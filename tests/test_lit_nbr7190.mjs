// test_lit_nbr7190.mjs — madeira (NBR 7190-1:2022) contra exemplos PUBLICADOS, complementar a
// test_nbr7190.mjs (Dias Ex.1–4 ELU) e test_timber_deflection.mjs (cálculo manual).
//   node tests/test_lit_nbr7190.mjs
//
// Fontes (valor esperado = o impresso; NUNCA ajustado):
//   [DIAS]   Dias, Calil Jr, Lahr, Martins (2019), Estruturas de Madeira, Elsevier, cap. 4.6 —
//            escrito sobre o texto-base de 2018 (mesmas Tab. 20/21 de fluência e flechas, mesmo γw).
//            Exemplo 1 (viga do mezanino, ELS: PDF p. 77) e Exemplo 2 (terça, cisalhamento e
//            flechas: PDF p. 79). O livro não tem paginação impressa no e-book.
//   [UESPI]  Guedes, L. F. S. (2025), "Comparação das versões 1997 e 2022 da NBR 7190 ...",
//            TCC Eng. Civil, UESPI (orient. C. F. C. Fernandes), Anexo IB — dimensionamento pela
//            NBR 7190-1:2022: terça pp. 169–171, barra comprimida pp. 171–172, tracionada pp. 172–173.
//            Fonte acadêmica de nível inferior a livro (TCC aprovado em banca) — usada porque é o
//            único exemplo numérico localizado com kc/βc, γw = 1,4 na tração e βM da edição 2022.
//   [MOLINA] Calil Jr & Molina (2010), Coberturas em Estruturas de Madeira — Exemplos de Cálculo,
//            Pini, treliça Howe 12 m: kmod p. 41, tração do banzo inferior p. 60. Edição: NBR 7190:1997.
//
// EDIÇÃO, caso a caso:
//   · ELS (Dias): Tab. 20 (φ) e Tab. 21 (faixas) iguais às da 2022; o livro imprime δfin pela forma
//     EN 1995 δQ·(1 + ψ2·φ) → comparado com `finEN` (informativo); a forma 2022 δQ·ψ2·(1 + φ) é
//     impressa como recálculo, sem asserção (já coberta em test_timber_deflection.mjs).
//   · Cisalhamento (Dias): τd = 1,5·Vd/A e γw = 1,8 inalterados na 2022.
//   · UESPI: calculado pela própria 2022 (kc, βc = 0,2, kM = 0,7, γw = 1,4 na tração, Tab. 8 βM).
//   · Molina (1997): tração com γwt = 1,8 e ft0,k = fc0,k/0,77 na 1997; o livro adota ft0,d = fc0,d =
//     1,60 kN/cm² (kmod = 0,7·1,0·0,8 = 0,56, com kmod3 de 2ª categoria). Na 2022 (Tab. 2, ft0,k = fc0,k;
//     γw = 1,4) o mesmo número sai com kmod = 0,56 — o kmod do livro (com kmod3, extinto em 2022 para
//     serrada) é passado como ENTRADA explícita. Só a tensão atuante e ft0,d são comparadas.
// TOLERÂNCIA: livros com aritmética explícita → ±0,5 unidade do último dígito impresso; tabelas do
//   TCC (planilha com valores arredondados a 2 casas em cada linha) → ±1 unidade do último dígito.
import { nbr7190 } from '../js/design/codes/nbr7190.js';
import { timberDeflectionCheck } from '../js/design/timber_deflection.js';

let fails = 0, n = 0;
const ok = (name, got, exp, tolAbs) => {
  n++; const d = Math.abs(got - exp), p = d <= tolAbs + 1e-12;
  if (!p) fails++;
  console.log(`${p ? 'ok  ' : 'FAIL'} ${name}: obtido ${(+got).toPrecision(5)} · esperado ${exp} (±${tolAbs}) · Δ ${(100 * (got - exp) / exp).toFixed(2)}%`);
};
const eq = (name, got, exp) => { n++; const p = got === exp; if (!p) fails++; console.log(`${p ? 'ok  ' : 'FAIL'} ${name}: ${got}${p ? '' : ` ≠ ${exp}`}`); };
const pendentes = [], notas = [];
const mm = 1e-3, MPa = 1000, kNcm2 = 1e4;            // kN/m² por MPa e por kN/cm²
const rect = (b, h, extra = {}) => ({ shape: 'rect', b: b * mm, h: h * mm, ...extra });

