// connections_weld.js — welded connections and weld groups, NBR 8800:2024 §6 (6.2: Tab. 9, 6.2.5.2-a/b/c, 6.2.6) and
// the elements of 6.5. Units: mm, MPa, N internally; kN, kN·m in inputs/outputs.
//  · weldElastic       — elastic (vector) method of a fillet-weld group: in-plane V and torsion; out-of-plane N and M
//                        (literature, decisão B: Saulo J. C. Almeida, Especialização INBEC 2016, Mód. 12 "Ligações II",
//                        Parte 2_C, Aplicações 8 e 9 — the weld metal 0,6·fw/γw2 is the Tab. 9 one, unchanged in 2024);
//  · weldICR           — instantaneous centre of rotation, 6.2.5.2-b (same model as AISC 360 J2.4; checked against
//                        AISC Manual 16th ed. Table 8-8 coefficients C);
//  · baseColumnWeld    — weld column → base plate (6.7.1.3: "dimensionada conforme esta Norma"): flanges + web fillets,
//                        elastic out-of-plane method (B);
//  · gussetChordWeld   — weld gusset plate → chord: resultant of the members at the node, eccentricity neglected as in
//                        Fakury, Silva e Caldas 2017, 10.14.3 (B); plate shear along the weld 6.5.5;
//  · lcspConnection    — viga–pilar flexível: 2 cantoneiras SOLDADAS na viga (filete em C, centro instantâneo) e
//                        parafusadas no suporte (Manual Gerdau "Ligações para estruturas de aço", NBR 8800:2024, LCSP 3.4.2);
//  · copedChecks       — beam with cope(s): 6.5.5, 6.5.6, flexural yielding and local web buckling of the coped section
//                        (Gerdau 3.4.2 after AISC 13th ed. p.9-7a — the NBR has no clause: LACUNA → B).
import * as C from './connections.js?v=7';

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const kN = (N) => N / 1000;
const qWeld = (dw, fw) => 0.6 * 0.707 * dw * fw / C.GAMMA.w2;          // N/mm of one fillet (Tab. 9 weld metal)

