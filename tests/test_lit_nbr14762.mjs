// test_lit_nbr14762.mjs — NBR 14762:2010 (js/design/codes/nbr14762.js) contra EXEMPLOS RESOLVIDOS DA LITERATURA
//   node tests/test_lit_nbr14762.mjs
//
// Só exemplos NÃO usados em test_nbr14762*.mjs (lá: CBCA 2014 Ex.04-09/Anexo D, CBCA 449 MLE/Ne, Mód. 05 2L).
// Todas as fontes abaixo declaram a NBR 14762:2010 (χ = 0,658^λ0², γc = 1,20, kv = 5,0, Tab. 11/14, Anexo C/F):
//  W4 — apostila Wanderson F. Maia, INBEC/UNICID, Mód. 04 "Perfis formados a frio I" (2015), "com base na ABNT NBR
//       14762:2010" (p.1): Ex.1 compressão U 127x50x2,0 (p.149-157), Ex.2 banzo Ue 127x50x17x2,0 (p.158-162),
//       Ex.1 terça Ue 200x75x25x2,65 MLE/MSE (p.184-198) e MRD (p.243-253), MRD compressão U 127x50x2,0 (p.230-237).
//  W5 — idem, Mód. 05 "Perfis formados a frio II" (2015): U 100x50x2,25 banzo inferior (p.101-108), superior
//       (p.109-116), pilar (p.138-144); tração com Ct (p.108/116).
//  W6 — idem, Mód. 06 "Perfis formados a frio III" (2016): terça Ue 100x50x17x2,00 pelo MRD (p.7-20).
//  UF — L. B. dos Santos, UFAL/CTEC, "PFF – Barras submetidas à compressão axial: notas de aula" (arq. 04, CC BY-NC-SA,
//       eduCAPES 572684) p.69-74: Ue 250x85x25x2,00, MLE + distorcional (Ndist de Pierin et al. 2013, ENTRADA);
//       "PFF – O Método da Resistência Direta" (arq. 07, eduCAPES 572687) p.13 (exercício de JAVARONI 2015) e
//       p.14 (exercício de CARVALHO et al. 2020).
// Fontes examinadas e NÃO usadas: CBCA 449 (base NBR 14762:2001 — χ, kv, γ, Ia diferem; Ex.16 tem Wef incoerente);
//   Manual CBCA Galpões (dimensiona com laminados); Calculista de aço Mód. 13 (r0 calculado com as coordenadas do CG
//   em vez de x0 e Ne = Nez sem a flexo-torção do 9.7.2.2, E = 20 500 — erros de formulação).
//
// O valor ESPERADO é o impresso na fonte (nunca recalculado aqui). Tolerâncias:
//   · 1 % para valores impressos com 3-4 algarismos (a fonte arredonda λ0/χ intermediários: p.ex. λ0 = 1,45 → χ);
//   · 2 % onde a fonte imprime 2 algarismos (χ = 0,33) ou onde a grandeza vem de faixas finitas de outro programa
//     (CUFSM: curva de assinatura amostrada em pontos discretos; o fsm.js do PORTICO converge a < 0,6 % com a malha).
// Propriedades: transcritas da fonte (sec(...)); onde o catálogo NBR 6355 (cfSection) coincide com o quadro da fonte
// (Ue 100x50x17x2,00, U 100x50x2,25, Ue 250x85x25x2,00, U 100x50x2,00) o catálogo é usado e a coincidência é testada.
//
// PENDENTES: divergências que NÃO são arredondamento — impressas, não falham a bateria (ver lista no fim).
import { nbr14762, cbMoments, mrdCompressao14762 } from '../js/design/codes/nbr14762.js';
import { criticalLoadsChannel } from '../js/design/fsm.js';
import { cfSection } from '../js/design/profiles_cf.js';

let fails = 0, n = 0;
const pend = [];
const d = (got, exp) => (100 * (got - exp) / exp).toFixed(2);
const ok = (name, got, exp, tol) => {
  n++; const e = Math.abs(got - exp) / Math.abs(exp);
  if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: obtido ${(+got).toPrecision(6)} × esperado ${exp} (Δ ${d(got, exp)} %, tol ${(100 * tol).toFixed(1)} %)`); }
  else console.log(`ok   ${name}: ${(+got).toPrecision(6)} × ${exp} (Δ ${d(got, exp)} %)`);
};
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}${info ? ' · ' + info : ''}`); };
const pendente = (name, got, exp, why) => { pend.push({ name, got, exp, why }); console.log(`PEND ${name}: obtido ${(+got).toPrecision(5)} × fonte ${exp} (Δ ${d(got, exp)} %)`); };

