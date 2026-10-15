// test_nbr7190.mjs — NBR 7190-1:2022 (madeira) — BR-7190-01
//   node tests/test_nbr7190.mjs
// Oráculos: Dias, Calil Jr, Lahr, Martins (2019), Estruturas de Madeira (Elsevier), Cap. 4.6 — livro
// posterior à revisão da norma. Onde o livro difere da 2022 publicada (kM = 0,5 do texto de 2018;
// módulos das classes da 1997), o dado do livro é passado como ENTRADA explícita (kM, E0,05) e o
// esperado é o do livro; o valor com kM = 0,7 da 2022 vem de recálculo manual registrado.
import { nbr7190, timberClass7190 } from '../js/design/codes/nbr7190.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
const MPa = 1000, mm = 1e-3;
const rect = (b, h) => ({ shape: 'rect', b: b * mm, h: h * mm });

// (1) Tabela 3 da 2022 (p.12): C24 e D30
{
  const c = timberClass7190('C24'), d = timberClass7190('D30'), n = timberClass7190('Tab2:D30');
  ok('1a. C24 fc0,k = 21 MPa', c.fc0k, 21 * MPa, 1e-12);
  ok('1b. C24 E0,05 = 7,4 GPa', c.E005, 7400 * MPa, 1e-12);
  ok('1c. D30 (Tab. 3) fb,k = 30 MPa', d.fbk, 30 * MPa, 1e-12);
  ok('1d. D30 nativa (Tab. 2) E0,med = 12 000 MPa', n.E0med, 12000 * MPa, 1e-12);
}
// (2) Dias Ex.3 — compressão centrada com instabilidade: 100×200, L = 3,5 m, biarticulado, fc0,k = 30,
//     E0,05 = 10 150 MPa (dado do livro), kmod = 0,7·1,0. Esperado: λy = 121, λrel = 2,10, kcy = 0,206,
//     Nd,máx = 61 800 N (o texto imprime 61.080 por erro tipográfico; 0,206·15·20 000 = 61 800).
{
  const mat = { fc0k: 30 * MPa, ft0k: 30 * MPa, fbk: 30 * MPa, fvk: 5 * MPa, E0med: 14500 * MPa, E005: 10150 * MPa };
  const r = nbr7190.check({ demands: { N: -61.8 }, mat, sec: rect(100, 200), member: { L: 3.5, KE: 1 }, options: { kmod1: 0.7, kmod2: 1.0 } });
  ok('2a. fc0,d = 15 MPa', r.fc0d / MPa, 15, 1e-9);
  ok('2b. λy = 121', r.estab.lambdaY, 121, 0.003);
  ok('2c. λrel,y = 2,10', r.estab.lambdaRelY, 2.10, 0.005);
  ok('2d. kcy = 0,206', r.estab.kcy, 0.206, 0.005);
  ok('2e. Nd = 61,8 kN esgota a peça (índice = 1)', r.interaction.ratio, 1.0, 0.005);
}
// (3) Dias Ex.1 — flexão reta (ELU coerente com a 2022): D60 nativa (fc0,k = fm = 60, fv0,k = 8),
//     50×200, Md = 8,5 kN·m, Vd = 8,809 kN, kmod = 0,7·0,9. Esperado: fm,d = 27 MPa, σMd = 25,50 MPa,
//     fv0,d = 2,8 MPa, τd = 1,32 MPa.
{
  const r = nbr7190.check({ demands: { Mz: 8.5, Vy: 8.809 }, mat: { classe7190: 'Tab2:D60' }, sec: rect(50, 200),
    member: { L: 3.86, L1: 0.6 }, options: { kmod1: 0.7, kmod2: 0.9 } });
  ok('3a. fm,d = 27 MPa', r.fmd / MPa, 27, 0.001);
  ok('3b. σMd/fm,d = 25,50/27', r.bending.ratio, 25.5 / 27, 0.003);
  ok('3c. fv0,d = 2,8 MPa', r.fvd / MPa, 2.8, 0.001);
  ok('3d. τd = 1,32 MPa', r.shear.demand / MPa, 1.32, 0.005);
}
// (4) Dias Ex.2 — flexão oblíqua: D40 nativa (fc0,k = 40), 60×120, Mxd = 1,775 kN·m, Myd = 0,476 kN·m,
//     kmod = 0,9·0,9 → fm,d = 23,1 MPa. Livro (kM = 0,5): índices 0,68 e 0,55 → máx. 0,68 (recálculo 0,675).
//     2022 (kM = 0,7, 6.3.5): recálculo manual 0,733 (σMx = 12,33; σMy = 6,61 MPa; 12,33/23,14 + 0,7·6,61/23,14).
{
  const base = { demands: { Mz: 1.775, My: 0.476 }, mat: { classe7190: 'Tab2:D40' }, sec: rect(60, 120), member: { L: 3, L1: 0.3 } };
  const r05 = nbr7190.check({ ...base, options: { kmod1: 0.9, kmod2: 0.9, kM: 0.5 } });
  const r07 = nbr7190.check({ ...base, options: { kmod1: 0.9, kmod2: 0.9 } });
  ok('4a. índice com kM = 0,5 (livro 0,68)', r05.bending.ratio, 0.675, 0.01);
  ok('4b. índice com kM = 0,7 da 2022 (recálculo 0,733)', r07.bending.ratio, 0.733, 0.005);
}
// (5) Dias Ex.4 — flexo-compressão com instabilidade, kM = 0,5 do livro: mesmos dados do Ex.3,
//     excentricidades ey = 50 mm (Mx) e ex = 25 mm (My). Livro: Pd,máx = 42 228 N.
{
  const mat = { fc0k: 30 * MPa, ft0k: 30 * MPa, fbk: 30 * MPa, fvk: 5 * MPa, E0med: 14500 * MPa, E005: 10150 * MPa };
  const Pd = 42.228;
  const r = nbr7190.check({ demands: { N: -Pd, Mz: Pd * 0.05, My: Pd * 0.025 }, mat, sec: rect(100, 200),
    member: { L: 3.5, KE: 1, L1: 0.1 }, options: { kmod1: 0.7, kmod2: 1.0, kM: 0.5 } });
  ok('5a. Pd = 42,228 kN esgota a peça (índice = 1)', r.interaction.ratio, 1.0, 0.005);
}
// (6) Robustez: sem classe → não verificado; λ > 140 → não permitido
{
  const r = nbr7190.check({ demands: { N: -1 }, mat: {}, sec: rect(50, 100), member: { L: 2 } });
  assert('6a. sem classe NBR 7190 → NÃO verificado', r.ratioMax === Infinity);
  const s = nbr7190.check({ demands: { N: -1 }, mat: { classe7190: 'C24' }, sec: rect(50, 100), member: { L: 3, KE: 1 }, options: { kmod1: 0.7, kmod2: 0.9 } });
  assert('6b. λ = 208 > 140 → NÃO atende', s.ratioMax === Infinity, String(s.estab.lambdaY));
}

