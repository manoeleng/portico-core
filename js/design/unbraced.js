// unbraced.js — automatic UNBRACED LENGTHS of the members for design (buckling about each axis, lateral-torsional).
//
// ABNT NBR 8800:2024 4.10.6.1: "comprimento destravado de uma barra é a distância entre dois pontos de contenção
// lateral ou entre um ponto de contenção lateral e uma extremidade"; a point of lateral restraint is a node of a
// bracing substructure or a node properly connected (4.10.3) to one. With internal forces from a second-order analysis
// (4.10.6.2) the buckling length is that unbraced length (K = 1) — the convention of the NBR 8800 module.
//
// What the model knows and this module does:
//  1. PHYSICAL MEMBER: analysis elements that continue one another — collinear (angle < 1°), not tension-only rods —
//     are chained (a change of section is not a restraint point, 4.10.6.1); a member split at every panel point of a truss is ONE bar for buckling (before: each segment
//     between nodes was taken as unbraced, which is unsafe for a bottom chord braced only at the columns).
//  2. RESTRAINT POINTS, per direction (local y of the chain → buckling about z, "Lx"; local z → about y, "Ly"). An
//     interior node of the chain restrains direction d when
//       · a support (restraint or spring) holds the translation along d (projection of d on the held axes ≥ 0,7);
//       · another member (not a tension-only rod — it gives no restraint in compression) frames in with a direction u
//         such that |u·d| ≥ 0,5 (at least 30° out of the chain axis towards d) — it carries the restraint force along
//         its own axis — AND that restraint is ANCHORED (4.10.3.2: the restraining element must be tied to a bracing
//         substructure): from the node there is a path of members not perpendicular to d (|u·d| ≥ 0,15 — a truss is
//         stiff in its plane whatever the angle of each bar; tension-only rods included here: the X of a bracing works
//         with its tensioned diagonal) reaching an ANCHOR — a node whose support holds d, a
//         rigid diaphragm node or a plate node (same tests as below). Purlins tying trusses that only sway together
//         (no roof bracing) are NOT restraints;
//       · the node belongs to a rigid diaphragm (horizontal component of d ≥ 0,7) or to a plate/area element whose
//         plane contains d (in-plane component ≥ 0,7).
//     The thresholds are geometric tolerances of this module, not values of the standard.
//  3. Lx = distance between the restraint points (y) around the element, Ly the same with z; the chain ends are
//     extremities (4.10.6.1). Lb (lateral-torsional buckling) and Lz (torsional / flexural-torsional buckling) are
//     CONSERVATIVE by default: between the chain ends and the interior supports that hold both transverse directions
//     (a lateral restraint does not necessarily hold the compression flange nor the twist — a purlin on the top flange
//     does not hold a bottom flange in compression, review 15/10/2026). The user declares el.design.contencaoTorcao =
//     true when the restraints also hold the twist and the compression flange → Lb = Lz = Ly.
//     Each element maps y/z restraints onto ITS own local axes (members of a chain may have different β).
//
// NOT verified here (stays with the engineer, flagged in the design output): the strength and stiffness of the
// restraints (4.12); K ≠ 1 of a free end (cantilever chain end: flagged); a chain with a change of section is checked
// segment by segment with the chain length (non-prismatic bar: approximation, flagged); K = 1 presumes second-order
// internal forces (4.10.6.2). Members with a user value (el.design.Lx/Ly/Lb/Lz or K) keep it.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
const P = (n) => [n.x, n.y, n.z];

export const COLLINEAR_COS = Math.cos(Math.PI / 180);   // 1°
export const FRAME_IN_MIN = 0.5;                         // |u·d| of a restraining member
export const HOLD_MIN = 0.7;                             // projection of d held by a support / diaphragm / plate
export const PATH_MIN = 0.15;                            // |u·d| of the members of the anchorage path (≈ 9°)

/**
 * @param model  PORTICO Model
 * @param localAxesFn  (n1, n2, betaDeg) → { ex, ey, ez, L }  (solver/timoshenko.js localAxes)
 * @returns Map elemId → { Lx, Ly, Lb, Lz, chain: [elemIds], chainL, freeEnd }
 */
