// test_nbr6118_els.mjs — NBR 6118 ELS (flecha: Mr, estádio II, Branson, fluência; fissuração: wk) contra literatura
//   node tests/test_nbr6118_els.mjs
//
// Fonte dos valores ESPERADOS: Carvalho & Figueiredo Filho, Vol. 1, 4ª ed. (2014), Cap. 4 Ex.1 (p.212-215,
// fissuras), Ex.2 (p.215-219) e Ex.3 (p.219-220) (flechas) — lidos de tests/data/nbr6118_els_carvalho.json.
// Nenhum esperado é calculado aqui; só a mecânica da viga (5·p·l⁴/384·EI) e σs = M·y·αe/III usam os
// números retornados pelas funções. Casos com fck <= 40 MPa; fissuração com CA-50 (η1 = 2,25).
// Base do livro: NBR 6118:2014 (§17.3.2.1 flecha, §17.3.3.2 fissuras). Equivalência 2026: para fck <= 40 e
// CA-50 as expressões usadas não mudaram (η1 do CA-60 e ηc > 40 MPa evitados).
// NÃO aferido contra o livro: crackingMoment (o livro só calcula Mr para a seção T, e a função é retangular;
// Mr, Ic e yt vão como entrada do livro). Ex.2/3 são seção T com LN na mesa (x < hf) = retangular b=bf,
// AsLinha = 0, logo stage2Inertia é comparável. Ecs = 21287 MPa (= 4760·√fck, valor do livro).
// Unidades das funções: kN, m, MPa onde indicado (JSON em cm → convertido abaixo).
import { readFileSync } from 'node:fs';
import { stage2Inertia, equivalentStiffness, xiTime, creepFactor, crackWidth, crackLimit } from '../js/design/codes/nbr6118.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

const D = JSON.parse(readFileSync(new URL('./data/nbr6118_els_carvalho.json', import.meta.url), 'utf8'));
const cm = 0.01, cm2 = 1e-4, cm4 = 1e-8;

// Flecha do livro: Ex.2 e Ex.3
for (const [id, tag] of [['BR-6118-04a', '04a'], ['BR-6118-04b', '04b']]) {
  const c = D.casos[id], d = c.dados, e = c.esperado, t = c.tol;
  const b = d.bf_cm * cm, dd = d.d_cm * cm, As = d.As_cm2 * cm2, Ecs = d.Ecs_MPa * 1000, L = d.vao_m;
  const s2 = stage2Inertia({ b, d: dd, As, AsLinha: 0, dLinha: 0, alphaE: d.alphaE });
  ok(`${tag}-1. x_II (cm)`, s2.x / cm, e.x_cm, t.x);
  assert(`${tag}-2. LN na mesa (x < hf)`, s2.x < d.hf_cm * cm);
  ok(`${tag}-3. I_II (cm⁴)`, s2.III / cm4, e.III_cm4, t.III);
  const Ic = d.Ic_cm4 * cm4;
  let aQP = 0;
  for (const k of d.comb) {
    const EI = equivalentStiffness({ Ecs, Ic, III: s2.III, Mr: d.Mr_kNm, Ma: k.Ma_kNm });
    const a = 5 * k.p_kNm * L ** 4 / (384 * EI) / cm;   // mecânica: flecha de viga biapoiada, EI = (EI)eq retornado
    ok(`${tag}-4. flecha imediata ${k.nome} (cm)`, a, k.a_cm, t.flecha);
    if (k.nome === 'quase permanente') aQP = a;
  }
  const t0 = d.t0_meses ?? 0.47;
  if (e.xi_t0 !== undefined) ok(`${tag}-5. ξ(t0=0,47 mês)`, xiTime(t0), e.xi_t0, t.xi);
  assert(`${tag}-6. ξ(t>70 meses) = 2`, xiTime(100) === 2);
  const af = creepFactor({ t0, rhoLinha: 0 });
  ok(`${tag}-7. αf (ρ'=0)`, af, e.alpha_f, t.alpha_f ?? 0.01);
  ok(`${tag}-8. flecha total t=∞ = a_QP·(1+αf) (cm)`, aQP * (1 + af), e.a_total_cm, t.total);
}

// Fissuração do livro: Ex.1 (viga V101, CA-50)
{
  const c = D.casos['BR-6118-04c'], d = c.dados, e = c.esperado, t = c.tol;
  const s2 = stage2Inertia({ b: d.b_cm * cm, d: d.d_cm * cm, As: d.As_cm2 * cm2, alphaE: d.alphaE });
  ok('04c-1. x_II (cm)', s2.x / cm, e.x_cm, t.x);
  ok('04c-2. I_II (cm⁴)', s2.III / cm4, e.III_cm4, t.III);
  const sigS = d.Mser_kNm * d.yst_m * d.alphaE / s2.III / 1000;   // mecânica: σs = M·y·αe/III (kN/m² → MPa)
  ok('04c-3. σs estádio II (MPa) — M_ser, y_st do livro', sigS, e.sigmaS_MPa, t.sigmaS);
  const base = { phi: d.phi_mm, eta1: d.eta1, fctm: d.fctm_MPa, rhoR: d.rhoR };
  ok('04c-4. wk com σs = 245 MPa simplificado (mm)', crackWidth({ ...base, sigmaS: d.sigma_simplificado_MPa }), e.wk_simplificado_mm, t.wk);
  ok('04c-5. wk com σs = 204 MPa estádio II (mm)', crackWidth({ ...base, sigmaS: e.sigmaS_MPa }), e.wk_exato_mm, t.wk);
  assert('04c-6. wk <= limite CAA II (0,3 mm)', crackWidth({ ...base, sigmaS: e.sigmaS_MPa }) <= crackLimit('II') && crackLimit('II') === e.limite_mm);
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
