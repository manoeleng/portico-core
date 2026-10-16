// test_connections_model.mjs — mapeamento e pré-dimensionamento das ligações do modelo (js/design/connections_model.js)
//   node tests/test_connections_model.mjs
// Oráculos:
//  (1) Manual Gerdau "Ligações para estruturas de aço" (NBR 8800:2024), tabela LCPP 30-B (p.26): W 360, 2L 76×76×6,4×230,
//      3 Ø ¾" A325N por aba, furo 21 mm (2.4.2), excentricidade desprezada (formulário 3.4.2), Vd sem recortes:
//      W 360×32,9 = 265 kN, ×51,0 = 328 kN, ×58,0 = 346 kN — a capacidade do pré-dimensionamento (V/razão) deve reproduzir.
//  (2) AISC Manual 16th ed. Table 1-7A (gabaritos): 3" → 1¾", 4" → 2½", 6" → 3½" (g1 2¼", g2 2½").
//  (3) propriedades do algoritmo: a geometria adotada atende a todas as combinações e a anterior da lista (um parafuso a
//      menos / chapa mais fina) não atende — mínimo da ordem de custo; classificação dos nós de um modelo sintético.
import * as CM from '../js/design/connections_model.js';
import { profileToSection } from '../js/design/profiles.js';
import { trussMemberConnection } from '../js/design/connections_truss.js';
import { columnBase } from '../js/design/connections_base.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 0.01) => { n++; const e = Math.abs(got / exp - 1); if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(3)}`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const mm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? v * 1000 : v]));
const W = (name) => ({ shape: 'I', dims: mm(profileToSection(name).design.dims), name, fy: 345, fu: 450 });
const PIN = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1], FIX = Array(12).fill(0);

// ---------------- AISC gages
ok('G1. AISC 1-7A: L 3" → g = 1¾" (44,45 mm)', CM.angleGage(76.2).g, 44.45, 1e-9);
ok('G2. AISC 1-7A: L 4" → g = 2½"', CM.angleGage(101.6).g, 63.5, 1e-9);
yes('G3. AISC 1-7A: L 6" → g1 = 2¼", g2 = 2½"', Math.abs(CM.angleGage(152.4).g1 - 57.15) < 1e-9 && Math.abs(CM.angleGage(152.4).g2 - 63.5) < 1e-9);

// ---------------- synthetic model: 2 columns W310×97 (bases), beam W360×51 pinned, column split (splice candidate),
// truss: continuous chord (U) 10–11–12 and a 2L diagonal 11–20 pinned, 20 on a second chord 21–20–22
const nodes = [
  { id: 1, x: 0, y: 0, z: 0, support: true }, { id: 2, x: 0, y: 0, z: 4 }, { id: 3, x: 6, y: 0, z: 0, support: true }, { id: 5, x: 6, y: 0, z: 2 }, { id: 4, x: 6, y: 0, z: 4 },
  { id: 10, x: 0, y: 5, z: 6 }, { id: 11, x: 2, y: 5, z: 6 }, { id: 12, x: 4, y: 5, z: 6 }, { id: 21, x: 0, y: 5, z: 5 }, { id: 20, x: 2, y: 5, z: 5 }, { id: 22, x: 4, y: 5, z: 5 },
];
const col = W('W 310 x 97,0'), bm = W('W 360 x 51,0');
const chord = { shape: 'U', dims: { bw: 150, bf: 60, t: 4.75 }, A: 1200, ec: 15, name: 'U 150x60x4,75', fy: 250, fu: 400 };
const diag = { shape: '2L', dims: { b: 76.2, t: 6.35 }, A: 2 * 927.4, ec: 21.4, name: '2L 76,2x6,35', fy: 250, fu: 400 };
const elems = [
  { id: 101, n1: 1, n2: 2, rel: FIX, ...col }, { id: 102, n1: 3, n2: 5, rel: FIX, ...col }, { id: 103, n1: 5, n2: 4, rel: FIX, ...col },
  { id: 201, n1: 2, n2: 4, rel: PIN, ...bm },
  { id: 301, n1: 10, n2: 11, rel: FIX, ...chord }, { id: 302, n1: 11, n2: 12, rel: FIX, ...chord }, { id: 303, n1: 21, n2: 20, rel: FIX, ...chord }, { id: 304, n1: 20, n2: 22, rel: FIX, ...chord },
  { id: 401, n1: 11, n2: 20, rel: PIN, ...diag },
];
const F = { 101: { N: -500, Vy1: 30, Vz1: 0, My1: 0, Mz1: 0, Vy2: 30, Vz2: 0, My2: 0, Mz2: 0 }, 102: { N: -400, Vy1: 0, Vz1: 0, My1: 0, Mz1: 0, Vy2: 0, Vz2: 0, My2: 0, Mz2: 20 },
  103: { N: -400, Vy1: 0, Vz1: 0, My1: 0, Mz1: 20, Vy2: 0, Vz2: 0, My2: 0, Mz2: 0 }, 201: { N: 0, Vy1: 200, Vz1: 0, My1: 0, Mz1: 0, Vy2: -200, Vz2: 0, My2: 0, Mz2: 0 },
  401: { N: 200, Vy1: 0, Vz1: 0, My1: 0, Mz1: 0, Vy2: 0, Vz2: 0, My2: 0, Mz2: 0 } };
