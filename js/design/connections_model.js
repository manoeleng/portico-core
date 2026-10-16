// connections_model.js — maps the connections of an analysed model and PRE-SIZES every one of them (decisão do
// Manoel, 16/10/2026: "pré-dimensiona sozinho"), with the calculation modules of the connection package
// (connections_truss / _shear / _base / _splice — NBR 8800:2024 §6, NBR 14762:2010 §10, revisão FECHADA).
// Pure module (no DOM): the app adapter (js/ui/connections_model_dialog.js) passes plain data:
//   topo   = { nodes: [{ id, x, y, z, support }], elems: [{ id, n1, n2, rel[12], cable, excluded, shape, dims (mm), cf, A (mm²),
//             ec (mm), fy, fu (MPa), name }] }
//   combos = [{ name, ef(eid) → { N, Vy1, Vz1, My1, Mz1, Vy2, Vz2, My2, Mz2 } (kN, kN·m, local axes, N > 0 tension),
//             R(nid) → [Fx, Fy, Fz, Mx, My, Mz] (global, force of the support ON the structure) }]
// Classification (node by node, element ends):
//   · base de pilar — support node with a near-vertical I/H member (6.7 covers I/H only; others: aviso);
//   · barra de treliça × chapa de nó — end with My and Mz released, section L/2L/U/Ue/channel/flat, at a node where some
//     other member continues without release (the chord);
//   · viga flexível — end with the major-axis moment released, I section, near-horizontal, at a node with a member that
//     continues (pilar or viga suporte);
//   · emenda — nodes chosen by the user among the candidates (2 collinear members, same section, no release).
// Pre-sizing rules (anchored): bolts s = 3·db rounded up to 5 mm (6.3.9 "de preferência 3db"), edges of Tab. 16 rounded up
// to 5 mm; gauges in rolled angles AISC Manual 16th ed. Table 1-7A (cold-formed: centre of the leg); viga–pilar by the
// Gerdau manual "Ligações para estruturas de aço" (NBR 8800:2024) 2.4 and 3.1: ⅝" s 60 e 30 L76×76×6,4 (W150–W200), ¾" s 75
// e 40 L76×76×6,4 (W250–W460), ⅞" s 75 e 40 L102×102×8,0 (W530–W610), gauge 45 / 65, angle length ≥ d/2, 10 mm gap;
// commercial plate thicknesses; base 6.7 with Tab. 18 and tp from the list. The first candidate (in the order of cost)
// that satisfies ALL ULS combinations is adopted; if none, the largest is reported as NÃO ATENDE.
import { trussMemberConnection } from './connections_truss.js?v=7';
import { shearConnection } from './connections_shear.js?v=7';
import { columnBase, TAB18 } from './connections_base.js?v=7';
import { spliceConnection } from './connections_splice.js?v=7';
import { edgeMin8800, filletMin8800 } from './connections.js?v=7';
import { lcspConnection, gussetChordWeld, baseColumnWeld } from './connections_weld.js?v=7';
import { lmssConnection, weldedSplice } from './connections_rigid.js?v=7';

export { PLATES } from './connections.js?v=7';
import { PLATES } from './connections.js?v=7';
const up5 = (v) => Math.ceil(v / 5 - 1e-9) * 5;
const INCH = 25.4;
// AISC Manual 16th ed. Table 1-7A — workable gages (in): leg → [g, g1, g2]
const GAGES = [[12, 6, 3, 2.5], [10, 5, 3, 2.5], [8, 4.5, 3, 3], [7, 4, 2.5, 3], [6, 3.5, 2.25, 2.5], [5, 3, 2, 1.75], [4, 2.5], [3.5, 2], [3, 1.75],
  [2.5, 1.375], [2, 1.125], [1.75, 1], [1.5, 0.875], [1.375, 0.875], [1.25, 0.75], [1, 0.625]];
export function angleGage(bmm) {
  const leg = bmm / INCH + 1e-6, r = GAGES.find(([l]) => l <= leg);
  if (!r) return null;
  return { g: r[1] * INCH, g1: r[2] ? r[2] * INCH : null, g2: r[3] ? r[3] * INCH : null, leg: r[0] };
}
export const DEFAULTS = {
  ligacaoFlexivel: 'cantoneira', excentricidade: true,
  parafuso8800: 'ASTM F3125 A325', parafuso14762: 'ASTM A307', rosca: true,
  diam8800: [15.875, 19.05, 22.225, 25.4], diam14762: [12.5, 16], nMax: 8,
  chapaNoMin: 8, chapaNoMin14762: 4.75, Lw: 100,
  fck: 25, A2A1: 1, fyPlaca: 250, minimo50: false,
  rigidas: 'lmss', emendaTipo: 'talas', soldaBase: true, soldaChapaBanzo: true,
};

