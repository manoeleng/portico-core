// ──────────────────────────────────────────────────────────────────────────────
// modal_core.js — the ALGEBRA-AGNOSTIC modal eigensolver cores (Stodola inverse
// iteration and Bathe subspace iteration), extracted so they can run on EITHER a dense
// banded backend (modal_worker.js) or a sparse CSR backend (modal_sparse.js). The cores
// only ever touch the linear algebra through three closures:
//
//     mvK(x)    → K·x        mvM(x) → M·x        solveK(b) → K⁻¹·b
//
// so the same iteration works whether K is a dense band or a CSR factorized by banded
// Cholesky. Everything else (dot products, M-orthogonalization, the small q×q projected
// eigenproblem) is O(nF) or O(q³) and shared verbatim.
// ──────────────────────────────────────────────────────────────────────────────

export function modalDot(a, b, n) { let s = 0; for (let i = 0; i < n; i++) s += a[i] * b[i]; return s; }

function mNorm(x, mvM, n) {
  const Mx = mvM(x);
  const norm = Math.sqrt(Math.max(modalDot(x, Mx, n), 0));
  if (norm < 1e-30) return x;
  for (let i = 0; i < n; i++) x[i] /= norm;
  return x;
}

function mOrtho(x, found, mvM, n) {
  for (const { vec: phi } of found) {
    const Mphi = mvM(phi);
    const c = modalDot(x, Mphi, n);
    for (let i = 0; i < n; i++) x[i] -= c * phi[i];
  }
}

// Stodola inverse power iteration with M-orthogonal deflation. solveK(b) solves K·y = b.
export function stodola(mvK, mvM, solveK, nF, nModes) {
  const found = [];
  for (let modeNum = 0; modeNum < nModes; modeNum++) {
    let bestOmega2 = Infinity, bestVec = null, lastConv = null, agree = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      const phase = (modeNum + 1 + attempt * 7) * 0.7 + attempt * 0.41;
      let x = new Float64Array(nF);
      for (let i = 0; i < nF; i++) x[i] = Math.sin(phase * (i + 1)) + Math.cos((attempt + 1) * (i + 0.5) * 1.1) * 0.5 + 0.1;
      mOrtho(x, found, mvM, nF);
      const n0 = Math.sqrt(Math.max(modalDot(x, mvM(x), nF), 0));
      if (n0 < 1e-10) continue;
      mNorm(x, mvM, nF);

      let omega2 = 0, converged = false;
      for (let iter = 0; iter < 150; iter++) {
        const Mx = mvM(x);
        const y = solveK(Mx);            // K y = M x
        mOrtho(y, found, mvM, nF);
        const My = mvM(y);
        const yn = Math.sqrt(Math.max(modalDot(y, My, nF), 0));
        if (yn < 1e-30) break;
        const xNew = y.slice();
        mNorm(xNew, mvM, nF);
        const Kx = mvK(xNew);
        const w2 = modalDot(xNew, Kx, nF);
        if (!isFinite(w2) || w2 < 0) break;
        const relChange = Math.abs(w2 - omega2) / Math.max(w2, 1e-10);
        omega2 = w2; x = xNew;
        if (relChange < 1e-7 && iter >= 4) { converged = true; break; }
        if (relChange < 1e-4 && iter >= 20) { converged = true; break; }
      }
      if (converged && isFinite(omega2) && omega2 >= 0 && omega2 < 1e12) {
        if (omega2 < bestOmega2) { bestOmega2 = omega2; bestVec = Array.from(x); }
        if (lastConv !== null && Math.abs(omega2 - lastConv) / Math.max(omega2, 1e-12) < 1e-3) { agree++; }
        lastConv = omega2;
        if (agree >= 1) break;
      }
    }
    if (!bestVec) break;
    found.push({ omega2: bestOmega2, vec: new Float64Array(bestVec) });
  }
  return found.map(m => ({ omega2: m.omega2, vec: Array.from(m.vec) }));
}

