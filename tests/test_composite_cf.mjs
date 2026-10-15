// test_composite_cf.mjs — built-up cold-formed sections (js/design/composite_cf.js)
//   node tests/test_composite_cf.mjs
// Oracle INDEPENDENT of the code path: the built-up section is rebuilt from its DIMENSIONS ONLY as thin-walled
// mid-line paths (two profiles placed as in the assembly, rounded corners rm = ri + t/2) and A, Iz, Iy are
// integrated numerically; the code uses the TABULATED single-profile values of NBR 6355 + Steiner. Tolerance 3 %
// (thin-walled model vs exact section, as in tests/test_nbr6355_zcr.mjs). Closed box J: Bredt by hand.
import { compositeSection, parseCompositeName, compositeName } from '../js/design/composite_cf.js';
import { cfProfile } from '../js/design/profiles_cf.js';

let fails = 0, n = 0;
const ok = (name, got, exp, tol) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toPrecision(5)} (${(e * 100).toFixed(2)} %)`); };

// thin-walled integration of mid-line polylines [[x,y],…] with thickness t and ROUNDED corners (rm = ri + t/2, ri = t
// as in NBR 6355 Tab. A.1/A.3) — the same independent integration as tests/test_nbr6355_zcr.mjs
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
function integrate(paths, t, rm = 1.5 * t) {
  const pieces = paths.flatMap((P) => filletPath(P, rm));
  const r = props(pieces, t);
  return { A: r.A, Ix: r.Ix, Iy: r.Iy };
}
const mm = 1e-3;
// Ue mid-line (web at x = 0, flanges towards +x), dims outer bw, bf, D, t
const ueMid = (d, flip = 1, dx = 0) => { const t = d.t, h = d.bw - t, b = d.bf - t, c = d.D - t / 2;
  return [[[b, -h / 2 + c], [b, -h / 2], [0, -h / 2], [0, h / 2], [b, h / 2], [b, h / 2 - c]].map(([x, y]) => [dx + flip * x, y])]; };
const lMid = (d, flip = 1, dx = 0) => { const t = d.t, a = d.b - t / 2; return [[[a, 0], [0, 0], [0, a]].map(([x, y]) => [dx + flip * x, y])]; };

{ // 2Ue costas: webs back to back, gap g → web mid-lines at ±(g/2 + t/2)
  const base = 'Ue 150x60x20x2,00', d = cfProfile(base).dims, g = 0.004;
  const c = compositeSection('2Ue', base, 'costas', 4);
  const o = integrate([...ueMid(d, 1, g / 2 + d.t / 2), ...ueMid(d, -1, -(g / 2 + d.t / 2))], d.t);
  ok('C1. 2Ue costas: A', c.A, o.A, 0.03); ok('C1b. Iz (eixo horizontal)', c.Iz, o.Ix, 0.03); ok('C1c. Iy (eixo de simetria)', c.Iy, o.Iy, 0.03);
}
{ // 2Ue caixa: lips facing, touching (g = 0) → flange tip mid-lines meet at x = 0
  const base = 'Ue 150x60x20x2,00', d = cfProfile(base).dims;
  const c = compositeSection('2Ue', base, 'caixa', 0);
  const xb = d.bf - d.t / 2;                                   // web mid-line distance from the lip plane
  const o = integrate([...ueMid(d, 1, -xb), ...ueMid(d, -1, xb)], d.t);
  ok('C2. 2Ue caixa: A', c.A, o.A, 0.03); ok('C2b. Iz', c.Iz, o.Ix, 0.03); ok('C2c. Iy', c.Iy, o.Iy, 0.03);
  // Bredt by hand: mid-line rectangle (bw − t) × (2bf − t), J = 4·Am²·t / perimeter
  const hm = (150 - 2) * mm, bm = (120 - 2) * mm, t = 2 * mm, Am = hm * bm, J = 4 * Am * Am * t / (2 * (hm + bm));
  ok('C2d. caixa fechada: J (Bredt)', c.J, J, 1e-9);
}
{ // 2L costas: vertical legs back to back, gap 8 mm
  const base = 'L 60x2,25', p = cfProfile(base);
  if (!p) { n++; fails++; console.log('FAIL C3. perfil L 60x2,25 ausente do catálogo'); }
  else {
    const d = p.dims, g = 0.008, c = compositeSection('2L', base, 'costas', 8);
    const o = integrate([...lMid(d, 1, g / 2 + d.t / 2), ...lMid(d, -1, -(g / 2 + d.t / 2))], d.t);
    ok('C3. 2L costas g8: A', c.A, o.A, 0.03); ok('C3b. Iz', c.Iz, o.Ix, 0.03); ok('C3c. Iy', c.Iy, o.Iy, 0.03);
  }
}
{ // 2U caixa: plain channels with the flange tips facing and touching (g = 0)
  const base = 'U 150x75x2,65', p = cfProfile(base), d = p.dims, t = d.t, h = d.bw - t, b = d.bf - t / 2;
  const c = compositeSection('2U', base, 'caixa', 0);
  const right = [[b, -h / 2], [0, -h / 2], [0, h / 2], [b, h / 2]].map(([x, y]) => [x - b, y]);  // tips at x = 0
  const o = integrate([right.map(([x, y]) => [x, y]), right.map(([x, y]) => [-x, y])], t, d.ri + t / 2);
  ok('C4. 2U caixa: A', c.A, o.A, 0.03); ok('C4b. Iz', c.Iz, o.Ix, 0.03); ok('C4c. Iy', c.Iy, o.Iy, 0.03);
}
{ // names round-trip
  const nm = compositeName('2Ue', 'Ue 200x75x25x2,65', 'caixa', 0), q = parseCompositeName(nm);
  n++; if (nm !== '2Ue 200x75x25x2,65 caixa' || q.base !== 'Ue 200x75x25x2,65' || q.arr !== 'caixa' || q.gapMm !== 0) { fails++; console.log('FAIL N1. nome', nm, JSON.stringify(q)); } else console.log('ok   N1. nome', nm);
  const q2 = parseCompositeName('2L 60x2,25 costas g8');
  n++; if (!(q2 && q2.base === 'L 60x2,25' && q2.gapMm === 8)) { fails++; console.log('FAIL N2', JSON.stringify(q2)); } else console.log('ok   N2. nome 2L com folga');
}
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