/* ------------------------------------------------------------------------------------------------ topology */
const sub = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const norm = (v) => Math.hypot(...v);
export function topology(topo) {
  const nodes = new Map(topo.nodes.map((n) => [n.id, n])), ends = new Map();
  for (const e of topo.elems) {
    const a = nodes.get(e.n1), b = nodes.get(e.n2), d = sub(b, a), L = norm(d);
    e._L = L; e._dir = d.map((x) => x / (L || 1)); e._vert = L > 0 && Math.abs(d[2]) / L >= 0.95; e._horiz = L > 0 && Math.abs(d[2]) / L <= 0.05;
    for (const [nid, o] of [[e.n1, 0], [e.n2, 6]]) { if (!ends.has(nid)) ends.set(nid, []); ends.get(nid).push({ e, o }); }
  }
  return { nodes, ends, elems: topo.elems };
}
const pinned = (e, o) => !!(e.rel?.[o + 4] && e.rel?.[o + 5]);
const majorReleased = (e, o) => !!e.rel?.[o + 5];
const continuous = (e, o) => !(e.rel?.[o + 4] || e.rel?.[o + 5]);
const AXIAL_SHAPES = new Set(['angle', 'L', '2L', 'U', 'Ue', 'channel', 'flat']);

/** candidate splice nodes: exactly 2 collinear members, same section name, continuous at the node, not a support */
export function spliceCandidates(T) {
  const out = [];
  for (const [nid, list] of T.ends) {
    if (list.length !== 2 || T.nodes.get(nid).support) continue;
    const [p, q] = list;
    if (p.e.name !== q.e.name || !continuous(p.e, p.o) || !continuous(q.e, q.o)) continue;
    const dot = Math.abs(p.e._dir.reduce((s, v, i) => s + v * q.e._dir[i], 0));
    if (dot > 0.999) out.push({ node: nid, elems: [p.e.id, q.e.id], name: p.e.name });
  }
  return out;
}

export function classify(T, P = {}) {
  const { spliceNodes = new Set(), emendaTipo = 'talas' } = P;
  const conns = [], avisos = [];
  for (const [nid, list] of T.ends) {
    const node = T.nodes.get(nid);
    if (node.support) {
      const col = list.find(({ e }) => e._vert && !e.cable);
      if (col) {
        if (col.e.shape === 'I') conns.push({ id: `B${nid}`, tipo: 'base', node: nid, elem: col.e.id, o: col.o });
        else avisos.push(`Nó ${nid}: base de pilar com seção "${col.e.name}" — a 6.7 cobre só pilares I/H (tubulares: NBR 16239); não dimensionada.`);
      }
    }
    if (spliceNodes.has(nid) && list.length === 2) {
      const [p, q] = list;
      if (p.e.shape === 'I') conns.push({ id: `E${nid}`, tipo: emendaTipo === 'soldada' ? 'emendaSoldada' : 'emenda', node: nid, elem: p.e.id, o: p.o, elem2: q.e.id });
      else avisos.push(`Nó ${nid}: emenda de "${p.e.name}" — v1 só emenda perfis I; não dimensionada.`);
    }
    const hasCont = (skip) => list.some(({ e, o }) => e !== skip && continuous(e, o) && !e.cable);
    for (const { e, o } of list) {
      if (e.cable || e.excluded) continue;
      if (pinned(e, o) && AXIAL_SHAPES.has(e.shape)) {
        if (hasCont(e) || list.length > 1) conns.push({ id: `T${e.id}${o ? 'j' : 'i'}`, tipo: 'trelica', node: nid, elem: e.id, o });
      } else if (majorReleased(e, o) && e.shape === 'I' && e._horiz && !node.support) {
        const supp = list.find(({ e: s, o: so }) => s !== e && continuous(s, so) && s.shape === 'I');
        if (supp) conns.push({ id: `F${e.id}${o ? 'j' : 'i'}`, tipo: 'flexivel', node: nid, elem: e.id, o, apoio: supp.e.id, vigaViga: supp.e._horiz });
        else avisos.push(`Barra ${e.id}, nó ${nid}: extremidade rotulada sem elemento suporte de perfil I contínuo — não dimensionada.`);
      } else if (pinned(e, o) && e.shape === 'I' && !e._horiz && !node.support) {
        // diagonal / bracing in an I section connected by the web to a gusset plate (5.2.5-c, 2 fictitious U)
        if (hasCont(e)) conns.push({ id: `T${e.id}${o ? 'j' : 'i'}`, tipo: 'trelica', node: nid, elem: e.id, o });
        else avisos.push(`Barra ${e.id} (${e.name}), nó ${nid}: perfil I rotulado sem barra contínua no nó — não dimensionada.`);
      } else if (majorReleased(e, o) && e.shape === 'I' && !e._horiz && !node.support) {
        avisos.push(`Barra ${e.id} (${e.name}), nó ${nid}: perfil I com rótula só no eixo forte, inclinado/vertical — tipo de ligação não previsto; dimensionar à parte.`);
      } else if (continuous(e, o) && e.shape === 'I' && e._horiz && !node.support && P.rigidas !== 'nao') {
        // rigid beam → column (LMSS): continuous I beam end at a node where a vertical I column is continuous
        const col = list.find(({ e: s, o: so }) => s !== e && s._vert && s.shape === 'I' && continuous(s, so));
        if (col) {
          const other = list.find(({ e: s, o: so }) => s !== e && s._horiz && s.shape === 'I' && continuous(s, so) && Math.abs(s._dir.reduce((q, v, i) => q + v * e._dir[i], 0)) > 0.999);
          if (other && other.e.id < e.id) continue;   // beam continuous over the column: one LMSS per node (2 lados), not one per end
          conns.push({ id: `R${e.id}${o ? 'j' : 'i'}`, tipo: 'lmss', node: nid, elem: e.id, o, apoio: col.e.id, oApoio: col.o, outra: other ? { elem: other.e.id, o: other.o } : null,
            extremidade: !list.some(({ e: s, o: so }) => s !== col.e && s._vert && s.shape === 'I' && continuous(s, so)) });
        }
      } else if ((pinned(e, o) || majorReleased(e, o)) && !node.support && !AXIAL_SHAPES.has(e.shape) && e.shape !== 'I') {
        avisos.push(`Barra ${e.id} (${e.name}), nó ${nid}: ligação rotulada de seção "${e.shape}" — tipo não previsto na v1.`);
      }
    }
  }
  // gusset plate → chord weld: one per node with truss members on a continuous chord (Fakury 10.14.3)
  if (P.soldaChapaBanzo !== false) {
    const byNode = new Map(); for (const c of conns) if (c.tipo === 'trelica') { if (!byNode.has(c.node)) byNode.set(c.node, []); byNode.get(c.node).push(c); }
    for (const [nid, tl] of byNode) {
      const chord = T.ends.get(nid).find(({ e, o }) => continuous(e, o) && !e.cable && !tl.some((c) => c.elem === e.id));
      if (chord) conns.push({ id: `S${nid}`, tipo: 'chapaBanzo', node: nid, elem: chord.e.id, o: chord.o, membros: tl.map((c) => ({ elem: c.elem, o: c.o })) });
    }
  }
  return { conns, avisos };
}

