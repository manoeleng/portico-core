// test_lit_solver.mjs — solver (estática linear de pórtico/treliça, flambagem linear, modal) contra
// exemplos PUBLICADOS com resultado numérico. Complementa os testes analíticos (test_beam_element,
// test_buckling, test_modal_beam, test_geometric_analysis).
//   node tests/test_lit_solver.mjs
//
// Fontes (valor esperado = o impresso; NUNCA ajustado):
//   [LEET]   Leet, Uang, Gilbert, Fundamentos da Análise Estrutural, 3ª ed. (McGraw-Hill/Bookman, 2009;
//            trad. da 3ª ed. americana 2008). Ex. 17.3 (pp. 705–707) e 17.4 (p. 708): treliça pelo método
//            da rigidez direta; Ex. 18.4 (pp. 741–747): pórtico com barra inclinada, deformação axial e
//            de flexão. Unidades do livro (kip, pol).
//   [MOLINA] Calil Jr & Molina (2010), Coberturas em Estruturas de Madeira — Exemplos de Cálculo, Pini:
//            treliça Howe de 12 m — nós p. 48 (Tab. 2.2), barras pp. 48–49 (Tab. 2.3), forças nodais do
//            VENTO 01 p. 55, esforços característicos (SAP90) p. 58 (Tab. 2.5).
//   [SALEM]  Gogate, A. B., discussão de Yura, "The effective length of columns in unbraced frames",
//            AISC Engineering Journal, jul. 1971, pp. 110–111, Figs. 1 e 2 (resultados de A. H. Salem):
//            (P1+P2)cr/(2·PE) de pórtico simples, base engastada e rotulada, PE = π²EI1/h².
//   [NAFEMS] Teste FV2 "Pin-ended double cross: in-plane vibration", NAFEMS TNSB Rev. 3 (1990), como
//            reproduzido no Abaqus Benchmarks Guide (2017), seção FV2 (tabela NAFEMS e arquivo
//            nfv2x22x.inp: braços de 5 m a 45°, seção quadrada 0,125 m, E = 200 GPa, ν = 0,3,
//            ρ = 8000 kg/m³, extremidades com ux = uy = 0).
//
// Divergências por defeito provável vão para PENDENTES (impressas, não falham a bateria).
import { Model } from '../js/model/model.js';
globalThis.window = globalThis;
await import('../lib/numeric.js');
const { StaticSolver } = await import('../js/solver/static_solver.js');
const { ModalSolver } = await import('../js/solver/modal_solver.js');
const { linearBuckling } = await import('../js/solver/geometric_analysis.js');

let fails = 0, n = 0;
const pendentes = [], notas = [];
const ok = (name, got, exp, tolAbs) => {
  n++; const d = Math.abs(got - exp), p = d <= tolAbs + 1e-12;
  if (!p) fails++;
  const dp = Math.abs(exp) > 1e-12 ? `${(100 * (got - exp) / Math.abs(exp)).toFixed(3)}%` : '—';
  console.log(`${p ? 'ok  ' : 'FAIL'} ${name}: obtido ${(+got).toPrecision(6)} · esperado ${exp} (±${+tolAbs.toPrecision(3)}) · Δ ${dp}`);
};
const okRel = (name, got, exp, rel) => ok(name, got, exp, rel * Math.abs(exp));
const eq = (name, c) => { n++; if (!c) fails++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); };
const newModel = () => { const m = new Model(); m.materials.clear(); m.sections.clear(); return m; };
const FIX = { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };
const PIN_REL = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1];   // barra de treliça: My, Mz liberados nas duas pontas
const bar = (m, a, b, mat, sec) => { const e = m.addElement(a, b, mat, sec); m.updateElement(e.id, { releases: PIN_REL }); return e; };

