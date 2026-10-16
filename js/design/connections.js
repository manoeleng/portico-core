// connections.js — steel connections: NBR 8800:2024 Section 6 (hot-rolled / welded, t > 4,75 mm) and NBR 14762:2010
// Section 10 (cold-formed, thinnest connected part ≤ 4,75 mm — 10.2.1 / 10.3.1). Pure calculation, no DOM.
// Units: lengths mm, stresses MPa, forces kN (internally N = MPa·mm²; reported /1000), moments kN·m.
// Every check returns { g (group), nome, ref (clause), eq (equation with the numbers), Sd, Rd, ratio, ok } — the
// report format of the module (equation → numbers → ratio → OK/NÃO), SkyCiv-like.
// Assemblies (decisão do Manoel, 16/10/2026): barra de treliça em chapa de nó, ligação flexível viga–pilar
// (chapa simples / cantoneira dupla), base de pilar (6.7, novo na 2024), emenda com talas.
// Sources read in the norm texts (C:\projetos\_referencias): NBR 8800:2024 6.1.5, 6.2.2, 6.2.5, 6.2.6, 6.3.2–6.3.12,
// Tab. 9, 11, 14, 16, 18, A.3, A.4, 5.2.3–5.2.5, 6.5.3–6.5.6, 6.6.5, 6.7; NBR 14762:2010 9.6.2, 10.1–10.4, Tab. 15, 16.
// Literature criteria (decisão B, declared in the report): Whitmore section of gusset plates (Fakury, Silva e Caldas
// 2017, 10.12.2/10.12.3 p.283; K = 0,65 and L = largest distance Whitmore section → weld, example 10.14.3 p.300);
// eccentric bolt group by the elastic method (Fakury 10.14.5).
import { ctPerfil14762 } from './codes/nbr14762.js?v=7';

export const GAMMA = { a1: 1.10, a2: 1.35, w2: 1.35, c: 1.4 };
export const E_ACO = 200000;

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const kN = (N) => N / 1000;
const area = (d) => Math.PI * d * d / 4;

/* ------------------------------------------------------------------------------------------------ materials */
// NBR 8800:2024 Tabela A.3 (fyb, fub MPa); comum = 6.3.3.2-a always (A307 and the low-carbon ISO 4.6, A.3 / 4.5)
export const BOLTS_8800 = {
  'ASTM A307': { fub: 415, comum: true },
  'ISO 898-1 classe 4.6': { fyb: 235, fub: 400, comum: true },
  'ASTM F3125 A325': { fyb: 635, fub: 830 },
  'ISO 898-1 classe 8.8': { fyb: 640, fub: 800 },
  'ASTM F3125 A490': { fyb: 895, fub: 1040 },
  'ISO 898-1 classe 10.9': { fyb: 900, fub: 1000 },
};
// NBR 14762:2010 Tabela 16 (fub MPa, by nominal diameter d in mm)
export function fub14762(grade, d) {
  if (/A307/.test(grade)) return d < 12.5 ? 370 : 415;           // 12,5 mm = ½" comercial (Wanderson mód. 6, Apl. 1)
  if (/A325/.test(grade)) return d <= 24 || (d <= 25.4 + 1e-6 && Math.abs(d - Math.round(d)) > 0.01) ? 825 : 725;   // 16–24 mm ou ½"–1"
  if (/A490/.test(grade)) return 1035;
  if (/4\.6/.test(grade)) return 400;
  if (/8\.8/.test(grade)) return 800;
  if (/10\.9/.test(grade)) return 1000;
  return null;
}
// NBR 8800:2024 Tabela A.4
export const ELECTRODES = { E60: 415, E70: 485, E80: 550 };