const combos = [{ name: 'ELU 1', ef: (id) => F[id] || { N: 0, Vy1: 0, Vz1: 0, My1: 0, Mz1: 0, Vy2: 0, Vz2: 0, My2: 0, Mz2: 0 }, R: (nid) => nid === 1 ? [30, 0, 500, 0, 0, 0] : [0, 0, 400, 0, 0, 0] },
  { name: 'ELU 2 (inversão)', ef: (id) => id === 401 ? { ...F[401], N: -120 } : (F[id] || { N: 0, Vy1: 0, Vz1: 0, My1: 0, Mz1: 0, Vy2: 0, Vz2: 0, My2: 0, Mz2: 0 }), R: (nid) => [0, 0, 300, 0, 0, 0] }];
const topo = { nodes, elems };
const T = CM.topology(topo);
yes('C1. candidatos a emenda: nó 5 (pilar dividido, 2 barras colineares); nó 11 não (3 barras: banzo + diagonal)', CM.spliceCandidates(T).some((c) => c.node === 5) && !CM.spliceCandidates(T).some((c) => c.node === 11));
const { conns } = CM.classify(T, { spliceNodes: new Set([5]) });
const by = (t) => conns.filter((c) => c.tipo === t);
yes('C2. 2 bases (nós 1 e 3)', by('base').length === 2 && by('base').every((c) => [1, 3].includes(c.node)));
yes('C3. 2 ligações flexíveis (viga 201 nas duas pontas, apoio no pilar)', by('flexivel').length === 2 && by('flexivel').every((c) => c.elem === 201));
yes('C4. 2 ligações de treliça (diagonal 401 nas duas pontas)', by('trelica').length === 2 && by('trelica').every((c) => c.elem === 401));
yes('C5. 1 emenda (nó 5 marcado)', by('emenda').length === 1 && by('emenda')[0].node === 5);
const all = CM.designAll(topo, combos, { spliceNodes: new Set([5]) });
yes('C6. todas dimensionadas sem erro', all.rows.every((r) => !r.erro), all.rows.filter((r) => r.erro).map((r) => r.c.id + ': ' + r.erro).join('; '));
yes('C7. todas atendem com a geometria adotada', all.rows.every((r) => r.ok), all.rows.filter((r) => !r.ok).map((r) => r.c.id).join(','));

// ---------------- (1) Gerdau LCPP: capacity of the standard geometry
for (const [name, Vd] of [['W 360 x 32,9', 265], ['W 360 x 51,0', 328], ['W 360 x 58,0', 346]]) {
  const b = W(name), t2 = CM.topology({ nodes: [{ id: 1, x: 0, y: 0, z: 0, support: true }, { id: 2, x: 0, y: 0, z: 4 }, { id: 3, x: 6, y: 0, z: 4 }],
    elems: [{ id: 1, n1: 1, n2: 2, rel: FIX, ...col }, { id: 2, n1: 2, n2: 3, rel: PIN, ...b }] });
  const c = CM.classify(t2).conns.find((x) => x.tipo === 'flexivel');
  const r = CM.designConnection(c, t2, [{ name: 'ELU', ef: () => ({ N: 0, Vy1: 150, Vy2: -150, Vz1: 0, Vz2: 0, My1: 0, My2: 0, Mz1: 0, Mz2: 0 }), R: () => [0, 0, 0, 0, 0, 0] }],
    { excentricidade: false, dhGerdau: { 19.05: 21 } });
  yes(`F-${name}. Gerdau: 3 parafusos ¾", 2L 76×76×6,4 × 230`, r.geo.par.n === 3 && r.geo.par.db === 19.05 && r.geo.cant.L === 230, r.desc);
  ok(`F-${name}. capacidade V/razão = Gerdau Vd sem recortes ${Vd} kN`, 150 / r.ratio, Vd, 0.01);
}

