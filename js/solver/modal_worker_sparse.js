// ──────────────────────────────────────────────────────────────────────────────
// modal_worker_sparse.js — SPARSE modal analysis off the main thread. Runs modalSparse
// (banded-Cholesky over CSR + O(nnz) mv products, no nF² densification) so large models
// whose dense Kff/Mff would not fit still solve. The main thread assembles the free-DOF
// CSR (K, optionally K+Kg, and M) and transfers the typed arrays zero-copy.
//
// Protocol:
//   Main → Worker: { Kcsr, Mcsr, nModes, method }   (CSR = {n, rowPtr, colIdx, val})
//   Worker → Main: { modes: [{omega2, vec}] }  |  { error }
// ──────────────────────────────────────────────────────────────────────────────
import { modalSparse } from './modal_sparse.js?v=7';

self.onmessage = (e) => {
  const { Kcsr, Mcsr, nModes, method } = e.data;
  try {
    const { modes } = modalSparse({ Kcsr, Mcsr, nModes, method });
    self.postMessage({ modes });
  } catch (err) {
    self.postMessage({ error: (err && err.message) ? err.message : String(err) });
  }
};
