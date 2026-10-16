// test_lit_nbr6118.mjs — NBR 6118:2026 (js/design/codes/nbr6118.js) contra EXEMPLOS RESOLVIDOS DA LITERATURA
//   node tests/test_lit_nbr6118.mjs
//
// Complementa (sem repetir) test_nbr6118*.mjs: lá estão Carvalho & Figueiredo Filho Vol.1 (cap. 3, 4, 6),
// Bastos "Pilares" Ex.1 de pilar intermediário e Kimura Ex.16. Aqui:
//   [BT] Bastos, P.S.S. "Torção em vigas de concreto armado", UNESP Bauru, mai/2024 (base NBR 6118:2023)
//        https://wwwp.feb.unesp.br/pbastos/concreto2/Torcao.pdf — Ex.1 (V1, V2), Ex.2, Ex.3 (VS1, VS6)
//   [BC] Bastos, "Dimensionamento de vigas de concreto armado à força cortante", UNESP, nov/2023 (base 2023)
//        https://wwwp.feb.unesp.br/pbastos/concreto2/Cortante.pdf — Ex. numéricos 1 e 2, Modelo II
//   [BP] Bastos, "Pilares de concreto armado" (notas de aula, base NBR 6118:2014) — acervo
//        C:\projetos\_referencias\Concreto\Bastos UNESP - Pilares ... .pdf — pilares de extremidade Ex.1 a 4
//   [K]  Kimura, "Cálculo de pilares de concreto armado" (2018, base 2014), Ex.17 (dados do IBRACON)
//   [BV] Bastos, "Vigas de concreto armado — dimensionamento, flecha e fissuração", UNESP (base 2023)
//        https://wwwp.feb.unesp.br/pbastos/concreto2/Vigas.pdf — itens 16.12, 17.1, 20.8, 21.7
// Páginas = numeração IMPRESSA nas notas (a do PDF entre colchetes quando diferente).
//
// EDIÇÃO. Itens conferidos no texto da NBR 6118:2026 (C:\projetos\_referencias\nbr6118-2026.txt) e iguais aos das
// edições 2014/2023 usadas pelas fontes: 17.5.1.2–17.5.1.6 e 17.7.2 (torção), 17.4.2.2/17.4.2.3 (cortante I e II),
// 11.3.3.4.3 (M1d,mín), 15.8.2 para pilar BIAPOIADO (αb = 0,6 + 0,4·MB/MA, 0,4 ≤ αb ≤ 1,0; λ1 com 35 ≤ λ1 ≤ 90),
// 15.8.3.3.2/15.8.3.3.3, 17.3.1 (Mr, α = 1,5 retangular), 17.3.2.1.1 (Branson), 17.3.2.1.2 (αf, ξ(t)),
// 17.3.3.2 (wk). Mudanças da 2026 que NÃO entram aqui: ηc (só fck > 40 na flexão — nenhum caso de flexão ELU aqui),
// αb do balanço (todos os pilares são biapoiados).
//
// ORÁCULO IMUTÁVEL: os esperados são os números IMPRESSOS na fonte; nada é recalculado aqui (a mecânica da viga
// biapoiada 5pL⁴/384EI é a única conta feita com números do módulo). Tolerâncias: 1 % (arredondamento de livro a
// 3–4 algarismos) salvo onde indicado; 2 % só em Bastos Torção Ex.2, onde o livro arredonda he = 6,4 e 2c1 = 7,9 cm
// (efeito no produto Ae·he ≈ 1,2 %); abs. 0,005 mm em wk (livro imprime 2 decimais).
// PENDENTES: divergências atribuídas a premissa/defeito provável do código — impressas, NÃO reprovam a bateria.
import { nbr6118, torsionCheck, columnSecondOrder, crackingMoment, stage2Inertia, equivalentStiffness, creepFactor, crackWidth } from '../js/design/codes/nbr6118.js';

let fails = 0, n = 0;
const pend = [];
const ok = (name, got, exp, tol) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); const p = e <= tol;
  if (!p) fails++; console.log(`${p ? 'ok  ' : 'FAIL'} ${name}: obtido=${(+got).toPrecision(6)} esperado=${exp} (Δ=${(100 * (got - exp) / exp).toFixed(2)} %, tol ${(tol * 100).toFixed(1)} %)`); };
