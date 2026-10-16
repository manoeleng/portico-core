// connections_geom.js — simplified 3D geometry of the designed connections, for VISUALIZATION (not fabrication): base
// plates and anchor rods, gusset plates and bolts, double angles / shear tabs, splice plates, weld beads. Built from the
// dimensions the designer adopted (row.geo, the same object the checks ran on) and the model geometry (node, member axes).
// Pure: returns primitives in MODEL coordinates (m) — { k: 'box', c, a: [u, v, w], h: [hu, hv, hw], m } (oriented box,
// half sizes along the unit axes) and { k: 'cyl', c, ax, r, h, m } (h = half length) — with m ∈ plate | bolt | anchor |
// weld, plus { k: 'poly', pts, n, h, m } (flat plate: polygon in its mid-plane, normal n, half thickness h). The viewport
// turns them into meshes. ONE gusset per truss node (and per side of the chord): the members of the same plane share a
// plate — the convex hull of each member's bolt (or weld) strip, cut at the chord face where it is welded (chapa de nó–
// banzo), thickness = the largest one adopted at the node (the weld design already takes it). Simplifications
// (declared): bolts on the member axis; the connection centred on the node; stiffeners, copes and washers not drawn;
// anchor length drawn as 12·db.
import { localAxes } from '../solver/timoshenko.js?v=7';

const MM = 1e-3;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : null; };
/** point P + Σ vi·si (si in mm) */
const at = (P, ...terms) => terms.reduce((p, [v, s]) => add(p, mul(v, s * MM)), P);
const box = (c, a, hmm, m) => ({ k: 'box', c, a, h: hmm.map((v) => v * MM), m });
const cyl = (c, ax, rmm, hmm, m) => ({ k: 'cyl', c, ax, r: rmm * MM, h: hmm * MM, m });

// 2D convex hull (monotone chain) and clipping by the half-plane y ≥ y0 (Sutherland–Hodgman)
function hull(P) {
  const pts = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (pts.length < 3) return pts;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function clipY(poly, y0) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ina = a[1] >= y0 - 1e-12, inb = b[1] >= y0 - 1e-12;
    if (ina) out.push(a);
    if (ina !== inb) { const t = (y0 - a[1]) / (b[1] - a[1]); out.push([a[0] + t * (b[0] - a[0]), y0]); }
  }
  return out;
}
/** one gusset per node and plane side from the strips registered by the truss members (ctx._gus) */
function gussets(ctx) {
  const res = [];
  for (const [nid, list] of ctx._gus) {
    const groups = [];
    for (const g of list) {                                         // coplanar members (same plate normal up to sign)
      const G = groups.find((x) => Math.abs(Math.abs(dot(x.n, g.n)) - 1) < 1e-3 && x.cdir === g.cdir && Math.sign(dot(g.u, x.e2)) === x.side);
      if (G) { G.items.push(g); continue; }
      const e1 = g.cdir || g.u, e2 = unit(cross(g.n, e1)) || g.w, side = g.cdir ? (Math.sign(dot(g.u, e2)) || 1) : 1;
      groups.push({ n: g.n, cdir: g.cdir, e1, e2, side, items: [g] });
    }
    groups.forEach((G, gi) => {
      const P = G.items[0].P, tg = Math.max(...G.items.map((g) => g.tg)), hc = Math.max(...G.items.map((g) => g.hc));
      const to2 = (X) => { const d = [X[0] - P[0], X[1] - P[1], X[2] - P[2]]; return [dot(d, G.e1), G.side * dot(d, G.e2)]; };
      const pts = [];
      for (const g of G.items) for (const a of [0, g.Lp]) for (const b of [-g.W / 2, g.W / 2]) pts.push(to2(at(P, [g.u, a], [g.w, b])));
      let poly = hull(pts);
      if (G.cdir) poly = clipY(poly, hc * MM);                      // the plate starts at the chord face (welded there)
      if (poly.length < 3) return;
      const pts3 = poly.map(([x, y]) => add(P, add(mul(G.e1, x), mul(G.e2, G.side * y))));
      // edge on the chord face (where the plate is welded): extent along the chord axis e1, mm from the node
      const onFace = G.cdir ? poly.filter(([, y]) => Math.abs(y - hc * MM) < 1e-9).map(([x]) => x / MM) : [];
      const edge = onFace.length >= 2 ? { x0: Math.min(...onFace), x1: Math.max(...onFace), L: Math.max(...onFace) - Math.min(...onFace) } : null;
      res.push({ id: `G${nid}${groups.length > 1 ? '-' + (gi + 1) : ''}`, tipo: 'trelica', node: nid, prims: [{ k: 'poly', pts: pts3, n: G.n, h: tg / 2 * MM, m: 'plate' }],
        gusset: { tg, membros: G.items.map((g) => g.elem), edge } });
    });
  }
  return res;
}