/* ------------------------------------------------------------------------------------------------ forces */
const endF = (f, o) => o === 0 ? { V: Math.abs(f.Vy1), Vw: Math.abs(f.Vz1), M: Math.abs(f.Mz1), Mw: Math.abs(f.My1) } : { V: Math.abs(f.Vy2), Vw: Math.abs(f.Vz2), M: Math.abs(f.Mz2), Mw: Math.abs(f.My2) };
function demands(c, T, combos) {
  return combos.map((cb) => {
    const f = cb.ef(c.elem); if (!f) return null;
    const ef = endF(f, c.o);
    if (c.tipo === 'base' || c.tipo === 'soldaBase') {
      const R = cb.R(c.node) || [0, 0, 0, 0, 0, 0];
      return { combo: cb.name, N: R[2], V: Math.hypot(R[0], R[1]), M: ef.M, Mw: ef.Mw };     // N > 0 compression on the base
    }
    if (c.tipo === 'lmss') {
      const fc = cb.ef(c.apoio), ec = fc ? endF(fc, c.oApoio) : { V: 0 };
      const f2 = c.outra ? cb.ef(c.outra.elem) : null;
      // column shear with unknown sense relative to the flange force → added (conservative, 5.7.7.1 algebraic sum)
      return { combo: cb.name, N: f.N, V: ef.V, M: ef.M, Mw: ef.Mw, Ncol: fc ? -fc.N : 0, Vcol: +ec.V, M2: f2 ? endF(f2, c.outra.o).M : 0 };
    }
    if (c.tipo === 'chapaBanzo') {
      // resultant on the gusset of the members at the node: Σ N·u (u from the node outward; tension pulls the plate)
      const F = [0, 0, 0];
      for (const m of c.membros) { const fm = cb.ef(m.elem), em = T.elems.find((x) => x.id === m.elem); if (!fm || !em) continue;
        const u = m.o === 0 ? em._dir : em._dir.map((v) => -v); for (let i = 0; i < 3; i++) F[i] += fm.N * u[i]; }
      const ch = T.elems.find((x) => x.id === c.elem)._dir, Fpar = F.reduce((q, v, i) => q + v * ch[i], 0);
      const Fperp = Math.hypot(...F.map((v, i) => v - Fpar * ch[i]));
      return { combo: cb.name, Fpar: Math.abs(Fpar), Fperp, N: Math.hypot(Fpar, Fperp), V: 0, M: 0 };
    }
    return { combo: cb.name, N: f.N, V: ef.V, Vw: ef.Vw, M: ef.M, Mw: ef.Mw };
  }).filter(Boolean);
}

