// ──────────────────────────────────────────────────────────────────────────────
// nbr6118.js — REINFORCED CONCRETE design per ABNT NBR 6118:2026 (PLANO_BRASIL 7.2).
//
//   · Materials       fcd = fck/γc, fyd = fyk/γs (Tab. 12.1); Es = 210 GPa (8.3.5); εyd = fyd/Es
//   · ELU bending     17.2.2: plane sections, rectangular block y = λ·x with stress αc·ηc·fcd
//                     (ηc = (40/fck)^(1/3) for fck > 40 — NEW in the 2026 edition, 8.2.10.1);
//                     εcu / εc2 (8.2.10.1); domains of Fig. 17.1 (steel elongation 10 ‰)
//   · N+M             interaction diagram by strain compatibility (design values, no φ);
//                     biaxial (MRd,x/MRd,xx)^α + (MRd,y/MRd,yy)^α ≤ 1, α = 1,2 rectangular (17.2.5)
//   · Ductility       x/d ≤ 0,45 (fck ≤ 50) / 0,35 (fck > 50) (14.6.4.3, 17.2.3)
//   · Long. steel     As,mín from Md,mín = 0,8·W0·fctk,sup ≥ 0,15 % Ac (17.3.5.2.1); As ≤ 4 % Ac (17.3.5.2.4)
//   · Shear           17.4.2.2 Model I (θ = 45°) and 17.4.2.3 Model II (30° ≤ θ ≤ 45°):
//                     VRd2, Vc0 = 0,6·fctd·bw·d, Vc1 interpolated, Vsw, fywd ≤ 435 MPa,
//                     ρsw,mín = 0,2·fct,m/fywk (17.4.1.1.1)
//
// Verifies the GIVEN reinforcement (sec.design.rebar: explicit layers or nTop/nBot+dia —
// layer depth `d` measured from the compression fiber) and also reports the required As for
// the beam (single/double reinforcement). Without explicit bars the section is reported as
// NOT verified (the ρ fallback of concrete.js is not accepted for NBR).
// Units: kN, m, kN/m² (strengths converted to MPa only inside the empirical expressions).
// Source transcription: PLANO_BRASIL "Fase 5" fichas (checked against the 2026 PDF).
// ──────────────────────────────────────────────────────────────────────────────

import { finalize } from './aisc360.js?v=7';
import { rebarLayers, pmRatio, pmMomentAt } from './concrete.js?v=7';

const ratObj = (D, C, extra = {}) => ({
  demand: +(+D).toFixed(4), capacity: +(+C).toFixed(4),
  ratio: C > 1e-12 ? +(D / C).toFixed(4) : Infinity, ...extra,
});
const ES = 210e6;                       // kN/m² (8.3.5)
const EPS_SU = 0.010;                   // steel elongation limit of the domains (Fig. 17.1)
const barArea = (dia) => Math.PI * (dia / 1000) ** 2 / 4;

/** Concrete parameters of NBR 6118:2026 for fck in MPa. */
export function concreteParams(fck, gc = 1.4) {
  const g1 = fck <= 50;
  return {
    fcd: fck / gc,                                                       // MPa
    etac: fck <= 40 ? 1.0 : Math.cbrt(40 / fck),                         // 8.2.10.1
    alphac: g1 ? 0.85 : 0.85 * (1 - (fck - 50) / 200),                  // 17.2.2-e
    lambda: g1 ? 0.8 : 0.8 - (fck - 50) / 400,
    ecu: g1 ? 0.0035 : 0.0026 + 0.035 * ((90 - fck) / 100) ** 4,        // 8.2.10.1
    ec2: g1 ? 0.002 : 0.002 + 0.000085 * (fck - 50) ** 0.53,
    fctm: g1 ? 0.3 * fck ** (2 / 3) : 2.12 * Math.log(1 + 0.1 * (fck + 8)),   // 8.2.5
    xdLim: g1 ? 0.45 : 0.35,                                             // 14.6.4.3
  };
}

