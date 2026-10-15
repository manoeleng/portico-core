// test_nbr6118.mjs — NBR 6118 (concreto armado, viga retangular: flexão simples e cortante) contra literatura
//   node tests/test_nbr6118.mjs      (falha até existir js/design/codes/nbr6118.js)
//
// Fonte dos valores ESPERADOS: Carvalho & Figueiredo Filho, Cálculo e Detalhamento de Estruturas Usuais
// de Concreto Armado, Vol. 1, 4ª ed. (2014) — Cap. 3 Ex. 1, 4, 6, 7 (flexão) e Cap. 6 Ex. 2, 4 e Ex. do
// modelo II (cortante) — lidos de tests/data/nbr6118_carvalho.json (página e dados completos lá). Nenhum
// esperado é calculado aqui. Casos com fck <= 40 MPa e CA-50.
// Base normativa do livro: NBR 6118:2014 (§17.2 flexão, §17.4.2.2/17.4.2.3 cortante Modelos I e II).
// Equivalência 2014→2026 dos itens usados conferida na ficha: para fck <= 40 MPa e CA-50, flexão e
// cortante não mudaram (ηc só acima de 40 MPa; η1 do CA-60 mudou — casos evitados).
// Unidades do módulo: kN, m, kN/m² (JSON em cm, cm², MPa, kN·m → convertidos abaixo).
// Demandas passadas são de CÁLCULO (Md = 1,4·M, Vsd = 1,4·V, como no livro); gamma_c=1,4, gamma_s=1,15.
// Altura h não é dada nos exemplos de flexão/Ex.2 de cortante: usa-se h = d + 0,04 m (não afeta As nem V).
import { readFileSync } from 'node:fs';
import { nbr6118 } from '../js/design/codes/nbr6118.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

const D = JSON.parse(readFileSync(new URL('./data/nbr6118_carvalho.json', import.meta.url), 'utf8'));
const cm = 0.01, cm2 = 1e-4, MPa = 1000, FYK = 500 * MPa; // CA-50
const OPT = { gamma_c: 1.4, gamma_s: 1.15 };
const run = (id, input) => { try { return nbr6118.check(input); } catch (e) { fails++; console.log(`✗ ${id}: exceção ${e.message}`); return null; } };

const secOf = (dd, extra = {}) => {
  const b = dd.bw_cm * cm, d = dd.d_cm * cm, h = (dd.h_cm ?? dd.d_cm + 4) * cm;
  return { shape: 'rect', b, h, A: b * h, d, rebar: { layers: [] }, ...extra };
};
const matOf = (dd) => ({ fc: dd.fck_MPa * MPa, fyRebar: FYK });
const flex = (id, dd, Md, extraSec = {}) => run(id, { demands: { N: 0, Vy: 0, Vz: 0, My: 0, Mz: Md }, mat: matOf(dd), sec: secOf(dd, extraSec), member: {}, options: { ...OPT } });
const cort = (id, dd, V, options, rebar) => run(id, { demands: { N: 0, Vy: V, Vz: 0, My: 0, Mz: 0 }, mat: matOf(dd), sec: secOf(dd, rebar ? { rebar } : {}), member: {}, options: { ...OPT, ...options } });

// BR-6118-01a · Carvalho Cap.3 Ex.1 (p.130-131) — As necessária, domínio 2
{
  const c = D.casos['BR-6118-01a'], e = c.esperado;
  const r = flex('01a', c.dados, c.dados.Md_kNm);
  if (r) {
    ok('01a-1. x/d — Ex.1 (x=0,0545 m)', r.flexao.xd, e.x_d, c.tol.x_d);
    assert('01a-2. domínio 2', r.flexao.dominio === e.dominio, String(r.flexao.dominio));
    ok('01a-3. As necessária (cm²) — Ex.1', r.flexao.asNec / cm2, e.As_cm2, c.tol.As);
    assert('01a-4. sem armadura de compressão', !(r.flexao.asLinhaNec > 0), String(r.flexao.asLinhaNec));
  }
}

