// test_connections_prim.mjs — primitives of js/design/connections.js against the literature (NBR 8800:2008 books,
// entering the book's own dimensions where the 2024 formula did not change) and NBR 14762:2010 (Wanderson, mód. 6).
//   node tests/test_connections_prim.mjs
// Fontes: Fakury, Silva e Caldas 2017 (10.14.3 p.296–302; 10.14.5 p.303–306; 10.14.8.2 p.321–324); Pfeil 9ª ed.
// (problemas 3.5.1 e 3.5.2); "Dimensionamento de Elementos e Ligações em Estruturas de Aço" Ex. 9.1; Wanderson mód. 6
// Aplicação 1. Mudança 2008 → 2024 recalculada à mão: Fv,Rd 0,40 → 0,45 (rosca, A307) e 0,50 → 0,56; A325 fub 830.
import * as C from '../js/design/connections.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 0.005) => { n++; const e = Math.abs(got / exp - 1); if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(3)}`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const k = (N) => N / 1000;

// --- tables
yes('T1. Tab. 14: furo-padrão M16 18, M20 22, M24 27, ¾" 20,6', C.holeStd8800(16) === 18 && C.holeStd8800(20) === 22 && C.holeStd8800(24) === 27 && Math.abs(C.holeStd8800(19.05) - 20.6375) < 1e-6);
yes('T2. Tab. 16: borda mín. M20 26, M24 30, ¾" 25, 1" 32, M36 45', C.edgeMin8800(20) === 26 && C.edgeMin8800(24) === 30 && C.edgeMin8800(19.05) === 25 && C.edgeMin8800(25.4) === 32 && C.edgeMin8800(36) === 45);
yes('T2c. Tab. 14: 1" → 1 1/8" (28,575 mm); ¾" → 13/16"', Math.abs(C.holeStd8800(25.4) - 28.575) < 1e-9 && Math.abs(C.holeStd8800(19.05) - 20.6375) < 1e-9);
yes('T2b. Tab. 14/16: ⅞" (22,225) = 22,225 + 1/16" e borda 28; M22 = 24 e borda 28', Math.abs(C.holeStd8800(22.225) - (22.225 + 25.4 / 16)) < 1e-9 && C.holeStd8800(22) === 24 && C.edgeMin8800(22.225) === 28);
yes('T3. Tab. 11: perna mínima 3/5/6/8', C.filletMin8800(6.3) === 3 && C.filletMin8800(9.5) === 5 && C.filletMin8800(16) === 6 && C.filletMin8800(25) === 8);
yes('T4. NBR 14762 Tab. 15 / 16: furo 12,5 → 14,0; A325 M16 825; A307 ½" 415', C.holeStd14762(12.5) === 14 && C.fub14762('ASTM A325', 16) === 825 && C.fub14762('ASTM A307', 12.7) === 415);

