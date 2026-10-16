// connections_figs.js — schematic SVG figures (elevation + section) of the connection module: they illustrate the
// geometry used in the calculation (bolts, edges, pitches, welds, Whitmore spread, pressure block). Not fabrication
// drawings (detailing stays with the Detalhador). Palette of the app: steel members slate, plates steel-blue, bolts
// dark, dimensions teal. Input: the `geo` object returned by the calculation functions (mm).
const COL = { mem: '#cbd5e1', memS: '#475569', plate: '#bfdbfe', plateS: '#1e3a8a', bolt: '#0f172a', dim: '#0f766e', weld: '#b45309', conc: '#e7e5e4', concS: '#78716c', press: '#0ea5e9', note: '#334155' };
const nf = (v, d = 0) => (+v).toLocaleString('pt-BR', { maximumFractionDigits: d });

class Svg {
  constructor(w, h, title) { this.w = w; this.h = h; this.p = []; this.title = title; }
  rect(x, y, w, h, f, s, extra = '') { this.p.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${f}" stroke="${s}" stroke-width="1" ${extra}/>`); }
  line(x1, y1, x2, y2, s, wd = 1, dash = '') { this.p.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${s}" stroke-width="${wd}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`); }
  poly(pts, f, s, wd = 1) { this.p.push(`<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="${f}" stroke="${s}" stroke-width="${wd}"/>`); }
  circ(x, y, r, f, s) { this.p.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${f}" stroke="${s}" stroke-width="1"/>`); }
  text(x, y, t, { size = 10, anchor = 'middle', color = COL.note, rot = 0, bold = false } = {}) {
    this.p.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" text-anchor="${anchor}" fill="${color}" ${bold ? 'font-weight="600"' : ''} ${rot ? `transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"` : ''} font-family="system-ui,sans-serif">${t}</text>`);
  }
  bolt(x, y, r) { this.circ(x, y, r, '#fff', COL.bolt); this.line(x - r * 1.5, y, x + r * 1.5, y, COL.bolt, 0.6); this.line(x, y - r * 1.5, x, y + r * 1.5, COL.bolt, 0.6); }
  /** horizontal dimension line at y between x1, x2 */
  dimH(x1, x2, y, label, off = 0) {
    if (Math.abs(x2 - x1) < 1) return;
    this.line(x1, y, x2, y, COL.dim, 0.8); this.line(x1, y - 4, x1, y + 4, COL.dim, 0.8); this.line(x2, y - 4, x2, y + 4, COL.dim, 0.8);
    this.text((x1 + x2) / 2, y - 3 + off, label, { size: 9, color: COL.dim });
  }
  dimV(y1, y2, x, label, side = -1) {
    if (Math.abs(y2 - y1) < 1) return;
    this.line(x, y1, x, y2, COL.dim, 0.8); this.line(x - 4, y1, x + 4, y1, COL.dim, 0.8); this.line(x - 4, y2, x + 4, y2, COL.dim, 0.8);
    this.text(x + side * 4, (y1 + y2) / 2, label, { size: 9, color: COL.dim, anchor: side < 0 ? 'end' : 'start' });
  }
  toString() { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" style="background:#fff">${this.title ? `<text x="8" y="14" font-size="11" font-weight="600" fill="#0f172a" font-family="system-ui,sans-serif">${this.title}</text>` : ''}${this.p.join('')}</svg>`; }
}
const fit = (W, H, wmm, hmm, pad = 50) => Math.min((W - 2 * pad) / wmm, (H - 2 * pad) / hmm);

