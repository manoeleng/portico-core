// connections_rigid.js — rigid welded beam–column (LMSS: beam flanges with complete-joint-penetration welds, web with a double
// fillet) and welded splice of I members (complete or partial penetration). NBR 8800:2024: Tab. 9 (CJP: metal-base AMB·fy/γa1
// in tension/compression, 0,6·AMB·fy/γa1 in shear; PJP: Tab. 6/10, mín(AMB·fy/γa1; 0,6·Aw·fw/γw1)), 6.2.6.1 (PJP forbidden in
// splices of members in bending), 6.1.12 (heavy shapes), column side by 5.7 (5.7.2 flexão local da mesa, 5.7.3 escoamento
// local da alma, 5.7.4 enrugamento, 5.7.6 instabilidade por compressão, 5.7.7 painel de alma with VRd of 5.4.3.1, 5.7.9
// enrijecedores, 5.7.7.2 chapas de reforço). Literature (decisão B, declared): flange force Ff = M/(d − tf) ± N/2 (Manual
// Gerdau "Ligações para estruturas de aço", LMSS 7.4); splice moment split by stiffness Mf = M·If/I, Mw = M·Iw/I (Saulo
// J. C. Almeida, Especialização INBEC 2016, Mód. 13 "Ligações III", Parte 3_B). Units: mm, MPa, N internally; kN, kN·m I/O.
import * as C from './connections.js?v=7';
const { PLATES } = C;

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const kN = (N) => N / 1000;
const E = C.E_ACO, g1 = C.GAMMA.a1, g2 = C.GAMMA.a2;

/** 5.4.3.1.1 VRd of an I web panel: Aw = d·tw, h = clear web, kv = 5,34 (no stiffeners) or 5 + 5/(a/h)² */
export function webShear(d, h, tw, fy, a = null) {
  const kv = a && a / h <= 3 ? 5 + 5 / (a / h) ** 2 : 5.34;
  const lam = h / tw, lp = 1.10 * Math.sqrt(kv * E / fy), lr = 1.37 * Math.sqrt(kv * E / fy), Vpl = 0.6 * d * tw * fy;
  const V = lam <= lp ? Vpl / g1 : lam <= lr ? lp / lam * Vpl / g1 : 1.24 * (lp / lam) ** 2 * Vpl / g1;
  return { V, kv, lam, lp, lr, Vpl, eq: `λ = h/tw = ${nf(lam, 1)}; kv = ${nf(kv, 2)}; λp = 1,10√(kv·E/fy) = ${nf(lp, 1)}; λr = ${nf(lr, 1)}; Vpℓ = 0,6·d·tw·fy = ${nf(kN(Vpl), 1)} kN → VRd = ${nf(kN(V), 1)} kN` };
}
/** 5.3 compression of a cruciform stiffener (pair, both sides of the web) + web strip, about the web mid-plane (5.7.9.4) */
function stiffenerColumn(bs, ts, tw, strip, KL, fy) {
  const A = 2 * bs * ts + strip * tw, I = ts * (2 * bs + tw) ** 3 / 12, Ne = Math.PI ** 2 * E * I / KL ** 2;
  const l0 = Math.sqrt(A * fy / Ne), chi = l0 <= 1.5 ? 0.658 ** (l0 * l0) : 0.877 / (l0 * l0);
  return { R: chi * A * fy / g1, chi, l0, A };
}

/* ------------------------------------------------------------------------------------------------ LMSS */
/** viga {d,bf,tf,tw,fy,fu, Zx?}; pilar {d,bf,tf,tw,r (fillet radius),fy,fu,A}; M (kN·m), V, N (beam, + tension), Ncol (column,
 *  compression > 0), Vcol (column shear at the joint, SIGNED: > 0 = same sense as the flange force → adds in the panel, 5.7.7.1
 *  "somada algebricamente"; < 0 reduces; the model adapter passes +|V| when the sense is unknown — conservative), lados 1|2, M2 (other beam, 2-sided, kN·m, sign: same sense → adds in
 *  the panel), extremidade (joint at the column top: distance to the end < d), solda {dw, eletrodo}, enrij (bool or {bs, ts}),
 *  reforco (doubler plate thickness each side, mm) */