/** half extents (mm) of a member section along its local y and z (topology dims, mm) */
function halfYZ(e) {
  const d = e?.dims || {};
  if (e?.shape === 'I' || e?.shape === 'channel') return [d.d / 2, d.bf / 2];
  if (e?.shape === 'U' || e?.shape === 'Ue') return [d.bw / 2, d.bf / 2];
  if (e?.shape === '2L') return [d.b / 2, d.b + (d.gap ?? 8) / 2];
  if (e?.shape === 'L' || e?.shape === 'angle') return [Math.max(d.b ?? 0, d.d ?? 0) / 2, Math.max(d.b ?? 0, d.d ?? 0) / 2];
  return [25, 25];
}
/** extent (mm) of member section `e` (axes ax) measured along the unit direction v (⊥ to the member) */
const extentAlong = (e, ax, v) => { const [hy, hz] = halfYZ(e); return Math.abs(dot(v, ax.ey)) * hy + Math.abs(dot(v, ax.ez)) * hz; };
/** face distance (mm) of an I support along v: flange face d/2 when v runs along the web, else web face tw/2 */
const faceI = (e, ax, v) => (Math.abs(dot(v, ax.ey)) >= Math.abs(dot(v, ax.ez)) ? e.dims.d / 2 : e.dims.tw / 2);

/**
 * ctx = { node(id) → {x,y,z}, axes(elemId) → {ex,ey,ez}, elem(id) → topology element (dims mm, shape, rel, cable, _dir),
 *         ends(nodeId) → [{ e, o }] }
 */
export function makeContext(model, T) {
  const axCache = new Map();
  const byId = new Map(T.elems.map((e) => [e.id, e]));
  return {
    node: (id) => model.nodes.get(id),
    elem: (id) => byId.get(id),
    ends: (nid) => T.ends.get(nid) || [],
    axes: (id) => {
      if (!axCache.has(id)) { const el = model.elements.get(id); axCache.set(id, el ? localAxes(model.nodes.get(el.n1), model.nodes.get(el.n2), el.beta || 0) : null); }
      return axCache.get(id);
    },
  };
}
const P3 = (n) => [n.x, n.y, n.z];
/** unit direction of element id leaving node nid */
function outward(ctx, id, nid) {
  const ax = ctx.axes(id), el = ctx.elem(id); if (!ax || !el) return null;
  return el.n1 === nid ? ax.ex : mul(ax.ex, -1);
}
const isCont = (e, o) => !(e.rel?.[o + 4] || e.rel?.[o + 5]);
const isPinned = (e, o) => !!(e.rel?.[o + 4] && e.rel?.[o + 5]);

function anchors(out, P, up, a, b, xs, ys, db, tp) {
  const top = 50, bot = -tp - 12 * db;                         // nut above the plate; 12·db embedded (drawing only)
  for (const x of xs) for (const y of ys) out.push(cyl(at(P, [a, x], [b, y], [up, (top + bot) / 2]), up, db / 2, (top - bot) / 2, 'anchor'));
}
function basePlate(out, P, up, a, b, H, B, tp, nb, db, a1, a2) {
  out.push(box(at(P, [up, -tp / 2]), [a, b, up], [H / 2, B / 2, tp / 2], 'plate'));
  const ys = Array.from({ length: Math.max(2, nb / 2) }, (_, j) => -B / 2 + a1 + j * (a2 || (B - 2 * a1)));
  anchors(out, P, up, a, b, [-(H / 2 - a1), H / 2 - a1], ys, db, tp);
}

