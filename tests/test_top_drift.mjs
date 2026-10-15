// test_top_drift.mjs — deslocamento horizontal do topo dos pilares sob vento (ELS)
//   node tests/test_top_drift.mjs
// Oráculo: cálculo manual sobre um pórtico de duas águas sintético (deslocamentos dados).
//   Pilares: (0,0)→(0,6) e (10,0)→(10,6) partindo da base z = 0; montante central (5, 6)→(5, 7) NÃO conta.
//   Vento: topo esquerdo ux = 0,012 m, uy = 0,005 m → Δ = 0,013 m; topo direito ux = 0,010 m; cumeeira 0,050 m.
//   NBR 8800:2024 Tab. B.1, galpão (H/300), rara: Δ/H = 0,013/6 = 0,0021667 → razão 0,0021667·300 = 0,6500
//     frequente (ψ1 = 0,30): 0,0039/6·300 = 0,1950
//   NBR 8800, 2+ pavimentos (H/400), rara: 0,0021667·400 = 0,8667
//   NBR 6118:2026 Tab. 13.3 (H/1 700, sempre frequente): 0,0039/6·1700 = 1,1050 → reprova
import { topDriftCheck } from '../js/design/top_drift.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

const nodes = [{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 0, y: 0, z: 6 }, { id: 3, x: 10, y: 0, z: 0 }, { id: 4, x: 10, y: 0, z: 6 },
  { id: 5, x: 5, y: 0, z: 6 }, { id: 6, x: 5, y: 0, z: 7 }];
const elements = [{ n1: 1, n2: 2 }, { n1: 3, n2: 4 }, { n1: 2, n2: 5 }, { n1: 5, n2: 4 }, { n1: 5, n2: 6 }, { n1: 2, n2: 6 }, { n1: 6, n2: 4 }];
const D = { 2: [0.012, 0.005, 0], 4: [0.010, 0, 0], 6: [0.050, 0, 0] };
const cases = [{ name: 'V0', disp: (id) => D[id] || [0, 0, 0] }];

const r1 = topDriftCheck({ nodes, elements, cases, code: 'NBR8800:2024', singleStory: true });
assert('1a. dois pilares (montante central excluído)', r1.columns === 2, String(r1.columns));
ok('1b. Δ do topo = 0,013 m (pilar esquerdo)', r1.rows[0].delta, 0.013, 1e-9);
ok('1c. H = 6 m (altura do pilar, não da cumeeira)', r1.rows[0].H, 6, 1e-12);
ok('1d. NBR 8800 galpão, rara: razão 0,6500', r1.rows[0].ratio, 0.65, 1e-6);
ok('1e. valor frequente informado = 0,3·Δ', r1.rows[0].freq, 0.0039, 1e-9);
const r2 = topDriftCheck({ nodes, elements, cases, code: 'NBR8800:2024', singleStory: true, combo: 'frequente' });
ok('2. NBR 8800 galpão, frequente: razão 0,1950', r2.rows[0].ratio, 0.195, 1e-6);
const r3 = topDriftCheck({ nodes, elements, cases, code: 'NBR8800:2024', singleStory: false });
ok('3. NBR 8800 2+ pavimentos (H/400), rara: razão 0,8667', r3.rows[0].ratio, 0.86667, 1e-4);
const r4 = topDriftCheck({ nodes, elements, cases, code: 'NBR6118:2026', combo: 'rara' });
assert('4a. NBR 6118 força a combinação frequente', r4.combo === 'frequente');
ok('4b. NBR 6118 H/1700: razão 1,1050 (reprova)', r4.rows[0].ratio, 1.105, 1e-6);
const r5 = topDriftCheck({ nodes, elements, cases, code: 'NCh433' });
assert('5. norma sem limite de topo → razão NaN (não verificado)', Number.isNaN(r5.rows[0].ratio));

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