export function lmssConnection({ viga: B, pilar: P, M, V = 0, N = 0, Ncol = 0, Vcol = 0, lados = 1, M2 = 0, extremidade = false, solda = { dw: 6, eletrodo: 'E70' }, enrij = null, reforco = 0 }) {
  const checks = [], avisos = [];
  const Md = Math.abs(M) * 1e6, Nb = Math.abs(N) * 1000, Vd = Math.max(Math.abs(V), 45) * 1000;
  const h0 = B.d - B.tf, Ff = Md / h0 + Nb / 2;
  checks.push({ g: 'Esforços', nome: 'Força nas mesas da viga', ref: 'Gerdau LMSS 7.4 (decisão B)', info: true,
    eq: `Ff = MSd/(d − tf) + |NSd|/2 = ${nf(Math.abs(M), 3)}·10⁶/${nf(h0, 1)} + ${nf(Math.abs(N))}·10³/2 = ${nf(kN(Ff), 1)} kN; V = ${nf(kN(Vd), 1)} kN` });
  // beam side
  const Af = B.bf * B.tf;
  checks.push({ g: 'Viga — soldas', nome: 'Mesas: penetração total, compatibilidade total', ref: 'Tab. 9; Gerdau LMSS 7.4 / AISC Manual Part 12 (decisão B)', info: true,
    eq: 'Solda de penetração total com metal compatível: resistência igual à do metal-base da mesa — verificação da solda dispensada; a flexão é verificada na seção da viga (abaixo) e Ff vai para o pilar' });
  const Zx = B.Zx ?? (Af * h0 + B.tw * (B.d - 2 * B.tf) ** 2 / 4), Mpl = Math.min(Zx, B.Wx ? 1.5 * B.Wx : Infinity) * B.fy / g1;   // 5.4.2: Z·fy/γa1 ≤ 1,5·W·fy/γa1
  checks.push({ ...C.chk('Viga — soldas', 'Momento da viga junto à ligação (plastificação)', '5.4.2 (seção compacta admitida — FLM/FLA no dimensionamento da barra)', `Z = ${nf(Zx / 1e3, 1)} cm³; MRd = Z·fy/γa1 = ${nf(Mpl / 1e6, 2)} kN·m`, Md / 1000, Mpl / 1000), Sd: Md / 1e6, Rd: Mpl / 1e6, un: 'kN·m' });
  const fw = C.ELECTRODES[solda.eletrodo || 'E70'], hw = B.d - 2 * B.tf, q = 2 * 0.6 * 0.707 * solda.dw * fw / C.GAMMA.w2 * hw;
  checks.push(C.chk('Viga — soldas', `Alma: filete duplo ${nf(solda.dw, 1)} mm × ${nf(hw, 0)} mm (força cortante)`, 'Tab. 9', `Fw,Rd = 2·0,6·0,707·dw·fw/γw2·hw = ${nf(kN(q), 1)} kN`, Vd, q));
  const dmin = C.filletMin8800(Math.min(B.tw, P.tf));
  checks.push(C.det('Disposições construtivas', 'Perna mínima do filete da alma (Tab. 11)', '6.2.6.2.1', `dw = ${nf(solda.dw, 1)} ≥ ${nf(dmin, 1)} mm`, solda.dw, dmin, 'min'));
  const sw = C.shearElement8800({ Agv: hw * B.tw, Anv: hw * B.tw, fy: B.fy, fu: B.fu });
  checks.push(C.chk('Viga — soldas', 'Metal-base da alma da viga ao longo do filete', 'Tab. 9 → 6.5.5', sw.eq, Vd, sw.R));
  // column side — 5.7 (forces of the beam flanges, ℓn = tf of the beam)
  const k = P.tf + (P.r ?? 0), ln = B.tf, hc = P.d - 2 * k, G = 'Pilar — forças localizadas (5.7)';
  const r572 = 6.25 * P.tf ** 2 * P.fy / g1 * (extremidade ? 0.5 : 1);
  const r573 = 1.10 * ((extremidade ? 2.5 : 5) * k + ln) * P.fy * P.tw / g1;
  const lnd = ln / P.d, base = P.tw ** 2 / g1 * Math.sqrt(E * P.fy * P.tf / P.tw);
  const r574 = extremidade ? (lnd <= 0.2 ? 0.33 * base * (1 + 3 * lnd * (P.tw / P.tf) ** 1.5) : 0.33 * base * (1 + (4 * lnd - 0.2) * (P.tw / P.tf) ** 1.5)) : 0.66 * base * (1 + 3 * lnd * (P.tw / P.tf) ** 1.5);
  const r576 = 24 * P.tw ** 3 * Math.sqrt(E * P.fy) / (g1 * hc) * (extremidade ? 0.5 : 1);
  const loc = [
    ['Flexão local da mesa (mesa tracionada)', '5.7.2', `FRd = 6,25·tf²·fy/γa1${extremidade ? ' × 0,5 (5.7.2.3)' : ''} = ${nf(kN(r572), 1)} kN`, r572, 'tracao'],
    ['Escoamento local da alma', '5.7.3', `FRd = 1,10·(${extremidade ? '2,5' : '5'}k + ℓn)·fy·tw/γa1, k = tf + r = ${nf(k, 1)}, ℓn = ${nf(ln, 1)} → ${nf(kN(r573), 1)} kN`, r573, 'ambas'],
    ['Enrugamento da alma (mesa comprimida)', '5.7.4', `FRd = ${extremidade ? '0,33' : '0,66'}·tw²/γa1·[1 + 3(ℓn/d)(tw/tf)^1,5]·√(E·fy·tf/tw) = ${nf(kN(r574), 1)} kN`, r574, 'compressao'],
  ];
  if (lados === 2) loc.push(['Instabilidade da alma por compressão (par de forças)', '5.7.6', `FRd = 24·tw³·√(E·fy)/(γa1·h)${extremidade ? ' × 0,5' : ''}, h = ${nf(hc, 0)} → ${nf(kN(r576), 1)} kN`, r576, 'compressao']);
  let need = 0, needT = 0, needC = 0; const failedLoc = [];
  for (const [nome, ref, eq, R, kind] of loc) {
    const c = C.chk(G, nome, ref, eq, Ff, R); checks.push(c); if (!c.ok) failedLoc.push({ c, R });
    if (!c.ok) { need = Math.max(need, Ff - R); if (kind !== 'compressao') needT = Math.max(needT, Ff - R); if (kind !== 'tracao') needC = Math.max(needC, Ff - R); }
  }
  if (extremidade) avisos.push('Nó no topo do pilar: reduções de extremidade aplicadas a 5.7.2, 5.7.3, 5.7.4 e 5.7.6 juntas (as distâncias da norma são 10tf, d e d/2) — conservador, exceto se 10tf > d.');
  avisos.push('5.7.5 (flambagem lateral da alma) não se aplica à alma do pilar no nó contida pela viga; verificar se o pilar não tiver contenção lateral no nível da ligação.');
  // stiffeners 5.7.9 (when needed or requested)
  let st = null;
  if (need > 0 || enrij) {
    const bsMin = B.bf / 3 - P.tw / 2, bsMax = (P.bf - P.tw) / 2;
    const bs = enrij?.bs ?? Math.min(bsMax, Math.max(Math.ceil(bsMin / 5) * 5, 50));
    let ts = enrij?.ts ?? PLATES.find((t) => t >= Math.max(B.tf / 2, bs / 16) && (2 * bs * t * P.fy / g1 >= needT) && (1.8 * P.fy * 2 * (bs - 15) * t / g2 >= needC)) ?? 50;
    st = { bs, ts };
    const Gs = 'Pilar — enrijecedores transversais (5.7.9)';
    checks.push(C.det(Gs, 'Largura: bs + tw/2 ≥ bf da viga/3', '5.7.9.5-a', `bs = ${nf(bs, 0)}; bs + tw/2 = ${nf(bs + P.tw / 2, 1)} ≥ ${nf(B.bf / 3, 1)} mm`, bs + P.tw / 2, B.bf / 3, 'min'));
    checks.push(C.det(Gs, 'Espessura ≥ tf da viga/2 e ≥ bs/16', '5.7.9.5-b', `ts = ${nf(ts, 2)} ≥ máx(${nf(B.tf / 2, 2)}; ${nf(bs / 16, 2)}) mm`, ts, Math.max(B.tf / 2, bs / 16), 'min'));
    if (needT > 0) { const R = 2 * bs * ts * P.fy / g1; checks.push(C.chk(Gs, 'Par tracionado: escoamento (5.2) para a diferença Ff − FRd', '5.7.9.1', `As = 2·bs·ts = ${nf(2 * bs * ts, 0)} mm²; Nt,Rd = As·fy/γa1 = ${nf(kN(R), 1)} kN`, needT, R)); }
    if (needC > 0) {
      const Ac = 2 * (bs - 15) * ts, R = 1.8 * P.fy * Ac / g2;      // contact area minus 15 mm corner clips (recortes)
      checks.push(C.chk(Gs, 'Par comprimido: esmagamento no contato com a mesa (6.6.2)', '5.7.9.2; 6.6.2', `A = 2·(bs − 15)·ts = ${nf(Ac, 0)} mm² (recorte de 15 mm nos cantos); FRd = 1,8·fy·A/γa2 = ${nf(kN(R), 1)} kN`, needC, R));
      if (lados === 2) { const sc = stiffenerColumn(bs, ts, P.tw, (extremidade ? 12 : 25) * P.tw, 0.75 * hc, P.fy);
        checks.push(C.chk(Gs, `Par comprimido como barra (enrijecedores + ${extremidade ? 12 : 25}·tw de alma, L = 0,75h)`, '5.7.9.4 → 5.3', `A = ${nf(sc.A, 0)} mm²; λ0 = ${nf(sc.l0, 3)}; χ = ${nf(sc.chi, 3)}; Nc,Rd = ${nf(kN(sc.R), 1)} kN`, Ff, sc.R)); }
    }
    // the localized checks exceeded are now resisted by the stiffeners (5.7.2.4, 5.7.3.3, 5.7.4.3, 5.7.6.4)
    for (const { c, R } of failedLoc) { c.info = true; c.ok = true; c.eq += ` — sem enrijecedor NÃO atende (razão ${nf(c.ratio, 3)}); excedente Ff − FRd = ${nf(kN(Ff - R), 1)} kN resistido pelos enrijecedores (5.7.9)`; }
    avisos.push(`Enrijecedores ${nf(bs, 0)} × ${nf(ts, 2)} mm (par, nas duas mesas da viga): soldas enrijecedor–mesa e enrijecedor–alma dimensionadas para a diferença entre a força solicitante e a resistente (5.7.9.1/5.7.9.2); ${lados === 2 ? 'altura total da alma' : 'pelo menos 3/4 da altura da alma (compressão) e metade (tração)'}.`);
  }
  // panel zone 5.7.7
  const FSd = Math.max(0, (lados === 2 ? (Md + Math.abs(M2) * 1e6) / h0 : Ff) + Vcol * 1000);   // 5.7.7.1: algebraic sum with the column shear
  const hp = P.d - 2 * k, a = st ? B.d - B.tf : null;
  let wv = webShear(P.d, hp, P.tw, P.fy, a), Npl = (P.A ?? (2 * P.bf * P.tf + (P.d - 2 * P.tf) * P.tw)) * P.fy, NSd = Math.max(0, Ncol * 1000);
  const red = NSd > 0.4 * Npl ? 1.4 - NSd / Npl : 1;
  let FRd = wv.V * red, extra = '';
  if (reforco > 0) { const vr = 2 * 0.6 * P.d * reforco * P.fy / g1; FRd += vr; extra = `; chapas de reforço 2 × ${nf(reforco, 1)} mm: + 2·0,6·dc·t·fy/γa1 = ${nf(kN(vr), 1)} kN (5.7.7.2)`; }
  checks.push(C.chk('Pilar — painel de alma (5.7.7)', 'Cisalhamento do painel de alma', '5.7.7.1; 5.4.3.1 (Aw = dc·tw)', `FSd = ${lados === 2 ? '(M1 + M2)/(d − tf)' : 'Ff'} ${Vcol >= 0 ? '+' : '−'} |Vpilar| (soma algébrica, ${Vcol >= 0 ? 'mesmo sentido ou sentido desconhecido — conservador' : 'sentido oposto'}) = ${nf(kN(FSd), 1)} kN; ${wv.eq}${red < 1 ? `; NSd > 0,4Npℓ → × (1,4 − NSd/Npℓ) = ${nf(red, 3)}` : ''}${extra}; FRd = ${nf(kN(FRd), 1)} kN`, FSd, FRd));
  if (FSd > FRd && !(reforco > 0)) {
    const tReq = (FSd - wv.V * red) / (2 * 0.6 * P.d * P.fy / g1), t = PLATES.find((x) => x >= tReq) ?? 50;
    avisos.push(`Painel de alma: usar chapas de reforço de ${nf(t, 1)} mm dos dois lados (5.7.7.2), estendidas 150 mm além das mesas da viga, soldadas às mesas do pilar.`);
  }
  if (Math.max(B.tf, B.tw, P.tf, P.tw) > 50) avisos.push('Espessura > 50 mm com penetração total: requisitos de 6.1.12 (tenacidade, aberturas de acesso 6.1.13).');
  avisos.push('Aberturas de acesso para a solda de penetração total das mesas: 6.1.13 (comprimento ≥ 1,5tw e ≥ 40 mm; altura ≥ tw e ≥ 20 mm; raio ≥ 10 mm).');
  return { ...C.summarize(checks, avisos), Ff: kN(Ff), enrijecedores: st, geo: { tipo: 'lmss', viga: B, pilar: P, enrij: st, lados } };
}

