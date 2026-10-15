// ──────────────────────────────────────────────────────────────────────────────
// combinations_nbr.js — load COMBINATIONS per the Brazilian codes (PLANO_BRASIL 3.1/3.2).
//
// Builds the same list shape used by presets/*/rules.json → combinations.lista:
// [{ nombre, factores: { <case symbol>: factor } }]. Pure function, no DOM.
//
//   · ELU normal      Fd = Σγg·Gk + γq1·Q1k + Σ(j>1) γqj·ψ0j·Qjk     NBR 8681:2025 5.1.3.1
//                     each variable as principal; G favourable (1,0) with wind principal
//   · ELU excepcional Fd = γg·Gk + 1,0·E + Σ 1,0·ψ0j,ef·Qjk            NBR 15421:2023 5.4
//                     γg = 1,2 (buildings, Q ≤ 5 kN/m²); wind, settlements and shrinkage not combined; ψ0,ef = ψ0, or ψ2 for actions of
//                     very short duration (NBR 8681:2025 5.1.3.2 — option psiSismo)
//   · ELS quase permanente  Gk + Σ ψ2j·Qjk                              NBR 8681:2025 5.1.5
//   · ELS frequente         Gk + ψ1·Q1k + Σ ψ2j·Qjk
//   · ELS rara              Gk + Q1k + Σ ψ1j·Qjk
//
// γ by material family (the specific code prevails over NBR 8681):
//   concrete → NBR 6118:2026 Tab. 11.1:  γg 1,4 · γq 1,4 · temperature 1,2
//   steel    → NBR 8800:2024 Tab. 1 (= NBR 8681:2025 Tab. 2/4): permanent grouped 1,35 ·
//              variable 1,50 · wind 1,40 · temperature 1,20
// ψ0/ψ1/ψ2: NBR 6118:2026 Tab. 11.2 = NBR 8800:2024 Tab. 2 = NBR 8681:2025 Tab. 6.
// Roof live load (Qcob) uses the "coberturas" row of NBR 8681:2025 Tab. 6 in both families
// (NBR 6118 Tab. 11.2 has no roof row).
//
// Case symbols: G (permanent), Q (use), Qcob (roof), V… (wind, one per direction, e.g.
// V0, V90 — never combined with each other), T (temperature), E… (seismic, one per
// direction — never combined with each other). Directional combination of the seismic
// action (NBR 15421 8.5) is NOT applied here.
// ──────────────────────────────────────────────────────────────────────────────

export const NBR_GAMMA = {
  concrete: { code: 'NBR6118:2026', gDes: 1.4, gFav: 1.0, gExc: 1.2, Q: 1.4, Qcob: 1.4, V: 1.4, T: 1.2 },
  steel:    { code: 'NBR8800:2024', gDes: 1.35, gFav: 1.0, gExc: 1.2, Q: 1.5, Qcob: 1.5, V: 1.4, T: 1.2 },
};

// [ψ0, ψ1, ψ2]
export const NBR_PSI = {
  residencial: [0.5, 0.4, 0.3],   // no predominance of fixed equipment nor high concentration of people
  comercial:   [0.7, 0.6, 0.4],   // predominance (offices, shops, public access)
  biblioteca:  [0.8, 0.7, 0.6],   // libraries, archives, warehouses, workshops, garages
  Qcob:        [0.8, 0.7, 0.6],   // roofs (NBR 8681:2025 Tab. 6)
  V:           [0.6, 0.3, 0.0],
  T:           [0.6, 0.5, 0.3],
};

const kind = (s) => s === 'G' ? 'G' : s === 'Q' ? 'Q' : s === 'Qcob' ? 'Qcob' : s === 'T' ? 'T'
  : /^V/.test(s) ? 'V' : /^E/.test(s) ? 'E' : null;

const r4 = (x) => Math.round(x * 1e4) / 1e4;

function name(prefix, f) {
  const parts = Object.entries(f).map(([s, v]) => `${v === 1 ? '' : r4(v)}${s}`);
  return `${prefix}: ${parts.join(' + ')}`;
}

