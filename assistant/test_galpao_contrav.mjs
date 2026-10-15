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
  const m = new Model(); m.materials.clear(); m.sections.clear(); m.units = modelo.units; m.mode = modelo.mode; m.planar = modelo.planar === true;
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
// panels follow the purlin spacing (default 1,8 m): slope length hypot(7,5; 0,75) = 7,537 m → ceil(7,537/1,8) = 5
// panels per slope → nT = 10 (panel 1,507 m along the slope ≤ 1,8 m)
const nT = 10;
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

// (e) purlins: Ue of NBR 6355 pre-sized d ≥ L/40 = 5000/40 = 125 mm → smallest web 125 mm, t closest to 2,00 mm
{
  const terca = m.sections.find(sc => sc.id === 5);
  assert('e1. terça Ue 125x50x17x2,00 (catálogo NBR 6355, d ≥ L/40)', terca?.name === 'Ue 125x50x17x2,00', terca?.name);
  const purl = m.elements.filter(e => e.secId === 5);
  assert('e2. terças em todos os nós do banzo superior (11 linhas × 6 vãos)', purl.length === (nT + 1) * 6, String(purl.length));
  assert('e3. terças biapoiadas (rotuladas)', purl.every(e => e.releases[4] && e.releases[5] && e.releases[10] && e.releases[11]));
  const panel = Math.hypot(7.5, 0.75) / (nT / 2);
  assert('e4. painel ao longo da água ≤ espaçamento das terças (1,8 m)', panel <= 1.8 + 1e-9, panel.toFixed(3));
}
// (f) bracing option: every bay / none
{
  const all = generateModel({ ...spec, warehouse: { ...spec.warehouse, bracing: 'todos' } }, BR);
  assert('f1. contraventamento em todos os vãos: 6 vãos × (2·nT + 4)', all.elements.filter(e => e.cable).length === 6 * (2 * nT + 4), String(all.elements.filter(e => e.cable).length));
  const none = generateModel({ ...spec, warehouse: { ...spec.warehouse, bracing: 'sem' } }, BR);
  assert('f2. sem contraventamento: nenhum tirante, terças mantidas', !none.elements.some(e => e.cable) && none.elements.some(e => e.secId === 5));
  const { F, R } = solve(all, 'Viento Y (Cpi 0)');
  assert('f3. todos os vãos: equilíbrio Y', Math.abs(R[1] + F[1]) < 1e-3 * Math.abs(F[1]));
}