// N–M diagram of a rectangular section (design values). b = width, h = depth in the bending
// direction, layers {As, dy} with dy from the compression fiber. Compression N positive.
function nbrDiagram(b, h, sigcd, lambda, ecu, ec2, fyd, layers, npts = 60) {
  const dmax = layers.length ? Math.max(...layers.map(L => L.dy)) : h;
  const x23 = ecu / (ecu + EPS_SU) * dmax;
  const pts = [];
  const xs = [];
  for (let i = 1; i <= npts; i++) xs.push(dmax * 0.02 + (3 * h - dmax * 0.02) * Math.pow(i / npts, 1.6));
  for (const x of xs) {
    // strain at depth y (compression +) — pivots of Fig. 17.1
    let strain;
    if (x <= x23) { const k = EPS_SU / (dmax - x); strain = (y) => k * (x - y); }                 // domain 2
    else if (x <= h) { const k = ecu / x; strain = (y) => k * (x - y); }                          // 3, 4, 4a
    else { const yC = h * (1 - ec2 / ecu); const k = ec2 / (x - yC); strain = (y) => k * (x - y); }  // 5
    const yb = Math.min(lambda * x, h);
    const Cc = sigcd * b * yb;
    let N = Cc, M = Cc * (h / 2 - yb / 2);
    for (const L of layers) {
      const es = strain(L.dy);
      let fs = Math.max(-fyd, Math.min(fyd, ES * es));
      if (es > 0 && L.dy <= yb) fs -= sigcd;          // displaced concrete
      N += fs * L.As; M += fs * L.As * (h / 2 - L.dy);
    }
    pts.push({ P: N, M: Math.abs(M) });
  }
  const Ast = layers.reduce((s, L) => s + L.As, 0);
  pts.push({ P: -fyd * Ast, M: 0 });                   // pure tension (all steel yielding)
  pts.sort((a, b2) => b2.P - a.P);
  return { pts };
}

// Required longitudinal steel for simple bending (rectangular block, 17.2.2-e).
function requiredAs(Md, b, d, dl, sigcd, lambda, ecu, fyd, xdLim) {
  const mu = 2 * Md / (sigcd * b * d * d);
  const eyd = fyd / ES;
  const x34 = ecu / (ecu + eyd) * d, x23 = ecu / (ecu + EPS_SU) * d;
  const dominio = (x) => x <= x23 ? 2 : x <= x34 ? 3 : 4;
  if (mu <= 1) {
    const x = d * (1 - Math.sqrt(1 - mu)) / lambda;
    if (x / d <= xdLim) return { asNec: sigcd * b * lambda * x / fyd, asLinhaNec: 0, xd: x / d, dominio: dominio(x) };
  }
  // double reinforcement with x = xlim
  const xl = xdLim * d;
  const Mlim = sigcd * b * lambda * xl * (d - lambda * xl / 2);
  const dM = Md - Mlim;
  const esl = ecu * (xl - dl) / xl;
  const fsl = Math.min(fyd, ES * Math.max(esl, 0));
  const asLinhaNec = fsl > 0 ? dM / ((d - dl) * fsl) : Infinity;
  return { asNec: sigcd * b * lambda * xl / fyd + dM / ((d - dl) * fyd), asLinhaNec, xd: xdLim, dominio: dominio(xl), dupla: true };
}

