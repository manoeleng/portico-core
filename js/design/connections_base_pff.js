// connections_base_pff.js — base of a LATTICED column with cold-formed legs (galpão PFF: pernas U de chapa dobrada). The
// NBR 8800:2024 6.7 covers only I/H columns, so both arrangements here are literature / analogy (decisão B, declared):
//  · basePerna     — one plate per leg (default; matches the model, which has one hinge per leg): 6.7 applied by ANALOGY with the
//                    U leg taken as an I of d = bw, bf (6.7.1.1 allows other methods meeting 6.1.1.3), plus the weld of the leg
//                    to the plate by NBR 14762 10.2.3 with the force max(analysis; 50 % NRd of the leg) (10.1-a);
//  · basePlacaUnica — one plate under both legs, as Wanderson F. Maia (Especialização INBEC 2016, Mód. 6 "Perfis formados a frio
//                    III", p.89–117): N = VA + VB, M = (VA − VB)·s/2, V = ΣH; triangular pressure with the large-eccentricity
//                    equilibrium (p.92, 100–102), σc,Rd by NBR 8800:2024 6.6.5 (changed from the 2008 one of the slides),
//                    thickness by the concrete side √(4,4·Mmax/fy) and by the anchor side with a 45° width (p.103–105), anchors by
//                    6.3.3 (2024: Fv,Rd 0,45). When the equilibrium gives T ≤ 0 the plate is in compression only (Y = 3(H/2 − e) or
//                    the core) — the slides force fpd = σc,Rd there (engenheiro de aço: C1 → Y = 3,15 cm, fpd = 0,46 kN/cm²).
// Units: mm, MPa, N internally; kN, kN·m in inputs/outputs.
import * as C from './connections.js?v=7';
import { columnBase, sigmaCRd, tab18 } from './connections_base.js?v=7';

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const kN = (N) => N / 1000;

/** weld of a cold-formed leg (U bw × bf × t) to the base plate, NBR 14762 10.2.3: contour 2·bf + bw, leg w; N normal to the
 *  welds, V parallel to the web weld; resultant per length ≤ the smaller resistance per length (B) */
export function legWeld14762({ perna: U, w, fu = 400, fw = 485, N, V, NRdPerna = 0 }) {
  const checks = [];
  const F = Math.max(Math.abs(N), 0.5 * NRdPerna) * 1000, t = U.t, Lt = 2 * U.bf + U.bw;
  const rN = C.fillet14762({ L: Lt, t, w, fu, fw, dir: 'normal' }), rV = C.fillet14762({ L: U.bw, t, w, fu, fw, dir: 'paralela' });
  const qN = rN.R / Lt, qV = rV.R / U.bw, q = Math.min(qN, qV);
  const fNl = F / Lt, fVl = Math.abs(V) * 1000 / U.bw, f = Math.hypot(fNl, fVl);
  checks.push({ g: 'Solda perna–placa (NBR 14762)', nome: 'Força de cálculo da solda', ref: 'NBR 14762 10.1-a', info: true, eq: `F = máx(|N| = ${nf(Math.abs(N))}; 50 % de NRd da perna = ${nf(0.5 * NRdPerna)}) = ${nf(kN(F))} kN; V = ${nf(Math.abs(V))} kN` });
  checks.push({ ...C.chk('Solda perna–placa (NBR 14762)', `Filete ${nf(w, 2)} mm em todo o contorno (${nf(Lt, 0)} mm), N normal + V paralelo à alma`, 'NBR 14762 10.2.3 (resultante ≤ menor resistência por comprimento — decisão B)',
    `N/L = ${nf(fNl, 1)} N/mm; V/bw = ${nf(fVl, 1)} N/mm; resultante ${nf(f, 1)} N/mm; normal: ${rN.eq} → ${nf(qN, 1)} N/mm; paralela (alma): ${rV.eq} → ${nf(qV, 1)} N/mm`, f, q), Sd: f / 1000, Rd: q / 1000, un: 'kN/mm' });
  return checks;
}

