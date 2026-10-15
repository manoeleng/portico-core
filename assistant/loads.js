// ──────────────────────────────────────────────────────────────────────────────
// loads.js — code-prescribed load magnitudes from the project data + rules.json
//   · snowLoad  → pf, ps (kN/m²)
//   · windLoad → q (N/m²) and pressures by zone
//   · responseSpectrum    → elastic curve Sa(T) [g] + saFactor (g/R*) for PORTICO
// Pure ES module (Node + browser). No DOM. Deterministic and auditable.
// ──────────────────────────────────────────────────────────────────────────────

const G_GRAV = 9.80665; // m/s² (also kN per tonne-force)

// ── step-table / band helpers ─────────────────────────────────────────────────

/** Index of the "lo-hi" band (e.g. "38-42") that contains x; -1 if none. */
function rangeBandIndex(bandas, x) {
  for (let i = 0; i < bandas.length; i++) {
    const [lo, hi] = String(bandas[i]).split('-').map(parseFloat);
    if (x >= lo && (i === bandas.length - 1 ? x <= hi : x < hi)) return i;
  }
  return -1;
}

/** Altitude band key ("0-300"…">4000") that contains alt. */
function altitudeBand(porAltitud, alt) {
  for (const k of Object.keys(porAltitud)) {
    if (k.startsWith('>')) { if (alt >= parseFloat(k.slice(1))) return k; }
    else { const [lo, hi] = k.split('-').map(parseFloat); if (alt >= lo && alt < hi) return k; }
  }
  return null;
}

/** Lookup in a step table [[upperBoundExcl|null, val]] (last null = ∞). */
function stepLookup(tabla, x) {
  for (const [ub, val] of tabla) if (ub === null || x < ub) return val;
  return tabla[tabla.length - 1][1];
}

// ── SNOW (NCh431.Of2010) ──────────────────────────────────────────────────────

/**
 * @returns {object} { pg, Ce, Ct, I, Cs, pf, ps, _notas }  (kN/m²); pf/ps null si pg null.
 */
export function snowLoad(ficha, reglas) {
  const n = reglas?.loads?.snow;
  // Graceful degradation: if rules.json is the example template (or carries no snow
  // table), no snow load is computed instead of breaking.
  if (!n || !n.ground_snow_table) {
    return { pg: null, pf: null, ps: null, _notas: ['Sin tabla de nieve en rules.json (plantilla de ejemplo): reemplázala con la de tu código para calcular la carga de nieve.'] };
  }
  const ub = ficha.location || {};
  const lat = ub.latitude_deg, alt = ub.altitude_masl ?? 0;
  const notas = [];

  const t1 = n.ground_snow_table;
  const li = rangeBandIndex(t1.latitudes, lat);
  const ab = altitudeBand(t1.by_altitude_masl, alt);
  if (li < 0 || ab == null) return { pg: null, pf: null, ps: null, _notas: ['latitud/altitud fuera de la Tabla 1'] };
  const pg = t1.by_altitude_masl[ab][li];
  if (pg == null) notas.push(`Tabla 1 sin dato para lat ${lat}°, altitud ${alt} m (banda ${t1.latitudes[li]} / ${ab})`);

  // Factors: conservative defaults; the project data can refine them.
  const expo = ub.exposure || 'C';
  const proteccion = ficha.loads?.snow_protection || 'Parcialmente expuesto';
  const Ce = n.exposure_factor_table[expo]?.[proteccion] ?? 1.0;
  const Ct = n.thermal_factor_table['Todas las estructuras (salvo las siguientes)'] ?? 1.0;
  const cat = ficha.seismic?.category || ficha.occupancy_category || 'II';
  const I = n.importance_factor_table[cat] ?? 1.0;

  // Roof slope → Cs (ASCE form; VALIDATE Figure 1).
  const pend = ficha.geometry?.roof_slope_deg ?? 0;
  const csQuiebre = Ct >= 1.2 ? 45 : Ct >= 1.1 ? 37.5 : 30;
  const Cs = pend <= csQuiebre ? 1.0 : pend >= 70 ? 0 : (70 - pend) / (70 - csQuiebre);

  const pf = pg == null ? null : +(0.7 * Ce * Ct * I * pg).toFixed(4);
  const ps = pf == null ? null : +(Cs * pf).toFixed(4);
  return { pg, Ce, Ct, I, Cs: +Cs.toFixed(3), pf, ps, _notas: notas, _formula: 'pf=0.7·Ce·Ct·I·pg ; ps=Cs·pf' };
}

