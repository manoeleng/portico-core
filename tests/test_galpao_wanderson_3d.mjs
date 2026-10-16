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
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} × ${b}`);
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
// wind of our NBR 6123:2023 engine (windNBR6123): resultants by hand — walls 3,0–9,5 m (h = 6,5 m) × L = 42 m, roof
// horizontal projection 13 m per slope, rise 1,3 m, gables 26 × 6,5 + 26 × 1,3 / 2 m²; p = q·(Cpe − Cpi), N/m² → kN
{
  const { SparseStaticSolver } = await import(R + 'js/solver/static_sparse.js');
  const w = JSON.parse(fs.readFileSync(new URL('examples/galpao_pff_wanderson_3d.s3d', R), 'utf8')).windNBR6123, L = 42, hW = 6.5, rise = 1.3, half = 13, Ag = 26 * hW + 26 * rise / 2;
  ok(w && w.q_Nm2 > 0 && w.categoria === 'IV' && String(w.grupoS3) === '3', 'vento pelo motor NBR 6123 (categoria IV, grupo 3)');
  const sumF = (lc) => { const F = [0, 0, 0]; for (const ld of lc.loads) for (let i = 0; i < 3; i++) F[i] += ld.F[i]; return F; };
  for (const { cpi, presiones: p } of w.presiones_por_cpi) {
    const ct = (cpi > 0 ? '+' : '−') + String(Math.abs(cpi)).replace('.', ',');
    const X = [...m3.loadCases.values()].find((l) => l.name === `Vento X (90°, Cpi ${ct})`), Y = [...m3.loadCases.values()].find((l) => l.name === `Vento Y (0°, Cpi ${ct})`);
    const FX = sumF(X), FY = sumF(Y);
    const fx = ((p['1'] - p['4']) * L * hW + (p.EFI - p.GHJ) * L * rise) / 1000, fz = -(p.EFI + p.GHJ) * L * half / 1000;
    ok(Math.abs(FX[0] - fx) < 1e-6 * Math.abs(fx) + 1e-6 && Math.abs(FX[2] - fz) < 1e-6 * Math.abs(fz) && Math.abs(FX[1]) < 1e-6, `Vento X Cpi ${ct}: ΣF = ${FX.map((v) => v.toFixed(3))} × mão (${fx.toFixed(3)}, 0, ${fz.toFixed(3)}) kN`);
    // 6.1.5 friction on the leeward ℓ2 − 4h = 42 − 38 = 4 m: Ct = 0,04 × q × (roof 26 m + walls 2 × 6,5 m sheeted) × 4 m
    const Ft = 0.04 * w.q_empena_Nm2 / 1000 * (26 + 2 * 6.5) * (42 - 4 * 9.5);
    near(Y.atrito_kN, Ft, 1e-3, `atrito 6.1.5 (${Ft.toFixed(3)} kN)`);
    const fy = (p.C - p.D) * Ag / 1000 + Ft;
    // 1e-4: the gable triangle is lumped on the purlin nodes (tributary strips, kink at the ridge) — not an exact integral
    ok(Math.abs(FY[1] - fy) < 1e-4 * Math.abs(fy) && Math.abs(FY[0]) < 1e-6, `Vento Y Cpi ${ct}: ΣFy = ${FY[1].toFixed(3)} × mão ${fy.toFixed(3)} kN; ΣFx = ${FY[0].toExponential(1)}`);
    const r = new SparseStaticSolver().solve(m3, Y.id, false);
    let Ry = 0; for (const n of m3.nodes.values()) if (n.restraints.uy) Ry += r.getReaction(n.id)[1];
    ok(Math.abs(Ry + FY[1]) < 1e-6 * Math.abs(fy), `Vento Y Cpi ${ct}: ΣRy = ${Ry.toFixed(3)} equilibra`);
  }
  // α = 0° regions by area: frame y = 12 (strip 9–15 m) → 1,5/6 in EG (y ≤ x0 = 10,5) and 4,5/6 in FH; vertical load of the
  // purlin node 37 (x = 6,37, strip 1,592 m horizontal) = −p·(1,592/cos θ)·6·cos θ = −p·1,592·6
  {
    const { cpi, presiones: p } = w.presiones_por_cpi[0], ct = (cpi > 0 ? '+' : '−') + String(Math.abs(cpi)).replace('.', ',');
    const Y = [...m3.loadCases.values()].find((l) => l.name === `Vento Y (0°, Cpi ${ct})`);
    const pR = (0.25 * p.EG + 0.75 * p.FH) / 1000, x37 = m3.nodes.get(37).x, x35 = m3.nodes.get(35).x, x39 = m3.nodes.get(39).x;
    const ld = Y.loads.filter((l) => l.nodeId === 2037).reduce((a, l) => a + l.F[2], 0);
    near(ld, -pR * ((x39 - x35) / 2) * 6, 1e-6, 'pórtico y = 12: telhado ponderado 25 % EG + 75 % FH');
    // 6.1.4: the ±ea / ±eb cases keep ΣF and move the resultant by 0,075·42 = 3,15 m (along y) / 0,075·26 = 1,95 m (along x)
    for (const [base, dir, sc, mid, e] of [['Vento X (90°, Cpi ' + ct, 0, 'y', 21, 3.15], ['Vento Y (0°, Cpi ' + ct, 1, 'x', 13, 1.95]]) {
      const C = [...m3.loadCases.values()].find((l) => l.name === base + ')');
      for (const sg of [1, -1]) {
        const E = [...m3.loadCases.values()].find((l) => l.name === `${base}, ${sg > 0 ? '+' : '−'}${dir ? 'eb' : 'ea'})`);
        const S = (lc) => lc.loads.reduce((a, l) => a + l.F[dir], 0), M = (lc) => lc.loads.reduce((a, l) => a + l.F[dir] * m3.nodes.get(l.nodeId)[sc], 0);
        near(S(E), S(C), 1e-4, `${E.name}: ΣF igual ao centrado`);
        near(M(E) / S(E) - mid, sg * e, 1e-4, `${E.name}: resultante deslocada de ${sg * e} m`);
      }
    }
    // α = 90°: gable y = 0 sucked outward (−Y): C1D1 on [0, 13] and C2D2 on [13, 26] (xC1 = min(2h, b/2) = 13), rectangle 6,5 m
    // + triangle up to the 1,3 m rise; net Fy of the X case is zero (the two gables cancel)
    const X = [...m3.loadCases.values()].find((l) => l.name === `Vento X (90°, Cpi ${ct})`);
    const g0 = X.loads.filter((l) => l.nodeId < 1000).reduce((a, l) => a + l.F[1], 0);
    const q = w.q_Nm2 / 1000, c1 = q * (w.cpe_paredes.C1D1 - cpi), c2 = q * (w.cpe_paredes.C2D2 - cpi);
    ok(c1 < 0 && c2 < 0, 'C1D1/C2D2 em sucção');
    near(g0, (c1 + c2) * (13 * 6.5 + 13 * 1.3 / 2), 2e-3 * Math.abs(g0), 'oitão y = 0 no vento a 90°: sucção C1D1 + C2D2');
  }
  // Cpe of the roof against the ones implied by the example's V2 (Wanderson: q = 0,35 kN/m², Cpi +0,2, purlin strip 1,6 × 6 m)
  near(w.cpe_telhado.EFI, -(3.86 / (1.6 * 6) / 0.35) + 0.2, 0.01, 'EFI × Wanderson (−0,949)');
  near(w.cpe_telhado.GHJ, -(2.03 / (1.6 * 6) / 0.35) + 0.2, 0.01, 'GHJ × Wanderson (−0,404)');
}
console.log(`test_galpao_wanderson_3d: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
