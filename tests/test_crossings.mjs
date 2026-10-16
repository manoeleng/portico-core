// test_crossings.mjs — barras que se cruzam ou se tocam sem nó comum (js/model/crossings.js) e a ligação pelo nó comum
// (intersectElements / splitElementAtNode, js/model/discretize.js). Oráculo: geometria montada à mão (pontos de
// cruzamento conhecidos) e as propriedades da barra original, que as duas metades devem herdar.
globalThis.window = globalThis;
const R = new URL('../', import.meta.url).href;
const fs = await import('node:fs');
const { Model } = await import(R + 'js/model/model.js');
const { Serializer } = await import(R + 'js/model/serializer.js');
const { findCrossings } = await import(R + 'js/model/crossings.js');
const { intersectElements, splitElementAtNode } = await import(R + 'js/model/discretize.js');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL', msg); } };

const m = new Model();
const N = (x, y, z) => m.addNode(x, y, z).id;
const E = (a, b) => m.addElement(a, b).id;
// 1) X no plano XZ: (0,0,0)–(2,0,2) × (0,0,2)–(2,0,0) → cruzam em (1, 0, 1)
const x1 = E(N(0, 0, 0), N(2, 0, 2)), x2 = E(N(0, 0, 2), N(2, 0, 0));
// 2) T: barra horizontal (0,5,0)–(2,5,0) e uma barra que nasce em (1,5,0) sem nó na horizontal
const th = E(N(0, 5, 0), N(2, 5, 0)), tv = E(N(1, 5, 0), N(1, 5, 1));
// 3) já ligadas por nó comum: não aparecem
const s1 = N(0, 10, 0), s2 = N(1, 10, 1); E(s1, s2); E(s2, N(2, 10, 0));
// 4) paralelas afastadas e 5) reversas a 1 cm (acima da tolerância de 2 mm): não aparecem
E(N(0, 15, 0), N(2, 15, 0)); E(N(0, 15.5, 0), N(2, 15.5, 0));
E(N(0, 20, 0), N(2, 20, 0)); E(N(1, 19, 0.01), N(1, 21, 0.01));
// 6) X com tirante (provável intencional)
const c1 = E(N(0, 25, 0), N(2, 27, 0)), c2 = E(N(0, 27, 0), N(2, 25, 0));
m.elements.get(c1).cable = true;

const r = findCrossings(m);
ok(r.cruz.length === 2, `2 cruzamentos em X (${r.cruz.length})`);
const cx = r.cruz.find((c) => c.a === Math.min(x1, x2));
ok(cx && cx.P.join() === '1,0,1' && !cx.provavelIntencional, `X em (1, 0, 1), a verificar (${cx && cx.P})`);
const cc = r.cruz.find((c) => c.a === Math.min(c1, c2));
ok(cc && cc.P.join() === '1,26,0' && cc.provavelIntencional, 'X com tirante: provável intencional');
ok(r.no.length === 1 && r.no[0].elem === th && m.elements.get(tv).n1 === r.no[0].node && r.no[0].t === 0.5, `T: nó da barra vertical no meio da horizontal (${JSON.stringify(r.no)})`);

// ligar o X: nó comum em (1, 0, 1) e 4 trechos; as metades herdam camada, tirante, dimensionamento e molas por extremidade
const e = m.elements.get(x1);
Object.assign(e, { layer: 3, cable: true, design: { presilhas: { l1: 0.5 } }, designExcluded: 'secundária', endSprings: { 4: 100, 10: 200 }, rigidEnd: { i: 0.1, j: 0.2 } });
const j = intersectElements(m, x1, x2);
const nd = j.ok && m.nodes.get(j.nodeId);
ok(j.ok && j.nuevos === 4 && nd && Math.abs(nd.x - 1) < 1e-9 && Math.abs(nd.z - 1) < 1e-9, `ligar o X: nó comum em (1, 0, 1), 4 trechos (${JSON.stringify(j)})`);
const halves = [...m.elements.values()].filter((x) => x.layer === 3);
const h1 = halves.find((x) => x.n2 === j.nodeId), h2 = halves.find((x) => x.n1 === j.nodeId);
ok(halves.length === 2 && halves.every((x) => x.cable && x.design?.presilhas?.l1 === 0.5 && x.designExcluded === 'secundária'), 'metades herdam camada, tirante, presilhas e exclusão do dimensionamento');
ok(h1 && h2 && JSON.stringify(h1.endSprings) === '{"4":100}' && JSON.stringify(h2.endSprings) === '{"10":200}', `molas: GDL da ponta i na 1ª metade, da ponta j na 2ª (${JSON.stringify(h1?.endSprings)} / ${JSON.stringify(h2?.endSprings)})`);
ok(h1.rigidEnd.i === 0.1 && h1.rigidEnd.j === 0 && h2.rigidEnd.i === 0 && h2.rigidEnd.j === 0.2, 'trecho rígido só nas pontas originais');
halves[0].design.presilhas.l1 = 9;
ok(halves[1].design.presilhas.l1 === 0.5, 'cópia profunda (as metades não compartilham objetos)');
// ligar o T: divide a horizontal no nó existente
const sp = splitElementAtNode(m, th, r.no[0].node);
ok(sp && sp.length === 2 && !m.elements.has(th), 'T ligado: horizontal dividida no nó existente');
const r2 = findCrossings(m);
ok(r2.cruz.length === 1 && r2.no.length === 0, `depois de ligar, só resta o X com tirante (${r2.cruz.length} / ${r2.no.length})`);

// galpão 3D do Wanderson: todos os cruzamentos envolvem tirantes (X, correntes) — nenhum "a verificar"
const g = new Serializer().fromJSON(fs.readFileSync(new URL('examples/galpao_pff_wanderson_3d.s3d', R), 'utf8'));
const rg = findCrossings(g);
ok(rg.cruz.length > 0 && [...rg.cruz, ...rg.no].every((c) => c.provavelIntencional), `galpão 3D: ${rg.cruz.length} cruzamentos e ${rg.no.length} nós sobre barra, todos com tirante`);
console.log(`test_crossings: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