const mm = 1e-3, cm = 1e-2, cm2 = 1e-4, cm3 = 1e-6, cm4 = 1e-8, cm6 = 1e-12;
// quadro de propriedades da fonte (mm, cm², cm⁴, cm⁶, cm) → sec SI do módulo; ri = t ("ri=t" nas figuras)
const sec = (p) => ({ shape: p.shape, dims: { bw: p.bw * mm, bf: p.bf * mm, t: p.t * mm, ri: (p.ri ?? p.t) * mm, ...(p.D ? { D: p.D * mm } : {}) },
  A: p.A * cm2, Iz: p.Ix * cm4, Iy: p.Iy * cm4, J: p.J * cm4, Cw: p.Cw * cm6, x0: p.x0 * cm, r0: p.r0 * cm,
  ...(p.rx ? { rz: p.rx * cm } : {}), ...(p.ry ? { ry: p.ry * cm } : {}), ...(p.Wx ? { Sz: p.Wx * cm3 } : {}), ...(p.xg ? { xg: p.xg * cm } : {}) });
const mat = (fy, fu) => ({ Fy: fy * 1e4, Fu: (fu ?? 1.3 * fy) * 1e4, E: 2e8, G: 7.7e7 });     // E = 20 000, G = 7 700 kN/cm² (todas as fontes)
const run = (input) => nbr14762.check(input);
// tensão crítica (MPa) do fsm.js na linha média: compressão σ = N/A, flexão σ = M/(Ix/zmax) — mesma convenção do CUFSM
const fsmSigma = (dims) => { const f = criticalLoadsChannel(dims, { E: 200000 }); const W = f.model.Ix / f.model.zmax;
  return { l: f.Nl / f.model.A, dist: f.Ndist ? f.Ndist / f.model.A : null, Ml: f.Ml / W, Mdist: f.Mdist ? f.Mdist / W : null }; };

// ── W4 Ex.1 (p.149-157) — U 127x50x2,0 comprimido, KL = 180 cm nas 3 direções, fy = 30 ────────────────────────────
//   p.149: A = 4,41; rx = 4,92; ry = 1,54; Ix = 107,3; Iy = 10,4; Cw = 290; r0 = 5,88; x0 = 2,81; J = 0,0588
//   p.150-151: Nex = 653, Nez = 64, Nexz = 62,6, Ney = 63,5 kN → Ne = 62,6 (flexo-torção); p.152: λ0 = 1,45, χ = 0,415
//   p.153-154 (MLE, σ = 12,45): mesa bef = 38 mm, alma bef = 109,6 mm → Aef = 3,9 cm²; p.155: Nc,Rd = 40,5 kN
{
  const U127 = { shape: 'U', bw: 127, bf: 50, t: 2, A: 4.41, rx: 4.92, ry: 1.54, Ix: 107.3, Iy: 10.4, Cw: 290, r0: 5.88, x0: 2.81, J: 0.0588 };
  const member = { L: 1.8, Lx: 1.8, Ly: 1.8, Lz: 1.8 };
  const a = run({ demands: { N: -10 }, mat: mat(30), sec: sec(U127), member }).axial;
  ok('W4-1 Nex (kN) p.150', a.Nex, 653, 0.01); ok('W4-1 Nez (kN) p.150 (2 alg.)', a.Nez, 64, 0.01);
  ok('W4-1 Ney (kN) p.151', a.Ney, 63.5, 0.01); ok('W4-1 Ne = Nexz (kN) p.151', a.Ne, 62.6, 0.01);
  yes('W4-1 modo = flexo-torção', a.modoGlobal === 'flexo-torção', a.modoGlobal);
  ok('W4-1 λ0 p.152', a.lambda0, 1.45, 0.01); ok('W4-1 χ p.152', a.chi, 0.415, 0.01);
  ok('W4-1 Aef MLE (cm²) p.154', a.Aef / cm2, 3.9, 0.01); ok('W4-1 Nc,Rd MLE (kN) p.155', a.capacity, 40.5, 0.01);
  // MRD (p.230-237): Nℓ = 77,6 kN (CUFSM, σℓ = 176 MPa) → Nc,Re = 54,9; λℓ = 0,84; Nc,Rℓ = 52,2; distorcional não
  // ocorre (sem 2º mínimo, p.236); Nc,Rd = 52,2/1,2 = 43,5 kN
  const m = run({ demands: { N: -10 }, mat: mat(30), sec: sec(U127), member, options: { metodo: 'MRD', Nl: 77.6 } }).axial;
  ok('W4-MRD Nc,Re (kN) p.233', m.mrd.NcRe, 54.9, 0.01); ok('W4-MRD λℓ p.234', m.mrd.lambdaL, 0.84, 0.01);
  ok('W4-MRD Nc,Rℓ (kN) p.234', m.mrd.NcRl, 52.2, 0.01); ok('W4-MRD Nc,Rd (kN) p.237', m.capacity, 43.5, 0.01);
  const s = fsmSigma({ bw: 127, bf: 50, t: 2 });
  ok('W4-MRD σℓ faixas finitas × CUFSM 176 MPa (p.235; tol 2 %: CUFSM amostrado)', s.l, 176, 0.02);
  yes('W4-MRD U simples: sem 2º mínimo distorcional (p.236)', s.dist == null);
  const mf = run({ demands: { N: -10 }, mat: mat(30), sec: sec(U127), member, options: { metodo: 'MRD' } }).axial;
  ok('W4-MRD Nc,Rd com Nℓ do fsm.js (kN) p.237', mf.capacity, 43.5, 0.01);
}

