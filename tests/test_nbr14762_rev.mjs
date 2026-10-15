// test_nbr14762_rev.mjs — achados da revisão do especialista (15/10/2026) no caminho real checkElement
//   node tests/test_nbr14762_rev.mjs
// C1: sem L a barra não pode ser verificada com L = 1 m (design.js preenche Lb/K/Cb por padrão).
// I1: T ≠ 0 → NÃO verificado (a NBR 14762:2010 não trata torção de seção aberta).
// I3: tração com L/r > 300 → aviso (9.6.3, "recomenda-se").
// I4: L 80x4,25 — NBR 6355:2012 p.18: I1 = 66,82, I2 = 15,69 cm⁴ → Ix = Iy = 41,26 cm⁴.
import { checkElement } from '../js/design/design.js';
import { profileToSection } from '../js/design/profiles.js';
import { cfSection, cfNames } from '../js/design/profiles_cf.js';

let fails = 0;
const assert = (name, c) => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}`); };
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const mat = { name: 'ZAR250', family: 'steel', Fy: 250e3, Fu: 360e3, E: 200e6, G: 77e6, nu: 0.3 };
const sec = profileToSection('Ue 150x60x20x3,00');
const run = (forces, member) => checkElement({ forces, sec, mat, codeId: 'NBR14762:2010', member });

const r0 = run({ N: -20 });
assert('C1a. compressão sem L → não verificada (antes: 0,13 "cumple" com L = 1 m)', r0.axial.verificado === false && r0.state === 'NO CUMPLE');
const r1 = run({ N: -20, L: 4 });
assert('C1b. com L = 4 m a compressão é verificada', r1.axial.verificado !== false && r1.axial.ratio > 0.4);
assert('C1c. aviso K = 1,0 dispara via checkElement', r1.avisos.some(a => /K = 1,0 adotado/.test(a)));
const r2 = run({ Mz: 2 });
assert('C1d. flexão sem L → FLT não verificada', r2.flexaoX.verificado === false);
const r3 = run({ Mz: 2, L: 4 });
assert('D3. aviso Cb = 1,0 dispara via checkElement', r3.avisos.some(a => /Cb = 1,0/.test(a)));
assert('I2. aviso de carga fora do centro de torção', r3.avisos.some(a => /centro de torção/.test(a)));
const r4 = run({ N: -3, T: 5, L: 4 });
assert('I1. T ≠ 0 → NÃO verificado', r4.ratioMax === Infinity && r4.avisos.some(a => /torção/.test(a)));
const r5 = run({ N: 10, L: 12 });
assert('I3. tração L/r > 300 → aviso 9.6.3', r5.avisos.some(a => /9\.6\.3/.test(a)));
const r6 = run({ N: 10, L: 3 });
assert('I3b. tração L/r ≤ 300 → sem aviso', !r6.avisos.some(a => /9\.6\.3/.test(a)));
// re-revisão: member.L sem forces.L deve dar a mesma FLT que forces.L (antes: Lb = 1 m injetado)
const secB = profileToSection('Ue 100x50x17x1,20');
const fl = (forces, member) => checkElement({ forces, sec: secB, mat, codeId: 'NBR14762:2010', member }).flexaoX.ratio;
const a6 = fl({ Mz: 0.5, L: 6 }), b6 = fl({ Mz: 0.5 }, { L: 6 }), c6 = fl({ Mz: 0.5 }, { Lb: 6 });
ok('R1. member.L = 6 ≡ forces.L = 6 (FLT)', b6, a6, 1e-9);
ok('R2. member.Lb = 6 sem L ≡ forces.L = 6 (FLT)', c6, a6, 1e-9);
assert('R3. member.Lb sem L: compressão não verificada', run({ N: -20 }, { Lb: 6 }).axial.verificado === false);
const L80 = cfSection('L 80x4,25');
ok('I4. L 80x4,25 Iz = 41,26 cm⁴', L80.Iz * 1e8, 41.26, 1e-3);
const nanList = cfNames().filter(n => { const c = cfSection(n); return !(c.Iz > 0 && c.Iy > 0 && c.A > 0); });
assert(`I4b. nenhum perfil L/Ue com A/Iz/Iy inválido (${nanList.join(', ') || 'nenhum'})`, nanList.length === 0);

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
