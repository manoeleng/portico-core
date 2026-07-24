// ──────────────────────────────────────────────────────────────────────────────
// corot_plastic.js — corotational beam with concentrated ELASTO-PLASTIC moment hinges
// at both ends (Giberson one-component model, bilinear KINEMATIC hardening). This adds
// MATERIAL nonlinearity — hysteretic yielding, the source of energy dissipation in a
// real seismic response — on top of the geometric nonlinearity of corotbeam.js, for the
// nonlinear direct time integration (Phase 3b).
//
// Each end carries a plastic rotation θp_i (a history variable committed step to step).
// The end moment obeys a bilinear law with back-stress q_i = Hp·θp_i and yield surface
// |M_i − q_i| ≤ Mp: elastic reloading/unloading, plastic flow on the surface. The return
// map is a small active-set solve (≤2 ends) and the tangent is the CONSISTENT algorithmic
// one — Cep = Ke − Ke·D·A⁻¹·D·Ke — so global Newton keeps quadratic convergence. For Hp=0
// (perfectly plastic) one active end recovers the 3EI/L released-end stiffness exactly.
//
// The corotational kinematics are identical to corotbeam.js (the plasticity lives only in
// the LOCAL moment–rotation law); axial stays elastic. Verified in test_nl_direct.mjs:
// the hinge caps the moment at ≈Mp, dissipates energy hysteretically (free vibration
// decays with NO viscous damping), and reduces to the elastic element below yield.
// ──────────────────────────────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;
function wrap(a) { a %= TWO_PI; if (a > Math.PI) a -= TWO_PI; else if (a <= -Math.PI) a += TWO_PI; return a; }

// ── Two-end moment hinge return map (backward Euler) ──────────────────────────
// kb = EI/L0. tb1,tb2 = chord-relative end rotations. tp1_0,tp2_0 = committed plastic
// rotations. Mp = plastic moment, Hp = kinematic hardening modulus (≥0).
// Returns { M1, M2, tp1, tp2, C } — C is the 2×2 algorithmic bending tangent.
export function hingeReturnMap(kb, tb1, tb2, tp1_0, tp2_0, Mp, Hp) {
  const K = [4 * kb, 2 * kb, 2 * kb, 4 * kb];   // [K11,K12,K21,K22]
  const mom = (tp1, tp2) => [K[0] * (tb1 - tp1) + K[1] * (tb2 - tp2), K[2] * (tb1 - tp1) + K[3] * (tb2 - tp2)];

  const [Mtr1, Mtr2] = mom(tp1_0, tp2_0);
  const phi1 = Math.abs(Mtr1 - Hp * tp1_0) - Mp;
  const phi2 = Math.abs(Mtr2 - Hp * tp2_0) - Mp;
  if (phi1 <= 0 && phi2 <= 0) return { M1: Mtr1, M2: Mtr2, tp1: tp1_0, tp2: tp2_0, C: [K[0], K[1], K[2], K[3]] };

  const s1 = Math.sign(Mtr1 - Hp * tp1_0) || 1, s2 = Math.sign(Mtr2 - Hp * tp2_0) || 1;
  let a1 = phi1 > 0, a2 = phi2 > 0;
  for (let pass = 0; pass < 3; pass++) {
    let dg1 = 0, dg2 = 0;
    if (a1 && a2) {
      // A·Δγ = Φ,  A_ij = s_i·K_ij·s_j + Hp·δ_ij
      const A11 = K[0] + Hp, A12 = s1 * K[1] * s2, A21 = s2 * K[2] * s1, A22 = K[3] + Hp;
      const det = A11 * A22 - A12 * A21 || 1e-300;
      dg1 = (phi1 * A22 - A12 * phi2) / det;
      dg2 = (A11 * phi2 - phi1 * A21) / det;
    } else if (a1) dg1 = phi1 / (K[0] + Hp);
    else if (a2) dg2 = phi2 / (K[3] + Hp);
    // KKT: plastic multipliers ≥ 0. Drop a negative one and re-solve (active set).
    if (a1 && dg1 < 0) { a1 = false; continue; }
    if (a2 && dg2 < 0) { a2 = false; continue; }

    const tp1 = tp1_0 + (a1 ? dg1 * s1 : 0), tp2 = tp2_0 + (a2 ? dg2 * s2 : 0);
    const [M1, M2] = mom(tp1, tp2);
    // Consistent tangent  Cep = Ke − Ke·D·A⁻¹·D·Ke  (D = diag(s) over active ends).
    let C;
    if (a1 && a2) {
      const A11 = K[0] + Hp, A12 = s1 * K[1] * s2, A21 = s2 * K[2] * s1, A22 = K[3] + Hp;
      const det = A11 * A22 - A12 * A21 || 1e-300;
      // Ai = A⁻¹
      const i11 = A22 / det, i12 = -A12 / det, i21 = -A21 / det, i22 = A11 / det;
      // (D·Ke): row i scaled by s_i → DK = [s1*K11, s1*K12; s2*K21, s2*K22]
      const DK = [s1 * K[0], s1 * K[1], s2 * K[2], s2 * K[3]];
      // M = Aiᵀ? we need Ke·D·A⁻¹·D·Ke = (DK)ᵀ·A⁻¹·(DK)
      const T = (r, c) => {   // (DKᵀ·A⁻¹·DK)[r][c]
        // DKᵀ column r = [DK[0..] ...]; compute via sum over active p,q
        const DKr = [DK[0 + r], DK[2 + r]];        // column r of DK = rows contributions
        const DKc = [DK[0 + c], DK[2 + c]];
        // A⁻¹ applied: [i11 i12; i21 i22]
        const t0 = i11 * DKc[0] + i12 * DKc[1];
        const t1 = i21 * DKc[0] + i22 * DKc[1];
        return DKr[0] * t0 + DKr[1] * t1;
      };
      C = [K[0] - T(0, 0), K[1] - T(0, 1), K[2] - T(1, 0), K[3] - T(1, 1)];
    } else if (a1) {
      const inv = 1 / (K[0] + Hp);   // D A⁻¹ D at (1,1) = 1/A11 (s1²=1)
      C = [K[0] - K[0] * inv * K[0], K[1] - K[0] * inv * K[1], K[2] - K[2] * inv * K[0], K[3] - K[2] * inv * K[1]];
    } else if (a2) {
      const inv = 1 / (K[3] + Hp);
      C = [K[0] - K[1] * inv * K[2], K[1] - K[1] * inv * K[3], K[2] - K[3] * inv * K[2], K[3] - K[3] * inv * K[3]];
    } else {
      C = [K[0], K[1], K[2], K[3]];   // all deactivated → elastic
    }
    return { M1, M2, tp1, tp2, C };
  }
  return { M1: Mtr1, M2: Mtr2, tp1: tp1_0, tp2: tp2_0, C: [K[0], K[1], K[2], K[3]] };
}

