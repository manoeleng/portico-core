// ──────────────────────────────────────────────────────────────────────────────
// beam_spans.js — groups nearly-horizontal beam elements into SPANS between supports and CANTILEVERS beyond the
// last support, and measures the deflection of each span relative to its supports (not to the chord of each
// element: a beam meshed in several elements, or a cantilever, would otherwise lose most of its deflection).
//
//   · collinear beam elements sharing a node form one beam line;
//   · support = node with a vertical restraint (uz) or at the top of a COLUMN: a chain of nearly vertical elements
//     (|dz| ≥ 0,8·L) going down to a restrained node. Truss diagonals and posts (which do not reach a restraint)
//     do not make supports — the chord deflection is measured between the real supports;
//   · span between consecutive supports: δ = max |u(s) − ulinear(s)|, u linear between the two support displacements;
//   · cantilever (free end beyond the end support): δ = max |u(s) − u(root)|, L = cantilever length.
// Sampling at xi = 0, 0.1 … 1 of every element of the segment. Units: m.
// ──────────────────────────────────────────────────────────────────────────────

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);

/**
 * @param {object} o
 *   nodes     Map|Array of { id, x, y, z, restraints }
 *   elements  Array of { id, n1, n2 }
 *   isBeam    (el, L, dz) => boolean — which elements are beams (default: |dz| ≤ 0,2·L)
 * @returns [{ kind: 'vao'|'balanco', L, elements: [ids], ends: [nodeA, nodeB] (balanço: [root, tip]), seg: [{ el, s1, s2 }] }]
 */
export function beamSpans({ nodes, elements, isBeam }) {
  const N = nodes instanceof Map ? nodes : new Map(nodes.map(n => [n.id, n]));
  const P = (id) => { const n = N.get(id); return [n.x, n.y, n.z]; };
  const beams = [], verts = [];
  for (const e of elements) {
    const a = N.get(e.n1), b = N.get(e.n2);
    if (!a || !b) continue;
    const d = sub(P(e.n2), P(e.n1)), L = norm(d);
    if (L < 1e-9) continue;
    const beam = isBeam ? isBeam(e, L, d[2]) : Math.abs(d[2]) <= 0.2 * L;
    if (beam) beams.push({ e, L, u: d.map(v => v / L) });
    else if (Math.abs(d[2]) >= 0.8 * L) verts.push(d[2] > 0 ? [e.n1, e.n2] : [e.n2, e.n1]);   // [lower, upper]
  }
  // union-find of collinear beams through shared nodes
  const parent = beams.map((_, i) => i);
  const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const byNode = new Map();
  beams.forEach((b, i) => { for (const n of [b.e.n1, b.e.n2]) { if (!byNode.has(n)) byNode.set(n, []); byNode.get(n).push(i); } });
  for (const list of byNode.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = beams[list[i]].u, b = beams[list[j]].u;
      const c = norm([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
      if (c < 1e-3) parent[find(list[i])] = find(list[j]);
    }
  }
  const groups = new Map();
  beams.forEach((b, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(b); });
  // grounded nodes: vertically restrained (uz), then upwards through vertical elements (fixpoint)
  const grounded = new Set([...N.values()].filter(n => { const r = n.restraints || {}; return r.uz; }).map(n => n.id));
  for (let changed = true; changed;) {
    changed = false;
    for (const [lo, up] of verts) if (grounded.has(lo) && !grounded.has(up)) { grounded.add(up); changed = true; }
  }
  const isSup = (id) => { const r = N.get(id)?.restraints || {}; return !!r.uz || (grounded.has(id) && verts.some(v => v[1] === id)); };
  const out = [];
  for (const g of groups.values()) {
    const u = g[0].u, o = P(g[0].e.n1);
    const s = (id) => { const p = sub(P(id), o); return p[0] * u[0] + p[1] * u[1] + p[2] * u[2]; };
    const seg = g.map(b => { const s1 = s(b.e.n1), s2 = s(b.e.n2); return { el: b.e.id, n1: b.e.n1, n2: b.e.n2, s1, s2, lo: Math.min(s1, s2), hi: Math.max(s1, s2) }; });
    const nodeS = new Map();
    for (const x of seg) { nodeS.set(x.n1, x.s1); nodeS.set(x.n2, x.s2); }
    const sorted = [...nodeS.entries()].sort((a, b) => a[1] - b[1]);
    const sups = sorted.filter(([id]) => isSup(id));
    if (!sups.length) continue;
    const pick = (lo, hi) => seg.filter(x => x.lo >= lo - 1e-9 && x.hi <= hi + 1e-9);
    for (let k = 0; k + 1 < sups.length; k++) {
      const [a, sa] = sups[k], [b, sb] = sups[k + 1];
      const sg = pick(sa, sb);
      if (sg.length) out.push({ kind: 'vao', L: sb - sa, ends: [a, b], sEnds: [sa, sb], seg: sg, elements: sg.map(x => x.el) });
    }
    const [first, sFirst] = sups[0], [last, sLast] = sups[sups.length - 1];
    const [tipL, sTipL] = sorted[0], [tipR, sTipR] = sorted[sorted.length - 1];
    if (sTipL < sFirst - 1e-9) { const sg = pick(sTipL, sFirst); out.push({ kind: 'balanco', L: sFirst - sTipL, ends: [first, tipL], sEnds: [sFirst, sTipL], seg: sg, elements: sg.map(x => x.el) }); }
    if (sTipR > sLast + 1e-9) { const sg = pick(sLast, sTipR); out.push({ kind: 'balanco', L: sTipR - sLast, ends: [last, tipR], sEnds: [sLast, sTipR], seg: sg, elements: sg.map(x => x.el) }); }
  }
  return out;
}

/**
 * Max deflection of a span/cantilever for one load case.
 *   nodeDisp(id) → [ux, uy, uz, …];  elemDisp(elId, xi) → { ux, uy, uz } (xi from n1 to n2)
 */
export function spanDeflection(span, nodeDisp, elemDisp) {
  const [a, b] = span.ends, [sa, sb] = span.sEnds;
  const ua = nodeDisp(a), ub = nodeDisp(b);
  if (!ua || !ub) return 0;
  const ref = (s) => span.kind === 'balanco' ? ua.slice(0, 3)
    : [0, 1, 2].map(i => ua[i] + (ub[i] - ua[i]) * (s - sa) / (sb - sa));
  let dmax = 0;
  for (const x of span.seg) {
    for (let k = 0; k <= 10; k++) {
      const xi = k / 10, d = elemDisp(x.el, xi); if (!d) continue;
      const s = x.s1 + xi * (x.s2 - x.s1);
      dmax = Math.max(dmax, norm(sub([d.ux, d.uy, d.uz], ref(s))));
    }
  }
  return dmax;
}