/** one plate per leg: the 6.7 by analogy (U taken as I of d = bw, bf, tw = tf = t) + leg weld (14762) */
export function basePerna({ perna: U, nb = 4, db = 19, a1, a2, placa, concreto, N: N0, V = 0, cis = { tipo: 'atrito' }, solda = { w: null, eletrodo: 'E70' }, NRdPerna = 0, fuPerna = 400 }) {
  // NBR 14762 10.1-a: the base is the connection of an axially loaded leg → plate and anchors also for ≥ 50 % of NRd (sign of N kept)
  const N = Math.sign(N0 || 1) * Math.max(Math.abs(N0), 0.5 * NRdPerna);
  const r = columnBase({ pilar: { d: U.bw, bf: U.bf, tw: U.t, tf: U.t }, tipo: 1, nb, db, a1, a2, placa, concreto, N, M: 0, V, cis });
  // tension or shear without friction → welded special washers (6.7.2.3/6.7.2.5) when friction does not carry V
  let res = r;
  const failV = r.checks.filter((x) => !x.ok && !x.info);
  if (V && failV.length && failV.every((x) => /Força cortante/.test(x.g)) && cis.tipo === 'atrito') res = columnBase({ pilar: { d: U.bw, bf: U.bf, tw: U.t, tf: U.t }, tipo: 1, nb, db, a1, a2, placa, concreto, N, M: 0, V, cis: { tipo: 'arruelas' } });
  const w = solda.w ?? U.t;
  const wc = legWeld14762({ perna: U, w, fu: fuPerna, fw: C.ELECTRODES[solda.eletrodo || 'E70'], N, V, NRdPerna });
  if (Math.abs(N) > Math.abs(N0) + 1e-9) res.checks.unshift({ g: 'Esforço de cálculo', nome: 'Força mínima da ligação da perna', ref: 'NBR 14762 10.1-a', info: true, eq: `|N| = ${nf(Math.abs(N0))} kN < 50 % de NRd da perna → N = ${nf(N)} kN na placa, nos chumbadores e na solda` });
  const checks = [...res.checks, ...wc], avisos = [...res.avisos, 'Perna U de pilar treliçado: a 6.7 da NBR 8800:2024 trata pilares I/H; aplicada por analogia (6.7.1.1 / 6.1.1.3) com a U tomada como I de d = bw e bf — decisão B, conferir no projeto.'];
  const calc = checks.filter((c) => !c.info), pool = calc.filter((c) => !c.det || c.res), gov = pool.reduce((a, c) => (!a || c.ratio > a.ratio ? c : a), null);
  return { ...res, checks, avisos, ok: calc.every((c) => c.ok), ratioMax: gov?.ratio || 0, governa: gov, geo: { ...res.geo, perna: U } };
}

/** one plate under both legs (Wanderson): pernas { s (axis distance), U }, placa { H, B, tp, fy }, nb (total, half on each end),
 *  db, a1 (edge → anchor line, along H), concreto { fck, A2A1 }, VA, VB (+ compression), HA (shear). fpd: override of σc,Rd (the
 *  2008 value of the slides, for the oracle test only). */