/* ------------------------------------------------------------------------------------------------ holes / edges */
const INCH = 25.4;
const MM_HOLE = { 16: 18, 20: 22, 22: 24, 24: 27, 27: 30, 30: 33 };          // Tab. 14, furo-padrão
const MM_EDGE = { 16: 22, 20: 26, 22: 28, 24: 30, 27: 34, 30: 38 };          // Tab. 16
const IN_EDGE = [[0.5, 19], [0.625, 22], [0.75, 25], [0.875, 28], [1, 32], [1.125, 38], [1.25, 41]];
const isInch = (db) => Math.abs(db - Math.round(db)) > 0.01 && Math.abs(db / INCH * 16 - Math.round(db / INCH * 16)) < 0.02;   // ½" = 12,7 … (mm não inteiro); ⅞" ≠ M22
/** NBR 8800 Tab. 14: standard hole diameter (mm) or null if not tabulated */
export function holeStd8800(db) {
  if (MM_HOLE[db]) return MM_HOLE[db];
  if (db >= 36 && !isInch(db)) return db + 3;
  if (isInch(db)) { const i = db / INCH; return i < 1 - 1e-9 ? db + INCH / 16 : db + INCH / 8; }   // ½"–⅞": +1/16"; 1" → 1 1/8"; ≥ 1 1/8": +1/8"
  return null;
}
/** NBR 8800 Tab. 16: minimum edge distance of a standard hole (mm) or null */
export function edgeMin8800(db) {
  if (MM_EDGE[db]) return MM_EDGE[db];
  if (isInch(db)) { const i = db / INCH; const r = IN_EDGE.find(([v]) => Math.abs(v - i) < 1e-3); return r ? r[1] : (i > 1.25 ? 1.25 * db : null); }
  if (db >= 36) return 1.25 * db;
  return null;
}
/** NBR 14762 Tab. 15: standard hole */
export const holeStd14762 = (d) => d < 12.5 ? d + 0.8 : d + 1.5;
/** NBR 8800 Tab. 11: minimum fillet leg */
export const filletMin8800 = (t) => t <= 6.3 ? 3 : t <= 12.5 ? 5 : t <= 19 ? 6 : 8;
/** NBR 8800 6.2.6.2.2: maximum fillet leg along an edge of thickness t */
export const filletMaxEdge8800 = (t) => t < 6.3 ? t : t - 1.5;

/* ------------------------------------------------------------------------------------------------ check helpers */
export function chk(g, nome, ref, eq, SdN, RdN, extra = {}) {
  const Sd = kN(SdN), Rd = kN(RdN), ratio = RdN > 0 ? Math.abs(SdN) / RdN : Infinity;
  return { g, nome, ref, eq, Sd, Rd, ratio, ok: ratio <= 1 + 1e-9, un: 'kN', ...extra };
}
export function det(g, nome, ref, eq, valor, lim, tipo /* 'min' | 'max' */, un = 'mm') {
  const ok = tipo === 'min' ? valor >= lim - 1e-9 : valor <= lim + 1e-9;
  return { g, nome, ref, eq, valor, lim, tipo, ok, un, det: true, ratio: tipo === 'min' ? (valor > 0 ? lim / valor : Infinity) : lim > 0 ? valor / lim : Infinity };
}
export function summarize(checks, avisos = []) {
  const calc = checks.filter((c) => !c.info);
  // governing ratio among the resistance checks; the detailing limits (det) enter only the OK/NÃO
  const res = calc.filter((c) => !c.det || c.res), pool = res.length ? res : calc;
  const gov = pool.reduce((a, c) => (!a || c.ratio > a.ratio ? c : a), null);
  return { checks, avisos, ok: calc.every((c) => c.ok), ratioMax: gov ? gov.ratio : 0, governa: gov };
}