/* ------------------------------------------------------------------------------------------------ candidates */
function memberSection(e) {
  const d = e.dims || {}, s = e.shape;
  if (s === 'angle') return { tipo: 'L', b: Math.max(d.d, d.b), b2: Math.min(d.d, d.b), t: d.t, A: e.A, ec: e.ec, desigual: Math.abs(d.d - d.b) > 0.5, laminado: true };
  if (s === 'I') return { tipo: 'I', d: d.d, bf: d.bf, tf: d.tf, tw: d.tw, t: d.tw, bw: d.d - 2 * d.tf, A: e.A, laminado: true };
  if (s === 'L') return { tipo: 'L', b: d.b, b2: d.b, t: d.t, A: e.A, ec: e.ec };
  if (s === '2L') return { tipo: '2L', b: d.b, b2: d.b, t: d.t, A: e.A / 2, ec: e.ec };
  if (s === 'U' || s === 'Ue') return { tipo: 'U', bw: d.bw, bf: d.bf, t: d.t, A: e.A, ec: e.ec };
  if (s === 'channel') return { tipo: 'U', bw: d.d, bf: d.bf, t: d.tw, A: e.A, ec: e.ec, laminado: true };
  if (s === 'flat') return { tipo: 'chapa', b: d.b, t: d.t };
  return null;
}
function* trussCandidates(e, P) {
  const sec = memberSection(e); if (!sec) return;
  const cf = sec.t <= 4.75 && !sec.laminado && sec.tipo !== 'I', diams = cf ? P.diam14762 : P.diam8800, grade = cf ? P.parafuso14762 : P.parafuso8800;
  const legB = sec.tipo === 'U' || sec.tipo === 'I' ? sec.bw : sec.b;
  const t0 = cf ? P.chapaNoMin14762 : Math.max(P.chapaNoMin, sec.t);
  for (const db of diams) for (let n = 1; n <= P.nMax; n++) for (const tg of PLATES.filter((x) => x >= t0 - 1e-9).slice(0, 5)) {
    const emin = cf ? up5(db * 1.5) : up5(edgeMin8800(db) || 1.25 * db), s = up5(3 * db);
    let gHeel, linhas = 1, g = 0;
    if (sec.tipo === 'L' || sec.tipo === '2L') { const ga = !cf && angleGage(legB); gHeel = ga ? ga.g : legB / 2; }
    else if ((sec.tipo === 'U' || sec.tipo === 'I') && legB >= 4 * s) { linhas = 2; g = up5(legB / 2); }
    yield { secao: { ...sec, fy: e.fy, fu: e.fu }, chapa: { t: tg, fy: P.fyChapa ?? 250, fu: P.fuChapa ?? 400, eBorda: emin, Lw: P.Lw, eLat: Math.max(emin, (n - 1) * s * Math.tan(Math.PI / 6)) },   // eLat = lwh/2 (geometria da chapa não está no modelo — conservador)
      meio: 'parafuso', par: { grade, db, n, linhas, s, g, e1: emin, gHeel, rosca: P.rosca }, desc: `${n * linhas} × Ø${fmtD(db)} (${grade.replace('ASTM F3125 ', '').replace('ISO 898-1 classe', 'ISO')}), s = ${s}, e = ${emin}; chapa de nó ${n2(tg)} mm` };
  }
  // welded alternative (no holes: An = A) — two longitudinal fillets along the connected element
  const tmin0 = Math.min(sec.t, t0);
  for (const tg of PLATES.filter((x) => x >= t0 - 1e-9).slice(0, 5)) for (let L = 40; L <= 400; L += 10) {
    const dw = cf ? Math.max(sec.t, 2) : Math.max(filletMin8800(Math.min(sec.t, tg)), 3);
    yield { secao: { ...sec, fy: e.fy, fu: e.fu }, chapa: { t: tg, fy: P.fyChapa ?? 250, fu: P.fuChapa ?? 400, eBorda: 0, Lw: P.Lw }, meio: 'solda',
      sol: { dw, L1: L, L2: L, Lt: 0, eletrodo: 'E70' }, desc: `soldada: 2 filetes ${n2(dw)} mm × ${L} mm (E70)${sec.tipo === '2L' ? ' por cantoneira' : ''}; chapa de nó ${n2(tg)} mm`, _t: tmin0 };
  }
}
const n2 = (v) => String(+(+v).toFixed(2)).replace('.', ',');
const fmtD = (db) => ({ 12.5: '12,5', 12.7: '½"', 15.875: '⅝"', 19.05: '¾"', 22.225: '⅞"', 25.4: '1"' }[db] || String(db));
function gerdauFlex(d) {
  if (d < 250) return { db: 15.875, s: 60, e: 30, ang: { b: 76, t: 6.4, g: 45 } };
  if (d < 530) return { db: 19.05, s: 75, e: 40, ang: { b: 76, t: 6.4, g: 45 } };
  return { db: 22.225, s: 75, e: 40, ang: { b: 102, t: 8, g: 65 } };
}
function* flexCandidates(e, sup, P, c = {}) {
  const { d, tw, tf } = e.dims, G = gerdauFlex(d), hw = d - 2 * tf;
  const supT = Math.min(sup.dims.tf, sup.dims.tw);
  // viga–viga: copes of the supported beam (tops aligned assumed): Gerdau 3.3 — Lh = (bf − tw)/2 of the support, Lv = tf + 10
  const recorte = c.vigaViga ? { n: d >= sup.dims.d - 1 ? 2 : 1, Lh: Math.ceil((sup.dims.bf - sup.dims.tw) / 2), Lv: Math.ceil(sup.dims.tf + 10), ya: 75 } : null;
  const n0 = Math.max(2, Math.ceil((d / 2 - 2 * G.e) / G.s + 1 - 1e-9));             // angle length ≥ d/2 (Gerdau 3.1.1)
  for (let n = n0; (n - 1) * G.s + 2 * G.e <= hw - 10 + 1e-9 || n === n0; n++) {
    const L = (n - 1) * G.s + 2 * G.e, viga = { tw, d, bf: e.dims.bf, tf, fy: e.fy, fu: e.fu };
    const par = { grade: P.parafuso8800, db: G.db, n, s: G.s, rosca: P.rosca, ...(P.dhGerdau ? { dh: P.dhGerdau[G.db] } : {}) };
    if (P.ligacaoFlexivel === 'lcsp') {
      for (const dw of [5, 6, 8]) yield { _tipo: 'lcsp', viga, cant: { b: G.ang.b, t: G.ang.t, L, ev: G.e, g: G.ang.g, fy: 250, fu: 400 }, solda: { dw, eletrodo: 'E70' }, suporte: { t: supT, fu: sup.fu },
        par, recorte, desc: `2L ${G.ang.b}×${G.ang.b}×${n2(G.ang.t)} × ${L} mm soldadas na alma (filete ${dw} mm em C), ${n} × Ø${fmtD(G.db)} por aba no suporte (Gerdau LCSP)${recorte ? `; ${recorte.n} recorte(s) Lh ${recorte.Lh} × Lv ${recorte.Lv}` : ''}` };
    } else if (P.ligacaoFlexivel === 'chapa') {
      for (const tp of PLATES.filter((x) => x >= 6.3 && x <= 16)) yield { tipo: 'chapa', viga, chapa: { t: tp, fy: 250, fu: 400, ev: G.e, eh: G.e, a: G.e + 10, ebv: G.e }, solda: { dw: Math.max(5, Math.min(8, Math.ceil(0.75 * tp))), eletrodo: 'E70' }, pilar: { t: supT }, par, desc: `chapa simples ${n2(tp)} × ${L} mm, ${n} × Ø${fmtD(G.db)}` };
    } else {
      yield { tipo: 'cantoneira', viga, cant: { b: G.ang.b, b2: G.ang.b, t: G.ang.t, L, fy: 250, fu: 400, ev: G.e, eh: G.ang.b - G.ang.g, a: G.ang.g, gc: G.ang.g, ebv: G.ang.g - 10 },
        pilar: { t: supT, fu: sup.fu }, par, opts: { excentricidade: P.excentricidade }, recorte, desc: `2L ${G.ang.b}×${G.ang.b}×${n2(G.ang.t)} × ${L} mm, ${n} × Ø${fmtD(G.db)} por aba (Gerdau LCPP)${recorte ? `; ${recorte.n} recorte(s) Lh ${recorte.Lh} × Lv ${recorte.Lv}` : ''}` };
    }
    if (n > 20) break;
  }
}
function* baseCandidates(e, P) {
  const { d, bf, tw, tf } = e.dims;
  for (const nb of [4, 6, 8]) for (const T of TAB18) {
    const a1 = T.a1, a2 = Math.max(T.a2, up5((bf + 25 - 2 * a1) / (0.5 * nb - 1)));
    for (const tp of PLATES.filter((x) => x >= 12.5)) yield { pilar: { d, bf, tw, tf }, tipo: 1, nb, db: T.db, a1, a2, placa: { fy: P.fyPlaca, tp }, concreto: { fck: P.fck, A2A1: P.A2A1 }, chumbador: { fy: 250, fu: 400 },
      desc: `placa ${d + 4 * a1} × ${(0.5 * nb - 1) * a2 + 2 * a1} × ${n2(tp)} mm, ${nb} chumbadores Ø ${T.pol}" (A36)` };
  }
}
function* spliceCandidatesGeo(e, P) {
  const { d, bf, tw, tf } = e.dims;
  const db = bf <= 150 ? 15.875 : 19.05, emin = up5(edgeMin8800(db)), s = up5(3 * db), e2 = Math.max(emin, 40), g = bf - 2 * e2;
  const linhas = g >= 2.7 * db && (g - tw) / 2 >= 1.35 * db ? 2 : 1;                     // Fakury 10.14.7 b: furo → alma ≥ 1,35·db
  const hT = up5(d - 2 * tf - 40) - 0, nr = Math.max(2, Math.floor((hT - 2 * emin) / s) + 1);
  for (let ncol = 2; ncol <= 8; ncol++) for (const tt of PLATES.filter((x) => x >= Math.max(6.3, 0.6 * tf)).slice(0, 6)) for (const nc of [1, 2]) {
    const tta = PLATES.find((x) => x >= Math.max(6.3, tw / 2));
    yield { tipo: 'perfilI', folga: 10, perfil: { d, bf, tf, tw, fy: e.fy, fu: e.fu }, talaMesa: { t: tt, b: bf, fy: 250, fu: 400 }, talaAlma: { h: hT, t: tta, fy: 250, fu: 400 },
      parMesa: { grade: P.parafuso8800, db, rosca: P.rosca, linhas: linhas === 2 ? 2 : 1, ncol, s, g: linhas === 2 ? g : 0, e1: emin, et: emin, e2: linhas === 2 ? e2 : bf / 2 },
      parAlma: { grade: P.parafuso8800, db, rosca: P.rosca, nr, nc, sv: s, sh: s, e1w: emin, ev: (hT - (nr - 1) * s) / 2, et: emin },
      desc: `mesas: tala ${n2(bf)} × ${n2(tt)}, ${linhas * ncol} × Ø${fmtD(db)} por lado; alma: 2 talas ${n2(hT)} × ${n2(tta)}, ${nr * nc} × Ø${fmtD(db)} por lado` };
  }
}

