// connections_base.js — base de pilar I/H (NBR 8800:2024 6.7, new in the 2024 edition): placa de base retangular soldada
// ao pilar, chumbadores ASTM A36 (fy 250, fu 400 — 6.7.1.5-c), argamassa expansiva, bloco de concreto. Cases of
// Figures 22/23: C1, C2, C3 (compression) and T1, T2, T3 (tension); base tipo 1 (chumbadores externos, all cases) and
// tipo 2 (internos, only C1, C2, T1, T2 — 6.7.1.4). Equations of 6.7.2.1/6.7.2.2 read on the images of p.102–107 of the
// norm; contact stress 6.6.5; shear plate 6.7.2.4; welded washers 6.7.2.5; Tabela 18 (disposições construtivas).
// Units: mm, MPa, N internally; inputs/outputs kN and kN·m. NSd > 0 = compression, < 0 = tension; MSd about the major
// axis of the column (6.7.1.3).
import * as C from './connections.js?v=7';

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const kN = (N) => N / 1000;

// Tabela 18: db [pol, mm] → a1 a2 a3 h1 h2 r1 r2 df | arruela: espessura, lado | en fck,min Nb,min | S φ
export const TAB18 = [
  ['3/4', 19, 40, 80, 120, 450, 150, 175, 50, 33, 6.3, 50, 40, 20, 800, 125, 10],
  ['7/8', 22, 45, 90, 140, 465, 200, 225, 50, 40, 6.3, 65, 50, 20, 800, 100, 10],
  ['1', 25, 50, 100, 160, 465, 200, 225, 50, 45, 8, 75, 60, 25, 800, 125, 12.5],
  ['1 1/4', 32, 65, 130, 190, 525, 225, 250, 60, 50, 9.5, 75, 60, 25, 900, 100, 12.5],
  ['1 1/2', 38, 80, 160, 230, 610, 250, 275, 70, 60, 9.5, 90, 70, 25, 1200, 150, 16],
  ['1 3/4', 44, 90, 180, 270, 700, 300, 325, 70, 70, 12.5, 100, 80, 25, 1300, 125, 16],
  ['2', 50, 100, 200, 300, 850, 350, 375, 100, 80, 16, 125, 90, 30, 1300, 100, 16],
].map(([pol, db, a1, a2, a3, h1, h2, r1, r2, df, ta, la, en, fckmin, Nbmin, S, phi]) => ({ pol, db, a1, a2, a3, h1, h2, r1, r2, df, ta, la, en, fckmin, Nbmin, S, phi }));
export const tab18 = (db) => TAB18.find((r) => Math.abs(r.db - db) < 0.6) || null;

/** σc,Rd of 6.6.5 (MPa) */
export function sigmaCRd(fck, A2A1) {
  const r = Math.sqrt(Math.max(1, A2A1)), v = 0.85 * fck / C.GAMMA.c * r, cap = 1.7 * fck / C.GAMMA.c;
  return { v: Math.min(v, cap), eq: `σc,Rd = 0,85·fck/γc·√(A2/A1) = 0,85·${nf(fck, 1)}/1,4·√${nf(A2A1, 3)} = ${nf(v, 2)}${v > cap ? ` > 1,7·fck/γc → ${nf(cap, 2)}` : ` ≤ 1,7·fck/γc = ${nf(cap, 2)}`} MPa` };
}