// ── WIND (NCh432.Of2010) ──────────────────────────────────────────────────────

/** Basic speed V (m/s): by station (city match) or by latitude band. */
function windSpeed(w, ub) {
  const ciudad = (ub.city || '').trim().toLowerCase();
  if (ciudad) {
    for (const [k, v] of Object.entries(w.basic_speed_m_s.by_station))
      if (k.toLowerCase() === ciudad) return { V: v, fuente: `estación ${k}` };
  }
  // latitude bands: upper bounds aligned to the array (robust to editing V)
  const lat = ub.latitude_deg;
  const ubExcl = [27, 35, 42, 50, Infinity];
  const arr = w.basic_speed_m_s.by_latitude;
  for (let i = 0; i < arr.length && i < ubExcl.length; i++)
    if (lat < ubExcl[i]) return { V: arr[i].V, fuente: `latitud ${arr[i].rango}` };
  return { V: arr[arr.length - 1].V, fuente: `latitud ${arr[arr.length - 1].rango}` };
}

/**
 * @param {number} h_techo  roof height (m)
 * @returns {object} { V, Kz, Kzt, Kd, I, q_Nm2, GCpi, presiones:{zone:p_Nm2}, _notas }
 */
export function windLoad(ficha, reglas, h_techo) {
  const w = reglas?.loads?.wind;
  if (w?.metodo === 'NBR6123') return windLoadNBR6123(ficha, w, h_techo);   // Brazil preset (PLANO_BRASIL 5.4)
  // Graceful degradation with the example template (or without a wind table).
  if (!w || !w.exposure || !w.basic_speed_m_s || !w.gcpf_external_pressure) {
    return { V: null, q_Nm2: 0, presiones: {}, _notas: ['Sin tabla de viento en rules.json (plantilla de ejemplo): reemplázala con la de tu código para calcular la carga de viento.'] };
  }
  const ub = ficha.location || {};
  const expo = ub.exposure || 'C';
  const e = w.exposure[expo];
  const { V, fuente } = windSpeed(w, ub);

  const z = Math.max(h_techo, 4.6);
  const Kz = 2.01 * Math.pow(z / e.Zg_m, 2 / e.alfa);
  const Kzt = 1.0; // no topographic data in the project → flat terrain
  const Kd = w.kd_directionality['Edificio SPRFV'] ?? 0.85;
  const cat = ficha.seismic?.category || ficha.occupancy_category || 'II';
  const I = w.importance_factor[cat] ?? 1.0;
  const q = 0.613 * Kz * Kzt * Kd * V * V * I; // N/m²

  const cierre = ficha.loads?.wind_enclosure || 'Cerrado';
  const GCpi = w.gcpi_internal_pressure[cierre] ?? 0.18;

  // slope range for GCpf
  const pend = ficha.geometry?.roof_slope_deg ?? 0;
  const tr = pend < 5 ? 0 : pend < 20 ? 1 : pend < 45 ? 2 : 3;
  const presiones = {};
  for (const [zona, vals] of Object.entries(w.gcpf_external_pressure.zonas)) {
    const g = vals[tr];
    const a = q * (g - GCpi), b = q * (g + GCpi);
    presiones[zona] = +(Math.abs(a) > Math.abs(b) ? a : b).toFixed(2);
  }
  return {
    V, fuente_V: fuente, Kz: +Kz.toFixed(4), Kzt, Kd, I,
    q_Nm2: +q.toFixed(2), GCpi, cierre, tramo_pendiente: tr, presiones,
    _formula: 'q=0.613·Kz·Kzt·Kd·V²·I [N/m²] ; p=q·(GCpf−GCpi)',
    _notas: ['Kzt=1 (terreno plano: la ficha no trae topografía)'],
  };
}

