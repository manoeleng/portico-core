// connections_truss.js — barra de treliça (L, 2L, U pela alma, barra chata) ligada a chapa de nó, parafusada ou
// soldada. Norma pela espessura mais fina conectada: ≤ 4,75 mm → NBR 14762:2010 §10 (10.2.1 / 10.3.1), senão
// NBR 8800:2024 §6. Primitives and sources: js/design/connections.js. Units: mm, MPa, kN.
// Geometry (mm): bolts in `linhas` lines parallel to the force, `n` bolts per line, pitch s, gauge g between lines;
// L / 2L: gHeel = heel (back of the outstanding leg) → first line, e2 = remaining distance to the toe; e1 = last bolt →
// end of the member; chapa.eBorda = bolt nearest to the gusset edge → that edge (along the force); chapa.eLat = bolt
// line → lateral free edge of the gusset (tension plane of the block, single line; Cts = 0,5 as Fakury 10.14.3);
// chapa.Lw = largest distance Whitmore section → weld of the gusset (compression, K = 0,65, Fakury p.300).
import * as C from './connections.js?v=7';
import { ctPerfil14762 } from './codes/nbr14762.js?v=7';

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const kN = (N) => N / 1000;
const TAN30 = Math.tan(Math.PI / 6);

function memberProps(sec) {
  const { tipo, b, b2 = b, t } = sec;
  if (tipo === 'chapa') return { A1: b * t, ec: 0, Ac1: b * t, nPerf: 1 };
  if (tipo === 'U') { const A1 = sec.A ?? t * (sec.bw + 2 * (sec.bf - t)); return { A1, ec: sec.ec ?? sec.xg, Ac1: sec.bw * t, nPerf: 1 }; }
  const r = C.angleRect({ b, b2, t });
  return { A1: sec.A ?? r.A, ec: sec.ec ?? r.ec, Ac1: b * t, nPerf: tipo === '2L' ? 2 : 1 };
}

