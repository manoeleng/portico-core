// test_nl_direct_plastic.mjs — concentrated ELASTO-PLASTIC moment hinges in the nonlinear
// direct time integration (js/solver/corot_plastic.js + nl_direct.js), Phase 3b. Material
// nonlinearity (hysteretic yielding) on top of the corotational geometry.
//
//   (1) ELASTIC LIMIT: a huge Mp makes the plastic element identical to the elastic one.
//   (2) CONSISTENT TANGENT: the algorithmic bending tangent Cep equals the finite-difference
//       derivative dM/dθ̄ for elastic, one-end and two-end plastic states (this is what keeps
//       global Newton quadratic).
//   (3) MOMENT CAPPING: under a slow ramp, a perfectly-plastic hinge holds the end moment at
//       exactly Mp — the plateau of the bilinear law.
//   (4) HYSTERETIC DISSIPATION: with NO extra viscous damping, plastic hinges decay a free
//       vibration far more than the elastic system (same integrator) — the plastic work is a
//       genuine energy sink, the signature of material nonlinearity.
//   (5) DRIVER: nlDirectTimeHistory with a per-element capacity map yields under base motion.
//
// Run:  node test_nl_direct_plastic.mjs
import { newmarkCorot, nlDirectTimeHistory } from '../js/solver/nl_direct.js';
import { hingeReturnMap } from '../js/solver/corot_plastic.js';
import { solveCorotBeam } from '../js/solver/corotbeam.js';
import { Model } from '../js/model/model.js';

