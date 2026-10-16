// build_galpao_pff_wanderson_3d.mjs — node tools/build_galpao_pff_wanderson_3d.mjs
// Galpão PFF do Wanderson completo em 3D a partir do pórtico plano examples/galpao_pff_wanderson.s3d.
// 8 pórticos a 6 m (y = 0..42), terças em cada nó carregado do banzo superior, longarinas nas pernas externas a 3,2/4,8/6,4/8,0 m,
// contraventamento em X (φ12,5, tirante) nos tramos extremos — cobertura (plano do banzo superior) e paredes laterais.
import fs from 'node:fs';
const R = new URL('../', import.meta.url).href;
globalThis.window = globalThis;
const { profileToSection } = await import(R + 'js/design/profiles.js');
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
// self-weight: CP keeps selfWeight (frame members MR250, secondary members rho = 0)
out._counters = { ...out._counters, nodes: Math.max(...out.nodes.map((n) => n.id)), elements: eid, materials: MAT2, sections: SEC_ROD, layers: 4 };
out.activeLayer = 1;
out.layerView = null;
fs.writeFileSync(new URL('examples/galpao_pff_wanderson_3d.s3d', R), JSON.stringify(out));
console.log('nós', out.nodes.length, 'elementos', out.elements.length, 'terças', purlinNodes.length, 'linhas; painéis do X na cobertura', lims.length - 1, lims.join(','));