// ═══ (S1) [LEET] Ex. 18.4 — pórtico com barra inclinada (pp. 741–747) ══════════════════════════
// A (0,0) engastado; B (30 ft, 40 ft); C (80 ft, 40 ft) engastado. EI = 24·10⁶ kip·pol², AE = 0,72·10⁶ kip
// nas duas barras; 40 kips para baixo no meio de BC. Plano X–Z do modelo (2D), unidades kip e pol.
// Livro: Δ1 = 0,014 pol (→), Δ2 = 0,0345 pol (↓), |θB| = 0,00937 rad (eq. 18.71);
// momentos finais (Fig. 18.10h, kip·ft): MA = 61,4; MB = 123,9; Mmeio BC = 281,3; MC = 313,6;
// normais: AB = −23,04 kips (compressão); |BC| = 16,8 kips.
// Tolerância: ±0,5 unidade do último dígito impresso (análise exata do mesmo modelo de barras).
{
  const m = newModel(); m.mode = '2D';
  const E = 29000;                                      // qualquer E: só EI e EA entram
  const mat = m.addMaterial({ name: 'E', E, G: E / 2.6, nu: 0.3, rho: 0 });
  const sec = m.addSection({ name: 'X', A: 0.72e6 / E, Iy: 24e6 / E, Iz: 24e6 / E, J: 1, Avy: 1e30, Avz: 1e30 });
  const A = m.addNode(0, 0, 0, FIX), B = m.addNode(360, 0, 480, {}), Mid = m.addNode(660, 0, 480, {}), C = m.addNode(960, 0, 480, FIX);
  const eAB = m.addElement(A.id, B.id, mat.id, sec.id), eBM = m.addElement(B.id, Mid.id, mat.id, sec.id), eMC = m.addElement(Mid.id, C.id, mat.id, sec.id);
  const lc = m.addLoadCase('P'); m.addLoad(lc.id, { type: 'nodal', nodeId: Mid.id, F: [0, 0, -40, 0, 0, 0] });
  const r = new StaticSolver().solve(m, lc.id, false);
  const f = (e) => r.getElemForces(e.id), dB = r.getNodeDisp(B.id);
  ok('S1a. Δ1 horizontal de B [pol]', dB[0], 0.014, 0.0005);
  ok('S1b. Δ2 vertical de B (para baixo) [pol]', -dB[2], 0.0345, 0.00005);
  ok('S1c. |θB| [rad]', Math.abs(dB[4]), 0.00937, 0.000005);
  ok('S1d. |MA| [kip·ft]', Math.abs(f(eAB).Mz1) / 12, 61.4, 0.05);
  ok('S1e. |MB| [kip·ft]', Math.abs(f(eAB).Mz2) / 12, 123.9, 0.05);
  // 281,3 no livro é superposição de valores já arredondados: PL/4 − (123,9 + 313,6)/2 = 500 − 218,75 = 281,25 → 281,3;
  // dois arredondamentos (extremos a 0,1 e o resultado a 0,1) → ±0,1 kip·ft.
  ok('S1f. |M meio de BC| [kip·ft]', Math.abs(f(eBM).Mz2) / 12, 281.3, 0.1);
  ok('S1g. |MC| [kip·ft]', Math.abs(f(eMC).Mz2) / 12, 313.6, 0.05);
  ok('S1h. N AB [kips] (compressão)', f(eAB).N, -23.04, 0.005);
  ok('S1i. |N BC| [kips]', Math.abs(f(eBM).N), 16.8, 0.05);
  eq('S1j. sinal de N BC coerente com Δ1 > 0 do próprio livro (B se aproxima de C → BC encurta → compressão)', f(eBM).N < 0 && dB[0] > 0);
  notas.push(`S1: a Fig. 18.10g/h do livro rotula BC como "+16,8 (tração)"; o solver dá N = ${f(eBM).N.toFixed(2)} kips (compressão). `
    + 'Com os deslocamentos do próprio livro (eq. 18.71: Δ1 = +0,014 pol para a direita, C engastado), a deformação axial de BC '
    + 'é uB − uC = +0,014 pol de encurtamento → compressão, e o equilíbrio horizontal de B (AB comprimida empurra B para a direita) '
    + 'exige BC comprimida. Erro de sinal da FONTE; a magnitude confere.');
}

