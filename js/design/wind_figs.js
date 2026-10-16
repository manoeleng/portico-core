// wind_figs.js — figures of the wind study (NBR 6123:2023) in the style of the dedicated wind programs (Notus):
// shaded isometric view with ground plane and dimensions, orthographic views (front / side / top), walls and roof
// in plan with a LOAD BLOCK per zone (base line on the surface, envelope line, uniform arrows, value), cross-
// sections A-B with Cpe, Cpi and Cp = Cpe − Cpi, the cpe médio regions (coloured and dimensioned) and the
// vertical profile q(z). Red = pressure (toward the surface), blue = suction (away). Pure SVG strings.
const F = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('pt-BR', { maximumFractionDigits: d });
const S = (v, d = 2) => (v > 0 ? '+' : '') + F(v, d);
const T = (x, y, s, o = '') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="11" font-family="Segoe UI,Arial,sans-serif" text-anchor="middle" ${o}>${s}</text>`;
const L = (x1, y1, x2, y2, o = 'stroke="#334155" stroke-width="1"') => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${o}/>`;
const PG = (pts, o) => `<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" ${o}/>`;
const RED = '#dc2626', BLUE = '#1d4ed8';
const DEFS = `<defs>
 <marker id="ar" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="${RED}"/></marker>
 <marker id="ab" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="${BLUE}"/></marker>
 <marker id="ak" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#111827"/></marker>
 <marker id="aw" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#0f766e"/></marker>
 <pattern id="gr" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#f8fafc"/><path d="M14 0H0V14" fill="none" stroke="#e2e8f0" stroke-width="1"/></pattern>
 <marker id="dt" markerWidth="6" markerHeight="6" refX="3" refY="3"><circle cx="3" cy="3" r="1.6" fill="#111827"/></marker>
 <pattern id="hR" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#ede9fe"/><line x1="0" y1="0" x2="0" y2="5" stroke="#7c3aed" stroke-width="1.2"/></pattern>
 <pattern id="hB" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#e2e8f0"/><line x1="0" y1="0" x2="0" y2="5" stroke="#475569" stroke-width="1.2"/></pattern>
 <pattern id="hD" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#ccfbf1"/><circle cx="2" cy="2" r=".8" fill="#0f766e"/></pattern></defs>`;
