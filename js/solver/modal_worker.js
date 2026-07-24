// ──────────────────────────────────────────────────────────────────────────────
// modal_worker.js — Stodola inverse iteration for the modal analysis, off the main
// thread. MODULE worker: uses the in-house solver (banded Cholesky with a single
// factorization) instead of numeric.js, and matrix·vector products ONLY within the
// band (O(n·b) instead of O(n²)). Much faster on large models.
//
// Protocol:
//   Main → Worker: { Kff_flat, Mff_flat, nF, nModes, dense }
//   Worker → Main: { modes: [{omega2, vec}] }  |  { error }
// ──────────────────────────────────────────────────────────────────────────────
import { makeFactor, rowBands, permRCM } from './linsolve.js?v=7';
import { modalIterate } from './modal_core.js?v=7';

// Product A·x using the per-row extent (variable band) → O(n·b). This is the ONLY
// backend-specific kernel; the eigensolver cores themselves live in modal_core.js and
// are shared verbatim with the sparse/CSR path (modal_sparse.js).
function _mvBand(A, x, n, lo, hi) {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0; const off = i * n, a = lo[i], b = hi[i];
    for (let j = a; j <= b; j++) s += A[off + j] * x[j];
    y[i] = s;
  }
  return y;
}

self.onmessage = (e) => {
  const { Kff_flat, Mff_flat, nF, nModes, dense, method } = e.data;
  try {
    // Regularize the diagonal of M (zero masses → small positive)
    let maxMd = 0;
    for (let i = 0; i < nF; i++) maxMd = Math.max(maxMd, Math.abs(Mff_flat[i * nF + i]));
    if (maxMd < 1e-30) { self.postMessage({ error: 'Matriz de masas nula. Asigne densidad ρ a los materiales o masa a los diafragmas.' }); return; }
    const eps = maxMd * 1e-8;
    for (let i = 0; i < nF; i++) if (Math.abs(Mff_flat[i * nF + i]) < eps) Mff_flat[i * nF + i] = eps;

    // REORDER K and M into banded form (RCM) once: this way the factorization, the
    // solve AND the matrix·vector products stay in O(n·b). In the banded path we
    // operate in the permuted space; the modes are un-permuted at the end. In the
    // dense path no reordering is needed (operated as-is).
    let Kp = Kff_flat, Mp = Mff_flat, perm = null, facPerm = null;
    if (!dense) {
      perm = permRCM(Kff_flat, nF);
      facPerm = new Int32Array(nF); for (let i = 0; i < nF; i++) facPerm[i] = i;
      Kp = new Float64Array(nF * nF); Mp = new Float64Array(nF * nF);
      for (let i = 0; i < nF; i++) {
        const pi = perm[i] * nF, oi = i * nF;
        for (let j = 0; j < nF; j++) { const pj = perm[j]; Kp[oi + j] = Kff_flat[pi + pj]; Mp[oi + j] = Mff_flat[pi + pj]; }
      }
    }

    const fac = makeFactor(Kp, nF, !!dense, facPerm);
    if (!fac.ok) { self.postMessage({ error: 'Factorización de K falló (¿estructura inestable / sin apoyos?).' }); return; }

    // Matrix·vector products only within the band (of the reordered matrix)
    const KB = rowBands(Kp, nF), MB = rowBands(Mp, nF);
    const mvK = (x) => _mvBand(Kp, x, nF, KB.lo, KB.hi);
    const mvM = (x) => _mvBand(Mp, x, nF, MB.lo, MB.hi);
    const solveK = (b) => fac.solve(b);

    const modes = modalIterate(mvK, mvM, solveK, nF, nModes, method);
    if (!modes.length) { self.postMessage({ error: 'Sin modos estructurales. Verifique masa (ρ en material o diafragmas) y apoyos.' }); return; }
    // Un-permute the mode vectors back to the original order
    if (perm) for (const md of modes) {
      const v = new Float64Array(nF); for (let i = 0; i < nF; i++) v[perm[i]] = md.vec[i]; md.vec = Array.from(v);
    }
    self.postMessage({ modes });
  } catch (err) {
    self.postMessage({ error: (err && err.message) ? err.message : String(err) });
  }
};