// BR-6118-01b · Carvalho Cap.3 Ex.6b (p.143-144) — d = 0,20 m, KMD=0,25, domínio 3
{
  const c = D.casos['BR-6118-01b'], e = c.esperado;
  const r = flex('01b', c.dados, c.dados.Md_kNm);
  if (r) {
    ok('01b-1. x/d — Ex.6b (KX=0,4479)', r.flexao.xd, e.x_d, c.tol.x_d);
    assert('01b-2. domínio 3', r.flexao.dominio === e.dominio, String(r.flexao.dominio));
    ok('01b-3. As necessária (cm²) — Ex.6b', r.flexao.asNec / cm2, e.As_cm2, c.tol.As);
    assert('01b-4. sem armadura de compressão', !(r.flexao.asLinhaNec > 0), String(r.flexao.asLinhaNec));
  }
}

// BR-6118-01c · Carvalho Cap.3 Ex.7 (p.146-147) — armadura dupla, x/d limite 0,45, d' = 3,6 cm
//   dLinha (distância da armadura comprimida à borda) passada em sec.dLinha — extensão ao contrato.
{
  const c = D.casos['BR-6118-01c'], e = c.esperado, dd = c.dados;
  const r = flex('01c', dd, dd.Md_kNm, { dLinha: dd.dLinha_cm * cm });
  if (r) {
    ok('01c-1. x/d limite (ductilidade)', r.flexao.xd, e.xlim_d, c.tol.xd);
    assert('01c-2. domínio 3', r.flexao.dominio === e.dominio, String(r.flexao.dominio));
    ok('01c-3. As tracionada total (cm²) — Ex.7', r.flexao.asNec / cm2, e.As_total_cm2, c.tol.As);
    ok("01c-4. A's comprimida (cm²) — Ex.7", r.flexao.asLinhaNec / cm2, e.AsLinha_cm2, c.tol.AsLinha);
  }
}

// BR-6118-01d · Carvalho Cap.3 Ex.4 (p.137-138) — MRd dada As (domínio 2 e domínio 3)
{
  const c = D.casos['BR-6118-01d'], dd = c.dados;
  for (const p of c.pontos) {
    const r = flex('01d' + p.id, dd, 1, { rebar: { layers: [{ As: p.As_cm2 * cm2, d: dd.d_cm * cm }] } });
    if (r) ok(`01d-${p.id}. MRd (kN·m) As=${p.As_cm2} cm², domínio ${p.dominio} — Ex.4`, r.flexao.capacity, p.MRd_kNm, c.tol.MRd);
  }
}

// BR-6118-02a · Carvalho Cap.6 Ex.2 (p.296-298) — Modelo I, bw=70, d=200, fck 26, Vsd=1820 kN
{
  const c = D.casos['BR-6118-02a'], e = c.esperado, dd = c.dados;
  const r = cort('02a', dd, dd.Vsd_kN, { modeloCortante: 'I', alpha: dd.alpha_graus });
  if (r) {
    assert('02a-1. modelo I', r.cortante.modelo === 'I', String(r.cortante.modelo));
    ok('02a-2. VRd2 (kN) — Ex.2 (6289,9)', r.cortante.VRd2, e.VRd2_kN, c.tol.VRd2);
    ok('02a-3. Vc (kN) — Ex.2 (1108,8)', r.cortante.Vc, e.Vc_kN, c.tol.Vc);
    ok('02a-4. Asw/s necessária (cm²/m) — Ex.2 (s=27,5 cm, 2φ12,5)', r.cortante.aswNec / cm2, e.AswS_cm2_m, c.tol.AswS);
  }
}

// BR-6118-02b · Carvalho Cap.6 Ex.4 (p.299-300) — Modelo I, V101: bw=25, d=80, fck 20, Vsd=357,7 kN
//   Estribo dado (φ6,3 c/ 8,90 cm, 2 ramos): VRd3 deve igualar Vsd (o livro dimensiona s para isso).
{
  const c = D.casos['BR-6118-02b'], e = c.esperado, dd = c.dados;
  const r = cort('02b', dd, dd.Vsd_kN, { modeloCortante: 'I', alpha: dd.alpha_graus },
    { layers: [], stirrups: { dia: 6.3, s: 89, legs: 2 } });
  if (r) {
    ok('02b-1. VRd2 (kN) — Ex.4 (τRd2=3,55 MPa)', r.cortante.VRd2, e.VRd2_kN, c.tol.VRd2);
    ok('02b-2. Vc (kN) — Ex.4 (τc=0,66 MPa)', r.cortante.Vc, e.Vc_kN, c.tol.Vc);
    ok('02b-3. Asw/s necessária (cm²/m) — Ex.4 (ρsw=2,88e-3)', r.cortante.aswNec / cm2, e.AswS_cm2_m, c.tol.AswS);
    ok('02b-4. VRd3 (kN) com φ6,3 c/ 8,9 = Vsd do livro (tol 3%: livro usa 0,32 cm²/ramo; π·6,3²/4 = 0,312)', r.cortante.capacity, e.VRd3_kN, c.tol.VRd3);
  }
}

