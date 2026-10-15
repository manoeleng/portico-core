// test_nbr15421_curva.mjs — curva de projeto para a análise espectral (NBR 15421:2023 6.3 + seção 10)
//   node tests/test_nbr15421_curva.mjs
// Oráculo: cálculo manual. ag = 0,10 g, classe D (Tab. 3: Ca = 1,6, Cv = 2,4), categoria II (I = 1,25),
// R = 3, Cd = 2,5 → I/R = 0,41667; Cv/Ca = 1,5.
//   T = 0:   ags0 = 0,16 g            → 0,16·0,41667 = 0,066667
//   T = 0,3: platô 2,5·ags0 = 0,40     → 0,166667
//   T = 1,0: ags1/T = 2,4·0,75·0,10/1 = 0,18 → 0,075
//   T = 3,0: = 2·Cv/Ca → ags1/T = 0,06 → 0,025
import { designCurve15421 } from '../js/design/spectra/nbr15421.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

const r = designCurve15421({ ag: 0.10, classe: 'D', categoria: 'II', R: 3, Cd: 2.5 });
const pts = Object.fromEntries(r.text.split('\n').map(l => l.split(',').map(Number)).map(([T, Sa]) => [T.toFixed(2), Sa]));
ok('1. fator I/R', r.fator, 1.25 / 3, 1e-9);
ok('2. Sa(0)·I/R', pts['0.00'], 0.066667, 1e-3);
ok('3. Sa(0,30)·I/R (platô)', pts['0.30'], 0.166667, 1e-3);
ok('4. Sa(1,00)·I/R', pts['1.00'], 0.075, 1e-3);
ok('5. Sa(3,00)·I/R', pts['3.00'], 0.025, 1e-3);
assert('6. nota traz Cd/I = 2,000 para os deslocamentos', /Cd\/I = 2\.000/.test(r.nota), r.nota);
{ const e = designCurve15421({ ag: 0.10, classe: 'D', categoria: 'II' });
  assert('7. sem R → elástico (fator 1) e nota avisa', e.fator === 1 && /ELÁSTICO/.test(e.nota)); }

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