// --- bolts, NBR 8800:2024 (hand: 0,45·π·20²/4·800/1,35 = 83,78 kN; Fakury p.300 tinha 0,4 → 74,43)
ok('P1. Fv,Rd ISO 8.8 M20 com rosca (2024) = 83,78 kN', k(C.boltShear8800({ grade: 'ISO 898-1 classe 8.8', db: 20 }).R), 0.45 * Math.PI * 100 * 800 / 1.35 / 1000, 1e-9);
ok('P2. idem pela conta 2008 do Fakury × 0,45/0,40 (74,43 → 83,73)', k(C.boltShear8800({ grade: 'ISO 898-1 classe 8.8', db: 20 }).R), 74.43 * 0.45 / 0.4, 0.002);
ok('P3. Fv,Rd A325 M16 com rosca = 55,6 kN (conta de mão)', k(C.boltShear8800({ grade: 'ASTM F3125 A325', db: 16 }).R), 55.6, 0.002);
ok('P4. Fv,Rd A325 M16 sem rosca = 69,2 kN', k(C.boltShear8800({ grade: 'ASTM F3125 A325', db: 16, rosca: false }).R), 69.2, 0.002);
ok('P5. Ft,Rd A325 M16 = 92,7 kN', k(C.boltTension8800({ grade: 'ASTM F3125 A325', db: 16 }).R), 92.7, 0.002);
ok('P6. Ex. 9.1: Fv,Rd A307 ½" (livro: db = 12,5 mm, Ab = 1,23 cm²) na 2024 = 16,97 kN', k(C.boltShear8800({ grade: 'ASTM A307', db: 12.5, rosca: false }).R), 16.97, 0.002);
ok('P7. Fakury 10.14.5: M22 sem rosca 0,56 → 126,1 kN', k(C.boltShear8800({ grade: 'ISO 898-1 classe 8.8', db: 22, rosca: false }).R), 0.56 * 380.13 * 800 / 1.35 / 1000, 0.001);
yes('P8. A307 nunca usa 0,56 (6.3.3.2-a)', C.boltShear8800({ grade: 'ASTM A307', db: 20, rosca: false }).k === 0.45);
ok('P9. pega longa 6.3.7: M20, pega 130 mm → −20 %', C.boltShear8800({ grade: 'ISO 898-1 classe 8.8', db: 20, pega: 130 }).R / C.boltShear8800({ grade: 'ISO 898-1 classe 8.8', db: 20 }).R, 0.8, 1e-9);

// --- bearing (6.3.3.3, unchanged) with the book's ℓf
ok('B1. Fakury p.300: contato na chapa de nó ℓf 28,25, t 9,5, fu 500 = 119,5', k(C.bearing8800({ lf: 28.25, db: 20, t: 9.5, fu: 500 }).R), 119.5, 0.002);
ok('B2. Fakury p.300: contato na cantoneira t 6,35, fu 400 = 63,9', k(C.bearing8800({ lf: 28.25, db: 20, t: 6.35, fu: 400 }).R), 63.9, 0.002);
ok('B3. Pfeil 3.5.2: furo externo a = 18 mm, ½", t 9,5 → 60,8', k(C.bearing8800({ lf: 18, db: 12.7, t: 9.5, fu: 400 }).R), 60.8, 0.003);
ok('B4. Pfeil 3.5.2: furo interno (teto 2,4·d·t·fu) → 85,8', k(C.bearing8800({ lf: 60, db: 12.7, t: 9.5, fu: 400 }).R), 85.8, 0.003);
ok('B5. Ex. 9.1: contato (teto) ½", t 9,5 = 84,4 kN (A307 ½" ~ 12,5 mm no livro)', k(C.bearing8800({ lf: 50, db: 12.5, t: 9.5, fu: 400 }).R), 84.4, 0.002);
ok('B6. Fakury 10.14.8.2: contato na alma tw 8,8, fu 450, ¾" (teto) = 133,8', k(C.bearing8800({ lf: 52.5, db: 19.05, t: 8.8, fu: 450 }).R), 133.8, 0.003);
ok('B7. Fakury 10.14.8.2: contato na cantoneira ℓf 28,75, t 9,5 = 97,28', k(C.bearing8800({ lf: 28.75, db: 19.05, t: 9.5, fu: 400 }).R), 97.28, 0.002);

