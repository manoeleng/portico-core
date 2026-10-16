// connections_splice.js — emenda parafusada com talas: (a) barra chata/chapa tracionada ou comprimida com 1 ou 2 talas;
// (b) perfil I: talas nas mesas (N e M, Fakury 10.14.7: Nmesa = MSd/h0 ± NSd/2, h0 = d − tf) e 2 talas na alma (V com a
// excentricidade e = folga/2 + borda + metade do grupo, método elástico). NBR 8800:2024 §6 (6.3.8 ligação longa
// > 950 mm × 1,20; 6.5.3 Ae = An ≤ 0,85Ag nas talas; 6.5.4 → 5.3 com K = 0,65 e L = 2·e1 + folga, Fakury 10.14.7;
// 6.5.6 com Cts = 0,5 nas faixas externas, Fakury perímetro 2); partes com t ≤ 4,75 mm → parafusos pela NBR 14762.
// Units: mm, MPa, kN, kN·m.
import * as C from './connections.js?v=7';
import { boltOps, plateZnet } from './connections_shear.js?v=7';

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const kN = (N) => N / 1000;

/** one plate splice (member plate + talas), force F [N] (> 0 tension). Pushes checks; prefix names the part. */
function splicePlate({ checks, avisos, pre, mem, tal, par, F, folga = 10 }) {
  const { db, linhas, ncol, s, g = 0, e1, et, e2 } = par;
  const tmin = Math.min(mem.t, tal.t), norma = mem.formadoFrio && tmin <= 4.75 ? '14762' : '8800';   // 14762 only for cold-formed parts
  const ops = boltOps(norma, par), dh = ops.dh, dn = ops.dn;
  const tr = F > 0, Fa = Math.abs(F), nb = linhas * ncol, np = tal.n;
  const G = `${pre} — disposições construtivas`;
  if (norma === '8800') {
    checks.push(C.det(G, 'Espaçamento ≥ 2,7·db', '6.3.9', `s = ${nf(s, 1)} ≥ ${nf(2.7 * db, 1)} mm`, s, 2.7 * db, 'min'));
    if (linhas > 1) checks.push(C.det(G, 'Gabarito ≥ 2,7·db', '6.3.9', `g = ${nf(g, 1)} ≥ ${nf(2.7 * db, 1)} mm`, g, 2.7 * db, 'min'));
    checks.push(C.det(G, 'Espaçamento máximo', '6.3.10-a', `s = ${nf(s, 1)} ≤ mín(24·${nf(tmin, 2)}; 300) mm`, s, Math.min(24 * tmin, 300), 'max'));
    for (const [nm, e, t] of [['Borda da peça na emenda (e1)', e1, mem.t], ['Borda da tala (et)', et, tal.t], ['Borda lateral (e2)', e2, tmin]]) {
      if (ops.emin) checks.push(C.det(G, `${nm} ≥ Tab. 16`, '6.3.11.1', `${nf(e, 1)} ≥ ${nf(ops.emin, 1)} mm`, e, ops.emin, 'min'));
      checks.push(C.det(G, `${nm} ≤ mín(12t; 150)`, '6.3.12', `${nf(e, 1)} ≤ ${nf(Math.min(12 * t, 150), 1)} mm`, e, Math.min(12 * t, 150), 'max'));
    }
  } else {
    checks.push(C.det(G, 'Distância livre entre furos ≥ 2d', '10.3.3.1', `s − df = ${nf(s - dh, 1)} ≥ ${nf(2 * db, 1)} mm`, s - dh, 2 * db, 'min'));
    for (const [nm, e] of [['e1', e1], ['et', et]]) checks.push(C.det(G, `Borda do furo à extremidade (${nm}) ≥ d`, '10.3.3.1', `${nf(e - dh / 2, 1)} ≥ ${nf(db, 1)} mm`, e - dh / 2, db, 'min'));
  }
  const Lj = (ncol - 1) * s, kLong = tr && Lj > 950 ? 1.2 : 1;
  if (kLong > 1) avisos.push(`${pre}: ligação com ${nf(Lj, 0)} mm > 950 mm — Fv,Sd e Fc,Sd × 1,20 (6.3.8).`);
  const Fv = Fa * kLong / (nb * np);
  checks.push(C.chk(`${pre} — parafusos`, `Cisalhamento (${nb} parafusos por lado × ${np} plano${np > 1 ? 's' : ''})`, ops.refV, `Fv,Sd = ${kLong > 1 ? '1,20·' : ''}F/(nb·np) = ${nf(kN(Fa))}${kLong > 1 ? '·1,20' : ''}/(${nb}·${np}) = ${nf(kN(Fv))} kN; ${ops.fv.eq}`, Fv, ops.fv.R));
  const bearing = (t, fu, eEnd, who) => {
    const end = tr ? ops.bear('borda', eEnd, t, fu) : ops.bear('livre', 0, t, fu), int = ncol > 1 ? ops.bear('interno', s, t, fu) : null;
    const R = linhas * (end.R + (ncol > 1 ? (ncol - 1) * int.R : 0));
    checks.push(C.chk(`${pre} — pressão de contato`, `Contato — ${who}`, ops.ref, `${tr ? 'furo extremo' : 'furo extremo (sem borda na direção da força)'}: ${end.eq}${int ? `; internos: ${int.eq}` : ''}; total = ${linhas}·(${nf(kN(end.R))}${int ? ` + ${ncol - 1}·${nf(kN(int.R))}` : ''}) = ${nf(kN(R))} kN`, Fa * kLong, R));
  };
  bearing(mem.t, mem.fu, e1, `peça emendada (t = ${nf(mem.t, 2)} mm)`);
  bearing(np * tal.t, tal.fu, et, `tala${np > 1 ? 's' : ''} (${np} × ${nf(tal.t, 2)} mm)`);
  const Ag = np * tal.b * tal.t, An = np * (tal.b - linhas * dn) * tal.t;
  if (tr) {
    const Ae = Math.min(An, 0.85 * Ag), te = C.tensionElement8800({ Ag, Ae, fy: tal.fy, fu: tal.fu });
    checks.push(C.chk(`${pre} — talas`, 'Tração nas talas (escoamento / ruptura com Ae = An ≤ 0,85Ag)', '6.5.3', `Ag = ${nf(Ag, 0)}; An = ${np}·(${nf(tal.b, 0)} − ${linhas}·${nf(dn, 2)})·${nf(tal.t, 2)} = ${nf(An, 0)}; Ae = mín(An; 0,85Ag = ${nf(0.85 * Ag, 0)}) = ${nf(Ae, 0)} mm²; Nt,Rd = mín(Ag·fy/γa1; Ae·fu/γa2) = mín(${nf(kN(te.y), 1)}; ${nf(kN(te.r), 1)}) kN`, Fa, te.R));
    const Agm = mem.b * mem.t, Anm = (mem.b - linhas * dn) * mem.t, tm = C.tensionElement8800({ Ag: Agm, Ae: Anm, fy: mem.fy, fu: mem.fu });
    checks.push(C.chk(`${pre} — peça emendada`, 'Tração na peça (seção bruta / líquida, Ct = 1)', '5.2.2; 5.2.5-a', `Ag = ${nf(Agm, 0)}; An = Ae = ${nf(Anm, 0)} mm²; Nt,Rd = mín(${nf(kN(tm.y), 1)}; ${nf(kN(tm.r), 1)}) kN`, Fa, tm.R));
    // block shear: inner tongue (Cts 1) and outer strips (Cts 0,5), for the talas (et) and the member (e1)
    for (const [who, t, e, fy, fu, mult] of [['talas', tal.t, et, tal.fy, tal.fu, np], ['peça emendada', mem.t, e1, mem.fy, mem.fu, 1]]) {
      const L = e + (ncol - 1) * s, Agv = 2 * L * t * mult, Anv = 2 * (L - (ncol - 0.5) * dn) * t * mult;
      const per = [];
      if (linhas > 1) per.push(['perímetro 1 — miolo entre as linhas, Cts = 1', (linhas - 1) * (g - dn) * t * mult, 1]);
      per.push([`perímetro 2 — faixas externas, Cts = ${linhas > 1 ? '0,5' : '1'}`, 2 * (e2 - 0.5 * dn) * t * mult, linhas > 1 ? 0.5 : 1]);
      for (const [nm, Ant, Cts] of per) {
        const r = C.blockShear8800({ Agv, Anv, Ant, fy, fu, Cts });
        checks.push(C.chk(`${pre} — colapso por rasgamento`, `${who}: ${nm}`, '6.5.6; Fakury 10.14.7', `Agv = ${nf(Agv, 0)}, Anv = ${nf(Anv, 0)}, Ant = ${nf(Ant, 0)} mm²; ${r.eq}`, Fa, r.R));
      }
    }
  } else {
    const KL = 0.65 * (2 * e1 + folga), r = C.compressionPlate8800({ b: tal.b, t: tal.t, KL, fy: tal.fy });
    checks.push(C.chk(`${pre} — talas`, `Compressão nas talas (K = 0,65; L = 2·e1 + folga = ${nf(2 * e1 + folga, 0)} mm)`, '6.5.4 → 5.3; Fakury 10.14.7', `${np > 1 ? `por tala (${np} talas): ` : ''}${r.eq}${np > 1 ? `; total = ${nf(kN(np * r.R), 1)} kN` : ''}`, Fa, np * r.R));
  }
  return { norma, dh, dn };
}