// (g) lattice ("treliçado") columns — width 0,5 m, module 0,5 m: H = 6 m → 12 panels; two pinned bases per column
{
  const t = generateModel({ ...spec, warehouse: { ...spec.warehouse, column_type: 'treliçado', column_width_m: 0.5, column_module_m: 0.5 } }, BR);
  const N = (id) => t.nodes[id - 1];
  const bases = t.nodes.filter(n => n.z === 0 && n.restraints.ux && n.restraints.uz);
  assert('g1. dois apoios por pilar (2 × 2 × 7 pórticos = 28), articulados', bases.length === 28 && bases.every(n => !n.restraints.ry), String(bases.length));
  const legs0 = t.elements.filter(e => e.secId === 1 && N(e.n1).x === 0 && N(e.n2).x === 0 && N(e.n1).y === 10);
  assert('g2. montante externo em 12 segmentos de 0,5 m', legs0.length === 12, String(legs0.length));
  const lace = t.elements.filter(e => e.secId === 6);
  assert('g3. travejamento rotulado (horizontais + diagonais)', lace.length > 0 && lace.every(e => e.releases[4] && e.releases[10]), String(lace.length));
  const bottomNode = t.nodes.find(n => Math.abs(n.x - 0.5) < 1e-9 && n.y === 10 && Math.abs(n.z - 6) < 1e-9);
  assert('g4. banzo inferior da treliça com nó em x = w (topo do montante interno)', !!bottomNode);
  for (const name of ['CM', 'Viento X (Cpi 0)', 'Viento Y (Cpi 0)']) {
    const { F, R } = solve(t, name);
    const tol = 1e-3 * Math.max(1, ...F.map(Math.abs));
    assert(`g5. ${name}: estável e ΣR + ΣF = 0 (X, Y, Z)`, R.every(Number.isFinite) && R.every((r, k) => Math.abs(r + F[k]) < tol), `F = [${F.map(v => v.toFixed(2))}] R = [${R.map(v => v.toFixed(2))}]`);
  }
  const { F } = solve(t, 'Viento X (Cpi -0,3)');
  // walls: (0,7 + 0,5)·616,87·6·30 = 133,24 kN; roof X component −7,53 kN → 125,71 kN (same as single columns)
  assert('g6. vento X total igual ao do pilar simples (125,71 kN)', Math.abs(F[0] - 125.71) < 0.05, F[0].toFixed(2));
  // no near-mechanism: max displacement under CM and wind X of the same order as with single columns
  const dmax = (mod, name) => { const { res } = solve(mod, name); let d = 0; for (const n of mod.nodes) { const u = res.getNodeDisp(n.id); if (u) d = Math.max(d, Math.hypot(u[0], u[1], u[2])); } return d; };
  for (const name of ['CM', 'Viento X (Cpi 0)']) {
    const dt = dmax(t, name), ds = dmax(m, name);
    assert(`g7. ${name}: deslocamento máx. treliçado ${(dt * 1000).toFixed(1)} mm × simples ${(ds * 1000).toFixed(1)} mm (mesma ordem, < L/100)`, dt < 0.15 && dt < 10 * ds);
  }
}