// ── Small generalized eigenproblem (q×q):  K·v = λ·M·v ────────────────────────
// Cholesky reduction M=L·Lᵀ → standard problem A·y=λ·y with A=L⁻¹K L⁻ᵀ, then classical
// Jacobi. Returns { vals (ascending), vecs (columns, M-orthonormal) }.
export function smallGenEig(K, M, n) {
  const L = []; for (let i = 0; i < n; i++) L.push(new Float64Array(n));
  for (let j = 0; j < n; j++) {
    let s = M[j][j]; for (let k = 0; k < j; k++) s -= L[j][k] * L[j][k];
    L[j][j] = Math.sqrt(Math.max(s, 1e-300));
    for (let i = j + 1; i < n; i++) {
      let t = M[i][j]; for (let k = 0; k < j; k++) t -= L[i][k] * L[j][k];
      L[i][j] = t / L[j][j];
    }
  }
  const fwd = b => { const y = new Float64Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; } return y; };
  const bwd = b => { const y = new Float64Array(n); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * y[k]; y[i] = s / L[i][i]; } return y; };
  const A = []; for (let i = 0; i < n; i++) A.push(new Float64Array(n));
  for (let j = 0; j < n; j++) {
    const ej = new Float64Array(n); ej[j] = 1;
    const w = bwd(ej);
    const Kw = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < n; k++) s += K[i][k] * w[k]; Kw[i] = s; }
    const col = fwd(Kw);
    for (let i = 0; i < n; i++) A[i][j] = col[i];
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const m = 0.5 * (A[i][j] + A[j][i]); A[i][j] = A[j][i] = m; }
  const V = []; for (let i = 0; i < n; i++) { V.push(new Float64Array(n)); V[i][i] = 1; }
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0; for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-18) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const tt = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(tt * tt + 1), s = tt * c;
      for (let i = 0; i < n; i++) { const aip = A[i][p], aiq = A[i][q]; A[i][p] = c * aip - s * aiq; A[i][q] = s * aip + c * aiq; }
      for (let i = 0; i < n; i++) { const api = A[p][i], aqi = A[q][i]; A[p][i] = c * api - s * aqi; A[q][i] = s * api + c * aqi; }
      for (let i = 0; i < n; i++) { const vip = V[i][p], viq = V[i][q]; V[i][p] = c * vip - s * viq; V[i][q] = s * vip + c * viq; }
    }
  }
  const pairs = [];
  for (let j = 0; j < n; j++) {
    const y = new Float64Array(n); for (let i = 0; i < n; i++) y[i] = V[i][j];
    pairs.push({ lam: A[j][j], v: bwd(y) });
  }
  pairs.sort((a, b) => a.lam - b.lam);
  return { vals: pairs.map(p => p.lam), vecs: pairs.map(p => p.v) };
}

// ── Subspace iteration (Bathe) — extracts the p lowest modes in a block ───────
export function subspace(mvK, mvM, solveK, nF, nModes) {
  const p = nModes;
  const q = Math.min(nF, Math.max(p + 8, 2 * p));
  let X = [];
  for (let c = 0; c < q; c++) {
    const v = new Float64Array(nF);
    for (let i = 0; i < nF; i++) v[i] = Math.sin((c + 1) * 0.7 * (i + 1)) + 0.3 * Math.cos((c + 1) * (i + 0.5)) + (c === 0 ? 1 : 0);
    X.push(v);
  }
  let prev = null, lastVals = null;
  for (let iter = 0; iter < 40; iter++) {
    const Xb = X.map(col => solveK(mvM(col)));
    const KXb = Xb.map(col => mvK(col)), MXb = Xb.map(col => mvM(col));
    const Kr = [], Mr = [];
    for (let a = 0; a < q; a++) { Kr.push(new Float64Array(q)); Mr.push(new Float64Array(q));
      for (let b = 0; b < q; b++) { Kr[a][b] = modalDot(Xb[a], KXb[b], nF); Mr[a][b] = modalDot(Xb[a], MXb[b], nF); } }
    const { vals, vecs } = smallGenEig(Kr, Mr, q);
    const Xnew = [];
    for (let c = 0; c < q; c++) {
      const v = new Float64Array(nF);
      for (let k = 0; k < q; k++) { const qc = vecs[c][k], xk = Xb[k]; if (qc) for (let i = 0; i < nF; i++) v[i] += qc * xk[i]; }
      Xnew.push(v);
    }
    X = Xnew; lastVals = vals;
    if (prev) { let ok = true; for (let i = 0; i < p; i++) if (Math.abs(vals[i] - prev[i]) / Math.max(Math.abs(vals[i]), 1e-12) > 1e-6) { ok = false; break; } if (ok && iter >= 2) break; }
    prev = vals.slice(0, p);
  }
  const out = [];
  for (let i = 0; i < p && i < q; i++) if (isFinite(lastVals[i]) && lastVals[i] >= 0) out.push({ omega2: lastVals[i], vec: Array.from(X[i]) });
  return out;
}

// Dispatch: 'subspace' (Bathe block) or 'stodola' (inverse iteration, default).
export function modalIterate(mvK, mvM, solveK, nF, nModes, method) {
  return method === 'subspace'
    ? subspace(mvK, mvM, solveK, nF, nModes)
    : stodola(mvK, mvM, solveK, nF, nModes);
}
