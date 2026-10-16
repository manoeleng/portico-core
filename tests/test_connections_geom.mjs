// Geometria simplificada das ligações no 3D (js/design/connections_geom.js) — conferência geométrica feita à mão:
// placa de base com a face superior no nó e chumbadores a a1 das bordas; parafusos da chapa de nó fora da face do banzo
// (distância ao nó = meia altura do banzo / sen θ + 20 mm + e1) e no plano da treliça; cantoneiras da viga–pilar
// encostadas na face da mesa do pilar (d/2); talas da emenda com o comprimento da furação. Por fim, todas as ligações do
// galpão PFF do Wanderson geram peças com coordenadas finitas.
import fs from 'node:fs';
const R = new URL('../', import.meta.url).href;
globalThis.window = globalThis;
const { connectionPrimitives, makeContext } = await import(R + 'js/design/connections_geom.js');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL', msg); } };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} × ${b}`);
const PIN = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1], FIX = Array(12).fill(0), PINJ = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1];
function mk(nodes, elems) {
  const model = { nodes: new Map(nodes.map((n) => [n.id, n])), elements: new Map(elems.map((e) => [e.id, e])) };
  const ends = new Map();
  for (const e of elems) for (const [nid, o] of [[e.n1, 0], [e.n2, 6]]) { if (!ends.has(nid)) ends.set(nid, []); ends.get(nid).push({ e: { ...e, rel: e.releases }, o }); }
  return makeContext(model, { elems: elems.map((e) => ({ ...e, rel: e.releases })), ends });
}
const prims = (ctx, row) => connectionPrimitives([row], ctx).flatMap((x) => x.prims);   // the row's pieces + the node's gusset