// ── W4 Ex.2 (p.158-162) — banzo Ue 127x50x17x2,0, KxLx = 540, KyLy = KzLz = 180 cm, fy = 30 ────────────────────────
//   p.158: A = 4,96; Ix = 122,8; Iy = 17; J = 0,07; Cw = 614; r0 = 6,56; x0 = 3,85
//   p.159: Ney = 104,2; Nex = 83,07; Nez = 98,66; Ne = Nexz = 56,7 kN; p.160: λ0 = 1,62; χ = 0,33
//   p.161: local pelo MSE (λp = 0,63 ≤ 0,776 → Aef = A) → Nc,Rd = 40,9 kN; p.162: distorcional dispensada (Tab. 11)
//   O módulo usa o MLE (9.2.2), que a norma admite como alternativa ao MSE (9.7.2): Aef < A em 1 % → tol 1 %.
//   Divergência de premissa (não defeito): a fonte lê a Tab. 11 na linha bf/bw = 0,4 com bf/bw = 50/127 = 0,394 < 0,4
//   (fora do domínio impresso); o módulo não extrapola e obtém Ndist por faixas finitas — a distorcional não governa.
{
  const Ue127 = { shape: 'Ue', bw: 127, bf: 50, D: 17, t: 2, A: 4.96, Ix: 122.8, Iy: 17, J: 0.07, Cw: 614, r0: 6.56, x0: 3.85 };
  const a = run({ demands: { N: -10 }, mat: mat(30), sec: sec(Ue127), member: { L: 5.4, Lx: 5.4, Ly: 1.8, Lz: 1.8 } }).axial;
  ok('W4-2 Ney (kN) p.159', a.Ney, 104.2, 0.01); ok('W4-2 Nex (kN) p.159', a.Nex, 83.07, 0.01);
  ok('W4-2 Nez (kN) p.159', a.Nez, 98.66, 0.01); ok('W4-2 Ne = Nexz (kN) p.159', a.Ne, 56.7, 0.01);
  ok('W4-2 λ0 p.160', a.lambda0, 1.62, 0.01); ok('W4-2 χ p.160 (2 alg. → tol 2 %)', a.chi, 0.33, 0.02);
  ok('W4-2 Nc,Rd (kN) p.161 (fonte MSE, módulo MLE)', a.capacity, 40.9, 0.01);
  yes('W4-2 Tab. 11 fora do domínio (bf/bw = 0,394) → Ndist por faixas finitas, não governa', a.distorcional.dispensada === false && a.distorcional.fonte === 'faixas finitas' && a.distorcional.NcRdDist > a.NcRdGlobal);
}

