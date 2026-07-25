// bench_direct_th.mjs — FEASIBILITY benchmark for full-model DIRECT time integration
// (linear Newmark-β, average acceleration) on a synthetic 3D building frame.
//
// Goal: real timings on THIS machine, in JS, using the repo's own solver infra
// (sparse assembly + factor-once + PCG). Answers "can direct integration handle
// many nodes in JS?" with numbers instead of hand-waving.
//
// It measures the two solve strategies a real implementation would choose between:
//   [A] FACTOR-ONCE  — K_eff = K + a1·M + b1·C is CONSTANT for constant Δt, so a
//                      single banded-Cholesky factorization (makeFactorCSR) is
//                      reused every step via back-substitution. Fastest per step;
//                      memory ~ nF·bandwidth.
//   [B] PCG warm-start — no factorization; each step is a preconditioned CG solve
//                      started from the previous step's u (few iterations because u
//                      barely moves step to step). Memory ~ O(nnz); scales to huge
//                      models the band factor can't hold.
//
// Everything is SPARSE (CSR): no dense nDOF² matrix is ever formed, and the RHS
// matvecs are O(nnz) — exactly the cost a production integrator would pay.
//
// Run:   node tests/bench_direct_th.mjs                (default size sweep)
//        node tests/bench_direct_th.mjs 10 15 800      (bays=10, stories=15, 800 steps)
import { Model } from '../js/model/model.js';
import { buildNodeIndex } from '../js/solver/assembler.js';
import { assembleSparseGlobal, extractFreeCSR, SparseSym } from '../js/solver/sparse.js';
import { makeFactorCSR, permRCMcsr, csrMv } from '../js/solver/linsolve.js';
import { pcg } from '../js/solver/pcg.js';

globalThis.window = globalThis;
await import('../lib/numeric.js');
globalThis.window.numeric = globalThis.numeric;

const now = () => Number(process.hrtime.bigint()) / 1e6;   // ms
const fmt = (v, w = 8) => String(v).padStart(w);

// ── Synthetic 3D moment frame: nx×ny bays, nStories tall ─────────────────────
// Columns + beams in X and Y. Base level fully fixed. Realistic connectivity so the
// RCM bandwidth is representative (not an artificially thin 1-D chain).
function building(nx, ny, nStories) {
  const m = new Model(); m.mode = '3D'; m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'H30', E: 2.5e7, G: 1.04e7, nu: 0.2, rho: 2.5 });   // rho = mass density (t/m³)
  const col = m.addSection({ name: 'col', A: 0.16, Iy: 2.13e-3, Iz: 2.13e-3, J: 3.6e-3, Avy: 0.13, Avz: 0.13 }); // 0.4×0.4
  const bm  = m.addSection({ name: 'beam', A: 0.12, Iy: 3.6e-3, Iz: 9e-4, J: 1.5e-3, Avy: 0.10, Avz: 0.10 });    // 0.3×0.4
  const SX = 5, SY = 5, H = 3;
  const id = (i, j, k) => `${i},${j},${k}`;
  const node = new Map();
  for (let k = 0; k <= nStories; k++)
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        const base = k === 0;
        const n = m.addNode(i * SX, j * SY, k * H,
          base ? { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 } : undefined);
        node.set(id(i, j, k), n.id);
      }
  for (let k = 1; k <= nStories; k++)
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        m.addElement(node.get(id(i, j, k - 1)), node.get(id(i, j, k)), mat.id, col.id);          // column
        if (i < nx) m.addElement(node.get(id(i, j, k)), node.get(id(i + 1, j, k)), mat.id, bm.id); // beam X
        if (j < ny) m.addElement(node.get(id(i, j, k)), node.get(id(i, j + 1, k)), mat.id, bm.id); // beam Y
      }
  return m;
}

