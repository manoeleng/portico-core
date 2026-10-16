// test_lit_nbr8800.mjs — NBR 8800:2024 (aço laminado/soldado) contra EXEMPLOS RESOLVIDOS DA LITERATURA
//   node tests/test_lit_nbr8800.mjs
//
// Os valores ESPERADOS são os dos livros, transcritos com página; nenhum é ajustado para passar.
// Fontes (acervo C:\projetos\_referencias):
//   [FSC]  Fakury, Silva, Caldas — Dimensionamento de Elementos Estruturais de Aço e Mistos, Pearson, 2017
//          (base: NBR 8800:2008). Páginas = numeração impressa do livro.
//   [PF9]  Pfeil & Pfeil — Estruturas de Aço: dimensionamento prático, 9ª ed., LTC, 2022 (base: NBR 8800:2008).
//          Páginas = página do PDF do acervo.
//   [CBCA] Fakury et al. / CBCA — Projeto de Estruturas de Edificações com Perfis Tubulares (base: NBR 16239:2013
//          + NBR 8800:2008). Páginas = numeração impressa.
// Edição: todos os livros são da NBR 8800:2008 (ou NBR 16239). Só entram como CASO (ok/FAIL) os itens conferidos
// como INALTERADOS na 2024 (PDF da NBR 8800:2024 do acervo): χ (5.3.3), 5.3.5.4 (cantoneira — mesmas
// expressões do Anexo E.1.4 da 2008), 5.2.5-c/e, 5.4.3.1 com enrijecedores (kv = 5 + 5/(a/h)²), Anexo D com Cb = 1
// (FLT), FLM/FLA de I, Mcr elástico (Cb·…), 5.5.1.2. Itens que MUDARAM na 2024 (Q → largura efetiva; Cb fora da
// interpolação e dentro de λr; kv = 5,34 sem enrijecedor; limites 0,60 ≤ Ct ≤ 0,90 removidos) vão para NOTAS
// (impressas, não falham). Divergências por provável lacuna do código vão para PENDENTES (impressas, não falham).
// Tolerância padrão 1 % (arredondamento de livro a 3–4 algarismos); exceções justificadas no próprio caso.
// Unidades do módulo: kN, m, kN/m². Livros em cm, kN/cm², kN·cm → convertidos aqui.
import { fromShape, resolveSectionProps } from '../js/design/section_props.js';
import { nbr8800 } from '../js/design/codes/nbr8800.js';

const cm = 0.01, cm2 = 1e-4, cm3 = 1e-6, cm4 = 1e-8, cm6 = 1e-12, KNCM2 = 1e4;
const matOf = (fy, fu, E = 20000) => ({ Fy: fy * KNCM2, Fu: fu * KNCM2, E: E * KNCM2 });   // kN/cm² → kN/m²
const run = (input) => nbr8800.check({ options: { gamma_a1: 1.10, gamma_a2: 1.35 }, ...input });
const TINY = 1e-3;   // comprimento "contido" (m): λ ≈ 0 → patamar plástico / sem flambagem nesse eixo

// Perfil I a partir das propriedades do livro (cm). lambdaWeb = h/tw do livro quando dado.
function secI(p, fabricacao) {
  return {
    shape: 'I', fabricacao,
    A: p.A * cm2, Iz: (p.Ix ?? p.A * p.rx ** 2) * cm4, Iy: p.Iy * cm4, J: p.J * cm4, Cw: p.Cw * cm6,
    Sz: p.Wx * cm3, Sy: p.Wy * cm3, Zz: p.Zx * cm3, Zy: p.Zy * cm3,
    rz: (p.rx ?? Math.sqrt(p.Ix / p.A)) * cm, ry: (p.ry ?? Math.sqrt(p.Iy / p.A)) * cm,
    lambdaFlange: p.bf / (2 * p.tf), lambdaWeb: p.h / p.tw, h: p.d * cm, b: p.bf * cm,
    dims: { d: p.d * cm, bf: p.bf * cm, tf: p.tf * cm, tw: p.tw * cm },
  };
}