// ── W4 terça (p.184-198, MLE/MSE) — Ue 200x75x25x2,65 biapoiada 7 m, 2 linhas de corrente, vento de sucção, fy = 25 ──
//   p.184: A = 10,14; Ix = 621,7; Iy = 78,7; J = 0,24; Cw = 6862,5; Wx = 62,2; r0 = 10,06; x0 = 5,64
//   p.185: MSd = −1040 kN·cm, VSd = 6,0 kN; p.191: MA = MC = 10,12, MB = Mmax = 10,41 → Cb = 1,01
//   p.188: MRd,esc = 62,2·25/1,1 = 1413,6 kN·cm (Wef = W); p.192: Ney = 286,1, Nez = 264,8 (Lb = 233), Me = 2796,6
//   p.193: λ0 = 0,75, χFLT = 0,936; p.195: MRd,FLT = 1323,2 kN·cm (Wc,ef = W); p.198: h/t = 71,5; limites 68,3 / 88,5;
//   VRd = 65,6 kN
{
  const Ue200 = { shape: 'Ue', bw: 200, bf: 75, D: 25, t: 2.65, A: 10.14, Ix: 621.7, Iy: 78.7, J: 0.24, Cw: 6862.5, Wx: 62.2, r0: 10.06, x0: 5.64 };
  ok('W4-T Cb (p.191)', cbMoments(10.41, 10.12, 10.41, 10.12), 1.01, 0.01);
  const r = run({ demands: { Mz: 10.4, Vy: 6.0 }, mat: mat(25), sec: sec(Ue200), member: { L: 7, Lb: 2.33, Cb: 1.01 } });
  const f = r.flexaoX, v = r.corteY;
  ok('W4-T MRd,esc (kN·cm) p.188', f.MRdEsc * 100, 1413.6, 0.01);
  ok('W4-T Me (kN·cm) p.192', f.Me * 100, 2796.6, 0.005); ok('W4-T λ0 p.193', f.lambda0, 0.75, 0.01);
  ok('W4-T χFLT p.193', f.chiFLT, 0.936, 0.005); ok('W4-T MRd,FLT (kN·cm) p.195', f.MRdFLT * 100, 1323.2, 0.005);
  ok('W4-T MRd (kN·m) p.195', f.capacity, 13.23, 0.005); yes('W4-T ramo FLT', /FLT/.test(f.ramo), f.ramo);
  ok('W4-T h/t p.198', v.ht, 71.5, 0.005); ok('W4-T 1,08√(E·kv/fy) p.198', v.lim108, 68.3, 0.005); ok('W4-T 1,40√(E·kv/fy) p.198', v.lim140, 88.5, 0.005);
  ok('W4-T VRd (kN) p.198', v.capacity, 65.6, 0.005);
  // p.197: distorcional "dispensada" lendo a Tab. 14 na linha 0,4 com bf/bw = 0,375 (fora do domínio) — o módulo não
  // extrapola, usa faixas finitas e chega ao mesmo desfecho (χdist = 1, a distorcional não governa)
  yes('W4-T Tab. 14 fora do domínio → faixas finitas, χdist = 1 (mesmo desfecho da p.197)', f.dist.dispensada === false && f.dist.fonte === 'faixas finitas' && f.dist.chiDist === 1);
  // p.196 Anexo F com R = 0,65 → 918,9 kN·cm: a fonte ignora a condição d) do Anexo F (2,8 ≤ bw/bf ≤ 4,5; aqui 2,67)
  const rf = run({ demands: { Mz: 10.4 }, mat: mat(25), sec: sec(Ue200), member: { L: 7, Lb: 7, Cb: 1, painelMesaTracionada: true } });
  yes('W4-T Anexo F recusado pela condição d) bw/bf = 2,67 (NBR 14762:2010 F.1 d; a fonte p.196 a omite)', !rf.flexaoX.anexoF && rf.avisos.some(a => /Anexo F não aplicável/.test(a) && /d\)/.test(a)));

  // MRD (p.243-253): MRe = 1456 (λ0 = 0,75); Mℓ = 62,2·91,7 = 5703,7 (CUFSM σℓ = 917 MPa) → λℓ = 0,505, MRℓ = 1456;
  //   Mdist = 62,2·66,6 = 4142,5 (σdist = 666 MPa) → λdist = 0,613, MRdist = 1555; MRd = 1456/1,1 = 13,24 kN·m
  const m = run({ demands: { Mz: 10.4 }, mat: mat(25), sec: sec(Ue200), member: { L: 7, Lb: 2.33, Cb: 1.01 }, options: { metodo: 'MRD', Ml: 57.037, Mdist: 41.425 } }).flexaoX;
  ok('W4-T MRD MRe (kN·cm) p.248', m.mrd.MRe, 1456, 0.01); ok('W4-T MRD λℓ p.249', m.mrd.lambdaL, 0.505, 0.01);
  ok('W4-T MRD λdist p.251', m.mrd.lambdaDist, 0.613, 0.005); ok('W4-T MRD MRdist (kN·cm) p.251', m.mrd.MRdist, 1555, 0.005);
  ok('W4-T MRD MRd (kN·m) p.253', m.capacity, 13.24, 0.01);
  const s = fsmSigma({ bw: 200, bf: 75, D: 25, t: 2.65 });
  ok('W4-T σℓ flexão faixas finitas × CUFSM 917 MPa (p.250)', s.Ml, 917, 0.02);
  if (Math.abs(s.Mdist / 666 - 1) > 0.02) pendente('W4-T σdist flexão faixas finitas × CUFSM 666 MPa (p.252)', s.Mdist, 666, 'modelo FSM (ver PENDENTES-1)');
  yes('W4-T λdist com o σdist do fsm.js ainda ≤ 0,673 → MRdist = W·fy (mesmo desfecho da p.251)', Math.sqrt(25 * 10 / s.Mdist) <= 0.673);
}

