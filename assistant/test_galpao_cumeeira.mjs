// test_galpao_cumeeira.mjs — galpão com terça de cumeeira DUPLA (uma por água), afastamento definido no lançamento
//   node assistant/test_galpao_cumeeira.mjs
// Oráculos independentes do código:
//  (a) geometria à mão: vão 15 m, inclinação 10 % → θ = atan(0,10) = 5,7106°; gap 0,15 m → terças em
//      x = 7,5 ∓ 0,075 = 7,425 / 7,575 m, z = 6 + 0,10·7,425 = 6,7425 m; nenhuma terça no ápice (x = 7,5).
//  (b) orientação: o eixo local y (alma) de cada terça é paralelo à normal da SUA água, n = (∓sen θ, 0, cos θ)
//      (|ey·n| = 1), tomado dos eixos locais do solver (timoshenko.js localAxes com o β gerado).
//  (c) estática: carga de telhado CM por pórtico = qCM·faixa·vão (projeção horizontal) — igual com terça simples
//      ou dupla (dividir o banzo não muda a carga) e ΣR + ΣF = 0 no solver real.
//  (d) correntes (1 linha por vão): T2 de cada água chega à terça da cumeeira da MESMA água.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCSV } from '../js/utils/csv.js';
import { generateModel } from './generator.js';

const dir = path.dirname(fileURLToPath(import.meta.url)); const raiz = path.resolve(dir, '..');
let fails = 0;
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
const rd = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const BR = { reglas: JSON.parse(rd('presets/brasil/rules.json')), perfiles: parseCSV(rd('presets/brasil/profiles.csv')),
  materiales: parseCSV(rd('presets/brasil/materials.csv')), sobrecargas: parseCSV(rd('presets/brasil/live_loads.csv')) };
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(raiz, 'lib', 'numeric.js'), 'utf8'));
const tmp = path.join(dir, '_gcum_tmp'); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} fs.mkdirSync(tmp, { recursive: true });
const buscarEn = ['js/solver', 'js/model', 'js']; const localizar = (b) => { for (const d of buscarEn) { const p = path.join(raiz, d, b); if (fs.existsSync(p)) return p; } return null; };
const vis = new Set(); const copiar = (b) => { if (vis.has(b)) return; vis.add(b); const s0 = localizar(b); if (!s0) return; const s = fs.readFileSync(s0, 'utf8').replace(/\?v=\d+/g, ''); fs.writeFileSync(path.join(tmp, b), s); for (const mm of s.matchAll(/from\s+['"]\.[^'"]*\/([\w.-]+\.js)['"]/g)) copiar(mm[1]); };
copiar('static_solver.js'); copiar('model.js'); copiar('timoshenko.js');
const { Model } = await import(pathToFileURL(path.join(tmp, 'model.js')).href);
const { StaticSolver } = await import(pathToFileURL(path.join(tmp, 'static_solver.js')).href);
const { localAxes } = await import(pathToFileURL(path.join(tmp, 'timoshenko.js')).href);
function solve(modelo, lcName) {
  const m = new Model(); m.materials.clear(); m.sections.clear(); m.units = modelo.units; m.mode = modelo.mode;
  for (const d of modelo.materials) m.materials.set(d.id, d);
  for (const d of modelo.sections) m.sections.set(d.id, d);
  for (const d of modelo.nodes) m.nodes.set(d.id, d);
  for (const d of modelo.elements) m.elements.set(d.id, d);
  for (const d of modelo.loadCases) m.loadCases.set(d.id, d);
  const lc = modelo.loadCases.find(l => l.name === lcName); const F = [0, 0, 0];
  for (const ld of lc.loads) {
    const e = modelo.elements[ld.elemId - 1], a = modelo.nodes[e.n1 - 1], b = modelo.nodes[e.n2 - 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), P = ld.w * L;
    if (ld.dir === 'globalX') F[0] += P; else if (ld.dir === 'globalY') F[1] += P; else F[2] -= P;
  }
  const res = new StaticSolver().solve(m, lc.id, false); const R = [0, 0, 0];
  for (const nd of m.nodes.values()) { const r = res.getReaction(nd.id); if (r) for (let k = 0; k < 3; k++) R[k] += r[k]; }
  return { F, R };
}
const base = { typology: 'galpão', sections: { material: 'MR250', columns: 'W 250 x 32,7' },
  warehouse: { span_m: 15, length_m: 30, column_height_m: 6, frame_spacing_m: 5, slope_pct: 10, chord_size: 'W 150 x 13,0', diagonal_size: 'W 150 x 13,0', sag_rod_lines: 1 },
  loads: { dead_extra_kN_m2: 0.15, live_load_kN_m2: 0.25, wind: true }, wind: { V0_m_s: 40, categoria: 'IV', grupoS3: '3' } };
