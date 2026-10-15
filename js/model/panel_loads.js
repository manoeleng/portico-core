// panel_loads.js — surface load on a panel ("carga por pano", CYPE 3D): a pressure q [kN/m²] on a planar polygon of
// nodes is distributed to the members lying in it. The panel is an authoring object kept in the load case
// (lc.panels); it is EXPANDED into ordinary member loads (type 'dist', tagged panelId), so every solver, the
// diagrams and the drawing see plain member loads. Regenerate after editing the panel or the geometry
// (regeneratePanelLoads — the app does it before each analysis).
//
// ONE-WAY distribution (the only one implemented): the load spans along the in-plane direction u and is carried by
// the members across it (|ex·u| < 0,1). Each one takes the strip between the mid-lines to its neighbours along u —
// or up to the panel edge when there is no neighbour on that side — clipped by the panel polygon; the effective
// width is b = A_strip / L and w = q·b, so Σ w·L = q·A for any panel shape (review: measuring b at the mid-point of
// the member over-loaded an apex strip 2× on a triangle). Exact for sheeting on purlins and one-way slabs; where the
// strip width varies along the member (slanted panel edge) the uniform w keeps the resultant exact but the real
// distribution is not uniform — a warning says the span moment is approximate. TWO-WAY (45° envelope) needs partial loads along a member,
// which the solver does not have yet: refused, not approximated by a uniform equivalent (that would under-estimate
// the span moment of a triangular load by up to a third).
//
// q is per m² of the panel surface; area: 'projected' takes it per m² of the horizontal projection (factor |n_z|) —
// the live loads of NBR 6120:2019 6.4 act on the horizontal projection; roofing weight is per surface.
// dir: 'gravity' (down) | 'against' (WIND PRESSURE: perpendicular to the panel, toward it) | 'normal' (WIND SUCTION:
//      perpendicular, away from it) | 'globalX' | 'globalY'. The panel normal is oriented UPWARD whenever the panel is
//      not vertical (roofs: pressure pushes into the roof, suction lifts it, whatever the node order); on a vertical
//      wall it follows the node order (right-hand rule). A wind load follows the roof slope and is split into the
//      global X, Y and vertical components on each member; a negative q reverses the sense.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
const P = (n) => [n.x, n.y, n.z];

// point in polygon (2D, ray casting) with a boundary tolerance
function inPoly(pt, poly, tol) {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {   // on an edge → inside
    const a = poly[j], b = poly[i], ab = [b[0] - a[0], b[1] - a[1]], L2 = ab[0] ** 2 + ab[1] ** 2;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * ab[0] + (pt[1] - a[1]) * ab[1]) / L2)) : 0;
    if (Math.hypot(pt[0] - a[0] - t * ab[0], pt[1] - a[1] - t * ab[1]) <= tol) return true;
  }
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
// polygon clipped by sLo ≤ s ≤ sHi, tLo ≤ t ≤ tHi (Sutherland–Hodgman; ±Infinity = no limit) → its area
function clipArea(poly, sLo, sHi, tLo, tHi) {
  let pts = poly;
  const clip = (inside, cut) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cut(a, b));
    }
    pts = out;
  };
  const lerp = (a, b, k, v) => { const f = (v - a[k]) / (b[k] - a[k]); return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]; };
  if (isFinite(sLo)) clip((p) => p[0] >= sLo, (a, b) => lerp(a, b, 0, sLo));
  if (isFinite(sHi)) clip((p) => p[0] <= sHi, (a, b) => lerp(a, b, 0, sHi));
  if (isFinite(tLo)) clip((p) => p[1] >= tLo, (a, b) => lerp(a, b, 1, tLo));
  if (isFinite(tHi)) clip((p) => p[1] <= tHi, (a, b) => lerp(a, b, 1, tHi));
  let A = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; A += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(A) / 2;
}

// the panel interval along s (first coordinate) on the line t = t0 that contains s0
function spanAt(poly, s0, t0) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if ((a[1] > t0) !== (b[1] > t0)) xs.push(a[0] + (b[0] - a[0]) * (t0 - a[1]) / (b[1] - a[1]));
  }
  xs.sort((p, q) => p - q);
  for (let k = 0; k + 1 < xs.length; k += 2) if (s0 >= xs[k] - 1e-9 && s0 <= xs[k + 1] + 1e-9) return [xs[k], xs[k + 1]];
  return xs.length >= 2 ? [xs[0], xs[xs.length - 1]] : [s0, s0];
}

/**
 * Expands one panel into member loads. panel = { id, nodes:[ids ≥ 3, in order], q, dir, mode:'one-way', axis, area }
 *   axis: span direction of the load — 'X' | 'Y' | 'Z' (projected on the panel plane) or 'edge' (first edge, default)
 * @returns {{ loads: object[], warnings: string[], members: number }}
 */