/* ------------------------------------------------------------------------------------------------ truss member */
export function figTruss(geo) {
  const { sec, chapa: gp, par = {}, sol = {}, meio } = geo, out = [];
  const bolted = meio === 'parafuso';
  const n = par.n || 2, s = par.s || 60, e1 = par.e1 || 30, lc = bolted ? (n - 1) * s : Math.max(sol.L1 || 0, sol.L2 || 0);
  const wMem = sec.tipo === 'U' ? sec.bw : sec.b;
  const lenView = Math.max(lc + e1 + (gp.eBorda || 30) + 120, 300), hView = Math.max(wMem * 3, 220);
  const W = 560, H = 300, k = fit(W, H, lenView, hView), cy = H / 2 + 10;
  const sv = new Svg(W, H, 'Elevação');
  // gusset: from x0 to the right; member enters from the left
  const xg = 40 + (lenView - (lc + (gp.eBorda || 30) + 60)) * k;          // gusset edge
  const gH = hView * k * 0.92;
  sv.rect(xg, cy - gH / 2, W - 20 - xg, gH, COL.plate, COL.plateS);
  sv.text(W - 30, cy - gH / 2 + 14, `chapa de nó t = ${nf(gp.t, 2)}`, { anchor: 'end', color: COL.plateS });
  // member strip (connected element), ending at x_end inside the gusset
  const xEnd = xg + ((gp.eBorda || 30) + lc + e1) * k, mh = wMem * k;
  const y0 = cy - (sec.tipo === 'U' || sec.tipo === 'chapa' ? mh / 2 : mh - (par.gHeel || wMem / 2) * k);
  sv.rect(20, y0, xEnd - 20, mh, COL.mem, COL.memS, 'fill-opacity="0.9"');
  sv.text(30, y0 - 6, `${sec.tipo === '2L' ? '2L' : sec.tipo} ${nf(wMem, 1)}×${nf(sec.t, 2)}${geo.tracao ? ' — tração' : ' — compressão'} F = ${nf(geo.F, 1)} kN`, { anchor: 'start', color: COL.memS });
  // force arrow
  const ay = cy, ax = 26; sv.line(ax + 40, ay, ax, ay, '#dc2626', 2); geo.tracao ? sv.poly([[ax, ay], [ax + 8, ay - 4], [ax + 8, ay + 4]], '#dc2626', '#dc2626') : sv.poly([[ax + 40, ay], [ax + 32, ay - 4], [ax + 32, ay + 4]], '#dc2626', '#dc2626');
  if (bolted) {
    const linhas = par.linhas || 1, g = par.g || 0, r = Math.max(3, (par.db || 16) / 2 * k);
    const lineY = (i) => sec.tipo === 'U' || sec.tipo === 'chapa' ? cy + (i - (linhas - 1) / 2) * g * k : y0 + mh - (par.gHeel + i * g) * k;
    for (let i = 0; i < linhas; i++) for (let j = 0; j < n; j++) sv.bolt(xg + ((gp.eBorda || 30) + j * s) * k, lineY(i), r);
    const yb = cy + gH / 2 + 14;
    sv.dimH(xg, xg + gp.eBorda * k, yb, `${nf(gp.eBorda)}`);
    for (let j = 0; j + 1 < n; j++) sv.dimH(xg + (gp.eBorda + j * s) * k, xg + (gp.eBorda + (j + 1) * s) * k, yb, `${nf(s)}`);
    sv.dimH(xg + (gp.eBorda + lc) * k, xEnd, yb, `${nf(e1)}`);
    // Whitmore 30°
    const x1 = xg + gp.eBorda * k, x2 = xg + (gp.eBorda + lc) * k, yT = lineY(linhas - 1), yB = lineY(0), t30 = Math.tan(Math.PI / 6);
    const yA = Math.min(yT, yB), yZ = Math.max(yT, yB);
    sv.line(x1, yA, x2, yA - lc * k * t30, COL.dim, 0.8, '4 3'); sv.line(x1, yZ, x2, yZ + lc * k * t30, COL.dim, 0.8, '4 3');
    sv.line(x2, yA - lc * k * t30, x2, yZ + lc * k * t30, COL.dim, 1.2);
    sv.text(x2 + 4, yZ + lc * k * t30 + 10, 'lwh (Whitmore, 30°)', { anchor: 'start', size: 9, color: COL.dim });
  } else {
    const yW1 = y0, yW2 = y0 + mh;
    if (sol.L1) sv.line(xEnd - sol.L1 * k, yW1, xEnd, yW1, COL.weld, 3);
    if (sol.L2) sv.line(xEnd - sol.L2 * k, yW2, xEnd, yW2, COL.weld, 3);
    if (sol.Lt) sv.line(xEnd, yW1, xEnd, yW2, COL.weld, 3);
    sv.text(xEnd - 4, yW1 - 4, `filete ${nf(sol.dw, 1)} mm (${sol.eletrodo || 'E70'})`, { anchor: 'end', color: COL.weld, size: 9 });
    sv.dimH(xEnd - lc * k, xEnd, cy + gH / 2 + 14, `ℓw = ${nf(lc)}`);
  }
  out.push(sv.toString());
  // section A-A
  const S = new Svg(220, 300, 'Corte A-A'), kk = fit(220, 300, Math.max(sec.b2 || wMem, 60) * 2 + gp.t + 40, wMem + 40, 30), cx = 110, cY = 150;
  S.rect(cx - gp.t * kk / 2, cY - (wMem * kk) / 2 - 30, gp.t * kk, wMem * kk + 60, COL.plate, COL.plateS);
  const t = sec.t * kk, b = wMem * kk, b2 = (sec.b2 || wMem) * kk;
  const angle = (dir) => { const x = cx + dir * gp.t * kk / 2; S.poly([[x, cY - b / 2], [x + dir * t, cY - b / 2], [x + dir * t, cY + b / 2 - t], [x + dir * b2, cY + b / 2 - t], [x + dir * b2, cY + b / 2], [x, cY + b / 2]], COL.mem, COL.memS); };
  if (sec.tipo === '2L') { angle(-1); angle(1); }
  else if (sec.tipo === 'L') angle(1);
  else if (sec.tipo === 'U') { const x = cx + gp.t * kk / 2, bf = (sec.bf || 40) * kk; S.poly([[x, cY - b / 2], [x + bf, cY - b / 2], [x + bf, cY - b / 2 + t], [x + t, cY - b / 2 + t], [x + t, cY + b / 2 - t], [x + bf, cY + b / 2 - t], [x + bf, cY + b / 2], [x, cY + b / 2]], COL.mem, COL.memS); }
  else S.rect(cx + gp.t * kk / 2, cY - b / 2, t, b, COL.mem, COL.memS);
  if (bolted) { const linhas = par.linhas || 1; for (let i = 0; i < linhas; i++) { const y = sec.tipo === 'U' || sec.tipo === 'chapa' ? cY + (i - (linhas - 1) / 2) * (par.g || 0) * kk : cY + b / 2 - (par.gHeel + i * (par.g || 0)) * kk; S.rect(cx - (gp.t * kk / 2 + (sec.tipo === '2L' ? t : 0)) - 6, y - 3, gp.t * kk + (sec.tipo === '2L' ? 2 : 1) * t + 12, 6, COL.bolt, COL.bolt); } }
  out.push(S.toString());
  return out;
}

