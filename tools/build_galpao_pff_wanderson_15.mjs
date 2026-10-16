// build_galpao_pff_wanderson_15.mjs — node tools/build_galpao_pff_wanderson_15.mjs [saída.s3d] [--trelica]
// Galpão em perfis formados a frio resolvido pelo Prof. Wanderson Fernando Maia (Especialização INBEC/UNICID, Módulo 05,
// "Perfis formados a frio II", 2015, págs. 61–151): vão 15 m, pórticos a 4 m, pilar treliçado b = 0,5 m com painéis de
// 0,5 m, banzo inferior a 5,0 m, banzo superior 5,5 m (beiral) → 6,65 m (cumeeira), U 100x50x2,25 nos banzos e pernas,
// 2L 40x2,25 na alma e no travejamento. Numeração das barras = a do Wanderson (pág. 96), para comparar com a envoltória
// das págs. 99–100. Geometria pelos comprimentos do pré-dimensionamento (págs. 91–94): montante de extremidade 730 mm
// (x = 1,5 m), central 1 650 mm; diagonal de extremidade 23→58 ≈ 1 240 mm, 48→59 = 1 750 mm, central 2 280 mm; banzo
// inferior KLy = 1 570 mm (último painel 5,93 → 7,5 m). Cargas nodais das págs. 81–86 (g = 0,12 kN/m² já inclui o peso
// próprio estimado, pág. 61 → sem peso próprio automático); combinações C1–C10 da pág. 88.
// Padrão: pernas e banzos contínuos, alma e travejamento rotulados (convenção do galpão de 26 m). --trelica: treliça ideal
// (todas as barras rotuladas, giros dos nós impedidos).
import fs from 'node:fs';
const R = new URL('../', import.meta.url).href;
globalThis.window = globalThis;
const { Model } = await import(R + 'js/model/model.js');
const { Serializer } = await import(R + 'js/model/serializer.js');
const { profileToSection } = await import(R + 'js/design/profiles.js');
const TRUSS = process.argv.includes('--trelica');
const outFile = process.argv.slice(2).find((a) => !a.startsWith('--')) || new URL('examples/galpao_pff_wanderson_15m.s3d', R);

const m = new Model(); m.materials.clear(); m.sections.clear();
m.planar = true;
const mat = m.addMaterial({ name: 'MR250', E: 2.0e8, G: 7.7e7, nu: 0.3, rho: 7.85 });
const cat = (nm, label) => { const ps = profileToSection(nm); if (!ps) throw new Error('perfil ausente: ' + nm);
  const d = ps.design.cfProps.dims, Av = ps.Avy ? {} : { Avy: d.bw * d.t, Avz: 2 * d.bf * d.t };
  return m.addSection({ name: `${nm} (${label})`, ...ps, ...Av }); };
const sBanzo = cat('U 100x50x2,25', 'banzos'), sPerna = cat('U 100x50x2,25', 'pernas do pilar');
const sDiag = cat('2L 40x2,25 costas g8', 'diagonais'), sMont = cat('2L 40x2,25 costas g8', 'montantes'), sTrav = cat('2L 40x2,25 costas g8', 'travejamento');
const PIN = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1];
const L = 15, b = 0.5, zB = 5.0, zEave = 5.5, zRidge = 6.65, slope = (zRidge - zEave) / (L / 2);
const zTop = (x) => zEave + slope * Math.min(x, L - x);
const nodes = new Map();
const N = (x, z, r) => { const k = `${(+x).toFixed(4)}|${(+z).toFixed(4)}`; if (nodes.has(k)) return nodes.get(k); const id = m.addNode(+(+x).toFixed(4), 0, +(+z).toFixed(4), r || {}).id; nodes.set(k, id); return id; };
const el = (a, c, s, { pin = false, beta = 0 } = {}) => { const e = m.addElement(a, c, mat.id, s.id); m.updateElement(e.id, { ...(pin || TRUSS ? { releases: [...PIN] } : {}), ...(beta ? { beta } : {}) }); return e.id; };
const BASE = { ux: 1, uy: 1, uz: 1 };
const check = (id, want) => { if (id !== want) throw new Error(`numeração: barra ${id} ≠ ${want} do Wanderson`); };