// ── WIND (ABNT NBR 6123:2023) ─────────────────────────────────────────────────
// Vk = V0·S1·S2·S3, q = 0,613·Vk² (4.2); S2 = bm·Fr·(z/10)^p (5.3.3, Tab. 1/2; category V constant up to
// 10 m); S3 Tab. 4; walls Cpe Tab. 6 (a ≥ b, interpolation in a/b between 3/2 and 2 — Note 2); two-slope
// roof Cpe Tab. 7 (linear interpolation in θ: practice, not a clause); Cpi 6.3.2.1. p = q·(Cpe − Cpi).
// Wind perpendicular to the LONG side a (α = 90°): A windward, B leeward → presiones '1' (A) and '4' (B),
// the keys the generator uses for the frame. Tables come from rules.loads.wind (preset Brasil).
const _band = (v, edges) => edges.findIndex(e => v <= e);
function windLoadNBR6123(ficha, w, h_techo) {
  const notas = [];
  const ub = ficha.location || {}, g = ficha.geometry || {}, wf = ficha.wind || {};
  const V0 = wf.V0_m_s ?? ub.V0_m_s;
  if (!(V0 > 0)) return { V: null, q_Nm2: 0, presiones: {}, _notas: ['NBR 6123: V0 (isopletas, Figura 1) não informado (ficha.wind.V0_m_s) — vento não calculado.'] };
  if (wf.categoria == null) notas.push('Categoria de rugosidade não informada: adotada IV (menos severa que I–III) — confirme (5.3.1).');
  const cat = String(wf.categoria ?? 'IV').toUpperCase();
  const S1 = wf.S1 ?? 1.0;
  const grupo = String(wf.grupoS3 ?? '3');
  const S3 = w.S3[grupo]?.S3 ?? w.S3[grupo];
  if (!(S3 > 0)) return { V: V0, q_Nm2: 0, presiones: {}, _notas: [`NBR 6123: grupo do S3 "${grupo}" fora da Tabela 4 — vento não calculado.`] };
  let b = wf.b_m ?? g.width_m, a = wf.a_m ?? g.length_m;
  if (!(a > 0 && b > 0)) { notas.push('Dimensões em planta não informadas (ficha.wind.a_m/b_m): adotado a = b (planta quadrada).'); a = b = a > 0 ? a : (b > 0 ? b : 10); }
  if (a < b) [a, b] = [b, a];
  const h = h_techo;
  // class by the largest dimension of the FRONT surface (5.3.2): long side a for α = 90°, b for the gable (α = 0°)
  const classOf = (dimFront) => { const m = Math.max(dimFront, h); return m <= 20 ? 'A' : m <= 50 ? 'B' : 'C'; };
  const classe = classOf(a), classeEmp = classOf(b);
  if (Math.max(a, h) > 80) notas.push('Maior dimensão > 80 m: classe pelo Anexo A da NBR 6123 (5.3.2) — adotada C.');
  const t1 = w.S2[cat]; if (!t1) throw new Error(`NBR 6123: categoria "${cat}" fora da Tabela 1`);
  // Tab. 3: S2 constant below 5 m (categories I–IV) and below 10 m (category V)
  const z = cat === 'V' ? Math.max(h, 10) : Math.max(h, 5);
  const S2of = (cl) => t1[cl].bm * w.Fr[cl] * Math.pow(z / 10, t1[cl].p);
  const S2 = S2of(classe), S2e = S2of(classeEmp);
  const Vk = V0 * S1 * S2 * S3, Vke = V0 * S1 * S2e * S3;
  const q = 0.613 * Vk * Vk, qe = 0.613 * Vke * Vke;              // N/m² (α = 90° and gable α = 0°)
  notas.push('h = altura do topo usada em z e em h/b (a Nota 1 da Tab. 6 usa a altura do Detalhe I; difere só perto de h/b = 0,5 e 1,5).');
  // walls (Tab. 6)
  const hb = h / b, ab = a / b;
  const rowsH = w.cpe_paredes.filter(r => (hb <= 0.5 && r.h_b === '<=1/2') || (hb > 0.5 && hb <= 1.5 && r.h_b === '1/2<h/b<=3/2') || (hb > 1.5 && r.h_b === '3/2<h/b<=6'));
  if (hb > 6) notas.push('h/b > 6: fora da Tabela 6.');
  if (ab > 4) notas.push('a/b > 4: fora da Tabela 6 (adotada a linha 2 ≤ a/b ≤ 4).');
  const r1 = rowsH.find(r => r.a_b === '1<=a/b<=3/2'), r2 = rowsH.find(r => r.a_b === '2<=a/b<=4');
  const t = ab <= 1.5 ? 0 : ab >= 2 ? 1 : (ab - 1.5) / 0.5;
  const cpeW = {};
  for (const k of ['A1B1', 'A2B2', 'C', 'D', 'A', 'B', 'C1D1', 'C2D2', 'cpe_medio']) cpeW[k] = +(r1[k] + (r2[k] - r1[k]) * t).toFixed(3);
  // roof (Tab. 7), two slopes
  const theta = g.roof_slope_deg ?? 0;
  const rowsR = w.cpe_telhado_2aguas.filter(r => (hb <= 0.5 && r.h_b === '<=1/2') || (hb > 0.5 && hb <= 1.5 && r.h_b === '1/2<h/b<=3/2') || (hb > 1.5 && r.h_b !== '<=1/2' && r.h_b !== '1/2<h/b<=3/2'));
  const ths = rowsR.map(r => r.theta);
  if (theta > ths[ths.length - 1]) notas.push(`θ = ${theta}° acima da Tabela 7 (máx. ${ths[ths.length - 1]}°): adotada a última linha.`);
  const bnd = _band(theta, ths);
  const i = bnd < 0 ? ths.length - 2 : Math.max(0, Math.min(ths.length - 2, bnd - 1));
  const lo = rowsR[i], hi = rowsR[i + 1];
  const u = theta <= lo.theta ? 0 : theta >= hi.theta ? 1 : (theta - lo.theta) / (hi.theta - lo.theta);
  const lin = (x, y) => +(x + (y - x) * u).toFixed(3);
  const cpeR = { EFI: lin(lo.a90.EFI, hi.a90.EFI), GHJ: lin(lo.a90.GHJ, hi.a90.GHJ), EG: lin(lo.a0.EG, hi.a0.EG), FH: lin(lo.a0.FH, hi.a0.FH) };
  if (u > 0 && u < 1) notas.push(`Cpe do telhado interpolado em θ = ${theta}° (prática; a Tabela 7 não prescreve interpolação).`);
  // internal pressure (6.3.2.1): default four permeable faces → −0,3 or 0 (both, the worse governs)
  const cpiSet = wf.cpi != null ? [].concat(wf.cpi) : w.cpi_padrao ?? [-0.3, 0];
  if (wf.cpi == null) notas.push('Cpi padrão −0,3 ou 0 (6.3.2.1-b): só vale com cobertura impermeável e as quatro faces igualmente permeáveis (≤ 30 %, 6.3.1). Portões/abertura dominante: 6.3.2.1-c (até +0,8) — informe ficha.wind.cpi.');
  // one internal pressure acts on ALL faces at once (it cancels in the net horizontal wall load): a full
  // set per Cpi; 'presiones' is the set with the larger roof suction (governs the roof/uplift)
  const set = (ci) => { const f = (cpe) => +(q * (cpe - ci)).toFixed(2), fe = (cpe) => +(qe * (cpe - ci)).toFixed(2);
    return { '1': f(cpeW.A), '4': f(cpeW.B), C: fe(cpeW.C), D: fe(cpeW.D), EFI: f(cpeR.EFI), GHJ: f(cpeR.GHJ), EG: fe(cpeR.EG), FH: fe(cpeR.FH) }; };
  const porCpi = cpiSet.map(ci => ({ cpi: ci, presiones: set(ci) }));
  const presiones = porCpi.reduce((a, b) => Math.abs(b.presiones.EFI) > Math.abs(a.presiones.EFI) ? b : a).presiones;
  return {
    V: V0, V0, S1, S2: +S2.toFixed(4), S3, Vk: +Vk.toFixed(3), categoria: cat, classe, q_Nm2: +q.toFixed(2),
    classe_empena: classeEmp, S2_empena: +S2e.toFixed(4), q_empena_Nm2: +qe.toFixed(2),
    cpi: cpiSet, cpe_paredes: cpeW, cpe_telhado: cpeR, presiones, presiones_por_cpi: porCpi,
    _formula: 'Vk = V0·S1·S2·S3; q = 0,613·Vk² [N/m²]; p = q·(Cpe − Cpi) (NBR 6123:2023)',
    _notas: notas,
  };
}

