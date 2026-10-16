// build_galpao_pff_wanderson_3d.mjs — node tools/build_galpao_pff_wanderson_3d.mjs
// Galpão PFF do Wanderson completo em 3D a partir do pórtico plano examples/galpao_pff_wanderson.s3d.
// 8 pórticos a 6 m (y = 0..42), terças em cada nó carregado do banzo superior, longarinas nas pernas externas a 3,2/4,8/6,4/8,0 m,
// contraventamento em X (φ12,5, tirante) nos tramos extremos — cobertura (plano do banzo superior) e paredes laterais.
import fs from 'node:fs';
const R = new URL('../', import.meta.url).href;
globalThis.window = globalThis;
const { profileToSection } = await import(R + 'js/design/profiles.js');
const { windLoad } = await import(R + 'assistant/loads.js');
const RULES = JSON.parse(fs.readFileSync(new URL('presets/brasil/rules.json', R), 'utf8'));
const P = JSON.parse(fs.readFileSync(new URL('examples/galpao_pff_wanderson.s3d', R), 'utf8'));
const NP = 8, DY = 6;
const N0 = P.nodes.length, E0 = P.elements.length;
const nid = (k, id) => k * 1000 + id;                       // node id of plane node `id` in frame k
const out = JSON.parse(JSON.stringify(P));
out.planar = false;
out.nodes = []; out.elements = [];
out.layers = [{ id: 1, name: 'Pórticos', color: '#64748b', visible: true, locked: false }, { id: 2, name: 'Terças', color: '#0ea5e9', visible: true, locked: false },
  { id: 3, name: 'Longarinas', color: '#22c55e', visible: true, locked: false }, { id: 4, name: 'Contraventamento', color: '#f97316', visible: true, locked: false }];
