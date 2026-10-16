// ──────────────────────────────────────────────────────────────────────────────
// nbr14762.js — COLD-FORMED STEEL design per ABNT NBR 14762:2010 (PLANO_BRASIL).
//
// Scope v1: channels — U enrijecido (shape 'Ue') and U simples (shape 'U'), method of the
// effective width (MLE). Z enrijecido, cartola and L (cantoneira) are reported "não verificado"
// (ratio = Infinity + warning) except tension, which only needs the gross area.
//
//   · 9.6.2  tension          Nt,Rd = min(A·fy/1,10; An0·fu/1,35; Ct·An·fu/1,65) — b/c only with member.secaoLiquida
//              { An0, An [m²], Ct | ligacao: 'parafusada'|'soldada', todosConectados, nDirecao, x, Lc [m], d, g [m],
//              tipo: 'U'|'L', soldas: 'transversais'|'longitudinais' } (Ct of 9.6.2 items 3 and 4, profiles)
//   · 9.7    compression      Nc,Rd = min(9.7.2 global, 9.7.3 distorcional)
//       9.7.2  Nc,Rd = χ·Aef·fy/1,20 ; λ0 = √(A·fy/Ne) with A GROSS ; χ = 0,658^λ0² (λ0 ≤ 1,5) | 0,877/λ0²
//       9.7.2.1/2  Nex, Ney, Nez, r0² = rx²+ry²+x0² ; monosymmetric (x = symmetry axis): Ne = min(Ney, Nexz)
//       9.2.2 / 9.2.3  Aef by MLE at σ = χ·fy (Tab. 5 AA, Tab. 6 AL, edge stiffener 9.2.3.1)
//       9.7.3  Nc,Rd = χdist·A·fy/1,20 ; dispensed by Tab. 11 (Ue) or by 9.3 (U simples);
//              otherwise needs options.Ndist (elastic stability analysis) — else "não verificado"
//       9.7.4  KL/r ≤ 200
//   · 9.8.2  bending          MRd = min(9.8.2.1 yield, 9.8.2.2 FLT, 9.8.2.3 distorcional)
//       9.8.2.1  Wef·fy/1,10 (σ at the onset of yield, iterative, 9.2.2.1 a)
//       9.8.2.2  χFLT·Wc,ef·fy/1,10 ; strong axis Me = Cb·r0·√(Ney·Nez) ; weak axis: Anexo E
//                (Cs, Cm, j) ; Cb = 12,5·Mmax/(2,5·Mmax+3MA+4MB+3MC) (helper `cbMoments`)
//       9.8.2.3  χdist·W·fy/1,10 ; dispensed by Tab. 14 (Ue, strong axis) or 9.3 (U simples);
//                otherwise needs options.Mdist (strong) / options.MdistY (weak) — else "não verificado"
//   · Anexo F  panel on the tension flange (member.painelMesaTracionada = true | { continua }): MRd = R·Wef·fy/1,10
//              replaces the FLT of 9.8.2.2 (free compressed flange under suction); R by Tab. F.1; conditions a)–e), g), m)
//              checked from the geometry, f) and h)–l) declared by the user (warning); F.4: not for cantilevers nor the
//              stretch between an inflection point and an interior support. Yield and distortional checks stay.
//   · 9.8.3  shear            kv = 5,0 ; VRd by h/t regime, γ = 1,10 (h = flat web width)
//   · 9.8.4  M + V            (MSd/MRd)² + (VSd/VRd)² ≤ 1,0   (no transverse stiffeners)
//   · 9.9    N + M            NSd/NRd + Mx,Sd/Mx,Rd + My,Sd/My,Rd ≤ 1,0 (linear; 2nd order from the analysis)
//   · 9.1.2  Tab. 4 max b/t   exceeded → "não verificado"
//
// LACUNAS (always reported as warnings; never silent):
//   · Ndist / Mdist have no closed formula in the 2010 edition (9.3: elastic stability analysis,
//     e.g. CUFSM/DimPerfil): INPUTS options.Ndist [kN], options.Mdist / options.MdistY [kN·m]; when absent, Ndist and
//     Mdist (strong axis) come from the finite strip method of js/design/fsm.js (centreline, square corners; validated:
//     plate k = 4, Euler ±0,2 %, DimPerfil Ue 100×50×17×3 Ndist −0,9 %). MdistY (weak axis) stays an input. options.fsm = false switches the FSM off (old LACUNA path).
//   · Anexo C (MRD) with options.metodo = 'MRD': Nc,Rd = min(Nc,Re; Nc,Rℓ; Nc,Rdist)/1,20 and MRd = min(MRe; MRℓ;
//     MRdist)/1,10 (strong axis), Nℓ/Ndist/Mℓ/Mdist by FSM (or options.Nl/Ndist/Ml/Mdist), Ne/Me of 9.7.2/9.8.2.2.
//   · Shear lag (9.4), MSE (9.7.2 b / 9.8.2.1 b),
//     Anexo B (cold-work fy), Anexo C (MRD), Anexo F (purlin with panel on the tension flange),
//     Vz (shear parallel to the flanges) and Ue weak-axis bending with the lips compressed
//     (gradient + edge stiffener is not covered by 9.2.3).
//
// Weak-axis bending of a channel depends on the SENSE of My (web or lip tips compressed): the
// model's My sign convention is not known here → options.sentidoMy = 'alma' | 'mesas'; without it
// the check takes the minimum of the two senses (and is "não verificado" if one of them is).
//
// Axes: z = strong axis (NBR x), y = weak axis. Units: kN, m, kN/m² at the interface; the
// engine works internally in kN and cm (same units as the NBR 14762 examples).
//
// Input `sec` (SI, e.g. from profiles_cf.js `cfSection`): shape 'Ue'|'U', dims {bw,bf,D,t,ri},
// A, Iz (=Ix), Iy, J, Cw, Sz (=Wx), Sy, rz, ry, x0 (centroid–shear-centre distance), xg
// (centroid from the web outer face), r0.
//
// Source transcription: ficha_nbr14762_2010.md (pages checked against the 2010 PDF).
// ──────────────────────────────────────────────────────────────────────────────

import { finalize } from './aisc360.js?v=7';
import { criticalLoadsChannel } from '../fsm.js?v=7';
import { cfSection } from '../profiles_cf.js?v=7';

const PI2 = Math.PI * Math.PI;
const fix = (x) => +(+x).toPrecision(8);
const ratObj = (D, C, extra = {}) => ({
  demand: fix(D), capacity: fix(C),
  ratio: C > 1e-12 ? +(D / C).toFixed(4) : Infinity, ...extra,
});
// Item that could not be verified: capacity 0, ratio = Infinity only if there is a demand.
const unverified = (D, why, extra = {}) => ({
  demand: fix(D), capacity: 0, ratio: D > 0 ? Infinity : 0, verificado: false, motivo: why, ...extra,
});

// ── 9.7.2 / 9.8.2.2 / 9.7.3 / 9.8.2.3 reduction factors ───────────────────────────
export const chiComp = (l0) => l0 <= 1.5 ? Math.pow(0.658, l0 * l0) : 0.877 / (l0 * l0);          // 9.7.2
export const chiFLT = (l0) => l0 <= 0.6 ? 1 : l0 < 1.336 ? 1.11 * (1 - 0.278 * l0 * l0) : 1 / (l0 * l0); // 9.8.2.2
export const chiDistN = (l) => l <= 0.561 ? 1 : (1 - 0.25 / Math.pow(l, 1.2)) / Math.pow(l, 1.2);   // 9.7.3
export const chiDistM = (l) => l <= 0.673 ? 1 : (1 - 0.22 / l) / l;                                  // 9.8.2.3

/** Cb of 9.8.2.2: Cb = 12,5·Mmax / (2,5·Mmax + 3·MA + 4·MB + 3·MC) (absolute values). */
export function cbMoments(Mmax, MA, MB, MC) {
  const a = Math.abs;
  return 12.5 * a(Mmax) / (2.5 * a(Mmax) + 3 * a(MA) + 4 * a(MB) + 3 * a(MC));
}

// ── Tabelas 11 (compressão, p.43) e 14 (flexão eixo x, p.50): D/bw mínimo p/ dispensar distorcional ──
const TAB_BWT = [250, 200, 125, 100, 50];
const TAB_BFBW = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0];
const TAB11 = [
  [0.02, 0.03, 0.04, 0.04, 0.08], [0.03, 0.04, 0.06, 0.06, 0.15], [0.05, 0.06, 0.08, 0.10, 0.22],
  [0.06, 0.07, 0.10, 0.12, 0.27], [0.06, 0.07, 0.12, 0.15, 0.27], [0.06, 0.08, 0.12, 0.15, 0.27],
  [0.07, 0.08, 0.12, 0.15, 0.27], [0.07, 0.08, 0.12, 0.15, 0.27], [0.07, 0.08, 0.12, 0.15, 0.27],
];
const TAB14 = [
  [0.05, 0.06, 0.10, 0.12, 0.25], [0.05, 0.06, 0.10, 0.12, 0.25], [0.05, 0.06, 0.09, 0.12, 0.22],
  [0.05, 0.06, 0.09, 0.11, 0.22], [0.05, 0.06, 0.09, 0.11, 0.20], [0.05, 0.06, 0.09, 0.10, 0.20],
  [0.05, 0.06, 0.09, 0.10, 0.20], [0.05, 0.06, 0.09, 0.10, 0.19], [0.05, 0.06, 0.09, 0.10, 0.19],
];
/** Bilinear interpolation (nota 2); null outside the printed domain (no extrapolation). */
export function dminTabela(tab, bfbw, bwt) {
  if (!(bfbw >= 0.4 - 1e-9 && bfbw <= 2.0 + 1e-9 && bwt >= 50 - 1e-9 && bwt <= 250 + 1e-9)) return null;
  const T = tab === 11 ? TAB11 : TAB14;
  let i = Math.min(Math.max(Math.floor((bfbw - 0.4) / 0.2 + 1e-9), 0), TAB_BFBW.length - 2);
  let j = 0; while (j < TAB_BWT.length - 2 && bwt < TAB_BWT[j + 1]) j++;
  const u = (bfbw - TAB_BFBW[i]) / 0.2, w = (TAB_BWT[j] - bwt) / (TAB_BWT[j] - TAB_BWT[j + 1]);
  const v = (r) => T[r][j] + (T[r][j + 1] - T[r][j]) * w;
  return v(i) + (v(i + 1) - v(i)) * u;
}

// ── 9.2.2 effective widths ────────────────────────────────────────────────────────
// σ > 0 = compression. Positions s are measured along the element from end "a" (s = 0).
const rhoOf = (lp) => lp <= 0.673 ? 1 : (1 - 0.22 / lp) / lp;
const lamP = (b, t, k, sig, E) => (b / t) / (0.95 * Math.sqrt(k * E / sig));          // 9.2.2.1: λp = (b/t)/[0,95(kE/σ)^0,5]
const FULL = { gaps: [], full: true };

// AA element (both edges supported) — Tab. 5, 9.2.2.1. Returns gaps = ineffective intervals.
function effAA(b, t, sa, sb, E) {
  const s1 = Math.max(sa, sb), s2 = Math.min(sa, sb);
  if (!(s1 > 0)) return FULL;
  const fromA = sa >= sb, psi = s2 / s1;
  const uni = psi >= 1 - 1e-9;
  const k = uni ? 4 : 4 + 2 * (1 - psi) + 2 * Math.pow(1 - psi, 3);                  // Tab. 5 a/b/c/d
  const lp = lamP(b, t, k, s1, E);                                                    // b = flat width (not bc)
  if (lp <= 0.673) return { gaps: [], full: true, k, lp, psi };
  const bef = b * rhoOf(lp);                                                          // 9.2.2.1
  const bc = psi >= 0 ? b : b / (1 - psi);
  let b1, b2;
  if (uni) { b1 = b2 = bef / 2; }                                                     // caso a
  else if (psi > -0.236) { b1 = bef / (3 - psi); b2 = bef - b1; }                     // casos b, c
  else { b1 = bef / (3 - psi); b2 = 0.5 * bef; }                                      // caso d (b1 + b2 ≤ bc)
  const g0 = b1, g1 = bc - b2;                                                        // from the σ1 end
  if (!(g1 > g0 + 1e-12)) return { gaps: [], full: true, k, lp, psi, bef };
  return { gaps: [fromA ? [g0, g1] : [b - g1, b - g0]], k, lp, psi, bef };
}

