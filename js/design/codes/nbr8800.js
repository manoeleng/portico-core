// ──────────────────────────────────────────────────────────────────────────────
// nbr8800.js — STEEL design per ABNT NBR 8800:2024 (PLANO_BRASIL 7.1).
//
//   · 5.2.2 tension            Nt,Rd = Ag·fy/γa1; net-section rupture Ct·An·fu/γa2 when member.secaoLiquida.An is given
//   · 5.3     compression      Nc,Rd = χ·Aef·fy/γa1;  λ0 = √(Ag·fy/Ne)  (5.3.3.2)
//               Ne = min(Nex, Ney, Nez) for doubly symmetric I (5.3.5.1)
//               Aef by effective width (5.3.4.2, Tab. 4/5) — the 2024 edition has NO Q factor
//   · Anexo D bending          I/H major axis: FLT (D.2.1, D.2.8-a: Cb inside λr and Mcr,
//               interpolation NOT multiplied by Cb), FLM (D.2.8-f, rolled/welded), FLA;
//               minor axis: FLM only (D.2.8-c/g);  MRd ≤ 1,5·W·fy/γa1 (5.4.2.2)
//               slender web (h/tw > 5,70√(E/fy), Anexo E) is out of scope → reported, not computed
//   · 5.4.3   shear            web (5.4.3.1, kv = 5,34 unstiffened) and minor axis (5.4.3.5, kv = 1,2)
//   · 5.5.1.2 N+M interaction  NSd/NRd ≥ 0,2: + 8/9·ΣM ; < 0,2: NSd/2NRd + ΣM
//
// Buckling lengths: NBR 8800:2024 uses UNBRACED lengths (4.10.6.1, 5.3.5.1) with internal
// forces from a second-order analysis including imperfections (4.10.6.2/4.10.7), so K = 1 by
// default; member.K/Kz/Ky are accepted as an override for isolated members and flagged.
// Axes: this code uses z = strong axis (NBR x: Mz → Msd,x, Iz → Ix) and y = weak axis.
// Units: kN, m, kN/m². Sections other than I/H get a simplified check (flagged).
// Source transcription: PLANO_BRASIL "Fase 3" ficha (pages checked against the 2024 PDF).
// ──────────────────────────────────────────────────────────────────────────────

import { finalize } from './aisc360.js?v=7';
import { nbr14762 } from './nbr14762.js?v=7';

const ratObj = (D, C, extra = {}) => ({
  demand: +(+D).toFixed(4), capacity: +(+C).toFixed(4),
  ratio: C > 1e-12 ? +(D / C).toFixed(4) : Infinity, ...extra,
});
const chiOf = (l0) => l0 <= 1.5 ? Math.pow(0.658, l0 * l0) : 0.877 / (l0 * l0);   // 5.3.3.1
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

// Single angle (legs H vertical, B horizontal, thickness t; outer corner at the origin): Ne about the
// PRINCIPAL axes with flexural-torsional buckling — smallest root of the 5.3.5.3 cubic
// (Nu−N)(Nv−N)(Nz−N) − N²(Nu−N)(v0/r0)² − N²(Nv−N)(u0/r0)² = 0, which reduces to 5.3.5.2 for equal legs
// (u0 = 0). Shear centre at the leg mid-line intersection (t/2, t/2); Cw = 0. Thin legs, no fillet.
function angleBuckling(dims, sec, E, G, L, Lt) {
  const H = dims.d, B = dims.b, t = dims.t;
  if (!(H > 0 && B > 0 && t > 0)) return null;
  const R = [{ x0: 0, x1: t, y0: 0, y1: H }, { x0: t, x1: B, y0: 0, y1: t }];
  let A = 0, Sx = 0, Sy = 0;
  for (const r of R) { const a = (r.x1 - r.x0) * (r.y1 - r.y0); A += a; Sx += a * (r.x0 + r.x1) / 2; Sy += a * (r.y0 + r.y1) / 2; }
  const cx = Sx / A, cy = Sy / A;
  let Ixx = 0, Iyy = 0, Ixy = 0;
  for (const r of R) {
    const w = r.x1 - r.x0, h = r.y1 - r.y0, a = w * h, dx = (r.x0 + r.x1) / 2 - cx, dy = (r.y0 + r.y1) / 2 - cy;
    Ixx += w * h ** 3 / 12 + a * dy * dy; Iyy += h * w ** 3 / 12 + a * dx * dx; Ixy += a * dx * dy;
  }
  const m = (Ixx + Iyy) / 2, q = Math.sqrt(((Ixx - Iyy) / 2) ** 2 + Ixy ** 2);
  const Iu = m + q, Iv = m - q;                                   // major / minor principal
  const th = 0.5 * Math.atan2(-2 * Ixy, Ixx - Iyy);               // angle of the u axis
  const sx = t / 2 - cx, sy = t / 2 - cy;                          // shear centre − centroid
  const u0 = sx * Math.cos(th) + sy * Math.sin(th), v0 = -sx * Math.sin(th) + sy * Math.cos(th);
  const r02 = (Iu + Iv) / A + u0 * u0 + v0 * v0;
  const J = sec.J > 0 ? sec.J : (H + B - t) * t ** 3 / 3;
  const Nu = Math.PI ** 2 * E * Iu / (L * L), Nv = Math.PI ** 2 * E * Iv / (L * L);
  const Nz = G * J / r02;
  const f = N => (Nu - N) * (Nv - N) * (Nz - N) - N * N * (Nu - N) * v0 * v0 / r02 - N * N * (Nv - N) * u0 * u0 / r02;
  let lo = 0, hi = Math.min(Nu, Nv, Nz);
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; (f(mid) > 0 ? lo = mid : hi = mid); }
  return { Ne: (lo + hi) / 2, Iu, Iv, Ixx, Iyy, A, rmin: Math.sqrt(Iv / A), u0, v0, r02, Nu, Nv, Nz };
}

