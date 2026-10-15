// test_offset.mjs — eccentric members (elem.offset: member axis shifted from the node line; js/solver/timoshenko.js)
//   node tests/test_offset.mjs
// Oracles (Euler–Bernoulli + Saint-Venant torsion, independent of the code). Cantilever along +X (length L, clamped at
// node 1), shear-rigid section; the member axis is the node line shifted by e. Rigid-arm kinematics at the nodes:
// u_node = u_axis − θ × r (r = e from node to axis). Local axes of a member along +X: y = +Z, z = −Y (global), so the
// "uy" below is the global Z displacement and a load along local y is applied along global +Z.
//  E1. offset y = e, tip AXIAL load −P at the node: N = −P, constant |Mz| = P·e on the axis;
//      uy = −P·e·L²/(2·E·Iz) (moment −P·e at the tip), ux = −P·L/(E·A) − P·e²·L/(E·Iz) (axis shortening + θz·e).
//  E2. offset z = e, tip load +P along y at the node: |T| = P·e, |Mz| at the root = P·L,
//      uy = P·L³/(3·E·Iz) + P·e²·L/(G·J) (bending of the axis + twist θx = P·e·L/(G·J) times the arm e).
//  E3. offset z = e, uniform q along local y: a member load acts ON THE AXIS (shear centre = centroid), so the member
//      has no torsion (T = 0), |Mz|root = q·L²/2 and uy(tip) = q·L⁴/(8·E·Iz); the torque q·L·e of the load about the
//      node line goes to the clamp through the arm: |Mx,reaction| = q·L·e.
//  E4. two members, both outer nodes clamped, free middle node, offset y = e, uniform ΔT: by symmetry the axis neither
//      moves nor rotates → N = −E·A·α·ΔT, Mz = 0 on the axis; the clamp reaction carries the moment of N about the
//      node line: |M,reaction| = E·A·α·ΔT·e.
//  E5. offset 0 ≡ no offset.
//  E7. offset z = e, tip AXIAL load −P at the node: constant |My| = P·e on the axis ((e × F)y = ez·Fx).
//  M1. mirror: the axis point of the image must be the reflection of the original axis point (geometry oracle).
//  E6. E3 with a rigid end zone of 0,5 m at the clamp (the load on the rigid segment goes straight to the node with
//      its arm): statics of the whole cantilever — |Mx,reaction| = q·L·e, |Mz,reaction| = q·L²/2, Fz,reaction = −q·L.
import { Model } from '../js/model/model.js';
import { StaticSolver } from '../js/solver/static_solver.js';
import { localAxes, mirroredBeta, mirroredOffset } from '../js/solver/timoshenko.js';
globalThis.window = globalThis;
await import('../lib/numeric.js');

