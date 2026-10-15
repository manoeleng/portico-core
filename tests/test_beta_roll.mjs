// test_beta_roll.mjs — roll angle β of a member (rotation of the local y, z axes about x; js/solver/timoshenko.js)
//   node tests/test_beta_roll.mjs
// Oracle (Euler–Bernoulli cantilever, independent of the code): member along +X, length L, clamped at x = 0, tip load
// P downward (−Z), principal inertias Iz (bending in the local x–y plane) and Iy (x–z plane), shear-rigid section.
// β = 0 → local y = +Z: δz = −P·L³/(3·E·Iz).  The load splits on the rotated principal axes (oblique bending):
//   ey' = cosβ·Z − sinβ·Y,  ez' = −sinβ·Z − cosβ·Y   (β = 0: ez = ex × Z = −Y)
//   δ = −P·L³/(3E)·[(Z·ey')·ey'/Iz + (Z·ez')·ez'/Iy]  →
//   δz = −P·L³/(3E)·(cos²β/Iz + sin²β/Iy),  δy = +P·L³/(3E)·sinβ·cosβ·(1/Iz − 1/Iy)  (< 0 for Iz > Iy: drifts to +ez')
//   root moments: |Mz| = P·L·cosβ, |My| = P·L·sinβ
import { Model } from '../js/model/model.js';
import { StaticSolver } from '../js/solver/static_solver.js';
import { localAxes, mirroredBeta } from '../js/solver/timoshenko.js';
globalThis.window = globalThis;
await import('../lib/numeric.js');

let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-6) => { n++; if (!(Math.abs(got - exp) <= tol * Math.max(1e-12, Math.abs(exp)) + 1e-12)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${(+got).toPrecision(6)}`); };

const E = 2e8, L = 4, P = 10, Iz = 8e-6, Iy = 2e-6;
function cantilever(beta) {
  const m = new Model(); m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'S', E, G: 8e7, nu: 0.3, rho: 0 });
  const sec = m.addSection({ name: 'R', A: 0.01, Iz, Iy, J: 1e-6, Avy: 1e6, Avz: 1e6 });   // shear-rigid
  const a = m.addNode(0, 0, 0, { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 }).id, b = m.addNode(L, 0, 0).id;
  const e = m.addElement(a, b, mat.id, sec.id);
  if (beta != null) m.updateElement(e.id, { beta });
  const lc = m.addLoadCase('P', false); lc.loads.push({ type: 'nodal', nodeId: b, F: [0, 0, -P, 0, 0, 0] });
  const r = new StaticSolver().solve(m, lc.id, false);
  return { u: r.getNodeDisp(b), f: r.getElemForces(e.id) };
}
const k = P * L ** 3 / (3 * E);
for (const deg of [0, 30, 90]) {
  const b = deg * Math.PI / 180, c = Math.cos(b), s = Math.sin(b);
  const { u, f } = cantilever(deg);
  ok(`B1. β=${deg}°: δz = −PL³/3E·(cos²/Iz + sin²/Iy)`, u[2], -k * (c * c / Iz + s * s / Iy));
  ok(`B1b. β=${deg}°: δy = +PL³/3E·sin·cos·(1/Iz − 1/Iy)`, u[1], k * s * c * (1 / Iz - 1 / Iy));
  ok(`B1c. β=${deg}°: |Mz| no engaste = P·L·cosβ`, Math.abs(f.Mz1 ?? f.Mz), P * L * c);
  ok(`B1d. β=${deg}°: |My| no engaste = P·L·sinβ`, Math.abs(f.My1 ?? f.My), P * L * s);
}
{
  const u0 = cantilever(null).u, u1 = cantilever(0).u;
  ok('B2. sem β = β 0 (modelos antigos inalterados)', u0[2], u1[2]);
  const A = localAxes({ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 0, y: 0, z: 3 }, 90), B = localAxes({ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 0, y: 0, z: 3 });
  // vertical member: β = 90° takes y to the old z (right-hand rule about +x = +Z)
  ok('B3. pilar: ey(β=90°) = ez(β=0) · x', A.ey[0], B.ez[0]); ok('B3b. · y', A.ey[1], B.ez[1]);
  ok('B3c. ez(β=90°) = −ey(β=0) · x', A.ez[0], -B.ey[0]); ok('B3d. · y', A.ez[1], -B.ey[1]);
}

// (M) mirror (review finding): the image's y axis must be the reflection R·y of the original y (geometry oracle).
//   vertical plane, non-vertical member → β' = −β (review: reflection reverses the default triad's cross product);
//   horizontal plane (z flipped) on a horizontal member → β' = 180° − β.
{
  const P = (id, x, y, z) => ({ id, x, y, z });
  const cases = [
    ['M1. plano x = 0, terça ao longo de +Y, β = −11,31°', [P(1, 2, 0, 6), P(2, 2, 5, 6.2)], -11.3099, 0, -1, 11.3099],
    ['M2. plano y = 0, barra inclinada, β = 25°', [P(1, 1, 2, 3), P(2, 4, 3, 5)], 25, 1, -1, null],
    ['M3. plano z = 0, viga horizontal, β = 30°', [P(1, 0, 0, 3), P(2, 4, 0, 3)], 30, 2, -1, 150],
    ['M4. plano x = 0, pilar vertical, β = 40°', [P(1, 1, 1, 0), P(2, 1, 1, 4)], 40, 0, -1, null],
  ];
  for (const [name, [a, b], beta, ax, sg, exp] of cases) {
    const fl = (p, id) => { const q = { ...p, id }; q[['x', 'y', 'z'][ax]] *= sg; return q; };
    const ma = fl(a, 3), mb = fl(b, 4), bm = mirroredBeta(a, b, beta, ma, mb, ax);
    const y = localAxes(a, b, beta).ey.slice(); y[ax] = -y[ax];
    const y2 = localAxes(ma, mb, bm).ey;
    ok(`${name}: ey' = R·ey`, Math.hypot(y2[0] - y[0], y2[1] - y[1], y2[2] - y[2]), 0, 1e-6);
    if (exp != null) ok(`${name}: β' = ${exp}°`, bm, exp, 1e-6);
  }
}