const BUILD = {
  base(q, g, ctx, out) {
    const n = ctx.node(q.node), ax = ctx.axes(q.elem), up = outward(ctx, q.elem, q.node); if (!n || !ax || !up) return;
    const H = g.pilar.d + 4 * g.a1, B = (0.5 * g.nb - 1) * g.a2 + 2 * g.a1;
    basePlate(out, P3(n), up, ax.ey, ax.ez, H, B, g.placa.tp, g.nb, g.db, g.a1, g.a2);
  },
  basePerna(q, g, ctx, out) {
    const n = ctx.node(q.node), ax = ctx.axes(q.elem), up = outward(ctx, q.elem, q.node); if (!n || !ax || !up) return;
    const H = g.perna.bw + 4 * g.a1, B = (0.5 * g.nb - 1) * g.a2 + 2 * g.a1;
    basePlate(out, P3(n), up, ax.ey, ax.ez, H, B, g.placa.tp, g.nb, g.db, g.a1, g.a2);
  },
  baseUnica(q, g, ctx, out) {
    const id2 = q.node2 ?? +String(q.id).match(/^PU\d+-(\d+)$/)?.[1];
    const n = ctx.node(q.node), n2 = ctx.node(id2), up = outward(ctx, q.elem, q.node); if (!n || !n2 || !up) return;
    const d = add(P3(n2), mul(P3(n), -1)), w = unit(add(d, mul(up, -dot(d, up)))); if (!w) return;
    const v = unit(cross(up, w)), M = mul(add(P3(n), P3(n2)), 0.5), { H, B, tp } = g.placa;
    out.push(box(at(M, [up, -tp / 2]), [w, v, up], [H / 2, B / 2, tp / 2], 'plate'));
    anchors(out, M, up, w, v, [-(H / 2 - g.a1), H / 2 - g.a1], [-(B / 2 - g.a1), B / 2 - g.a1], g.db, tp);
  },
  soldaBase(q, g, ctx, out) {
    const n = ctx.node(q.node), ax = ctx.axes(q.elem), up = outward(ctx, q.elem, q.node); if (!n || !ax || !up) return;
    const { d, bf, tw, tf } = g.pilar, w = g.dw, P = P3(n);
    for (const s of [-1, 1]) {
      out.push(box(at(P, [ax.ey, s * (d / 2 + w / 2)], [up, w / 2]), [ax.ez, ax.ey, up], [bf / 2, w / 2, w / 2], 'weld'));
      out.push(box(at(P, [ax.ez, s * (tw / 2 + w / 2)], [up, w / 2]), [ax.ey, ax.ez, up], [(d - 2 * tf) / 2, w / 2, w / 2], 'weld'));
    }
  },
  trelica(q, g, ctx, out) {
    const n = ctx.node(q.node), u = outward(ctx, q.elem, q.node), axm = ctx.axes(q.elem); if (!n || !u) return;
    const P = P3(n);
    const chord = ctx.ends(q.node).find(({ e, o }) => e.id !== q.elem && isCont(e, o) && !e.cable);
    const cdir = chord ? ctx.axes(chord.e.id)?.ex : null;
    const nrm = (cdir && unit(cross(u, cdir))) || axm.ez, w = unit(cross(nrm, u));
    let clear = 50, hc = 0;
    if (chord) {
      const p = unit(cross(nrm, cdir)), sin = Math.max(Math.abs(dot(u, p)), 0.3);
      hc = extentAlong(chord.e, ctx.axes(chord.e.id), p);
      clear = Math.min(hc / sin + 20, 400);
    }
    // the gusset itself is shared by the members of the node: register this member's strip (built in gussets())
    const reg = (Lp, W) => { if (!ctx._gus) return; if (!ctx._gus.has(q.node)) ctx._gus.set(q.node, []);
      ctx._gus.get(q.node).push({ elem: q.elem, P, u, w, n: nrm, cdir: chord ? cdir : null, Lp, W, tg, hc }); };
    const sec = g.secao || {}, legB = sec.tipo === 'U' || sec.tipo === 'I' ? (sec.bw ?? sec.d) : sec.b, tg = g.chapa.t;
    const tm = sec.tipo === '2L' ? 2 * sec.t : sec.t;
    if (g.meio === 'solda') {
      const L = g.sol.L1, Lp = clear + L + 10, W = legB + 40;
      reg(Lp, W);
      for (const sw of [-1, 1]) for (const sn of [-1, 1]) out.push(box(at(P, [u, clear + L / 2], [w, sw * legB / 2], [nrm, sn * (tg / 2 + g.sol.dw / 2)]), [u, w, nrm], [L / 2, g.sol.dw / 2, g.sol.dw / 2], 'weld'));
      return;
    }
    const pr = g.par, Lc = 2 * pr.e1 + (pr.n - 1) * pr.s, Lp = clear + Lc + 10;
    const W = Math.max(2 * (g.chapa.eLat ?? pr.e1), legB) + 2 * (g.chapa.eBorda || pr.e1);
    reg(Lp, W);
    const lines = pr.linhas === 2 ? [-pr.g / 2, pr.g / 2] : [0], hl = (tg + 2 * tm + 1.4 * pr.db) / 2;
    for (let i = 0; i < pr.n; i++) for (const yl of lines) out.push(cyl(at(P, [u, clear + pr.e1 + i * pr.s], [w, yl]), nrm, pr.db / 2, hl, 'bolt'));
  },
  chapaBanzo(q, g, ctx, out) {
    const n = ctx.node(q.node), axc = ctx.axes(q.elem); if (!n || !axc) return;
    const P = P3(n), cdir = axc.ex, chord = ctx.elem(q.elem);
    let s = [0, 0, 0];
    for (const { e, o } of ctx.ends(q.node)) if (e.id !== q.elem && isPinned(e, o) && !e.cable) s = add(s, outward(ctx, e.id, q.node) || [0, 0, 0]);
    const nrm = unit(cross(cdir, s)); if (!nrm) return;
    let p = unit(cross(nrm, cdir)); if (dot(p, s) < 0) p = mul(p, -1);
    const hc = extentAlong(chord, axc, p);
    const xm = g.x0 != null && g.x1 != null ? (g.x0 + g.x1) / 2 : 0;          // along the whole gusset edge when designed so
    for (const sn of [-1, 1]) out.push(box(at(P, [cdir, xm], [p, hc + g.dw / 2], [nrm, sn * (g.tg / 2 + g.dw / 2)]), [cdir, p, nrm], [g.L / 2, g.dw / 2, g.dw / 2], 'weld'));
  },
  flexivel(q, g, ctx, out) {
    const n = ctx.node(q.node), u = outward(ctx, q.elem, q.node), ax = ctx.axes(q.elem); if (!n || !u || !ax) return;
    const P = P3(n), sup = q.apoio ?? ctx.ends(q.node).find(({ e, o }) => e.id !== q.elem && isCont(e, o) && e.shape === 'I')?.e.id;
    const se = ctx.elem(sup), ext = se ? faceI(se, ctx.axes(sup), u) : 0;
    const { tw } = g.viga, ey = ax.ey, ez = ax.ez, pr = g.par;
    if (g.tipo === 'chapa') {
      const c = g.chapa, L = (pr.n - 1) * pr.s + 2 * c.ev, Lh = c.a + c.eh;
      out.push(box(at(P, [u, ext + Lh / 2], [ez, tw / 2 + c.t / 2]), [u, ez, ey], [Lh / 2, c.t / 2, L / 2], 'plate'));
      for (const sn of [-1, 1]) out.push(box(at(P, [u, ext + g.solda.dw / 2], [ez, tw / 2 + c.t / 2 + sn * (c.t / 2 + g.solda.dw / 2)]), [u, ez, ey], [g.solda.dw / 2, g.solda.dw / 2, L / 2], 'weld'));
      for (let i = 0; i < pr.n; i++) out.push(cyl(at(P, [u, ext + c.a], [ey, -L / 2 + c.ev + i * pr.s], [ez, c.t / 2]), ez, pr.db / 2, (tw + c.t + 1.4 * pr.db) / 2, 'bolt'));
      return;
    }
    const c = g.cant, b = c.b, t = c.t, L = c.L, gg = c.g ?? c.a ?? b / 2, lcsp = g._tipo === 'lcsp';
    for (const sz of [-1, 1]) {
      out.push(box(at(P, [u, ext + b / 2], [ez, sz * (tw / 2 + t / 2)]), [u, ez, ey], [b / 2, t / 2, L / 2], 'plate'));         // leg on the beam web
      out.push(box(at(P, [u, ext + t / 2], [ez, sz * (tw / 2 + b / 2)]), [u, ez, ey], [t / 2, b / 2, L / 2], 'plate'));         // leg on the support
      for (let i = 0; i < pr.n; i++) out.push(cyl(at(P, [u, ext], [ez, sz * (tw / 2 + gg)], [ey, -L / 2 + c.ev + i * pr.s]), u, pr.db / 2, (t + 15 + 1.4 * pr.db) / 2, 'bolt'));
    }
    if (lcsp) for (const sz of [-1, 1]) out.push(box(at(P, [u, ext + b], [ez, sz * (tw / 2 + t + g.solda.dw / 2)]), [u, ez, ey], [g.solda.dw / 2, g.solda.dw / 2, L / 2], 'weld'));
    else for (let i = 0; i < pr.n; i++) out.push(cyl(at(P, [u, ext + gg], [ey, -L / 2 + c.ev + i * pr.s]), ez, pr.db / 2, (tw + 2 * t + 1.4 * pr.db) / 2, 'bolt'));
  },
  lmss(q, g, ctx, out) {
    const n = ctx.node(q.node), u = outward(ctx, q.elem, q.node), ax = ctx.axes(q.elem); if (!n || !u || !ax) return;
    const P = P3(n), col = q.apoio ?? ctx.ends(q.node).find(({ e, o }) => e.id !== q.elem && isCont(e, o) && e.shape === 'I' && Math.abs(dot(ctx.axes(e.id).ex, u)) < 0.1)?.e.id;
    const ce = ctx.elem(col), axc = col != null ? ctx.axes(col) : null, ext = ce ? faceI(ce, axc, u) : 0;
    const { d, bf, tf, tw } = g.viga, dw = g.solda.dw;
    for (const s of [-1, 1]) {
      out.push(box(at(P, [u, ext + 2], [ax.ey, s * (d / 2 - tf / 2)]), [u, ax.ez, ax.ey], [2, bf / 2, tf / 2], 'weld'));               // CJP flange welds
      out.push(box(at(P, [u, ext + dw / 2], [ax.ez, s * (tw / 2 + dw / 2)]), [u, ax.ez, ax.ey], [dw / 2, dw / 2, (d - 2 * tf) / 2], 'weld'));
    }
    if (g.reforco && ce) {
      const up = axc.ex, pc = g.pilar;
      for (const s of [-1, 1]) out.push(box(at(P, [axc.ez, s * (pc.tw / 2 + g.reforco / 2)]), [axc.ey, axc.ez, up], [(pc.d - 2 * pc.tf) / 2, g.reforco / 2, d / 2], 'plate'));
    }
  },
  emenda(q, g, ctx, out) {
    const n = ctx.node(q.node), ax = ctx.axes(q.elem); if (!n || !ax) return;
    const P = P3(n), u = ax.ex, ey = ax.ey, ez = ax.ez, { d, tf, tw } = g.perfil, TM = g.talaMesa, TA = g.talaAlma, pm = g.parMesa, pa = g.parAlma, f = g.folga;
    const Lm = f + 2 * (pm.e1 + (pm.ncol - 1) * pm.s + pm.et), La = f + 2 * (pa.e1w + (pa.nc - 1) * pa.sh + pa.et);
    for (const s of [-1, 1]) {
      out.push(box(at(P, [ey, s * (d / 2 + TM.t / 2)]), [u, ez, ey], [Lm / 2, TM.b / 2, TM.t / 2], 'plate'));
      out.push(box(at(P, [ez, s * (tw / 2 + TA.t / 2)]), [u, ey, ez], [La / 2, TA.h / 2, TA.t / 2], 'plate'));
    }
    const lines = pm.linhas === 2 ? [-pm.g / 2, pm.g / 2] : [0];
    for (const sx of [-1, 1]) {
      for (let j = 0; j < pm.ncol; j++) for (const zl of lines) for (const s of [-1, 1])
        out.push(cyl(at(P, [u, sx * (f / 2 + pm.e1 + j * pm.s)], [ez, zl], [ey, s * (d / 2 + (TM.t - tf) / 2)]), ey, pm.db / 2, (tf + TM.t + 1.4 * pm.db) / 2, 'bolt'));
      for (let j = 0; j < pa.nc; j++) for (let i = 0; i < pa.nr; i++)
        out.push(cyl(at(P, [u, sx * (f / 2 + pa.e1w + j * pa.sh)], [ey, -TA.h / 2 + pa.ev + i * pa.sv]), ez, pa.db / 2, (tw + 2 * TA.t + 1.4 * pa.db) / 2, 'bolt'));
    }
  },
  emendaSoldada(q, g, ctx, out) {
    const n = ctx.node(q.node), ax = ctx.axes(q.elem); if (!n || !ax) return;
    const P = P3(n), { d, bf, tf, tw } = g.perfil;
    for (const s of [-1, 1]) out.push(box(at(P, [ax.ey, s * (d / 2 - tf / 2)]), [ax.ex, ax.ez, ax.ey], [2, bf / 2 + 1, tf / 2 + 1], 'weld'));
    out.push(box(P, [ax.ex, ax.ez, ax.ey], [2, tw / 2 + 1, (d - 2 * tf) / 2], 'weld'));
  },
};

