// ──────────────────────────────────────────────────────────────────────────────
// fsm.js — finite strip method (FSM) for the elastic buckling of thin-walled open sections, in the line of
// CUFSM (Schafer & Ádány 2006): signature curve λ(a) for a single half-wave sin(πy/a) (ends simply supported),
// local (first minimum) and distortional (second minimum) critical loads for NBR 14762:2010 9.7.3 / 9.8.2.3 and
// Anexo C (MRD), which require Nℓ, Ndist, Mℓ, Mdist from an elastic stability analysis.
//
// Strip (width b, thickness t, isotropic E, ν): local x across the strip (0..b), y along the member (0..a), k = π/a
//   membrane  u = Σ Nᵢ uᵢ·sin(ky) (across), v = Σ Nᵢ vᵢ·cos(ky) (longitudinal), N linear
//   bending   w = Σ Hᵢ (wᵢ, θᵢ)·sin(ky), H cubic Hermite (θ = ∂w/∂x)
//   K  from ½∫(εᵀ·Dm·ε·t + κᵀ·Db·κ), Kg from ½∫ T(x)·[(∂u/∂y)² + (∂v/∂y)² + (∂w/∂y)²], T = t·σy (linear across
//   the strip; compression positive) — both integrated with 5-point Gauss across the width (exact for these
//   polynomials) and ∫sin² = ∫cos² = a/2 along the length.
// Generalized eigenproblem K·φ = λ·Kg·φ: Cholesky K = L·Lᵀ, A = L⁻¹·Kg·L⁻ᵀ, λ = 1/μmax(A) (Householder + QL).
// Units: consistent (N, mm, MPa recommended). Node DOFs (global): [X, Y(longitudinal), Z, Θ].
// ──────────────────────────────────────────────────────────────────────────────

const GX = [-0.9061798459386640, -0.5384693101056831, 0, 0.5384693101056831, 0.9061798459386640];
const GW = [0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665, 0.2369268850561891];

// local 8×8 matrices of one strip; DOF order [u1, v1, w1, θ1, u2, v2, w2, θ2]
function stripMatrices(b, t, E, nu, a, s1, s2) {
  const k = Math.PI / a, G = E / (2 * (1 + nu));
  const E1 = E / (1 - nu * nu), D = E * t ** 3 / (12 * (1 - nu * nu));
  const K = Array.from({ length: 8 }, () => new Float64Array(8)), Kg = Array.from({ length: 8 }, () => new Float64Array(8));
  const add = (M, rowVec, colVec, f) => { for (let i = 0; i < 8; i++) if (rowVec[i]) for (let j = 0; j < 8; j++) if (colVec[j]) M[i][j] += f * rowVec[i] * colVec[j]; };
  for (let g = 0; g < 5; g++) {
    const xi = (GX[g] + 1) / 2, wq = GW[g] / 2 * b;                     // ξ ∈ [0, 1], weight × b
    const N1 = 1 - xi, N2 = xi, dN1 = -1 / b, dN2 = 1 / b;
    const H1 = 1 - 3 * xi * xi + 2 * xi ** 3, H2 = b * (xi - 2 * xi * xi + xi ** 3), H3 = 3 * xi * xi - 2 * xi ** 3, H4 = b * (-xi * xi + xi ** 3);
    const d2 = (h) => h / (b * b);
    const H1xx = d2(-6 + 12 * xi), H2xx = (-4 + 6 * xi) / b, H3xx = d2(6 - 12 * xi), H4xx = (-2 + 6 * xi) / b;
    const H1x = (-6 * xi + 6 * xi * xi) / b, H2x = 1 - 4 * xi + 3 * xi * xi, H3x = (6 * xi - 6 * xi * xi) / b, H4x = -2 * xi + 3 * xi * xi;
    const Z = (o) => { const r = new Float64Array(8); for (const [i, v] of Object.entries(o)) r[i] = v; return r; };
    // membrane strains (amplitudes; sin terms: εx, εy; cos term: γxy)
    const ex = Z({ 0: dN1, 4: dN2 }), ey = Z({ 1: k * N1, 5: k * N2 }), gxy = Z({ 0: k * N1, 4: k * N2, 1: dN1, 5: dN2 });
    // εy = ∂v/∂y = −k·v·sin → sign irrelevant in the quadratic form except for the coupling with εx: keep −k
    const eyS = Z({ 1: -k * N1, 5: -k * N2 });
    const half = a / 2;
    add(K, ex, ex, E1 * t * wq * half); add(K, eyS, eyS, E1 * t * wq * half);
    add(K, ex, eyS, nu * E1 * t * wq * half); add(K, eyS, ex, nu * E1 * t * wq * half);
    add(K, gxy, gxy, G * t * wq * half);
    // bending curvatures (sin: κx, κy; cos: κxy)
    const kx = Z({ 2: -H1xx, 3: -H2xx, 6: -H3xx, 7: -H4xx }), ky = Z({ 2: k * k * H1, 3: k * k * H2, 6: k * k * H3, 7: k * k * H4 });
    const kxy = Z({ 2: 2 * k * H1x, 3: 2 * k * H2x, 6: 2 * k * H3x, 7: 2 * k * H4x });
    add(K, kx, kx, D * wq * half); add(K, ky, ky, D * wq * half);
    add(K, kx, ky, nu * D * wq * half); add(K, ky, kx, nu * D * wq * half);
    add(K, kxy, kxy, D * (1 - nu) / 2 * wq * half);
    // geometric: T(x)·[(k u)² + (k v)² + (k w)²]·(a/2)
    const T = t * (s1 * N1 + s2 * N2);
    const gu = Z({ 0: k * N1, 4: k * N2 }), gv = Z({ 1: k * N1, 5: k * N2 }), gw = Z({ 2: k * H1, 3: k * H2, 6: k * H3, 7: k * H4 });
    add(Kg, gu, gu, T * wq * half); add(Kg, gv, gv, T * wq * half); add(Kg, gw, gw, T * wq * half);
  }
  return { K, Kg };
}

