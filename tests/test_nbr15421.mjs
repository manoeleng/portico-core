// test_nbr15421.mjs — BR-15421-01: espectro de projeto da NBR 15421:2023 (6.3), cálculo manual
//   node tests/test_nbr15421.mjs
// Zona 2, ag = 0,10 g, terreno D: Ca = 1,6; Cv = 2,4 (Tab. 3) → ags0 = 0,160 g; ags1 = 2,4·0,75·0,10 = 0,180 g;
// Cv/Ca = 1,5 → faixas em 0,06 / 0,45 / 3,0 s. Sa(0) = 0,160; Sa(0,5) = 0,18/0,5 = 0,360; Sa(1,0) = 0,180;
// Sa(2,0) = 0,090; Sa(4,0) = 2·1,5·0,18/16 = 0,03375; platô 2,5·0,16 = 0,400.
// Interpolação ag = 0,125 g, terreno D: Ca = 1,55; Cv = 2,30.
import { buildSpectrum15421, sa15421, zone15421, category15421 } from '../js/design/spectra/nbr15421.js';
import { getSpectrum } from '../js/design/spectra/index.js';

let fails = 0;
const ok = (name, got, exp, tol = 1e-9) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c) => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}`); };
const p = { ag: 0.10, Ca: 1.6, Cv: 2.4 };
ok('1a. Sa(0) = 0,160 g', sa15421(0, p), 0.160);
ok('1b. platô Sa(0,2) = 0,400 g', sa15421(0.2, p), 0.400);
ok('1c. Sa(0,5) = 0,360 g', sa15421(0.5, p), 0.360);
ok('1d. Sa(1,0) = 0,180 g', sa15421(1.0, p), 0.180);
ok('1e. Sa(2,0) = 0,090 g', sa15421(2.0, p), 0.090);
ok('1f. Sa(4,0) = 0,03375 g (ramo 1/T², novo na 2023)', sa15421(4.0, p), 0.03375);
ok('1g. continuidade em 3,0 s', sa15421(3.0, p), 0.18 / 3.0, 1e-9);
const s = buildSpectrum15421({ ag: 0.125, classe: 'D', categoria: 'II', R: 3, Cd: 2.5 });
ok('2a. Ca interpolado (0,125 g, D) = 1,55', s.params.Ca, 1.55);
ok('2b. Cv interpolado = 2,30', s.params.Cv, 2.30);
ok('2c. I categoria II = 1,25', s.params.I, 1.25);
ok('2d. fator de forças I/R = 1,25/3', s.fatorForcas, 1.25 / 3);
assert('3a. zonas (Tab. 1)', zone15421(0.02) === 0 && zone15421(0.04) === 1 && zone15421(0.08) === 2 && zone15421(0.12) === 3 && zone15421(0.15) === 4);
assert('3b. categoria sísmica (Tab. 5)', category15421(1) === 'A' && category15421(2) === 'B' && category15421(4) === 'C');
let errF = false; try { buildSpectrum15421({ ag: 0.1, classe: 'F' }); } catch { errF = true; }
assert('3c. terreno F exige estudo específico (erro)', errF);
assert('3d. registrado no registro de espectros', !!getSpectrum('NBR15421:2023'));
console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