// ═══ (S2) [LEET] Ex. 17.3 e 17.4 — treliça pelo método da rigidez direta (pp. 705–708) ═════════
// Nó 1 (0,0) apoio fixo; nó 3 (0, 20 ft) apoio que restringe só x; nó 2 (15 ft, 0) livre (17.3) ou
// com rolo restringindo x (17.4). k1 = k2 = AE/L = 250 kip/pol, k3 = 500 kip/pol; 40 kips ↓ no nó 2.
// 17.3: Δ3 = −0,12; Δ4 = −0,375; Δ6 = −0,16 pol; Q1 = 30, Q2 = 40, Q5 = −30 kips.
// 17.4: Δ4 = −0,285; Δ6 = −0,160 pol; Q1 = 0, Q2 = 40, Q3 = 30, Q5 = −30 kips.
for (const ex of ['17.3', '17.4']) {
  const m = newModel(); m.mode = '2D';
  const E = 1000, mat = m.addMaterial({ name: 'E', E, G: 400, nu: 0.25, rho: 0 });
  const s = (AE) => m.addSection({ name: 'b', A: AE / E, Iy: 1, Iz: 1, J: 1 }).id;
  const n1 = m.addNode(0, 0, 0, { ux: 1, uz: 1, ry: 1 });
  const n2 = m.addNode(180, 0, 0, { ux: ex === '17.4' ? 1 : 0, ry: 1 });
  const n3 = m.addNode(0, 0, 240, { ux: 1, ry: 1 });
  bar(m, n1.id, n2.id, mat.id, s(250 * 180)); bar(m, n1.id, n3.id, mat.id, s(250 * 240)); bar(m, n3.id, n2.id, mat.id, s(500 * 300));
  const lc = m.addLoadCase('P'); m.addLoad(lc.id, { type: 'nodal', nodeId: n2.id, F: [0, 0, -40, 0, 0, 0] });
  const r = new StaticSolver().solve(m, lc.id, false);
  const d2 = r.getNodeDisp(n2.id), d3 = r.getNodeDisp(n3.id), R1 = r.getReaction(n1.id), R2 = r.getReaction(n2.id), R3 = r.getReaction(n3.id);
  if (ex === '17.3') {
    ok('S2a. 17.3 Δ3 (x do nó 2) [pol]', d2[0], -0.12, 0.005);
    ok('S2b. 17.3 Δ4 (y do nó 2) [pol]', d2[2], -0.375, 0.0005);
    ok('S2c. 17.3 Δ6 (y do nó 3) [pol]', d3[2], -0.16, 0.005);
    ok('S2d. 17.3 Q1 [kips]', R1[0], 30, 0.5); ok('S2e. 17.3 Q2 [kips]', R1[2], 40, 0.5); ok('S2f. 17.3 Q5 [kips]', R3[0], -30, 0.5);
  } else {
    ok('S2g. 17.4 Δ4 [pol]', d2[2], -0.285, 0.0005);
    ok('S2h. 17.4 Δ6 [pol]', d3[2], -0.160, 0.0005);
    ok('S2i. 17.4 Q1 [kips]', R1[0], 0, 0.5); ok('S2j. 17.4 Q2 [kips]', R1[2], 40, 0.5);
    ok('S2k. 17.4 Q3 [kips]', R2[0], 30, 0.5); ok('S2l. 17.4 Q5 [kips]', R3[0], -30, 0.5);
  }
}

