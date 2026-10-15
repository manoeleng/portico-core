// ──────────────────────────────────────────────────────────────────────────────
// nbr14762.js — COLD-FORMED STEEL design per ABNT NBR 14762:2010 (PLANO_BRASIL).
//
// Scope v1: channels — U enrijecido (shape 'Ue') and U simples (shape 'U'), method of the
// effective width (MLE). Z enrijecido, cartola and L (cantoneira) are reported "não verificado"
// (ratio = Infinity + warning) except tension, which only needs the gross area.
//
//   · 9.6.2  tension          Nt,Rd = A·fy/1,10 (net-section rupture 9.6.2 b/c NOT checked → warning)
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
//   · 9.8.3  shear            kv = 5,0 ; VRd by h/t regime, γ = 1,10 (h = flat web width)
//   · 9.8.4  M + V            (MSd/MRd)² + (VSd/VRd)² ≤ 1,0   (no transverse stiffeners)
//   · 9.9    N + M            NSd/NRd + Mx,Sd/Mx,Rd + My,Sd/My,Rd ≤ 1,0 (linear; 2nd order from the analysis)
//   · 9.1.2  Tab. 4 max b/t   exceeded → "não verificado"
//
// LACUNAS (always reported as warnings; never silent):
//   · Ndist / Mdist have no closed formula in the 2010 edition (9.3: elastic stability analysis,
//     e.g. CUFSM/DimPerfil): they are INPUTS (options.Ndist [kN], options.Mdist / options.MdistY [kN·m]).
//   · Net-section rupture in tension (9.6.2 b/c), shear lag (9.4), MSE (9.7.2 b / 9.8.2.1 b),
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
function effAL(b, t, sa, sb, E) {
  if (!(Math.max(sa, sb) > 0)) return FULL;
  let psi, k, s1, bc = b, bef, gap;
  if (sa >= sb) {                                                                      // σ1 at the support: casos a, b, c
    s1 = sa; psi = sb / s1;
    if (psi >= 1 - 1e-9) k = 0.43;
    else if (psi >= 0) k = 0.578 / (psi + 0.34);
    else if (psi >= -1) k = 1.7 - 5 * psi + 17.1 * psi * psi;
    else return { unverified: `AL com ψ = ${psi.toFixed(2)} < −1 fora da Tab. 6` };
    if (psi < 0) bc = b / (1 - psi);
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
          const rf = effFlangeStiff(el.b, el.t, el.Dn, lip.b, sa, E);
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

function checkNBR14762({ demands = {}, mat, sec, member = {}, options = {} }) {
  const avisos = [];
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
  const semL = (member.Ldefault || member.L == null) && member.Lx == null && member.Ly == null && member.Lb == null && member.Lz == null;
  const Lx = (member.Lx ?? (member.Kz ?? member.K ?? 1) * (member.L || 1)) * 100;     // buckling about the strong axis
  const Ly = (member.Ly ?? (member.Ky ?? member.K ?? 1) * (member.L || 1)) * 100;     // about the weak axis
  const Lt = (member.Lz ?? (member.Kt ?? 1) * (member.L || 1)) * 100;                 // torsion (KzLz)
  const Lby = member.Lb != null ? member.Lb * 100 : Ly, Lbz = member.Lb != null ? member.Lb * 100 : Lt;   // unbraced lengths for FLT (9.8.2.2)
  const Cb = member.Cb ?? 1.0, Cm = member.Cm ?? 1.0;
  if (member.Cb == null && Mz > 0) avisos.push('Cb = 1,0 (a favor da segurança, 9.8.2.2): informe member.Cb (helper cbMoments) para o diagrama real.');
  if (member.L != null && !member.Ldefault && member.Lx == null && member.K == null && member.Kz == null && member.Ky == null && (N < 0))
    avisos.push('K = 1,0 adotado (comprimento destravado = L); informe Lx/Ly/Lz com K da NBR 8800 se aplicável (14762:2010 8.2).');

  // geometry (cm) ----------------------------------------------------------------
  let g = null, geomWhy = null, limComp = null, limFlex = null;
  if (!isCh) geomWhy = `seção "${shape}" fora do escopo da v1 (Ue e U simples): NÃO verificada (LACUNA).`;
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

  // ── 9.6 tension / 9.7 compression ───────────────────────────────────────────────
  let axial, NRd = 0;
  const lamHard = isCh && g ? Math.max(Lx / g.rx, Ly / g.ry) : 0;
  if (N >= 0) {
    NRd = A * fy / gamT;
    axial = ratObj(Nabs, NRd, { modo: 'tração', formula: 'Nt,Rd = A·fy/1,10 (9.6.2 a)' });
    if (Nabs > 0) avisos.push('Tração: ruptura da seção líquida (9.6.2 b/c, Ct) não verificada — o modelo não tem área líquida/ligação.');
    if (!isCh) avisos.push(`Seção "${shape}": tração só por escoamento da seção bruta.`);
  } else {
    let why = whyC, det = {};
    if (!why && semL) why = 'comprimento da barra não informado (flambagem global).';
    if (!why) {
      const gb = glob(g);
      const lambda0 = Math.sqrt(A * fy / gb.Ne), chi = chiComp(lambda0);
      const ef = solveEff(g, E, { axis: 'N', sigma: chi * fy });
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
        else if (options.Ndist > 0) {
          const ld = Math.sqrt(A * fy / options.Ndist), cd = chiDistN(ld);
          Object.assign(dist, { Ndist: options.Ndist, lambdaDist: ld, chiDist: cd, NcRdDist: cd * A * fy / gamC });
          det.NcRd = Math.min(det.NcRdGlobal, dist.NcRdDist);
        } else why = `flambagem distorcional não dispensada (${dist.motivo || 'D/bw abaixo da Tab. 11'}) e options.Ndist não informado (9.7.3: análise de estabilidade elástica — LACUNA).`;
      }
    }
    if (!why && lamHard > 200) why = `KL/r = ${lamHard.toFixed(0)} > 200 (9.7.4): os valores calculados ficam em axial.* apenas como informação.`;
    const info = det.Ne == null ? {} : { chi: +det.chi.toFixed(4), lambda0: +det.lambda0.toFixed(4), Ne: fix(det.Ne),
      Nex: fix(det.Nex), Ney: fix(det.Ney), Nez: fix(det.Nez), Nexz: fix(det.Nexz), modoGlobal: det.modo,
      esbeltez: { x: +(Lx / g.rx).toFixed(2), y: +(Ly / g.ry).toFixed(2), limite: 200 },
      Aef: det.Aef != null ? det.Aef / 1e4 : undefined, NcRdGlobal: det.NcRdGlobal != null ? fix(det.NcRdGlobal) : undefined, distorcional: det.dist };
    if (why) { axial = unverified(Nabs, why, { modo: 'compressão', ...info }); warnUnv(Nabs, 'Compressão', why); }
    else {
      NRd = det.NcRd;
      axial = ratObj(Nabs, NRd, { modo: 'compressão', ...info,
        formula: 'Nc,Rd = min(χ·Aef·fy/1,20 (9.7.2); χdist·A·fy/1,20 (9.7.3)); λ0 = √(A·fy/Ne), A bruta' });
    }
  }
  if (N < 0) avisos.push('Esforços devem vir de análise com 2ª ordem/imperfeições (NBR 14762:2010 8.1).');

  // ── 9.8.2 bending, strong axis (z; NBR x) ──────────────────────────────────────────
  const flexX = () => {
    if (whyF) return { why: whyF };
    if (semL) return { why: 'comprimento da barra não informado (FLT).' };
    const out = {};
    const ye = solveEff(g, E, { axis: 'x', mode: 'yield', fy });
    if (ye.unverified) return { why: ye.unverified };
    out.Wef = ye.I / Math.max(ye.dc, ye.dt); out.Ief = ye.I; out.MRdEsc = out.Wef * fy / gamF;
    // FLT 9.8.2.2: Me = Cb·r0·√(Ney·Nez), KyLy = Ly, KzLz = Lz → unbraced lengths
    const Ney = PI2 * E * g.Iy / (Lby * Lby), Nez = (PI2 * E * g.Cw / (Lbz * Lbz) + G * g.J) / (g.r0 * g.r0);
    const Me = Cb * g.r0 * Math.sqrt(Ney * Nez);
    const lam0 = Math.sqrt(g.Wx * fy / Me), chi = chiFLT(lam0);
    const se = solveEff(g, E, { axis: 'x', mode: 'stab', sigma: chi * fy });
    if (se.unverified) return { why: se.unverified };
    out.Me = Me; out.lambda0 = lam0; out.chiFLT = chi; out.WcEf = se.I / se.dc; out.MRdFLT = chi * out.WcEf * fy / gamF;
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
      if (options.Mdist > 0) {
        const Md = options.Mdist * 100, ld = Math.sqrt(g.Wx * fy / Md), cd = chiDistM(ld);
        Object.assign(dist, { Mdist: options.Mdist, lambdaDist: ld, chiDist: cd });
        out.MRdDist = cd * g.Wx * fy / gamF; MRd = Math.min(MRd, out.MRdDist);
      } else return { ...out, why: `flambagem distorcional não dispensada (${dist.motivo || 'D/bw abaixo da Tab. 14'}) e options.Mdist não informado (9.8.2.3 — LACUNA).` };
    }
    out.MRd = MRd;
    out.ramo = MRd === out.MRdEsc ? 'escoamento (9.8.2.1)' : MRd === out.MRdFLT ? 'FLT (9.8.2.2)' : 'distorcional (9.8.2.3)';
    return out;
  };

  // ── weak axis (y): one sense ('alma' | 'mesas'), Anexo E ────────────────────────────
  const flexYsense = (comp) => {
    const out = { comp };
    const ye = solveEff(g, E, { axis: 'y', comp, mode: 'yield', fy });
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
    const se = solveEff(g, E, { axis: 'y', comp, mode: 'stab', sigma: chi * fy });
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
    if (semL) return { why: 'comprimento da barra não informado (FLT).' };
    const senses = options.sentidoMy ? [options.sentidoMy] : ['alma', 'mesas'];
    const rs = senses.map(flexYsense), bad = rs.find(r => r.why);
    if (bad) return { ...bad, why: bad.why + (options.sentidoMy ? '' : ' (sentido de My desconhecido: informe options.sentidoMy)') };
    return rs.reduce((a, b) => b.MRd < a.MRd ? b : a);
  };

  const fx = flexX(), fyr = flexY();
  const mkFlex = (f, D, eixo) => {
    if (f.why) { warnUnv(D, `Flexão ${eixo}`, f.why); return unverified(D / 100, f.why, { eixo }); }
    const { MRd, why, ...rest } = f;
    const o = { eixo, ramo: f.ramo, ...rest };
    for (const k of ['Wef', 'WcEf', 'Wc']) if (o[k] != null) o[k] = o[k] / 1e6;       // m³
    for (const k of ['Me', 'MRdEsc', 'MRdFLT', 'MRdDist']) if (o[k] != null) o[k] = o[k] / 100;  // kN·m
    delete o.Ief;
    return ratObj(D / 100, MRd / 100, o);
  };
  const flexaoX = mkFlex(fx, Mz, 'forte (Mz = Msd,x)');
  const flexaoY = mkFlex(fyr, My, 'fraco (My = Msd,y)');
  flexaoX.formula = 'MRd = min(Wef·fy/1,10; χFLT·Wc,ef·fy/1,10; χdist·W·fy/1,10) (9.8.2)';
  flexaoY.formula = 'MRd = min(Wef·fy/1,10; χFLT·Wc,ef·fy/1,10 [Anexo E]; χdist·W·fy/1,10) (9.8.2)';

  // ── 9.8.3 shear / 9.8.4 M+V ─────────────────────────────────────────────────────────
  let corteY, corteZ, VRdY = null;
  if (whyF) corteY = unverified(Vy, whyF, { dir: 'Vy (alma)' });
  else {
    const h = g.bw - 2 * (g.t + g.ri), sr = shearRd(h, g.t, fy, E, 5.0);
    VRdY = sr.V;
    corteY = ratObj(Vy, sr.V, { dir: 'Vy (alma)', regime: sr.regime, kv: 5.0, h: h / 100, ht: fix(sr.ht), lim108: fix(sr.l1), lim140: fix(sr.l2),
      formula: 'VRd (9.8.3), kv = 5,0, h = parte plana da alma, γ = 1,10' });
  }
  warnUnv(Vy, 'Cortante Vy', whyF);
  corteZ = Vz > 0 ? unverified(Vz, 'cortante paralelo às mesas (Vz): 9.8.3 trata só a(s) alma(s) — LACUNA.', { dir: 'Vz (mesas)' })
    : { demand: 0, capacity: 0, ratio: 0, dir: 'Vz (mesas)' };
  if (Vz > 0) avisos.push('Cortante Vz (mesas): NÃO verificado — 9.8.3 trata só a(s) alma(s) (LACUNA).');

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
  const mx = Mz > 0 ? (flexaoX.verificado === false ? (i99Why = i99Why || flexaoX.motivo, Infinity) : (Mz / 100) / flexaoX.capacity) : 0;
  const my = My > 0 ? (flexaoY.verificado === false ? (i99Why = i99Why || flexaoY.motivo, Infinity) : (My / 100) / flexaoY.capacity) : 0;
  H = nr + mx + my;
  const interaction99 = ratObj(H, 1, { adim: true, modo: axial.modo, parcelas: { N: nr, Mx: mx, My: my },
    formula: 'NSd/NRd + Mx,Sd/Mx,Rd + My,Sd/My,Rd ≤ 1,0 (9.9)', ...(i99Why ? { verificado: false, motivo: i99Why } : {}) });
  interaction99.ratio = H === Infinity ? Infinity : +H.toFixed(4);
  const interaction = interaction99.ratio >= interactionMV.ratio ? interaction99 : interactionMV;

  // shear lag (9.4) — only a flag
  if (Mz > 0 && g && member.L && L < 30 * g.bf) avisos.push('L < 30·bf0: shear lag (9.4, Tab. 7) NÃO verificado — aplica-se a vigas com forças concentradas.');
  if (shape === 'U' && Mz > 0) avisos.push('U simples: distorcional dispensada (9.3), exceto viga com painel ligado à mesa tracionada e mesa comprimida livre (Anexo F/bibliografia).');
  if (shape === 'Ue' && My > 0 && !options.sentidoMy) avisos.push('My: sentido (alma/mesas comprimidas) não informado — adotado o mínimo entre os dois.');

  const bending = flexaoX.ratio >= flexaoY.ratio ? flexaoX : flexaoY;
  const shear = corteY.ratio >= corteZ.ratio ? corteY : corteZ;
  return finalize({ material: 'aço formado a frio', metodo: 'ABNT NBR 14762:2010 (MLE)', axial, bending, shear, interaction,
    interaction99, interactionMV, flexaoX, flexaoY, corteY, corteZ, avisos }, options);
}

export const nbr14762 = {
  id: 'NBR14762:2010', family: 'steel', label: 'ABNT NBR 14762:2010 (formados a frio)',
  check: (input) => checkNBR14762(input),
};

// exposed for tests / reuse
export const _nbr14762 = { effAA, effAL, effFlangeStiff, solveEff, anexoEj, shearRd };