/* ------------------------------------------------------------------------------------------------ NBR 8800 primitives */
/** 6.3.3.2 shear per plane (N). rosca = shear plane through the thread. pega (grip, mm) → 6.3.7 */
export function boltShear8800({ grade, db, rosca = true, pega = 0, protendido = false }) {
  const b = BOLTS_8800[grade]; if (!b) throw new Error(`parafuso desconhecido: ${grade}`);
  const k = (b.comum || rosca) ? 0.45 : 0.56, Ab = area(db);
  let red = 1, txtRed = '';
  if (!protendido && pega > 5 * db) { red = Math.max(0, 1 - 0.01 * (pega - 5 * db) / 1.5); txtRed = ` × ${nf(red, 3)} (pega longa 6.3.7)`; }
  const R = k * Ab * b.fub / GAMMA.a2 * red;
  return { R, k, Ab, fub: b.fub, eq: `Fv,Rd = ${nf(k)}·Ab·fub/γa2 = ${nf(k)}·${nf(Ab, 1)}·${nf(b.fub, 0)}/1,35${txtRed} = ${nf(kN(R))} kN` };
}
/** 6.3.3.1 tension (N) */
export function boltTension8800({ grade, db }) {
  const b = BOLTS_8800[grade], Ab = area(db), R = 0.75 * Ab * b.fub / GAMMA.a2;
  return { R, eq: `Ft,Rd = 0,75·Ab·fub/γa2 = 0,75·${nf(Ab, 1)}·${nf(b.fub, 0)}/1,35 = ${nf(kN(R))} kN` };
}
/** 6.3.3.3 bearing on one hole (N); deform: 'limitada' (1,2/2,4, default) | 'livre' (1,5/3,0) | 'perpendicular' (1,0/2,0) */
export function bearing8800({ lf, db, t, fu, deform = 'limitada' }) {
  const [k1, k2] = deform === 'livre' ? [1.5, 3.0] : deform === 'perpendicular' ? [1.0, 2.0] : [1.2, 2.4];
  const a = k1 * lf * t * fu / GAMMA.a2, b = k2 * db * t * fu / GAMMA.a2, R = Math.min(a, b);
  return { R, eq: `Fc,Rd = mín(${nf(k1, 1)}·ℓf·t·fu; ${nf(k2, 1)}·db·t·fu)/γa2 = mín(${nf(k1, 1)}·${nf(lf, 1)}·${nf(t, 2)}·${nf(fu, 0)}; ${nf(k2, 1)}·${nf(db, 2)}·${nf(t, 2)}·${nf(fu, 0)})/1,35 = ${nf(kN(R))} kN` };
}
/** 6.5.3 tension of a plate/element (N): yield Ag·fy/γa1, rupture Ae·fu/γa2 */
export function tensionElement8800({ Ag, Ae, fy, fu }) {
  const y = Ag * fy / GAMMA.a1, r = Ae * fu / GAMMA.a2;
  return { y, r, R: Math.min(y, r) };
}
/** 6.5.5 shear of an element */
export function shearElement8800({ Agv, Anv, fy, fu }) {
  const y = 0.6 * Agv * fy / GAMMA.a1, r = 0.6 * Anv * fu / GAMMA.a2;
  return { y, r, R: Math.min(y, r), eq: `mín(0,6·Agv·fy/γa1; 0,6·Anv·fu/γa2) = mín(0,6·${nf(Agv, 0)}·${nf(fy, 0)}/1,10; 0,6·${nf(Anv, 0)}·${nf(fu, 0)}/1,35) = mín(${nf(kN(y), 1)}; ${nf(kN(r), 1)}) kN` };
}
/** 6.5.6 block shear (N) */
export function blockShear8800({ Agv, Anv, Ant, fy, fu, Cts = 1 }) {
  const a = (0.6 * fu * Anv + Cts * fu * Ant) / GAMMA.a2, b = (0.6 * fy * Agv + Cts * fu * Ant) / GAMMA.a2, R = Math.min(a, b);
  return { R, eq: `Fr,Rd = mín(0,6·fu·Anv + Cts·fu·Ant; 0,6·fy·Agv + Cts·fu·Ant)/γa2 = mín(0,6·${nf(fu, 0)}·${nf(Anv, 0)} + ${nf(Cts, 1)}·${nf(fu, 0)}·${nf(Ant, 0)}; 0,6·${nf(fy, 0)}·${nf(Agv, 0)} + ${nf(Cts, 1)}·${nf(fu, 0)}·${nf(Ant, 0)})/1,35 = ${nf(kN(R), 1)} kN` };
}
/** 5.3 (via 6.5.4) compression of a plate element: rectangle b × t, Le = K·L; Q = 1 (decisão B: always min with 5.3) */
export function compressionPlate8800({ b, t, KL, fy }) {
  const Ag = b * t, I = b * t ** 3 / 12, r = Math.sqrt(I / Ag), Ne = Math.PI ** 2 * E_ACO * I / KL ** 2;
  const l0 = Math.sqrt(Ag * fy / Ne), chi = l0 <= 1.5 ? 0.658 ** (l0 * l0) : 0.877 / (l0 * l0);
  const R = chi * Ag * fy / GAMMA.a1;
  return { R, chi, l0, Ne, slender: KL / r, eq: `Nc,Rd = χ·Ag·fy/γa1, Ne = π²EI/(KL)² = ${nf(kN(Ne), 0)} kN, λ0 = ${nf(l0, 3)}, χ = ${nf(chi, 3)} → ${nf(chi, 3)}·${nf(Ag, 0)}·${nf(fy, 0)}/1,10 = ${nf(kN(R), 1)} kN (KL/r = ${nf(KL / r, 1)})` };
}
/** fillet weld metal, 6.2.5.1 Tab. 9 (N) per weld: 0,6·Aw·fw/γw2 with Aw = 0,707·dw·Lef; directional factor of 6.2.5.2-a optional */
export function fillet8800({ dw, L, fw, theta = 0, longitudinalExtremo = false }) {
  let Lef = L, beta = 1, nota = '';
  if (longitudinalExtremo) {                                   // 6.2.2.2-d
    if (L > 300 * dw) { Lef = 180 * dw; nota = ` (L > 300dw → ℓef = 180dw)`; beta = Lef / L; }
    else { beta = Math.min(1, Math.max(0.6, 1.2 - 0.002 * L / dw)); Lef = beta * L; if (beta < 1) nota = ` (β = ${nf(beta, 3)}, 6.2.2.2-d)`; }
  }
  const Aw = 0.707 * dw * Lef, dir = 1 + 0.5 * Math.sin(theta * Math.PI / 180) ** 1.5, R = 0.6 * Aw * fw / GAMMA.w2 * dir;
  return { R, Aw, Lef, beta, dir, eq: `Fw,Rd = 0,6·Aw·fw/γw2${dir > 1 ? `·(1 + 0,5·sen^1,5 θ)` : ''} = 0,6·(0,707·${nf(dw, 1)}·${nf(Lef, 0)})·${nf(fw, 0)}/1,35${dir > 1 ? `·${nf(dir, 3)}` : ''} = ${nf(kN(R), 1)} kN${nota}` };
}

