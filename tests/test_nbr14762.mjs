// test_nbr14762.mjs — NBR 14762:2010 (formados a frio: Ue e U simples) contra oráculos de literatura
//   node tests/test_nbr14762.mjs
//
// Fonte dos valores ESPERADOS (tests/data/nbr14762_cbca.json, transcritos de oraculos_14762.json):
//   · CBCA 2014, E. Lubas Silva, "Estruturas compostas por perfis formados a frio" (base NBR 14762:2010 /
//     NBR 6355:2012) — Ex.04, 05, 06, 07, 08, 09 e Anexo D S8 (U 125x50x2,65);
//   · CBCA 449/2008 — SÓ fórmulas do MLE (Tab. 5/6) e Ne com E = 20500 / G = 7884,615 explícitos
//     (o resto desse manual é o método 2001: χ, γ, kv, Ia diferem da 2010).
// Nenhum esperado é calculado aqui. Unidades do módulo: kN, m, kN/m² (fixtures em cm, kN/cm², kN·cm).
//
// Tolerâncias: valores impressos têm 3-4 algarismos → 1 % (Ne, χ, Nc,Rd, Me). Onde há DIVERGÊNCIA entre o
// manual e a norma a tolerância é maior e o motivo está no comentário do caso — nunca afrouxada sem motivo:
//   (a) 9.2.3.1 "considerar Is/Ia ≤ 1" no k do enrijecedor: o manual (Ex.07) usa Is/Ia sem o limite (k = 3,52;
//       a norma dá 3,37) → Wef 0,8 % menor na norma;
//   (b) Ex.08 / S8: o manual desloca o centroide com Aret·e/A (área BRUTA) em vez de Aef → Wef,y 1,4 % maior;
//   (c) S8: o manual usa h = bw − 4t (ri = t) embora liste ri = 3,975 mm; Wef de y e Wc,ef de y vêm do
//       DimPerfil 4.0 (fibra mais comprimida = extremo da largura efetiva) → 3,8 % acima da norma literal
//       (extremo da seção bruta); a implementação fica do lado conservador.
import { readFileSync } from 'node:fs';
import { nbr14762, cbMoments, dminTabela, _nbr14762 as N } from '../js/design/codes/nbr14762.js';
import { cfProfile, cfNames, cfSection } from '../js/design/profiles_cf.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${+(+got).toPrecision(6)} exp=${exp} (Δ ${(100 * (got - exp) / (exp || 1)).toFixed(2)} %, tol ${(100 * tol).toFixed(2)} %)`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

const D = JSON.parse(readFileSync(new URL('./data/nbr14762_cbca.json', import.meta.url), 'utf8'));
const cm = 0.01, mm = 1e-3, cm2 = 1e-4, cm3 = 1e-6, cm4 = 1e-8, cm6 = 1e-12, KNCM2 = 1e4;

// perfil do fixture (cm) → sec SI
function secOf(name, over = {}) {
  const p = D.perfis[name];
  const sec = { shape: p.shape, dims: { bw: p.bw * mm, bf: p.bf * mm, t: p.t * mm, ri: p.ri * mm },
    A: p.A * cm2, Iz: p.Ix * cm4, Iy: p.Iy * cm4, J: p.It * cm4, Cw: p.Cw * cm6, x0: p.x0 * cm, r0: p.r0 * cm };
  if (p.D != null) sec.dims.D = p.D * mm;
  if (p.xg != null) sec.xg = p.xg * cm;
  if (p.Wx != null) sec.Sz = p.Wx * cm3;
  if (p.Wy != null) sec.Sy = p.Wy * cm3;
  if (p.rx != null) sec.rz = p.rx * cm;
  if (p.ry != null) sec.ry = p.ry * cm;
  return { ...sec, ...over, dims: { ...sec.dims, ...(over.dims || {}) } };
}
const matOf = (c) => ({ Fy: c.fy * KNCM2, Fu: 1.6 * c.fy * KNCM2, E: (c.E ?? 20000) * KNCM2, G: (c.G ?? 7700) * KNCM2 });
const run = (id, input) => { try { return nbr14762.check(input); } catch (e) { fails++; console.log(`✗ ${id}: exceção ${e.stack}`); return null; } };
const hasAviso = (r, re) => r.avisos.some(a => re.test(a));