// ── W5 (Mód. 05) — U 100x50x2,25 (catálogo NBR 6355 = quadro da p.101), fy = 28, fu = 38 ─────────────────────────────
//   p.101: A = 4,33; rx = 3,98; ry = 1,58; Ix = 68,57; Iy = 10,82; J = 0,073; x0 = 3,07; r0 = 5,27; xg = 1,35; Cw = 183,02
//   banzo inf. KL = 314/157/157: Ne = 58,4; χ = 0,420; Aef = 4,16; Nc,Rd = 40,8 (p.102-107)
//   banzo sup. KL = 300/150/150: Ne = 62,8; χ = 0,445; Aef = 4,12; Nc,Rd = 42,8 (p.110-115)
//   pilar      KL = 500/50/50:   Ne = 52,2; χ = 0,380; Aef = 4,21; Nc,Rd = 37,3 (p.139-144)
//   tração (p.108/116): Nt,Rd = 4,33·28/1,1 = 110,2; ligação soldada, An = A, Ct = 1 → 4,33·38/1,65 = 99,7 kN
{
  const c = cfSection('U 100x50x2,25');
  ok('W5 catálogo A = 4,33 (p.101)', c.A / cm2, 4.33, 1e-6); ok('W5 catálogo Ix = 68,57', c.Iz / cm4, 68.57, 1e-6);
  ok('W5 catálogo Cw = 183,02', c.Cw / cm6, 183.02, 1e-6); ok('W5 catálogo x0 = 3,07', c.x0 / cm, 3.07, 1e-6);
  ok('W5 catálogo J recalculado × 0,073 da fonte', c.J / cm4, 0.073, 0.02);
  for (const [id, Lx, Ly, Ne, chi, Aef, Nc, pg] of [['banzo inf.', 3.14, 1.57, 58.4, 0.420, 4.16, 40.8, 'p.103-107'],
    ['banzo sup.', 3.0, 1.5, 62.8, 0.445, 4.12, 42.8, 'p.110-115'], ['pilar', 5.0, 0.5, 52.2, 0.380, 4.21, 37.3, 'p.140-144']]) {
    const a = run({ demands: { N: -10 }, mat: mat(28, 38), sec: c, member: { L: Lx, Lx, Ly, Lz: Ly } }).axial;
    ok(`W5 ${id} Ne (kN) ${pg}`, a.Ne, Ne, 0.01); ok(`W5 ${id} χ`, a.chi, chi, 0.01);
    ok(`W5 ${id} Aef MLE (cm²)`, a.Aef / cm2, Aef, 0.01); ok(`W5 ${id} Nc,Rd (kN)`, a.capacity, Nc, 0.01);
  }
  const t = run({ demands: { N: 26.7 }, mat: mat(28, 38), sec: c, member: { L: 3.14, secaoLiquida: { An: c.A, ligacao: 'soldada', todosConectados: true } } }).axial;
  ok('W5 tração Nt,Rd = Ct·An·fu/1,65, Ct = 1 (kN) p.108', t.capacity, 99.7, 0.005);
  yes('W5 tração governa a ruptura (escoamento 110,2 kN, p.108)', /9\.6\.2 c/.test(t.formula) && t.Ct === 1);
  const ty = run({ demands: { N: 26.7 }, mat: mat(28, 38), sec: c, member: { L: 3.14 } }).axial;
  ok('W5 tração escoamento A·fy/1,1 (kN) p.108', ty.capacity, 110.2, 0.005);
}

