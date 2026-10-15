// test_galpao_contrav.mjs — galpão do preset Brasil com contraventamento e rótulas, resolvido no solver real
//   node assistant/test_galpao_contrav.mjs
// Referência de modelagem: Manual CBCA "Galpões para usos gerais" 2.14/2.15 — contraventamento do telhado
// nos vãos extremos (vento nas empenas), X em barra redonda ≥ 12 mm, contraventamento vertical nos eixos
// longitudinais. Verificações: (a) topologia gerada; (b) solução estável e EQUILÍBRIO GLOBAL vetorial
// (ΣR + ΣF = 0 em X, Y e Z) nos casos de vento; (c) o vento de empena (Y) chega à fundação pelas paredes
// laterais contraventadas (ΣRy = −ΣFy) e as barras de contraventamento ficam solicitadas.
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
const GEN = { reglas: JSON.parse(rd('assistant/rules.json')), perfiles: parseCSV(rd('assistant/profiles.csv')), materiales: parseCSV(rd('assistant/materials.csv')) };

// solver (same harness as test_bridge_warehouse.mjs)
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(raiz, 'lib', 'numeric.js'), 'utf8'));
const tmp = path.join(dir, '_gc_tmp'); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} fs.mkdirSync(tmp, { recursive: true });
const buscarEn = ['js/solver', 'js/model', 'js']; const localizar = (b) => { for (const d of buscarEn) { const p = path.join(raiz, d, b); if (fs.existsSync(p)) return p; } return null; };
const vis = new Set(); const copiar = (b) => { if (vis.has(b)) return; vis.add(b); const s0 = localizar(b); if (!s0) return; const s = fs.readFileSync(s0, 'utf8').replace(/\?v=\d+/g, ''); fs.writeFileSync(path.join(tmp, b), s); for (const mm of s.matchAll(/from\s+['"]\.[^'"]*\/([\w.-]+\.js)['"]/g)) copiar(mm[1]); };
copiar('static_solver.js'); copiar('model.js');
const { Model } = await import(pathToFileURL(path.join(tmp, 'model.js')).href);
const { StaticSolver } = await import(pathToFileURL(path.join(tmp, 'static_solver.js')).href);
function solve(modelo, lcName) {
  const m = new Model(); m.materials.clear(); m.sections.clear(); m.units = modelo.units; m.mode = modelo.mode;
  for (const d of modelo.materials) m.materials.set(d.id, d);
  for (const d of modelo.sections) m.sections.set(d.id, d);
  for (const d of modelo.nodes) m.nodes.set(d.id, d);
  for (const d of modelo.elements) m.elements.set(d.id, d);
  for (const d of modelo.loadCases) m.loadCases.set(d.id, d);
  const lc = modelo.loadCases.find(l => l.name === lcName);
  const F = [0, 0, 0];
  for (const ld of lc.loads) {
    const e = modelo.elements[ld.elemId - 1], a = modelo.nodes[e.n1 - 1], b = modelo.nodes[e.n2 - 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), P = ld.w * L;
    if (ld.dir === 'globalX') F[0] += P; else if (ld.dir === 'globalY') F[1] += P; else F[2] -= P;   // gravity: w > 0 down
  }
  const res = new StaticSolver().solve(m, lc.id, false);
  const R = [0, 0, 0];
  for (const nd of m.nodes.values()) { const r = res.getReaction(nd.id); if (r) for (let k = 0; k < 3; k++) R[k] += r[k]; }
  return { F, R, res };
}

const spec = { typology: 'galpão', sections: { material: 'MR250', columns: 'W 250 x 32,7' },
  warehouse: { span_m: 15, length_m: 30, column_height_m: 6, frame_spacing_m: 5, slope_pct: 10, chord_size: 'W 150 x 13,0', diagonal_size: 'W 150 x 13,0' },
  loads: { dead_extra_kN_m2: 0.15, live_load_kN_m2: 0.25, wind: true }, wind: { V0_m_s: 40, categoria: 'IV', grupoS3: '3' } };
const m = generateModel(spec, BR);
const rods = m.elements.filter(e => e.cable);
const nd = (id) => m.nodes[id - 1];
// (a) topology: 16 roof panels × 2 diagonals × 2 end bays + 2 walls × 2 diagonals × 2 bays
const nT = 16;   // n_panels = round(15) → 15 → even 16
assert('a1. barras de contraventamento só de tração (cable)', rods.length === 2 * nT * 2 + 2 * 2 * 2, String(rods.length));
assert('a2. contraventamento só nos vãos extremos (0–5 m e 25–30 m)', rods.every(e => { const ys = [nd(e.n1).y, nd(e.n2).y].sort((p, q) => p - q); return (ys[0] === 0 && ys[1] === 5) || (ys[0] === 25 && ys[1] === 30); }));
assert('a3. barra redonda φ12 (mínimo CBCA / NBR 8800)', m.sections.some(s => s.id === 4 && /φ12/.test(s.name)));
assert('a4. diagonais e terças rotuladas (ry, rz nas duas pontas)', m.elements.filter(e => e.secId === 3).every(e => e.releases[4] && e.releases[5] && e.releases[10] && e.releases[11]));
assert('a5. banzos contínuos (sem rótula)', m.elements.filter(e => e.secId === 2).every(e => e.releases.every(r => !r)));
// (b) equilibrium and stability under every wind case and CM
for (const name of ['CM', 'Viento X (Cpi -0,3)', 'Viento Y (Cpi -0,3)', 'Viento X (Cpi 0)', 'Viento Y (Cpi 0)']) {
  const { F, R } = solve(m, name);
  const tol = 1e-3 * Math.max(1, ...F.map(Math.abs));
  assert(`b. ${name}: solução finita e ΣR + ΣF = 0 (X, Y, Z)`, R.every(Number.isFinite) && R.every((r, k) => Math.abs(r + F[k]) < tol),
    `F = [${F.map(v => v.toFixed(2))}] R = [${R.map(v => v.toFixed(2))}]`);
}
// (c) gable wind reaches the foundation and loads the bracing
{
  const { F, R, res } = solve(m, 'Viento Y (Cpi 0)');
  assert('c1. vento de empena: ΣFy > 0 e ΣRy = −ΣFy', F[1] > 1 && Math.abs(R[1] + F[1]) < 1e-3 * F[1], `ΣFy = ${F[1].toFixed(2)} kN`);
  const Nmax = Math.max(...rods.map(e => Math.abs(res.getElemForces(e.id)?.N ?? 0)));
  assert('c2. contraventamento solicitado (|N| máx > 0,5 kN)', Nmax > 0.5, `|N| máx = ${Nmax.toFixed(2)} kN`);
}
// (d) generic preset unchanged: no bracing, no hinges
{
  const g = generateModel({ typology: 'warehouse', warehouse: { span_m: 15, length_m: 30 } }, GEN);
  assert('d. preset genérico sem contraventamento nem rótulas', !g.elements.some(e => e.cable) && g.elements.every(e => e.releases.every(r => !r)));
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