/* ------------------------------------------------------------------------------------------------ shear (beam–column) */
export function figShear(geo) {
  const { tipo, par, ys, viga } = geo, out = [];
  const s = par.s, n = par.n, W = 460, H = 360;
  const p = tipo === 'chapa' ? geo.chapa : geo.cant, hp = tipo === 'chapa' ? geo.hp : geo.L;
  const wView = (p.a + (p.eh || 40) + 120), hView = hp + 120, k = fit(W, H, wView + 60, hView);
  const sv = new Svg(W, H, 'Elevação'), xc = 60, cy = H / 2 + 8;
  sv.rect(xc - 24, 24, 24, H - 40, COL.mem, COL.memS); sv.text(xc - 12, H - 22, 'pilar', { size: 9 });
  const xLine = xc + p.a * k;
  // beam (web) to the right
  sv.rect(xc + 10 * k, cy - hView * k / 2 + 10, W - 20 - xc - 10 * k, hView * k - 20, COL.mem, COL.memS, 'fill-opacity="0.45"');
  sv.text(W - 26, cy - hView * k / 2 + 24, `viga, tw = ${nf(viga.tw, 1)}`, { anchor: 'end', color: COL.memS });
  if (tipo === 'chapa') {
    sv.rect(xc, cy - hp * k / 2, (p.a + p.eh) * k, hp * k, COL.plate, COL.plateS);
    sv.line(xc + 1, cy - hp * k / 2, xc + 1, cy + hp * k / 2, COL.weld, 3);
    sv.text(xc + 6, cy - hp * k / 2 - 6, `chapa ${nf(p.t, 1)} × ${nf(hp)} · filete ${nf(geo.chapa && geo.chapa.dw || 0)}`.replace(' · filete 0', ''), { anchor: 'start', color: COL.plateS, size: 9 });
  } else {
    sv.rect(xc, cy - hp * k / 2, (p.a + p.eh) * k, hp * k, COL.plate, COL.plateS);
    sv.text(xc + 6, cy - hp * k / 2 - 6, `2L ${nf(p.b, 1)}×${nf(p.b2, 1)}×${nf(p.t, 2)} · L = ${nf(hp)}`, { anchor: 'start', color: COL.plateS, size: 9 });
  }
  const r = Math.max(3, par.db / 2 * k);
  for (const y of ys) sv.bolt(xLine, cy + y * k, r);
  const xd = xLine + (p.eh + 20) * k;
  sv.dimV(cy - hp * k / 2, cy + ys[0] * k, xd, nf(p.ev), 1);
  for (let i = 0; i + 1 < ys.length; i++) sv.dimV(cy + ys[i] * k, cy + ys[i + 1] * k, xd, nf(s), 1);
  sv.dimV(cy + ys[ys.length - 1] * k, cy + hp * k / 2, xd, nf(p.ev), 1);
  sv.dimH(xc, xLine, cy + hp * k / 2 + 16, `a = ${nf(p.a)}`); sv.dimH(xLine, xLine + p.eh * k, cy + hp * k / 2 + 16, nf(p.eh));
  sv.line(xLine + 30, 30, xLine + 30, 60, '#dc2626', 2); sv.poly([[xLine + 30, 64], [xLine + 26, 56], [xLine + 34, 56]], '#dc2626', '#dc2626'); sv.text(xLine + 36, 46, `V = ${nf(geo.V, 1)} kN`, { anchor: 'start', color: '#dc2626' });
  out.push(sv.toString());
  // plan section
  const S = new Svg(240, 360, 'Corte (planta)'), kk = 1.1, cx = 120, cY = 180;
  S.rect(20, cY - 40, 30, 80, COL.mem, COL.memS); S.text(35, cY + 56, 'pilar', { size: 9 });
  S.rect(50, cY - viga.tw * kk / 2, 170, viga.tw * kk, COL.mem, COL.memS); S.text(200, cY - 10, 'alma', { size: 9, anchor: 'end' });
  if (tipo === 'chapa') { S.rect(50, cY + viga.tw * kk / 2, 120, p.t * kk, COL.plate, COL.plateS); S.poly([[50, cY + viga.tw * kk / 2 + p.t * kk], [58, cY + viga.tw * kk / 2 + p.t * kk], [50, cY + viga.tw * kk / 2 + p.t * kk + 8]], COL.weld, COL.weld); }
  else for (const d of [-1, 1]) { const y = d > 0 ? cY + viga.tw * kk / 2 : cY - viga.tw * kk / 2 - p.t * kk; S.rect(50 + p.t * kk, y, 110, p.t * kk, COL.plate, COL.plateS); S.rect(50, d > 0 ? cY + viga.tw * kk / 2 : cY - viga.tw * kk / 2 - (p.b2 || 80) * 0.6, p.t * kk, (p.b2 || 80) * 0.6, COL.plate, COL.plateS); }
  S.rect(50 + p.a * 0.9 - 3, cY - 26, 6, 52, COL.bolt, COL.bolt);
  out.push(S.toString());
  return out;
}