// ── Tabelas 11 e 14 (interpolação bilinear) ────────────────────────────────────────────────
for (const c of D.casos['BR-14762-TAB-DISPENSA'].casos) {
  ok(`TAB${c.tab} bf/bw=${c.bf_bw} bw/t=${c.bw_t}: D/bw mín`, dminTabela(c.tab, c.bf_bw, c.bw_t), c.D_bw_min, 0.005);
}
assert('TAB11 fora do domínio (bw/t = 33,3 < 50) → null (sem extrapolação)', dminTabela(11, 0.5, 33.3) === null);
assert('TAB14 fora do domínio (bf/bw = 2,5) → null', dminTabela(14, 2.5, 100) === null);

// ── Cb (9.8.2.2) ───────────────────────────────────────────────────────────────────────────
for (const c of D.casos['BR-14762-CB'].casos) ok(`Cb Mmax=${c.Mmax}`, cbMoments(c.Mmax, c.MA, c.MB, c.MC), c.Cb, c.tol);

// ── BR-14762-NE-01 · M14 Ex.04 — Ue 100x50x17x1,2: Ne (flexo-torção), χ, Nc,Rd global, dispensa Tab. 11 ──
{
  const c = D.casos['BR-14762-NE-01'], e = c.esperado;
  const r = run('NE-01', { demands: { N: -5 }, mat: matOf(c), sec: secOf(c.perfil),
    member: { L: 4, Lx: c.KxLx * cm, Ly: c.KyLy * cm, Lz: c.KzLz * cm } });
  if (r) {
    const a = r.axial;
    ok('NE-01 Nex (kN)', a.Nex, e.Nex, 0.01); ok('NE-01 Ney (kN)', a.Ney, e.Ney, 0.01); ok('NE-01 Nez (kN)', a.Nez, e.Nez, 0.01);
    ok('NE-01 Nexz = Ne (kN)', a.Ne, e.Ne, 0.01);
    assert('NE-01 modo = flexo-torção', a.modoGlobal === 'flexo-torção', a.modoGlobal);
    ok('NE-01 λ0 (A bruta)', a.lambda0, e.lambda0, 0.01); ok('NE-01 χ', a.chi, e.chi, 0.01);
    ok('NE-01 Aef (cm²) — todos os elementos efetivos a σ = 3,1 kN/cm²', a.Aef * 1e4, e.Aef, 0.001);
    ok('NE-01 Nc,Rd global (kN)', a.NcRdGlobal, e.Nc_Rd_global, 0.01);
    ok('NE-01 D/bw mín Tab. 11', a.distorcional.Dmin_bw, e.Dmin_Tab11, 0.01);
    assert('NE-01 distorcional dispensada (D/bw = 0,17)', a.distorcional.dispensada === true);
    // divergência manual × 9.7.4: KyLy/ry = 207 > 200 → não verificado (nunca passagem silenciosa)
    assert('NE-01 KL/r = 207 > 200 (9.7.4): ratio = Infinity + aviso', a.ratio === Infinity && a.verificado === false && hasAviso(r, /9\.7\.4/), `esb.y=${a.esbeltez.y}`);
  }
  // mesma seção com comprimento que respeita KL/r ≤ 200: capacidade verificada = χ·Aef·fy/1,2
  const r2 = run('NE-01b', { demands: { N: -3 }, mat: matOf(c), sec: secOf(c.perfil), member: { L: 3, Lx: 3, Ly: 3, Lz: 3 } });
  if (r2) assert('NE-01b KL/r = 155 ≤ 200: verificado, ratio finito', Number.isFinite(r2.axial.ratio) && r2.axial.verificado !== false, `Nc,Rd=${r2.axial.capacity}`);
}

// ── BR-14762-NE-02 · M14 Ex.05 — Ue 150x60x20x3,0 ─────────────────────────────────────────────
{
  const c = D.casos['BR-14762-NE-02'], e = c.esperado;
  const r = run('NE-02', { demands: { N: -50 }, mat: matOf(c), sec: secOf(c.perfil),
    member: { L: 6, Lx: c.KxLx * cm, Ly: c.KyLy * cm, Lz: c.KzLz * cm } });
  if (r) {
    const a = r.axial;
    ok('NE-02 Nex', a.Nex, e.Nex, 0.01); ok('NE-02 Ney', a.Ney, e.Ney, 0.01); ok('NE-02 Nez', a.Nez, e.Nez, 0.01);
    ok('NE-02 Nexz = Ne', a.Ne, e.Ne, 0.01); ok('NE-02 λ0', a.lambda0, e.lambda0, 0.01); ok('NE-02 χ = 0,877/λ0² (λ0 > 1,5)', a.chi, e.chi, 0.01);
    ok('NE-02 Aef (cm²)', a.Aef * 1e4, e.Aef, 0.001);
    ok('NE-02 Nc,Rd (kN) — recálculo χ·Aef·fy/1,2 (o 16,69 impresso é inconsistente)', a.capacity, e.Nc_Rd_recalculo, 0.01);
    assert('NE-02 distorcional dispensada (D/bw = 0,133 > 0,08)', a.distorcional.dispensada === true);
  }
}