const svg = (W, H, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="background:#fff">${DEFS}${body}${title ? T(W / 2, 15, title, 'font-weight="600" fill="#0f172a" font-size="12"') : ''}</svg>`;
// dimension line (ticks at the ends), label at the middle, offset along the normal
function dim(x1, y1, x2, y2, label, off = 14, col = '#475569') {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy * off, ny = ux * off;
  const a = [x1 + nx, y1 + ny], b = [x2 + nx, y2 + ny], tk = (p) => L(p[0] - (ux + uy) * 3, p[1] - (uy - ux) * 3, p[0] + (ux + uy) * 3, p[1] + (uy - ux) * 3, `stroke="${col}" stroke-width="1.2"`);
  let ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
  const mx = (a[0] + b[0]) / 2 + Math.sign(off) * (-uy) * 7, my = (a[1] + b[1]) / 2 + Math.sign(off) * ux * 7 + 3;
  return L(x1, y1, a[0], a[1], 'stroke="#cbd5e1"') + L(x2, y2, b[0], b[1], 'stroke="#cbd5e1"') + L(a[0], a[1], b[0], b[1], `stroke="${col}"`) + tk(a) + tk(b)
    + `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-size="10" font-family="Segoe UI,Arial,sans-serif" text-anchor="middle" fill="${col}" transform="rotate(${ang.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})">${label}</text>`;
}
// LOAD BLOCK on a surface segment: outward normal (nx, ny); value v (Cp or pressure) → envelope at k·|v| (min 10 px);
// pressure (v > 0) arrows point to the surface, suction away; label on the envelope
function block(x1, y1, x2, y2, nx, ny, v, label, k = 30, n = null) {
  const c = v >= 0 ? RED : BLUE, mk = v >= 0 ? 'ar' : 'ab', len = Math.hypot(x2 - x1, y2 - y1), H = Math.max(10, k * Math.min(Math.abs(v), 2.5));
  const m = n ?? Math.max(2, Math.round(len / 18));
  const ex1 = x1 + nx * H, ey1 = y1 + ny * H, ex2 = x2 + nx * H, ey2 = y2 + ny * H;
  let s = L(ex1, ey1, ex2, ey2, `stroke="${c}" stroke-width="1.3"`) + L(x1, y1, ex1, ey1, `stroke="${c}"`) + L(x2, y2, ex2, ey2, `stroke="${c}"`);
  for (let i = 0; i <= m; i++) {
    const t = i / m, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t, qx = px + nx * H, qy = py + ny * H;
    s += v >= 0 ? L(qx, qy, px + nx * 1.5, py + ny * 1.5, `stroke="${c}" stroke-width="1.1" marker-end="url(#${mk})"`) : L(px + nx * 1.5, py + ny * 1.5, qx, qy, `stroke="${c}" stroke-width="1.1" marker-end="url(#${mk})"`);
  }
  let ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
  const mx = (ex1 + ex2) / 2 + nx * 9, my = (ey1 + ey2) / 2 + ny * 9 + 3.5;
  return s + `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-size="10.5" font-family="Segoe UI,Arial,sans-serif" font-weight="600" text-anchor="middle" fill="${c}" transform="rotate(${ang.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})">${label}</text>`;
}
const zv = (st, zona, cpi, what = 'cp') => { const z = st.zonas.find((q) => q.z === zona); if (!z) return 0; if (what === 'cpe') return z.cpe; const p = z.por.find((r) => r.cpi === cpi); return what === 'p' ? z.q * p.cp : p.cp; };   // p unrounded (q·Cp, kN/m²)
const WIND = '#0f766e';
const wind = (x1, y1, x2, y2, lbl) => L(x1, y1, x2, y2, `stroke="${WIND}" stroke-width="2.6" stroke-dasharray="7 3" marker-end="url(#aw)"`) + T((x1 + x2) / 2, Math.min(y1, y2) - 8, lbl, `fill="${WIND}" font-weight="700" font-size="12" font-style="italic"`);
const WALL1 = '#dbe4ee', WALL2 = '#b8c6d6', ROOF1 = '#4b6584', ROOF2 = '#5f7fa3', EDGE = '#1e293b';

/** shaded isometric view (long wall yellow, gable white, roof orange, ground plane), dimensions and V0/V90 */
export function figIsometrica(st) {
  const { a, b, hBeiral: h } = st.inp, hT = st.hTop, W = 600, H = 380;
  const c30 = Math.cos(Math.PI / 6), raw = (X, Y, Z) => [(X - Y) * c30, (X + Y) * 0.5 - Z];
  const g0 = 0.16 * Math.max(a, b), box = [[-g0, -g0, 0], [a + g0, -g0, 0], [a + g0, b + g0, 0], [-g0, b + g0, 0], [0, 0, hT]].map((p) => raw(...p));
  const xs = box.map((p) => p[0]), ys = box.map((p) => p[1]);
  const sc = Math.min((W - 40) / (Math.max(...xs) - Math.min(...xs)), (H - 50) / (Math.max(...ys) - Math.min(...ys)));
  const ox = (W - sc * (Math.max(...xs) + Math.min(...xs))) / 2, oy = (H - sc * (Math.max(...ys) + Math.min(...ys))) / 2 + 12;
  const P = (X, Y, Z) => { const [u, v] = raw(X, Y, Z); return [ox + sc * u, oy + sc * v]; };
  const o = `stroke="${EDGE}" stroke-width="1.3" stroke-linejoin="round"`;
  let g = PG([P(-g0, -g0, 0), P(a + g0, -g0, 0), P(a + g0, b + g0, 0), P(-g0, b + g0, 0)], 'fill="url(#gr)" stroke="#cbd5e1"') + PG([P(0.06 * a, 0.06 * b, 0), P(a + 0.10 * a, 0.06 * b, 0), P(a + 0.10 * a, b + 0.10 * b, 0), P(0.06 * a, b + 0.10 * b, 0)], 'fill="#0f172a" opacity=".08"');
  g += PG([P(0, 0, 0), P(0, 0, h), P(0, b / 2, hT), P(0, b, h), P(0, b, 0)], 'fill="#f1f5f9" stroke="#94a3b8" stroke-dasharray="3 2"');   // back gable (hidden)
  g += PG([P(0, b, 0), P(a, b, 0), P(a, b, h), P(0, b, h)], `fill="${WALL1}" ${o}`);                       // long wall
  g += PG([P(a, 0, 0), P(a, b, 0), P(a, b, h), P(a, b / 2, hT), P(a, 0, h)], `fill="${WALL2}" ${o}`);      // gable
  g += PG([P(0, 0, h), P(a, 0, h), P(a, b / 2, hT), P(0, b / 2, hT)], `fill="${ROOF1}" ${o}`);             // back slope
  g += PG([P(0, b / 2, hT), P(a, b / 2, hT), P(a, b, h), P(0, b, h)], `fill="${ROOF2}" ${o}`);             // front slope
  g += dim(...P(0, b, 0), ...P(a, b, 0), `a = ${F(a)} m`, 26) + dim(...P(a, b, 0), ...P(a, 0, 0), `b = ${F(b)} m`, 26);
  g += dim(...P(0, b, 0), ...P(0, b, h), `H = ${F(h)} m`, 22) + dim(...P(0, b, h), ...P(0, b / 2, hT), `h1 = ${F(hT - h)} m`, 22);
  const c0 = P(-0.06 * a, b / 2, hT + 0.25 * h), c1 = P(0.04 * a, b / 2, hT + 0.12 * h);
  g += wind(c0[0], c0[1], c1[0], c1[1], 'α = 0°');
  const d0 = P(0.45 * a, b + 0.30 * b, 0.55 * h), d1 = P(0.45 * a, b + 0.05 * b, 0.55 * h);
  g += wind(d0[0], d0[1], d1[0], d1[1], 'α = 90°');
  return svg(W, H, g, 'Geometria');
}

/** orthographic views: front (gable), side (long wall) and top, dimensioned, with the wind directions */
export function figVistas(st) {
  const { a, b, hBeiral: h } = st.inp, hT = st.hTop, W = 830, H = 272, base = H - 52;
  const s1 = Math.min(190 / b, 150 / hT), s2 = Math.min(230 / a, 150 / hT), s3 = Math.min(150 / b, 180 / a);
  let g = '';
  // front view (gable, width b): V90 in the plane, V0 into the page (dot)
  { const x0 = 72, X = (v) => x0 + v * s1, Y = (z) => base - z * s1;
    g += L(x0 - 14, base, X(b) + 14, base, 'stroke="#64748b" stroke-width="2"') + PG([[X(0), Y(0)], [X(0), Y(h)], [X(b / 2), Y(hT)], [X(b), Y(h)], [X(b), Y(0)]], `fill="${WALL2}" stroke="${EDGE}" stroke-width="1.3"`);
    g += PG([[X(0), Y(h)], [X(b / 2), Y(hT)], [X(b), Y(h)]], `fill="none" stroke="${ROOF1}" stroke-width="3"`);
    g += dim(X(0), Y(0), X(b), Y(0), `b = ${F(b)} m`, 18) + dim(X(b), Y(0), X(b), Y(h), `H = ${F(h)}`, 16) + dim(X(b), Y(h), X(b), Y(hT), `h1 = ${F(hT - h)}`, 16);   // dimensions on the right: the wind arrow stays alone on the left
    g += wind(X(0) - 44, Y(h * 0.82), X(0) - 22, Y(h * 0.82), 'α = 90°') + `<circle cx="${X(b / 2)}" cy="${Y(h * 0.5)}" r="5" fill="none" stroke="${WIND}" stroke-width="2"/><circle cx="${X(b / 2)}" cy="${Y(h * 0.5)}" r="1.6" fill="${WIND}"/>` + T(X(b / 2), Y(h * 0.5) - 10, 'α = 0°', `fill="${WIND}" font-weight="700" font-style="italic"`) + T(X(b / 2), H - 6, 'Frontal (empena)', 'font-size="10" fill="#475569"'); }
  // side view (long wall a)
  { const x0 = 360, X = (v) => x0 + v * s2, Y = (z) => base - z * s2;
    g += L(x0 - 14, base, X(a) + 14, base, 'stroke="#64748b" stroke-width="2"') + PG([[X(0), Y(0)], [X(0), Y(h)], [X(a), Y(h)], [X(a), Y(0)]], `fill="${WALL1}" stroke="${EDGE}" stroke-width="1.3"`);
    g += PG([[X(0), Y(h)], [X(0), Y(hT)], [X(a), Y(hT)], [X(a), Y(h)]], `fill="${ROOF2}" stroke="${EDGE}" stroke-width="1.3"`);
    g += dim(X(0), Y(0), X(a), Y(0), `a = ${F(a)} m`, 18) + wind(X(0) - 40, Y(h * 0.5), X(0) - 6, Y(h * 0.5), 'α = 0°') + `<circle cx="${X(a / 2)}" cy="${Y(h * 0.5)}" r="5" fill="none" stroke="${WIND}" stroke-width="2"/><circle cx="${X(a / 2)}" cy="${Y(h * 0.5)}" r="1.6" fill="${WIND}"/>` + T(X(a / 2), Y(h * 0.5) - 10, 'α = 90°', `fill="${WIND}" font-weight="700" font-style="italic"`) + T(X(a / 2), H - 6, 'Lateral', 'font-size="10" fill="#475569"'); }
  // top view
  { const x0 = 640, y0 = 34, X = (v) => x0 + v * s3, Y = (v) => y0 + v * s3;
    g += `<rect x="${X(0)}" y="${Y(0)}" width="${b * s3}" height="${a * s3}" fill="${ROOF2}" stroke="${EDGE}" stroke-width="1.3"/>` + L(X(b / 2), Y(0), X(b / 2), Y(a), 'stroke="#e2e8f0" stroke-width="1.5"');
    g += dim(X(0), Y(a), X(b), Y(a), `b = ${F(b)}`, 16) + dim(X(0), Y(0), X(0), Y(a), `a = ${F(a)}`, 16) + wind(X(b / 2), Y(0) - 26, X(b / 2), Y(0) - 4, '') + T(X(b / 2) + 26, Y(0) - 14, 'α = 0°', `fill="${WIND}" font-weight="700" font-style="italic"`);
    g += wind(X(b) + 30, Y(a / 2), X(b) + 6, Y(a / 2), '') + T(X(b) + 24, Y(a / 2) - 8, 'α = 90°', `fill="${WIND}" font-weight="700" font-style="italic"`) + T(X(b / 2), H - 6, 'Topo', 'font-size="10" fill="#475569"'); }
  return svg(W, H, g, 'Vistas');
}

/** walls in plan (a vertical, as the figure of Tab. 6) with a load block per zone — what = 'cpe' or Cp/pressure of one Cpi */
export function figParedes(st, alpha, cpi = null, what = 'cpe') {
  const { a, b } = st.inp, W = 460, H = 460, M = 100;
  const sc = Math.min((W - 2 * M) / b, (H - 2 * M) / a), w = b * sc, hh = a * sc, x = (W - w) / 2, y = (H - hh) / 2 + 10;
  const val = (z) => (what === 'cpe' ? zv(st, z, null, 'cpe') : zv(st, z, cpi, what));
  const lab = (v) => (what === 'p' ? F(Math.abs(v) * 1000, 1) : F(Math.abs(v), 2));
  const k = what === 'p' ? 30 / Math.max(...st.zonas.map((z) => Math.abs(z.por[0].p)), 0.1) : 26;
  const blk = (x1, y1, x2, y2, nx, ny, z) => { const v = val(z); return block(x1, y1, x2, y2, nx, ny, v, lab(v), k); };
  let g = `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="#fff" stroke="#111827" stroke-width="1.4"/>`;
  g += L(x + w / 2, y - 6, x + w / 2, y + hh + 6, 'stroke="#64748b" stroke-dasharray="10 3 2 3"');
  if (alpha === 0) {
    const x0 = st.geo.x0 * sc, m = hh / 2;
    g += L(x - 10, y + m, x + w + 10, y + m, 'stroke="#64748b" stroke-dasharray="10 3 2 3"');
    for (const [xx, nx, s] of [[x, -1, 'A'], [x + w, 1, 'B']]) {
      g += blk(xx, y, xx, y + x0, nx, 0, 'A1/B1') + blk(xx, y + x0, xx, y + m, nx, 0, 'A2/B2') + blk(xx, y + m, xx, y + hh, nx, 0, 'A3/B3');
      for (const [yy, i] of [[y + x0 / 2, 1], [y + (x0 + m) / 2, 2], [y + 3 * hh / 4, 3]]) g += T(xx - nx * 14, yy + 4, `${s}${i}`, 'font-size="11"');
    }
    g += blk(x, y, x + w, y, 0, -1, 'C') + blk(x + w, y + hh, x, y + hh, 0, 1, 'D') + T(x + w / 2, y + 16, 'C') + T(x + w / 2, y + hh - 8, 'D');
    g += dim(x + w, y, x + w, y + x0, `${F(st.geo.x0)}`, -88) + dim(x + w, y + x0, x + w, y + m, `${F(a / 2 - st.geo.x0)}`, -88) + dim(x + w, y + m, x + w, y + hh, `${F(a / 2)}`, -88);
    g += wind(x + w / 2 - 70, y - 76, x + w / 2 - 70, y - 44, '') + T(x + w / 2 - 90, y - 60, '0°', 'font-weight="700" font-size="16"');
  } else {
    const c1 = st.geo.xC1 * sc;
    g += blk(x, y + hh, x, y, -1, 0, 'A') + blk(x + w, y, x + w, y + hh, 1, 0, 'B') + T(x + 14, y + hh / 2 + 4, 'A') + T(x + w - 14, y + hh / 2 + 4, 'B');
    g += blk(x, y, x + c1, y, 0, -1, 'C1/D1') + blk(x + c1, y, x + w, y, 0, -1, 'C2/D2') + blk(x + c1, y + hh, x, y + hh, 0, 1, 'C1/D1') + blk(x + w, y + hh, x + c1, y + hh, 0, 1, 'C2/D2');
    g += T(x + c1 / 2, y + 16, 'C1') + T(x + (c1 + w) / 2, y + 16, 'C2') + T(x + c1 / 2, y + hh - 8, 'D1') + T(x + (c1 + w) / 2, y + hh - 8, 'D2');
    g += L(x + c1, y - 4, x + c1, y + hh + 4, 'stroke="#64748b" stroke-dasharray="4 3"');
    g += dim(x, y + hh, x + c1, y + hh, `${F(st.geo.xC1)}`, 64);
    g += wind(x - 98, y + hh / 2 + 34, x - 62, y + hh / 2 + 34, '') + T(x - 80, y + hh / 2 + 22, '90°', 'font-weight="700" font-size="16"');
  }
  g += dim(x, y + hh, x + w, y + hh, `b = ${F(b)} m`, alpha === 0 ? 58 : 62);
  const tt = what === 'cpe' ? 'Cpe' : what === 'cp' ? `Cp = Cpe − Cpi (Cpi = ${S(cpi, 1)})` : `p [N/m²] (Cpi = ${S(cpi, 1)})`;
  return svg(W, H, g, `Paredes — vento ${alpha}° — ${tt}`);
}

/** roof in plan (a horizontal, b vertical) — zones dimensioned with the values (load-block colours) */
export function figTelhado(st, alpha, cpi = null, what = 'cpe') {
  const { a, b } = st.inp, W = 520, H = 320, M = 64;
  const sc = Math.min((W - 2 * M) / a, (H - 2 * M) / b), w = a * sc, hh = b * sc, x = (W - w) / 2, y = (H - hh) / 2 + 8;
  const val = (z) => (what === 'cpe' ? zv(st, z, null, 'cpe') : zv(st, z, cpi, what));
  const fill = (v) => (v >= 0 ? '#fee2e2' : Math.abs(v) >= 1 ? '#bfdbfe' : '#dbeafe');
  const lbl = (v) => (what === 'p' ? F(v * 1000, 1) : S(v, 2));
  const zone = (x1, y1, ww, h1, z, n) => { const v = val(z); return `<rect x="${x1}" y="${y1}" width="${ww}" height="${h1}" fill="${fill(v)}" stroke="#334155" stroke-width=".9"/>` + T(x1 + 12, y1 + 14, n, 'font-size="10" fill="#334155"') + T(x1 + ww / 2, y1 + h1 / 2 + 5, lbl(v), `font-weight="700" font-size="13" fill="${v >= 0 ? RED : BLUE}"`); };
  let g = '';
  if (alpha === 0) {
    const x0 = st.geo.x0 * sc, m = w / 2;
    g += zone(x, y, x0, hh / 2, 'EG', 'G') + zone(x, y + hh / 2, x0, hh / 2, 'EG', 'E') + zone(x + x0, y, m - x0, hh / 2, 'FH', 'H') + zone(x + x0, y + hh / 2, m - x0, hh / 2, 'FH', 'F') + zone(x + m, y, m, hh / 2, 'IJ', 'J') + zone(x + m, y + hh / 2, m, hh / 2, 'IJ', 'I');
    g += dim(x, y, x + x0, y, F(st.geo.x0), -14) + dim(x + x0, y, x + m, y, F(a / 2 - st.geo.x0), -14) + dim(x + m, y, x + w, y, F(a / 2), -14);
    g += wind(x - 52, y + hh / 2 + 22, x - 10, y + hh / 2 + 22, '') + T(x - 34, y + hh / 2 + 10, '0°', 'font-weight="700" font-size="14"');
  } else {
    g += zone(x, y + hh / 2, w, hh / 2, 'EFI', 'E F I') + zone(x, y, w, hh / 2, 'GHJ', 'G H J');
    g += wind(x + w / 2, H - 6, x + w / 2, y + hh + 6, '') + T(x + w / 2 + 22, H - 12, '90°', 'font-weight="700" font-size="14"');
  }
  g += L(x, y + hh / 2, x + w, y + hh / 2, 'stroke="#111827" stroke-width="2.2"') + T(x + 4, y + hh / 2 - 4, 'cumeeira', 'text-anchor="start" font-size="9" fill="#475569"');
  // a: below for 0° (the zone widths are on top), on top for 90° (the wind arrow comes from below)
  g += (alpha === 0 ? dim(x, y + hh, x + w, y + hh, `a = ${F(a)} m`, 16) : dim(x, y, x + w, y, `a = ${F(a)} m`, -14)) + dim(x + w, y, x + w, y + hh, `b = ${F(b)} m`, -18);
  const tt = what === 'cpe' ? 'Cpe' : what === 'cp' ? `Cp (Cpi = ${S(cpi, 1)})` : `p [N/m²] (Cpi = ${S(cpi, 1)})`;
  return svg(W, H, g, `Telhado — vento ${alpha}° — ${tt}`);
}

/** cross-section A-B (gable): walls and slopes with load blocks. what: 'cpe' | 'cpi' | 'cp' | 'p' | 'q' (frame load kN/m)
 *  alpha 90 → A, B, EFI, GHJ; alpha 0 → region r = 1|2|3 (A1/B1+EG, A2/B2+FH, A3/B3+IJ) */
export function figCorte(st, alpha, cpi = null, what = 'cp', { r = 1, spacing = null } = {}) {
  const { b, hBeiral: h } = st.inp, hT = st.hTop, W = 500, H = 300;
  const sc = Math.min(270 / b, 165 / hT), x0 = (W - b * sc) / 2, y0 = H - 46, X = (v) => x0 + v * sc, Y = (z) => y0 - z * sc;
  const Z = alpha === 90 ? ['A', 'B', 'EFI', 'GHJ'] : r === 1 ? ['A1/B1', 'A1/B1', 'EG', 'EG'] : r === 2 ? ['A2/B2', 'A2/B2', 'FH', 'FH'] : ['A3/B3', 'A3/B3', 'IJ', 'IJ'];
  const val = (z) => what === 'cpe' ? zv(st, z, null, 'cpe') : what === 'cpi' ? -cpi : what === 'cp' ? zv(st, z, cpi, 'cp') : zv(st, z, cpi, 'p') * (what === 'q' ? spacing : 1);
  const vs = Z.map(val), vmax = Math.max(...vs.map(Math.abs), 1e-9), k = what === 'cpe' || what === 'cp' || what === 'cpi' ? 34 : 40 / vmax;
  const lab = (v) => what === 'p' ? F(Math.abs(v) * 1000, 1) : what === 'q' ? F(Math.abs(v), 3) : F(Math.abs(v), 2);
  let g = L(x0 - 40, y0, X(b) + 40, y0, 'stroke="#64748b" stroke-width="2.4"');
  g += PG([[X(0), Y(0)], [X(0), Y(h)], [X(b / 2), Y(hT)], [X(b), Y(h)], [X(b), Y(0)]], 'fill="#fff" stroke="#111827" stroke-width="1.3"');
  const n1 = [-(hT - h), -(b / 2)], l1 = Math.hypot(...n1), n2 = [(hT - h), -(b / 2)], l2 = Math.hypot(...n2);
  g += block(X(0), Y(0), X(0), Y(h), -1, 0, vs[0], lab(vs[0]), k) + block(X(b), Y(h), X(b), Y(0), 1, 0, alpha === 90 ? vs[1] : vs[1], lab(vs[1]), k);
  g += block(X(0), Y(h), X(b / 2), Y(hT), n1[0] / l1, n1[1] / l1, vs[2], lab(vs[2]), k) + block(X(b / 2), Y(hT), X(b), Y(h), n2[0] / l2, n2[1] / l2, vs[3], lab(vs[3]), k);
  if (alpha === 90) g += wind(14, Y(h * 0.5), X(0) - 62, Y(h * 0.5), '') + T(26, Y(h * 0.5) - 8, '90°', 'font-weight="700"');
  else g += `<circle cx="${X(b / 2)}" cy="${Y(h * 0.45)}" r="5" fill="none" stroke="${WIND}" stroke-width="2"/><circle cx="${X(b / 2)}" cy="${Y(h * 0.45)}" r="1.6" fill="${WIND}"/>` + T(X(b / 2), Y(h * 0.45) - 10, `α = 0° — região ${r}`, `fill="${WIND}" font-weight="700" font-style="italic"`);
  const un = what === 'p' ? ' [N/m²]' : what === 'q' ? ` [kN/m] (pórticos a ${F(spacing)} m)` : '';
  const tt = what === 'cpe' ? 'Cpe' : what === 'cpi' ? `Cpi = ${S(cpi, 1)} (seta para dentro = sobrepressão interna)` : `${what === 'cp' ? 'Cp = Cpe − Cpi' : 'p = q·Cp'}${un}, Cpi = ${S(cpi, 1)}`;
  g += T(W / 2, H - 10, 'Corte transversal A-B', 'fill="#0f766e" font-size="11" font-style="italic"');
  return svg(W, H, g, `Vento ${alpha}° — ${tt}`);
}

/** cpe médio regions of the roof (Tab. 7): gables (blue hatch), corners (red hatch), eaves (green), ridge (dotted) */
export function figCpeMedio(st) {
  const { a, b } = st.inp, W = 560, H = 330, M = 80, yR = st.geo.y, x0 = st.geo.x0;
  const sc = Math.min((W - 2 * M) / a, (H - 2 * M) / b), w = a * sc, hh = b * sc, x = (W - w) / 2, y = (H - hh) / 2 + 6, ys = yR * sc, xs = x0 * sc;
  const cm = Object.fromEntries(st.cpeMedioTelhado.map((c) => [c.zona, c.cpe]));
  const v = (k) => (cm[k] != null ? F(cm[k], 1) : '—');
  let g = `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="#fff" stroke="#111827" stroke-width="1.4"/>`;
  g += `<rect x="${x + ys}" y="${y + hh / 2 - ys}" width="${w - 2 * ys}" height="${2 * ys}" fill="url(#hD)" stroke="#0f766e"/>`;
  g += `<rect x="${x + xs}" y="${y}" width="${w - 2 * xs}" height="${ys}" fill="#fde68a" stroke="#b45309"/><rect x="${x + xs}" y="${y + hh - ys}" width="${w - 2 * xs}" height="${ys}" fill="#fde68a" stroke="#b45309"/>`;
  for (const [cx, cy] of [[x, y], [x + w - xs, y], [x, y + hh - ys], [x + w - xs, y + hh - ys]]) g += `<rect x="${cx}" y="${cy}" width="${xs}" height="${ys}" fill="url(#hR)" stroke="#7c3aed"/>`;
  g += `<rect x="${x - 7}" y="${y}" width="7" height="${hh}" fill="url(#hB)" stroke="#475569"/><rect x="${x + w}" y="${y}" width="7" height="${hh}" fill="url(#hB)" stroke="#475569"/>`;
  g += L(x, y + hh / 2, x + w, y + hh / 2, 'stroke="#111827" stroke-width="1.6"');
  for (const [px, py, n] of [[x + 12, y + hh * 0.3, 'G'], [x + w * 0.35, y + hh * 0.3, 'H'], [x + w * 0.75, y + hh * 0.3, 'J'], [x + 12, y + hh * 0.75, 'E'], [x + w * 0.35, y + hh * 0.75, 'F'], [x + w * 0.75, y + hh * 0.75, 'I']]) g += T(px + 8, py, n, 'fill="#334155"');
  const lead = (x1, y1, x2, y2, s) => L(x1, y1, x2, y2, 'stroke="#111827" stroke-width=".9"') + T(x2, y2 + (y2 < y1 ? -4 : 12), s, 'font-weight="700" font-size="12"');
  g += lead(x + xs / 2, y + ys / 2, x - 18, y - 30, v('cantos_x_por_y_hachura_\\')) + lead(x + w / 2, y + ys / 2, x + w / 2, y - 30, v('beiral_central_y_linhas'));
  g += lead(x - 3, y + hh * 0.8, x - 40, y + hh + 30, v('empena_y_hachura_/')) + lead(x + w * 0.6, y + hh / 2, x + w * 0.6 + 30, y - 30, v('cumeeira_2y_pontilhado'));
  g += dim(x, y, x + xs, y, F(x0), -46) + dim(x + xs, y, x + w - xs, y, F(a - 2 * x0), -46) + dim(x + w, y, x + w, y + ys, F(yR), -22) + dim(x + w, y + hh / 2 - ys, x + w, y + hh / 2 + ys, F(2 * yR), -22) + dim(x, y + hh, x + w, y + hh, `a = ${F(a)} m`, 22) + dim(x, y, x, y + hh, `b = ${F(b)}`, 52);
  return svg(W, H, g, `Cpe médio — telhado; paredes: ${F(st.cpeMedioParede, 1)} na faixa de ${F(st.geo.faixaParede)} m`);
}

/** vertical profile q(z) with grid */
export function figPerfil(st) {
  const W = 360, H = 270, l = 48, r = 22, t = 32, bt = 38, P = st.perfil, zm = st.hTop;
  const qm = Math.ceil(Math.max(...P.map((p) => p.q)) / 100) * 100;
  const X = (q) => l + (W - l - r) * q / qm, Y = (z) => H - bt - (H - t - bt) * z / zm;
  let g = '';
  for (let i = 0; i <= 5; i++) { const q = qm * i / 5; g += L(X(q), Y(0), X(q), Y(zm), 'stroke="#e2e8f0"') + T(X(q), H - bt + 14, F(q, 0), 'font-size="9" fill="#475569"'); }
  for (const p of P) g += L(X(0), Y(p.z), X(qm), Y(p.z), 'stroke="#f1f5f9"') + T(l - 6, Y(p.z) + 3, F(p.z, 2), 'font-size="9" text-anchor="end" fill="#475569"');
  g += L(X(0), Y(0), X(0), Y(zm), 'stroke="#334155"') + L(X(0), Y(0), X(qm), Y(0), 'stroke="#334155"');
  const pts = [[X(P[0].q), Y(0)], ...P.map((p) => [X(p.q), Y(p.z)])];
  g += PG([[X(0), Y(0)], ...pts, [X(0), Y(zm)]], 'fill="#dbeafe" stroke="none"') + `<polyline points="${pts.map(([u, v]) => `${u.toFixed(1)},${v.toFixed(1)}`).join(' ')}" fill="none" stroke="#1d4ed8" stroke-width="2.2"/>`;
  for (const p of P) g += `<circle cx="${X(p.q).toFixed(1)}" cy="${Y(p.z).toFixed(1)}" r="2.6" fill="#1d4ed8"/>` + T(X(p.q) + 6, Y(p.z) - 4, F(p.q, 1), 'font-size="9" text-anchor="start"');
  g += T((l + W - r) / 2, H - 8, 'q [N/m²]', 'font-size="10"') + `<text x="13" y="${(t + H - bt) / 2}" font-size="10" font-family="Segoe UI,Arial" text-anchor="middle" transform="rotate(-90 13 ${(t + H - bt) / 2})">z [m]</text>`;
  return svg(W, H, g, `Pressão dinâmica (cat. ${st.res.categoria}, classe ${st.res.classe})`);
}
