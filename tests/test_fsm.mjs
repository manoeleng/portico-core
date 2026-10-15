// test_fsm.mjs — método das faixas finitas (js/design/fsm.js) e MRD da NBR 14762:2010 Anexo C
//   node tests/test_fsm.mjs
// Oráculos independentes do código:
//   (1) Placa simplesmente apoiada sob compressão uniforme (Timoshenko & Gere): σcr = k·π²·D/(b²·t),
//       k(a) = (b/a + a/b)² para uma meia-onda → k = 4,000 em a = b; 6,25 em a = b/2; 4,2025 em a = 0,8b
//   (2) Euler na onda longa com as propriedades da MESMA linha média: N = π²·E·Iy/a² (Ue 100×50×17×3, Iy calculado aqui)
//   (3) Manual CBCA "Estruturas Compostas por Perfis Formados a Frio", Ex. 06: Ue 100×50×17×3,00 → Ndist = 575,60 kN
//       (DimPerfil 4.0 / INSTAB; o modelo aqui é de linha média com cantos vivos — tolerância 3 %)
//   (4) MRD (Anexo C, C.3/C.4) refeito à mão em Python: A = 6,43 cm², fy = 25 kN/cm², Ne = 100, Nℓ = 200 → λ0 = 1,26787,
//       Nc,Re = 82,0255; Nℓ = 60 → λℓ = 1,16923, Nc,Rℓ = 62,8011; Ndist = 575,6 → λdist = 0,52846 ≤ 0,561 → A·fy = 160,75;
//       W = 20 cm³, Me = 700, Mℓ = 900, Mdist = 450 → MRe = 444,7929, MRℓ = MRe (λℓ = 0,7030), MRdist = 375,3416 (λdist = 1,05409)
import { bucklingFactor, channelModel, criticalLoadsChannel } from '../js/design/fsm.js';
import { mrdCompressao14762, mrdFlexao14762, nbr14762 } from '../js/design/codes/nbr14762.js';
import { cfSection } from '../js/design/profiles_cf.js';

let fails = 0, n = 0;
const ok = (name, got, exp, rel = 1e-4) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= rel)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)}%)`); } else console.log(`ok   ${name}: ${got}`); };
const assert = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name}${info ? ' · ' + info : ''}`); } else console.log(`ok   ${name}`); };

