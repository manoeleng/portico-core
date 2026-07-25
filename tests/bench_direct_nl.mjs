// bench_direct_nl.mjs — FEASIBILITY benchmark for NONLINEAR DIRECT time integration
// (Newmark-β + Newton-Raphson per step) on a synthetic 3D building frame. The heaviest
// analysis in the suite.
//
//   M·ü + C·u̇ + r(u) = −M·ι·a_g(t)      integrated step by step, Newton per step.
//
// Cost per time step = (Newton iters) × (tangent solve). The saving grace: the tangent
// K_eff = Kt + c1·M + c2·C only changes when the plastic state changes (a hinge forms or
// unloads). Most steps are elastic → the factorization / preconditioner is REUSED and
// each Newton iteration is a cheap PCG warm-started solve. Only on the fraction of steps
// with a plastic event do we re-assemble and rebuild the preconditioner.
//
// This runs a real loop (sparse, O(nnz)) and extrapolates to a full record.
//
// Run:  node tests/bench_direct_nl.mjs                      (sweep)
//       node tests/bench_direct_nl.mjs 8 8 12 400 2 20      (bays,stories, measSteps, newtonIters, updateEvery)
import { Model } from '../js/model/model.js';
import { buildNodeIndex } from '../js/solver/assembler.js';
import { assembleSparseGlobal, extractFreeCSR, SparseSym } from '../js/solver/sparse.js';
import { csrMv } from '../js/solver/linsolve.js';
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

function combine(Ks, Ms, nDOF, a, b) {
  const R = new SparseSym(nDOF);
  for (let i=0;i<nDOF;i++) for (const [j,v] of Ks.rows[i]) R.add(i,j,a*v);
  for (let i=0;i<nDOF;i++) for (const [j,v] of Ms.rows[i]) R.add(i,j,b*v);
  return R;
}

const FULL_RECORD = 6000;             // steps in a real 30 s record at Δt = 0.005 s