export function basePlacaUnica({ s, perna: U, placa: Pl, nb = 4, db = 19, a1 = 40, concreto, VA, VB, H: Hk = 0, fpdOverride = null, chumbador = { fy: 250, fu: 400 }, dExt = null, solda = null, NRdPerna = 0, fuPerna = 400 }) {
  const checks = [], avisos = [];
  const g1 = C.GAMMA.a1, g2 = C.GAMMA.a2, H = Pl.H, B = Pl.B, fy = Pl.fy;
  const N = (VA + VB) * 1000, M = (VA - VB) * s / 2 * 1000, V = Math.abs(Hk) * 1000;   // N > 0 compression; M about the plate centre
  const Ma = Math.abs(M), e = Math.abs(N) > 1e-9 ? Ma / Math.abs(N) : Infinity;
  const sR = sigmaCRd(concreto.fck, concreto.A2A1 ?? 1), fpd = fpdOverride ?? sR.v;
  checks.push({ g: 'Esforços na placa única', nome: 'Reações das pernas → N, M, V', ref: 'Wanderson, Mód. 6 p.98 (decisão B)', info: true,
    eq: `N = VA + VB = ${nf(VA)} + ${nf(VB)} = ${nf(kN(N))} kN (${N >= 0 ? 'compressão' : 'tração'}); M = (VA − VB)·s/2 = ${nf(Ma / 1e6, 3)} kN·m; V = ${nf(kN(V))} kN; e = M/N = ${isFinite(e) ? nf(e, 1) : '∞'} mm; H/6 = ${nf(H / 6, 1)}, H/3 = ${nf(H / 3, 1)} mm` });
  checks.push({ g: 'Esforços na placa única', nome: 'Tensão resistente de contato', ref: fpdOverride ? 'valor informado (oráculo da NBR 8800:2008)' : 'NBR 8800:2024 6.6.5', info: true, eq: fpdOverride ? `fpd = ${nf(fpd, 3)} MPa` : sR.eq });
  // d = distance between the OUTER faces of the two legs along H (Wanderson p.96: 520 mm); default s + the smaller leg dimension
  // (larger cantilever m → thicker plate: conservative when the leg orientation is not known)
  const dOut = dExt ?? s + Math.min(U.bw, U.bf), m = (H - 0.95 * dOut) / 2, G = H / 2 - a1, Hl = H / 2 + G, nt = nb / 2;
  let Y, T = 0, f, regime;
  const big = N > 0 ? e > H / 3 : true;
  if (big) {
    // large eccentricity (Wanderson p.92/101): N·G + M = (fpd·Y·B/2)·(H' − Y/3); T = fpd·Y·B/2 − N
    const a = fpd * B / 6, b = fpd * B * Hl / 2, c = N * G + Ma;
    const disc = b * b - 4 * a * c;
    if (disc < 0) { checks.push({ g: 'Concreto', nome: 'Equilíbrio de grande excentricidade', ref: 'Wanderson p.92', eq: 'sem solução real: aumentar a placa', Sd: 1, Rd: 0, ratio: Infinity, ok: false, un: '' }); return { ...C.summarize(checks, avisos) }; }
    Y = (b - Math.sqrt(disc)) / (2 * a); T = fpd * Y * B / 2 - N; f = fpd; regime = 'grande excentricidade (com tração nos chumbadores)';
    if (T <= 0) {   // equilibrium without tension: compression only (correction of the slides — engenheiro de aço)
      T = 0; Y = 3 * (H / 2 - e); f = 2 * N / (Y * B); regime = 'sem tração nos chumbadores: triângulo Y = 3(H/2 − e)';
    }
  } else if (e <= H / 6) { Y = H; f = N / (B * H) + Ma * (H / 2) / (B * H ** 3 / 12); regime = 'pequena excentricidade (núcleo central)'; }
  else { Y = 3 * (H / 2 - e); f = 2 * N / (Y * B); regime = 'excentricidade moderada'; }
  if (big && T > 0) {
    // the method sets f = σc,Rd: the pressure "check" is an identity — what limits is the compressed zone fitting before the anchors
    checks.push({ g: 'Concreto', nome: `Pressão de contato — ${regime}`, ref: 'Wanderson p.92; 6.6.5', info: true, eq: `f = σc,Rd = ${nf(fpd, 3)} MPa no bloco triangular; Y = ${nf(Y, 1)} mm` });
    checks.push(C.det('Concreto', 'Zona comprimida antes da linha de chumbadores', 'Wanderson p.92 (equilíbrio)', `Y = ${nf(Y, 1)} ≤ H′ = H/2 + G = ${nf(Hl, 0)} mm`, Y, Hl, 'max'));
  } else checks.push({ ...C.chk('Concreto', `Pressão de contato — ${regime}`, 'Wanderson p.90–92; 6.6.5', `Y = ${nf(Y, 1)} mm; f = ${nf(f, 3)} MPa ≤ σc,Rd = ${nf(fpd, 3)} MPa`, f, fpd), Sd: f, Rd: fpd, un: 'MPa' });
  // plate: concrete side (cantilever m, triangular pressure) and anchor side (45° width b = m)
  const Mmax = Y < m ? f * Y / 2 * (m - Y / 3) : f * m * m / 2;
  const t1 = Math.sqrt(4 * g1 * Mmax / fy);
  const Ft = nt > 0 ? T / nt : 0, bw45 = m, Ms = Ft * (m - a1), t2 = Ms > 0 ? Math.sqrt(Ms * 6 * g1 / (1.5 * bw45 * fy)) : 0, tmin = Math.max(t1, t2);
  checks.push({ ...C.det('Placa', 'Espessura da placa', 'Wanderson p.103–105 (decisão B)', `m = (H − 0,95d)/2 = (${nf(H, 0)} − 0,95·${nf(dOut, 0)})/2 = ${nf(m, 1)} mm (d = s + bw, faces externas das pernas); lado do concreto: Mmax = ${nf(Mmax, 1)} N·mm/mm → t = √(4γa1·Mmax/fy) = ${nf(t1, 2)} mm; lado dos chumbadores: Ft = ${nf(kN(Ft))} kN, MSd = Ft·(m − a1) = ${nf(Ms / 1e3, 1)} kN·mm, largura 45° = m → t = √(6γa1·MSd/(1,5·m·fy)) = ${nf(t2, 2)} mm; tp = ${nf(Pl.tp, 2)} mm`, Pl.tp, tmin, 'min'), res: true });
  // anchors (6.3.3, A36 — 6.7.1.5-c)
  const Ab = Math.PI * db * db / 4, FtRd = 0.75 * Ab * chumbador.fu / g2, FvRd = 0.45 * Ab * chumbador.fu / g2, Fv = V / nb;
  if (Ft > 0) checks.push(C.chk('Chumbadores', 'Tração', '6.3.3.1', `Ft,Sd = T/${nt} = ${nf(kN(Ft))} kN; Ft,Rd = 0,75·Ab·fu/γa2 = ${nf(kN(FtRd))} kN`, Ft, FtRd));
  checks.push(C.chk('Chumbadores', 'Cisalhamento', '6.3.3.2 (rosca no plano: 0,45)', `Fv,Sd = V/${nb} = ${nf(kN(Fv))} kN; Fv,Rd = ${nf(kN(FvRd))} kN`, Fv, FvRd));
  const it = (Ft / FtRd) ** 2 + (Fv / FvRd) ** 2;
  checks.push({ ...C.chk('Chumbadores', 'Tração e cisalhamento combinados', '6.3.3.4', `(Ft/Ft,Rd)² + (Fv/Fv,Rd)² = ${nf(it, 3)} ≤ 1`, it * 1000, 1000), Sd: it, Rd: 1, un: '' });
  const T18 = tab18(db);
  if (T18) checks.push(C.det('Disposições', 'Borda a1 ≥ Tab. 18 (analogia)', 'Tab. 18 (6.7 por analogia)', `a1 = ${nf(a1, 0)} ≥ ${T18.a1} mm`, a1, T18.a1, 'min'));
  checks.push(C.det('Disposições', 'Diâmetro mínimo do chumbador (Tab. 18: ¾")', 'Tab. 18 (analogia)', `db = ${nf(db, 1)} ≥ 19 mm`, db, 19, 'min'));
  if (solda) for (const [nm, Vi] of [['A', VA], ['B', VB]]) for (const c of legWeld14762({ perna: U, w: solda.w ?? U.t, fu: fuPerna, fw: C.ELECTRODES[solda.eletrodo || 'E70'], N: Vi, V: Math.abs(Hk) / 2, NRdPerna })) checks.push({ ...c, g: `${c.g} — perna ${nm}` });
  avisos.push('Placa única: placa e chumbadores com as reações da análise; o mínimo de 50 % de NRd (NBR 14762 10.1-a) entra na solda de cada perna.');
  avisos.push('Placa única sob as duas pernas (Wanderson): a flexão da placa no vão entre as pernas não é verificada pelo método (LACUNA) — conferir; o modelo tem uma rótula por perna e a placa rígida acopla as duas.');
  avisos.push('Comprimento de ancoragem dos chumbadores: Tabela 18 (h1) por analogia ou NBR 6118 da edição do projeto (Wanderson usa fbd da NBR 6118:2014).');
  return { ...C.summarize(checks, avisos), Y, T: kN(T), m, Mmax, t1, t2, regime, geo: { tipo: 'baseUnica', s, perna: U, placa: Pl, nb, db, a1 } };
}