// ── pilares (esquerdo: barras 1–44; direito: 45–88) ──
function column(xo, xi, first) {
  const inward = xi > xo ? 90 : -90, lv = Array.from({ length: 11 }, (_, k) => +(k * 0.5).toFixed(4));
  const out = [...lv.map((z) => N(xo, z, z === 0 ? BASE : null)), N(xo, zEave)];        // 12 nós, topo 5,5
  const inn = [...lv.map((z) => N(xi, z, z === 0 ? BASE : null)), N(xi, zTop(xi))];     // 12 nós, topo no banzo superior
  let id = first;
  for (let k = 0; k < 11; k++) check(el(out[k], out[k + 1], sPerna, { beta: inward }), id++);            // pernas externas
  for (let k = 0; k < 11; k++) check(el(inn[k], inn[k + 1], sPerna, { beta: -inward }), id++);           // pernas internas
  for (let k = 0; k < 11; k++) {                                                                          // travejamento em zigue-zague
    const a = k % 2 === 0 ? out[k] : inn[k], c = k % 2 === 0 ? inn[k + 1] : out[k + 1];
    check(el(a, c, sTrav, { pin: true }), id++);
  }
  for (let k = 1; k <= 10; k++) check(el(out[k], inn[k], sTrav, { pin: true }), id++);                   // horizontais 0,5–5,0
  check(el(out[11], inn[11], sTrav, { pin: true }), id++);                                                // topo entre as pernas
  return { outTop: out[11], innTop: inn[11], innB: inn[10] };
}
const Lc = column(0, b, 1), Rc = column(L, L - b, 45);
// ── treliça (89–127) ──
const xIn = [b, 1.5, 2.9767, 4.4533, 5.93, L / 2];
const xs = [...xIn, ...xIn.slice(0, -1).reverse().map((x) => +(L - x).toFixed(4))];          // 0,5 … 7,5 … 14,5
const bot = xs.map((x, k) => (k === 0 ? Lc.innB : k === xs.length - 1 ? Rc.innB : N(x, zB)));
const top = xs.map((x, k) => (k === 0 ? Lc.innTop : k === xs.length - 1 ? Rc.innTop : N(x, zTop(x))));
let id = 89;
for (let k = 0; k + 1 < xs.length; k++) check(el(bot[k], bot[k + 1], sBanzo, { beta: 90 }), id++);      // banzo inferior 89–98
for (let k = 0; k + 1 < xs.length; k++) check(el(top[k], top[k + 1], sBanzo, { beta: -90 }), id++);     // banzo superior 99–108
for (let k = 1; k + 1 < xs.length; k++) check(el(bot[k], top[k], sMont, { pin: true }), id++);          // montantes 109–117
for (let k = 0; k + 1 < xs.length; k++) {                                                                 // diagonais 118–127
  const left = k < (xs.length - 1) / 2;
  check(left ? el(bot[k], top[k + 1], sDiag, { pin: true }) : el(top[k], bot[k + 1], sDiag, { pin: true }), id++);
}
if (TRUSS) for (const n of m.nodes.values()) n.restraints.ry = 1;   // treliça ideal: giros sem rigidez impedidos (não transmitem momento)

