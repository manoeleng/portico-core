// tension_only.js — tension-only members ("tirantes": X bracing rods, sag rods) solved per COMBINATION.
// CYPE 3D, Memória de cálculo 1.6.2 "Tirante": the exact model of diagonals that only take tension is a nonlinear
// analysis for each load combination, suppressing in each calculation the diagonals whose axial force is compression
// (the current CYPE 3D does it in the "bars only in tension" module, one analysis per combination). Here:
//   1. the combination is solved as one load case (loads × factors; self-weight × factor as member loads);
//   2. every member flagged `cable` with N < 0 becomes slack (its stiffness scaled by SLACK in elemLocalK) and the
//      structure is solved again; a slack member whose ends move apart again (elongation > 0) is re-activated;
//   3. repeat until no member changes state (or maxIter).
// Load cases alone stay linear (both diagonals work) — results of a single case are not combinations.
import { selfWeightPerLength } from './assembler.js?v=7';
import { localAxes } from './timoshenko.js?v=7';

export const SLACK = 1e-9;                     // stiffness factor of a slack tension-only member

export function hasTensionOnly(model) {
  for (const e of model.elements.values()) if (e.cable) return true;
  return false;
}

// combination → one temporary static case (only static cases; spectral terms make it non-solvable here → null)
function combinedCase(model, combo, id) {
  const loads = [];
  for (const { lcId, factor } of combo.factors || []) {
    const f = parseFloat(factor) || 0;
    if (typeof lcId === 'string' && lcId.startsWith('esp')) return null;
    const lc = model.loadCases.get(typeof lcId === 'number' ? lcId : parseInt(lcId));
    if (!lc || lc.type === 'spectrum') return null;
    for (const ld of lc.loads || []) {
      if (ld.type === 'nodal') loads.push({ ...ld, F: ld.F.map((v) => v * f) });
      else if (ld.type === 'dist') loads.push({ ...ld, w: ld.w * f, ...(ld.w2 != null ? { w2: ld.w2 * f } : {}) });
      else if (ld.type === 'temp') loads.push({ ...ld, dT: (ld.dT || 0) * f });
      else loads.push(ld);
    }
    if (lc.selfWeight) for (const e of model.elements.values()) {
      const mat = model.materials.get(e.matId), sec = model.sections.get(e.secId);
      const w = mat && sec ? selfWeightPerLength(mat, sec) : 0;
      if (w > 0) loads.push({ type: 'dist', elemId: e.id, dir: 'gravity', w: w * f });
    }
  }
  return { id, name: `${combo.name} (NL tirantes)`, loads, selfWeight: false, type: 'static', specDir: null };
}

/**
 * Solves one combination with tension-only members. Returns { res, iters, slack:[ids], converged } or null when the
 * combination cannot be solved this way (spectral terms). `Solver` = StaticSolver class.
 */
export function solveCombinationTensionOnly(model, combo, Solver, { maxIter = 30, tol = 1e-6 } = {}) {
  const tmpId = 1e9 + (combo.id || 0);
  const lc = combinedCase(model, combo, tmpId);
  if (!lc) return null;
  const rods = [...model.elements.values()].filter((e) => e.cable);
  model.loadCases.set(tmpId, lc);
  let res = null, iters = 0, converged = false;
  try {
    for (const e of rods) delete e._slack;
    for (iters = 1; iters <= maxIter; iters++) {
      res = new Solver().solve(model, tmpId, false);
      let changed = false;
      for (const e of rods) {
        if (!e._slack) {
          const N = res.getElemForces(e.id)?.N ?? 0;
          if (N < -tol) { e._slack = true; changed = true; }
        } else {
          // re-tension check: elongation of the chord between the end nodes
          const a = model.nodes.get(e.n1), b = model.nodes.get(e.n2);
          const ua = res.getNodeDisp(e.n1), ub = res.getNodeDisp(e.n2);
          const { ex } = localAxes(a, b);
          const dl = (ub[0] - ua[0]) * ex[0] + (ub[1] - ua[1]) * ex[1] + (ub[2] - ua[2]) * ex[2];
          if (dl > tol * 1e-3) { delete e._slack; changed = true; }
        }
      }
      if (!changed) { converged = true; break; }
    }
    const slack = rods.filter((e) => e._slack).map((e) => e.id);
    if (res) res.tensionOnly = { iters, slack, converged };
    return { res, iters, slack, converged };
  } finally {
    model.loadCases.delete(tmpId);
    // the slack state is kept on the result only: the model goes back to all members active
    for (const e of rods) delete e._slack;
  }
}
