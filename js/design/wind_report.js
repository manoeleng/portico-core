// wind_report.js — wind STUDY per ABNT NBR 6123:2023 for a rectangular building with a gable roof (Notus-like
// module): the validated calculation of assistant/loads.js (windLoad, 130 literature checks in
// tests/test_lit_acoes.mjs) plus what a report needs — vertical profile S2(z)/Vk(z)/q(z), zone geometry of
// Tab. 6/7 (x0, C1/D1 width, cpe médio strips), Cp = Cpe − Cpi tables, pressures per zone and SVG figures.
// Pure functions (no DOM): used by the wind dialog (js/app.js windDialog) and by tests/test_wind_report.mjs.
//
// Geometry (Tab. 6/7): a = largest plan dimension, b = smallest; h = height at the eave (Detalhe I, Tab. 7);
// top height = h + (b/2)·tan θ. α = 0°: wind parallel to a (onto the gable C); α = 90°: wind onto the long side A.
import { windLoad } from '../../assistant/loads.js?v=7';

const r3 = (x) => Math.round(x * 1000) / 1000;

/** S2 of NBR 6123:2023 (5.3.3, Tab. 1/3): bm·Fr·(z/10)^p, z ≥ 5 m (categories I–IV) or ≥ 10 m (V). */
export function s2At(w, cat, cl, z) {
  const t1 = w.S2[cat]; if (!t1) throw new Error(`categoria ${cat} fora da Tabela 1`);
  const zz = cat === 'V' ? Math.max(z, 10) : Math.max(z, 5);
  return t1[cl].bm * w.Fr[cl] * Math.pow(zz / 10, t1[cl].p);
}

/**
 * @param inp { obra, V0, S1, categoria, grupoS3, a, b, hBeiral, theta (°), cpi: number[] }
 * @param w   rules.json → loads.wind of the Brazil preset
 */
