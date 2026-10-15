// test_preset_brasil.mjs — preset Brasil (PLANO_BRASIL 8.3): vento NBR 6123:2023 e sismo NBR 15421:2023
//   node assistant/test_preset_brasil.mjs
// Vento — galpão 25 × 54 m, cumeeira 7,25 m, V0 = 40 m/s, categoria IV, S1 = S3 = 1 (memorial do curso
// "Calculista de Aço", Módulo 16; cálculo manual com a Tab. 1 da 2023):
//   classe C (54 m > 50 m): bm = 0,84; Fr = 0,95; p = 0,135 → S2 = 0,84·0,95·(0,725)^0,135 = 0,7641
//   Vk = 30,56 m/s → q = 0,613·Vk² = 572,6 N/m² (memorial: 0,57 kN/m²)
//   paredes, h/b = 0,29 ≤ 1/2, a/b = 2,16 (linha 2 ≤ a/b ≤ 4): A = +0,7; B = −0,5 (memorial: A +0,70, B −0,50)
// Sismo — o espectro do assistente deve coincidir com js/design/spectra/nbr15421.js.
import { readFileSync } from 'node:fs';
import { windLoad, responseSpectrum } from './loads.js';
import { buildSpectrum15421 } from '../js/design/spectra/nbr15421.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c) => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}`); };
const reglas = JSON.parse(readFileSync(new URL('../presets/brasil/rules.json', import.meta.url), 'utf8'));

const ficha = { wind: { V0_m_s: 40, categoria: 'IV', grupoS3: '3', a_m: 54, b_m: 25 }, geometry: { roof_slope_deg: 5.71 } };
const v = windLoad(ficha, reglas, 7.25);
assert('1a. classe C', v.classe === 'C');
ok('1b. S2 = 0,7641', v.S2, 0.7641, 0.001);
ok('1c. q = 572,6 N/m² (memorial 0,57 kN/m²)', v.q_Nm2, 572.6, 0.002);
ok('1d. Cpe parede barlavento A = +0,7', v.cpe_paredes.A, 0.7, 1e-9);
ok('1e. Cpe parede sotavento B = −0,5', v.cpe_paredes.B, -0.5, 1e-9);
ok('1f. pressão líquida barlavento − sotavento = q·1,2', v.presiones['1'] - v.presiones['4'], 572.6 * 1.2, 0.003);
const v2 = windLoad({ wind: { categoria: 'IV' } }, reglas, 7.25);
assert('1g. sem V0 → vento não calculado (aviso)', v2.q_Nm2 === 0 && v2._notas.some(n => /V0/.test(n)));

for (const [ag, soil] of [[0.10, 'D'], [0.125, 'E'], [0.05, 'C']]) {
  const a = responseSpectrum({ seismic: { ag, soil, category: 'II' } }, reglas, { Tmax: 3, dT: 0.05 });
  const b = buildSpectrum15421({ ag, classe: soil, categoria: 'II', dT: 0.05 });
  const maxDiff = Math.max(...a.curva.map((q, i) => Math.abs(q.Sa - b.curve[i].Sa)));
  assert(`2. espectro assistente = módulo do app (ag ${ag}, ${soil}) · máx. dif ${maxDiff}`, maxDiff < 1e-9 && a.curva.length === b.curve.length);
}
console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