function shearCheck({ VSd, bw, d, fck, fcd, fctm, fyd, fywk, gc, stir, modelo, thetaDeg, alphaDeg, N }) {
  const a = alphaDeg * Math.PI / 180, th = thetaDeg * Math.PI / 180;
  const av2 = 1 - fck / 250;
  const fctd = 0.7 * fctm / gc;                                   // MPa (fctk,inf/γc)
  const fywd = Math.min(fyd, 435);                                // MPa
  const Vc0 = 0.6 * fctd * 1000 * bw * d;                         // kN
  let VRd2, Vc, kSw;
  if (modelo === 'II') {
    VRd2 = 0.54 * av2 * fcd * 1000 * bw * d * Math.sin(th) ** 2 * (1 / Math.tan(a) + 1 / Math.tan(th));
    Vc = VSd <= Vc0 ? Vc0 : VSd >= VRd2 ? 0 : Vc0 * (VRd2 - VSd) / (VRd2 - Vc0);
    kSw = 0.9 * d * fywd * 1000 * (1 / Math.tan(a) + 1 / Math.tan(th)) * Math.sin(a);
  } else {
    VRd2 = 0.27 * av2 * fcd * 1000 * bw * d;
    Vc = Vc0;
    kSw = 0.9 * d * fywd * 1000 * (Math.sin(a) + Math.cos(a));
  }
  const aswS = stir && +stir.dia > 0 && +stir.s > 0 ? (+stir.legs || 2) * barArea(+stir.dia) / (+stir.s / 1000) : 0;
  const Vsw = aswS * kSw;
  const aswMin = 0.2 * fctm / fywk * bw * Math.sin(a);            // m²/m (17.4.1.1.1)
  const aswNec = Math.max(Math.max(VSd - Vc, 0) / kSw, aswMin);
  const VRd3 = Vc + Vsw;
  return { VRd2, Vc, Vc0, Vsw, VRd3, aswS, aswMin, aswNec, modelo: modelo === 'II' ? 'II' : 'I' };
}


// ── Columns: local second-order effects (15.8) ─────────────────────────────────
// h = depth in the bending direction (m); Nd compression (kN); M1dA = larger end moment (kN·m,
// absolute); rMBA = MB/MA signed (+ same face in tension = single curvature); le (m).
// opts: { balanco, cargaTransversal, metodo: 'curvatura'|'kappa' }
export function columnSecondOrder({ h, Ac, Nd, M1dA, rMBA = 1, le, fcdK, opts = {} }) {
  const M1dmin = Nd * (0.015 + 0.03 * h);                          // 11.3.3.4.3
  const usesMin = M1dA < M1dmin;
  const M1 = Math.max(M1dA, M1dmin);
  let alphab;                                                       // 15.8.2
  if (opts.balanco || opts.cargaTransversal || usesMin) alphab = 1.0;
  else alphab = Math.max(0.6 + 0.4 * rMBA, 0.4);
  const lambda = le / (h / Math.sqrt(12));                          // rectangular: i = h/√12
  const e1 = M1 / Nd;
  const lambda1 = Math.min(Math.max((25 + 12.5 * e1 / h) / alphab, 35), 90);
  const out = { M1dmin, M1: M1, alphab, lambda, lambda1, Mdtot: M1, metodo: 'sem 2ª ordem local (λ ≤ λ1)', ok: true };
  if (lambda <= lambda1) return out;
  if (lambda > 90) { out.ok = false; out.metodo = `λ = ${lambda.toFixed(1)} > 90: exige fluência e pilar-padrão com diagramas M,N,1/r ou método geral (15.8.3.3.4/15.8.3.2) — fora da v1`; return out; }
  const nu = Nd / (Ac * fcdK);
  if (opts.metodo === 'kappa') {                                     // 15.8.3.3.3, direct solution
    const a = 5 * h, bq = h * h * Nd - Nd * le * le / 320 - 5 * h * alphab * M1, c = -Nd * h * h * alphab * M1;
    out.Mdtot = Math.max((-bq + Math.sqrt(bq * bq - 4 * a * c)) / (2 * a), M1);
    out.metodo = 'pilar-padrão com rigidez κ aproximada (15.8.3.3.3)';
  } else {                                                          // 15.8.3.3.2
    const invr = Math.min(0.005 / (h * (nu + 0.5)), 0.005 / h);
    out.Mdtot = Math.max(alphab * M1 + Nd * le * le / 10 * invr, M1);
    out.invr = invr;
    out.metodo = 'pilar-padrão com curvatura aproximada (15.8.3.3.2)';
  }
  out.nu = nu;
  return out;
}