// Core plastic element: current end positions/rotations + committed plastic state →
// { fint(6), Kt(36), N, M1, M2, tp1, tp2 }. Mirrors corotBeamCore but with the plastic
// moment law and its consistent bending tangent. el.{EA, EI, L0, beta0, Mp, Hp}.
export function corotPlasticCore(x1, z1, t1, x2, z2, t2, el, tp1_0, tp2_0) {
  const dx = x2 - x1, dz = z2 - z1;
  const ln = Math.hypot(dx, dz) || 1e-300;
  const c = dx / ln, s = dz / ln;
  const beta = Math.atan2(dz, dx);
  const alpha = wrap(beta - el.beta0);
  const ubar = ln - el.L0;
  const tb1 = wrap(t1 - alpha), tb2 = wrap(t2 - alpha);

  const ka = el.EA / el.L0, kb = el.EI / el.L0;
  const N = ka * ubar;                                   // axial stays elastic
  // Kinematic hardening modulus from the ratio b (post-yield stiffness ≈ b·elastic):
  // Hp = b/(1−b)·6kb. el.Hp overrides if given directly. b = 0 → perfectly plastic.
  const Hp = el.Hp != null ? el.Hp : (el.b > 0 ? el.b / (1 - el.b) * 6 * kb : 0);
  const { M1, M2, tp1, tp2, C } = hingeReturnMap(kb, tb1, tb2, tp1_0, tp2_0, el.Mp, Hp);

  const a = [-c, -s, 0, c, s, 0];
  const z = [s, -c, 0, -s, c, 0];
  const e3 = [0, 0, 1, 0, 0, 0], e6 = [0, 0, 0, 0, 0, 1];
  const B0 = a, B1 = e3.map((v, k) => v - z[k] / ln), B2 = e6.map((v, k) => v - z[k] / ln);

  const fint = new Float64Array(6);
  for (let k = 0; k < 6; k++) fint[k] = N * B0[k] + M1 * B1[k] + M2 * B2[k];

  // Material tangent  Bᵀ·Cl·B,  Cl = [[ka,0,0],[0,C11,C12],[0,C21,C22]]
  const Cl = [[ka, 0, 0], [0, C[0], C[1]], [0, C[2], C[3]]];
  const Brows = [B0, B1, B2];
  const Kt = new Float64Array(36);
  for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) {
    const cpq = Cl[p][q]; if (!cpq) continue;
    const Bp = Brows[p], Bq = Brows[q];
    for (let r = 0; r < 6; r++) { const br = cpq * Bp[r]; if (!br) continue; for (let cc = 0; cc < 6; cc++) Kt[r * 6 + cc] += br * Bq[cc]; }
  }
  // Geometric tangent (uses the ACTUAL N, M1, M2)
  const g1 = N / ln, g2 = (M1 + M2) / (ln * ln);
  for (let r = 0; r < 6; r++) for (let cc = 0; cc < 6; cc++) Kt[r * 6 + cc] += g1 * z[r] * z[cc] + g2 * (a[r] * z[cc] + z[r] * a[cc]);

  return { fint, Kt, N, M1, M2, tp1, tp2 };
}