// (h) number of frames prevails over the spacing: 5 frames over 30 m → spacing 7,5 m
{
  const h = generateModel({ ...spec, warehouse: { ...spec.warehouse, n_frames: 5 } }, BR);
  const ys = [...new Set(h.nodes.map(n => n.y))].sort((p, q) => p - q);
  assert('h1. 5 pórticos @ 7,5 m (0; 7,5; 15; 22,5; 30)', JSON.stringify(ys) === JSON.stringify([0, 7.5, 15, 22.5, 30]), JSON.stringify(ys));
}
// (i) bracing in the chosen bays (1-based): bays 2 and 4 → y 5–10 and 15–20; out-of-range bay warned and ignored
{
  const b = generateModel({ ...spec, warehouse: { ...spec.warehouse, bracing: 'escolhidos', bracing_bays: [2, 4, 9] } }, BR);
  const r = b.elements.filter(e => e.cable), N = (id) => b.nodes[id - 1];
  assert('i1. 2 vãos × (2·nT + 4) tirantes', r.length === 2 * (2 * nT + 4), String(r.length));
  assert('i2. só nos vãos 2 (5–10 m) e 4 (15–20 m)', r.every(e => { const y = [N(e.n1).y, N(e.n2).y].sort((p, q) => p - q); return (y[0] === 5 && y[1] === 10) || (y[0] === 15 && y[1] === 20); }));
  assert('i3. vão 9 (fora de 1…6) avisado', b._warnings.some(w => /fora de 1…6 ignorados: 9/.test(w.msg)));
  const { F, R } = solve(b, 'Viento Y (Cpi 0)');
  assert('i4. vãos escolhidos: vento de empena equilibrado (ΣRy = −ΣFy)', Math.abs(R[1] + F[1]) < 1e-3 * Math.abs(F[1]));
}
// (j) end depth ("montante inicial") 1,0 m: trapezoidal truss; the end post is the column carried up (same section)
{
  const hE = 1.0, hR = 0.75;
  const j = generateModel({ ...spec, warehouse: { ...spec.warehouse, end_depth_m: hE } }, BR);
  const N = (id) => j.nodes[id - 1];
  const zmax = Math.max(...j.nodes.map(n => n.z));
  assert('j1. cumeeira em H + montante + flecha = 6 + 1 + 0,75 = 7,75 m', Math.abs(zmax - (6 + hE + hR)) < 1e-6, String(zmax));
  const post = j.elements.find(e => { const a = N(e.n1), c = N(e.n2); return a.x === 0 && c.x === 0 && a.y === 10 && c.y === 10 && Math.min(a.z, c.z) === 6 && Math.max(a.z, c.z) === 7; });
  assert('j2. montante de extremidade x = 0, 6 → 7 m, seção do pilar e contínuo', post && post.secId === 1 && post.releases.every(r => !r), JSON.stringify(post));
  const eave = j.nodes.find(n => n.x === 0 && n.y === 10 && n.z === 7);
  assert('j3. banzo superior nasce no topo do montante (x = 0, z = 7)', !!eave && j.elements.some(e => (e.n1 === eave.id || e.n2 === eave.id) && e.secId === 2));
  for (const name of ['CM', 'Viento X (Cpi 0)', 'Viento Y (Cpi 0)']) {
    const { F, R } = solve(j, name);
    const tol = 1e-3 * Math.max(1, ...F.map(Math.abs));
    assert(`j4. ${name}: estável e ΣR + ΣF = 0`, R.every(Number.isFinite) && R.every((r, k) => Math.abs(r + F[k]) < tol), `F = [${F.map(v => v.toFixed(2))}] R = [${R.map(v => v.toFixed(2))}]`);
  }
  // wall wind now acts up to the eave (H + hE): loaded height of the windward wall line of a frame = 7 m (was 6 m).
  // (Not the resultant ratio: the wall Cpe of NBR 6123 Tab. 4 depend on h/b, so the pressure itself changes too.)
  const loadedH = (mod) => { const ids = new Set(mod.loadCases.find(l => l.name === 'Viento X (Cpi 0)').loads.filter(ld => ld.dir === 'globalX').map(ld => ld.elemId));
    return mod.elements.filter(e => ids.has(e.id)).map(e => [mod.nodes[e.n1 - 1], mod.nodes[e.n2 - 1]])
      .filter(([a, c]) => a.x === 0 && c.x === 0 && a.y === 10 && c.y === 10).reduce((s, [a, c]) => s + Math.abs(c.z - a.z), 0); };
  assert('j5. parede a barlavento carregada até o beiral: 7 m (triangular: 6 m)', Math.abs(loadedH(j) - 7) < 1e-9 && Math.abs(loadedH(m) - 6) < 1e-9, `${loadedH(j)} / ${loadedH(m)}`);
  const q0 = m.loadCases.find(l => l.name === 'Viento X (Cpi 0)')._viento.q_Nm2, q1 = j.loadCases.find(l => l.name === 'Viento X (Cpi 0)')._viento.q_Nm2;
  assert('j6. q calculado na altura total H + montante + flecha (z = 7,75 m ≥ 6,75 m)', q1 >= q0, `${q0} → ${q1}`);
}