function checkNBR6118({ demands, mat, sec, member = {}, options = {} }) {
  const avisos = [];
  const gc = options.gamma_c ?? 1.4, gs = options.gamma_s ?? 1.15;
  const fck = mat.fc / 1000, fyk = mat.fyRebar / 1000;            // MPa
  const P = concreteParams(fck, gc);
  const fyd = fyk / gs;                                           // MPa
  const sigcd = P.alphac * P.etac * P.fcd * 1000;                 // kN/m² (width not decreasing)
  const fydK = fyd * 1000;
  if (fck > 40) avisos.push(`fck = ${fck} MPa > 40: ηc = ${P.etac.toFixed(4)} reduz a tensão do bloco (NBR 6118:2026 8.2.10.1).`);
  const b = sec.b, h = sec.h, A = sec.A ?? b * h;
  if (sec.shape && sec.shape !== 'rect') avisos.push(`Seção "${sec.shape}": a v1 verifica só seção retangular — resultado NÃO verificado.`);

  const reb = sec.rebar || (sec.design && sec.design.rebar) || {};
  const cover = (reb.cover_mm ?? options.cover_mm ?? 40) / 1000;
  const rl = rebarLayers(reb, h, b, cover, 0);
  const layers = rl.layers.filter(L => L.As > 0);
  const hasBars = layers.length > 0;
  if (!hasBars) avisos.push('Sem armadura longitudinal explícita (sec.design.rebar): flexão/N+M NÃO verificados (a NBR exige barras, não taxa ρ).');
  const stir = reb.stirrups || (reb.estribo_dia_mm ? { dia: reb.estribo_dia_mm, s: reb.estribo_s_mm } : null);

  const N = demands.N || 0;                                       // + tension
  const Vy = Math.abs(demands.Vy || 0), Vz = Math.abs(demands.Vz || 0);
  const My = Math.abs(demands.My || 0), Mz = Math.abs(demands.Mz || 0);
  const Nc = -N;                                                  // compression +

  // ── columns (compression + member.le): γn (13.2.3) and local 2nd order (15.8) ──
  let pilar = null;
  let MzD = Mz, MyD = My, NcD = Nc;
  if (Nc > 0 && member.le > 0) {
    const bmin = Math.min(b, h);
    let gn = 1.0;
    if (bmin < 0.19) {
      if (bmin < 0.14) avisos.push(`Menor dimensão ${(bmin * 100).toFixed(1)} cm < 14 cm (13.2.3).`);
      gn = 1.95 - 0.05 * bmin * 100;                                // Tab. 13.1 (b in cm)
      avisos.push(`b = ${(bmin * 100).toFixed(1)} cm < 19 cm: esforços majorados por γn = ${gn.toFixed(2)} (13.2.3).`);
    }
    if (A < 0.036) avisos.push('Área do pilar < 360 cm² (13.2.3).');
    NcD = gn * Nc;
    const fcdK = P.fcd * 1000;
    const opts = { balanco: !!member.balanco, cargaTransversal: !!member.cargaTransversal, metodo: options.metodo2aOrdem };
    const sz = columnSecondOrder({ h, Ac: A, Nd: NcD, M1dA: gn * Mz, rMBA: member.rMBA_z ?? member.rMBA ?? 1, le: member.lez ?? member.le, fcdK, opts });
    const sy = columnSecondOrder({ h: b, Ac: A, Nd: NcD, M1dA: gn * My, rMBA: member.rMBA_y ?? member.rMBA ?? 1, le: member.ley ?? member.le, fcdK, opts });
    MzD = sz.Mdtot; MyD = sy.Mdtot;
    pilar = { gn, z: sz, y: sy };
    for (const [ax, so] of [['z', sz], ['y', sy]]) if (!so.ok) avisos.push(`Pilar (eixo ${ax}): ${so.metodo}.`);
    const asMinP = Math.max(0.15 * NcD / fydK, 0.004 * A);           // 17.3.5.3
    if (hasBars && rl.Ast < asMinP - 1e-12) avisos.push(`As do pilar ${(rl.Ast * 1e4).toFixed(2)} cm² < As,mín ${(asMinP * 1e4).toFixed(2)} cm² (17.3.5.3).`);
    if (hasBars && rl.Ast > 0.08 * A) avisos.push('As do pilar > 8 % Ac, incluindo emendas (17.3.5.3).');
    pilar.asMin = asMinP;
  }

  const dTens = hasBars ? Math.max(...layers.map(L => L.dy)) : h - cover;
  const d = sec.d ?? dTens;
  const dl = sec.dLinha ?? sec.dlinha ?? (hasBars ? Math.min(...layers.map(L => L.dy)) : cover);

  // ── bending (strong axis, Mz) ────────────────────────────────────────────────
  const req = requiredAs(Mz, b, d, dl, sigcd, P.lambda, P.ecu, fydK, P.xdLim);
  let MRd = 0, diag = null;
  if (hasBars) {
    diag = nbrDiagram(b, h, sigcd, P.lambda, P.ecu, P.ec2, fydK, layers);
    MRd = pmMomentAt(diag, NcD);
  }
  const flexao = ratObj(MzD, MRd, { eixo: 'forte (Mz = Msd,x)', asNec: req.asNec, asLinhaNec: req.asLinhaNec,
    xd: +req.xd.toFixed(4), dominio: req.dominio, dupla: !!req.dupla, d, formula: 'MRd por compatibilidade (17.2.2), bloco αc·ηc·fcd, λ·x' });
  if (!hasBars) flexao.ratio = Infinity;

  // minimum / maximum longitudinal steel (17.3.5.2.1 / 17.3.5.2.4)
  const fctksup = 1.3 * P.fctm;
  const W0 = b * h * h / 6;
  const MdMin = 0.8 * W0 * fctksup * 1000;
  const asMin = Math.max(requiredAs(MdMin, b, d, dl, sigcd, P.lambda, P.ecu, fydK, P.xdLim).asNec, 0.0015 * A);
  const asTrac = hasBars ? layers.filter(L => L.dy > h / 2).reduce((s, L) => s + L.As, 0) : 0;
  if (hasBars && asTrac < asMin - 1e-12) avisos.push(`As tracionada ${(asTrac * 1e4).toFixed(2)} cm² < As,mín ${(asMin * 1e4).toFixed(2)} cm² (17.3.5.2.1).`);
  if (hasBars && rl.Ast > 0.04 * A) avisos.push(`As total ${(rl.Ast * 1e4).toFixed(2)} cm² > 4 % Ac (17.3.5.2.4).`);
  if (req.dupla) avisos.push(`x/d acima de ${P.xdLim}: armadura dupla necessária (14.6.4.3).`);
  flexao.asMin = asMin;

  // ── weak axis bending (My) ───────────────────────────────────────────────────
  // bar positions across the width are needed for the weak axis: reb.layersY [{n,dia,d}|{As,d}]
  // with d measured from the compressed face in the y direction
  let MRdy = 0;
  const lY = Array.isArray(reb.layersY) ? rebarLayers({ layers: reb.layersY }, b, h, cover, 0).layers.filter(L => L.As > 0) : [];
  if (lY.length) MRdy = pmMomentAt(nbrDiagram(h, b, sigcd, P.lambda, P.ecu, P.ec2, fydK, lY), NcD);
  const flexaoY = ratObj(MyD, MRdy, { eixo: 'fraco (My = Msd,y)' });
  if (MyD > 1e-9 && !lY.length) { flexaoY.ratio = Infinity; avisos.push('My ≠ 0 sem posição das barras no eixo fraco (rebar.layersY): flexão em y NÃO verificada.'); }
  if (MyD <= 1e-9) flexaoY.ratio = 0;

  // ── axial ────────────────────────────────────────────────────────────────────
  let axial;
  if (N < 0) {
    const NRd = 0.85 * P.etac * P.fcd * 1000 * (A - rl.Ast) + Math.min(fydK, ES * 0.002) * rl.Ast;   // εc2 = 2 ‰
    axial = ratObj(Math.abs(N), NRd, { modo: 'compressão', formula: 'NRd = 0,85·ηc·fcd·Ac + σs(εc2)·As' });
  } else {
    axial = ratObj(N, fydK * rl.Ast, { modo: 'tração', formula: 'NRd = fyd·As' });
  }

  // ── N + M interaction ────────────────────────────────────────────────────────
  let interaction;
  if (!hasBars) interaction = ratObj(Infinity, 1, { adim: true, formula: 'não verificado (sem barras)' });
  else if (MyD > 1e-9 && MzD > 1e-9) {
    const al = 1.2;                                                 // 17.2.5, rectangular section
    const r = Math.pow(MzD / (MRd || 1e-12), al) + Math.pow(MyD / (MRdy || 1e-12), al);
    interaction = ratObj(r, 1, { adim: true, modo: 'flexão oblíqua', formula: '(MSd,x/MRd,xx)^1,2 + (MSd,y/MRd,yy)^1,2 ≤ 1 (17.2.5)' });
  } else {
    interaction = ratObj(pmRatio(diag, NcD, MzD), 1, { adim: true, modo: Nc >= 0 ? 'flexo-compressão' : 'flexo-tração',
      formula: 'diagrama N–M por compatibilidade (17.2.2)' });
  }

  // ── shear ────────────────────────────────────────────────────────────────────
  const modelo = options.modeloCortante === 'II' ? 'II' : 'I';
  const theta = modelo === 'II' ? Math.min(Math.max(options.theta ?? 45, 30), 45) : 45;
  const alpha = options.alpha ?? 90;
  const sv = shearCheck({ VSd: Vy, bw: b, d, fck, fcd: P.fcd, fctm: P.fctm, fyd, fywk: fyk, gc, stir, modelo, thetaDeg: theta, alphaDeg: alpha, N });
  const capV = Math.min(sv.VRd2, sv.VRd3);
  const cortante = ratObj(Vy, capV, { dir: 'Vy', modelo: sv.modelo, VRd2: sv.VRd2, Vc: sv.Vc, Vsw: sv.Vsw, VRd3: sv.VRd3,
    aswNec: sv.aswNec, aswMin: sv.aswMin, theta, formula: modelo === 'II' ? 'Modelo II (17.4.2.3)' : 'Modelo I (17.4.2.2)' });
  if (!sv.aswS) avisos.push('Sem estribos informados: VRd3 = Vc; a NBR exige armadura transversal mínima (17.4.1.1.1).');
  else if (sv.aswS < sv.aswMin - 1e-12) avisos.push('Armadura transversal abaixo da mínima ρsw,mín = 0,2·fct,m/fywk (17.4.1.1.1).');
  if (N < 0) avisos.push('Flexo-compressão: Vc tomado sem o acréscimo (1 + M0/MSd,máx) — conservador (17.4.2.2-b).');
  const dz = b - cover;
  const svz = shearCheck({ VSd: Vz, bw: h, d: dz, fck, fcd: P.fcd, fctm: P.fctm, fyd, fywk: fyk, gc, stir: null, modelo, thetaDeg: theta, alphaDeg: alpha, N });
  const corteZ = ratObj(Vz, Math.min(svz.VRd2, svz.VRd3), { dir: 'Vz', modelo: svz.modelo });

  if (pilar && !(pilar.z.ok && pilar.y.ok)) { flexao.ratio = Infinity; interaction.ratio = Infinity; }
  const bending = flexao.ratio >= flexaoY.ratio ? flexao : flexaoY;
  const shear = cortante.ratio >= corteZ.ratio ? cortante : corteZ;
  return finalize({ material: 'concreto', metodo: 'ABNT NBR 6118:2026', axial, bending, shear, interaction,
    flexao, flexaoY, cortante, corteZ, pilar, avisos, diagrama: diag ? { pts: diag.pts, Pu: Nc, Mu: Mz } : null }, options);
}

export const nbr6118 = {
  id: 'NBR6118:2026', family: 'concrete', label: 'ABNT NBR 6118:2026',
  check: (input) => checkNBR6118(input),
};
