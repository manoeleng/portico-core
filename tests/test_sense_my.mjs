// test_sense_my.mjs — sense of the weak-axis moment of a channel (js/design/sense_my.js)
//   node tests/test_sense_my.mjs
// Oracle by statics (independent of the code): a cantilever bends towards its tip load, so at the clamp the fibres on
// the LOAD side are compressed. Channel member along +X with β = 0: local z = −Y; the web is on the +z (= −Y) side and
// the flange tips on the −z (= +Y) side (catalogue outline). Tip load towards +Y → flange tips compressed ('mesas');
// tip load towards −Y → web compressed ('alma'). Also with β = 180° (the channel flipped) the answers swap.
import { Model } from '../js/model/model.js';
import { StaticSolver } from '../js/solver/static_solver.js';
import { senseOfMy, myExtremes } from '../js/design/sense_my.js';
globalThis.window = globalThis;
await import('../lib/numeric.js');
let fails = 0, n = 0;
const eq = (name, got, exp) => { n++; if (got !== exp) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
function clampSense(Fy, beta = 0) {
  const m = new Model(); const a = m.addNode(0, 0, 0, { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 }), b = m.addNode(3, 0, 0);
  const e = m.addElement(a.id, b.id); if (beta) m.updateElement(e.id, { beta });
  const lc = m.addLoadCase('P', false); lc.loads.push({ type: 'nodal', nodeId: b.id, F: [0, Fy, 0, 0, 0, 0] });
  const r = new StaticSolver().solve(m, lc.id, false);
  const My0 = (r.getDiagramData(e.id, 'My', 2).pts)[0].val;
  return { s: senseOfMy(My0), ext: myExtremes(r, e.id) };
}
eq('S1. carga para +Y (lado das pontas) → mesas comprimidas', clampSense(10).s, 'mesas');
eq('S2. carga para −Y (lado da alma) → alma comprimida', clampSense(-10).s, 'alma');
eq('S3. perfil girado 180°, carga +Y (agora lado da alma) → alma', clampSense(10, 180).s, 'alma');
const x = clampSense(10).ext;
n++; if (!(x.neg > 29.99 && x.pos < 1e-9)) { fails++; console.log('FAIL S4. extremos', JSON.stringify(x)); } else console.log('ok   S4. extremos com sinal: só negativo, |M| = 30');
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
