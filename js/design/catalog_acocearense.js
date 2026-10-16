// catalog_acocearense.js — Aço Cearense, "Catálogo de produtos 2026" (Downloads/…DIGITAL_Catálogo_2026.pdf), pages
// "Estrutural e serralheria": Perfil U simples (p. 21), Perfil U enrijecido (p. 22), Cantoneira (p. 23). Transcribed
// 16/10/2026 from the PDF images: DIMENSIONS and the manufacturer's nominal MASS (±5 a ±6 %, note of the catalogue).
// The catalogue gives no section properties: U / Ue are cold-formed from hot-rolled strip ("dobrado"), so their
// properties come from js/design/cf_geom.js (mid-line, corners ri = t, the NBR 6355 convention — validated against
// all NBR 6355 rows with t ≤ 4,75 mm, tests/test_cf_geom.mjs) and they are designed by NBR 14762. The angles are
// hot-rolled ("laminação direta", inch series): shape 'angle' of the library (NBR 8800). The steel grade is not in
// the catalogue — choose it in the material (MR250 / A36 / ASTM A572…). The mass kept is the manufacturer's.
//   rows: [bw, t, bf, (D,) kg/m]  (catalogue columns: largura b = web, espessura e, lateral h = flange, aba = lip)
import { channelProps } from './cf_geom.js?v=7';

const U_AC = [
  [50, 2.00, 25, 1.475], [50, 2.25, 25, 1.650], [50, 2.65, 25, 1.930], [50, 3.00, 25, 2.167],
  [75, 2.00, 40, 2.320], [75, 2.25, 40, 2.602], [75, 2.65, 40, 3.048], [75, 3.00, 40, 3.434], [75, 4.75, 40, 5.310],
  [100, 2.00, 40, 2.704], [100, 2.25, 40, 3.034], [100, 2.65, 40, 3.557], [100, 3.00, 40, 4.011], [100, 4.75, 40, 6.222],
  [100, 2.00, 50, 3.012], [100, 2.25, 50, 3.380], [100, 3.00, 50, 4.470], [100, 4.75, 50, 6.950],
  [125, 2.00, 50, 3.427], [125, 2.25, 50, 3.846], [125, 2.65, 50, 4.514], [125, 3.00, 50, 5.094], [125, 4.75, 50, 7.937],
  [150, 2.00, 50, 3.780], [150, 2.25, 50, 4.244], [150, 2.65, 50, 4.982], [150, 3.00, 50, 5.624], [150, 4.75, 50, 8.777],
  [200, 2.65, 50, 6.006], [200, 3.00, 50, 6.800], [200, 4.75, 50, 10.504], [200, 2.00, 60, 4.911], [200, 4.75, 60, 11.252],
  [200, 4.75, 75, 12.374],
  // "Perfil U de encaixe"
  [45, 2.00, 17, 1.170], [68, 2.00, 30, 1.934], [93, 2.00, 30, 2.324], [93, 3.00, 30, 3.440],
];
const UE_AC = [
  [50, 1.95, 25, 10, 1.590], [50, 2.00, 25, 10, 1.633], [50, 2.25, 25, 10, 1.824], [50, 2.65, 25, 10, 2.123], [50, 3.00, 25, 10, 2.379],
  [75, 1.95, 40, 15, 2.510], [75, 2.00, 40, 15, 2.575], [75, 2.25, 40, 15, 2.883], [75, 2.65, 40, 15, 3.371], [75, 3.00, 40, 15, 3.792],
  [100, 1.95, 40, 15, 2.900], [100, 2.00, 40, 15, 2.967], [100, 2.25, 40, 15, 3.325], [100, 2.65, 40, 15, 3.891], [100, 3.00, 40, 15, 4.380],
  [100, 2.00, 50, 14, 3.266], [100, 2.25, 50, 14, 3.661], [100, 2.65, 50, 14, 4.290], [100, 3.00, 50, 14, 4.830],
  [125, 2.00, 50, 17, 3.860], [125, 2.25, 50, 17, 4.310], [125, 2.65, 50, 17, 5.030], [125, 3.00, 50, 17, 5.630],
  [150, 3.00, 50, 20, 6.150], [150, 2.00, 60, 20, 4.459], [150, 2.25, 60, 20, 5.003], [150, 2.65, 60, 20, 5.867], [150, 3.00, 60, 20, 6.618],
  [200, 2.65, 50, 25, 6.600], [200, 2.65, 60, 25, 7.010], [200, 3.00, 60, 25, 7.910],
  [200, 2.00, 75, 25, 5.920], [200, 2.25, 75, 25, 6.630], [200, 2.65, 75, 25, 7.960], [200, 3.00, 75, 25, 8.960],
];
// hot-rolled angles (inch): [b mm, t mm, kg/m]
export const L_AC = [
  [19.05, 3.17, 0.87], [22.22, 3.17, 1.03], [25.40, 3.17, 1.19], [25.40, 4.76, 1.72], [25.40, 6.35, 2.22],
  [31.75, 3.17, 1.50], [31.75, 4.76, 2.19], [31.75, 6.35, 2.85], [38.10, 3.17, 1.82], [38.10, 4.76, 2.67], [38.10, 6.35, 3.48],
  [50.80, 3.17, 2.45], [50.80, 4.76, 3.62], [50.80, 6.35, 4.75],
];

const n2 = (v) => String(v.toFixed(2)).replace('.', ',');
const n0 = (v) => String(+v.toFixed(2)).replace('.', ',');
export const AC_TAG = '(Aço Cearense)';
function build(shape, bw, t, bf, D, massa) {
  const g = channelProps({ bw, bf, t, D, ri: t });
  const name = shape === 'Ue' ? `Ue ${n0(bw)}x${n0(bf)}x${n0(D)}x${n2(t)} ${AC_TAG}` : `U ${n0(bw)}x${n0(bf)}x${n2(t)} ${AC_TAG}`;
  const mm = 1e-3, mm2 = 1e-6, mm3 = 1e-9, mm4 = 1e-12, mm6 = 1e-18;
  return [name, {
    shape, designacao: name, massa, fabricante: 'Aço Cearense',
    dims: { bw: bw * mm, bf: bf * mm, ...(shape === 'Ue' ? { D: D * mm } : {}), t: t * mm, ri: t * mm },
    A: g.A * mm2, Iz: g.Ix * mm4, Iy: g.Iy * mm4, Sz: g.Wx * mm3, Sy: g.Wy * mm3, rz: g.rx * mm, ry: g.ry * mm,
    J: g.J * mm4, Cw: g.Cw * mm6, x0: g.x0 * mm, xg: g.xg * mm, r0: g.r0 * mm,
    massaGeom: g.A * mm2 * 7850,
    fonte: 'Aço Cearense, Catálogo 2026 (dimensões e massa); propriedades pela linha média com cantos ri = t (convenção da NBR 6355, js/design/cf_geom.js)',
  }];
}
export const AC_PROFILES = Object.fromEntries([
  ...U_AC.map(([bw, t, bf, m]) => build('U', bw, t, bf, 0, m)),
  ...UE_AC.map(([bw, t, bf, D, m]) => build('Ue', bw, t, bf, D, m)),
]);
/** library entries of the hot-rolled angles: name → { shape: 'angle', dims (m), massa } */
export const AC_ANGLES = Object.fromEntries(L_AC.map(([b, t, m]) => [`L ${n0(b)}x${n0(b)}x${n2(t)} ${AC_TAG}`, { shape: 'angle', dims: { d: b / 1000, b: b / 1000, t: t / 1000 }, massa: m, fabricante: 'Aço Cearense' }]));
