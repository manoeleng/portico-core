// static_sparse.js — synchronous SPARSE static solver with the same interface as StaticSolver
// (solve(model, lcId, selfWeight) → Results). Same assembly as the static worker's sparse path (assembleSparseGlobal →
// K_ff in CSR + fixed–free coupling) and the same factorization (RCM + banded Cholesky, makeFactorCSR), but on the
// calling thread — for the loops that re-solve the model many times (tension-only combinations), where the dense
// StaticSolver costs O(nDOF²) memory and O(nDOF³) time per solve.
// Cases the sparse path does not cover (prescribed displacements, unilateral and nonlinear soil springs) and a non-SPD factorization
// (mechanism) are delegated to the dense StaticSolver, which owns the diagnostics.
import { buildNodeIndex, assembleF, getNodeDOFs } from './assembler.js?v=7';
import { assembleSparseGlobal, extractFreeCSR } from './sparse.js?v=7';
import { makeFactorCSR } from './linsolve.js?v=7';
import { Results } from './postprocess.js?v=7';
import { StaticSolver } from './static_solver.js?v=7';

const needsDense = (model) => {
  for (const n of model.nodes.values()) {
    if (n.prescDisp && Object.values(n.prescDisp).some((v) => +v)) return true;
    if (n.springUni && Object.values(n.springUni).some((v) => v === 'c' || v === 't')) return true;
    if (n.soilSpring) return true;
  }
  return false;
};

export class SparseStaticSolver {
  solve(model, lcId = null, selfWeight = false) {
    if (needsDense(model)) return new StaticSolver().solve(model, lcId, selfWeight);
    const nodeIndex = buildNodeIndex(model), nDOF = nodeIndex.size * 6;
    const is2D = model.mode === '2D' || model.planar === true;   // as StaticSolver: out-of-plane DOFs restrained
    const freeDOF = [], freeMap = new Int32Array(nDOF).fill(-1);
    for (const node of model.nodes.values()) {
      const r = node.restraints, d = getNodeDOFs(nodeIndex, node.id);
      const fix = [r.ux, is2D ? 1 : r.uy, r.uz, is2D ? 1 : r.rx, r.ry, is2D ? 1 : r.rz];
      d.forEach((gi, li) => { if (!fix[li]) { freeMap[gi] = freeDOF.length; freeDOF.push(gi); } });
    }
    if (!freeDOF.length) return new StaticSolver().solve(model, lcId, selfWeight);
    const { S } = assembleSparseGlobal(model, nodeIndex, { withMass: false });
    const { csr, cf } = extractFreeCSR(S, freeMap, freeDOF.length);
    const fac = makeFactorCSR(csr);
    if (!fac.ok) return new StaticSolver().solve(model, lcId, selfWeight);   // not SPD → dense path raises the mechanism error
    const F = assembleF(model, nodeIndex, lcId, selfWeight), nF = freeDOF.length;
    const Ff = new Float64Array(nF); for (let i = 0; i < nF; i++) Ff[i] = F[freeDOF[i]];
    const uf = fac.solve(Ff);
    if (!uf || uf.some((v) => !Number.isFinite(v))) return new StaticSolver().solve(model, lcId, selfWeight);
    const u = new Float64Array(nDOF); for (let i = 0; i < nF; i++) u[freeDOF[i]] = uf[i];
    // reactions at the fixed DOFs: K[fixed, free]·u_f − F; elastic supports: −k·u (as the app's worker path)
    const reac = new Float64Array(nDOF);
    for (let r = 0; r < cf.rowDof.length; r++) { let s = 0; for (let p = cf.ptr[r]; p < cf.ptr[r + 1]; p++) s += cf.val[p] * uf[cf.freeIdx[p]]; reac[cf.rowDof[r]] = s - F[cf.rowDof[r]]; }
    for (const node of model.nodes.values()) {
      const sp = node.springs; if (!sp) continue;
      const ks = [sp.kux, sp.kuy, sp.kuz, sp.krx, sp.kry, sp.krz]; if (!ks.some((k) => k > 0)) continue;
      const d = getNodeDOFs(nodeIndex, node.id);
      for (let i = 0; i < 6; i++) if (ks[i] > 0 && freeMap[d[i]] >= 0) reac[d[i]] = -ks[i] * u[d[i]];
    }
    const res = new Results(model, nodeIndex, u, reac, F, lcId, selfWeight);
    res.solverKind = 'banda·dispersa'; res.bandwidth = fac.m;
    return res;
  }
}
