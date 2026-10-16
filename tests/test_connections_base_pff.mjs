// test_connections_base_pff.mjs — base de pilar treliçado com pernas formadas a frio (js/design/connections_base_pff.js)
//   node tests/test_connections_base_pff.mjs
// Oráculo: Wanderson F. Maia, Especialização INBEC 2016, Mód. 6 "Perfis formados a frio III", p.95–117 (NBR 8800:2008):
//   placa 680 × 270, d = 520 (faces externas das pernas), a1 = 40, s = 50 cm, fck 20, A2 = A1, fy 250; C4: VA = −47,2,
//   VB = 36,7, HA = 10,5 kN → N = −10,5 kN, M = 2097,5 kN·cm, e = 199,8 cm (grande), fpd = 1,02 kN/cm² (2008), Y = 2,04 cm,
//   T = 38,6 kN, m = 9,3 cm, Mmax = 8,97 kN·cm/cm, t (concreto) = 1,26 cm, Ft = 19,3 kN, t (chumbador) = 1,39 cm.
//   Na 2024 (6.6.5: σc,Rd = 0,85·20/1,4 = 12,14 MPa) o equilíbrio dá Y = 1,715 cm e o MESMO T = 38,6 kN; chumbador db 12,5 (valor
//   das págs. 106–107): Ft,Rd = 27,3, Fv,Rd 2024 = 16,4 kN. C1: VA = 22,6, VB = −3,1 → N = 19,5, M = 642,5 kN·cm; o equilíbrio de
//   grande excentricidade dá T ≤ 0 → sem tração: Y = 3·(34 − 32,95) = 3,15 cm, fpd = 0,46 kN/cm² (correção do engenheiro de aço).
import { basePlacaUnica, basePerna, legWeld14762 } from '../js/design/connections_base_pff.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 0.005) => { n++; const e = Math.abs(got / exp - 1); if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(4)}`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const find = (r, re) => r.checks.find((x) => re.test(x.nome)) || { Rd: NaN, Sd: NaN };
const U = { bw: 200, bf: 100, t: 2.65 };
const W = (VA, VB, HA, fpd = null, db = 12.5) => basePlacaUnica({ s: 500, perna: U, placa: { H: 680, B: 270, tp: 16, fy: 250 }, nb: 4, db, a1: 40, dExt: 520,
  concreto: { fck: 20, A2A1: 1 }, VA, VB, H: HA, fpdOverride: fpd });
{ const r = W(-47.2, 36.7, 10.5, 10.2);
  ok('C4a. Wanderson (2008): Y = 2,04 cm', r.Y, 20.4, 0.005);
  ok('C4b. T = 38,6 kN', r.T, 38.6, 0.003);
  ok('C4c. m = (680 − 0,95·520)/2 = 93 mm', r.m, 93, 1e-9);
  ok('C4d. Mmax = 8,97 kN·cm/cm (= kN; ×1000 N·mm/mm)', r.Mmax / 1000, 8.97, 0.005);
  ok('C4e. t (lado do concreto) = 1,26 cm', r.t1, 12.6, 0.005);
  ok('C4f. Ft = 19,3 kN; t (lado dos chumbadores) = 1,39 cm', r.t2, 13.9, 0.005);
  ok('C4g. Ft,Rd (db 12,5; Abe 0,92) = 27,3 kN', find(r, /^Tração$/).Rd, 27.3, 0.005);
  ok('C4h. Fv,Rd 2024 (0,45) = 16,4 kN', find(r, /^Cisalhamento$/).Rd, 16.36, 0.003);
  ok('C4i. Fv,Sd = 10,5/4 = 2,6 kN', find(r, /^Cisalhamento$/).Sd, 2.625, 1e-9); }
{ const r = W(-47.2, 36.7, 10.5);           // 2024
  ok('C4-2024a. σc,Rd = 0,85·20/1,4 = 12,14 MPa → Y = 1,715 cm', r.Y, 17.15, 0.005);
  ok('C4-2024b. T = 38,6 kN (equilíbrio)', r.T, 38.6, 0.003);
  ok('C4-2024c. Mmax = 9,09 kN·cm/cm; t = 1,27 cm', r.t1, 12.7, 0.006); }
{ const r = W(22.6, -3.1, 3.4, 10.2);
  yes('C1a. N = 19,5 kN, M = 642,5 kN·cm, grande excentricidade, mas T ≤ 0 → sem tração', r.T === 0 && /sem tração/.test(r.regime), r.regime);
  ok('C1b. Y = 3·(H/2 − e) = 3,15 cm', r.Y, 31.5, 0.005);
  ok('C1c. fpd = 2N/(Y·B) = 0,46 kN/cm²', find(r, /Pressão de contato/).Sd / 10, 0.459, 0.005); }
// one plate per leg (6.7 by analogy, U as I of d = bw = 200, bf = 100): leg A of C4 in tension 47,2 kN + V 10,5 kN
{ const r = basePerna({ perna: U, nb: 4, db: 19, a2: 80, placa: { tp: 16, fy: 250 }, concreto: { fck: 20, A2A1: 1 }, N: -47.2, V: 10.5, NRdPerna: 0 });
  // hand: ℓx = 200 + 4·40 = 360; ℓy = 80 + 80 = 160; m = (360 − 190)/2 = 85; Ft = 47,2/4; tp,min = √(2·4·Ft·(m − a1)/(ℓy·fy/1,1))
  ok('P1. perna tracionada (T1): tp,min = √(2nb·Ft·(m − a1)/(ℓy·fy/γa1))', find(r, /Espessura da placa/).lim, Math.sqrt(2 * 4 * 11800 * 45 / (160 * 250 / 1.1)), 1e-9);
  yes('P2. tração + cortante → arruelas soldadas (6.7.2.5)', r.checks.some((c) => /Arruelas especiais/.test(c.nome)));
  yes('P3. aviso da analogia com a 6.7 (pilar I/H)', r.avisos.some((a) => /analogia/.test(a))); }
{ const c = legWeld14762({ perna: U, w: 2.65, N: -47.2, V: 10.5, NRdPerna: 120 });
  // hand: F = máx(47,2; 60) = 60 kN; L = 400 mm; t = 2,65 > 2,5 → normal ≤ 0,75·0,7·2,65·400·485/1,65 = 163,6 kN (governa) → 409 N/mm
  const k = c.find((x) => /Filete/.test(x.nome));
  ok('P4. solda da perna (10.2.3-c governa): 0,75·0,7w·fw/1,65 = 409 N/mm', Math.min(k.Rd * 1000, 1e9), Math.min(0.75 * 0.7 * 2.65 * 485 / 1.65, (1 - 0.01 * 200 / 2.65 > 0 ? 0.75 * 2.65 * 400 / 2.0 : 0)), 0.001);
  ok('P5. força = 50 % de NRd da perna (10.1-a) = 60 kN → 150 N/mm + V/bw', k.Sd * 1000, Math.hypot(60000 / 400, 10500 / 200), 1e-9); }
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