// ── BR-14762-DIST-01 · M14 Ex.06 — Ue 100x50x17x3,0, Ndist = 575,60 kN (DimPerfil, ENTRADA) ───────
{
  const c = D.casos['BR-14762-DIST-01'], e = c.esperado, mat = matOf(c);
  const base = { demands: { N: -50 }, mat, sec: secOf(c.perfil), member: { L: c.L * cm, Lx: c.L * cm, Ly: c.L * cm, Lz: c.L * cm } };
  const r = run('DIST-01', { ...base, options: { Ndist: c.Ndist } });
  if (r) {
    const d = r.axial.distorcional;
    ok('DIST-01 λdist', d.lambdaDist, e.lambda_dist, 0.01); ok('DIST-01 χdist', d.chiDist, e.chi_dist, 0.001);
    ok('DIST-01 Nc,Rd distorcional (kN)', d.NcRdDist, e.Nc_Rd_dist, 0.001);
    assert('DIST-01 Tab. 11 não dispensa (bw/t = 33,3 fora do domínio)', d.dispensada === false);
    assert('DIST-01 Nc,Rd = min(global, dist) com Ndist informado', Math.abs(r.axial.capacity - Math.min(r.axial.NcRdGlobal, d.NcRdDist)) < 1e-6);
  }
  const r0 = run('DIST-01-semNdist', base);
  if (r0) assert('ROB distorcional não dispensado e sem Ndist → não verificado (ratio=Infinity + aviso)', r0.axial.ratio === Infinity && r0.axial.verificado === false && hasAviso(r0, /Ndist/));
  // flexão: Tab. 14 também não cobre bw/t = 33 → sem Mdist não verificado
  const rf = run('DIST-flex', { demands: { Mz: 1 }, mat, sec: secOf(c.perfil), member: { L: 1, Lb: 1, Cb: 1 } });
  if (rf) assert('ROB flexão x: distorcional não dispensada e sem Mdist → Infinity + aviso', rf.flexaoX.ratio === Infinity && hasAviso(rf, /Mdist/));
}

// ── BR-14762-FLEX-01 · M14 Ex.07 — Ue 100x50x17x1,2, L=400, flexão x ────────────────────────────
{
  const c = D.casos['BR-14762-FLEX-01'], e = c.esperado;
  const r = run('FLEX-01', { demands: { Mz: 0.5 }, mat: matOf(c), sec: secOf(c.perfil), member: { L: 4, Lb: c.Lb * cm, Cb: c.Cb } });
  if (r) {
    const f = r.flexaoX;
    // (a) 9.2.3.1 com Is/Ia ≤ 1 no k (norma): k = 3,37 (manual 3,52) → Wef 0,8 % menor; tol 1,2 %
    ok('FLEX-01 Wef (cm³) — 9.2.3.1/9.2.2.1/Tab. 5-6 (tol 1,2 %, ver (a))', f.Wef / cm3, e.Wef, 0.012);
    ok('FLEX-01 MRd,esc (kN·cm) (tol 1,2 %)', f.MRdEsc * 100, e.MRd_esc, 0.012);
    assert('FLEX-01 conservador (norma ≤ manual)', f.MRdEsc * 100 <= e.MRd_esc * 1.0005);
    ok('FLEX-01 Me (kN·cm)', f.Me * 100, e.Me, 0.005); ok('FLEX-01 λ0', f.lambda0, e.lambda0, 0.005);
    ok('FLEX-01 χFLT', f.chiFLT, e.chi_FLT, 0.005);
    ok('FLEX-01 Wc,ef (cm³) — todos efetivos a σ = 8,05', f.WcEf / cm3, e.Wc_ef, 0.001);
    ok('FLEX-01 MRd,FLT (kN·cm)', f.MRdFLT * 100, e.MRd_FLT, 0.005);
    ok('FLEX-01 D/bw mín Tab. 14', f.dist.Dmin_bw, e.Dmin_Tab14, 0.005);
    assert('FLEX-01 distorcional dispensada (0,17 ≥ 0,163)', f.dist.dispensada === true);
    ok('FLEX-01 MRd (kN·cm) governa FLT', f.capacity * 100, e.MRd, 0.005);
    assert('FLEX-01 ramo = FLT', /FLT/.test(f.ramo), f.ramo);
  }
}