/**
 * @param {object} o
 *   family    'concrete' | 'steel'
 *   cases     case symbols present in the model, e.g. ['G','Q','V0','V90','T','E0','E90']
 *   uso       'residencial' | 'comercial' | 'biblioteca'  (ψ of Q; default residencial)
 *   psiSismo  'psi0' (default, conservative) | 'psi2' (NBR 8681:2025 5.1.3.2, very short duration)
 * @returns {{ code, elu, exc, qp, freq, rara, lista }}  lista = all, rules.json shape
 */
export function nbrCombinations({ family, cases, uso = 'residencial', psiSismo = 'psi0' }) {
  const g = NBR_GAMMA[family];
  if (!g) throw new Error(`family must be 'concrete' or 'steel' (got ${family})`);
  if (!NBR_PSI[uso] || uso === 'Qcob' || uso === 'V' || uso === 'T') throw new Error(`uso inválido: ${uso}`);
  const syms = [...new Set(cases)];
  if (!syms.includes('G')) throw new Error('the permanent case G is required');
  const vars = syms.filter(s => ['Q', 'Qcob', 'V', 'T'].includes(kind(s)));
  const seis = syms.filter(s => kind(s) === 'E');
  const psi = (s) => kind(s) === 'Q' ? NBR_PSI[uso] : NBR_PSI[kind(s)];
  const gq = (s) => g[kind(s)];
  // variables that may act together with the principal (one wind direction at a time)
  const companions = (p) => vars.filter(s => s !== p && !(kind(s) === 'V' && kind(p) === 'V'));
  const pick = (others) => {          // others with the wind of one direction only
    const winds = others.filter(s => kind(s) === 'V');
    const rest = others.filter(s => kind(s) !== 'V');
    return winds.length ? winds.map(w => [...rest, w]) : [rest];
  };

  const elu = [], exc = [], qp = [], freq = [], rara = [];
  // identical factor sets are emitted once (e.g. ELS frequente with Q principal: ψ2 of wind = 0, so
  // G + ψ1·Q would repeat once per wind direction)
  const push = (arr, prefix, f) => {
    const c = {}; for (const [s, v] of Object.entries(f)) if (r4(v) !== 0) c[s] = r4(v);
    const nombre = name(prefix, c);
    const key = o => JSON.stringify(Object.entries(o).sort());
    if (!arr.some(x => key(x.factores) === key(c))) arr.push({ nombre, factores: c });
  };

  // ELU normal
  for (const p of vars) {
    for (const set of pick(companions(p))) {
      const f = { G: g.gDes, [p]: gq(p) };
      for (const s of set) f[s] = gq(s) * psi(s)[0];
      push(elu, 'ELU', f);
    }
    if (kind(p) === 'V') push(elu, 'ELU', { G: g.gFav, [p]: gq(p) });   // uplift / overturning
  }
  if (!vars.length) push(elu, 'ELU', { G: g.gDes });

  // ELU excepcional (seismic) — NBR 15421:2023 5.4
  const iEf = psiSismo === 'psi2' ? 2 : 0;
  for (const e of seis) {
    for (const set of pick(vars.filter(s => kind(s) !== 'V'))) {
      const f = { G: g.gExc, [e]: 1.0 };
      for (const s of set) f[s] = 1.0 * psi(s)[iEf];
      push(exc, 'ELU-EXC', f);
      push(exc, 'ELU-EXC', { G: g.gFav, [e]: 1.0 });
    }
  }

  // ELS — quase permanente (one), frequente and rara (each variable as principal)
  { const f = { G: 1.0 }; for (const s of vars) if (kind(s) !== 'V') f[s] = psi(s)[2]; push(qp, 'ELS-QP', f); }
  for (const p of vars) {
    for (const set of pick(companions(p))) {
      const ff = { G: 1.0, [p]: psi(p)[1] }, fr = { G: 1.0, [p]: 1.0 };
      for (const s of set) { ff[s] = psi(s)[2]; fr[s] = psi(s)[1]; }
      push(freq, 'ELS-FREQ', ff);
      push(rara, 'ELS-RARA', fr);
    }
  }

  return { code: g.code, elu, exc, qp, freq, rara, lista: [...elu, ...exc, ...qp, ...freq, ...rara] };
}