// (k) materials by function and cold-formed sections (NBR 6355): Ue chords, L web
{
  const k = generateModel({ ...spec, warehouse: { ...spec.warehouse, chord_size: 'Ue 150x60x20x3,00', diagonal_size: 'L 50x3,00',
    materials: { columns: 'AR350', chords: 'MR250', web: 'AR350 COR' } } }, BR);
  const name = (id) => k.materials[id - 1].name;
  assert('k1. três aços distintos no modelo', new Set(k.materials.map(x => x.name)).size === 3, k.materials.map(x => x.name).join(','));
  assert('k2. pilares AR350, banzos MR250, alma AR350 COR', k.elements.filter(e => e.secId === 1).every(e => name(e.matId) === 'AR350')
    && k.elements.filter(e => e.secId === 2).every(e => name(e.matId) === 'MR250') && k.elements.filter(e => e.secId === 3 && e.releases[4]).every(e => name(e.matId) === 'AR350 COR'));
  const sc = k.sections.find(x => x.id === 2), sd = k.sections.find(x => x.id === 3);
  assert('k3. banzo Ue (NBR 14762 via cfProps) e alma L dobrada', sc.design?.shape === 'Ue' && !!sc.design.cfProps && sd.design?.shape === 'L' && !!sd.design.cfProps, `${sc.design?.shape}/${sd.design?.shape}`);
  for (const nm of ['CM', 'Viento X (Cpi 0)']) { const { F, R } = solve(k, nm); const tol = 1e-3 * Math.max(1, ...F.map(Math.abs));
    assert(`k4. ${nm}: equilíbrio com perfis dobrados`, R.every((r, i) => Math.abs(r + F[i]) < tol)); }
}
// (l) concrete columns 40x40 C30: fixed base, steel truss pinned on top, no wall bracing
{
  const l = generateModel({ ...spec, warehouse: { ...spec.warehouse, column_type: 'concreto', column_concrete: { b_cm: 40, h_cm: 40 } } }, BR);
  const cols = l.elements.filter(e => e.secId === 1), name = (id) => l.materials[id - 1].name;
  assert('l1. pilares 40x40 em C30', cols.length === 14 && cols.every(e => name(e.matId) === 'C30') && l.sections[0].name === '40x40', `${cols.length} ${name(cols[0].matId)}`);
  // only the in-plane rotation is released (local rz of the vertical column = about global Y); the rotation about X
  // stays held — releasing it too let the truss roll (mechanism found by the launch audit)
  assert('l2. topo do pilar articulado só no plano do pórtico (rz local livre, ry local preso)', cols.every(e => e.releases[11] && !e.releases[10] && !e.releases[4]));
  assert('l3. sem contraventamento vertical nas paredes (só no telhado)', l.elements.filter(e => e.cable).every(e => l.nodes[e.n1 - 1].z >= 6 && l.nodes[e.n2 - 1].z >= 6));
  for (const nm of ['CM', 'Viento X (Cpi 0)', 'Viento Y (Cpi 0)']) { const { F, R } = solve(l, nm); const tol = 1e-3 * Math.max(1, ...F.map(Math.abs));
    assert(`l4. ${nm}: estável e equilíbrio`, R.every(Number.isFinite) && R.every((r, i) => Math.abs(r + F[i]) < tol), `F=[${F.map(v => v.toFixed(2))}] R=[${R.map(v => v.toFixed(2))}]`); }
}
// (m) roof only: no columns, trusses on supports (fixed x = 0, sliding x = span)
{
  const r = generateModel({ ...spec, warehouse: { ...spec.warehouse, column_type: 'sem' } }, BR);
  assert('m1. nenhum nó abaixo do banzo inferior', r.nodes.every(n => n.z >= 6 - 1e-9));
  const sup = r.nodes.filter(n => n.restraints.uz);
  assert('m2. dois apoios por treliça (fixo + deslizante em X)', sup.length === 14 && sup.filter(n => n.x === 0).every(n => n.restraints.ux) && sup.filter(n => n.x === 15).every(n => !n.restraints.ux));
  for (const nm of ['CM', 'Viento X (Cpi 0)', 'Viento Y (Cpi 0)']) { const { F, R } = solve(r, nm); const tol = 1e-3 * Math.max(1, ...F.map(Math.abs));
    assert(`m3. ${nm}: estável e equilíbrio (só cobertura)`, R.every(Number.isFinite) && R.every((v, i) => Math.abs(v + F[i]) < tol), `F=[${F.map(v => v.toFixed(2))}] R=[${R.map(v => v.toFixed(2))}]`); }
  assert('m4. aviso: vento de paredes e empenas não aplicado', r._warnings.some(w => /Sem pilares/.test(w.msg)));
}
// (n) sag-rod lines (CBCA 2.10–2.11): 1 line per bay, flexible φ12,5; purlins split, pinned only at the frames
{
  const nS = generateModel({ ...spec, warehouse: { ...spec.warehouse, sag_rod_lines: 1 } }, BR);
  const N = (id) => nS.nodes[id - 1];
  const sag = nS.elements.filter(e => e.secId === 7), purl = nS.elements.filter(e => e.secId === 5);
  // CBCA Fig. 77: T1 along each slope from the eave to the purlin below the ridge (nT/2 − 1 segments per slope) and T2
  // diagonals from there to the ridge purlin at both frames (middle line) → (nT − 2) + 4 = 12 per bay
  assert('n1. correntes T1 + T2 (CBCA Fig. 77): (nT − 2 + 4) × 6 vãos, só tração, φ12,5', sag.length === (nT - 2 + 4) * 6 && sag.every(e => e.cable) && /φ12,5/.test(nS.sections.find(x => x.id === 7).name), `${sag.length}`);
  assert('n2. terças (inclusive as de beiral) divididas no meio do vão: (nT + 1) linhas × 6 vãos × 2 trechos', purl.length === (nT + 1) * 6 * 2, String(purl.length));
  const keyOf = (e) => [N(e.n1), N(e.n2)].map(n => `${n.x},${n.z}`).sort().join('|') + '|' + [N(e.n1).y, N(e.n2).y].sort((p, q) => p - q).join('-');
  const eaveFull = nS.elements.filter(e => N(e.n1).x === 0 && N(e.n2).x === 0 && N(e.n1).z === 6 && N(e.n2).z === 6 && Math.abs(N(e.n1).y - N(e.n2).y) > 2.5 + 1e-9);
  assert('n2b. no beiral não sobra barra inteira em paralelo com a terça dividida', eaveFull.length === 0, eaveFull.map(keyOf).join(' ; '));
  const fr = new Set([0, 5, 10, 15, 20, 25, 30]);
  assert('n3. terças rotuladas só nos pórticos, contínuas na corrente', purl.every(e => (fr.has(N(e.n1).y) === !!e.releases[4]) && (fr.has(N(e.n2).y) === !!e.releases[10])));
  const { F, R, res } = solve(nS, 'CM');
  assert('n4. CM: equilíbrio com correntes', R.every((r, i) => Math.abs(r + F[i]) < 1e-3 * Math.max(1, ...F.map(Math.abs))));
  // T2 ends at the ridge purlin on the frame lines (x = span/2, y = 0, 5, …) — the line hangs from the frames
  const ridge = nS.nodes.filter(n => Math.abs(n.x - 7.5) < 1e-9 && fr.has(n.y)).map(n => n.id);
  assert('n5. diagonais T2 chegam à terça da cumeeira nos pórticos', sag.filter(e => ridge.includes(e.n1) || ridge.includes(e.n2)).length === 4 * 6);
  const rg = generateModel({ ...spec, warehouse: { ...spec.warehouse, sag_rod_lines: 2, sag_rod_type: 'rigida', sag_rod_section: 'L 40x2,00' } }, BR);
  const sr = rg.elements.filter(e => e.secId === 7);
  assert('n6. correntes rígidas nos terços: 2 × nT × 6, L 40x2,00, sem flag de tração', sr.length === 2 * nT * 6 && sr.every(e => !e.cable) && rg.sections.find(x => x.id === 7).design?.shape === 'L');
}