// α·K + β·M as a fresh SparseSym (used to build K_eff without densifying).
function combine(Ks, Ms, nDOF, a, b) {
  const R = new SparseSym(nDOF);
  for (let i = 0; i < nDOF; i++) { for (const [j, v] of Ks.rows[i]) R.add(i, j, a * v); }
  for (let i = 0; i < nDOF; i++) { for (const [j, v] of Ms.rows[i]) R.add(i, j, b * v); }
  return R;
}

function benchOne(nx, ny, nStories, nSteps) {
  const m = building(nx, ny, nStories);
  const nodeIndex = buildNodeIndex(m);
  const nDOF = nodeIndex.size * 6;

  // Free-DOF map
  const freeMap = new Int32Array(nDOF).fill(-1);
  let nF = 0;
  for (const nd of m.nodes.values()) {
    const b = 6 * nodeIndex.get(nd.id), r = nd.restraints || {};
    const rr = [r.ux, r.uy, r.uz, r.rx, r.ry, r.rz];
    for (let d = 0; d < 6; d++) if (!rr[d]) freeMap[b + d] = nF++;
  }

  // ── Assembly (K, M sparse) ───────────────────────────────────────────────
  let t = now();
  const { S: Ks, M: Ms } = assembleSparseGlobal(m, nodeIndex, { withMass: true });
  const asmMs = now() - t;

  // Rayleigh C = a0·M + a1·K targeting 5% at 1 Hz and 10 Hz
  const z = 0.05, w1 = 2 * Math.PI * 1, w2 = 2 * Math.PI * 10;
  const a0 = z * 2 * w1 * w2 / (w1 + w2), a1 = z * 2 / (w1 + w2);

  // Newmark average-acceleration constants (γ=½, β=¼)
  const dt = 0.005, g = 0.5, beta = 0.25;
  const a1c = 1 / (beta * dt * dt), a2c = 1 / (beta * dt), a3c = 1 / (2 * beta) - 1;
  const b1c = g / (beta * dt), b2c = g / beta - 1, b3c = dt * (g / (2 * beta) - 1);

  // K_eff = (1 + b1c·a1)·K + (a1c + b1c·a0)·M
  const Keff_S = combine(Ks, Ms, nDOF, 1 + b1c * a1, a1c + b1c * a0);

  const Kcsr   = extractFreeCSR(Ks,   freeMap, nF).csr;
  const Mcsr   = extractFreeCSR(Ms,   freeMap, nF).csr;
  const Keffcsr = extractFreeCSR(Keff_S, freeMap, nF).csr;
  const nnz = Keffcsr.val.length;

  // Influence vector ι (global X = local DOF 0 of each node) and constant load part
  const iota = new Float64Array(nF);
  for (let i = 0; i < nDOF; i++) if (freeMap[i] >= 0 && i % 6 === 0) iota[freeMap[i]] = 1;
  const Miota = new Float64Array(nF); csrMv(Mcsr, iota, Miota);      // M·ι  (constant)
  const ag = (kStep) => 2.0 * Math.sin(2 * Math.PI * 2 * kStep * dt) * Math.exp(-0.15 * kStep * dt);  // synthetic m/s²

  // reusable buffers (no allocation inside the step loop)
  const u = new Float64Array(nF), v = new Float64Array(nF), acc = new Float64Array(nF);
  const w = new Float64Array(nF), Mw = new Float64Array(nF), Kw = new Float64Array(nF), rhs = new Float64Array(nF);
  const uNew = new Float64Array(nF);

  const rhsStep = (kStep) => {
    const ap = -ag(kStep + 1);
    for (let i = 0; i < nF; i++) w[i] = a1c * u[i] + a2c * v[i] + a3c * acc[i];
    csrMv(Mcsr, w, Mw);
    for (let i = 0; i < nF; i++) w[i] = b1c * u[i] + b2c * v[i] + b3c * acc[i];
    csrMv(Mcsr, w, rhs); csrMv(Kcsr, w, Kw);            // C·w = a0·M·w + a1·K·w
    for (let i = 0; i < nF; i++) rhs[i] = ap * Miota[i] + Mw[i] + a0 * rhs[i] + a1 * Kw[i];
    return rhs;
  };
  const update = () => {
    for (let i = 0; i < nF; i++) {
      const du = uNew[i] - u[i];
      const vN = b1c * du + (1 - g / beta) * v[i] + dt * (1 - g / (2 * beta)) * acc[i];
      const aN = a1c * du - a2c * v[i] - a3c * acc[i];
      u[i] = uNew[i]; v[i] = vN; acc[i] = aN;
    }
  };

  // Bandwidth after RCM (governs factor cost/memory)
  const perm = permRCMcsr(Keffcsr);

  // ── [A] Factor-once ───────────────────────────────────────────────────────
  let facMs = NaN, stepA = NaN, bandMem = NaN, m_band = NaN;
  t = now();
  const fac = makeFactorCSR(Keffcsr, perm);
  facMs = now() - t;
  if (fac.ok) {
    m_band = fac.m; bandMem = nF * (fac.m || 0) * 8;
    u.fill(0); v.fill(0); acc.fill(0);
    t = now();
    for (let k = 0; k < nSteps; k++) { fac.solve(rhsStep(k), uNew); update(); }
    stepA = (now() - t) / nSteps;
  }

  // ── [B] PCG warm-start ────────────────────────────────────────────────────
  u.fill(0); v.fill(0); acc.fill(0);
  let itersSum = 0, warm = new Float64Array(nF);
  t = now();
  const bSteps = Math.min(nSteps, 200);       // PCG path is the slow one; sample fewer
  for (let k = 0; k < bSteps; k++) {
    const r = pcg(Keffcsr, rhsStep(k), { pre: 'ic0', x0: warm, tol: 1e-8 });
    itersSum += r.iters; uNew.set(r.x); warm.set(r.x); update();
  }
  const stepB = (now() - t) / bSteps, avgIters = itersSum / bSteps;

  return { nodes: m.nodes.size, nF, nnz, m_band, asmMs, facMs, stepA, stepB, avgIters, bandMem };
}