let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-6) => { n++; if (!(Math.abs(got - exp) <= tol * Math.max(1e-12, Math.abs(exp)) + 1e-14)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${(+got).toPrecision(6)}`); };

const E = 2e8, G = 8e7, A = 0.004, Iz = 8e-6, Iy = 2e-6, J = 1e-6, L = 4, alpha = 1.2e-5;
const FIX = { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };
function beam({ offset = null, twoSpan = false, load }) {
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E, G, nu: 0.25, rho: 0, alpha });
  const sec = m.addSection({ name: 'R', A, Iz, Iy, J, Avy: 1e6, Avz: 1e6 });
  const a = m.addNode(0, 0, 0, FIX).id, b = m.addNode(L, 0, 0).id;
  const els = [m.addElement(a, b, mat.id, sec.id)];
  if (twoSpan) els.push(m.addElement(b, m.addNode(2 * L, 0, 0, FIX).id, mat.id, sec.id));
  if (offset) for (const e of els) m.updateElement(e.id, { offset });
  const lc = m.addLoadCase('C', false); for (const e of els) lc.loads.push(load(b, e.id));
  if (!twoSpan) lc.loads = lc.loads.slice(0, 1);
  const r = new StaticSolver().solve(m, lc.id, false);
  return { u: r.getNodeDisp(b), f: r.getElemForces(els[0].id), R: r.getReaction(a) };
}
const e = 0.15, P = 10, q = 2, dT = 30;

{ // E1
  const { u, f } = beam({ offset: { y: e }, load: (b) => ({ type: 'nodal', nodeId: b, F: [-P, 0, 0, 0, 0, 0] }) });
  ok('E1. N = −P', f.N, -P);
  ok('E1b. |Mz| extremo 1 = P·e', Math.abs(f.Mz1), P * e); ok('E1c. |Mz| extremo 2 = P·e', Math.abs(f.Mz2), P * e);
  ok('E1d. uy (= uZ) = −P·e·L²/(2EIz)', u[2], -P * e * L * L / (2 * E * Iz));
  ok('E1e. ux = −PL/EA − P·e²·L/(EIz)', u[0], -P * L / (E * A) - P * e * e * L / (E * Iz));
}
{ // E2
  const { u, f } = beam({ offset: { z: e }, load: (b) => ({ type: 'nodal', nodeId: b, F: [0, 0, P, 0, 0, 0] }) });
  ok('E2. |T| = P·e', Math.abs(f.T), P * e);
  ok('E2b. |Mz| engaste = P·L', Math.abs(f.Mz1), P * L);
  ok('E2c. uy (= uZ) = PL³/3EIz + P·e²·L/GJ', u[2], P * L ** 3 / (3 * E * Iz) + P * e * e * L / (G * J));
}
{ // E3
  const { u, f, R } = beam({ offset: { z: e }, load: (b, id) => ({ type: 'dist', elemId: id, dir: 'localY', w: q }) });
  ok('E3. T na barra = 0 (carga no eixo)', Math.abs(f.T), 0, 1e-9);
  ok('E3b. |Mz| engaste = qL²/2', Math.abs(f.Mz1), q * L * L / 2);
  ok('E3c. |uy| (= uZ) = qL⁴/8EIz', Math.abs(u[2]), q * L ** 4 / (8 * E * Iz));
  ok('E3d. |Mx reação| = q·L·e', Math.abs(R[3]), q * L * e);
}
{ // E4
  const { f, R } = beam({ offset: { y: e }, twoSpan: true, load: (b, id) => ({ type: 'temp', elemId: id, dT }) });
  const Nt = E * A * alpha * dT;
  ok('E4. N = −EAαΔT', f.N, -Nt);
  ok('E4b. Mz no eixo = 0', Math.abs(f.Mz1) + Math.abs(f.Mz2), 0, 1e-9);
  ok('E4c. |M reação| = EAαΔT·e', Math.hypot(R[3], R[4], R[5]), Nt * e);
}
{ // E5
  const a = beam({ offset: { y: 0, z: 0 }, load: (b) => ({ type: 'nodal', nodeId: b, F: [0, 0, P, 0, 0, 0] }) });
  const b = beam({ load: (bb) => ({ type: 'nodal', nodeId: bb, F: [0, 0, P, 0, 0, 0] }) });
  ok('E5. offset 0 ≡ sem offset', a.u[2], b.u[2]);
}

{ // E6
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E, G, nu: 0.25, rho: 0, alpha });
  const sec = m.addSection({ name: 'R', A, Iz, Iy, J, Avy: 1e6, Avz: 1e6 });
  const a = m.addNode(0, 0, 0, FIX).id, b = m.addNode(L, 0, 0).id, el = m.addElement(a, b, mat.id, sec.id);
  m.updateElement(el.id, { offset: { z: e }, rigidEnd: { i: 0.5, j: 0 } });
  const lc = m.addLoadCase('C', false); lc.loads.push({ type: 'dist', elemId: el.id, dir: 'localY', w: q });
  const R = new StaticSolver().solve(m, lc.id, false).getReaction(a);
  ok('E6. trecho rígido + excentricidade: |Mx reação| = q·L·e', Math.abs(R[3]), q * L * e);
  ok('E6b. |M flexão reação| = qL²/2', Math.hypot(R[4], R[5]), q * L * L / 2);
  ok('E6c. |F reação| = q·L', Math.hypot(R[0], R[1], R[2]), q * L);
}

{ // E7
  const { f } = beam({ offset: { z: e }, load: (b) => ({ type: 'nodal', nodeId: b, F: [-P, 0, 0, 0, 0, 0] }) });
  ok('E7. offset z, axial: |My| extremo 1 = P·e', Math.abs(f.My1), P * e); ok('E7b. |My| extremo 2 = P·e', Math.abs(f.My2), P * e);
  ok('E7c. Mz = 0', Math.abs(f.Mz1) + Math.abs(f.Mz2), 0, 1e-9);
}
{ // M1
  const Pn = (id, x, y, z) => ({ id, x, y, z }), off = { y: 0.12, z: -0.07 }, beta = 23;
  for (const [ax, a, b] of [[0, Pn(1, 1, 2, 3), Pn(2, 4, 3, 5)], [1, Pn(1, 0, 1, 2), Pn(2, 0, 6, 2.5)], [2, Pn(1, 1, 1, 0), Pn(2, 1, 1, 4)]]) {
    const fl = (p, id) => { const q = { ...p, id }; q[['x', 'y', 'z'][ax]] *= -1; return q; };
    const ma = fl(a, 3), mb = fl(b, 4);
    const la = localAxes(a, b, beta), pt = [0, 1, 2].map((k) => [a.x, a.y, a.z][k] + off.y * la.ey[k] + off.z * la.ez[k]);
    pt[ax] = -pt[ax];                                                       // reflected axis point
    const lm = localAxes(ma, mb, mirroredBeta(a, b, beta, ma, mb, ax)), om = mirroredOffset(off);
    const q = [0, 1, 2].map((k) => [ma.x, ma.y, ma.z][k] + om.y * lm.ey[k] + om.z * lm.ez[k]);
    ok(`M1. espelho no eixo ${'XYZ'[ax]}: ponto do eixo da imagem = reflexo do original`, Math.hypot(q[0] - pt[0], q[1] - pt[1], q[2] - pt[2]), 0, 1e-9);
  }
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