export function windStudy(inp, w) {
  let a = +inp.a, b = +inp.b;
  if (a < b) [a, b] = [b, a];
  const th = +inp.theta || 0, hB = +inp.hBeiral;
  const hTop = hB + (b / 2) * Math.tan(th * Math.PI / 180);
  const res = windLoad({ geometry: { width_m: b, length_m: a, roof_slope_deg: th, eave_height_m: hB },
    wind: { V0_m_s: +inp.V0, S1: +inp.S1 || 1, categoria: inp.categoria, grupoS3: String(inp.grupoS3), cpi: inp.cpi, a_m: a, b_m: b } },
    { loads: { wind: w } }, hTop);
  if (!(res.q_Nm2 > 0)) return { erro: (res._notas || []).join(' '), res };
  // vertical profile (5 m steps, plus eave and top)
  const zs = [...new Set([...Array.from({ length: Math.floor(hTop / 5) }, (_, i) => 5 * (i + 1)), hB, hTop].map(r3))].filter((z) => z > 0).sort((p, q) => p - q);
  const perfil = zs.map((z) => {
    const S2 = s2At(w, res.categoria, res.classe, z), Vk = res.V0 * res.S1 * S2 * res.S3;
    return { z, S2: r3(S2 * 10) / 10, Vk: r3(Vk), q: Math.round(0.613 * Vk * Vk * 100) / 100 };
  });
  const xC1 = Math.min(2 * hB, b / 2), yR = Math.min(hB, 0.15 * b), faixaPar = Math.min(0.2 * b, hB);
  // pressures (kN/m²): α = 90° zones with q, α = 0° zones with q of the gable (as loads.js)
  const q90 = res.q_Nm2 / 1000, q0 = res.q_empena_Nm2 / 1000;
  const W = res.cpe_paredes, R = res.cpe_telhado;
  const zonas = [
    { z: 'A1/B1', alpha: 0, cpe: W.A1B1, q: q0, onde: `paredes laterais, faixa de ${r3(res.x0_m)} m a barlavento` },
    { z: 'A2/B2', alpha: 0, cpe: W.A2B2, q: q0, onde: 'paredes laterais, até a/2' },
    { z: 'A3/B3', alpha: 0, cpe: W.A3B3, q: q0, onde: 'paredes laterais, restante (Nota 3)' },
    { z: 'C', alpha: 0, cpe: W.C, q: q0, onde: 'empena de barlavento' },
    { z: 'D', alpha: 0, cpe: W.D, q: q0, onde: 'empena de sotavento' },
    { z: 'A', alpha: 90, cpe: W.A, q: q90, onde: 'parede longa de barlavento' },
    { z: 'B', alpha: 90, cpe: W.B, q: q90, onde: 'parede longa de sotavento' },
    { z: 'C1/D1', alpha: 90, cpe: W.C1D1, q: q90, onde: `empenas, faixa de ${r3(xC1)} m a barlavento` },
    { z: 'C2/D2', alpha: 90, cpe: W.C2D2, q: q90, onde: 'empenas, restante' },
    { z: 'EG', alpha: 0, cpe: R.EG, q: q0, onde: `telhado, faixa de ${r3(res.x0_m)} m a barlavento` },
    { z: 'FH', alpha: 0, cpe: R.FH, q: q0, onde: 'telhado, até a/2' },
    { z: 'IJ', alpha: 0, cpe: R.IJ, q: q0, onde: 'telhado, restante (Nota 3)' },
    { z: 'EFI', alpha: 90, cpe: R.EFI, q: q90, onde: 'água de barlavento' },
    { z: 'GHJ', alpha: 90, cpe: R.GHJ, q: q90, onde: 'água de sotavento' },
  ];
  const cpis = res.cpi;
  for (const zn of zonas) zn.por = cpis.map((ci) => { const cp = r3(zn.cpe - ci); return { cpi: ci, cp, p: Math.round(zn.q * cp * 1000) / 1000 }; });
  // cpe médio of the roof (Tab. 7): the θ band rows (no interpolation in the table; the more negative is shown)
  const hb = hB / b;
  const rowsR = w.cpe_telhado_2aguas.filter((r) => (hb <= 0.5 && r.h_b === '<=1/2') || (hb > 0.5 && hb <= 1.5 && r.h_b === '1/2<h/b<=3/2') || (hb > 1.5 && r.h_b !== '<=1/2' && r.h_b !== '1/2<h/b<=3/2'));
  const lo = [...rowsR].reverse().find((r) => r.theta <= th) || rowsR[0], hi = rowsR.find((r) => r.theta >= th) || rowsR[rowsR.length - 1];
  const keys = lo?.cpe_medio ? Object.keys(lo.cpe_medio) : [];
  const cpeMedioTelhado = keys.map((k) => {
    const v = [lo?.cpe_medio?.[k], hi?.cpe_medio?.[k]].filter((x) => x != null);
    return { zona: k, cpe: v.length ? Math.min(...v) : null };
  });
  return {
    inp: { ...inp, a, b, theta: th, hBeiral: hB }, hTop: r3(hTop), res, perfil, zonas, cpis,
    geo: { x0: res.x0_m, xC1: r3(xC1), y: r3(yR), faixaParede: r3(faixaPar), hb: r3(hB / b), ab: r3(a / b) },
    cpeMedioParede: W.cpe_medio, cpeMedioTelhado, thetaRows: [lo?.theta, hi?.theta],
    notas: res._notas || [],
  };
}