const okAbs = (name, got, exp, tolAbs) => { n++; const p = Math.abs(got - exp) <= tolAbs;
  if (!p) fails++; console.log(`${p ? 'ok  ' : 'FAIL'} ${name}: obtido=${(+got).toPrecision(5)} esperado=${exp} (tol abs ${tolAbs})`); };
const assert = (name, c, info = '') => { n++; if (!c) fails++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}${info ? ' · ' + info : ''}`); };
const pendente = (name, got, exp, motivo) => { const d = 100 * (got - exp) / exp; pend.push({ name, got, exp, d, motivo });
  console.log(`PEND ${name}: obtido=${(+got).toPrecision(5)} esperado=${exp} (Δ=${d.toFixed(1)} %)`); };

const cm = 0.01, cm2 = 1e-4, kNcm = 0.01;        // 1 kN·cm = 0,01 kN·m
const OPT = { gamma_c: 1.4, gamma_s: 1.15 };
const fywd = 500 / 1.15;                          // CA-50, ≤ 435 MPa

// ═══════════════════════════ 1. TORÇÃO (17.5.1, 17.7.2) ═══════════════════════════════════════════════════
// [BT] Ex.2, item 15.2.9, p.51–53 [PDF 56–58]: viga 19 × 40, C30, CA-50, c1 = 3,925 cm, Modelo I (θ = 45°),
// TSd = 1,4·1026 = 1436 kN·cm. A/u = 6,4 < 2c1 → he = A/u, Ae nos eixos das barras de canto.
// Livro: Ae = (19 − 7,9)(40 − 7,9) = 356,3 cm²; ue = 86,4 cm; TRd2 = 2150,0 kN·cm; As,l/ue = A90/s = 4,63 cm²/m.
{
  const t = torsionCheck({ TSd: 1436 * kNcm, b: 0.19, h: 0.40, c1: 0.03925, fck: 30, fcd: 30 / 1.4, fywd });
  ok('T2a. [BT Ex.2 p.52] ue (cm)', t.ue / cm, 86.4, 0.01);
  ok('T2b. [BT Ex.2 p.52] TRd2 (kN·cm) — tol 2 %: livro arredonda he = 6,4 e 2c1 = 7,9', t.TRd2 / kNcm, 2150.0, 0.02);
  ok('T2c. [BT Ex.2 p.53] As,l/ue (cm²/m)', t.aslNec / t.ue / cm2, 4.63, 0.01);
  ok('T2d. [BT Ex.2 p.53] A90/s por ramo (cm²/m)', t.a90Nec / cm2, 4.63, 0.01);
  assert('T2e. [BT Ex.2] ramo A/u < 2c1 (17.5.1.4.1)', /2c1/.test(t.regra), t.regra);
}

// [BT] Ex.3, viga VS1, item 16.5.7, p.72–74 [PDF 77–79]: 19 × 60, C35, c1 = 3,925, θ = 45°, TSd = 1,4·1616 = 2262 kN·cm,
// VSd = 89,6 kN, d = 56 cm. Livro: he = 7,2; Ae = 581,5 cm²; ue = 126,6 cm; TRd2 = 4500,8 kN·cm; VRd2 = 617,1 kN;
// VSd/VRd2 + TSd/TRd2 = 0,65; As,l/ue = A90/s = 4,47 cm²/m; estribo por ramo (cortante mínimo 2,44/2 + torção) = 5,69 cm²/m.
const vigaVS = (T, V) => nbr6118.check({ demands: { N: 0, Vy: V, Vz: 0, My: 0, Mz: 0, T }, mat: { fc: 35e3, fyRebar: 500e3 },
  sec: { shape: 'rect', b: 0.19, h: 0.60, A: 0.114, d: 0.56, rebar: { cover_mm: 39.25, layers: [], stirrups: { dia: 8, s: 90, legs: 2 }, Asl_torcao_cm2: 10 } },
  member: { role: 'viga' }, options: { ...OPT } });
{
  const t = torsionCheck({ TSd: 2262 * kNcm, b: 0.19, h: 0.60, c1: 0.03925, fck: 35, fcd: 35 / 1.4, fywd });
  ok('T3a. [BT Ex.3 VS1 p.73] he (cm)', t.he / cm, 7.2, 0.005);
  ok('T3b. [BT Ex.3 VS1 p.73] Ae (cm²)', t.Ae / cm2, 581.5, 0.001);
  ok('T3c. [BT Ex.3 VS1 p.73] ue (cm)', t.ue / cm, 126.6, 0.001);
  ok('T3d. [BT Ex.3 VS1 p.73] TRd2 (kN·cm)', t.TRd2 / kNcm, 4500.8, 0.005);
  ok('T3e. [BT Ex.3 VS1 p.74] As,l/ue (cm²/m)', t.aslNec / t.ue / cm2, 4.47, 0.01);
  ok('T3f. [BT Ex.3 VS1 p.74] A90/s por ramo (cm²/m)', t.a90Nec / cm2, 4.47, 0.01);
  const r = vigaVS(22.62, 89.6);
  ok('T3g. [BT Ex.3 VS1 p.73] VRd2 Modelo I (kN)', r.cortante.VRd2, 617.1, 0.01);
  ok('T3h. [BT Ex.3 VS1 p.73] VSd/VRd2 + TSd/TRd2 (17.7.2.2) — livro 2 decimais', r.torcao.interacaoVT, 0.65, 0.01);
  // estribo por ramo exigido pelo código = razão × fornecido (φ8 c/9, 2 ramos)
  const legS = Math.PI * 0.008 ** 2 / 4 / 0.09;
  // corrigido no código em 15/10/2026 (era PENDENTE: o ρsw,mín era aplicado uma vez só ao total)
  ok('T3i. [BT Ex.3 VS1 p.75] estribo por ramo V + T = Asw,mín/2 + A90/s (cm²/m)', r.torcao.razaoEstribos * legS / cm2, 5.69, 0.01);
}
// [BT] Ex.3, viga VS6, item 16.6.x, p.79–80 [PDF 84–85]: mesma seção, TSd = 1,4·1540 = 2156 kN·cm, VSd = 98,8 kN.
// Livro: As,l/ue = A90/s = 4,26 cm²/m; interação = 0,64.
{
  const t = torsionCheck({ TSd: 2156 * kNcm, b: 0.19, h: 0.60, c1: 0.03925, fck: 35, fcd: 35 / 1.4, fywd });
  ok('T4a. [BT Ex.3 VS6 p.80] As,l/ue (cm²/m)', t.aslNec / t.ue / cm2, 4.26, 0.01);
  ok('T4b. [BT Ex.3 VS6 p.80] A90/s por ramo (cm²/m)', t.a90Nec / cm2, 4.26, 0.01);
  const r = vigaVS(21.56, 98.8);
  ok('T4c. [BT Ex.3 VS6 p.80] VSd/VRd2 + TSd/TRd2 — livro 2 decimais', r.torcao.interacaoVT, 0.64, 0.01);
}
// [BT] Ex.1, viga V1 em balanço, item 14.3.6, p.34–36 [PDF 39–41]: 35 × 50, C25, c1 = 4,125, Modelo II θ = 38°,
// TSd = 6808 kN·cm. A/u = 10,3 ≥ 2c1 = 8,3: o LIVRO ADOTA he = 10,0 cm (qualquer valor entre 2c1 e A/u é permitido
// por 17.5.1.4.1); o código toma he = A/u = 10,29 (limite superior). Premissa diferente → comparação informativa.
// Livro: Ae = 1000 cm², TRd2 = 7797 kN·cm, As,l/ue = 10,02 cm²/m, A90/s = 6,12 cm²/m.
{
  const t = torsionCheck({ TSd: 6808 * kNcm, b: 0.35, h: 0.50, c1: 0.04125, fck: 25, fcd: 25 / 1.4, fywd, theta: 38 });
  pendente('T1a. [BT Ex.1 p.35] TRd2 (kN·cm) — he livre', t.TRd2 / kNcm, 7797, 'premissa: livro he = 10,0 cm adotado; código he = A/u = 10,29 cm (ambos válidos em 17.5.1.4.1)');
  pendente('T1b. [BT Ex.1 p.36] As,l/ue (cm²/m) — he livre', t.aslNec / t.ue / cm2, 10.02, 'premissa: Ae = 1000 cm² (livro) × 981 cm² (código)');
  pendente('T1c. [BT Ex.1 p.36] A90/s (cm²/m) — he livre', t.a90Nec / cm2, 6.12, 'premissa: idem');
}

// ═══════════════════════════ 2. CORTANTE — MODELO II (17.4.2.3) ═══════════════════════════════════════════
const cort = (b, d, fck, V, theta) => nbr6118.check({ demands: { N: 0, Vy: V, Vz: 0, My: 0, Mz: 0 }, mat: { fc: fck * 1e3, fyRebar: 500e3 },
  sec: { shape: 'rect', b, h: d + 0.04, A: b * (d + 0.04), d, rebar: { layers: [] } }, member: { role: 'viga' },
  options: { ...OPT, modeloCortante: 'II', theta } }).cortante;
// [BT] Ex.1 viga V2, item 14.2.4, p.28–29 [PDF 33–34]: bw = 20, d = 46, C25, θ = 38°, VSd = 73,4 kN.
// Livro: VRd2 = 388,3 kN; Vc0 = 70,8; Vc1 = 70,2 kN; Asw,mín = 2,05 cm²/m (governa).
{
  const c = cort(0.20, 0.46, 25, 73.4, 38);
  ok('C1a. [BT Ex.1 V2 p.28] VRd2 θ = 38° (kN)', c.VRd2, 388.3, 0.01);
  ok('C1b. [BT Ex.1 V2 p.28] Vc1 interpolado (kN)', c.Vc, 70.2, 0.01);
  ok('C1c. [BT Ex.1 V2 p.29] Asw,mín (cm²/m)', c.aswMin / cm2, 2.05, 0.01);
  ok('C1d. [BT Ex.1 V2 p.29] Asw adotada = mínima (cm²/m)', c.aswNec / cm2, 2.05, 0.01);
}
// [BT] Ex.1 viga V1, item 14.3.4, p.33–34 [PDF 38–39]: bw = 35, d = 46, C25, θ = 38°, VSd = 83,4 < Vc0.
// Livro: VRd2 = 679,5 kN; Vc1 = Vc0 = 123,9 kN; Asw,mín = 3,58 cm²/m.
{
  const c = cort(0.35, 0.46, 25, 83.4, 38);
  ok('C2a. [BT Ex.1 V1 p.33] VRd2 θ = 38° (kN)', c.VRd2, 679.5, 0.01);
  ok('C2b. [BT Ex.1 V1 p.33] Vc1 = Vc0 (kN)', c.Vc, 123.9, 0.01);
  ok('C2c. [BT Ex.1 V1 p.33] Asw,mín (cm²/m)', c.aswMin / cm2, 3.58, 0.01);
}
// [BC] Ex. numérico 1, item 5.15.1.2, p.44–45 [PDF 48–49]: bw = 14, d = 46, C25, θ = 30°, VSd = 153,0 kN.
// Livro: VRd2 = 242,0 kN; Vc1 = 22,9 kN; Asw = 4,17 cm²/m (> Asw,mín = 1,44).
{
  const c = cort(0.14, 0.46, 25, 153.0, 30);
  ok('C3a. [BC Ex.1 p.44] VRd2 θ = 30° (kN)', c.VRd2, 242.0, 0.01);
  ok('C3b. [BC Ex.1 p.45] Vc1 (kN)', c.Vc, 22.9, 0.01);
  ok('C3c. [BC Ex.1 p.45] Asw/s (cm²/m)', c.aswNec / cm2, 4.17, 0.01);
  ok('C3d. [BC Ex.1 p.45] Asw,mín (cm²/m)', c.aswMin / cm2, 1.44, 0.01);
}
// [BC] Ex. numérico 2, itens 5.16.3.2 e 5.16.3.3, p.51–55 [PDF 55–59]: bw = 25, d = 80, C25; VSd,A = 232,1 e
// VSd,B = 262,1 kN. θ = 30°: VRd2 = 751,6; Vc1,A = 133,8; Vc1,B = 126,0; Asw calc < Asw,mín = 2,56 → mínima.
// θ = 45°: VRd2 = 867,9; Vc1,A = 137,0; Vc1,B = 130,6; Asw,A = 3,04 e Asw,B = 4,20 cm²/m (p.55 e resumo p.65).
{
  const a30 = cort(0.25, 0.80, 25, 232.1, 30), b30 = cort(0.25, 0.80, 25, 262.1, 30);
  ok('C4a. [BC Ex.2 p.52] VRd2 θ = 30° (kN)', a30.VRd2, 751.6, 0.01);
  ok('C4b. [BC Ex.2 p.52] Vc1 apoio A θ = 30° (kN)', a30.Vc, 133.8, 0.01);
  ok('C4c. [BC Ex.2 p.53] Vc1 apoio B θ = 30° (kN)', b30.Vc, 126.0, 0.01);
  ok('C4d. [BC Ex.2 p.53] Asw = mínima 2,56 cm²/m (apoio B)', b30.aswNec / cm2, 2.56, 0.01);
  const a45 = cort(0.25, 0.80, 25, 232.1, 45), b45 = cort(0.25, 0.80, 25, 262.1, 45);
  ok('C4e. [BC Ex.2 p.53] VRd2 Modelo II θ = 45° (kN)', a45.VRd2, 867.9, 0.01);
  ok('C4f. [BC Ex.2 p.54] Vc1 apoio A θ = 45° (kN)', a45.Vc, 137.0, 0.01);
  ok('C4g. [BC Ex.2 p.54] Vc1 apoio B θ = 45° (kN)', b45.Vc, 130.6, 0.01);
  ok('C4h. [BC Ex.2 p.55] Asw apoio A θ = 45° (cm²/m)', a45.aswNec / cm2, 3.04, 0.01);
  ok('C4i. [BC Ex.2 p.55] Asw apoio B θ = 45° (cm²/m)', b45.aswNec / cm2, 4.20, 0.01);
}

// ═══════════════════════════ 3. PILARES — 2ª ORDEM LOCAL (15.8) ═══════════════════════════════════════════
// [BP] Pilares de extremidade, C20, CA-50, γc = γf = 1,4 (item 16.2). fcd = 20/1,4 MPa.
const fcdK = 20000 / 1.4;
// Ex.1, item 16.2.1, p.42–46 [PDF 46–50]: 20 × 70, Nd = 1554 kN, le = 280 cm, dir. x (h = 20): M1d,A = −M1d,B = 2170 kN·cm
// < M1d,mín. Livro: λ = 48,4; M1d,mín = 3263,4 kN·cm; λ1 = 35; ν = 0,78; Md,tot = 5642,8 (curvatura) e 4943,1 kN·cm (κ).
{
  const base = { h: 0.20, Ac: 0.14, Nd: 1554, M1dA: 2170 * kNcm, rMBA: -1, le: 2.80, fcdK };
  const c = columnSecondOrder(base), k = columnSecondOrder({ ...base, opts: { metodo: 'kappa' } });
  ok('P1a. [BP Ex.1 p.43] λx', c.lambda, 48.4, 0.005);
  ok('P1b. [BP Ex.1 p.43] M1d,mín,x (kN·cm)', c.M1dmin / kNcm, 3263.4, 0.001);
  assert('P1c. [BP Ex.1 p.43] αb = 1,0 (M1d,A < M1d,mín, 15.8.2-d)', c.alphab === 1, String(c.alphab));
  ok('P1d. [BP Ex.1 p.43] λ1,x', c.lambda1, 35, 0.001);
  ok('P1e. [BP Ex.1 p.44] ν (livro 2 decimais)', c.nu, 0.78, 0.01);
  ok('P1f. [BP Ex.1 p.44] Md,tot curvatura aproximada (kN·cm)', c.Mdtot / kNcm, 5642.8, 0.005);
  ok('P1g. [BP Ex.1 p.46] Md,tot rigidez κ aproximada (kN·cm)', k.Mdtot / kNcm, 4943.1, 0.005);
}
// Ex.2, item 16.2.2, p.47–51 [PDF 51–55]: 20 × 70, Nd = 1554, le = 460 cm. Dir. y (h = 20, sem momento de 1ª ordem):
// λ = 79,6; Md,tot = 9685,4 (curvatura) e 9450,6 kN·cm (κ). Dir. x (h = 70, M1d,A = 3260 < M1d,mín = 5594,4):
// λ = 22,7 < λ1 = 35 → Md,tot,x = M1d,mín = 5594,4 kN·cm.
{
  const y = { h: 0.20, Ac: 0.14, Nd: 1554, M1dA: 0, le: 4.60, fcdK };
  const c = columnSecondOrder(y), k = columnSecondOrder({ ...y, opts: { metodo: 'kappa' } });
  ok('P2a. [BP Ex.2 p.47] λy', c.lambda, 79.6, 0.005);
  ok('P2b. [BP Ex.2 p.49] Md,tot,y curvatura (kN·cm)', c.Mdtot / kNcm, 9685.4, 0.005);
  ok('P2c. [BP Ex.2 p.51] Md,tot,y rigidez κ (kN·cm)', k.Mdtot / kNcm, 9450.6, 0.005);
  const x = columnSecondOrder({ h: 0.70, Ac: 0.14, Nd: 1554, M1dA: 3260 * kNcm, rMBA: -1, le: 4.60, fcdK });
  ok('P2d. [BP Ex.2 p.47] λx', x.lambda, 22.7, 0.005);
  ok('P2e. [BP Ex.2 p.49] Md,tot,x = M1d,mín (λ ≤ λ1) (kN·cm)', x.Mdtot / kNcm, 5594.4, 0.001);
}
// Ex.3, item 16.2.3, p.51–54 [PDF 55–58]: 20 × 40, Nd = 700 kN, le = 280. Dir. y (h = 40): M1d,A = M1d,B = 7000 kN·cm
// (mesma face, MB/MA = +1) > M1d,mín,y = 1890 → αb = 1,0; λ1 = 28,1 → 35; λ = 24,2 → Md,tot,y = 7000 kN·cm.
// Dir. x (h = 20, só M1d,mín = 1470): ν = 0,61; Md,tot,x = 2705,9 kN·cm (curvatura).
{
  const y = columnSecondOrder({ h: 0.40, Ac: 0.08, Nd: 700, M1dA: 70, rMBA: 1, le: 2.80, fcdK });
  ok('P3a. [BP Ex.3 p.52] αb,y = 1,0', y.alphab, 1.0, 0.001);
  ok('P3b. [BP Ex.3 p.52] λ1,y = 35 (28,1 < 35)', y.lambda1, 35, 0.001);
  ok('P3c. [BP Ex.3 p.51] λy', y.lambda, 24.2, 0.005);
  ok('P3d. [BP Ex.3 p.53] Md,tot,y = M1d,A (kN·cm)', y.Mdtot / kNcm, 7000, 0.001);
  const x = columnSecondOrder({ h: 0.20, Ac: 0.08, Nd: 700, M1dA: 0, le: 2.80, fcdK });
  ok('P3e. [BP Ex.3 p.52] M1d,mín,x (kN·cm)', x.M1dmin / kNcm, 1470.0, 0.001);
  ok('P3f. [BP Ex.3 p.52] ν (livro 2 decimais)', x.nu, 0.61, 0.01);
  ok('P3g. [BP Ex.3 p.53] Md,tot,x curvatura (kN·cm)', x.Mdtot / kNcm, 2705.9, 0.005);
}
// Ex.4, item 16.2.4, p.54–57 [PDF 58–61]: igual ao Ex.3 com M1d,A,y = −M1d,B,y = 7000 kN·cm (curvatura dupla):
// αb = 0,6 − 0,4 = 0,2 → 0,4 (limite inferior); λ1,y = 70,3.
{
  const y = columnSecondOrder({ h: 0.40, Ac: 0.08, Nd: 700, M1dA: 70, rMBA: -1, le: 2.80, fcdK });
  ok('P4a. [BP Ex.4 p.55] αb,y = 0,4 (limite inferior)', y.alphab, 0.4, 0.001);
  ok('P4b. [BP Ex.4 p.55] λ1,y', y.lambda1, 70.3, 0.005);
  assert('P4c. [BP Ex.4 p.55] λy = 24,2 < λ1 → sem 2ª ordem: Md,tot,y = 7000 kN·cm', Math.abs(y.Mdtot / kNcm - 7000) < 1e-6, String(y.Mdtot));
}
// [K] Ex.17, p.137–138 (dados de IBRACON "Comentários da NB-1"): 20 × 60, le = 300 cm, NSd = 210 tf (1 tf = 10 kN).
// Dir. x (h = 60): MA = 7,0 tf·m, MB = −4,0 tf·m → αb = 0,37 → 0,4; λx = 17,3; λ1,x = 64,2.
// Dir. y (h = 20): MA = 6,0, MB = −5,0 tf·m → αb = 0,4; λy = 52,0; λ1,y = 67,0.
{
  const fcdKimura = 25000 / 1.4;   // fck não interfere em λ, λ1, αb (só em ν, não comparado)
  const x = columnSecondOrder({ h: 0.60, Ac: 0.12, Nd: 2100, M1dA: 70, rMBA: -4 / 7, le: 3.0, fcdK: fcdKimura });
  const y = columnSecondOrder({ h: 0.20, Ac: 0.12, Nd: 2100, M1dA: 60, rMBA: -5 / 6, le: 3.0, fcdK: fcdKimura });
  ok('P5a. [K Ex.17 p.138] αb,x', x.alphab, 0.4, 0.001);
  ok('P5b. [K Ex.17 p.138] λx', x.lambda, 17.3, 0.005);
  ok('P5c. [K Ex.17 p.138] λ1,x', x.lambda1, 64.2, 0.005);
  ok('P5d. [K Ex.17 p.138] λy', y.lambda, 52.0, 0.005);
  ok('P5e. [K Ex.17 p.138] λ1,y', y.lambda1, 67.0, 0.005);
}

// ═══════════════════════════ 4. ELS — FLECHA E FISSURAÇÃO (17.3) ══════════════════════════════════════════
// [BV] item 16.12, p.59–62 [PDF 65–68]: viga biapoiada 20 × 80, vão 10 m, d = 77, As = 12,60 cm² (4φ20), A's = 0, C20,
// Ecs = 2554,5 kN/cm² (valor do livro), αe = 8,22; gk = qk = 10 kN/m, ψ2 = 0,3 → p = 13 kN/m, Ma = 16 250 kN·cm.
// Livro: Mr = 7072 kN·cm; xII = 22,58 cm; III = 383 483 cm⁴; (EI)eq = 1 078 538 307 kN·cm²; ai = 1,57 cm;
// αf = 2,00 − 0,68 = 1,32 (t0 = 1 mês); at = 3,64 cm.
{
  const Mr = crackingMoment({ b: 0.20, h: 0.80, fck: 20, alpha: 1.5, para: 'flecha' });
  ok('E1a. [BV 16.12 p.60] Mr (kN·cm)', Mr / kNcm, 7072, 0.005);
  const s2 = stage2Inertia({ b: 0.20, d: 0.77, As: 12.60 * cm2, alphaE: 8.22 });
  // A equação impressa pelo próprio livro (xII² + 10,358·xII − 797,5 = 0) tem raiz 23,53 cm, não 22,58: deslize
  // aritmético da fonte (III, estacionário em x, quase não muda). Esperado mantido; vai para PENDENTES, não reprova.
  pendente('E1b. [BV 16.12 p.60] xII (cm)', s2.x / cm, 22.58, 'erro da fonte: a equação do 2º grau impressa na mesma página dá xII = 23,53 cm (= código); o III do livro (383 483) usou 22,58 e difere só 0,13 %');
  ok('E1c. [BV 16.12 p.60] III (cm⁴)', s2.III / 1e-8, 383483, 0.005);
  const EI = equivalentStiffness({ Ecs: 2554.5e4, Ic: 0.2 * 0.8 ** 3 / 12, III: s2.III, Mr: 7072 * kNcm, Ma: 16250 * kNcm });
  ok('E1d. [BV 16.12 p.61] (EI)eq (kN·cm²)', EI * 1e4, 1078538307, 0.005);
  const ai = 5 * 13 * 10 ** 4 / (384 * EI) / cm;     // mecânica da viga biapoiada
  ok('E1e. [BV 16.12 p.61] flecha imediata (cm)', ai, 1.57, 0.01);
  const af = creepFactor({ t0: 1, rhoLinha: 0 });
  ok('E1f. [BV 16.12 p.61] αf (t0 = 1 mês)', af, 1.32, 0.01);
  ok('E1g. [BV 16.12 p.62] flecha final (cm)', ai * (1 + af), 3.64, 0.01);
}
// [BV] item 20.8, p.117–120 [PDF 123–126]: 14 × 70, C30, d = 65, As = 8,00, A's = 1,60 cm², d' = 3,0 cm, αe = 6,52,
// Ecs = 3221 kN/cm², Ma = 10 494 kN·cm. Livro: Mr = 4974 kN·cm; xII = 18,09 cm; III = 144 782 cm⁴;
// (EI)eq = 553 938 015 kN·cm²; ρ' = 0,001758; t0 = 5 meses: ξ = 1,12 (Tab. 17.1) → αf = 0,80889.
// PREMISSA: o livro homogeneiza A's com αe; o código usa (αe − 1) (desconta o concreto deslocado). Efeito < 0,5 %
// neste caso — comparado com 1 % (abaixo do arredondamento de 4 algarismos + premissa) e anotado.
{
  const Mr = crackingMoment({ b: 0.14, h: 0.70, fck: 30, alpha: 1.5, para: 'flecha' });
  ok('E2a. [BV 20.8 p.117] Mr (kN·cm)', Mr / kNcm, 4974, 0.005);
  const s2 = stage2Inertia({ b: 0.14, d: 0.65, As: 8.00 * cm2, AsLinha: 1.60 * cm2, dLinha: 0.03, alphaE: 6.52 });
  ok("E2b. [BV 20.8 p.118] xII (cm) — premissa αe×(αe−1) em A's", s2.x / cm, 18.09, 0.01);
  ok("E2c. [BV 20.8 p.118] III (cm⁴) — idem", s2.III / 1e-8, 144782, 0.01);
  const EI = equivalentStiffness({ Ecs: 3221e4, Ic: 0.14 * 0.7 ** 3 / 12, III: s2.III, Mr: 4974 * kNcm, Ma: 10494 * kNcm });
  ok('E2d. [BV 20.8 p.118] (EI)eq (kN·cm²)', EI * 1e4, 553938015, 0.01);
  ok('E2e. [BV 20.8 p.120] αf (t0 = 5 meses, ρ\' = 0,001758) — livro usa ξ(5) da Tab. 17.1', creepFactor({ t0: 5, rhoLinha: 0.001758 }), 0.80889, 0.01);
}
// [BV] item 21.7, p.142–143 [PDF 148–149]: 25 × 65, C45, d = 61, As = 10,00, A's = 2,40, d' = 3,5 cm, αe = 5,11.
// Livro: Mr = 10 034 kN·cm (Ic = 572 135 cm⁴); xII = 13,57 cm; III = 137 022 cm⁴ (mesma premissa αe em A's).
{
  const Mr = crackingMoment({ b: 0.25, h: 0.65, fck: 45, alpha: 1.5, para: 'flecha' });
  ok('E3a. [BV 21.7 p.142] Mr (kN·cm) — C45', Mr / kNcm, 10034, 0.005);
  const s2 = stage2Inertia({ b: 0.25, d: 0.61, As: 10.00 * cm2, AsLinha: 2.40 * cm2, dLinha: 0.035, alphaE: 5.11 });
  ok("E3b. [BV 21.7 p.143] xII (cm) — premissa αe×(αe−1) em A's", s2.x / cm, 13.57, 0.01);
  ok("E3c. [BV 21.7 p.143] III (cm⁴) — idem", s2.III / 1e-8, 137022, 0.01);
}
// [BV] item 17.1 Exemplo 1, p.66–70 [PDF 72–76]: longarina de ponte, C40, CA-50 (η1 = 2,25), φ = 25 mm,
// σsi = 25,18 kN/cm² (Md,ser/(0,85·d·As), dado do livro), fct,m = 3,51 MPa, ρri = 0,07264.
// Livro: w (fct,m) = 0,23 mm; w (ρr) = 0,11 mm; wk = 0,11 mm.
{
  const wk = crackWidth({ phi: 25, eta1: 2.25, sigmaS: 251.8, fctm: 3.51, rhoR: 0.07264 });
  okAbs('E4a. [BV 17.1 p.70] wk = mín. das duas expressões (mm) — livro 2 decimais', wk, 0.11, 0.005);
  // cada expressão isolada anulando a outra: fct,m → 0 torna a 1ª infinita; ρri → 0 torna a 2ª infinita
  const wRho = crackWidth({ phi: 25, eta1: 2.25, sigmaS: 251.8, fctm: 1e-12, rhoR: 0.07264 });
  okAbs('E4b. [BV 17.1 p.70] expressão com ρri (mm)', wRho, 0.11, 0.005);
  const wFct = crackWidth({ phi: 25, eta1: 2.25, sigmaS: 251.8, fctm: 3.51, rhoR: 1e-12 });
  okAbs('E4c. [BV 17.1 p.70] expressão com fct,m (mm)', wFct, 0.23, 0.005);
}

console.log(`\n${n} verificações, ${fails} falha(s).`);
if (pend.length) {
  console.log(`\nPENDENTES (${pend.length}) — não reprovam a bateria:`);
  for (const p of pend) console.log(`  · ${p.name}: obtido ${(+p.got).toPrecision(5)} × livro ${p.exp} (Δ ${p.d.toFixed(1)} %) — ${p.motivo}`);
}
console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