// ── BR-14762-FLEX-02 · M14 Ex.08 — Ue, flexão em torno de y (Anexo E), alma comprimida ───────────
{
  const c = D.casos['BR-14762-FLEX-02'], e = c.esperado;
  const sec = secOf(c.perfil);
  const g = { ue: true, bw: 10, bf: 5, D: 1.7, t: 0.12, ri: 0.12, Iy: 10.12 };
  const ae = N.anexoEj(g);
  ok('FLEX-02 xm (cm)', ae.xm, e.xm, 0.002); ok('FLEX-02 x0 Anexo E (cm)', ae.x0, e.x0, 0.002);
  ok('FLEX-02 βℓ (cm⁵)', ae.betaL, e.beta_l, 0.002); ok('FLEX-02 βw (cm⁵)', ae.betaW, e.beta_w, 0.002);
  ok('FLEX-02 βf (cm⁵)', ae.betaF, e.beta_f, 0.002); ok('FLEX-02 j (cm)', ae.j, e.j, 0.005);
  // MdistY enorme só neutraliza a LACUNA do distorcional (não faz parte do oráculo) p/ isolar 9.8.2.1/9.8.2.2
  const r = run('FLEX-02', { demands: { My: 0.3 }, mat: matOf(c), sec, member: { L: 4, Lx: 4, Ly: 4, Lz: 4, Cb: 1 }, options: { sentidoMy: 'alma', MdistY: 1e5 } });
  if (r) {
    const f = r.flexaoY;
    ok('FLEX-02 Me Anexo E, Cs=+1 (kN·cm)', f.Me * 100, e.Me, 0.005);
    ok('FLEX-02 λ0', f.lambda0, e.lambda0, 0.005); assert('FLEX-02 χFLT = 1', f.chiFLT === 1);
    // (b) manual: Δx do centroide com A bruta → Wef 1,4 % maior; tol 2 %
    ok('FLEX-02 Wef (cm³) — MLE iterativo, Tab. 5 (tol 2 %, ver (b))', f.Wef / cm3, e.Wef, 0.02);
    ok('FLEX-02 MRd,esc (kN·cm) (tol 2 %)', f.MRdEsc * 100, e.MRd_esc, 0.02);
    ok('FLEX-02 MRd (kN·cm)', f.capacity * 100, e.MRd, 0.02);
    assert('FLEX-02 ramo = escoamento', /escoamento/.test(f.ramo), f.ramo);
  }
  const r0 = run('FLEX-02-semMdistY', { demands: { My: 0.3 }, mat: matOf(c), sec, member: { L: 4, Cb: 1 }, options: { sentidoMy: 'alma' } });
  if (r0) assert('ROB Ue eixo y sem MdistY → não verificado (Tab. 14 só vale p/ eixo de maior inércia)', r0.flexaoY.ratio === Infinity && hasAviso(r0, /MdistY/));
  const r1 = run('FLEX-02-semSentido', { demands: { My: 0.3 }, mat: matOf(c), sec, member: { L: 4, Cb: 1 }, options: { MdistY: 1e5 } });
  if (r1) assert('ROB Ue eixo y sem sentido de My: mínimo dos dois e Infinity se um deles não é coberto (lábios comprimidos + gradiente)', r1.flexaoY.ratio === Infinity && hasAviso(r1, /sentido|mesas/));
}

// ── BR-14762-VM-01 · M14 Ex.09 — cortante e M+V ───────────────────────────────────────────────
{
  const c = D.casos['BR-14762-VM-01'], e = c.esperado;
  const r = run('VM-01', { demands: { Mz: c.MSd / 100, Vy: c.VSd }, mat: matOf(c), sec: secOf(c.perfil), member: { L: 4, Lb: 1, Cb: 1 } });
  if (r) {
    const v = r.corteY;
    ok('VM-01 limite 1,08√(E·kv/fy)', v.lim108, e.limite_1_08, 0.002); ok('VM-01 limite 1,4√(E·kv/fy)', v.lim140, e.limite_1_4, 0.002);
    ok('VM-01 h/t', v.ht, e.h_t, 0.001); ok('VM-01 VRd (kN) — regime intermediário', v.capacity, e.VRd, 0.005);
    assert('VM-01 regime intermediário', /0,65/.test(v.regime), v.regime);
    // MRd,esc da norma é 0,8 % menor que a do manual (ver (a)) → interação até 1,6 % maior; tol 2 %
    ok('VM-01 (MSd/MRd)² + (VSd/VRd)² (9.8.4)', r.interactionMV.ratio, e.interacao, 0.02);
  }
}