export function columnBase(inp) {
  const { pilar: P, tipo = 1, nb = 4, db, placa, concreto, N: Nk = 0, M: Mk = 0, V: Vk = 0, cis = {}, chumbador = { fy: 250, fu: 400 } } = inp;
  const checks = [], avisos = [];
  const T = tab18(db); if (!T) throw new Error(`chumbador db = ${db} mm fora da Tabela 18 (19, 22, 25, 32, 38, 44, 50 mm)`);
  const a1 = inp.a1 ?? T.a1, a2 = inp.a2 ?? T.a2;
  const { d, bf, tw } = P, fy = placa.fy, ga1 = C.GAMMA.a1, ga2 = C.GAMMA.a2, fub = chumbador.fu;
  const G0 = 'Geometria (6.7.2.1) e Tabela 18';
  // 6.7.2.1
  const lx = d + 4 * a1, ly = (0.5 * nb - 1) * a2 + 2 * a1;
  const a = tipo === 1 ? d / 2 + a1 : (inp.a ?? a2 / 2);
  const m = (lx - 0.95 * d) / 2, n = (ly - 0.80 * bf) / 2, n0 = Math.sqrt(d * bf) / 4;
  const l0 = tipo === 2 ? (0.5 * nb - 1) * a2 + 1.75 * (a2 - tw) : null;
  checks.push({ g: G0, nome: 'Dimensões da placa e balanços', ref: '6.7.2.1', info: true,
    eq: `ℓx = d + 4a1 = ${nf(d, 0)} + 4·${nf(a1, 0)} = ${nf(lx, 0)} mm; ℓy = (0,5nb − 1)·a2 + 2a1 = ${nf(ly, 0)} mm; a = ${nf(a, 1)} mm; m = (ℓx − 0,95d)/2 = ${nf(m, 1)}; n = (ℓy − 0,80bf)/2 = ${nf(n, 1)}; n0 = √(d·bf)/4 = ${nf(n0, 1)} mm${l0 != null ? `; ℓ0 = (0,5nb − 1)·a2 + 1,75·(a2 − tw) = ${nf(l0, 1)} mm` : ''}` });
  checks.push(C.det(G0, 'ℓy ≥ bf + 25 mm', '6.7.2.1', `ℓy = ${nf(ly, 0)} ≥ ${nf(bf + 25, 0)} mm`, ly, bf + 25, 'min'));
  if (tipo === 2) checks.push(C.det(G0, 'ℓ0 ≤ d (base tipo 2)', '6.7.2.1', `ℓ0 = ${nf(l0, 1)} ≤ ${nf(d, 0)} mm`, l0, d, 'max'));
  checks.push(C.det(G0, tipo === 1 ? 'Número de chumbadores 4 ≤ nb ≤ 8' : 'nb = 4 (base tipo 2)', '6.7.2.1', `nb = ${nb}`, nb, tipo === 1 ? 8 : 4, 'max'));
  if (nb < 4 || nb % 2) checks.push(C.det(G0, 'nb ≥ 4 e par', '6.7.2.1', `nb = ${nb}`, nb, 4, 'min'));
  if (tipo === 1 && Math.abs(a1 - T.a1) > 1e-9) avisos.push(`Base tipo 1: a1 = ${nf(a1, 0)} mm difere do valor da Tabela 18 (${T.a1} mm) para db = ${T.db} mm.`);
  if (tipo === 2 && (a1 < 10 || a1 > T.a1)) checks.push(C.det(G0, 'a1 entre 10 mm e o valor da Tab. 18 (tipo 2)', 'Tab. 18 nota f', `a1 = ${nf(a1, 0)} ≤ ${T.a1} mm`, a1, T.a1, 'max'));
  if (a2 < T.a2) checks.push(C.det(G0, 'a2 ≥ valor da Tabela 18', 'Tab. 18', `a2 = ${nf(a2, 0)} ≥ ${T.a2} mm`, a2, T.a2, 'min'));
  checks.push(C.det(G0, 'fck do bloco ≥ fck,min', 'Tab. 18 nota b', `fck = ${nf(concreto.fck, 1)} ≥ ${T.fckmin} MPa`, concreto.fck, T.fckmin, 'min'));
  if (concreto.Nb > 0 && concreto.Bb > 0) {
    const Nbr = Math.max(T.Nbmin, lx + 2 * (T.a3 - a1)), Bbr = ly + 2 * (T.a3 - a1);
    checks.push(C.det(G0, 'Dimensão Nb do bloco', 'Tab. 18 nota e', `Nb = ${nf(concreto.Nb, 0)} ≥ máx(Nb,min; ℓx + 2(a3 − a1)) = ${nf(Nbr, 0)} mm`, concreto.Nb, Nbr, 'min'));
    checks.push(C.det(G0, 'Dimensão Bb do bloco', 'Tab. 18 nota e', `Bb = ${nf(concreto.Bb, 0)} ≥ ℓy + 2(a3 − a1) = ${nf(Bbr, 0)} mm`, concreto.Bb, Bbr, 'min'));
    if (concreto.Ab > 0) { const Abr = Math.max(T.h1 + 150, Nbr); checks.push(C.det(G0, 'Altura Ab do bloco', 'Tab. 18 nota e', `Ab = ${nf(concreto.Ab, 0)} ≥ máx(h1 + 150; Nb) = ${nf(Abr, 0)} mm`, concreto.Ab, Abr, 'min')); }
  }
  checks.push({ g: G0, nome: 'Chumbadores e disposições da Tabela 18', ref: 'Tab. 18; 6.7.1.5-c,d', info: true,
    eq: `db = ${T.pol}" (${T.db} mm), ASTM A36 (fy 250, fu 400 MPa), porca sextavada pesada; h1 = ${T.h1}, h2 = ${T.h2}, r1 = ${T.r1}, r2 = ${T.r2}, furo da placa df = ${T.df} mm; arruela especial ${nf(T.ta, 1)} × ${T.la} × ${T.la} mm (furo db + 1,5); argamassa en = ${T.en} mm com fck ≥ 2·fck do bloco; armadura mínima do bloco φ${nf(T.phi, 1)} c/${T.S} mm` });

  // 6.6.5 and the auxiliary quantities
  const A1 = lx * ly, A2A1 = concreto.A2A1 ?? (concreto.Nb > 0 && concreto.Bb > 0 ? Math.min(concreto.Nb / lx, concreto.Bb / ly) ** 2 : 1);
  const sR = sigmaCRd(concreto.fck, A2A1), sRd = sR.v, tau = Math.min(0.2 * concreto.fck / C.GAMMA.c, 4);
  const N = Nk * 1000, M = Math.abs(Mk) * 1e6, V = Math.abs(Vk) * 1000, Nabs = Math.abs(N);
  const comp = N > 0, e = Nabs > 0 ? M / Nabs : Infinity;
  const X = Math.min(1, 4 * d * bf / (d + bf) ** 2 * (Nabs / (lx * ly * sRd)));
  const lam = Math.min(1, 2 * Math.sqrt(X) / (1 + Math.sqrt(1 - X)));
  checks.push({ g: 'Concreto (6.6.5)', nome: 'Tensão resistente de contato', ref: '6.6.5', info: true, eq: `${sR.eq}; A1 = ℓx·ℓy = ${nf(A1, 0)} mm²; τc,Rd = 0,2·fck/γc ≤ 4 MPa = ${nf(tau, 3)} MPa` });
  const tpEq = (lmax, sig) => lmax * Math.sqrt(2 * sig / (fy / ga1));
  const lmaxRule = (lc, withN0) => {
    if (lc >= m) { const c = [m, n, ...(withN0 ? [lam * n0] : [])]; return { v: Math.max(...c), txt: `ℓc ≥ m → ℓmax = máx(m; n${withN0 ? '; λn0' : ''}) = máx(${c.map((x) => nf(x, 1)).join('; ')})` }; }
    const p = Math.sqrt(lc * (2 * m - lc)); return { v: Math.max(p, n), txt: `ℓc < m → p = √(ℓc(2m − ℓc)) = ${nf(p, 1)}; ℓmax = máx(p; n) = ${nf(Math.max(p, n), 1)}` };
  };
  const dbMin = (Ft) => Math.sqrt(4 * Ft / (0.75 * Math.PI * (fub / ga2)));
  const tp2 = (Ft) => Math.sqrt(Math.max(0, 2 * nb * Ft * (m - a1)) / (ly * (fy / ga1)));
  let caso, Ft = 0, VRd = null, VRdTxt = '', tpmin, tpTxt, nTens = 0;
  const G = 'Placa, chumbadores e concreto (6.7.2.2)';
  if (comp) {
    const eLim = 0.5 * (lx - Nabs / (sRd * ly));
    caso = M === 0 ? 'C1' : e <= eLim ? 'C2' : 'C3';
    checks.push({ g: G, nome: `Caso ${caso}`, ref: '6.7.1.4; 6.7.2.2', info: true, eq: `NSd = ${nf(kN(N))} kN (compressão), MSd = ${nf(Math.abs(Mk), 3)} kN·m → e = M/N = ${nf(e, 1)} mm; limite C2: ½(ℓx − NSd/(σc,Rd·ℓy)) = ${nf(eLim, 1)} mm; X = [4dbf/(d + bf)²]·NSd/(ℓxℓyσc,Rd) = ${nf(X, 4)}; λ = 2√X/(1 + √(1 − X)) = ${nf(lam, 4)}` });
    if (tipo === 2 && caso === 'C3') { checks.push({ g: G, nome: 'Caso C3 não previsto para base tipo 2', ref: '6.7.1.4', eq: 'base tipo 2: apenas C1, C2, T1 e T2 — alterar a ligação (tipo 1 ou maior placa)', Sd: 1, Rd: 0, ratio: Infinity, ok: false, un: '' }); return { ...C.summarize(checks, avisos), caso, geo: { lx, ly, a, a1, a2, tipo, nb, db } }; }
    if (caso === 'C1' || caso === 'C2') {
      const lc = caso === 'C1' ? lx : lx - 2 * e, sSd = Nabs / (lc * ly);
      checks.push({ ...C.chk(G, 'Tensão de contato no concreto', '6.7.1.5-d; 6.6.5', `${caso === 'C2' ? `ℓc = ℓx − 2e = ${nf(lc, 1)} mm; ` : ''}σc,Sd = NSd/(${caso === 'C2' ? 'ℓc' : 'ℓx'}·ℓy) = ${nf(sSd, 3)} MPa ≤ σc,Rd = ${nf(sRd, 3)} MPa`, sSd, sRd), Sd: sSd, Rd: sRd, un: 'MPa' });
      const lm = caso === 'C1' ? { v: Math.max(m, n, lam * n0), txt: `ℓmax = máx(m; n; λn0) = máx(${nf(m, 1)}; ${nf(n, 1)}; ${nf(lam * n0, 1)})` } : lmaxRule(lc, true);
      tpmin = tpEq(lm.v, sSd); tpTxt = `${lm.txt} = ${nf(lm.v, 1)} mm; tp,min = ℓmax·√(2σc,Sd/(fy/γa1)) = ${nf(lm.v, 1)}·√(2·${nf(sSd, 3)}/(${nf(fy, 0)}/1,10)) = ${nf(tpmin, 2)} mm`;
      const Vf = 0.45 * sSd * lc * ly / ga2, Vt = tau * lx * ly; VRd = Math.min(Vf, Vt);
      VRdTxt = `VRd = μ·σc,Sd·${caso === 'C2' ? 'ℓc' : 'ℓx'}·ℓy/γa2 = 0,45·${nf(sSd, 3)}·${nf(lc, 0)}·${nf(ly, 0)}/1,35 = ${nf(kN(Vf), 1)} ≤ τc,Rd·ℓx·ℓy = ${nf(kN(Vt), 1)} kN`;
    } else {
      const k = lx / 2 + a, rhs = 2 * (M + Nabs * a) / (sRd * ly);
      if (k * k < rhs) { checks.push({ g: G, nome: 'Condição de equilíbrio do caso C3', ref: '6.7.2.2-c', eq: `(ℓx/2 + a)² = ${nf(k * k, 0)} < 2NSd(e + a)/(σc,Rd·ℓy) = ${nf(rhs, 0)} mm² — alterar a ligação`, Sd: rhs, Rd: k * k, ratio: rhs / (k * k), ok: false, un: 'mm²' }); return { ...C.summarize(checks, avisos), caso, geo: { lx, ly, a, a1, a2, tipo, nb, db } }; }
      const lc = k - Math.sqrt(k * k - rhs); Ft = 2 * (sRd * lc * ly - Nabs) / nb; nTens = nb / 2;
      const lm = lmaxRule(lc, true), t1 = tpEq(lm.v, sRd), t2 = tp2(Ft); tpmin = Math.max(t1, t2);
      tpTxt = `ℓc = (ℓx/2 + a) − √((ℓx/2 + a)² − 2NSd(e + a)/(σc,Rd·ℓy)) = ${nf(lc, 1)} mm; Ft,Sd = 2(σc,Rd·ℓc·ℓy − NSd)/nb = ${nf(kN(Ft))} kN; ${lm.txt} = ${nf(lm.v, 1)}; tp,min1 = ℓmax·√(2σc,Rd/(fy/γa1)) = ${nf(t1, 2)}; tp,min2 = √(2nb·Ft,Sd·(m − a1)/(ℓy·fy/γa1)) = ${nf(t2, 2)} → tp,min = ${nf(tpmin, 2)} mm`;
      const Vf = 0.45 * sRd * lc * ly / ga2, Vt = tau * lx * ly; VRd = Math.min(Vf, Vt);
      VRdTxt = `VRd = μ·σc,Rd·ℓc·ℓy/γa2 = 0,45·${nf(sRd, 3)}·${nf(lc, 1)}·${nf(ly, 0)}/1,35 = ${nf(kN(Vf), 1)} ≤ τc,Rd·ℓx·ℓy = ${nf(kN(Vt), 1)} kN`;
    }
  } else {
    caso = M === 0 ? 'T1' : e <= a ? 'T2' : 'T3';
    if (Nabs === 0 && M === 0) caso = 'C1';
    checks.push({ g: G, nome: `Caso ${caso}`, ref: '6.7.1.4; 6.7.2.2', info: true, eq: `NSd = ${nf(kN(N))} kN (tração), MSd = ${nf(Math.abs(Mk), 3)} kN·m → e = ${isFinite(e) ? nf(e, 1) : '∞'} mm; a = ${nf(a, 1)} mm` });
    if (tipo === 2 && caso === 'T3') { checks.push({ g: G, nome: 'Caso T3 não previsto para base tipo 2', ref: '6.7.1.4', eq: 'base tipo 2: apenas C1, C2, T1 e T2 — alterar a ligação', Sd: 1, Rd: 0, ratio: Infinity, ok: false, un: '' }); return { ...C.summarize(checks, avisos), caso, geo: { lx, ly, a, a1, a2, tipo, nb, db } }; }
    if (caso === 'T1' || caso === 'T2') {
      Ft = caso === 'T1' ? Nabs / nb : Nabs / nb + M / (a * nb); nTens = caso === 'T1' ? nb : nb / 2;
      if (tipo === 1) { tpmin = tp2(Ft); tpTxt = `Ft,Sd = ${caso === 'T1' ? 'NSd/nb' : 'NSd/nb + MSd/(a·nb)'} = ${nf(kN(Ft))} kN; tp,min = √(2nb·Ft,Sd·(m − a1)/(ℓy·fy/γa1)) = ${nf(tpmin, 2)} mm`; }
      else { tpmin = Math.sqrt(Math.max(0, nb * Ft * (a2 - tw)) / (l0 * (fy / ga1))); tpTxt = `Ft,Sd = ${nf(kN(Ft))} kN; tp,min = √(nb·Ft,Sd·(a2 − tw)/(ℓ0·fy/γa1)) = ${nf(tpmin, 2)} mm`; }
      VRd = 0; VRdTxt = 'casos T1 e T2: não há atrito — a força cortante exige dispositivo (6.7.2.3)';
    } else {
      const k = lx / 2 + a, rhs = 2 * (M - Nabs * a) / (sRd * ly);
      if (k * k < rhs) { checks.push({ g: G, nome: 'Condição de equilíbrio do caso T3', ref: '6.7.2.2-f', eq: `(ℓx/2 + a)² = ${nf(k * k, 0)} < 2NSd(e − a)/(σc,Rd·ℓy) = ${nf(rhs, 0)} mm² — alterar a ligação`, Sd: rhs, Rd: k * k, ratio: rhs / (k * k), ok: false, un: 'mm²' }); return { ...C.summarize(checks, avisos), caso, geo: { lx, ly, a, a1, a2, tipo, nb, db } }; }
      const lc = k - Math.sqrt(k * k - rhs); Ft = 2 * (sRd * lc * ly + Nabs) / nb; nTens = nb / 2;
      const lm = lmaxRule(lc, false), t1 = tpEq(lm.v, sRd), t2 = tp2(Ft); tpmin = Math.max(t1, t2);
      tpTxt = `ℓc = (ℓx/2 + a) − √((ℓx/2 + a)² − 2NSd(e − a)/(σc,Rd·ℓy)) = ${nf(lc, 1)} mm; Ft,Sd = 2(σc,Rd·ℓc·ℓy + NSd)/nb = ${nf(kN(Ft))} kN; ${lm.txt} = ${nf(lm.v, 1)}; tp,min1 = ${nf(t1, 2)}; tp,min2 = ${nf(t2, 2)} → tp,min = ${nf(tpmin, 2)} mm`;
      const Vf = 0.45 * sRd * lc * ly / ga2, Vt = tau * lx * ly; VRd = Math.min(Vf, Vt);
      VRdTxt = `VRd = μ·σc,Rd·ℓc·ℓy/γa2 = ${nf(kN(Vf), 1)} ≤ τc,Rd·ℓx·ℓy = ${nf(kN(Vt), 1)} kN`;
    }
  }
  checks.push({ ...C.det(G, 'Espessura da placa de base', '6.7.1.5-a; 6.7.2.2', `${tpTxt}; tp = ${nf(placa.tp, 2)} mm`, placa.tp, tpmin, 'min'), res: true });
  if (Ft > 0) { const dm = dbMin(Ft); checks.push({ ...C.det(G, 'Diâmetro do chumbador', '6.7.1.5-b; 6.7.2.2', `db,min = √(4Ft,Sd/(0,75π·fub/γa2)) = √(4·${nf(Ft, 0)}/(0,75π·${nf(fub, 0)}/1,35)) = ${nf(dm, 2)} mm; db = ${nf(db, 2)} mm`, db, dm, 'min'), res: true }); }
  // shear (6.7.1.5-e, 6.7.2.3–6.7.2.5)
  const GV = 'Força cortante (6.7.2.3–6.7.2.5)';
  const disp = cis.tipo || 'atrito';
  if (disp === 'atrito') {
    if (V > 0) checks.push(C.chk(GV, 'Força cortante — atrito placa–argamassa (μ = 0,45)', '6.7.1.5-e; 6.7.2.2', `${VRdTxt}`, V, VRd || 0));
  } else if (disp === 'placa') {
    const s4 = sigmaCRd(concreto.fck, 4).v, { bv, bh, tpv } = cis, en = cis.en ?? T.en;
    const R = s4 * (bv - en) * bh, tmin = Math.sqrt(2 * V * (bv + en) / (bh * (fy / ga1))), Mw = 0.5 * s4 * bh * (bv * bv - en * en);
    checks.push(C.chk(GV, 'Placa de cisalhamento', '6.7.2.4', `σc,Rd (A2/A1 = 4) = ${nf(s4, 2)} MPa; VRd = σc,Rd·(bv − en)·bh = ${nf(s4, 2)}·(${nf(bv, 0)} − ${nf(en, 0)})·${nf(bh, 0)} = ${nf(kN(R), 1)} kN`, V, R));
    checks.push({ ...C.det(GV, 'Espessura da placa de cisalhamento', '6.7.2.4', `tpv,min = √(2VSd(bv + en)/(bh·fy/γa1)) = ${nf(tmin, 2)} mm; tpv = ${nf(tpv, 2)} mm`, tpv, tmin, 'min'), res: true });
    checks.push(C.det(GV, 'tpv ≤ tp', '6.7.2.4', `tpv = ${nf(tpv, 2)} ≤ tp = ${nf(placa.tp, 2)} mm`, tpv, placa.tp, 'max'));
    checks.push({ g: GV, nome: 'Solda da placa de cisalhamento', ref: '6.7.2.4', info: true, eq: `dimensionar para VRd = ${nf(kN(R), 1)} kN com MSd = ½·σc,Rd·bh·(bv² − en²) = ${nf(Mw / 1e6, 3)} kN·m (exceto penetração total); bloco armado para concrete break-out (ACI 318)` });
  } else if (disp === 'arruelas') {
    const ta = cis.ta ?? T.ta, Ab = Math.PI * db * db / 4, FvRd = 0.45 * Ab * fub / ga2;
    const alpha = 1.45 * (placa.tp + 0.5 * ta) / db * fub / chumbador.fy * ga1 / ga2;
    const Vi = (FtI) => { const q = 0.533 * FtI; const r = (Math.sqrt(Math.max(0, (1 + alpha * alpha) * FvRd * FvRd - q * q)) - alpha * q) / (1 + alpha * alpha); return Math.min(Math.max(0, r), 5 * db * db * sRd); };
    const R = nTens * Vi(Ft) + (nb - nTens) * Vi(0);
    checks.push(C.chk(GV, 'Arruelas especiais soldadas à placa de base', '6.7.2.5', `α = 1,45·(tp + 0,5ta)/db·(fub/fy)·(γa1/γa2) = ${nf(alpha, 3)}; Fv,Rd,i = 0,45·Ab·fub/γa2 = ${nf(kN(FvRd))} kN; ${nTens} chumbador(es) tracionado(s) (Ft,Sd = ${nf(kN(Ft))} kN): VRd,i = ${nf(kN(Vi(Ft)))} kN; ${nb - nTens} sem tração: VRd,i = ${nf(kN(Vi(0)))} kN (≤ 5db²σc,Rd = ${nf(kN(5 * db * db * sRd), 1)}); VRd = ${nf(kN(R), 1)} kN`, V, R));
    checks.push({ g: GV, nome: 'Solda das arruelas', ref: '6.7.2.5', info: true, eq: `só as arruelas superiores, soldadas para Fv,Rd,i = ${nf(kN(FvRd))} kN cada` });
  }
  avisos.push('A solda do pilar à placa de base é dimensionada pela 6.2 (6.7.1.3); a armadura e o dimensionamento do bloco seguem a NBR 6118 com os mínimos da Tabela 18.');
  return { ...C.summarize(checks, avisos), caso, Ft: kN(Ft), tpmin, geo: { lx, ly, a, a1, a2, tipo, nb, db, d, bf, tw, tf: P.tf, caso } };
}
