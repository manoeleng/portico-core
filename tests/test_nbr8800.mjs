// test_nbr8800.mjs — NBR 8800 (aço, perfil I) contra oráculos de literatura
//   node tests/test_nbr8800.mjs      (falha até existir js/design/codes/nbr8800.js)
//
// Fonte dos valores ESPERADOS: Pfeil & Pfeil, Estruturas de Aço, 9ª ed. (2022) — Probl. 2.3.8, 5.8.2,
// 5.8.3, Ex. 6.2.4 e Viga V3 — transcritos/validados nos fixtures de C:\projetos\StructPro-Pro
// (tests\StructPro.Tests\Fixtures\*.json) e lidos de tests/data/nbr8800_pfeil.json. Nenhum esperado é
// calculado aqui. Propriedades de perfil: laminados-gerdau.csv do StructPro-Pro.
// Base normativa do livro: NBR 8800:2008 (os fixtures citam §NBR 8800:2024). A equivalência
// 2008→2024 desses itens está registrada nas fichas do StructPro-Pro (docs/decisoes.md).
// Unidades do módulo: kN, m, kN/m² (fixtures em cm, kN/cm², kN·cm → convertidos abaixo).
// Pulados (dados insuficientes): P1-FS-A / P1-FC-A (Pfeil 7.6.5, CVS 400x87: só A, Zx, Wx, ry e λ;
// faltam d, bf, tf, tw para o módulo).
import { readFileSync } from 'node:fs';
import { nbr8800 } from '../js/design/codes/nbr8800.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

const D = JSON.parse(readFileSync(new URL('./data/nbr8800_pfeil.json', import.meta.url), 'utf8'));
const cm = 0.01, cm2 = 1e-4, cm3 = 1e-6, cm4 = 1e-8, cm6 = 1e-12, KNCM2 = 1e4;

// Seção I completa (laminado) a partir de linha do CSV, em m. λ de catálogo = bf/2tf e h/tw.
function secI(p) {
  return {
    shape: 'I', fabricacao: 'laminado',
    A: p.A * cm2, Iz: p.Ix * cm4, Iy: p.Iy * cm4, J: p.It * cm4,
    Sz: p.Wx * cm3, Sy: p.Wy * cm3, Zz: p.Zx * cm3, Zy: p.Zy * cm3, Cw: p.Cw * cm6,
    rz: p.rx * cm, ry: p.ry * cm,
    lambdaFlange: p.bf / (2 * p.tf), lambdaWeb: p.h / p.tw,
    h: p.d * cm, b: p.bf * cm,
    dims: { d: p.d * cm, bf: p.bf * cm, tf: p.tf * cm, tw: p.tw * cm },
  };
}
const matOf = (c) => ({ Fy: c.fy * KNCM2, Fu: (c.fu ?? 1.6 * c.fy) * KNCM2, E: c.E * KNCM2 });
const run = (id, input) => { try { return nbr8800.check(input); } catch (e) { fails++; console.log(`✗ ${id}: exceção ${e.message}`); return null; } };

// BR-8800-01 · Tração, Pfeil 2.3.8 — U 381x50,4 (só Ag disponível; escoamento da seção bruta governa)
{
  const c = D.casos['BR-8800-01'], p = D.perfis[c.perfil];
  const r = run('01', { demands: { N: 1000, Vy: 0, Vz: 0, My: 0, Mz: 0 }, mat: matOf(c),
    sec: { shape: 'I', fabricacao: 'laminado', A: p.A * cm2 }, member: { L: 3, Lb: 3, Kz: 1, Ky: 1, Cb: 1 }, options: { gamma_a1: 1.10, gamma_a2: 1.35 } });
  if (r) {
    assert('01a. modo tração', r.axial.modo === 'tração', r.axial.modo);
    ok('01b. Nt,Rd escoamento (kN) — Pfeil 2.3.8', r.axial.capacity, c.Nt_Rd_escoamento_kN, c.tol);
  }
}

// BR-8800-02 · Compressão, Pfeil 5.8.3 — H 152x40,9, K=1, L=4 m, Q=1. Eixo fraco governa (ry=3,57 cm).
{
  const c = D.casos['BR-8800-02'], p = D.perfis[c.perfil];
  const A = p.A * cm2;
  const sec = { shape: 'I', fabricacao: 'laminado', A, rz: p.rx * cm, ry: p.ry * cm,
    Iz: A * (p.rx * cm) ** 2, Iy: A * (p.ry * cm) ** 2 }; // I = A·r² (só A, rx, ry disponíveis no catálogo)
  const r = run('02', { demands: { N: -500, Vy: 0, Vz: 0, My: 0, Mz: 0 }, mat: matOf(c), sec,
    member: { L: c.L * cm, Lb: c.L * cm, Kz: c.K, Ky: c.K, Cb: 1 }, options: { gamma_a1: 1.10, Q: c.Q } });
  if (r) {
    assert('02a. modo compressão', r.axial.modo === 'compressão', r.axial.modo);
    ok('02b. λ0 (Pfeil 5.8.3)', r.axial.lambda0, c.lambda0, 0.01);
    ok('02c. Nc,Rd (kN) — Pfeil 5.8.3 (tol 1,5% do fixture)', r.axial.capacity, c.Nc_Rd_kN, c.tol);
  }
}

