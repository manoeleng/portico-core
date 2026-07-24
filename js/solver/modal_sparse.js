// ──────────────────────────────────────────────────────────────────────────────
// modal_sparse.js — SPARSE modal eigensolver: the same Stodola / subspace iteration
// as the dense banded worker (modal_core.js), but backed by CSR matrices and the
// repo's banded-Cholesky factorization (makeFactorCSR) + CSR matrix·vector products.
//
// The dense modal path stores K and M as nF² arrays (four of them, once reordered) and
// only RESTRICTS the arithmetic to the band — so compute is O(n·b) but MEMORY is O(nF²),
// the real ceiling on large models. Here nothing is ever densified: K/M live in CSR, the
// factorization is banded Cholesky over the CSR, and every mv is O(nnz). This is what the
// direct-integration and P-Δ/buckling solvers already do; the modal analysis now shares it.
//
// SELF-CONTAINED (no DOM, no worker): verifiable in Node against a closed-form cantilever
// AND, DOF-for-DOF, against the dense ModalSolver (test_modal_sparse.mjs).
// ──────────────────────────────────────────────────────────────────────────────
import { csrMv, makeFactorCSR, permRCMcsr } from './linsolve.js?v=7';
import { modalIterate } from './modal_core.js?v=7';

// Return a CSR copy of M with every diagonal entry present and floored to `eps` when it
// is (near) zero — the same regularization the dense worker applies, so massless DOFs
// (ρ=0 rotations, internal nodes) become high-frequency and the iteration skips them
// instead of dividing by a zero mass. Off-diagonals are untouched.
export function floorMassDiagonal(csr, eps) {
  const { n, rowPtr, colIdx, val } = csr;
  const rp = new Int32Array(n + 1);
  const cols = [], vals = [];
  for (let i = 0; i < n; i++) {
    let seenDiag = false, inserted = false;
    for (let p = rowPtr[i]; p < rowPtr[i + 1]; p++) {
      const j = colIdx[p];
      // Insert the diagonal in ascending order if it is missing from this row.
      if (!seenDiag && !inserted && j > i) { cols.push(i); vals.push(eps); inserted = true; }
      if (j === i) { seenDiag = true; cols.push(i); vals.push(Math.abs(val[p]) < eps ? eps : val[p]); }
      else { cols.push(j); vals.push(val[p]); }
    }
    if (!seenDiag && !inserted) { cols.push(i); vals.push(eps); }   // diagonal after all cols
    rp[i + 1] = cols.length;
  }
  return { n, rowPtr: rp, colIdx: Int32Array.from(cols), val: Float64Array.from(vals) };
}

/**
 * Sparse modal analysis of the free–free system.
 * @param {object} o
 *   Kcsr, Mcsr  CSR of the FREE-DOF stiffness/mass (n×n). Kcsr may already include Kg.
 *   nModes      number of modes to extract (default 10).
 *   method      'stodola' (default) | 'subspace'.
 * @returns {{modes:[{omega2,vec}]}}  vec is length n (free DOFs), M-normalized.
 * @throws on a null mass matrix or a non-factorable K (unstable/no supports).
 */
export function modalSparse({ Kcsr, Mcsr, nModes = 10, method = 'stodola' }) {
  const n = Kcsr.n;

  // Mass floor from the largest diagonal (same rule as the dense path).
  let maxMd = 0;
  for (let i = 0; i < n; i++) for (let p = Mcsr.rowPtr[i]; p < Mcsr.rowPtr[i + 1]; p++) {
    if (Mcsr.colIdx[p] === i) { const a = Math.abs(Mcsr.val[p]); if (a > maxMd) maxMd = a; }
  }
  if (maxMd < 1e-30) throw new Error('Matriz de masas nula. Asigne densidad ρ a los materiales o masa a los diafragmas.');
  const Mf = floorMassDiagonal(Mcsr, maxMd * 1e-8);

  // Factor K once (RCM + banded Cholesky over the CSR); mv products stay O(nnz).
  const fac = makeFactorCSR(Kcsr, permRCMcsr(Kcsr));
  if (!fac.ok) throw new Error('Factorización de K falló (¿estructura inestable / sin apoyos?).');

  const mvK = (x) => csrMv(Kcsr, x);
  const mvM = (x) => csrMv(Mf, x);
  const solveK = (b) => fac.solve(b);

  const modes = modalIterate(mvK, mvM, solveK, n, nModes, method);
  if (!modes.length) throw new Error('Sin modos estructurales. Verifique masa (ρ en material o diafragmas) y apoyos.');
  return { modes };
}