// AL element (end a supported, end b free) — Tab. 6, 9.2.2.1. Effective part adjacent to the support.
// EXTENSION (review 15/10/2026, declared — not a literal reading): σ1 at the support with ψ < −1 (e.g. the flanges of a
// plain U with the web compressed, ψ ≈ −3,7) is outside Tab. 6 (caso c: −1 ≤ ψ < 0). k grows as ψ decreases (smaller
// compressed zone), so k(ψ = −1) = 23,8 is a lower bound; with it λp ≤ 0,673 for any b/t admitted by Tab. 4 and the
// element is fully effective, whatever ψ < −1. In the ρ < 1 branch bc = b/2 (larger than b/(1 − ψ)) — conservative.
const _alNotes = new Set();
export function effAL(b, t, sa, sb, E) {
  if (!(Math.max(sa, sb) > 0)) return FULL;
  let psi, k, s1, bc = b, bef, gap;
  if (sa >= sb) {                                                                      // σ1 at the support: casos a, b, c
    s1 = sa; psi = sb / s1;
    if (psi >= 1 - 1e-9) k = 0.43;
    else if (psi >= 0) k = 0.578 / (psi + 0.34);
    else if (psi >= -1) k = 1.7 - 5 * psi + 17.1 * psi * psi;
    else { k = 23.8; _alNotes.add(`elemento AL com ψ < −1 (borda apoiada comprimida): extensão da Tab. 6 com k = 23,8 (valor de ψ = −1, limite inferior por monotonia) e bc = b/2 — não é leitura literal da NBR 14762.`); }
    if (psi < 0) bc = psi < -1 ? b / 2 : b / (1 - psi);
    const lp = lamP(b, t, k, s1, E);
    bef = bc * rhoOf(lp);
    gap = bef < bc - 1e-12 ? [bef, bc] : null;
    return { gaps: gap ? [gap] : [], full: !gap, k, lp, psi, bef };
  }
  s1 = sb; psi = sa / s1;                                                              // σ1 at the free edge: caso d
  if (psi < -1) return { unverified: `AL com ψ = ${psi.toFixed(2)} < −1 fora da Tab. 6` };
  k = 0.57 - 0.21 * psi + 0.07 * psi * psi;
  const lp = lamP(b, t, k, s1, E);
  if (psi >= 0) { bef = b * rhoOf(lp); gap = bef < b - 1e-12 ? [bef, b] : null; }
  else {                                                                               // 9.2.2.1: bef = bc·ρ, bc = compressed width
    bc = b / (1 - psi); bef = bc * rhoOf(lp);
    gap = bef < bc - 1e-12 ? [b - bc + bef, b] : null;                                 // effective part next to the tension zone
  }
  return { gaps: gap ? [gap] : [], full: !gap, k, lp, psi, bef };
}

// 9.2.3.1 — uniformly compressed AA element with simple edge stiffener (θ = 90°).
// b = flat width, Dn = nominal stiffener dimension, d = flat stiffener width.
function effFlangeStiff(b, t, Dn, d, sig, E) {
  const lp0 = (b / t) / (0.623 * Math.sqrt(E / sig));
  if (lp0 <= 0.673) return { gaps: [], R: 1, lp0, full: true };                       // stiffener not necessary; ds = def
  const Is = t * Math.pow(d, 3) / 12;                                                  // sen²θ = 1
  const Ia = Math.min(399 * Math.pow(t, 4) * Math.pow(0.487 * lp0 - 0.328, 3), Math.pow(t, 4) * (56 * lp0 + 5));
  const n = Math.max(0.582 - 0.122 * lp0, 1 / 3);
  const R = Math.min(Is / Ia, 1);                                                      // "considerar Is/Ia ≤ 1"
  const db = Dn / b;
  if (db > 0.8) return { unverified: `D/b = ${db.toFixed(2)} > 0,8 fora de 9.2.3.1` };
  const k = Math.min(db <= 0.25 ? 3.57 * Math.pow(R, n) + 0.43 : (4.82 - 5 * db) * Math.pow(R, n) + 0.43, 4);
  const lp = lamP(b, t, k, sig, E);
  const bef = b * rhoOf(lp);
  const b1 = R * bef / 2, b2 = bef - b1;                                               // b1 next to the stiffener, b2 next to the web (Fig. 2)
  const gap = b - b1 > b2 + 1e-12 ? [b2, b - b1] : null;
  return { gaps: gap ? [gap] : [], R, lp0, k, lp, Is, Ia, bef, full: !gap };
}

// ── channel geometry (cm) and effective section ───────────────────────────────────
// x from the web outer face, y from the mid-height (symmetric). Flat widths exclude corners:
// c = t + ri per corner (NBR 14762 symbols, p.8; same b of the CBCA manual).
function channelElems(g) {
  const { bw, bf, D, t, ri, ue } = g, c = t + ri, hw = bw - 2 * c, els = [];
  els.push({ id: 'alma', kind: 'AA', t, b: hw, P0: [t / 2, hw / 2], u: [0, -1] });
  for (const s of [1, -1]) {
    const yf = s * (bw / 2 - t / 2), tag = s > 0 ? '+' : '-';
    if (ue) {
      els.push({ id: 'mesa' + tag, kind: 'FLG', t, b: bf - 2 * c, P0: [c, yf], u: [1, 0], Dn: D, lip: 'labio' + tag });
      els.push({ id: 'labio' + tag, kind: 'AL', t, b: D - c, P0: [bf - t / 2, s * (bw / 2 - c)], u: [0, -s], lipOf: 'mesa' + tag });
    } else {
      els.push({ id: 'mesa' + tag, kind: 'AL', t, b: bf - c, P0: [c, yf], u: [1, 0] });
    }
  }
  return els;
}

// cfg: { axis: 'N' (uniform σ = cfg.sigma) | 'x' (strong) | 'y' (weak, cfg.comp 'alma'|'mesas'),
//        mode: 'yield' (σ_fibra = fy no início do escoamento) | 'stab' (σ na fibra comprimida = cfg.sigma) }
function solveEff(g, E, cfg) {
  const els = channelElems(g), byId = Object.fromEntries(els.map(e => [e.id, e]));
  const A0 = g.A, N = cfg.axis === 'N';
  let I0, pn0, pc, pt, ax;
  if (cfg.axis === 'x') { I0 = g.Ix; pn0 = 0; pc = g.bw / 2; pt = -g.bw / 2; ax = 1; }
  else if (cfg.axis === 'y') { I0 = g.Iy; pn0 = g.xg; ax = 0; if (cfg.comp === 'alma') { pc = 0; pt = g.bf; } else { pc = g.bf; pt = 0; } }
  const dsgn = N ? 1 : (pc > pt ? 1 : -1);
  let pn = N ? 0 : pn0, last = null;
  for (let it = 0; it < 400; it++) {
    let a = 0;
    if (!N) {
      const dc = Math.abs(pc - pn), dt = Math.abs(pt - pn);
      a = cfg.mode === 'yield' ? cfg.fy / Math.max(dc, dt) : cfg.sigma / dc;
    }
    const pe = (el, s) => {                                                            // stress-axis coordinate of a point of the element
      if (el.u[ax] === 0) return el.P0[ax] + dsgn * el.t / 2;                          // perpendicular element: face towards the compressed fibre
      return el.P0[ax] + el.u[ax] * s;
    };
    const sig = (el, s) => N ? cfg.sigma : a * dsgn * (pe(el, s) - pn);
    const pieces = [], notes = {};
    let bad = null;
    const addGap = (el, g0, g1) => {
      const L = g1 - g0; if (!(L > 1e-12)) return;
      const sm = (g0 + g1) / 2, pcen = N ? 0 : el.P0[ax] + el.u[ax] * sm;
      const along = !N && el.u[ax] !== 0;
      pieces.push({ el: el.id, area: L * el.t, p: pcen, Iown: N ? 0 : along ? el.t * L ** 3 / 12 : L * el.t ** 3 / 12, g0, g1 });
    };
    for (const el of els) {
      if (el.lipOf) continue;
      if (el.kind === 'AA') {
        const r = effAA(el.b, el.t, sig(el, 0), sig(el, el.b), E); notes[el.id] = r;
        for (const gp of r.gaps) addGap(el, gp[0], gp[1]);
      } else if (el.kind === 'AL') {
        const r = effAL(el.b, el.t, sig(el, 0), sig(el, el.b), E); notes[el.id] = r;
        if (r.unverified) { bad = `${el.id}: ${r.unverified}`; break; }
        for (const gp of r.gaps) addGap(el, gp[0], gp[1]);
      } else {                                                                         // FLG: flange with edge stiffener + its lip
        const lip = byId[el.lip];
        const sa = sig(el, 0), sb = sig(el, el.b), la = sig(lip, 0), lb = sig(lip, lip.b);
        const uni = Math.abs(sa - sb) <= 1e-9 * (Math.abs(sa) + Math.abs(sb) + 1e-12);
        const rl = effAL(lip.b, lip.t, la, lb, E);
        if (rl.unverified) { bad = `${lip.id}: ${rl.unverified}`; break; }
        if (uni) {
          const rf = sa > 0 ? effFlangeStiff(el.b, el.t, el.Dn, lip.b, sa, E) : { R: 1, gaps: [] };   // tensioned flange: fully effective
          if (rf.unverified) { bad = `${el.id}: ${rf.unverified}`; break; }
          notes[el.id] = rf; notes[lip.id] = rl;
          if (sa > 0) for (const gp of rf.gaps) addGap(el, gp[0], gp[1]);
          if (rf.R < 1) {                                                              // ds = (Is/Ia)·def
            const def = rl.gaps.length ? rl.gaps[0][0] : lip.b, end = rl.gaps.length ? rl.gaps[0][1] : lip.b;
            addGap(lip, rf.R * def, end);
          } else for (const gp of rl.gaps) addGap(lip, gp[0], gp[1]);
        } else {
          if (Math.max(sa, sb) > 0 && Math.max(la, lb) > 0) { bad = `${el.id}: mesa com gradiente e enrijecedor comprimido (9.2.3 só cobre compressão uniforme)`; break; }
          const rf = effAA(el.b, el.t, sa, sb, E); notes[el.id] = rf; notes[lip.id] = rl;
          for (const gp of rf.gaps) addGap(el, gp[0], gp[1]);
          for (const gp of rl.gaps) addGap(lip, gp[0], gp[1]);
        }
      }
    }
    if (bad) return { unverified: bad };
    const dA = pieces.reduce((s, q) => s + q.area, 0);
    const Aef = A0 - dA;
    let res;
    if (N) res = { Aef, pieces, notes, dA };
    else {
      const pnN = (A0 * pn0 - pieces.reduce((s, q) => s + q.area * q.p, 0)) / Aef;
      const I00 = I0 - pieces.reduce((s, q) => s + q.area * (q.p - pn0) ** 2 + q.Iown, 0);
      const I = I00 - Aef * (pnN - pn0) ** 2;
      res = { Aef, I, pn: pnN, dc: Math.abs(pc - pnN), dt: Math.abs(pt - pnN), pieces, notes, dA, a };
    }
    last = res;
    if (N) return res;
    const dpn = Math.abs(res.pn - pn);
    if (dpn < 1e-10) { res.iter = it + 1; return res; }
    pn = it < 40 ? res.pn : 0.5 * (pn + res.pn);
  }
  last.naoConvergiu = true;
  return last;
}

// ── Anexo E (p.82-84): monosymmetric bending about the axis ⟂ symmetry (cm) ──────────────
function anexoEj(g) {
  const t = g.t, am = g.bw - t;
  let bm, cm = 0, xm, x0;
  if (g.ue) {
    bm = g.bf - t; cm = g.D - 0.5 * t;
    xm = bm * (bm + 2 * cm) / (am + 2 * bm + 2 * cm);
    x0 = bm * (3 * am * am * bm + cm * (6 * am * am - 8 * cm * cm)) /
      (am ** 3 + 6 * am * am * bm + cm * (8 * cm * cm - 12 * am * cm + 6 * am * am)) + xm;
  } else {
    bm = g.bf - 0.5 * t;
    xm = bm * bm / (am + 2 * bm);
    x0 = bm * 3 * am * am * bm / (am ** 3 + 6 * am * am * bm) + xm;
  }
  const bw_ = -(t * xm * am ** 3 / 12 + t * xm ** 3 * am);
  const bf_ = (t / 2) * ((bm - xm) ** 4 - xm ** 4) + (t * am * am / 4) * ((bm - xm) ** 2 - xm * xm);
  const bl_ = g.ue ? 2 * cm * t * (bm - xm) ** 3 + (2 / 3) * t * (bm - xm) * ((am / 2) ** 3 - (am / 2 - cm) ** 3) : 0;
  return { am, bm, cm, xm, x0, betaW: bw_, betaF: bf_, betaL: bl_, j: (bw_ + bf_ + bl_) / (2 * g.Iy) + x0 };
}

// ── 9.8.3 shear (cm, kN) ──────────────────────────────────────────────────────────
function shearRd(h, t, fy, E, kv = 5.0) {
  const ht = h / t, l1 = 1.08 * Math.sqrt(E * kv / fy), l2 = 1.4 * Math.sqrt(E * kv / fy), ga = 1.10;
  let V, regime;
  if (ht <= l1) { V = 0.6 * fy * h * t / ga; regime = 'h/t ≤ 1,08√(E·kv/fy): 0,6·fy·h·t/γ'; }
  else if (ht <= l2) { V = 0.65 * t * t * Math.sqrt(kv * fy * E) / ga; regime = '1,08√ < h/t ≤ 1,4√: 0,65·t²·√(kv·fy·E)/γ'; }
  else { V = 0.905 * E * kv * Math.pow(t, 3) / (h * ga); regime = 'h/t > 1,4√: 0,905·E·kv·t³/(h·γ)'; }
  return { V, regime, ht, l1, l2 };
}

