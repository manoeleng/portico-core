// test_panel_loads.mjs — carga por pano (unidirecional): faixa de influência por barra, total = q·A
//   node tests/test_panel_loads.mjs
// Oráculo por cálculo manual (largura de influência): pano 10 × 6 m, terças paralelas a X a cada 1,5 m
// (y = 0; 1,5; 3; 4,5; 6), vão da telha em Y, q = 1 kN/m² → terças de borda w = 0,75 kN/m, internas 1,5 kN/m;
// vigas de borda paralelas ao vão (x = 0 e 10) não recebem nada; Σ w·L = q·A = 60 kN.
import { Model } from '../js/model/model.js';
import { panelToDistLoads, regeneratePanelLoads } from '../js/model/panel_loads.js';
import { StaticSolver } from '../js/solver/static_solver.js';
globalThis.window = globalThis;
await import('../lib/numeric.js');

let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-6) => { n++; const e = Math.abs(got - exp); if (!(e <= tol * Math.max(1, Math.abs(exp)))) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${+(+got).toFixed(6)}`); };
const assert = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name}${info ? ' · ' + info : ''}`); } else console.log(`ok   ${name}`); };

function roof(z = (y) => 3) {
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E: 2e8, G: 8e7, nu: 0.3, rho: 0 });
  const sec = m.addSection({ name: 'P', A: 0.002, Iy: 2e-6, Iz: 4e-6, J: 1e-8, Avy: 1e-3, Avz: 1e-3 });
  const F = { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };
  const ys = [0, 1.5, 3, 4.5, 6], purl = [], edge = [];
  const sup = (y) => (y === 0 || y === 6 ? F : {});   // corners supported; the inner purlins rest on the edge beams
  const L = ys.map((y) => [m.addNode(0, y, z(y), sup(y)).id, m.addNode(10, y, z(y), sup(y)).id]);
  for (const [a, b] of L) purl.push(m.addElement(a, b, mat.id, sec.id).id);
  for (let i = 0; i + 1 < ys.length; i++) { edge.push(m.addElement(L[i][0], L[i + 1][0], mat.id, sec.id).id); edge.push(m.addElement(L[i][1], L[i + 1][1], mat.id, sec.id).id); }
  const corners = [L[0][0], L[0][1], L[4][1], L[4][0]];
  return { m, purl, edge, corners, L };
}
const total = (m, loads) => loads.reduce((s, ld) => { const e = m.elements.get(ld.elemId), a = m.nodes.get(e.n1), b = m.nodes.get(e.n2); return s + ld.w * Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }, 0);