let eid = 0;
const add = (e) => { out.elements.push({ ...e, id: ++eid }); return eid; };
for (let k = 0; k < NP; k++) {
  for (const n of P.nodes) out.nodes.push({ ...JSON.parse(JSON.stringify(n)), id: nid(k, n.id), y: k * DY });
  for (const e of P.elements) add({ ...JSON.parse(JSON.stringify(e)), id: undefined, n1: nid(k, e.n1), n2: nid(k, e.n2), layer: 1, frame: k + 1 });
}
for (const e of out.elements) delete e.frame;
// materials: secondary members without self-weight (their weight is already in the nodal CP loads of the frame)
const mat0 = P.materials[0];
const MAT2 = 3;
out.materials.push({ ...mat0, id: MAT2, name: 'MR250 (secundárias — peso já nas cargas nodais)', rho: 0 });
// sections
const ue = profileToSection('Ue 150x60x20x2,00');
const SEC_UE = 7, SEC_ROD = 8;
out.sections.push({ id: SEC_UE, name: 'Ue 150x60x20x2,00 (terças e longarinas)', kappay: 0.833, kappaz: 0.833, mod: { A: 1, Iy: 1, Iz: 1, J: 1 }, ...ue, Avy: 0.15 * 0.002, Avz: 0.15 * 0.002 });   // alma bw·t, como nos U do pórtico
const d = 0.0125, A = Math.PI * d * d / 4, I = Math.PI * d ** 4 / 64;
out.sections.push({ id: SEC_ROD, name: 'Barra redonda φ12,5 (contraventamento)', A, Iz: I, Iy: I, J: 2 * I, Avy: 0.9 * A, Avz: 0.9 * A, kappay: 0.9, kappaz: 0.9, mod: { A: 1, Iy: 1, Iz: 1, J: 1 } });
const PIN = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1];
const EXCL = 'barra secundária gerada (terça/longarina/contraventamento): esforços de análise global não são os de dimensionamento — dimensionar à parte (Wanderson não dimensiona neste exemplo)';
// purlins: every top-chord node loaded in CP (13, 31..59, 28)
const cp = P.loadCases.find((l) => l.name === 'CP');
const purlinNodes = [...new Set(cp.loads.map((l) => l.nodeId))];
for (const id of purlinNodes) for (let k = 0; k < NP - 1; k++) add({ n1: nid(k, id), n2: nid(k + 1, id), matId: MAT2, secId: SEC_UE, releases: [...PIN], layer: 2, beta: 0, designExcluded: EXCL });
// girts: outer legs at 3,2/4,8/6,4/8,0 m
const byXZ = (x, z) => P.nodes.find((n) => Math.abs(n.x - x) < 1e-6 && Math.abs(n.z - z) < 1e-6)?.id;
const W = Math.max(...P.nodes.map((n) => n.x));
const girts = [];
for (const x of [0, W]) for (const z of [3.2, 4.8, 6.4, 8.0]) { const id = byXZ(x, z); if (!id) throw new Error(`sem nó em x=${x} z=${z}`); girts.push(id); }
for (const id of girts) for (let k = 0; k < NP - 1; k++) add({ n1: nid(k, id), n2: nid(k + 1, id), matId: MAT2, secId: SEC_UE, releases: [...PIN], layer: 3, beta: 90, designExcluded: EXCL });
// bracing (tension-only rods) in the end bays (k = 0 and k = NP-2)
const rod = (a, b) => add({ n1: a, n2: b, matId: MAT2, secId: SEC_ROD, releases: [...PIN], layer: 4, beta: 0, cable: true, designExcluded: EXCL });
const topSorted = purlinNodes.map((id) => P.nodes.find((n) => n.id === id)).sort((a, b) => a.x - b.x);
const half = topSorted.filter((n) => n.x <= W / 2 + 1e-6), mid = half.length - 1;
// panel limits: every second purlin from each eave to the ridge (ridge always a limit)
const limsL = []; for (let i = 0; i <= mid; i += 2) limsL.push(i); if (limsL.at(-1) !== mid) limsL.push(mid);
const lims = [...limsL.map((i) => topSorted[i].id), ...limsL.slice(0, -1).reverse().map((i) => topSorted[topSorted.length - 1 - i].id)];
for (const k of [0, NP - 2]) {
  for (let i = 0; i + 1 < lims.length; i++) { rod(nid(k, lims[i]), nid(k + 1, lims[i + 1])); rod(nid(k, lims[i + 1]), nid(k + 1, lims[i])); }
  for (const x of [0, W]) { const b = byXZ(x, 0), t = byXZ(x, 8.0); rod(nid(k, b), nid(k + 1, t)); rod(nid(k, t), nid(k + 1, b)); }
}
// loads: per frame, end frames half
for (const lc of out.loadCases) {
  const src = P.loadCases.find((l) => l.id === lc.id);
  lc.loads = [];
  for (let k = 0; k < NP; k++) { const f = (k === 0 || k === NP - 1) ? 0.5 : 1; for (const ld of src.loads) lc.loads.push({ ...ld, nodeId: nid(k, ld.nodeId), F: ld.F.map((v) => v * f) }); }
}
// ── WIND: our NBR 6123:2023 engine (assistant/loads.js windLoad, the one of the shed generator) instead of the plane
// frame's V1–V3 (which have no longitudinal wind). Site data: Wanderson gives only V0 = 30 m/s and q = 0,35 kN/m²; that q
// is reproduced by category IV, class B, S1 = 1, S3 = 0,95 (group 3 of the 1988 edition) at z = 10,8 m → adopted cat. IV,
// S1 = 1, group 3 (industrial, low occupancy: S3 = 1,00 in the 2023 edition). Cpi +0,2 and −0,3 as in the example.
// Wind +X (α = 90°) and +Y (α = 0°, gable C at y = 0); −X/−Y by symmetry. Nodal forces, p = q·(Cpe − Cpi) > 0 toward
// the surface: walls (cladding from 3,0 m — masonry below — to the eave 9,5 m) on the outer-leg nodes at the girt levels;
// roof on the purlin nodes, normal to each slope; gables (no gable columns in the example): the rectangle 3,0–9,5 m
// half to each outer leg of the end frame and the triangle above the eave on the end frame's purlin nodes — as the
// shed generator does (assistant/generator.js). Revision (revisor-calculo-nbr, 16/10/2026):
//  · α = 0° regions (x0, a/2) weighted by the AREA of each frame's tributary strip in each region (the generator takes the
//    region of the frame position, which under-loads the strip that straddles x0);
//  · α = 90°: suction on the gables parallel to the wind (Tab. 6 C1D1 up to xC1 = min(2h, b/2) from the windward wall,
//    C2D2 beyond);
//  · 6.1.4: drag eccentricity ea = 0,075·a (wind X, a along y) and eb = 0,075·b (wind Y, b along x), no neighbourhood —
//    cases ±e with the horizontal component in the wind direction varied linearly so that its resultant moves by e
//    (ΣF unchanged), plus the centred case;
//  · 6.1.5: friction for wind Y (ℓ2/h = 42/9,5 > 4, h at the eave — conservative): Ft = Ct·q·ℓ1·(ℓ2 − 4h) (roof) +
//    Ct·q·2h·(ℓ2 − 4h) (walls), Ct = 0,04 (steel sheeting, rectangular ribs transverse to the wind); the masonry strip
//    0–3 m bears directly on the foundation and is left out; applied on the leeward ℓ2 − 4h of roof and walls.
const WIND = { V0: 30, S1: 1, categoria: 'IV', grupoS3: '3', cpi: [0.2, -0.3], hParede0: 3.0 };
const zEave = 9.5, zRidge = Math.max(...topSorted.map((n) => n.z)), theta = Math.atan((zRidge - zEave) / (W / 2));
const vi = windLoad({ geometry: { width_m: W, length_m: (NP - 1) * DY, roof_slope_deg: theta * 180 / Math.PI, eave_height_m: zEave },
  wind: { V0_m_s: WIND.V0, S1: WIND.S1, categoria: WIND.categoria, grupoS3: WIND.grupoS3, cpi: WIND.cpi } }, RULES, zRidge);