// ── Anexo C (MRD) — characteristic resistances (kN, cm), γ applied by the caller ────────────────────────
// C.3: Nc,Re = χ(λ0)·A·fy; Nc,Rℓ = Nc,Re (λℓ ≤ 0,776) | (1 − 0,15/λℓ^0,8)·Nc,Re/λℓ^0,8, λℓ = √(Nc,Re/Nℓ);
//      Nc,Rdist = A·fy (λdist ≤ 0,561) | (1 − 0,25/λdist^1,2)·A·fy/λdist^1,2, λdist = √(A·fy/Ndist)
export function mrdCompressao14762({ A, fy, Ne, Nl, Ndist }) {
  const l0 = Math.sqrt(A * fy / Ne), NcRe = chiComp(l0) * A * fy;
  let NcRl = NcRe, ll = null; if (Nl > 0) { ll = Math.sqrt(NcRe / Nl); if (ll > 0.776) NcRl = (1 - 0.15 / ll ** 0.8) * NcRe / ll ** 0.8; }
  let NcRdist = Infinity, ld = null; if (Ndist > 0) { ld = Math.sqrt(A * fy / Ndist); NcRdist = ld <= 0.561 ? A * fy : (1 - 0.25 / ld ** 1.2) * A * fy / ld ** 1.2; }
  return { lambda0: l0, NcRe, lambdaL: ll, NcRl, lambdaDist: ld, NcRdist, NcRk: Math.min(NcRe, NcRl, NcRdist) };
}
// C.4: MRe = χFLT(λ0)·W·fy, λ0 = √(W·fy/Me); MRℓ = MRe (λℓ ≤ 0,776) | (1 − 0,15/λℓ^0,8)·MRe/λℓ^0,8, λℓ = √(MRe/Mℓ);
//      MRdist = W·fy (λdist ≤ 0,673) | (1 − 0,22/λdist)·W·fy/λdist, λdist = √(W·fy/Mdist)
export function mrdFlexao14762({ W, fy, Me, Ml, Mdist }) {
  const l0 = Math.sqrt(W * fy / Me), MRe = chiFLT(l0) * W * fy;
  let MRl = MRe, ll = null; if (Ml > 0) { ll = Math.sqrt(MRe / Ml); if (ll > 0.776) MRl = (1 - 0.15 / ll ** 0.8) * MRe / ll ** 0.8; }
  let MRdist = Infinity, ld = null; if (Mdist > 0) { ld = Math.sqrt(W * fy / Mdist); MRdist = ld <= 0.673 ? W * fy : (1 - 0.22 / ld) * W * fy / ld; }
  return { lambda0: l0, MRe, lambdaL: ll, MRl, lambdaDist: ld, MRdist, MRk: Math.min(MRe, MRl, MRdist) };
}

const _fsmCache = new Map();
// FSM critical loads of a channel (kN, kN·cm), cached by geometry; dims in cm, E in kN/cm²
function fsmChannel(g, E) {
  const key = [g.bw, g.bf, g.D, g.t, E, g.A, g.Wx].map(v => (+v || 0).toFixed(4)).join('|');
  if (!_fsmCache.has(key)) {
    let r = null;
    try { r = criticalLoadsChannel({ bw: g.bw * 10, bf: g.bf * 10, D: g.D * 10, t: g.t * 10 }, { E: E * 10, nu: 0.3 }); } catch { r = null; }
    // by critical STRESS (σcr = N/A, M/W of the centreline model) times the catalogue A / W, so λ = √(fy/σcr) does not
    // mix geometries (square-corner centreline vs rounded catalogue section)
    const Wm = r ? r.model.Ix / r.model.zmax : 0;
    const N = (v) => v > 0 ? v / r.model.A * g.A / 10 : null;          // MPa · cm² / 10 → kN
    const M = (v) => v > 0 && g.Wx > 0 ? v / Wm * g.Wx / 10 : null;    // MPa · cm³ / 10 → kN·cm
    _fsmCache.set(key, r && { Nl: N(r.Nl), Ndist: N(r.Ndist), Ml: M(r.Ml), Mdist: M(r.Mdist), aNdist: r.aNdist, aMdist: r.aMdist });
  }
  return _fsmCache.get(key);
}
const FSM_NOTE = 'faixas finitas (js/design/fsm.js: linha média, cantos vivos, convertido pela tensão crítica para A/W do catálogo; local = 1º e distorcional = 2º mínimo da curva de assinatura; validado contra placa k = 4, Euler e DimPerfil)';

// 9.6.2 c: Ct of PROFILES (items 3 bolted, 4 welded). Lengths in cm. Returns { Ct, ref } or { erro }.
export function ctPerfil14762({ Ct, ligacao, todosConectados, nDirecao, x, Lc, d, g, tipo = 'U', soldas }) {
  if (Ct != null) return { Ct: Math.min(Ct, 1), ref: 'informado' };
  const lim = (v, vmin) => v < vmin - 1e-12 ? { erro: `Ct = ${v.toFixed(3)} < ${vmin}: ligação não permitida (9.6.2 c)` } : { Ct: Math.min(v, 0.9) };
  if (ligacao === 'parafusada') {
    if (todosConectados && nDirecao >= 2) return { Ct: 1.0, ref: '9.6.2 c-3: todos os elementos conectados, ≥ 2 parafusos' };
    if (nDirecao === 1 || nDirecao == null && d > 0 && g > 0) {
      if (!(d > 0 && g > 0)) return { erro: 'parafusos numa única seção: informe d e g (chapa equivalente, Ct = 2,5·d/g)' };
      return { Ct: Math.min(2.5 * d / g, 1), ref: '9.6.2 c-3: parafusos numa única seção (chapa equivalente), Ct = 2,5·d/g' };
    }
    if (!(x > 0 && Lc > 0)) return { erro: 'U/L com parafusos e nem todos os elementos conectados: informe x e Lc' };
    const r = lim(1 - 1.2 * x / Lc, 0.4); return r.erro ? r : { ...r, ref: '9.6.2 c-3: Ct = 1 − 1,2·x/L (≤ 0,9; ≥ 0,4)' };
  }
  if (ligacao === 'soldada') {
    if (soldas === 'transversais') return { Ct: 1.0, ref: '9.6.2 c-4: apenas soldas transversais' };
    if (todosConectados) return { Ct: 1.0, ref: '9.6.2 c-4: todos os elementos conectados' };
    if (!(x > 0 && Lc > 0)) return { erro: 'soldas longitudinais em parte dos elementos: informe x e Lc' };
    const r = tipo === 'L' ? lim(1 - 1.2 * x / Lc, 0.4) : lim(1 - 0.36 * x / Lc, 0.5);
    return r.erro ? r : { ...r, ref: tipo === 'L' ? '9.6.2 c-4: cantoneira, Ct = 1 − 1,2·x/L (≤ 0,9; ≥ 0,4)' : '9.6.2 c-4: perfil U, Ct = 1 − 0,36·x/L (≤ 0,9; ≥ 0,5)' };
  }
  return { erro: 'informe Ct ou ligacao (parafusada | soldada)' };
}