// ── (L1) [DIAS] Ex.1 — viga do mezanino, ELS (PDF p. 77) ─────────────────────────────────────
// ℓ = 3,86 m, madeira serrada, classe de umidade 2 (φ = 0,8), ψ2 = 0,4 (escritórios).
// δinst,G,k = 2,69 mm e δinst,Q1,k = 8,85 mm (entradas impressas). Livro:
//   δinst = 2,69 + 8,85 = 11,54 mm ≤ ℓ/300 = 12,87 mm (limite menos restritivo da faixa);
//   δfin,G = 2,69·1,8 = 4,84; δfin,Q1 = 8,85·(1 + 0,4·0,8) = 11,68 → δfin = 16,52 mm ≤ ℓ/150 = 25,73 mm.
{
  const r = timberDeflectionCheck({ L: 3.86, dG: 2.69 * mm, dQ: [{ delta: 8.85 * mm, psi1: 0.4, psi2: 0.4 }],
    material: 'serrada', classeUmidade: 2 });
  ok('L1a. φ (serrada, umidade 2)', r.phi, 0.8, 0.05);
  ok('L1b. δinst [mm]', r.inst.delta / mm, 11.54, 0.005);
  ok('L1c. ℓ/300 [mm]', r.inst.limLenient / mm, 12.87, 0.005);
  eq('L1d. δinst ≤ ℓ/300 (livro: atende; código: dentro da faixa Tab. 21)', r.inst.status !== 'excede', true);
  ok('L1e. δfin forma EN 1995 impressa no livro [mm]', r.finEN / mm, 16.52, 0.01);
  ok('L1f. ℓ/150 [mm]', r.fin.limLenient / mm, 25.73, 0.005);
  console.log(`     (recálculo, sem asserção) δfin pela forma 2022 δG(1+φ) + ψ2·δQ(1+φ) = ${(r.fin.delta / mm).toFixed(2)} mm`);
}

// ── (L2) [DIAS] Ex.2 — terça, flechas por plano, só permanente (PDF p. 79) ──────────────────
// ℓ = 3 m, φ = 0,8. δinst,y = 3,0 mm e δinst,x = 3,2 mm (impressos) → δfin = 5,4 e 5,8 mm ≤ ℓ/150 = 10 mm;
// δinst ≤ ℓ/300 = 10 mm. Só ação permanente: a forma 2022 e a EN coincidem.
for (const [eixo, d, fin] of [['y', 3.0, 5.4], ['x', 3.2, 5.8]]) {
  const r = timberDeflectionCheck({ L: 3, dG: d * mm, material: 'serrada', classeUmidade: 2 });
  ok(`L2${eixo}. δfin,G,${eixo} = δinst·(1 + φ) [mm]`, r.fin.delta / mm, fin, 0.05);
  eq(`L2${eixo}2. δinst e δfin atendem (≤ ℓ/300 e ≤ ℓ/150)`, r.inst.ratioLenient <= 1 && r.fin.ratioLenient <= 1, true);
}

// ── (L3) [DIAS] Ex.2 — cisalhamento em cada plano (PDF p. 79) ────────────────────────────────
// D40 nativa (fv0,k = 6 MPa), 60×120 mm, kmod = 0,9·0,9 (curta duração, umidade 2):
//   fv0,d = 0,81·6/1,8 = 2,7 MPa; Vy,d = 2 367 N → τy = 0,49 MPa; Vx,d = 634 N → τx = 0,13 MPa.
{
  const base = { mat: { classe7190: 'Tab2:D40' }, sec: rect(60, 120), member: { L: 3, L1: 0.3 }, options: { kmod1: 0.9, kmod2: 0.9 } };
  const ry = nbr7190.check({ ...base, demands: { Vy: 2.367 } });
  const rx = nbr7190.check({ ...base, demands: { Vz: 0.634 } });
  ok('L3a. fv0,d [MPa]', ry.fvd / MPa, 2.7, 0.05);
  ok('L3b. τy,d [MPa]', ry.shear.demand / MPa, 0.49, 0.005);
  ok('L3c. τx,d [MPa]', rx.shear.demand / MPa, 0.13, 0.005);
  const rxy = nbr7190.check({ ...base, demands: { Vy: 2.367, Vz: 0.634 } });
  notas.push(`L3: com Vy e Vz simultâneos o código usa a resultante (τ = ${(rxy.shear.demand / MPa).toFixed(3)} MPa) — o livro verifica `
    + 'cada plano separadamente (0,49 MPa). Critério declarado no código (6.4.2 é omissa no biaxial); conservador em +4 %, não é defeito.');
}