function* lmssCandidates(e, col, P) {
  const B = { ...e.dims, fy: e.fy, fu: e.fu, Zx: e.Zx, Wx: e.Wx }, C0 = { ...col.dims, fy: col.fy, fu: col.fu, A: col.A, r: col.dims.r ?? 0 };
  for (const reforco of [0, ...PLATES.filter((x) => x >= 6.3 && x <= 25)]) for (const dw of [5, 6, 8, 10, 12]) {
    if (dw < filletMin8800(Math.min(B.tw, C0.tf))) continue;
    yield { viga: B, pilar: C0, solda: { dw, eletrodo: 'E70' }, reforco, desc: `mesas com penetração total; alma com filete duplo ${dw} mm${reforco ? `; chapas de reforço do painel 2 × ${n2(reforco)} mm (5.7.7.2)` : ''}` };
  }
}
function* soldaBaseCandidates(e, tp) {
  for (let dw = Math.max(3, filletMin8800(Math.min(e.dims.tf, tp))); dw <= 16; dw++) yield { pilar: { ...e.dims, fy: e.fy, fu: e.fu }, tp, dw, eletrodo: 'E70', desc: `filetes de ${dw} mm em todo o contorno do pilar (E70)` };
}
function* chapaBanzoCandidates(chord, tg) {
  const tc = chord.shape === 'I' || chord.shape === 'channel' ? chord.dims.tf : chord.dims.t;
  const cf = Math.min(tg, tc) <= 4.75, dw = cf ? Math.max(Math.min(tg, tc), 2) : Math.max(3, filletMin8800(Math.min(tg, tc)));
  for (let L = 60; L <= 1500; L += 10) yield { dw, L, tg, tc, fy: 250, fu: 400, fuChord: chord.fu, eletrodo: 'E70', desc: `2 filetes ${n2(dw)} mm × ${L} mm (chapa de nó ${n2(tg)} mm ao banzo)` };
}