export function panelToDistLoads(model, panel) {
  const warnings = [], loads = [];
  const ns = (panel.nodes || []).map((id) => model.nodes.get(id)).filter(Boolean);
  if (ns.length < 3) return { loads, warnings: ['Pano com menos de 3 nós válidos.'], members: 0 };
  if ((panel.mode || 'one-way') !== 'one-way') return { loads, warnings: ['Distribuição bidirecional ainda não disponível (exige carga parcial na barra).'], members: 0 };
  // plane: Newell normal (node order → right-hand rule)
  let n = [0, 0, 0];
  for (let i = 0; i < ns.length; i++) { const a = P(ns[i]), b = P(ns[(i + 1) % ns.length]); n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  n = unit(n);
  if (len(n) < 0.5) return { loads, warnings: ['Pano degenerado (nós colineares).'], members: 0 };
  if (n[2] < -1e-9) n = [-n[0], -n[1], -n[2]];                 // roofs: normal upward, independent of the node order
  const p0 = P(ns[0]);
  const size = Math.max(...ns.map((q) => len(sub(P(q), p0))));
  const tol = Math.max(1e-6, 1e-4 * size);
  const off = Math.max(...ns.map((q) => Math.abs(dot(sub(P(q), p0), n))));
  if (off > 1e-3 * size) warnings.push(`Pano não plano (desvio ${off.toFixed(3)} m): carga distribuída no plano médio.`);
  // span direction u (in plane) and v = n × u
  const ax = String(panel.axis || 'edge').toUpperCase();
  const g = ax === 'X' ? [1, 0, 0] : ax === 'Y' ? [0, 1, 0] : ax === 'Z' ? [0, 0, 1] : sub(P(ns[1]), P(ns[0]));
  let u = sub(g, n.map((c) => c * dot(g, n)));
  if (len(u) < 1e-6) return { loads, warnings: [`Direção de vão ${ax} perpendicular ao pano.`], members: 0 };
  u = unit(u);
  const v = cross(n, u);
  const to2 = (p) => { const d = sub(p, p0); return [dot(d, u), dot(d, v)]; };
  const poly = ns.map((q) => to2(P(q)));
  // members lying in the panel and across the span direction
  const recv = [];
  for (const e of model.elements.values()) {
    const a = model.nodes.get(e.n1), b = model.nodes.get(e.n2);
    if (!a || !b) continue;
    const pa = P(a), pb = P(b);
    if (Math.abs(dot(sub(pa, p0), n)) > 1e-3 * size + tol || Math.abs(dot(sub(pb, p0), n)) > 1e-3 * size + tol) continue;
    const A2 = to2(pa), B2 = to2(pb), M2 = [(A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2];
    if (!inPoly(A2, poly, tol) || !inPoly(B2, poly, tol) || !inPoly(M2, poly, tol)) continue;
    const ex = unit(sub(pb, pa));
    if (Math.abs(dot(ex, u)) > 0.1) continue;                         // runs along the span: carries nothing
    recv.push({ e, s: M2[0], t0: Math.min(A2[1], B2[1]), t1: Math.max(A2[1], B2[1]), tm: M2[1] });
  }
  if (!recv.length) { warnings.push('Nenhuma barra do pano atravessa a direção de vão: carga não distribuída.'); return { loads, warnings, members: 0 }; }
  const projected = panel.area === 'projected';
  const fArea = projected ? Math.abs(n[2]) : 1;
  const q = +panel.q || 0;
  let varying = 0, partial = 0;
  for (const r of recv) {
    // neighbours along u overlapping in t (a partial overlap counts as a whole neighbour — approximation)
    const nb = recv.filter((o) => o !== r && o.t1 > r.t0 + tol && o.t0 < r.t1 - tol);
    const left = nb.filter((o) => o.s < r.s - tol).reduce((m, o) => Math.max(m, o.s), -Infinity);
    const right = nb.filter((o) => o.s > r.s + tol).reduce((m, o) => Math.min(m, o.s), Infinity);
    const sLo = left > -Infinity ? (left + r.s) / 2 : -Infinity, sHi = right < Infinity ? (right + r.s) / 2 : Infinity;
    // the nearest neighbours only partly beside this member (interrupted members, openings): total kept, split rough
    if (nb.some((o) => (o.s === left || o.s === right) && (Math.abs(o.t0 - r.t0) > tol || Math.abs(o.t1 - r.t1) > tol))) partial++;
    // along the member: its own extent; an end with no member continuing the row extends to the panel edge
    const row = recv.filter((o) => o !== r && Math.abs(o.s - r.s) <= tol);
    const tLo = row.some((o) => o.t1 <= r.t0 + tol) ? r.t0 : -Infinity, tHi = row.some((o) => o.t0 >= r.t1 - tol) ? r.t1 : Infinity;
    const L = r.t1 - r.t0;
    const Astrip = clipArea(poly, sLo, sHi, tLo, tHi);
    const b = L > 0 ? Astrip / L : 0;
    // strip width at the two ends of the member: different → the real load is not uniform along it
    const [s0l, s0r] = spanAt(poly, r.s, r.t0 + 1e-6 * (L || 1)), [s1l, s1r] = spanAt(poly, r.s, r.t1 - 1e-6 * (L || 1));
    const wid = (a, c) => Math.min(c, sHi) - Math.max(a, sLo);
    if (Math.abs(wid(s0l, s0r) - wid(s1l, s1r)) > 1e-3 * Math.max(1, Math.abs(b))) varying++;
    const w = q * b * fArea;                                           // kN/m along the member
    if (!(Math.abs(w) > 0)) continue;
    const tag = { panelId: panel.id };
    const dir = panel.dir || 'gravity';
    if (dir === 'normal' || dir === 'against') {                     // split the normal into global components
      const sg = dir === 'against' ? -1 : 1, c = [sg * n[0] * w, sg * n[1] * w, sg * n[2] * w];
      if (Math.abs(c[0]) > 1e-12) loads.push({ type: 'dist', elemId: r.e.id, dir: 'globalX', w: +c[0].toFixed(6), ...tag });
      if (Math.abs(c[1]) > 1e-12) loads.push({ type: 'dist', elemId: r.e.id, dir: 'globalY', w: +c[1].toFixed(6), ...tag });
      if (Math.abs(c[2]) > 1e-12) loads.push({ type: 'dist', elemId: r.e.id, dir: 'gravity', w: +(-c[2]).toFixed(6), ...tag });   // gravity: w > 0 down
    } else loads.push({ type: 'dist', elemId: r.e.id, dir: dir === 'globalX' || dir === 'globalY' ? dir : 'gravity', w: +w.toFixed(6), ...tag });
  }
  if (partial) warnings.push(`${partial} barra(s) com vizinha que cobre só parte da sua extensão (barra interrompida ou abertura): resultante exata, mas a divisão entre essas barras é aproximada — confira as cargas.`);
  if (varying) warnings.push(`${varying} barra(s) com faixa de largura variável (borda do pano inclinada): carga uniforme equivalente com a resultante exata (b = A_faixa/L); o momento de vão real difere.`);
  return { loads, warnings, members: recv.length };
}

/**
 * Geometric frame of a panel, as used by the distribution: model-space points, unit normal n (node order, right-hand
 * rule), span direction u and v = n × u, the polygon in (u, v) and its centroid. null if degenerate.
 */
export function panelFrame(model, panel) {
  const ns = (panel.nodes || []).map((id) => model.nodes.get(id)).filter(Boolean);
  if (ns.length < 3) return null;
  let n = [0, 0, 0];
  for (let i = 0; i < ns.length; i++) { const a = P(ns[i]), b = P(ns[(i + 1) % ns.length]); n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  n = unit(n);
  if (len(n) < 0.5) return null;
  if (n[2] < -1e-9) n = [-n[0], -n[1], -n[2]];
  const p0 = P(ns[0]);
  const ax = String(panel.axis || 'edge').toUpperCase();
  const g = ax === 'X' ? [1, 0, 0] : ax === 'Y' ? [0, 1, 0] : ax === 'Z' ? [0, 0, 1] : sub(P(ns[1]), P(ns[0]));
  let u = sub(g, n.map((c) => c * dot(g, n)));
  if (len(u) < 1e-6) return null;
  u = unit(u);
  const v = cross(n, u);
  const pts = ns.map(P), poly = pts.map((p) => { const d = sub(p, p0); return [dot(d, u), dot(d, v)]; });
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], k = a[0] * b[1] - b[0] * a[1]; A += k; cx += (a[0] + b[0]) * k; cy += (a[1] + b[1]) * k; }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  const c = [p0[0] + u[0] * cx + v[0] * cy, p0[1] + u[1] * cx + v[1] * cy, p0[2] + u[2] * cx + v[2] * cy];
  return { pts, n, u, v, p0, poly, area: Math.abs(A), centroid: c };
}

// Replaces the panel-derived member loads of every case by a fresh expansion of its panels.
export function regeneratePanelLoads(model) {
  const warnings = [];
  for (const lc of model.loadCases.values()) {
    if (!Array.isArray(lc.panels) || !lc.panels.length) { if (lc.loads?.some((l) => l.panelId != null)) lc.loads = lc.loads.filter((l) => l.panelId == null); continue; }
    lc.loads = (lc.loads || []).filter((l) => l.panelId == null);
    for (const p of lc.panels) {
      const r = panelToDistLoads(model, p);
      lc.loads.push(...r.loads);
      for (const w of r.warnings) warnings.push(`${lc.name} · pano ${p.id}: ${w}`);
    }
  }
  return warnings;
}