// 5.2.2-b / 5.2.3–5.2.5: net-section rupture Nt,Rd = Ct·An·fu/γa2. Input member.secaoLiquida (SI, m):
//   An (5.2.4, required — the hole pattern is not in the model; An = Ag when there are no holes, 5.2.4.2) and
//   Ct directly, or caso: 'a' (all elements connected, 1,00) | 'b' (transverse welds only, Ac/Ag) |
//   'c' (open section, 1 − ec/ℓc; default when lc is given) | 'd' (plate, longitudinal welds on both edges) |
//   'e' (tube with a concentric gusset, [1 + (ec/ℓc)^3,2]^−10). ec defaults, for a single angle, to the distance
//   from the centroid to the back of the connected leg (Fig. 4); Ac to the connected leg (b·t). Except for tubes and
//   plates, Ct need not be taken below Ac/Ag (last paragraph of 5.2.5).
function netSectionRupture(sl, { A, fu, ga2, shape, dims, abaLigada }) {
  if (!sl || !(sl.An > 0)) return null;
  if (!(fu > 0)) return { NRd: Infinity, Ct: 1, ref: '', aviso: 'Tração: seção líquida informada, mas o material não tem fu — 5.2.2-b NÃO verificada.' };
  const An = Math.min(sl.An, A);
  const tube = shape === 'pipe' || shape === 'tube' || shape === 'rhs' || shape === 'chs' || shape === 'box';
  let conn = null;   // single angle: connected leg a, outstanding o, thickness t
  if (shape === 'angle' && dims.d > 0 && dims.b > 0 && dims.t > 0) {
    const big = Math.max(dims.d, dims.b), small = Math.min(dims.d, dims.b);
    const a = abaLigada === 'menor' ? small : big, o = abaLigada === 'menor' ? big : small, t = dims.t;
    const Ag = t * (a + o - t);
    conn = { ec: (a * t * t / 2 + (o - t) * t * (t + (o - t) / 2)) / Ag, Ac: a * t };
  }
  const caso = sl.caso ?? (sl.Ct != null ? null : sl.lc > 0 ? (tube ? 'e' : 'c') : null);
  let Ct, ref, aviso = null;
  const ec = sl.ec ?? conn?.ec, Ac = sl.Ac ?? conn?.Ac;
  if (sl.Ct != null) { Ct = sl.Ct; ref = 'informado'; }
  else if (caso === 'a') { Ct = 1; ref = '5.2.5-a'; }
  else if (caso === 'b' && Ac > 0) { Ct = Ac / A; ref = '5.2.5-b'; }
  else if (caso === 'c' && ec >= 0 && sl.lc > 0) { Ct = 1 - ec / sl.lc; ref = '5.2.5-c'; }
  else if (caso === 'd' && sl.lc > 0 && sl.b > 0 && sl.t > 0) {
    Ct = 3 * sl.lc ** 2 / (3 * sl.lc ** 2 + sl.b ** 2) * (1 - sl.t / (2 * sl.lc)); ref = '5.2.5-d';
  } else if (caso === 'e' && ec >= 0 && sl.lc > 0) { Ct = (1 + (ec / sl.lc) ** 3.2) ** -10; ref = '5.2.5-e'; }
  else if (!tube && shape !== 'rect' && Ac > 0) {   // no Ct, ℓc or case: the code's own lower bound (safe side)
    Ct = Ac / A; ref = 'Ac/Ag, limite inferior de 5.2.5';
    aviso = 'Tração: sem Ct nem ℓc — adotado Ct = Ac/Ag (limite inferior de 5.2.5); informe ℓc (ou caso: \'a\' se a força chega a todos os elementos).';
  } else {
    return { NRd: Infinity, Ct: 1, An, ref: '', aviso: 'Tração: seção líquida informada sem Ct, ec/ℓc ou caso — ruptura (5.2.2-b) NÃO verificada.' };
  }
  if (!tube && shape !== 'rect' && caso !== 'd' && sl.Ct == null && Ac > 0 && Ct < Ac / A) { Ct = Ac / A; ref += ', ≥ Ac/Ag'; }
  if (!(Ct > 0 && Ct <= 1)) {
    const c = Math.min(Math.max(Ct, 0), 1);
    aviso = `Tração: Ct = ${Ct.toFixed(3)} fora de [0; 1] (ec > ℓc ou Ct informado) — limitado a ${c.toFixed(3)}.`;
    Ct = c;
  }
  if (!aviso && !tube && shape !== 'angle' && shape !== 'rect' && caso === 'c' && !(Ac > 0)) {
    aviso = 'Tração: Ac não informado — piso Ct ≥ Ac/Ag (5.2.5) não aplicado (a favor da segurança).';
  }
  return { NRd: Ct * An * fu / ga2, Ct, An, ref, aviso };
}