// --- block shear / shear / tension elements (6.5.6, 6.5.5, 6.5.3 — unchanged)
ok('R1. Fakury p.301: rasgamento da cantoneira (Agv 889, Anv 665, Ant 116 mm²) = 133,1', k(C.blockShear8800({ Agv: 889, Anv: 665, Ant: 116, fy: 250, fu: 400 }).R), 133.1, 0.002);
ok('R2. Fakury p.301: rasgamento da chapa de nó (Cts 0,5) = 416,3', k(C.blockShear8800({ Agv: 1330, Anv: 995, Ant: 1131, fy: 350, fu: 500, Cts: 0.5 }).R), 416.3, 0.002);
ok('R3. Pfeil 3.5.2: rasgamento 2L = 224', k(C.blockShear8800({ Agv: 1320, Anv: 819, Ant: 265, fy: 250, fu: 400 }).R), 224, 0.005);
ok('R4. Ex. 9.1: rasgamento = 206,3', k(C.blockShear8800({ Agv: 1425, Anv: 1045, Ant: 162, fy: 250, fu: 400 }).R), 206.3, 0.002);
ok('R5. Fakury 10.14.8.2: rasgamento da cantoneira dupla = 352,4', k(C.blockShear8800({ Agv: 2518, Anv: 1770, Ant: 245, fy: 250, fu: 400 }).R), 352.4, 0.002);
ok('S1. Fakury p.301: cisalhamento da chapa, linha 1 (Agv = Anv = 2850) = 544,1', k(C.shearElement8800({ Agv: 2850, Anv: 2850, fy: 350, fu: 500 }).R), 544.1, 0.002);
ok('S2. Fakury 10.14.8.2: cisalhamento das cantoneiras (2898 / 2043) = 363,2', k(C.shearElement8800({ Agv: 2898, Anv: 2043, fy: 250, fu: 400 }).R), 363.2, 0.002);
ok('S3. Fakury 10.14.8.2: cisalhamento da alma (3608 / 2816; fy 345, fu 450) = 563,2', k(C.shearElement8800({ Agv: 3608, Anv: 2816, fy: 345, fu: 450 }).R), 563.2, 0.002);
ok('N1. Ex. 9.1: ruptura Ae = 323 mm², fu 400 → 95,7', k(C.tensionElement8800({ Ag: 475, Ae: 323, fy: 250, fu: 400 }).r), 95.7, 0.002);
ok('N2. Ex. 9.1: escoamento Ag 475 → 107,9', k(C.tensionElement8800({ Ag: 475, Ae: 323, fy: 250, fu: 400 }).y), 107.9, 0.002);
ok('N3. Fakury 10.14.3: Whitmore Ag = 1097 mm², fy 350 → 349,0', k(C.tensionElement8800({ Ag: 1097, Ae: 1097, fy: 350, fu: 500 }).y), 349.0, 0.002);
ok('N4. Fakury 10.14.7: tala Ae 2251, fu 500 → 833,7', k(C.tensionElement8800({ Ag: 2813, Ae: 2251, fy: 350, fu: 500 }).r), 833.7, 0.002);
// compression of the gusset (Fakury p.301: 115,5 × 9,5, K·L = 0,65·102 → 335,1 kN)
ok('K1. Fakury 10.14.3: compressão na chapa de nó (Whitmore 115,5 × 9,5; 0,65·102) = 335,1', k(C.compressionPlate8800({ b: 115.5, t: 9.5, KL: 0.65 * 102, fy: 350 }).R), 335.1, 0.003);
ok('K2. Fakury 10.14.7: tala comprimida (225 × 12,5; 0,65·90 mm) = 877,1', k(C.compressionPlate8800({ b: 225, t: 12.5, KL: 0.65 * 90, fy: 350 }).R), 877.1, 0.005);

// --- welds (Tab. 9 weld metal, unchanged): Fakury p.302 τRd = 0,6·485/1,35 = 215,6 MPa; conta de mão 5 mm E70 0,762 kN/mm
ok('W1. filete 5 mm E70: 0,762 kN/mm', k(C.fillet8800({ dw: 5, L: 1, fw: 485 }).R), 0.762, 0.002);
ok('W2. Fakury p.302: τRd = 0,6·fw/γw2 = 215,6 MPa (Aw = 1 mm²)', C.fillet8800({ dw: 1 / 0.707, L: 1, fw: 485 }).R, 215.56, 0.001);
ok('W3. 6.2.5.2-a: transversal θ = 90° → × 1,5', C.fillet8800({ dw: 5, L: 100, fw: 485, theta: 90 }).R / C.fillet8800({ dw: 5, L: 100, fw: 485 }).R, 1.5, 1e-9);
ok('W4. 6.2.2.2-d: L = 150dw → β = 1,2 − 0,3 = 0,9', C.fillet8800({ dw: 6, L: 900, fw: 485, longitudinalExtremo: true }).beta, 0.9, 1e-9);
ok('W5. 6.2.2.2-d: L > 300dw → ℓef = 180dw', C.fillet8800({ dw: 5, L: 2000, fw: 485, longitudinalExtremo: true }).Lef, 900, 1e-9);