// ── SEISMIC (ABNT NBR 15421:2023) ─────────────────────────────────────────────
// Same formulas as js/design/spectra/nbr15421.js (kept standalone like the NCh433 copy; a test pins the
// two together): ags0 = Ca·ag, ags1 = Cv·0,75·ag; four period ranges (6.3); Ca/Cv Tab. 3 with linear
// interpolation 0,10–0,15 g; I Tab. 4. Not divided by R/I: forces × I/R, displacements × Cd/R (10).
function responseSpectrumNBR15421(ficha, s, { Tmax = 3.0, dT = 0.02 } = {}) {
  const p = ficha.seismic || {};
  const ag = p.ag ?? s.default_params?.ag;
  if (!(ag > 0)) throw new Error('NBR 15421: ag (g) não informado (ficha.seismic.ag).');
  if (ag > 0.15) throw new Error('NBR 15421: ag > 0,15 g está fora das zonas da Tabela 1.');
  const cls = String(p.soil ?? s.default_params?.soil ?? 'D').toUpperCase();
  if (cls === 'F') throw new Error('NBR 15421: terreno F exige estudo específico (6.2).');
  const row = s.ca_cv[cls]; if (!row) throw new Error(`NBR 15421: classe de terreno inválida "${cls}"`);
  const it = (v) => ag <= 0.10 ? v[0] : ag >= 0.15 ? v[1] : v[0] + (v[1] - v[0]) * (ag - 0.10) / 0.05;
  const Ca = it(row.Ca), Cv = it(row.Cv), r = Cv / Ca;
  const ags0 = Ca * ag, ags1 = Cv * 0.75 * ag;
  const I = s.importance[p.category];
  if (I == null) throw new Error(`NBR 15421: categoria de utilização "${p.category}" inválida ou não informada (I, II ou III — Tab. 4; não confundir com a NCh433).`);
  const sa = (T) => T <= 0.04 * r ? ags0 * (37.5 * T * Ca / Cv + 1) : T <= 0.3 * r ? 2.5 * ags0 : T <= 2 * r ? ags1 / T : 2 * r * ags1 / (T * T);
  const curva = [];
  for (let T = 0; T <= Tmax + 1e-9; T += dT) { const Tr = +T.toFixed(4); curva.push({ T: Tr, Sa: +sa(Tr).toFixed(6) }); }
  const R = p.R;
  if (!(R > 0)) throw new Error('NBR 15421: coeficiente R do sistema estrutural não informado (Tab. 6: 1,5 a 4,5).');
  const catA = ag <= 0.05;
  return {
    curva, texto: curva.map((q) => `${q.T}\t${q.Sa}`).join('\n'),
    params: { ag, classe: cls, Ca, Cv, ags0, ags1, I, R },
    saFactor_nota: `Colar a curva em F7; saFactor = ${G_GRAV.toFixed(5)}·I/R = ${(G_GRAV * I / R).toFixed(5)} (NBR 15421:2023 seção 10: forças × I/R; deslocamentos × Cd/R; ≥ 90 % da massa efetiva, 10.1; Ht ≥ 0,85·H, 10.4).`
      + (catA ? ' Categoria sísmica A (zonas 0–1): análise espectral não exigida; zona 1 com Fx = 0,01·wx (7.3.2).' : ''),
  };
}

