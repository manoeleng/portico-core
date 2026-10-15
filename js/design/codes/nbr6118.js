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
// layer depth `d` measured from the compression fiber to the bar CENTROID; with nTop/nBot,
// `cover_mm` is that centroid distance, not the nominal cover) and also reports the required
// As for the beam (single/double reinforcement). Without explicit bars, with a non-rectangular
// section or with torsion the result is NOT verified (ratio = ∞, never a silent pass).
// Detailing limits (As,mín/máx, dimensions) are reported as warnings (avisos). The moment SENSE
// is not checked (magnitudes; layers measured from the compressed fiber). Flexo-tension uses
// N = 0 in the ductility check (conservative). ELS (deflection,
// cracking) is not part of check(): see the serviceability helpers.
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
  // uniform compression (reta b, εc2 over the whole section) closes the top of the diagram
  { let N = sigcd * b * h, M = 0;
    for (const L of layers) { const fs = Math.min(fyd, ES * ec2) - sigcd; N += fs * L.As; M += fs * L.As * (h / 2 - L.dy); }
    pts.push({ P: N, M: Math.abs(M) }); }
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

// Weak-axis layers from the strong-axis description, only when the bar COUNT of every layer is known
// (layers [{n, dia, d}] or nTop/nBot + dia): the n bars of a layer are spread evenly between the
// covers across the width b. Returns [] when positions cannot be derived.
function deriveLayersY(reb, b, cover) {
  let rows = [];
  if (Array.isArray(reb.layers) && reb.layers.length) {
    if (!reb.layers.every(L => +L.n > 0 && +L.dia > 0)) return [];
    rows = reb.layers.map(L => ({ n: +L.n, Ab: barArea(+L.dia) }));
  } else if (+reb.dia > 0 || +reb.dia_mm > 0) {
    const Ab = barArea(+reb.dia_mm || +reb.dia);
    if (+reb.nTop) rows.push({ n: +reb.nTop, Ab });
    if (+reb.nBot) rows.push({ n: +reb.nBot, Ab });
  }
  const pos = new Map();
  for (const r of rows) {
    if (r.n === 1) { pos.set(b / 2, (pos.get(b / 2) || 0) + r.Ab); continue; }
    for (let i = 0; i < r.n; i++) { const y = +(cover + (b - 2 * cover) * i / (r.n - 1)).toFixed(6); pos.set(y, (pos.get(y) || 0) + r.Ab); }
  }
  return [...pos].map(([dy, As]) => ({ As, dy }));
}