// (7) Revisão do especialista: cortante biaxial resultante, NaN, tração L0 > 50b, Ex.4 com kM = 0,7
{
  const base = { mat: { classe7190: 'C24' }, options: { kmod1: 0.7, kmod2: 0.9 } };
  const v = nbr7190.check({ ...base, demands: { Vy: 10, Vz: 10 }, sec: rect(100, 200), member: { L: 2, L1: 0.1 } });
  ok('7a. τd com Vd = √(Vy² + Vz²): 1,5·14,142/0,02 = 1060,7 kN/m²', v.shear.demand, 1060.66, 0.001);
  const nan = nbr7190.check({ demands: { Mz: 2 }, mat: { fc0k: 30e3, fvk: 5e3, E005: 7e6 }, sec: rect(100, 200), member: { L: 3 }, options: { kmod1: 0.7, kmod2: 0.9 } });
  assert('7b. valores explícitos incompletos (sem E0med/ft0k/fbk) → NÃO verificado (nunca NaN)', nan.ratioMax === Infinity);
  const tr = nbr7190.check({ ...base, demands: { N: 5 }, sec: rect(50, 100), member: { L: 3 } });
  assert('7c. tração com L0 = 3 m > 50 × 5 cm (9.3) → NÃO atende', tr.ratioMax === Infinity);
  // Ex.4 com kM = 0,7 da 2022 (recálculo do revisor): o Pd do livro dá 1,042 → reprova
  const mat = { fc0k: 30 * MPa, ft0k: 30 * MPa, fbk: 30 * MPa, fvk: 5 * MPa, E0med: 14500 * MPa, E005: 10150 * MPa };
  const Pd = 42.228;
  const e = nbr7190.check({ demands: { N: -Pd, Mz: Pd * 0.05, My: Pd * 0.025 }, mat, sec: rect(100, 200),
    member: { L: 3.5, KE: 1, L1: 0.1 }, options: { kmod1: 0.7, kmod2: 1.0 } });
  ok('7d. Ex.4 com kM = 0,7 (2022): índice 1,042', e.interaction.ratio, 1.042, 0.002);
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