// Anexo E — slender-web I/H (h/tw > 5,70·√(E/fy)), doubly symmetric welded section (the section model has one
// bf/tf, so hc = h, Wxc = Wxt = W and E.5.3-a does not apply). Nominal moments (÷ γa1 by the caller):
//   E.6.1 tension-flange yielding Wxt·fy;  E.6.2 FLT and E.6.3 FLM with My = kpg·fy·Wxc, Mr = kpg·(fy − σr)·Wxc,
//   kpg = 1 − ar/(1200 + 300·ar)·(hc/tw − 5,70·√(E/fy)) ≤ 1, ar = hc·tw/Afc (≤ 10).
//   FLT: λ = Lb/ryc (T = compression flange + 1/3 of the compressed web, h/6), λy = 1,10·√(E/fy),
//        λr = π·√(E·Cb/(fy − σr)), Mcr = Cb·kpg·π²·E·Wxc/λ²  (Cb enters λr and Mcr, not the inelastic line).
//   FLM: λ = bf/2tf, λy = 0,38·√(E/fy), λr = 0,95·√(kc·E/(fy − σr)), Mcr = 0,90·kpg·E·kc·Wxc/λ².
//   E.5.3-b: h/tw ≤ 260 and ≤ 11,7·√(E/fy) (a/h ≤ 1,5) or 0,42·E/fy (a/h > 1,5 or no stiffeners); a = member.a.
function slenderWebBending({ E, fy, sr, kc, W, h, tw, bf, tf, lamF, Lb, Cb, a, laminado }) {
  if (laminado) return { erro: 'Anexo E vale só para perfil soldado (E.5.2)' };
  if (!(h > 0 && tw > 0 && bf > 0 && tf > 0)) return { erro: 'faltam d, bf, tf, tw para o Anexo E' };
  const lam = h / tw, aRel = a > 0 ? a / h : Infinity;
  const limB = aRel <= 1.5 ? 11.7 * Math.sqrt(E / fy) : 0.42 * E / fy;
  if (lam > 260 || lam > limB) return { erro: `h/tw acima do limite de E.5.3-b (260 e ${limB.toFixed(1)}, a/h ${aRel <= 1.5 ? '≤' : '>'} 1,5)` };
  const Afc = bf * tf, hc = h, ar = hc * tw / Afc;
  if (ar > 10) return { erro: `ar = hc·tw/Afc = ${ar.toFixed(2)} > 10 (E.6.2)` };
  const kpg = Math.min(1, 1 - ar / (1200 + 300 * ar) * (hc / tw - 5.70 * Math.sqrt(E / fy)));
  const My = kpg * fy * W, Mr = kpg * (fy - sr) * W;
  const lin = (l, ly, lr) => My - (My - Mr) * (l - ly) / (lr - ly);
  // E.6.2 FLT
  const hT = h / 6, ryc = Math.sqrt((tf * bf ** 3 / 12 + hT * tw ** 3 / 12) / (Afc + hT * tw));
  const l = Lb / ryc, ly = 1.10 * Math.sqrt(E / fy), lr = Math.PI * Math.sqrt(E * Cb / (fy - sr));
  const MnFLT = l <= ly ? My : l <= lr ? lin(l, ly, lr) : Cb * kpg * Math.PI ** 2 * E * W / (l * l);
  const ramoFLT = l <= ly ? 'FLT (E.6.2): λ ≤ λy' : l <= lr ? 'FLT (E.6.2): λy < λ ≤ λr' : 'FLT (E.6.2): λ > λr (elástica)';
  // E.6.3 FLM
  const lyF = 0.38 * Math.sqrt(E / fy), lrF = 0.95 * Math.sqrt(kc * E / (fy - sr));
  const MnFLM = lamF <= lyF ? My : lamF <= lrF ? lin(lamF, lyF, lrF) : 0.90 * kpg * E * kc * W / (lamF * lamF);
  return { kpg, ar, ryc, lambdaFLT: l, MnFLT, MnFLM,
    cand: [[W * fy, 'escoamento da mesa tracionada (E.6.1)'], [MnFLT, ramoFLT], [MnFLM, 'FLM (E.6.3)']] };
}