// rotation local → global for one node: local (u across, v long., w normal, θ) from global (X, Y, Z, Θ)
function rotate(M, c, s) {
  // T maps global node dofs [X,Y,Z,Θ] → local [u,v,w,θ]: u = c·X + s·Z, v = Y, w = −s·X + c·Z, θ = Θ
  const Tn = [[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]];
  const T = Array.from({ length: 8 }, () => new Float64Array(8));
  for (let blk = 0; blk < 2; blk++) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) T[4 * blk + i][4 * blk + j] = Tn[i][j];
  const R = Array.from({ length: 8 }, () => new Float64Array(8));
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { let sum = 0; for (let p = 0; p < 8; p++) for (let q = 0; q < 8; q++) sum += T[p][i] * M[p][q] * T[q][j]; R[i][j] = sum; }
  return R;
}

// symmetric eigenvalues (Householder tridiagonalization + implicit QL), in place on a copy
function symEig(A0) {
  const n = A0.length, a = A0.map(r => Float64Array.from(r)), d = new Float64Array(n), e = new Float64Array(n);
  for (let i = n - 1; i > 0; i--) {
    const l = i - 1; let h = 0, scale = 0;
    if (l > 0) {
      for (let k = 0; k <= l; k++) scale += Math.abs(a[i][k]);
      if (scale === 0) e[i] = a[i][l];
      else {
        for (let k = 0; k <= l; k++) { a[i][k] /= scale; h += a[i][k] * a[i][k]; }
        let f = a[i][l]; const g = f >= 0 ? -Math.sqrt(h) : Math.sqrt(h);
        e[i] = scale * g; h -= f * g; a[i][l] = f - g; f = 0;
        for (let j = 0; j <= l; j++) {
          let gg = 0;
          for (let k = 0; k <= j; k++) gg += a[j][k] * a[i][k];
          for (let k = j + 1; k <= l; k++) gg += a[k][j] * a[i][k];
          e[j] = gg / h; f += e[j] * a[i][j];
        }
        const hh = f / (h + h);
        for (let j = 0; j <= l; j++) { const ff = a[i][j]; const gg = e[j] - hh * ff; e[j] = gg; for (let k = 0; k <= j; k++) a[j][k] -= ff * e[k] + gg * a[i][k]; }
      }
    } else e[i] = a[i][l];
    d[i] = h;
  }
  for (let i = 0; i < n; i++) d[i] = a[i][i];
  for (let i = 1; i < n; i++) e[i - 1] = e[i];
  e[n - 1] = 0;
  for (let l = 0; l < n; l++) {
    let iter = 0, m;
    do {
      for (m = l; m < n - 1; m++) { const dd = Math.abs(d[m]) + Math.abs(d[m + 1]); if (Math.abs(e[m]) <= 1e-15 * dd) break; }
      if (m !== l) {
        if (iter++ > 60) break;
        let g = (d[l + 1] - d[l]) / (2 * e[l]); let r = Math.hypot(g, 1);
        g = d[m] - d[l] + e[l] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
        let s = 1, c = 1, p = 0, i;
        for (i = m - 1; i >= l; i--) {
          let f = s * e[i]; const b = c * e[i];
          r = Math.hypot(f, g); e[i + 1] = r;
          if (r === 0) { d[i + 1] -= p; e[m] = 0; break; }
          s = f / r; c = g / r; g = d[i + 1] - p; r = (d[i] - g) * s + 2 * c * b; p = s * r; d[i + 1] = g + p; g = c * r - b;
        }
        if (r === 0 && i >= l) continue;
        d[l] -= p; e[l] = g; e[m] = 0;
      }
    } while (m !== l);
  }
  return Array.from(d);
}

