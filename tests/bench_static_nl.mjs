// bench_static_nl.mjs — FEASIBILITY benchmark for NONLINEAR STATIC analysis
// (incremental Newton-Raphson) on a synthetic 3D building frame.
//
// A nonlinear static solve (geometric P-Δ or plastic pushover) is a loop:
//   for each load increment:               (STEPS)
//     for each Newton iteration:           (ITERS)
//       assemble tangent Kt(u)  +  solve Kt·Δu = residual
// so its cost is (STEPS·ITERS) × (assemble + solve). This measures both pieces with
// the repo's real functions, two ways:
//   CURRENT (dense)  — assembleK + assembleKg build dense nDOF² matrices; band
//                      Cholesky. Real today, but O(nDOF²) memory caps it ~6–8k DOF.
//   SPARSE (potential) — sparse assembly + PCG warm-started with an IC0 preconditioner
//                      built once per load step (modified Newton). O(nnz) memory.
//
// The point: show where the dense nonlinear path caps, and what a sparse rewrite buys.
//
// Run:  node tests/bench_static_nl.mjs            (sweep)
//       node tests/bench_static_nl.mjs 8 8 12     (one size)
import { Model } from '../js/model/model.js';
import { buildNodeIndex, assembleK } from '../js/solver/assembler.js';
import { assembleKg } from '../js/solver/geometric.js';
import { assembleSparseGlobal, extractFreeCSR } from '../js/solver/sparse.js';
import { makeFactor, makeFactorCSR, permRCM, permRCMcsr, csrMv } from '../js/solver/linsolve.js';
import { pcg, ic0 } from '../js/solver/pcg.js';

globalThis.window = globalThis;
await import('../lib/numeric.js');
globalThis.window.numeric = globalThis.numeric;

const now = () => Number(process.hrtime.bigint()) / 1e6;
const fmt = (v, w = 8) => String(v).padStart(w);

function building(nx, ny, nStories) {
  const m = new Model(); m.mode = '3D'; m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'H30', E: 2.5e7, G: 1.04e7, nu: 0.2, rho: 2.5 });
  const col = m.addSection({ name: 'col', A: 0.16, Iy: 2.13e-3, Iz: 2.13e-3, J: 3.6e-3, Avy: 0.13, Avz: 0.13 });
  const bm  = m.addSection({ name: 'beam', A: 0.12, Iy: 3.6e-3, Iz: 9e-4, J: 1.5e-3, Avy: 0.10, Avz: 0.10 });
  const SX = 5, SY = 5, H = 3, id = (i, j, k) => `${i},${j},${k}`, node = new Map();
  for (let k = 0; k <= nStories; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const n = m.addNode(i*SX, j*SY, k*H, k===0 ? {ux:1,uy:1,uz:1,rx:1,ry:1,rz:1} : undefined);
    node.set(id(i,j,k), n.id);
  }
  for (let k = 1; k <= nStories; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    m.addElement(node.get(id(i,j,k-1)), node.get(id(i,j,k)), mat.id, col.id);
    if (i < nx) m.addElement(node.get(id(i,j,k)), node.get(id(i+1,j,k)), mat.id, bm.id);
    if (j < ny) m.addElement(node.get(id(i,j,k)), node.get(id(i,j+1,k)), mat.id, bm.id);
  }
  return m;
}

const STEPS = 25, ITERS = 4;          // representative pushover: 25 load steps × 4 Newton iters
const DENSE_CAP = 6000;               // skip the dense path above this nDOF (memory)