/* ------------------------------------------------------------------------------------------------ column base */
export function figBase(geo) {
  const { lx, ly, a, a1, a2, tipo, nb, db, d, bf, tw, tf } = geo, out = [];
  const W = 420, H = 380, k = fit(W, H, lx + 80, ly + 80), cx = W / 2, cy = H / 2 + 8;
  const sv = new Svg(W, H, `Planta — base tipo ${tipo}, ${nb} chumbadores Ø ${nf(db)} mm`);
  sv.rect(cx - lx * k / 2, cy - ly * k / 2, lx * k, ly * k, COL.plate, COL.plateS);
  // I section (major axis along x: d along x)
  const D = d * k, B = bf * k, T = (tf || 12) * k, Tw = tw * k;
  sv.rect(cx - D / 2, cy - B / 2, T, B, COL.mem, COL.memS); sv.rect(cx + D / 2 - T, cy - B / 2, T, B, COL.mem, COL.memS); sv.rect(cx - D / 2 + T, cy - Tw / 2, D - 2 * T, Tw, COL.mem, COL.memS);
  const r = Math.max(4, db / 2 * k);
  const rowsY = (cnt) => Array.from({ length: cnt }, (_, i) => (i - (cnt - 1) / 2) * a2);
  if (tipo === 1) for (const sx of [-1, 1]) for (const y of rowsY(nb / 2)) sv.bolt(cx + sx * a * k, cy + y * k, r);
  else for (const sx of [-1, 1]) for (const sy of [-1, 1]) sv.bolt(cx + sx * a * k, cy + sy * a2 / 2 * k, r);
  sv.dimH(cx - lx * k / 2, cx + lx * k / 2, cy + ly * k / 2 + 22, `ℓx = ${nf(lx)}`);
  sv.dimV(cy - ly * k / 2, cy + ly * k / 2, cx - lx * k / 2 - 14, `ℓy = ${nf(ly)}`);
  sv.dimH(cx - lx * k / 2, cx - a * k, cy - ly * k / 2 - 10, nf(a1));
  sv.dimH(cx - a * k, cx, cy - ly * k / 2 - 10, `a = ${nf(a, 1)}`);
  out.push(sv.toString());
  // elevation with the stress block of the case
  const E = new Svg(420, 260, `Elevação — caso ${geo.caso || ''}`), ke = fit(420, 260, lx + 80, 400), ex = 210, ey = 150;
  E.rect(ex - lx * ke / 2 - 30, ey + 6, lx * ke + 60, 90, COL.conc, COL.concS); E.text(ex, ey + 86, 'bloco de concreto', { size: 9 });
  E.rect(ex - lx * ke / 2, ey - 10, lx * ke, 10, COL.plate, COL.plateS);
  E.rect(ex - D / k * ke / 2, ey - 110, d * ke, 100, COL.mem, COL.memS, 'fill-opacity="0.7"');
  for (const sx of [-1, 1]) { const x = ex + sx * a * ke; E.line(x, ey - 22, x, ey + 70, COL.bolt, 2); E.rect(x - 6, ey - 16, 12, 6, COL.bolt, COL.bolt); }
  const c = geo.caso || 'C1';
  if (/^C/.test(c) || c === 'T3') {
    const w = c === 'C1' ? lx : c === 'C2' ? lx * 0.75 : lx * 0.3;
    const x0 = c === 'C2' ? ex + lx * ke / 2 - w * ke : c === 'C1' ? ex - lx * ke / 2 : ex + lx * ke / 2 - w * ke;
    for (let x = x0 + 4; x < x0 + w * ke; x += 10) { E.line(x, ey + 30, x, ey + 8, COL.press, 1.2); E.poly([[x, ey + 4], [x - 3, ey + 10], [x + 3, ey + 10]], COL.press, COL.press); }
    E.text(x0 + w * ke / 2, ey + 44, c === 'C1' ? 'σc,Sd uniforme' : 'ℓc (σc)', { size: 9, color: COL.press });
  }
  if (/^T|C3/.test(c)) E.text(ex - a * ke, ey + 84, 'Ft,Sd', { size: 9, color: '#dc2626' });
  out.push(E.toString());
  return out;
}

