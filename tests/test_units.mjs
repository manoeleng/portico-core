// test_units.mjs — display units (js/utils/units.js): kN-m identity; tf-m with 1 tf = 9,80665 kN (tonne-force =
// 1000 kgf, standard gravity gₙ = 9,80665 m/s² — definition, BIPM SI Brochure). Every force-bearing kind scales by the
// same factor because the length unit is the metre in both systems.
//   node tests/test_units.mjs
import { setUnits, getUnits, toDisp, fromDisp, ulbl, inVal, readIn, normUnits, KN_PER_TF } from '../js/utils/units.js';

let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-12) => { n++; if (!(Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)))) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
const eq = (name, got, exp) => { n++; if (got !== exp) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };

eq('U0. fator', KN_PER_TF, 9.80665);
eq('U0b. aliases', [normUnits('ton-m'), normUnits('tf'), normUnits('kN-m'), normUnits(undefined)].join(), 'tf-m,tf-m,kN-m,kN-m');
setUnits('kN-m');
ok('U1. kN-m: identidade', toDisp(12.5, 'M'), 12.5); eq('U1b. rótulo', ulbl('W'), 'kN/m');
setUnits('tf-m'); eq('U2. sistema', getUnits(), 'tf-m');
ok('U2b. 9,80665 kN = 1 tf', toDisp(9.80665, 'F'), 1);
ok('U2c. 98,0665 kN·m = 10 tf·m', toDisp(98.0665, 'M'), 10);
ok('U2d. E = 2·10⁸ kN/m² = 2,0394324·10⁷ tf/m²', toDisp(2e8, 'Q'), 2e8 / 9.80665);
ok('U2e. 1 tf/m digitado = 9,80665 kN/m', fromDisp(1, 'W'), 9.80665);
eq('U2f. rótulos', ['F', 'M', 'W', 'Q', 'KR'].map(ulbl).join(' '), 'tf tf·m tf/m tf/m² tf·m/rad');
// inputs: rounded display, exact value back when untouched
const el = (attrs) => { const m = /value="([^"]*)" data-kn="([^"]*)" data-disp="([^"]*)"/.exec(attrs); return { value: m[1], dataset: { kn: m[2], disp: m[3] } }; };
const a = el(inVal(10, 'F'));
eq('U3. campo mostra 6 algarismos', a.value, '1.01972');
ok('U3b. sem edição volta exato (10 kN)', readIn(a, 'F'), 10);
a.value = '2';
ok('U3c. editado: 2 tf = 19,6133 kN', readIn(a, 'F'), 19.6133, 1e-12);
setUnits('kN-m');
const b = el(inVal(0.15, 'Q'));
eq('U4. kN-m: valor exato no campo', b.value, '0.15'); ok('U4b. leitura', readIn(b, 'Q'), 0.15);

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