let fails = 0, nOk = 0;
const rows = [];
const rel = (got, exp) => (got - exp) / Math.abs(exp);
function caso(id, fonte, ed, got, exp, tol = 0.01) {
  const d = rel(got, exp), pass = Math.abs(d) <= tol;
  if (pass) nOk++; else fails++;
  rows.push([id, fonte, ed, exp, got, d, pass ? 'ok' : 'FAIL']);
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${id} [${fonte}; ${ed}]: obtido=${(+got).toFixed(4)} esperado=${exp} (Δ ${(d * 100).toFixed(2)} %, tol ${(tol * 100).toFixed(1)} %)`);
}
const NOTAS = [], PENDENTES = [];
const nota = (id, fonte, got, exp, motivo) => NOTAS.push({ id, fonte, got, exp, motivo });
const pendente = (id, fonte, got, exp, motivo) => PENDENTES.push({ id, fonte, got, exp, motivo });

// ═══════════════ 1. Cantoneira simples comprimida ligada por uma aba (5.3.5.4) ═══════════════════════════
// [FSC] 7.8.3 caso c, p. 149 — diagonal de treliça PLANA, L 88,9 × 7,94, fy = 250 MPa, L = 3,40 m, soldada pela
// mesma aba nas duas extremidades. Livro: Ag = 13,5 cm², Ix1 = 102 cm⁴, rx1 = 2,75 cm (Tab. A.3.1, com raio de
// concordância); Lx1/rx1 = 123,6 > 80 → Kx1Lx1 = 32·rx1 + 1,25·Lx1 = 513 cm; Ne,x1 = 76,51 kN; λ0 = 2,10; χ = 0,199;
// Nc,Rd = 61,06 kN. 2024: 5.3.5.4.2-b idêntico; b/t = 11,2 < 0,71·√(E/fy) = 20,1 (sem flexo-torção, 5.3.5.4.4) e
// < 0,45·√(E/fy) = 12,7 (aba não esbelta) → mesmo resultado.
// Tolerância 2 %: o código calcula Ix1/rx1 da geometria de abas finas SEM raio de concordância (angleBuckling),
// e o livro usa o catálogo (102 cm⁴, 2,75 cm) — diferença de premissa geométrica, não de norma.
{
  const b = 0.0889, t = 0.00794;
  const g = fromShape('angle', { d: b, b, t });
  const sec = resolveSectionProps({ A: 13.5 * cm2, Iz: g.Iz, Iy: g.Iy, J: 2.83 * cm4, design: { shape: 'angle', dims: { d: b, b, t } } });
  const r = run({ demands: { N: -50 }, mat: matOf(25, 40), sec, member: { L: 3.40, Lb: 3.40, cantoneira: { trelica: 'plana' } } });
  caso('L1a Ne,x1 (kN)', 'FSC 7.8.3c p.149', '2008=2024', r.axial.Ne, 76.51, 0.02);
  caso('L1b χ', 'FSC 7.8.3c p.149', '2008=2024', r.axial.chi, 0.199, 0.02);
  caso('L1c Nc,Rd (kN)', 'FSC 7.8.3c p.149', '2008=2024', r.axial.capacity, 61.06, 0.02);
}

// ═══════════════ 2. Tração — seção líquida efetiva, Ct (5.2.2-b, 5.2.5) ══════════════════════════════════
// [PF9] Probl. 2.3.8, p. 95 — U 381 × 50,4, MR250 (fu = 400), ligação soldada pela alma: Ag = 64,2 cm²,
// Ct = 1 − 20/100 = 0,80 (5.2.5-c, ec = 20 mm, ℓc = 100 mm), ruptura 0,80·64,2·40/1,35 = 1522 kN; escoamento
// 64,2·25/1,1 = 1459 kN governa. 2024: 5.2.5-c idêntico; 0,80 dentro de [0,60; 0,90] da 2008 → mesmo valor.
{
  const r = run({ demands: { N: 1000 }, mat: matOf(25, 40), sec: { shape: 'U', A: 64.2 * cm2 },
    member: { L: 3, secaoLiquida: { An: 64.2 * cm2, ec: 0.020, lc: 0.100 } } });
  caso('T1a ruptura Ct·An·fu/γa2 (kN)', 'PF9 2.3.8 p.95', '2008=2024', r.axial.secaoLiquida.NRd, 1522);
  caso('T1b Nt,Rd governante = escoamento (kN)', 'PF9 2.3.8 p.95', '2008=2024', r.axial.capacity, 1459);
}
// [FSC] 6.10.6, p. 115–116 — dupla cantoneira A36 (fy 250, fu 400), um plano de corte por cantoneira; aqui UMA
// cantoneira (metade de An e da força). (a) 2L 63,5 × 4,76: An = 2(5,80 − 1,95·0,476) = 9,74 cm², ec = 1,75 cm,
// ℓc = 5 cm → Ct = 0,65, Ae = 6,33 cm² (2 cantoneiras) → por cantoneira Nt,Rd = (6,33/2)·40/1,35 = 93,78 kN.
// (b) 2L 50,8 × 7,94: An = 11,74, ec = 1,55, Ct = 0,69, Ae = 8,10 → 120,0 kN por cantoneira.
// 2024: 5.2.5-c idêntico; Ct > Ac/Ag (0,52 e 0,54) → piso da 2024 não atua.
{
  const mk = (b, t, A) => { const g = fromShape('angle', { d: b, b, t }); return resolveSectionProps({ A: A * cm2, Iz: g.Iz, Iy: g.Iy, J: g.J, design: { shape: 'angle', dims: { d: b, b, t } } }); };
  const s1 = mk(0.0635, 0.00476, 5.80), s2 = mk(0.0508, 0.00794, 7.42);
  const ra = run({ demands: { N: 100 }, mat: matOf(25, 40), sec: s1, member: { L: 2, secaoLiquida: { An: 9.74 / 2 * cm2, ec: 0.0175, lc: 0.05 } } });
  caso('T2a Ct (2L 63,5×4,76)', 'FSC 6.10.6 p.116', '2008=2024', ra.axial.secaoLiquida.Ct, 0.65);
  caso('T2b Nt,Rd por cantoneira (kN) = Ae/2·fu/γa2', 'FSC 6.10.6 p.116', '2008=2024', ra.axial.capacity, 6.33 / 2 * 40 / 1.35);
  const rb = run({ demands: { N: 100 }, mat: matOf(25, 40), sec: s2, member: { L: 2, secaoLiquida: { An: 11.74 / 2 * cm2, ec: 0.0155, lc: 0.05 } } });
  caso('T2c Nt,Rd por cantoneira 2L 50,8×7,94 (kN)', 'FSC 6.10.6 p.116', '2008=2024', rb.axial.capacity, 8.10 / 2 * 40 / 1.35);
  // ec automático (geometria de abas finas, sem raio): 17,63 mm × 17,5 mm do catálogo → tolerância 1 % (premissa geométrica)
  const rc = run({ demands: { N: 100 }, mat: matOf(25, 40), sec: s1, member: { L: 2, secaoLiquida: { An: 9.74 / 2 * cm2, lc: 0.05 } } });
  caso('T2d Ct com ec calculado pelo código', 'FSC 6.10.6 p.116', '2008=2024', rc.axial.secaoLiquida.Ct, 0.65, 0.01);
}
// [CBCA] 3.7.1, p. 177 — TC 168,3 × 16 VMB 300 (fy 300, fu 415), chapa de nó concêntrica tc = 8 mm, ℓc = 1,2d:
// ec = 16,8/π − 0,8/2 = 4,95 cm, ℓc = 20,16 cm → Ct = 0,89 (5.2.5-e), Ae = 0,89·76,6 → Nt,Rd = 2096 kN;
// escoamento 76,6·30/1,1 = 2089 kN (3.7.3, p. 180). NBR 16239:2013 = NBR 8800:2024 5.2.5-e (mesma expressão).
// Tolerância 1 %: o livro arredonda Ct para 0,89 (exato 0,8949).
{
  const sec = { shape: 'pipe', A: 76.6 * cm2, Iz: 2244 * cm4, Iy: 2244 * cm4, rz: 5.41 * cm, ry: 5.41 * cm, dims: { D: 0.1683, t: 0.016 } };
  const r = run({ demands: { N: 2000 }, mat: matOf(30, 41.5), sec, member: { L: 2.5, secaoLiquida: { An: 76.6 * cm2, ec: 0.0495, lc: 0.2016 } } });
  caso('T3a ruptura tubo chapa concêntrica (kN)', 'CBCA 3.7.1 p.177', 'NBR16239=2024', r.axial.secaoLiquida.NRd, 2096);
  caso('T3b Nt,Rd governante = escoamento (kN)', 'CBCA 3.7.3 p.180', '2008=2024', r.axial.capacity, 2089);
}

// ═══════════════ 3. Compressão de tubo (5.3) ══════════════════════════════════════════════════════════════
// [CBCA] 3.7.3, p. 180–181 — mesmo tubo, SOLDADO (curva da NBR 8800, Eq. 3.9): Ne = 7087 kN, λ0 = 0,57,
// χ = 0,873, Nc,Rd = 1824 kN. D/t = 10,5 < 0,11·E/fy (sem flambagem local). Curva χ idêntica na 2024 (5.3.3).
{
  const sec = { shape: 'pipe', A: 76.6 * cm2, Iz: 2244 * cm4, Iy: 2244 * cm4, rz: 5.41 * cm, ry: 5.41 * cm, Sz: 266.7 * cm3, Sy: 266.7 * cm3, dims: { D: 0.1683, t: 0.016 } };
  const r = run({ demands: { N: -2000 }, mat: matOf(30, 41.5), sec, member: { L: 2.5, Lb: 2.5 } });
  caso('C1a χ tubo soldado', 'CBCA 3.7.3 p.181', '2008=2024', r.axial.chi, 0.873);
  caso('C1b Nc,Rd tubo soldado (kN)', 'CBCA 3.7.3 p.181', '2008=2024', r.axial.capacity, 1824);
}

// ═══════════════ 4. Flexo-compressão / flexo-tração (5.5.1.2) ════════════════════════════════════════════
// [FSC] 9.5.4, p. 229–232 — pilar W 360 × 79, A572 Gr50 (fy 345), esforços de 2ª ordem: NSd = 916,80 kN,
// Mx,Sd = 220,32 kN·m; Lx = 4 m, Ly = Lb = Lz = 2 m. Livro: Ney = 11 922 kN, λ0 = 0,54, χ = 0,885,
// Nc,Rd = 2809 kN; Mx,Rd = Mpl/γa1 = 450,70 kN·m (λ = 40,9 < λp); interação (a) = 0,33 + 0,43 = 0,76.
// Seção: livro (A, Ix, Wx, Zx, rx, Iy, ry, d, bf, tf, tw, h); J = 82,41 cm⁴ e Cw = 685 701 cm⁶ do catálogo Gerdau
// (laminados-gerdau.csv do StructPro-Pro; o livro dispensa Nez por Lz ≤ Ly). Wy, Zy do mesmo catálogo.
{
  const p = { d: 35.4, bf: 20.5, tf: 1.68, tw: 0.94, h: 28.8, A: 101.2, Ix: 22713, Wx: 1283.2, Zx: 1437, rx: 14.98,
    Iy: 2416, Wy: 235.7, Zy: 361.9, ry: 4.89, J: 82.41, Cw: 685701 };
  const r = run({ demands: { N: -916.80, Mz: 220.32 }, mat: matOf(34.5, 45), sec: secI(p, 'laminado'),
    member: { L: 4, Lx: 4, Ly: 2, Lz: 2, Lb: 2, Cb: 1 } });
  caso('FC1a Ne = Ney (kN)', 'FSC 9.5.4 p.230', '2008=2024', r.axial.Ne, 11922);
  caso('FC1b χ', 'FSC 9.5.4 p.231', '2008=2024', r.axial.chi, 0.885);
  caso('FC1c Nc,Rd (kN)', 'FSC 9.5.4 p.231', '2008=2024', r.axial.capacity, 2809);
  caso('FC1d Mx,Rd (kN·m)', 'FSC 9.5.4 p.231', '2008=2024', r.flexaoX.capacity, 450.70);
  caso('FC1e interação 5.5.1.2-a', 'FSC 9.5.4 p.232', '2008=2024', r.interaction.demand, 0.76);
}
// [FSC] 9.5.2, p. 227–228 — W 360 × 101 A572 Gr50 (fy 345, fu 450), flexo-TRAÇÃO, Ae = 115 cm² (dado):
// Nt,Rd = min(4062; 115·45/1,35 = 3833) = 3833 kN; Mx,Rd = 59 243 kN·cm (Mpl/γa1, mesa contida).
// H1: Nt = 672, Mx = 473,85 → 0,09 + 0,80 = 0,89 (5.5.1.2-b); H2: Nt = 1120, Mx = 400,95 → 0,29 + 0,60 = 0,89 (a).
// Seção: catálogo Gerdau (A = 129,5, Zx = 1888,9 = 59 243·1,1/34,5 ✓).
{
  const p = { d: 35.7, bf: 25.5, tf: 1.83, tw: 1.05, h: 28.6, A: 129.5, Ix: 30279, Wx: 1696.3, Zx: 1888.9, rx: 15.29,
    Iy: 5063, Wy: 397.1, Zy: 606.1, ry: 6.25, J: 128.47, Cw: 1450410 };
  const base = { mat: matOf(34.5, 45), sec: secI(p, 'laminado') };
  const m = { L: 6, Lb: TINY, Cb: 1, secaoLiquida: { An: 115 * cm2, Ct: 1 } };
  const r1 = run({ ...base, demands: { N: 672, Mz: 473.85 }, member: m });
  const r2 = run({ ...base, demands: { N: 1120, Mz: 400.95 }, member: m });
  caso('FT1a Nt,Rd ruptura (kN)', 'FSC 9.5.2 p.227', '2008=2024', r1.axial.capacity, 3833);
  caso('FT1b Mx,Rd (kN·m)', 'FSC 9.5.2 p.227', '2008=2024', r1.flexaoX.capacity, 592.43);
  caso('FT1c interação H1 (5.5.1.2-b)', 'FSC 9.5.2 p.228', '2008=2024', r1.interaction.demand, 0.89);
  caso('FT1d interação H2 (5.5.1.2-a)', 'FSC 9.5.2 p.228', '2008=2024', r2.interaction.demand, 0.89);
}
// [PF9] Probl. 7.6.1–7.6.3, p. 288–291 — coluna CVS 450 × 116 soldado, MR250, Nd = 1120 kN, Mdx = 72,7 kN·m
// (já amplificado por B1), comprimento 6 m. Seção do livro: A = 148,3; Wx = 2348; rx = 18,88; Zx = 2629; Iy = 7207;
// Wy = 480; ry = 6,97; J = 109; Cw = 3 393 704; bf = 300, tf = 16, tw = 12,5, h = 418; Ix = A·rx²; Zy = 720 (p. 291).
const cvs450 = { d: 45, bf: 30, tf: 1.6, tw: 1.25, h: 41.8, A: 148.3, rx: 18.88, Wx: 2348, Zx: 2629, Iy: 7207,
  Wy: 480, Zy: 720, ry: 6.97, J: 109, Cw: 3393704 };
{
  // 7.6.1: contenção lateral contínua no plano ⟂ à alma → só flambagem em x (λ0 = 0,36, χ = 0,947, NRd = 3192 kN);
  // MRd = 2629·25/1,1 = 597,5 kN·m.
  const r = run({ demands: { N: -1120, Mz: 72.7 }, mat: matOf(25, 40), sec: secI(cvs450, 'soldado'),
    member: { L: 6, Lx: 6, Ly: TINY, Lz: TINY, Lb: TINY, Cb: 1 } });
  caso('FC2a χ (eixo x)', 'PF9 7.6.1 p.289', '2008=2024', r.axial.chi, 0.947);
  caso('FC2b Nc,Rd (kN)', 'PF9 7.6.1 p.289', '2008=2024', r.axial.capacity, 3192);
  caso('FC2c MRd (kN·m)', 'PF9 7.6.1 p.289', '2008=2024', r.flexaoX.capacity, 597.5);
  nota('FC2d interação', 'PF9 7.6.1 p.289', r.interaction.demand, 0.47,
    'PREMISSA: o livro usa a interação linear N/NRd + M/MRd (Eq. 7.11 do livro, sem 8/9); o código usa 5.5.1.2-a (0,35 + 8/9·0,12).');
  // 7.6.2: sem contenção: (Kl/r)y = 86,1, λ0 = 0,969, χ = 0,675, NRd = 2275 kN; FLT com Cb = 1: λp = 49,8,
  // λr = 156,3, Mr = 41 090, Mp = 65 725 kN·cm → Mn = 573,3, MRd = 521,2 kN·m.
  const r2 = run({ demands: { N: -1120, Mz: 72.7 }, mat: matOf(25, 40), sec: secI(cvs450, 'soldado'), member: { L: 6, Lb: 6, Cb: 1 } });
  caso('FC3a λ0 (eixo y)', 'PF9 7.6.2 p.289', '2008=2024', r2.axial.lambda0, 0.969);
  caso('FC3b Nc,Rd (kN)', 'PF9 7.6.2 p.289', '2008=2024', r2.axial.capacity, 2275);
  caso('FC3c Lr = λr·ry com Cb = 1 (m)', 'PF9 7.6.2 p.290', '2008=2024 (Cb=1)', r2.flexaoX.Lr, 1.563 * 6.97);
  caso('FC3d MRd FLT inelástica Cb = 1 (kN·m)', 'PF9 7.6.2 p.290', '2008=2024 (Cb=1)', r2.flexaoX.capacity, 521.2);
  nota('FC3e interação', 'PF9 7.6.2 p.290', r2.interaction.demand, 0.63, 'PREMISSA: interação linear do livro (sem 8/9).');
  // 7.6.3: My,Rd = 720·25/1,1 = 164 kN·m (16 363 kN·cm); seção compacta para flexão em y.
  caso('FC4a My,Rd (kN·m)', 'PF9 7.6.3 p.291', '2008=2024', r2.flexaoY.capacity, 163.63);
  const r3 = run({ demands: { N: -1120, Mz: 72.7, My: 31.2 }, mat: matOf(25, 40), sec: secI(cvs450, 'soldado'), member: { L: 6, Lb: 6, Cb: 1 } });
  nota('FC4b interação biaxial', 'PF9 7.6.3 p.291', r3.interaction.demand, 0.82, 'PREMISSA: interação linear do livro (sem 8/9).');
}

// ═══════════════ 5. Flexão de perfil I soldado — FLM, FLA, FLT (Anexo D) ══════════════════════════════════
// [FSC] 8.10.5, p. 203–206 — USI CIVIL 350 (fy = 350 MPa), perfis da NBR 5884 com as propriedades do livro.
// VS 800 × 143: FLM λ = 8,42 < 9,08 (Mpl); FLA λ = 95,25 entre 89,88 e 136,26 → MRk = 204 678 kN·cm,
//   MRd = 186 071 kN·cm. VS 850 × 155: FLM λ = 9,21 (kc = 0,40, λr = 17,17) → MRk = 238 183; FLA λ = 101,5 →
//   MRk = 234 296 → MRd = 212 996 kN·cm; FLT Cb = 1 → λr = 108,64 (ry = 8,28 cm).
// 2024: Tab. D.1 (FLM de soldado com kc, FLA com Mr = fy·W) inalterada nesses itens.
// Wy, Zy (não usados aqui) calculados das chapas: Wy = Iy/(bf/2); Zy = 2·tf·bf²/4 + h·tw²/4.
const vs800 = { d: 80, bf: 32, tf: 1.9, tw: 0.8, h: 76.2, A: 182.6, Ix: 214961, Wx: 5374, Zx: 5910, rx: 34.31, Iy: 10380,
  ry: 7.54, J: 159.7, Cw: 15823202, Wy: 10380 / 16, Zy: 2 * 1.9 * 32 ** 2 / 4 + 76.2 * 0.64 / 4 };
const vs850 = { d: 85, bf: 35, tf: 1.9, tw: 0.8, h: 81.2, A: 198, Ix: 265344, Wx: 6243, Zx: 6845, rx: 36.61, Iy: 13581,
  ry: 8.28, J: 174.2, Cw: 23439511, Wy: 13581 / 17.5, Zy: 2 * 1.9 * 35 ** 2 / 4 + 81.2 * 0.64 / 4 };
{
  const m350 = matOf(35, 48.5);
  const ra = run({ demands: { Mz: 1867.2 }, mat: m350, sec: secI(vs800, 'soldado'), member: { L: 12, Lb: TINY, Cb: 1 } });
  caso('B1a VS 800×143 MRd FLA (kN·m)', 'FSC 8.10.5 p.204', '2008=2024', ra.flexaoX.capacity, 1860.71);
  const rb = run({ demands: { Mz: 1867.2 }, mat: m350, sec: secI(vs850, 'soldado'), member: { L: 12, Lb: TINY, Cb: 1 } });
  caso('B1b VS 850×155 MRd FLA governa (kN·m)', 'FSC 8.10.5 p.205', '2008=2024', rb.flexaoX.capacity, 2129.96);
  caso('B1c VS 850×155 MRd,FLM (kN·m) = 238 183/1,1', 'FSC 8.10.5 p.205', '2008=2024', rb.flexaoX.MRdFLM, 2381.83 / 1.10);
  const rc = run({ demands: { Mz: 1604 }, mat: m350, sec: secI(vs850, 'soldado'), member: { L: 12, Lb: 5, Cb: 1 } });
  caso('B1d VS 850×155 Lr com Cb = 1 (m) = 108,64·ry', 'FSC 8.10.5 p.206', '2008=2024 (Cb=1)', rc.flexaoX.Lr, 1.0864 * 8.28);
  // Trecho EB: Lb = 5 m, Cb = 1,67 — livro (2008): Cb·[interp] = 360 281 > Mpl → FLT = Mpl; MRd global = FLA = 212 996.
  const rd = run({ demands: { Mz: 1604 }, mat: m350, sec: secI(vs850, 'soldado'), member: { L: 12, Lb: 5, Cb: 1.67 } });
  nota('B1e VS 850×155 trecho EB (Lb = 5 m, Cb = 1,67) MRd', 'FSC 8.10.5 p.206', rd.flexaoX.capacity, 2129.96,
    'EDIÇÃO: na 2024 (D.2.1) Cb entra em λr e NÃO multiplica a interpolação → FLT inelástica passa a governar abaixo da FLA; o livro (2008) limita Cb·[…] a Mpl.');
}
// [PF9] Probl. 6.5.7, p. 254–255 — VS 400 × 49, MR250, viga contínua, Lb = 8 m, Cb = 1,55: Wx = 870, Iy = 1267,
// J = 14,6, Cw = 483 188, ℓbr = 617 cm (λr da 2008, sem Cb = λr da 2024 com Cb = 1); Mcr = 1,55·10 107 = 15 666 kN·cm,
// MRd = 14 242 kN·cm. ry = √(Iy/A), A = 2·20·0,95 + 38,1·0,63 = 62,0 cm²; Zx = 970,6 (p. 257); Ix = 17 393 (p. 255).
const vs400 = { d: 40, bf: 20, tf: 0.95, tw: 0.63, h: 38.1, A: 62.0, Ix: 17393, Wx: 870, Zx: 970.6, Iy: 1267, J: 14.6, Cw: 483188,
  Wy: 1267 / 10, Zy: 2 * 0.95 * 20 ** 2 / 4 + 38.1 * 0.63 ** 2 / 4 };
{
  const r1 = run({ demands: { Mz: 100 }, mat: matOf(25, 40), sec: secI(vs400, 'soldado'), member: { L: 8, Lb: 8, Cb: 1 } });
  // tol 1,5 %: refazendo a Eq. do próprio livro com os dados dele (β1 = 0,0521; 27·Cw·β1²/Iy = 27,95) dá ℓbr = 623 cm;
  // o 617 impresso é arredondamento/aritmética do livro (≈ 1 %).
  caso('B2a VS 400×49 Lr (Cb = 1) (m)', 'PF9 6.5.7 p.254', '2008=2024 (Cb=1)', r1.flexaoX.Lr, 6.17, 0.015);
  const r = run({ demands: { Mz: 100 }, mat: matOf(25, 40), sec: secI(vs400, 'soldado'), member: { L: 8, Lb: 8, Cb: 1.55 } });
  caso('B2b Mcr com Cb = 1,55 (kN·m)', 'PF9 6.5.7 p.255', '2008=2024', r.flexaoX.Mcr, 156.66);
  nota('B2c MRd Lb = 8 m, Cb = 1,55', 'PF9 6.5.7 p.255', r.flexaoX.capacity, 142.42,
    'EDIÇÃO: com Cb = 1,55 o λr da 2024 sobe para ≈ 180 > λ = 177 → ramo inelástico (interpolação sem Cb) em vez de Mcr.');
  // 6.5.8: Lb = 4 m, Cb = 1,67: ℓbp = 224 cm; livro (2008) → Mn = 1,67·[…] = 337,5 > Mp → MRd = 220,5 kN·m.
  const r2 = run({ demands: { Mz: 100 }, mat: matOf(25, 40), sec: secI(vs400, 'soldado'), member: { L: 4, Lb: 4, Cb: 1.67 } });
  caso('B2d Lp (m)', 'PF9 6.5.8 p.256', '2008=2024', r2.flexaoX.Lp, 2.24);
  caso('B2e Mpl (kN·m)', 'PF9 6.5.8 p.257', '2008=2024', r2.flexaoX.Mpl, 242.65);
  caso('B2f Mr (kN·m)', 'PF9 6.5.8 p.257', '2008=2024', r2.flexaoX.Mr, 152.25);
  nota('B2g MRd Lb = 4 m, Cb = 1,67', 'PF9 6.5.8 p.257', r2.flexaoX.capacity, 220.5,
    'EDIÇÃO: 2024 D.2.1 — Cb não multiplica a interpolação (λr cresce com Cb) → MRd < Mpl/γa1.');
}

// ═══════════════ 6. Cortante (5.4.3.1) ════════════════════════════════════════════════════════════════════
// [FSC] 8.10.8, p. 212–213 — I soldado d = 500, tw = 4,75, tf = 12,5 mm, fy = 300: h/tw = 100,0; Vpl = 427,5 kN.
//   Painéis a = 71,5 cm (a/h = 1,51) → kv = 5 + 5/1,51² = 7,19 → λp = 76,16, λr = 94,85 → VRd = 279,53 kN.
//   Sem enrijecedor (2008: kv = 5,0) → VRd = 194,38 kN — fórmula idêntica na 2024; kv default da 2024 = 5,34.
//   bf não é dado no livro e não entra em VRd,y: adotado bf = 200 mm só para o perfil ser reconhecido como I.
// [FSC] 8.10.5-g, p. 206–207 — VS 850 × 155, fy 350: a = 150 cm, h = 81,2 → kv = 6,46 → VRd = 697,86 kN;
//   kv = 5,0 → 540,23 kN.
{
  const pI = { d: 50, bf: 20, tf: 1.25, tw: 0.475, h: 47.5, A: 2 * 20 * 1.25 + 47.5 * 0.475, Ix: 50000, Wx: 2000, Zx: 2300, Iy: 1667,
    Wy: 167, Zy: 250, J: 30, Cw: 1e6 };
  const v = (p, fy, kv) => run({ demands: { Vy: 100 }, mat: matOf(fy, fy * 1.3), sec: secI(p, 'soldado'), member: { L: 10, Lb: TINY, kv } });
  caso('V1a VRd kv = 7,19 (a/h = 1,51) (kN)', 'FSC 8.10.8 p.213', '2008=2024', v(pI, 30, 7.19).corteY.capacity, 279.53);
  caso('V1b VRd kv = 5,0 imposto (kN)', 'FSC 8.10.8 p.212', '2008 (kv imposto)', v(pI, 30, 5.0).corteY.capacity, 194.38);
  caso('V2a VS 850×155 VRd kv = 6,46 (kN)', 'FSC 8.10.5 p.207', '2008=2024', v(vs850, 35, 6.46).corteY.capacity, 697.86);
  caso('V2b VS 850×155 VRd kv = 5,0 imposto (kN)', 'FSC 8.10.5 p.207', '2008 (kv imposto)', v(vs850, 35, 5.0).corteY.capacity, 540.23);
  nota('V2c VS 850×155 VRd sem enrijecedor, kv default', 'FSC 8.10.5 p.207', v(vs850, 35, undefined).corteY.capacity, 540.23,
    'EDIÇÃO: 2024 5.4.3.1.1 usa kv = 5,34 para alma sem enrijecedor (2008: 5,0).');
}

// ═══════════════ 7. Edição: flambagem local na compressão (Q da 2008 × largura efetiva da 2024) ═══════════
{
  // [FSC] 9.5.6-j, p. 241–242 — L 75 × 5 A36 ligada pelas duas abas (concêntrica), L = 2,59 m: Q = 0,94 (2008),
  // Ney = 46,85 kN, λ0 = 1,91, χ = 0,24, Nc,Rd = 37,28 kN.
  const b = 0.075, t = 0.005, g = fromShape('angle', { d: b, b, t });
  const sec = resolveSectionProps({ A: 7.27 * cm2, Iz: g.Iz, Iy: g.Iy, J: g.J, design: { shape: 'angle', dims: { d: b, b, t } } });
  const r = run({ demands: { N: -0.7 }, mat: matOf(25, 40), sec, member: { L: 2.59, Lb: 2.59, cantoneira: { trelica: 'concentrica' } } });
  nota('E1 L 75×5 concêntrica Nc,Rd', 'FSC 9.5.6-j p.242', r.axial.capacity, 37.28,
    'EDIÇÃO: 2024 5.3.4 — aba só é esbelta se b/t > 0,45√(E/fy)/√χ (≈ 26 com χ ≈ 0,24) → Aef = Ag, sem o Q = 0,94 da 2008; e λ0 sem Q.');
  // [FSC] 7.8.1, p. 142–144 — pilar I soldado 650 × 400 × 9,5 × 8 (ASTM A242, fy 345): Q = Qs·Qa = 0,43 (2008),
  // Ney = 8003 kN, λ0 = 0,48, χ = 0,908, Nc,Rd = 1549 kN.
  const secW = resolveSectionProps({ A: 126.5 * cm2, Iz: 94701 * cm4, Iy: 10136 * cm4, design: { shape: 'I', dims: { d: 0.65, bf: 0.4, tf: 0.0095, tw: 0.008 }, fabricacao: 'soldado' } });
  const rw = run({ demands: { N: -1500 }, mat: matOf(34.5, 48.5), sec: secW, member: { L: 10, Lx: 10, Ly: 5, Lz: 5, Lb: 5 } });
  nota('E2 I soldado 650×400 esbelto Nc,Rd', 'FSC 7.8.1 p.144', rw.axial.capacity, 1549,
    'EDIÇÃO: 2008 aplica Q = 0,43 em λ0 e em χ·Q·Ag·fy; 2024 usa Aef por largura efetiva dependente de χ (5.3.4.2) e λ0 com Ag.');
}

// ═══════════════ 8. Tubos fletidos (Anexo D, D.2.6/D.2.7) — PENDENTES ═════════════════════════════════════
// [CBCA] 3.7.4, p. 183–185 — TR 300 × 220 × 6,3 soldado, fy 345: Zx = 652, Wx = 550 cm³; FLM λ = b/t = 30,92 entre
//   λp = 26,96 e λr = 33,71 → MRk = 20 442 kN·cm, MRd = 18 584 kN·cm (185,84 kN·m). (NBR 16239; a 2024 D.2.7 dá
//   20 435 kN·cm — Δ 0,04 %, mesmo resultado.)
// [CBCA] 3.7.7, p. 190 — tubo circular soldado 320 × 6,3, fy 345: D/t = 50,79 entre λp = 40,58 e λr = 179,71 →
//   MRk = (0,021·E/(D/t) + fy)·W = 20 444 kN·cm, W = 478 cm³ → MRd = 185,85 kN·m (= 2024 D.2.6).
{
  const box = { shape: 'box', A: 62.91 * cm2, Iz: 8245 * cm4, Iy: 5133 * cm4, J: 9843 * cm4, Sz: 550 * cm3, Zz: 652 * cm3,
    Sy: 5133 / 11 * cm3, Zy: 520 * cm3, rz: Math.sqrt(8245 / 62.91) * cm, ry: 9.03 * cm, Avy: 2 * 27.48 * 0.63 * cm2, Avz: 2 * 19.48 * 0.63 * cm2,
    dims: { b: 0.22, h: 0.30, t: 0.0063 } };
  const rb = run({ demands: { Mz: 176 }, mat: matOf(34.5, 45), sec: box, member: { L: 8, Lb: 8 } });
  // era PENDENTE (flexão simplificada, +10 %): D.2.7 implementada em 15/10/2026
  caso('P1 TR 300×220×6,3 MRd (FLM inelástica, D.2.7)', 'CBCA 3.7.4 p.185', 'NBR 16239 = 2024 D.2.7', rb.flexaoX.capacity, 185.84, 0.005);
  const D = 32, t = 0.63, W = Math.PI * (D ** 4 - (D - 2 * t) ** 4) / (32 * D), Z = (D ** 3 - (D - 2 * t) ** 3) / 6;
  const I = Math.PI * (D ** 4 - (D - 2 * t) ** 4) / 64, A = Math.PI * (D * t - t * t);
  const pipe = { shape: 'pipe', A: A * cm2, Iz: I * cm4, Iy: I * cm4, J: 2 * I * cm4, Sz: W * cm3, Sy: W * cm3, Zz: Z * cm3, Zy: Z * cm3,
    rz: Math.sqrt(I / A) * cm, ry: Math.sqrt(I / A) * cm, Avy: A / 2 * cm2, Avz: A / 2 * cm2, dims: { D: 0.32, t: 0.0063 } };
  const rp = run({ demands: { Mz: 176 }, mat: matOf(34.5, 45), sec: pipe, member: { L: 8, Lb: 8 } });
  // era PENDENTE (Mpl simplificado, +4,6 %): D.2.6 implementada em 15/10/2026
  caso('P2 tubo circular 320×6,3 MRd (flambagem local da parede, D.2.6)', 'CBCA 3.7.7 p.190', 'NBR 16239 = 2024 D.2.6', rp.flexaoX.capacity, 185.85, 0.005);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
for (const n of NOTAS) console.log(`NOTA     ${n.id} [${n.fonte}]: obtido=${(+n.got).toFixed(3)} livro=${n.exp} (Δ ${(rel(n.got, n.exp) * 100).toFixed(1)} %) — ${n.motivo}`);
for (const p of PENDENTES) console.log(`PENDENTE ${p.id} [${p.fonte}]: obtido=${(+p.got).toFixed(3)} livro=${p.exp} (Δ ${(rel(p.got, p.exp) * 100).toFixed(1)} %) — ${p.motivo}`);
console.log(fails ? `\n${fails} FALHA(S) de ${nOk + fails}; ${NOTAS.length} nota(s), ${PENDENTES.length} pendente(s)`
  : `\n${nOk}/${nOk} ok; ${NOTAS.length} nota(s) de edição/premissa, ${PENDENTES.length} pendente(s)`);
process.exit(fails ? 1 : 0);