function checkNBR14762({ demands = {}, mat, sec, member = {}, options = {} }) {
  const avisos = [];
  _alNotes.clear();
  const E = mat.E / 1e4, fy = mat.Fy / 1e4;                                           // kN/cm²
  const G = (mat.G ?? 0.385 * mat.E) / 1e4;                                           // 77 000 MPa (4.6)
  if (Math.abs(mat.E - 2e8) > 1e5) avisos.push(`E = ${(mat.E / 1e6).toFixed(0)} GPa ≠ 200 GPa (NBR 14762:2010 4.6): conferir o material.`);
  if (mat.Fu && mat.Fu < 1.08 * mat.Fy) avisos.push('fu/fy < 1,08 (NBR 14762:2010 4.1.1): aço sem qualificação estrutural para esta norma.');
  const gamC = 1.20, gamT = 1.10, gamF = 1.10;
  const shape = sec.shape, d0 = sec.dims || {};
  const isCh = shape === 'Ue' || shape === 'U';
  const N = demands.N || 0, Nabs = Math.abs(N);
  const Mz = Math.abs(demands.Mz || 0) * 100, My = Math.abs(demands.My || 0) * 100;   // kN·cm
  const Vy = Math.abs(demands.Vy || 0), Vz = Math.abs(demands.Vz || 0);
  const A = sec.A * 1e4;                                                              // cm²

  // member lengths (cm). L alone ⇒ K = 1,0 (flagged); K from NBR 8800 (14762 8.2).
  const L = (member.L || 1) * 100;
  const semLbar = member.Ldefault || member.L == null;                                // no bar length (design.js fills Lb/K/Cb by default)
  const semLc = semLbar && member.Lx == null && member.Ly == null && member.Lz == null;                 // global buckling
  const semLf = semLbar && (member.Lb == null || member.LbDefault) && member.Ly == null && member.Lz == null;   // FLT
  const Lx = (member.Lx ?? (member.Kz ?? member.K ?? 1) * (member.L || 1)) * 100;     // buckling about the strong axis
  const Ly = (member.Ly ?? (member.Ky ?? member.K ?? 1) * (member.L || 1)) * 100;     // about the weak axis
  const Lt = (member.Lz ?? (member.Kt ?? 1) * (member.L || 1)) * 100;                 // torsion (KzLz)
  const LbIn = member.Lb != null && !member.LbDefault;                               // Lb injected by design.js is not a user value
  const Lby = LbIn ? member.Lb * 100 : Ly, Lbz = LbIn ? member.Lb * 100 : Lt;   // unbraced lengths for FLT (9.8.2.2)
  const Cb = member.Cb ?? 1.0, Cm = member.Cm ?? 1.0;
  if ((member.Cb == null || member.CbDefault) && Mz > 0) avisos.push('Cb = 1,0 (a favor da segurança, 9.8.2.2): informe member.Cb (helper cbMoments) para o diagrama real.');
  if (member.L != null && !member.Ldefault && member.Lx == null && (member.K == null || member.Kdefault) && member.Kz == null && member.Ky == null && (N < 0))
    avisos.push('K = 1,0 adotado (comprimento destravado = L); informe Lx/Ly/Lz com K da NBR 8800 se aplicável (14762:2010 8.2).');

  // geometry (cm) ----------------------------------------------------------------
  let g = null, gL = null, geomWhy = null, limComp = null, limFlex = null;
  const isL = shape === 'L';
  if (isL) {
    // single equal-leg angle (NBR 6355 Tab. A.1): axial force only. Axis 1 (I1, major) = axis of symmetry, x0 on it.
    const miss = ['I1', 'I2', 'J', 'x0', 'r0'].filter(k => !(sec[k] > 0));
    if (!(d0.b > 0 && d0.t > 0)) miss.push('dims.b', 'dims.t');
    if (d0.b2 > 0 && Math.abs(d0.b2 - d0.b) > 1e-9) geomWhy = 'cantoneira de abas desiguais: seção assimétrica (9.7.2.3) — fora do escopo da v1, NÃO verificada.';
    else if (miss.length) geomWhy = `cantoneira sem ${miss.join(', ')} (eixos principais da NBR 6355 Tab. A.1): fora do escopo da verificação — NÃO verificada. Escolha uma cantoneira do catálogo NBR 6355 ou informe I1, I2, J, x0 e r0.`;
    else {
      const t = d0.t * 100, ri = (d0.ri ?? d0.t) * 100;
      gL = { B: d0.b * 100, t, ri, I1: sec.I1 * 1e8, I2: sec.I2 * 1e8, J: sec.J * 1e8, x0: sec.x0 * 100, r0: sec.r0 * 100 };
      gL.b = gL.B - (t + ri);                                                  // flat width of each leg (AL)
      gL.r2 = sec.r2 > 0 ? sec.r2 * 100 : Math.sqrt(gL.I2 / A);
      if (gL.b / t > 60) limComp = `Tab. 4 (9.1.2) excedida: aba (AL) b/t = ${(gL.b / t).toFixed(1)} > 60.`;
      gL.xg = sec.xg > 0 ? sec.xg * 100 : null; gL.A = A;
      if (!(gL.xg > 0)) limFlex = 'cantoneira sem xg (NBR 6355 Tab. A.1): flexão NÃO verificada.';
    }
  } else if (/^2(L|U|Ue)$/.test(shape)) geomWhy = sec.arr === 'caixa'
    ? `composta em caixa "${sec.designacao || shape}": LACUNA na v1 — a NBR 14762:2010 só trata o tubo de 2 U com solda de costura contínua (Tab. 9 d / Tab. 12 c) e não dá Cw nem FLT da seção composta. Tração: só escoamento da seção bruta.`
    : `composta "${sec.designacao || shape}": use nbr14762.check (verificação por perfil isolado): NÃO verificada.`;
  else if (!isCh) geomWhy = `seção "${shape}" fora do escopo da v1 (Ue e U simples): NÃO verificada (LACUNA).`;
  else {
    const need = ['bw', 'bf', 't'].filter(k => !(d0[k] > 0));
    const props = { Iz: sec.Iz, Iy: sec.Iy, J: sec.J, Cw: sec.Cw, x0: sec.x0 };   // xg only for weak-axis bending
    const miss = Object.keys(props).filter(k => !(props[k] > 0));
    if (shape === 'Ue' && !(d0.D > 0)) need.push('D');
    if (need.length || miss.length) geomWhy = `faltam dados da seção (${[...need.map(k => 'dims.' + k), ...miss].join(', ')}): NÃO verificada.`;
    else {
      const t = d0.t * 100;
      if (!(d0.ri >= 0)) avisos.push('ri não informado: adotado ri = t (NBR 6355:2012 Tab. A.3 para Ue; confirme para U simples).');
      g = { ue: shape === 'Ue', bw: d0.bw * 100, bf: d0.bf * 100, D: shape === 'Ue' ? d0.D * 100 : 0, t, ri: (d0.ri ?? d0.t) * 100,
        A, Ix: sec.Iz * 1e8, Iy: sec.Iy * 1e8, J: sec.J * 1e8, Cw: sec.Cw * 1e12, x0: sec.x0 * 100, xg: sec.xg > 0 ? sec.xg * 100 : null };
      g.rx = (sec.rz ?? Math.sqrt(sec.Iz / sec.A)) * 100; g.ry = (sec.ry ?? Math.sqrt(sec.Iy / sec.A)) * 100;
      g.r0 = sec.r0 > 0 ? sec.r0 * 100 : Math.sqrt(g.rx ** 2 + g.ry ** 2 + g.x0 ** 2);
      g.Wx = (sec.Sz > 0 ? sec.Sz * 1e6 : g.Ix / (g.bw / 2));
      // Tab. 4 (9.1.2) maximum b/t
      const c = g.t + g.ri, hw = g.bw - 2 * c;
      const lc = [], lf = [], both = [];
      if (hw / g.t > 200) lf.push(`alma h/t = ${(hw / g.t).toFixed(0)} > 200 (viga sem enrijecedor transversal)`);
      if (g.ue && hw / g.t > 500) lc.push(`alma b/t = ${(hw / g.t).toFixed(0)} > 500`);
      if (!g.ue && hw / g.t > 90) lc.push(`alma de U simples comprimida b/t = ${(hw / g.t).toFixed(0)} > 90`);
      if (g.ue) {
        const bF = g.bf - 2 * c, dL = g.D - c;
        const lp0 = (bF / g.t) / (0.623 * Math.sqrt(E / fy)), Is = g.t * dL ** 3 / 12;
        const Ia = lp0 > 0.673 ? Math.min(399 * g.t ** 4 * (0.487 * lp0 - 0.328) ** 3, g.t ** 4 * (56 * lp0 + 5)) : 0;
        const lim = Is >= Ia ? 90 : 60;
        if (bF / g.t > lim) both.push(`mesa b/t = ${(bF / g.t).toFixed(1)} > ${lim}`);
        if (dL / g.t > 60) both.push(`enrijecedor b/t = ${(dL / g.t).toFixed(1)} > 60`);
      } else if ((g.bf - c) / g.t > 60) both.push(`mesa (AL) b/t = ${((g.bf - c) / g.t).toFixed(1)} > 60`);
      const mk = (a) => a.length ? `Tab. 4 (9.1.2) excedida: ${a.join('; ')}.` : null;
      limComp = mk([...lc, ...both]); limFlex = mk([...lf, ...both]);
    }
  }
  const why0 = geomWhy || null;                                  // blocks everything
  const whyC = why0 || limComp, whyF = why0 || limFlex;           // compression / bending-shear
  if (why0 && (N < 0 || Mz > 0 || My > 0 || Vy > 0 || Vz > 0)) avisos.push(`NBR 14762: ${why0}`);

  const warnUnv = (D, lbl, why) => { if (D > 0 && why) avisos.push(`${lbl}: NÃO verificado — ${why}`); };

  // global buckling quantities (cm, kN) ----------------------------------------------
  const glob = (g_) => {
    const Nex = PI2 * E * g_.Ix / (Lx * Lx), Ney = PI2 * E * g_.Iy / (Ly * Ly);
    const Nez = (PI2 * E * g_.Cw / (Lt * Lt) + G * g_.J) / (g_.r0 * g_.r0);
    const f = 1 - (g_.x0 / g_.r0) ** 2;
    const s = Nex + Nez;
    const Nexz = (s / (2 * f)) * (1 - Math.sqrt(Math.max(0, 1 - 4 * Nex * Nez * f / (s * s))));   // 9.7.2.2 (x = symmetry axis)
    const Ne = Math.min(Ney, Nexz);
    return { Nex, Ney, Nez, Nexz, Ne, modo: Ne === Ney ? 'flexão em y' : 'flexo-torção' };
  };


  // ── single angle in bending (review 15/10/2026 — engenheiro de aço): principal axes, 9.9 summed ──────────────────
  // NBR 14762 x/y are PRINCIPAL axes (9.7.2.1): the geometric Mz/My are projected on axis 1 (symmetry, I1) and 2 (I2):
  // M1 = (−Mz + My)/√2, M2 = (Mz + My)/√2 in the section plane (Xs = −z, Ys = y). The design forces come as magnitudes,
  // so every sign combination is checked: |M1|, |M2| ∈ {(|Mz| + |My|)/√2, ||Mz| − |My||/√2} and both senses of M2
  // (leg tips or heel compressed) — the worst governs.
  //   M1 (about the axis of symmetry): yield 9.8.2.1 with Wef (MLE) and FLT 9.8.2.2, Me = Cb·r0·√(Ney·Nez) =
  //      Cb·√(Ney·G·J) (Cw = 0, r0 cancels), Ney with I2.
  //   M2 (⊥ to the symmetry axis): yield with Wef and the Anexo E, Me = (Cs·Nex/Cm)·[j + Cs·√(j² + G·J/Nex)],
  //      Nex with I1, j = a/√2 (general j of E.2.1 integrated on the mid-line of an equal-leg angle, a = B − t/2),
  //      Cs = −1 with the tips compressed (low Me: torsional mode of the thin angle), +1 with the heel compressed.
  //   Legs: AL elements of Tab. 6 (case d, σ1 at the free edge; case c, σ1 at the support) on the flat width
  //   b = B − (t + ri), effective section iterated (centroid shift), product of inertia of the effective section
  //   neglected (declared). Shear of the legs: 9.8.3 is written for webs — LACUNA.
  const angleFlex = () => {
    const t = gL.t, B = gL.B, xg = gL.xg, a = B - t / 2, c = xg - t / 2, s0 = gL.t + gL.ri - t / 2, s1 = a, r2 = Math.SQRT1_2;
    const uOf = (X, Y) => [(X + Y) * r2, (-X + Y) * r2];                 // (u1, u2): u1 along the symmetry axis
    const legs = [{ d: [1, 0], n: [0, 1] }, { d: [0, 1], n: [1, 0] }];  // horizontal / vertical leg (X, Y) and its normal
    const P = (leg, s, off = 0) => uOf(-c + leg.d[0] * s + leg.n[0] * off, -c + leg.d[1] * s + leg.n[1] * off);
    const corners = [[-xg, -xg], [-xg, B - xg], [t - xg, B - xg], [t - xg, t - xg], [B - xg, t - xg], [B - xg, -xg]].map(([X, Y]) => uOf(X, Y));
    const tipCorners = [[4, 5], [1, 2]];                                // corner indices at the tip of leg 0 / leg 1
    const Ig = { 1: gL.I1, 2: gL.I2 }, k = { 1: 1, 2: 0 };             // axis 1: stress ∝ u2; axis 2: stress ∝ u1
    // effective section for bending about `ax`, sgn = +1 compresses the positive coordinate side; sigRef applied to the
    // fibre with the largest distance among the compressed ones (mode 'stab') or all (mode 'yield')
    // effective section for bending about principal axis `ax` (1 or 2), sgn = +1 compresses the positive side of the
    // stress coordinate; sigRef applied at the fibre with the largest stress among the compressed ones (mode 'stab')
    // or among all (mode 'yield', 9.8.2.1). The effective section loses part of ONE leg (M1) and is no longer
    // symmetric: its product of inertia Iuv′ is kept and the stress is that of unsymmetric bending under the single
    // principal moment (review 16/10/2026: neglecting Iuv′ underestimated the compression stress about 2×).
    const eff = (ax, sgn, sigRef, mode) => {
      const ci = k[ax], oi = 1 - ci;
      let props = { e: [0, 0], Icc: Ig[ax], Ioo: Ig[ax === 1 ? 2 : 1], Ico: 0 }, gaps = [[], []], why = null, ref = 1, fibers = [];
      // stress factor per unit moment at u (positive = compression): σ/M = sgn·(Ioo·c′ − Ico·o′)/(Icc·Ioo − Ico²)
      const fOf = (u, pr) => sgn * (pr.Ioo * (u[ci] - pr.e[ci]) - pr.Ico * (u[oi] - pr.e[oi])) / (pr.Icc * pr.Ioo - pr.Ico * pr.Ico);
      const propsOf = (gp) => {          // gross principal-axis inertias minus the removed strips (own inertia tL³/12 along the leg)
        let dA = 0, S = [0, 0], dcc = 0, doo = 0, dco = 0;
        gp.forEach((gl, li) => gl.forEach(([p0, q0]) => {
          const L = q0 - p0, m = P(legs[li], s0 + (p0 + q0) / 2), d = uOf(legs[li].d[0], legs[li].d[1]), A_ = L * t, own = t * L ** 3 / 12;
          dA += A_; S[0] += A_ * m[0]; S[1] += A_ * m[1];
          dcc += A_ * m[ci] ** 2 + own * d[ci] ** 2; doo += A_ * m[oi] ** 2 + own * d[oi] ** 2; dco += A_ * m[ci] * m[oi] + own * d[ci] * d[oi];
        }));
        const A1 = gL.A - dA, e = [-S[0] / A1, -S[1] / A1];
        return { e, A1, Icc: props0.Icc - dcc - A1 * e[ci] ** 2, Ioo: props0.Ioo - doo - A1 * e[oi] ** 2, Ico: -dco - A1 * e[ci] * e[oi] };
      };
      const props0 = { ...props };
      for (let it = 0; it < 40; it++) {
        fibers = corners.filter((_, i) => !gaps.some((gl, li) => gl.some(([, q]) => q >= gL.b - 1e-9) && tipCorners[li].includes(i)));
        gaps.forEach((gl, li) => gl.forEach(([p0]) => { for (const off of [-t / 2, t / 2]) fibers.push(P(legs[li], s0 + p0, off)); }));
        const fs = fibers.map((u) => fOf(u, props));
        ref = mode === 'yield' ? Math.max(...fs.map(Math.abs)) : Math.max(...fs);
        const sigAt = (u) => sigRef * fOf(u, props) / ref;
        const ng = [];
        for (const leg of legs) {
          const r = effAL(gL.b, t, sigAt(P(leg, s0)), sigAt(P(leg, s1)), E);
          if (r.unverified) { why = r.unverified; break; }
          ng.push(r.gaps || []);
        }
        if (why) break;
        const np = propsOf(ng);
        const conv = Math.abs(np.e[0] - props.e[0]) + Math.abs(np.e[1] - props.e[1]) < 1e-7 && Math.abs(np.Ico - props.Ico) < 1e-9 && JSON.stringify(ng.map((g) => g.map(([a_, b_]) => [+a_.toFixed(6), +b_.toFixed(6)]))) === JSON.stringify(gaps.map((g) => g.map(([a_, b_]) => [+a_.toFixed(6), +b_.toFixed(6)])));
        props = np; gaps = ng;
        if (conv) break;
      }
      if (why) return { why };
      // final stresses with the converged section
      fibers = corners.filter((_, i) => !gaps.some((gl, li) => gl.some(([, q]) => q >= gL.b - 1e-9) && tipCorners[li].includes(i)));
      gaps.forEach((gl, li) => gl.forEach(([p0]) => { for (const off of [-t / 2, t / 2]) fibers.push(P(legs[li], s0 + p0, off)); }));
      const fs = fibers.map((u) => fOf(u, props));
      ref = mode === 'yield' ? Math.max(...fs.map(Math.abs)) : Math.max(...fs);
      return { W: 1 / ref, e: props.e, Ico: props.Ico, gaps };
    };
    const grossD = (ax, sgn) => Math.max(...corners.map((f) => sgn * f[k[ax]]));   // gross distance to the compressed fibre
    const L1 = Math.max(Lx, Ly, LbIn ? Lby : 0);
    const GJ = G * gL.J;
    const out = {};
    // M1 — yield + FLT (9.8.2.2)
    {
      const y = eff(1, 1, fy, 'yield'); if (y.why) return { why: `M1: ${y.why}` };
      const Ney = PI2 * E * gL.I2 / (L1 * L1), Me = Cb * Math.sqrt(Ney * GJ), Wc = Ig[1] / grossD(1, 1);
      const lam0 = Math.sqrt(Wc * fy / Me), chi = chiFLT(lam0);
      const st = eff(1, 1, chi * fy, 'stab'); if (st.why) return { why: `M1: ${st.why}` };
      out.m1 = { Wef: y.W, MRdEsc: y.W * fy / gamF, Me, lambda0: lam0, chiFLT: chi, WcEf: st.W, MRdFLT: chi * st.W * fy / gamF };
      out.m1.MRd = Math.min(out.m1.MRdEsc, out.m1.MRdFLT);
    }
    // M2 — yield + Anexo E, both senses
    const Nex = PI2 * E * gL.I1 / (L1 * L1), j = a * r2;
    for (const [key, sgn, Cs] of [['pontas', 1, -1], ['quina', -1, 1]]) {
      const y = eff(2, sgn, fy, 'yield'); if (y.why) return { why: `M2 (${key} comprimida(s)): ${y.why}` };
      const Me = (Cs * Nex / Cm) * (j + Cs * Math.sqrt(j * j + GJ / Nex)), Wc = Ig[2] / grossD(2, sgn);
      if (!(Me > 0)) return { why: `M2 (${key}): Me do Anexo E ≤ 0.` };
      const lam0 = Math.sqrt(Wc * fy / Me), chi = chiFLT(lam0);
      const st = eff(2, sgn, chi * fy, 'stab'); if (st.why) return { why: `M2 (${key} comprimida(s)): ${st.why}` };
      out[key] = { Wef: y.W, MRdEsc: y.W * fy / gamF, Me, Cs, j, lambda0: lam0, chiFLT: chi, WcEf: st.W, MRdFLT: chi * st.W * fy / gamF };
      out[key].MRd = Math.min(out[key].MRdEsc, out[key].MRdFLT);
    }
    // governing combination of signs
    const A1 = (Mz + My) * r2, A2 = Math.abs(Mz - My) * r2;
    let gov = null;
    for (const [m1, m2] of [[A1, A2], [A2, A1]]) for (const key of ['pontas', 'quina']) {
      const r = m1 / out.m1.MRd + m2 / out[key].MRd;
      if (!gov || r > gov.r) gov = { r, m1, m2, key };
    }
    out.gov = gov; out.L1 = L1;
    return out;
  };

  const solve = (gg, EE, cfg) => { const r = solveEff(gg, EE, cfg); if (r.naoConvergiu) avisos.push(`Seção efetiva (${cfg.axis}, ${cfg.mode || 'N'}): iteração do centroide efetivo não convergiu — resultado aproximado.`); return r; };

  // ── 9.6 tension / 9.7 compression ───────────────────────────────────────────────
  let axial, NRd = 0;
  // 9.7.4 / 9.6.3: built-up members use the slenderness of the WHOLE member (options._lamConj, from checkComposite14762)
  const lamHard = options._lamConj ?? (isCh && g ? Math.max(Lx / g.rx, Ly / g.ry) : isL && gL ? Math.max(Lx, Ly) / gL.r2 : 0);

  // single angle in compression (9.7.2.2, monosymmetric, x = axis of symmetry = principal axis 1; Cw = 0 Tab. A.1).
  // Principal axes are inclined to the member axes: one length Lp = max(Lx, Ly) for both flexural modes (declared).
  const angleComp = () => {
    const Lp = Math.max(Lx, Ly);
    const Ne1 = PI2 * E * gL.I1 / (Lp * Lp), Ne2 = PI2 * E * gL.I2 / (Lp * Lp), Nez = G * gL.J / (gL.r0 * gL.r0);
    const f = 1 - (gL.x0 / gL.r0) ** 2, s = Ne1 + Nez;
    const Ne1z = (s / (2 * f)) * (1 - Math.sqrt(Math.max(0, 1 - 4 * Ne1 * Nez * f / (s * s))));
    const Ne = Math.min(Ne2, Ne1z), lambda0 = Math.sqrt(A * fy / Ne), chi = chiComp(lambda0);
    const e = effAL(gL.b, gL.t, chi * fy, chi * fy, E);                                // uniform: Tab. 6 a, k = 0,43
    const Aef = A - 2 * gL.t * e.gaps.reduce((a, [p, q]) => a + q - p, 0);
    avisos.push('Cantoneira: força axial CENTRADA — a excentricidade da ligação por uma aba não é considerada (NBR 14762 omissa); verifique-a à parte (p.ex. NBR 8800:2024 5.3.5.4 ou ensaio), pode reduzir Nc,Rd de forma significativa.');
    if (Math.abs(Lx - Ly) > 1e-6) avisos.push(`Cantoneira: eixos principais inclinados em relação aos locais — adotado KL = max(Lx, Ly) = ${(Lp / 100).toFixed(2).replace('.', ',')} m nos dois modos de flexão.`);
    return { Ne, lambda0, chi, Aef, NcRd: chi * Aef * fy / gamC,
      info: { chi: +chi.toFixed(4), lambda0: +lambda0.toFixed(4), Ne: fix(Ne), Ne1: fix(Ne1), Ne2: fix(Ne2), Nez: fix(Nez), Ne1z: fix(Ne1z),
        modoGlobal: Ne === Ne2 ? 'flexão em torno do eixo principal menor (2)' : 'flexo-torção (eixo 1 + torção)',
        esbeltez: { principal2: +(Lp / gL.r2).toFixed(2), limite: 200 }, lambdaP: e.lp != null ? +e.lp.toFixed(4) : undefined,
        Aef: Aef / 1e4, NcRdGlobal: fix(chi * Aef * fy / gamC) } };
  };
  if (N >= 0) {
    NRd = A * fy / gamT;
    axial = ratObj(Nabs, NRd, { modo: 'tração', formula: 'Nt,Rd = A·fy/1,10 (9.6.2 a)' });
    const sl = member.secaoLiquida, fu = (mat.Fu || 0) / 1e4;
    if (sl && (sl.An0 > 0 || sl.An > 0)) {
      const cand = [{ v: NRd, f: 'Nt,Rd = A·fy/1,10 (9.6.2 a)' }];
      if (!(fu > 0)) avisos.push('Tração: seção líquida informada sem fu no material — 9.6.2 b/c NÃO verificadas.');
      else {
        if (sl.An0 > 0) cand.push({ v: Math.min(sl.An0 * 1e4, A) * fu / 1.35, f: 'Nt,Rd = An0·fu/1,35 (9.6.2 b)' });
        if (sl.An > 0) {
          const xcm = sl.x != null ? sl.x * 100 : (isCh && g && sl.ligacao && !sl.todosConectados && sl.conexao !== 'mesas' ? g.xg : undefined);
          const ct = ctPerfil14762({ ...sl, x: xcm, Lc: sl.Lc != null ? sl.Lc * 100 : undefined, d: sl.d != null ? sl.d * 100 : undefined, g: sl.g != null ? sl.g * 100 : undefined });
          if (ct.erro) { axial.ratio = Infinity; axial.verificado = false; avisos.push(`Tração 9.6.2 c: ${ct.erro} — NÃO verificada.`); }
          else {
            cand.push({ v: ct.Ct * Math.min(sl.An * 1e4, A) * fu / 1.65, f: `Nt,Rd = Ct·An·fu/1,65 (9.6.2 c), Ct = ${ct.Ct.toFixed(3)} (${ct.ref})`, Ct: ct.Ct });
            if (sl.x == null && xcm != null) avisos.push(`Tração 9.6.2 c: x = xg = ${xcm.toFixed(2)} cm (U ligado pela alma; ligado pelas mesas, 9.6.2 manda usar duas cantoneiras fictícias — informe x).`);
          }
        }
        const gov = cand.reduce((a, b) => b.v < a.v ? b : a);
        if (axial.ratio !== Infinity) { NRd = gov.v; axial = ratObj(Nabs, NRd, { modo: gov === cand[0] ? 'tração' : 'tração (seção líquida)', formula: gov.f, ...(gov.Ct != null ? { Ct: gov.Ct } : {}) }); }
      }
    } else if (Nabs > 0) avisos.push('Tração: ruptura da seção líquida (9.6.2 b/c, Ct) não verificada — informe member.secaoLiquida (An0 e/ou An + ligação).');
    if (!isCh && !isL) avisos.push(`Seção "${shape}": tração só por escoamento da seção bruta.`);
    if (Nabs > 0 && !semLc && lamHard > 300) avisos.push(`Tração: L/r = ${lamHard.toFixed(0)} > 300 — recomenda-se L/r ≤ 300 (NBR 14762:2010 9.6.3).`);
  } else {
    let why = whyC, det = {};
    if (!why && semLc) why = 'comprimento da barra não informado (flambagem global).';
    if (!why && isL) { det = angleComp(); }
    else if (!why) {
      const gb = glob(g);
      const lambda0 = Math.sqrt(A * fy / gb.Ne), chi = chiComp(lambda0);
      const ef = solve(g, E, { axis: 'N', sigma: chi * fy });
      det = { ...gb, lambda0, chi, sigmaChiFy: chi * fy };
      if (ef.unverified) why = ef.unverified;
      else {
        det.Aef = ef.Aef;
        det.NcRdGlobal = chi * ef.Aef * fy / gamC;
        // 9.7.3 distorcional
        const dist = { };
        if (!g.ue) { dist.dispensada = true; dist.motivo = '9.3: U simples não sofre flambagem distorcional'; }
        else {
          const dmin = dminTabela(11, g.bf / g.bw, g.bw / g.t);
          dist.Dmin_bw = dmin; dist.D_bw = g.D / g.bw;
          dist.dispensada = dmin != null && g.D / g.bw >= dmin;
          if (!dist.dispensada && dmin == null) dist.motivo = `Tab. 11 não cobre bw/t = ${(g.bw / g.t).toFixed(1)} / bf/bw = ${(g.bf / g.bw).toFixed(2)}`;
        }
        det.dist = dist;
        if (dist.dispensada) det.NcRd = det.NcRdGlobal;
        else {
          const fs = options.Ndist > 0 || options.fsm === false ? null : fsmChannel(g, E);
          const Nd = options.Ndist > 0 ? options.Ndist : fs?.Ndist;
          if (Nd > 0) {
            const ld = Math.sqrt(A * fy / Nd), cd = chiDistN(ld);
            Object.assign(dist, { Ndist: +Nd.toFixed(3), fonte: options.Ndist > 0 ? 'informado' : 'faixas finitas', lambdaDist: ld, chiDist: cd, NcRdDist: cd * A * fy / gamC });
            det.NcRd = Math.min(det.NcRdGlobal, dist.NcRdDist);
            if (fs) avisos.push(`Ndist = ${Nd.toFixed(1).replace('.', ',')} kN (meia-onda ${(fs.aNdist / 10).toFixed(1).replace('.', ',')} cm) por ${FSM_NOTE} — 9.7.3.`);
          } else why = `flambagem distorcional não dispensada (${dist.motivo || 'D/bw abaixo da Tab. 11'}): Ndist não informado e o mínimo distorcional da curva de assinatura (faixas finitas) não é distinto — informe options.Ndist (9.7.3).`;
        }
      }
    }
    // Anexo C (MRD): replaces 9.7 when options.metodo = 'MRD' (Nℓ, Ndist by FSM unless given)
    if (!why && options.metodo === 'MRD' && det.Ne > 0 && isCh) {
      const fsC = options.fsm === false ? null : fsmChannel(g, E);
      const Nl = options.Nl > 0 ? options.Nl : fsC?.Nl, Nd = g.ue ? (options.Ndist > 0 ? options.Ndist : fsC?.Ndist) : null;
      if (!(Nl > 0) || (g.ue && !(Nd > 0))) why = 'MRD (Anexo C): Nℓ/Ndist não disponíveis (informe options.Nl/Ndist).';
      else {
        const m = mrdCompressao14762({ A, fy, Ne: det.Ne, Nl, Ndist: Nd });
        det.mrd = m; det.NcRd = m.NcRk / gamC;
        avisos.push(`Compressão pelo MRD (Anexo C): Nℓ = ${Nl.toFixed(1)} kN${Nd ? `, Ndist = ${Nd.toFixed(1)} kN` : ''}${fsC ? ` (${FSM_NOTE})` : ''}; Nc,Rk = min(Nc,Re ${m.NcRe.toFixed(1)}; Nc,Rℓ ${m.NcRl.toFixed(1)}; Nc,Rdist ${isFinite(m.NcRdist) ? m.NcRdist.toFixed(1) : '—'}) kN.`);
      }
    }
    if (!why && lamHard > 200) why = `KL/r = ${lamHard.toFixed(0)} > 200 (9.7.4): os valores calculados ficam em axial.* apenas como informação.`;
    const info = det.Ne == null ? {} : isL ? det.info : { chi: +det.chi.toFixed(4), lambda0: +det.lambda0.toFixed(4), Ne: fix(det.Ne),
      Nex: fix(det.Nex), Ney: fix(det.Ney), Nez: fix(det.Nez), Nexz: fix(det.Nexz), modoGlobal: det.modo,
      esbeltez: { x: +(Lx / g.rx).toFixed(2), y: +(Ly / g.ry).toFixed(2), limite: 200 },
      Aef: det.Aef != null ? det.Aef / 1e4 : undefined, NcRdGlobal: det.NcRdGlobal != null ? fix(det.NcRdGlobal) : undefined, distorcional: det.dist };
    if (why) { axial = unverified(Nabs, why, { modo: 'compressão', ...info }); warnUnv(Nabs, 'Compressão', why); }
    else {
      NRd = det.NcRd;
      axial = ratObj(Nabs, NRd, { modo: 'compressão', ...info, ...(det.mrd ? { mrd: det.mrd } : {}),
        formula: isL ? 'Nc,Rd = χ·Aef·fy/1,20 (9.7.2); cantoneira: Ne = min(Ne2; Ne1z), Cw = 0; abas AL k = 0,43 (Tab. 6 a); λ0 = √(A·fy/Ne)'
          : det.mrd ? 'Nc,Rd = min(Nc,Re; Nc,Rℓ; Nc,Rdist)/1,20 (Anexo C, MRD)' : 'Nc,Rd = min(χ·Aef·fy/1,20 (9.7.2); χdist·A·fy/1,20 (9.7.3)); λ0 = √(A·fy/Ne), A bruta' });
    }
  }
  if (N < 0) avisos.push('Esforços devem vir de análise com 2ª ordem/imperfeições (NBR 14762:2010 8.1).');

  // ── 9.8.2 bending, strong axis (z; NBR x) ──────────────────────────────────────────
  const flexX = () => {
    if (whyF) return { why: whyF };
    if (semLf) return { why: 'comprimento da barra não informado (FLT).' };
    const out = {};
    const ye = solve(g, E, { axis: 'x', mode: 'yield', fy });
    if (ye.unverified) return { why: ye.unverified };
    out.Wef = ye.I / Math.max(ye.dc, ye.dt); out.Ief = ye.I; out.MRdEsc = out.Wef * fy / gamF;
    // FLT 9.8.2.2: Me = Cb·r0·√(Ney·Nez), KyLy = Ly, KzLz = Lz → unbraced lengths
    const Ney = PI2 * E * g.Iy / (Lby * Lby), Nez = (PI2 * E * g.Cw / (Lbz * Lbz) + G * g.J) / (g.r0 * g.r0);
    const Me = Cb * g.r0 * Math.sqrt(Ney * Nez);
    const lam0 = Math.sqrt(g.Wx * fy / Me), chi = chiFLT(lam0);
    const se = solve(g, E, { axis: 'x', mode: 'stab', sigma: chi * fy });
    if (se.unverified) return { why: se.unverified };
    out.Me = Me; out.lambda0 = lam0; out.chiFLT = chi; out.WcEf = se.I / se.dc; out.MRdFLT = chi * out.WcEf * fy / gamF;
    // Anexo F: tension flange connected to a panel (purlin + steel sheeting under suction) — replaces the FLT above
    const pf = member.painelMesaTracionada;
    if (pf) {
      const cfg = typeof pf === 'object' ? pf : {};
      const bwmm = g.bw * 10, b = g.bf - 2 * g.t - 2 * g.ri;                       // b: flat width of the flange (cm)
      const falhas = [];
      if (!g.ue) falhas.push('a) mesas sem enrijecedor de borda');
      if (!(bwmm <= 292 + 1e-9)) falhas.push(`b) bw = ${bwmm.toFixed(0)} mm > 292`);
      if (!(g.bw / g.t >= 60 && g.bw / g.t <= 170)) falhas.push(`c) bw/t = ${(g.bw / g.t).toFixed(1)} fora de 60–170`);
      if (!(g.bw / g.bf >= 2.8 && g.bw / g.bf <= 4.5)) falhas.push(`d) bw/bf = ${(g.bw / g.bf).toFixed(2)} fora de 2,8–4,5`);
      if (!(b / g.t >= 16 && b / g.t <= 43)) falhas.push(`e) b/t = ${(b / g.t).toFixed(1)} fora de 16–43`);
      if (!(L < 1000)) falhas.push(`g) vão ${(L / 100).toFixed(2)} m ≥ 10 m`);
      if (!(fy <= 41.0 + 1e-9)) falhas.push(`m) fy = ${(fy * 10).toFixed(0)} MPa > 410`);
      if (falhas.length) {
        avisos.push(`Anexo F não aplicável (${falhas.join('; ')}): FLT pela 9.8.2.2 com a mesa comprimida livre (F.2).`);
      } else {
        const R = cfg.continua ? 0.60 : bwmm <= 165 ? 0.70 : bwmm <= 216 ? 0.65 : 0.40;       // Tab. F.1, seção U
        out.anexoF = { R, continua: !!cfg.continua };
        out.MRdFLT = R * out.Wef * fy / gamF; out.chiFLT = null; out.lambda0 = null;
        avisos.push(`Anexo F (painel na mesa tracionada): MRd = R·Wef·fy/1,10 com R = ${String(R).replace('.', ',')} (Tab. F.1, U ${cfg.continua ? 'contínua' : 'biapoiada'}), no lugar da FLT. Premissas do usuário: f) traspasse ≥ 1,5·bw nos apoios internos (contínua; vãos adjacentes com razão ≤ 1,2), h) mesas travadas lateralmente nos apoios, i) telha de aço ≥ 0,45 mm, altura ≥ 25 mm, nervuras a ≤ 300 mm, j–l) parafusos ≥ 5,5 mm (ou rebites 4,75 mm) com arruela 12,5 mm a ≤ 300 mm, perto do centro da mesa; F.4: não vale em balanços nem entre ponto de inflexão e apoio interno.`);
      }
    }
    // distorcional 9.8.2.3
    const dist = {};
    if (!g.ue) { dist.dispensada = true; dist.motivo = '9.3: U simples não sofre flambagem distorcional'; }
    else {
      const dmin = dminTabela(14, g.bf / g.bw, g.bw / g.t);
      dist.Dmin_bw = dmin; dist.D_bw = g.D / g.bw; dist.dispensada = dmin != null && g.D / g.bw >= dmin;
      if (!dist.dispensada && dmin == null) dist.motivo = `Tab. 14 não cobre bw/t = ${(g.bw / g.t).toFixed(1)} / bf/bw = ${(g.bf / g.bw).toFixed(2)}`;
    }
    out.dist = dist;
    let MRd = Math.min(out.MRdEsc, out.MRdFLT);
    if (!dist.dispensada) {
      const fsM = options.Mdist > 0 || options.fsm === false ? null : fsmChannel(g, E);
      const MdIn = options.Mdist > 0 ? options.Mdist : (fsM?.Mdist > 0 ? fsM.Mdist / 100 : null);   // kN·m
      if (fsM && MdIn) avisos.push(`Mdist = ${MdIn.toFixed(2).replace('.', ',')} kN·m (meia-onda ${(fsM.aMdist / 10).toFixed(1).replace('.', ',')} cm) por ${FSM_NOTE} — 9.8.2.3.`);
      if (MdIn > 0) {
        const Md = MdIn * 100, ld = Math.sqrt(g.Wx * fy / Md), cd = chiDistM(ld);
        Object.assign(dist, { Mdist: +MdIn.toFixed(4), fonte: options.Mdist > 0 ? 'informado' : 'faixas finitas', lambdaDist: ld, chiDist: cd });
        out.MRdDist = cd * g.Wx * fy / gamF; MRd = Math.min(MRd, out.MRdDist);
      } else return { ...out, why: `flambagem distorcional não dispensada (${dist.motivo || 'D/bw abaixo da Tab. 14'}): Mdist não informado e o mínimo distorcional (faixas finitas) não é distinto — informe options.Mdist (9.8.2.3).` };
    }
    out.MRd = MRd;
    out.ramo = MRd === out.MRdEsc ? 'escoamento (9.8.2.1)' : MRd === out.MRdFLT ? (out.anexoF ? 'painel na mesa tracionada (Anexo F)' : 'FLT (9.8.2.2)') : 'distorcional (9.8.2.3)';
    return out;
  };

  // ── weak axis (y): one sense ('alma' | 'mesas'), Anexo E ────────────────────────────
  const flexYsense = (comp) => {
    const out = { comp };
    const ye = solve(g, E, { axis: 'y', comp, mode: 'yield', fy });
    if (ye.unverified) return { ...out, why: `sentido ${comp}: ${ye.unverified}` };
    out.Wef = ye.I / Math.max(ye.dc, ye.dt); out.Ief = ye.I; out.MRdEsc = out.Wef * fy / gamF;
    const Wc = g.Iy / (comp === 'alma' ? g.xg : g.bf - g.xg);
    const Cs = comp === 'alma' ? 1 : -1;                                                // Cs = +1: compression on the shear-centre side (web)
    const Nex = PI2 * E * g.Ix / (Lx * Lx), Nez = (PI2 * E * g.Cw / (Lt * Lt) + G * g.J) / (g.r0 * g.r0);
    const ae = anexoEj(g);
    const Me = (Cs * Nex / Cm) * (ae.j + Cs * Math.sqrt(ae.j * ae.j + g.r0 * g.r0 * Nez / Nex));
    out.j = ae.j; out.Cs = Cs; out.Cm = Cm; out.Me = Me; out.Wc = Wc;
    if (!(Me > 0)) return { ...out, why: `sentido ${comp}: Me do Anexo E ≤ 0 (${fix(Me)}).` };
    const lam0 = Math.sqrt(Wc * fy / Me), chi = chiFLT(lam0);
    const se = solve(g, E, { axis: 'y', comp, mode: 'stab', sigma: chi * fy });
    if (se.unverified) return { ...out, why: `sentido ${comp}: ${se.unverified}` };
    out.lambda0 = lam0; out.chiFLT = chi; out.WcEf = se.I / se.dc; out.MRdFLT = chi * out.WcEf * fy / gamF;
    let MRd = Math.min(out.MRdEsc, out.MRdFLT);
    if (g.ue) {                                                                         // 9.8.2.3: Tab. 14 só vale para o eixo de maior inércia
      if (options.MdistY > 0) {
        const Wd = g.Iy / Math.max(g.xg, g.bf - g.xg), ld = Math.sqrt(Wd * fy / (options.MdistY * 100)), cd = chiDistM(ld);
        out.MRdDist = cd * Wd * fy / gamF; MRd = Math.min(MRd, out.MRdDist);
      } else return { ...out, why: `sentido ${comp}: flambagem distorcional do Ue em torno do eixo y não é dispensada pela Tab. 14 e options.MdistY não informado (9.8.2.3 — LACUNA).` };
    }
    out.MRd = MRd;
    out.ramo = MRd === out.MRdEsc ? 'escoamento (9.8.2.1)' : MRd === out.MRdFLT ? 'FLT (Anexo E)' : 'distorcional';
    return out;
  };
  const flexY = () => {
    if (whyF) return { why: whyF };
    if (g.xg == null) return { why: 'xg (centroide a partir da face da alma) não informado: flexão em torno de y NÃO verificada.' };
    if (semLf) return { why: 'comprimento da barra não informado (FLT).' };
    const senses = options.sentidoMy ? [options.sentidoMy] : ['alma', 'mesas'];
    const rs = senses.map(flexYsense), bad = rs.find(r => r.why);
    if (bad) return { ...bad, why: bad.why + (options.sentidoMy ? '' : ' (sentido de My desconhecido: informe options.sentidoMy)') };
    return rs.reduce((a, b) => b.MRd < a.MRd ? b : a);
  };

  const fx = isL ? {} : flexX(), fyr = isL ? {} : flexY();
  const angF = isL && gL && !whyF && (Mz > 0 || My > 0) ? angleFlex() : null;
  // Anexo C (MRD) for strong-axis bending: replaces 9.8.2 (C.1); with the Anexo F declared, the smaller governs
  if (options.metodo === 'MRD' && isCh && g && !fx.why && fx.Me > 0) {
    const fsF = options.fsm === false ? null : fsmChannel(g, E);
    const Ml = options.Ml > 0 ? options.Ml * 100 : fsF?.Ml, Md = g.ue ? (options.Mdist > 0 ? options.Mdist * 100 : fsF?.Mdist) : null;   // kN·cm
    if (Ml > 0 && (!g.ue || Md > 0)) {
      const m = mrdFlexao14762({ W: g.Wx, fy, Me: fx.Me, Ml, Mdist: Md });
      const MRdC = m.MRk / gamF;
      fx.mrd = m;
      if (!(fx.anexoF && fx.MRdFLT < MRdC)) { fx.MRd = MRdC; fx.ramo = 'MRD (Anexo C)'; }
      avisos.push(`Flexão pelo MRD (Anexo C): Mℓ = ${(Ml / 100).toFixed(2)} kN·m${Md ? `, Mdist = ${(Md / 100).toFixed(2)} kN·m` : ''}${fsF ? ` (${FSM_NOTE})` : ''}; MRk = min(MRe ${(m.MRe / 100).toFixed(2)}; MRℓ ${(m.MRl / 100).toFixed(2)}; MRdist ${isFinite(m.MRdist) ? (m.MRdist / 100).toFixed(2) : '—'}) kN·m.`);
    } else avisos.push('MRD (Anexo C) na flexão: Mℓ/Mdist não disponíveis — mantido 9.8.2.');
  }
  const mkFlex = (f, D, eixo) => {
    if (f.why) { warnUnv(D, `Flexão ${eixo}`, f.why); return unverified(D / 100, f.why, { eixo }); }
    const { MRd, why, ...rest } = f;
    const o = { eixo, ramo: f.ramo, ...rest };
    for (const k of ['Wef', 'WcEf', 'Wc']) if (o[k] != null) o[k] = o[k] / 1e6;       // m³
    for (const k of ['Me', 'MRdEsc', 'MRdFLT', 'MRdDist']) if (o[k] != null) o[k] = o[k] / 100;  // kN·m
    delete o.Ief;
    return ratObj(D / 100, MRd / 100, o);
  };
  let flexaoX, flexaoY;
  if (isL) {
    const whyA = whyF || angF?.why;
    if (whyA) { flexaoX = unverified(Mz / 100, whyA, { eixo: 'principal 1' }); flexaoY = unverified(My / 100, whyA, { eixo: 'principal 2' }); warnUnv(Mz + My, 'Flexão (cantoneira)', whyA); }
    else if (!angF) { flexaoX = ratObj(0, 0, { eixo: 'principal 1 (simetria)' }); flexaoY = ratObj(0, 0, { eixo: 'principal 2' }); flexaoX.ratio = 0; flexaoY.ratio = 0; }
    else {
      const g2 = angF.gov, k2 = angF[g2.key], kN = (v) => +(v / 100).toFixed(6);
      const det = (o) => ({ Wef: o.Wef / 1e6, MRdEsc: kN(o.MRdEsc), Me: kN(o.Me), lambda0: +o.lambda0.toFixed(4), chiFLT: +o.chiFLT.toFixed(4), WcEf: o.WcEf / 1e6, MRdFLT: kN(o.MRdFLT) });
      flexaoX = ratObj(g2.m1 / 100, angF.m1.MRd / 100, { eixo: 'principal 1 (simetria, I1)', ramo: angF.m1.MRd === angF.m1.MRdEsc ? 'escoamento (9.8.2.1)' : 'FLT (9.8.2.2)', ...det(angF.m1),
        formula: 'M1Rd = min(Wef·fy; χFLT·Wc,ef·fy)/1,10; Me = Cb·√(Ney·G·J) (9.8.2.2, Cw = 0)' });
      flexaoY = ratObj(g2.m2 / 100, k2.MRd / 100, { eixo: `principal 2 (I2), ${g2.key === 'pontas' ? 'pontas das abas' : 'quina'} comprimida(s)`, ramo: k2.MRd === k2.MRdEsc ? 'escoamento (9.8.2.1)' : 'FLT (Anexo E)', ...det(k2), Cs: k2.Cs, j: k2.j / 100,
        formula: 'M2Rd = min(Wef·fy; χFLT·Wc,ef·fy)/1,10; Me pelo Anexo E (j = a/√2, Cw = 0)' });
      avisos.push(`Cantoneira em flexão: Mz/My projetados nos eixos principais (|M1| = ${(g2.m1 / 100).toFixed(3).replace('.', ',')}, |M2| = ${(g2.m2 / 100).toFixed(3).replace('.', ',')} kN·m, combinação de sinais mais desfavorável — ${g2.key === 'pontas' ? 'pontas das abas' : 'quina'} comprimida(s) em M2); 9.9 somado nos eixos principais (interação linear; o acoplamento de M1 e M2 pela seção efetiva assimétrica não é considerado na combinação). Seção efetiva com o produto de inércia Iuv′ (flexão oblíqua). Me de 9.8.2.2/Anexo E vale com a carga no centro de torção (vértice) ou em posição estabilizante — carga aplicada numa aba não é coberta. Comprimento ${(angF.L1 / 100).toFixed(2).replace('.', ',')} m nos dois eixos.`);
    }
  } else {
    flexaoX = mkFlex(fx, Mz, 'forte (Mz = Msd,x)');
    flexaoY = mkFlex(fyr, My, 'fraco (My = Msd,y)');
    flexaoX.formula = 'MRd = min(Wef·fy/1,10; χFLT·Wc,ef·fy/1,10; χdist·W·fy/1,10) (9.8.2)';
    flexaoY.formula = 'MRd = min(Wef·fy/1,10; χFLT·Wc,ef·fy/1,10 [Anexo E]; χdist·W·fy/1,10) (9.8.2)';
  }

  // ── 9.8.3 shear / 9.8.4 M+V ─────────────────────────────────────────────────────────
  let corteY, corteZ, VRdY = null;
  // angle legs in shear: the NBR 14762 has no kv for an AL element (9.8.3 is for webs). By decision of the engineer
  // (Manoel, 16/10/2026) the NBR 8800:2024 5.4.3.4 is used as an EXTERNAL reference: procedure of 5.4.3.1.1 with
  // kv = 1,2, h = b (leg width) and tw = t; Aw = 2bt for the pair → b·t per angle, the leg parallel to V resisting;
  // γa1 = 1,10; b/t ≤ 260.
  const shearL = (V, dirTxt) => {
    const b = gL.B, t = gL.t, kv = 1.2, lam = b / t, lp = 1.10 * Math.sqrt(kv * E / fy), lr = 1.37 * Math.sqrt(kv * E / fy);
    const Vpl = 0.60 * b * t * fy, ga = 1.10;
    if (lam > 260) return unverified(V, `aba b/t = ${lam.toFixed(0)} > 260 (NBR 8800 5.4.3.4).`, { dir: dirTxt });
    const VRk = lam <= lp ? Vpl : lam <= lr ? (lp / lam) * Vpl : 1.24 * (lp / lam) ** 2 * Vpl;
    return ratObj(V, VRk / ga, { dir: dirTxt, regime: lam <= lp ? 'plastificação' : lam <= lr ? 'inelástico' : 'elástico', kv, ht: fix(lam), lp: fix(lp), lr: fix(lr),
      formula: 'VRd pela NBR 8800:2024 5.4.3.4 (referência externa à NBR 14762): kv = 1,2; h = b da aba; Aw = b·t; γa1 = 1,10' });
  };
  if (isL && gL && !whyF) {
    corteY = shearL(Vy, 'Vy (aba vertical)');
    if (Vy > 0 || Vz > 0) avisos.push('Cortante nas abas da cantoneira pela NBR 8800:2024 5.4.3.4 (kv = 1,2; Aw = b·t por cantoneira) — referência externa, escrita para duas cantoneiras formando T (aplicada à cantoneira isolada por decisão do engenheiro): a NBR 14762:2010 9.8.3 só trata alma; M + V (9.8.4) não verificada para cantoneira.');
  } else if (whyF || isL) corteY = unverified(Vy, whyF, { dir: isL ? 'V (aba)' : 'Vy (alma)' });
  else {
    const h = g.bw - 2 * (g.t + g.ri), sr = shearRd(h, g.t, fy, E, 5.0);
    VRdY = sr.V;
    corteY = ratObj(Vy, sr.V, { dir: 'Vy (alma)', regime: sr.regime, kv: 5.0, h: h / 100, ht: fix(sr.ht), lim108: fix(sr.l1), lim140: fix(sr.l2),
      formula: 'VRd (9.8.3), kv = 5,0, h = parte plana da alma, γ = 1,10' });
  }
  warnUnv(Vy, 'Cortante Vy', whyF);
  if (isL && gL && !whyF) corteZ = shearL(Vz, 'Vz (aba horizontal)');
  else if (isCh && g && !whyF && Vz > 0) {
    // shear parallel to the flanges of U / Ue (Manoel, 16/10/2026 — same decision as the angle legs): the NBR 14762:2010
    // 9.8.3 is written for webs; EXTERNAL reference NBR 8800:2024 5.4.3.5 (U bent about the axis perpendicular to the
    // flanges): procedure of 5.4.3.1.1 with kv = 1,2, tw = t, Vpl = 0,60·Aw·fy, γa1 = 1,10; as in 9.8.3 for the web
    // (h = flat width), h = FLAT flange width b = bf − (t + ri) and Aw = 2·b·t (revisor-calculo-nbr 16/10/2026: the safer of
    // the two readings — the 8800 text takes bf, 5–8 % higher). The lip of the Ue is ignored (conservative); no M + V for Vz
    // (5.4.3.5 does not require it); the shear is assumed introduced in the flanges (a web-only connection loads them
    // through the web and the corners — local distortion not checked). b/t ≤ 260 borrowed from 5.4.3.3/5.4.3.4.
    const t = g.t, b = g.bf - (t + g.ri), kv = 1.2, lam = b / t, lp = 1.10 * Math.sqrt(kv * E / fy), lr = 1.37 * Math.sqrt(kv * E / fy);
    const Vpl = 0.60 * 2 * b * t * fy, ga = 1.10;
    const VRk = lam <= lp ? Vpl : lam <= lr ? (lp / lam) * Vpl : 1.24 * (lp / lam) ** 2 * Vpl;
    corteZ = lam > 260 ? unverified(Vz, `mesa b/t = ${lam.toFixed(0)} > 260 (limite das NBR 8800 5.4.3.3/5.4.3.4, adotado).`, { dir: 'Vz (mesas)' })
      : ratObj(Vz, VRk / ga, { dir: 'Vz (mesas)', regime: lam <= lp ? 'plastificação' : lam <= lr ? 'inelástico' : 'elástico', kv, ht: fix(lam), lp: fix(lp), lr: fix(lr),
        formula: 'VRd pela NBR 8800:2024 5.4.3.5 (referência externa à NBR 14762): kv = 1,2; h = parte plana da mesa b = bf − (t + ri); tw = t; Aw = 2·b·t; γa1 = 1,10' });
    avisos.push('Cortante Vz (paralela às mesas) pela NBR 8800:2024 5.4.3.5 (kv = 1,2; h = parte plana da mesa, Aw = 2·b·t) — referência externa: a NBR 14762:2010 9.8.3 só trata alma; enrijecedor de borda do Ue desprezado; M + V não verificada para Vz; admite a força introduzida nas mesas (ligação só pela alma: distorção local não verificada).');
  } else {
    corteZ = Vz > 0 ? unverified(Vz, 'cortante paralelo às mesas (Vz): 9.8.3 trata só a(s) alma(s) — LACUNA.', { dir: 'Vz (mesas)' })
      : { demand: 0, capacity: 0, ratio: 0, dir: 'Vz (mesas)' };
    if (Vz > 0) avisos.push('Cortante Vz (mesas): NÃO verificado — 9.8.3 trata só a(s) alma(s) (LACUNA).');
  }

  // M + V (9.8.4): MRd of 9.8.2.1 (yield), no transverse stiffeners
  let rMV = 0, mvWhy = null;
  if (Mz > 0 && Vy > 0) {
    if (fx.why && fx.MRdEsc == null) mvWhy = fx.why; else if (VRdY == null) mvWhy = whyF;
    else { const x = Mz / fx.MRdEsc, y = Vy / VRdY; rMV = x * x + y * y; }
  }
  if (mvWhy) rMV = Infinity;
  const interactionMV = ratObj(rMV, 1, { adim: true, formula: '(MSd/MRd)² + (VSd/VRd)² ≤ 1,0 (9.8.4)', ...(mvWhy ? { verificado: false, motivo: mvWhy } : {}) });
  interactionMV.ratio = rMV === Infinity ? Infinity : +rMV.toFixed(4);

  // ── 9.9 N + M ──────────────────────────────────────────────────────────────────────
  let H = 0, i99Why = null;
  const nr = Nabs > 0 ? (axial.verificado === false ? (i99Why = axial.motivo, Infinity) : Nabs / NRd) : 0;
  const mx = isL ? (Mz + My > 0 ? (flexaoX.verificado === false ? (i99Why = i99Why || flexaoX.motivo, Infinity) : flexaoX.ratio) : 0)
    : Mz > 0 ? (flexaoX.verificado === false ? (i99Why = i99Why || flexaoX.motivo, Infinity) : (Mz / 100) / flexaoX.capacity) : 0;
  const my = isL ? (Mz + My > 0 && flexaoY.verificado !== false ? flexaoY.ratio : 0)
    : My > 0 ? (flexaoY.verificado === false ? (i99Why = i99Why || flexaoY.motivo, Infinity) : (My / 100) / flexaoY.capacity) : 0;
  H = nr + mx + my;
  const interaction99 = ratObj(H, 1, { adim: true, modo: axial.modo, parcelas: { N: nr, Mx: mx, My: my },
    formula: 'NSd/NRd + Mx,Sd/Mx,Rd + My,Sd/My,Rd ≤ 1,0 (9.9)', ...(i99Why ? { verificado: false, motivo: i99Why } : {}) });
  interaction99.ratio = H === Infinity ? Infinity : +H.toFixed(4);
  const interaction = interaction99.ratio >= interactionMV.ratio ? interaction99 : interactionMV;

  // shear lag (9.4) — only a flag
  if (Mz > 0 && g && member.L && L < 30 * g.bf) avisos.push('L < 30·bf0: shear lag (9.4, Tab. 7) NÃO verificado — aplica-se a vigas com forças concentradas.');
  if (shape === 'U' && Mz > 0) avisos.push('U simples: distorcional dispensada (9.3), exceto viga com painel ligado à mesa tracionada e mesa comprimida livre (Anexo F/bibliografia).');
  if (shape === 'Ue' && My > 0 && !options.sentidoMy) avisos.push('My: sentido (alma/mesas comprimidas) não informado — adotado o mínimo entre os dois.');

  if ((Mz > 0 || My > 0) && isCh) avisos.push('FLT (9.8.2.2): carga suposta no centro de torção ou em posição estabilizante; carga na mesa superior/alma de U/Ue (excêntrica ao centro de torção, torção induzida) NÃO coberta' + (member.painelMesaTracionada ? '' : ' — terça com telha na mesa tracionada: declare member.painelMesaTracionada (Anexo F)') + '.');
  const bending = flexaoX.ratio >= flexaoY.ratio ? flexaoX : flexaoY;
  let shear = corteY.ratio >= corteZ.ratio ? corteY : corteZ;
  if (Math.abs(demands.T || 0) > 1e-6) {
    avisos.push('Momento torçor ≠ 0: a NBR 14762:2010 não traz verificação de torção para seção aberta (LACUNA) — resultado NÃO verificado.');
    shear = { ratio: Infinity, demand: Math.abs(demands.T), capacity: 0, verificado: false, modo: 'torção', motivo: 'torção não coberta pela NBR 14762:2010 (LACUNA).' };
  }
  for (const nt of _alNotes) avisos.push(nt);
  return finalize({ material: 'aço formado a frio', metodo: 'ABNT NBR 14762:2010 (MLE)', axial, bending, shear, interaction,
    interaction99, interactionMV, flexaoX, flexaoY, corteY, corteZ, avisos }, options);
}

