// ──────────────────────────────────────────────────────────────────────────────
// nbr7190.js — TIMBER design per ABNT NBR 7190-1:2022 (PLANO_BRASIL 7.3).
//
//   · Design values      Xd = kmod·Xk/γw (5.8.3); kmod = kmod1·kmod2 (5.8.4, Tab. 4/5);
//                        γw = 1,4 normal stresses (compression, TENSION, bending), 1,8 shear (5.8.5)
//   · Classes            Tab. 2 (native, D20–D60) and Tab. 3 (structural pieces, C14–C50, D18–D70)
//   · Tension ∥          σNt,d ≤ ft0,d (6.3.2);  flexo-tension, linear (6.3.6)
//   · Compression ∥      (σNc,d/fc0,d)² + σMx,d/fm,d + kM·σMy,d/fm,d ≤ 1 (6.3.7)
//   · Stability          λ = L0/i ≤ 140; λrel = (λ/π)·√(fc0,k/E0,05) (6.5.4); if λrel > 0,3:
//                        σNc,d/(kc·fc0,d) + σMx,d/fm,d + kM·σMy,d/fm,d ≤ 1 (and swapped) (6.5.5),
//                        kc = 1/(k + √(k² − λrel²)), k = 0,5·[1 + βc·(λrel − 0,3) + λrel²],
//                        βc = 0,2 sawn / 0,1 glulam (MLC)
//   · Bending            σMx,d/fm,d + kM·σMy,d/fm,d ≤ 1 (and swapped), kM = 0,7 rectangular (6.3.5)
//   · Shear              τd = 1,5·Vd/A ≤ fv0,d (6.4.2)
//   · Lateral stability  L1/b ≤ E0,ef/(βM·fm,d), else σc,d ≤ E0,ef/((L1/b)·βM) (6.5.6),
//                        βM = (4/π)·(βE/γf)·(h/b)^1,5/((h/b) − 0,63)^0,5, βE = 4, γf = 1,4
//
// The 2022 edition replaced the short/intermediate/slender classification of 1997 by kc, removed
// kmod3 for sawn timber, changed γw of tension (1,8 → 1,4) and kM (0,5 → 0,7).
// Rectangular solid sections only; z = strong axis (Mz → Mx,d). Units: kN, m, kN/m².
// Material: mat.classe7190 ('D30', 'C24'… Tab. 3; 'Tab2:D30' for native Tab. 2) or explicit
// characteristic values mat.fc0k, ft0k, fbk, fvk, E0med, E005 (kN/m²).
// options: kmod1 (Tab. 4) and kmod2 (Tab. 5) — load-duration and moisture classes are project
// data; defaults (long duration 0,70; moisture class 2 0,90) are flagged. kmod3 (glulam) when
// options.kmod3 is given (6.7.4.9, applied as a further product — reading flagged).
// Source transcription: PLANO_BRASIL "Fase 7" ficha (checked against the 2022 PDF).
// ──────────────────────────────────────────────────────────────────────────────

import { finalize } from './aisc360.js?v=7';

const MPA = 1000;
const ratObj = (D, C, extra = {}) => {
  const r = C > 1e-12 ? D / C : Infinity;
  return { demand: +(+D).toFixed(4), capacity: +(+C).toFixed(4), ratio: Number.isFinite(r) ? +r.toFixed(4) : Infinity, ...extra };
};