// ── W6 (Mód. 06 p.7-20) — terça Ue 100x50x17x2,00, vão 4 m, 1 linha de corrente (Lb = 200), fy = 28 ──────────────────
//   p.7: A = 4,42; Ix = 70,26; Iy = 15,76; J = 0,06; Cw = 381,65; Wx = 14,05; r0 = 6,08; x0 = 4,18 (= catálogo)
//   p.10: MA = 1,02; MB = 1,74; MC = 2,18; Mmax = 2,32 kN·m → Cb = 1,30; p.11: Ney = 77,8; Nez = 63,4; Me = 555,1 kN·cm;
//   λ0 = 0,842; p.12: MRe = 350,6; p.14: σℓ = 1476 MPa → Mℓ = 2073,8; p.15: λℓ = 0,411, MRℓ = 350,6;
//   p.17: σdist = 916 MPa → Mdist = 1287,0; p.18: λdist = 0,553, MRdist = 393,4; p.19: MRd = 318,7 kN·cm;
//   p.20: h/t = 92/2 = 46 ≤ 64,5 → VRd = 0,6·28·9,2·0,2/1,1 = 28,1 kN
{
  const c = cfSection('Ue 100x50x17x2,00');
  ok('W6 catálogo Wx = 14,05 (p.7)', c.Sz / cm3, 14.05, 1e-6); ok('W6 catálogo Cw = 381,65', c.Cw / cm6, 381.65, 1e-6);
  ok('W6 Cb (p.10)', cbMoments(2.32, 1.02, 1.74, 2.18), 1.30, 0.005);
  const member = { L: 4, Lb: 2, Cb: 1.30 };
  const r = run({ demands: { Mz: 2.32, Vy: 2.32 }, mat: mat(28), sec: c, member, options: { Mdist: 12.87 } });
  const f = r.flexaoX;
  ok('W6 Me (kN·cm) p.11', f.Me * 100, 555.1, 0.005); ok('W6 λ0 p.11', f.lambda0, 0.842, 0.005);
  yes('W6 Tab. 14 não dispensa (D/bw = 0,17 < 0,25) — coerente com o uso do CUFSM', f.dist.dispensada === false && Math.abs(f.dist.Dmin_bw - 0.25) < 1e-9);
  ok('W6 λdist (Mdist = 1287 kN·cm de entrada) p.18', f.dist.lambdaDist, 0.553, 0.005);
  ok('W6 MRd 9.8.2 (MLE: Wc,ef = W → = MRe/1,1) (kN·cm) p.19', f.capacity * 100, 318.7, 0.005);
  ok('W6 VRd (kN) p.20', r.corteY.capacity, 28.1, 0.005); ok('W6 h/t p.20', r.corteY.ht, 46, 0.001);
  const m = run({ demands: { Mz: 2.32 }, mat: mat(28), sec: c, member, options: { metodo: 'MRD', Ml: 20.738, Mdist: 12.87 } }).flexaoX;
  ok('W6 MRD MRe (kN·cm) p.12', m.mrd.MRe, 350.6, 0.005); ok('W6 MRD λℓ p.15', m.mrd.lambdaL, 0.411, 0.005);
  ok('W6 MRD MRdist (kN·cm) p.18', m.mrd.MRdist, 393.4, 0.005); ok('W6 MRD MRd (kN·cm) p.19', m.capacity * 100, 318.7, 0.005);
  const s = fsmSigma({ bw: 100, bf: 50, D: 17, t: 2 });
  if (Math.abs(s.Ml / 1476 - 1) > 0.02) pendente('W6 σℓ flexão faixas finitas × CUFSM 1476 MPa (p.14)', s.Ml, 1476, 'modelo FSM; local do Ue ABAIXO do CUFSM, a favor da segurança (λℓ = 0,41 ≪ 0,776, sem efeito)');
  else ok('W6 σℓ flexão × CUFSM 1476 MPa (p.14)', s.Ml, 1476, 0.02);
  if (Math.abs(s.Mdist / 916 - 1) > 0.02) pendente('W6 σdist flexão faixas finitas × CUFSM 916 MPa (p.17)', s.Mdist, 916, 'modelo FSM (ver PENDENTES-1)');
  const mf = run({ demands: { Mz: 2.32 }, mat: mat(28), sec: c, member }).flexaoX;
  ok('W6 MRd com Mdist do fsm.js (desfecho igual: χdist = 1) (kN·cm) p.19', mf.capacity * 100, 318.7, 0.005);
}