// BR-8800-03 · Curva χ, Pfeil 5.8.2 — W 150x37,1, L=3 m, dois pontos (K=0,7 e K=2,0)
{
  const c = D.casos['BR-8800-03'], p = D.perfis[c.perfil];
  for (const pt of c.pontos) {
    const r = run('03', { demands: { N: -100, Vy: 0, Vz: 0, My: 0, Mz: 0 }, mat: matOf(c), sec: secI(p),
      member: { L: c.L * cm, Lb: c.L * cm, Kz: pt.K, Ky: pt.K, Cb: 1 }, options: { gamma_a1: 1.10, Q: c.Q } });
    if (!r) continue;
    ok(`03 ${pt.apoio} λ0`, r.axial.lambda0, pt.lambda0, 0.01);
    ok(`03 ${pt.apoio} χ`, r.axial.chi, pt.chi, c.tol);
    ok(`03 ${pt.apoio} Nc,Rd (kN)`, r.axial.capacity, pt.Nc_Rd_kN, c.tol);
  }
}

// BR-8800-04 · Flexão compacta contida, Pfeil 6.2.4 — W 530x66,0, MRd = Mpl/γa1 (Lb curto, Cb=1)
{
  const c = D.casos['BR-8800-04'], p = D.perfis[c.perfil];
  const r = run('04', { demands: { N: 0, Vy: 0, Vz: 0, My: 0, Mz: 100 }, mat: matOf(c), sec: secI(p),
    member: { L: c.Lb * cm, Lb: c.Lb * cm, Kz: 1, Ky: 1, Cb: c.Cb }, options: { gamma_a1: 1.10 } });
  if (r) {
    ok('04a. Mpl (kN·m) — Pfeil 6.2.4', r.flexaoX.Mpl, c.Mpl_kNcm / 100, c.tol);
    ok('04b. MRd (kN·m) — Pfeil 6.2.4', r.flexaoX.capacity, c.MRd_kNcm / 100, c.tol);
  }
}

// BR-8800-05 · FLT intermediária, Pfeil V3 — W 410x38,8 AR350, Lb=2,5 m, Cb=1,67 (2008: governa Mpl/γa1; 2024: FLT intermediária — ver 05f)
{
  const c = D.casos['BR-8800-05'], p = D.perfis[c.perfil];
  const r = run('05', { demands: { N: 0, Vy: 0, Vz: 0, My: 0, Mz: 136.75 }, mat: matOf(c), sec: secI(p),
    member: { L: c.Lb * cm, Lb: c.Lb * cm, Kz: 1, Ky: 1, Cb: c.Cb }, options: { gamma_a1: 1.10 } });
  if (r) {
    ok('05a. Lp (m)', r.flexaoX.Lp, c.Lp_cm * cm, c.tol);
    ok('05c. Mpl (kN·m)', r.flexaoX.Mpl, c.Mpl_kNcm / 100, c.tol);
    ok('05d. Mr (kN·m)', r.flexaoX.Mr, c.Mr_kNcm / 100, c.tol);
    ok('05e. Mcr (kN·m)', r.flexaoX.Mcr, c.Mcr_kNcm / 100, c.tol);
    // NBR 8800:2024 MUDOU a FLT (D.2.1/D.2.8-a): Cb entra em λr e Mcr e NÃO multiplica a interpolação.
    // O Lr = 3,42 m e o MRd = 231,1 kN·m do Pfeil são da forma 2008 (Lr sem Cb; Cb·[…] ≤ Mpl).
    // (b) Lr do Pfeil vale nas duas edições com Cb = 1 → aferido com Cb = 1.
    const r1 = run('05-Cb1', { demands: { N: 0, Vy: 0, Vz: 0, My: 0, Mz: 136.75 }, mat: matOf(c), sec: secI(p),
      member: { L: c.Lb * cm, Lb: c.Lb * cm, Kz: 1, Ky: 1, Cb: 1 }, options: { gamma_a1: 1.10 } });
    if (r1) ok('05b. Lr com Cb=1 (m) — Pfeil V3', r1.flexaoX.Lr, c.Lr_cm * cm, c.tol);
    // (f) MRd com Cb = 1,67 pela 2024 — CÁLCULO MANUAL (não é o Pfeil; ratificar pelo RT), kN·cm:
    //   Mr = 0,7·34,5·640,5 = 15 468; β1 = Mr/(E·J) = 15 468/(20 000·11,69) = 0,06616 /cm
    //   λr = 1,38·1,67·√(404·11,69)/(2,83·11,69·0,06616) · √(1+√(1+27·153 190·0,06616²/(1,67²·404))) = 163,9
    //   λ = 250/2,83 = 88,34; λp = 1,76·√(20 000/34,5) = 42,38; Mpl = 736,8·34,5 = 25 420
    //   Mn = 25 420 − (25 420 − 15 468)·(88,34 − 42,38)/(163,9 − 42,38) = 21 656 → MRd = 21 656/1,10 = 19 687 kN·cm
    ok('05f. MRd 2024 com Cb=1,67 (kN·m) — cálculo manual', r.flexaoX.capacity, 196.87, 0.01);
    ok('05g. Lr 2024 com Cb=1,67 (m) — cálculo manual (163,9·2,83 cm)', r.flexaoX.Lr, 4.639, 0.01);
  }
}