// (o) one frame only: a single representative frame, tributary width = spacing; no purlins/bracing/sag rods
for (const ct of ['laminado', 'treliçado', 'concreto', 'sem']) {
  const o = generateModel({ ...spec, warehouse: { ...spec.warehouse, n_frames: 1, sag_rod_lines: 1, column_type: ct } }, BR);
  assert(`o1. ${ct}: um único pórtico (todos os nós em y = 0)`, o.nodes.every(n => n.y === 0), String(new Set(o.nodes.map(n => n.y)).size));
  assert(`o2. ${ct}: sem terças, tirantes nem correntes`, !o.elements.some(e => e.cable || e.secId === 5 || e.secId === 7));
  const { F, R } = solve(o, 'CM');
  // roof dead load on the tributary width 5 m: qCM·trib·span = 0,15·5·15 = 11,25 kN plus self-weight
  const qRoof = o.loadCases.find(l => l.name === 'CM').loads.reduce((sm, ld) => { const e = o.elements[ld.elemId - 1], a = o.nodes[e.n1 - 1], b = o.nodes[e.n2 - 1]; return sm + ld.w * Math.hypot(b.x - a.x, b.z - a.z); }, 0);
  assert(`o3. ${ct}: telha na largura de influência 5 m → 0,15·5·15 = 11,25 kN (w gravado com 6 casas)`, Math.abs(qRoof - 11.25) < 1e-5 * 11.25, qRoof.toFixed(6));
  assert(`o3b. ${ct}: pórtico isolado em vista 3D com cálculo plano (planar) e sem caso de vento Y`, o.mode === '3D' && o.planar === true && !o.loadCases.some(l => /^Viento Y/.test(l.name)));
  for (const nm of ['CM', 'Viento X (Cpi 0)', 'Viento X (Cpi -0,3)']) { const r = solve(o, nm); const tol = 1e-3 * Math.max(1, ...r.F.map(Math.abs));
    assert(`o4. ${ct} · ${nm}: estável e equilíbrio`, r.R.every(Number.isFinite) && r.R.every((v, i) => Math.abs(v + r.F[i]) < tol), `F=[${r.F.map(v => v.toFixed(2))}] R=[${r.R.map(v => v.toFixed(2))}]`); }
}