// ── BR-14762-TERCA-S8 · M14 Anexo D S8 — U 125x50x2,65 (U simples, fy 24) ────────────────────────
{
  const c = D.casos['BR-14762-TERCA-S8'], e = c.esperado, mat = matOf(c);
  const member = { L: c.Lx * cm, Lx: c.Lx * cm, Ly: c.Ly * cm, Lz: c.Lz * cm, Lb: c.Lb * cm, Cb: c.Cb };
  const dem = { N: -c.NSd, Mz: c.MxSd / 100, My: c.MySd / 100, Vy: c.VSd };
  const r = run('S8', { demands: dem, mat, sec: secOf(c.perfil), member, options: { sentidoMy: 'mesas' } });
  if (r) {
    const a = r.axial;
    ok('S8 Nex', a.Nex, e.Nex, 0.005); ok('S8 Ney', a.Ney, e.Ney, 0.005); ok('S8 Nez', a.Nez, e.Nez, 0.005);
    ok('S8 Nexz = Ne', a.Ne, e.Ne, 0.005); ok('S8 λ0', a.lambda0, e.lambda0, 0.005); ok('S8 χ', a.chi, e.chi, 0.005);
    ok('S8 Aef (cm²) — U simples: mesa AL k = 0,43, todos efetivos', a.Aef * 1e4, e.Aef, 0.001);
    ok('S8 Nc,Rd (kN)', a.capacity, e.Nc_Rd, 0.005);
    ok('S8 λx = Lx/rx', a.esbeltez.x, e.esbeltez.x, 0.005); ok('S8 λy = Ly/ry', a.esbeltez.y, e.esbeltez.y, 0.005);
    const fx = r.flexaoX, ex = e.flexao_x;
    // oráculo usa h = bw − 4t (ri = t) → com ri = 3,975 (entrada) a norma literal dá +0,9 % (ver (c)); tol 1,5 %
    ok('S8 x Wef,esc (cm³) (tol 1,5 %)', fx.Wef / cm3, ex.Wef_esc, 0.015); ok('S8 x MRd,esc (kN·cm) (tol 1,5 %)', fx.MRdEsc * 100, ex.MRd_esc, 0.015);
    ok('S8 x Me (kN·cm) — Cb·r0·√(Ney·Nez)', fx.Me * 100, ex.Me, 0.002); ok('S8 x λ0', fx.lambda0, ex.lambda0, 0.005); ok('S8 x χFLT', fx.chiFLT, ex.chi_FLT, 0.005);
    ok('S8 x Wc,ef (cm³) (tol 1,5 %)', fx.WcEf / cm3, ex.Wc_ef, 0.015); ok('S8 x MRd,FLT (kN·cm) (tol 1,5 %)', fx.MRdFLT * 100, ex.MRd_FLT, 0.015);
    ok('S8 x MxRd (kN·cm)', fx.capacity * 100, ex.MxRd, 0.015);
    const fy = r.flexaoY, ey = e.flexao_y;
    ok('S8 y j (cm)', fy.j, ey.j, 0.002); assert('S8 y Cs = −1 (mesas comprimidas)', fy.Cs === -1);
    ok('S8 y Wc (cm³) = Iy/(bf − xg)', fy.Wc / cm3, ey.Wc, 0.002);
    // Me do Anexo E é diferença de dois termos próximos (j arredondado no manual): recálculo do oráculo = 227,5 (+1,3 %)
    ok('S8 y Me Anexo E (kN·cm) (tol 2 %: j arredondado)', fy.Me * 100, ey.Me, 0.02);
    ok('S8 y λ0 (tol 1 %: Me)', fy.lambda0, ey.lambda0, 0.01); ok('S8 y χFLT', fy.chiFLT, ey.chi_FLT, 0.005);
    // (c) DimPerfil toma a fibra comprimida no extremo da largura efetiva; a norma literal usa o extremo da seção
    ok('S8 y Wef,esc (cm³) (tol 5 %, ver (c); implementação conservadora)', fy.Wef / cm3, ey.Wy_ef_esc, 0.05);
    ok('S8 y MRd,esc (kN·cm) (tol 5 %)', fy.MRdEsc * 100, ey.MRd_esc, 0.05);
    ok('S8 y Wc,ef (cm³) (tol 5 %)', fy.WcEf / cm3, ey.Wc_ef, 0.05); ok('S8 y MRd,FLT (kN·cm) (tol 5 %)', fy.MRdFLT * 100, ey.MRd_FLT, 0.05);
    ok('S8 y MyRd (kN·cm) (tol 5 %)', fy.capacity * 100, ey.MyRd, 0.05);
    assert('S8 y conservador (norma ≤ DimPerfil)', fy.capacity * 100 <= ey.MyRd * 1.001);
    ok('S8 VRd (kN) (tol 3 %: manual h = bw − 4t)', r.corteY.capacity, e.VRd, 0.03);
    ok('S8 limite 1,08√(E·kv/fy)', r.corteY.lim108, e.lim_1_08, 0.002);
    const p = r.interaction99.parcelas, ei = e.interacao_9_9;
    ok('S8 9.9 N/NRd', p.N, ei.N, 0.05); ok('S8 9.9 Mx/MxRd', p.Mx, ei.Mx, 0.02); ok('S8 9.9 My/MyRd (tol 5 %, ver (c))', p.My, ei.My, 0.05);
    ok('S8 9.9 soma', r.interaction99.ratio, ei.soma, 0.015);
    assert('S8 distorcional dispensada (U simples, 9.3)', a.distorcional.dispensada === true);
  }
  // mesma seção com ri = t (convenção do manual): x-bending e cortante do oráculo reproduzidos
  const r2 = run('S8-ri=t', { demands: dem, mat, sec: secOf(c.perfil, { dims: { ri: 2.65 * mm } }), member, options: { sentidoMy: 'mesas' } });
  if (r2) {
    const ex = e.flexao_x;
    ok('S8(ri=t) x Wef,esc (cm³)', r2.flexaoX.Wef / cm3, ex.Wef_esc, 0.005); ok('S8(ri=t) x MRd,FLT (kN·cm)', r2.flexaoX.MRdFLT * 100, ex.MRd_FLT, 0.005);
    ok('S8(ri=t) x Wc,ef (cm³)', r2.flexaoX.WcEf / cm3, ex.Wc_ef, 0.005);
    ok('S8(ri=t) VRd (kN)', r2.corteY.capacity, e.VRd, 0.002);
  }
  // sem sentido de My: mínimo dos dois sentidos (nunca maior que o sentido 'mesas')
  const r3 = run('S8-semSentido', { demands: dem, mat, sec: secOf(c.perfil), member });
  if (r3 && r) assert('S8 sem sentido de My: capacidade = mín(alma, mesas) ≤ mesas', r3.flexaoY.capacity <= r.flexaoY.capacity + 1e-12, `min=${r3.flexaoY.capacity.toFixed(4)} mesas=${r.flexaoY.capacity.toFixed(4)}`);
}