/* ------------------------------------------------------------------------------------------------ NBR 14762 primitives */
const G14 = { rasg: 1.45, esm: 1.55, bolt: 1.35, block: 1.65, ty: 1.10, tr: 1.65 };
export function boltShear14762({ grade, d, rosca = true }) {
  const fub = fub14762(grade, d), Ab = area(d), k = rosca ? 0.4 : 0.5, R = k * Ab * fub / G14.bolt;
  return { R, fub, eq: `Fv,Rd = ${nf(k, 1)}·Ab·fub/γ = ${nf(k, 1)}·${nf(Ab, 1)}·${nf(fub, 0)}/1,35 = ${nf(kN(R))} kN` };
}
export function boltTension14762({ grade, d }) {
  const fub = fub14762(grade, d), Ab = area(d), R = 0.75 * Ab * fub / G14.bolt;
  return { R, eq: `Ft,Rd = 0,75·Ab·fub/γ = 0,75·${nf(Ab, 1)}·${nf(fub, 0)}/1,35 = ${nf(kN(R))} kN` };
}
/** 10.3.4 tearing: e from the hole centre to the edge of the adjacent hole or to the end */
export function tearing14762({ e, t, fu }) {
  const R = t * e * fu / G14.rasg;
  return { R, eq: `FRd = t·e·fu/γ = ${nf(t, 2)}·${nf(e, 1)}·${nf(fu, 0)}/1,45 = ${nf(kN(R))} kN` };
}
/** 10.3.5 bearing: αe = 0,183t + 1,53 (t mm, ≤ 4,75) */
export function bearing14762({ d, t, fu }) {
  const ae = 0.183 * t + 1.53, R = ae * d * t * fu / G14.esm;
  return { R, ae, eq: `FRd = αe·d·t·fu/γ, αe = 0,183·${nf(t, 2)} + 1,53 = ${nf(ae, 3)} → ${nf(ae, 3)}·${nf(d, 2)}·${nf(t, 2)}·${nf(fu, 0)}/1,55 = ${nf(kN(R))} kN` };
}
/** 10.4 block shear: smaller of the two expressions (text of the norm) */
export function blockShear14762({ Agv, Anv, Ant, fy, fu }) {
  const a = (0.6 * Agv * fy + Ant * fu) / G14.block, b = (0.6 * Anv * fu + Ant * fu) / G14.block, R = Math.min(a, b);
  return { R, eq: `FRd = mín(0,6·Agv·fy + Ant·fu; 0,6·Anv·fu + Ant·fu)/1,65 = mín(0,6·${nf(Agv, 0)}·${nf(fy, 0)} + ${nf(Ant, 0)}·${nf(fu, 0)}; 0,6·${nf(Anv, 0)}·${nf(fu, 0)} + ${nf(Ant, 0)}·${nf(fu, 0)})/1,65 = ${nf(kN(R), 1)} kN` };
}
/** 10.2.3 fillet on flat surfaces (N): paralela → a), normal → b); weld metal c) for t > 2,5 mm */
export function fillet14762({ L, t, w, fu, fw, dir = 'paralela' }) {
  let base, eqb;
  if (dir === 'paralela') {
    if (L / t < 25) { base = (1 - 0.01 * L / t) * t * L * fu / 1.65; eqb = `[1 − 0,01·L/t]·t·L·fu/1,65 = [1 − 0,01·${nf(L / t, 2)}]·${nf(t, 2)}·${nf(L, 0)}·${nf(fu, 0)}/1,65`; }
    else { base = 0.75 * t * L * fu / 2.0; eqb = `0,75·t·L·fu/2,00 = 0,75·${nf(t, 2)}·${nf(L, 0)}·${nf(fu, 0)}/2,00`; }
  } else { base = t * L * fu / 1.55; eqb = `t·L·fu/1,55 = ${nf(t, 2)}·${nf(L, 0)}·${nf(fu, 0)}/1,55`; }
  let R = base, eq = `FRd = ${eqb} = ${nf(kN(base), 2)} kN`;
  if (t > 2.5) {
    const tef = 0.7 * w, wm = 0.75 * tef * L * fw / 1.65;
    if (wm < R) { R = wm; }
    eq += `; t > 2,5 mm: ≤ 0,75·tef·L·fw/1,65 = 0,75·${nf(tef, 2)}·${nf(L, 0)}·${nf(fw, 0)}/1,65 = ${nf(kN(wm), 2)} kN`;
  }
  return { R, eq };
}

