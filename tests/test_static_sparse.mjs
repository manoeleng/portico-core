// SparseStaticSolver (RCM + Cholesky em banda sobre CSR) × StaticSolver denso (numeric.js LU) — galpão PFF do Wanderson
// em 3D (2 880 GL): deslocamentos, esforços e reações iguais; combinação com tirantes só à tração (tension_only) com o
// mesmo conjunto de tirantes frouxos e os mesmos esforços. Também o pórtico plano (planar: GL fora do plano presos).
import fs from 'node:fs';
const R = new URL('../', import.meta.url).href;
globalThis.window = globalThis;
await import(R + 'lib/numeric.js');
const { Serializer } = await import(R + 'js/model/serializer.js');
const { StaticSolver } = await import(R + 'js/solver/static_solver.js');
const { SparseStaticSolver } = await import(R + 'js/solver/static_sparse.js');
const { solveCombinationTensionOnly } = await import(R + 'js/solver/tension_only.js');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL', msg); } };
const rd = (f) => new Serializer().fromJSON(fs.readFileSync(new URL('examples/' + f, R), 'utf8'));
function compare(m, a, b, tag) {
  let dN = 0, Nmax = 0, dR = 0, Rmax = 0, dU = 0, Umax = 0;
  for (const e of m.elements.values()) { const fa = a.getElemForces(e.id), fb = b.getElemForces(e.id);
    for (const k of ['N', 'Vy1', 'Vz1', 'My1', 'Mz1', 'My2', 'Mz2']) { dN = Math.max(dN, Math.abs(fa[k] - fb[k])); Nmax = Math.max(Nmax, Math.abs(fa[k])); } }
  for (const n of m.nodes.values()) { const ra = a.getReaction(n.id), rb = b.getReaction(n.id), ua = a.getNodeDisp(n.id), ub = b.getNodeDisp(n.id);
    for (let i = 0; i < 6; i++) { dR = Math.max(dR, Math.abs(ra[i] - rb[i])); Rmax = Math.max(Rmax, Math.abs(ra[i])); dU = Math.max(dU, Math.abs(ua[i] - ub[i])); Umax = Math.max(Umax, Math.abs(ua[i])); } }
  ok(dN <= 1e-6 * Nmax, `${tag}: esforços ${dN} (máx ${Nmax})`);
  ok(dR <= 1e-6 * Rmax, `${tag}: reações ${dR} (máx ${Rmax})`);
  ok(dU <= 1e-6 * Umax, `${tag}: deslocamentos ${dU} (máx ${Umax})`);
}
{
  const m = rd('galpao_pff_wanderson.s3d');
  for (const lc of m.loadCases.values()) compare(m, new StaticSolver().solve(m, lc.id, !!lc.selfWeight), new SparseStaticSolver().solve(m, lc.id, !!lc.selfWeight), `plano ${lc.name}`);
}
{
  const m = rd('galpao_pff_wanderson_3d.s3d');
  const lc = [...m.loadCases.values()].find((l) => l.name.startsWith('Vento X'));
  let t = Date.now(); const a = new StaticSolver().solve(m, lc.id, false); const tD = Date.now() - t;
  t = Date.now(); const b = new SparseStaticSolver().solve(m, lc.id, false); const tS = Date.now() - t;
  compare(m, a, b, `3D ${lc.name}`);
  ok(b.solverKind === 'banda·dispersa', 'caminho esparso usado');
  console.log(`  denso ${tD} ms × esparso ${tS} ms (banda ${b.bandwidth})`);
  const c = [...m.combinations.values()][0];
  const rD = solveCombinationTensionOnly(m, c, StaticSolver), rS = solveCombinationTensionOnly(m, c, SparseStaticSolver);
  ok(rD.converged && rS.converged && JSON.stringify([...rD.slack].sort()) === JSON.stringify([...rS.slack].sort()) && rS.slack.length > 0, `tirantes frouxos iguais (${rS.slack.length})`);
  compare(m, rD.res, rS.res, `3D ${c.name} só tração`);
}
console.log(`test_static_sparse: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