// ── Tração (9.6.2 a) — S6 só escoamento da bruta; ruptura líquida NÃO verificada (aviso) ───────────
{
  const c = D.casos['BR-14762-PILAR-S6-tracao'];
  const r = run('S6', { demands: { N: 16.8 }, mat: matOf(c), sec: { shape: '2Ue', A: c.A * cm2 }, member: { L: 3 } });
  if (r) {
    ok('S6 Nt,Rd escoamento (kN)', r.axial.capacity, c.esperado.Nt_Rd_esc, 0.001);
    assert('S6 aviso: ruptura da seção líquida não verificada', hasAviso(r, /ruptura da seção líquida/));
  }
}

// ── MLE: Tab. 5/6 com os exemplos do CBCA 449 (E = 20500 explícito) ───────────────────────────────
{
  const c = D.casos['BR-14762-MLE-449'], E = c.E;
  const m1 = c.Ex01_mesa, r1 = N.effAL(m1.b, m1.t, m1.sigma, m1.sigma, E);
  ok('MLE Ex.01 mesa AL k = 0,43 λp', (m1.b / m1.t) / (0.95 * Math.sqrt(0.43 * E / m1.sigma)), m1.lambda_p, 0.005);
  ok('MLE Ex.01 mesa bef (cm)', r1.gaps[0][0], m1.bef, 0.005);
  const m2 = c.Ex02_mesa, r2 = N.effAL(m2.b, m2.t, 0.236 * m2.sigma * -1, m2.sigma, E);   // σ no apoio = −0,236·σ livre (tração), livre = 25 (comprime)
  ok('MLE Ex.02 mesa AL caso d: k = 0,57 − 0,21ψ + 0,07ψ²', r2.k, m2.k, 0.005);
  ok('MLE Ex.02 mesa λp', r2.lp, m2.lambda_p, 0.005);
  ok('MLE Ex.02 bef sobre bc (9.2.2.1, 2010) × 4,94 do manual 2001 sobre b: aqui bc = b/(1−ψ)', r2.bef, m2.bef_2001 * (1 / (1 + 0.236)), 0.01);
  const m3 = c.Ex03_L, r3 = N.effAL(m3.b, m3.t, m3.sigma, m3.sigma, E);
  ok('MLE Ex.03 cantoneira λp', r3.lp, m3.lambda_p, 0.01); ok('MLE Ex.03 bef (cm)', r3.gaps.length ? r3.gaps[0][0] : m3.b, m3.bef, 0.005);
  // alma AA em flexão pura (ψ = −1): k = 24 (Tab. 5 caso d)
  const aa = N.effAA(23.94, 0.265, 20.64, -20.64, E);
  ok('MLE Ex.01 alma AA ψ = −1: k = 24', aa.k, 24, 0.001); assert('MLE Ex.01 alma totalmente efetiva', aa.full === true);
}