/* ------------------------------------------------------------------------------------------------ elastic group */
/** lines [{x1,y1,x2,y2, a (throat, mm)}]; returns section properties of the weld group (per throat) */
export function weldGroupProps(lines) {
  lines = lines.filter((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 1e-9);
  let A = 0, Sx = 0, Sy = 0;
  for (const l of lines) { const L = Math.hypot(l.x2 - l.x1, l.y2 - l.y1); l.L = L; A += l.a * L; Sx += l.a * L * (l.x1 + l.x2) / 2; Sy += l.a * L * (l.y1 + l.y2) / 2; }
  const xc = Sx / A, yc = Sy / A;
  const I = (f1, f2) => (f1 * f1 + f1 * f2 + f2 * f2) / 3;             // ∫ f² ds / L for linear f
  let Ix = 0, Iy = 0;
  for (const l of lines) { Ix += l.a * l.L * I(l.y1 - yc, l.y2 - yc); Iy += l.a * l.L * I(l.x1 - xc, l.x2 - xc); }
  return { A, xc, yc, Ix, Iy, Ip: Ix + Iy };
}
/** in-plane loads at the centroid: Vx, Vy (N), T (N·mm, counter-clockwise). Max resultant stress (MPa) at the line ends. */
export function weldElastic(lines, { Vx = 0, Vy = 0, T = 0 }) {
  lines = lines.filter((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 1e-9);
  const g = weldGroupProps(lines);
  let best = null;
  for (const l of lines) for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {
    const dx = x - g.xc, dy = y - g.yc, tx = Vx / g.A - T * dy / g.Ip, ty = Vy / g.A + T * dx / g.Ip, f = Math.hypot(tx, ty);
    if (!best || f > best.f) best = { f, x, y, tx, ty };
  }
  return { ...g, ...best };
}
/** out-of-plane: normal N (N, + tension), Mx (N·mm, about the x axis through the centroid → σ ∝ y), in-plane shear Vy carried
 *  by the lines of `vLines` (indices; default all). Max √(σ² + τ²) (MPa). */
export function weldOutOfPlane(lines, { N = 0, Mx = 0, Vy = 0, vLines = null }) {
  const g = weldGroupProps(lines);
  const Av = (vLines ? vLines.map((i) => lines[i]) : lines).reduce((s, l) => s + l.a * l.L, 0), tau = Vy / Av;
  let best = null;
  lines.forEach((l, i) => { for (const y of [l.y1, l.y2]) {
    const s = N / g.A + Mx * (y - g.yc) / g.Ix, t = !vLines || vLines.includes(i) ? tau : 0, f = Math.hypot(s, t);
    if (!best || f > best.f) best = { f, s, t, y }; } });
  return { ...g, Av, tau, ...best };
}

/* ------------------------------------------------------------------------------------------------ ICR (6.2.5.2-b) */
/** lines [{x1,y1,x2,y2, dw (leg, mm)}], vertical load P (downward) at x = xP (y irrelevant). Returns the resistance Rd
 *  (N) = P that the group carries by the instantaneous centre method of 6.2.5.2-b, with fw (MPa) and γw2. */
export function weldICR(lines, { xP, fw, gamma = C.GAMMA.w2, nSeg = 60 }) {
  const el = [];
  for (const l of lines.filter((q) => Math.hypot(q.x2 - q.x1, q.y2 - q.y1) > 1e-9)) {
    const L = Math.hypot(l.x2 - l.x1, l.y2 - l.y1), ux = (l.x2 - l.x1) / L, uy = (l.y2 - l.y1) / L;
    for (let i = 0; i < nSeg; i++) { const s = (i + 0.5) / nSeg; el.push({ x: l.x1 + (l.x2 - l.x1) * s, y: l.y1 + (l.y2 - l.y1) * s, L: L / nSeg, dw: l.dw, ux, uy }); }
  }
  const Lt = el.reduce((s, e) => s + e.L, 0), xc = el.reduce((s, e) => s + e.x * e.L, 0) / Lt, yc = el.reduce((s, e) => s + e.y * e.L, 0) / Lt;
  // the IC is searched on the horizontal through the centroid: valid for groups symmetric about it (C, box, AISC 8-x)
  const Ixy = el.reduce((s, e) => s + (e.x - xc) * (e.y - yc) * e.L, 0), Ixx = el.reduce((s, e) => s + (e.y - yc) ** 2 * e.L, 0) || 1;
  const assimetrico = Math.abs(Ixy) > 1e-6 * Ixx;
  const ex = xP - xc, sideP = Math.sign(ex) || 1;
  const forces = (r0) => {
    // IC on the horizontal through the centroid, on the side opposite to the load
    const xi = xc - sideP * r0, yi = yc;
    const d = el.map((e) => { const rx = e.x - xi, ry = e.y - yi, r = Math.hypot(rx, ry); return { e, rx, ry, r }; }).filter((q) => q.r > 1e-9);
    for (const q of d) {
      const fx = -q.ry / q.r, fy = q.rx / q.r;                           // unit force ⊥ r (rotation about the IC)
      const c = Math.min(1, Math.abs(fx * q.e.ux + fy * q.e.uy)), th = Math.acos(c) * 180 / Math.PI;   // angle force ↔ weld axis
      q.th = th; q.fx = fx; q.fy = fy;
      q.du = Math.min(1.087 * (th + 6) ** -0.65 * q.e.dw, 0.17 * q.e.dw);
      q.dm = 0.209 * (th + 2) ** -0.32 * q.e.dw;
    }
    const kcr = Math.min(...d.map((q) => q.du / q.r));
    let Fy = 0, M = 0;
    for (const q of d) {
      const p = Math.min(1, kcr * q.r / q.dm), f = (p * (1.9 - 0.9 * p)) ** 0.3;
      const R = 0.6 * fw / gamma * 0.707 * q.e.dw * q.e.L * (1 + 0.5 * Math.sin(q.th * Math.PI / 180) ** 1.5) * f;
      Fy += R * q.fy; M += R * q.r;
    }
    return { Fy: Math.abs(Fy), M, arm: Math.abs(ex) + r0 };
  };
  if (Math.abs(ex) < 1e-6) {                                            // concentric: every element at θ = angle with vertical
    const R = el.reduce((s, e) => { const th = Math.acos(Math.min(1, Math.abs(e.uy))) * 180 / Math.PI; return s + 0.6 * fw / gamma * 0.707 * e.dw * e.L * (1 + 0.5 * Math.sin(th * Math.PI / 180) ** 1.5); }, 0);
    return { Rd: R, r0: Infinity, ex: 0, xc, yc, assimetrico };
  }
  // bisection on r0: P from the moment = P from the vertical force equilibrium
  let lo = 1e-3, hi = 1e6, g = (r0) => { const f = forces(r0); return f.M / f.arm - f.Fy; };
  let glo = g(lo), ghi = g(hi);
  for (let i = 0; i < 200 && glo * ghi > 0; i++) { hi *= 2; ghi = g(hi); }
  for (let i = 0; i < 120; i++) { const mid = Math.sqrt(lo * hi), gm = g(mid); if (gm * glo > 0) { lo = mid; glo = gm; } else hi = mid; if (hi / lo < 1 + 1e-9) break; }
  const f = forces(Math.sqrt(lo * hi));
  return { Rd: f.M / f.arm, r0: Math.sqrt(lo * hi), ex, xc, yc, assimetrico };
}
/** C-shaped fillet group: vertical line of length l at x = 0, two horizontal lines of length kl toward +x (AISC Table 8-8) */
export const cShape = (l, kl, dw) => [
  { x1: 0, y1: -l / 2, x2: 0, y2: l / 2, dw }, { x1: 0, y1: l / 2, x2: kl, y2: l / 2, dw }, { x1: 0, y1: -l / 2, x2: kl, y2: -l / 2, dw }];

/* ------------------------------------------------------------------------------------------------ weld limits */
function weldDetailing(checks, { dw, tmin, tEdge = null, L = null, G = 'Disposições construtivas', avisos = null }) {
  const dmin = C.filletMin8800(tmin);
  checks.push(C.det(G, 'Perna mínima do filete (Tab. 11)', '6.2.6.2.1', `dw = ${nf(dw, 1)} ≥ ${nf(dmin, 1)} mm (menor espessura ${nf(tmin, 2)} mm)`, dw, dmin, 'min'));
  if (tEdge) {
    const dmax = C.filletMaxEdge8800(tEdge);
    if (dw > dmax && tEdge >= 6.3 && dw <= tEdge + 1e-9) {
      // Tab. 11 minimum above the edge maximum (e.g. t = 6,4: mínimo 5, máximo 4,9) — 6.2.6.2.2-b admits it when the weld is
      // indicated on the drawings as built up ("reforçada") to the full throat
      checks.push({ g: G, nome: 'Perna ao longo de borda: solda indicada como reforçada', ref: '6.2.6.2.2-b', info: true, eq: `dw = ${nf(dw, 1)} > t − 1,5 = ${nf(dmax, 1)} mm — admitido pela 6.2.6.2.2-b com a solda indicada nos desenhos como reforçada durante a execução` });
      avisos?.push(`Indicar nos desenhos o filete de ${nf(dw, 1)} mm ao longo da borda de ${nf(tEdge, 2)} mm como "reforçado durante a execução" (6.2.6.2.2-b).`);
    } else checks.push(C.det(G, 'Perna máxima ao longo de borda', '6.2.6.2.2', `dw = ${nf(dw, 1)} ≤ ${nf(dmax, 1)} mm`, dw, dmax, 'max'));
  }
  if (L) checks.push(C.det(G, 'Comprimento mínimo do filete', '6.2.6.2.3', `L = ${nf(L, 0)} ≥ máx(4dw; 40) = ${nf(Math.max(4 * dw, 40), 0)} mm`, L, Math.max(4 * dw, 40), 'min'));
}

/* ------------------------------------------------------------------------------------------------ (1) column → base plate */
/** pilar {d, bf, tw, tf, fy}, tp (base plate), dw, eletrodo, N (kN, + compression on the base), M (kN·m, major axis), V (kN) */
export function baseColumnWeld({ pilar: P, tp, dw, eletrodo = 'E70', N = 0, M = 0, V = 0, contato = false }) {
  const checks = [], avisos = [];
  const fw = C.ELECTRODES[eletrodo], a = 0.707 * dw, { d, bf, tw, tf } = P, hw = d - 2 * tf;
  const ye = d / 2, yi = d / 2 - tf, bi = (bf - tw) / 2;
  const lines = [
    { x1: -bf / 2, y1: ye, x2: bf / 2, y2: ye, a }, { x1: -bf / 2, y1: -ye, x2: bf / 2, y2: -ye, a },                 // flanges, outside
    { x1: -bf / 2, y1: yi, x2: -tw / 2, y2: yi, a }, { x1: tw / 2, y1: yi, x2: bf / 2, y2: yi, a },                   // flanges, inside
    { x1: -bf / 2, y1: -yi, x2: -tw / 2, y2: -yi, a }, { x1: tw / 2, y1: -yi, x2: bf / 2, y2: -yi, a },
    { x1: -tw / 2, y1: -yi, x2: -tw / 2, y2: yi, a }, { x1: tw / 2, y1: -yi, x2: tw / 2, y2: yi, a },                 // web, both sides
  ];
  const Nw = contato && N > 0 ? 0 : N * 1000;                            // compression by contact (6.1.6.1, milled end): weld keeps the parts in place
  const r = weldOutOfPlane(lines, { N: -Nw, Mx: Math.abs(M) * 1e6, Vy: Math.abs(V) * 1000, vLines: [6, 7] });
  const fRd = 0.6 * fw / C.GAMMA.w2;
  checks.push({ ...C.chk('Solda pilar–placa de base', 'Filetes em todo o contorno — método elástico (N, M no eixo forte, V na alma)', 'Tab. 9; 6.7.1.3; Saulo Almeida (INBEC, Mód. 12) — método elástico',
    `garganta a = 0,707·${nf(dw, 1)} = ${nf(a, 2)} mm; Aw = ${nf(r.A, 0)} mm², Ix = ${nf(r.Ix / 1e4, 0)} cm⁴; σ = ${contato && N > 0 ? '0 (compressão por contato, 6.1.6)' : `N/Aw`} ± M·y/Ix = ${nf(r.s, 1)} MPa; τ = V/Aw,alma = ${nf(r.tau, 1)} MPa; f = √(σ² + τ²) = ${nf(r.f, 1)} MPa ≤ 0,6·fw/γw2 = 0,6·${nf(fw, 0)}/1,35 = ${nf(fRd, 1)} MPa`, r.f, fRd), Sd: r.f, Rd: fRd, un: 'MPa' });
  // base metal (6.5): web shear along the welds, flange in tension
  const sw = C.shearElement8800({ Agv: hw * tw, Anv: hw * tw, fy: P.fy, fu: P.fu ?? 400 });
  checks.push(C.chk('Solda pilar–placa de base', 'Metal-base: alma do pilar ao longo dos filetes', 'Tab. 9 → 6.5.5', `Agv = hw·tw = ${nf(hw * tw, 0)} mm²; ${sw.eq}`, Math.abs(V) * 1000, sw.R));
  weldDetailing(checks, { dw, tmin: Math.min(tf, tp), L: bi });
  if (contato && N > 0) avisos.push('Compressão transmitida por contato (extremidade usinada, 6.1.6.1): a solda mantém as partes em posição; a tração e o momento vão para a solda.');
  return { ...C.summarize(checks, avisos), geo: { pilar: P, dw } };
}

/* ------------------------------------------------------------------------------------------------ (2) gusset → chord */
/** F = { Fpar, Fperp } (kN, resultant of the members at the node in the chord direction and perpendicular), dw, L (each of the
 *  two fillets, mm), tg, tc (chord element thickness), gusset fy/fu, eletrodo. */
export function gussetChordWeld({ Fpar, Fperp = 0, dw, L, tg, tc, fy, fu, eletrodo = 'E70', fuChord = 400 }) {
  const checks = [], avisos = [];
  const fw = C.ELECTRODES[eletrodo], R = Math.hypot(Fpar, Fperp) * 1000, tmin = Math.min(tg, tc);
  if (tmin <= 4.75) {
    const t = tmin, fuMin = Math.min(fu, fuChord), r = C.fillet14762({ L, t, w: dw, fu: fuMin, fw, dir: 'paralela' });
    checks.push(C.chk('Solda chapa de nó–banzo', `2 filetes ${nf(dw, 1)} × ${nf(L, 0)} mm (NBR 14762, resultante tomada como paralela)`, 'NBR 14762 10.2.3-a; Fakury 10.14.3 (excentricidade desprezada)',
      `F = √(F∥² + F⊥²) = √(${nf(Fpar)}² + ${nf(Fperp)}²) = ${nf(kN(R))} kN; por filete: ${r.eq}; total = 2·${nf(kN(r.R))} kN`, R, 2 * r.R));
  } else {
    const q = qWeld(dw, fw), Aw = 2 * 0.707 * dw * L, tau = R / Aw, tRd = 0.6 * fw / C.GAMMA.w2;
    checks.push({ ...C.chk('Solda chapa de nó–banzo', `2 filetes ${nf(dw, 1)} × ${nf(L, 0)} mm`, 'Tab. 9; Fakury 10.14.3 (excentricidade desprezada, decisão B)',
      `F = √(F∥² + F⊥²) = √(${nf(Fpar)}² + ${nf(Fperp)}²) = ${nf(kN(R))} kN; Aw = 2·0,707·${nf(dw, 1)}·${nf(L, 0)} = ${nf(Aw, 0)} mm²; τ = ${nf(tau, 1)} MPa ≤ 0,6·${nf(fw, 0)}/1,35 = ${nf(tRd, 1)} MPa (${nf(q * 2 * L / 1000, 1)} kN)`, tau, tRd), Sd: tau, Rd: tRd, un: 'MPa' });
    weldDetailing(checks, { dw, tmin, L });
  }
  const sh = C.shearElement8800({ Agv: L * tg, Anv: L * tg, fy, fu });
  checks.push(C.chk('Solda chapa de nó–banzo', 'Cisalhamento da chapa de nó ao longo da solda', '6.5.5 (Fakury 10.14.3, linha 2)', `Agv = Anv = L·tg = ${nf(L, 0)}·${nf(tg, 2)}; ${sh.eq}`, Math.abs(Fpar) * 1000, sh.R));
  avisos.push('Seção vertical da chapa de nó entre as diagonais (Fakury 10.14.3, linha 1) depende da geometria da chapa: verificar à parte.');
  return { ...C.summarize(checks, avisos), geo: { dw, L, tg } };
}

/* ------------------------------------------------------------------------------------------------ (6) coped beam */
/** recorte { n: 1 | 2, Lh, Lv }, viga { d, bf, tf, tw, fy, fu }; bolted web (Np rows, s, ya top → 1st bolt, ebv bolt line → beam
 *  end, dn hole + 2) or welded (null). V (N). Pushes checks. Formulas: Gerdau 3.4.2 (NBR 8800:2024) after AISC 13th ed. */
export function copedChecks(checks, avisos, { recorte: R, viga: Vg, V, bolts = null }) {
  const G = `Viga recortada (${R.n} recorte${R.n > 1 ? 's' : ''}, Lh = ${nf(R.Lh, 0)}, Lv = ${nf(R.Lv, 0)} mm)`;
  const { d: H, tw, tf, bf } = Vg, hr = H - R.n * R.Lv;
  const sh = C.shearElement8800({ Agv: hr * Vg.tw, Anv: (hr - (bolts ? bolts.n * bolts.dn : 0)) * tw, fy: Vg.fy, fu: Vg.fu });
  checks.push(C.chk(G, 'Cisalhamento da alma recortada', '6.5.5', `h = H − ${R.n}·Lv = ${nf(hr, 0)} mm; Agv = ${nf(hr * tw, 0)}, Anv = ${nf((hr - (bolts ? bolts.n * bolts.dn : 0)) * tw, 0)} mm²; ${sh.eq}`, V, sh.R));
  if (bolts) {
    const Agv = ((bolts.n - 1) * bolts.s + bolts.ya - R.Lv) * tw, Anv = Agv - (bolts.n - 0.5) * bolts.dn * tw, Ant = (bolts.ebv - 0.5 * bolts.dn) * tw;
    const bk = C.blockShear8800({ Agv, Anv, Ant, fy: Vg.fy, fu: Vg.fu, Cts: 1 });
    checks.push(C.chk(G, 'Colapso por rasgamento da alma recortada', '6.5.6; Gerdau 3.4.2', `Agv = [(Np − 1)·s + ya − Lv]·tw = ${nf(Agv, 0)}, Anv = ${nf(Anv, 0)}, Ant = (ebv − 0,5·dh')·tw = ${nf(Ant, 0)} mm²; ${bk.eq}`, V, bk.R));
  }
  // section modulus of the coped section (1 cope: tee = web + bottom flange; 2 copes: web rectangle)
  let W, h0;
  if (R.n === 1) {
    h0 = H - R.Lv; const hwr = h0 - tf, Af = bf * tf, Aw = hwr * tw, A = Af + Aw;
    const yb = (Af * tf / 2 + Aw * (tf + hwr / 2)) / A, I = bf * tf ** 3 / 12 + Af * (yb - tf / 2) ** 2 + tw * hwr ** 3 / 12 + Aw * (tf + hwr / 2 - yb) ** 2;
    W = I / Math.max(yb, h0 - yb);
  } else { h0 = H - 2 * R.Lv; W = tw * h0 * h0 / 6; }
  const arm = R.Lh + 10;                                                   // Gerdau: Lh + 1,0 cm (cope + 10 mm gap)
  const My = W * Vg.fy / C.GAMMA.a1 / arm;
  checks.push(C.chk(G, 'Escoamento por flexão da seção recortada', 'Gerdau 3.4.2 (decisão B)', `W = ${nf(W / 1e3, 1)} cm³ (${R.n === 1 ? 'seção T restante' : 'alma retangular, tw·h0²/6'}); FRd = fy·W/[(Lh + 10)·γa1] = ${nf(Vg.fy, 0)}·${nf(W / 1e3, 1)}·10³/(${nf(arm, 0)}·1,10) = ${nf(kN(My), 1)} kN`, V, My));
  // local web buckling (AISC 13th ed. Eq. 9-7, as Gerdau 3.4.2: Fbc,Rd = 16 243·(tw/h0)²·f·k, kN/cm²)
  const hb = H - R.n * R.Lv;                                            // 2 recortes: altura restante (conservador; Gerdau não distingue)
  if (R.Lh > hb) avisos.push(`Recorte com Lh = ${nf(R.Lh, 0)} > h0 = ${nf(hb, 0)} mm: fora do limite da fórmula de flambagem local (Gerdau 3.4.2).`);
  const f = R.Lh / H <= 1 ? 2 * R.Lh / H : 1 + R.Lh / H, k = R.Lh / hb <= 1 ? 2.2 * (hb / R.Lh) ** 1.65 : 2.2 * hb / R.Lh;
  const Fbc = Math.min(16243 * (tw / hb) ** 2 * f * k * 10, Vg.fy / C.GAMMA.a1);   // MPa (kN/cm² × 10), ≤ fy/γa1
  const Fb = Fbc * W / arm;
  checks.push(C.chk(G, 'Flambagem local da alma recortada', 'Gerdau 3.4.2 ← AISC 13ª ed. p.9-7a (NBR sem cláusula: LACUNA → decisão B)', `h0 = ${nf(hb, 0)} mm; f = ${nf(f, 3)}; k = ${nf(k, 3)}; Fbc,Rd = 16 243·(tw/h0)²·f·k [kN/cm²; constante do Gerdau = AISC 26 210 ksi convertido, com φ = 0,9] = ${nf(Fbc, 1)} MPa (≤ fy/γa1); FRd = Fbc,Rd·W/(Lh + 10) = ${nf(kN(Fb), 1)} kN`, V, Fb));
}

/* ------------------------------------------------------------------------------------------------ (3) LCSP */
/** viga {d, bf, tf, tw, fy, fu}; cant {b, t, L, ev, g, fy, fu}; solda {dw, eletrodo}; suporte {t, fu}; par {grade, db, n, s, rosca, dh};
 *  V (kN); recorte (optional) */
export function lcspConnection({ viga: Vg, cant: A, solda: W, suporte: S, par, V: Vk, recorte = null, opts = {} }) {
  const checks = [], avisos = [];
  const Vd = Math.max(Math.abs(Vk), opts.excecao45 ? 0 : 45) * 1000;
  checks.push({ g: 'Esforço de cálculo', nome: 'Força cortante de cálculo da ligação', ref: '6.1.5.2', info: true, eq: `|VSd| = ${nf(Math.abs(Vk))} kN${Math.abs(Vk) < 45 && !opts.excecao45 ? ' → 45 kN' : ''}` });
  const fw = C.ELECTRODES[W.eletrodo || 'E70'], kl = A.b - 10;              // horizontals: angle leg minus the 10 mm gap to the beam end
  // (a) weld on the beam web, per angle: C-shape l = L, kl = b − 10, load V/2 at the heel (support face), 6.2.5.2-b
  const lines = cShape(A.L, kl, W.dw), icr = weldICR(lines, { xP: A.b, fw });
  checks.push(C.chk('Solda na alma da viga', `Filete em C (${nf(A.L, 0)} + 2 × ${nf(kl, 0)} mm, dw = ${nf(W.dw, 1)}) por cantoneira — centro instantâneo de rotação`, '6.2.5.2-b',
    `excentricidade ex = b − x̄ = ${nf(A.b, 1)} − ${nf(icr.xc, 1)} = ${nf(icr.ex, 1)} mm; Fw,Rd (por cantoneira, ICR) = ${nf(kN(icr.Rd), 1)} kN; solicitante V/2 = ${nf(kN(Vd / 2), 1)} kN`, Vd / 2, icr.Rd));
  if (icr.assimetrico) avisos.push('Grupo de solda sem simetria em relação ao eixo horizontal do centroide: o centro instantâneo foi buscado nesse eixo (aproximação).');
  weldDetailing(checks, { dw: W.dw, tmin: Math.min(A.t, Vg.tw), tEdge: A.t, L: kl, avisos });
  // (b) bolts on the support: 2n single shear; bearing on the angle legs and on the support
  const dh = par.dh ?? C.holeStd8800(par.db), dn = dh + 2, fv = C.boltShear8800({ grade: par.grade, db: par.db, rosca: par.rosca ?? true });
  const n = par.n, FvSd = Vd / (2 * n);
  checks.push(C.chk('Parafusos no suporte', `Cisalhamento (2 × ${n} parafusos, corte simples)`, '6.3.3.2', `Fv,Sd = V/(2n) = ${nf(kN(FvSd))} kN; ${fv.eq}`, FvSd, fv.R));
  const cb = Math.min(C.bearing8800({ lf: A.ev - dh / 2, db: par.db, t: A.t, fu: A.fu }).R, n > 1 ? C.bearing8800({ lf: par.s - dh, db: par.db, t: A.t, fu: A.fu }).R : Infinity);
  checks.push(C.chk('Pressão de contato', 'Contato — aba da cantoneira no suporte (furo mais crítico)', '6.3.3.3', `ℓf = mín(ev − dh/2; s − dh) → Fc,Rd = ${nf(kN(cb))} kN por furo`, FvSd, cb));
  const cs = C.bearing8800({ lf: n > 1 ? par.s - dh : 1e9, db: par.db, t: S.t, fu: S.fu });
  checks.push(C.chk('Pressão de contato', 'Contato — elemento suporte', '6.3.3.3', cs.eq, FvSd, cs.R));
  // (c) angles: shear (support leg has the holes) and block shear of the support legs
  const shA = C.shearElement8800({ Agv: 2 * A.L * A.t, Anv: 2 * (A.L - n * dn) * A.t, fy: A.fy, fu: A.fu });
  checks.push(C.chk('Cantoneiras', 'Cisalhamento das 2 cantoneiras', '6.5.5', `Agv = ${nf(2 * A.L * A.t, 0)}, Anv = ${nf(2 * (A.L - n * dn) * A.t, 0)} mm²; ${shA.eq}`, Vd, shA.R));
  const Agv = 2 * ((n - 1) * par.s + A.ev) * A.t, Anv = Agv - 2 * (n - 0.5) * dn * A.t, Ant = 2 * (A.b - A.g - 0.5 * dn) * A.t;
  const bk = C.blockShear8800({ Agv, Anv, Ant, fy: A.fy, fu: A.fu, Cts: 1 });
  checks.push(C.chk('Cantoneiras', 'Colapso por rasgamento das 2 cantoneiras (aba no suporte)', '6.5.6; Gerdau 3.4.2', `Agv = ${nf(Agv, 0)}, Anv = ${nf(Anv, 0)}, Ant = ${nf(Ant, 0)} mm²; ${bk.eq}`, Vd, bk.R));
  // (d) beam web
  if (!recorte) {
    const sw = C.shearElement8800({ Agv: Vg.d * Vg.tw, Anv: Vg.d * Vg.tw, fy: Vg.fy, fu: Vg.fu });
    checks.push(C.chk('Viga', 'Cisalhamento da alma da viga', '6.5.5', `Agv = d·tw = ${nf(Vg.d * Vg.tw, 0)} mm² (sem furos); ${sw.eq}`, Vd, sw.R));
  } else copedChecks(checks, avisos, { recorte, viga: Vg, V: Vd, bolts: null });
  avisos.push('Lado do suporte: excentricidade dos parafusos desprezada (Gerdau LCSP); verificar o elemento suporte (Gerdau, nota 3 das tabelas).');
  const ys = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * par.s);
  return { ...C.summarize(checks, avisos), V: kN(Vd), geo: { tipo: 'lcsp', viga: Vg, cant: { ...A, a: A.g, eh: A.b - A.g, b2: A.b }, L: A.L, ys, V: kN(Vd), solda: W, par, recorte } };
}
