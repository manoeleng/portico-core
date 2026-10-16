// test_galpao_wanderson_3d_design.mjs — trava de regressão do dimensionamento das barras do galpão 3D do Wanderson
// (examples/galpao_pff_wanderson_3d.s3d, seções redimensionadas em 16/10/2026): as 37 combinações ELU com os tirantes só
// à tração (como o app) e o mesmo laço de verificação do app (js/design/design_envelope.js) → nenhuma das 920 barras dos
// pórticos com razão > 1,00. NÃO é oráculo de correção (o valor sai do próprio programa): detecta mudança de solver,
// verificação NBR 14762, comprimentos destravados, combinações ou gerador que faça o exemplo deixar de passar. A
// correção de cada peça está nos testes de literatura (galpao_wanderson_15m, lit_nbr14762, …). Demora ≈ 5 min (37
// combinações com tirantes só à tração, ≈ 8 s cada): na bateria, timeout de 600 s.
import fs from 'node:fs';
const R = new URL('../', import.meta.url).href;
globalThis.window = globalThis;
await import(R + 'lib/numeric.js');
const { Serializer } = await import(R + 'js/model/serializer.js');
const { SparseStaticSolver } = await import(R + 'js/solver/static_sparse.js');
const { solveCombinationTensionOnly } = await import(R + 'js/solver/tension_only.js');
const { designMembers } = await import(R + 'js/design/design_envelope.js?v=7');
const mod = await import(R + 'js/design/design.js?v=7');
// the app in pt sets NBR 8800:2024 as the steel code (cold-formed sections go to NBR 14762); same module instance (?v=7)
const { setDefaultCode } = await import(R + 'js/design/registry.js?v=7'); setDefaultCode('steel', 'NBR8800:2024');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL', msg); } };
const m = new Serializer().fromJSON(fs.readFileSync(new URL('examples/galpao_pff_wanderson_3d.s3d', R), 'utf8'));
const params = JSON.parse(fs.readFileSync(new URL('assistant/design_params.json', R), 'utf8'));
const disResults = [...m.combinations.values()].map((c) => {
  const r = solveCombinationTensionOnly(m, c, SparseStaticSolver);
  if (!r?.res || !r.converged) throw new Error(`combinação ${c.name}: tirantes sem convergência`);
  return { name: c.name, res: r.res };
});
ok(disResults.length === 37, `37 combinações resolvidas (${disResults.length})`);
const { filas, excluidos } = designMembers(m, disResults, params, mod);
ok(filas.length === 920, `920 barras dos pórticos dimensionadas (${filas.length}; ${excluidos.length} secundárias fora do dimensionamento)`);
const grp = {};
for (const f of filas) { const g = /\(([^)]*)\)$/.exec(f.sec)?.[1] || f.sec; const o = grp[g] = grp[g] || { n: 0, nao: 0, max: 0 }; o.n++; if (!(f.ratioMax <= 1)) o.nao++; o.max = Math.max(o.max, f.ratioMax); }
for (const [g, o] of Object.entries(grp)) ok(o.nao === 0, `${g}: ${o.nao}/${o.n} reprovam (máx. ${o.max.toFixed(3)})`);
console.log(Object.entries(grp).map(([g, o]) => `${g} ${o.max.toFixed(2)}`).join(' · '));
console.log(`test_galpao_wanderson_3d_design: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
