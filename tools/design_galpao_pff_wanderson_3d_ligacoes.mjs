// design_galpao_pff_wanderson_3d_ligacoes.mjs — node tools/design_galpao_pff_wanderson_3d_ligacoes.mjs
// Pre-designs the connections of examples/galpao_pff_wanderson_3d.s3d (run after build_galpao_pff_wanderson_3d.mjs) and
// saves them in the file as model.connectionDesign — the same record as "Ligações do modelo → Gravar no modelo" — so the
// example opens with Assistente → "Ligações gravadas — mostrar no 3D" and the section 3.1 of the memorial ready.
// Forces as in the app: load cases by the sparse solver; ELU combinations re-solved with the tension-only rods
// (tension_only.js, CYPE 3D 1.6.2); connection design by the same adapter and defaults as the window.
import fs from 'node:fs';
const R = new URL('../', import.meta.url).href;
globalThis.window = globalThis;
await import(R + 'lib/numeric.js');
const { Serializer } = await import(R + 'js/model/serializer.js');
const { SparseStaticSolver } = await import(R + 'js/solver/static_sparse.js');
const { solveCombinationTensionOnly } = await import(R + 'js/solver/tension_only.js');
const { modelTopology } = await import(R + 'js/ui/connections_model_dialog.js');
const { designAll, DEFAULTS } = await import(R + 'js/design/connections_model.js');
const FILE = new URL('examples/galpao_pff_wanderson_3d.s3d', R);
const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const m = new Serializer().fromJSON(JSON.stringify(raw));
const t0 = Date.now();
const combos = [...m.combinations.values()].map((c) => {
  const r = solveCombinationTensionOnly(m, c, SparseStaticSolver);
  if (!r?.res || !r.converged) throw new Error(`combinação ${c.name}: tirantes sem convergência`);
  return { name: c.name, ef: (id) => r.res.getElemForces(id), R: (nid) => r.res.getReaction(nid) };
});
const { topo, avisos } = modelTopology({ model: m });
const P = { ...DEFAULTS };
const out = designAll(topo, combos, P);
const rows = out.rows.map((r) => ({ id: r.c.id, tipo: r.c.tipo, node: r.c.node, elem: r.c.elem, perfil: out.T.elems.find((e) => e.id === r.c.elem)?.name || '',
  desc: r.desc || r.erro || '', combo: r.D?.combo || '', ratio: r.ratio, ok: !!r.ok, nota: r.nota || '', req: r.req || '', geo: r.geo ? JSON.parse(JSON.stringify(r.geo)) : null }));
raw.connectionDesign = { versao: 1, data: new Date().toLocaleDateString('pt-BR'), nCombos: combos.length,
  params: JSON.parse(JSON.stringify({ ...P, spliceNodes: [...(P.spliceNodes || [])] })), rows, avisos: [...avisos, ...out.avisos] };
fs.writeFileSync(FILE, JSON.stringify(raw));
const nao = rows.filter((r) => !r.ok).length, mx = rows.reduce((a, r) => (r.ratio > a.ratio ? r : a), rows[0]);
console.log(`${rows.length} ligações gravadas (${nao} não atendem), ${combos.length} combinações com tirantes só à tração; maior razão ${mx.ratio.toFixed(4)} em ${mx.id} (${mx.combo}) — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