/**
 * Lowest positive load factor for one half-wavelength.
 * model: { nodes: [{x, z}], strips: [{i, j, t}], E, nu, stress: [σ per node] (compression +), fixed: [{node, dof}] }
 */
export function bucklingFactor(model, a) {
  const nn = model.nodes.length, n = 4 * nn;
  const K = Array.from({ length: n }, () => new Float64Array(n)), Kg = Array.from({ length: n }, () => new Float64Array(n));
  for (const s of model.strips) {
    const A = model.nodes[s.i], B = model.nodes[s.j];
    const dx = B.x - A.x, dz = B.z - A.z, b = Math.hypot(dx, dz), c = dx / b, sn = dz / b;
    const m = stripMatrices(b, s.t, model.E, model.nu, a, model.stress[s.i], model.stress[s.j]);
    const Kr = rotate(m.K, c, sn), Kgr = rotate(m.Kg, c, sn);
    const map = [0, 1, 2, 3].map(d => 4 * s.i + d).concat([0, 1, 2, 3].map(d => 4 * s.j + d));
    for (let p = 0; p < 8; p++) for (let q = 0; q < 8; q++) { K[map[p]][map[q]] += Kr[p][q]; Kg[map[p]][map[q]] += Kgr[p][q]; }
  }
  const fixed = new Set((model.fixed || []).map(f => 4 * f.node + f.dof));
  const keep = [...Array(n).keys()].filter(i => !fixed.has(i));
  const m = keep.length;
  const Kk = keep.map(i => keep.map(j => K[i][j])), Gk = keep.map(i => keep.map(j => Kg[i][j]));
  // Cholesky K = L·Lᵀ
  const L = Array.from({ length: m }, () => new Float64Array(m));
  for (let i = 0; i < m; i++) for (let j = 0; j <= i; j++) {
    let s = Kk[i][j]; for (let p = 0; p < j; p++) s -= L[i][p] * L[j][p];
    if (i === j) { if (!(s > 0)) return null; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  // X = L⁻¹·Kg, then A = X·L⁻ᵀ = L⁻¹·(L⁻¹·Kg)ᵀ (symmetric)
  const solveL = (col) => { const y = new Float64Array(m); for (let i = 0; i < m; i++) { let s = col[i]; for (let p = 0; p < i; p++) s -= L[i][p] * y[p]; y[i] = s / L[i][i]; } return y; };
  const X = []; for (let j = 0; j < m; j++) X.push(solveL(Gk.map(r => r[j])));          // columns of L⁻¹·Kg
  const Xt = Array.from({ length: m }, (_, i) => Float64Array.from(X.map(col => col[i])));  // rows
  const Acols = []; for (let i = 0; i < m; i++) Acols.push(solveL(Xt[i]));
  const Am = Array.from({ length: m }, (_, i) => Float64Array.from(Acols.map(col => col[i])));
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) { const v = (Am[i][j] + Am[j][i]) / 2; Am[i][j] = Am[j][i] = v; }
  const mu = symEig(Am);
  const muMax = Math.max(...mu);
  return muMax > 0 ? 1 / muMax : Infinity;
}

/** Signature curve λ(a) over log-spaced half-wavelengths; returns points and the first two local minima. */
export function signatureCurve(model, { aMin, aMax, n = 60 } = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = aMin * Math.pow(aMax / aMin, i / (n - 1));
    pts.push({ a, lf: bucklingFactor(model, a) });
  }
  const minima = [];
  for (let i = 1; i < pts.length - 1; i++) if (pts[i].lf < pts[i - 1].lf && pts[i].lf <= pts[i + 1].lf) minima.push(refineMin(model, pts[i - 1].a, pts[i + 1].a));
  return { pts, minima };
}

