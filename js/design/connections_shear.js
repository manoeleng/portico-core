// connections_shear.js — ligação flexível viga–pilar (6.1.3): chapa simples (soldada ao pilar, parafusada na alma)
// ou cantoneira dupla (parafusada na alma e no pilar). NBR 8800:2024 §6; partes com t ≤ 4,75 mm → parafusos e contato
// pela NBR 14762 §10 (10.3.1), elementos pela NBR 8800 6.5 (a 14762 não tem cláusula de elemento de ligação ao
// cisalhamento). Eccentric bolt group by the elastic method (Fakury et al. 2017, 10.14.5). Units: mm, MPa, kN.
//  chapa simples: a = face do pilar (solda) → linha de parafusos; ev = parafuso extremo → borda horizontal da chapa;
//                 eh = linha → borda vertical livre da chapa; ebv = linha → extremidade da viga.
//  cantoneira dupla: a = face do pilar (dorso) → linha da alma; ev = parafuso extremo → ponta da cantoneira;
//                 eh = linha da alma → ponta da aba; gc = dorso → linha no pilar (aba b2); ebv = linha → extremidade da viga.
import * as C from './connections.js?v=7';

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const kN = (N) => N / 1000;
const BIG = 1e9;

/** bolt operations for the norm chosen by the thinnest part */
export function boltOps(norma, { grade, db, rosca = true, dh: dhIn, furo = 'padrao', deform = 'limitada' }) {
  if (norma === '8800') {
    const dh = dhIn ?? C.holeStd8800(db); if (!dh) throw new Error(`furo não tabelado para db = ${db} mm (Tab. 14): informe dh`);
    const fv = C.boltShear8800({ grade, db, rosca });
    return { dh, dn: furo === 'broca' ? dh : dh + 2, fv, ref: '6.3.3.3', refV: '6.3.3.2', emin: C.edgeMin8800(db),
      // dist = centre → edge (borda) or the pitch s (interno)
      bear: (kind, dist, t, fu) => { const lf = kind === 'borda' ? dist - dh / 2 : kind === 'interno' ? dist - dh : BIG; const r = C.bearing8800({ lf, db, t, fu, deform }); return { R: r.R, eq: `${kind === 'livre' ? 'sem borda na direção' : `ℓf = ${nf(lf, 1)} mm`}: ${r.eq}` }; } };
  }
  const dh = dhIn ?? C.holeStd14762(db), fv = C.boltShear14762({ grade, d: db, rosca });
  return { dh, dn: dh, fv, ref: '10.3.4 / 10.3.5', refV: '10.3.7', emin: null,
    bear: (kind, dist, t, fu) => {
      const tA = Math.min(t, 4.75), b = C.bearing14762({ d: db, t: tA, fu }), Rb = b.R * t / tA;
      if (kind === 'livre') return { R: Rb, eq: `esmagamento ${nf(kN(Rb))} kN` };
      const e = kind === 'borda' ? dist : dist - dh / 2, tr = C.tearing14762({ e, t, fu });
      return { R: Math.min(tr.R, Rb), eq: `mín(rasgamento ${tr.eq}; esmagamento ${nf(kN(Rb))} kN)` };
    } };
}
function detailing(checks, ops, norma, { db, s, edges, tmin }) {
  const G = 'Disposições construtivas';
  if (norma === '8800') {
    checks.push(C.det(G, 'Espaçamento entre furos ≥ 2,7·db', '6.3.9', `s = ${nf(s, 1)} ≥ ${nf(2.7 * db, 1)} mm`, s, 2.7 * db, 'min'));
    const smax = Math.min(24 * tmin, 300);
    checks.push(C.det(G, 'Espaçamento máximo', '6.3.10-a', `s = ${nf(s, 1)} ≤ mín(24·${nf(tmin, 2)}; 300) = ${nf(smax, 1)} mm`, s, smax, 'max'));
    for (const [nm, e, t] of edges) {
      if (ops.emin) checks.push(C.det(G, `${nm} ≥ Tab. 16`, '6.3.11.1', `${nf(e, 1)} ≥ ${nf(ops.emin, 1)} mm`, e, ops.emin, 'min'));
      const emax = Math.min(12 * t, 150);
      checks.push(C.det(G, `${nm} ≤ mín(12t; 150)`, '6.3.12', `${nf(e, 1)} ≤ ${nf(emax, 1)} mm`, e, emax, 'max'));
    }
  } else {
    checks.push(C.det(G, 'Distância livre entre furos ≥ 2d', '10.3.3.1', `s − df = ${nf(s - ops.dh, 1)} ≥ ${nf(2 * db, 1)} mm`, s - ops.dh, 2 * db, 'min'));
    for (const [nm, e] of edges) checks.push(C.det(G, `${nm}: borda do furo ≥ d`, '10.3.3.1', `${nf(e, 1)} − df/2 = ${nf(e - ops.dh / 2, 1)} ≥ ${nf(db, 1)} mm`, e - ops.dh / 2, db, 'min'));
  }
}
/** net plastic modulus of a plate tp × hp with holes of width dn centred at ys (y from mid-height) */
export function plateZnet(tp, hp, dn, ys) {
  let Z = tp * hp * hp / 4;
  for (const y of ys) { const a = y - dn / 2, b = y + dn / 2;
    const I = (u, v) => (u >= 0 ? (v * v - u * u) / 2 : v <= 0 ? (u * u - v * v) / 2 : (u * u + v * v) / 2);   // ∫|y|dy
    Z -= tp * I(Math.max(a, -hp / 2), Math.min(b, hp / 2)); }
  return Z;
}

