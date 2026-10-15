// composite_cf.js — BUILT-UP cold-formed sections from the NBR 6355:2012 catalogue (profiles_cf.js): two equal profiles
// connected along their length (presilhas / continuous weld).
//
//   2L costas  — two equal-leg angles back to back (vertical legs facing, gap g = presilha thickness): ⅃L
//   2Ue costas — two Ue back to back (webs facing, gap g): I-shaped
//   2Ue caixa  — two Ue with the lips facing (gap g between the lip tips; g = 0 → lips touching): box
//   2U costas / 2U caixa — the same with the plain channel (when the U simples catalogue is loaded)
//
// Properties from the TABULATED single-profile values (A, Ix, Iy, xg, It of NBR 6355) with the parallel-axis theorem —
// Iz (horizontal axis, depth along local y) = 2·Ix1; Iy (vertical axis of symmetry) = 2·[Iy1 + A1·d²] with d the distance
// from each profile's centroid to the axis of symmetry:
//   costas: d = xg + g/2 (xg measured from the back of the web / heel);  caixa: d = (bf − xg) + g/2.
// Torsion: OPEN built-up section (costas, or caixa with g > 0) J = 2·J1 (presilhas do not close the section);
// CLOSED box (caixa, g = 0, continuous weld assumed — flagged) Bredt: J = 4·Am²/∮ds/t with the mid-line rectangle.
// Cw is NOT computed (built-up section: flexural-torsional checks left to the engineer → design "not verified").
// The single-profile slenderness between presilhas (NBR 14762 / 8800 composite members) is not checked here.
import { cfProfile, cfNames } from './profiles_cf.js?v=7';

export const ARRANGEMENTS = {
  '2L': ['costas'],
  '2Ue': ['costas', 'caixa'],
  '2U': ['costas', 'caixa'],
};

/** name of a built-up section: "2Ue 150x60x20x2,00 caixa", "2L 60x2,25 costas g8" (g in mm, omitted when 0) */
export function compositeName(kind, baseName, arr, gapMm = 0) {
  const tail = baseName.replace(/^(Ue|U|L)\s*/, '');
  return `${kind} ${tail} ${arr}${gapMm ? ` g${String(gapMm).replace('.', ',')}` : ''}`;
}
export function parseCompositeName(name) {
  const m = /^(2L|2Ue|2U)\s+(\S+)\s+(costas|caixa)(?:\s+g([\d,.]+))?$/.exec(String(name || '').trim());
  if (!m) return null;
  const prefix = m[1] === '2L' ? 'L' : m[1] === '2Ue' ? 'Ue' : 'U';
  return { kind: m[1], base: `${prefix} ${m[2]}`, arr: m[3], gapMm: m[4] ? parseFloat(m[4].replace(',', '.')) : 0 };
}

/**
 * Built-up section (SI) or null. Same field names as the catalogue entries (A, Iz, Iy, J, dims …) + kind/arr/gap.
 */
export function compositeSection(kind, baseName, arr, gapMm = 0) {
  const p = cfProfile(baseName);
  if (!p || !(ARRANGEMENTS[kind] || []).includes(arr)) return null;
  const g = (+gapMm || 0) / 1000, d = p.dims, t = d.t;
  const bf = kind === '2L' ? d.b : d.bf;
  const dist = arr === 'costas' ? p.xg + g / 2 : (bf - p.xg) + g / 2;
  const A = 2 * p.A, Iz = 2 * p.Iz, Iy = 2 * (p.Iy + p.A * dist * dist);
  let J = 2 * p.J, closed = false;
  if (arr === 'caixa' && g === 0) {                       // closed box, mid-line rectangle (lips inside ignored)
    const hm = d.bw - t, bm = 2 * bf - t, Am = hm * bm;
    J = 4 * Am * Am / (2 * (hm + bm) / t);
    closed = true;
  }
  const depth = kind === '2L' ? d.b : d.bw;
  const width = arr === 'costas' ? 2 * bf + g : 2 * bf + g;
  return {
    shape: kind, arr, base: baseName, gap: g, closed, designacao: compositeName(kind, baseName, arr, gapMm),
    massa: 2 * (p.massa || 0),
    dims: { ...d, bf, gap: g, kind, arr },
    A, Iz, Iy, J, Cw: null,
    Sz: Iz / (depth / 2), Sy: Iy / (width / 2), rz: Math.sqrt(Iz / A), ry: Math.sqrt(Iy / A),
    Avy: 2 * depth * t, Avz: 2 * 2 * bf * t * (kind === '2L' ? 0.5 : 1),
    fonte: `Composta de 2 × ${baseName} (ABNT NBR 6355:2012), Steiner${closed ? '; caixa fechada — J por Bredt (solda contínua: confirmar)' : ''}`,
  };
}

/** catalogue names of the built-up families for a base shape prefix ('L' | 'Ue' | 'U') */
export function compositeNames(kind, arr, gapMm = 0) {
  const prefix = kind === '2L' ? 'L ' : kind === '2Ue' ? 'Ue ' : 'U ';
  return cfNames().filter((n) => n.startsWith(prefix) && !(prefix === 'U ' && n.startsWith('Ue')))
    .map((n) => compositeName(kind, n, arr, gapMm));
}
