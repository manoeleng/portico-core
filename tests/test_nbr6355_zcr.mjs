// test_nbr6355_zcr.mjs — transcription of NBR 6355:2012 Tab. A.4 (Z90), A.5 (Z45), A.6 (cartola) in profiles_cf.js
//   node tests/test_nbr6355_zcr.mjs
// Oracle INDEPENDENT of the table: the section is rebuilt from its dimensions only (bw, bf, D, t, ri) as a mid-line
// path with rounded corners (rm = ri + t/2) and A, Ix, Iy, Ixy and the centroid are integrated numerically.
// Tolerances: A, Ix, Ixy 2 %; Iy 3 % (4 % when the printed ry confirms the printed Iy — the thin-walled model departs
// from the exact section in the thickest rows).
// Internal consistency (typo catcher for the columns the geometry does not give): rx = √(Ix/A), ry = √(Iy/A),
// m = 0,785·A, Wx = Ix/(bw/2) (Z), I1, I2, αp by Mohr (Z) — 1,5 %. Errata: r0 of Z = √(rx² + ry²).
import { cfNames, cfSection } from '../js/design/profiles_cf.js';

let fails = 0, n = 0;
const fail = (msg) => { fails++; console.log('FAIL ' + msg); };

// mid-line path with rounded interior corners → small pieces {x, y, ds, cx, cy}
function filletPath(pts, rm, nArc = 40, nLine = 60) {
  const P = pts.map((p) => [...p]), trims = P.slice(1).map(() => [0, 0]), arcs = [], out = [];
  for (let i = 1; i < P.length - 1; i++) {
    const [a, p, b] = [P[i - 1], P[i], P[i + 1]];
    let d1 = [p[0] - a[0], p[1] - a[1]]; const L1 = Math.hypot(...d1); d1 = [d1[0] / L1, d1[1] / L1];
    let d2 = [b[0] - p[0], b[1] - p[1]]; const L2 = Math.hypot(...d2); d2 = [d2[0] / L2, d2[1] / L2];
    const phi = Math.acos(Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1]))), Lt = rm * Math.tan(phi / 2);
    const t1 = [p[0] - d1[0] * Lt, p[1] - d1[1] * Lt], t2 = [p[0] + d2[0] * Lt, p[1] + d2[1] * Lt];
    const nrm = d1[0] * d2[1] - d1[1] * d2[0] > 0 ? [-d1[1], d1[0]] : [d1[1], -d1[0]];
    const C = [t1[0] + nrm[0] * rm, t1[1] + nrm[1] * rm];
    const a0 = Math.atan2(t1[1] - C[1], t1[0] - C[0]); let da = Math.atan2(t2[1] - C[1], t2[0] - C[0]) - a0;
    while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    arcs.push([C, a0, da]); trims[i - 1][1] = Lt; trims[i][0] = Lt;
  }
  for (let i = 0; i < P.length - 1; i++) {
    const d = [P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]], L = Math.hypot(...d), u = [d[0] / L, d[1] / L];
    const s0 = trims[i][0], s1 = L - trims[i][1];
    for (let k = 0; k < nLine; k++) { const s = s0 + (k + 0.5) * (s1 - s0) / nLine; out.push([P[i][0] + u[0] * s, P[i][1] + u[1] * s, (s1 - s0) / nLine, u[0], u[1]]); }
    if (i < arcs.length) {
      const [C, a0, da] = arcs[i];
      for (let k = 0; k < nArc; k++) { const a = a0 + (k + 0.5) * da / nArc, sg = da > 0 ? 1 : -1; out.push([C[0] + rm * Math.cos(a), C[1] + rm * Math.sin(a), rm * Math.abs(da) / nArc, -Math.sin(a) * sg, Math.cos(a) * sg]); }
    }
  }
  return out;
}
function props(path, t) {
  let A = 0, Sx = 0, Sy = 0;
  for (const [x, y, ds] of path) { A += t * ds; Sx += t * ds * x; Sy += t * ds * y; }
  const xc = Sx / A, yc = Sy / A; let Ix = 0, Iy = 0, Ixy = 0;
  for (const [x, y, ds, cx, cy] of path) { Ix += t * ds * (y - yc) ** 2 + t ** 3 * ds * cx * cx / 12; Iy += t * ds * (x - xc) ** 2 + t ** 3 * ds * cy * cy / 12; Ixy += t * ds * (x - xc) * (y - yc); }
  return { A, yc, Ix, Iy, Ixy };
}
const zPts = (bw, bf, D, t, lip) => {
  const h = bw - t, b = bf - t;
  if (lip === 90) { const c = D - t / 2; return [[-b, -h / 2 + c], [-b, -h / 2], [0, -h / 2], [0, h / 2], [b, h / 2], [b, h / 2 - c]]; }
  const e = D / Math.SQRT2;                                    // 45° lip, outward, length D on the mid-line
  return [[-b - e, -h / 2 + e], [-b, -h / 2], [0, -h / 2], [0, h / 2], [b, h / 2], [b + e, h / 2 - e]];
};
const crPts = (bw, bf, D, t) => { const h = bw - t, b = bf - t, c = D - t / 2; return [[-b / 2 - c, 0], [-b / 2, 0], [-b / 2, h], [b / 2, h], [b / 2, 0], [b / 2 + c, 0]]; };