export function unbracedLengths(model, localAxesFn) {
  const out = new Map();
  const els = [...model.elements.values()].filter((e) => model.nodes.has(e.n1) && model.nodes.has(e.n2));
  const at = new Map();                                   // nodeId → elements
  for (const e of els) for (const n of [e.n1, e.n2]) { if (!at.has(n)) at.set(n, []); at.get(n).push(e); }
  const axis = new Map(els.map((e) => [e.id, unit(sub(P(model.nodes.get(e.n2)), P(model.nodes.get(e.n1))))]));
  const continues = (a, b) => !a.cable && !b.cable && Math.abs(dot(axis.get(a.id), axis.get(b.id))) >= COLLINEAR_COS;

  // ── 1. chains ─────────────────────────────────────────────────────────────
  const seen = new Set();
  const diaNodes = new Map();                             // nodeId → true (rigid diaphragm member)
  for (const d of model.diaphragms?.values?.() || []) for (const id of d.nodes || []) diaNodes.set(id, true);
  const areaAt = new Map();                               // nodeId → [unit normals]
  for (const a of model.areas?.values?.() || []) {
    const ps = (a.nodes || []).map((id) => model.nodes.get(id)).filter(Boolean).map(P);
    if (ps.length < 3) continue;
    const u = sub(ps[1], ps[0]), v = sub(ps[2], ps[0]);
    const nrm = unit([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    for (const id of a.nodes) { if (!areaAt.has(id)) areaAt.set(id, []); areaAt.get(id).push(nrm); }
  }
  // anchor for direction d: a support (restraint or spring) holding the translation along d, a rigid-diaphragm node
  // (horizontal d) or a plate node with d in its plane
  const supportHolds = (nodeId, d) => {
    const nd = model.nodes.get(nodeId), r = nd.restraints || {}, sp = nd.springs || {};
    const held = [r.ux || sp.kux > 0, r.uy || sp.kuy > 0, r.uz || sp.kuz > 0];
    return Math.hypot(...d.map((c, k) => (held[k] ? c : 0))) >= HOLD_MIN;
  };
  const anchor = (nodeId, d) => {
    if (supportHolds(nodeId, d)) return true;
    if (diaNodes.has(nodeId) && Math.hypot(d[0], d[1]) >= HOLD_MIN) return true;
    for (const nrm of areaAt.get(nodeId) || []) { const c = dot(d, nrm); if (Math.hypot(d[0] - c * nrm[0], d[1] - c * nrm[1], d[2] - c * nrm[2]) >= HOLD_MIN) return true; }
    return false;
  };
  for (const e0 of els) {
    if (seen.has(e0.id) || e0.cable) continue;
    // grow both ways
    const chain = [e0]; seen.add(e0.id);
    for (const dir of [0, 1]) {
      let cur = e0, node = dir ? e0.n2 : e0.n1;
      for (;;) {
        const nxt = (at.get(node) || []).filter((o) => o !== cur && !seen.has(o.id) && continues(cur, o));
        if (nxt.length !== 1) break;
        const o = nxt[0]; seen.add(o.id);
        if (dir) chain.push(o); else chain.unshift(o);
        node = o.n1 === node ? o.n2 : o.n1; cur = o;
      }
    }
    // ordered node list along the chain
    const ex = axis.get(e0.id), N1 = model.nodes.get(e0.n1);
    const nodeIds = [...new Set(chain.flatMap((e) => [e.n1, e.n2]))];
    const s = new Map(nodeIds.map((id) => [id, dot(sub(P(model.nodes.get(id)), P(N1)), ex)]));
    nodeIds.sort((a, b) => s.get(a) - s.get(b));
    const { ey, ez } = localAxesFn(model.nodes.get(e0.n1), model.nodes.get(e0.n2), e0.beta);
    const inChain = new Set(chain.map((e) => e.id));

    // restraint of direction d at an interior node: an anchor itself, or a member framing in whose far side reaches an
    // anchor through members along d (the chain itself excluded)
    const holds = (nodeId, d) => {
      if (anchor(nodeId, d)) return true;
      const start = (at.get(nodeId) || []).filter((o) => !inChain.has(o.id) && !o.cable && Math.abs(dot(axis.get(o.id), d)) >= FRAME_IN_MIN);
      if (!start.length) return false;
      const seenN = new Set([nodeId]), queue = [];
      for (const o of start) { const nb = o.n1 === nodeId ? o.n2 : o.n1; if (!seenN.has(nb)) { seenN.add(nb); queue.push(nb); } }
      while (queue.length) {
        const q = queue.shift();
        if (anchor(q, d)) return true;
        for (const o of at.get(q) || []) {
          if (inChain.has(o.id) || Math.abs(dot(axis.get(o.id), d)) < PATH_MIN) continue;
          const nb = o.n1 === q ? o.n2 : o.n1;
          if (!seenN.has(nb)) { seenN.add(nb); queue.push(nb); }
        }
      }
      return false;
    };
    const first = nodeIds[0], last = nodeIds[nodeIds.length - 1];
    const bracedY = nodeIds.map((id) => id === first || id === last || holds(id, ey));
    const bracedZ = nodeIds.map((id) => id === first || id === last || holds(id, ez));
    // Lb / Lz (conservative): chain ends and interior supports holding both transverse directions
    const bracedT = nodeIds.map((id) => id === first || id === last || (supportHolds(id, ey) && supportHolds(id, ez)));
    const secs = new Set(chain.map((e) => e.secId));
    // a chain end with nothing else attached and no support: free end (cantilever) — K = 2 not applied here
    const isFree = (id) => (at.get(id) || []).every((o) => inChain.has(o.id)) && !Object.values(model.nodes.get(id).restraints || {}).some(Boolean);
    const freeEnd = isFree(first) || isFree(last);
    const chainL = s.get(last) - s.get(first);
    const span = (braced, i0, i1) => {           // restraint points around the node interval [i0, i1]
      let a = i0; while (a > 0 && !braced[a]) a--;
      let b = i1; while (b < nodeIds.length - 1 && !braced[b]) b++;
      return s.get(nodeIds[b]) - s.get(nodeIds[a]);
    };
    for (const e of chain) {
      const i0 = Math.min(nodeIds.indexOf(e.n1), nodeIds.indexOf(e.n2)), i1 = Math.max(nodeIds.indexOf(e.n1), nodeIds.indexOf(e.n2));
      let Lx = span(bracedY, i0, i1), Ly = span(bracedZ, i0, i1);
      // the element's own local y may be the chain's z (different β along the chain): swap
      const own = localAxesFn(model.nodes.get(e.n1), model.nodes.get(e.n2), e.beta);
      if (Math.abs(dot(own.ey, ey)) < Math.SQRT1_2) [Lx, Ly] = [Ly, Lx];
      const LT = span(bracedT, i0, i1);
      out.set(e.id, { Lx, Ly, Lb: LT, Lz: LT, LyT: Ly, chain: chain.map((c) => c.id), chainL, freeEnd, mixedSections: secs.size > 1 });
    }
  }
  return out;
}

/**
 * member data for checkElement: the automatic lengths, unless the user set a value for that axis in el.design — a
 * length (Lx/Ly/Lb/Lz) or a factor (K for all; Kz → Lx, Ky → Ly and Lb, Kt → Lz), which keeps its meaning (K·L).
 */
export function memberWithUnbraced(el, auto) {
  if (!auto) return el.design;
  const d = el.design || {};
  if (d.K != null) return d;
  const m = { unbracedAuto: true, unbracedFreeEnd: auto.freeEnd, unbracedChain: auto.chain.length };
  const tors = d.contencaoTorcao === true;               // user: the restraints also hold twist + compression flange
  if (d.Kz == null) m.Lx = auto.Lx;
  if (d.Ky == null) { m.Ly = auto.Ly; m.Lb = tors ? auto.Ly : auto.Lb; }
  if (d.Kt == null) m.Lz = tors ? auto.Ly : auto.Lz;
  return { ...m, ...d };
}