// ── (L4) [UESPI] barra comprimida da tesoura, NBR 7190-1:2022 (pp. 171–172) ─────────────────
// D60 nativa (fc0,k = 60 MPa; Ec0,m = 19 500 → E0,05 = 13 650 MPa), kmod = 0,6·0,9 = 0,54,
// 10×20 cm, L0 = 170 cm nos dois eixos, Nd = 64,26 kN. Impressos: fc0,d = 2,31 kN/cm²;
// λx = 29,44, λy = 58,89; λrel,x = 0,62, λrel,y = 1,24; kcx = 0,92, kcy = 0,52;
// σNc,d/(kcy·fc0,d) = 0,27 (governa); (σ/fc0,d)² = 0,02.
{
  const r = nbr7190.check({ demands: { N: -64.26 }, mat: { classe7190: 'Tab2:D60' }, sec: rect(100, 200),
    member: { L: 1.7, KE: 1 }, options: { kmod1: 0.6, kmod2: 0.9 } });
  const e = r.estab;
  ok('L4a. fc0,d [kN/cm²]', r.fc0d / kNcm2, 2.31, 0.01);
  ok('L4b. λx (eixo forte)', e.lambdaZ, 29.44, 0.01);
  ok('L4c. λy (eixo fraco)', e.lambdaY, 58.89, 0.01);
  ok('L4d. λrel,x', e.lambdaRelZ, 0.62, 0.01);
  ok('L4e. λrel,y', e.lambdaRelY, 1.24, 0.01);
  ok('L4f. kcy (βc = 0,2)', e.kcy, 0.52, 0.01);
  // L4g kcx: NÃO asserido — o 0,92 impresso decorre de intermediários truncados na fonte (ver NOTA abaixo).
  console.log(`info L4g. kcx: obtido ${e.kcz.toFixed(4)} · impresso 0,92 · Δ ${(100 * (e.kcz - 0.92) / 0.92).toFixed(2)}% (divergência da fonte)`);
  ok('L4h. σNc,d/(kcy·fc0,d)', r.axial.ratio, 0.27, 0.01);
  ok('L4i. índice final (estabilidade governa)', r.ratioMax, 0.27, 0.01);
  if (Math.abs(e.kcz - 0.92) > 0.005) notas.push(`L4g: kcx = ${e.kcz.toFixed(4)} × 0,92 impresso (Δ ${(100 * (e.kcz - 0.92) / 0.92).toFixed(1)} %). `
    + 'Recálculo: kx = 0,5·[1 + 0,2·(0,6214 − 0,3) + 0,6214²] = 0,7252 (a fonte imprime 0,72) e kcx = 1/(0,7252 + √(0,7252² − 0,6214²)) = 0,910; '
    + 'com os intermediários truncados da fonte (0,72; 0,62) sai 0,920. Arredondamento da FONTE, não defeito do código; kcx não governa.');
}

// ── (L5) [UESPI] barra tracionada da tesoura, NBR 7190-1:2022 (pp. 172–173) ─────────────────
// D60 nativa, kmod = 0,54, 6×13 cm, área líquida (furo φ25) 46,80 cm², Nd = 61,18 kN.
// Impressos: σNt,d = 1,31 kN/cm²; ft0,d = fc0,d = 2,31 kN/cm² (Tab. 2: ft0,k = fc0,k; γw = 1,4);
// σ/ft0,d = 0,57. (Na 1997 o mesmo TCC obtém ft0,d = 2,59 por γwt = 1,8 e ft0,k = fc0,k/0,77.)
{
  const r = nbr7190.check({ demands: { N: 61.18 }, mat: { classe7190: 'Tab2:D60' }, sec: rect(60, 130, { A: 46.8e-4 }),
    member: { L: 1.69 }, options: { kmod1: 0.6, kmod2: 0.9 } });
  ok('L5a. σNt,d [kN/cm²]', r.axial.demand / kNcm2, 1.31, 0.01);
  ok('L5b. ft0,d com γw = 1,4 [kN/cm²]', r.ft0d / kNcm2, 2.31, 0.01);
  ok('L5c. σNt,d/ft0,d', r.axial.ratio, 0.57, 0.01);
  eq('L5d. L0 = 169 cm ≤ 50·b = 300 cm (9.3) → verificado', Number.isFinite(r.ratioMax), true);
}