// --- elastic group (Fakury 10.14.5: 6 bolts 2 × 3, x = ±65, y = 0, ±75; F = 76 kN at 210 mm; Ab = 380 mm²)
{ const bolts = []; for (const x of [-65, 65]) for (const y of [-75, 0, 75]) bolts.push({ x, y });
  const g = C.elasticGroup(bolts, { Vy: -76, M: -76 * 210 });
  ok('G1. Σ(x² + y²) = Iz/Ab = 1818 cm⁴ / 3,80 cm² → 47 850 mm²', g.J, (4 * 75 ** 2 + 6 * 65 ** 2), 1e-9);
  ok('G2. Fakury: Fv,Sd = 3,80·11,18 = 42,48 kN', g.Rmax, 42.48, 0.003); }

// --- NBR 14762 (Wanderson mód. 6, Aplicação 1: t = 2 mm, e = 25, d = 12,5 A307, fu 400)
ok('F1. rasgamento t·e·fu/1,45 = 13,8 kN', k(C.tearing14762({ e: 25, t: 2, fu: 400 }).R), 13.8, 0.003);
ok('F2. esmagamento αe = 1,896; FRd = 12,3 kN (livro arredonda αe = 1,90 → tolerância 1 %)', k(C.bearing14762({ d: 12.5, t: 2, fu: 400 }).R), 12.3, 0.01);
ok('F3. corte A307 12,5 rosca: 0,4·Ab·415/1,35 = 15,1 kN', k(C.boltShear14762({ grade: 'ASTM A307', d: 12.5 }).R), 15.1, 0.005);
ok('F4. Ft,Rd A307 12,5 = 0,75·122,7·415/1,35 = 28,3 kN', k(C.boltTension14762({ grade: 'ASTM A307', d: 12.5 }).R), 0.75 * Math.PI * 12.5 ** 2 / 4 * 415 / 1.35 / 1000, 1e-9);
ok('F5. 10.2.3-b normal: t·L·fu/1,55, t 2, L 100 → 51,6 kN', k(C.fillet14762({ L: 100, t: 2, w: 3, fu: 400, fw: 415, dir: 'normal' }).R), 2 * 100 * 400 / 1.55 / 1000, 1e-9);
ok('F6. 10.2.3-a paralela L/t = 20: (1 − 0,2)·t·L·fu/1,65', k(C.fillet14762({ L: 40, t: 2, w: 3, fu: 400, fw: 415 }).R), 0.8 * 2 * 40 * 400 / 1.65 / 1000, 1e-9);
ok('F7. 10.2.3-c t = 3: metal da solda 0,75·0,7w·L·fw/1,65 governa', k(C.fillet14762({ L: 100, t: 3, w: 3, fu: 400, fw: 415, dir: 'normal' }).R), 0.75 * 2.1 * 100 * 415 / 1.65 / 1000, 1e-9);

// --- design force (6.1.5.2 / 10.1-a)
yes('D1. 8800: 20 kN → 45 kN (6.1.5.2)', C.designForce({ norma: '8800', N: 20 }).F === 45);
yes('D2. 8800: exceção (terça/travessa/tirante) mantém 20 kN', C.designForce({ norma: '8800', N: 20, excecao45: true }).F === 20);
yes('D4. 6.1.5.3: esbeltez comanda → 100 % de Nc,Rd (30 → 80 kN)', C.designForce({ norma: '8800', N: 30, esbeltezComanda: true, NcRdBarra: 80 }).F === 80);
yes('D5. NBR 14762 Tab. 16: A325 1" (25,4) = 825; M27 = 725', C.fub14762('ASTM A325', 25.4) === 825 && C.fub14762('ASTM A325', 27) === 725);
yes('D3. 14762: 40 kN com NRd 111 → 55,5 kN (10.1-a)', Math.abs(C.designForce({ norma: '14762', N: 40, NRdBarra: 111 }).F - 55.5) < 1e-9);

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