/* ------------------------------------------------------------------------------------------------ run one connection */
function evaluate(c, geo, dem, P) {
  let worst = null;
  for (const D of dem) {
    let r;
    try {
      if (c.tipo === 'trelica') {
        r = trussMemberConnection({ ...geo, N: Math.abs(D.N) < 1e-9 ? 1e-6 : D.N, opts: { minimo50: P.minimo50 } });   // N = 0 → mínimo de 45 kN / 50 % NRd
      } else if (c.tipo === 'flexivel') r = geo._tipo === 'lcsp' ? lcspConnection({ ...geo, V: D.V }) : shearConnection({ ...geo, V: D.V });
      else if (c.tipo === 'lmss') r = lmssConnection({ ...geo, M: D.M, V: D.V, N: D.N, Ncol: D.Ncol, Vcol: D.Vcol, lados: c.outra ? 2 : 1, M2: D.M2, extremidade: c.extremidade });
      else if (c.tipo === 'emendaSoldada') r = weldedSplice({ ...geo, N: D.N, M: D.M, V: D.V });
      else if (c.tipo === 'soldaBase') r = baseColumnWeld({ ...geo, N: D.N, M: D.M, V: D.V });
      else if (c.tipo === 'chapaBanzo') r = gussetChordWeld({ ...geo, Fpar: D.Fpar, Fperp: D.Fperp });
      else if (c.tipo === 'base') {
        r = columnBase({ ...geo, N: D.N, M: D.M, V: D.V, cis: { tipo: 'atrito' } });
        // friction not enough (or T1/T2: no friction) → welded special washers (6.7.2.3/6.7.2.5, Tab. 18)
        const failV = r.checks.filter((x) => !x.ok && !x.info);
        if (failV.length && failV.every((x) => /Força cortante/.test(x.g))) r = columnBase({ ...geo, N: D.N, M: D.M, V: D.V, cis: { tipo: 'arruelas' } });
      }
      else r = spliceConnection({ ...geo, N: D.N, M: D.M, V: D.V });
    } catch (err) { return { ok: false, erro: err.message }; }
    const ratio = r.ok ? r.ratioMax : Math.max(r.ratioMax, 1 + 1e-6) + (r.checks.filter((x) => !x.ok && !x.info).length);
    if (!worst || ratio > worst.ratio) worst = { r, D, ratio, ok: r.ok };
    if (!r.ok) return { ...worst, ok: false };
  }
  return worst || { ok: true, ratio: 0, r: null, D: null };
}
// (b) construction requirements of the gusset plate assumed by the pre-sizing (its geometry is not in the model)
function gussetReq(o) {
  if (o.c.tipo !== 'trelica' || !o.geo) return o;
  const g = o.geo, t30 = Math.tan(Math.PI / 6);
  const bConn = g.secao.tipo === 'U' ? g.secao.bw : g.secao.b;
  const lwh = g.meio === 'parafuso' ? (g.par.linhas - 1) * (g.par.g || 0) + 2 * (g.par.n - 1) * g.par.s * t30 : bConn + 2 * Math.max(g.sol.L1, g.sol.L2) * t30;
  const f = (v) => String(Math.ceil(v));
  const req = `Chapa de nó (requisitos admitidos no cálculo): largura na seção de Whitmore ≥ ${f(lwh)} mm${g.meio === 'parafuso' && g.par.linhas === 1 ? `; borda lateral a partir da linha de parafusos ≥ ${f(g.chapa.eLat)} mm` : ''}; distância Whitmore → solda ao banzo ≤ ${f(g.chapa.Lw)} mm; ligação ao banzo e cisalhamento da chapa verificados à parte`;
  return { ...o, req };
}
export function designConnection(c, T, combos, P = {}) {
  P = { ...DEFAULTS, ...P };
  const e = T.elems.find((x) => x.id === c.elem), dem = demands(c, T, combos);
  if (!dem.length) return { c, ok: false, erro: 'sem esforços nas combinações de ELU' };
  const gen = c.tipo === 'trelica' ? trussCandidates(e, P) : c.tipo === 'flexivel' ? flexCandidates(e, T.elems.find((x) => x.id === c.apoio), P, c)
    : c.tipo === 'base' ? baseCandidates(e, P) : c.tipo === 'lmss' ? lmssCandidates(e, T.elems.find((x) => x.id === c.apoio), P)
    : c.tipo === 'emendaSoldada' ? [{ perfil: { ...e.dims, fy: e.fy, fu: e.fu }, penetracao: 'total', eletrodo: 'E70', desc: 'penetração total nas mesas e na alma (E70, compatibilidade total)' }]
    : c.tipo === 'soldaBase' ? soldaBaseCandidates(e, c.tp) : c.tipo === 'chapaBanzo' ? chapaBanzoCandidates(e, c.tg) : spliceCandidatesGeo(e, P);
  // scope limits that no geometry fixes (reported, never hidden)
  const lim = [];
  const MwMax = Math.max(...dem.map((d) => d.Mw || 0)), NMax = Math.max(...dem.map((d) => Math.abs(d.N || 0)));
  let baseFora = false;
  if (c.tipo === 'base' && MwMax > 0) {
    // tolerance RELATIVE to the column: 5 % of the weak-axis plastic moment Zy·fy/γa1 (revisão: absolute 1 kN·m rejected)
    const { d: dd, bf, tw, tf } = e.dims, Zy = 2 * tf * bf * bf / 4 + (dd - 2 * tf) * tw * tw / 4, MplW = Zy * e.fy / 1.1 / 1e6, tol = 0.05 * MplW;
    const txt = `momento no eixo de menor inércia do pilar até ${MwMax.toFixed(2).replace('.', ',')} kN·m (tolerância: 5 % de Zy·fy/γa1 = ${tol.toFixed(2).replace('.', ',')} kN·m)`;
    if (MwMax > tol) { baseFora = true; lim.push(`${txt} — fora da 6.7.1.3 (só eixo de maior inércia): base dimensionada para N, M (eixo forte) e V; verificar o eixo fraco por outro método`); }
    else lim.push(`${txt} — desprezado`);
  }
  if (['flexivel', 'emenda', 'emendaSoldada', 'lmss'].includes(c.tipo)) lim.push('torção e esforços do eixo de menor inércia não entram nesta ligação');
  if (c.tipo === 'flexivel' && c.vigaViga) lim.push('viga–viga: topos alinhados admitidos para os recortes (Lh = (bf − tw)/2 e Lv = tf + 10 mm do suporte, Gerdau 3.3)');
  if (c.tipo === 'lmss' && c.outra) lim.push('ligação dos dois lados do pilar: painel com (M1 + M2)/(d − tf) e instabilidade da alma por compressão (5.7.6)');
  if (c.tipo === 'chapaBanzo') lim.push('comprimento mínimo da solda calculado; a chapa de nó real deve ter pelo menos esse comprimento ao longo do banzo; seção vertical da chapa (Fakury, linha 1) à parte');
  if (c.tipo === 'trelica' && memberSection(e)?.desigual) lim.push('cantoneira de abas desiguais: admitida ligada pela aba maior');
  if (c.tipo === 'base' && T.nodes.get(c.node)?.springRest) lim.push('apoio elástico (mola) tratado como base de pilar');
  if (c.tipo === 'flexivel' && NMax > 5) lim.push(`força normal na viga até ${NMax.toFixed(1).replace('.', ',')} kN não verificada na ligação flexível (só V; ver Gerdau 3.4.2, caso 2)`);
  const finish0 = (o) => o.r?.checks?.some((x) => /Arruelas especiais/.test(x.nome)) ? { ...o, desc: `${o.desc} + arruelas especiais soldadas (6.7.2.5)` } : o;
  const finish = (o0) => { const o = finish0(gussetReq(o0)); return lim.length ? { ...o, ok: baseFora ? false : o.ok, nota: [o.nota, ...lim].filter(Boolean).join(' · ') } : o; };
  let best = null, tried = 0;
  for (const geo of gen) {
    tried++;
    const ev = evaluate(c, geo, dem, P);
    if (ev.ok && !ev.erro) return finish({ c, ok: true, geo, desc: geo.desc, ratio: ev.ratio, r: ev.r, D: ev.D, tried, dem });
    if (!best || (!ev.erro && (best.ev.erro || ev.ratio < best.ev.ratio))) best = { geo, ev };
    if (tried > 6000) break;
  }
  if (!best) return { c, ok: false, erro: 'seção não suportada para pré-dimensionamento' };
  // nothing passes: report the candidate of smallest ratio and what governs it
  const gov = best.ev.r?.governa;
  const why = gov ? `nenhuma geometria da lista atende — a de menor razão é mostrada; governa: ${gov.nome}${/seção líquida|Escoamento da seção bruta/.test(gov.nome) ? ' (a própria barra na região da ligação — rever o perfil)' : ''}` : (best.ev.erro || 'nenhuma geometria atende');
  return finish({ c, ok: false, geo: best.geo, desc: best.geo.desc, ratio: best.ev.ratio, r: best.ev.r, D: best.ev.D, erro: best.ev.erro, nota: why, tried, dem });
}
export function designAll(topo, combos, P = {}) {
  P = { ...DEFAULTS, ...P };
  const T = topology(topo), { conns, avisos } = classify(T, P);
  const first = conns.filter((c) => c.tipo !== 'chapaBanzo');
  const rows = first.map((c) => designConnection(c, T, combos, P));
  // dependent welds: column → base plate (tp of the base adopted) and gusset → chord (thickest gusset adopted at the node)
  if (P.soldaBase) for (const r of rows.filter((x) => x.c.tipo === 'base' && x.geo)) rows.push(designConnection({ id: `W${r.c.node}`, tipo: 'soldaBase', node: r.c.node, elem: r.c.elem, o: r.c.o, tp: r.geo.placa.tp }, T, combos, P));
  for (const c of conns.filter((x) => x.tipo === 'chapaBanzo')) {
    const tg = Math.max(P.chapaNoMin14762, ...rows.filter((x) => x.c.tipo === 'trelica' && x.c.node === c.node && x.geo).map((x) => x.geo.chapa.t));
    rows.push(designConnection({ ...c, tg }, T, combos, P));
  }
  return { rows, avisos, T, candidatosEmenda: spliceCandidates(T) };
}