/** main entry. Returns summarize() + { norma, F, geo } */
export function trussMemberConnection(inp) {
  const { secao: sec, chapa: gp, meio = 'parafuso', par = {}, sol = {}, N, opts = {} } = inp;
  const avisos = [], checks = [];
  const tmin = Math.min(sec.t, gp.t), norma = tmin <= 4.75 ? '14762' : '8800';
  const mp = memberProps(sec), nP = mp.nPerf, Ag = mp.A1 * nP, tm = sec.t * nP;   // tm: total member thickness at the bolts
  const tracao = N > 0;
  // member tension resistance for the 50 % rule (14762 10.1-a), when not given
  let NRdBarra = opts.NRdBarra || 0;
  if (norma === '14762' && !(NRdBarra > 0)) { NRdBarra = Ag * sec.fy / 1.10 / 1000; avisos.push(`10.1-a: NRd da barra não informado — adotado o escoamento da seção bruta (${nf(NRdBarra)} kN); se a barra é comandada pela compressão, informe Nc,Rd.`); }
  const df = C.designForce({ norma, N, excecao45: opts.excecao45, minimo50: opts.minimo50, NRdBarra, esbeltezComanda: opts.esbeltezComanda, NcRdBarra: opts.NcRdBarra });
  const F = df.F * 1000;                                                      // N
  checks.push({ g: 'Esforço de cálculo', nome: 'Força de cálculo da ligação', ref: norma === '8800' ? 'NBR 8800 6.1.5' : 'NBR 14762 10.1-a', eq: `${df.txt} → F = ${nf(df.F)} kN (${tracao ? 'tração' : 'compressão'})`, info: true });
  const geo = { norma, tipo: sec.tipo, meio, sec, chapa: gp, par, sol, F: df.F, tracao };

  if (meio === 'parafuso') {
    const { grade, db, n = 2, linhas = 1, s = 3 * db, g = 0, e1, gHeel, rosca = true, furo = 'padrao', deform = 'limitada' } = par;
    const nb = n * linhas, planes = sec.tipo === '2L' ? 2 : 1;
    const e2 = sec.tipo === 'chapa' ? (sec.b - (linhas - 1) * g) / 2 : sec.tipo === 'U' ? null : sec.b - gHeel - (linhas - 1) * g;
    const lc = (n - 1) * s;
    if (norma === '8800') {
      const dh = par.dh ?? C.holeStd8800(db); if (!dh) throw new Error(`furo não tabelado para db = ${db} mm (Tab. 14): informe par.dh`);
      const dn = furo === 'broca' ? dh : dh + 2;                               // 5.2.4.1-a
      const emin = C.edgeMin8800(db);
      const G = 'Disposições construtivas';
      checks.push(C.det(G, 'Espaçamento entre furos ≥ 2,7·db', '6.3.9', `s = ${nf(s, 1)} ≥ 2,7·${nf(db, 1)} = ${nf(2.7 * db, 1)} mm`, s, 2.7 * db, 'min'));
      checks.push(C.det(G, 'Distância livre entre furos ≥ db', '6.3.9', `s − dh = ${nf(s - dh, 1)} ≥ ${nf(db, 1)} mm`, s - dh, db, 'min'));
      if (linhas > 1) checks.push(C.det(G, 'Gabarito entre linhas ≥ 2,7·db', '6.3.9', `g = ${nf(g, 1)} ≥ ${nf(2.7 * db, 1)} mm`, g, 2.7 * db, 'min'));
      const smax = Math.min(24 * tmin, 300);
      checks.push(C.det(G, 'Espaçamento máximo', '6.3.10-a', `s = ${nf(s, 1)} ≤ mín(24·${nf(tmin, 2)}; 300) = ${nf(smax, 1)} mm`, s, smax, 'max'));
      if (emin) {
        checks.push(C.det(G, 'Borda da barra (direção da força) ≥ Tab. 16', '6.3.11.1', `e1 = ${nf(e1, 1)} ≥ ${nf(emin, 1)} mm`, e1, emin, 'min'));
        if (e2 != null) checks.push(C.det(G, 'Borda lateral da barra ≥ Tab. 16', '6.3.11.1', `e2 = ${nf(e2, 1)} ≥ ${nf(emin, 1)} mm`, e2, emin, 'min'));
        checks.push(C.det(G, 'Borda da chapa de nó ≥ Tab. 16', '6.3.11.1', `eBorda = ${nf(gp.eBorda, 1)} ≥ ${nf(emin, 1)} mm`, gp.eBorda, emin, 'min'));
      } else avisos.push(`Tab. 16 sem valor para db = ${db} mm: distâncias mínimas às bordas não verificadas.`);
      const emax = Math.min(12 * sec.t, 150);
      checks.push(C.det(G, 'Borda máxima da barra', '6.3.12', `e1 = ${nf(e1, 1)} ≤ mín(12·${nf(sec.t, 2)}; 150) = ${nf(emax, 1)} mm`, e1, emax, 'max'));
      if (e2 != null) checks.push(C.det(G, 'Borda lateral máxima da barra', '6.3.12', `e2 = ${nf(e2, 1)} ≤ ${nf(emax, 1)} mm`, e2, emax, 'max'));
      // bolts
      const fv = C.boltShear8800({ grade, db, rosca, pega: par.pega || 0, protendido: par.protendido });
      const FvSd = F / (nb * planes);
      checks.push(C.chk('Parafusos', `Cisalhamento (${nb} parafuso${nb > 1 ? 's' : ''} × ${planes} plano${planes > 1 ? 's' : ''})`, '6.3.3.2', `Fv,Sd = F/(nb·np) = ${nf(df.F)}/(${nb}·${planes}) = ${nf(kN(FvSd))} kN; ${fv.eq}`, FvSd, fv.R));
      // bearing: member and gusset (6.3.3.3, total = Σ holes)
      const bear = (t, fu, eEnd, who) => {
        const big = 1e9;                                                        // no free edge in the direction → cap 2,4·db·t·fu
        const lfEnd = tracao ? eEnd - dh / 2 : big, lfInt = s - dh;
        const rEnd = C.bearing8800({ lf: lfEnd, db, t, fu, deform }), rInt = n > 1 ? C.bearing8800({ lf: lfInt, db, t, fu, deform }) : null;
        const R = linhas * (rEnd.R + (n > 1 ? (n - 1) * rInt.R : 0));
        const eq = `${tracao ? `furo extremo ℓf = ${nf(eEnd, 1)} − ${nf(dh, 1)}/2 = ${nf(lfEnd, 1)} mm: ${rEnd.eq}` : `furo extremo sem borda livre na direção da força: ${rEnd.eq}`}${n > 1 ? `; furos internos ℓf = s − dh = ${nf(lfInt, 1)} mm: ${rInt.eq}` : ''}; total = ${linhas}·(${nf(kN(rEnd.R))}${n > 1 ? ` + ${n - 1}·${nf(kN(rInt.R))}` : ''}) = ${nf(kN(R))} kN`;
        checks.push(C.chk('Pressão de contato', `Contato e rasgamento entre furos — ${who}`, '6.3.3.3', eq, F, R));
      };
      bear(tm, sec.fu, e1, sec.tipo === '2L' ? `cantoneiras (2 × ${nf(sec.t, 2)} mm)` : `barra (t = ${nf(sec.t, 2)} mm)`);
      bear(gp.t, gp.fu, gp.eBorda, `chapa de nó (t = ${nf(gp.t, 2)} mm)`);
      // member net section (tension)
      if (tracao) {
        const ty = Ag * sec.fy / C.GAMMA.a1;
        checks.push(C.chk('Barra na região da ligação', 'Escoamento da seção bruta', '5.2.2-a', `Nt,Rd = Ag·fy/γa1 = ${nf(Ag, 0)}·${nf(sec.fy, 0)}/1,10 = ${nf(kN(ty), 1)} kN`, F, ty));
        const An = Ag - nP * linhas * dn * sec.t;
        let Ct, ctTxt;
        if (sec.tipo === 'chapa') { Ct = 1; ctTxt = 'Ct = 1,00 (5.2.5-a: força transmitida a todo o elemento)'; }
        else {
          const floor = mp.Ac1 / mp.A1;
          if (n < 2) { Ct = floor; ctTxt = `um parafuso por linha (ℓc = 0): Ct = Ac/Ag = ${nf(mp.Ac1, 0)}/${nf(mp.A1, 0)} = ${nf(Ct, 3)} (5.2.5, piso)`; }
          else { const c = 1 - mp.ec / lc; Ct = Math.min(1, Math.max(c, floor)); ctTxt = `Ct = 1 − ec/ℓc = 1 − ${nf(mp.ec, 2)}/${nf(lc, 1)} = ${nf(c, 3)}${c < floor ? ` < Ac/Ag = ${nf(floor, 3)} → ${nf(Ct, 3)} (piso, 5.2.5)` : ''} (5.2.5-c)`; }
        }
        const Ae = Ct * An, tr = Ae * sec.fu / C.GAMMA.a2;
        checks.push(C.chk('Barra na região da ligação', 'Ruptura da seção líquida efetiva', '5.2.2-b, 5.2.3–5.2.5', `An = Ag − ${nP * linhas}·(dh ${furo === 'broca' ? '' : '+ 2 '})·t = ${nf(Ag, 0)} − ${nP * linhas}·${nf(dn, 1)}·${nf(sec.t, 2)} = ${nf(An, 0)} mm²; ${ctTxt}; Ae = ${nf(Ae, 0)} mm²; Nt,Rd = Ae·fu/γa2 = ${nf(Ae, 0)}·${nf(sec.fu, 0)}/1,35 = ${nf(kN(tr), 1)} kN`, F, tr));
        // block shear of the member
        const L = e1 + (n - 1) * s, Agv1 = L * sec.t, Anv1 = (L - (n - 0.5) * dn) * sec.t;
        const blocks = [];
        if (sec.tipo === 'L' || sec.tipo === '2L') blocks.push({ txt: 'linha de parafusos → aba (ponta)', Agv: Agv1, Anv: Anv1, Ant: (e2 + (linhas - 1) * g - (linhas - 0.5) * dn) * sec.t, Cts: 1, mult: nP });
        if ((sec.tipo === 'U' || sec.tipo === 'chapa') && linhas > 1) blocks.push({ txt: 'miolo entre as linhas externas', Agv: 2 * Agv1, Anv: 2 * Anv1, Ant: ((linhas - 1) * g - (linhas - 1) * dn) * sec.t, Cts: 1, mult: 1 });
        if (sec.tipo === 'chapa') blocks.push({ txt: 'faixas externas (linhas → bordas; Cts = 0,5 como Fakury 10.14.7, perímetro 2)', Agv: 2 * Agv1, Anv: 2 * Anv1, Ant: 2 * (e2 - 0.5 * dn) * sec.t, Cts: 0.5, mult: 1 });
        if (sec.tipo === 'U' && linhas < 2) avisos.push('U ligado pela alma com uma linha de parafusos: colapso por rasgamento da alma não se forma no miolo — não verificado (verificar arrancamento com as mesas, se aplicável).');
        for (const bk of blocks) {
          const r = C.blockShear8800({ Agv: bk.Agv * bk.mult, Anv: bk.Anv * bk.mult, Ant: bk.Ant * bk.mult, fy: sec.fy, fu: sec.fu, Cts: bk.Cts });
          checks.push(C.chk('Colapso por rasgamento', `Barra — ${bk.txt}${bk.mult > 1 ? ' (2 cantoneiras)' : ''}`, '6.5.6', `Agv = ${nf(bk.Agv * bk.mult, 0)}, Anv = ${nf(bk.Anv * bk.mult, 0)}, Ant = ${nf(bk.Ant * bk.mult, 0)} mm²; ${r.eq}`, F, r.R));
        }
        gussetBlock8800({ checks, avisos, gp, n, linhas, s, g, dn, F, fyG: gp.fy, fuG: gp.fu });
      }
      gussetWhitmore({ checks, avisos, gp, lwh: (linhas - 1) * g + 2 * lc * TAN30, lwhTxt: `lwh = (linhas − 1)·g + 2·ℓc·tg 30° = ${linhas - 1}·${nf(g, 1)} + 2·${nf(lc, 1)}·0,577`, F, tracao, holes: linhas * dn, gamma: 1.10 });
      if (lc * 1 > 950 && sec.tipo !== '2L') avisos.push('Comprimento da ligação > 950 mm: em emendas tracionadas aplica-se o fator 1,20 do 6.3.8.');
      geo.dh = dh; geo.e2 = e2;
    } else {
      // ---------------- NBR 14762 bolted
      const dhf = par.dh ?? C.holeStd14762(db);
      const G = 'Disposições construtivas';
      checks.push(C.det(G, 'Distância livre entre furos ≥ 2d', '10.3.3.1', `s − df = ${nf(s - dhf, 1)} ≥ 2·${nf(db, 1)} = ${nf(2 * db, 1)} mm`, s - dhf, 2 * db, 'min'));
      if (linhas > 1) checks.push(C.det(G, 'Distância livre entre linhas ≥ 2d', '10.3.3.1', `g − df = ${nf(g - dhf, 1)} ≥ ${nf(2 * db, 1)} mm`, g - dhf, 2 * db, 'min'));
      checks.push(C.det(G, 'Borda do furo à extremidade da barra ≥ d', '10.3.3.1', `e1 − df/2 = ${nf(e1 - dhf / 2, 1)} ≥ ${nf(db, 1)} mm`, e1 - dhf / 2, db, 'min'));
      checks.push(C.det(G, 'Borda do furo à extremidade da chapa de nó ≥ d', '10.3.3.1', `eBorda − df/2 = ${nf(gp.eBorda - dhf / 2, 1)} ≥ ${nf(db, 1)} mm`, gp.eBorda - dhf / 2, db, 'min'));
      if (e2 != null) checks.push(C.det(G, 'Borda lateral do furo ≥ d', '10.3.3.1 (aplicada também à borda lateral)', `e2 − df/2 = ${nf(e2 - dhf / 2, 1)} ≥ ${nf(db, 1)} mm`, e2 - dhf / 2, db, 'min'));
      const fv = C.boltShear14762({ grade, d: db, rosca });
      const FvSd = F / (nb * planes);
      checks.push(C.chk('Parafusos', `Cisalhamento (${nb} parafuso${nb > 1 ? 's' : ''} × ${planes} plano${planes > 1 ? 's' : ''})`, '10.3.7', `Fv,Sd = ${nf(df.F)}/(${nb}·${planes}) = ${nf(kN(FvSd))} kN; ${fv.eq}`, FvSd, fv.R));
      const part = (t, fu, eEnd, who, nPl) => {
        // 10.3.5 bearing (αe valid for t ≤ 4,75 mm) and 10.3.4 tearing: tension → end bolt e = e1, interior e = s − df/2;
        // compression → the innermost bolt has no edge in the force direction (bearing only), the others e = s − df/2
        const tA = Math.min(t, 4.75); if (t > 4.75) avisos.push(`αe do 10.3.5 vale para t ≤ 4,75 mm: ${who} (t = ${nf(t, 2)} mm) usa αe com t = 4,75 mm.`);
        const rb = C.bearing14762({ d: db, t: tA, fu }), Rb1 = rb.R * t / tA, Rb = Rb1 * nPl * nb;
        checks.push(C.chk('Rasgamento e esmagamento', `Esmagamento — ${who}`, '10.3.5', `${rb.eq.replace(/ = [\d.,]+ kN$/, '')}${t > tA ? ` (×${nf(t / tA, 3)})` : ''} por furo; total = ${nPl * nb}·${nf(kN(Rb1))} = ${nf(kN(Rb))} kN`, F, Rb));
        const rI = C.tearing14762({ e: s - dhf / 2, t, fu });
        if (tracao) {
          const rE = C.tearing14762({ e: eEnd, t, fu }), Rt = nPl * linhas * (rE.R + (n - 1) * rI.R);
          checks.push(C.chk('Rasgamento e esmagamento', `Rasgamento entre furos / furo–borda — ${who}`, '10.3.4', `furo extremo e = ${nf(eEnd, 1)} mm: ${rE.eq}${n > 1 ? `; internos e = s − df/2 = ${nf(s - dhf / 2, 1)} mm: ${rI.eq}` : ''}; total = ${nPl * linhas}·(${nf(kN(rE.R))}${n > 1 ? ` + ${n - 1}·${nf(kN(rI.R))}` : ''}) = ${nf(kN(Rt))} kN`, F, Rt));
        } else if (n > 1) {
          const Rt = nPl * linhas * ((n - 1) * Math.min(rI.R, Rb1) + Rb1);
          checks.push(C.chk('Rasgamento e esmagamento', `Rasgamento entre furos (compressão) — ${who}`, '10.3.4 / 10.3.5', `${n - 1} furo(s) com e = s − df/2 = ${nf(s - dhf / 2, 1)} mm: mín(${rI.eq}; esmagamento ${nf(kN(Rb1))} kN); furo mais interno sem borda na direção da força: esmagamento ${nf(kN(Rb1))} kN; total = ${nPl * linhas}·(${n - 1}·${nf(kN(Math.min(rI.R, Rb1)))} + ${nf(kN(Rb1))}) = ${nf(kN(Rt))} kN`, F, Rt));
        }
      };
      part(sec.t, sec.fu, e1, sec.tipo === '2L' ? `cantoneiras (2 × ${nf(sec.t, 2)} mm)` : `barra (t = ${nf(sec.t, 2)} mm)`, nP);
      part(gp.t, gp.fu, gp.eBorda, `chapa de nó (t = ${nf(gp.t, 2)} mm)`, 1);
      if (tracao) {
        const ty = Ag * sec.fy / 1.10;
        checks.push(C.chk('Barra na região da ligação', 'Escoamento da seção bruta', 'NBR 14762 9.6.2-a', `Nt,Rd = A·fy/1,10 = ${nf(Ag, 0)}·${nf(sec.fy, 0)}/1,10 = ${nf(kN(ty), 1)} kN`, F, ty));
        const An = 0.9 * (Ag - nP * linhas * dhf * sec.t);
        let ct;
        if (sec.tipo === 'chapa') {
          let gg = linhas > 1 ? g : sec.b; if (linhas > 1 && g < 2 * e2) gg = 2 * e2;
          const k = n === 1 ? [0, 2.5] : n === 2 ? [0.5, 1.25] : n === 3 ? [0.67, 0.83] : [0.75, 0.625];
          ct = { Ct: Math.min(1, k[0] + k[1] * db / gg), ref: `9.6.2-c-1: Ct = ${nf(k[0], 2)} + ${nf(k[1], 3)}·d/g = ${nf(k[0], 2)} + ${nf(k[1], 3)}·${nf(db, 1)}/${nf(gg, 1)}` };
        } else ct = ctPerfil14762({ ligacao: 'parafusada', todosConectados: false, nDirecao: n, x: mp.ec / 10, Lc: lc / 10, d: db / 10, g: (sec.tipo === 'U' ? sec.bw : sec.b + (sec.b2 ?? sec.b) - sec.t) / 10, tipo: sec.tipo === 'U' ? 'U' : 'L' });
        if (ct.erro) { checks.push({ g: 'Barra na região da ligação', nome: 'Ruptura da seção líquida', ref: '9.6.2-c', eq: ct.erro, Sd: kN(F), Rd: 0, ratio: Infinity, ok: false, un: 'kN' }); }
        else {
          const tr = ct.Ct * An * sec.fu / 1.65;
          checks.push(C.chk('Barra na região da ligação', 'Ruptura da seção líquida na ligação', 'NBR 14762 9.6.2-c', `An = 0,9·(A − nf·df·t) = 0,9·(${nf(Ag, 0)} − ${nP * linhas}·${nf(dhf, 1)}·${nf(sec.t, 2)}) = ${nf(An, 0)} mm²; Ct = ${nf(ct.Ct, 3)} (${ct.ref}); Nt,Rd = Ct·An·fu/1,65 = ${nf(kN(tr), 1)} kN`, F, tr));
        }
        const L = e1 + (n - 1) * s, Agv1 = L * sec.t, Anv1 = (L - (n - 0.5) * dhf) * sec.t;
        const blocks = [];
        if (sec.tipo === 'L' || sec.tipo === '2L') blocks.push({ txt: 'linha de parafusos → aba (ponta)', Agv: Agv1 * nP, Anv: Anv1 * nP, Ant: (e2 + (linhas - 1) * g - (linhas - 0.5) * dhf) * sec.t * nP });
        if ((sec.tipo === 'U' || sec.tipo === 'chapa') && linhas > 1) blocks.push({ txt: 'miolo entre as linhas externas', Agv: 2 * Agv1, Anv: 2 * Anv1, Ant: ((linhas - 1) * (g - dhf)) * sec.t });
        if (sec.tipo === 'chapa') blocks.push({ txt: 'faixas externas (linhas → bordas)', Agv: 2 * Agv1, Anv: 2 * Anv1, Ant: 2 * (e2 - 0.5 * dhf) * sec.t });
        for (const bk of blocks) {
          const r = C.blockShear14762({ ...bk, fy: sec.fy, fu: sec.fu });
          checks.push(C.chk('Colapso por rasgamento', `Barra — ${bk.txt}`, 'NBR 14762 10.4', `Agv = ${nf(bk.Agv, 0)}, Anv = ${nf(bk.Anv, 0)}, Ant = ${nf(bk.Ant, 0)} mm²; ${r.eq}`, F, r.R));
        }
      }
      gussetWhitmore({ checks, avisos, gp, lwh: (linhas - 1) * g + 2 * lc * TAN30, lwhTxt: `lwh = (linhas − 1)·g + 2·ℓc·tg 30° = ${linhas - 1}·${nf(g, 1)} + 2·${nf(lc, 1)}·0,577`, F, tracao, holes: linhas * dhf, gamma: gp.t <= 4.75 ? 1.20 : 1.10, norma14762: true });
      geo.dh = dhf; geo.e2 = e2;
    }
  } else {
    // ---------------- welded
    const { dw, L1 = 0, L2 = 0, Lt = 0, eletrodo = 'E70' } = sol;
    const fw = C.ELECTRODES[eletrodo];
    const Llong = Math.max(L1, L2);
    const bConn = sec.tipo === 'U' ? sec.bw : sec.b;                          // width of the connected element (distance between the welds)
    if (norma === '8800') {
      const G = 'Disposições construtivas';
      const dmin = C.filletMin8800(tmin), dmax = C.filletMaxEdge8800(sec.t);
      checks.push(C.det(G, 'Perna mínima do filete (Tab. 11)', '6.2.6.2.1', `dw = ${nf(dw, 1)} ≥ ${nf(dmin, 1)} mm (menor espessura ${nf(tmin, 2)} mm)`, dw, dmin, 'min'));
      checks.push(C.det(G, 'Perna máxima ao longo da borda', '6.2.6.2.2', `dw = ${nf(dw, 1)} ≤ ${nf(dmax, 1)} mm`, dw, dmax, 'max'));
      for (const [nm, L] of [['L1', L1], ['L2', L2], ['Lt', Lt]]) if (L > 0) checks.push(C.det(G, `Comprimento mínimo do filete ${nm}`, '6.2.6.2.3', `${nm} = ${nf(L, 0)} ≥ máx(4·dw; 40) = ${nf(Math.max(4 * dw, 40), 0)} mm`, L, Math.max(4 * dw, 40), 'min'));
      if (sec.tipo === 'chapa' && Lt === 0) checks.push(C.det(G, 'Só filetes longitudinais em chapa: comprimento ≥ distância entre eles', '6.2.6.2.3', `L = ${nf(Math.min(L1, L2), 0)} ≥ b = ${nf(sec.b, 0)} mm`, Math.min(L1, L2), sec.b, 'min'));
      const wl = [L1, L2].filter((L) => L > 0).map((L) => C.fillet8800({ dw, L, fw, longitudinalExtremo: true }));
      const Fl = wl.reduce((s, w) => s + w.R, 0) * nP, Ft = Lt > 0 ? C.fillet8800({ dw, L: Lt, fw }).R * nP : 0;
      const R = Ft === 0 ? Fl : Fl === 0 ? 1.5 * Ft : Math.max(Fl + Ft, 0.85 * Fl + 1.5 * Ft);
      const eqw = `${wl.map((w, i) => `long. ${i + 1}: ${w.eq}`).join('; ')}${Lt > 0 ? `; transv.: ${C.fillet8800({ dw, L: Lt, fw }).eq}` : ''}${nP > 1 ? ' (× 2 cantoneiras)' : ''}; ${Ft > 0 && Fl > 0 ? `grupo (6.2.5.2-c): máx(Fwl + Fwt; 0,85·Fwl + 1,5·Fwt) = máx(${nf(kN(Fl + Ft), 1)}; ${nf(kN(0.85 * Fl + 1.5 * Ft), 1)})` : Fl === 0 ? 'só transversal (6.2.5.2-a, θ = 90°): 1,5·Fwt' : 'só longitudinais'} = ${nf(kN(R), 1)} kN`;
      checks.push(C.chk('Solda', 'Metal da solda (filetes)', 'Tab. 9, 6.2.5.2', eqw, F, R));
      if (sec.tipo === 'L' || sec.tipo === '2L') avisos.push('Filetes da cantoneira somados sem a excentricidade entre o eixo da barra e o grupo de solda — permitido pela 6.1.8.2 para barras solicitadas estaticamente; em fadiga, considerar.');
      const Lsum = L1 + L2;
      if (Lsum > 0) {
        const bm = C.shearElement8800({ Agv: Lsum * sec.t * nP, Anv: Lsum * sec.t * nP, fy: sec.fy, fu: sec.fu });
        checks.push(C.chk('Solda', 'Metal-base da barra ao longo dos filetes', 'Tab. 9 → 6.5.5', `Agv = Anv = ΣL·t = ${nf(Lsum, 0)}·${nf(sec.t, 2)}${nP > 1 ? '·2' : ''}; ${bm.eq}`, F, bm.R));
        const bg = C.shearElement8800({ Agv: Lsum * gp.t, Anv: Lsum * gp.t, fy: gp.fy, fu: gp.fu });
        checks.push(C.chk('Solda', 'Metal-base da chapa de nó ao longo dos filetes', 'Tab. 9 → 6.5.5', `Agv = Anv = ΣL·tg = ${nf(Lsum, 0)}·${nf(gp.t, 2)}; ${bg.eq}`, F, bg.R));
      }
      if (tracao) {
        const ty = Ag * sec.fy / C.GAMMA.a1;
        checks.push(C.chk('Barra na região da ligação', 'Escoamento da seção bruta', '5.2.2-a', `Nt,Rd = ${nf(Ag, 0)}·${nf(sec.fy, 0)}/1,10 = ${nf(kN(ty), 1)} kN`, F, ty));
        let Ct, ctTxt; const floor = mp.Ac1 / mp.A1;
        if (sec.tipo === 'chapa') {
          if (Lt > 0) { Ct = 1; ctTxt = 'Ct = 1,00 (5.2.5-a)'; }
          else { const lcw = (L1 + L2) / 2, b = sec.b; Ct = 3 * lcw ** 2 / (3 * lcw ** 2 + b * b) * (1 - sec.t / (2 * lcw)); ctTxt = `Ct = 3ℓc²/(3ℓc² + b²)·(1 − t/2ℓc) = ${nf(Ct, 3)} (5.2.5-d)`; }
        } else if (Llong === 0) { Ct = floor; ctTxt = `só soldas transversais: Ct = Ac/Ag = ${nf(Ct, 3)} (5.2.5-b)`; }
        else { const c = 1 - mp.ec / Llong; Ct = Math.min(1, Math.max(c, floor)); ctTxt = `Ct = 1 − ec/ℓc = 1 − ${nf(mp.ec, 2)}/${nf(Llong, 0)} = ${nf(c, 3)}${c < floor ? ` → piso Ac/Ag = ${nf(floor, 3)}` : ''} (5.2.5-c)`; }
        const tr = Ct * Ag * sec.fu / C.GAMMA.a2;
        checks.push(C.chk('Barra na região da ligação', 'Ruptura da seção líquida efetiva', '5.2.2-b, 5.2.5', `An = Ag = ${nf(Ag, 0)} mm²; ${ctTxt}; Nt,Rd = Ct·Ag·fu/γa2 = ${nf(kN(tr), 1)} kN`, F, tr));
      }
      gussetWhitmore({ checks, avisos, gp, lwh: bConn + 2 * Llong * TAN30, lwhTxt: `lwh = b + 2·ℓw·tg 30° = ${nf(bConn, 1)} + 2·${nf(Llong, 0)}·0,577`, F, tracao, holes: 0, gamma: 1.10 });
    } else {
      const t = tmin, fu = Math.min(sec.fu, gp.fu);
      const parts = [];
      for (const [nm, L] of [['L1', L1], ['L2', L2]]) if (L > 0) parts.push([nm, C.fillet14762({ L, t, w: dw, fu, fw, dir: 'paralela' })]);
      if (Lt > 0) parts.push(['Lt', C.fillet14762({ L: Lt, t, w: dw, fu, fw, dir: 'normal' })]);
      const R = parts.reduce((s, [, r]) => s + r.R, 0) * nP;
      if (sec.tipo === 'L' || sec.tipo === '2L') avisos.push('Filetes da cantoneira somados sem a excentricidade entre o eixo da barra e o grupo de solda — a NBR 14762 é omissa; adotada por analogia a NBR 8800 6.1.8.2 (barras solicitadas estaticamente; em fadiga, considerar).');
      if (sec.tipo === 'chapa' && Lt === 0) checks.push(C.det('Disposições construtivas', 'Só filetes longitudinais em chapa: L ≥ b', 'NBR 14762 9.6.2-c-2', `L = ${nf(Math.min(L1, L2), 0)} ≥ b = ${nf(sec.b, 0)} mm`, Math.min(L1, L2), sec.b, 'min'));
      checks.push(C.chk('Solda', 'Filetes em superfície plana', 'NBR 14762 10.2.3', `${parts.map(([nm, r]) => `${nm}: ${r.eq}`).join('; ')}${nP > 1 ? ' (× 2 cantoneiras)' : ''}; total = ${nf(kN(R), 1)} kN`, F, R));
      if (tracao) {
        const ty = Ag * sec.fy / 1.10;
        checks.push(C.chk('Barra na região da ligação', 'Escoamento da seção bruta', 'NBR 14762 9.6.2-a', `Nt,Rd = ${nf(Ag, 0)}·${nf(sec.fy, 0)}/1,10 = ${nf(kN(ty), 1)} kN`, F, ty));
        const ct = sec.tipo === 'chapa' ? (Lt > 0 ? { Ct: 1, ref: '9.6.2-c-2: longitudinais + transversais' } : { Ct: Llong >= 2 * sec.b ? 1 : Llong >= 1.5 * sec.b ? 0.87 : 0.75, ref: '9.6.2-c-2: só longitudinais' })
          : ctPerfil14762({ ligacao: 'soldada', soldas: Llong === 0 ? 'transversais' : 'longitudinais', todosConectados: false, x: mp.ec / 10, Lc: Llong / 10, tipo: sec.tipo === 'U' ? 'U' : 'L' });
        if (ct.erro) checks.push({ g: 'Barra na região da ligação', nome: 'Ruptura da seção líquida', ref: '9.6.2-c', eq: ct.erro, Sd: kN(F), Rd: 0, ratio: Infinity, ok: false, un: 'kN' });
        else { const tr = ct.Ct * Ag * sec.fu / 1.65; checks.push(C.chk('Barra na região da ligação', 'Ruptura da seção líquida na ligação', 'NBR 14762 9.6.2-c', `An = A = ${nf(Ag, 0)} mm²; Ct = ${nf(ct.Ct, 3)} (${ct.ref}); Nt,Rd = Ct·An·fu/1,65 = ${nf(kN(tr), 1)} kN`, F, tr)); }
      }
      gussetWhitmore({ checks, avisos, gp, lwh: bConn + 2 * Llong * TAN30, lwhTxt: `lwh = b + 2·ℓw·tg 30° = ${nf(bConn, 1)} + 2·${nf(Llong, 0)}·0,577`, F, tracao, holes: 0, gamma: gp.t <= 4.75 ? 1.20 : 1.10, norma14762: true });
    }
  }
  avisos.push('A ligação da chapa de nó ao banzo (solda ou parafusos) e o cisalhamento da chapa nas linhas de ligação ao banzo são verificados à parte.');
  return { ...C.summarize(checks, avisos), norma, F: df.F, geo };
}