function benchOne(nx, ny, ns) {
  const m = building(nx, ny, ns);
  const nodeIndex = buildNodeIndex(m);
  const nDOF = nodeIndex.size * 6;
  const freeMap = new Int32Array(nDOF).fill(-1);
  let nF = 0;
  for (const nd of m.nodes.values()) {
    const b = 6*nodeIndex.get(nd.id), r = nd.restraints || {};
    const rr = [r.ux,r.uy,r.uz,r.rx,r.ry,r.rz];
    for (let d=0; d<6; d++) if (!rr[d]) freeMap[b+d] = nF++;
  }
  const uFull = new Float64Array(nDOF);
  for (let i=0;i<nDOF;i++) uFull[i] = 1e-4*((i*7)%13-6);   // deterministic displacement to feed Kg

  // ── CURRENT dense path: assembleK + assembleKg + dense band factor ──────────
  let denseAsm = NaN, denseFac = NaN, denseSolve = NaN;
  if (nDOF <= DENSE_CAP) {
    let t = now();
    const { K, M } = assembleK(m, nodeIndex);
    const { Kg } = assembleKg(m, nodeIndex, uFull);
    denseAsm = now() - t;
    // Kt_ff = (K+Kg) reduced to free DOFs
    const free = []; for (let i=0;i<nDOF;i++) if (freeMap[i]>=0) free.push(i);
    const Kt = new Float64Array(nF*nF);
    for (let a=0;a<nF;a++){ const ia=free[a]; for (let b=0;b<nF;b++){ const jb=free[b]; Kt[a*nF+b] = K[ia*nDOF+jb] + Kg[ia*nDOF+jb]; } }
    t = now();
    const perm = permRCM(Kt, nF);
    const fac = makeFactor(Kt, nF, false, perm);
    denseFac = now() - t;
    const rhs = new Float64Array(nF).fill(1), out = new Float64Array(nF);
    t = now(); for (let k=0;k<20;k++) fac.solve(rhs, out); denseSolve = (now()-t)/20;
  }

  // ── SPARSE path: sparse assembly + IC0-preconditioned PCG warm-start ─────────
  let t = now();
  const { S: Ks } = assembleSparseGlobal(m, nodeIndex, { withMass: false });
  const spAsm = now() - t;
  const Kcsr = extractFreeCSR(Ks, freeMap, nF).csr;
  const nnz = Kcsr.val.length;

  // Factor-once (CSR band) for comparison
  t = now(); const perm = permRCMcsr(Kcsr); const facCsr = makeFactorCSR(Kcsr, perm); const facCsrMs = now()-t;
  const rhs = new Float64Array(nF).fill(1), out = new Float64Array(nF);
  let bandSolveMs = NaN;
  if (facCsr.ok) { t = now(); for (let k=0;k<20;k++) facCsr.solve(rhs, out); bandSolveMs = (now()-t)/20; }

  // PCG with a preconditioner BUILT ONCE (modified Newton: reuse across a step's iters)
  t = now(); const pre = ic0(Kcsr); const preMs = now()-t;
  const warm = new Float64Array(nF); let iters = 0, nS = 12;
  t = now();
  for (let k=0;k<nS;k++){ const r = pcg(Kcsr, rhs, { pre, x0: warm, tol: 1e-8 }); warm.set(r.x); iters += r.iters; }
  const pcgSolve = (now()-t)/nS, pcgIters = iters/nS;

  return { nodes: m.nodes.size, nF, nnz, denseAsm, denseFac, denseSolve, spAsm, facCsrMs, bandSolveMs, preMs, pcgSolve, pcgIters };
}

const argv = process.argv.slice(2).map(Number);
const sizes = argv.length>=2 ? [[argv[0],argv[1],argv[2]||12]] : [[3,3,5],[4,4,8],[6,6,10],[8,8,12],[10,10,15]];

console.log(`Nonlinear STATIC — feasibility (Newton-Raphson, pushover scenario = ${STEPS} steps × ${ITERS} iters = ${STEPS*ITERS} tangent solves)\n`);
console.log('  nodes    nF   nnz | DENSE(current): asm+Kg  factor  solve  → full-Newton total(s) | SPARSE: asm  IC0  PCG(it,ms)  → mod-Newton total(s)');
console.log('  '.padEnd(140, '─'));
for (const [nx,ny,ns] of sizes) {
  const r = benchOne(nx,ny,ns);
  // full Newton dense: every iteration re-assembles tangent + re-factors + solves
  const denseTot = (r.denseAsm != null && !isNaN(r.denseAsm))
    ? ((r.denseAsm + r.denseFac + r.denseSolve) * STEPS*ITERS / 1000) : NaN;
  // modified Newton sparse: assemble + IC0 once per STEP, PCG warm each iter
  const sparseTot = (r.spAsm + r.preMs) * STEPS / 1000 + r.pcgSolve * STEPS*ITERS / 1000;
  const dc = isNaN(denseTot) ? '   (capped: dense nDO²>mem)          ' :
    `${fmt(r.denseAsm.toFixed(0),8)} ${fmt(r.denseFac.toFixed(0),7)} ${fmt(r.denseSolve.toFixed(2),6)}  → ${fmt(denseTot.toFixed(1),6)}`;
  console.log(
    `  ${fmt(r.nodes,5)} ${fmt(r.nF,6)} ${fmt((r.nnz/1000).toFixed(0)+'k',5)} |` +
    ` ${dc} |` +
    ` ${fmt(r.spAsm.toFixed(0),5)} ${fmt(r.preMs.toFixed(0),4)} ${fmt(r.pcgIters.toFixed(0),2)}it ${fmt(r.pcgSolve.toFixed(1),5)}ms → ${fmt(sparseTot.toFixed(1),6)}`
  );
}
console.log('\nDENSE = the current assembleK/assembleKg (Float64Array nDOF²) → caps ~6–8k DOF. SPARSE = what a CSR rewrite would cost.');
console.log('full-Newton = re-factor every iteration. mod-Newton = factor/precond once per load step, reuse for its iterations.');
