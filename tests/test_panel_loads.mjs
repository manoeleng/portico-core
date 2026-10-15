// test_panel_loads.mjs — carga por pano (unidirecional): faixa de influência por barra, total = q·A
//   node tests/test_panel_loads.mjs
// Oráculo por cálculo manual (largura de influência): pano 10 × 6 m, terças paralelas a X a cada 1,5 m
// (y = 0; 1,5; 3; 4,5; 6), vão da telha em Y, q = 1 kN/m² → terças de borda w = 0,75 kN/m, internas 1,5 kN/m;
// vigas de borda paralelas ao vão (x = 0 e 10) não recebem nada; Σ w·L = q·A = 60 kN.
import { Model } from '../js/model/model.js';
import { panelToDistLoads, regeneratePanelLoads, panelMembers } from '../js/model/panel_loads.js';
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
// (6) interrupted member (review layout): 12 × 8 panel, members along Y at x = 2, 10 (8 m) and x = 6 only y 0→3:
//     total still q·A = 96, with a warning that the split between those members is rough
{
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E: 2e8, G: 8e7, nu: 0.3, rho: 0 }), sec = m.addSection({ name: 'P', A: 0.002, Iy: 2e-6, Iz: 4e-6, J: 1e-8, Avy: 1e-3, Avz: 1e-3 });
  const c = [m.addNode(0, 0, 0).id, m.addNode(12, 0, 0).id, m.addNode(12, 8, 0).id, m.addNode(0, 8, 0).id];
  for (const x of [2, 10]) m.addElement(m.addNode(x, 0, 0).id, m.addNode(x, 8, 0).id, mat.id, sec.id);
  m.addElement(m.addNode(6, 0, 0).id, m.addNode(6, 3, 0).id, mat.id, sec.id);
  const r = panelToDistLoads(m, { id: 8, nodes: c, q: 1, dir: 'gravity', axis: 'X' });
  ok('P6. barra interrompida: Σ = q·A = 96 kN', total(m, r.loads), 96, 1e-6);
  assert('P6b. aviso de vizinha parcial', r.warnings.some((w) => /cobre só parte/.test(w)), r.warnings.join(' | '));
}
// (7) wind on a sloped roof (15°, rising along +Y): pressure ⊥ to the panel, into the roof → per purlin of strip b:
//     horizontal +Y component q·b·sin15° and downward q·b·cos15°; suction the opposite; same result for both node orders
{
  const th = 15 * Math.PI / 180;
  const { m, purl, corners } = roof((y) => y * Math.tan(th));
  const b = 1.5 / Math.cos(th);                                    // interior strip along the slope (purlins 1,5 m apart in plan)
  const comp = (loads, id, dir) => loads.filter((l) => l.elemId === id && l.dir === dir).reduce((s, l) => s + l.w, 0);
  for (const [nm, ord] of [['anti-horário', corners], ['horário', [...corners].reverse()]]) {
    const r = panelToDistLoads(m, { id: 9, nodes: ord, q: 1, dir: 'against', axis: 'Y' });
    ok(`P7. vento pressão (${nm}): componente vertical ↓ = q·b·cos15°`, comp(r.loads, purl[2], 'gravity'), b * Math.cos(th), 1e-6);
    ok(`P7b. vento pressão (${nm}): componente horizontal +Y = q·b·sen15°`, comp(r.loads, purl[2], 'globalY'), b * Math.sin(th), 1e-6);
  }
  const su = panelToDistLoads(m, { id: 9, nodes: corners, q: 1, dir: 'normal', axis: 'Y' });
  ok('P7c. vento sucção: componente vertical para cima (w < 0 na gravidade)', comp(su.loads, purl[2], 'gravity'), -b * Math.cos(th), 1e-6);
}
// (8) tirantes (cable) never take surface load: a rod along X in the panel, at y = 2,25 (between purlins)
{
  const { m, purl, corners } = roof();
  const mat = [...m.materials.values()][0], sec = [...m.sections.values()][0];
  const rod = m.addElement(m.addNode(0, 2.25, 3).id, m.addNode(10, 2.25, 3).id, mat.id, sec.id);
  m.updateElement(rod.id, { cable: true });
  const r = panelToDistLoads(m, { id: 10, nodes: corners, q: 1, dir: 'gravity', axis: 'Y' });
  assert('P8. tirante no pano não recebe carga', !r.loads.some((l) => l.elemId === rod.id));
  ok('P8b. terças continuam com Σ = q·A = 60 kN', total(m, r.loads), 60);
}
// (4) two-way refused (no uniform approximation); regeneration replaces only panel loads
{
  const { m, corners } = roof();
  const r = panelToDistLoads(m, { id: 4, nodes: corners, q: 1, mode: 'two-way' });
  assert('P4. bidirecional recusado com aviso', r.loads.length === 0 && /bidirecional/.test(r.warnings[0] || ''));
  // old format (panel inside the case) is migrated: geometry → model.panels, load → lc.panelLoads
  const lc = m.addLoadCase('CM', false);
  lc.loads.push({ type: 'nodal', nodeId: corners[0], F: [0, 0, -1, 0, 0, 0] });
  lc.panels = [{ id: 7, nodes: corners, q: 2, dir: 'gravity', axis: 'Y' }];
  regeneratePanelLoads(m); regeneratePanelLoads(m);
  ok('P4b. regenerar duas vezes não duplica (Σ = 2·60)', total(m, lc.loads.filter((l) => l.type === 'dist')), 120);
  assert('P4c. carga nodal do usuário preservada; formato antigo migrado', lc.loads.some((l) => l.type === 'nodal') && m.panels.length === 1 && lc.panelLoads.length === 1 && !lc.panels);
  lc.panelLoads = [];
  regeneratePanelLoads(m);
  assert('P4d. carga do pano removida → suas cargas de barra somem (o pano continua)', !lc.loads.some((l) => l.panelId != null) && m.panels.length === 1);
}
// (9) one panel, several loads: two in the same case (roofing 0,15 + ceiling 0,10) and wind in another case
{
  const { m, corners } = roof();
  m.panels = [{ id: 1, nodes: corners, axis: 'Y', layer: 1 }];
  const cm = m.addLoadCase('CM', false), v = m.addLoadCase('Vento', false);
  cm.panelLoads = [{ id: 1, panelId: 1, q: 0.15, dir: 'gravity', area: 'real' }, { id: 2, panelId: 1, q: 0.10, dir: 'gravity', area: 'real' }];
  v.panelLoads = [{ id: 1, panelId: 1, q: 0.6, dir: 'normal', area: 'real' }];
  regeneratePanelLoads(m);
  ok('P9. caso CM: Σ = (0,15 + 0,10)·60 = 15 kN', total(m, cm.loads), 15);
  assert('P9b. duas cargas distintas no mesmo pano (panelLoadId 1 e 2)', new Set(cm.loads.map((l) => l.panelLoadId)).size === 2);
  ok('P9c. caso Vento: sucção 0,6·60 = 36 kN para cima', -total(m, v.loads), 36);
}

// (10) roles of the bars in the panel (dashed drawing): the 'loaded' ones are exactly those that get load in P1
{
  const { m, purl, edge, corners, L } = roof();
  const e0 = m.elements.get(purl[0]), rod = m.addElement(L[0][0], L[1][1], e0.matId, e0.secId).id; m.updateElement(rod, { cable: true });
  const pan = { id: 1, nodes: corners, q: 1, dir: 'gravity', axis: 'Y' };
  const roles = panelMembers(m, pan), r = panelToDistLoads(m, pan);
  const got = new Set(r.loads.map((l) => l.elemId));
  assert('P10. terças: papel "loaded" = barras que recebem carga', purl.every((id) => roles.get(id) === 'loaded' && got.has(id)));
  assert('P10b. vigas paralelas ao vão: "parallel" (tracejadas)', edge.every((id) => roles.get(id) === 'parallel' && !got.has(id)));
  assert('P10c. tirante no pano: "cable" (tracejado), sem carga', roles.get(rod) === 'cable' && !got.has(rod));
  assert('P10d. nenhuma outra barra classificada', roles.size === purl.length + edge.length + 1);
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
