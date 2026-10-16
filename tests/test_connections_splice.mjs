// test_connections_splice.mjs — emenda com talas (js/design/connections_splice.js)
//   node tests/test_connections_splice.mjs
// Oráculos:
//  A) Fakury, Silva e Caldas 2017, 10.14.7 (p.310–319): PS 600×225×16×12,5 USI CIVIL 350, talas CH 12,5, A325 ¾";
//     NSd = 100 kN (compressão), MSd = 250 kN·m, VSd = 275 kN; mesa: 2 linhas a 115 mm, 5 parafusos por lado
//     (e = 40, s = 75), bordas 55, folga 10; alma: talas 380 × 12,5, 4 × 2 parafusos por lado (100 / 60), e = 75 mm.
//     Furo do livro dh + 2 = 22,5 mm (entrada dh = 20,5). Parafusos por atrito no livro — não são oráculo (fórmula 2024).
//  B) Pfeil 9ª ed., problema 3.5.1: chapas 204 × 12,7 A36, 2 talas 9,5, A307 7/8" (Ab 3,88 cm²), 3 linhas × 2 por lado,
//     Nd = 430 kN; furo do livro 22,2 + 1,5 = 23,7 (+ 2 na área líquida); ℓf do furo externo 39,3 mm.
import { spliceConnection } from '../js/design/connections_splice.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 0.005) => { n++; const e = Math.abs(got / exp - 1); if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(3)}`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const find = (r, gre, re) => { const c = r.checks.find((x) => gre.test(x.g) && re.test(x.nome)); if (!c) console.log(`  (sem ${gre} / ${re})`); return c || { Rd: NaN, Sd: NaN }; };

{ const r = spliceConnection({ tipo: 'perfilI', folga: 10, N: -100, M: 250, V: 275,
    perfil: { d: 600, bf: 225, tf: 16, tw: 12.5, fy: 350, fu: 500 },
    talaMesa: { t: 12.5, fy: 350, fu: 500 }, talaAlma: { h: 380, t: 12.5, fy: 350, fu: 500 },
    parMesa: { grade: 'ASTM F3125 A325', db: 19.05, dh: 20.5, rosca: false, linhas: 2, ncol: 5, s: 75, g: 115, e1: 40, et: 40, e2: 55 },
    parAlma: { grade: 'ASTM F3125 A325', db: 19.05, dh: 20.5, rosca: false, nr: 4, nc: 2, sv: 100, sh: 60, e1w: 40, ev: 40, et: 40 } });
  ok('A1. Fakury: Nt,Sd na tala inferior = 25 000/58,4 − 100/2 = 378,1 kN', r.geo.Ft, 378.1, 0.001);
  ok('A2. Fakury: Nc,Sd na tala superior = 478,1 kN', r.geo.Fc, 478.1, 0.001);
  ok('A3. Fakury: tração na tala (Ae = 22,51 cm²) = 833,7 kN', find(r, /Mesa tracionada — talas/, /Tração nas talas/).Rd, 833.7, 0.002);
  ok('A4. Fakury: rasgamento da tala, perímetro 1 = 1 750 kN', find(r, /Mesa tracionada — colapso/, /talas: perímetro 1/).Rd, 1750, 0.002);
  ok('A5. Fakury: rasgamento da tala, perímetro 2 (Cts 0,5) = 1 525 kN', find(r, /Mesa tracionada — colapso/, /talas: perímetro 2/).Rd, 1525, 0.002);
  ok('A6. Fakury: tala comprimida (K 0,65, L 9 cm) = 877,1 kN', find(r, /Mesa comprimida — talas/, /Compressão nas talas/).Rd, 877.1, 0.005);
  ok('A7. Fakury: cisalhamento da alma (Agv 71, Anv 59,75 cm²) = 1 328 kN', find(r, /^Alma$/, /Cisalhamento da alma/).Rd, 1328, 0.002);
  ok('A8. Fakury: cisalhamento das talas da alma = 2 × 805,6 kN', find(r, /^Alma$/, /Cisalhamento das 2 talas/).Rd, 2 * 805.6, 0.002);
  ok('A9. Fakury: rasgamento da tala da alma, perímetro 1 = 814,4 kN', find(r, /^Alma$/, /Colapso por rasgamento de cada tala/).Rd, 814.4, 0.002);
  ok('A10. Fakury: MSd por tala = 7,5 cm · 137,5 kN = 10,31 kN·m', find(r, /^Alma$/, /escoamento/).Sd, 0.075 * 137.5, 1e-9);
  ok('A11. Fakury: ruptura fu·Zef/γa2 (Zef = 338,8 cm³) = 125,48 kN·m', find(r, /^Alma$/, /ruptura na linha/).Rd, 125.48, 0.002); }
{ const r = spliceConnection({ tipo: 'chapa', folga: 10, N: 430,
    membro: { b: 204, t: 12.7, fy: 250, fu: 400 }, talas: { n: 2, b: 204, t: 9.5, fy: 250, fu: 400 },
    par: { grade: 'ASTM A307', db: 22.23, dh: 23.7, linhas: 3, ncol: 2, s: 76, g: 64, e1: 39.3 + 23.7 / 2, et: 51.15, e2: 38 } });
  ok('B1. Pfeil 3.5.1: corte duplo 2024 (0,45): 12 × 53,7 = 644 kN → por plano', find(r, /parafusos/, /Cisalhamento/).Rd * 12, 0.45 * 388.1 * 415 / 1.35 / 1000 * 12, 0.001);
  ok('B2. Pfeil: Fv,Sd = 430/12 = 35,83 kN', find(r, /parafusos/, /Cisalhamento/).Sd, 430 / 12, 1e-9);
  // o livro arredonda d = 2,2 cm no teto (2,4·2,2·1,27·40/1,35 = 198,7) mas usa Ab = 3,88 cm² (d = 22,23) no corte;
  // aqui um único d = 22,23: furo externo 177,5 (livro, ℓf = 39,3) + teto 2,4·22,23·12,7·400/1,35 = 200,8
  ok('B3. Pfeil: contato na chapa 3·177,5 + 3·200,8 (teto com d = 22,23)', find(r, /pressão de contato/, /peça emendada/).Rd, 3 * 177.5 + 3 * 2.4 * 22.23 * 12.7 * 400 / 1.35 / 1000, 0.002);
  ok('B4. Pfeil: ruptura da seção líquida (16,12 cm²) = 477,6 kN', find(r, /peça emendada$/, /Tração na peça/).Rd, 477.6, 0.002);
  yes('B5. talas: Ae = mín(An; 0,85Ag) (6.5.3)', /0,85Ag/.test(find(r, /talas$/, /Tração nas talas/).eq)); }
{ const r = spliceConnection({ tipo: 'chapa', N: 20, membro: { b: 100, t: 8, fy: 250, fu: 400 }, talas: { n: 2, b: 100, t: 6.3, fy: 250, fu: 400 },
    par: { grade: 'ISO 898-1 classe 8.8', db: 16, linhas: 1, ncol: 2, s: 50, e1: 30, et: 30, e2: 50 } });
  yes('C1. mínimo de 45 kN (6.1.5.2)', /→ 45 kN/.test(r.checks[0].eq)); }
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
