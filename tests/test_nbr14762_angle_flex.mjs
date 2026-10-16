// test_nbr14762_angle_flex.mjs — flexão de cantoneira de abas iguais formada a frio (NBR 14762:2010), eixos principais
//   node tests/test_nbr14762_angle_flex.mjs
// Oráculo: cálculo manual do engenheiro de aço (16/10/2026), independente do código — L 60x2,25 (NBR 6355 Tab. A.1:
// I1 = 15,29; I2 = 3,66 cm⁴; A = 2,62 cm²; xg = 1,60 cm), J = (2B − t)t³/3 = 0,04471 cm⁴ (linha média), E = 20 000,
// G = 7 700, fy = 25 kN/cm², L = 160 cm, Cb = Cm = 1:
//   M1 (eixo de simetria, 9.8.2.2): Ney = π²E·I2/L² = 28,22 kN; Me1 = Cb·√(Ney·G·J) = 98,57 kN·cm (r0 cancela);
//     W1 = I1/(B/√2) = 15,29/4,243 = 3,604 cm³ → λ0 = √(3,604·25/98,57) = 0,956 → χFLT = 1,11(1 − 0,278λ0²) = 0,828
//   M2 (⊥ à simetria, Anexo E): Nex = π²E·I1/L² = 117,90 kN; j = a/√2 = (6 − 0,1125)/√2 = 4,163 cm;
//     √(j² + GJ/Nex) = √(17,331 + 2,920) = 4,500;  Cs = −1 (pontas comprimidas): Me2 = 117,90·(4,500 − 4,163) = 39,7;
//     Cs = +1 (quina comprimida): Me2 = 117,90·(4,163 + 4,500) = 1021 kN·cm
//     W2,ponta = I2/[(B + t)/√2 − √2·xg] = 3,66/2,141 = 1,710 → λ0 = √(1,710·25/39,7) = 1,037 → χFLT = 0,778
//   Seção efetiva (revisor-calculo-nbr, verificador independente de parede fina com a seção efetiva ASSIMÉTRICA — produto
//   de inércia Iuv′ — e flexão oblíqua, 16/10/2026; Δ ≈ 1 % pelo I bruto de parede fina × catálogo → tolerância 2 %):
//     M1: Wef(escoamento) = 1,078 cm³ → MRd,esc = 24,51 kN·cm; Wc,ef(χ·fy = 20,7) = 1,364 cm³ → MRd,FLT = 25,67 → M1Rd = 24,51
//     M2 pontas: Wef = 0,966; Wc,ef = 1,225 cm³ (Iuv′ = 0: as duas pontas perdem a mesma faixa) → M2Rd ≈ 21,6 kN·cm
//   Interação só com Mz = 20 kN·cm: |M1| = |M2| = 14,14 → 14,14/24,51 + 14,14/21,69 = 1,229 (a versão sem Iuv′ dava 0,97,
//   contra a segurança)
import { nbr14762 } from '../js/design/codes/nbr14762.js';
import { cfSection } from '../js/design/profiles_cf.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol) => { n++; const d = (got - exp) / Math.abs(exp); if (!(Math.abs(d) <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (Δ ${(d * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(4)} (Δ ${(d * 100).toFixed(2)} %)`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const sec = { ...cfSection('L 60x2,25'), coldFormed: true };
const mat = { Fy: 250e3, Fu: 400e3, E: 2e8, G: 7.7e7 };
const run = (demands) => nbr14762.check({ demands, mat, sec, member: { L: 1.6, Lx: 1.6, Ly: 1.6, Lz: 1.6, Cb: 1 } });
const r = run({ Mz: 0.2 });
const x = r.flexaoX, y = r.flexaoY;
ok('A1. Me1 = Cb·√(Ney·G·J) (kN·cm)', x.Me * 100, 98.57, 0.002);
ok('A2. λ0 (M1)', x.lambda0, 0.956, 0.002);
ok('A3. χFLT (M1)', x.chiFLT, 0.828, 0.002);
ok('A4. Me2 Anexo E, pontas comprimidas, Cs = −1 (kN·cm)', y.Me * 100, 39.7, 0.005);
ok('A5. j = a/√2 (cm)', y.j * 100, 4.163, 0.001);
ok('A6. λ0 (M2, pontas)', y.lambda0, 1.037, 0.003);
ok('A7. χFLT (M2, pontas)', y.chiFLT, 0.778, 0.003);
ok('A8. M2Rd pontas comprimidas = 21,6 kN·cm', y.capacity * 100, 21.6, 0.02);
ok('A8b. Wef M2 pontas (escoamento) = 0,966 cm³', y.Wef * 1e6, 0.966, 0.02);
ok('A8c. Wc,ef M2 pontas = 1,225 cm³', y.WcEf * 1e6, 1.225, 0.02);
ok('A9. M1Rd = 24,51 kN·cm (escoamento, seção efetiva assimétrica)', x.capacity * 100, 24.51, 0.02);
ok('A9b. Wef M1 (escoamento) = 1,078 cm³', x.Wef * 1e6, 1.078, 0.02);
ok('A9c. Wc,ef M1 (χ·fy) = 1,364 cm³', x.WcEf * 1e6, 1.364, 0.02);
ok('A10. |M1| = |M2| = Mz/√2 (kN·cm)', x.demand * 100, 20 / Math.SQRT2, 1e-6);
ok('A11. interação 9.9 só com Mz = 20 kN·cm = 1,229', r.interaction.ratio, 1.229, 0.02);
yes('A12. governa M2 com as pontas comprimidas (caso crítico)', /pontas/.test(y.eixo), y.eixo);
// quina comprimida: Me2 = 1021 kN·cm (Cs = +1) — testado com My e Mz que levam |M2| ao sentido da quina: aqui pela
// simetria do enunciado, o código guarda os dois sentidos; checa-se o Me da quina reconstruído pela fórmula
{ const Nex = Math.PI ** 2 * 20000 * 15.29 / 160 ** 2, j = (6 - 0.1125) / Math.SQRT2, GJ = 7700 * 0.04471;
  ok('A13. Me2 quina comprimida, Cs = +1 (fórmula, controle do oráculo)', Nex * (j + Math.sqrt(j * j + GJ / Nex)), 1021, 0.002); }