const dup = generateModel({ ...base, warehouse: { ...base.warehouse, ridge_purlins: 'dupla', ridge_purlin_gap_m: 0.15 } }, BR);
const sim = generateModel(base, BR);
const N = (m, id) => m.nodes[id - 1];
const purl = (m) => m.elements.filter(e => e.secId === 5);
const th = Math.atan(0.10);
// (a)
const xs = [...new Set(purl(dup).map(e => +N(dup, e.n1).x.toFixed(4)))].sort((p, q) => p - q);
assert('a1. terças da cumeeira em x = 7,425 e 7,575 m', xs.includes(7.425) && xs.includes(7.575), xs.join(' '));
assert('a2. nenhuma terça no ápice (x = 7,5)', !xs.includes(7.5));
const nr = dup.nodes.find(n => Math.abs(n.x - 7.425) < 1e-9 && n.y === 0 && n.z > 6);
assert('a3. nó da terça no banzo: z = 6 + 0,10·7,425 = 6,7425 m', nr && Math.abs(nr.z - 6.7425) < 1e-4, String(nr?.z));
assert('a4. uma linha de terça a mais que na cumeeira simples (6 vãos × 2 trechos)', purl(dup).length === purl(sim).length + 6 * 2, `${purl(dup).length} × ${purl(sim).length}`);
const apex = dup.nodes.find(n => Math.abs(n.x - 7.5) < 1e-9 && n.y === 0 && n.z > 6.7);
assert('a5. ápice mantido no banzo (encontro da alma da treliça)', !!apex && dup.elements.some(e => e.secId === 2 && (e.n1 === apex.id || e.n2 === apex.id)));
// (b)
let okB = true, info = '';
for (const e of purl(dup)) {
  const a = N(dup, e.n1), b = N(dup, e.n2); if (Math.abs(a.x - 7.5) > 0.1) continue;
  const ey = localAxes(a, b, e.beta || 0).ey, s = a.x < 7.5 ? -1 : 1, n = [s * Math.sin(th), 0, Math.cos(th)];
  const d = Math.abs(ey[0] * n[0] + ey[1] * n[1] + ey[2] * n[2]);
  if (Math.abs(d - 1) > 1e-6) { okB = false; info = `x = ${a.x}: |ey·n| = ${d}`; }
}
assert('b. alma de cada terça da cumeeira perpendicular à sua água (|ey·n| = 1)', okB, info);
// (c)
const cmFrame = (m) => { const lc = m.loadCases.find(l => l.name === 'CM'); let s = 0;
  for (const ld of lc.loads) { const e = m.elements[ld.elemId - 1], a = N(m, e.n1), b = N(m, e.n2); if (a.y !== 10 || b.y !== 10 || ld.dir !== 'gravity') continue; s += ld.w * Math.hypot(b.x - a.x, b.z - a.z); }
  return s; };
assert('c1. CM do pórtico interno = 0,15·5·15 = 11,25 kN (dupla)', Math.abs(cmFrame(dup) - 11.25) < 1e-4   /* w gravado com 6 casas (toFixed(6)) → erro ≤ ~1e-5 kN */, cmFrame(dup).toFixed(6));
assert('c2. igual à cumeeira simples', Math.abs(cmFrame(dup) - cmFrame(sim)) < 1e-6);
for (const name of ['CM', 'Viento X (Cpi 0)', 'Viento Y (Cpi 0)']) {
  const { F, R } = solve(dup, name); const tol = 1e-3 * Math.max(1, ...F.map(Math.abs));
  assert(`c3. ${name}: estável e ΣR + ΣF = 0`, R.every(Number.isFinite) && R.every((r, k) => Math.abs(r + F[k]) < tol), `F = [${F.map(v => v.toFixed(2))}]`);
}
// (d)
const sags = dup.elements.filter(e => e.secId === 7);
const toRidge = sags.filter(e => [N(dup, e.n1).x, N(dup, e.n2).x].some(x => Math.abs(Math.abs(x - 7.5) - 0.075) < 1e-6));
assert('d. T2: cada corrente que chega à cumeeira vem da mesma água', toRidge.length > 0 && toRidge.every(e => { const x1 = N(dup, e.n1).x, x2 = N(dup, e.n2).x; return (x1 - 7.5) * (x2 - 7.5) > 0; }), String(toRidge.length));
// gap que não cabe no painel → volta para terça simples com aviso
const big = generateModel({ ...base, warehouse: { ...base.warehouse, ridge_purlins: 'dupla', ridge_purlin_gap_m: 4 } }, BR);
assert('e. afastamento maior que o painel → terça simples', purl(big).length === purl(sim).length);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} FALHA(S)` : '\nOK — terça de cumeeira dupla');
process.exit(fails ? 1 : 0);
