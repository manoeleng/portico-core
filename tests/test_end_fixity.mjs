// test_end_fixity.mjs — engaste parcial por αR (NBR 9062:2017 5.1.2.7) e vinculação interior do nó
//   node tests/test_end_fixity.mjs
// Oráculos independentes do código:
//   (1) NBR 9062:2017 5.1.2.8-a: αR = 0,85 ⇔ Rsec = 17·(EI)sec/Lef  (limite rígido impresso na norma)
//   (2) Viga biapoiada em pilares de giro impedido, extremos com αR, carga uniforme w (slope-deflection com
//       mola Rsec = 3EIαR/(L(1−αR)) da própria definição 5.1.2.7): M_apoio = 3αR/(2+αR) · wL²/12
//       (αR → 0: 0; αR → 1: wL²/12). Mesmo fator para P no meio do vão: M_apoio = 3αR/(2+αR) · PL/8
//   (3) Nó articulado: equilíbrio do nó sem momento aplicado → momento nulo em TODOS os extremos de barra
import { Model } from '../js/model/model.js';
import { StaticSolver } from '../js/solver/static_solver.js';
import { fixitySprings } from '../js/solver/timoshenko.js';
globalThis.window = globalThis;
await import('../lib/numeric.js');

let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-6) => { n++; const e = Math.abs(got - exp) / Math.max(Math.abs(exp), 1e-9); if (!(e <= tol) && !(Math.abs(got - exp) < 1e-9)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${+got.toFixed(6)}`); };
const assert = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name}${info ? ' · ' + info : ''}`); } else console.log(`ok   ${name}`); };

const E = 2.1e8, I = 8e-5, L = 6, w = 10, P = 10;
const FIX = { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };
const ROLL = { uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };   // giro impedido, ux livre (o modelo precisa de GDL livre)
function base() {
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E, G: 8e7, nu: 0.3, rho: 0 });
  const sec = m.addSection({ name: 'C', A: 0.01, Iy: I, Iz: I, J: 1e-5, Avy: 1e30, Avz: 1e30 });
  return { m, mat, sec };
}

// (1)
{
  const { mat, sec } = base();
  const k = fixitySprings({ endFixity: { 4: 0.85, 11: 0.85 } }, mat, sec, L);
  ok('F1. αR = 0,85 → Rsec = 17·EI/L (NBR 9062 5.1.2.8-a)', k[4], 17 * E * I / L, 1e-12);
  ok('F1b. eixo forte (dof 11) idem', k[11], 17 * E * I / L, 1e-12);
  const k2 = fixitySprings({ endFixity: { 5: 0.5 }, rigidEnd: { i: 0.5, j: 0.5 } }, mat, sec, L);
  ok('F1c. Lef = vão flexível (trechos rígidos excluídos): αR = 0,5 → 3EI/Lef', k2[5], 3 * E * I / (L - 1), 1e-12);
}

// (2) carga uniforme no vão e peso próprio
for (const a of [0.15, 0.5, 0.85]) {
  const { m, mat, sec } = base();
  const A = m.addNode(0, 0, 0, FIX), B = m.addNode(L, 0, 0, ROLL);
  const e = m.addElement(A.id, B.id, mat.id, sec.id);
  m.updateElement(e.id, { endFixity: { 4: a, 5: a, 10: a, 11: a } });
  const lc = m.addLoadCase('L', false); lc.loads.push({ type: 'dist', elemId: e.id, w, dir: 'gravity' });
  const res = new StaticSolver().solve(m, lc.id, false), f = res.getElemForces(e.id);
  const Mref = 3 * a / (2 + a) * w * L * L / 12;
  ok(`F2. αR = ${a}: M_apoio = 3αR/(2+αR)·wL²/12`, Math.abs(f.Mz1 || f.My1), Mref, 1e-6);
  ok(`F2b. αR = ${a}: simetria M1 = M2`, Math.abs(f.Mz2 || f.My2), Mref, 1e-6);
  // flecha no meio do vão (superposição: biapoiada − momentos de extremidade iguais M): δ = 5wL⁴/(384EI) − M·L²/(8EI)
  const dRef = 5 * w * L ** 4 / (384 * E * I) - Mref * L * L / (8 * E * I);
  ok(`F2c. αR = ${a}: flecha no meio do vão (rotação do membro ≠ do nó)`, Math.abs(res.getElemAtXi(e.id, 0.5).uz), dRef, 1e-4);
}
{
  const { m, sec } = base();
  const mat = m.addMaterial({ name: 'Sw', E, G: 8e7, nu: 0.3, rho: 7.85 });
  const A = m.addNode(0, 0, 0, FIX), B = m.addNode(L, 0, 0, ROLL);
  const e = m.addElement(A.id, B.id, mat.id, sec.id);
  m.updateElement(e.id, { endFixity: { 4: 0.5, 5: 0.5, 10: 0.5, 11: 0.5 } });
  const lc = m.addLoadCase('PP', true);
  const res = new StaticSolver().solve(m, lc.id, true), f = res.getElemForces(e.id);
  const q = Math.abs(f.qz || f.qy);
  ok('F3. peso próprio pelo mesmo caminho: M_apoio = 0,6·qL²/12', Math.abs(f.Mz1 || f.My1), 0.6 * q * L * L / 12, 1e-6);
}

