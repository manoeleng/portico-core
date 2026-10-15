// test_unbraced.mjs — automatic unbraced lengths (js/design/unbraced.js; NBR 8800:2024 4.10.6.1)
//   node tests/test_unbraced.mjs
// Oracles: (U) GEOMETRY of the model — the unbraced length is the distance between restraint points/extremities of
// the physical member, counted by hand for each case; (D) the design of a member split in two segments must
// reproduce the BR-8800-07 case of tests/test_nbr8800 (L = Lb = 4 m: Ne = Ney = 6941 kN, χ = 0,8039 — independent
// calculation of the reviewer from the 2024 PDF), because the two 2 m segments are ONE unbraced bar of 4 m.
import { Model } from '../js/model/model.js';
import { localAxes } from '../js/solver/timoshenko.js';
import { unbracedLengths, memberWithUnbraced } from '../js/design/unbraced.js';
import { nbr8800 } from '../js/design/codes/nbr8800.js';
import { resolveSectionProps } from '../js/design/section_props.js';

let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-6) => { n++; if (!(Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)))) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${+(+got).toFixed(4)}`); };
const assert = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name}${info ? ' · ' + info : ''}`); } else console.log(`ok   ${name}`); };

// beam along X, nodes at x = 0, 2, 4, 6 (local y = +Z, local z = −Y), pinned ends
function beam() {
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E: 2e8, G: 8e7, nu: 0.3, rho: 0 });
  const s1 = m.addSection({ name: 'A', A: 0.01, Iy: 1e-5, Iz: 3e-5, J: 1e-7, Avy: 0.002, Avz: 0.002 });
  const s2 = m.addSection({ name: 'B', A: 0.01, Iy: 1e-5, Iz: 3e-5, J: 1e-7, Avy: 0.002, Avz: 0.002 });
  const PIN = { ux: 1, uy: 1, uz: 1 };
  const N = [0, 2, 4, 6].map((x, i) => m.addNode(x, 0, 0, i === 0 || i === 3 ? PIN : {}).id);
  const E = [0, 1, 2].map((i) => m.addElement(N[i], N[i + 1], mat.id, s1.id).id);
  return { m, N, E, mat, s2 };
}
const L = (m) => unbracedLengths(m, localAxes);

