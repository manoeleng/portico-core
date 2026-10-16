// Galpão PFF do Wanderson em 3D (tools/build_galpao_pff_wanderson_3d.mjs): oráculo = o pórtico plano
// examples/galpao_pff_wanderson.s3d. Um pórtico interno do 3D carrega o mesmo que o plano e as terças/longarinas são
// rotuladas → esforços normais iguais ao plano; a soma das reações verticais da SC é 7 × a do plano (6 internos + 2 × ½).
import fs from 'node:fs';
const R = new URL('../', import.meta.url).href;
globalThis.window = globalThis;
await import(R + 'lib/numeric.js');
const { Serializer } = await import(R + 'js/model/serializer.js');
const { StaticSolver } = await import(R + 'js/solver/static_solver.js');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL', msg); } };
const rd = (f) => new Serializer().fromJSON(fs.readFileSync(new URL('examples/' + f, R), 'utf8'));
const m2 = rd('galpao_pff_wanderson.s3d'), m3 = rd('galpao_pff_wanderson_3d.s3d');
ok(m3.nodes.size === 8 * m2.nodes.size && !m3.planar, 'oito pórticos, modelo espacial');
const E0 = m2.elements.size, SC = [...m2.loadCases.values()].find((l) => l.name === 'SC').id;
const r2 = new StaticSolver().solve(m2, SC, false), r3 = new StaticSolver().solve(m3, SC, false);
let worst = 0, Nmax = 0;
for (const e of m2.elements.values()) {
  const a = r2.getElemForces(e.id).N, b = r3.getElemForces(3 * E0 + e.id).N;   // pórtico 4 (interno)
  worst = Math.max(worst, Math.abs(a - b)); Nmax = Math.max(Nmax, Math.abs(a));
}
ok(Nmax > 10 && worst < 1e-3 * Nmax, `pórtico interno × plano: |ΔN|máx = ${worst} kN (|N|máx ${Nmax})`);
let s2 = 0, s3 = 0;
for (const n of m2.nodes.values()) if (n.restraints.uz) s2 += r2.getReaction(n.id)[2];
for (const n of m3.nodes.values()) if (n.restraints.uz) s3 += r3.getReaction(n.id)[2];
ok(Math.abs(s3 - 7 * s2) < 1e-6 * Math.abs(s2), `ΣRz SC: 3D ${s3} × 7 · plano ${7 * s2}`);
// secondary members: hinged, no self-weight, out of member design; rods tension-only
const sec = [...m3.elements.values()].filter((e) => e.layer > 1);
ok(sec.every((e) => e.designExcluded && e.releases[4] && e.releases[5] && e.releases[10] && e.releases[11]), 'secundárias rotuladas e fora do dimensionamento');
ok(sec.every((e) => m3.materials.get(e.matId).rho === 0), 'secundárias sem peso próprio (já nas cargas nodais do pórtico)');
ok(sec.filter((e) => e.cable).length === 2 * (2 * 8 + 2 * 2), 'X na cobertura (8 painéis) e nas duas paredes, nos dois tramos extremos');
console.log(`test_galpao_wanderson_3d: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
