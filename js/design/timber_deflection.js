// ──────────────────────────────────────────────────────────────────────────────
// timber_deflection.js — serviceability (deflection) of timber members by ABNT NBR 7190-1:2022, section 8.
//
//   8.1  δinst = Σ δinst,Gi + δinst,Q1 + Σ(j≥2) ψ1j·δinst,Qj                  (rare combination, no creep)
//        δfin  = Σ δfin,Gi + Σ(j≥1) δfin,Qj,  δfin,G = δinst,G·(1 + φ),  δfin,Qj = δinst,Qj·ψ2j·(1 + φ)
//        (quasi-permanent combination with creep — the 2022 text; Dias et al. 2019, written on the 2018 draft,
//        print the EN 1995 form δinst,Q1·(1 + ψ2·φ), which the published standard did not adopt)
//        δnet,fin = δfin − δcamber, δcamber ≤ 2/3·Σ δinst,G (8.2)
//   Tab. 20 creep coefficient φ by material and service class (umidade 1 | 2–3 | 4).
//   Tab. 21 limits are RANGES (the choice inside the range is the designer's): each check reports
//        'atende' (≤ strict end), 'faixa' (between the ends — designer decides) or 'excede' (> lenient end);
//        `limites` = { inst, fin, net } divisors chosen by the designer replace the ranges.
//   8.2  brittle non-structural parts: instantaneous deflection due to the variable actions only
//        ≤ L/500 (cantilever: L/250) and ≤ 15 mm. The expression in parentheses after "ações variáveis" is blank
//        in the PDF of the acervo (reading gap): the characteristic sum Σ δinst,Qj (no ψ1) is used — the severer reading.
//   finEN (informative): EN 1995 form δG·(1 + φ) + δQ1·(1 + ψ2·φ) + Σ δQj·(ψ1j + ψ2j·φ), as printed by Dias et al. (2019).
// Units: m. L of a cantilever is the cantilever length (Tab. 21 has its own row).
// ──────────────────────────────────────────────────────────────────────────────

// Tab. 20 — [classe 1, classes 2 e 3, classe 4]
export const PHI_7190 = {
  serrada:    [0.6, 0.8, 2.0],    // madeira serrada, MLC, MLCC, LVL e roliça (MLCC not allowed in class 4)
  compensado: [0.8, 1.0, 2.5],
  osb:        [1.5, 2.25, null],
};

// Tab. 21 — [strict, lenient] divisors (limit = L/divisor)
export const LIM_7190 = {
  viga:    { inst: [500, 300], fin: [300, 150], net: [350, 250] },
  balanco: { inst: [250, 150], fin: [150, 75], net: [175, 125] },
};

export function creepCoefficient(material = 'serrada', classeUmidade = 1) {
  const row = PHI_7190[material];
  if (!row) return null;
  const c = Number(classeUmidade);
  return c <= 1 ? row[0] : c <= 3 ? row[1] : row[2];
}

const verdict = (delta, L, [strict, lenient]) => {
  const lStrict = L / strict, lLen = L / lenient;
  return { delta, limStrict: lStrict, limLenient: lLen, divisors: [strict, lenient],
    ratioStrict: delta / lStrict, ratioLenient: delta / lLen,
    status: delta <= lStrict + 1e-12 ? 'atende' : delta <= lLen + 1e-12 ? 'faixa' : 'excede' };
};

/**
 * @param {object} o
 *   L            span (cantilever: cantilever length), m
 *   cantilever   boolean
 *   dG           Σ instantaneous deflection of the permanent actions (characteristic), m
 *   dQ           [{ delta, psi1, psi2 }] instantaneous deflection of each variable action (characteristic), m;
 *                the principal Q1 is the one giving the largest δinst (each is tried)
 *   phi          creep coefficient, or material + classeUmidade (Tab. 20)
 *   camber       contraflecha, m (capped at 2/3·dG)
 *   frageis      brittle non-structural parts attached (8.2 extra limit)
 *   limites      { inst, fin, net } designer's divisors (replace the Tab. 21 ranges)
 */
export function timberDeflectionCheck({ L, cantilever = false, dG = 0, dQ = [], phi, material = 'serrada',
  classeUmidade = 1, camber = 0, frageis = false, limites } = {}) {
  const avisos = [];
  const f = phi ?? creepCoefficient(material, classeUmidade);
  if (f == null || !(f >= 0)) return { erro: `φ não definido (material ${material}, classe de umidade ${classeUmidade} — Tab. 20)` };
  const qs = dQ.map(q => ({ delta: Math.abs(q.delta || 0), psi1: q.psi1 ?? 0, psi2: q.psi2 ?? 0 }));
  const g = Math.abs(dG);
  // rare combination: try each variable action as principal
  let instQ = 0, principal = -1;
  qs.forEach((q, i) => {
    const v = q.delta + qs.reduce((s, o, j) => s + (j === i ? 0 : o.psi1 * o.delta), 0);
    if (v > instQ) { instQ = v; principal = i; }
  });
  const inst = g + instQ;
  const finG = g * (1 + f), finQ = qs.reduce((s, q) => s + q.delta * q.psi2 * (1 + f), 0);
  const fin = finG + finQ;
  let cb = Math.abs(camber);
  if (cb > (2 / 3) * g) { avisos.push(`Contraflecha limitada a 2/3·δinst,G = ${((2 / 3) * g * 1000).toFixed(1)} mm (8.2).`); cb = (2 / 3) * g; }
  const net = fin - cb;
  const tab = LIM_7190[cantilever ? 'balanco' : 'viga'];
  const lim = (k) => limites?.[k] ? [limites[k], limites[k]] : tab[k];
  const finEN = finG + qs.reduce((t, q, i) => t + q.delta * (i === principal ? 1 + q.psi2 * f : q.psi1 + q.psi2 * f), 0);
  const out = { L, cantilever, phi: f, principal, inst: verdict(inst, L, lim('inst')), fin: verdict(fin, L, lim('fin')),
    net: verdict(net, L, lim('net')), finG, finQ, finEN, camber: cb, instQ, avisos };
  if (frageis) {
    const lf = Math.min(L / (cantilever ? 250 : 500), 0.015), dv = qs.reduce((t, q) => t + q.delta, 0);
    out.frageis = { delta: dv, lim: lf, ratio: dv / lf, status: dv <= lf + 1e-12 ? 'atende' : 'excede' };
  }
  const st = [out.inst, out.fin, out.net, out.frageis].filter(Boolean).map(v => v.status);
  out.status = st.includes('excede') ? 'excede' : st.includes('faixa') ? 'faixa' : 'atende';
  if (out.status === 'faixa') avisos.push('Flecha dentro da faixa da Tab. 21: o limite dentro da faixa é escolha do projetista.');
  return out;
}
