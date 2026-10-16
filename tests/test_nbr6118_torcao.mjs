// test_nbr6118_torcao.mjs — torção uniforme NBR 6118:2026 (17.5.1, 17.7.2)
//   node tests/test_nbr6118_torcao.mjs
// Oráculo: cálculo manual pela NBR 6118:2026 (não há exemplo resolvido de torção no acervo — Carvalho
// Vol. 1/2, Araújo e Bastos não cobrem; IBRACON Comentários = LACUNA). Viga 20 × 50 cm, c1 = 4 cm,
// C25, CA-50, estribo φ8 c/10 (2 ramos), modelo I (θ = 45°), TSd = 10 kN·m.
//   A/u = 0,0714 m < 2c1 = 0,08 → he = 0,0714 (≤ b − 2c1); Ae = 0,12·0,42 = 0,0504 m²; ue = 1,08 m
//   TRd2 = 0,5·0,9·17 857·0,0504·0,0714·sen 90° = 28,93 kN·m
//   VRd2 = 0,27·0,9·17 857·0,20·0,46 = 399,21 kN; Vc0 = 70,79 kN
//   A90/s = 10/(2·0,0504·434 783) = 2,282 cm²/m por ramo; φ8 c/10 = 5,027 cm²/m → 0,4539
//   As,l = 10·1,08/(2·0,0504·434 783) = 2,464 cm²
//   VSd = 60 kN:  60/399,21 + 10/28,93 = 0,4960
//   VSd = 150 kN: 150/399,21 + 10/28,93 = 0,7214; estribos (150 − 70,79)/(0,9·0,46·434 783)/2 + A90/s
//                 = 4,482 cm²/m por ramo → 0,8917
import { nbr6118, torsionCheck } from '../js/design/codes/nbr6118.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

const mat = { fc: 25e3, fyRebar: 500e3 };
const sec = (extra = {}) => ({ shape: 'rect', b: 0.20, h: 0.50, A: 0.10, d: 0.46,
  rebar: { cover_mm: 40, layers: [], stirrups: { dia: 8, s: 100, legs: 2 }, ...extra } });
const run = (V, T, rebarExtra, options = {}) => nbr6118.check({ demands: { N: 0, Vy: V, Vz: 0, My: 0, Mz: 0, T }, mat, sec: sec(rebarExtra), member: {}, options: { gamma_c: 1.4, gamma_s: 1.15, ...options } });

{ const t = torsionCheck({ TSd: 10, b: 0.20, h: 0.50, c1: 0.04, fck: 25, fcd: 25 / 1.4, fywd: 500 / 1.15 });
  ok('1a. he (m)', t.he, 0.071429, 1e-4); ok('1b. Ae (m²)', t.Ae, 0.0504, 1e-6); ok('1c. ue (m)', t.ue, 1.08, 1e-6);
  ok('1d. TRd2 (kN·m)', t.TRd2, 28.9286, 1e-4);
  ok('1e. A90/s por ramo (cm²/m)', t.a90Nec * 1e4, 2.2817, 1e-4); ok('1f. As,l (cm²)', t.aslNec * 1e4, 2.4643, 1e-4); }

{ const r = run(60, 10, { Asl_torcao_cm2: 3.0 });
  ok('2a. interação V/VRd2 + T/TRd2', r.torcao.interacaoVT, 0.49597, 1e-3);
  // 17.7.2.3 + 17.4.1.1.1 (corrigido 15/10/2026, Bastos UNESP Torção Ex.3 VS1 p.75): cortante com o seu mínimo
  // ρ·bw/2 = 1,02596 cm²/m por ramo + A90/s = 2,2817 = 3,3077 → /5,02655 = 0,65804 (antes 0,45394, só a torção)
  ok('2b. razão dos estribos (VSd < Vc: Asw,mín da cortante + torção)', r.torcao.razaoEstribos, 0.65804, 1e-3);
  ok('2c. razão longitudinal 2,464/3,0', r.torcao.razaoLongitudinal, 2.4643 / 3.0, 1e-3);
  ok('2d. razão da torção = máx.', r.torcao.ratio, 2.4643 / 3.0, 1e-3); }