// ── Run ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2).map(Number);
let sizes;
if (argv.length >= 2) sizes = [[argv[0], argv[1], argv[2] || 12]];
else sizes = [[3,3,5],[4,4,8],[6,6,10],[8,8,12],[10,10,15]];   // ~0.6k → ~12k DOF
const NSTEPS = argv[2] || (argv.length >= 2 ? 500 : 500);

console.log(`Direct time integration — feasibility benchmark (Newmark avg-accel, Δt=0.005s, ${NSTEPS} steps)\n`);
console.log('  nodes    nF    nnz   band | assemble  factor   [A] ms/step  A total(s) | [B] CG it  [B] ms/step  B total(s)');
console.log('  '.padEnd(112, '─'));
for (const [nx, ny, ns] of sizes) {
  const r = benchOne(nx, ny, ns, NSTEPS);
  const aTot = (r.stepA * NSTEPS / 1000);
  const bTot = (r.stepB * NSTEPS / 1000);
  const memMB = (r.bandMem / 1048576);
  console.log(
    `  ${fmt(r.nodes,5)} ${fmt(r.nF,6)} ${fmt((r.nnz/1000).toFixed(0)+'k',6)} ${fmt(r.m_band,5)} |` +
    ` ${fmt(r.asmMs.toFixed(0),7)} ${fmt(r.facMs.toFixed(0),7)} ` +
    ` ${fmt(r.stepA.toFixed(3),11)} ${fmt(aTot.toFixed(1),9)} |` +
    ` ${fmt(r.avgIters.toFixed(1),7)} ${fmt(r.stepB.toFixed(3),11)} ${fmt(bTot.toFixed(1),9)}` +
    `   (band ~${memMB.toFixed(0)}MB)`
  );
}
console.log('\n[A] factor-once = one factorization reused every step (constant Δt).  [B] = PCG warm-started from previous step.');
console.log('ms/step × your real step count = wall time in a Web Worker. Factor + assembly are one-time.');