// (p) stability (launch audit): mechanisms that equilibrium alone does not catch — max displacement under the cases
// that excite them must stay finite and of the order of the stable variants (< 0,2 m)
{
  const dmaxOf = (mod, name) => { const { res } = solve(mod, name); let d = 0; for (const n of mod.nodes) { const u = res.getNodeDisp(n.id); if (u) d = Math.max(d, Math.hypot(u[0], u[1], u[2])); } return d; };
  const variants = [
    ['concreto, montante 1 m', { column_type: 'concreto', end_depth_m: 1 }],
    ['concreto, montante 1 m, sem contraventamento', { column_type: 'concreto', end_depth_m: 1, bracing: 'sem' }],
    ['concreto, sem contraventamento', { column_type: 'concreto', bracing: 'sem' }],
    ['treliçado, sem contraventamento', { column_type: 'treliçado', bracing: 'sem' }],
    ['treliçado, vãos escolhidos vazios', { column_type: 'treliçado', bracing: 'escolhidos', bracing_bays: [] }],
    ['laminado, montante 1 m', { end_depth_m: 1 }],
    ['sem pilar, montante 1 m', { column_type: 'sem', end_depth_m: 1 }],
  ];
  for (const [nm, w] of variants) {
    const v = generateModel({ ...spec, warehouse: { ...spec.warehouse, ...w }, loads: { ...spec.loads, seismic: true }, seismic: { zona: 1 } }, BR);
    // without ROOF bracing the gable triangle loads the end trusses out of plane (their lateral bending only): not a
    // mechanism, but large — the check there is "finite, < 1 m, and warned"; elsewhere < 0,2 m
    const semTelhado = w.bracing === 'sem' || (w.bracing === 'escolhidos' && !(w.bracing_bays || []).length);
    for (const lc of ['Viento Y (Cpi 0)', 'Sismo Y (NBR 15421 7.3.2)']) {
      const d = dmaxOf(v, lc), lim = semTelhado ? 1.0 : 0.2;
      assert(`p. ${nm} · ${lc}: deslocamento máx. finito e < ${lim} m`, Number.isFinite(d) && d < lim, `${(d * 1000).toFixed(1)} mm`);
    }
    if (semTelhado && w.column_type !== 'sem') assert(`p. ${nm}: aviso de telhado sem contraventamento`, v._warnings.some(x => /Sem contraventamento no telhado/.test(x.msg)));
  }
  // lattice column without bracing: wall X generated (with a warning); laminated + end depth: the wall X reaches the eave
  const tr = generateModel({ ...spec, warehouse: { ...spec.warehouse, column_type: 'treliçado', bracing: 'sem' } }, BR);
  assert('p2. treliçado sem contraventamento: X de parede gerado e avisado', tr.elements.some(e => e.cable && tr.nodes[e.n1 - 1].z === 0) && tr._warnings.some(w => /Pilar treliçado sem contraventamento/.test(w.msg)));
  const le = generateModel({ ...spec, warehouse: { ...spec.warehouse, end_depth_m: 1 } }, BR);
  const wallTop = Math.max(...le.elements.filter(e => e.cable && (le.nodes[e.n1 - 1].z === 0 || le.nodes[e.n2 - 1].z === 0)).flatMap(e => [le.nodes[e.n1 - 1].z, le.nodes[e.n2 - 1].z]));
  assert('p3. montante 1 m: X da parede chega ao beiral (z = 7 m)', wallTop === 7, String(wallTop));
  // roof only + end depth: no wall/gable wind (as the warning says)
  const so = generateModel({ ...spec, warehouse: { ...spec.warehouse, column_type: 'sem', end_depth_m: 1 } }, BR);
  const fy = solve(so, 'Viento Y (Cpi 0)').F[1];
  assert('p4. sem pilar + montante: nenhum vento de empena (ΣFy = 0)', Math.abs(fy) < 1e-9, fy.toFixed(3));
}