export function shearConnection(inp) {
  const { tipo = 'chapa', V, viga, par, opts = {} } = inp;
  const checks = [], avisos = [];
  const Vd = Math.max(Math.abs(V), opts.excecao45 ? 0 : 45) * 1000;            // 6.1.5.2
  const { db, n, s, rosca = true } = par;
  const ys = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * s);
  checks.push({ g: 'Esforço de cálculo', nome: 'Força cortante de cálculo da ligação', ref: '6.1.5.2', eq: `|VSd| = ${nf(Math.abs(V))} kN${Math.abs(V) < 45 && !opts.excecao45 ? ' < 45 kN → 45 kN (6.1.5.2)' : ''}`, info: true });
  const geo = { tipo, V: kN(Vd), viga, par, ys };

  if (tipo === 'chapa') {
    const { chapa: p, solda: w } = inp;
    const tmin = Math.min(p.t, viga.tw), norma = tmin <= 4.75 ? '14762' : '8800';
    const ops = boltOps(norma, par);
    if (norma === '14762') avisos.push('Parte com t ≤ 4,75 mm: parafusos, rasgamento e esmagamento pela NBR 14762 §10; chapa e solda pela NBR 8800 (6.5, Tab. 9).');
    detailing(checks, ops, norma, { db, s, tmin, edges: [['Borda vertical da chapa (ev)', p.ev, p.t], ['Borda horizontal livre da chapa (eh)', p.eh, p.t], ['Extremidade da viga (ebv)', p.ebv ?? BIG, viga.tw]].filter((e) => e[1] < BIG) });
    const hp = (n - 1) * s + 2 * p.ev;
    // elastic group: bolts on x = 0, load V at the weld (x = −a) → M = V·a about the bolt line
    const grp = C.elasticGroup(ys.map((y) => ({ x: 0, y })), { Vy: -kN(Vd), M: kN(Vd) * p.a });
    const FvSd = grp.Rmax * 1000;
    checks.push(C.chk('Parafusos', `Cisalhamento — grupo excêntrico (e = a = ${nf(p.a, 0)} mm), método elástico`, `${ops.refV}; Fakury 10.14.5`, `V/n = ${nf(kN(Vd) / n)} kN; M = V·a = ${nf(kN(Vd) * p.a / 1000, 3)} kN·m; Σy² = ${nf(grp.J, 0)} mm²; parafuso extremo: fh = M·y/Σy² = ${nf(Math.abs(grp.gov.fx))}, fv = ${nf(Math.abs(grp.gov.fy))} → Fv,Sd = ${nf(grp.Rmax)} kN; ${ops.fv.eq}`, FvSd, ops.fv.R));
    // bearing per bolt: conservative — governing ℓf among the directions of the resultant (vertical and horizontal)
    const plateB = [ops.bear('borda', p.ev, p.t, p.fu), ops.bear('borda', p.eh, p.t, p.fu), n > 1 ? ops.bear('interno', s, p.t, p.fu) : null].filter(Boolean);
    const pb = plateB.reduce((a, c) => c.R < a.R ? c : a);
    checks.push(C.chk('Pressão de contato', 'Contato no furo mais solicitado — chapa', ops.ref, `menor entre as direções (borda vertical ev, borda livre eh${n > 1 ? ', furo adjacente' : ''}): ${pb.eq}`, FvSd, pb.R));
    const webB = [p.ebv ? ops.bear('borda', p.ebv, viga.tw, viga.fu) : null, n > 1 ? ops.bear('interno', s, viga.tw, viga.fu) : ops.bear('livre', 0, viga.tw, viga.fu)].filter(Boolean);
    const wb = webB.reduce((a, c) => c.R < a.R ? c : a);
    checks.push(C.chk('Pressão de contato', 'Contato no furo mais solicitado — alma da viga', ops.ref, `menor entre as direções: ${wb.eq}`, FvSd, wb.R));
    // plate as element (6.5.5, 6.5.6)
    const sh = C.shearElement8800({ Agv: hp * p.t, Anv: (hp - n * ops.dn) * p.t, fy: p.fy, fu: p.fu });
    checks.push(C.chk('Chapa', 'Cisalhamento da chapa (seção bruta e líquida)', '6.5.5', `hp = (n − 1)·s + 2·ev = ${nf(hp, 0)} mm; Agv = ${nf(hp * p.t, 0)}, Anv = ${nf((hp - n * ops.dn) * p.t, 0)} mm²; ${sh.eq}`, Vd, sh.R));
    const bAgv = (p.ev + (n - 1) * s) * p.t, bAnv = bAgv - (n - 0.5) * ops.dn * p.t, bAnt = (p.eh - 0.5 * ops.dn) * p.t;
    const bk = C.blockShear8800({ Agv: bAgv, Anv: bAnv, Ant: bAnt, fy: p.fy, fu: p.fu, Cts: 1 });
    checks.push(C.chk('Chapa', 'Colapso por rasgamento da chapa', '6.5.6', `Agv = ${nf(bAgv, 0)}, Anv = ${nf(bAnv, 0)}, Ant = ${nf(bAnt, 0)} mm², Cts = 1; ${bk.eq}`, Vd, bk.R));
    // flexure (Fakury 10.12.5: chapter 8 + rupture fu·Zef/γa2), M = V·a
    const M = Vd * p.a, Zg = p.t * hp * hp / 4, Zn = plateZnet(p.t, hp, ops.dn, ys);
    const My = Zg * p.fy / C.GAMMA.a1, Mu = Zn * p.fu / C.GAMMA.a2;
    checks.push({ ...C.chk('Chapa', 'Flexão da chapa — escoamento (seção bruta)', '5.4.2 (seção retangular); Fakury 10.12.5', `MSd = V·a = ${nf(M / 1e6, 3)} kN·m; Z = t·hp²/4 = ${nf(Zg, 0)} mm³; MRd = Z·fy/γa1 = ${nf(My / 1e6, 3)} kN·m`, M / 1000, My / 1000), Sd: M / 1e6, Rd: My / 1e6, un: 'kN·m' });
    checks.push({ ...C.chk('Chapa', 'Flexão da chapa — ruptura na linha de furos', 'Fakury 10.12.5 (MRd = fu·Zef/γa2)', `Zef = ${nf(Zn, 0)} mm³; MRd = ${nf(Zn, 0)}·${nf(p.fu, 0)}/1,35 = ${nf(Mu / 1e6, 3)} kN·m`, M / 1000, Mu / 1000), Sd: M / 1e6, Rd: Mu / 1e6, un: 'kN·m' });
    avisos.push('Flambagem lateral com torção da chapa simples não verificada (chapas curtas usuais); para chapa alta e delgada verificar pela NBR 8800 Anexo G.');
    // weld plate → column: 2 fillets of length hp, V and M = V·a, elastic per unit length
    const fw = C.ELECTRODES[w.eletrodo || 'E70'];
    const fv = Vd / (2 * hp), fm = 3 * M / (hp * hp), f = Math.hypot(fv, fm), q = 0.6 * 0.707 * w.dw * fw / C.GAMMA.w2;
    checks.push({ ...C.chk('Solda chapa–pilar', 'Filetes (2 × hp), V + M, distribuição elástica', 'Tab. 9; 6.2.5.1', `fv = V/(2hp) = ${nf(fv / 1000, 4)}, fm = M/(2·hp²/6) = ${nf(fm / 1000, 4)} → f = ${nf(f / 1000, 4)} kN/mm; resistência = 0,6·0,707·${nf(w.dw, 1)}·${nf(fw, 0)}/1,35 = ${nf(q / 1000, 4)} kN/mm`, f, q), Sd: f / 1000, Rd: q / 1000, un: 'kN/mm' });
    const dmin = C.filletMin8800(Math.min(p.t, inp.pilar?.t ?? p.t));
    checks.push(C.det('Disposições construtivas', 'Perna mínima do filete (Tab. 11)', '6.2.6.2.1', `dw = ${nf(w.dw, 1)} ≥ ${nf(dmin, 1)} mm`, w.dw, dmin, 'min'));
    avisos.push('Metal-base do pilar na região da solda e a alma da viga recortada (se houver recorte) são verificados à parte.');
    Object.assign(geo, { chapa: p, hp, norma });
    return { ...C.summarize(checks, avisos), norma, V: kN(Vd), geo };
  }

  // ---------------- double angle
  const { cant: a, pilar: col } = inp;
  const tmin = Math.min(a.t, viga.tw, col.t), norma = tmin <= 4.75 ? '14762' : '8800';
  const ops = boltOps(norma, par);
  if (norma === '14762') avisos.push('Parte com t ≤ 4,75 mm: parafusos, rasgamento e esmagamento pela NBR 14762 §10; cantoneiras e alma pela NBR 8800 6.5.');
  const L = a.L ?? (n - 1) * s + 2 * a.ev;
  detailing(checks, ops, norma, { db, s, tmin, edges: [['Ponta da cantoneira (ev)', a.ev, a.t], ['Ponta da aba na alma (eh)', a.eh, a.t], ['Ponta da aba no pilar', a.b2 - a.gc, a.t], ...(a.ebv ? [['Extremidade da viga (ebv)', a.ebv, viga.tw]] : [])] });
  const exc = opts.excentricidade !== false;
  const grp = C.elasticGroup(ys.map((y) => ({ x: 0, y })), { Vy: -kN(Vd), M: exc ? kN(Vd) * a.a : 0 });
  const FvSd = grp.Rmax * 1000 / 2;                                              // per shear plane (2 planes)
  checks.push(C.chk('Parafusos na alma da viga', `Cisalhamento (corte duplo)${exc ? `, grupo excêntrico e = ${nf(a.a, 0)} mm` : ', excentricidade desprezada (Fakury 10.14.8.2)'}`, ops.refV, `${exc ? `M = V·a = ${nf(kN(Vd) * a.a / 1000, 3)} kN·m; Σy² = ${nf(grp.J, 0)} mm²; ` : ''}resultante no parafuso mais solicitado = ${nf(grp.Rmax)} kN → por plano ${nf(kN(FvSd))} kN; ${ops.fv.eq}`, FvSd, ops.fv.R));
  // bearing: angles (2·t) — vertical: bottom bolt to the angle end (ev), others the pitch; web — pitch (top bolt free)
  const angDirs = [ops.bear('borda', a.ev, 2 * a.t, a.fu), ...(n > 1 ? [ops.bear('interno', s, 2 * a.t, a.fu)] : []), ...(exc ? [ops.bear('borda', a.eh, 2 * a.t, a.fu)] : [])];
  const ab = angDirs.reduce((x, c) => c.R < x.R ? c : x);
  checks.push(C.chk('Pressão de contato', 'Contato no furo mais solicitado — cantoneiras (2t)', ops.ref, `menor entre as direções: ${ab.eq}`, grp.Rmax * 1000, ab.R));
  const webDirs = [n > 1 ? ops.bear('interno', s, viga.tw, viga.fu) : ops.bear('livre', 0, viga.tw, viga.fu), ...(exc && a.ebv ? [ops.bear('borda', a.ebv, viga.tw, viga.fu)] : [])];
  const wb = webDirs.reduce((x, c) => c.R < x.R ? c : x);
  checks.push(C.chk('Pressão de contato', 'Contato no furo mais solicitado — alma da viga', ops.ref, `menor entre as direções: ${wb.eq}`, grp.Rmax * 1000, wb.R));
  // angles as elements, 2 angles
  const sh = C.shearElement8800({ Agv: 2 * L * a.t, Anv: 2 * (L - n * ops.dn) * a.t, fy: a.fy, fu: a.fu });
  checks.push(C.chk('Cantoneiras', 'Cisalhamento das 2 cantoneiras', '6.5.5', `L = ${nf(L, 0)} mm; Agv = 2·L·t = ${nf(2 * L * a.t, 0)}, Anv = 2·(L − n·dn)·t = ${nf(2 * (L - n * ops.dn) * a.t, 0)} mm²; ${sh.eq}`, Vd, sh.R));
  const bAgv = 2 * (a.ev + (n - 1) * s) * a.t, bAnv = bAgv - 2 * (n - 0.5) * ops.dn * a.t, bAnt = 2 * (a.eh - 0.5 * ops.dn) * a.t;
  const bk = C.blockShear8800({ Agv: bAgv, Anv: bAnv, Ant: bAnt, fy: a.fy, fu: a.fu, Cts: 1 });
  checks.push(C.chk('Cantoneiras', 'Colapso por rasgamento das 2 cantoneiras (aba na alma)', '6.5.6', `Agv = ${nf(bAgv, 0)}, Anv = ${nf(bAnv, 0)}, Ant = ${nf(bAnt, 0)} mm², Cts = 1; ${bk.eq}`, Vd, bk.R));
  if (viga.d > 0) {
    const vw = C.shearElement8800({ Agv: viga.d * viga.tw, Anv: (viga.d - n * ops.dn) * viga.tw, fy: viga.fy, fu: viga.fu });
    checks.push(C.chk('Viga', 'Cisalhamento da alma da viga na ligação', '6.5.5', `Agv = d·tw = ${nf(viga.d * viga.tw, 0)}, Anv = (d − n·dn)·tw = ${nf((viga.d - n * ops.dn) * viga.tw, 0)} mm²; ${vw.eq}`, Vd, vw.R));
  }
  // column side: 2n bolts in single shear, eccentricity neglected (usual practice — Fakury 10.14.8.2)
  const FvC = Vd / (2 * n);
  checks.push(C.chk('Parafusos no pilar', `Cisalhamento (2 × ${n} parafusos, corte simples)`, ops.refV, `Fv,Sd = V/(2n) = ${nf(kN(FvC))} kN; ${ops.fv.eq}`, FvC, ops.fv.R));
  const cb = [ops.bear('borda', a.ev, a.t, a.fu), ...(n > 1 ? [ops.bear('interno', s, a.t, a.fu)] : [])].reduce((x, c) => c.R < x.R ? c : x);
  checks.push(C.chk('Pressão de contato', 'Contato — aba da cantoneira no pilar', ops.ref, cb.eq, FvC, cb.R));
  const cc = (n > 1 ? ops.bear('interno', s, col.t, col.fu) : ops.bear('livre', 0, col.t, col.fu));
  checks.push(C.chk('Pressão de contato', 'Contato — mesa/alma do pilar', ops.ref, cc.eq, FvC, cc.R));
  avisos.push('Lado do pilar: excentricidade dos parafusos desprezada (prática usual, Fakury 10.14.8.2); verificar a alma da viga recortada, se houver recorte.');
  Object.assign(geo, { cant: a, L, norma, exc });
  return { ...C.summarize(checks, avisos), norma, V: kN(Vd), geo };
}