// BR-6118-02c · Carvalho Cap.6, Exemplo do Modelo II (p.302-304) — θ=30°, mesma viga V101
{
  const c = D.casos['BR-6118-02c'], e = c.esperado, dd = c.dados;
  const r = cort('02c', dd, dd.Vsd_kN, { modeloCortante: 'II', theta: dd.theta_graus, alpha: dd.alpha_graus });
  if (r) {
    assert('02c-1. modelo II', r.cortante.modelo === 'II', String(r.cortante.modelo));
    ok('02c-2. VRd2,II (kN) — τRd2=3,07 MPa', r.cortante.VRd2, e.VRd2_kN, c.tol.VRd2);
    ok('02c-3. Vc,II (kN) — τc=0,351 MPa (interpolado)', r.cortante.Vc, e.Vc_kN, c.tol.Vc);
    ok('02c-4. Asw/s necessária (cm²/m) — ρsw=2,12e-3', r.cortante.aswNec / cm2, e.AswS_cm2_m, c.tol.AswS);
    // Coerência citada no livro (p.304): Modelo II (θ=30°) pede menos estribo que o I (s 12,1 > 8,90 cm)
    const r1 = cort('02c-I', dd, dd.Vsd_kN, { modeloCortante: 'I', alpha: dd.alpha_graus });
    if (r1) assert('02c-5. Asw/s(II,30°) < Asw/s(I) — livro p.304', r.cortante.aswNec < r1.cortante.aswNec, `${r.cortante.aswNec} < ${r1.cortante.aswNec}`);
  }
}

// BR-6118-03 · Pilar, 2ª ordem local — Bastos (UNESP, notas de aula "Pilares", base NBR 6118:2014),
// Ex. 1: pilar 20×50, C20, CA-50, Nd = 1100 kN, le = 2,80 m, eixo de h = 20 cm, M1d,A < M1d,mín.
// Esperados do livro: λ = 48,4; M1d,mín = 2310 kN·cm; ν = 0,77; Md,tot = 4008 kN·cm (curvatura aproximada)
// e 3500 kN·cm (rigidez κ). Itens iguais na 2026 (ficha de pilares: M1d,mín, λ1, αb biapoiado, 15.8.3.3.2/3).
{
  const { columnSecondOrder } = await import('../js/design/codes/nbr6118.js');
  const base = { h: 0.20, Ac: 0.10, Nd: 1100, M1dA: 0, le: 2.80, fcdK: 20000 / 1.4 };
  const c = columnSecondOrder(base), k = columnSecondOrder({ ...base, opts: { metodo: 'kappa' } });
  const ok2 = (name, got, exp, tol) => { const e = Math.abs(got - exp) / Math.abs(exp); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
  ok2('03a. λ — Bastos Ex.1', c.lambda, 48.4, 0.005);
  ok2('03b. M1d,mín (kN·cm)', c.M1dmin * 100, 2310, 0.001);
  ok2('03c. ν', c.nu, 0.77, 0.002);
  ok2('03d. Md,tot curvatura aproximada (kN·cm)', c.Mdtot * 100, 4008, 0.002);
  ok2('03e. Md,tot rigidez κ (kN·cm) — livro arredonda a 3500', k.Mdtot * 100, 3500, 0.005);
  console.log(`${c.alphab === 1 ? '✓' : '✗'} 03f. αb = 1,0 quando M1d,A < M1d,mín`); if (c.alphab !== 1) fails++;
  // 2026: αb do balanço = 1,0 (mudou em relação à 2014)
  const bal = columnSecondOrder({ ...base, M1dA: 50, rMBA: -0.5, opts: { balanco: true } });
  console.log(`${bal.alphab === 1 ? '✓' : '✗'} 03g. balanço: αb = 1,0 (NBR 6118:2026 15.8.2)`); if (bal.alphab !== 1) fails++;
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