/* ------------------------------------------------------------------------------------------------ geometry */
/** rolled/plate angle by rectangles: A and ec = centroid → back of the connected leg (mm) */
export function angleRect({ b, b2 = b, t }) {
  const A = t * (b + b2 - t);
  const ec = (b * t * t / 2 + (b2 - t) * t * (t + (b2 - t) / 2)) / A;   // outstanding leg b2 perpendicular to the plane
  return { A, ec };
}
/** normal force for the design of the connection: minima of 8800 6.1.5.2 / 6.1.5.3 or 14762 10.1-a */
export function designForce({ norma, N, excecao45 = false, minimo50 = false, NRdBarra = 0, esbeltezComanda = false, NcRdBarra = 0 }) {
  const abs = Math.abs(N), parts = [`|NSd| = ${nf(abs)} kN`]; let F = abs, ref = '';
  if (norma === '8800') {
    if (!excecao45 && F < 45) { F = 45; parts.push('mínimo de 45 kN (6.1.5.2)'); }
    if (minimo50 && NRdBarra > 0 && F < 0.5 * NRdBarra) { F = 0.5 * NRdBarra; parts.push(`50 % de NRd da barra = ${nf(F)} kN (6.1.5.3, recomendação adotada)`); }
    if (esbeltezComanda && NcRdBarra > 0 && F < NcRdBarra) { F = NcRdBarra; parts.push(`barra comandada pela esbeltez máxima: 100 % de Nc,Rd = ${nf(F)} kN (6.1.5.3, recomendação adotada)`); }
    ref = '6.1.5';
  } else {
    if (NRdBarra > 0 && F < 0.5 * NRdBarra) { F = 0.5 * NRdBarra; parts.push(`50 % de NRd da barra = ${nf(F)} kN (10.1-a)`); }
    ref = '10.1-a';
  }
  return { F, ref, txt: parts.join('; ') };
}

/* ------------------------------------------------------------------------------------------------ elastic bolt group */
/** bolts [{x,y}] (mm), loads at the group centroid: Vx, Vy (kN), M (kN·mm, counter-clockwise +).
 *  Returns per-bolt [fx, fy, R] and the governing bolt (Fakury 10.14.5, elastic method). */
export function elasticGroup(bolts, { Vx = 0, Vy = 0, M = 0 }) {
  const n = bolts.length, xc = bolts.reduce((s, b) => s + b.x, 0) / n, yc = bolts.reduce((s, b) => s + b.y, 0) / n;
  const J = bolts.reduce((s, b) => s + (b.x - xc) ** 2 + (b.y - yc) ** 2, 0);
  const f = bolts.map((b) => { const dx = b.x - xc, dy = b.y - yc;
    const fx = Vx / n - (J > 0 ? M * dy / J : 0), fy = Vy / n + (J > 0 ? M * dx / J : 0); return { fx, fy, R: Math.hypot(fx, fy) }; });
  const gov = f.reduce((a, c) => c.R > a.R ? c : a, f[0]);
  return { J, xc, yc, f, Rmax: gov.R, gov };
}