export const nbr14762 = {
  id: 'NBR14762:2010', family: 'steel', label: 'ABNT NBR 14762:2010 (formados a frio)',
  check: (input) => (/^2(L|U|Ue)$/.test(input?.sec?.shape) && (input.sec.arr === 'costas' || (input.sec.shape === '2L' && input.sec.arr === 'U'))
    ? checkComposite14762(input) : checkNBR14762(input)),
};

// ── BUILT-UP members "costas" (composite_cf.js: 2L, 2U, 2Ue) — 9.7.5, 9.6.3, 9.8.6 ──────────────────────────────────
// The NBR 14762:2010 gives no Ne, Me or Cw for a built-up section (Manual CBCA 2014, Anexo D p.158). v1 (review 15/10/2026):
//  • every kind: each profile ISOLATED with half the forces and the member lengths, capacities × 2 (Manual CBCA 2014
//    Anexo D §4.3/§4.7; apostila Wanderson/INBEC Mód. 05 p.117-122, 1st step). Lower bound: the connection only adds
//    restraint. Net section (member.secaoLiquida An, An0) is given for the WHOLE member.
//  • 2L in compression: also the COMPOSITE section (apostila Mód. 05 p.123-126, 2nd step) when 9.7.5 is met with the
//    presilha spacing l1 (member.presilhas = { l1 [m], tipo: 'presilha' | 'trelica' | 'tala' }). 9.7.2.2 with y = axis
//    of symmetry; shear centre at the intersection of the mid-lines of the horizontal legs (y0 = yg − t/2); Cw = 0 and
//    J = 2·J1 (AISC 360-16 E4 a, double angles: Fez = GJ/(Ag·r0²)). The apostila keeps only the flexural mode about x
//    (no Steiner); the flexural-torsional mode is required by 9.7.2.2 for a monosymmetric section and governs short
//    members. Nc,Rd = max(2 × isolated; composite). Talas: not covered by the NBR 14762 (EN 1993-1-1) → isolated only.
//  • 2L "U" (legs pointing inward): 2 × isolated only (E4 a covers back-to-back angles), 9.7.5 still applies.
//  • 2U / 2Ue: the composite I needs its Cw (flexural-torsional, FLT): LACUNA → 2 × isolated only. My (about the
//    vertical axis): each profile about its own weak axis with My/2, both senses (no composite action).
//    9.8.6 connection spacing smax = 2·g·FRd/(m·q) ≤ L/6, checked only with member.conexao = { s, g [m], FRd [kN], q [kN/m] };
//    q = REFERENCE load = 3 × the design distributed load (or the concentrated design load / its bearing length).
function checkComposite14762(input) {
  const { demands = {}, mat, sec, member = {}, options = {} } = input;
  const kind = sec.shape, base = cfSection(sec.base);
  if (!base) return checkNBR14762(input);
  const E = mat.E / 1e4, fy = mat.Fy / 1e4, G = (mat.G ?? 0.385 * mat.E) / 1e4;
  const Lx = (member.Lx ?? (member.Kz ?? member.K ?? 1) * (member.L || 1)) * 100;
  const Ly = (member.Ly ?? (member.Ky ?? member.K ?? 1) * (member.L || 1)) * 100;
  const semLc = (member.Ldefault || member.L == null) && member.Lx == null && member.Ly == null && member.Lz == null;
  const rz = sec.rz * 100, ry = sec.ry * 100, lamConj = Math.max(Lx / rz, Ly / ry);
  const r1 = (kind === '2L' ? (base.r2 ?? base.ry) : base.ry) * 100;                 // least radius of one profile (L: axis 2)
  const f2 = (v, d = 2) => (+v).toFixed(d).replace('.', ',');
  const half = (k) => (demands[k] || 0) / 2;
  const sl = member.secaoLiquida;
  const r = checkNBR14762({ demands: { ...demands, N: half('N'), Mz: half('Mz'), My: half('My'), Vy: half('Vy'), Vz: half('Vz') }, mat,
    sec: { ...base, dims: { ...base.dims }, coldFormed: true },
    member: { ...member, ...(sl ? { secaoLiquida: { ...sl, ...(sl.An > 0 ? { An: sl.An / 2 } : {}), ...(sl.An0 > 0 ? { An0: sl.An0 / 2 } : {}) } } : {}) },
    options: { ...options, sentidoMy: undefined, _lamConj: lamConj } });
  const seen = new Set();
  for (const k of ['axial', 'flexaoX', 'flexaoY', 'corteY', 'corteZ']) {
    const o = r[k]; if (!o || seen.has(o)) continue; seen.add(o);
    o.demand = fix(o.demand * 2); o.capacity = fix(o.capacity * 2); o.porPerfil = '2 × perfil isolado (metade dos esforços)';
  }
  const av = r.avisos, N = demands.N || 0, Nabs = Math.abs(N);
  av.unshift(`Composta ${sec.designacao || kind}: cada perfil isolado com metade dos esforços, capacidades × 2 (Manual CBCA 2014 Anexo D; apostila Wanderson/INBEC Mód. 05). 9.7.4/9.6.3 com a esbeltez do conjunto λmáx = ${f2(lamConj, 1)}.`);

  // 9.7.5 (compression) / 9.6.3 (tension): slenderness of one profile between presilhas
  const pr = member.presilhas || {}, l1 = pr.l1 > 0 ? pr.l1 * 100 : null, tipo = pr.tipo || 'presilha';
  const lim = tipo === 'trelica' ? lamConj : 0.5 * lamConj, l1max = lim * r1;
  let ok975 = false;
  if (N < 0) {
    if (tipo === 'tala') av.push('9.7.5: travejamento em quadro (talas) não é previsto pela NBR 14762:2010 (remete ao EN 1993-1-1) — LACUNA; adotado só o perfil isolado.');
    else if (l1 == null) {
      av.push(`9.7.5 NÃO VERIFICADO: espaçamento l1 das ${tipo === 'trelica' ? 'ligações do travejamento' : 'presilhas'} não informado. O resultado vale como DOIS PERFIS INDEPENDENTES (limite inferior); informe l1 e confira l1 ≤ l1,máx = ${f2(l1max / 100, 3)} m (λ1 = l1/r1 < ${tipo === 'trelica' ? '' : '0,5·'}λmáx,conj = ${f2(lim, 1)}, r1 = ${f2(r1)} cm).`);
      r.condicionado = '9.7.5 não verificado (l1 não informado): resultado de dois perfis independentes';
    }
    else {
      const lam1 = l1 / r1; ok975 = lam1 < lim;
      if (!ok975) r.condicionado = '9.7.5 não atendido: resultado de dois perfis independentes';
      av.push(`9.7.5 ${ok975 ? 'atendido' : 'NÃO atendido'}: λ1 = l1/r1 = ${f2(l1)}/${f2(r1)} = ${f2(lam1, 1)} ${ok975 ? '<' : '≥'} ${tipo === 'trelica' ? 'λmáx,conj' : '0,5·λmáx,conj'} = ${f2(lim, 1)} (l1,máx = ${f2(l1max / 100, 3)} m)${ok975 ? '' : ' — a barra NÃO pode ser tratada como composta; vale só o perfil isolado'}.${tipo === 'trelica' ? ' Barras do travejamento: λ < 140 não verificado aqui.' : ''}`);
    }
  } else if (N > 0 && l1 != null && l1 / r1 > 300) av.push(`Tração: l1/r1 = ${f2(l1 / r1, 0)} > 300 — recomenda-se ≤ 300 para cada perfil componente (9.6.3).`);

  // 2L composite section in compression
  if (kind === '2L' && sec.arr === 'U' && N < 0) av.push('2L em U: seção composta NÃO considerada (a flexo-torção com Cw = 0 do AISC 360-16 E4 é para cantoneiras de costas) — vale 2 × perfil isolado.');
  if (kind === '2L' && sec.arr === 'costas' && N < 0 && ok975 && !semLc && r.axial && r.axial.verificado !== false && base.I1 > 0) {
    const t = base.dims.t * 100, ri = (base.dims.ri ?? base.dims.t) * 100, b = base.dims.b * 100 - (t + ri);
    const A = sec.A * 1e4, Iz = sec.Iz * 1e8, Iy = sec.Iy * 1e8, J = sec.J * 1e8;
    const y0 = base.xg * 100 - t / 2, r0 = Math.sqrt(rz * rz + ry * ry + y0 * y0);
    const Nzf = PI2 * E * Iz / (Lx * Lx), Ney = PI2 * E * Iy / (Ly * Ly), Nt = G * J / (r0 * r0);
    const f = 1 - (y0 / r0) ** 2, s = Ney + Nt;
    const Neyz = (s / (2 * f)) * (1 - Math.sqrt(Math.max(0, 1 - 4 * Ney * Nt * f / (s * s))));
    const Ne = Math.min(Nzf, Neyz), lambda0 = Math.sqrt(A * fy / Ne), chi = chiComp(lambda0);
    const e = effAL(b, t, chi * fy, chi * fy, E);
    const Aef = A - 4 * t * e.gaps.reduce((a, [p, q]) => a + q - p, 0);
    const NcRd = chi * Aef * fy / 1.20, iso = r.axial.capacity;
    const comp = { Ne: fix(Ne), Nzf: fix(Nzf), Ney: fix(Ney), Nt: fix(Nt), Neyz: fix(Neyz), y0: y0 / 100, r0: r0 / 100,
      lambda0: +lambda0.toFixed(4), chi: +chi.toFixed(4), Aef: Aef / 1e4, NcRd: fix(NcRd),
      modoGlobal: Ne === Nzf ? 'flexão em torno de z (eixo sem Steiner)' : 'flexo-torção (eixo de simetria y + torção, Cw = 0)' };
    av.push(`Dupla cantoneira como seção composta (9.7.2.2; Cw = 0 e J = 2·J1 — referência externa AISC 360-16 E4, ambos limites inferiores; válida com g constante e presilhas que garantam o trabalho conjunto): Nez = ${f2(Nzf, 1)}, Neyz = ${f2(Neyz, 1)} kN (${comp.modoGlobal}) → Nc,Rd = ${f2(NcRd)} kN; 2 × isolada = ${f2(iso)} kN → governa ${NcRd > iso ? 'a composta' : 'a isolada'}.`);
    if (NcRd > iso) {
      r.axial = ratObj(Nabs, NcRd, { modo: 'compressão', composta: comp, NcRdIsolado: iso, esbeltez: { conjunto: +lamConj.toFixed(2), limite: 200 },
        formula: 'Nc,Rd = χ·Aef·fy/1,20 da seção composta (9.7.2.2, eixo de simetria y; Cw = 0) — 9.7.5 atendido; Nc,Rd = max(composta; 2 × isolada)' });
    } else r.axial.composta = comp;
  }

  // 9.8.6 — connection of two channels forming an I
  if (kind !== '2L' && Math.abs(demands.Mz || 0) > 1e-9) {
    const m = (base.x0 - base.xg) * 100 + base.dims.t * 50, c = member.conexao;                // cm
    if (c && c.s > 0 && c.g > 0 && c.FRd > 0 && c.q > 0) {
      const sRes = 2 * c.g * c.FRd / ((m / 100) * c.q), sL = member.L > 0 ? member.L / 6 : Infinity, smax = Math.min(sRes, sL);
      r.conexao986 = ratObj(c.s, smax, { m: m / 100, sRes: fix(sRes), sL: isFinite(sL) ? fix(sL) : null, formula: 'smax = 2·g·FRd/(m·q) ≤ L/6 (9.8.6)' });
      if (c.s > smax + 1e-12) {
        av.push(`9.8.6 NÃO atendido: s = ${f2(c.s, 3)} m > smax = ${f2(smax, 3)} m — MRd,conj = 2·MRd,1 não vale.`);
        r.flexaoX.ratio = Infinity; r.flexaoX.verificado = false; r.flexaoX.motivo = '9.8.6: espaçamento da conexão acima de smax.';
        r.bending = r.flexaoX;
      } else av.push(`9.8.6: s = ${f2(c.s, 3)} m ≤ smax = ${f2(smax, 3)} m (m = ${f2(m)} cm).`);
    } else av.push(`9.8.6: conexão dos perfis NÃO verificada — MRd = 2·MRd,1 pressupõe s ≤ smax = 2·g·FRd/(m·q) ≤ L/6, m = x0 − xg + t/2 = ${f2(m)} cm (informe member.conexao = { s, g, FRd, q }, q = 3 × carga distribuída de cálculo).`);
  }
  if (kind === '2L' && (Math.abs(demands.Mz || 0) > 1e-9 || Math.abs(demands.My || 0) > 1e-9))
    av.push('2L em flexão: cada cantoneira com metade dos momentos, nos eixos principais (sem ação composta — limite inferior); espaçamento das ligações dos perfis em flexão (análogo ao 9.8.6, que só trata 2U) — LACUNA.');
  if (kind !== '2L') av.push('Composta 2U/2Ue: ação composta (Cw e FLT do I) — LACUNA; My em cada perfil em torno do próprio eixo fraco com My/2, nos dois sentidos.');

  // interaction (9.9) with the final axial capacity
  const i99 = r.interaction99;
  if (i99 && i99.verificado !== false && r.axial.verificado !== false && Nabs > 0 && r.axial.capacity > 0) {
    const p = i99.parcelas; p.N = Nabs / r.axial.capacity;
    const H = p.N + p.Mx + p.My; i99.demand = fix(H); i99.ratio = +H.toFixed(4);
  }
  r.interaction = r.interaction99.ratio >= r.interactionMV.ratio ? r.interaction99 : r.interactionMV;
  return finalize(r, options);
}

// exposed for tests / reuse
export const _nbr14762 = { effAA, effAL, effFlangeStiff, solveEff, anexoEj, shearRd };
