// test_connections_base.mjs — base de pilar NBR 8800:2024 6.7 (js/design/connections_base.js)
//   node tests/test_connections_base.mjs
// Não há exemplo publicado do método da 2024 (LACUNA registrada pelo engenheiro de aço: Fakury 2017 cap. 11 é o
// antecessor e diverge). Oráculos: (1) conta de mão do engenheiro de aço para o caso C1 (d = bf = 200, tipo 1, 4 × ¾",
// a1 = 40, a2 = 150, NSd = 500 kN, fck 25, A2/A1 = 4 → tp,min 19,6 mm, VRd 166,7 kN); (2) conta de mão independente em
// Python das equações lidas nas imagens das p.102–108 (scratchpad lig/base_hand.py) para C2, C3, T1, T2, T3, arruelas
// soldadas (6.7.2.5) e placa de cisalhamento (6.7.2.4); (3) parâmetros que coincidem com o Fakury 11.12.1 (m, n, n0).
import { columnBase, sigmaCRd, tab18 } from '../js/design/connections_base.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 0.002) => { n++; const e = Math.abs(got / exp - 1); if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(3)}`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const find = (r, re) => r.checks.find((x) => re.test(x.nome)) || { lim: NaN, Rd: NaN, valor: NaN };
const base = (N, M, extra = {}) => columnBase({ pilar: { d: 200, bf: 200, tw: 8, tf: 12 }, tipo: 1, nb: 4, db: 19, a1: 40, a2: 150,
  placa: { fy: 250, tp: 25 }, concreto: { fck: 25, A2A1: 4 }, N, M, V: 50, ...extra });

yes('T0. Tabela 18: ¾" → a1 40, a2 80, h1 450, en 40, fck,min 20', tab18(19).a1 === 40 && tab18(19).a2 === 80 && tab18(19).h1 === 450 && tab18(19).en === 40 && tab18(19).fckmin === 20);
ok('S1. 6.6.5: σc,Rd = 0,85·25/1,4·√4 = 30,36 MPa', sigmaCRd(25, 4).v, 30.357, 1e-4);
ok('S2. 6.6.5: teto 1,7·fck/γc (A2/A1 = 9)', sigmaCRd(25, 9).v, 1.7 * 25 / 1.4, 1e-12);
{ const r = base(500, 0);
  yes('C1a. caso C1', r.caso === 'C1');
  ok('C1b. engenheiro de aço: tp,min = 19,6 mm', find(r, /Espessura da placa/).lim, 19.6, 0.003);
  ok('C1c. engenheiro de aço: VRd = 166,7 kN', find(r, /atrito/).Rd, 166.67, 0.001);
  ok('C1d. σc,Sd = 500 000/(360·230) = 6,04 MPa', find(r, /Tensão de contato/).Sd, 6.039, 0.001);
  yes('C1e. Fakury 11.12.1: m = 0,95-balanço, n = 0,80-balanço, n0 = √(d·bf)/4 — mesma definição', /m = \(ℓx − 0,95d\)\/2 = 85/.test(r.checks[0].eq) && /n0 = √\(d·bf\)\/4 = 50/.test(r.checks[0].eq)); }
{ const r = base(500, 20);
  yes('C2a. caso C2 (e = 40 ≤ 144,2 mm)', r.caso === 'C2');
  ok('C2b. tp,min = 22,218 mm (mão)', find(r, /Espessura da placa/).lim, 22.2179);
  ok('C2c. σc,Sd = N/(ℓc·ℓy) = 7,764 MPa', find(r, /Tensão de contato/).Sd, 7.76398);
  ok('C2d. VRd = 166,67 kN', find(r, /atrito/).Rd, 166.667); }
{ const r = base(100, 60);
  yes('C3a. caso C3 (e = 600 > 172,8 mm)', r.caso === 'C3');
  ok('C3b. Ft,Sd = 72,32 kN (mão)', r.Ft, 72.3218);
  ok('C3c. tp,min = máx(35,54; 22,32) = 35,54 mm', find(r, /Espessura da placa/).lim, 35.5426);
  ok('C3d. db,min = 20,36 mm', find(r, /Diâmetro do chumbador/).lim, 20.3562);
  yes('C3e. db = 19 < 20,36 → NÃO atende', find(r, /Diâmetro do chumbador/).ok === false);
  ok('C3f. VRd = μσc,Rd·ℓc·ℓy/γa2 = 81,55 kN', find(r, /atrito/).Rd, 81.5479); }
{ const r = base(-100, 0);
  yes('T1a. caso T1', r.caso === 'T1');
  ok('T1b. Ft = 25 kN; tp,min = 13,12 mm', find(r, /Espessura da placa/).lim, 13.1215);
  ok('T1c. db,min = 11,97 mm', find(r, /Diâmetro do chumbador/).lim, 11.9683);
  yes('T1d. sem dispositivo: VSd = 50 > VRd = 0 → NÃO (6.7.2.3)', find(r, /atrito/).ok === false); }
{ const r = base(-100, 10);
  yes('T2a. caso T2 (e = 100 ≤ a = 140)', r.caso === 'T2');
  ok('T2b. Ft = 100/4 + 10 000/(140·4) = 42,857 kN; tp,min = 17,18 mm', find(r, /Espessura da placa/).lim, 17.1801); }
{ const r = base(-50, 30);
  yes('T3a. caso T3 (e = 600 > a)', r.caso === 'T3');
  ok('T3b. Ft = 61,535 kN', r.Ft, 61.5349);
  ok('T3c. tp,min = máx(21,12; 20,59) = 21,12 mm', find(r, /Espessura da placa/).lim, 21.119); }
{ const r = base(100, 60, { cis: { tipo: 'arruelas', ta: 6.3 } });
  ok('W1. arruelas soldadas (6.7.2.5): 2 tracionadas VRd,i = 0 (tração esgota) + 2 × 12,712 kN', find(r, /Arruelas especiais/).Rd, 2 * 12.7119); }
{ const r = base(-100, 0, { V: 100, cis: { tipo: 'placa', bv: 100, bh: 150, en: 40, tpv: 25 } });
  ok('P1. placa de cisalhamento: VRd = σc,Rd(4)·(bv − en)·bh = 273,21 kN', find(r, /Placa de cisalhamento/).Rd, 273.214);
  ok('P2. tpv,min = 28,66 mm', find(r, /Espessura da placa de cisalhamento/).lim, 28.6589);
  yes('P3. tpv = 25 < 28,66 → NÃO', find(r, /Espessura da placa de cisalhamento/).ok === false); }
{ const r = columnBase({ pilar: { d: 300, bf: 200, tw: 8, tf: 12 }, tipo: 2, nb: 4, db: 19, a1: 30, a2: 100, placa: { fy: 250, tp: 25 }, concreto: { fck: 25, A2A1: 4 }, N: 100, M: 80, V: 0 });
  yes('K1. base tipo 2 em grande excentricidade → C3 não previsto (6.7.1.4)', r.caso === 'C3' && r.ok === false); }
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
