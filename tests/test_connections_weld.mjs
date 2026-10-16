// test_connections_weld.mjs — welded connections (js/design/connections_weld.js)
//   node tests/test_connections_weld.mjs
// Oráculos:
//  (1) AISC Steel Construction Manual 16th ed., Table 8-8 (C-shaped weld group, angle 0°): C = Rn/(C1·D·l) with D in
//      sixteenths, l in inches, FEXX = 70 ksi (C1 = 1) — the instantaneous-centre model of AISC 360 J2.4 is the one of
//      NBR 8800:2024 6.2.5.2-b; checked: (a, k) = (0,5; 0,5) 2,85; (1,0; 1,0) 3,01; (0,2; 0,5) 4,11; (0,5; 0) 1,15; (2,0; 0,2) 0,514.
//  (2) Saulo J. C. Almeida, Especialização INBEC 2016, Mód. 12 "Ligações II", Parte 2_C Exercícios: Aplicação 8 (C 2 × 190 +
//      250, a = 4,2 mm, P a 290 mm do cordão vertical → P = 137,3 kN pelo metal da solda, E60) e Aplicação 9 (C 2 × 66 + 200,
//      a = 3,5, V = 110 kN por cantoneira a 76 mm → fw,Sd = 17,2 kN/cm²) — método elástico; metal da solda igual na 2024.
//  (3) Fakury, Silva e Caldas 2017, 10.14.3: solda chapa de nó–banzo, 2 × 41,6 cm, filete 4 mm E70, F = 200 kN →
//      τSd = 8,58 kN/cm² (livro com aw = 0,28 cm), τRd = 21,56 kN/cm²; cisalhamento da chapa (linha 2) = 754,5 kN.
//  (4) Manual Gerdau "Ligações para estruturas de aço" (NBR 8800:2024), LCSP p.44: W 410×38,8, 2L 76×76×6,4×230, 6 Ø ¾" A325N
//      (3 por cantoneira), filete 5 mm: Vd sem recorte 346 kN; 2 recortes Lh = 130 → 275 kN.
//  (5) solda pilar–placa: conta de mão do método elástico fora do plano.
import * as W from '../js/design/connections_weld.js';
import { profileToSection } from '../js/design/profiles.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 0.01) => { n++; const e = Math.abs(got / exp - 1); if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(4)}`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const find = (r, re) => r.checks.find((x) => re.test(x.nome)) || { Rd: NaN, Sd: NaN };

// ---------------- (1) ICR vs AISC Table 8-8
const IN = 25.4, KIP = 4448.2216;
const aiscC = (a, k) => {
  const l = IN, kl = k * l, xc = kl * kl / (l + 2 * kl), D = IN / 16;
  const r = W.weldICR(W.cShape(l, kl, D), { xP: xc + a * l, fw: 70 * 6.894757, gamma: 1 });
  return r.Rd / KIP;                                        // kips per (sixteenth · inch)
};
for (const [a, k, c] of [[0.5, 0.5, 2.85], [1.0, 1.0, 3.01], [0.2, 0.5, 4.11], [0.5, 0, 1.15], [2.0, 0.2, 0.514], [0.3, 1.0, 6.03]]) ok(`I-${a}/${k}. AISC 8-8: C(a = ${a}; k = ${k}) = ${c}`, aiscC(a, k), c, 0.015);

// ---------------- (2) Saulo — elastic method
{ const a = 4.2, lines = [{ x1: 0, y1: -125, x2: 0, y2: 125, a }, { x1: 0, y1: 125, x2: 190, y2: 125, a }, { x1: 0, y1: -125, x2: 190, y2: -125, a }];
  const g = W.weldGroupProps(lines);
  ok('S8a. Saulo Apl. 8: xg = 5,7 cm', g.xc, 57.3, 0.01);
  ok('S8b. Saulo Apl. 8: Aw = 26,5 cm²', g.A, 2646, 0.003);
  const r = W.weldElastic(lines, { Vy: -1, T: -1 * (290 - g.xc) });       // per unit P (N)
  ok('S8c. Saulo Apl. 8: fw,Sd = 0,134·P (kN/cm² por kN)', r.f * 100, 0.134, 0.01);   // MPa/N → kN/cm² per kN
  ok('S8d. Saulo Apl. 8: P = 18,4/0,134 = 137,3 kN (E60: 0,6·415/1,35)', (0.6 * 415 / 1.35) / r.f / 1000, 137.3, 0.01); }
{ const a = 3.5, lines = [{ x1: 0, y1: -100, x2: 0, y2: 100, a }, { x1: 0, y1: 100, x2: 66, y2: 100, a }, { x1: 0, y1: -100, x2: 66, y2: -100, a }];
  const g = W.weldGroupProps(lines), r = W.weldElastic(lines, { Vy: -110e3, T: -110e3 * (76 - g.xc) });
  ok('S9a. Saulo Apl. 9: xg = 1,31 cm', g.xc, 13.1, 0.01);
  ok('S9b. Saulo Apl. 9: fw,Sd = 17,2 kN/cm²', r.f / 10, 17.2, 0.01); }

