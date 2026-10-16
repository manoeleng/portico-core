// test_lit_acoes.mjs — AÇÕES do PORTICO (vento NBR 6123:2023, combinações NBR 8681:2025, sismo NBR 15421:2023)
// contra EXEMPLOS RESOLVIDOS DA LITERATURA.   node tests/test_lit_acoes.mjs
//
// Regra: o valor esperado é o da FONTE, transcrito com página; nunca ajustado. A tolerância vem do arredondamento
// impresso na fonte (S2 com 2 casas → ±0,005; q em kN/m² com 2 casas → ±0,005; ábaco de Ca → ±0,02).
// Edição: a literatura usa NBR 6123:1988, NBR 8800:2008/NBR 8681:2003 e NBR 15421:2006. Só entram como caso as
// etapas idênticas na edição vigente (conferidas no PDF da edição vigente — ver cada bloco). Etapas que mudaram
// entram como "EDIÇÃO" (impresso, sem asserção). Divergência por provável defeito do código: lista PENDENTES
// (impressa, não derruba a bateria). Divergência por erro da própria fonte: "FONTE" (impressa).
//
// FONTES
//  [G]  GONÇALVES, R. M.; SALES, J. J.; MALITE, M.; MUNAIAR NETO, J. Ação do vento nas edificações: teoria e
//       exemplos. São Carlos: EESC-USP. Arquivo C:\projetos\_referencias\Acoes\Acao do Vento nas Edificacoes -
//       Teoria e Exemplos.pdf (página do livro = número impresso; "PDF n" = folha do arquivo, 2 páginas por folha).
//  [CB] PRAVIA, Z. M. C.; DREHMER, G. A.; MESACASA JR., E. Galpões para usos gerais. 4. ed. Rio de Janeiro:
//       IABr/CBCA, 2010 (Série Manual de Construção em Aço). Arquivo Aco\01_Manual_Galpoes_web.pdf, pp. 22–27.
//  [F]  FAKURY, R. H.; SILVA, A. L. R. C.; CALDAS, R. B. Dimensionamento de elementos estruturais de aço e mistos
//       de aço e concreto. São Paulo: Pearson, 2016/2017. Subitens 4.4.1 e 4.4.2, pp. 52–54.
//  [P]  PARISENTI, R. Estudo de análise dinâmica e métodos da NBR 15421 para projeto de edifícios submetidos a
//       sismos. Dissertação (Mestrado) — PPGEC/UFSC, 2011. Subitem 5.4.1, pp. 137–143.
//       https://repositorio.ufsc.br/bitstream/handle/123456789/96022/295653.pdf
//
// EQUIVALÊNCIA DE EDIÇÃO (conferida nos PDFs vigentes em 15/10/2026)
//  · NBR 6123:2023 Tab. 1 (bm, p) e Tab. 2 (Fr) = 1988 Tab. 1 para as categorias II, III e IV usadas aqui;
//    Tab. 3 (2023) dá os mesmos S2 de 10 a 50 m. NOVO na 2023: S2 constante abaixo de 5 m (Tab. 3, linha "< 5").
//  · NBR 6123:2023 Tab. 6 (paredes) e Tab. 7 (telhado 2 águas, h/b ≤ 1/2) = 1988 Tab. 4 e 5 nas células usadas.
//  · NBR 6123:2023 Tab. 12 (shed) = 1988 Tab. 7 ([G] Tab. 3.6) em θ = 10°/15°, todas as direções; DIFERE em
//    θ = 30°, α = 180°, z* (1988: −0,1; 2023: +0,1) → célula excluída.
//  · S3: os VALORES 1,00 e 0,95 são os mesmos, mas os GRUPOS foram renumerados: 1988 grupo 2 (alto fator de
//    ocupação) = 2023 grupo 3 (S3 = 1,00); 1988 grupo 3 (depósito) = 2023 grupo 4 (S3 = 0,95).
//  · Cpi 6.3.2.1 (2023) = 6.2.5 (1988): duas faces opostas +0,2/−0,3; quatro faces −0,3/0.
//  · NBR 8681:2025 Tab. 4 (vento 1,4; demais 1,5), Tab. 6 (ψ) = Fakury Tab. 4.4/4.5. Tab. 2 (permanentes
//    agrupadas 1,35) e Tab. 5 (variáveis agrupadas 1,5) MUDARAM em relação à 8800:2008 Tab. 1 usada em [F] 4.4.2.
//  · NBR 15421:2023 Tab. 3 (Ca, Cv) = 2006; patamar 2,5·ags0 igual. MUDOU: ags1 = 0,75·Cv·ag, rampa inicial e
//    cantos do espectro (0,04 / 0,3 / 2,0·Cv/Ca contra 0,08 / 0,4·Cv/Ca na 2006). Só períodos no patamar das
//    DUAS edições são comparáveis.
import fs from 'node:fs';
import { windLoad, caEdificio, cpeTelhadoMultiplo, responseSpectrum } from '../assistant/loads.js';
import { nbrCombinations } from '../js/design/combinations_nbr.js';
import { buildSpectrum15421, sa15421 } from '../js/design/spectra/nbr15421.js';