{ // U1: no restraint inside → one bar of 6 m about both axes
  const { m, E } = beam(), u = L(m);
  assert('U1. três trechos colineares = 1 barra física', u.get(E[0]).chain.length === 3);
  for (const id of E) { ok(`U1. trecho ${id}: Lx = 6`, u.get(id).Lx, 6); ok(`U1. trecho ${id}: Ly = Lb = 6`, u.get(id).Ly, 6); }
}
{ // U2: a horizontal member along Y at x = 2 restrains local z (−Y) only
  const { m, N, E, mat, s2 } = beam();
  m.addElement(N[1], m.addNode(2, 1, 0, { ux: 1, uy: 1, uz: 1 }).id, mat.id, s2.id);
  const u = L(m);
  ok('U2. trecho 0–2: Ly = 2', u.get(E[0]).Ly, 2); ok('U2b. trecho 2–4: Ly = 4', u.get(E[1]).Ly, 4); ok('U2c. trecho 4–6: Ly = 4', u.get(E[2]).Ly, 4);
  ok('U2d. Lx não muda (6)', u.get(E[0]).Lx, 6);
  // review 15/10/2026: a lateral restraint does not hold the twist / compression flange → Lb = Lz between the ends
  ok('U2e. Lb padrão conservador = entre extremidades (6)', u.get(E[0]).Lb, 6);
  const mt = memberWithUnbraced({ design: { contencaoTorcao: true } }, u.get(E[0]));
  assert('U2f. contenção declarada também à torção: Lb = Lz = Ly = 2', mt.Lb === 2 && mt.Lz === 2, JSON.stringify(mt));
}
{ // U3: a vertical post at x = 4 restrains local y (+Z) only
  const { m, N, E, mat, s2 } = beam();
  m.addElement(N[2], m.addNode(4, 0, -1, { ux: 1, uy: 1, uz: 1 }).id, mat.id, s2.id);
  const u = L(m);
  ok('U3. trecho 2–4: Lx = 4', u.get(E[1]).Lx, 4); ok('U3b. trecho 4–6: Lx = 2', u.get(E[2]).Lx, 2); ok('U3c. Ly não muda (6)', u.get(E[1]).Ly, 6);
}
{ // U4: a tension-only rod gives no restraint
  const { m, N, E, mat, s2 } = beam();
  const r = m.addElement(N[1], m.addNode(2, 1, 0, { ux: 1, uy: 1, uz: 1 }).id, mat.id, s2.id); m.updateElement(r.id, { cable: true });
  ok('U4. tirante não trava: Ly = 6', L(m).get(E[0]).Ly, 6);
}
{ // U5: a support holding uy at x = 4 restrains local z
  const { m, N, E } = beam(); m.updateNode(N[2], { restraints: { uy: 1 } });
  ok('U5. apoio em Y no nó 4: Ly (4–6) = 2', L(m).get(E[2]).Ly, 2); ok('U5b. Lx = 6', L(m).get(E[2]).Lx, 6);
}
{ // U6: a member at 20° from the chain axis does not restrain (|u·d| = sin 20° = 0,34 < 0,5); at 45° it does
  const { m, N, E, mat, s2 } = beam(), a = 20 * Math.PI / 180;
  m.addElement(N[1], m.addNode(2 + Math.cos(a), Math.sin(a), 0, { ux: 1, uy: 1, uz: 1 }).id, mat.id, s2.id);
  ok('U6. barra a 20°: não trava (Ly = 6)', L(m).get(E[0]).Ly, 6);
  const b = beam(); b.m.addElement(b.N[1], b.m.addNode(3, 1, 0, { ux: 1, uy: 1, uz: 1 }).id, b.mat.id, b.s2.id);
  ok('U6b. barra a 45°: trava (Ly = 2)', L(b.m).get(b.E[0]).Ly, 2);
}
{ // U7: a change of section is not a restraint point (4.10.6.1): the physical member goes on
  const { m, E, s2 } = beam(); m.updateElement(E[2], { secId: s2.id });
  const u = L(m);
  ok('U7. troca de seção em x = 4 não trava: trecho 0–2 Ly = 6', u.get(E[0]).Ly, 6); ok('U7b. trecho 4–6: Ly = 6', u.get(E[2]).Ly, 6);
}
{ // U8: user values win; K keeps its meaning
  const auto = { Lx: 6, Ly: 6, Lb: 6, Lz: 6, chain: [1, 2, 3], freeEnd: false };
  const a = memberWithUnbraced({ design: { Ly: 1.5 } }, auto);
  assert('U8. Ly do usuário prevalece, Lx automático', a.Ly === 1.5 && a.Lx === 6);
  assert('U8b. K informado: sem automático', memberWithUnbraced({ design: { K: 1 } }, auto).Lx === undefined);
  const k = memberWithUnbraced({ design: { Kz: 0.8 } }, auto);
  assert('U8c. Kz informado: Lx fica K·L, Ly automático', k.Lx === undefined && k.Ly === 6);
}
{ // U10: the restraining member must be ANCHORED (4.10.3.2): a member along Y to a FREE node does not restrain
  const { m, N, E, mat, s2 } = beam();
  m.addElement(N[1], m.addNode(2, 1, 0).id, mat.id, s2.id);
  ok('U10. barra transversal sem ancoragem: Ly = 6', L(m).get(E[0]).Ly, 6);
  // two parallel beams tied by a strut at x = 2, nothing else: they sway together → no restraint
  const b = beam(); const q1 = b.m.addNode(0, 2, 0, { ux: 1, uy: 1, uz: 1 }).id, q2 = b.m.addNode(2, 2, 0).id, q3 = b.m.addNode(6, 2, 0, { ux: 1, uy: 1, uz: 1 }).id;
  b.m.addElement(q1, q2, b.mat.id, b.s2.id); b.m.addElement(q2, q3, b.mat.id, b.s2.id); b.m.addElement(b.N[1], q2, b.mat.id, b.s2.id);
  ok('U10b. duas vigas amarradas sem contraventamento: Ly = 6', L(b.m).get(b.E[0]).Ly, 6);
  // … the same with a tension-only diagonal from the tie node to a support: anchored
  const c = beam(); const p1 = c.m.addNode(0, 2, 0, { ux: 1, uy: 1, uz: 1 }).id, p2 = c.m.addNode(2, 2, 0).id, p3 = c.m.addNode(6, 2, 0, { ux: 1, uy: 1, uz: 1 }).id;
  c.m.addElement(p1, p2, c.mat.id, c.s2.id); c.m.addElement(p2, p3, c.mat.id, c.s2.id); c.m.addElement(c.N[1], p2, c.mat.id, c.s2.id);
  const x1 = c.m.addElement(p2, c.N[0], c.mat.id, c.s2.id); c.m.updateElement(x1.id, { cable: true });      // diagonal (2,2)→(0,0)
  ok('U10c. com diagonal (tirante) até o apoio: ancorada, Ly = 2', L(c.m).get(c.E[0]).Ly, 2);
}
{ // U11: interior support holding both transverse directions breaks Lb/Lz
  const { m, N, E } = beam(); m.updateNode(N[2], { restraints: { uy: 1, uz: 1 } });
  const u = L(m);
  ok('U11. apoio interno (y e z) em x = 4: Lb do trecho 0–2 = 4', u.get(E[0]).Lb, 4); ok('U11b. Lb trecho 4–6 = 2', u.get(E[2]).Lb, 2);
}
{ // U12: an element of the chain rolled 90°: its own local y is the chain's z → Lx/Ly swap
  const { m, N, E, mat, s2 } = beam();
  m.addElement(N[1], m.addNode(2, 1, 0, { ux: 1, uy: 1, uz: 1 }).id, mat.id, s2.id);   // restrains chain z (−Y) at x = 2
  m.updateElement(E[0], { beta: 90 });
  const u = L(m);
  ok('U12. trecho com β = 90°: Lx (seu y = −Y global) = 2', u.get(E[0]).Lx, 2); ok('U12b. Ly = 6', u.get(E[0]).Ly, 6);
}
{ // U13: shallow Warren truss (depth 0,3 m, panel 1,5 m: |u·Z| of the web = 0,37 < 0,5) — every bottom node with a web
  // member is a truss node in the plane (4.10.6.1-a): Lx = panel; out of plane nothing restrains: Ly = span
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E: 2e8, G: 8e7, nu: 0.3, rho: 0 });
  const c = m.addSection({ name: 'C', A: 0.01, Iy: 1e-5, Iz: 3e-5, J: 1e-7, Avy: 0.002, Avz: 0.002 });
  const w = m.addSection({ name: 'W', A: 0.005, Iy: 1e-6, Iz: 1e-6, J: 1e-8, Avy: 0.001, Avz: 0.001 });
  const B = [0, 1.5, 3, 4.5, 6].map((x, i) => m.addNode(x, 0, 0, i === 0 || i === 4 ? { ux: 1, uy: 1, uz: 1 } : {}).id);
  const T = [0.75, 2.25, 3.75, 5.25].map((x) => m.addNode(x, 0, 0.3).id);
  const bot = []; for (let i = 0; i < 4; i++) bot.push(m.addElement(B[i], B[i + 1], mat.id, c.id).id);
  for (let i = 0; i < 3; i++) m.addElement(T[i], T[i + 1], mat.id, c.id);
  for (let i = 0; i < 4; i++) { m.addElement(B[i], T[i], mat.id, w.id); m.addElement(T[i], B[i + 1], mat.id, w.id); }
  const u = L(m);
  ok('U13. treliça rasa: banzo inferior Lx = painel 1,5', u.get(bot[1]).Lx, 1.5);
  ok('U13b. fora do plano sem contenção: Ly = 6', u.get(bot[1]).Ly, 6);
}
{ // U9: cantilever chain end flagged
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E: 2e8, G: 8e7, nu: 0.3, rho: 0 });
  const s = m.addSection({ name: 'A', A: 0.01, Iy: 1e-5, Iz: 3e-5, J: 1e-7, Avy: 0.002, Avz: 0.002 });
  const e = m.addElement(m.addNode(0, 0, 0, { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 }).id, m.addNode(3, 0, 0).id, mat.id, s.id);
  assert('U9. balanço: extremidade livre sinalizada', L(m).get(e.id).freeEnd === true);
}
{ // D: BR-8800-07 section, a 4 m bar split at 2 m without restraint → same as L = Lb = 4 m
  const sec = resolveSectionProps({ design: { shape: 'I', dims: { d: 0.5, bf: 0.3, tf: 0.0125, tw: 0.0063 }, fabricacao: 'soldado' } });
  const mat = { Fy: 345e3, E: 200e6 };
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mt = m.addMaterial({ name: 'S', E: 2e8, G: 7.7e7, nu: 0.3, rho: 0 });
  const s = m.addSection({ name: 'I', A: 0.01, Iy: 1e-5, Iz: 3e-5, J: 1e-7, Avy: 0.002, Avz: 0.002 });
  const a = m.addNode(0, 0, 0, { ux: 1, uy: 1, uz: 1 }).id, b = m.addNode(2, 0, 0).id, c = m.addNode(4, 0, 0, { ux: 1, uy: 1, uz: 1 }).id;
  const e1 = m.addElement(a, b, mt.id, s.id), e2 = m.addElement(b, c, mt.id, s.id);
  const member = { L: 2, Cb: 1, ...memberWithUnbraced(e1, L(m).get(e1.id)) };
  const rc = nbr8800.check({ demands: { N: -100 }, mat, sec, member, options: {} });
  const rb = nbr8800.check({ demands: { Mz: 100, Vy: 10 }, mat, sec, member, options: {} });
  ok('D1. trecho de 2 m de barra destravada de 4 m: Ne = Ney = 6941 kN (BR-8800-07)', rc.axial.Ne, 6941, 0.001);
  ok('D1b. χ = 0,8039', rc.axial.chi, 0.8039, 0.001);
  ok('D1c. MRd FLT = 640,3 kN·m (Lb = 4 m)', rb.flexaoX.MRdFLT, 640.3, 0.001);
  assert('D1d. o outro trecho recebe o mesmo comprimento', L(m).get(e2.id).Ly === 4);
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