function refineMin(model, lo, hi) {                // golden section on log a
  const f = (la) => bucklingFactor(model, Math.exp(la));
  let a = Math.log(lo), b = Math.log(hi); const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a), d = a + r * (b - a), fc = f(c), fd = f(d);
  for (let it = 0; it < 30; it++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - r * (b - a); fc = f(c); } else { a = c; c = d; fc = fd; d = a + r * (b - a); fd = f(d); }
  }
  const la = (a + b) / 2; return { a: Math.exp(la), lf: f(la) };
}

/**
 * Centreline model of a lipped channel Ue (or plain channel U when D = 0), square corners, web vertical in z.
 * dims in mm: bw, bf, D, t (outer dimensions). Returns the model nodes/strips and centreline properties.
 */
export function channelModel({ bw, bf, D = 0, t }, { E = 200000, nu = 0.3, sub = 4 } = {}) {
  const h = bw - t, b = bf - t, d = D > 0 ? D - t / 2 : 0;
  // corner path: lip tip (top) → top flange → web → bottom flange → lip tip (bottom); web at x = 0
  const corners = [];
  if (d > 0) corners.push({ x: b, z: h / 2 - d });
  corners.push({ x: b, z: h / 2 }, { x: 0, z: h / 2 }, { x: 0, z: -h / 2 }, { x: b, z: -h / 2 });
  if (d > 0) corners.push({ x: b, z: -h / 2 + d });
  const nodes = [corners[0]];
  for (let i = 1; i < corners.length; i++) {
    const A = corners[i - 1], B = corners[i];
    const ns = (A.x !== B.x && A.z !== B.z) ? sub : (i === 1 || i === corners.length - 1) && d > 0 ? Math.max(2, sub / 2) : sub;
    for (let k = 1; k <= ns; k++) nodes.push({ x: A.x + (B.x - A.x) * k / ns, z: A.z + (B.z - A.z) * k / ns });
  }
  const strips = []; for (let i = 0; i < nodes.length - 1; i++) strips.push({ i, j: i + 1, t });
  // centreline properties
  let A = 0, Sx = 0, Iz = 0;
  for (const s of strips) {
    const P = nodes[s.i], Q = nodes[s.j], L = Math.hypot(Q.x - P.x, Q.z - P.z), zc = (P.z + Q.z) / 2;
    A += L * t; Sx += L * t * (P.x + Q.x) / 2; Iz += t * L * (zc * zc + ((Q.z - P.z) ** 2) / 12);
  }
  return { nodes, strips, E, nu, A, Ix: Iz, zmax: h / 2 + 0, xc: Sx / A };
}

/**
 * Elastic critical loads of a Ue/U by FSM: compression (uniform σ) and strong-axis bending (linear σ, max at the
 * flange centreline). Returns { Nl, Ndist, Ml, Mdist } in N and N·mm (null when the minimum is not distinct).
 */
export function criticalLoadsChannel(dims, opts = {}) {
  const m = channelModel(dims, opts);
  const span = Math.max(dims.bw, dims.bf);
  const run = (stress) => signatureCurve({ ...m, stress }, { aMin: 0.3 * Math.min(dims.bf, dims.bw) / 2, aMax: 20 * span, n: opts.n ?? 50 });
  const comp = run(m.nodes.map(() => 1));
  const bend = run(m.nodes.map(nd => nd.z / (m.zmax)));     // +1 at the top flange (compressed), −1 at the bottom
  const pick = (r) => ({ local: r.minima[0] || null, dist: r.minima[1] || null });
  const c = pick(comp), f = pick(bend);
  const Mref = m.Ix / m.zmax;                                // σ = 1 at the flange centreline → M = Ix/zmax
  return {
    Nl: c.local ? c.local.lf * m.A : null, aNl: c.local?.a ?? null,
    Ndist: c.dist ? c.dist.lf * m.A : null, aNdist: c.dist?.a ?? null,
    Ml: f.local ? f.local.lf * Mref : null, aMl: f.local?.a ?? null,
    Mdist: f.dist ? f.dist.lf * Mref : null, aMdist: f.dist?.a ?? null,
    model: { A: m.A, Ix: m.Ix, zmax: m.zmax, nodes: m.nodes.length },
    curves: { comp: comp.pts, bend: bend.pts },
  };
}