let fails = 0, n = 0;
const PEND = [], FONTE = [], EDICAO = [];
const pct = (got, exp) => exp === 0 ? 0 : (got - exp) / Math.abs(exp) * 100;
const okRel = (name, got, exp, tol) => { n++; const p = Math.abs(got - exp) <= tol * Math.abs(exp); if (!p) fails++;
  console.log(`${p ? 'ok  ' : 'FAIL'} ${name}: obtido=${+got.toFixed(4)} esperado=${exp} Δ=${pct(got, exp).toFixed(2)}% (tol ${(tol * 100).toFixed(2)}%)`); };
const okAbs = (name, got, exp, tol) => { n++; const p = Math.abs(got - exp) <= tol; if (!p) fails++;
  console.log(`${p ? 'ok  ' : 'FAIL'} ${name}: obtido=${+got.toFixed(4)} esperado=${exp} Δ=${pct(got, exp).toFixed(2)}% (tol ±${tol})`); };
const ok = (name, cond, info = '') => { n++; if (!cond) fails++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${info ? ' · ' + info : ''}`); };

const R = JSON.parse(fs.readFileSync(new URL('../presets/brasil/rules.json', import.meta.url), 'utf8'));
const W = R.loads.wind;
const vento = (h, w, theta = 0) => windLoad({ wind: { S1: 1.0, ...w }, geometry: { roof_slope_deg: theta } }, R, h);
// tolerância de Vk e q quando a fonte arredonda S2 a 2 casas: δS2 = 0,005/S2 (Vk ∝ S2; q ∝ S2²)
const tS2 = (s2) => 0.005 / s2;

console.log('══ VENTO — NBR 6123 ══');
// ── V1. [G] Exemplo 2, p. 28–29 (PDF 19): edifício 25 × 25 × 50 m, Americana-SP; V0 = 45, S1 = S3 = 1,0,
//        categoria IV, classe B. Tabela 2.5 (S2 e Vk por nível).
{
  const tab = [[10, 0.83, 37.35], [20, 0.91, 40.95], [30, 0.96, 43.20], [40, 0.99, 44.55], [50, 1.02, 45.90]];
  for (const [z, s2, vk] of tab) {
    const r = vento(z, { V0_m_s: 45, categoria: 'IV', grupoS3: '3', a_m: 25, b_m: 25 });
    okAbs(`V1. [G] Ex.2 p.29 z=${z} m: S2 (IV-B)`, r.S2, s2, 0.0051);
    okRel(`V1. [G] Ex.2 p.29 z=${z} m: Vk`, r.Vk, vk, tS2(s2) + 0.001);
  }
}
// ── V2. [G] Exemplo 1, p. 27–28 (PDF 18–19): galpão 30 × 60 m, h = 15 m, São Carlos, V0 = 40, S1 = S3 = 1, cat. IV.
//        0°: face frontal 30 m → classe B, S2 = 0,88, Vk = 35,2 m/s. 90°: face 60 m → classe C, S2 = 0,83, Vk = 33,2.
{
  const r = vento(15, { V0_m_s: 40, categoria: 'IV', grupoS3: '3', a_m: 60, b_m: 30 });
  ok('V2. [G] Ex.1 p.27: classe por face frontal — 90° (60 m) C, 0° (30 m) B', r.classe === 'C' && r.classe_empena === 'B', `${r.classe}/${r.classe_empena}`);
  okAbs('V2. [G] Ex.1 p.27: S2 vento 0° (classe B, z = 15 m)', r.S2_empena, 0.88, 0.0051);
  okRel('V2. [G] Ex.1 p.28: Vk vento 0°', 40 * r.S2_empena, 35.2, tS2(0.88) + 0.001);
  // classe C: a fonte imprime 0,83; a própria [G] (3.3.2, p. 70) dá 0,84 para o MESMO caso (IV-C, 15 m) e a
  // NBR 6123:2023 Tab. 3 (e 1988 Tab. 2) também: 0,84. Erro de impressão da fonte → não vira asserção.
  FONTE.push(`V2. [G] Ex.1 p.27 S2 classe C (IV, 15 m) = 0,83 na fonte; código ${r.S2} (Δ ${pct(r.S2, 0.83).toFixed(1)} %). ` +
    `A mesma [G] p.70 e a Tab. 3 da 2023 dão 0,84 → erro da fonte, não do código.`);
}
// ── V3. [G] 3.3.1, p. 64–68 (PDF 37–39): galpão 20 × 40 m, pé-direito 8 m, cumeeira 10 m, θ ≈ 10° (adotado 10°),
//        São Carlos, V0 = 40, S1 = S3 = 1, cat. IV, classe B, h = 10 m → S2 = 0,83, Vk = 33,2 m/s, q = 675,6 N/m².
//        h/b = 0,4, a/b = 2 → Tab. 4/5 (1988) = Tab. 6/7 (2023). Cpi extremos adotados: +0,3 / −0,5 (d.5, p. 68).
{
  const r = vento(10, { V0_m_s: 40, categoria: 'IV', grupoS3: '3', a_m: 40, b_m: 20, cpi: [0.3, -0.5] }, 10);
  okAbs('V3. [G] 3.3.1 p.64: S2 (IV-B, h = 10 m)', r.S2, 0.83, 0.0051);
  okRel('V3. [G] 3.3.1 p.65: Vk', r.Vk, 33.2, tS2(0.83) + 0.001);
  okRel('V3. [G] 3.3.1 p.65: q = 0,613·Vk²', r.q_Nm2, 675.6, 2 * tS2(0.83) + 0.001);
  const cw = r.cpe_paredes, cr = r.cpe_telhado;
  const cells = [['90° parede A (barlavento)', cw.A, 0.7], ['90° parede B (sotavento)', cw.B, -0.5], ['90° C1/D1', cw.C1D1, -0.9],
    ['90° C2/D2', cw.C2D2, -0.5], ['0° A1/B1', cw.A1B1, -0.8], ['0° A2/B2', cw.A2B2, -0.4], ['0° A3/B3 (a/b = 2)', cw.A3B3, -0.2],
    ['0° C (barlavento)', cw.C, 0.7], ['0° D', cw.D, -0.3], ['90° telhado EF(I)', cr.EFI, -1.2], ['90° telhado GH(J)', cr.GHJ, -0.4],
    ['0° telhado EG', cr.EG, -0.8], ['0° telhado FH', cr.FH, -0.6], ['0° telhado IJ', cr.IJ, -0.2]];
  for (const [nm, got, exp] of cells) okAbs(`V3. [G] 3.3.1 p.65–66: Cpe ${nm}`, got, exp, 1e-9);
  okAbs('V3. [G] 3.3.1 p.66: x0 = maior(b/3; a/4) = 10 m (≤ 2h)', r.x0_m, 10, 1e-9);
  // e.1 (p. 68): coeficientes finais Cp = Cpe − Cpi, vento a 90° — pressão = q·Cp
  const s03 = r.presiones_por_cpi.find(s => s.cpi === 0.3).presiones, s05 = r.presiones_por_cpi.find(s => s.cpi === -0.5).presiones;
  for (const [nm, got, cp] of [['Cpi +0,3: A', s03['1'], 0.4], ['Cpi +0,3: B', s03['4'], -0.8], ['Cpi +0,3: EF', s03.EFI, -1.5],
    ['Cpi +0,3: GH', s03.GHJ, -0.7], ['Cpi −0,5: A', s05['1'], 1.2], ['Cpi −0,5: EF', s05.EFI, -0.7], ['Cpi −0,5: GH', s05.GHJ, 0.1]])
    okAbs(`V3. [G] 3.3.1 p.68: Cp 90° ${nm} = p/q`, got / r.q_Nm2, cp, 1e-3);
}
// ── V4. [G] 3.3.2, p. 69–71 (PDF 39–40): shed 72 × 35 m, h = 13,5 m (adotado 15 m), V0 = 40, cat. IV, S1 = S3 = 1;
//        0°/180°: classe B, S2 = 0,88, q = 759,5 N/m²; 90°: classe C, S2 = 0,84, q = 692,1 N/m². θ = 18° → adotado 15°.
{
  const r = vento(15, { V0_m_s: 40, categoria: 'IV', grupoS3: '3', a_m: 72, b_m: 35 });
  ok('V4. [G] 3.3.2 p.70: classes 90° C / 0° B', r.classe === 'C' && r.classe_empena === 'B');
  okAbs('V4. [G] 3.3.2 p.70: S2 90° (IV-C, 15 m)', r.S2, 0.84, 0.0051);
  okAbs('V4. [G] 3.3.2 p.69: S2 0°/180° (IV-B, 15 m)', r.S2_empena, 0.88, 0.0051);
  okRel('V4. [G] 3.3.2 p.70: q 90°', r.q_Nm2, 692.1, 2 * tS2(0.84) + 0.001);
  okRel('V4. [G] 3.3.2 p.70: q 0°/180°', r.q_empena_Nm2, 759.5, 2 * tS2(0.88) + 0.001);
  // [G] Tabela 3.6, p. 51 (PDF 30) = NBR 6123:1988 Tab. 7, linhas θ = 10° e 15° (idênticas à 2023 Tab. 12)
  const lit = { 10: { a0: [0.6, -0.6, -0.5, -0.2, 0.2, -0.2, 0.2, -0.2], a180: [-0.2, -0.1, -0.2, -0.1, -0.2, -0.2, -0.4, -0.2], a90: [-0.8, -0.6, -0.2] },
    15: { a0: [0.6, -0.7, -0.6, -0.2, 0.1, -0.2, 0.1, -0.3], a180: [-0.2, -0.1, -0.2, -0.1, -0.2, -0.2, -0.5, -0.2], a90: [-0.8, -0.6, -0.2] },
    30: { a0: [0.7, -0.7, -0.6, -0.4, 0.1, -0.2, 0.1, -0.2], a90: [-0.9, -0.6, -0.3] } };
  const K = ['a', 'b', 'c', 'd', 'm', 'n', 'x', 'z'];
  for (const [th, L] of Object.entries(lit)) for (const [dir, al] of [['a0', 0], ['a180', 180], ['a90', 90]]) {
    if (!L[dir]) continue;
    const ce = cpeTelhadoMultiplo(W, 'shed', { alpha: al, theta: +th }).ce;
    const got = dir === 'a90' ? [ce.b1, ce.b2, ce.b3] : K.map(k => ce[k]);
    ok(`V4. [G] Tab. 3.6 p.51: shed θ = ${th}°, α = ${al}°`, got.every((v, i) => Math.abs(v - L[dir][i]) < 1e-9), `obtido ${JSON.stringify(got)} esperado ${JSON.stringify(L[dir])}`);
  }
  const z30 = cpeTelhadoMultiplo(W, 'shed', { alpha: 180, theta: 30 }).ce;
  EDICAO.push(`V4. Shed θ = 30°, α = 180°: [G] Tab. 3.6 (1988) z* = −0,1, n* = −0,1; código ${JSON.stringify({ n: z30.n, z: z30.z })} = NBR 6123:2023 Tab. 12 (z* = +0,1, conferido no PDF p. 26). Célula mudou de edição — não comparada.`);
}
// ── V5. [G] 3.5, p. 87–90 (PDF 48–50): edifício 15 × 30 × 50 m, V0 = 45, S1 = S3 = 1, cat. II, classe B,
//        baixa turbulência. DV.1: ℓ1 = 30, ℓ2 = 15 → Ca = 1,35; DV.2: ℓ1 = 15, ℓ2 = 30 → Ca = 1,00.
//        Tabela por trecho (p. 88): S2, Vk, q [kN/m²]. qeq DV.1 = Ca·q·ℓ1 (figura p. 89).
{
  const tab = [[10, 0.98, 44.10, 1.19, 48.20], [20, 1.04, 46.80, 1.34, 54.27], [30, 1.08, 48.60, 1.45, 58.73], [40, 1.11, 49.95, 1.53, 61.97], [50, 1.13, 50.85, 1.59, 64.40]];
  const ca1 = caEdificio(W, { h: 50, l1: 30, l2: 15 }), ca2 = caEdificio(W, { h: 50, l1: 15, l2: 30 });
  okAbs('V5. [G] 3.5 p.87: Ca DV.1 (ℓ1/ℓ2 = 2, h/ℓ1 = 1,67, Fig. 4)', ca1.Ca, 1.35, 0.02);
  okAbs('V5. [G] 3.5 p.87: Ca DV.2 (ℓ1/ℓ2 = 0,5, h/ℓ1 = 3,33, Fig. 4)', ca2.Ca, 1.00, 0.02);
  for (const [z, s2, vk, q, qeq] of tab) {
    const r = vento(z, { V0_m_s: 45, categoria: 'II', grupoS3: '3', a_m: 30, b_m: 15 });
    okAbs(`V5. [G] 3.5 p.88 z=${z} m: S2 (II-B)`, r.S2, s2, 0.0051);
    okRel(`V5. [G] 3.5 p.88 z=${z} m: Vk`, r.Vk, vk, tS2(s2) + 0.001);
    okRel(`V5. [G] 3.5 p.88 z=${z} m: q`, r.q_Nm2 / 1000, q, 2 * tS2(s2) + 0.005 / q);
    okRel(`V5. [G] 3.5 p.89 z=${z} m: qeq DV.1 = Ca·q·ℓ1 [kN/m]`, ca1.Ca * r.q_Nm2 / 1000 * 30, qeq, 0.02 / 1.35 + 2 * tS2(s2) + 0.005 / q);
  }
  FONTE.push('V5. [G] 3.5 p.89: Fa = 2905,4 kN soma 57,24 kN/m no trecho 2, mas a figura (e Ca·q·ℓ1 = 1,35·1,34·30) dá 54,27 → total coerente 2875,7 kN; a coluna qeq da tabela da p. 88 (35,77…) usa Ca = 1,0. Não usados como oráculo.');
}
// ── V6. [CB] pp. 22–27: galpão 15 × 54 m, pé-direito 6 m, cumeeira 7,32 m, θ = 10°, São Paulo, V0 = 40, S1 = 1,
//        cat. III, classe C (bm 0,93; Fr 0,95; p 0,115), S3 = 0,95 (depósito → 2023 grupo 4).
//        S2(7,3 m) = 0,85; Vk = 32,30 m/s; q = 639,54 N/m². h/b = 0,4; a/b = 3,6. Cpi +0,2 / −0,3.
{
  const r = vento(7.32, { V0_m_s: 40, categoria: 'III', grupoS3: '4', a_m: 54, b_m: 15, cpi: [0.2, -0.3] }, 10);
  ok('V6. [CB] p.23: classe C (54 m)', r.classe === 'C');
  okAbs('V6. [CB] p.23: S2(7,3 m) (III-C)', r.S2, 0.85, 0.0051);
  okRel('V6. [CB] p.23: Vk(7,3 m)', r.Vk, 32.30, tS2(0.85) + 0.001);
  okRel('V6. [CB] p.23: q(7,3 m)', r.q_Nm2, 639.54, 2 * tS2(0.85) + 0.001);
  const cw = r.cpe_paredes, cr = r.cpe_telhado;
  for (const [nm, got, exp] of [['Fig.30 0° A1/B1', cw.A1B1, -0.8], ['Fig.30 0° A2/B2', cw.A2B2, -0.4], ['Fig.30 0° A3/B3', cw.A3B3, -0.2],
    ['Fig.30 0° C', cw.C, 0.7], ['Fig.30 0° D', cw.D, -0.3], ['Fig.31 90° A', cw.A, 0.7], ['Fig.31 90° B', cw.B, -0.5],
    ['Fig.31 90° C1/D1', cw.C1D1, -0.9], ['Fig.31 90° C2/D2', cw.C2D2, -0.5], ['Fig.32 cpe médio paredes', cw.cpe_medio, -1.0],
    ['Fig.33 0° E/G', cr.EG, -0.8], ['Fig.33 0° F/H', cr.FH, -0.6], ['Fig.33 0° I/J', cr.IJ, -0.2], ['Fig.34 90° E/F/I', cr.EFI, -1.2], ['Fig.34 90° G/H/J', cr.GHJ, -0.4]])
    okAbs(`V6. [CB] pp.24–25: Cpe ${nm}`, got, exp, 1e-9);
  // Figs. 41/42 (p. 26): Cpe(90°) + Cpi; Tabela 01 (p. 27): F = 6 m·q·Cp, hipótese II telhado barlavento 5,38 kN/m
  const s2 = r.presiones_por_cpi.find(s => s.cpi === 0.2).presiones, s3 = r.presiones_por_cpi.find(s => s.cpi === -0.3).presiones;
  for (const [nm, got, cp] of [['Fig.41 Cpi +0,2: A', s2['1'], 0.5], ['Fig.41 Cpi +0,2: B', s2['4'], -0.7], ['Fig.41 Cpi +0,2: EF', s2.EFI, -1.4],
    ['Fig.41 Cpi +0,2: GH', s2.GHJ, -0.6], ['Fig.42 Cpi −0,3: A', s3['1'], 1.0], ['Fig.42 Cpi −0,3: B', s3['4'], -0.2],
    ['Fig.42 Cpi −0,3: EF', s3.EFI, -0.9], ['Fig.42 Cpi −0,3: GH', s3.GHJ, -0.1]])
    okAbs(`V6. [CB] p.26: Cp 90° ${nm} = p/q`, got / r.q_Nm2, cp, 1e-3);
  okRel('V6. [CB] p.27 Tab.01: hipótese II, telhado barlavento 6·q·1,4 [kN/m]', Math.abs(s2.EFI) * 6 / 1000, 5.38, 2 * tS2(0.85) + 0.005 / 5.38);
  okRel('V6. [CB] p.27 Tab.01: hipótese II, telhado sotavento 6·q·0,6 [kN/m]', Math.abs(s2.GHJ) * 6 / 1000, 2.30, 2 * tS2(0.85) + 0.005 / 2.30);
  // x0 (comprimento de A1/B1 e E/G): [CB] p.24 usa h = 6 m (pé-direito) → min(a/4 = 13,5; 2h = 12) = 12 m.
  // corrigido 15/10/2026 (era PENDENTE): h do Detalhe I da Tab. 7 = altura do beiral (pé-direito 6 m) em h/b e no 2h;
  // a altura do topo segue em z (S2). Com h_beiral_m = 6: x0 = min(a/4 = 13,5; 2h = 12) = 12 m.
  { const rb = vento(7.32, { V0_m_s: 40, categoria: 'III', grupoS3: '4', a_m: 54, b_m: 15, cpi: [0.2, -0.3], h_beiral_m: 6 }, 10);
    okAbs('V6. [CB] p.24: x0 = 12 m (2h com h = pé-direito 6 m)', rb.x0_m, 12, 1e-9);
    okAbs('V6. [CB] p.23: q com h do topo inalterado', rb.q_Nm2, r.q_Nm2, 1e-9); }
  EDICAO.push(`V6. [CB] p.23: S2(3 m) = 0,77 e q(3 m) = 524,82 N/m² pela fórmula de 1988 em z = 3 m; a NBR 6123:2023 Tab. 3 manda S2 constante abaixo de 5 m → código S2 = ${vento(3, { V0_m_s: 40, categoria: 'III', grupoS3: '4', a_m: 54, b_m: 15 }).S2} (Tab. 3: 0,82). Mudou de edição — não comparado.`);
}

console.log('\n══ COMBINAÇÕES — NBR 8681:2025 ══');
// ── C1. [F] 4.4.1, pp. 52–54: treliça de cobertura, edifício comercial. Forças axiais características [kN]
//        (permanente, sobrecarga de cobertura, equipamento, vento). γ separados: aço 1,25; demais variáveis 1,5;
//        vento 1,4; G favorável 1,0. ψ0: sobrecarga em cobertura 0,8; equipamento (comercial) 0,7.
//        Mapeamento: sobrecarga → Qcob; equipamento → Q (uso 'comercial'); vento → V. Família 'steel'.
{
  // [Ncp, Nsc, Neq, Nve, máximo gravitacional de projeto (maior |N| das 2 primeiras combinações), 1,0G + 1,4V] — tabela p. 53
  const barras = { AD: [-33.56, -67.11, -67.11, 95.00, -223.15, 99.44], DB: [-22.37, -44.74, -67.11, 65.00, -182.32, 68.63],
    BE: [-22.37, -44.74, -67.11, 70.00, -182.32, 75.63], EC: [-33.56, -67.11, -67.11, 84.99, -223.15, 85.43],
    AF: [30.00, 60.00, 60.00, -93.87, 199.50, -101.42], FC: [30.00, 60.00, 60.00, -71.54, 199.50, -70.16],
    BF: [10.00, 20.00, 60.00, -33.53, 126.50, -36.94], DF: [-11.19, -22.37, 0, 50.00, -47.54, 58.81], FE: [-11.19, -22.37, 0, 25.00, -47.54, 23.81] };
  const c = nbrCombinations({ family: 'steel', cases: ['G', 'Qcob', 'Q', 'V'], uso: 'comercial' });
  const has = (pred) => c.elu.some(x => pred(x.factores));
  ok('C1. [F] p.53: combinação 1,0G + 1,4V (G favorável, vento principal) existe', has(f => f.G === 1 && f.V === 1.4 && Object.keys(f).length === 2));
  ok('C1. [F] p.53: sobrecarga principal → γq = 1,5 e equipamento 1,5·0,7 = 1,05', has(f => f.Qcob === 1.5 && Math.abs(f.Q - 1.05) < 1e-9));
  ok('C1. [F] p.53: equipamento principal → γq = 1,5 e sobrecarga 1,5·0,8 = 1,2', has(f => f.Q === 1.5 && Math.abs(f.Qcob - 1.2) < 1e-9));
  const N = (f, b) => (f.G ?? 0) * b[0] + (f.Qcob ?? 0) * b[1] + (f.Q ?? 0) * b[2] + (f.V ?? 0) * b[3];
  const fv = c.elu.find(x => x.factores.G === 1 && x.factores.V === 1.4).factores;
  for (const [nm, b] of Object.entries(barras)) okAbs(`C1. [F] p.53 barra ${nm}: 1,0G + 1,4V`, N(fv, b), b[5], 0.006);
  // Combinações gravitacionais: [F] exclui o vento (favorável, NBR 8681 5.1.4.2) e usa γg = 1,25 (aço, Tab. 1).
  // O código só oferece permanentes agrupadas (1,35 ≥ 1,25), logo sua envoltória deveria ser AO MENOS tão severa.
  const pior = [];
  for (const [nm, b] of Object.entries(barras)) {
    const ex = b[4], env = ex < 0 ? Math.min(...c.elu.map(x => N(x.factores, b))) : Math.max(...c.elu.map(x => N(x.factores, b)));
    if (Math.abs(env) < Math.abs(ex) - 0.01) pior.push(`${nm}: código ${env.toFixed(2)} × [F] ${ex} (Δ ${pct(env, ex).toFixed(1)} %)`);
  }
  if (pior.length) PEND.push('C1. [F] 4.4.1 p.53: envoltória ELU do código MENOS severa que a fonte nas barras ' + pior.join('; ') +
    '. Causa: nbrCombinations sempre põe o vento como secundário (0,84V) quando ele existe — não gera a combinação sem a variável ' +
    'secundária favorável (NBR 8681:2025 5.1.4.2: variáveis favoráveis não entram). Contra a segurança. Correção sugerida: emitir ' +
    'também cada combinação sem o vento secundário (1,35G + 1,5Qcob + 1,05Q etc.).');
  // ELS frequente [F] p.53: δF = 0,80 + 0,7·1,60 + 0,4·2,00 = 2,72 cm; 0,80 + 0,6·2,00 + 0,6·1,60 = 2,96 cm (governa)
  const d = [0.80, 1.60, 2.00, -1.80];
  const dl = c.freq.map(x => N(x.factores, d));
  ok('C1. [F] p.53: ELS frequente com sobrecarga principal = 2,72 cm', dl.some(v => Math.abs(v - 2.72) < 0.005), dl.map(v => v.toFixed(3)).join(' | '));
  okAbs('C1. [F] p.53: ELS frequente, envoltória δF', Math.max(...dl), 2.96, 0.005);
  EDICAO.push('C1. [F] 4.4.2 p.54 (ações agrupadas, 8800:2008: γg = γq = 1,40 com variáveis ≤ 5 kN/m²): a NBR 8681:2025 Tab. 2 fixa 1,35 e a Tab. 5, 1,5 — mudou de edição, não comparado. ' +
    '[F] 4.4.1 usa γg = 1,25 (aço, Tab. 1 separada), opção que o código não oferece (só agrupadas 1,35, limitação já registrada na ficha BR-8681).');
}

console.log('\n══ SISMO — NBR 15421:2023 ══');
// ── S1. [P] 5.4.1.1–5.4.1.3, pp. 137–143: ag = 0,15 g, terreno D, I = 1 → Ca = 1,5; Cv = 2,2 (Tab. 2 da 2006 = Tab. 3
//        da 2023). Ex. 1 (1 pav., W = 1647 kN, Ta = 0,118 s; SAP T = 0,14 s): Sa/g = Cs(R=1) = 0,563 (patamar),
//        Hmax = 927 kN; R = 3 → 309 kN. Ex. 2 (3 pav., W = 4941 kN, Ta = 0,316 s): Cs = 0,563; Hmax = 2781 → 927 kN.
//        Modos T2 = 0,170 s, T3 = 0,118 s (patamar). Patamar da 2023: 0,04·Cv/Ca = 0,059 s a 0,3·Cv/Ca = 0,44 s;
//        da 2006: 0,117 s a 0,587 s → T = 0,118 / 0,14 / 0,17 / 0,316 s estão no patamar das DUAS edições.
{
  const s = buildSpectrum15421({ ag: 0.15, classe: 'D', categoria: 'I', R: 3 });
  okAbs('S1. [P] p.138: Ca (D, 0,15 g)', s.params.Ca, 1.5, 1e-9);
  okAbs('S1. [P] p.138: Cv (D, 0,15 g)', s.params.Cv, 2.2, 1e-9);
  for (const T of [0.118, 0.14, 0.17, 0.316]) okAbs(`S1. [P] pp.138–141: Sa(${T} s)/g (patamar 2,5·Ca·ag)`, sa15421(T, { ag: 0.15, Ca: 1.5, Cv: 2.2 }), 0.563, 0.0005);
  okAbs('S1. [P] p.140: I/R (I = 1, R = 3)', s.fatorForcas, 1 / 3, 1e-9);
  okAbs('S1. [P] p.138: Hmax Ex.1, R = 1 [kN]', 1647 * sa15421(0.118, { ag: 0.15, Ca: 1.5, Cv: 2.2 }), 927, 1);
  okAbs('S1. [P] p.138: Hmax Ex.1, R = 3 [kN]', 1647 * sa15421(0.118, { ag: 0.15, Ca: 1.5, Cv: 2.2 }) * s.fatorForcas, 309, 1);
  okAbs('S1. [P] p.141: Hmax Ex.2, R = 3 [kN]', 4941 * sa15421(0.316, { ag: 0.15, Ca: 1.5, Cv: 2.2 }) * s.fatorForcas, 927, 1);
  // mesmo espectro pelo caminho do assistente (preset Brasil)
  const a = responseSpectrum({ seismic: { ag: 0.15, soil: 'D', category: 'I', R: 3 } }, R);
  okAbs('S1. [P] p.139: assistente Sa(0,14 s)', a.curva.find(p => Math.abs(p.T - 0.14) < 1e-9).Sa, 0.563, 0.0005);
  ok('S1. ag = 0,15 g → zona 4, categoria sísmica C (NBR 15421 Tab. 1/5; [P] usa zona 4 para 0,15 g)', s.params.zona === 4 && s.params.catSismica === 'C');
  EDICAO.push(`S1. [P] p.143: modo 1, T1 = 0,479 s, está no patamar da 2006 (Sa = 0,563 g) mas no ramo ags1/T da 2023 (ags1 = 0,75·Cv·ag): código Sa = ${sa15421(0.479, { ag: 0.15, Ca: 1.5, Cv: 2.2 }).toFixed(4)} g. Mudou de edição — não comparado. Rampa, cantos e ramo 1/T² da 2023 não têm exemplo publicado (LACUNA).`);
}

const lista = (t, a) => { if (a.length) { console.log(`\n── ${t} (${a.length}) ──`); a.forEach(s => console.log(' · ' + s)); } };
lista('PENDENTES — provável defeito do código (não derrubam a bateria)', PEND);
lista('FONTE — erro/inconsistência da própria literatura', FONTE);
lista('EDIÇÃO — etapa que mudou na edição vigente (não comparada)', EDICAO);
console.log(fails ? `\n${fails} FALHA(S) em ${n} verificações` : `\nOK — ${n} verificações`);
process.exit(fails ? 1 : 0);
