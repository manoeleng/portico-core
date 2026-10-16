// test_connections_rigid.mjs — LMSS (viga–pilar rígida soldada) e emenda soldada (js/design/connections_rigid.js)
//   node tests/test_connections_rigid.mjs
// Oráculos:
//  (1) Manual Gerdau "Ligações para estruturas de aço" (NBR 8800:2024), LMSS p.130–133: W 250×32,7 → Md = 136 kN·m
//      (Z·fy/γa1, A572-50) — mesas com penetração total dispensadas da verificação (7.4).
//  (2) conta de mão independente (scratchpad lig/lmss_hand.py): viga W250×32,7 em pilar W310×97 (r = 0 adotado), M = 100
//      kN·m: Ff = 401,77 kN; 5.7.2 = 464,89; 5.7.3 = 294,07 (não atende → enrijecedores); 5.7.4 = 637,07; painel (5.4.3.1,
//      λ = 28 ≤ λp = 61,2) VRd = 573,80 kN.
//  (3) emenda soldada: conta de mão (divisão por rigidez Mf = M·If/I — Saulo Almeida, INBEC Mód. 13; Tab. 9 da 2024).
import { lmssConnection, weldedSplice, webShear } from '../js/design/connections_rigid.js';
import { profileToSection } from '../js/design/profiles.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 0.002) => { n++; const e = Math.abs(got / exp - 1); if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(3)}`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const find = (r, re) => r.checks.find((x) => re.test(x.nome)) || { Rd: NaN, Sd: NaN };
const s250 = profileToSection('W 250 x 32,7').design;
const beam = { d: 258, bf: 146, tf: 9.1, tw: 6.1, fy: 345, fu: 450, Zx: s250.Zz * 1e9 };
const col = { d: 308, bf: 305, tf: 15.4, tw: 9.9, r: 0, fy: 345, fu: 450 };
// catálogo atual Z = 428,5 cm³; o manual usou 433,6 (diferença de catálogo, não de fórmula) → tolerância 1,5 %
ok('L1. Gerdau LMSS W250×32,7: Md = Z·fy/γa1 = 136 kN·m', find(lmssConnection({ viga: beam, pilar: col, M: 100, V: 50 }), /Momento da viga/).Rd, 136, 0.015);
{ const r = lmssConnection({ viga: beam, pilar: col, M: 100, V: 50 });
  ok('L2. Ff = M/(d − tf) = 401,77 kN', r.Ff, 401.768);
  ok('L3. 5.7.2 flexão local da mesa = 464,89 kN', find(r, /Flexão local da mesa/).Rd, 464.888);
  ok('L4. 5.7.3 escoamento local da alma = 294,07 kN', find(r, /Escoamento local da alma/).Rd, 294.075);
  ok('L5. 5.7.4 enrugamento = 637,07 kN', find(r, /Enrugamento/).Rd, 637.075);
  ok('L6. 5.7.7 painel: VRd = 573,80 kN (λ = 28 ≤ λp)', webShear(308, 308 - 2 * 15.4, 9.9, 345).V / 1000, 573.804);
  yes('L7. 5.7.3 não atende → enrijecedores 50 × 4,75 (bs ≥ bf/3 − tw/2; ts ≥ tf/2; tração e contato para Ff − FRd = 107,7 kN)', r.enrijecedores && r.enrijecedores.bs === 50 && r.enrijecedores.ts === 4.75, JSON.stringify(r.enrijecedores));
  yes('L8. com os enrijecedores a ligação atende', r.ok, r.governa?.nome); }
{ const r = lmssConnection({ viga: beam, pilar: col, M: 100, V: 50, extremidade: true });
  ok('L9. topo do pilar: 5.7.2 × 0,5 e 5.7.3 com 2,5k', find(r, /Flexão local da mesa/).Rd, 464.888 / 2); }
{ // 5.7.7.1: column shear summed ALGEBRAICALLY (revisão): +50 kN (same sense) adds, −50 kN reduces
  const pz = (Vcol) => lmssConnection({ viga: beam, pilar: col, M: 100, V: 50, Vcol }).checks.find((x) => /painel de alma/.test(x.nome)).Sd;
  ok('L10. painel: FSd = Ff + Vpilar (mesmo sentido) = 451,77 kN', pz(50), 401.768 + 50);
  ok('L11. painel: FSd = Ff − Vpilar (sentido oposto) = 351,77 kN', pz(-50), 401.768 - 50); }
// welded splice: W 250×32,7 (d 258, bf 146, tf 9,1, tw 6,1), M = 60 kN·m, N = 50 kN, V = 40 kN, fy 345
{ const P = { d: 258, bf: 146, tf: 9.1, tw: 6.1, fy: 345, fu: 450 }, hw = 258 - 18.2, Af = 146 * 9.1, Aw = hw * 6.1, A = 2 * Af + Aw;
  const If = 2 * (146 * 9.1 ** 3 / 12 + Af * (248.9 / 2) ** 2), Iw = 6.1 * hw ** 3 / 12, I = If + Iw;
  const Ff = 60e6 * If / I / 248.9 + 50e3 * Af / A;
  const r = weldedSplice({ perfil: P, N: 50, M: 60, V: 40 });
  ok('W1. emenda soldada: força na mesa = M·If/I/(d − tf) + N·Af/A (conta de mão)', find(r, /Mesas: penetração total/).Sd, Ff / 1000, 1e-9);
  ok('W2. mesa CJP: Af·fy/γa1', find(r, /Mesas: penetração total/).Rd, Af * 345 / 1.1 / 1000, 1e-9);
  ok('W3. alma: σ = N·Aw/A/Aw + M·Iw/I/(tw·hw²/6)', find(r, /tensão normal/).Sd, 50e3 / A + 60e6 * Iw / I / (6.1 * hw * hw / 6), 1e-9);
  ok('W4. alma: cisalhamento 0,6·hw·tw·fy/γa1', find(r, /cisalhamento/).Rd, 0.6 * Aw * 345 / 1.1 / 1000, 1e-9);
  yes('W5. penetração parcial com momento → NÃO (6.2.6.1)', !weldedSplice({ perfil: P, N: 50, M: 60, V: 40, penetracao: 'parcial', garganta: 6 }).ok);
  yes('W6. penetração parcial só com força axial e garganta ≥ Tab. 10 → verificada', weldedSplice({ perfil: P, N: 50, M: 0, V: 10, penetracao: 'parcial', garganta: 6 }).ok); }
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