// ---------------- (3) minimality: the adopted truss geometry passes and one bolt fewer fails
{ const r = all.rows.find((x) => x.c.tipo === 'trelica');
  yes('M1. treliça: geometria adotada atende tração (200) e compressão (−120)', r.ok, r.desc);
  if (r.geo.par.n > 1) { const g = JSON.parse(JSON.stringify(r.geo)); g.par.n -= 1;
    const t = trussMemberConnection({ ...g, N: 200 }), c = trussMemberConnection({ ...g, N: -120 });
    yes('M2. um parafuso a menos não atende', !(t.ok && c.ok)); }
  else yes('M2. um parafuso basta (n = 1)', true); }
{ const r = all.rows.find((x) => x.c.tipo === 'base' && x.c.node === 1);
  const tpmin = columnBase({ ...r.geo, N: 500, M: 0, V: 30 }).tpmin;
  yes('M3. base: tp adotado = menor chapa comercial ≥ tp,min', r.geo.placa.tp >= tpmin && CM.PLATES.filter((x) => x >= 12.5 && x < r.geo.placa.tp).every((x) => x < tpmin), `tp ${r.geo.placa.tp}, tpmin ${tpmin}`);
  yes('M4. base: ¾" (primeira linha da Tab. 18) e 4 chumbadores bastam para N = 500 kN, V = 30', r.geo.db === 19 && r.geo.nb === 4); }
// ---------------- welded fallback (case found on the Wanderson shed: 2L 60×2,25 cold-formed diagonal, N = 94,5 kN)
{ const { angleProps } = await import('../js/design/cf_geom.js');
  const a = angleProps({ b: 60, t: 2.25 });
  const d2 = { shape: '2L', dims: { b: 60, t: 2.25 }, A: 2 * a.A, ec: a.xg, name: '2L 60x2,25', fy: 250, fu: 400 };
  const t3 = CM.topology({ nodes: [{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 2, y: 0, z: 0 }, { id: 3, x: 1, y: 0, z: -1 }, { id: 4, x: 3, y: 0, z: -1 }],
    elems: [{ id: 1, n1: 1, n2: 2, rel: FIX, ...chord }, { id: 2, n1: 3, n2: 4, rel: FIX, ...chord }, { id: 3, n1: 1, n2: 3, rel: PIN, ...d2 }] });
  const c = CM.classify(t3).conns.find((x) => x.tipo === 'trelica');
  const r = CM.designConnection(c, t3, [{ name: 'ELU', ef: (id) => id === 3 ? { N: 94.53, Vy1: 0, Vz1: 0, My1: 0, Mz1: 0, Vy2: 0, Vz2: 0, My2: 0, Mz2: 0 } : null, R: () => null }]);
  yes('S1. 2L 60×2,25, N = 94,5 kN: parafusada não atende (seção líquida, Ct ≤ 0,9) → adotada soldada e atende', r.ok && r.geo.meio === 'solda', r.desc);
  const pb = trussMemberConnection({ secao: { tipo: '2L', b: 60, b2: 60, t: 2.25, A: a.A, ec: a.xg, fy: 250, fu: 400 }, chapa: { t: 12.5, fy: 250, fu: 400, eBorda: 25, eLat: 200, Lw: 100 }, meio: 'parafuso',
    par: { grade: 'ASTM A307', db: 16, n: 8, linhas: 1, s: 50, e1: 25, gHeel: 30 }, N: 94.53 });
  yes('S2. conferência: o maior arranjo parafusado (8 × Ø16, chapa 12,5) não atende pela seção líquida', !pb.ok && /seção líquida/.test(pb.governa.nome), pb.governa?.nome); }