function checkNBR8800({ demands, mat, sec, member = {}, options = {} }) {
  // cold-formed sections (NBR 6355 catalogue or flagged) are checked by NBR 14762:2010
  if (sec.coldFormed || sec.shape === 'Ue') {
    const r = nbr14762.check({ demands, mat, sec, member, options });
    (r.avisos = r.avisos || []).unshift('Perfil formado a frio: verificado pela ABNT NBR 14762:2010.');
    return r;
  }
  const fy = mat.Fy, E = mat.E, G = mat.G || 0.385 * E;           // G = 77 000 MPa for E = 200 000 MPa (NBR 8800:2024 4.6.2.9-c)
  const ga1 = options.gamma_a1 ?? 1.10, ga2 = options.gamma_a2 ?? 1.35;   // Tab. 3
  const avisos = [];
  const { A, Iz, Iy, J, Cw, Sz, Sy, Zz, Zy, rz, ry, shape } = sec;
  const isI = shape === 'I' && Cw > 0 && J > 0;
  const dims = sec.dims || {};
  const tf = dims.tf, tw = dims.tw, bf = dims.bf ?? sec.b, d = dims.d ?? sec.h;
  // λ of flange (bf/2tf) and web (h/tw): catalogue values, else derived from the plate dims
  const hWeb = (sec.lambdaWeb > 0 && tw > 0) ? sec.lambdaWeb * tw : (d > 0 && tf > 0 ? d - 2 * tf : 0);
  const lamF = sec.lambdaFlange > 0 ? sec.lambdaFlange : (bf > 0 && tf > 0 ? bf / (2 * tf) : NaN);
  const lamW = sec.lambdaWeb > 0 ? sec.lambdaWeb : (hWeb > 0 && tw > 0 ? hWeb / tw : NaN);
  const welded = sec.fabricacao !== 'laminado';                   // not given → welded (conservative, as the warning says)
  if (shape === 'I' && !isI) avisos.push('Perfil I sem Cw/J: verificação simplificada (sem FLT nem flambagem por torção).');
  if (isI && !(isFinite(lamF) && isFinite(lamW))) avisos.push('Faltam λ da mesa/alma e dimensões da chapa: flambagem local, FLM e FLA NÃO verificadas.');
  if (isI && !(sec.lambdaWeb > 0) && isFinite(lamW) && !welded) avisos.push('h/tw derivado de d − 2·tf: em laminado a norma desconta os raios de concordância (D.3) — informe λ de catálogo.');
  if (isI && sec.fabricacao !== 'laminado' && sec.fabricacao !== 'soldado') {
    avisos.push('Fabricação não informada: adotado perfil soldado (FLM/flambagem local mais conservadoras).');
  }
  const kc = (hWeb > 0 && tw > 0) ? clamp(4 / Math.sqrt(hWeb / tw), 0.35, 0.76) : 0.35;   // Tab. 4, nota a
  const sr = 0.3 * fy;                                              // σr (D.2.8-e)

  const L = member.L || 1;
  const Ks = ['K', 'Kz', 'Ky', 'Kt'].map(k => member[k]).filter(v => v != null);
  if (Ks.some(v => v < 1)) avisos.push('K < 1 informado: sem base na NBR 8800:2024 (comprimento destravado, 5.3.5.1) e contra a segurança.');
  else if (Ks.some(v => v > 1)) avisos.push('K > 1 informado (barra isolada/balanço): a NBR 8800:2024 é omissa (comprimento destravado + análise de 2ª ordem, 4.10.6.2) — decisão do RT.');
  const Lx = member.Lx ?? (member.Kz ?? member.K ?? 1) * L;          // buckling about strong axis
  const Ly = member.Ly ?? (member.Ky ?? member.K ?? 1) * L;          // about weak axis
  const Lt = member.Lz ?? (member.Kt ?? 1) * L;                      // torsion
  const Lb = member.Lb ?? L;
  const Cb = member.Cb ?? 1.0;

  const N = demands.N || 0, Nabs = Math.abs(N);
  const semL = (member.Ldefault || member.L == null) && member.Lx == null && member.Ly == null && member.Lb == null;
  if (semL && (N < 0 || (demands.Mz || 0) !== 0)) avisos.push('Comprimento da barra não informado: flambagem/FLT NÃO verificadas.');
  const Vy = Math.abs(demands.Vy || 0), Vz = Math.abs(demands.Vz || 0);
  const My = Math.abs(demands.My || 0), Mz = Math.abs(demands.Mz || 0);

  // ── 5.2 tension / 5.3 compression ─────────────────────────────────────────────
  let axial, NRd;
  if (N >= 0) {
    NRd = A * fy / ga1;
    const slT = Math.max(L / rz, L / ry);
    if (slT > 300) avisos.push(`Esbeltez de barra tracionada ${slT.toFixed(0)} > 300 (5.2.8.1).`);
    axial = ratObj(Nabs, NRd, { modo: 'tração', formula: 'Nt,Rd = Ag·fy/γa1 (5.2.2-a)' });
    const net = netSectionRupture(member.secaoLiquida, { A, fu: mat.Fu, ga2, shape, dims, abaLigada: member.cantoneira?.abaLigada });
    if (net && net.NRd < NRd) {
      NRd = net.NRd;
      axial = ratObj(Nabs, NRd, { modo: 'tração (seção líquida)', formula: `Nt,Rd = Ct·An·fu/γa2 (5.2.2-b), Ct = ${net.Ct.toFixed(3)} (${net.ref})` });
    }
    if (net) { axial.secaoLiquida = { An: net.An, Ct: +net.Ct.toFixed(4), NRd: +net.NRd.toFixed(4), ref: net.ref }; if (net.aviso) avisos.push(net.aviso); }
    else if (Nabs > 0) avisos.push('Tração: ruptura da seção líquida (5.2.2-b) não verificada — informe member.secaoLiquida.An (e Ct ou ec/ℓc).');
  } else {
    const Nex = Math.PI ** 2 * E * Iz / (Lx * Lx);
    const Ney = Math.PI ** 2 * E * Iy / (Ly * Ly);
    let Nez = Infinity;
    if (isI && J > 0) Nez = (Math.PI ** 2 * E * Cw / (Lt * Lt) + G * J) / (rz * rz + ry * ry);   // x0 = y0 = 0
    let Ne = Math.min(Nex, Ney, Nez);
    const ang = shape === 'angle' ? angleBuckling(dims, sec, E, G, Math.max(Lx, Ly), Lt) : null;
    if (ang) {
      // 5.3.5.4: single angle connected by ONE leg — equivalent unbraced length about the axis parallel to
      // the connected leg (taken as the larger leg); flexural-torsional only when b/t > 0,71·√(E/fy).
      const cfg = member.cantoneira || {};
      const big = Math.max(dims.d, dims.b), small = Math.min(dims.d, dims.b);
      // connected leg: the larger one by default; member.cantoneira.abaLigada = 'menor' for unequal legs connected
      // by the smaller one (then Lx1,eq has the lower bounds of 5.3.5.4.2 / 5.3.5.4.3, last paragraph)
      const ligMenor = cfg.abaLigada === 'menor' && big / small > 1 + 1e-9;
      const connHoriz = ligMenor ? dims.b < dims.d : dims.b >= dims.d;     // b = horizontal leg, d = vertical leg
      const Ix1 = connHoriz ? ang.Ixx : ang.Iyy, rx1 = Math.sqrt(Ix1 / ang.A), L1 = member.L ?? Math.max(Lx, Ly);
      const lim71 = 0.71 * Math.sqrt(E / fy), btMax = big / dims.t;
      const lr = L1 / rx1;
      const Leq = { plana: lr <= 80 ? 72 * rx1 + 0.75 * L1 : 32 * rx1 + 1.25 * L1,          // 5.3.5.4.2
                    espacial: lr <= 75 ? 60 * rx1 + 0.80 * L1 : 45 * rx1 + L1 };           // 5.3.5.4.3 (b: "> 75")
      if (ligMenor) {   // not less than 0,95 (0,82)·Lx1·rx1/rmín nor the value above + 4 (6)·[(be/bs)² − 1]·rx1
        const inc = (big / small) ** 2 - 1;
        Leq.plana = Math.max(Leq.plana + 4 * inc * rx1, 0.95 * L1 * rx1 / ang.rmin);
        Leq.espacial = Math.max(Leq.espacial + 6 * inc * rx1, 0.82 * L1 * rx1 / ang.rmin);
      }
      const NeEq = (k) => Math.PI ** 2 * E * Ix1 / (Leq[k] * Leq[k]);
      const aplicavel = (k) => big / small <= 1.7 && Leq[k] / rx1 <= 200;                     // 5.3.5.4.1-d/e
      const NeFT = btMax > lim71 ? ang.Ne : Infinity;                                       // 5.3.5.4.4
      const tr = cfg.trelica;
      if (tr === 'concentrica') {
        Ne = ang.Ne;
        avisos.push(`Cantoneira com força centrada (declarada): Ne pelos eixos principais com flexo-torção (5.3.5.2/5.3.5.3), rmín = ${(ang.rmin * 100).toFixed(2)} cm.`);
      } else if (tr === 'plana' || tr === 'espacial') {
        if (!aplicavel(tr)) { Ne = 0; avisos.push(`Cantoneira fora das condições de 5.3.5.4.1 (abas ${(big / small).toFixed(2)} > 1,7 ou Lx1,eq/rx1 > 200): tratar como flexo-compressão (5.3.5.4.5) — NÃO verificado.`); }
        else {
          Ne = Math.min(NeEq(tr), NeFT);
          avisos.push(`Cantoneira ligada pela aba ${ligMenor ? 'MENOR (limites inferiores de Lx1,eq do último parágrafo de 5.3.5.4.2/5.3.5.4.3)' : 'maior (member.cantoneira.abaLigada = \'menor\' se for a menor)'}, treliça ${tr}: Lx1,eq = ${Leq[tr].toFixed(3)} m (5.3.5.4.${tr === 'plana' ? 2 : 3}), rx1 = ${(rx1 * 100).toFixed(2)} cm${isFinite(NeFT) ? '; b/t > 0,71·√(E/fy): flexo-torção considerada (5.3.5.4.4)' : ''}.`);
        }
      } else {
        const cands = [ang.Ne, ...['plana', 'espacial'].filter(aplicavel).map(NeEq)];
        Ne = Math.min(...cands);
        if (!['plana', 'espacial'].some(aplicavel)) { Ne = 0; avisos.push('Cantoneira fora das condições de 5.3.5.4.1: flexo-compressão (5.3.5.4.5) — NÃO verificado.'); }
        else avisos.push(`Cantoneira: ligação não declarada (member.cantoneira.trelica = 'plana' | 'espacial' | 'concentrica') — adotado o menor Ne entre 5.3.5.4.2, 5.3.5.4.3 (supondo ligada a aba maior) e eixos principais (rmín = ${(ang.rmin * 100).toFixed(2)} cm).`);
      }
    } else if (shape === 'angle') {
      avisos.push('Cantoneira sem dimensões (d, b, t): eixos principais e flexo-torção NÃO verificados (5.3.5.2/5.3.5.3).');
    }
    const lambda0 = Math.sqrt(A * fy / Ne);
    const chi = chiOf(lambda0);
    // effective area (5.3.4.1/5.3.4.2): Aef = Ag − Σ(b − bef)·t  [sum over elements: interpretation,
    // the text says "with them, the effective area of the section"]
    let Aef = A, localOk = true;
    if (isI || ang) {
      const elems = [];
      if (ang) {                                                   // Tab. 4 grupo 3 (aba de cantoneira simples, b = largura total)
        const limL = 0.45 * Math.sqrt(E / fy);
        for (const b of [dims.d, dims.b]) elems.push({ bt: b / dims.t, lim: limL, c1: 0.22, c2: 1.49, n: 1, t: dims.t, b });   // AL
      } else {
        const limF = welded ? 0.64 * Math.sqrt(E / (fy / kc)) : 0.56 * Math.sqrt(E / fy);   // Tab. 4 grupos 5 / 4
        const limW = 1.49 * Math.sqrt(E / fy);                                            // Tab. 4 grupo 2
        if (lamF > 0) elems.push({ bt: lamF, lim: limF, c1: 0.22, c2: 1.49, n: 4, t: tf, b: bf / 2 });   // AL, Tab. 5
        if (lamW > 0) elems.push({ bt: lamW, lim: limW, c1: 0.18, c2: 1.31, n: 1, t: tw, b: hWeb });     // AA
      }
      for (const e of elems) {
        if (e.bt <= e.lim / Math.sqrt(chi)) continue;
        const sel = (e.c2 * e.lim / e.bt) ** 2 * fy;
        const k = Math.sqrt(sel / (chi * fy));
        const ratio = Math.min(1, (1 - e.c1 * k) * k);           // bef/b (≤ 1 at the transition)
        if (e.t > 0 && e.b > 0) Aef -= e.n * (1 - ratio) * e.b * e.t;
        else localOk = false;
      }
      if (!localOk) avisos.push('Flambagem local: faltam dimensões da chapa (d, bf, tf, tw) para calcular Aef — adotado Aef = Ag (NÃO verificado).');
    } else {
      avisos.push(`Seção "${shape}": compressão simplificada (Aef = Ag, sem flambagem local nem por torção).`);
    }
    NRd = chi * Aef * fy / ga1;
    axial = ratObj(Nabs, NRd, { modo: 'compressão', chi: +chi.toFixed(4), lambda0: +lambda0.toFixed(4),
      Ne: +Ne.toFixed(2), Aef, formula: 'Nc,Rd = χ·Aef·fy/γa1 (5.3.2); λ0 = √(Ag·fy/Ne)' });
    const slend = ang ? Math.max(Lx, Ly) / ang.rmin : Math.max(Lx / rz, Ly / ry);   // cantoneira: rmín (eixo principal)
    if (slend > 200) avisos.push(`Esbeltez ${slend.toFixed(0)} > 200 (5.3.7.1).`);
  }

  // ── Anexo D bending ───────────────────────────────────────────────────────────
  const interp = (Mpl, Mr, lam, lp, lr) => Mpl - (Mpl - Mr) * (lam - lp) / (lr - lp);
  let flexaoX, flexaoY;
  if (isI) {
    const W = Sz, Mpl = Zz * fy, Mr = (fy - sr) * W;
    // FLT (D.2.1, D.2.8-a)
    const lam = Lb / ry, lp = 1.76 * Math.sqrt(E / fy);
    const b1 = (fy - sr) * W / (E * J);
    const lr = (1.38 * Cb * Math.sqrt(Iy * J) / (ry * J * b1)) * Math.sqrt(1 + Math.sqrt(1 + 27 * Cw * b1 * b1 / (Cb * Cb * Iy)));
    const Mcr = (Cb * Math.PI ** 2 * E * Iy / (Lb * Lb)) * Math.sqrt((Cw / Iy) * (1 + 0.039 * J * Lb * Lb / Cw));
    const MnFLT = lam <= lp ? Mpl : lam <= lr ? interp(Mpl, Mr, lam, lp, lr) : Mcr;
    const ramoFLT = lam <= lp ? 'FLT: λ ≤ λp' : lam <= lr ? 'FLT: λp < λ ≤ λr' : 'FLT: λ > λr (elástica)';
    // FLM (D.2.8-f)
    const lpF = 0.38 * Math.sqrt(E / fy);
    const lrF = welded ? 0.95 * Math.sqrt(E / ((fy - sr) / kc)) : 0.83 * Math.sqrt(E / (fy - sr));
    const McrF = (welded ? 0.90 * E * kc : 0.69 * E) * W / (lamF * lamF);
    const MnFLM = lamF <= lpF ? Mpl : lamF <= lrF ? interp(Mpl, Mr, lamF, lpF, lrF) : McrF;
    // FLA (Tab. D.1)
    const lpW = 3.76 * Math.sqrt(E / fy), lrW = 5.70 * Math.sqrt(E / fy);
    const MnFLA = lamW <= lpW ? Mpl : interp(Mpl, fy * W, lamW, lpW, lrW);
    const slenderWeb = lamW > lrW;
    const cap = 1.5 * W * fy;                                      // 5.4.2.2
    let cand = [[MnFLT, ramoFLT], [MnFLM, 'FLM'], [MnFLA, 'FLA'], [cap, '1,5·W·fy (5.4.2.2)']];
    let slenderBlocked = false, anexoE = null;
    if (slenderWeb) {
      anexoE = slenderWebBending({ E, fy, sr, kc, W, h: hWeb, tw, bf, tf, lamF, Lb, Cb, a: member.a,
        laminado: sec.fabricacao === 'laminado' });
      if (anexoE.erro) { slenderBlocked = true; avisos.push(`Alma esbelta (h/tw = ${lamW.toFixed(1)} > ${lrW.toFixed(1)}): ${anexoE.erro} — flexão NÃO verificada.`); }
      else {
        cand = anexoE.cand;
        avisos.push(`Alma esbelta (h/tw = ${lamW.toFixed(1)} > ${lrW.toFixed(1)}): momento resistente pelo Anexo E (kpg = ${anexoE.kpg.toFixed(4)}).`);
      }
    }
    const unk = cand.some(([v]) => !isFinite(v));
    const [Mn, ramo] = cand.filter(([v]) => isFinite(v)).reduce((a, b) => b[0] < a[0] ? b : a);
    flexaoX = anexoE && !anexoE.erro
      ? ratObj(Mz, Mn / ga1, { eixo: 'forte (Mz = Msd,x)', ramo, kpg: anexoE.kpg, Cb, MRdFLT: anexoE.MnFLT / ga1, MRdFLM: anexoE.MnFLM / ga1,
          formula: 'MRd = min(Wxt·fy, FLT, FLM)/γa1 com kpg (Anexo E, E.6.1–E.6.3)' })
      : ratObj(Mz, Mn / ga1, { eixo: 'forte (Mz = Msd,x)', ramo, Mpl, Mr, Mcr,
          Lp: lp * ry, Lr: lr * ry, Cb, MRdFLT: MnFLT / ga1, MRdFLM: MnFLM / ga1,
          formula: 'MRd = min(FLT, FLM, FLA)/γa1 ≤ 1,5·W·fy/γa1 (Anexo D)' });
    if (slenderBlocked || unk) flexaoX.ratio = Infinity;
    // minor axis: FLM only (D.2.8-c, D.2.8-g)
    const Wy = Sy, Mply = Zy * fy, Mry = (fy - sr) * Wy;
    const McrFy = (welded ? 0.90 * E * kc : 0.69 * E) * Wy / (lamF * lamF);
    const MnFLMy = lamF <= lpF ? Mply : lamF <= lrF ? interp(Mply, Mry, lamF, lpF, lrF) : McrFy;
    const Mny = Math.min(MnFLMy, 1.5 * Wy * fy);
    flexaoY = ratObj(My, Mny / ga1, { eixo: 'fraco (My = Msd,y)', formula: 'MRd = min(FLM, 1,5·W·fy)/γa1 (Anexo D)' });
  } else if ((shape === 'box' || shape === 'rhs') && dims.b > 0 && dims.h > 0 && dims.t > 0 && Zz > 0 && Zy > 0) {
    // rectangular tube / box, doubly symmetric — NBR 8800:2024 D.2.7 (FLM, FLA) and Tab. D.1 (FLT, major axis only,
    // D.2.8-g). Added 15/10/2026 (literature check, Manual CBCA de perfis tubulares 3.7.4: the simplified Mpl was
    // 10 % above). Tubular: flat width = outside width − 4t when the corner radius is not known (5.1.2.2-d); box
    // (welded caixão, sec.caixao): clear distance between the webs/flanges (5.1.2.2-b/c).
    const caixao = sec.caixao === true || dims.caixao === true, t = dims.t;
    const sq = Math.sqrt(E / fy), flat = (B) => caixao ? B - 2 * t : (dims.flatOffset > 0 ? B - dims.flatOffset : B - 4 * t);
    const tubeM = (Bf, Hw, W, Z, I, major) => {
      const Mpl = Z * fy, out = { Mpl };
      // FLM
      const bF = flat(Bf), lam = bF / t, lp = 1.12 * sq, lr = (caixao ? 1.49 : 1.40) * sq;
      if (lam <= lp) out.FLM = Mpl;
      else if (lam <= lr) out.FLM = Mpl - (Mpl - fy * W) * (3.57 * lam / sq - 4.0);
      else {                                                                     // fy·Wef, bef by 5.3.4.2 with (b/t)lim = λr, χ = 1
        const c1 = caixao ? 0.18 : 0.20, c2 = caixao ? 1.31 : 1.38, rs = c2 * lr / lam;   // √(σel/fy)
        const bef = Math.min(bF, bF * (1 - c1 * rs) * rs), dA = (bF - bef) * t, yc = (Hw - t) / 2;
        const A1 = A - dA, e = dA * yc / A1, Ief = I - dA * yc * yc - A1 * e * e;
        out.Wef = Ief / (Hw / 2 + e); out.FLM = fy * out.Wef;
      }
      out.lamF = lam; out.lpF = lp; out.lrF = lr;
      // FLA
      const hW = flat(Hw), lw = hW / t, lpw = 2.42 * sq, lrw = 5.70 * sq;
      out.lamW = lw;
      if (lw <= lpw) out.FLA = Mpl;
      else if (lw <= lrw) out.FLA = Math.min(Mpl - (Mpl - fy * W) * (0.305 * lw / sq - 0.738), Mpl);
      else { out.FLA = NaN; out.blocked = `alma h/t = ${lw.toFixed(1)} > λr = ${lrw.toFixed(1)} (D.2.7: Anexo E) — NÃO verificado.`; }
      // FLT (Tab. D.1), only about the axis of greater inertia
      if (major) {
        const rmin = Math.sqrt(Math.min(Iz, Iy) / A), lt = Lb / rmin, Mr = (fy - sr) * W, sJA = Math.sqrt(J * A);
        const lpt = 0.13 * E * sJA / Mpl, lrt = 2 * Cb * E * sJA / Mr, Mcr = 2 * Cb * E * sJA / lt;
        out.FLT = lt <= lpt ? Mpl : lt <= lrt ? interp(Mpl, Mr, lt, lpt, lrt) : Mcr;
        out.lamT = lt;
      } else out.FLT = Mpl;
      out.Mn = Math.min(out.FLM, isNaN(out.FLA) ? Infinity : out.FLA, out.FLT, 1.5 * W * fy);
      out.ramo = out.Mn === out.FLM ? 'FLM (D.2.7)' : out.Mn === out.FLA ? 'FLA (D.2.7)' : out.Mn === out.FLT ? 'FLT (Tab. D.1)' : '1,5·W·fy';
      return out;
    };
    const majorZ = Iz >= Iy;
    const tz = tubeM(dims.b, dims.h, Sz, Zz, Iz, majorZ), ty = tubeM(dims.h, dims.b, Sy, Zy, Iy, !majorZ);
    const fmt = (o) => ({ ramo: o.ramo, Mpl: o.Mpl, MRdFLM: o.FLM / ga1, MRdFLA: isNaN(o.FLA) ? null : o.FLA / ga1, MRdFLT: o.FLT / ga1,
      lambdaMesa: +o.lamF.toFixed(3), lambdaAlma: +o.lamW.toFixed(3), ...(o.Wef ? { Wef: o.Wef } : {}) });
    flexaoX = ratObj(Mz, tz.Mn / ga1, { eixo: 'forte (Mz = Msd,x)', ...fmt(tz), formula: `MRd = min(FLM, FLA, FLT)/γa1 — ${caixao ? 'seção-caixão' : 'tubo retangular'} (D.2.7, Tab. D.1)` });
    flexaoY = ratObj(My, ty.Mn / ga1, { eixo: 'fraco (My = Msd,y)', ...fmt(ty), formula: `MRd = min(FLM, FLA${!majorZ ? ', FLT' : ''})/γa1 (D.2.7)` });
    for (const [o, f] of [[tz, flexaoX], [ty, flexaoY]]) if (o.blocked) { f.ratio = Infinity; avisos.push(`Flexão ${f.eixo}: ${o.blocked}`); }
    if (!caixao && !(dims.flatOffset > 0)) avisos.push('Tubo retangular: parte plana = largura externa − 4t (raio de concordância não informado, 5.1.2.2-d).');
  } else if ((shape === 'pipe' || shape === 'chs' || shape === 'tube') && dims.D > 0 && dims.t > 0) {
    // circular tube — NBR 8800:2024 D.2.6 (local buckling of the wall, the only applicable limit state; D/t ≤ 0,45·E/fy).
    // Added 15/10/2026 (Manual CBCA de perfis tubulares 3.7.7: the simplified Mpl was 4,6 % above).
    const lam = dims.D / dims.t, lp = 0.07 * E / fy, lr = 0.31 * E / fy, W = Sz, Mpl = Zz * fy;
    let Mn = lam <= lp ? Mpl : lam <= lr ? (0.021 * E / lam + fy) * W : 0.33 * E / lam * W;
    Mn = Math.min(Mn, 1.5 * W * fy);
    const ramo = lam <= lp ? 'Mpl (λ ≤ λp)' : lam <= lr ? '(0,021·E/(D/t) + fy)·W' : 'Mcr = 0,33·E/(D/t)·W';
    const o = { ramo, lambda: +lam.toFixed(3), lambdaP: +lp.toFixed(3), lambdaR: +lr.toFixed(3), formula: 'MRd por D.2.6 (flambagem local da parede)' };
    flexaoX = ratObj(Mz, Mn / ga1, { eixo: 'forte (Mz = Msd,x)', ...o });
    flexaoY = ratObj(My, Mn / ga1, { eixo: 'fraco (My = Msd,y)', ...o });
    if (lam > 0.45 * E / fy) { flexaoX.ratio = Infinity; flexaoY.ratio = Infinity; avisos.push(`Tubo circular com D/t = ${lam.toFixed(1)} > 0,45·E/fy = ${(0.45 * E / fy).toFixed(1)}: fora do escopo da NBR 8800 (D.2.6) — NÃO verificado.`); }
  } else {
    const Mnz = Math.min(Zz * fy, 1.5 * Sz * fy), Mny = Math.min(Zy * fy, 1.5 * Sy * fy);
    flexaoX = ratObj(Mz, Mnz / ga1, { eixo: 'forte (Mz = Msd,x)', ramo: 'Mpl (simplificada)', formula: 'MRd = Mpl/γa1 ≤ 1,5·W·fy/γa1' });
    flexaoY = ratObj(My, Mny / ga1, { eixo: 'fraco (My = Msd,y)', formula: 'MRd = Mpl/γa1 ≤ 1,5·W·fy/γa1' });
    avisos.push(`Seção "${shape}": flexão simplificada (sem FLT nem flambagem local).`);
  }

  // ── 5.4.3 shear ───────────────────────────────────────────────────────────────
  const shearRd = (lam, kv, Aw) => {
    const lp = 1.10 * Math.sqrt(kv * E / fy), lr = 1.37 * Math.sqrt(kv * E / fy), Vpl = 0.60 * Aw * fy;
    if (lam <= lp) return { V: Vpl / ga1, regime: 'plastificação (λ ≤ λp)' };
    if (lam <= lr) return { V: (lp / lam) * Vpl / ga1, regime: 'inelástico (λp < λ ≤ λr)' };
    return { V: 1.24 * (lp / lam) ** 2 * Vpl / ga1, regime: 'elástico (λ > λr)' };
  };
  let corteY, corteZ;
  if (isI) {
    const kv = member.kv ?? 5.34;                                  // unstiffened web (5.4.3.1.1)
    const Aw = (d > 0 && tw > 0) ? d * tw : sec.Avy;               // 5.4.3.1.2: Aw = d·tw
    if (!(d > 0 && tw > 0)) avisos.push('Cortante: sem d·tw, adotado Aw = área de alma do modelo.');
    const sY = shearRd(lamW, kv, Aw);
    corteY = ratObj(Vy, sY.V, { dir: 'Vy (alma)', regime: sY.regime, formula: 'Vpl = 0,60·Aw·fy, Aw = d·tw (5.4.3.1)' });
    const Awz = (bf > 0 && tf > 0) ? 2 * bf * tf : sec.Avz;        // 5.4.3.5: kv = 1,2; h = bf/2; tw = tf
    const sZ = shearRd(lamF, 1.2, Awz);
    corteZ = ratObj(Vz, sZ.V, { dir: 'Vz (mesas)', regime: sZ.regime, formula: 'Aw = 2·bf·tf, kv = 1,2 (5.4.3.5)' });
  } else {
    corteY = ratObj(Vy, 0.60 * sec.Avy * fy / ga1, { dir: 'Vy', regime: 'simplificado', formula: 'VRd = 0,60·Av·fy/γa1' });
    corteZ = ratObj(Vz, 0.60 * sec.Avz * fy / ga1, { dir: 'Vz', regime: 'simplificado', formula: 'VRd = 0,60·Av·fy/γa1' });
  }

  // ── 5.5.1.2 interaction ───────────────────────────────────────────────────────
  const nr = NRd > 1e-12 ? Nabs / NRd : 0;
  const mm = (flexaoX.capacity > 1e-12 ? Mz / flexaoX.capacity : 0) + (flexaoY.capacity > 1e-12 ? My / flexaoY.capacity : 0);
  const H = nr >= 0.2 ? nr + (8 / 9) * mm : nr / 2 + mm;
  const interaction = ratObj(H, 1, { adim: true, modo: axial.modo,
    formula: nr >= 0.2 ? 'NSd/NRd + 8/9·(Mx,Sd/Mx,Rd + My,Sd/My,Rd) (5.5.1.2-a)' : 'NSd/2NRd + (Mx,Sd/Mx,Rd + My,Sd/My,Rd) (5.5.1.2-b)' });

  if (Nabs > 0 && N < 0) avisos.push('Esforços devem vir de análise de 2ª ordem com imperfeições (NBR 8800:2024 4.10.6.2/4.10.7).');
  if (semL) { if (N < 0) { axial.ratio = Infinity; interaction.ratio = Infinity; } if ((demands.Mz || 0) !== 0) flexaoX.ratio = Infinity; }
  const bending = flexaoX.ratio >= flexaoY.ratio ? flexaoX : flexaoY;
  const shear = corteY.ratio >= corteZ.ratio ? corteY : corteZ;
  return finalize({ material: 'aço', metodo: 'ABNT NBR 8800:2024', axial, bending, shear, interaction,
    flexaoX, flexaoY, corteY, corteZ, avisos }, options);
}

export const nbr8800 = {
  id: 'NBR8800:2024', family: 'steel', label: 'ABNT NBR 8800:2024',
  check: (input) => checkNBR8800(input),
};