// (1) flat roof, span along Y, q = 1
{
  const { m, purl, edge, corners } = roof();
  const r = panelToDistLoads(m, { id: 1, nodes: corners, q: 1, dir: 'gravity', axis: 'Y' });
  const w = (id) => r.loads.filter((l) => l.elemId === id).reduce((s, l) => s + l.w, 0);
  ok('P1. terça de borda y = 0: w = 0,75', w(purl[0]), 0.75);
  ok('P1b. terça interna y = 1,5: w = 1,5', w(purl[1]), 1.5);
  ok('P1c. terça interna y = 3: w = 1,5', w(purl[2]), 1.5);
  ok('P1d. terça de borda y = 6: w = 0,75', w(purl[4]), 0.75);
  assert('P1e. vigas paralelas ao vão não recebem carga', edge.every((id) => w(id) === 0));
  ok('P1f. Σ w·L = q·A = 60 kN', total(m, r.loads), 60);
  assert('P1g. cargas marcadas com o pano (panelId)', r.loads.every((l) => l.panelId === 1 && l.dir === 'gravity'));
  assert('P1i. retângulo: sem aviso de faixa variável', !r.warnings.some((w) => /largura variável/.test(w)), r.warnings.join(' | '));
  // equilibrium in the solver: ΣRz = 60
  const lc = m.addLoadCase('Telha', false); lc.loads.push(...r.loads);
  const res = new StaticSolver().solve(m, lc.id, false);
  let Rz = 0; for (const nd of m.nodes.values()) { const rr = res.getReaction(nd.id); if (rr) Rz += rr[2]; }
  ok('P1h. solver: ΣRz = 60 kN', Rz, 60, 1e-6);
}
// (2) inclined roof (30°): q per m² of surface vs of the horizontal projection
{
  const t30 = Math.tan(Math.PI / 6);
  const { m, corners } = roof((y) => y * t30);
  const Ls = 6 / Math.cos(Math.PI / 6);                             // slope length
  const real = panelToDistLoads(m, { id: 2, nodes: corners, q: 1, dir: 'gravity', axis: 'Y' });
  ok('P2. inclinado, área real: Σ = q·10·L_inclinado', total(m, real.loads), 10 * Ls);
  const proj = panelToDistLoads(m, { id: 2, nodes: corners, q: 1, dir: 'gravity', axis: 'Y', area: 'projected' });
  ok('P2b. inclinado, área projetada: Σ = q·10·6', total(m, proj.loads), 60);
}
// (3) normal pressure on a vertical wall x = 0 (nodes counter-clockwise seen from −X → normal −X)
{
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E: 2e8, G: 8e7, nu: 0.3, rho: 0 }), sec = m.addSection({ name: 'P', A: 0.002, Iy: 2e-6, Iz: 4e-6, J: 1e-8, Avy: 1e-3, Avz: 1e-3 });
  const a = m.addNode(0, 0, 0).id, b = m.addNode(0, 5, 0).id, c = m.addNode(0, 5, 4).id, d = m.addNode(0, 0, 4).id;
  const g1 = m.addElement(a, b, mat.id, sec.id).id, g2 = m.addElement(d, c, mat.id, sec.id).id;
  const r = panelToDistLoads(m, { id: 3, nodes: [a, b, c, d], q: 0.5, dir: 'normal', axis: 'Z' });
  assert('P3. parede: só componente X', r.loads.every((l) => l.dir === 'globalX'));
  ok('P3b. Σ |Fx| = 0,5·5·4 = 10 kN (vigas de 5 m, faixa de 2 m cada)', Math.abs(total(m, r.loads)), 10);
  ok('P3c. sentido pela regra da mão direita (a→b→c→d: normal +X)', Math.sign(r.loads[0].w), 1);
}
// (5) triangle (review case): base 10 m at y = 0, apex (0, 6); purlins along X at y = 0, 2, 4 cut by the slanted edge.
//     Strip areas by hand (width 10·(1 − y/6)): y 0→1: 9,1667; 1→3: 13,3333; 3→6: 7,5 → Σ = 30 = q·A
{
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E: 2e8, G: 8e7, nu: 0.3, rho: 0 }), sec = m.addSection({ name: 'P', A: 0.002, Iy: 2e-6, Iz: 4e-6, J: 1e-8, Avy: 1e-3, Avz: 1e-3 });
  const A = m.addNode(0, 0, 0).id, B = m.addNode(10, 0, 0).id, C = m.addNode(0, 6, 0).id;
  const e0 = m.addElement(A, B, mat.id, sec.id).id;
  const p2 = [m.addNode(0, 2, 0).id, m.addNode(10 * (1 - 2 / 6), 2, 0).id], p4 = [m.addNode(0, 4, 0).id, m.addNode(10 * (1 - 4 / 6), 4, 0).id];
  const e2 = m.addElement(p2[0], p2[1], mat.id, sec.id).id, e4 = m.addElement(p4[0], p4[1], mat.id, sec.id).id;
  const r = panelToDistLoads(m, { id: 5, nodes: [A, B, C], q: 1, dir: 'gravity', axis: 'Y' });
  const res = (id) => { const e = m.elements.get(id), a = m.nodes.get(e.n1), b = m.nodes.get(e.n2); return r.loads.filter((l) => l.elemId === id).reduce((s, l) => s + l.w, 0) * Math.hypot(b.x - a.x, b.y - a.y); };
  ok('P5. triângulo, barra y = 0: faixa 0→1 = 9,1667 kN', res(e0), 10 * (1 - 1 / 12), 1e-6);
  ok('P5b. barra y = 2: faixa 1→3 = 13,3333 kN', res(e2), 10 * (2 - 8 / 12), 1e-6);
  ok('P5c. barra y = 4 (ápice): faixa 3→6 = 7,5 kN', res(e4), 7.5, 1e-6);
  ok('P5d. Σ = q·A = 30 kN', total(m, r.loads), 30, 1e-6);
  assert('P5e. aviso de faixa de largura variável', r.warnings.some((w) => /largura variável/.test(w)));
  const rp = panelToDistLoads(m, { id: 6, nodes: [A, B, C], q: 1, dir: 'against', axis: 'Y' });
  assert('P5f. "contra o pano" = oposto da normal (pano anti-horário visto de cima, normal +Z → carga para baixo)', rp.loads.every((l) => l.dir === 'gravity' && l.w > 0));
}
// (4) two-way refused (no uniform approximation); regeneration replaces only panel loads
{
  const { m, corners } = roof();
  const r = panelToDistLoads(m, { id: 4, nodes: corners, q: 1, mode: 'two-way' });
  assert('P4. bidirecional recusado com aviso', r.loads.length === 0 && /bidirecional/.test(r.warnings[0] || ''));
  const lc = m.addLoadCase('CM', false);
  lc.loads.push({ type: 'nodal', nodeId: corners[0], F: [0, 0, -1, 0, 0, 0] });
  lc.panels = [{ id: 7, nodes: corners, q: 2, dir: 'gravity', axis: 'Y' }];
  regeneratePanelLoads(m); regeneratePanelLoads(m);
  ok('P4b. regenerar duas vezes não duplica (Σ = 2·60)', total(m, lc.loads.filter((l) => l.type === 'dist')), 120);
  assert('P4c. carga nodal do usuário preservada', lc.loads.some((l) => l.type === 'nodal'));
  lc.panels = [];
  regeneratePanelLoads(m);
  assert('P4d. pano removido → suas cargas somem', !lc.loads.some((l) => l.panelId != null));
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