// ── carregamentos (kN, págs. 81–86): telhado nos nós do banzo superior (beirais x = 0 e 15), paredes nas longarinas ──
const roofX = [0, ...xs.slice(1, -1), L];
const roofN = roofX.map((x) => (x === 0 ? Lc.outTop : x === L ? Rc.outTop : N(x, zTop(x))));
const sn = slope / Math.hypot(1, slope), cs = 1 / Math.hypot(1, slope);
const lc = (name, t) => m.addLoadCase(name, false, 'static', null, t);
const CP = lc('CP', 'dead'), SC = lc('SC', 'live');
const V = [lc('V1 (0°, Cpi −0,3)', 'wind'), lc('V2 (0°, Cpi +0,3)', 'wind'), lc('V3 (90°, Cpi 0)', 'wind'), lc('V4 (90°, Cpi −0,3)', 'wind')];
const grav = (c, vals) => vals.forEach((v, k) => c.loads.push({ type: 'nodal', nodeId: roofN[k], F: [0, 0, -v, 0, 0, 0] }));
grav(CP, [2.28, ...Array(9).fill(0.72), 2.28]);
grav(SC, [0.75, ...Array(9).fill(1.50), 0.75]);
// roof: + = suction (outward, normal to the slope); − = pressure (into the roof); ridge: the two half-slopes summed vertically
const roof = (c, vals) => vals.forEach((v, k) => { const x = roofX[k], d = x < L / 2 - 1e-6 ? [-sn, cs] : x > L / 2 + 1e-6 ? [sn, cs] : [0, 1];
  c.loads.push({ type: 'nodal', nodeId: roofN[k], F: [v * d[0], 0, v * d[1], 0, 0, 0] }); });
const lvl = [zEave, 4.5, 3.0, 1.5];                                     // longarinas (pág. 83: 0,11 / 0,29 / 0,34 / 0,17 de cima para baixo)
const wall = (c, xo, vals, sign) => vals.forEach((v, k) => c.loads.push({ type: 'nodal', nodeId: N(xo, lvl[k]), F: [sign * v, 0, 0, 0, 0, 0] }));
roof(V[0], [-0.17, ...Array(9).fill(-0.34), -0.17]); wall(V[0], 0, [0.11, 0.29, 0.34, 0.17], +1); wall(V[0], L, [0.11, 0.29, 0.34, 0.17], -1);
roof(V[1], [1.88, ...Array(9).fill(3.76), 1.88]); wall(V[1], 0, [1.25, 3.14, 3.76, 1.88], -1); wall(V[1], L, [1.25, 3.14, 3.76, 1.88], +1);
roof(V[2], [1.92, 3.83, 3.83, 3.83, 3.83, 2.60, 1.37, 1.37, 1.37, 1.37, 0.68]); wall(V[2], 0, [0.80, 2.00, 2.39, 1.20], +1); wall(V[2], L, [0.57, 1.43, 1.71, 0.86], +1);
roof(V[3], [1.40, 2.80, 2.80, 2.80, 2.80, 1.57, 0.34, 0.34, 0.34, 0.34, 0.17]); wall(V[3], 0, [1.14, 2.85, 3.42, 1.71], +1); wall(V[3], L, [0.23, 0.57, 0.68, 0.34], +1);
// ── combinações ELU (pág. 88) ──
const C = (cid, name, f) => m.combinations.set(cid, { id: cid, name, factors: f.map(([c, k]) => ({ lcId: c.id, factor: k })) });
C(1, 'C1 – 1,25CP + 1,5SC + 0,84V1', [[CP, 1.25], [SC, 1.5], [V[0], 0.84]]);
C(2, 'C2 – 1,0CP + 1,4V2', [[CP, 1.0], [V[1], 1.4]]);
C(3, 'C3 – 1,0CP + 1,4V3', [[CP, 1.0], [V[2], 1.4]]);
C(4, 'C4 – 1,0CP + 1,4V4', [[CP, 1.0], [V[3], 1.4]]);
for (const [cid, k] of [[5, 1], [6, 2], [7, 3]]) C(cid, `C${cid} – 1,25CP + 1,5SC + 0,84V${k + 1}`, [[CP, 1.25], [SC, 1.5], [V[k], 0.84]]);
for (const [cid, k] of [[8, 1], [9, 2], [10, 3]]) C(cid, `C${cid} – 1,25CP + 1,4V${k + 1} + 1,2SC`, [[CP, 1.25], [V[k], 1.4], [SC, 1.2]]);
m._cnt.combinations = 10;
fs.writeFileSync(outFile, new Serializer().toJSON(m), 'utf8');
console.log(`${TRUSS ? 'treliça ideal' : 'banzos e pernas contínuos'}: nós ${m.nodes.size}, barras ${m.elements.size}, casos ${m.loadCases.size}, combinações ${m.combinations.size}`);
