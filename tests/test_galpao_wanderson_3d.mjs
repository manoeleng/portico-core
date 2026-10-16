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
const nFr = [...m3.nodes.keys()].filter((id) => id < 100000).length;
ok(nFr === 8 * m2.nodes.size && !m3.planar, `oito pórticos, modelo espacial (${nFr} nós dos pórticos + ${m3.nodes.size - nFr} nós das mãos-francesas nas terças)`);
const E0 = m2.elements.size, SC = [...m2.loadCases.values()].find((l) => l.name === 'SC').id;
// X in alternate bays (Manoel, 16/10/2026) ties the frames longitudinally (ΔN ≈ 3 % in the interior frame): the plane-frame
// equivalence is checked on a copy without the X (layer 4) — the premise of this oracle
const m3x = rd('galpao_pff_wanderson_3d.s3d'); for (const e of [...m3x.elements.values()]) if (e.layer === 4) m3x.elements.delete(e.id);
const r2 = new StaticSolver().solve(m2, SC, false), r3 = new StaticSolver().solve(m3x, SC, false);
let worst = 0, Nmax = 0;
for (const e of m2.elements.values()) {
  const a = r2.getElemForces(e.id).N, b = r3.getElemForces(3 * E0 + e.id).N;   // pórtico 4 (interno)
  worst = Math.max(worst, Math.abs(a - b)); Nmax = Math.max(Nmax, Math.abs(a));
}
// the mãos-francesas tie the bottom chord to the purlins between frames: the frames are no longer independent — a small
// coupling (bottom-chord vs. purlin vertical displacement) is expected; 1 % of |N|max bounds it (0,25 % with the MF layout)
ok(Nmax > 10 && worst < 1e-2 * Nmax, `pórtico interno × plano: |ΔN|máx = ${worst} kN (|N|máx ${Nmax})`);
let s2 = 0, s3 = 0;
for (const n of m2.nodes.values()) if (n.restraints.uz) s2 += r2.getReaction(n.id)[2];
for (const n of m3.nodes.values()) if (n.restraints.uz) s3 += r3.getReaction(n.id)[2];
ok(Math.abs(s3 - 7 * s2) < 1e-6 * Math.abs(s2), `ΣRz SC: 3D ${s3} × 7 · plano ${7 * s2}`);
// secondary members: hinged, no self-weight, out of member design; rods tension-only
const sec = [...m3.elements.values()].filter((e) => e.layer > 1);
// hinged where they meet the frames (node ids < 100000); purlins continuous between frames on the MF lines; MF hinged at both ends
const atFrame = (e, o) => (o ? e.n2 : e.n1) < 100000;
ok(sec.every((e) => e.designExcluded && [0, 6].every((o) => !atFrame(e, o) || (e.releases[o + 4] && e.releases[o + 5]))), 'secundárias rotuladas nos pórticos e fora do dimensionamento');
const mf = sec.filter((e) => e.layer === 5);
ok(mf.length === 2 * 7 * 7 && mf.every((e) => e.releases[4] && e.releases[5] && e.releases[10] && e.releases[11]), `mãos-francesas: 7 linhas × 7 vãos × 2 (V) = ${mf.length}, rotuladas`);
{ // 45°: from the bottom chord to the purlin 1,5 m away from the frame (truss depth 1,5 m)
  const e = mf[0], a = m3.nodes.get(e.n1), b = m3.nodes.get(e.n2);
  near(Math.abs(b.y - a.y), 1.5, 1e-9, 'mão-francesa encontra a terça a 1,5 m do pórtico'); near(Math.abs(b.z - a.z), 1.5, 0.01, 'altura 1,5 m (45°)');
}
// unbraced lengths: bottom chord out of plane ≤ 3,45 m (Wanderson KL = 3,2 m), top chord 1,6 m (purlins anchored by the bracing)
{
  const { unbracedLengths } = await import(R + 'js/design/unbraced.js');
  const { localAxes } = await import(R + 'js/solver/timoshenko.js');
  const ub = unbracedLengths(m3, localAxes), inner = m2.nodes.size; void inner;
  const bot = [...m2.elements.values()].filter((e) => [e.n1, e.n2].every((n) => n % 2 === 0 && n >= 32 && n <= 60)).map((e) => ub.get(3 * E0 + e.id).Lx);
  const topc = [...m2.elements.values()].filter((e) => [e.n1, e.n2].every((n) => n % 2 === 1 && n >= 31 && n <= 59)).map((e) => ub.get(3 * E0 + e.id).Lx);
  ok(bot.length && Math.max(...bot) <= 3.4476 / Math.cos(Math.atan(0.1)) + 1e-3, `banzo inferior (maior vão entre MF 9,55–13,0 m, medido no banzo inclinado): Lx fora do plano máx ${Math.max(...bot).toFixed(2)} m (MF)`);
  ok(topc.length && Math.max(...topc) <= 1.8556 / Math.cos(Math.atan(0.1)) + 1e-3, `banzo superior (maior vão entre terças, junto à cumeeira): Lx fora do plano máx ${Math.max(...topc).toFixed(2)} m (terças)`);
}
// PP × CP (Wanderson Mód. 5 p.61: PP estimado 7 kg/m² + telhas e acessórios 5 kg/m² = 0,12 kN/m²): CP = 5/12 das cargas
// nodais dele (p.186: 1,15 / 6,33 kN no pórtico plano); PP = peso próprio das barras (secundárias com ρ = 7,85; tirantes
// com ρ = 0 e o peso ρ·A·g·L como cargas nodais, ½ em cada nó)
{
  const lc = (nm) => [...m3.loadCases.values()].find((l) => l.name === nm), cp2 = [...m2.loadCases.values()].find((l) => l.name === 'CP');
  near(cp2.loads[0].F[2], -6.33 * 5 / 12, 1e-6, 'CP do pórtico plano no beiral = 5/12 × 6,33'); near(cp2.loads[1].F[2], -1.15 * 5 / 12, 1e-6, 'CP nó intermediário = 5/12 × 1,15');
  ok(!cp2.selfWeight && lc('PP').selfWeight && !lc('CP').selfWeight, 'peso próprio só no caso PP');
  ok(sec.every((e) => m3.materials.get(e.matId).rho === (e.cable ? 0 : 7.85)), 'secundárias com peso próprio; tirantes com ρ = 0 (peso nodal no PP)');
  // aço: ZAR 280 nos perfis formados a frio (Mód. 5 p.51; NBR 14762 Tab. A.1: 280/380 MPa); barras redondas MR250 (Mód. 6 p.36)
  ok([...m3.elements.values()].every((e) => { const d = m3.materials.get(e.matId).design || {}; return e.cable ? d.Fy === 250 && d.Fu === 400 : d.Fy === 280 && d.Fu === 380; }), 'aço ZAR 280 (280/380 MPa) nos perfis; MR250 (250/400) nas barras redondas');
  let wr = 0; for (const e of sec.filter((x) => x.cable)) { const a = m3.nodes.get(e.n1), b = m3.nodes.get(e.n2); wr += 7.85 * 9.80665 * m3.sections.get(e.secId).A * Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }
  near(lc('PP').loads.reduce((a, l) => a + l.F[2], 0), -wr, 1e-9, `peso dos tirantes no PP (${wr.toFixed(3)} kN)`);
  const c1 = m3.combinations.get(1), fct = (c, id) => c.factors.find((x) => x.lcId === id)?.factor;
  ok(fct(c1, lc('PP').id) === 1.25 && fct(c1, lc('CP').id) === 1.3, 'NBR 8681:2025 Tab. 1: 1,25 PP (aço) e 1,30 CP (industrializados)');
  ok([...m3.combinations.values()].every((c) => c.factors.find((x) => x.lcId === lc('SC').id) || (fct(c, lc('PP').id) === 1 && fct(c, lc('CP').id) === 1 && c.factors.length === 3 && c.factors.some((x) => x.factor === 1.4 && /^Vento/.test(m3.loadCases.get(x.lcId).name)))), 'sem SC (vento de sucção): PP e CP favoráveis 1,0 e vento 1,4');
}
ok(sec.filter((e) => e.layer === 4).length === 4 * (2 * 8 + 2 * 2) && sec.filter((e) => e.layer === 4).every((e) => e.cable), 'X na cobertura (8 painéis) e nas duas paredes, nos vãos alternados 1, 3, 5 e 7');
// correntes φ9,5 (tirantes) no meio de cada vão e barras rígidas (Mód. 5 p.34/37): telhado 14 trechos + 4 inclinados à
// cumeeira, cada parede 3 trechos + 2 inclinados ao beiral; barras rígidas: 2 junto à cumeeira + 1 em cada parede, por vão
{
  const cor = sec.filter((e) => e.layer === 6), rig = sec.filter((e) => e.layer === 7);
  ok(cor.length === 7 * (14 + 4 + 2 * 5) && cor.every((e) => e.cable && /φ9,5/.test(m3.sections.get(e.secId).name)), `correntes: ${cor.length} tirantes φ9,5`);
  ok(rig.length === 7 * 4 && rig.every((e) => !e.cable && /L 40x2,25/.test(m3.sections.get(e.secId).name)), `barras rígidas: ${rig.length} L 40x2,25`);
  ok(cor.concat(rig).every((e) => [e.n1, e.n2].some((n) => n > 100000 && Math.abs(m3.nodes.get(n).y % 6 - 3) < 1e-9)), 'correntes e barras rígidas partem do meio do vão');
  const midP = [...m3.nodes.values()].filter((n) => n.id > 100000 && Math.abs(n.y % 6 - 3) < 1e-9);
  ok(midP.length === 7 * 25 && midP.every((n) => sec.filter((e) => (e.layer === 2 || e.layer === 3) && (e.n1 === n.id || e.n2 === n.id)).every((e) => !e.releases[e.n1 === n.id ? 4 : 10])), 'terças e longarinas contínuas no meio do vão (17 + 8 linhas × 7 vãos)');
}
ok(sec.filter((e) => e.cable && e.layer === 4 && [e.n1, e.n2].some((n) => [13, 28].includes(n % 1000)) && [e.n1, e.n2].some((n) => [1, 16].includes(n % 1000))).length === 4 * 2 * 2, 'X das paredes da base ao beiral (9,5 m), 4 vãos × 2 paredes');
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
// connections saved in the example (tools/design_galpao_pff_wanderson_3d_ligacoes.mjs): Assistente → "Ligações gravadas — mostrar no 3D"
{
  const cd = m3.connectionDesign, nComb = m3.combinations.size;
  ok(cd?.rows?.length === 1328 && cd.nCombos === nComb && cd.rows.every((r) => r.geo && r.ok), `ligações gravadas no exemplo: ${cd?.rows?.length} (${cd?.nCombos} de ${nComb} combinações), todas com geometria e atendendo`);
}
console.log(`test_galpao_wanderson_3d: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