export function spliceConnection(inp) {
  const { tipo = 'chapa', par, folga = 10, opts = {} } = inp;
  const checks = [], avisos = [];
  if (tipo === 'chapa') {
    const { membro: mem, talas: tal, N } = inp;
    const F = Math.max(Math.abs(N), opts.excecao45 ? 0 : 45) * Math.sign(N || 1) * 1000;
    checks.push({ g: 'Esforço de cálculo', nome: 'Força de cálculo da emenda', ref: '6.1.5.2', info: true, eq: `|NSd| = ${nf(Math.abs(N))} kN${Math.abs(N) < 45 && !opts.excecao45 ? ' → 45 kN (6.1.5.2)' : ''} (${F > 0 ? 'tração' : 'compressão'})` });
    const r = splicePlate({ checks, avisos, pre: 'Emenda', mem, tal: { n: 1, ...tal }, par, F, folga });
    return { ...C.summarize(checks, avisos), norma: r.norma, geo: { tipo, membro: mem, talas: tal, par, folga, N: kN(F) } };
  }
  // ---------------- I section
  const { perfil: P, talaMesa: tm, talaAlma: ta, parMesa, parAlma, N = 0, M = 0, V = 0 } = inp;
  const h0 = P.d - P.tf, Nm = M * 1e6 / h0, NN = N * 1000;               // N > 0 tension
  const Ft = Nm + NN / 2, Fc = Nm - NN / 2;                                 // tension flange (+), compression flange (as magnitude)
  checks.push({ g: 'Esforços nas talas', nome: 'Distribuição (Fakury 10.14.7)', ref: 'Fakury 10.14.7', info: true,
    eq: `h0 = d − tf = ${nf(h0, 1)} mm; mesa tracionada: MSd/h0 + NSd/2 = ${nf(M * 1000 / h0 * 1000 / 1000, 1)} ${NN >= 0 ? '+' : '−'} ${nf(Math.abs(N) / 2, 1)} = ${nf(kN(Ft), 1)} kN; mesa comprimida: MSd/h0 − NSd/2 = ${nf(kN(Fc), 1)} kN; alma: VSd = ${nf(V, 1)} kN` });
  avisos.push('Mesas: talas externas (corte simples); a força das mesas é a das talas (talas com largura igual à da mesa e espessura menor governam — Fakury 10.14.7).');
  const pm = { ...parMesa };
  if (Ft > 0) splicePlate({ checks, avisos, pre: 'Mesa tracionada', mem: { b: P.bf, t: P.tf, fy: P.fy, fu: P.fu }, tal: { n: 1, b: tm.b ?? P.bf, t: tm.t, fy: tm.fy, fu: tm.fu }, par: pm, F: Ft, folga });
  if (Fc !== 0) splicePlate({ checks, avisos, pre: Fc > 0 ? 'Mesa comprimida' : 'Mesa “comprimida” (tracionada)', mem: { b: P.bf, t: P.tf, fy: P.fy, fu: P.fu }, tal: { n: 1, b: tm.b ?? P.bf, t: tm.t, fy: tm.fy, fu: tm.fu }, par: pm, F: -Fc, folga });
  // web: 2 talas, bolts per side nr × nc, vertical pitch sv, horizontal sh, e1w = column nearest the gap → web end
  if (V !== 0) {
    const { db, nr, nc = 1, sv, sh = 0, e1w, ev, et } = parAlma, ops = boltOps('8800', parAlma);   // I sections: rolled or welded → NBR 8800
    const e = folga / 2 + e1w + (nc - 1) * sh / 2;
    const bolts = []; for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) bolts.push({ x: j * sh, y: (i - (nr - 1) / 2) * sv });
    const grp = C.elasticGroup(bolts, { Vy: -Math.abs(V), M: Math.abs(V) * e });
    const Fv = grp.Rmax * 1000 / 2, Vd = Math.abs(V) * 1000, G = 'Alma';
    checks.push(C.chk(G, `Parafusos (corte duplo), grupo excêntrico e = ${nf(e, 1)} mm`, `${ops.refV}; Fakury 10.14.5`, `M = V·e = ${nf(Math.abs(V) * e / 1000, 3)} kN·m; resultante no parafuso mais solicitado = ${nf(grp.Rmax)} kN → por plano ${nf(kN(Fv))} kN; ${ops.fv.eq}`, Fv, ops.fv.R));
    const wb = [...(nr > 1 ? [ops.bear('interno', sv, P.tw, P.fu)] : []), ...(nc > 1 ? [ops.bear('interno', sh, P.tw, P.fu)] : []), ops.bear('borda', e1w, P.tw, P.fu)].reduce((a, c) => c.R < a.R ? c : a);
    checks.push(C.chk(G, 'Contato no furo mais solicitado — alma', ops.ref, `menor entre as direções: ${wb.eq}`, grp.Rmax * 1000, wb.R));
    const tb = [ops.bear('borda', ev, 2 * ta.t, ta.fu), ops.bear('borda', et, 2 * ta.t, ta.fu), ...(nr > 1 ? [ops.bear('interno', sv, 2 * ta.t, ta.fu)] : [])].reduce((a, c) => c.R < a.R ? c : a);
    checks.push(C.chk(G, 'Contato no furo mais solicitado — talas (2t)', ops.ref, `menor entre as direções: ${tb.eq}`, grp.Rmax * 1000, tb.R));
    const hw = P.d - 2 * P.tf, sw = C.shearElement8800({ Agv: hw * P.tw, Anv: (hw - nr * ops.dn) * P.tw, fy: P.fy, fu: P.fu });
    checks.push(C.chk(G, 'Cisalhamento da alma na linha de furos', '6.5.5', `Agv = hw·tw = ${nf(hw * P.tw, 0)}, Anv = ${nf((hw - nr * ops.dn) * P.tw, 0)} mm²; ${sw.eq}`, Vd, sw.R));
    const st = C.shearElement8800({ Agv: 2 * ta.h * ta.t, Anv: 2 * (ta.h - nr * ops.dn) * ta.t, fy: ta.fy, fu: ta.fu });
    checks.push(C.chk(G, 'Cisalhamento das 2 talas da alma', '6.5.5', `Agv = 2·h·t = ${nf(2 * ta.h * ta.t, 0)}, Anv = ${nf(2 * (ta.h - nr * ops.dn) * ta.t, 0)} mm²; ${st.eq}`, Vd, st.R));
    // block of each web tala (Fakury 10.14.7: shear along the column, tension across the other columns to the edge, Cts 0,5)
    const Agv = (ev + (nr - 1) * sv) * ta.t, Anv = Agv - (nr - 0.5) * ops.dn * ta.t, Ant = ((nc - 1) * sh + et - (nc - 0.5) * ops.dn) * ta.t, Cts = nc > 1 ? 0.5 : 1;
    const bk = C.blockShear8800({ Agv, Anv, Ant, fy: ta.fy, fu: ta.fu, Cts });
    checks.push(C.chk(G, `Colapso por rasgamento de cada tala da alma (Cts = ${nf(Cts, 1)})`, '6.5.6; Fakury 10.14.7', `por tala: Agv = ${nf(Agv, 0)}, Anv = ${nf(Anv, 0)}, Ant = ${nf(Ant, 0)} mm²; ${bk.eq}`, Vd / 2, bk.R));
    const Mt = Vd / 2 * e, ys = Array.from({ length: nr }, (_, i) => (i - (nr - 1) / 2) * sv);
    const Zg = ta.t * ta.h ** 2 / 4, Zn = plateZnet(ta.t, ta.h, ops.dn, ys);
    checks.push({ ...C.chk(G, 'Flexão de cada tala da alma — escoamento', '5.4.2; Fakury 10.12.5', `MSd = (V/2)·e = ${nf(Mt / 1e6, 3)} kN·m; MRd = Z·fy/γa1 = ${nf(Zg, 0)}·${nf(ta.fy, 0)}/1,10 = ${nf(Zg * ta.fy / 1.1 / 1e6, 3)} kN·m`, Mt / 1000, Zg * ta.fy / 1.1 / 1000), Sd: Mt / 1e6, Rd: Zg * ta.fy / 1.1 / 1e6, un: 'kN·m' });
    checks.push({ ...C.chk(G, 'Flexão de cada tala da alma — ruptura na linha de furos', 'Fakury 10.12.5', `Zef = ${nf(Zn, 0)} mm³; MRd = fu·Zef/γa2 = ${nf(Zn * ta.fu / 1.35 / 1e6, 3)} kN·m`, Mt / 1000, Zn * ta.fu / 1.35 / 1000), Sd: Mt / 1e6, Rd: Zn * ta.fu / 1.35 / 1e6, un: 'kN·m' });
    avisos.push('Talas da alma: flambagem lateral com torção não verificada (Fakury 10.14.7 mostra que não governa em talas usuais).');
  }
  return { ...C.summarize(checks, avisos), norma: '8800', geo: { tipo, perfil: P, talaMesa: tm, talaAlma: ta, parMesa, parAlma, folga, Ft: kN(Ft), Fc: kN(Fc), V } };
}
