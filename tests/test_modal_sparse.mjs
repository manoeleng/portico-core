// test_modal_sparse.mjs — the SPARSE modal eigensolver (js/solver/modal_sparse.js +
// modal_core.js): the same Stodola / subspace iteration as the dense banded worker, but
// on CSR matrices with banded-Cholesky factorization — no nF² densification.
//
//   (1) Natural frequencies of a cantilever match Euler-Bernoulli (the same closed form
//       test_modal_beam pins the dense pipeline to).
//   (2) Sparse frequencies match the DENSE ModalSolver mode-for-mode (machine precision).
//   (3) Recovered modes are M-orthonormal (φᵀMφ = I) — deflation / projection correctness.
//   (4) Both cores (stodola, subspace) agree.
//
// Run:  node test_modal_sparse.mjs
import { Model } from '../js/model/model.js';
globalThis.window = globalThis;
await import('../lib/numeric.js');                       // for the dense ModalSolver cross-check
const { ModalSolver } = await import('../js/solver/modal_solver.js');
const { modalSparse, floorMassDiagonal } = await import('../js/solver/modal_sparse.js');
const { buildNodeIndex } = await import('../js/solver/assembler.js');
const { assembleSparseGlobal, extractFreeCSR } = await import('../js/solver/sparse.js');
const { csrMv } = await import('../js/solver/linsolve.js');

let failures = 0;
const check = (cond, msg, extra = '') => { console.log(`  ${cond ? 'OK  ' : 'FAIL'} ${msg}${extra ? '  ' + extra : ''}`); if (!cond) failures++; };
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

const E = 2.1e11, G = 8.0e10, rho = 7850;
const A = 0.01, Iz = 8e-6, Iy = 8e-6, J = 1e-6, L = 4.0, nEl = 12;

const m = new Model();
m.materials.clear(); m.sections.clear();
const mat = m.addMaterial({ name: 'Steel', E, G, nu: 0.3125, rho });
const sec = m.addSection({ name: 'B', A, Iy, Iz, J, Avy: 1e30, Avz: 1e30, kappay: 1, kappaz: 1 });
const nodes = [];
for (let k = 0; k <= nEl; k++) nodes.push(m.addNode((L / nEl) * k, 0, 0, { ux: 1, uz: 1, rx: 1, ry: 1 }));
m.updateNode(nodes[0].id, { restraints: { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 } });
for (let k = 0; k < nEl; k++) m.addElement(nodes[k].id, nodes[k + 1].id, mat.id, sec.id);

// Sparse free-DOF CSR assembly (K and M)
const nodeIndex = buildNodeIndex(m);
const nDOF = nodeIndex.size * 6;
const freeMap = new Int32Array(nDOF).fill(-1);
let nF = 0;
for (const nd of m.nodes.values()) {
  const b = 6 * nodeIndex.get(nd.id), r = nd.restraints || {};
  const rr = [r.ux, r.uy, r.uz, r.rx, r.ry, r.rz];
  for (let d = 0; d < 6; d++) if (!rr[d]) freeMap[b + d] = nF++;
}
const { S: Ks, M: Ms } = assembleSparseGlobal(m, nodeIndex, { withMass: true });
const Kcsr = extractFreeCSR(Ks, freeMap, nF).csr;
const Mcsr = extractFreeCSR(Ms, freeMap, nF).csr;

const betaL = [1.875104, 4.694091, 7.854757];
const fa = betaL.map(b => b * b / (2 * Math.PI) * Math.sqrt(E * Iz / (rho * A)) / (L * L));
const freqOf = (modes) => modes.map(md => Math.sqrt(Math.max(md.omega2, 0)) / (2 * Math.PI));