function gussetBlock8800({ checks, avisos, gp, n, linhas, s, g, dn, F }) {
  const L = gp.eBorda + (n - 1) * s;
  if (linhas > 1) {
    const Agv = 2 * L * gp.t, Anv = 2 * (L - (n - 0.5) * dn) * gp.t, Ant = (linhas - 1) * (g - dn) * gp.t;
    const r = C.blockShear8800({ Agv, Anv, Ant, fy: gp.fy, fu: gp.fu, Cts: 1 });
    checks.push(C.chk('Colapso por rasgamento', 'Chapa de nó — miolo entre as linhas', '6.5.6', `Agv = ${nf(Agv, 0)}, Anv = ${nf(Anv, 0)}, Ant = ${nf(Ant, 0)} mm²; ${r.eq}`, F, r.R));
  } else if (gp.eLat > 0) {
    const Agv = L * gp.t, Anv = (L - (n - 0.5) * dn) * gp.t, Ant = (gp.eLat - 0.5 * dn) * gp.t;
    const r = C.blockShear8800({ Agv, Anv, Ant, fy: gp.fy, fu: gp.fu, Cts: 0.5 });
    checks.push(C.chk('Colapso por rasgamento', 'Chapa de nó — linha de parafusos → borda lateral (Cts = 0,5, Fakury 10.14.3)', '6.5.6', `Agv = ${nf(Agv, 0)}, Anv = ${nf(Anv, 0)}, Ant = ${nf(Ant, 0)} mm²; ${r.eq}`, F, r.R));
  } else avisos.push('Chapa de nó com uma linha de parafusos: informe eLat (linha → borda lateral da chapa) para o colapso por rasgamento.');
}