if (!(vi.q_Nm2 > 0)) throw new Error('vento não calculado: ' + (vi._notas || []).join(' '));
const L = (NP - 1) * DY, tribY = (k) => (k === 0 || k === NP - 1 ? DY / 2 : DY);
// tributary lengths of sorted stations xs inside [lo, hi] (mid-points)
const tribs = (xs, lo, hi) => xs.map((x, i) => Math.min(hi, i + 1 < xs.length ? (x + xs[i + 1]) / 2 : hi) - Math.max(lo, i > 0 ? (xs[i - 1] + x) / 2 : lo));
const wallZ = [3.2, 4.8, 6.4, 8.0, zEave], wallT = tribs(wallZ, WIND.hParede0, zEave);
const roofL = topSorted.filter((n) => n.x <= W / 2 + 1e-9), roofR = topSorted.filter((n) => n.x >= W / 2 - 1e-9);
const roofTL = tribs(roofL.map((n) => n.x), 0, W / 2), roofTR = tribs(roofR.map((n) => n.x), W / 2, W);
// mid-point of each node's tributary interval (to pick the Tab. 6 gable zone of the strip it carries)
const mids = (xs, lo, hi) => xs.map((x, i) => (Math.max(lo, i > 0 ? (xs[i - 1] + x) / 2 : lo) + Math.min(hi, i + 1 < xs.length ? (x + xs[i + 1]) / 2 : hi)) / 2);
const midL = mids(roofL.map((n) => n.x), 0, W / 2), midR = mids(roofR.map((n) => n.x), W / 2, W);
const sn = Math.sin(theta), cs = Math.cos(theta), kN = (v) => (v || 0) / 1000;
// strip of frame k along y and its area fractions in the α = 0° regions [0, x0], [x0, a/2], [a/2, L]
const strip = (k) => [Math.max(0, k * DY - DY / 2), Math.min(L, k * DY + DY / 2)];
const fracs = (k) => { const [y0, y1] = strip(k), ov = (a, b) => Math.max(0, Math.min(y1, b) - Math.max(y0, a)) / (y1 - y0);
  return [ov(0, vi.x0_m), ov(vi.x0_m, L / 2), ov(L / 2, L)]; };