// ── Ne dos exemplos CBCA 449 (E = 20500, G = 7884,615 explícitos) ──────────────────────────────────
for (const id of ['BR-14762-NE-449-13', 'BR-14762-NE-449-14']) {
  const c = D.casos[id], e = c.esperado, mat = matOf(c);
  const member = c.KL ? { L: c.KL * cm, Lx: c.KL * cm, Ly: c.KL * cm, Lz: c.KL * cm } : { L: c.Lx * cm, Lx: c.Lx * cm, Ly: c.Ly * cm, Lz: c.Lz * cm };
  const r = run(id, { demands: { N: -1 }, mat, sec: secOf(c.perfil), member });
  if (r) {
    const a = r.axial;
    ok(`${id} Nex`, a.Nex, e.Nex, 0.005); ok(`${id} Ney`, a.Ney, e.Ney, 0.005); ok(`${id} Nez`, a.Nez, e.Nez, 0.005);
    ok(`${id} Nexz = Ne`, a.Ne, e.Ne, 0.005);
  }
}

// ── Catálogo profiles_cf.js ────────────────────────────────────────────────────────────────────────
{
  assert('Catálogo: 85 Ue + 65 L', cfNames('Ue').length === 85 && cfNames('L').length === 65, `${cfNames('Ue').length}+${cfNames('L').length}`);
  const p = cfProfile('Ue 100x50x17x1,20');
  ok('Catálogo Ue 100x50x17x1,2 A (m²)', p.A, 2.71e-4, 1e-9); ok('Catálogo Ix (m⁴)', p.Iz, 44.15e-8, 1e-9); ok('Catálogo Cw (m⁶)', p.Cw, 246.61e-12, 1e-9);
  ok('Catálogo ri = t (6355 Tab. A.3)', p.dims.ri, p.dims.t, 1e-12);
  // It recalculado da linha média: (am+2bm+2cm)·t³/3 = 0,0132 cm⁴ (manual: 0,013; tabela 6355: 0,01)
  ok('Catálogo J recalculado (cm⁴) = Σ b·t³/3', p.J / cm4, 0.0132, 0.01); ok('Catálogo JTab = 0,01 (impresso)', p.JTab / cm4, 0.01, 1e-9);
  // perfil do catálogo direto no check: Ex.05 (Ue 150x60x20x3,00) — It recalculado (0,262 vs manual 0,261)
  const r = run('CAT', { demands: { N: -50 }, mat: { Fy: 250000, E: 2e8 }, sec: cfSection('Ue 150x60x20x3,00'), member: { L: 6, Lx: 6, Ly: 3, Lz: 3 } });
  if (r) ok('Catálogo→check Ex.05: Ne (kN)', r.axial.Ne, D.casos['BR-14762-NE-02'].esperado.Ne, 0.01);
  const rb = run('CAT-b', { demands: { N: -3, Mz: 0.2 }, mat: { Fy: 250000, E: 2e8 }, sec: cfSection('Ue 100x50x17x1,20'), member: { L: 3, Lx: 3, Ly: 3, Lz: 3, Lb: 1, Cb: 1 } });
  if (rb) assert('Catálogo Ue 100x50x17x1,20 verificado sem exceção (dispensa por Tab. 11/14)', Number.isFinite(rb.ratioMax) && rb.axial.verificado !== false && rb.flexaoX.verificado !== false, `ratioMax=${rb.ratioMax}, estado=${rb.state}`);
  // Ue 200x75x25x3,00: bf/bw = 0,375 < 0,4 (fora da Tab. 11/14) e sem Ndist/Mdist → não verificado (a norma só dispensa dentro das tabelas)
  const rd = run('CAT-c', { demands: { N: -20, Mz: 0.3 }, mat: { Fy: 250000, E: 2e8 }, sec: cfSection('Ue 200x75x25x3,00'), member: { L: 3, Lx: 3, Ly: 3, Lz: 3, Lb: 3, Cb: 1 } });
  if (rd) assert('Catálogo Ue 200x75x25x3,00 (fora das Tab. 11/14, sem Ndist/Mdist) → Infinity + aviso', rd.axial.ratio === Infinity && rd.flexaoX.ratio === Infinity && hasAviso(rd, /Tab\. 11 não cobre/) && hasAviso(rd, /Tab\. 14 não cobre/));
}