// Neutral-axis depth of the given reinforcement for an axial force Nc (compression +), strain
// profile with εcu at the top (domains 3/4); bisection on force equilibrium.
function neutralAxis(b, h, sigcd, lambda, ecu, fyd, layers, Nc) {
  const f = (x) => {
    let N = sigcd * b * Math.min(lambda * x, h);
    for (const L of layers) {
      const es = ecu * (x - L.dy) / x;
      let fs = Math.max(-fyd, Math.min(fyd, ES * es));
      if (es > 0 && L.dy <= lambda * x) fs -= sigcd;
      N += fs * L.As;
    }
    return N - Nc;
  };
  let lo = 1e-5, hi = h;
  if (f(hi) < 0) return h;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

function shearCheck({ VSd, bw, d, fck, fcd, fctm, fyd, fywk, gc, stir, modelo, thetaDeg, alphaDeg, N, vcZero = false }) {
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
  if (vcZero) Vc = 0;
  const aswS = stir && +stir.dia > 0 && +stir.s > 0 ? (+stir.legs || 2) * barArea(+stir.dia) / (+stir.s / 1000) : 0;
  const Vsw = aswS * kSw;
  const aswMin = 0.2 * fctm / fywk * bw * Math.sin(a);            // m²/m (17.4.1.1.1)
  const aswNec = Math.max(Math.max(VSd - Vc, 0) / kSw, aswMin);
  const VRd3 = Vc + Vsw;
  return { VRd2, Vc, Vc0, Vsw, VRd3, aswS, aswMin, aswNec, kSw, modelo: modelo === 'II' ? 'II' : 'I' };
}


// ── Torsion (17.5.1, 17.7.2) — solid rectangle b × h, units m / kN / MPa ─────────
// Equivalent hollow section (17.5.1.4.1): he = A/u; when A/u < 2·c1, he = A/u ≤ b − 2·c1 and Ae is taken
// on the corner-bar axes. TRd2 = 0,50·αv2·fcd·Ae·he·sen2θ; TRd3 = (A90/s)·fywd·2Ae·cotgθ (one leg);
// TRd4 = (Asl/ue)·2Ae·fywd·tgθ. θ is the shear θ (17.7.2.1: model I ⇒ 45°).
export function torsionCheck({ TSd, b, h, c1, fck, fcd, fywd, theta = 45 }) {
  const th = theta * Math.PI / 180, A = b * h, u = 2 * (b + h);
  let he = A / u, Ae, ue, regra;
  if (he >= 2 * c1) { Ae = (b - he) * (h - he); ue = 2 * ((b - he) + (h - he)); regra = 'he = A/u'; }
  else { he = Math.min(A / u, Math.min(b, h) - 2 * c1); Ae = (b - 2 * c1) * (h - 2 * c1); ue = 2 * ((b - 2 * c1) + (h - 2 * c1)); regra = 'A/u < 2c1: Ae nos eixos das barras de canto'; }
  if (!(he > 0 && Ae > 0)) return null;                                              // b or h ≤ 2·c1
  const av2 = 1 - fck / 250;
  const TRd2 = 0.50 * av2 * fcd * 1000 * Ae * he * Math.sin(2 * th);                  // kN·m
  const a90Nec = TSd / (2 * Ae * fywd * 1000 / Math.tan(th));                          // m²/m, one leg
  const aslNec = TSd * ue / (2 * Ae * fywd * 1000 * Math.tan(th));                     // m², total
  return { he, Ae, ue, regra, TRd2, a90Nec, aslNec, theta };
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
  let naoVerificado = false;                                      // forces NO CUMPLE (never a silent pass)
  if (sec.shape && sec.shape !== 'rect') { naoVerificado = true; avisos.push(`Seção "${sec.shape}": a v1 verifica só seção retangular maciça — resultado NÃO verificado.`); }

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

  // ── columns: γn (13.2.3) and local 2nd order (15.8) ─────────────────────────────
  // A column is a member where compression is PREPONDERANT (14.4.1.2, no numeric limit): the section
  // role ('pilar'/'viga', member.role/tipo) decides; without a role, ν = Nd/(Ac·fcd) ≥ 0,10 is the
  // ADOPTED criterion (flagged). Beams with small compression keep the ductility check below.
  // le: member.le / lez / ley; without it the member length L (NOT conservative for cantilevers or
  // sway frames, where le > L — warned).
  let pilar = null, gn = 1.0;
  let MzD = Mz, MyD = My, NcD = Nc;
  const nuD = Nc / (A * P.fcd * 1000);
  const roleCol = member.role === 'pilar' || member.tipo === 'pilar' || member.isColumn === true;
  const roleBeam = member.role === 'viga' || member.tipo === 'viga';
  const isCol = Nc > 0 && (roleCol || (!roleBeam && nuD >= 0.10));
  if (Nc > 0 && !roleCol && !roleBeam && !isCol) avisos.push(`Compressão sem papel definido e ν = ${nuD.toFixed(3)} < 0,10: verificado como VIGA (sem M1d,mín/2ª ordem) — marque a seção como pilar se for o caso.`);
  if (isCol && !roleCol) avisos.push(`Compressão preponderante adotada por ν = ${nuD.toFixed(3)} ≥ 0,10 (14.4.1.2 não fixa limite): verificado como pilar.`);
  if (isCol) {
    if (!(member.le > 0 || member.lez > 0 || member.ley > 0) && (member.Ldefault || member.L == null)) {
      naoVerificado = true; avisos.push('Pilar sem le e sem comprimento da barra: 2ª ordem NÃO verificada.');
    }
    if (!(member.le > 0 || member.lez > 0 || member.ley > 0)) {
      avisos.push(`Pilar sem comprimento equivalente (member.le): adotado le = L = ${(member.L || 1).toFixed(2)} m${member.L ? '' : ' (L não informado: valor padrão)'} e αb = 1,0 — NÃO conservador para balanço (le = 2L) ou nós móveis; informe le (15.6).`);
    }
    member = { ...member, le: member.le ?? member.L ?? 1 };
    const bmin = Math.min(b, h);
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

  // d = depth of the CENTROID of the tension reinforcement (17.2.4.1); layers below mid-depth
  const tens = layers.filter(L => L.dy > h / 2);
  const dTens = tens.length ? tens.reduce((s, L) => s + L.As * L.dy, 0) / tens.reduce((s, L) => s + L.As, 0)
    : (hasBars ? Math.max(...layers.map(L => L.dy)) : h - cover);
  const d = sec.d ?? dTens;
  if (hasBars && !pilar) {
    const top = layers.filter(L => L.dy <= h / 2).reduce((s, L) => s + L.As, 0), bot = tens.reduce((s, L) => s + L.As, 0);
    if (Math.abs(top - bot) > 0.05 * Math.max(top, bot)) avisos.push('Armadura assimétrica: verificação com a face de maior d tracionada (layers medidos da fibra comprimida); o momento de sentido oposto exige outro arranjo de camadas.');
  }
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
  // ductility of the GIVEN reinforcement (14.6.4.3 / 17.2.3) — beams (no compression)
  if (hasBars && !pilar) {
    const xg = neutralAxis(b, h, sigcd, P.lambda, P.ecu, fydK, layers, Math.max(NcD, 0));
    flexao.xdArmadura = +(xg / d).toFixed(4);
    if (xg / d > P.xdLim + 1e-9) {
      flexao.ratio = Infinity;
      avisos.push(`Ductilidade: x/d = ${(xg / d).toFixed(3)} > ${P.xdLim} com a armadura dada (14.6.4.3) — reduza a armadura de tração ou use armadura de compressão.`);
    }
  }

  // minimum / maximum longitudinal steel (17.3.5.2.1 / 17.3.5.2.4)
  const fctksup = 1.3 * P.fctm;
  const W0 = b * h * h / 6;
  const MdMin = 0.8 * W0 * fctksup * 1000;
  const asMin = Math.max(requiredAs(MdMin, b, d, dl, sigcd, P.lambda, P.ecu, fydK, P.xdLim).asNec, 0.0015 * A);
  const asTrac = hasBars ? layers.filter(L => L.dy > h / 2).reduce((s, L) => s + L.As, 0) : 0;
  if (hasBars && asTrac < asMin - 1e-12) avisos.push(`As tracionada ${(asTrac * 1e4).toFixed(2)} cm² < As,mín ${(asMin * 1e4).toFixed(2)} cm² (17.3.5.2.1).`);
  if (hasBars && !pilar && rl.Ast > 0.04 * A) avisos.push(`As total ${(rl.Ast * 1e4).toFixed(2)} cm² > 4 % Ac (17.3.5.2.4).`);
  if (req.dupla) avisos.push(`x/d acima de ${P.xdLim}: armadura dupla necessária (14.6.4.3).`);
  flexao.asMin = asMin;

  // ── weak axis bending (My) ───────────────────────────────────────────────────
  // bar positions across the width are needed for the weak axis: reb.layersY [{n,dia,d}|{As,d}]
  // with d measured from the compressed face in the y direction
  // or derived when every strong-axis layer gives its bar count (n bars spread evenly across b)
  let MRdy = 0;
  let lY = Array.isArray(reb.layersY) ? rebarLayers({ layers: reb.layersY }, b, h, cover, 0).layers.filter(L => L.As > 0) : [];
  if (!lY.length) lY = deriveLayersY(reb, b, cover);
  if (lY.length) MRdy = pmMomentAt(nbrDiagram(h, b, sigcd, P.lambda, P.ecu, P.ec2, fydK, lY), NcD);
  const flexaoY = ratObj(MyD, MRdy, { eixo: 'fraco (My = Msd,y)' });
  if (MyD > 1e-9 && !lY.length) { flexaoY.ratio = Infinity; avisos.push('My ≠ 0 sem posição das barras no eixo fraco (rebar.layersY): flexão em y NÃO verificada.'); }
  if (MyD <= 1e-9) flexaoY.ratio = 0;

  // ── axial ────────────────────────────────────────────────────────────────────
  let axial;
  if (N < 0) {
    const NRd = 0.85 * P.etac * P.fcd * 1000 * (A - rl.Ast) + Math.min(fydK, ES * 0.002) * rl.Ast;   // εc2 = 2 ‰
    axial = ratObj(NcD, NRd, { modo: 'compressão', formula: 'NRd = 0,85·ηc·fcd·Ac + σs(εc2)·As' });
  } else {
    axial = ratObj(N, fydK * rl.Ast, { modo: 'tração', formula: 'NRd = fyd·As' });
  }

  // ── N + M interaction ────────────────────────────────────────────────────────
  let interaction;
  if (!hasBars) interaction = ratObj(Infinity, 1, { adim: true, formula: 'não verificado (sem barras)' });
  else if (MyD > 1e-9 && MzD > 1e-9) {
    const al = 1.2;                                                 // 17.2.5, rectangular section
    const r = (MRd > 1e-12 && MRdy > 1e-12) ? Math.pow(MzD / MRd, al) + Math.pow(MyD / MRdy, al) : Infinity;
    interaction = ratObj(r, 1, { adim: true, modo: 'flexão oblíqua', formula: '(MSd,x/MRd,xx)^1,2 + (MSd,y/MRd,yy)^1,2 ≤ 1 (17.2.5)' });
  } else if (MzD <= 1e-9) {
    // pure axial: the radial ray does not cross the polygon away from M = 0
    const Pmax = Math.max(...diag.pts.map(p => p.P)), Pmin = Math.min(...diag.pts.map(p => p.P));
    interaction = ratObj(NcD >= 0 ? NcD / Pmax : NcD / Pmin, 1, { adim: true, modo: 'axial', formula: 'NSd/NRd (diagrama, M = 0)' });
  } else {
    interaction = ratObj(pmRatio(diag, NcD, MzD), 1, { adim: true, modo: Nc >= 0 ? 'flexo-compressão' : 'flexo-tração',
      formula: 'diagrama N–M por compatibilidade (17.2.2)' });
  }

  // ── shear ────────────────────────────────────────────────────────────────────
  const modelo = options.modeloCortante === 'II' ? 'II' : 'I';
  const theta = modelo === 'II' ? Math.min(Math.max(options.theta ?? 45, 30), 45) : 45;
  const alpha = options.alpha ?? 90;
  // tension with small eccentricity (e = M/N inside the bars): neutral axis outside → Vc = 0 (17.4.2.2-b)
  const vcZero = N > 0 && (Mz / N) <= Math.max(d - h / 2, 0);
  const vcZeroZ = N > 0 && (My / N) <= Math.max(b / 2 - cover, 0);       // plane of Vz: e = My/N
  if (vcZero) avisos.push('Tração com pequena excentricidade (LN fora da seção): Vc = 0 (17.4.2.2-b).');
  const VyD = gn * Vy, VzD = gn * Vz;
  const sv = shearCheck({ VSd: VyD, bw: b, d, fck, fcd: P.fcd, fctm: P.fctm, fyd, fywk: fyk, gc, stir, modelo, thetaDeg: theta, alphaDeg: alpha, N, vcZero });
  const capV = Math.min(sv.VRd2, sv.VRd3);
  const cortante = ratObj(VyD, capV, { dir: 'Vy', modelo: sv.modelo, VRd2: sv.VRd2, Vc: sv.Vc, Vsw: sv.Vsw, VRd3: sv.VRd3,
    aswNec: sv.aswNec, aswMin: sv.aswMin, theta, formula: modelo === 'II' ? 'Modelo II (17.4.2.3)' : 'Modelo I (17.4.2.2)' });
  if (!sv.aswS) avisos.push('Sem estribos informados: VRd3 = Vc; a NBR exige armadura transversal mínima (17.4.1.1.1).');
  else if (sv.aswS < sv.aswMin - 1e-12) avisos.push('Armadura transversal abaixo da mínima ρsw,mín = 0,2·fct,m/fywk (17.4.1.1.1).');
  if (N < 0) avisos.push('Flexo-compressão: Vc tomado sem o acréscimo (1 + M0/MSd,máx) — conservador (17.4.2.2-b).');
  const dz = b - cover;
  const svz = shearCheck({ VSd: VzD, bw: h, d: dz, fck, fcd: P.fcd, fctm: P.fctm, fyd, fywk: fyk, gc, stir: null, modelo, thetaDeg: theta, alphaDeg: alpha, N, vcZero: vcZeroZ });
  const corteZ = ratObj(VzD, Math.min(svz.VRd2, svz.VRd3), { dir: 'Vz', modelo: svz.modelo });

  // ── torsion (17.5.1 / 17.7.2) ────────────────────────────────────────────────
  let torcao = null;
  const TSd = gn * Math.abs(demands.T || 0);
  if (TSd > 1e-6 && options.torcaoCompatibilidade) {
    avisos.push('Torção de compatibilidade desprezada por opção do projeto (17.5.1.2): exige capacidade de adaptação plástica e os demais esforços calculados sem ela.');
    if (VyD > 0.7 * sv.VRd2) avisos.push(`Torção de compatibilidade: VSd = ${VyD.toFixed(1)} kN > 0,7·VRd2 = ${(0.7 * sv.VRd2).toFixed(1)} kN — em trechos de comprimento ≤ 2h isso NÃO é permitido (17.5.1.2), além da armadura mínima de torção.`);
    else avisos.push('Torção de compatibilidade: em trechos de comprimento ≤ 2h respeitar a armadura mínima de torção (17.5.1.2); VSd ≤ 0,7·VRd2 atendido.');
  }
  const fywdT = Math.min(fyd, 435);
  const t = TSd > 1e-6 && !options.torcaoCompatibilidade ? torsionCheck({ TSd, b, h, c1: cover, fck, fcd: P.fcd, fywd: fywdT, theta }) : null;
  if (TSd > 1e-6 && !options.torcaoCompatibilidade && !t) { naoVerificado = true; avisos.push('Torção: seção com b ou h ≤ 2·c1 — seção vazada equivalente inválida, NÃO verificado.'); }
  if (t) {
    // 17.7.2.2 with the concomitant shears (Vz added too — conservative for biaxial shear)
    const inter = VyD / sv.VRd2 + VzD / svz.VRd2 + TSd / t.TRd2;
    const rhoMin = 0.2 * P.fctm / Math.min(fyk, 500);                              // 17.5.1.2: ρsl = ρsw ≥ 0,2·fct,m/fywk
    t.aslNec = Math.max(t.aslNec, rhoMin * t.he * t.ue);
    const legs = stir ? (+stir.legs || 2) : 2;
    const legS = sv.aswS / legs;                                                   // provided, one leg (m²/m)
    // peripheral leg: shear part shared by all legs + torsion (one wall, 17.5.1.6); total ≥ ρsw,mín·bw (17.5.1.2)
    const legNec = Math.max(Math.max(VyD - sv.Vc, 0) / sv.kSw / legs + t.a90Nec, sv.aswMin / legs);
    const rTransv = legS > 0 ? legNec / legS : Infinity;                           // 17.7.2.3 (sum V + T)
    const aslProv = reb.Asl_torcao_cm2 != null ? reb.Asl_torcao_cm2 / 1e4 : null;
    const rLong = aslProv != null ? (aslProv > 0 ? t.aslNec / aslProv : Infinity) : Infinity;
    if (aslProv == null) avisos.push(`Torção: armadura longitudinal de torção não informada (rebar.Asl_torcao_cm2) — necessária As,l = ${(t.aslNec * 1e4).toFixed(2)} cm² ao longo de ue = ${t.ue.toFixed(3)} m, ACRESCIDA à de flexão no banzo tracionado (17.7.1.2). NÃO verificado.`);
    if (!stir) avisos.push('Torção: sem estribos informados — TRd3 = 0 (estribos periféricos fechados obrigatórios, 17.5.1.2).');
    if (b * h / (2 * (b + h)) < 2 * cover) avisos.push(`Torção: A/u < 2c1 — ${t.regra} (17.5.1.4.1).`);
    torcao = { demand: +TSd.toFixed(4), capacity: +t.TRd2.toFixed(4), ratio: +Math.max(inter, rTransv, rLong).toFixed(4),
      TRd2: +t.TRd2.toFixed(3), interacaoVT: +inter.toFixed(4), razaoEstribos: +rTransv.toFixed(4), razaoLongitudinal: isFinite(rLong) ? +rLong.toFixed(4) : null,
      he: +t.he.toFixed(4), Ae: +t.Ae.toFixed(5), ue: +t.ue.toFixed(4), a90Nec: t.a90Nec, aslNec: t.aslNec, theta,
      formula: 'VSd/VRd2 + TSd/TRd2 ≤ 1 (17.7.2.2); estribos V + T (17.7.2.3); TRd4 com As,l (17.5.1.5-b)' };
    if (theta !== 45 && modelo === 'I') avisos.push('Modelo I: θ = 45° também na torção (17.7.2.1).');
    if (alpha !== 90) avisos.push('Torção: os estribos de torção devem ser verticais, normais ao eixo (17.5.1.2) — α ≠ 90° não serve à torção.');
    if (VzD > 0) avisos.push('Torção: Vz concomitante somado na interação 17.7.2.2 (conservador).');
  }

  if (pilar && !(pilar.z.ok && pilar.y.ok)) { flexao.ratio = Infinity; interaction.ratio = Infinity; }
  if (naoVerificado) for (const o of [flexao, flexaoY, interaction, cortante, corteZ, axial, torcao].filter(Boolean)) o.ratio = Infinity;
  const bending = flexao.ratio >= flexaoY.ratio ? flexao : flexaoY;
  const shear = [cortante, corteZ, torcao].filter(Boolean).reduce((a, c) => c.ratio > a.ratio ? c : a);
  return finalize({ material: 'concreto', metodo: 'ABNT NBR 6118:2026', axial, bending, shear, interaction,
    flexao, flexaoY, cortante, corteZ, torcao, pilar, avisos, diagrama: diag ? { pts: diag.pts, Pu: Nc, Mu: Mz } : null }, options);
}

export const nbr6118 = {
  id: 'NBR6118:2026', family: 'concrete', label: 'ABNT NBR 6118:2026',
  check: (input) => checkNBR6118(input),
};

// ── ELS helpers (17.3) — pure functions for post-processing; MPa / m / kN·m ─────
// Mr = α·fct·Ic/yt (17.3.1): α = 1,5 rectangular, 1,3 I/T inverted, 1,2 T/double T;
// fct = fct,m for deflection (17.3.2) and fctk,inf = 0,7·fct,m for crack formation.
export function crackingMoment({ b, h, fck, alpha = 1.5, para = 'flecha', barrasLisas = false }) {
  const fctm = concreteParams(fck).fctm;
  const fct = para === 'flecha' ? fctm : 0.7 * fctm;
  const Ic = b * h ** 3 / 12, yt = h / 2;
  const Mr = alpha * fct * 1000 * Ic / yt;                         // kN·m
  return barrasLisas ? Mr / 2 : Mr;                                // 17.3.2.1.1: Mr/2 with plain bars
}
// Cracked (stage II) inertia of a rectangular section, αe = Es/Ecs (17.3.2.1.1). Compression steel
// with (αe − 1) (displaced concrete) — homogenized section, neutral axis by first moments.
export function stage2Inertia({ b, d, As, AsLinha = 0, dLinha = 0, alphaE }) {
  const a = b / 2, bq = alphaE * As + (alphaE - 1) * AsLinha, c = -(alphaE * As * d + (alphaE - 1) * AsLinha * dLinha);
  const x = (-bq + Math.sqrt(bq * bq - 4 * a * c)) / (2 * a);
  return { x, III: b * x ** 3 / 3 + alphaE * As * (d - x) ** 2 + (alphaE - 1) * AsLinha * (x - dLinha) ** 2 };
}
// Branson (17.3.2.1.1): (EI)eq = Ecs·{(Mr/Ma)³·Ic + [1 − (Mr/Ma)³]·III} ≤ Ecs·Ic
export function equivalentStiffness({ Ecs, Ic, III, Mr, Ma }) {
  const r3 = Ma > 0 ? Math.min((Mr / Ma) ** 3, 1) : 1;
  return Math.min(Ecs * (r3 * Ic + (1 - r3) * III), Ecs * Ic);
}
// Creep of the deflection (17.3.2.1.2): αf = Δξ/(1 + 50ρ'), ξ(t) = 0,68·0,996^t·t^0,32 (t ≤ 70 months), 2 beyond
export function xiTime(tMonths) { return tMonths > 70 ? 2 : 0.68 * 0.996 ** tMonths * tMonths ** 0.32; }
export function creepFactor({ t0, t = 1e9, rhoLinha = 0 }) { return (xiTime(t) - xiTime(t0)) / (1 + 50 * rhoLinha); }
// Crack width (17.3.3.2): wk = min of the two expressions (φ in mm, σs and fct,m in MPa, result in mm)
export function crackWidth({ phi, eta1 = 2.25, sigmaS, fctm, rhoR, Es = 210000 }) {
  const w1 = phi / (12.5 * eta1) * (sigmaS / Es) * (3 * sigmaS / fctm);
  const w2 = phi / (12.5 * eta1) * (sigmaS / Es) * (4 / rhoR + 45);
  return Math.min(w1, w2);
}
// Tab. 13.4: reinforced concrete, frequent combination — CAA I 0,4; II and III 0,3; IV 0,2 mm
export function crackLimit(caa) { return ({ I: 0.4, II: 0.3, III: 0.3, IV: 0.2 })[String(caa).toUpperCase()] ?? null; }