// Tab. 3 — structural pieces (MPa): fb,k, ft0,k, fc0,k, fv,k, E0,m, E0,05
const T3 = {
  C14: [14, 8, 16, 3.0, 7000, 4700], C16: [16, 10, 17, 3.2, 8000, 5400], C18: [18, 11, 18, 3.4, 9000, 6000],
  C20: [20, 12, 19, 3.6, 9500, 6400], C22: [22, 13, 20, 3.8, 10000, 6700], C24: [24, 14, 21, 4.0, 11000, 7400],
  C27: [27, 16, 22, 4.0, 12000, 7700], C30: [30, 18, 23, 4.0, 12000, 8000], C35: [35, 21, 25, 4.0, 13000, 8700],
  C40: [40, 24, 26, 4.0, 14000, 9400], C45: [45, 27, 27, 4.0, 15000, 10000], C50: [50, 30, 29, 4.0, 16000, 11000],
  D18: [18, 11, 18, 3.4, 9500, 8000], D24: [24, 14, 21, 4.0, 10000, 8500], D30: [30, 18, 23, 4.0, 11000, 9200],
  D35: [35, 21, 25, 4.0, 12000, 10000], D40: [40, 24, 26, 4.0, 13000, 11000], D50: [50, 30, 29, 4.0, 14000, 12000],
  D60: [60, 36, 32, 4.5, 17000, 14000], D70: [70, 42, 34, 5.0, 20000, 16800],
};
// Tab. 2 — native species, clear specimens (MPa): fc0,k, fv0,k, Ec0,med. ft0 = fm = fc0 (6.2.2, 6.3.4);
// E0,05 = 0,7·Ec0,med (5.8.7)
const T2 = { D20: [20, 4, 10000], D30: [30, 5, 12000], D40: [40, 6, 14500], D50: [50, 7, 16500], D60: [60, 8, 19500] };

/** Characteristic values (kN/m²) of a NBR 7190-1:2022 strength class, or null. */
export function timberClass7190(name) {
  if (!name) return null;
  const n = String(name).trim().toUpperCase();
  if (n.startsWith('TAB2:')) {
    const v = T2[n.slice(5)]; if (!v) return null;
    return { fc0k: v[0] * MPA, ft0k: v[0] * MPA, fbk: v[0] * MPA, fvk: v[1] * MPA, E0med: v[2] * MPA, E005: 0.7 * v[2] * MPA, tabela: 2 };
  }
  const v = T3[n]; if (!v) return null;
  return { fbk: v[0] * MPA, ft0k: v[1] * MPA, fc0k: v[2] * MPA, fvk: v[3] * MPA, E0med: v[4] * MPA, E005: v[5] * MPA, tabela: 3 };
}

const kcOf = (lrel, bc) => {
  const k = 0.5 * (1 + bc * (lrel - 0.3) + lrel * lrel);
  return Math.min(1 / (k + Math.sqrt(k * k - lrel * lrel)), 1);
};