// ---------------- revisão (Importantes a, b, c)
{ const tI = CM.topology({ nodes: [{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 4, y: 0, z: 0 }, { id: 3, x: 0, y: 0, z: 4 }],
    elems: [{ id: 1, n1: 1, n2: 2, rel: FIX, ...bm }, { id: 2, n1: 2, n2: 3, rel: PIN, ...W('W 250 x 25,3') }, { id: 3, n1: 3, n2: 1, rel: FIX, ...col }] });
  yes('R-a. perfil I rotulado inclinado (diagonal em W) → ligação de treliça pela alma (5.2.5-c)', CM.classify(tI).conns.some((c) => c.tipo === 'trelica' && c.elem === 2)); }
{ const r = all.rows.find((x) => x.c.tipo === 'trelica');
  yes('R-b. treliça: requisitos da chapa de nó no resultado (largura de Whitmore, Lw)', /largura na seção de Whitmore ≥ \d+ mm/.test(r.req || '') && /≤ 100 mm/.test(r.req), r.req); }
{ const mk = (Mw) => { const t = CM.topology({ nodes: [{ id: 1, x: 0, y: 0, z: 0, support: true }, { id: 2, x: 0, y: 0, z: 4 }], elems: [{ id: 1, n1: 1, n2: 2, rel: FIX, ...col }] });
    const c = CM.classify(t).conns[0];
    return CM.designConnection(c, t, [{ name: 'ELU', ef: () => ({ N: -300, Vy1: 10, Vz1: 0, My1: Mw, Mz1: 0, Vy2: 0, Vz2: 0, My2: 0, Mz2: 0 }), R: () => [10, 0, 300, 0, 0, 0] }]); };
  // W310×97: Zy = 2·15,4·305²/4 + (308 − 30,8)·9,9²/4 = 723 034 mm³ → 5 %·Zy·345/1,1 = 11,34 kN·m
  const lo = mk(5), hi = mk(15);
  yes('R-c1. eixo fraco 5 kN·m ≤ 5 % de Zy·fy/γa1 (11,34) → desprezado, atende', lo.ok && /desprezado/.test(lo.nota) && /11,34/.test(lo.nota), lo.nota);
  yes('R-c2. eixo fraco 15 kN·m > 11,34 → NÃO, fora da 6.7.1.3', !hi.ok && /fora da 6.7.1.3/.test(hi.nota)); }