// ── Robustez: nunca passagem silenciosa ────────────────────────────────────────────────────────────
{
  const mat = { Fy: 250000, E: 2e8 };
  const base = secOf('Ue 100x50x17x1,20');
  // Z enrijecido / cartola / L → não verificado (compressão, flexão, cortante), tração só escoamento
  for (const shape of ['Z', 'C', 'L']) {
    const r = run('Z-' + shape, { demands: { N: -5, Mz: 0.2, Vy: 1 }, mat, sec: { ...base, shape }, member: { L: 2, Lb: 2, Cb: 1 } });
    if (r) assert(`ROB shape ${shape} → compressão/flexão/cortante Infinity + aviso`, r.axial.ratio === Infinity && r.flexaoX.ratio === Infinity && r.corteY.ratio === Infinity && r.interaction.ratio === Infinity && r.state === 'NO CUMPLE' && hasAviso(r, /fora do escopo/));
    const rt = run('Zt-' + shape, { demands: { N: 10 }, mat, sec: { ...base, shape }, member: { L: 2 } });
    if (rt) assert(`ROB shape ${shape} tração: só escoamento, finito`, Number.isFinite(rt.axial.ratio) && hasAviso(rt, /ruptura da seção líquida/));
  }
  // sem comprimento → não verificado
  const rl = run('semL', { demands: { N: -5, Mz: 0.1 }, mat, sec: base, member: { Ldefault: true, L: 1 } });
  if (rl) assert('ROB sem comprimento: compressão e flexão Infinity + aviso', rl.axial.ratio === Infinity && rl.flexaoX.ratio === Infinity && hasAviso(rl, /comprimento/));
  // faltam propriedades (Cw)
  const rc = run('semCw', { demands: { N: -5 }, mat, sec: { ...base, Cw: 0 }, member: { L: 2, Lx: 2, Ly: 2, Lz: 2 } });
  if (rc) assert('ROB sem Cw: não verificado', rc.axial.ratio === Infinity && hasAviso(rc, /Cw/));
  // Tab. 4: alma h/t > 200 em flexão
  const rt4 = run('tab4', { demands: { Mz: 0.1 }, mat, sec: secOf('Ue 100x50x17x1,20', { dims: { bw: 0.3 } }), member: { L: 2, Lb: 2, Cb: 1 } });
  if (rt4) assert('ROB Tab. 4: alma h/t > 200 em flexão → Infinity + aviso', rt4.flexaoX.ratio === Infinity && hasAviso(rt4, /Tab\. 4/));
  // 9.9 com componente não verificado → interação Infinity
  const ri = run('i99', { demands: { N: -3, My: 0.02 }, mat, sec: secOf('Ue 100x50x17x1,20'), member: { L: 3, Lx: 3, Ly: 3, Lz: 3 } });
  if (ri) assert('ROB 9.9: My de Ue sem sentido/MdistY → interação Infinity', ri.interaction.ratio === Infinity);
  // demanda nula → itens não verificados não inflam ratio
  const rz = run('zero', { demands: { N: -3 }, mat, sec: secOf('Ue 100x50x17x1,20'), member: { L: 3, Lx: 3, Ly: 3, Lz: 3 } });
  if (rz) assert('ROB sem My/Mz: flexão sem demanda não gera Infinity', rz.flexaoX.ratio === 0 && rz.flexaoY.ratio === 0 && Number.isFinite(rz.interaction.ratio), `ratioMax=${rz.ratioMax}`);
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK — todos os testes NBR 14762 passaram');
process.exit(fails ? 1 : 0);