function gussetWhitmore({ checks, avisos, gp, lwh: lwh0, lwhTxt: txt0, F, tracao, holes, gamma, norma14762 = false }) {
  const lwh = gp.largura > 0 ? Math.min(lwh0, gp.largura) : lwh0;
  const lwhTxt = lwh < lwh0 ? `${txt0} = ${nf(lwh0, 1)} mm > largura da chapa → lwh` : txt0;
  const Ag = lwh * gp.t, src = 'seção de Whitmore (Fakury et al. 2017, 10.12.2/10.12.3 — critério de literatura)';
  if (tracao) {
    const y = Ag * gp.fy / 1.10;                                             // γa1 (8800) = γ (14762 9.6.2-a) = 1,10
    checks.push(C.chk('Chapa de nó', 'Tração — escoamento na seção de Whitmore', norma14762 ? 'NBR 14762 9.6.2-a; ' + src : '6.5.3-a; ' + src, `${lwhTxt} = ${nf(lwh, 1)} mm; Ag = lwh·tg = ${nf(Ag, 0)} mm²; Nt,Rd = Ag·fy/1,10 = ${nf(kN(y), 1)} kN`, F, y));
    if (gp.largura > 0 && gp.largura - holes < lwh) {
      const An = (gp.largura - holes) * gp.t, r = An * gp.fu / (norma14762 ? 1.65 : C.GAMMA.a2);
      checks.push(C.chk('Chapa de nó', 'Tração — ruptura da seção líquida (largura líquida < lwh)', norma14762 ? 'NBR 14762 9.6.2-c' : '6.5.3-b', `An = (${nf(gp.largura, 0)} − ${nf(holes, 1)})·${nf(gp.t, 2)} = ${nf(An, 0)} mm²; Nt,Rd = An·fu/${norma14762 ? '1,65' : '1,35'} = ${nf(kN(r), 1)} kN`, F, r));
    } else if (!(gp.largura > 0)) avisos.push('Largura da chapa de nó na seção dos furos não informada: ruptura da seção líquida só é necessária se a largura líquida for menor que lwh (Fakury 10.12.2).');
  } else {
    if (!(gp.Lw > 0)) { avisos.push('Compressão: informe chapa.Lw (maior distância da seção de Whitmore à solda) para a flambagem da chapa de nó.'); return; }
    const r = C.compressionPlate8800({ b: lwh, t: gp.t, KL: 0.65 * gp.Lw, fy: gp.fy });
    const R = gamma !== 1.10 ? r.R * 1.10 / gamma : r.R;
    checks.push(C.chk('Chapa de nó', 'Compressão — seção de Whitmore, K = 0,65', (norma14762 ? 'NBR 14762 9.7 (γ = 1,20); ' : '6.5.4 → 5.3; ') + src, `${lwhTxt} = ${nf(lwh, 1)} mm; KL = 0,65·${nf(gp.Lw, 0)} mm; ${r.eq}${gamma !== 1.10 ? ` × 1,10/1,20 = ${nf(kN(R), 1)} kN` : ''}`, F, R));
  }
}
