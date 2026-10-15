// test_tension_only.mjs — tension-only members (tirantes) solved per combination (js/solver/tension_only.js)
//   node tests/test_tension_only.mjs
// Oracle (statics, independent of the code): pinned square frame 4 m wide × 3 m high (columns pinned at the base,
// pinned beam, axially rigid) braced by an X of rods; horizontal H = 10 kN at the top. cosθ = 4/5.
//   linear (both rods active, equal sections): each rod ±H/(2·cosθ) = ±6,25 kN;
//   tension-only: the compressed rod goes slack and the other takes H/cosθ = 12,5 kN (the frame alone is a mechanism).
import { Model } from '../js/model/model.js';
import { StaticSolver } from '../js/solver/static_solver.js';
import { solveCombinationTensionOnly } from '../js/solver/tension_only.js';
globalThis.window = globalThis;
await import('../lib/numeric.js');

let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-4) => { n++; if (!(Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)))) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${(+got).toFixed(4)}`); };
const assert = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name}${info ? ' · ' + info : ''}`); } else console.log(`ok   ${name}`); };

function frame(sign = 1) {
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E: 2e8, G: 8e7, nu: 0.3, rho: 0 });
  // frame members axially rigid (the ±H/(2cosθ) split of the linear case assumes it; with finite EA the shortening
  // of the columns unbalances the two rods slightly)
  const col = m.addSection({ name: 'W', A: 10, Iy: 1e-5, Iz: 3e-5, J: 1e-7, Avy: 0.002, Avz: 0.002 });
  const rodS = m.addSection({ name: 'φ12', A: 1.131e-4, Iy: 1e-9, Iz: 1e-9, J: 2e-9, Avy: 1e-4, Avz: 1e-4 });
  // every member is pinned at both ends in the X–Z plane (local rz = rotation about global Y for these members), so
  // the node rotation ry has no stiffness of its own: it is held (it does not change any member force)
  const PIN = { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 }, TOP = { uy: 1, rx: 1, ry: 1, rz: 1 };
  const a = m.addNode(0, 0, 0, PIN).id, b = m.addNode(4, 0, 0, PIN).id, c = m.addNode(4, 0, 3, TOP).id, d = m.addNode(0, 0, 3, TOP).id;
  const hinge = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];          // in-plane bending released at both ends
  for (const [p, q] of [[a, d], [b, c], [d, c]]) m.updateElement(m.addElement(p, q, mat.id, col.id).id, { releases: hinge });
  const r1 = m.addElement(a, c, mat.id, rodS.id), r2 = m.addElement(b, d, mat.id, rodS.id);
  for (const r of [r1, r2]) m.updateElement(r.id, { releases: hinge, cable: true });
  const lc = m.addLoadCase('H', false); lc.loads.push({ type: 'nodal', nodeId: d, F: [10 * sign, 0, 0, 0, 0, 0] });
  m.combinations.set(1, { id: 1, name: '1,0 H', factors: [{ lcId: lc.id, factor: 1 }] });
  return { m, lc, r1: r1.id, r2: r2.id };
}

{
  const { m, lc, r1, r2 } = frame(1);
  const lin = new StaticSolver().solve(m, lc.id, false);
  ok('T1. linear: diagonal a→c tracionada +H/(2cosθ) = 6,25', lin.getElemForces(r1).N, 6.25, 1e-3);
  ok('T1b. linear: diagonal b→d comprimida −6,25', lin.getElemForces(r2).N, -6.25, 1e-3);
  const t = solveCombinationTensionOnly(m, m.combinations.get(1), StaticSolver);
  assert('T2. convergiu, diagonal comprimida inativa', t.converged && t.slack.length === 1 && t.slack[0] === r2, JSON.stringify(t.slack));
  ok('T2b. só tração: a→c leva H/cosθ = 12,5 kN', t.res.getElemForces(r1).N, 12.5, 1e-3);
  ok('T2c. só tração: b→d ≈ 0', Math.abs(t.res.getElemForces(r2).N), 0, 1e-6);
  let Rx = 0; for (const nd of m.nodes.values()) { const r = t.res.getReaction(nd.id); if (r) Rx += r[0]; }
  ok('T2d. equilíbrio: ΣRx = −H', Rx, -10, 1e-6);
  assert('T2e. o modelo volta com todos os tirantes ativos', [...m.elements.values()].every((e) => !e._slack) && !m.loadCases.has(1e9 + 1));
}
{
  const { m, r1, r2 } = frame(-1);                                // load reversed: the other rod works
  const t = solveCombinationTensionOnly(m, m.combinations.get(1), StaticSolver);
  ok('T3. carga invertida: b→d leva 12,5 kN', t.res.getElemForces(r2).N, 12.5, 1e-3);
  assert('T3b. a→c inativa', t.slack.length === 1 && t.slack[0] === r1);
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