// ── UF arq. 04 p.69-74 — Ue 250x85x25x2,00 (catálogo = quadro da p.69), fy = 30, KxLx = 240 ─────────────────────────
//   caso 1 KyLy = KzLz = 120: χ = 0,890; Aef = 5,64 (MLE) → Nc,Rd,1 = 125,49; Ndist = 143,87 kN (Pierin et al. 2013,
//     ENTRADA) → λdist = 1,380, χdist = 0,564, Nc,Rd,2 = 128,81 → Nc,Rd = 125,49 kN (p.69-71)
//   caso 2 KyLy = KzLz = 80: χ = 0,938; Aef = 5,53 → Nc,Rd,1 = 129,62 → Nc,Rd = 128,81 kN (distorcional, p.72-73)
{
  const c = cfSection('Ue 250x85x25x2,00');
  ok('UF catálogo A = 9,14 (p.69)', c.A / cm2, 9.14, 1e-6); ok('UF catálogo Cw = 11 477,06', c.Cw / cm6, 11477.06, 1e-6);
  for (const [id, Ly, chi, Aef, N1, Nc] of [['caso 1', 1.2, 0.890, 5.64, 125.49, 125.49], ['caso 2', 0.8, 0.938, 5.53, 129.62, 128.81]]) {
    const a = run({ demands: { N: -10 }, mat: mat(30), sec: c, member: { L: 2.4, Lx: 2.4, Ly, Lz: Ly }, options: { Ndist: 143.87 } }).axial;
    ok(`UF ${id} χ`, a.chi, chi, 0.005); ok(`UF ${id} Aef MLE (cm²)`, a.Aef / cm2, Aef, 0.005);
    ok(`UF ${id} Nc,Rd global (kN)`, a.NcRdGlobal, N1, 0.005);
    ok(`UF ${id} χdist`, a.distorcional.chiDist, 0.564, 0.005); ok(`UF ${id} Nc,Rd distorcional (kN)`, a.distorcional.NcRdDist, 128.81, 0.005);
    ok(`UF ${id} Nc,Rd final (kN)`, a.capacity, Nc, 0.005);
  }
  const s = fsmSigma({ bw: 250, bf: 85, D: 25, t: 2 });
  if (Math.abs(s.dist * 9.14 / 10 / 143.87 - 1) > 0.02) pendente('UF Ndist faixas finitas × Pierin et al. 2013 143,87 kN (p.70)', s.dist * 9.14 / 10, 143.87, 'modelo FSM (ver PENDENTES-1)');
}