// ---------------- (3) Fakury — gusset to chord
{ const r = W.gussetChordWeld({ Fpar: 200, Fperp: 0, dw: 4, L: 416, tg: 9.5, tc: 9.5, fy: 350, fu: 500, eletrodo: 'E70' });
  const c = find(r, /2 filetes/);
  ok('F1. Fakury: τSd = 200/(2·0,707·0,4·41,6) (livro: 8,58 com aw = 0,28)', c.Sd / 10, 200 / (2 * 0.707 * 0.4 * 41.6), 1e-9);
  ok('F2. ≈ Fakury 8,58 kN/cm²', c.Sd / 10, 8.58, 0.01);
  ok('F3. Fakury: τRd = 0,6·48,5/1,35 = 21,56 kN/cm²', c.Rd / 10, 21.56, 0.001);
  ok('F4. Fakury: cisalhamento da chapa na linha da solda = 754,5 kN', find(r, /Cisalhamento da chapa/).Rd, 754.5, 0.002); }

// ---------------- (4) Gerdau LCSP
const mm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v * 1000]));
const w410 = { ...mm(profileToSection('W 410 x 38,8').design.dims), fy: 345, fu: 450 };
const lcsp = (V, recorte = null) => W.lcspConnection({ viga: w410, cant: { b: 76, t: 6.4, L: 230, ev: 40, g: 45, fy: 250, fu: 400 }, solda: { dw: 5, eletrodo: 'E70' },
  suporte: { t: 15, fu: 450 }, par: { grade: 'ASTM F3125 A325', db: 19.05, n: 3, s: 75, dh: 21 }, V, recorte });
{ const r = lcsp(200);
  ok('G1. Gerdau LCSP W410×38,8 sem recorte: capacidade V/razão = 346 kN (governa o rasgamento das cantoneiras)', 200 / r.ratioMax, 346, 0.01);
  yes('G2. a solda (ICR) não governa', !/Solda/.test(r.governa.g), r.governa.nome);
  const r2 = lcsp(200, { n: 2, Lh: 130, Lv: 30 });
  ok('G3. Gerdau LCSP 2 recortes Lh = 130: 275 kN (escoamento por flexão da alma recortada)', 200 / r2.ratioMax, 275, 0.01); }

// ---------------- Gerdau LCPP p.26 with copes (W 360×51, 2L 76×76×6,4×230, 3 Ø ¾", furo 21, excentricidade desprezada)
{ const { shearConnection } = await import('../js/design/connections_shear.js');
  const w360 = { ...mm(profileToSection('W 360 x 51,0').design.dims), fy: 345, fu: 450 };
  const run = (recorte) => shearConnection({ tipo: 'cantoneira', V: 200, viga: w360, cant: { b: 76, b2: 76, t: 6.4, fy: 250, fu: 400, ev: 40, eh: 31, a: 45, gc: 45, ebv: 35 },
    pilar: { t: 15, fu: 450 }, par: { grade: 'ASTM F3125 A325', db: 19.05, n: 3, s: 75, dh: 21 }, opts: { excentricidade: false }, recorte });
  ok('R1. Gerdau LCPP W360×51, 1 recorte Lh = 80 (Lv 30): 252 kN', 200 / run({ n: 1, Lh: 80, Lv: 30 }).ratioMax, 252, 0.012);
  ok('R2. Gerdau LCPP W360×51, 2 recortes Lh = 130: 234 kN', 200 / run({ n: 2, Lh: 130, Lv: 30 }).ratioMax, 234, 0.01); }
// ---------------- (5) column → base plate (hand: W 250×32,7 d 258 bf 146 tw 6,1 tf 9,1, dw 6; N = −100 kN (tração), M = 20 kN·m, V = 30)
{ const P = { d: 258, bf: 146, tw: 6.1, tf: 9.1, fy: 345, fu: 450 }, a = 0.707 * 6;
  const r = W.baseColumnWeld({ pilar: P, tp: 25, dw: 6, eletrodo: 'E70', N: -100, M: 20, V: 30 });
  // hand: lines — outside 2 × 146 at ±129; inside 4 × 69,95 at ±119,9; web 2 × 239,8 at x = ±3,05
  const A = a * (2 * 146 + 4 * 69.95 + 2 * 239.8), Ix = a * (2 * 146 * 129 ** 2 + 4 * 69.95 * 119.9 ** 2 + 2 * 239.8 ** 3 / 12);
  const s = 100e3 / A + 20e6 * 129 / Ix, t = 30e3 / (a * 2 * 239.8);
  ok('B1. solda pilar–placa: f = √(σ² + τ²) no bordo externo da mesa (conta de mão)', find(r, /Filetes em todo o contorno/).Sd, Math.hypot(s, 0), 1e-6);
  ok('B2. resistência 0,6·485/1,35 = 215,6 MPa', find(r, /Filetes em todo o contorno/).Rd, 215.56, 0.001);
  yes('B3. τ só na alma: 30 kN / (2·a·239,8)', Math.abs(t - 30e3 / (a * 2 * 239.8)) < 1e-9); }
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
