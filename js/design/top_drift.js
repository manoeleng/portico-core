// ──────────────────────────────────────────────────────────────────────────────
// top_drift.js — horizontal displacement of the column tops under wind (serviceability), pure function.
//
//   NBR 6118:2026 Tab. 13.3 (concrete): H/1 700, frequent combination with wind principal, ψ1 = 0,30.
//   NBR 8800:2024 Tab. B.1 (steel): H/300 sheds / one-storey, H/400 two or more storeys — H = column height,
//   top to base (note a). B.2.4 leaves the service combination to the designer; the rare one (wind at its
//   characteristic value, as in the CBCA warehouse manual) is the default here and the frequent value
//   (ψ1 = 0,30) is reported alongside.
// Columns = near-vertical member lines that start at the support level; their top node and height H.
// Truss verticals and king posts (not reaching the base) are excluded. Δ is relative to the base
// (supports do not translate). Units: m.
// ──────────────────────────────────────────────────────────────────────────────

import { topDriftLimit } from './serviceability.js?v=7';

/**
 * @param {object} o
 *   nodes      [{id, x, y, z}]          elements [{n1, n2}]
 *   cases      [{name, disp(nodeId) → [ux, uy, uz, …]}]   one per characteristic wind case
 *   code       'NBR6118:2026' | 'NBR8800:2024'
 *   singleStory  NBR 8800 shed / one-storey (H/300) instead of H/400
 *   combo      'rara' | 'frequente' (NBR 8800 only; NBR 6118 is always 'frequente')
 *   psi1       wind ψ1 (default 0,30 — NBR 6118 Tab. 11.2 = NBR 8800 Tab. 2)
 * @returns {{ code, limit, combo, columns, rows:[{case, delta, H, freq, rara, demand, ratio, nodeId}] }}
 */
export function topDriftCheck({ nodes, elements, cases, code, singleStory = false, combo = 'rara', psi1 = 0.30 }) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const zMin = Math.min(...nodes.map(n => n.z));
  const lines = new Map();                                   // (x, y) → { lo, hi } of the vertical members
  for (const e of elements) {
    const a = byId.get(e.n1), b = byId.get(e.n2); if (!a || !b) continue;
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (!(L > 0) || Math.abs(b.z - a.z) < 0.8 * L) continue;
    const k = `${a.x.toFixed(4)}|${a.y.toFixed(4)}`, cur = lines.get(k) || { lo: a, hi: a };
    for (const n of [a, b]) { if (n.z < cur.lo.z) cur.lo = n; if (n.z > cur.hi.z) cur.hi = n; }
    lines.set(k, cur);
  }
  const cols = [...lines.values()].filter(l => Math.abs(l.lo.z - zMin) < 1e-6 && l.hi.z - zMin > 1e-6)
    .map(l => ({ node: l.hi, H: l.hi.z - zMin }));
  const limit = topDriftLimit(code, { singleStory });
  const useCombo = code === 'NBR6118:2026' ? 'frequente' : combo;
  const rows = cases.map(c => {
    let best = { ratio: -1, delta: 0, H: 0, nodeId: null };
    for (const col of cols) {
      const u = c.disp(col.node.id); if (!u) continue;
      const d = Math.hypot(u[0], u[1]), dem = useCombo === 'frequente' ? psi1 * d : d;
      const r = limit ? (dem / col.H) / limit : dem / col.H;
      if (r > best.ratio) best = { ratio: r, delta: d, H: col.H, nodeId: col.node.id };
    }
    const freq = psi1 * best.delta, rara = best.delta;
    return { case: c.name, delta: best.delta, H: best.H, freq, rara, demand: useCombo === 'frequente' ? freq : rara,
      nodeId: best.nodeId, ratio: limit ? best.ratio : NaN };
  });
  return { code, limit, combo: useCombo, psi1, singleStory, columns: cols.length, rows };
}