function benchOne(nx, ny, ns, measSteps, nIter, updateEvery) {
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

  const { S: Ks, M: Ms } = assembleSparseGlobal(m, nodeIndex, { withMass: true });
  const z = 0.05, w1 = 2*Math.PI*1, w2 = 2*Math.PI*10;
  const a0 = z*2*w1*w2/(w1+w2), a1 = z*2/(w1+w2);
  const dt = 0.005, g = 0.5, beta = 0.25;
  const a1c = 1/(beta*dt*dt), a2c = 1/(beta*dt), a3c = 1/(2*beta)-1;
  const b1c = g/(beta*dt), b2c = g/beta-1, b3c = dt*(g/(2*beta)-1);

  const Kcsr = extractFreeCSR(Ks, freeMap, nF).csr;
  const Mcsr = extractFreeCSR(Ms, freeMap, nF).csr;
  const buildKeff = () => extractFreeCSR(combine(Ks, Ms, nDOF, 1+b1c*a1, a1c+b1c*a0), freeMap, nF).csr;
  let Keffcsr = buildKeff();
  const nnz = Keffcsr.val.length;

  const iota = new Float64Array(nF);
  for (let i=0;i<nDOF;i++) if (freeMap[i]>=0 && i%6===0) iota[freeMap[i]] = 1;
  const Miota = new Float64Array(nF); csrMv(Mcsr, iota, Miota);
  const ag = (k) => 3.0*Math.sin(2*Math.PI*2*k*dt)*Math.exp(-0.1*k*dt);

  const u = new Float64Array(nF), v = new Float64Array(nF), acc = new Float64Array(nF);
  const w = new Float64Array(nF), Mw = new Float64Array(nF), Kw = new Float64Array(nF);
  const rhs = new Float64Array(nF), uNew = new Float64Array(nF), tmp = new Float64Array(nF);

  const dynRhs = (k) => {
    const ap = -ag(k+1);
    for (let i=0;i<nF;i++) w[i] = a1c*u[i]+a2c*v[i]+a3c*acc[i];
    csrMv(Mcsr, w, Mw);
    for (let i=0;i<nF;i++) w[i] = b1c*u[i]+b2c*v[i]+b3c*acc[i];
    csrMv(Mcsr, w, rhs); csrMv(Kcsr, w, Kw);
    for (let i=0;i<nF;i++) rhs[i] = ap*Miota[i]+Mw[i]+a0*rhs[i]+a1*Kw[i];
    return rhs;
  };
  const update = () => {
    for (let i=0;i<nF;i++){ const du=uNew[i]-u[i];
      const vN=b1c*du+(1-g/beta)*v[i]+dt*(1-g/(2*beta))*acc[i];
      const aN=a1c*du-a2c*v[i]-a3c*acc[i];
      u[i]=uNew[i]; v[i]=vN; acc[i]=aN; }
  };

  // ── Newmark + Newton loop, sparse, PCG warm-start; tangent rebuilt on "events" ──
  let pre = ic0(Keffcsr);
  const warm = new Float64Array(nF);
  let tangentRebuilds = 0, newtonSolves = 0, itersSum = 0;
  const t0 = now();
  for (let k=0; k<measSteps; k++) {
    // plastic EVENT every `updateEvery` steps → re-assemble tangent + rebuild preconditioner
    if (k > 0 && k % updateEvery === 0) { Keffcsr = buildKeff(); pre = ic0(Keffcsr); tangentRebuilds++; }
    const base = dynRhs(k);
    warm.set(u);                                   // dynamic warm start from current displacement
    for (let it=0; it<nIter; it++) {
      // Newton residual for a nonlinear step ≈ base − Keff·u_trial (elastic part) + hinge correction.
      csrMv(Keffcsr, warm, tmp);
      for (let i=0;i<nF;i++) tmp[i] = base[i] - tmp[i] + Keffcsr.val[0]*0;   // residual (hinge corr ~0 in benchmark)
      const r = pcg(Keffcsr, tmp, { pre, x0: new Float64Array(nF), tol: 1e-8 });
      for (let i=0;i<nF;i++) warm[i] += r.x[i];
      itersSum += r.iters; newtonSolves++;
    }
    uNew.set(warm); update();
  }
  const loopMs = now() - t0;

  const msPerStep = loopMs / measSteps;
  const avgIters = itersSum / newtonSolves;
  return { nodes: m.nodes.size, nF, nnz, msPerStep, avgIters, nIter, updateEvery,
           fullRecordS: msPerStep * FULL_RECORD / 1000 };
}

const argv = process.argv.slice(2).map(Number);
const one = argv.length >= 2;
const sizes = one ? [[argv[0],argv[1],argv[2]||12]] : [[3,3,5],[4,4,8],[6,6,10],[8,8,12],[10,10,15]];
const MEAS = one ? (argv[3]||400) : 400;
const NITER = one ? (argv[4]||2) : 2;          // Newton iters per step (2 typical when mostly elastic)
const UPD  = one ? (argv[5]||20) : 20;         // a plastic event (tangent rebuild) every 20 steps (5%)

console.log(`Nonlinear DIRECT integration — feasibility (Newmark+Newton, ${NITER} Newton it/step, tangent rebuild every ${UPD} steps)`);
console.log(`measuring ${MEAS} steps, extrapolating to a ${FULL_RECORD}-step record (30 s at Δt=0.005 s)\n`);
console.log('  nodes    nF   nnz | PCG it/solve   ms/step | FULL record (6000 steps)');
console.log('  '.padEnd(88, '─'));
for (const [nx,ny,ns] of sizes) {
  const r = benchOne(nx,ny,ns, MEAS, NITER, UPD);
  console.log(
    `  ${fmt(r.nodes,5)} ${fmt(r.nF,6)} ${fmt((r.nnz/1000).toFixed(0)+'k',5)} |` +
    ` ${fmt(r.avgIters.toFixed(1),8)}     ${fmt(r.msPerStep.toFixed(2),7)} |` +
    ` ${fmt(r.fullRecordS.toFixed(0),6)} s  (${(r.fullRecordS/60).toFixed(1)} min)`
  );
}
console.log('\nWarm start = each step starts Newton from the current displacement (u barely moves per Δt).');
console.log('Most steps reuse the factorization/preconditioner; only plastic events (every ' + UPD + ' steps) rebuild it.');
console.log('All sparse (O(nnz)); runs in a Web Worker so the UI stays responsive.');
