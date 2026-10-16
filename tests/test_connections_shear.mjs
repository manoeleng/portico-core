// test_connections_shear.mjs — ligação flexível viga–pilar (js/design/connections_shear.js)
//   node tests/test_connections_shear.mjs
// Oráculos:
//  A) Fakury, Silva e Caldas 2017, 10.14.8.2 (p.321–324): W 410×67 (tw 8,8; d 410; A572-50 fy 345 fu 450) na mesa de
//     W 310×97 (tf 15,4); 2L 102×102×9,5 A36; A325 ¾" com rosca; 4 parafusos s = 75, ev = 40, eh = 37; V = 400 kN;
//     excentricidade desprezada (livro). Fórmulas inalteradas na 2024 conferidas com as áreas do livro (dh 22,5) e,
//     onde a 2024 mudou (Fv,Rd 0,45; fub 830; furo ¾" = 20,64 + 2), refeitas à mão.
//  B) chapa simples — conta de mão independente (método elástico, Fakury 10.14.5; flexão Fakury 10.12.5; solda Tab. 9).
import { shearConnection, plateZnet } from '../js/design/connections_shear.js';
import * as C from '../js/design/connections.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 0.005) => { n++; const e = Math.abs(got / exp - 1); if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(3)}`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const find = (r, re) => { const c = r.checks.find((x) => re.test(x.nome)); if (!c) console.log(`  (sem ${re}: ${r.checks.map((x) => x.nome).join(' | ')})`); return c || { Rd: NaN, Sd: NaN }; };
const dh = C.holeStd8800(19.05), dn = dh + 2;

const fak = (exc) => shearConnection({ tipo: 'cantoneira', V: 400, viga: { tw: 8.8, d: 410, fy: 345, fu: 450 },
  cant: { b: 101.6, b2: 101.6, t: 9.5, fy: 250, fu: 400, ev: 40, eh: 37, a: 65, gc: 65 }, pilar: { t: 15.4, fu: 450 },
  par: { grade: 'ASTM F3125 A325', db: 19.05, n: 4, s: 75, rosca: true }, opts: { excentricidade: exc } });
{ const r = fak(false);
  yes('A1. norma NBR 8800', r.norma === '8800');
  const v = find(r, /^Cisalhamento \(corte duplo\)/);
  ok('A2. Fakury: Fv,Sd = 400/4/2 = 50 kN', v.Sd, 50, 1e-9);
  ok('A3. Fv,Rd A325 ¾" rosca (2024: 0,45; fub 830) = 78,9 kN', v.Rd, 0.45 * Math.PI * 19.05 ** 2 / 4 * 830 / 1.35 / 1000, 1e-9);
  ok('A4. Fakury: contato na alma (teto 2,4·d·t·fu) = 133,8 kN', find(r, /alma da viga$/).Rd, 133.8, 0.003);
  ok('A5. contato nas cantoneiras, ℓf 2024 = 40 − 20,64/2 (livro: 28,75 → 97,28 por cantoneira)', find(r, /cantoneiras \(2t\)/).Rd, 1.2 * (40 - dh / 2) * 19 * 400 / 1.35 / 1000, 1e-9);
  ok('A6. Fakury: cisalhamento das cantoneiras 2 × 363,2 (furo 2024)', find(r, /Cisalhamento das 2 cantoneiras/).Rd, Math.min(0.6 * 250 * 5795 / 1.1, 0.6 * 400 * 2 * (305 - 4 * dn) * 9.5 / 1.35) / 1000, 1e-9);
  ok('A7. ≈ livro 2 × 363,2 kN', find(r, /Cisalhamento das 2 cantoneiras/).Rd, 2 * 363.2, 0.005);
  ok('A8. Fakury: rasgamento das cantoneiras ≈ 2 × 352,4 kN', find(r, /Colapso por rasgamento das 2/).Rd, 2 * 352.4, 0.006);
  ok('A9. Fakury: cisalhamento da alma da viga ≈ 563,2 kN', find(r, /alma da viga na ligação/).Rd, 563.2, 0.004);
  yes('A10. atende', r.ok, r.governa?.nome); }
{ const r = fak(true);
  // hand: M = 400·65 = 26 000 kN·mm; Σy² = 2·(37,5² + 112,5²) = 28 125; top bolt fh = 26 000·112,5/28 125 = 104, fv = 100
  ok('A11. com excentricidade: resultante = √(104² + 100²) = 144,3 kN (2 planos → 72,1)', find(r, /^Cisalhamento \(corte duplo\)/).Sd, Math.hypot(104, 100) / 2, 1e-9); }