// Rigid end zones (#87) around the plastic core — same arm kinematics as corotbeam.js's
// corotRigidArm, delegating the flexible span to corotPlasticCore. The plastic state
// belongs to the flexible-span ends (where the section actually yields).
export function corotPlasticRigidArm(x1, z1, t1, x2, z2, t2, el, tp1_0, tp2_0) {
  const cb = Math.cos(el.beta0), sb = Math.sin(el.beta0);
  const oi = el.oi || 0, oj = el.oj || 0;
  const r1x = oi * cb, r1z = oi * sb, r2x = -oj * cb, r2z = -oj * sb;
  const c1 = Math.cos(t1), s1 = Math.sin(t1), c2 = Math.cos(t2), s2 = Math.sin(t2);
  const X1 = x1 + r1x * c1 - r1z * s1, Z1 = z1 + r1x * s1 + r1z * c1;
  const X2 = x2 + r2x * c2 - r2z * s2, Z2 = z2 + r2x * s2 + r2z * c2;

  const res = corotPlasticCore(X1, Z1, t1, X2, Z2, t2, el, tp1_0, tp2_0);
  const f = res.fint, Kc = res.Kt;

  const a02 = -r1x * s1 - r1z * c1, a12 = r1x * c1 - r1z * s1;
  const a35 = -r2x * s2 - r2z * c2, a45 = r2x * c2 - r2z * s2;
  const A = [
    [1, 0, a02, 0, 0, 0], [0, 1, a12, 0, 0, 0], [0, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, a35], [0, 0, 0, 0, 1, a45], [0, 0, 0, 0, 0, 1],
  ];
  const fint = new Float64Array(6);
  for (let k = 0; k < 6; k++) { let sm = 0; for (let r = 0; r < 6; r++) sm += A[r][k] * f[r]; fint[k] = sm; }
  const Kt = new Float64Array(36);
  for (let p = 0; p < 6; p++) for (let q = 0; q < 6; q++) {
    let sm = 0;
    for (let r = 0; r < 6; r++) { const arp = A[r][p]; if (!arp) continue; for (let cc = 0; cc < 6; cc++) { const acq = A[cc][q]; if (!acq) continue; sm += arp * Kc[r * 6 + cc] * acq; } }
    Kt[p * 6 + q] = sm;
  }
  Kt[2 * 6 + 2] += f[0] * (-r1x * c1 + r1z * s1) + f[1] * (-r1x * s1 - r1z * c1);
  Kt[5 * 6 + 5] += f[3] * (-r2x * c2 + r2z * s2) + f[4] * (-r2x * s2 - r2z * c2);

  return { fint, Kt, N: res.N, M1: res.M1, M2: res.M2, tp1: res.tp1, tp2: res.tp2 };
}

// Global internal force + tangent of a plastic corotational element from the reference
// coords and the current displacement u, given the committed plastic state (tp1,tp2).
export function corotPlasticForceTangent(coords, u, el, tp1_0, tp2_0) {
  const i = el.n1, j = el.n2;
  const x1 = coords[2 * i] + u[3 * i], z1 = coords[2 * i + 1] + u[3 * i + 1], t1 = u[3 * i + 2];
  const x2 = coords[2 * j] + u[3 * j], z2 = coords[2 * j + 1] + u[3 * j + 1], t2 = u[3 * j + 2];
  return (el.oi || el.oj)
    ? corotPlasticRigidArm(x1, z1, t1, x2, z2, t2, el, tp1_0, tp2_0)
    : corotPlasticCore(x1, z1, t1, x2, z2, t2, el, tp1_0, tp2_0);
}
