// ──────────────────────────────────────────────────────────────────────────────
// rhs_en10219.js — sectional properties of cold-formed rectangular/square hollow sections with corner
// radii, EN 10219-2:2019 Annex A.3 (the same formulae as Fakury/Silva/Caldas – Vallourec, eq. 1.18–1.29).
//   ro = 2,0T / 2,5T / 3,0T and ri = 1,0T / 1,5T / 2,0T for T ≤ 6 / 6 < T ≤ 10 / T > 10 mm.
// Input H (longer side), B (shorter side), T in mm. Output in SI (m, m², m³, m⁴); y-y = major axis.
// Checked against EN 10219-2 Table B.3 (≤ 0,23 %) in tests/test_profiles_lib.mjs.
// ──────────────────────────────────────────────────────────────────────────────

export function rhsEN10219(H, B, T) {
  if (B > H) [H, B] = [B, H];
  const ro = T <= 6 ? 2 * T : T <= 10 ? 2.5 * T : 3 * T;
  const ri = T <= 6 ? T : T <= 10 ? 1.5 * T : 2 * T;
  const Ag = (1 - Math.PI / 4) * ro ** 2, Ax = (1 - Math.PI / 4) * ri ** 2;
  const k = (10 - 3 * Math.PI) / (12 - 3 * Math.PI), c = 1 / 3 - Math.PI / 16 - 1 / (3 * (12 - 3 * Math.PI));
  const Ig = c * ro ** 4, Ix = c * ri ** 4;
  const I = (h, b) => { const hg = h / 2 - k * ro, hx = (h - 2 * T) / 2 - k * ri;
    return b * h ** 3 / 12 - (b - 2 * T) * (h - 2 * T) ** 3 / 12 - 4 * (Ig + Ag * hg ** 2) + 4 * (Ix + Ax * hx ** 2); };
  const Z = (h, b) => { const hg = h / 2 - k * ro, hx = (h - 2 * T) / 2 - k * ri;
    return b * h ** 2 / 4 - (b - 2 * T) * (h - 2 * T) ** 2 / 4 - 4 * Ag * hg + 4 * Ax * hx; };
  const A = 2 * T * (B + H - 2 * T) - (4 - Math.PI) * (ro ** 2 - ri ** 2);
  const Rc = (ro + ri) / 2, hp = 2 * ((B - T) + (H - T)) - 2 * Rc * (4 - Math.PI);
  const Ah = (B - T) * (H - T) - Rc ** 2 * (4 - Math.PI), K = 2 * Ah * T / hp;
  const It = T ** 3 * hp / 3 + 2 * K * Ah;
  const Iyy = I(H, B), Izz = I(B, H);
  const m = 1e-3;                                                      // mm → m
  return { H: H * m, B: B * m, T: T * m, ro: ro * m, ri: ri * m, A: A * m ** 2, Iyy: Iyy * m ** 4, Izz: Izz * m ** 4,
    Welyy: 2 * Iyy / H * m ** 3, Welzz: 2 * Izz / B * m ** 3, Wplyy: Z(H, B) * m ** 3, Wplzz: Z(B, H) * m ** 3, It: It * m ** 4 };
}