// ---------------- B) chapa simples, conta de mão
{ const r = shearConnection({ tipo: 'chapa', V: 150, viga: { tw: 8, fy: 345, fu: 450 },
    chapa: { t: 9.5, fy: 250, fu: 400, ev: 40, eh: 40, a: 75, ebv: 40 }, solda: { dw: 6, eletrodo: 'E70' }, pilar: { t: 12 },
    par: { grade: 'ISO 898-1 classe 8.8', db: 20, n: 3, s: 75, rosca: true } });
  ok('B1. elástico: Σy² = 11 250; topo fh = 150·75·75/11 250 = 75, fv = 50 → 90,14 kN', find(r, /grupo excêntrico/).Sd, Math.hypot(75, 50), 1e-9);
  ok('B2. cisalhamento da chapa hp = 230: mín(0,6·250·2185/1,1; 0,6·400·(230 − 3·24)·9,5/1,35)', find(r, /Cisalhamento da chapa/).Rd, Math.min(0.6 * 250 * 2185 / 1.1, 0.6 * 400 * 158 * 9.5 / 1.35) / 1000, 1e-9);
  ok('B3. bloco: Agv 1805, Anv 1805 − 2,5·24·9,5, Ant (40 − 12)·9,5', find(r, /rasgamento da chapa/).Rd, Math.min((0.6 * 400 * (1805 - 570) + 400 * 266) / 1.35, (0.6 * 250 * 1805 + 400 * 266) / 1.35) / 1000, 1e-9);
  ok('B4. flexão: M = 11,25 kN·m; Z = 9,5·230²/4 → MRd = 125 637,5·250/1,1', find(r, /escoamento \(seção bruta\)/).Rd, 9.5 * 230 ** 2 / 4 * 250 / 1.1 / 1e6, 1e-9);
  // Zef by hand: holes y = −75, 0, 75 (24 mm): removes 9,5·(2·∫63..87 y dy + 2·∫0..12 y dy) = 9,5·(2·1800 + 144) = 35 568
  ok('B5. Zef = 125 637,5 − 35 568 = 90 069,5 mm³', plateZnet(9.5, 230, 24, [-75, 0, 75]), 125637.5 - 35568, 1e-9);
  ok('B6. solda: f = √(326,1² + 637,9²) N/mm vs 0,6·0,707·6·485/1,35', find(r, /Filetes \(2 × hp\)/).Sd, Math.hypot(150000 / 460, 3 * 11.25e6 / 230 ** 2) / 1000, 1e-9);
  ok('B7. resistência do filete 6 mm E70 = 0,9144 kN/mm', find(r, /Filetes \(2 × hp\)/).Rd, 0.6 * 0.707 * 6 * 485 / 1.35 / 1000, 1e-9);
  yes('B8. mínimo 45 kN: V = 20 → 45', shearConnection({ tipo: 'chapa', V: 20, viga: { tw: 8, fy: 345, fu: 450 }, chapa: { t: 9.5, fy: 250, fu: 400, ev: 40, eh: 40, a: 75 }, solda: { dw: 6 }, par: { grade: 'ISO 898-1 classe 8.8', db: 20, n: 3, s: 75 } }).V === 45); }
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