/* ------------------------------------------------------------------------------------------------ welded splice */
/** perfil {d,bf,tf,tw,fy,fu}; N (kN, + tension), M (kN·m), V (kN); penetracao 'total' | 'parcial' (garganta mm for flanges and
 *  web, Tab. 6), eletrodo */
export function weldedSplice({ perfil: P, N = 0, M = 0, V = 0, penetracao = 'total', garganta = null, eletrodo = 'E70' }) {
  const checks = [], avisos = [];
  const { d, bf, tf, tw, fy } = P, hw = d - 2 * tf, Af = bf * tf, Aw = hw * tw, A = 2 * Af + Aw;
  const If = 2 * (bf * tf ** 3 / 12 + Af * ((d - tf) / 2) ** 2), Iw = tw * hw ** 3 / 12, I = If + Iw;
  const Md = Math.abs(M) * 1e6, Nd = N * 1000, Vd = Math.abs(V) * 1000;
  const Mf = Md * If / I, Mw = Md * Iw / I, Ff = Mf / (d - tf) + Math.abs(Nd) * Af / A;
  checks.push({ g: 'Esforços', nome: 'Distribuição entre mesas e alma (rigidez)', ref: 'Saulo Almeida, INBEC Mód. 13 (decisão B)', info: true,
    eq: `If = ${nf(If / 1e4, 0)}, Iw = ${nf(Iw / 1e4, 0)}, I = ${nf(I / 1e4, 0)} cm⁴; Mf = M·If/I = ${nf(Mf / 1e6, 2)}, Mw = M·Iw/I = ${nf(Mw / 1e6, 2)} kN·m; Ff = Mf/(d − tf) + |N|·Af/A = ${nf(kN(Ff), 1)} kN` });
  const fw = C.ELECTRODES[eletrodo];
  if (penetracao === 'parcial' && Md > 0) {
    checks.push({ g: 'Solda', nome: 'Penetração parcial em emenda de peça fletida', ref: '6.2.6.1', eq: '"Não podem ser usadas soldas de penetração parcial em emendas de peças fletidas" — usar penetração total', Sd: 1, Rd: 0, ratio: Infinity, ok: false, un: '' });
  }
  if (penetracao === 'total') {
    const Rf = Af * fy / g1;
    checks.push(C.chk('Solda', 'Mesas: penetração total', 'Tab. 9 (AMB·fy/γa1); 6.2.2.1', `garganta = menor espessura; AMB = ${nf(Af, 0)} mm²; Fw,Rd = ${nf(kN(Rf), 1)} kN`, Ff, Rf));
    const sig = Math.abs(Nd) * (Aw / A) / Aw + Mw / (tw * hw * hw / 6), sRd = fy / g1;
    checks.push({ ...C.chk('Solda', 'Alma: penetração total — tensão normal', 'Tab. 9 (AMB·fy/γa1)', `σ = |N|·(Aw/A)/Aw + Mw/(tw·hw²/6) = ${nf(sig, 1)} MPa ≤ fy/γa1 = ${nf(sRd, 1)} MPa`, sig, sRd), Sd: sig, Rd: sRd, un: 'MPa' });
    const Rv = 0.6 * Aw * fy / g1;
    checks.push(C.chk('Solda', 'Alma: penetração total — cisalhamento', 'Tab. 9 (0,6·AMB·fy/γa1)', `AMB = hw·tw = ${nf(Aw, 0)} mm²; ${nf(kN(Rv), 1)} kN`, Vd, Rv));
  } else {
    const te = garganta, tmin = Math.min(tf, tw), Tab10 = tmin <= 6.3 ? 3 : tmin <= 12.5 ? 5 : tmin <= 19 ? 6 : tmin <= 37.5 ? 8 : tmin <= 57 ? 10 : tmin <= 150 ? 13 : 16;
    checks.push(C.det('Disposições construtivas', 'Garganta efetiva mínima (Tab. 10)', '6.2.6.1', `te = ${nf(te, 1)} ≥ ${Tab10} mm (menor espessura ${nf(tmin, 1)})`, te, Tab10, 'min'));
    const Awf = 2 * bf * te, Aww = hw * te;   // PJP from both sides? one-sided throat te on each element (user throat)
    const Rn = Math.min(A * fy / g1, 0.6 * (Awf + Aww) * fw / 1.25);
    checks.push(C.chk('Solda', 'Penetração parcial — tração/compressão normal (força axial)', 'Tab. 9 (mín(AMB·fy/γa1; 0,6·Aw·fw/γw1), γw1 = 1,25)', `Aw = ${nf(Awf + Aww, 0)} mm²; FRd = ${nf(kN(Rn), 1)} kN`, Math.abs(Nd), Rn));
    const Rv = Math.min(0.6 * Aww * fw / C.GAMMA.w2, 0.6 * Aw * fy / g1);
    checks.push(C.chk('Solda', 'Penetração parcial — cisalhamento na alma', 'Tab. 9 (0,6·Aw·fw/γw2); 6.5.5', `Aw = hw·te = ${nf(Aww, 0)} mm²; FRd = ${nf(kN(Rv), 1)} kN`, Vd, Rv));
  }
  if (Math.max(tf, tw) > 50) avisos.push('Mesa ou alma > 50 mm com penetração total sob tração: 6.1.12 (tenacidade 12.2.1.5, metal da solda 6.2.4.2-b, aberturas 6.1.13).');
  avisos.push('Penetração total: metal da solda com compatibilidade total (Tab. 8); preparação e qualificação conforme AWS D1.1 (6.2.4).');
  return { ...C.summarize(checks, avisos), geo: { tipo: 'emendaSoldada', perfil: P, penetracao } };
}
