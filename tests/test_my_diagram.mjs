// test_my_diagram.mjs — moment diagrams My(x) and Mz(x) along a member (js/solver/postprocess.js)
//   node tests/test_my_diagram.mjs
// Oracles by hand (statics), for bending in the local x–z plane (My) and, as a guard, x–y plane (Mz):
//  D1 cantilever L = 3, tip load P = 10 along local z (or y): |M| = P·L = 30 at the root, 0 at the tip, linear.
//  D2 fixed–fixed beam L = 4 (two members of 2 m), q = 12 along global Y (or gravity): |M| = qL²/12 = 16 at the
//     supports, qL²/24 = 8 at midspan; the diagram of each member must end at its far-end value.
//  D3 simply supported L = 4, q = 12: |M| = qL²/8 = 24 at midspan, 0 at the ends; getElemAtXi(0,5) = diagram.
// (Before 15/10/2026 the My diagram used dM/dx = −V: D1 gave 30 → 60 and D2 ended at −40 instead of 8.)
import { Model } from '../js/model/model.js';
import { StaticSolver } from '../js/solver/static_solver.js';
import { localAxes } from '../js/solver/timoshenko.js';
globalThis.window = globalThis;
await import('../lib/numeric.js');
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-6) => { n++; if (!(Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)))) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${(+got).toFixed(4)}`); };
const F = { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };
const diag = (r, id, type) => { const d = r.getDiagramData(id, type, 20); return d.pts || d; };
for (const [type, ax] of [['My', 'ez'], ['Mz', 'ey']]) {
  { // D1
    const m = new Model(); const a = m.addNode(0, 0, 0, F), b = m.addNode(3, 0, 0); const e = m.addElement(a.id, b.id);
    const v = localAxes(a, b, 0)[ax], lc = m.addLoadCase('P', false); lc.loads.push({ type: 'nodal', nodeId: b.id, F: [10 * v[0], 10 * v[1], 10 * v[2], 0, 0, 0] });
    const r = new StaticSolver().solve(m, lc.id, false), p = diag(r, e.id, type);
    ok(`D1 ${type}. |M| engaste = PL = 30`, Math.abs(p[0].val), 30); ok(`D1b ${type}. M ponta = 0`, Math.abs(p[p.length - 1].val), 0, 1e-9);
    ok(`D1c ${type}. |M| no meio = 15 (linear)`, Math.abs(p[10].val), 15);
  }
  { // D2
    const m = new Model(); const a = m.addNode(0, 0, 0, F), c = m.addNode(2, 0, 0), b = m.addNode(4, 0, 0, F);
    const e1 = m.addElement(a.id, c.id), e2 = m.addElement(c.id, b.id);
    const lc = m.addLoadCase('q', false); for (const e of [e1, e2]) lc.loads.push({ type: 'dist', elemId: e.id, dir: type === 'My' ? 'globalY' : 'gravity', w: 12 });
    const r = new StaticSolver().solve(m, lc.id, false), p = diag(r, e1.id, type), q = diag(r, e2.id, type);
    ok(`D2 ${type}. |M| apoio = qL²/12 = 16`, Math.abs(p[0].val), 16); ok(`D2b ${type}. |M| meio = qL²/24 = 8`, Math.abs(p[20].val), 8);
    ok(`D2c ${type}. continuidade no meio (fim da barra 1 = início da 2)`, p[20].val, q[0].val);
    ok(`D2d ${type}. sinais opostos apoio × meio`, Math.sign(p[0].val) * Math.sign(p[20].val), -1);
  }
  { // D3
    const m = new Model(); const a = m.addNode(0, 0, 0, { ux: 1, uy: 1, uz: 1, rx: 1 }), b = m.addNode(4, 0, 0, { uy: 1, uz: 1 }); const e = m.addElement(a.id, b.id);
    const lc = m.addLoadCase('q', false); lc.loads.push({ type: 'dist', elemId: e.id, dir: type === 'My' ? 'globalY' : 'gravity', w: 12 });
    const r = new StaticSolver().solve(m, lc.id, false), p = diag(r, e.id, type);
    ok(`D3 ${type}. |M| meio = qL²/8 = 24`, Math.abs(p[10].val), 24); ok(`D3b ${type}. M extremidade = 0`, Math.abs(p[20].val), 0, 1e-9);
    ok(`D3c ${type}. getElemAtXi(0,5) = diagrama`, r.getElemAtXi(e.id, 0.5)[type], p[10].val);
  }
}
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