// ---------------- v2: soldadas, rígida, recorte, chapa–banzo
{ // portal knee: column W310×97 (1–2, support at 1) continuous into a rafter W360×51 (2–3) continuous → LMSS
  const t = CM.topology({ nodes: [{ id: 1, x: 0, y: 0, z: 0, support: true }, { id: 2, x: 0, y: 0, z: 5 }, { id: 3, x: 8, y: 0, z: 5 }],
    elems: [{ id: 1, n1: 1, n2: 2, rel: FIX, ...col, Zx: undefined }, { id: 2, n1: 2, n2: 3, rel: FIX, ...bm }] });
  const { conns } = CM.classify(t, CM.DEFAULTS);
  const r = conns.find((c) => c.tipo === 'lmss');
  yes('V1. nó de pórtico (viga contínua no pilar contínuo) → LMSS, no topo do pilar', r && r.elem === 2 && r.apoio === 1 && r.extremidade === true);
  const out = CM.designAll({ nodes: [...t.nodes.values()], elems: t.elems }, [{ name: 'ELU', ef: (id) => id === 2 ? { N: -20, Vy1: 80, Vz1: 0, My1: 0, Mz1: 90, Vy2: 0, Vz2: 0, My2: 0, Mz2: 0 } : { N: -100, Vy1: 20, Vz1: 0, My1: 0, Mz1: 0, Vy2: 20, Vz2: 0, My2: 0, Mz2: 90 }, R: () => [20, 0, 100, 0, 0, 0] }]);
  const lm = out.rows.find((x) => x.c.tipo === 'lmss');
  yes('V2. LMSS pré-dimensionada (mesas CJP, filete na alma) — atende ou mostra o que governa', lm && lm.r && (lm.ok || /governa/.test(lm.nota || '')), lm?.desc);
  yes('V3. solda pilar–placa de base gerada para a base', out.rows.some((x) => x.c.tipo === 'soldaBase' && x.ok), out.rows.filter((x) => x.c.tipo === 'soldaBase').map((x) => x.desc + ' ' + x.ok).join()); }
{ // Fakury 10.14.3 arrangement: chord 1–2–3 (x), two diagonals ±200 kN at 60° meeting at node 2 → F∥ = 200, F⊥ = 0
  const c60 = Math.cos(Math.PI / 3), s60 = Math.sin(Math.PI / 3);
  const t = CM.topology({ nodes: [{ id: 1, x: -2, y: 0, z: 0 }, { id: 2, x: 0, y: 0, z: 0 }, { id: 3, x: 2, y: 0, z: 0 }, { id: 4, x: -c60, y: 0, z: -s60 }, { id: 5, x: c60, y: 0, z: -s60 }],
    elems: [{ id: 1, n1: 1, n2: 2, rel: FIX, ...chord }, { id: 2, n1: 2, n2: 3, rel: FIX, ...chord }, { id: 3, n1: 2, n2: 4, rel: PIN, ...diag }, { id: 4, n1: 2, n2: 5, rel: PIN, ...diag }] });
  const ef = (id) => ({ N: id === 3 ? 200 : id === 4 ? -200 : 0, Vy1: 0, Vz1: 0, My1: 0, Mz1: 0, Vy2: 0, Vz2: 0, My2: 0, Mz2: 0 });
  const out = CM.designAll({ nodes: [...t.nodes.values()], elems: t.elems }, [{ name: 'ELU', ef, R: () => null }]);
  const sb = out.rows.find((x) => x.c.tipo === 'chapaBanzo');
  ok('V4. solda chapa–banzo: F∥ = |200·(−cos60) − 200·cos60| = 200 kN (Fakury 10.14.3)', sb.D.Fpar, 200, 1e-9);
  ok('V5. F⊥ = 0 (componentes verticais se anulam)', sb.D.Fperp + 1, 1, 1e-9);
  yes('V6. comprimento mínimo de solda adotado e atende', sb.ok && /2 filetes/.test(sb.desc), sb.desc); }
{ // viga–viga: W360×51 pinned into W360×51 (same depth → 2 copes), LCSP
  const t = CM.topology({ nodes: [{ id: 1, x: 0, y: -3, z: 4 }, { id: 2, x: 0, y: 0, z: 4 }, { id: 3, x: 0, y: 3, z: 4 }, { id: 4, x: 6, y: 0, z: 4 }],
    elems: [{ id: 1, n1: 1, n2: 2, rel: FIX, ...bm }, { id: 2, n1: 2, n2: 3, rel: FIX, ...bm }, { id: 3, n1: 2, n2: 4, rel: PIN, ...bm }] });
  const c = CM.classify(t).conns.find((x) => x.tipo === 'flexivel' && x.node === 2);
  const r = CM.designConnection(c, t, [{ name: 'ELU', ef: () => ({ N: 0, Vy1: 150, Vy2: -150, Vz1: 0, Vz2: 0, My1: 0, My2: 0, Mz1: 0, Mz2: 0 }), R: () => null }], { ligacaoFlexivel: 'lcsp' });
  yes('V7. viga–viga mesma altura → 2 recortes (Lh = (bf − tw)/2, Lv = tf + 10) e LCSP soldada', r.geo._tipo === 'lcsp' && r.geo.recorte?.n === 2 && r.geo.recorte.Lh === Math.ceil((171 - 7.2) / 2), JSON.stringify(r.geo?.recorte));
  yes('V8. memória inclui flexão e flambagem local da alma recortada', r.r.checks.some((x) => /Escoamento por flexão da seção recortada/.test(x.nome)) && r.r.checks.some((x) => /Flambagem local da alma recortada/.test(x.nome))); }
{ // welded splice option
  const t = CM.topology({ nodes: [{ id: 1, x: 0, y: 0, z: 0, support: true }, { id: 2, x: 0, y: 0, z: 3 }, { id: 3, x: 0, y: 0, z: 6 }],
    elems: [{ id: 1, n1: 1, n2: 2, rel: FIX, ...col }, { id: 2, n1: 2, n2: 3, rel: FIX, ...col }] });
  const cs = CM.classify(t, { spliceNodes: new Set([2]), emendaTipo: 'soldada' }).conns.find((x) => x.node === 2);
  yes('V9. emenda marcada com opção soldada → emendaSoldada (penetração total)', cs?.tipo === 'emendaSoldada'); }
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