// BR-8800-06 · Cortante, Pfeil V3 — W 410x38,8, h/tw=55,8 < limite de plastificação, Vrd = 481 kN
{
  const c = D.casos['BR-8800-06'], p = D.perfis[c.perfil];
  const r = run('06', { demands: { N: 0, Vy: c.Vsd_kN, Vz: 0, My: 0, Mz: 0 }, mat: matOf(c), sec: secI(p),
    member: { L: 2.5, Lb: 2.5, Kz: 1, Ky: 1, Cb: 1 }, options: { gamma_a1: 1.10 } });
  if (r) {
    assert('06a. regime plastificação', /plastific/i.test(String(r.corteY.regime)), String(r.corteY.regime));
    ok('06b. Vrd (kN) — Pfeil V3', r.corteY.capacity, c.Vrd_kN, c.tol);
  }
}

// BR-8800-07 · Itens NOVOS da 2024 — I soldado sintético d=500, bf=300, tf=12,5, tw=6,3 mm; fy=345 MPa;
// E=200 GPa; L=Lb=4 m; Cb=1. Oráculo: cálculo INDEPENDENTE do revisor (Python, do zero, a partir do PDF da
// NBR 8800:2024 — Ne=min(Nex,Ney,Nez), Aef por largura efetiva com kc, FLM soldado, cortante inelástico).
// Não é literatura: ratificar pelo RT.
{
  const { resolveSectionProps } = await import('../js/design/section_props.js');
  const sec = resolveSectionProps({ design: { shape: 'I', dims: { d: 0.5, bf: 0.3, tf: 0.0125, tw: 0.0063 }, fabricacao: 'soldado' } });
  const mat = { Fy: 345e3, E: 200e6 };
  const rc = run('07c', { demands: { N: -100 }, mat, sec, member: { L: 4, Lb: 4, Cb: 1 } });
  const rb = run('07b', { demands: { Mz: 100, Vy: 10 }, mat, sec, member: { L: 4, Lb: 4, Cb: 1 } });
  if (rc && rb) {
    ok('07a. Ne = Ney (kN)', rc.axial.Ne, 6941, 0.001);
    ok('07b. λ0', rc.axial.lambda0, 0.7222, 0.001);
    ok('07c. χ', rc.axial.chi, 0.8039, 0.001);
    ok('07d. Aef (cm²) — mesa e alma esbeltas, 5.3.4.2', rc.axial.Aef * 1e4, 92.22, 0.001);
    ok('07e. Nc,Rd (kN)', rc.axial.capacity, 2325, 0.001);
    ok('07f. MRd FLM soldado (kN·m) — governa', rb.flexaoX.capacity, 610.9, 0.001);
    ok('07g. MRd FLT (kN·m)', rb.flexaoX.MRdFLT, 640.3, 0.001);
    ok('07h. Lr (m)', rb.flexaoX.Lr, 8.02, 0.002);
    ok('07i. VRd alma (kN), regime inelástico', rb.corteY.capacity, 481.2, 0.001);
    assert('07j. regime inelástico', /inel/i.test(rb.corteY.regime), rb.corteY.regime);
  }
}

// BR-8800-08 · Robustez (revisão): avisos e falha visível
{
  const c = D.casos['BR-8800-05'], p = D.perfis[c.perfil];
  const base = { mat: matOf(c), options: { gamma_a1: 1.10 } };
  const rK = run('08a', { ...base, demands: { N: -100 }, sec: secI(p), member: { L: 3, Lb: 3, K: 0.7 } });
  if (rK) assert('08a. K < 1 gera aviso de contra a segurança', rK.avisos.some(a => /K < 1/.test(a)));
  const s = secI(p); delete s.lambdaFlange; delete s.lambdaWeb; s.dims = {};
  const rL = run('08b', { ...base, demands: { Mz: 50 }, sec: s, member: { L: 3, Lb: 3 } });
  if (rL) {
    assert('08b. sem λ nem dims → aviso', rL.avisos.some(a => /NÃO verificadas/.test(a)));
    assert('08c. sem λ nem dims → flexão não passa em silêncio', rL.flexaoX.ratio === Infinity);
  }
  const rI = run('08d', { ...base, demands: { N: -300, Mz: 40 }, sec: secI(p), member: { L: 3, Lb: 3 } });
  if (rI) {
    const nr = 300 / rI.axial.capacity, mm = 40 / rI.flexaoX.capacity;
    const H = nr >= 0.2 ? nr + 8 / 9 * mm : nr / 2 + mm;
    ok('08d. interação 5.5.1.2 coerente com as capacidades', rI.interaction.demand, H, 0.001);
  }
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTODOS OK');
process.exit(fails ? 1 : 0);