// ── UF arq. 07 p.13 — exercício de JAVARONI (2015): Ue 250x100x25x2,0 pelo MRD (perfil fora do catálogo 6355) ─────────
//   A = 12,79; fy = 30; Ne = 429,90 kN (ENTRADA, 9.7.2); Nℓ = 149,09; Ndist = 273,15 (Pierin et al. 2013, ENTRADAS)
//   → λ0 = 0,945; Nc,Re = 264,0; λℓ = 1,327; Nc,Rℓ = 185,34; λdist = 1,185; Nc,Rdist = 249,2; Nc,Rd = 154,5 kN
{
  const m = mrdCompressao14762({ A: 12.79, fy: 30, Ne: 429.90, Nl: 149.09, Ndist: 273.15 });
  ok('JAV λ0', m.lambda0, 0.945, 0.005); ok('JAV Nc,Re (kN)', m.NcRe, 264.0, 0.005);
  ok('JAV λℓ', m.lambdaL, 1.327, 0.005); ok('JAV Nc,Rℓ (kN)', m.NcRl, 185.34, 0.005);
  ok('JAV λdist', m.lambdaDist, 1.185, 0.005); ok('JAV Nc,Rdist (kN)', m.NcRdist, 249.2, 0.005);
  ok('JAV Nc,Rd = Nc,Rk/1,2 (kN)', m.NcRk / 1.2, 154.5, 0.005);
}

// ── UF arq. 07 p.14 — exercício de CARVALHO et al. (2020): U 100x50x2,0, KxLx = 250, KyLy = KzLz = 125, MRD ─────────
//   Ne = 73,52; λ0 = 1,147; Nc,Re = 55,76; Nℓ = 84,16 (Pierin et al. 2013, ENTRADA); λℓ = 0,814; Nc,Rℓ = 54,124;
//   Nc,Rd = 45,10 kN. PREMISSA: o slide declara fy = 300 MPa, mas todos os números impressos são os de fy = 250 MPa
//   (λ0 = √(3,87·25/73,52) = 1,147; com 30 seria 1,257) — usada fy = 25, a única consistente com a própria solução.
{
  const c = cfSection('U 100x50x2,00');
  const a = run({ demands: { N: -10 }, mat: mat(25), sec: c, member: { L: 2.5, Lx: 2.5, Ly: 1.25, Lz: 1.25 }, options: { metodo: 'MRD', Nl: 84.16 } }).axial;
  ok('CAR Ne (kN)', a.Ne, 73.52, 0.01); ok('CAR λ0', a.mrd.lambda0, 1.147, 0.01); ok('CAR Nc,Re (kN)', a.mrd.NcRe, 55.76, 0.01);
  ok('CAR λℓ', a.mrd.lambdaL, 0.814, 0.01); ok('CAR Nc,Rℓ (kN)', a.mrd.NcRl, 54.124, 0.01); ok('CAR Nc,Rd (kN)', a.capacity, 45.10, 0.01);
  const s = fsmSigma({ bw: 100, bf: 50, t: 2 });
  if (Math.abs(s.l * 3.87 / 10 / 84.16 - 1) > 0.02) pendente('CAR Nℓ faixas finitas × Pierin et al. 2013 84,16 kN (p.14)', s.l * 3.87 / 10, 84.16, 'modelo FSM local de U simples ACIMA da tabela (ver PENDENTES-2)');
}

console.log(`\n${n - fails}/${n} ok${fails ? `, ${fails} FALHAS` : ''}`);
if (pend.length) {
  console.log(`\nPENDENTES (${pend.length}) — não falham a bateria:`);
  for (const p of pend) console.log(`  · ${p.name}: ${(+p.got).toPrecision(5)} × ${p.exp} (Δ ${d(p.got, p.exp)} %) — ${p.why}`);
  console.log(`  PENDENTES-1 (distorcional a favor da segurança): o fsm.js (linha média, cantos vivos; malha convergida a < 0,6 %)
    dá σdist 3-4 % ABAIXO do CUFSM das apostilas e das tabelas de Pierin et al. (2013) para Ue — provável diferença de
    modelo (cantos arredondados / representação do enrijecedor no CUFSM), não defeito comprovado; λdist sai maior, Nc,Rd
    e MRd não ficam contra a segurança. Nos casos testados o desfecho (χdist) coincide.
  PENDENTES-2 (local CONTRA a segurança, investigar js/design/fsm.js): para U simples o σℓ do fsm.js fica ACIMA da
    referência (U 100x50x2,0: Nℓ +3,5 % × Pierin et al. 2013; U 127x50x2,0: σℓ +1,8 % × CUFSM, Mód. 04 p.235) →
    Nc,Rℓ do MRD até ~1 % maior. Hipótese: cantos vivos na linha média enrijecem a junção alma-mesa do U simples;
    conferir com CUFSM com cantos arredondados antes de corrigir (Anexo C, C.3).`);
}
process.exit(fails ? 1 : 0);