/* ------------------------------------------------------------------------------------------------ splice */
export function figSplice(geo) {
  const out = [];
  if (geo.tipo === 'chapa') {
    const { membro: m, talas: t, par, folga } = geo, L = 2 * (par.e1 + (par.ncol - 1) * par.s + par.et) + folga;
    const W = 560, H = 260, k = fit(W, H, L + 200, m.b + 60), cx = W / 2, cy = H / 2 + 6;
    const sv = new Svg(W, H, 'Elevação'), hb = m.b * k;
    sv.rect(20, cy - hb / 2, cx - folga * k / 2 - 20, hb, COL.mem, COL.memS); sv.rect(cx + folga * k / 2, cy - hb / 2, W - 20 - cx - folga * k / 2, hb, COL.mem, COL.memS);
    sv.rect(cx - L * k / 2, cy - t.b * k / 2, L * k, t.b * k, COL.plate, COL.plateS, 'fill-opacity="0.75"');
    const r = Math.max(3, par.db / 2 * k), lines = Array.from({ length: par.linhas }, (_, i) => (i - (par.linhas - 1) / 2) * (par.g || 0));
    for (const sx of [-1, 1]) for (let j = 0; j < par.ncol; j++) for (const y of lines) sv.bolt(cx + sx * (folga / 2 + par.e1 + j * par.s) * k, cy + y * k, r);
    const yb = cy + hb / 2 + 16;
    sv.dimH(cx - L * k / 2, cx - (folga / 2 + par.e1 + (par.ncol - 1) * par.s) * k, yb, nf(par.et));
    sv.dimH(cx - (folga / 2 + par.e1) * k, cx - folga * k / 2, yb, nf(par.e1));
    if (par.ncol > 1) sv.dimH(cx - (folga / 2 + par.e1 + par.s) * k, cx - (folga / 2 + par.e1) * k, yb, nf(par.s));
    sv.text(cx, cy - hb / 2 - 8, `${t.n} tala${t.n > 1 ? 's' : ''} ${nf(t.b)} × ${nf(t.t, 1)} · peça ${nf(m.b)} × ${nf(m.t, 1)} · N = ${nf(geo.N, 1)} kN`, { color: COL.plateS });
    out.push(sv.toString());
    return out;
  }
  const { perfil: P, talaAlma: ta, parMesa: pm, parAlma: pa, folga } = geo;
  const Lm = 2 * (pm.e1 + (pm.ncol - 1) * pm.s + pm.et) + folga, W = 600, H = 340, k = fit(W, H, Lm + 240, P.d + 60), cx = W / 2, cy = H / 2 + 6, D = P.d * k;
  const sv = new Svg(W, H, 'Elevação — emenda de perfil I');
  for (const sx of [-1, 1]) { const x0 = sx < 0 ? 20 : cx + folga * k / 2, w = cx - folga * k / 2 - 20; sv.rect(x0, cy - D / 2, w, D, COL.mem, COL.memS, 'fill-opacity="0.5"'); sv.rect(x0, cy - D / 2, w, P.tf * k, COL.mem, COL.memS); sv.rect(x0, cy + D / 2 - P.tf * k, w, P.tf * k, COL.mem, COL.memS); }
  for (const sy of [-1, 1]) sv.rect(cx - Lm * k / 2, sy < 0 ? cy - D / 2 - 12 * k : cy + D / 2, Lm * k, 12 * k + 3, COL.plate, COL.plateS);
  const Lw = 2 * (pa.e1w + (pa.nc - 1) * pa.sh + pa.et) + folga;
  sv.rect(cx - Lw * k / 2, cy - ta.h * k / 2, Lw * k, ta.h * k, COL.plate, COL.plateS, 'fill-opacity="0.75"');
  const r = Math.max(2.5, pa.db / 2 * k);
  for (const sx of [-1, 1]) {
    for (let j = 0; j < pm.ncol; j++) for (const sy of [-1, 1]) sv.bolt(cx + sx * (folga / 2 + pm.e1 + j * pm.s) * k, cy + sy * (D / 2 + 2), r);
    for (let j = 0; j < pa.nc; j++) for (let i = 0; i < pa.nr; i++) sv.bolt(cx + sx * (folga / 2 + pa.e1w + j * pa.sh) * k, cy + (i - (pa.nr - 1) / 2) * pa.sv * k, r);
  }
  sv.text(cx, 30, `mesa tracionada ${nf(geo.Ft, 1)} kN · comprimida ${nf(geo.Fc, 1)} kN · V = ${nf(geo.V, 1)} kN`, { color: COL.plateS });
  out.push(sv.toString());
  return out;
}