let failures = 0;
const check = (cond, msg, extra = '') => {
  console.log(`  ${cond ? 'OK  ' : 'FAIL'} ${msg}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
};

const E = 2.1e8, A = 0.01, I = 8e-5, H = 4, nEl = 4, rho = 7.85, nNode = nEl + 1;
const Mp = 120;   // kN·m plastic moment
function column(mtip, MpVal, b) {
  const coords = new Float64Array(2 * nNode);
  for (let i = 0; i <= nEl; i++) { coords[2 * i] = 0; coords[2 * i + 1] = H * i / nEl; }
  const elems = [];
  for (let i = 0; i < nEl; i++) { const el = { n1: i, n2: i + 1, EA: E * A, EI: E * I }; if (MpVal !== undefined) { el.Mp = MpVal; el.b = b ?? 0; } elems.push(el); }
  const free = []; for (let i = 1; i <= nEl; i++) free.push(3 * i, 3 * i + 1, 3 * i + 2);
  const nDOF = 3 * nNode, Mlump = new Float64Array(nDOF);
  for (const el of elems) { const L = Math.hypot(coords[2 * el.n2] - coords[2 * el.n1], coords[2 * el.n2 + 1] - coords[2 * el.n1 + 1]); const half = rho * A * L / 2; Mlump[3 * el.n1] += half; Mlump[3 * el.n1 + 1] += half; Mlump[3 * el.n2] += half; Mlump[3 * el.n2 + 1] += half; }
  Mlump[3 * nEl] += mtip; Mlump[3 * nEl + 1] += mtip;
  const dofMap = new Int32Array(nDOF).fill(-1); let nF = 0; for (const d of free) dofMap[d] = nF++;
  return { coords, elems, free, nDOF, Mlump, dofMap, nF, top: nEl };
}
const decayOf = (h, n) => { let pe = 0, pl = 0; for (let k = 0; k < 600; k++) pe = Math.max(pe, Math.abs(h[k])); for (let k = n - 600; k < n; k++) pl = Math.max(pl, Math.abs(h[k])); return pl / pe; };

// ── (1) Elastic limit ─────────────────────────────────────────────────────────
console.log('── (1) huge Mp → identical to the elastic element ──');
{
  const P = column(40, 1e12, 0), Q = column(40);   // plastic-with-huge-Mp vs pure elastic
  const iota = new Float64Array(P.nF); for (const d of P.free) if (d % 3 === 0) iota[P.dofMap[d]] = 1;
  const dt = 0.01, nSteps = 500, ag = new Float64Array(nSteps);
  for (let k = 0; k < nSteps; k++) ag[k] = 2 * Math.sin(2 * Math.PI * 1 * k * dt);
  const np = newmarkCorot({ coords: P.coords, elems: P.elems, free: P.free, Mlump: P.Mlump, ag, dt, iota, a0: 0.3, a1: 0.002, record: [P.dofMap[3 * P.top]] });
  const ne = newmarkCorot({ coords: Q.coords, elems: Q.elems, free: Q.free, Mlump: Q.Mlump, ag, dt, iota, a0: 0.3, a1: 0.002, record: [Q.dofMap[3 * Q.top]] });
  const hp = np.hist.get(P.dofMap[3 * P.top]), he = ne.hist.get(Q.dofMap[3 * Q.top]);
  let md = 0; for (let k = 0; k < nSteps; k++) md = Math.max(md, Math.abs(hp[k] - he[k]));
  check(np.anyPlastic && !ne.anyPlastic, 'plastic path active only for the finite-Mp model');
  check(md < 1e-10, 'plastic-with-huge-Mp ≡ elastic to machine precision', `(maxDiff=${md.toExponential(2)})`);
}

// ── (2) Consistent algorithmic tangent (finite difference) ────────────────────
console.log('\n── (2) hinge tangent Cep ≡ d(M)/dθ̄ (finite difference) ──');
{
  const kb = 16800, Hp = 2000, hh = 1e-7;
  const states = [
    ['elastic', 0.001, -0.0005, 0, 0],
    ['end1 plastic', 0.02, 0.001, 0.005, 0],
    ['both plastic', 0.03, -0.03, 0.01, -0.01],
  ];
  let worst = 0;
  for (const [name, tb1, tb2, tp1, tp2] of states) {
    const r = hingeReturnMap(kb, tb1, tb2, tp1, tp2, Mp, Hp);
    const a = hingeReturnMap(kb, tb1 + hh, tb2, tp1, tp2, Mp, Hp), b = hingeReturnMap(kb, tb1 - hh, tb2, tp1, tp2, Mp, Hp);
    const c = hingeReturnMap(kb, tb1, tb2 + hh, tp1, tp2, Mp, Hp), d = hingeReturnMap(kb, tb1, tb2 - hh, tp1, tp2, Mp, Hp);
    const fd = [(a.M1 - b.M1) / (2 * hh), (c.M1 - d.M1) / (2 * hh), (a.M2 - b.M2) / (2 * hh), (c.M2 - d.M2) / (2 * hh)];
    let e = 0; for (let k = 0; k < 4; k++) e = Math.max(e, Math.abs(fd[k] - r.C[k]) / (Math.abs(r.C[k]) + 1));
    worst = Math.max(worst, e);
    check(e < 1e-5, `tangent matches FD — ${name}`, `(relErr=${e.toExponential(2)})`);
  }
}

// ── (3) Moment capping under a slow ramp (perfectly plastic) ──────────────────
console.log('\n── (3) perfectly-plastic hinge caps |M| at Mp ──');
{
  const P = column(40, Mp, 0);   // EPP
  const iota = new Float64Array(P.nF); for (const d of P.free) if (d % 3 === 0) iota[P.dofMap[d]] = 1;
  const Ag = 40, dt = 0.02, nSteps = 2500, ag = new Float64Array(nSteps);
  for (let k = 0; k < nSteps; k++) ag[k] = Ag * Math.min(1, k * dt / 12);
  const nl = newmarkCorot({ coords: P.coords, elems: P.elems, free: P.free, Mlump: P.Mlump, ag, dt, iota, a0: 2, a1: 0.02, record: [P.dofMap[3 * P.top]], plasticProbe: 0 });
  let peakM = 0, peakTp = 0; for (let k = 0; k < nSteps; k++) { peakM = Math.max(peakM, Math.abs(nl.hingeHist.M1[k])); peakTp = Math.max(peakTp, Math.abs(nl.hingeHist.tp1[k])); }
  check(nl.ok && nl.notConverged === 0, 'ramp integrated, all steps converged');
  check(Math.abs(peakM - Mp) / Mp < 1e-3, 'base moment held at Mp (bilinear plateau)', `(peak|M1|=${peakM.toFixed(3)} vs Mp=${Mp})`);
  check(peakTp > 1e-3, 'plastic rotation accumulated (hinge yielded)', `(θp=${peakTp.toExponential(2)} rad)`);
}

// ── (4) Hysteretic energy dissipation (no viscous damping) ────────────────────
console.log('\n── (4) plastic hysteresis decays free vibration (vs elastic, same integrator) ──');
{
  const P = column(40, Mp, 0.03), Q = column(40);
  const Fref = new Float64Array(P.nDOF); Fref[3 * P.top] = 250;   // yields several hinges
  const u0 = solveCorotBeam({ coords: Float64Array.from(P.coords), elems: P.elems.map(e => ({ ...e })), free: P.free, Fref, nSteps: 8, maxIter: 80, tol: 1e-9 }).u;
  const dt = 0.005, nSteps = 3000, ag = new Float64Array(nSteps);
  const nlP = newmarkCorot({ coords: P.coords, elems: P.elems, free: P.free, Mlump: P.Mlump, ag, dt, iota: new Float64Array(P.nF), a0: 0, a1: 0, u0, record: [P.dofMap[3 * P.top]] });
  const nlE = newmarkCorot({ coords: Q.coords, elems: Q.elems, free: Q.free, Mlump: Q.Mlump, ag, dt, iota: new Float64Array(Q.nF), a0: 0, a1: 0, u0, record: [Q.dofMap[3 * Q.top]] });
  const dP = decayOf(nlP.hist.get(P.dofMap[3 * P.top]), nSteps), dE = decayOf(nlE.hist.get(Q.dofMap[3 * Q.top]), nSteps);
  check(nlP.ok && nlP.notConverged < nSteps * 0.02, 'plastic run converged (chatter tamed by HHT-α)', `(notConv=${nlP.notConverged}/${nSteps}, avgN=${nlP.avgNewton.toFixed(2)})`);
  check(dP < 0.8 * dE, 'plastic decays far more than elastic → hysteretic dissipation', `(plastic ${dP.toFixed(3)} vs elastic ${dE.toFixed(3)})`);
}

// ── (5) Driver end-to-end with a capacity map ─────────────────────────────────
console.log('\n── (5) driver (nlDirectTimeHistory) with plastic hinges ──');
{
  const m = new Model(); m.mode = '2D'; m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E, G: 8e7, nu: 0.3, rho });
  const sec = m.addSection({ name: 'C', A, Iy: I, Iz: I, J: 1e-6, Avy: 1e30, Avz: 1e30, kappay: 1, kappaz: 1 });
  const n0 = m.addNode(0, 0, 0, { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 });
  const n1 = m.addNode(0, 0, 2), n2 = m.addNode(0, 0, 4);
  const e1 = m.addElement(n0.id, n1.id, mat.id, sec.id), e2 = m.addElement(n1.id, n2.id, mat.id, sec.id);
  n1.nodeMass = { mx: 10, mz: 10 }; n2.nodeMass = { mx: 10, mz: 10 };
  const dt = 0.02, nSteps = 600, ag = new Float64Array(nSteps);
  for (let k = 0; k < nSteps; k++) ag[k] = 6 * Math.sin(2 * Math.PI * 0.9 * k * dt) * Math.exp(-k * dt / 8);   // strong, yields the base
  const capByElem = new Map([[e1.id, { Mz: 60 }], [e2.id, { Mz: 60 }]]);
  const r = nlDirectTimeHistory(m, { ag, dt, direction: 'X', rayleighFreqs: [7, 35], zeta: 0.03, plastic: { capByElem, hardening: 0.03 }, plasticProbe: e1.id, record: [{ node: n2.id, dof: 0 }] });
  check(r.ok && r.anyPlastic, 'driver ran with plastic hinges active', r.ok ? `(avgNewton=${r.avgNewton.toFixed(2)}, notConv=${r.notConverged})` : `(${r.reason})`);
  if (r.ok) {
    let peakM = 0, peakTp = 0, allFinite = true; for (let k = 0; k < nSteps; k++) { peakM = Math.max(peakM, Math.abs(r.hingeHist.M1[k])); peakTp = Math.max(peakTp, Math.abs(r.hingeHist.tp1[k])); if (!isFinite(r.hingeHist.M1[k])) allFinite = false; }
    const peakU = r.peakNodal(n2.id)[0];
    check(peakTp > 1e-4, 'base hinge yielded under the ground motion', `(θp=${peakTp.toExponential(2)} rad, peak|M|=${peakM.toFixed(1)}, Mp=60)`);
    check(allFinite && isFinite(peakU) && peakU > 0, 'response stays finite (bounded plastic dynamics)', `(peak tip ux=${peakU.toFixed(3)} m)`);
    const empty = nlDirectTimeHistory(new Model(), { ag, dt, rayleighFreqs: [10, 40], plastic: { capByElem } });
    check(!empty.ok, 'empty model → refusal', `(${empty.reason})`);
  }
}

console.log(`\n=== ${failures === 0 ? 'ALL OK' : failures + ' FAILURE(S)'} ===`);
process.exit(failures === 0 ? 0 : 1);
