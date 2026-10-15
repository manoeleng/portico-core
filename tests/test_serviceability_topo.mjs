// test_serviceability_topo.mjs — deslocamento horizontal do topo (PLANO_BRASIL, pendência da fase 2)
//   node tests/test_serviceability_topo.mjs
// Oráculo: NBR 6118:2026 Tab. 13.3 (H/1 700, comb. frequente) e NBR 8800:2024 Tab. B.1 (H/400 para
// 2+ pavimentos; H/300 galpões e edificações de um pavimento), lidas no texto das normas do acervo.
import { checkTopDrift, topDriftLimit } from '../js/design/serviceability.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

ok('1a. NBR 6118 H/1700', topDriftLimit('NBR6118:2026'), 1 / 1700, 1e-12);
ok('1b. NBR 8800 multipavimento H/400', topDriftLimit('NBR8800:2024'), 1 / 400, 1e-12);
ok('1c. NBR 8800 galpão H/300', topDriftLimit('NBR8800:2024', { singleStory: true }), 1 / 300, 1e-12);
assert('1d. norma sem limite → null', topDriftLimit('NCh433') === null);
// Edifício de concreto H = 30 m, Δtopo = 15 mm: limite 30/1700 = 17,65 mm → razão 0,85
{ const r = checkTopDrift({ delta: -0.015, H: 30, code: 'NBR6118:2026' });
  ok('2a. razão 15/17,65', r.ratio, 0.85, 1e-3); assert('2b. fórmula cita 1/1700', /1\/1700/.test(r.formula)); }
// Galpão H = 8 m, Δtopo = 30 mm: limite 8/300 = 26,67 mm → razão 1,125 (reprova)
{ const r = checkTopDrift({ delta: 0.030, H: 8, code: 'NBR8800:2024', singleStory: true });
  ok('3. galpão razão 1,125', r.ratio, 1.125, 1e-3); }
{ const r = checkTopDrift({ delta: 0.01, H: 10, code: 'NCh433' });
  assert('4. sem limite → não verificado (NaN), nunca aprova em silêncio', Number.isNaN(r.ratio) && r.limit === null); }

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