// (q) gable wind: rectangle up to the eave on the end columns + triangle above it (area span·rise/2) — audit D4.
//     Hand check: ΣFy of the gable pressures = (pC − pD)·span·(H + rise/2), pC/pD = q·(Cpe − Cpi) of NBR 6123 for C/D
{
  const lc = m.loadCases.find(l => l.name === 'Viento Y (Cpi 0)'), P = lc._viento.presiones_por_cpi.find(x => x.cpi === 0).presiones;
  const gable = lc.loads.filter(ld => ld.dir === 'globalY').reduce((s, ld) => { const e = m.elements[ld.elemId - 1], a = m.nodes[e.n1 - 1], b = m.nodes[e.n2 - 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); return s + (ld.w + (ld.w2 ?? ld.w)) / 2 * L; }, 0);
  const exp = (P.C - P.D) / 1000 * 15 * (6 + 0.75 / 2);
  assert('q1. vento de empena: ΣFy = (pC − pD)·vão·(H + flecha/2) — inclui o triângulo acima do beiral', Math.abs(gable - exp) < 1e-6 * Math.abs(exp), `${gable.toFixed(4)} vs ${exp.toFixed(4)}`);
}

// (r) purlins and sag rods are excluded from the strength check (their analysis forces are not design forces)
{
  const r = generateModel({ ...spec, warehouse: { ...spec.warehouse, sag_rod_lines: 1 } }, BR);
  assert('r1. terças e correntes marcadas designExcluded com o motivo', r.elements.filter(e => e.secId === 5 || e.secId === 7).every(e => typeof e.designExcluded === 'string' && e.designExcluded.length > 20)
    && r.elements.filter(e => e.secId === 1 || e.secId === 2).every(e => !e.designExcluded));
}

// (s) layers by function
{
  const s = generateModel({ ...spec, warehouse: { ...spec.warehouse, sag_rod_lines: 1 } }, BR);
  const L = (n) => s.layers.find(l => l.name === n)?.id;
  assert('s1. camadas por função (pilares, banzos, alma, terças, contraventamento, correntes)', ['Pilares', 'Banzos', 'Montantes e diagonais', 'Terças', 'Contraventamento', 'Correntes'].every(n => L(n)), s.layers.map(l => l.name).join(','));
  assert('s2. barras nas camadas certas', s.elements.filter(e => e.secId === 1).every(e => e.layer === L('Pilares')) && s.elements.filter(e => e.cable && e.secId === 4).every(e => e.layer === L('Contraventamento')) && s.elements.filter(e => e.secId === 7).every(e => e.layer === L('Correntes')));
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