// ── SEISMIC (NCh433/DS61) ─────────────────────────────────────────────────────

/** R* = 1 + T* / (0.10·To + T* / Ro), with T* from the modal analysis. */
/**
 * External Cpe of multi-span / central-gutter roofs, NBR 6123:2023 Tab. 9–12 (data in the preset
 * rules.json, loads.wind). The single-span generator does not use them yet; this is the lookup for
 * multi-span buildings or manual checks. θ between table rows → linear interpolation (practice, not a
 * clause — flagged in `notas`); outside the table → `null` (not covered), never an extrapolated value.
 * @param {object} w     reglas.loads.wind (NBR6123)
 * @param {'calha'|'simetrico'|'assimetrico60'|'shed'} tipo   Tab. 9 / 10 / 11 / 12
 * @param {object} o     { alpha: 0|90|180, theta (°, Tab. 10/12), a_b, hp_h (Tab. 9) }
 * @returns {{ ce: object|null, notas: string[], tabela: string }}
 */
export function cpeTelhadoMultiplo(w, tipo, { alpha = 0, theta, a_b, hp_h } = {}) {
  const notas = [];
  const out = (ce, tabela) => ({ ce, notas, tabela });
  const interp = (rows, key) => {
    const ths = rows.map(r => r.theta);
    if (!(theta >= ths[0] && theta <= ths[ths.length - 1])) { notas.push(`θ = ${theta}° fora da tabela (${ths[0]}°–${ths[ths.length - 1]}°): não coberto.`); return null; }
    let i = 0; while (i < rows.length - 2 && theta > rows[i + 1].theta) i++;
    const lo = rows[i], hi = rows[i + 1], u = (theta - lo.theta) / (hi.theta - lo.theta);
    if (u > 0 && u < 1) notas.push(`Cpe interpolado em θ = ${theta}° (prática; a tabela não prescreve interpolação).`);
    const A = key ? lo[key] : lo, B = key ? hi[key] : hi, ce = {};
    for (const k of Object.keys(A)) if (k !== 'theta') ce[k] = +(A[k] + (B[k] - A[k]) * u).toFixed(3);
    return ce;
  };
  if (tipo === 'calha') {
    const t = w.cpe_telhado_calha_central;
    const faixa = hp_h <= 0.05 ? '<=0.05' : (hp_h >= 0.1 && hp_h <= 0.2) ? '0.1-0.2' : null;
    const r = t.linhas.find(l => l.a_b === a_b && l.hp_h === faixa);
    if (!r) { notas.push(`Tab. 9 só cobre h/b = 0,5, a/b = 1 ou 2 e h'p/h ≤ 0,05 ou 0,1–0,2 (a/b = ${a_b}, h'p/h = ${hp_h}).`); return out(null, 'Tab. 9'); }
    return out(alpha === 90 ? { ...r.a90 } : alpha === 0 ? { ...r.a0 } : null, 'Tab. 9');
  }
  if (tipo === 'simetrico') {
    const t = w.cpe_telhados_multiplos_simetricos;
    if (alpha === 90) return out(theta <= t.a90.theta_max ? { b1: t.a90.b1, b2: t.a90.b2, b3: t.a90.b3 } : null, 'Tab. 10');
    return out(alpha === 0 ? interp(t.a0) : null, 'Tab. 10');
  }
  if (tipo === 'assimetrico60') {
    const t = w.cpe_telhados_multiplos_assimetricos_60;
    return out(alpha === 0 ? { ...t.a0 } : alpha === 180 ? { ...t.a180 } : alpha === 90 ? { ...t.a90 } : null, 'Tab. 11');
  }
  if (tipo === 'shed') {
    const t = w.cpe_telhados_multiplos_agua_vertical;
    const key = alpha === 0 ? 'a0' : alpha === 180 ? 'a180' : alpha === 90 ? 'a90' : null;
    return out(key ? interp(t.linhas, key) : null, 'Tab. 12');
  }
  throw new Error(`tipo de telhado múltiplo inválido: ${tipo}`);
}