// ── (L6) [UESPI] terça, flexão oblíqua + cisalhamento + estabilidade lateral, 2022 (pp. 169–171) ──
// D60 nativa, kmod = 0,54, 6×18 cm, Mx,d = 406,77 kN·cm, My,d = 10,17 kN·cm, Vy,d = 4,07 kN, Vx,d = 0,20 kN,
// L1 = 200 cm. Impressos: fm,d = 2,31 kN/cm²; σMx,d/fm,d + kM·σMy,d/fm,d = 0,57 (kM = 0,7; governa);
// τ = 0,057 kN/cm² ≤ fv0,d = 0,24 kN/cm²; βM = 12,30 (Tab. 8 da 2022: h/b = 3 → 12,3);
// L1/b = 33,33 ≤ E0,ef/(βM·fm,d) = 36,99 → estabilidade lateral dispensada.
{
  const r = nbr7190.check({ demands: { Mz: 4.0677, My: 0.1017, Vy: 4.07, Vz: 0.20 }, mat: { classe7190: 'Tab2:D60' },
    sec: rect(60, 180), member: { L: 4, L1: 2 }, options: { kmod1: 0.6, kmod2: 0.9 } });
  ok('L6a. fm,d [kN/cm²]', r.fmd / kNcm2, 2.31, 0.01);
  ok('L6b. índice de flexão oblíqua (kM = 0,7)', r.bending.ratio, 0.57, 0.01);
  ok('L6c. τd [kN/cm²]', r.shear.demand / kNcm2, 0.057, 0.001);
  ok('L6d. fv0,d [kN/cm²]', r.fvd / kNcm2, 0.24, 0.01);
  ok('L6e. βM (h/b = 3; Tab. 8 = 12,3)', r.estab.betaM, 12.3, 0.05);
  eq('L6f. estabilidade lateral dispensada (33,33 ≤ 36,99)', r.estab.lateralDispensada, true);
  ok('L6g. índice final', r.ratioMax, 0.57, 0.01);
}

// ── (L7) [MOLINA] treliça Howe, tração no banzo inferior (p. 60; kmod p. 41) — edição 1997 ────
// C40 dicotiledônea (= D40 da Tab. 2 de 2022: fc0,k = 40 MPa), 2 peças 3×12 cm, área líquida com
// furos φ10: A = 2·3·(12 − 2) = 60 cm²; Nd = 30,75 kN (barras 7 e 8, 3º carregamento).
// Livro: σt,d = 0,51 kN/cm² < 1,60 kN/cm².
{
  const r = nbr7190.check({ demands: { N: 30.75 }, mat: { classe7190: 'Tab2:D40' }, sec: rect(60, 120, { A: 60e-4 }),
    member: { L: 1.63 }, options: { kmod1: 0.56, kmod2: 1.0 } });
  ok('L7a. σt,d [kN/cm²]', r.axial.demand / kNcm2, 0.51, 0.005);
  ok('L7b. ft0,d com o kmod do livro (0,56) [kN/cm²]', r.ft0d / kNcm2, 1.60, 0.005);
}

console.log('\nPENDENTES (defeito provável — impressos, não falham a bateria):');
console.log(pendentes.length ? pendentes.map(p => '  · ' + p).join('\n') : '  (nenhum)');
console.log('NOTAS (divergência explicada pela fonte ou por critério declarado):');
console.log(notas.length ? notas.map(p => '  · ' + p).join('\n') : '  (nenhuma)');
console.log(fails ? `\n${fails}/${n} FALHA(S)` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