// robustez: My sozinho → mesmo resultado que Mz sozinho (simetria da L de abas iguais em relação ao eixo 1)
{ const rY = run({ My: 0.2 }); ok('A14. My = 0,2 ≡ Mz = 0,2 (simetria)', rY.interaction.ratio, r.interaction.ratio, 1e-9); }
// N + M (9.9): N/NRd + M1/M1Rd + M2/M2Rd
{ const rn = run({ N: -5, Mz: 0.1 }), NRd = rn.axial.capacity;
  ok('A15. 9.9 = N/NRd + M1/M1Rd + M2/M2Rd', rn.interaction99.ratio, 5 / NRd + (0.1 / Math.SQRT2) / x.capacity + (0.1 / Math.SQRT2) / y.capacity, 1e-3); }
// cortante na aba (decisão do Manoel 16/10/2026): NBR 8800:2024 5.4.3.4 como referência externa — kv = 1,2, h = b,
// Aw = b·t por cantoneira. L 60x2,25, fy = 25: b/t = 6/0,225 = 26,67; λp = 1,10·√(1,2·20000/25) = 34,08 → plastificação;
// Vpl = 0,60·6·0,225·25 = 20,25 kN → VRd = 20,25/1,10 = 18,409 kN
{ const rv = run({ Mz: 0.1, Vy: 1, Vz: 2 });
  ok('A16. VRd da aba (NBR 8800 5.4.3.4) = 18,409 kN', rv.corteY.capacity, 20.25 / 1.10, 1e-6);
  ok('A16b. Vz na aba horizontal, mesma resistência', rv.corteZ.capacity, 20.25 / 1.10, 1e-6);
  yes('A16c. aviso da referência externa', rv.avisos.some(a => /5\.4\.3\.4/.test(a))); }
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