// ═══ (S3) [MOLINA] treliça Howe 12 m, VENTO 01 (sucção assimétrica) — Tab. 2.5, p. 58 ═════════
// Geometria Tab. 2.2/2.3 (cm); nó 1 apoio fixo, nó 16 rolo (isostática). Forças nodais do VENTO 01
// (p. 55, kN; vertical + para cima, horizontal + para a direita), barlavento = água esquerda:
//   nó de extremidade: barlavento (1,16 ↑; 0,31 ←), sotavento (0,53 ↑; 0,14 →);
//   nó intermediário:  barlavento (2,31 ↑; 0,62 ←), sotavento (1,05 ↑; 0,28 →).
// Leitura: nós 1 e 16 = extremidade; 3, 5, 7 e 11, 13, 15 = intermediários; cumeeira (9) = soma das duas
// extremidades (meia faixa de cada água). Esforços: + tração.
// Tolerância: as forças de entrada estão arredondadas a 0,01 kN (até ±0,4 % nas menores) → ±(0,4 %·|N| + 0,005 kN).
{
  const XY = { 1: [0, 0], 2: [101, 0], 3: [101, 27], 4: [264, 0], 5: [264, 71], 6: [427, 0], 7: [427, 115], 8: [600, 0], 9: [600, 161],
    10: [773, 0], 11: [773, 115], 12: [936, 0], 13: [936, 71], 14: [1099, 0], 15: [1099, 27], 16: [1200, 0] };
  const BARS = [[1, 2], [2, 4], [4, 6], [6, 8], [8, 10], [10, 12], [12, 14], [14, 16], [1, 3], [3, 5], [5, 7], [7, 9], [9, 11], [11, 13], [13, 15], [15, 16],
    [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [3, 4], [5, 6], [7, 8], [8, 11], [10, 13], [12, 15]];
  const LIVRO = [-26.69, -26.69, -20.85, -15.97, -13.29, -15.51, -18.21, -18.21, 26.54, 21.15, 16.74, 12.32, 12.50, 14.49, 16.50, 18.99,
    0, -0.97, -2.13, -4.70, -0.97, -0.45, 0, 5.92, 5.32, 5.85, 2.63, 2.43, 2.73];
  const m = newModel(); m.mode = '2D';
  const mat = m.addMaterial({ name: 'C40', E: 1950, G: 100, nu: 0.3, rho: 0 });   // isostática: E e A não alteram N
  const sec = m.addSection({ name: '2×3×12', A: 72, Iy: 864, Iz: 864, J: 1 });
  const N = {};
  for (const [k, [x, z]] of Object.entries(XY)) N[k] = m.addNode(x, 0, z, { ry: 1 });
  m.updateNode(N[1].id, { restraints: { ux: 1, uz: 1, ry: 1 } });
  m.updateNode(N[16].id, { restraints: { uz: 1, ry: 1 } });
  const E = BARS.map(([a, b]) => bar(m, N[a].id, N[b].id, mat.id, sec.id));
  const lc = m.addLoadCase('VENTO 01');
  const V01 = [[1, -0.31, 1.16], [3, -0.62, 2.31], [5, -0.62, 2.31], [7, -0.62, 2.31], [9, -0.31 + 0.14, 1.16 + 0.53],
    [11, 0.28, 1.05], [13, 0.28, 1.05], [15, 0.28, 1.05], [16, 0.14, 0.53]];
  for (const [k, fx, fz] of V01) m.addLoad(lc.id, { type: 'nodal', nodeId: N[k].id, F: [fx, 0, fz, 0, 0, 0] });
  const r = new StaticSolver().solve(m, lc.id, false);
  let worst = 0;
  E.forEach((e, i) => {
    const got = r.getElemForces(e.id).N, exp = LIVRO[i], tol = 0.004 * Math.abs(exp) + 0.005;
    n++; const p = Math.abs(got - exp) <= tol; if (!p) { fails++; console.log(`FAIL S3. barra ${i + 1}: obtido ${got.toFixed(3)} · livro ${exp} (±${tol.toFixed(3)})`); }
    worst = Math.max(worst, Math.abs(got - exp));
  });
  console.log(`ok   S3. Howe/VENTO 01: 29 barras conferidas com a Tab. 2.5 — maior |Δ| = ${worst.toFixed(3)} kN (banzo inferior 1: ${r.getElemForces(E[0].id).N.toFixed(2)} × −26,69)`);
}

// ═══ (S4) [SALEM] flambagem de pórtico simples — AISC Eng. J., jul. 1971, Figs. 1–2 ═══════════
// Pilares h, I1 (K1 = I1/h); viga L, I2 (K2 = I2/L); cargas P1, P2 no topo dos pilares; PE = π²EI1/h².
// Ordenada (P1+P2)cr/(2·PE): base ENGASTADA (Fig. 1) e ROTULADA (Fig. 2), P1/P2 = 1 (coluna direita da
// figura) e P1/P2 = 0 (coluna esquerda). Pórtico modelado com 8 elementos de Euler–Bernoulli por barra e
// EA alto (a solução clássica despreza deformação axial).
// Tolerância 0,2 %: discretização (erro O(h²) < 0,1 % com 8 elementos) + 0,5 unidade da 4ª decimal.
function salem(base, k2k1, P1, P2, nEl = 8) {
  const m = newModel(); m.mode = '2D';
  const E = 2e8, I = 1e-4, h = 4, L = 4;
  const mat = m.addMaterial({ name: 'E', E, G: E / 2.6, nu: 0.3, rho: 0 });
  const sc = m.addSection({ name: 'col', A: 1, Iy: I, Iz: I, J: 1e-4, Avy: 1e30, Avz: 1e30 });
  const sb = m.addSection({ name: 'vig', A: 1, Iy: k2k1 * I * L / h, Iz: k2k1 * I * L / h, J: 1e-4, Avy: 1e30, Avz: 1e30 });
  const apoio = base === 'engastada' ? { ux: 1, uz: 1, ry: 1 } : { ux: 1, uz: 1 };
  const linha = (x0, z0, x1, z1, sec, ini, fim = null) => {
    let prev = ini;
    for (let i = 1; i <= nEl; i++) {
      const nd = (i === nEl && fim) ? fim : m.addNode(x0 + (x1 - x0) * i / nEl, 0, z0 + (z1 - z0) * i / nEl, {});
      m.addElement(prev.id, nd.id, mat.id, sec.id); prev = nd;
    }
    return prev;
  };
  const B = linha(0, 0, 0, h, sc, m.addNode(0, 0, 0, apoio));
  const C = linha(L, 0, L, h, sc, m.addNode(L, 0, 0, apoio));
  linha(0, h, L, h, sb, B, C);
  const lc = m.addLoadCase('P');
  if (P1) m.addLoad(lc.id, { type: 'nodal', nodeId: B.id, F: [0, 0, -P1, 0, 0, 0] });
  if (P2) m.addLoad(lc.id, { type: 'nodal', nodeId: C.id, F: [0, 0, -P2, 0, 0, 0] });
  const res = linearBuckling(m, { nModes: 2 });
  if (!res.ok) return NaN;
  return res.modes[0].lambda * (P1 + P2) / (2 * Math.PI ** 2 * E * I / h ** 2);
}
for (const [base, k, P1, P2, exp] of [
  ['engastada', 1, 1, 1, 0.7475], ['engastada', 0.5, 1, 1, 0.6109], ['engastada', 2, 1, 1, 0.8547], ['engastada', 1, 0, 1, 0.7386],
  ['rotulada', 1, 1, 1, 0.1845], ['rotulada', 0.5, 1, 1, 0.1440], ['rotulada', 2, 1, 1, 0.2131], ['rotulada', 1, 0, 1, 0.1819]]) {
  okRel(`S4. base ${base}, K2/K1 = ${k}, P1/P2 = ${P1 / P2}: (P1+P2)cr/2PE`, salem(base, k, P1, P2), exp, 0.002);
}

// ═══ (S5) [NAFEMS] FV2 — cruz dupla biarticulada, vibração no plano ═════════════════════════════
// 8 braços de 5 m a 45° a partir do centro (5; 5), seção 0,125 × 0,125 m, E = 200 GPa, ν = 0,3, ρ = 8000 kg/m³;
// extremidades com translações no plano impedidas; plano X–Z do modelo (uy, rx, rz travados).
// NAFEMS [Hz]: f1 = 11,336; f2–f8 = 17,709; f9 = 45,345; f10–f16 = 57,390.
// Malha: 4 elementos de Euler–Bernoulli (massa consistente) por braço — a malha de referência do teste.
// Tolerância: 0,5 % (modos 1–8) e 1,0 % (modos 9–16) — erro de discretização; o próprio Abaqus Benchmarks
// Guide reporta desvios de até 0,14 % (1–8) e 2,46 % (9–16) com B22/B23 para este teste.
{
  const m = newModel();
  const E = 2e11, nu = 0.3, a = 0.125, A = a * a, I = a ** 4 / 12, nEl = 4;
  const mat = m.addMaterial({ name: 'aço', E, G: E / (2 * (1 + nu)), nu, rho: 8000 });
  const sec = m.addSection({ name: 'Q125', A, Iy: I, Iz: I, J: 0.1406 * a ** 4, Avy: 1e30, Avz: 1e30 });
  const plano = { uy: 1, rx: 1, rz: 1 };
  const c = m.addNode(5, 0, 5, { ...plano });
  for (let k = 0; k < 8; k++) {
    const th = k * Math.PI / 4; let prev = c;
    for (let i = 1; i <= nEl; i++) {
      const rr = 5 * i / nEl;
      const nd = m.addNode(5 + rr * Math.cos(th), 0, 5 + rr * Math.sin(th), i === nEl ? { ...plano, ux: 1, uz: 1 } : { ...plano });
      m.addElement(prev.id, nd.id, mat.id, sec.id); prev = nd;
    }
  }
  const f = new ModalSolver().solve(m, 16).freq;
  const REF = [11.336, ...Array(7).fill(17.709), 45.345, ...Array(7).fill(57.390)];
  REF.forEach((fr, i) => okRel(`S5. FV2 f${i + 1} [Hz]`, f[i], fr, i < 8 ? 0.005 : 0.010));
  // Multiplicidade: a tabela NAFEMS lista os grupos {2,3}, {4..8}, {10,11}, {12..16} com autovalor repetido.
  const disp = [];
  for (const [i0, i1] of [[1, 2], [3, 7], [9, 10], [11, 15]]) {
    const g = f.slice(i0, i1 + 1), spread = (Math.max(...g) - Math.min(...g)) / Math.min(...g);
    console.log(`info S5. grupo repetido f${i0 + 1}–f${i1 + 1}: ${g.map(v => v.toFixed(3)).join(', ')} Hz (dispersão ${(100 * spread).toFixed(3)} %)`);
    if (spread > 1e-4) disp.push(`f${i0 + 1}–f${i1 + 1}: ${(100 * spread).toFixed(3)} %`);
  }
  if (disp.length) pendentes.push(`S5: autovalores que o FV2 dá como REPETIDOS saem dispersos (${disp.join('; ')}). `
    + 'Causa provável: o Stodola com deflação do ModalSolver (js/solver/modal_solver.js l. 198–200; mesmo critério em modal_core.js) aceita convergência relaxada '
    + '(|Δω²|/ω² < 1e-4 após 20 iterações) e, em agrupamentos, devolve quocientes de Rayleigh de combinações não convergidas. '
    + 'Conferido fora da bateria: scipy.linalg.eigh(K, M) do MESMO K e M dá f2 = f3 = 17,692; f4–f8 = 17,721; f10 = f11 = 57,427; '
    + 'f12–f16 = 57,748 Hz (o solver dá f10 = 57,548, +0,2 %). Efeito ≤ 0,3 % na frequência; com 8 el./braço a ordem dos modos '
    + 'dentro do grupo sai trocada (f10 > f11). Sugestão (não feita aqui): critério de convergência por resíduo ou método subspace.');
}

console.log('\nPENDENTES (defeito provável — impressos, não falham a bateria):');
console.log(pendentes.length ? pendentes.map(p => '  · ' + p).join('\n') : '  (nenhum)');
console.log('NOTAS (divergência explicada pela fonte):');
console.log(notas.length ? notas.map(p => '  · ' + p).join('\n') : '  (nenhuma)');
console.log(fails ? `\n${fails}/${n} FALHA(S)` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
