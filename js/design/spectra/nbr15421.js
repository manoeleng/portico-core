// ──────────────────────────────────────────────────────────────────────────────
// spectra/nbr15421.js — Design response spectrum of ABNT NBR 15421:2023 (PLANO_BRASIL 5.6).
//
//   · Zones (Tab. 1): ag 0,025 g (zone 0) · 0,025–0,05 (1) · 0,05–0,10 (2) · 0,10–0,15 (3) · 0,15 g (4)
//   · Ground classes A–E (Tab. 2); Ca, Cv (Tab. 3), linear interpolation for 0,10 g ≤ ag ≤ 0,15 g;
//     class F requires a site-specific study (not supported)
//   · 6.3: ags0 = Ca·ag; ags1 = Cv·0,75·ag (the 0,75 factor is NEW in the 2023 edition)
//       Sa = ags0·(37,5·T·Ca/Cv + 1)      0 ≤ T ≤ 0,04·Cv/Ca
//       Sa = 2,5·ags0                     0,04·Cv/Ca ≤ T ≤ 0,3·Cv/Ca
//       Sa = ags1/T                       0,3·Cv/Ca ≤ T ≤ 2,0·Cv/Ca
//       Sa = 2·(Cv/Ca)·ags1/T²            T ≥ 2,0·Cv/Ca
//   · Importance I (Tab. 4): 1,0 / 1,25 / 1,50; seismic category (Tab. 5): zones 0–1 A, 2 B, 3–4 C
//   · Section 10: the spectrum is NOT divided by R/I; forces × I/R, displacements × Cd/R (returned as
//     fatorForcas / fatorDeslocamentos for the caller)
// Units: Sa in g. Checked against the 2023 PDF pages 10–11 (6.3, Tab. 3).
// ──────────────────────────────────────────────────────────────────────────────

const CA = { A: [0.8, 0.8], B: [1.0, 1.0], C: [1.2, 1.2], D: [1.6, 1.5], E: [2.5, 2.1] };
const CV = { A: [0.8, 0.8], B: [1.0, 1.0], C: [1.7, 1.7], D: [2.4, 2.2], E: [3.5, 3.4] };
export const NBR15421_I = { I: 1.0, II: 1.25, III: 1.5 };

const interp = ([a10, a15], ag) => ag <= 0.10 ? a10 : ag >= 0.15 ? a15 : a10 + (a15 - a10) * (ag - 0.10) / 0.05;
export function zone15421(ag) { return ag <= 0.025 ? 0 : ag <= 0.05 ? 1 : ag <= 0.10 ? 2 : ag < 0.15 ? 3 : 4; }
export function category15421(zone) { return zone <= 1 ? 'A' : zone === 2 ? 'B' : 'C'; }

export function sa15421(T, { ag, Ca, Cv }) {
  const ags0 = Ca * ag, ags1 = Cv * 0.75 * ag, r = Cv / Ca;
  if (T <= 0.04 * r) return ags0 * (37.5 * T * Ca / Cv + 1.0);
  if (T <= 0.3 * r) return 2.5 * ags0;
  if (T <= 2.0 * r) return ags1 / T;
  return 2 * r * ags1 / (T * T);
}

/**
 * @param {object} o  { ag (g, characteristic), classe 'A'..'E', categoria 'I'|'II'|'III', R, Cd, Tmax=3, dT=0.05 }
 * @returns {{ curve:{T,Sa}[], text, Sa0, params, fatorForcas, fatorDeslocamentos }}
 */
export function buildSpectrum15421({ ag, classe = 'D', categoria = 'II', R = null, Cd = null, Tmax = 3.0, dT = 0.05 } = {}) {
  if (!(ag > 0)) throw new Error('nbr15421: ag (g) is required');
  const k = String(classe).toUpperCase();
  if (k === 'F') throw new Error('nbr15421: ground class F requires a site-specific study (6.2)');
  if (!CA[k]) throw new Error(`nbr15421: ground class "${classe}" not in Tab. 2/3`);
  const I = NBR15421_I[categoria];
  if (I == null) throw new Error(`nbr15421: category "${categoria}" not in Tab. 4`);
  const Ca = interp(CA[k], ag), Cv = interp(CV[k], ag);
  const zona = zone15421(ag), catSismica = category15421(zona);
  const curve = [];
  for (let T = 0; T <= Tmax + 1e-9; T += dT) { const Tr = +T.toFixed(4); curve.push({ T: Tr, Sa: +sa15421(Tr, { ag, Ca, Cv }).toFixed(6) }); }
  return {
    curve, text: curve.map(q => `${q.T.toFixed(2)}, ${q.Sa.toFixed(4)}`).join('\n'),
    Sa0: +(Ca * ag).toFixed(6),
    params: { ag, classe: k, categoria, I, Ca: +Ca.toFixed(4), Cv: +Cv.toFixed(4), ags0: Ca * ag, ags1: Cv * 0.75 * ag, zona, catSismica, R, Cd },
    fatorForcas: R ? I / R : null, fatorDeslocamentos: R && Cd ? Cd / R : null,
    avisos: catSismica === 'A' ? ['Categoria sísmica A (zonas 0–1): zona 0 sem requisito; zona 1 com forças horizontais Fx = 0,01·wx (7.3.2) — análise espectral não exigida.'] : [],
  };
}

/**
 * Curve to feed the response-spectrum analysis (UI "Gerar curva"): section 10 scales the FORCES by I/R;
 * modal superposition is linear, so the curve Sa·I/R gives the design forces directly. Without R the
 * elastic curve is returned. Displacements of that analysis must be multiplied by Cd/I (section 10:
 * elastic displacements × Cd/R; the curve already carries I/R).
 * @returns {{ text, fator, nota, base }}  base = buildSpectrum15421 result
 */
export function designCurve15421(o) {
  const base = buildSpectrum15421(o);
  const f = base.fatorForcas ?? 1;
  const text = base.curve.map(q => `${q.T.toFixed(2)}, ${(q.Sa * f).toFixed(5)}`).join('\n');
  const p = base.params;
  const nota = base.fatorForcas
    ? `Sa·I/R (I = ${p.I}, R = ${p.R}) · Ca = ${p.Ca}, Cv = ${p.Cv}, zona ${p.zona}, categoria sísmica ${p.catSismica}.` +
      (p.Cd ? ` Deslocamentos da análise × Cd/I = ${(p.Cd / p.I).toFixed(3)}.` : ' Informe Cd para os deslocamentos (× Cd/I).')
    : `Espectro ELÁSTICO (sem R) · Ca = ${p.Ca}, Cv = ${p.Cv}, zona ${p.zona}, categoria sísmica ${p.catSismica}.`;
  return { text, fator: f, nota, base };
}
