// crossings.js — members that cross or touch WITHOUT a shared node (no force transfer between them). Two kinds:
//   · 'cruz'  — the axes of two members cross at a point interior to both (X crossing) within `tol`;
//   · 'no'    — a node lies on the interior of a member that does not use it (T junction without a node).
// The list is for the model audit: some crossings are intended (an X brace rod passing a purlin, the two rods of an X,
// a sag rod passing a brace — they are not connected in the real structure), others are modelling errors (a diagonal
// drawn without snapping to the chord). `provavelIntencional` flags the crossings that involve a tension-only member
// (cable), the usual intended case. Connecting is up to the user (intersectElements / splitElementAtNode).
//   findCrossings(model, { tol }) → { cruz: [...], no: [...] }

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const P = (n) => [n.x, n.y, n.z];

export function findCrossings(model, { tol = 2e-3 } = {}) {
  const segs = [];
  for (const e of model.elements.values()) {
    const a = model.nodes.get(e.n1), b = model.nodes.get(e.n2); if (!a || !b) continue;
    const p = P(a), q = P(b), d = sub(q, p), L2 = dot(d, d); if (L2 < 1e-12) continue;
    segs.push({ e, p, q, d, L2, L: Math.sqrt(L2),
      lo: [Math.min(p[0], q[0]) - tol, Math.min(p[1], q[1]) - tol, Math.min(p[2], q[2]) - tol],
      hi: [Math.max(p[0], q[0]) + tol, Math.max(p[1], q[1]) + tol, Math.max(p[2], q[2]) + tol] });
  }
  const box = (A, B) => A.lo[0] <= B.hi[0] && B.lo[0] <= A.hi[0] && A.lo[1] <= B.hi[1] && B.lo[1] <= A.hi[1] && A.lo[2] <= B.hi[2] && B.lo[2] <= A.hi[2];
  // sweep along x (sorted by lo.x) to keep the pair test near-linear on big models
  const order = segs.map((s, i) => i).sort((i, j) => segs[i].lo[0] - segs[j].lo[0]);
  const cruz = [];
  for (let ii = 0; ii < order.length; ii++) {
    const A = segs[order[ii]];
    for (let jj = ii + 1; jj < order.length; jj++) {
      const B = segs[order[jj]];
      if (B.lo[0] > A.hi[0]) break;
      if (!box(A, B)) continue;
      const ea = A.e, eb = B.e;
      if (ea.n1 === eb.n1 || ea.n1 === eb.n2 || ea.n2 === eb.n1 || ea.n2 === eb.n2) continue;   // already connected
      const r = sub(A.p, B.p), a = A.L2, e = B.L2, bb = dot(A.d, B.d), c = dot(A.d, r), f = dot(B.d, r), den = a * e - bb * bb;
      if (Math.abs(den) < 1e-12 * a * e) continue;                               // parallel: overlap handled as 'no'
      const s = (bb * f - c * e) / den, t = (a * f - bb * c) / den;
      const es = tol / A.L, et = tol / B.L;                                       // interior to both, by more than tol
      if (s <= es || s >= 1 - es || t <= et || t >= 1 - et) continue;
      const pa = [A.p[0] + s * A.d[0], A.p[1] + s * A.d[1], A.p[2] + s * A.d[2]], pb = [B.p[0] + t * B.d[0], B.p[1] + t * B.d[1], B.p[2] + t * B.d[2]];
      const dist = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
      if (dist > tol) continue;
      const [x, y] = ea.id < eb.id ? [ea, eb] : [eb, ea];
      cruz.push({ a: x.id, b: y.id, P: pa.map((v, k) => +((v + pb[k]) / 2).toFixed(4)), dist: +dist.toFixed(6), provavelIntencional: !!(x.cable || y.cable) });
    }
  }
  // nodes on the interior of a member that does not use them
  const nodes = [...model.nodes.values()].map((n) => ({ n, p: P(n) })).sort((u, v) => u.p[0] - v.p[0]);
  const no = [];
  for (const S of segs) {
    let k0 = 0, hi = nodes.length;                                                // binary search on x for the first node ≥ lo.x
    while (k0 < hi) { const m = (k0 + hi) >> 1; if (nodes[m].p[0] < S.lo[0]) k0 = m + 1; else hi = m; }
    for (let k = k0; k < nodes.length && nodes[k].p[0] <= S.hi[0]; k++) {
      const { n, p } = nodes[k];
      if (n.id === S.e.n1 || n.id === S.e.n2) continue;
      if (p[1] < S.lo[1] || p[1] > S.hi[1] || p[2] < S.lo[2] || p[2] > S.hi[2]) continue;
      const t = dot(sub(p, S.p), S.d) / S.L2, et = tol / S.L;
      if (t <= et || t >= 1 - et) continue;
      const q = [S.p[0] + t * S.d[0], S.p[1] + t * S.d[1], S.p[2] + t * S.d[2]];
      const dist = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (dist <= tol) no.push({ elem: S.e.id, node: n.id, t: +t.toFixed(4), dist: +dist.toFixed(6), provavelIntencional: !!S.e.cable });
    }
  }
  return { cruz, no };
}