const rel = (g, e) => Math.abs(g - e) / Math.abs(e);
const counts = { Z: 0, Cr: 0 };
for (const shape of ['Z', 'Cr']) for (const name of cfNames(shape)) {
  const s = cfSection(name), mm = 1e3, d = s.dims, t = d.t * mm;
  const pts = shape === 'Z' ? zPts(d.bw * mm, d.bf * mm, d.D * mm, t, s.lip) : crPts(d.bw * mm, d.bf * mm, d.D * mm, t);
  const g = props(filletPath(pts, d.ri * mm + t / 2), t);       // mm
  counts[shape]++;
  n += 3;
  if (rel(g.A / 1e6, s.A) > 0.02) fail(`${name}: A geom ${(g.A / 100).toFixed(3)} × tab ${(s.A * 1e4).toFixed(3)} cm²`);
  if (rel(g.Ix / 1e12, s.Iz) > 0.02) fail(`${name}: Ix geom ${(g.Ix / 1e4).toFixed(2)} × tab ${(s.Iz * 1e8).toFixed(2)} cm⁴`);
  // Iy: 3 %; up to 4 % only when the independently printed ry confirms the printed Iy (√(Iy/A) within 1,5 %) — then the
  // transcription is right and the residual is the thin-walled model (thickest hat rows, e.g. Cr 100×50×20×3,35: 3,4 %)
  { const e = rel(g.Iy / 1e12, s.Iy), ryOk = rel(Math.sqrt(s.Iy / s.A), s.ry) <= 0.015;
    if (e > 0.04 || (e > 0.03 && !ryOk)) fail(`${name}: Iy geom ${(g.Iy / 1e4).toFixed(2)} × tab ${(s.Iy * 1e8).toFixed(2)} cm⁴`); }
  if (shape === 'Z') { n++; if (rel(Math.abs(g.Ixy) / 1e12, s.Izy) > 0.02) fail(`${name}: Ixy geom ${(g.Ixy / 1e4).toFixed(2)} × tab ${(s.Izy * 1e8).toFixed(2)}`); }
  else { n++; const ygTop = (d.bw * mm - g.yc - t / 2) / 10; if (rel(ygTop, s.yg * 100) > 0.02) fail(`${name}: yg (do topo) geom ${ygTop.toFixed(3)} × tab ${(s.yg * 100).toFixed(3)} cm`); }
  // internal consistency
  const chk = { rx: [Math.sqrt(s.Iz / s.A), s.rz], ry: [Math.sqrt(s.Iy / s.A), s.ry], m: [7850 * s.A, s.massa] };
  if (shape === 'Z') {
    chk.Wx = [s.Iz / (d.bw / 2), s.Sz];
    const C = (s.Iz + s.Iy) / 2, R = Math.hypot((s.Iz - s.Iy) / 2, s.Izy);
    chk.I1 = [C + R, s.I1]; chk.I2 = [C - R, s.I2];
    chk['αp'] = [0.5 * Math.atan2(2 * s.Izy, s.Iz - s.Iy) * 180 / Math.PI, s.alphaP];
    chk['r0 = √(rx²+ry²)'] = [Math.sqrt((s.Iz + s.Iy) / s.A), s.r0];
  }
  for (const [k, [c, v]] of Object.entries(chk)) { n++; if (rel(c, v) > 0.015) fail(`${name}: ${k} calc ${c} × tab ${v}`); }
}
n++; if (counts.Z !== 108 || counts.Cr !== 26) fail(`contagem: Z ${counts.Z} (esperado 60 + 48), cartola ${counts.Cr} (esperado 26)`);
// errata documented: the printed r0 of Z90 250×85×25×2,00 is 21,72 cm; the correct √(rx² + ry²) = 10,51 cm
{ const s = cfSection('Z90 250x85x25x2,00'); n++; if (!(Math.abs(s.r0 * 100 - 10.51) < 0.02 && Math.abs(s.r0Tab * 100 - 21.72) < 1e-9)) fail(`errata r0 Z90 250×85: ${s.r0 * 100} / ${s.r0Tab * 100}`); }

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok (Z ${counts.Z}, cartola ${counts.Cr})`);
process.exit(fails ? 1 : 0);
