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
  const a = responseSpectrum({ seismic: { ag, soil, category: 'II', R: 3 } }, reglas, { Tmax: 3, dT: 0.05 });
  const b = buildSpectrum15421({ ag, classe: soil, categoria: 'II', dT: 0.05 });
  const maxDiff = Math.max(...a.curva.map((q, i) => Math.abs(q.Sa - b.curve[i].Sa)));
  assert(`2. espectro assistente = módulo do app (ag ${ag}, ${soil}) · máx. dif ${maxDiff}`, maxDiff < 1e-9 && a.curva.length === b.curve.length);
}
// Revisão do especialista (achados I-1 a I-4)
// I-1: Tab. 3 — S2 constante abaixo de 5 m. Galpão 30 × 15 m, h = 3 m → classe B (30 m), z = 5 m:
//   S2 = 0,85·0,98·(5/10)^0,125 = 0,7639 (a fórmula com z = 3 m daria 0,7166 — 6 % menor)
const vb = windLoad({ ...ficha, wind: { ...ficha.wind, a_m: 30, b_m: 15 } }, reglas, 3.0);
ok('3a. h = 3 m: S2 no valor de z = 5 m (Tab. 3)', vb.S2, 0.85 * 0.98 * Math.pow(0.5, 0.125), 0.001);
// I-3: empena (α = 0°) com a classe pela face b = 25 m → B: S2 = 0,85·0,98·0,725^0,125 = 0,8002
assert('3b. classe da empena = B', v.classe_empena === 'B');
ok('3c. S2 da empena (classe B) = 0,8002', v.S2_empena, 0.85 * 0.98 * Math.pow(0.725, 0.125), 0.001);
// I-2: categoria de utilização fora de I–III → erro (não vira I = 1,0); R obrigatório
let erro = false; try { responseSpectrum({ seismic: { ag: 0.1, soil: 'D', category: 'IV', R: 3 } }, reglas); } catch { erro = true; }
assert('3d. categoria "IV" (NCh433) recusada na NBR 15421', erro);
let erroR = false; try { responseSpectrum({ seismic: { ag: 0.1, soil: 'D', category: 'II' } }, reglas); } catch { erroR = true; }
assert('3e. R não informado → erro', erroR);
// I-4: aviso do Cpi padrão
assert('3f. aviso do Cpi padrão (cobertura impermeável)', v._notas.some(n => /cobertura imperme/.test(n)));

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