// (1) placa
{
  const nb = 8, b = 100, t = 1, E = 200000, nu = 0.3;
  const nodes = [...Array(nb + 1).keys()].map(i => ({ x: i * b / nb, z: 0 }));
  const model = { nodes, strips: [...Array(nb).keys()].map(i => ({ i, j: i + 1, t })), E, nu, stress: nodes.map(() => 1),
    fixed: [{ node: 0, dof: 2 }, { node: nb, dof: 2 }, { node: 0, dof: 0 }, { node: nb, dof: 0 }] };
  const D = E * t ** 3 / (12 * (1 - nu * nu)), kOf = (a) => bucklingFactor(model, a) * t * b * b / (Math.PI ** 2 * D);
  ok('P1. placa: k = 4,000 em a = b', kOf(100), 4.0, 1e-4);
  ok('P2. k = 6,25 em a = b/2', kOf(50), 6.25, 1e-4);
  ok('P3. k = 4,2025 em a = 0,8b', kOf(80), 4.2025, 1e-4);
}
// (2) Euler com a mesma linha média
{
  const m = channelModel({ bw: 100, bf: 50, D: 17, t: 3 }), t = 3;
  let A = 0, Sx = 0; for (const s of m.strips) { const P = m.nodes[s.i], Q = m.nodes[s.j], L = Math.hypot(Q.x - P.x, Q.z - P.z); A += L * t; Sx += L * t * (P.x + Q.x) / 2; }
  const xc = Sx / A; let Iy = 0; for (const s of m.strips) { const P = m.nodes[s.i], Q = m.nodes[s.j], L = Math.hypot(Q.x - P.x, Q.z - P.z), xm = (P.x + Q.x) / 2 - xc; Iy += t * L * (xm * xm + (Q.x - P.x) ** 2 / 12); }
  for (const a of [3000, 6000]) ok(`E${a}. onda longa a = ${a} mm: FSM = Euler π²EIy/a²`, bucklingFactor({ ...m, stress: m.nodes.map(() => 1) }, a) * A, Math.PI ** 2 * 200000 * Iy / a ** 2, 4e-3);
}
// (3) Ndist do Manual CBCA (DimPerfil)
{
  const r = criticalLoadsChannel({ bw: 100, bf: 50, D: 17, t: 3 }, { E: 200000, nu: 0.3 });
  ok('D1. Ue 100×50×17×3: Ndist ≈ 575,60 kN (DimPerfil), tolerância 3 %', r.Ndist / 1e3, 575.60, 0.03);
  assert('D1b. mínimo local antes do distorcional na curva de assinatura', r.aNl < r.aNdist, `${r.aNl} / ${r.aNdist}`);
  assert('D1c. Mdist positivo e distinto', r.Mdist > 0 && r.aMdist > r.aMl);
}
// (4) MRD — fórmulas do Anexo C
{
  const c = mrdCompressao14762({ A: 6.43, fy: 25, Ne: 100, Nl: 200, Ndist: 575.6 });
  ok('M1. Nc,Re (C.3.1)', c.NcRe, 82.02554, 1e-6);
  ok('M1b. Nc,Rℓ = Nc,Re para λℓ ≤ 0,776', c.NcRl, 82.02554, 1e-6);
  ok('M1c. Nc,Rdist = A·fy para λdist ≤ 0,561', c.NcRdist, 160.75, 1e-9);
  ok('M2. Nℓ = 60: Nc,Rℓ (C.3.2)', mrdCompressao14762({ A: 6.43, fy: 25, Ne: 100, Nl: 60, Ndist: 575.6 }).NcRl, 62.80109, 1e-6);
  const f = mrdFlexao14762({ W: 20, fy: 25, Me: 700, Ml: 900, Mdist: 450 });
  ok('M3. MRe (C.4.1)', f.MRe, 444.79286, 1e-6);
  ok('M3b. MRdist (C.4.3) governa', f.MRk, 375.34165, 1e-6);
}
// (5) ligação no dimensionamento: Ue fora das Tab. 11/14 passa a ser verificado com Ndist/Mdist das faixas finitas
{
  const r = nbr14762.check({ demands: { N: -20, Mz: 0.3 }, mat: { Fy: 250000, E: 2e8 }, sec: cfSection('Ue 200x75x25x3,00'),
    member: { L: 3, Lx: 3, Ly: 3, Lz: 3, Lb: 3, Cb: 1 }, options: {} });
  assert('I1. compressão verificada com Ndist por faixas finitas', r.axial.verificado !== false && r.axial.distorcional?.fonte === 'faixas finitas', JSON.stringify(r.axial.distorcional));
  assert('I1b. flexão verificada com Mdist por faixas finitas', r.flexaoX.verificado !== false && r.flexaoX.dist?.fonte === 'faixas finitas');
  assert('I1c. avisos citam a origem (faixas finitas)', r.avisos.some(a => /Ndist = .* faixas finitas/.test(a)) && r.avisos.some(a => /Mdist = .* faixas finitas/.test(a)));
}

// (6) opção MRD no dimensionamento: Nc,Rd = Nc,Rk/1,20 e MRd = MRk/1,10 com as funções do Anexo C (checadas em (4))
{
  const r = nbr14762.check({ demands: { N: -20, Mz: 0.3 }, mat: { Fy: 250000, E: 2e8 }, sec: cfSection('Ue 200x75x25x3,00'),
    member: { L: 3, Lx: 3, Ly: 3, Lz: 3, Lb: 3, Cb: 1 }, options: { metodo: 'MRD' } });
  assert('R1. compressão pelo MRD', /Anexo C/.test(r.axial.formula) && r.axial.mrd);
  ok('R1b. Nc,Rd = Nc,Rk/1,20', r.axial.capacity, +(r.axial.mrd.NcRk / 1.20).toFixed(4), 1e-4);
  assert('R2. flexão pelo MRD', /MRD/.test(r.flexaoX.ramo || ''), r.flexaoX.ramo);
  ok('R2b. MRd = MRk/1,10 (kN·m)', r.flexaoX.capacity, +(r.flexaoX.mrd.MRk / 1.10 / 100).toFixed(4), 1e-4);
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
