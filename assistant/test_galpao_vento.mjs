// test_galpao_vento.mjs — vento NBR 6123:2023 no gerador de galpão (preset Brasil)
//   node assistant/test_galpao_vento.mjs
// Oráculo: cálculo manual independente (Python, fora do código). Galpão 15 × 30 m, H = 6 m, inclinação 10 %
// (θ = 5,711°, h = 6,75 m), pórticos a cada 5 m, V0 = 40 m/s, categoria IV, grupo S3 = 3 (S3 = 1).
//   α = 90°: classe B (30 m) → S2 = 0,7931, q = 616,87 N/m²; α = 0°: classe A (15 m) → S2 = 0,8204, q = 660,10 N/m²
//   Tab. 6 (h/b = 0,45; a/b = 2): A +0,7, B −0,5; A1B1 −0,8; C +0,7; D −0,3; A3B3 (Nota 3, a/b = 2) −0,2
//   Tab. 7 (h/b ≤ 1/2, θ 5,711° entre 5° e 10°): EFI −0,9426, GHJ −0,4; IJ (Nota 3, a/b = 2) −0,2
//   x0 = min(max(b/3, a/4), 2h) = 7,5 m → pórticos y = 0, 5 região 1; 10, 15 região 2; 20, 25, 30 região 3.
import fs from 'node:fs';
import { parseCSV } from '../js/utils/csv.js';
import { generateModel } from './generator.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const BR = { reglas: JSON.parse(rd('../presets/brasil/rules.json')), perfiles: parseCSV(rd('../presets/brasil/profiles.csv')),
  materiales: parseCSV(rd('../presets/brasil/materials.csv')), sobrecargas: parseCSV(rd('../presets/brasil/live_loads.csv')) };

const m = generateModel({ typology: 'galpão', sections: { material: 'MR250', columns: 'W 250 x 32,7' },
  warehouse: { span_m: 15, length_m: 30, column_height_m: 6, frame_spacing_m: 5, slope_pct: 10, chord_size: 'W 150 x 13,0', diagonal_size: 'W 150 x 13,0' },
  loads: { dead_extra_kN_m2: 0.15, live_load_kN_m2: 0.25, wind: true }, wind: { V0_m_s: 40, categoria: 'IV', grupoS3: '3' } }, BR);

const node = (id) => m.nodes[id - 1];
const col = (x, y) => m.elements.find(e => { const a = node(e.n1), b = node(e.n2); return e.secId === 1 && Math.abs(a.x - x) < 1e-6 && Math.abs(b.x - x) < 1e-6 && Math.abs(a.y - y) < 1e-6; }).id;
const lc = (name) => m.loadCases.find(l => l.name === name);
const load = (l, elemId, dir) => l.loads.filter(q => q.elemId === elemId && q.dir === dir).reduce((s, q) => s + q.w, 0);
const firstTop = (y) => {                       // windward roof element of the frame at y: top chord from the eave x = 0
  const eave = m.nodes.find(n => Math.abs(n.x) < 1e-6 && Math.abs(n.y - y) < 1e-6 && Math.abs(n.z - 6) < 1e-6).id;
  return m.elements.find(e => (e.n1 === eave || e.n2 === eave) && e.secId === 2 && node(e.n1 === eave ? e.n2 : e.n1).z > 6 + 1e-9).id;
};

assert('0. quatro casos de vento (X, Y × Cpi −0,3 e 0)', ['Viento X (Cpi -0,3)', 'Viento Y (Cpi -0,3)', 'Viento X (Cpi 0)', 'Viento Y (Cpi 0)'].every(n => lc(n)), m.loadCases.map(l => l.name).join(', '));
for (const [cpi, cX0, cXL, rgx, rgz, sY0, gC, gD, s25, r25] of [
  ['-0,3', 3.084370, 0.616874, -0.197229, -1.972289, -0.825126, 4.950756, 0, 0.330050, 0.328412],
  ['0', 2.159059, 1.542185, -0.289301, -2.893007, -1.320202, 3.465529, 1.485227, -0.660101, -0.656825],
]) {
  const X = lc(`Viento X (Cpi ${cpi})`), Y = lc(`Viento Y (Cpi ${cpi})`);
  ok(`Cpi ${cpi} X: pilar barlavento y=10 (A, kN/m)`, load(X, col(0, 10), 'globalX'), cX0, 2e-4);
  ok(`Cpi ${cpi} X: pilar sotavento y=10 (B)`, load(X, col(15, 10), 'globalX'), cXL, 2e-4);
  ok(`Cpi ${cpi} X: telhado barlavento y=10 (EFI) componente X`, load(X, firstTop(10), 'globalX'), rgx, 1e-3);   // Cpe interpolado arredondado a 3 casas em loads.js (−0,943 × −0,94263)
  ok(`Cpi ${cpi} X: telhado barlavento y=10 (EFI) componente vertical`, load(X, firstTop(10), 'gravity'), rgz, 1e-3);
  ok(`Cpi ${cpi} Y: parede lateral y=0 (A1B1, trib 2,5)`, load(Y, col(0, 0), 'globalX'), sY0, 2e-4);
  ok(`Cpi ${cpi} Y: empena C em y=0 (pilar, trib 7,5)`, load(Y, col(0, 0), 'globalY'), gC, 2e-4);
  if (gD) ok(`Cpi ${cpi} Y: empena D em y=30`, load(Y, col(0, 30), 'globalY'), gD, 2e-4);
  else assert(`Cpi ${cpi} Y: empena D em y=30 nula (Cpe −0,3 = Cpi)`, Math.abs(load(Y, col(0, 30), 'globalY')) < 1e-9);
  ok(`Cpi ${cpi} Y: parede lateral y=25 (A3B3, região 3)`, load(Y, col(0, 25), 'globalX'), s25, 2e-4);
  ok(`Cpi ${cpi} Y: telhado y=25 (IJ) vertical`, load(Y, firstTop(25), 'gravity'), r25, 2e-4);
}
const ids = Object.fromEntries(m.loadCases.map(l => [l.name, l.id]));
assert('5. combinações com cada vento como principal (1,35G + 1,4V)', m.combinations.filter(c => c.factors.some(f => f.factor === 1.4)).length >= 4, m.combinations.map(c => c.name).join(' | '));
assert('6. G favorável 1,0G + 1,4V (sucção)', m.combinations.some(c => c.factors.some(f => f.lcId === ids.CM && f.factor === 1) && c.factors.some(f => f.factor === 1.4)));

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