// ── (1) Sparse frequencies vs Euler-Bernoulli ────────────────────────────────
console.log('── (1) sparse cantilever frequencies vs Euler-Bernoulli ──');
const spSub = modalSparse({ Kcsr, Mcsr, nModes: 3, method: 'subspace' });
const fSp = freqOf(spSub.modes);
const tol = [0.01, 0.02, 0.04];
for (let i = 0; i < 3; i++) check(rel(fSp[i], fa[i]) < tol[i], `f${i + 1} = ${fSp[i].toFixed(3)} Hz`, `(analytic ${fa[i].toFixed(3)}, err ${(rel(fSp[i], fa[i]) * 100).toFixed(2)}%)`);
check(fSp[0] < fSp[1] && fSp[1] < fSp[2], 'frequencies strictly ascending');

// ── (2) Sparse ≡ dense ModalSolver ───────────────────────────────────────────
console.log('\n── (2) sparse ≡ dense ModalSolver (mode-for-mode) ──');
const dense = new ModalSolver().solve(m, 3);
for (let i = 0; i < 3; i++) check(rel(fSp[i], dense.freq[i]) < 1e-6, `f${i + 1}: sparse ${fSp[i].toFixed(4)} ≡ dense ${dense.freq[i].toFixed(4)} Hz`, `(rel ${(rel(fSp[i], dense.freq[i])).toExponential(1)})`);

// ── (3) M-orthonormality of the sparse modes ─────────────────────────────────
console.log('\n── (3) sparse modes are M-orthonormal (φᵀMφ = I) ──');
{
  const V = spSub.modes.map(md => Float64Array.from(md.vec));
  let maxOff = 0, maxDiag = 0;
  for (let i = 0; i < V.length; i++) for (let j = 0; j < V.length; j++) {
    const Mvj = csrMv(Mcsr, V[j]);
    let d = 0; for (let k = 0; k < nF; k++) d += V[i][k] * Mvj[k];
    if (i === j) maxDiag = Math.max(maxDiag, Math.abs(d - 1));
    else maxOff = Math.max(maxOff, Math.abs(d));
  }
  check(maxOff < 1e-8, 'off-diagonal φiᵀMφj ≈ 0', `(max ${maxOff.toExponential(1)})`);
  check(maxDiag < 1e-6, 'diagonal φiᵀMφi ≈ 1', `(max dev ${maxDiag.toExponential(1)})`);
}

// ── (4) Stodola core agrees with subspace ────────────────────────────────────
console.log('\n── (4) stodola core agrees with subspace ──');
{
  const spSto = modalSparse({ Kcsr, Mcsr, nModes: 3, method: 'stodola' });
  const fSto = freqOf(spSto.modes);
  for (let i = 0; i < 3; i++) check(rel(fSto[i], fSp[i]) < 1e-5, `f${i + 1}: stodola ${fSto[i].toFixed(4)} ≡ subspace ${fSp[i].toFixed(4)} Hz`);
}

// ── (5) Mass-diagonal floor helper ───────────────────────────────────────────
console.log('\n── (5) floorMassDiagonal inserts/floors the diagonal ──');
{
  // A 2×2 CSR with a missing and a tiny diagonal entry.
  const csr = { n: 2, rowPtr: Int32Array.from([0, 1, 3]), colIdx: Int32Array.from([1, 0, 1]), val: Float64Array.from([5, 5, 1e-20]) };
  const f = floorMassDiagonal(csr, 1e-6);
  const d0 = (() => { for (let p = f.rowPtr[0]; p < f.rowPtr[1]; p++) if (f.colIdx[p] === 0) return f.val[p]; return null; })();
  const d1 = (() => { for (let p = f.rowPtr[1]; p < f.rowPtr[2]; p++) if (f.colIdx[p] === 1) return f.val[p]; return null; })();
  check(d0 === 1e-6, 'missing diagonal inserted at eps', `(row0 diag=${d0})`);
  check(d1 === 1e-6, 'tiny diagonal floored to eps', `(row1 diag=${d1})`);
}

console.log(`\n=== ${failures === 0 ? 'ALL OK' : failures + ' FAILURE(S)'} ===`);
process.exit(failures === 0 ? 0 : 1);
