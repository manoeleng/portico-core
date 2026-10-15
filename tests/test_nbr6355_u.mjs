// test_nbr6355_u.mjs — transcription of NBR 6355:2012 Tab. A.2 (U simples, 126 profiles) in profiles_cf.js
//   node tests/test_nbr6355_u.mjs
// Oracle INDEPENDENT of the table: each section is rebuilt from its dimensions only (bw, bf, t, ri) as a mid-line path
// with rounded corners (rm = ri + t/2) and A, Ix, Iy and xg are integrated numerically (same method as
// tests/test_nbr6355_zcr.mjs). Tolerances: A, Ix 2 %; Iy, xg 3 % (thin-walled model, thickest rows).
// Internal consistency: rx = √(Ix/A), ry = √(Iy/A), m = 0,785·A (1,5 %).
import { cfNames, cfSection } from '../js/design/profiles_cf.js';

let fails = 0, n = 0, rows = 0;
const fail = (msg) => { fails++; console.log('FAIL ' + msg); };
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

const mm = 1e-3;
for (const name of cfNames('U')) {
  const s = cfSection(name), d = s.dims, t = d.t, rm = d.ri + t / 2, h = d.bw - t, b = d.bf - t / 2;
  const path = filletPath([[b, -h / 2], [0, -h / 2], [0, h / 2], [b, h / 2]], rm);
  const o = props(path, t);
  let xg = 0; { let A = 0; for (const [x, , ds] of path) { A += t * ds; xg += t * ds * x; } xg = xg / A + t / 2; }
  const chk = (lbl, got, exp, tol) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= tol)) fail(`${name} ${lbl}: tabela ${got} × geometria ${exp} (${(e * 100).toFixed(2)} %)`); };
  chk('A', s.A, o.A, 0.02); chk('Ix', s.Iz, o.Ix, 0.02); chk('Iy', s.Iy, o.Iy, 0.03); chk('xg', s.xg, xg, 0.03);
  chk('rx', s.rz, Math.sqrt(s.Iz / s.A), 0.015); chk('ry', s.ry, Math.sqrt(s.Iy / s.A), 0.015);
  chk('m', s.massa, 0.785 * s.A * 1e4, 0.015);
  rows++;
}
n++; if (rows !== 126) fail(`contagem: ${rows} (esperado 126)`);
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok (${rows} perfis U simples)`);
process.exit(fails ? 1 : 0);