/**
 * Gusset edges on the chord face per truss node, from the adopted truss rows and the topology (design side: the gusset →
 * chord weld is laid along the whole edge). T = topology() of connections_model (nodes Map, elems with beta, ends).
 * Returns Map nodeId → { x0, x1, L } (mm along the chord axis from the node); with plates on both sides of the chord, the
 * shorter edge (conservative for one weld check per node).
 */
export function gussetEdges(rows, T) {
  const model = { nodes: T.nodes, elements: new Map(T.elems.map((e) => [e.id, { n1: e.n1, n2: e.n2, beta: e.beta || 0 }])) };
  const out = new Map();
  for (const g of connectionPrimitives(rows.filter((r) => (r.c || r).tipo === 'trelica'), makeContext(model, T))) {
    const e = g.gusset?.edge; if (!e) continue;
    const prev = out.get(g.node); if (!prev || e.L < prev.L) out.set(g.node, e);
  }
  return out;
}

/** rows: live ({ c, geo }) or saved ({ id, tipo, node, elem, geo }); returns [{ id, tipo, prims: [...] }] */
export function connectionPrimitives(rows, ctx) {
  const res = [];
  ctx._gus = new Map();
  for (const r of rows) {
    const q = r.c ? r.c : r, g = r.geo, f = BUILD[q.tipo];
    if (!g || !f) continue;
    const prims = [];
    try { f(q, g, ctx, prims); } catch { continue; }            // drawing only: a row with an unexpected geo is skipped
    res.push({ id: q.id, tipo: q.tipo, prims });
  }
  res.push(...gussets(ctx));
  ctx._gus = null;
  return res;
}