{ const r = run(150, 10, { Asl_torcao_cm2: 3.0 });
  ok('3a. interação com VSd = 150 kN', r.torcao.interacaoVT, 0.72142, 1e-3);
  ok('3b. estribos V + T somados (17.7.2.3)', r.torcao.razaoEstribos, 0.89165, 1e-3); }

{ const r = run(60, 10, {});
  assert('4. sem As,l de torção → NÃO verificado (nunca aprova)', !isFinite(r.torcao.ratio) && r.state === 'NO CUMPLE' && r.avisos.some(a => /2,46 cm²/.test(a) || /2\.46 cm²/.test(a)), r.avisos.join(' | ')); }
{ const r = run(60, 10, {}, { torcaoCompatibilidade: true });
  assert('5. torção de compatibilidade desprezada por opção (17.5.1.2) com aviso', r.torcao === null && r.avisos.some(a => /compatibilidade/.test(a))); }
{ const r = run(60, 40, { Asl_torcao_cm2: 10 });
  assert('6. TSd > TRd2 reprova pela biela', r.torcao.interacaoVT > 1 && r.state === 'NO CUMPLE'); }

// (7) Taxas mínimas 17.5.1.2 (achado da revisão): TSd = 1 kN·m, VSd = 10 kN, As,l = 3,0 cm²
//   ρmín = 0,2·2,5649/500 = 1,02596e-3; estribo (corrigido 15/10/2026 — 17.7.2.3 soma V + T; mínimo de torção da
//   17.5.1.2 aplicado ao A90/s de um ramo, leitura de Bastos UNESP Ex.3): cortante ρ·bw/2 = 1,02596 + torção
//   máx(0,2282; ρ·bw = 2,0519) = 3,0779 cm²/m → /5,02655 = 0,61232 (antes 0,20411); As,l mín = ρ·he·ue = 1,02596e-3·0,071429·1,08 = 0,79146 cm² → /3,0 = 0,26382
{ const r = run(10, 1, { Asl_torcao_cm2: 3.0 });
  ok('7a. estribo pelas taxas mínimas de V e de T', r.torcao.razaoEstribos, 0.61232, 1e-3);
  ok('7b. As,l pela taxa mínima', r.torcao.razaoLongitudinal, 0.26382, 1e-3); }
// (8) Estribo de 4 ramos: cortante dividido por 4 + torção num ramo periférico
//   (150 − 70,793)/(0,9·0,46·434 783)/4 = 1,1001 cm²/m + 2,2817 = 3,3818 → /5,02655 = 0,67278
{ const r = nbr6118.check({ demands: { N: 0, Vy: 150, Vz: 0, My: 0, Mz: 0, T: 10 }, mat,
    sec: { ...sec({ Asl_torcao_cm2: 3.0 }), rebar: { cover_mm: 40, layers: [], stirrups: { dia: 8, s: 100, legs: 4 }, Asl_torcao_cm2: 3.0 } }, member: {}, options: { gamma_c: 1.4, gamma_s: 1.15 } });
  ok('8. estribo de 4 ramos (ramo periférico)', r.torcao.razaoEstribos, 0.67278, 1e-3); }
// (9) Ramo A/u ≥ 2c1 (17.5.1.4.1): 40 × 80, c1 = 4 cm → he = 0,13333; Ae = 0,26667·0,66667 = 0,17778 m²
{ const t = torsionCheck({ TSd: 10, b: 0.40, h: 0.80, c1: 0.04, fck: 25, fcd: 25 / 1.4, fywd: 434.78 });
  ok('9a. he', t.he, 0.133333, 1e-4); ok('9b. Ae', t.Ae, 0.177778, 1e-4); }
// (10) Compatibilidade com VSd > 0,7·VRd2 = 279,4 kN → aviso de 17.5.1.2
{ const r = run(300, 10, {}, { torcaoCompatibilidade: true });
  assert('10. aviso VSd > 0,7·VRd2', r.avisos.some(a => /0,7·VRd2/.test(a) && /NÃO é permitido/.test(a))); }
// (11) Guarda geométrica: b ≤ 2c1 → null
assert('11. b ≤ 2c1 → seção equivalente inválida', torsionCheck({ TSd: 1, b: 0.08, h: 0.5, c1: 0.04, fck: 25, fcd: 17.86, fywd: 434.78 }) === null);

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