export function Rstar(Tstar, To, Ro = 11.0) {
  return 1 + Tstar / (0.10 * To + Tstar / Ro);
}

/**
 * ELASTIC NCh433 design spectrum: Sa(T) = S·Ao·I·α(T) in g units.
 * The R* reduction (which needs T* from the modal) is applied as saFactor.
 *
 * The core UI uses js/design/nch433_spectrum.js (buildSpectrum) for the same formula.
 * This one stays here because the assistant subsystem is deliberately standalone (no
 * js/ imports). test_nch433_spectrum.mjs §7 pins the two together so they cannot drift.
 *
 * @returns {object} { curva:[{T,Sa}], texto, params, saFactor_nota, Rstar_formula }
 */
export function responseSpectrum(ficha, reglas, { Tmax = 3.0, dT = 0.02 } = {}) {
  const s = reglas?.loads?.seismic;
  if (s?.metodo === 'NBR15421') return responseSpectrumNBR15421(ficha, s, { Tmax, dT });   // Brazil preset (5.6)
  if (!s || !s.soil_table || !s.zone_table_Ao_g) {
    throw new Error('Sin tabla sísmica en rules.json (plantilla de ejemplo): reemplázala con la de tu código para generar el espectro.');
  }
  const p = ficha.seismic || {};
  const def = s.default_params || {};
  const suelo = s.soil_table[p.soil];
  if (!suelo) throw new Error(`Clase de sitio / suelo no válido: "${p.soil}"`);
  const Ao = s.zone_table_Ao_g[String(p.zone)];
  if (Ao == null) throw new Error(`Zona sísmica no válida: ${p.zone}`);
  const I = s.category_table[p.category || 'II'] ?? 1.0;
  const { S, To, Tp, n: nn, p: pp } = suelo;

  const alpha = (T) => (1 + 4.5 * Math.pow(T / To, pp)) / (1 + Math.pow(T / To, 3));
  const curva = [];
  for (let T = 0; T <= Tmax + 1e-9; T += dT) {
    const Tr = +T.toFixed(4);
    curva.push({ T: Tr, Sa: +(S * Ao * I * alpha(Tr)).toFixed(6) });
  }
  const texto = curva.map((q) => `${q.T}\t${q.Sa}`).join('\n');
  const Ro = def.Ro ?? 11.0, R = p.R ?? def.R ?? 7.0;
  return {
    curva, texto,
    params: { S, Ao, I, To, Tp, n: nn, p: pp, Ro, R },
    Rstar_formula: 'R* = 1 + T*/(0.10·To + T*/Ro), con T* del modal',
    saFactor_nota: `Pegar la curva en F7; saFactor = ${G_GRAV.toFixed(5)}/R* (convierte g→m/s² y aplica R*). R* tras el modal con Rstar(T*, To=${To}, Ro=${Ro}).`,
  };
}
