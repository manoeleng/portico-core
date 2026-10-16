// cf_geom.js — geometric properties of cold-formed open sections (U, Ue, L) from the DIMENSIONS, thin-walled
// mid-line model with circular corners (internal radius ri, mid-line radius ri + t/2), as the NBR 6355:2012 tables:
// A, centroid, Ix, Iy, Ixy, St. Venant J = Σ L·t³/3, shear centre and warping constant Cw by the sectorial coordinate
// (Vlasov), section moduli and radii. Used for manufacturer catalogues that give only dimensions and mass (Aço
// Cearense) — validated against the NBR 6355 tabulated values (tests/test_cf_geom.mjs). Units: the input unit (mm);
// results in that unit (mm², mm⁴, mm⁶…).

function arc(cx, cy, r, a0, a1, n = 10) {   // points on an arc (angles in degrees), a0 → a1, excluding the first point
  const out = [];
  for (let i = 1; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}

/** mid-line polyline of a U (lipped if D > 0): web on x = 0 (mid-line), flanges toward +x */
export function midlineChannel({ bw, bf, t, D = 0, ri = t }) {
  const hm = bw - t, bm = bf - t, r = ri + t / 2, cm = D > 0 ? D - t / 2 : 0;
  const P = [];
  if (D > 0) { P.push([bm, hm / 2 - cm]); P.push([bm, hm / 2 - r]); P.push(...arc(bm - r, hm / 2 - r, r, 0, 90)); }
  else P.push([bm + t / 2, hm / 2]);                                   // plain U: flange to the outer face of the tip
  P.push([r, hm / 2], ...arc(r, hm / 2 - r, r, 90, 180), [0, -hm / 2 + r], ...arc(r, -hm / 2 + r, r, 180, 270));
  if (D > 0) { P.push([bm - r, -hm / 2], ...arc(bm - r, -hm / 2 + r, r, 270, 360), [bm, -hm / 2 + cm]); }
  else P.push([bm + t / 2, -hm / 2]);
  return P;
}
/** mid-line polyline of an equal-leg angle: heel at the origin side, legs along +x and +y */
export function midlineAngle({ b, t, ri = t }) {
  const a = b - t / 2, r = ri + t / 2;
  return [[0, a], [0, r], ...arc(r, r, r, 180, 270), [a, 0]];
}

/** thin-walled properties of an open polyline P with thickness t */
export function thinWalled(P, t) {
  const seg = [];
  for (let i = 0; i + 1 < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[i + 1], L = Math.hypot(x2 - x1, y2 - y1); if (L > 1e-12) seg.push({ x1, y1, x2, y2, L }); }
  const A = seg.reduce((s, q) => s + q.L * t, 0);
  const xc = seg.reduce((s, q) => s + q.L * t * (q.x1 + q.x2) / 2, 0) / A, yc = seg.reduce((s, q) => s + q.L * t * (q.y1 + q.y2) / 2, 0) / A;
  const I = (f1, f2, g1, g2) => (2 * f1 * g1 + f1 * g2 + f2 * g1 + 2 * f2 * g2) / 6;   // ∫ f·g ds / L for linear f, g
  let Ixx = 0, Iyy = 0, Ixy = 0;
  for (const q of seg) { const X1 = q.x1 - xc, X2 = q.x2 - xc, Y1 = q.y1 - yc, Y2 = q.y2 - yc, w = q.L * t;
    Ixx += w * I(Y1, Y2, Y1, Y2); Iyy += w * I(X1, X2, X1, X2); Ixy += w * I(X1, X2, Y1, Y2); }
  // sectorial coordinate about the centroid, ω(0) = 0; dω = x dy − y dx
  let om = 0; const omg = [0];
  for (const q of seg) { const X1 = q.x1 - xc, Y1 = q.y1 - yc, X2 = q.x2 - xc, Y2 = q.y2 - yc; om += X1 * Y2 - X2 * Y1; omg.push(om); }
  let Ixw = 0, Iyw = 0;
  seg.forEach((q, i) => { const w = q.L * t; Ixw += w * I(q.x1 - xc, q.x2 - xc, omg[i], omg[i + 1]); Iyw += w * I(q.y1 - yc, q.y2 - yc, omg[i], omg[i + 1]); });
  // ω_S = ω_C + p·x + q·y with ∫ω_S x = ∫ω_S y = 0  →  shear centre ys = p, xs = −q
  const det = Iyy * Ixx - Ixy * Ixy, p = (-Ixw * Ixx + Iyw * Ixy) / det, qq = (-Iyw * Iyy + Ixw * Ixy) / det;
  const xs = xc - qq, ys = yc + p;
  // normalized warping function and Cw
  const wS = seg.map((q, i) => [omg[i] + p * (q.x1 - xc) + qq * (q.y1 - yc), omg[i + 1] + p * (q.x2 - xc) + qq * (q.y2 - yc)]);
  const wm = seg.reduce((s, q, i) => s + q.L * t * (wS[i][0] + wS[i][1]) / 2, 0) / A;
  const Cw = seg.reduce((s, q, i) => s + q.L * t * I(wS[i][0] - wm, wS[i][1] - wm, wS[i][0] - wm, wS[i][1] - wm), 0);
  const J = seg.reduce((s, q) => s + q.L * t ** 3 / 3, 0);
  const xs_ = P.map((p_) => p_[0]), ys_ = P.map((p_) => p_[1]);
  return { A, xc, yc, Ixx, Iyy, Ixy, J, xs, ys, Cw, xmin: Math.min(...xs_) - t / 2, xmax: Math.max(...xs_) + t / 2, ymin: Math.min(...ys_) - t / 2, ymax: Math.max(...ys_) + t / 2 };
}

/** NBR 6355-like property set of a U / Ue (mm): A, Ix, Iy, xg (from the outer face of the web), x0, J, Cw, W, r, r0 */
export function channelProps({ bw, bf, t, D = 0, ri = t }) {
  const g = thinWalled(midlineChannel({ bw, bf, t, D, ri }), t);
  // NBR 6355 convention (checked against its tables, tests/test_cf_geom.mjs): A, I, xg, x0 with the rounded corners;
  // Cw with SHARP corners on the mid-line (the tabulated Cw matches that to 0,00 %)
  const gs = thinWalled(midlineChannel({ bw, bf, t, D, ri: -t / 2 }), t);
  g.Cw = gs.Cw;
  const xg = g.xc + t / 2, x0 = Math.abs(g.xc - g.xs);                 // web outer face at x = −t/2; shear centre beyond the web
  const Wx = g.Ixx / (bw / 2), Wy = g.Iyy / Math.max(xg, bf - xg);
  const rx = Math.sqrt(g.Ixx / g.A), ry = Math.sqrt(g.Iyy / g.A);
  return { A: g.A, Ix: g.Ixx, Iy: g.Iyy, xg, x0, J: g.J, Cw: g.Cw, Wx, Wy, rx, ry, r0: Math.sqrt(rx * rx + ry * ry + x0 * x0) };
}
/** equal-leg angle (mm): A, Ix = Iy (legs), Ixy, I1, I2, xg = yg (from the outer heel face), x0 (centroid → shear centre), J, r2, r0 */
export function angleProps({ b, t, ri = t }) {
  const g = thinWalled(midlineAngle({ b, t, ri }), t);
  const I1 = (g.Ixx + g.Iyy) / 2 + Math.hypot((g.Ixx - g.Iyy) / 2, g.Ixy), I2 = (g.Ixx + g.Iyy) / 2 - Math.hypot((g.Ixx - g.Iyy) / 2, g.Ixy);
  const xg = g.xc + t / 2, x0 = Math.hypot(g.xc - g.xs, g.yc - g.ys);
  const rx = Math.sqrt(g.Ixx / g.A);
  return { A: g.A, Ix: g.Ixx, Iy: g.Iyy, Ixy: g.Ixy, I1, I2, xg, x0, J: g.J, Cw: 0, Wx: g.Ixx / (b - xg), rx, r2: Math.sqrt(I2 / g.A),
    r0: Math.sqrt((I1 + I2) / g.A + x0 * x0) };
}