function checkNBR7190({ demands, mat, sec, member = {}, options = {} }) {
  const avisos = [];
  let naoVerificado = false;
  const cls = timberClass7190(mat.classe7190 ?? mat.design?.classe7190);
  // explicit characteristic values: all required (ft0 = fm = fc0 only for Tab. 2 species, mat.tabela7190 = 2)
  const tab2 = mat.tabela7190 === 2;
  const X = cls || (mat.fc0k ? { fc0k: mat.fc0k, ft0k: mat.ft0k ?? (tab2 ? mat.fc0k : NaN), fbk: mat.fbk ?? (tab2 ? mat.fc0k : NaN),
    fvk: mat.fvk, E0med: mat.E0med, E005: mat.E005 ?? (mat.E0med > 0 && tab2 ? 0.7 * mat.E0med : NaN) } : null);
  const okX = X && [X.fc0k, X.ft0k, X.fbk, X.fvk, X.E0med, X.E005].every(v => v > 0);
  if (!okX) {
    return finalize({ material: 'madeira', metodo: 'ABNT NBR 7190-1:2022',
      bending: ratObj(Infinity, 1), shear: ratObj(Infinity, 1), axial: ratObj(Infinity, 1), interaction: ratObj(Infinity, 1),
      avisos: ['Madeira sem classe NBR 7190 (mat.classe7190) nem valores característicos completos (fc0k, ft0k, fbk, fvk, E0med, E005): NÃO verificado.'] }, options);
  }
  if (options.kmod1 == null || options.kmod2 == null) avisos.push('kmod1/kmod2 não informados: adotados longa duração (0,70) e classe de umidade 2 (0,90) — confirme (Tab. 4/5).');
  const kmod1 = options.kmod1 ?? 0.70, kmod2 = options.kmod2 ?? 0.90;
  const kmod = kmod1 * kmod2 * (options.kmod3 ?? 1);
  if (options.kmod3 != null) avisos.push('kmod3 (MLC) aplicado como fator adicional de kmod — leitura de 6.7.4.9.');
  const gwN = 1.4, gwV = 1.8;
  const fc0d = kmod * X.fc0k / gwN, ft0d = kmod * X.ft0k / gwN, fmd = kmod * X.fbk / gwN, fvd = kmod * X.fvk / gwV;
  const mlc = !!(options.mlc ?? mat.mlc);
  const bc = mlc ? 0.1 : 0.2;

  const b = sec.b, h = sec.h;
  if (!(b > 0 && h > 0)) { naoVerificado = true; avisos.push('Seção sem b × h: NÃO verificado.'); }
  if (sec.shape && sec.shape !== 'rect') { naoVerificado = true; avisos.push(`Seção "${sec.shape}": a v1 verifica só seção retangular maciça — NÃO verificado.`); }
  const A = sec.A ?? b * h, Sz = sec.Sz ?? b * h * h / 6, Sy = sec.Sy ?? h * b * b / 6;
  const rz = sec.rz ?? h / Math.sqrt(12), ry = sec.ry ?? b / Math.sqrt(12);
  const kM = options.kM ?? 0.7;                                     // 6.3.5, rectangular
  if (options.kM != null && options.kM !== 0.7) avisos.push(`kM = ${options.kM} informado (a NBR 7190-1:2022 6.3.5 dá 0,7 para seção retangular).`);

  const N = demands.N || 0;
  if ((member.Ldefault || member.L == null) && member.Lz0 == null && member.Ly0 == null && (N !== 0 || (demands.Mz || 0) !== 0)) {
    naoVerificado = true; avisos.push('Comprimento da barra não informado: estabilidade/esbeltez NÃO verificadas.');
  }
  const sN = Math.abs(N) / A;
  const sMx = Math.abs(demands.Mz || 0) / Sz, sMy = Math.abs(demands.My || 0) / Sy;
  const tau = 1.5 * Math.hypot(demands.Vy || 0, demands.Vz || 0) / A;   // resultant (6.4.2 silent on biaxial)

  const flex = Math.max(sMx / fmd + kM * sMy / fmd, kM * sMx / fmd + sMy / fmd);
  const bending = ratObj(flex, 1, { adim: true, kM, fmd, formula: 'σMx,d/fm,d + kM·σMy,d/fm,d ≤ 1 (6.3.5)' });
  const shear = ratObj(tau, fvd, { formula: 'τd = 1,5·Vd/A ≤ fv0,d (6.4.2), Vd = √(Vy² + Vz²)' });

  let axial, interaction, estab = null;
  if (N > 0) {
    axial = ratObj(sN, ft0d, { modo: 'tração', formula: 'σNt,d ≤ ft0,d (6.3.2), γw = 1,4' });
    const r = Math.max(sN / ft0d + sMx / fmd + kM * sMy / fmd, sN / ft0d + kM * sMx / fmd + sMy / fmd);
    interaction = ratObj(r, 1, { adim: true, modo: 'flexo-tração', formula: '6.3.6 (linear)' });
    const L0t = member.L || 1;
    if (L0t > 50 * Math.min(b, h)) { naoVerificado = true; avisos.push(`Tração: L0 = ${L0t.toFixed(2)} m > 50 × menor dimensão (9.3) — não permitido.`); }
    avisos.push('Tração: verificada na seção bruta — descontar furos/entalhes (área líquida, 6.3.2).');
  } else {
    const KE = member.KE ?? 1;                                     // Tab. 7 (design.js always fills K = 1: not used)
    if (member.KE == null) avisos.push('KE = 1,0 adotado (Tab. 7: 0,65 a 2,40 conforme os vínculos — em pórtico deslocável KE > 1): informe member.KE.');
    const L = member.L || 1;
    const Lz = member.Lz0 ?? KE * (member.Lx ?? L), Ly = member.Ly0 ?? KE * (member.Ly ?? L);
    const lz = Lz / rz, ly = Ly / ry;
    const lrz = lz / Math.PI * Math.sqrt(X.fc0k / X.E005), lry = ly / Math.PI * Math.sqrt(X.fc0k / X.E005);
    const res = Math.max((sN / fc0d) ** 2 + sMx / fmd + kM * sMy / fmd, (sN / fc0d) ** 2 + kM * sMx / fmd + sMy / fmd);
    let r = res, kcz = 1, kcy = 1;
    if (sN > 0 && (lrz > 0.3 || lry > 0.3)) {
      kcz = kcOf(lrz, bc); kcy = kcOf(lry, bc);
      r = Math.max(res, sN / (kcz * fc0d) + sMx / fmd + kM * sMy / fmd, sN / (kcy * fc0d) + kM * sMx / fmd + sMy / fmd);
    }
    estab = { lambdaZ: lz, lambdaY: ly, lambdaRelZ: lrz, lambdaRelY: lry, kcz, kcy, betac: bc };
    axial = ratObj(sN, Math.min(kcz, kcy) * fc0d, { modo: 'compressão', kc: Math.min(kcz, kcy), formula: 'σNc,d ≤ kc·fc0,d (6.5.5)' });
    interaction = ratObj(r, 1, { adim: true, modo: 'flexo-compressão', formula: '6.3.7 e 6.5.5' });
    if (sN > 0 && Math.max(lz, ly) > 140) { naoVerificado = true; avisos.push(`Esbeltez ${Math.max(lz, ly).toFixed(0)} > 140 (6.5.3) — não permitido.`); }
    if (sN > 0 && (Lz > 40 * h || Ly > 40 * b)) { naoVerificado = true; avisos.push('L0 > 40 × dimensão transversal correspondente (9.3) — não permitido.'); }
  }

  // lateral stability of the beam (6.5.6), compressed edge braced every L1 (default: Lb or L)
  if (sMx > 0 && h / b >= 0.63) {
    const L1 = member.L1 ?? member.Lb ?? member.L ?? 1;
    avisos.push('Estabilidade lateral (6.5.6): admite rotação impedida nos apoios de extremidade (condição a).');
    const E0ef = kmod1 * kmod2 * X.E0med;
    const hb = h / b;
    const betaM = (4 / Math.PI) * (4 / 1.4) * Math.pow(hb, 1.5) / Math.sqrt(Math.max(hb - 0.63, 1e-9));
    const okGeom = L1 / b <= E0ef / (betaM * fmd);
    const sLim = E0ef / ((L1 / b) * betaM);
    const rL = okGeom ? 0 : (sMx + (N < 0 ? sN : 0)) / sLim;     // σc,d: max compression stress
    estab = { ...(estab || {}), L1, betaM: +betaM.toFixed(3), lateralDispensada: okGeom };
    if (!okGeom) interaction = { ...interaction, ratio: +Math.max(interaction.ratio, rL).toFixed(4), demand: +Math.max(interaction.ratio, rL).toFixed(4), formula: interaction.formula + ' + estabilidade lateral (6.5.6)' };
  }

  if (naoVerificado) for (const o of [bending, shear, axial, interaction]) o.ratio = Infinity;
  return finalize({ material: 'madeira', metodo: 'ABNT NBR 7190-1:2022', bending, shear, axial, interaction,
    kmod, fc0d, ft0d, fmd, fvd, estab, avisos }, options);
}

export const nbr7190 = {
  id: 'NBR7190-1:2022', family: 'timber', label: 'ABNT NBR 7190-1:2022',
  check: (input) => checkNBR7190(input),
};
