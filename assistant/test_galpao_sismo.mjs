// test_galpao_sismo.mjs — sismo NBR 15421:2023 no gerador de galpão (preset Brasil), categoria sísmica A
//   node assistant/test_galpao_sismo.mjs
// Norma (imagem da pág. 21 do PDF do acervo, 7.3.1 Tab. 5 e 7.3.2): zonas 0 e 1 → categoria A; zona 0: nenhum
// requisito de resistência sísmica; zona 1: Fx = 0,01·wx aplicadas simultaneamente a todos os pisos, independentemente
// em cada uma de duas direções ortogonais (25 % da variável só em armazenamento/estacionamento).
// Oráculo independente: W = cobertura em projeção horizontal (CM 0,15 kN/m² × 15 m × 30 m = 67,5 kN) + peso
// próprio recalculado da geometria (Σ ρ·A·g·L de cada barra, g = 9,80665 como o solver) → ΣFx = ΣFy = 0,01·W.
import fs from 'node:fs';
import { parseCSV } from '../js/utils/csv.js';
import { generateModel } from './generator.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const BR = { reglas: JSON.parse(rd('../presets/brasil/rules.json')), perfiles: parseCSV(rd('../presets/brasil/profiles.csv')),
  materiales: parseCSV(rd('../presets/brasil/materials.csv')), sobrecargas: parseCSV(rd('../presets/brasil/live_loads.csv')) };
const gen = (seismic) => generateModel({ typology: 'galpão', sections: { material: 'MR250', columns: 'W 250 x 32,7' },
  warehouse: { span_m: 15, length_m: 30, column_height_m: 6, frame_spacing_m: 5, slope_pct: 10, chord_size: 'W 150 x 13,0', diagonal_size: 'W 150 x 13,0' },
  loads: { dead_extra_kN_m2: 0.15, live_load_kN_m2: 0.25, seismic: true }, seismic }, BR);

{
  const m = gen({ zona: 1 });
  const X = m.loadCases.find(l => /^Sismo X/.test(l.name)), Y = m.loadCases.find(l => /^Sismo Y/.test(l.name));
  assert('S0. zona 1: casos Sismo X e Sismo Y', !!X && !!Y, m.loadCases.map(l => l.name).join(', '));
  const N = new Map(m.nodes.map(n => [n.id, n])), S = new Map(m.sections.map(s => [s.id, s])), rho = m.materials[0].rho;
  const L = (e) => { const a = N.get(e.n1), b = N.get(e.n2); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); };
  const SW = m.elements.reduce((s, e) => s + rho * S.get(e.secId).A * 9.80665 * L(e), 0);
  const W = 0.15 * 15 * 30 + SW;
  const E = new Map(m.elements.map(e => [e.id, e]));
  const sum = (lc, dir) => lc.loads.filter(q => q.dir === dir).reduce((s, q) => s + q.w * L(E.get(q.elemId)), 0);
  ok('S1. ΣFx = 0,01·W (7.3.2)', sum(X, 'globalX'), 0.01 * W, 1e-4);
  ok('S1b. ΣFy = 0,01·W (direção ortogonal, caso separado)', sum(Y, 'globalY'), 0.01 * W, 1e-4);
  assert('S1c. sem componente cruzada (X só globalX, Y só globalY)', X.loads.every(q => q.dir === 'globalX') && Y.loads.every(q => q.dir === 'globalY'));
  assert('S2. combinações NBR com sismo (excepcional)', m.combinations.some(c => /E0/.test(c.name)) && m.combinations.some(c => /E90/.test(c.name)), m.combinations.map(c => c.name).filter(n => /E/.test(n)).join(' | '));
}
{
  const m = gen({ zona: 0 });
  assert('S3. zona 0: nenhum caso de sismo', !m.loadCases.some(l => /^Sismo/.test(l.name)));
  assert('S3b. zona 0: aviso "nenhum requisito" (7.3.2)', (m._warnings || []).some(w => /zona sísmica 0/.test(w.msg)));
  const m1 = gen({ ag_g: 0.04 });
  assert('S4. ag = 0,04g → zona 1 (Tab. 1)', m1.loadCases.some(l => /^Sismo X/.test(l.name)));
  const m2 = gen({ zona: 2 });
  assert('S5. zona 2: não gerado, com aviso (categoria B, seção 9)', !m2.loadCases.some(l => /^Sismo/.test(l.name)) && (m2._warnings || []).some(w => /categoria B/.test(w.msg)));
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