// (2') carga concentrada em nó intermediário (só rigidez; Rsec referido ao vão total L)
{
  const a = 0.5, R = 3 * E * I * a / (L * (1 - a));
  const { m, mat, sec } = base();
  const A = m.addNode(0, 0, 0, FIX), C = m.addNode(L / 2, 0, 0, {}), B = m.addNode(L, 0, 0, FIX);
  const e1 = m.addElement(A.id, C.id, mat.id, sec.id), e2 = m.addElement(C.id, B.id, mat.id, sec.id);
  m.updateElement(e1.id, { endSprings: { 4: R, 5: R } }); m.updateElement(e2.id, { endSprings: { 10: R, 11: R } });
  const lc = m.addLoadCase('L', false); lc.loads.push({ type: 'nodal', nodeId: C.id, F: [0, 0, -P, 0, 0, 0] });
  const f = new StaticSolver().solve(m, lc.id, false).getElemForces(e1.id);
  ok('F4. P no meio do vão: M_apoio = 3αR/(2+αR)·PL/8', Math.abs(f.Mz1 || f.My1), 3 * a / (2 + a) * P * L / 8, 1e-6);
}

// (3) vinculação interior do nó — pórtico plano: pilares engastados na base, viga; nó superior esquerdo
function portal() {
  const { m, mat, sec } = base();
  const a = m.addNode(0, 0, 0, FIX), b = m.addNode(0, 0, 4), c = m.addNode(6, 0, 4), d = m.addNode(6, 0, 0, FIX);
  for (const nd of [b, c]) Object.assign(nd.restraints, { uy: 1, rx: 1, rz: 1 });   // plano XZ
  const col = m.addElement(a.id, b.id, mat.id, sec.id), beam = m.addElement(b.id, c.id, mat.id, sec.id), col2 = m.addElement(d.id, c.id, mat.id, sec.id);
  const lc = m.addLoadCase('L', false);
  lc.loads.push({ type: 'dist', elemId: beam.id, w: 10, dir: 'gravity' }, { type: 'nodal', nodeId: b.id, F: [5, 0, 0, 0, 0, 0] });
  return { m, b, col, beam, col2, lc };
}
{
  const { m, b, col, beam, lc } = portal();
  assert('N1. nó sem alteração lê como engastado', m.nodeFixity(b.id).mode === 'rigid');
  m.setNodeFixity(b.id, 'hinge');
  assert('N2. articulado: leitura', m.nodeFixity(b.id).mode === 'hinge', JSON.stringify(m.nodeFixity(b.id)));
  // the node holds ry? it is free (only uy/rx/rz restrained) → one end kept continuous
  const relEnds = [col.releases[10] && col.releases[11], beam.releases[4] && beam.releases[5]].filter(Boolean).length;
  assert('N2b. giro ry livre no nó → um extremo contínuo (n−1 liberados)', relEnds === 1, `${relEnds}`);
  let res, err; try { res = new StaticSolver().solve(m, lc.id, false); } catch (e) { err = e; }
  assert('N3. articulado resolve sem mecanismo', !err, err?.message);
  if (res) {
    const fc = res.getElemForces(col.id), fb = res.getElemForces(beam.id);
    ok('N3b. momento no topo do pilar = 0 (equilíbrio do nó)', Math.abs(fc.My2) + Math.abs(fc.Mz2), 0);
    ok('N3c. momento no início da viga = 0', Math.abs(fb.My1) + Math.abs(fb.Mz1), 0);
  }
  m.setNodeFixity(b.id, 'partial', 0.4);
  const fx = m.nodeFixity(b.id);
  assert('N4. engaste parcial: leitura com αR', fx.mode === 'partial' && fx.alpha === 0.4, JSON.stringify(fx));
  assert('N4b. αR gravado nos dois extremos, flexão nos dois eixos', col.endFixity[10] === 0.4 && col.endFixity[11] === 0.4 && beam.endFixity[4] === 0.4 && beam.endFixity[5] === 0.4);
  assert('N4c. sem liberação residual', !col.releases[10] && !beam.releases[4]);
  m.setNodeFixity(b.id, 'rigid');
  assert('N5. engastado: volta ao contínuo', m.nodeFixity(b.id).mode === 'rigid' && !col.endFixity && !beam.endFixity);
  assert('N6. αR fora de (0,1) é recusado', m.setNodeFixity(b.id, 'partial', 1) === false && m.setNodeFixity(b.id, 'partial', 0) === false);
}
{
  // node with rotation restrained → every end released (the support takes no moment from the bars)
  const { m, b, col, beam } = portal();
  b.restraints.ry = 1;
  m.setNodeFixity(b.id, 'hinge');
  assert('N7. giro restringido no nó → todos os extremos liberados', col.releases[10] && col.releases[11] && beam.releases[4] && beam.releases[5]);
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