// (G) galpão generator: purlin web perpendicular to its roof slope. Oracle = geometry only: the slope normal of the
// two-slope roof, n = (∓sinθ, 0, cosθ) with tanθ = 2·hR/luz (left slope x < luz/2 → −sinθ), must be the local y of
// every purlin (localAxes with its β); the ridge purlin keeps the web vertical.
{
  const fs = await import('node:fs'), { parseCSV } = await import('../js/utils/csv.js'), { generateModel } = await import('../assistant/generator.js');
  const rd = (q) => fs.readFileSync(new URL('../' + q, import.meta.url), 'utf8');
  const BR = { reglas: JSON.parse(rd('presets/brasil/rules.json')), perfiles: parseCSV(rd('presets/brasil/profiles.csv')),
    materiales: parseCSV(rd('presets/brasil/materials.csv')), sobrecargas: parseCSV(rd('presets/brasil/live_loads.csv')) };
  const luz = 15, slope = 0.10, th = Math.atan(slope);           // hR = slope·luz/2 → tanθ = 2hR/luz = slope
  const g = generateModel({ typology: 'galpão', sections: { material: 'MR250', columns: 'W 250 x 32,7' },
    warehouse: { span_m: luz, length_m: 30, column_height_m: 6, frame_spacing_m: 5, slope_pct: slope * 100 },
    loads: { dead_extra_kN_m2: 0.15, live_load_kN_m2: 0.25, wind: false } }, BR);
  const purl = g.elements.filter((e) => e.secId === 5);
  let worst = 0, nL = 0, nR = 0, nC = 0;
  for (const e of purl) {
    const a = g.nodes[e.n1 - 1], b = g.nodes[e.n2 - 1];
    const sx = a.x < luz / 2 - 1e-6 ? -1 : a.x > luz / 2 + 1e-6 ? 1 : 0;
    if (sx < 0) nL++; else if (sx > 0) nR++; else nC++;
    const nrm = sx ? [sx * Math.sin(th), 0, Math.cos(th)] : [0, 0, 1];
    const { ey } = localAxes(a, b, e.beta);
    worst = Math.max(worst, Math.hypot(ey[0] - nrm[0], ey[1] - nrm[1], ey[2] - nrm[2]));
  }
  n++; if (!(purl.length > 0 && nL > 0 && nR > 0 && worst < 1e-6)) { fails++; console.log(`FAIL G1. terças: ey = normal do pano · ${purl.length} terças, máx. desvio ${worst}`); }
  else console.log(`ok   G1. ${purl.length} terças (${nL} água esq., ${nR} dir., ${nC} cumeeira): ey = normal do pano (desvio ${worst.toExponential(1)})`);
  ok('G1b. |β| da água esquerda = θ = atan(0,10) = 5,7106°', Math.abs(purl.find((e) => g.nodes[e.n1 - 1].x < luz / 2 - 1e-6).beta), th * 180 / Math.PI, 1e-5);
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