const xC1 = Math.min(2 * zEave, W / 2), CT = 0.04, hFr = zEave, Lfr = L - 4 * hFr;
const windCases = [];
let lcId = Math.max(...out.loadCases.map((l) => l.id));
const push = (lc, nodeId, F) => { if (F.some((v) => Math.abs(v) > 1e-12)) lc.loads.push({ type: 'nodal', nodeId, F: [...F.map((v) => +v.toFixed(6)), 0, 0, 0] }); };
// roof: p·A on each slope, A = horizontal width / cos θ × tributary along y; force −p·A·n (n outward, upward)
const roof = (lc, k, pL, pR) => {
  roofL.forEach((n, i) => { const A = roofTL[i] / cs * tribY(k), p = kN(pL); push(lc, nid(k, n.id), [p * A * sn, 0, -p * A * cs]); });
  roofR.forEach((n, i) => { const A = roofTR[i] / cs * tribY(k), p = kN(pR); push(lc, nid(k, n.id), [-p * A * sn, 0, -p * A * cs]); });
};
const wall = (lc, k, x, pIn, dir) => wallZ.forEach((z, i) => { const F = [0, 0, 0]; F[dir] = pIn * wallT[i] * tribY(k); push(lc, nid(k, byXZ(x, z)), F); });
for (const { cpi, presiones: Pz } of vi.presiones_por_cpi) {
  const ct = (cpi > 0 ? '+' : '−') + String(Math.abs(cpi)).replace('.', ',');
  const X = { id: ++lcId, name: `Vento X (90°, Cpi ${ct})`, loads: [], selfWeight: false, type: 'static', specDir: null };
  const Y = { id: ++lcId, name: `Vento Y (0°, Cpi ${ct})`, loads: [], selfWeight: false, type: 'static', specDir: null };
  for (let k = 0; k < NP; k++) {
    wall(X, k, 0, kN(Pz['1']), 0); wall(X, k, W, -kN(Pz['4']), 0); roof(X, k, Pz.EFI, Pz.GHJ);
    const fr = fracs(k);
    const pS = fr[0] * Pz.A1B1 + fr[1] * Pz.A2B2 + fr[2] * Pz.A3B3, pR = fr[0] * Pz.EG + fr[1] * Pz.FH + fr[2] * Pz.IJ;
    wall(Y, k, 0, kN(pS), 0); wall(Y, k, W, -kN(pS), 0); roof(Y, k, pR, pR);
    if (k === 0 || k === NP - 1) {                       // α = 90°: gables parallel to the wind, suction C1D1 / C2D2 (outward)
      const inw = k === 0 ? 1 : -1, pC1 = kN(vi.q_Nm2 * (vi.cpe_paredes.C1D1 - cpi)), pC2 = kN(vi.q_Nm2 * (vi.cpe_paredes.C2D2 - cpi));   // Tab. 6 Cpe of the engine (no ready pressure)
      // leg x = 0 takes the gable width [0, b/2] (all C1D1 when xC1 = b/2), leg x = W takes [b/2, b]
      const pOf = (x0, x1) => ((Math.min(x1, xC1) - Math.min(x0, xC1)) * pC1 + (Math.max(x1, xC1) - Math.max(x0, xC1)) * pC2) / (x1 - x0);
      for (const [x, pg] of [[0, pOf(0, W / 2)], [W, pOf(W / 2, W)]]) wallZ.forEach((z, i) => push(X, nid(k, byXZ(x, z)), [0, inw * pg * wallT[i] * W / 2, 0]));
      // each slope's share of a node by the side it belongs to (the ridge node carries half of each slope)
      [...roofL.map((n, i) => [n, roofTL[i], midL[i]]), ...roofR.map((n, i) => [n, roofTR[i], midR[i]])].forEach(([n, t, xm]) => push(X, nid(k, n.id), [0, inw * (xm < xC1 ? pC1 : pC2) * (n.z - zEave) * t, 0]));
    }
    if (k === 0 || k === NP - 1) {                       // gables: C (y = 0, inward +Y), D (y = L, inward −Y)
      const pG = k === 0 ? kN(Pz.C) : -kN(Pz.D);
      for (const x of [0, W]) wallZ.forEach((z, i) => push(Y, nid(k, byXZ(x, z)), [0, pG * wallT[i] * W / 2, 0]));
      [...roofL.map((n, i) => [n, roofTL[i]]), ...roofR.map((n, i) => [n, roofTR[i]])].forEach(([n, t]) => push(Y, nid(k, n.id), [0, pG * (n.z - zEave) * t, 0]));
    }
  }
  // 6.1.5 friction (wind +Y) on the leeward ℓ2 − 4h: roof on the purlin nodes (horizontal width share), walls on the
  // girt nodes of both side walls (height share of the sheeted part 3,0–9,5 m)
  if (Lfr > 0) {
    const q = vi.q_empena_Nm2 / 1000, FtR = CT * q * W * Lfr, FtW = CT * q * 2 * (zEave - WIND.hParede0) * Lfr;
    for (let k = 0; k < NP; k++) {
      const [y0, y1] = strip(k), f = Math.max(0, y1 - Math.max(y0, L - Lfr)) / Lfr; if (!(f > 0)) continue;
      [...roofL.map((n, i) => [n, roofTL[i]]), ...roofR.map((n, i) => [n, roofTR[i]])].forEach(([n, t]) => push(Y, nid(k, n.id), [0, FtR * f * t / W, 0]));
      for (const x of [0, W]) wallZ.forEach((z, i) => push(Y, nid(k, byXZ(x, z)), [0, FtW / 2 * f * wallT[i] / (zEave - WIND.hParede0), 0]));
    }
    Y.atrito_kN = +(FtR + FtW).toFixed(3);
  }
  windCases.push(X, Y);
  // 6.1.4 eccentricity: ±e cases, horizontal component in the wind direction scaled by 1 + c·d (d = s − s̄); resultant at
  // s̄ + e: (A + c·B)/(F + c·A) = e → c = (e·F − A)/(B − e·A), A = ΣF·d, B = ΣF·d²
  const coord = new Map(out.nodes.map((n) => [n.id, n]));
  for (const [C, dir, e, sc, sbar, tag] of [[X, 0, 0.075 * L, 'y', L / 2, 'ea'], [Y, 1, 0.075 * W, 'x', W / 2, 'eb']]) {
    let F = 0, A = 0, B = 0;
    for (const ld of C.loads) { const d = coord.get(ld.nodeId)[sc] - sbar; F += ld.F[dir]; A += ld.F[dir] * d; B += ld.F[dir] * d * d; }
    for (const sg of [1, -1]) {
      const c = (sg * e * F - A) / (B - sg * e * A), E = { ...C, id: ++lcId, name: C.name.replace(')', `, ${sg > 0 ? '+' : '−'}${tag})`), loads: C.loads.map((ld) => {
        const G = [...ld.F]; G[dir] = +(G[dir] * (1 + c * (coord.get(ld.nodeId)[sc] - sbar))).toFixed(6); return { ...ld, F: G }; }), excentricidade_m: sg * e };
      windCases.push(E);
    }
  }
}
// the plane frame's wind cases (V1–V3) and their combinations are replaced
const windIds = new Set(P.loadCases.filter((l) => /^V\d/.test(l.name)).map((l) => l.id));
out.loadCases = [...out.loadCases.filter((l) => !windIds.has(l.id)), ...windCases];
const cpId = P.loadCases.find((l) => l.name === 'CP').id, scId = P.loadCases.find((l) => l.name === 'SC').id;
// ELU of the example (pág. 192) per wind case: 1,25CP + 1,5SC; 1,0CP + 1,4V; 1,25CP + 1,5SC + 0,84V; 1,25CP + 1,4V + 1,2SC
out.combinations = [{ id: 1, name: 'C1 – 1,25CP + 1,5SC', factors: [{ lcId: cpId, factor: 1.25 }, { lcId: scId, factor: 1.5 }] }];
for (const V of windCases) {
  const v = V.name.replace('Vento ', 'V').replace(/ \(.*Cpi /, '(').replace(')', ')');
  for (const [nm, f] of [[`1,0CP + 1,4${v}`, [[cpId, 1], [V.id, 1.4]]], [`1,25CP + 1,5SC + 0,84${v}`, [[cpId, 1.25], [scId, 1.5], [V.id, 0.84]]], [`1,25CP + 1,4${v} + 1,2SC`, [[cpId, 1.25], [V.id, 1.4], [scId, 1.2]]]])
    out.combinations.push({ id: out.combinations.length + 1, name: `C${out.combinations.length + 1} – ${nm}`, factors: f.map(([lcId, factor]) => ({ lcId, factor })) });
}
out.windNBR6123 = { ...WIND, q_Nm2: vi.q_Nm2, q_empena_Nm2: vi.q_empena_Nm2, S2: vi.S2, S2_empena: vi.S2_empena, S3: vi.S3, classe: vi.classe, classe_empena: vi.classe_empena,
  x0_m: vi.x0_m, xC1_m: xC1, ea_m: 0.075 * L, eb_m: 0.075 * W, atrito: { Ct: CT, h_m: hFr, l2_menos_4h_m: Lfr },
  gammaG: 'γg = 1,25 do exemplo (peso próprio de aço, NBR 8681 Tab. 1); com telhas e instalações no CP, 1,35 agrupado (Tab. 2) para o projeto real', cpe_paredes: vi.cpe_paredes, cpe_telhado: vi.cpe_telhado, presiones_por_cpi: vi.presiones_por_cpi, notas: vi._notas,
  fonte: 'motor NBR 6123:2023 do PORTICO (assistant/loads.js windLoad); V0 do Wanderson (Mód. 6 p.183), categoria IV / grupo 3 inferidos do q = 0,35 kN/m² do exemplo (NBR 6123:1988)' };
// self-weight: CP keeps selfWeight (frame members MR250, secondary members rho = 0)
out._counters = { ...out._counters, nodes: Math.max(...out.nodes.map((n) => n.id)), elements: eid, materials: MAT2, sections: SEC_ROD, layers: 4 };
out.activeLayer = 1;
out.layerView = null;
fs.writeFileSync(new URL('examples/galpao_pff_wanderson_3d.s3d', R), JSON.stringify(out));
console.log(`vento: q = ${vi.q_Nm2} N/m² (α = 90°, classe ${vi.classe}), ${vi.q_empena_Nm2} N/m² (α = 0°, classe ${vi.classe_empena}); x0 = ${vi.x0_m} m; casos ${windCases.map((l) => l.name).join(' | ')}; ${out.combinations.length} combinações`);
console.log('nós', out.nodes.length, 'elementos', out.elements.length, 'terças', purlinNodes.length, 'linhas; painéis do X na cobertura', lims.length - 1, lims.join(','));