// 1 — base de perna (Wanderson P1: U 200x100x2,65, placa 360 × 160 × 19, 4 × ¾", a1 = 40, a2 = 80)
{
  const ctx = mk([{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 0, y: 0, z: 1.6 }], [{ id: 1, n1: 1, n2: 2, beta: 90, releases: FIX, shape: 'U', dims: { bw: 200, bf: 100, t: 2.65 } }]);
  const g = { perna: { bw: 200, bf: 100, t: 2.65 }, nb: 4, db: 19.05, a1: 40, a2: 80, placa: { tp: 19 } };
  const p = prims(ctx, { id: 'P1', tipo: 'basePerna', node: 1, elem: 1, geo: g });
  const pl = p.find((x) => x.m === 'plate'), an = p.filter((x) => x.m === 'anchor');
  ok(pl && an.length === 4, 'placa + 4 chumbadores');
  near(pl.h[0] * 2000, 360, 1e-9, 'H = bw + 4·a1 = 200 + 160'); near(pl.h[1] * 2000, 160, 1e-9, 'B = a2 + 2·a1 = 80 + 80'); near(pl.h[2] * 2000, 19, 1e-9, 'tp');
  near(pl.c[2] + pl.h[2], 0, 1e-12, 'face superior da placa no nó (z = 0)');
  const off = an.map((a) => [Math.abs(a.c[0]) * 1000, Math.abs(a.c[1]) * 1000].sort((u, v) => u - v));
  ok(off.every(([s, l]) => Math.abs(s - 40) < 1e-6 && Math.abs(l - 140) < 1e-6), `chumbadores a ±(180 − 40) = ±140 e ±(80 − 40) = ±40 mm: ${JSON.stringify(off)}`);
  near((an[0].c[2] + an[0].h) * 1000, 50, 1e-9, 'ponta do chumbador 50 mm acima do nó');
}
// 2 — chapa de nó: banzo U 150 horizontal contínuo, diagonal a 45° rotulada (3 × Ø12,5, s = 40, e1 = 20, chapa 4,75)
{
  const s2 = Math.SQRT1_2;
  const ctx = mk([{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: -1, y: 0, z: 0 }, { id: 3, x: 1, y: 0, z: 0 }, { id: 4, x: 1, y: 0, z: 1 }],
    [{ id: 1, n1: 2, n2: 1, beta: 0, releases: FIX, shape: 'U', dims: { bw: 150, bf: 75, t: 2.65 } }, { id: 2, n1: 1, n2: 3, beta: 0, releases: FIX, shape: 'U', dims: { bw: 150, bf: 75, t: 2.65 } },
      { id: 3, n1: 1, n2: 4, beta: 0, releases: PIN, shape: '2L', dims: { b: 60, t: 2.25, gap: 8 } }]);
  const g = { secao: { tipo: '2L', b: 60, t: 2.25 }, chapa: { t: 4.75, eBorda: 20, eLat: 46.19 }, meio: 'parafuso', par: { db: 12.5, n: 3, linhas: 1, s: 40, e1: 20 } };
  const p = prims(ctx, { id: 'T3i', tipo: 'trelica', node: 1, elem: 3, geo: g });
  const b = p.filter((x) => x.m === 'bolt');
  ok(b.length === 3, '3 parafusos');
  const clear = 75 / s2 + 20, dist = b.map((x) => Math.hypot(...x.c) * 1000).sort((u, v) => u - v);
  near(dist[0], clear + 20, 1e-6, 'primeiro parafuso a 75/sen45° + 20 + e1 do nó'); near(dist[1] - dist[0], 40, 1e-6, 's = 40');
  ok(b.every((x) => x.c[2] * 1000 > 75 && Math.abs(x.c[1]) < 1e-12 && Math.abs(Math.abs(x.ax[1]) - 1) < 1e-12), 'parafusos acima da face do banzo, no plano da treliça, eixo ⊥ ao plano');
  const pl = p.find((x) => x.k === 'poly'); near(pl.h * 2000, 4.75, 1e-9, 'espessura da chapa de nó'); near(Math.abs(pl.n[1]), 1, 1e-12, 'chapa no plano x–z');
  // one gusset for the node: montante (vertical, 2L 40, 3 × Ø12,5) + the diagonal on the same chord node → a single plate,
  // its edge on the chord face z = 75 mm, all bolts of both members inside it
  const ctx2 = mk([{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: -1, y: 0, z: 0 }, { id: 3, x: 1, y: 0, z: 0 }, { id: 4, x: 1, y: 0, z: 1 }, { id: 5, x: 0, y: 0, z: 1 }],
    [{ id: 1, n1: 2, n2: 1, beta: 0, releases: FIX, shape: 'U', dims: { bw: 150, bf: 75, t: 2.65 } }, { id: 2, n1: 1, n2: 3, beta: 0, releases: FIX, shape: 'U', dims: { bw: 150, bf: 75, t: 2.65 } },
      { id: 3, n1: 1, n2: 4, beta: 0, releases: PIN, shape: '2L', dims: { b: 60, t: 2.25, gap: 8 } }, { id: 4, n1: 1, n2: 5, beta: 0, releases: PIN, shape: '2L', dims: { b: 40, t: 2.25, gap: 8 } }]);
  const g2 = { secao: { tipo: '2L', b: 40, t: 2.25 }, chapa: { t: 6.3, eBorda: 20, eLat: 46.19 }, meio: 'parafuso', par: { db: 12.5, n: 3, linhas: 1, s: 40, e1: 20 } };
  const all = connectionPrimitives([{ id: 'T3i', tipo: 'trelica', node: 1, elem: 3, geo: g }, { id: 'T4i', tipo: 'trelica', node: 1, elem: 4, geo: g2 }], ctx2);
  const plates = all.flatMap((x) => x.prims).filter((x) => x.m === 'plate'), bolts2 = all.flatMap((x) => x.prims).filter((x) => x.m === 'bolt');
  ok(plates.length === 1 && plates[0].k === 'poly', `uma única chapa no nó (${plates.length})`);
  near(plates[0].h * 2000, 6.3, 1e-9, 'espessura = a maior das barras do nó (6,3)');
  near(Math.min(...plates[0].pts.map((q) => q[2])) * 1000, 75, 1e-6, 'borda da chapa na face do banzo (z = 75 mm)');
  const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j];
    if ((a[2] > pt[2]) !== (b[2] > pt[2]) && pt[0] < (b[0] - a[0]) * (pt[2] - a[2]) / (b[2] - a[2]) + a[0]) c = !c; } return c; };
  ok(bolts2.length === 6 && bolts2.every((b) => inside(b.c, plates[0].pts)), 'os 6 parafusos (diagonal + montante) dentro da chapa');
}
// 3 — viga–pilar flexível (cantoneira dupla): pilar I d = 250 vertical (alma ao longo de x), viga I ao longo de +x rotulada
{
  const ctx = mk([{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 0, y: 0, z: 3 }, { id: 3, x: 5, y: 0, z: 3 }],
    [{ id: 1, n1: 1, n2: 2, beta: 0, releases: FIX, shape: 'I', dims: { d: 250, bf: 150, tf: 9, tw: 6 } }, { id: 2, n1: 2, n2: 3, beta: 0, releases: PIN, shape: 'I', dims: { d: 310, bf: 165, tf: 10, tw: 6.6 } }]);
  const g = { tipo: 'cantoneira', viga: { tw: 6.6, d: 310 }, cant: { b: 76, t: 6.4, L: 180, ev: 30, g: 45 }, par: { db: 15.875, n: 3, s: 60 } };
  const p = prims(ctx, { id: 'F2i', tipo: 'flexivel', node: 2, elem: 2, geo: g });
  const legs = p.filter((x) => x.m === 'plate'), bs = p.filter((x) => x.m === 'bolt');
  ok(legs.length === 4 && bs.length === 3 * 2 + 3, '2 cantoneiras (4 abas), 6 parafusos no pilar e 3 na alma');
  const sup = legs.filter((x) => Math.abs(x.h[0] * 1000 - 3.2) < 1e-9);
  ok(sup.length === 2 && sup.every((x) => Math.abs((x.c[0] - x.h[0]) * 1000 - 125) < 1e-9), 'aba no suporte encostada na face da mesa (x = d/2 = 125 mm)');
  const zs = [...new Set(bs.map((x) => Math.round((x.c[2] - 3) * 1e6) / 1e3))].sort((u, v) => u - v);
  ok(JSON.stringify(zs) === JSON.stringify([-60, 0, 60]), `parafusos em −L/2 + ev + i·s = −60, 0, 60 mm: ${zs}`);
}
// 4 — emenda com talas (I d = 400, folga 10, mesa: 2 colunas s = 50 e1 = et = 30; alma: nc = 2, sh = 50, e1w = et = 30)
{
  const ctx = mk([{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 2, y: 0, z: 0 }, { id: 3, x: 4, y: 0, z: 0 }],
    [{ id: 1, n1: 1, n2: 2, beta: 0, releases: FIX, shape: 'I', dims: { d: 400, bf: 180, tf: 12, tw: 8 } }, { id: 2, n1: 2, n2: 3, beta: 0, releases: FIX, shape: 'I', dims: { d: 400, bf: 180, tf: 12, tw: 8 } }]);
  const g = { folga: 10, perfil: { d: 400, bf: 180, tf: 12, tw: 8 }, talaMesa: { t: 9.5, b: 180 }, talaAlma: { h: 330, t: 6.3 },
    parMesa: { db: 19.05, linhas: 2, ncol: 2, s: 50, g: 100, e1: 30, et: 30 }, parAlma: { db: 19.05, nr: 4, nc: 2, sv: 60, sh: 50, e1w: 30, ev: 75, et: 30 } };
  const p = prims(ctx, { id: 'E2', tipo: 'emenda', node: 2, elem: 1, geo: g });
  const tm = p.filter((x) => x.m === 'plate' && Math.abs(x.h[2] * 2000 - 9.5) < 1e-9), ta = p.filter((x) => x.m === 'plate' && Math.abs(x.h[2] * 2000 - 6.3) < 1e-9);
  near(tm[0].h[0] * 2000, 10 + 2 * (30 + 50 + 30), 1e-9, 'tala de mesa = folga + 2·(e1 + s + et) = 230 mm');
  near(ta[0].h[0] * 2000, 230, 1e-9, 'talas de alma = 230 mm');
  ok(p.filter((x) => x.m === 'bolt').length === 2 * (2 * 2 * 2 + 2 * 4), 'parafusos: 2 lados × (2 mesas × 2 linhas × 2 colunas + 2 × 4 na alma) = 32');
  near(Math.max(...tm.map((x) => x.c[2] + x.h[2])) * 1000, 200 + 9.5, 1e-9, 'tala de mesa por fora da mesa (d/2 + t)');
}
// 5 — todas as ligações do galpão do Wanderson (pórtico plano) geram peças finitas
{
  await import(R + 'lib/numeric.js');
  const { Serializer } = await import(R + 'js/model/serializer.js');
  const { StaticSolver } = await import(R + 'js/solver/static_solver.js');
  const { modelTopology } = await import(R + 'js/ui/connections_model_dialog.js');
  const { designAll, topology } = await import(R + 'js/design/connections_model.js');
  const m = new Serializer().fromJSON(fs.readFileSync(new URL('examples/galpao_pff_wanderson.s3d', R), 'utf8'));
  const by = new Map(); for (const lc of m.loadCases.values()) by.set(lc.id, new StaticSolver().solve(m, lc.id, !!lc.selfWeight));
  const KEYS = ['N', 'Vy1', 'Vz1', 'My1', 'Mz1', 'Vy2', 'Vz2', 'My2', 'Mz2'];
  const combos = [...m.combinations.values()].map((c) => ({ name: c.name,
    ef: (id) => { const o = Object.fromEntries(KEYS.map((k) => [k, 0])); for (const { lcId, factor } of c.factors) { const f = by.get(lcId).getElemForces(id); for (const k of KEYS) o[k] += factor * (f[k] || 0); } return o; },
    R: (nid) => { const o = [0, 0, 0, 0, 0, 0]; for (const { lcId, factor } of c.factors) { const r = by.get(lcId).getReaction(nid); for (let i = 0; i < 6; i++) o[i] += factor * r[i]; } return o; } }));
  const { topo } = modelTopology({ model: m });
  for (const basePFF of ['perna', 'unica']) {
    const out = designAll(topo, combos, { basePFF });
    const g = connectionPrimitives(out.rows, makeContext(m, topology(topo)));
    const nums = (q) => q.k === 'poly' ? [...q.pts.flat(), ...q.n, q.h] : [...q.c, ...(q.h.length ? q.h : [q.h]), ...(q.a ? q.a.flat() : q.ax)];
    const finite = g.every((x) => x.prims.every((q) => nums(q).every(Number.isFinite)));
    const rowsG = g.filter((x) => !x.gusset), gus = g.filter((x) => x.gusset);
    const trussNodes = new Set(out.rows.filter((r) => r.c.tipo === 'trelica').map((r) => r.c.node));
    ok(rowsG.length === out.rows.length && rowsG.every((x) => x.prims.length > 0) && finite, `${basePFF}: ${rowsG.length}/${out.rows.length} ligações com peças finitas`);
    // one gusset per truss node and side of the continuous member: with the chords hinged to the legs, the 4 knee nodes
    // (chords on both sides of the leg) get one plate on each side
    const per = new Map(); for (const x of gus) per.set(x.node, (per.get(x.node) || 0) + 1);
    const two = [...per.values()].filter((v) => v === 2).length;
    ok(per.size === trussNodes.size && [...per.keys()].every((n) => trussNodes.has(n)) && [...per.values()].every((v) => v <= 2) && two === 4, `${basePFF}: uma chapa por nó de treliça e por lado (${gus.length} chapas, ${trussNodes.size} nós, ${two} com chapa dos dois lados)`);
    if (basePFF === 'unica') {
      const u = g.find((x) => x.tipo === 'baseUnica'), pl = u?.prims.find((q) => q.m === 'plate'), r = out.rows.find((x) => x.c.id === u.id);
      near(pl.h[0] * 2000, r.geo.placa.H, 1e-9, 'placa única: H na direção perna–perna');
      near(pl.c[0], 0.4, 1e-9, 'placa única centrada entre as pernas (x = 0,4 m)');
    }
  }
}
console.log(`test_connections_geom: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