// ── SVG figures ──────────────────────────────────────────────────────────────────────────────────────
const f2 = (v) => (v > 0 ? '+' : '') + String(Math.round(v * 100) / 100).replace('.', ',');
const box = (x, y, w, h, fill = 'none') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#334155" stroke-width="1.2"/>`;
const txt = (x, y, s, o = '') => `<text x="${x}" y="${y}" font-size="11" font-family="sans-serif" text-anchor="middle" ${o}>${s}</text>`;
const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0ea5e9" stroke-width="2" marker-end="url(#ah)"/>`;
const defs = '<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#0ea5e9"/></marker></defs>';
const col = (cpe) => cpe >= 0 ? '#fee2e2' : cpe <= -0.8 ? '#bfdbfe' : '#dbeafe';

/** walls in plan (Tab. 6 figure): alpha 0 (wind along a, from the top) or 90 (wind onto A, from the left) */
export function svgParedes(st, alpha) {
  const { a, b } = st.inp, W = st.res.cpe_paredes, Wd = 340, Hd = 300, pad = 60;
  const s = Math.min((Wd - 2 * pad) / b, (Hd - 2 * pad) / a), w = b * s, h = a * s, x = (Wd - w) / 2, y = (Hd - h) / 2;
  let g = '';
  if (alpha === 0) {
    const x0 = st.geo.x0 * s;
    g += box(x, y, w, h) + `<line x1="${x - 25}" y1="${y + h / 2}" x2="${x + w + 25}" y2="${y + h / 2}" stroke="#94a3b8" stroke-dasharray="6 4"/>`;
    for (const [side, xs] of [['A', x - 18], ['B', x + w + 18]]) {
      g += `<line x1="${xs - 6}" y1="${y + x0}" x2="${xs + 6}" y2="${y + x0}" stroke="#334155"/>`;
      g += txt(xs, y + x0 / 2 + 4, `${side}1 ${f2(W.A1B1)}`, side === 'A' ? 'text-anchor="end"' : 'text-anchor="start"');
      g += txt(xs, y + (x0 + h / 2) / 2 + 4, `${side}2 ${f2(W.A2B2)}`, side === 'A' ? 'text-anchor="end"' : 'text-anchor="start"');
      g += txt(xs, y + 3 * h / 4 + 4, `${side}3 ${f2(W.A3B3)}`, side === 'A' ? 'text-anchor="end"' : 'text-anchor="start"');
    }
    g += txt(x + w / 2, y - 8, `C ${f2(W.C)}`) + txt(x + w / 2, y + h + 18, `D ${f2(W.D)}`) + arrow(x + w / 2, 6, x + w / 2, y - 22);
    g += txt(x + w / 2, y + h / 2 - 6, `x₀ = ${String(st.geo.x0).replace('.', ',')} m`, 'fill="#64748b"');
  } else {
    const c1 = st.geo.xC1 * s;
    g += box(x, y, w, h) + `<line x1="${x + c1}" y1="${y - 8}" x2="${x + c1}" y2="${y + 8}" stroke="#334155"/><line x1="${x + c1}" y1="${y + h - 8}" x2="${x + c1}" y2="${y + h + 8}" stroke="#334155"/>`;
    g += txt(x + c1 / 2, y - 10, `C1 ${f2(W.C1D1)}`) + txt(x + (c1 + w) / 2 + 8, y - 10, `C2 ${f2(W.C2D2)}`);
    g += txt(x + c1 / 2, y + h + 20, `D1 ${f2(W.C1D1)}`) + txt(x + (c1 + w) / 2 + 8, y + h + 20, `D2 ${f2(W.C2D2)}`);
    g += txt(x - 8, y + h / 2, `A ${f2(W.A)}`, 'text-anchor="end"') + txt(x + w + 8, y + h / 2, `B ${f2(W.B)}`, 'text-anchor="start"') + arrow(6, y + h / 2 + 18, x - 8, y + h / 2 + 18);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}">${defs}${g}${txt(Wd / 2, Hd - 4, `Paredes — α = ${alpha}° (a = ${String(a).replace('.', ',')} m vertical, b = ${String(b).replace('.', ',')} m)`, 'fill="#475569" font-size="10"')}</svg>`;
}

/** roof in plan (Tab. 7 figure): a horizontal, b vertical, ridge in the middle */
export function svgTelhado(st, alpha) {
  const { a, b } = st.inp, R = st.res.cpe_telhado, Wd = 420, Hd = 240, pad = 50;
  const s = Math.min((Wd - 2 * pad) / a, (Hd - 2 * pad) / b), w = a * s, h = b * s, x = (Wd - w) / 2, y = (Hd - h) / 2;
  let g = box(x, y, w, h) + `<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="#334155" stroke-width="1.5"/>`;
  if (alpha === 0) {
    const x0 = st.geo.x0 * s;
    g += `<rect x="${x}" y="${y}" width="${x0}" height="${h}" fill="${col(R.EG)}" opacity=".7"/><rect x="${x + x0}" y="${y}" width="${w / 2 - x0}" height="${h}" fill="${col(R.FH)}" opacity=".7"/><rect x="${x + w / 2}" y="${y}" width="${w / 2}" height="${h}" fill="${col(R.IJ)}" opacity=".7"/>`;
    g += box(x, y, w, h) + `<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="#334155" stroke-width="1.5"/>`;
    g += `<line x1="${x + x0}" y1="${y}" x2="${x + x0}" y2="${y + h}" stroke="#334155" stroke-dasharray="5 3"/><line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="#334155" stroke-dasharray="5 3"/>`;
    g += txt(x + x0 / 2, y + h / 4 + 4, `G ${f2(R.EG)}`) + txt(x + x0 / 2, y + 3 * h / 4 + 4, `E ${f2(R.EG)}`);
    g += txt(x + (x0 + w / 2) / 2, y + h / 4 + 4, `H ${f2(R.FH)}`) + txt(x + (x0 + w / 2) / 2, y + 3 * h / 4 + 4, `F ${f2(R.FH)}`);
    g += txt(x + 3 * w / 4, y + h / 4 + 4, `J ${f2(R.IJ)}`) + txt(x + 3 * w / 4, y + 3 * h / 4 + 4, `I ${f2(R.IJ)}`) + arrow(6, y + h / 2 + 16, x - 6, y + h / 2 + 16);
  } else {
    g = box(x, y, w, h) + `<rect x="${x}" y="${y + h / 2}" width="${w}" height="${h / 2}" fill="${col(R.EFI)}" opacity=".7"/><rect x="${x}" y="${y}" width="${w}" height="${h / 2}" fill="${col(R.GHJ)}" opacity=".7"/>`;
    g += box(x, y, w, h) + `<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="#334155" stroke-width="1.5"/>`;
    g += txt(x + w / 2, y + 3 * h / 4 + 4, `E/F/I ${f2(R.EFI)} (barlavento)`) + txt(x + w / 2, y + h / 4 + 4, `G/H/J ${f2(R.GHJ)} (sotavento)`) + arrow(x + w / 2, Hd - 4, x + w / 2, y + h + 8);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}">${defs}${g}${txt(Wd / 2, 12, `Telhado — α = ${alpha}°, θ = ${String(st.inp.theta).replace('.', ',')}°`, 'fill="#475569" font-size="10"')}</svg>`;
}

/** vertical profile q(z) */
export function svgPerfil(st) {
  const Wd = 260, Hd = 240, pad = 34, P = st.perfil, qm = Math.max(...P.map((p) => p.q)), zm = st.hTop;
  const X = (q) => pad + (Wd - 2 * pad) * q / qm, Y = (z) => Hd - pad - (Hd - 2 * pad) * z / zm;
  let g = `<line x1="${pad}" y1="${Y(0)}" x2="${pad}" y2="${Y(zm)}" stroke="#334155"/><line x1="${pad}" y1="${Y(0)}" x2="${Wd - pad}" y2="${Y(0)}" stroke="#334155"/>`;
  const pts = [{ z: 0, q: P[0].q }, ...P].map((p) => `${X(p.q)},${Y(p.z)}`).join(' ');
  g += `<polyline points="${pts}" fill="none" stroke="#0ea5e9" stroke-width="2"/>`;
  for (const p of P) g += txt(X(p.q) + 4, Y(p.z) + 4, `${String(p.q).replace('.', ',')}`, 'text-anchor="start" font-size="9"') + txt(pad - 4, Y(p.z) + 3, String(p.z).replace('.', ','), 'text-anchor="end" font-size="9"');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}">${g}${txt(Wd / 2, 12, 'q(z) [N/m²] × z [m]', 'fill="#475569" font-size="10"')}</svg>`;
}
