// ──────────────────────────────────────────────────────────────────────────────
// Deterministic PORTICO generator
// project data (validated) + rules + libraries (profiles, materials, live loads)
//   → .s3d model (same format as Serializer.toJSON)
//
// It is the engineering SOURCE OF TRUTH: auditable, repeatable, no LLM.
// Pure ES module (no DOM, no Three.js): used in Node (n8n) and in the app.
// Axis convention: Z-up (X east, Y north, Z vertical).
// ──────────────────────────────────────────────────────────────────────────────

import { snowLoad, windLoad, responseSpectrum, caEdificio } from './loads.js';
import { nbrCombinations } from '../js/design/combinations_nbr.js';
import { cfNames, cfSection } from '../js/design/profiles_cf.js';

const G_GRAV = 9.80665;          // kN per tonne-force (weight→mass)
const CM2_M2 = 1e-4;             // cm² → m²
const CM4_M4 = 1e-8;             // cm⁴ → m⁴

// ── Library conversion ────────────────────────────────────────────────────────

/**
 * EN profile (cm) → PORTICO section (m). WATCH the axis mapping:
 *  - profiles.csv: Iy = STRONG axis (major), Iz = WEAK axis (minor).
 *  - PORTICO/timoshenko.js: Φy = 12·E·Iz/(G·Avy·L²) → Iz is the strong axis and is
 *    paired with Avy. That's why they are swapped: Iz←Iy_EN, Iy←Iz_EN, Avy←Avz_EN
 *    (web, major shear), Avz←Avy_EN (flanges, minor shear).
 */
export function profileToSection(p, nombre) {
  const num = (v) => (typeof v === 'number' ? v : parseFloat(v));
  return {
    name: nombre,
    A:   num(p.A_cm2)   * CM2_M2,
    Iz:  num(p.Iy_cm4)  * CM4_M4,   // strong axis
    Iy:  num(p.Iz_cm4)  * CM4_M4,   // weak axis
    J:   num(p.It_cm4)  * CM4_M4,
    Avy: num(p.Avz_cm2) * CM2_M2,   // web    → paired with Iz (strong)
    Avz: num(p.Avy_cm2) * CM2_M2,   // flanges → paired with Iy (weak)
    kappay: 1.0, kappaz: 1.0,       // Av is already the effective shear area
  };
}

/**
 * Solid RECTANGULAR section (e.g. concrete beam/column) defined by b×h.
 * b = width, h = height (depth, strong axis). Accepts b_cm/h_cm or b_mm/h_mm or b_m/h_m.
 *  - Iz (strong) = b·h³/12 ; Iy (weak) = h·b³/12
 *  - J: St. Venant torsion constant for a rectangle (a≥c)
 *  - Avy = Avz = (5/6)·A  (Timoshenko shear factor for a rectangle)
 */
export function rectToSection(spec, nombre) {
  const m = (cm, mm, mt) => cm != null ? cm / 100 : mm != null ? mm / 1000 : mt;
  const b = m(spec.b_cm, spec.b_mm, spec.b_m);
  const h = m(spec.h_cm, spec.h_mm, spec.h_m);
  if (!(b > 0) || !(h > 0)) throw new Error(`Sección rectangular inválida: ${JSON.stringify(spec)}`);
  const A = b * h;
  const Iz = b * h ** 3 / 12;   // strong axis (bending in the depth plane)
  const Iy = h * b ** 3 / 12;   // weak axis
  const a = Math.max(b, h), c = Math.min(b, h);
  const J = a * c ** 3 * (1 / 3 - 0.21 * (c / a) * (1 - c ** 4 / (12 * a ** 4)));
  const Av = (5 / 6) * A;
  const fmt = (x) => +x.toFixed(8);
  return {
    name: nombre || `${Math.round(b * 100)}x${Math.round(h * 100)}`,
    A: fmt(A), Iz: fmt(Iz), Iy: fmt(Iy), J: fmt(J),
    Avy: fmt(Av), Avz: fmt(Av), kappay: 1.0, kappaz: 1.0,
  };
}

// Commercial timber sizes (nominal inches → real mm, S4S planed).
// For non-tabulated ones, nominal × 25.4 mm is used. Reference teaching values.
const ESCUADRIAS_MM = {
  '1x4': [19, 89], '1x6': [19, 140],
  '2x2': [38, 38], '2x3': [38, 64], '2x4': [38, 89], '2x5': [38, 114],
  '2x6': [38, 140], '2x8': [38, 184], '2x10': [38, 235], '2x12': [38, 286],
  '3x4': [64, 89], '4x4': [89, 89], '4x6': [89, 140],
};

/**
 * Timber size ("2x4", "2x8") or {b_cm,h_cm} → PORTICO section.
 * Also returns the recognized size (mm). null if it cannot be interpreted.
 */
export function sizeToSection(spec, nombre) {
  if (spec && typeof spec === 'object') {
    // Only if it carries recognizable dimensions; otherwise (e.g. nested LLM object), null.
    if (spec.b_cm == null && spec.b_mm == null && spec.b_m == null) return null;
    try { const sec = rectToSection(spec, nombre); return { sec, etiqueta: nombre || sec.name, mm: null }; }
    catch { return null; }
  }
  if (spec == null) return null;
  const s = String(spec).toLowerCase().replace(/["”]|pulg\w*|plg|in\b|\s/g, '');
  const key = s.replace(/[x×*]/g, 'x');
  if (ESCUADRIAS_MM[key]) {
    const [b, h] = ESCUADRIAS_MM[key];
    return { sec: rectToSection({ b_mm: b, h_mm: h }, nombre || `${key}"`), etiqueta: `${key}" (${b}×${h} mm)`, mm: [b, h] };
  }
  const m = key.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (m) {
    const b = +(+m[1] * 25.4).toFixed(1), h = +(+m[2] * 25.4).toFixed(1);
    return { sec: rectToSection({ b_mm: b, h_mm: h }, nombre || `${m[1]}x${m[2]}"`), etiqueta: `${m[1]}x${m[2]}" (${b}×${h} mm nominal)`, mm: [b, h] };
  }
  return null;
}

/** Row of materials.csv → PORTICO material. */
export function rowToMaterial(m) {
  const num = (v) => (typeof v === 'number' ? v : parseFloat(v));
  return {
    name: m.nombre,
    E: num(m.E_kN_m2), G: num(m.G_kN_m2), nu: num(m.nu), rho: num(m.rho_ton_m3),
  };
}

/**
 * FLEXIBLE material resolver for stud-frame/truss: recognizes STEEL
 * (acero/steel/metalcon/S235.../A630), TIMBER (pino/madera/wood) and CONCRETE
 * (Hxx/fc). Returns the PORTICO material or null (so the caller resolves the
 * default by context). Records interpretation warnings.
 */
export function resolveFlexMaterial(n, materiales, addWarning) {
  if (n == null) return null;
  const byName = new Map(materiales.map((m) => [String(m.nombre).trim().toLowerCase(), m]));
  const raw = String(n).trim(), low = raw.toLowerCase();
  const ex = byName.get(low); if (ex) return rowToMaterial(ex);
  if (/acero|steel|metalcon|s2\d\d|s3\d\d|a2\d\d|a6\d\d/.test(low)) {
    const grade = materiales.find((m) => m.type === 'acero' && low.includes(String(m.nombre).toLowerCase())) || byName.get('s275');
    if (grade) { if (String(grade.nombre).toLowerCase() !== low) addWarning('info', `Material "${n}" interpreted as steel "${grade.nombre}".`); return rowToMaterial(grade); }
    addWarning('replacement', `Material "${n}": used steel S275.`); return { name: 'S275', E: 2.1e8, G: 8.08e7, nu: 0.3, rho: 7.85 };
  }
  if (/pino|madera|wood|radiata|timber/.test(low)) {
    const w = byName.get('pino radiata'); if (w) { if (low !== 'pino radiata') addWarning('info', `Material "${n}" interpreted as "${w.nombre}".`); return rowToMaterial(w); }
  }
  const ctx = /(horm|[hg]\s*\d|fc|concret)/.test(low);   // [hg]: accepts "G30" and legacy "H30"
  const fcm = low.match(/(\d{2,3})/);   // no \b: captures "G50", "H50", "fc=50", "hormigón 50"
  if (ctx && fcm) {
    const fc = +fcm[1]; const c = byName.get('g' + fc) || byName.get('h' + fc); if (c) return rowToMaterial(c);
    const E = Math.round(4700 * Math.sqrt(fc) * 1000);
    addWarning('estimated', `Concrete fc=${fc} MPa estimated (E≈${(E / 1e6).toFixed(0)} GPa).`);
    return { name: `G${fc}(est)`, E, G: Math.round(E / 2.4), nu: 0.2, rho: 2.5 };
  }
  return null;
}

/**
 * Weaves the WEB of a truss (verticals + diagonals) between the bottom chord
 * B[] and the top chord T[] (n panels, n+1 nodes), by type:
 *  - 'warren': zigzag diagonals, no verticals.
 *  - 'pratt':  vertical posts + diagonals that DESCEND toward the center
 *              (in tension under gravity load).
 *  - 'howe':   vertical posts + diagonals that ASCEND toward the center
 *              (in compression).
 * addEl(n1,n2,secId) creates the member; secId = section of the diagonals/posts.
 */
export function weaveTrussWeb(B, T, n, tipo, addEl, secId) {
  const t = String(tipo || 'warren').toLowerCase();
  const half = n / 2;
  if (/pratt|howe/.test(t)) {
    for (let i = 0; i <= n; i++) addEl(B[i], T[i], secId);              // posts
    for (let i = 0; i < n; i++) {
      const izq = i < half;
      if (/pratt/.test(t)) izq ? addEl(T[i], B[i + 1], secId) : addEl(B[i], T[i + 1], secId);
      else /* howe */      izq ? addEl(B[i], T[i + 1], secId) : addEl(T[i], B[i + 1], secId);
    }
  } else {
    for (let i = 0; i < n; i++) (i % 2 === 0 ? addEl(B[i], T[i + 1], secId) : addEl(T[i], B[i + 1], secId));
  }
}

/**
 * GENERAL section resolver: timber size ("2x8") or {b_cm,h_cm} → rectangular;
 * steel profile name ("HEB200") → profile; if not recognized, uses a default
 * rectangular section. Records warnings.
 */
export function pickSection(spec, perfiles, defRect, label, addWarning) {
  const r = sizeToSection(spec);   // auto name by dimensions (not the label → no collapse)
  if (r) { if (spec) addWarning('info', `${label}: ${r.etiqueta}.`); return r.sec; }
  if (typeof spec === 'string') {
    const pm = new Map((perfiles || []).map((p) => [String(p.nombre).trim().toLowerCase(), p]));
    const pf = pm.get(spec.trim().toLowerCase());
    if (pf) { addWarning('info', `${label}: profile ${pf.nombre}.`); return profileToSection(pf, pf.nombre); }
  }
  if (spec != null) addWarning('replacement', `${label}: section "${typeof spec === 'object' ? JSON.stringify(spec) : spec}" not recognized: used ${defRect.b_cm}×${defRect.h_cm} cm by default.`);
  return rectToSection(defRect, `${defRect.b_cm}x${defRect.h_cm}`);
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Axis coordinates from a span specification:
 *  - list of spans:   [3, 3, 3, 4]
 *  - uniform:         { count: 4, span_m: 3 }
 *  Returns null if there is no valid spec. */
function axesFromBays(vanos) {
  let luces = null;
  if (Array.isArray(vanos) && vanos.length) luces = vanos.map(Number);
  else if (vanos && vanos.count >= 1 && vanos.span_m > 0)
    luces = Array(Math.round(vanos.count)).fill(Number(vanos.span_m));
  if (!luces || luces.some((l) => !(l > 0))) return null;
  const ejes = [0];
  for (const l of luces) ejes.push(+(ejes[ejes.length - 1] + l).toFixed(6));
  return ejes;
}

/** Grid axes, by priority: explicit axes → spans → subdivide L by sepMax. */
function resolveAxes(L, ejesExplicit, vanos, sepMax) {
  if (Array.isArray(ejesExplicit) && ejesExplicit.length >= 2) {
    return [...ejesExplicit].sort((a, b) => a - b);
  }
  const v = axesFromBays(vanos);
  if (v) return v;
  if (!(L > 0)) return [0];
  const nVanos = Math.max(1, Math.ceil(L / sepMax));
  const arr = [];
  for (let i = 0; i <= nVanos; i++) arr.push(+(L * i / nVanos).toFixed(6));
  return arr;
}

/** Perpendicular tributary width (Y) of axis j: mean of the neighboring half-spans. */
function tributario(ejes, j) {
  const lo = j > 0 ? (ejes[j] - ejes[j - 1]) / 2 : 0;
  const hi = j < ejes.length - 1 ? (ejes[j + 1] - ejes[j]) / 2 : 0;
  return lo + hi;
}

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * @param {object} spec    conforming to spec.schema.json (assumed already validated)
 * @param {object} libs     { reglas, perfiles: [], materiales: [] }
 *                           perfiles/materiales = arrays of objects (CSV rows)
 * @returns {object}        .s3d model (ready for JSON.stringify and to open in PORTICO)
 */
// Brazil preset (rules with NBR6123 wind or NBR15421 seismic): every typology leaves the generator with
// NBR combinations (NBR 8681:2025; γ of NBR 6118:2026 for concrete, NBR 8800:2024 = NBR 8681 for steel
// and timber) instead of the NCh3171 templates written by each typology.
const isBrasil = (reglas) => reglas?.loads?.wind?.metodo === 'NBR6123' || reglas?.loads?.seismic?.metodo === 'NBR15421';
function applyNbrCombinations(model, spec) {
  const warn = (t, m) => (model._warnings = model._warnings || []).push({ type: t, msg: m });
  const roofOnly = /galp|nave|industrial|shed|hangar|warehouse|cercha|celos|warren|truss/.test(String(spec.typology || '').toLowerCase());
  const sym = new Map(), used = new Set();
  for (const lc of model.loadCases || []) {
    let k = null;
    if (lc.type === 'spectrum') k = lc.specDir === 'Y' ? 'E90' : lc.specDir === 'Z' ? null : 'E0';
    else if (lc.selfWeight || /^CM\b/.test(lc.name)) k = 'G';
    else if (/^CV\b/.test(lc.name)) k = roofOnly ? 'Qcob' : 'Q';
    else if (/^Viento/.test(lc.name)) { const base = /^Viento Y\b/.test(lc.name) ? 'V90' : 'V0'; let i = 1; k = base; while (used.has(k)) k = `${base}_${++i}`; }
    else if (/^Sismo [XY]\b/.test(lc.name)) k = /^Sismo Y\b/.test(lc.name) ? 'E90' : 'E0';   // static (NBR 15421 7.3.2, zone 1)
    if (!k || used.has(k)) { warn('omitted', `Caso "${lc.name}" fora das combinações NBR (sem ação correspondente na NBR 8681/6120/6123/15421).`); continue; }
    used.add(k); sym.set(k, lc.id);
  }
  if (!sym.has('G')) { warn('omitted', 'Sem caso permanente: combinações NBR não geradas.'); model.combinations = []; return model; }
  const E = (model.materials || []).map(m => +m.E || 0);
  const family = E.length && E.every(e => e > 1e7 && e < 6e7) ? 'concrete' : 'steel';
  const r = nbrCombinations({ family, cases: [...sym.keys()], uso: spec.loads?.uso_nbr || 'residencial' });
  model.combinations = r.lista.map((c, i) => ({ id: i + 1, name: c.nombre,
    factors: Object.entries(c.factores).map(([k, f]) => ({ lcId: sym.get(k), factor: f })) }));
  if (model._counters) model._counters.combinations = model.combinations.length;
  // the typology's summary counted its own (replaced) combinations — keep it in step with the NBR set
  const g = model._generado, nc = model.combinations.length;
  if (g?.resumenT?.v && g.resumenT.v.ncb != null) g.resumenT.v.ncb = nc;
  if (typeof g?.resumen === 'string') g.resumen = g.resumen.replace(/\b\d+ combinations\b/, `${nc} combinations`);
  warn('info', `Combinações NBR 8681:2025 (${r.code}; ψ de uso "${spec.loads?.uso_nbr || 'residencial'}"): ${model.combinations.length} geradas.`);
  return model;
}

export function generateModel(spec, libs) {
  const m = generateModelByTypology(spec, libs);
  return isBrasil(libs?.reglas) ? applyNbrCombinations(m, spec) : m;
}

function generateModelByTypology(spec, libs) {
  // Dispatch by typology: timber and truss have their own geometry.
  const tip = String(spec.typology || 'frame').toLowerCase();
  // PARAMETRIC transmission tower (#53): spec.tower with dimensions → 3D lattice.
  if (spec.tower && typeof spec.tower === 'object' && !(Array.isArray(spec.elements) && spec.elements.length)
      || (/torre|mastil|transmis|alta.?tensi|celos[ií]a.?(3d|espacial)/.test(tip) && spec.tower)) return generateTower(spec, libs);
  if (/primitiv|libre|custom|generic|torre|mastil|celos[ií]a.?libre/.test(tip) || (Array.isArray(spec.elements) && spec.elements.length)) return generateFromPrimitives(spec, libs);
  if (/puente|bridge|viaduct|pasarela/.test(tip)) return generateBridge(spec, libs);
  if (/galp|nave|industrial|shed|hangar|bodega|warehouse/.test(tip)) return generateWarehouse(spec, libs);
  if (/cercha|celos|warren|truss/.test(tip)) return generateTruss(spec, libs);
  if (/madera|tabiqu|entramad|light.?frame|steel.?fram|metalcon|muros|timber|wall/.test(tip)) return generateStudWalls(spec, libs);

  const { reglas, perfiles, materiales } = libs;
  const rmod = reglas.modeling_rules || {};
  const sepMax = rmod.max_span_m || 6.0;
  const is2D = spec.mode === '2D';

  const perfilPorNombre = new Map(perfiles.map((p) => [String(p.nombre).trim(), p]));
  const matPorNombre = new Map(materiales.map((m) => [String(m.nombre).trim(), m]));

  // ── Warnings: the generator NEVER fails on missing data; it substitutes/estimates
  //    and records what it did. type: 'replacement'|'estimated'|'omitted'|'info'.
  const warnings = [];
  const addWarning = (tipo, msg) => warnings.push({ tipo, msg });

  const sec = spec.sections || {};
  const esRect = (s) => (s && typeof s === 'object' && (s.b_cm || s.b_mm || s.b_m)) ||
                        (typeof s === 'string' && /\d+\s*[xX×]\s*\d+/.test(s));
  // Concrete context if the sections are given by dimensions or the material suggests it.
  const contextoHormigon = esRect(sec.beams) || esRect(sec.columns) ||
                           /horm|fc|concret|^\s*h\s*\d/i.test(String(sec.material || ''));

  // RESILIENT material: exact → fc/Hxx → token-match → estimate concrete → default.
  const materialResiliente = (n) => {
    if (n != null) {
      const raw = String(n).trim();
      const exact = matPorNombre.get(raw);
      if (exact) return rowToMaterial(exact);
      const low = raw.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, ' ');
      const fcm = low.match(/\b(\d{2,3})\b/);
      const fc = fcm ? +fcm[1] : null;
      if (fc && /(horm|h\s*\d|fc|concret)/.test(low)) {
        const byFc = materiales.find((m) => String(m.fc_MPa).trim() === String(fc) || String(m.nombre).trim().toUpperCase() === 'H' + fc);
        if (byFc) return rowToMaterial(byFc);
        const E = Math.round(4700 * Math.sqrt(fc) * 1000); // kN/m² (E=4700√fc MPa)
        addWarning('estimated', `Material "${n}" was not in the database: concrete estimated fc=${fc} MPa (E≈${(E / 1e6).toFixed(0)} GPa, G≈${(Math.round(E / 2.4) / 1e6).toFixed(0)} GPa, ν=0.2, ρ=2.5 t/m³).`);
        return { name: `H${fc}(est)`, E, G: Math.round(E / 2.4), nu: 0.2, rho: 2.5 };
      }
      const qt = low.split(/\s+/).filter(Boolean);
      let best = null, bestScore = 0;
      for (const m of materiales) {
        const t = `${m.nombre} ${m.descripcion}`.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, ' ');
        const score = qt.filter((q) => q.length >= 2 && t.includes(q)).length;
        if (score > bestScore) { best = m; bestScore = score; }
      }
      if (best && bestScore > 0) {
        if (best.nombre.toLowerCase() !== raw.toLowerCase()) addWarning('info', `Material "${n}" interpreted as "${best.nombre}".`);
        return rowToMaterial(best);
      }
    }
    const defNom = contextoHormigon ? 'G30' : 'S275';
    addWarning('replacement', `Material ${n == null ? '(not given)' : `"${n}"`} not recognized: used ${defNom} by default.`);
    const def = matPorNombre.get(defNom) || (contextoHormigon ? matPorNombre.get('H30') : null);
    if (def) return rowToMaterial(def);
    return contextoHormigon ? { name: 'G30', E: 28700000, G: 11960000, nu: 0.2, rho: 2.5 }
                            : { name: 'S275', E: 210000000, G: 80800000, nu: 0.3, rho: 7.85 };
  };

  // RESILIENT section: rectangular {b_cm,h_cm}/"20x40" → concrete; string → steel
  // profile; if not recognized → default substitution by context.
  const resilientSection = (spec, etiqueta) => {
    try {
      if (spec && typeof spec === 'object') return rectToSection(spec, spec.name);
      if (typeof spec === 'string') {
        const mm = spec.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
        if (mm) return rectToSection({ b_cm: +mm[1], h_cm: +mm[2] }, spec);
        const p = perfilPorNombre.get(spec.trim());
        if (p) return profileToSection(p, spec.trim());
      }
    } catch { /* falls through to substitution */ }
    if (contextoHormigon) {
      const d = etiqueta === 'columns' ? { b_cm: 30, h_cm: 30 } : { b_cm: 25, h_cm: 50 };
      addWarning('replacement', `Section of ${etiqueta} ${spec == null ? '(not given)' : `"${typeof spec === 'object' ? JSON.stringify(spec) : spec}"`} not recognized: used concrete ${d.b_cm}×${d.h_cm} cm by default.`);
      return rectToSection(d, `${d.b_cm}x${d.h_cm}`);
    }
    const defNom = etiqueta === 'columns' ? 'HEB200' : 'IPE300';
    addWarning('replacement', `Profile of ${etiqueta} ${spec == null ? '(not given)' : `"${spec}"`} not found: used ${defNom} by default.`);
    const dp = perfilPorNombre.get(defNom);
    if (dp) return profileToSection(dp, defNom);
    return rectToSection({ b_cm: 30, h_cm: 30 }, '30x30');
  };

  // ── Counters and indices ──────────────────────────────────────────────────
  const cnt = { nodes: 0, elements: 0, materials: 0, sections: 0, diaphragms: 0, loadCases: 0, combinations: 0 };
  const nodes = [], elements = [], materials = [], sections = [], diaphragms = [], loadCases = [], combinations = [];

  // ── Materials and sections ────────────────────────────────────────────────
  const mat = materialResiliente(sec.material);
  mat.id = ++cnt.materials; materials.push(mat);

  const secViga = resilientSection(sec.beams, 'beams');
  secViga.id = ++cnt.sections; sections.push(secViga);
  const secPilar = resilientSection(sec.columns, 'columns');
  secPilar.id = ++cnt.sections; sections.push(secPilar);

  // ── Geometry: axes and levels (RESILIENT) ─────────────────────────────────
  const geo = spec.geometry || {};
  const pinf = geo.base_plan || {};
  // Axes per direction: explicit axes → spans (list or {count,span_m}) → plan.
  let ejesX = resolveAxes(pinf.Lx_m, geo.axes_x_m, geo.spans_x, sepMax);
  let ejesY = is2D ? [0] : resolveAxes(pinf.Ly_m, geo.axes_y_m, geo.spans_y, sepMax);
  if (ejesX.length < 2) { ejesX = [0, 5]; addWarning('replacement', 'No geometry defined in X: used 1 span of 5 m by default.'); }
  if (!is2D && ejesY.length < 2) { ejesY = [0, 5]; addWarning('replacement', 'No geometry defined in Y: used 1 span of 5 m by default.'); }
  if (!geo.levels || !geo.levels.length) { geo.levels = [{ height_m: 3 }]; addWarning('replacement', 'No levels defined: used 1 level of 3 m by default.'); }

  // Total span from the resolved axes (works for plan, spans or explicit axes).
  const Lx_inf = ejesX[ejesX.length - 1];
  const Ly_inf = is2D ? 0 : ejesY[ejesY.length - 1];
  const sup = geo.top_plan || {};
  const Lx_sup = sup.Lx_m ?? Lx_inf;
  const Ly_sup = is2D ? 0 : (sup.Ly_m ?? Ly_inf);

  const nNiv = geo.levels.length;
  const zNivel = [0];
  for (let k = 0; k < nNiv; k++) zNivel.push(zNivel[k] + geo.levels[k].height_m);
  // zNivel[0]=0 (base), zNivel[1..nNiv] = floors

  // interpolated plan factor for floor k (1..nNiv); base uses floor 1's
  const factorPlanta = (k) => {
    const t = nNiv > 1 ? (Math.max(1, k) - 1) / (nNiv - 1) : 0;
    return {
      sx: (Lx_inf + t * (Lx_sup - Lx_inf)) / Lx_inf,
      sy: Ly_inf > 0 ? (Ly_inf + t * (Ly_sup - Ly_inf)) / Ly_inf : 1,
    };
  };

  // ── Nodes: id by (level k, axis i, axis j) ────────────────────────────────
  const empotrado = !/rotul|pin/.test(String(spec.base_support || 'fixed').toLowerCase());
  const nodeId = new Map(); // key "k,i,j" → id
  const key = (k, i, j) => `${k},${i},${j}`;
  for (let k = 0; k <= nNiv; k++) {
    const { sx, sy } = factorPlanta(k);
    const esBase = k === 0;
    const r = esBase
      ? (empotrado ? { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 }
                   : { ux: 1, uy: 1, uz: 1, rx: 0, ry: 0, rz: 0 })
      : { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 };
    for (let i = 0; i < ejesX.length; i++) {
      for (let j = 0; j < ejesY.length; j++) {
        const id = ++cnt.nodes;
        nodeId.set(key(k, i, j), id);
        nodes.push({
          id, x: +(ejesX[i] * sx).toFixed(6), y: +(ejesY[j] * sy).toFixed(6), z: zNivel[k],
          restraints: { ...r },
          nodeMass: { mx: 0, my: 0, mz: 0 },
          springs: { kux: 0, kuy: 0, kuz: 0, krx: 0, kry: 0, krz: 0 },
        });
      }
    }
  }

  // ── Elements: columns (vertical) and beams (per level ≥ 1) ────────────────
  const addElem = (n1, n2, secId) => {
    const id = ++cnt.elements;
    elements.push({ id, n1, n2, matId: mat.id, secId, releases: Array(12).fill(0) });
    return id;
  };
  // columns: connect level k → k+1 at each (i,j)
  const elementoPilar = new Map(); // "k,i,j" → elemId (column of level k→k+1)
  for (let k = 0; k < nNiv; k++)
    for (let i = 0; i < ejesX.length; i++)
      for (let j = 0; j < ejesY.length; j++)
        elementoPilar.set(key(k, i, j), addElem(nodeId.get(key(k, i, j)), nodeId.get(key(k + 1, i, j)), secPilar.id));

  // beams at each floor level (k = 1..nNiv): spans in X and in Y.
  // All are recorded (X and Y) with their length and a tributary area that
  // accumulates by panels (45° rule) to distribute area loads in BOTH directions.
  const anchoTrib2D = geo.tributary_width_m || sepMax; // 2D: spacing between frames
  const coordX = (k, i) => ejesX[i] * factorPlanta(k).sx;
  const coordY = (k, j) => ejesY[j] * factorPlanta(k).sy;
  const vigas = [];                  // {elemId, k, dir:'X'|'Y', L, trib}
  const vigaXId = new Map();         // "k,i,j" → index (X beam of (i,j)→(i+1,j))
  const vigaYId = new Map();         // "k,i,j" → index (Y beam of (i,j)→(i,j+1))
  for (let k = 1; k <= nNiv; k++) {
    for (let j = 0; j < ejesY.length; j++)
      for (let i = 0; i < ejesX.length - 1; i++) {
        const eid = addElem(nodeId.get(key(k, i, j)), nodeId.get(key(k, i + 1, j)), secViga.id);
        vigaXId.set(key(k, i, j), vigas.push({ elemId: eid, k, dir: 'X', L: coordX(k, i + 1) - coordX(k, i), trib: 0 }) - 1);
      }
    if (!is2D)
      for (let i = 0; i < ejesX.length; i++)
        for (let j = 0; j < ejesY.length - 1; j++) {
          const eid = addElem(nodeId.get(key(k, i, j)), nodeId.get(key(k, i, j + 1)), secViga.id);
          vigaYId.set(key(k, i, j), vigas.push({ elemId: eid, k, dir: 'Y', L: coordY(k, j + 1) - coordY(k, j), trib: 0 }) - 1);
        }
  }

  // Tributary area per beam: 3D = 45° rule per panel (triangles on the short side,
  // trapezoids on the long side) → loads X and Y beams. 2D = fixed tributary width.
  if (is2D) {
    for (const v of vigas) v.trib = v.L * anchoTrib2D;
  } else {
    for (let k = 1; k <= nNiv; k++)
      for (let i = 0; i < ejesX.length - 1; i++)
        for (let j = 0; j < ejesY.length - 1; j++) {
          const sx = coordX(k, i + 1) - coordX(k, i);
          const sy = coordY(k, j + 1) - coordY(k, j);
          // tributary area this panel contributes to each X beam (length sx) and each Y beam (length sy)
          const aX = sx >= sy ? sy * (2 * sx - sy) / 4 : sx * sx / 4;
          const aY = sx >= sy ? sy * sy / 4 : sx * (2 * sy - sx) / 4;
          vigas[vigaXId.get(key(k, i, j))].trib     += aX;   // edge y=j
          vigas[vigaXId.get(key(k, i, j + 1))].trib += aX;   // edge y=j+1
          vigas[vigaYId.get(key(k, i, j))].trib     += aY;   // edge x=i
          vigas[vigaYId.get(key(k, i + 1, j))].trib += aY;   // edge x=i+1
        }
  }

  // ── Rigid diaphragms per level ────────────────────────────────────────────
  const usarDiaf = spec.rigid_diaphragm !== false && rmod.rigid_diaphragm_per_level !== false;
  const areaPiso = (k) => {
    const { sx, sy } = factorPlanta(k);
    return (Lx_inf * sx) * (is2D ? 1 : (Ly_inf * sy));
  };

  // ── Area loads → lines, CM / CV cases (PER LEVEL) ──────────────────────────
  const cargas = spec.loads || {};

  // Live-use load lookup (NCh1537), tolerant: exact match and, failing that, the
  // best by token overlap (accent-free, with prefixes). So "bodegas livianas" →
  // "Bodegas/Áreas de mercadería liviana", "salas de clase" →
  // "Escuelas/Salas de Clases", etc.
  // normalize('NFD') splits accents as combining marks; [^a-z0-9 ] removes them
  // along with punctuation → comparison without accents or symbols.
  const norm = (s) => String(s).toLowerCase().normalize('NFD')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'con', 'area', 'areas', 'para', 'tipo', 'uso']);
  const toks = (s) => norm(s).split(' ').filter((t) => t && !STOP.has(t));
  const pref = (a, b) => (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b)) || a === b;
  const usoALo = (uso) => {
    if (uso == null) return null;
    const filas = libs.sobrecargas || [];
    const b = norm(uso);
    // 1) exact (description or "type/description")
    const exacto = filas.find((s) => norm(s.descripcion) === b ||
      norm(`${s.building_type} ${s.descripcion}`) === b || norm(`${s.building_type}/${s.descripcion}`) === b);
    if (exacto) return parseFloat(exacto.Lo_kNm2);
    // 2) best token overlap
    const qt = toks(uso);
    if (!qt.length) return null;
    let best = null, bestScore = 0, bestLen = Infinity;
    for (const s of filas) {
      const rt = toks(`${s.building_type} ${s.descripcion}`);
      const score = qt.filter((q) => rt.some((r) => pref(q, r))).length;
      if (score > bestScore || (score === bestScore && score > 0 && rt.length < bestLen)) {
        best = s; bestScore = score; bestLen = rt.length;
      }
    }
    // require matching at least half of the query tokens
    return best && bestScore >= Math.ceil(qt.length / 2) ? parseFloat(best.Lo_kNm2) : null;
  };

  // Loads PER LEVEL (k = 1..nNiv): each level may declare its use/loads; otherwise
  // it inherits the globals from spec.loads. Allows e.g. level 1 "Salas de Clases"
  // and level 3 "Bodegas livianas" with different live loads.
  const nivel = (k) => geo.levels[k - 1] || {};
  // usoALo + warning if a declared use is not recognized (once per text).
  const usosAvisados = new Set();
  const usoLo = (uso) => {
    if (uso == null) return null;
    const lo = usoALo(uso);
    if (lo == null && !usosAvisados.has(uso)) {
      usosAvisados.add(uso);
      addWarning('omitted', `Use "${uso}" not found in NCh1537: that level has no use live load (LL=0). Specify it in kN/m² if applicable.`);
    }
    return lo;
  };
  const qCMk = (k) => nivel(k).dead_extra_kN_m2 ?? cargas.dead_extra_kN_m2 ?? 0;
  const qCVk = (k) => nivel(k).live_load_kN_m2 ?? usoLo(nivel(k).use_class)
                    ?? cargas.live_load_kN_m2 ?? usoLo(cargas.use_class) ?? 0;

  // distributes an area load q(k) [kN/m²] to ALL beams (X and Y) by their tributary
  // area: equivalent line load w = q · A_trib / L. Preserves the total resultant
  // (Σ A_trib = floor area) and loads both directions.
  const distLoadsFn = (qFn) => {
    const out = [];
    for (const v of vigas) {
      const q = qFn(v.k);
      if (!(q > 0) || !(v.trib > 0) || !(v.L > 0)) continue;
      const w = q * v.trib / v.L;
      if (w > 0) out.push({ type: 'dist', elemId: v.elemId, dir: 'gravity', w: +w.toFixed(6) });
    }
    return out;
  };

  // CM: self-weight + dead area load (per level)
  const lcCM = { id: ++cnt.loadCases, name: 'CM', loads: distLoadsFn(qCMk), selfWeight: true, type: 'static', specDir: null };
  loadCases.push(lcCM);
  // CV: live-use load (per level)
  const lcCV = { id: ++cnt.loadCases, name: 'CV', loads: distLoadsFn(qCVk), selfWeight: false, type: 'static', specDir: null };
  loadCases.push(lcCV);

  // optional lateral cases (geometry placeholders; magnitudes tuned separately)
  let lcSxId = null, lcSyId = null, lcNvId = null, lcWId = null;
  const h_techo = zNivel[nNiv];

  const ub = spec.location || {};
  if (cargas.snow) {
    // Snow on the roof (top level): area load ps (kN/m²) distributed.
    const nv = snowLoad(spec, reglas);
    const ps = nv.ps ?? 0;
    (nv._notas || []).forEach((n) => addWarning('omitted', `Snow: ${n}`));
    if (ps <= 0) addWarning('omitted', `Snow enabled but no applicable value (missing latitude/altitude?): the case was created with load 0.`);
    const lcNv = { id: ++cnt.loadCases, name: 'Nieve', loads: [], selfWeight: false, type: 'static', specDir: null, _nieve: nv };
    if (ps > 0) for (const v of vigas) if (v.k === nNiv && v.trib > 0 && v.L > 0) {
      lcNv.loads.push({ type: 'dist', elemId: v.elemId, dir: 'gravity', w: +(ps * v.trib / v.L).toFixed(6) });
    }
    loadCases.push(lcNv); lcNvId = lcNv.id;
  }
  if (cargas.wind) {
    // Wind in +X: net wall pressure (zone 1 windward − zone 4 leeward) as a
    // horizontal line load (globalX) on the columns of the x=min face.
    if (ub.latitude_deg == null && !ub.city && !(spec.wind?.V0_m_s > 0)) addWarning('omitted', 'Wind enabled without location (latitude/city): used the default basic speed.');
    // preset Brasil, 3D: the plan of windLoad (a ≥ b, S2 class of each façade) comes from the resolved plan unless given
    const nbrPlan = reglas.loads?.wind?.metodo === 'NBR6123' && !is2D && !(spec.wind?.a_m > 0 && spec.wind?.b_m > 0);
    const vi = windLoad(nbrPlan ? { ...spec, wind: { ...(spec.wind || {}), a_m: Math.max(Lx_inf, Ly_inf), b_m: Math.min(Lx_inf, Ly_inf) } } : spec, reglas, h_techo);
    let pNet_kNm2 = ((vi.presiones['1'] || 0) - (vi.presiones['4'] || 0)) / 1000; // N/m²→kN/m²
    // NBR 6123:2023 6.1.2: the global force on a rectangular-plan building is Fa = Ca·q·Ae (Fig. 4/5), not the
    // difference of the wall Cpe (those are for the cladding/elements). Ca per wind direction from the real plan:
    // wind X hits the face x = 0 → ℓ1 = Ly (⊥ wind), ℓ2 = Lx; wind Y → ℓ1 = Lx, ℓ2 = Ly. 2D: the plan of windLoad.
    const nbrW = reglas.loads?.wind?.metodo === 'NBR6123';
    const br = (v) => String(v).replace('.', ',');
    const caDir = (l1, l2) => caEdificio(reglas.loads.wind, { h: h_techo, l1, l2, altaTurbulencia: !!spec.wind?.altaTurbulencia });
    // q of the façade hit: class by its own frontal dimension (5.3.2) — long side a → q, short side b → q_empena
    const qFace = (width) => (width >= Math.max(Lx_inf, Ly_inf) - 1e-9 ? vi.q_Nm2 : (vi.q_empena_Nm2 ?? vi.q_Nm2));
    const pNbr = (ca, dir, qN = vi.q_Nm2) => {
      if (ca?.Ca > 0) {
        for (const n of ca.avisos || []) addWarning('info', `Vento ${dir}: ${n}`);
        addWarning('info', `Vento NBR 6123 (6.1.2) ${dir}: Ca = ${br(ca.Ca)} (${ca.fig}, ℓ1/ℓ2 = ${br(ca.l1_l2)}, h/ℓ1 = ${br(ca.h_l1)}) × q = ${br(qN)} N/m² (classe pela fachada atingida) nos pilares a barlavento; q do topo em toda a altura (a favor da segurança).`);
        return ca.Ca * qN / 1000;
      }
      addWarning('omitted', `Vento NBR 6123 ${dir}: ${ca?.aviso || 'Ca indisponível'} — usada a diferença de Cpe das paredes (Tab. 6), que NÃO é a força global de 6.1.2; informe Ca.`);
      return null;
    };
    if (nbrW) {
      const p = pNbr(is2D ? vi.ca : caDir(Ly_inf, Lx_inf), 'X', is2D ? vi.q_Nm2 : qFace(Ly_inf));
      if (p != null) pNet_kNm2 = p;
      addWarning('omitted', 'Vento NBR 6123: excentricidade das forças de arrasto (6.1.4: ea = 0,075·a e eb = 0,075·b; 0,15 com vizinhança) NÃO gerada — considere a torção (casos com a força deslocada) no projeto.');
    }
    const lcW = { id: ++cnt.loadCases, name: 'Viento X', loads: [], selfWeight: false, type: 'static', specDir: null, _viento: vi, _presion_neta_muro_kNm2: +pNet_kNm2.toFixed(4) };
    if (pNet_kNm2 !== 0) for (let k = 0; k < nNiv; k++) for (let j = 0; j < ejesY.length; j++) {
      // column of the windward face (i=0) at level k→k+1
      const eid = elementoPilar.get(`${k},0,${j}`);
      const w = pNet_kNm2 * (is2D ? anchoTrib2D : tributario(ejesY, j) * factorPlanta(k + 1).sy);
      if (eid != null && w !== 0) lcW.loads.push({ type: 'dist', elemId: eid, dir: 'globalX', w: +w.toFixed(6) });
    }
    // preset Brasil, 3D: wind on the other façade too (NBR 6123: each façade), face y = 0, Ca with ℓ1 = Lx
    let lcYwind = null;
    if (nbrW && !is2D) {
      let pY = pNbr(caDir(Lx_inf, Ly_inf), 'Y', qFace(Lx_inf));
      if (pY == null) pY = ((vi.presiones['1'] || 0) - (vi.presiones['4'] || 0)) / 1000;
      const lcY = { id: ++cnt.loadCases, name: 'Viento Y', loads: [], selfWeight: false, type: 'static', specDir: null, _viento: vi, _presion_neta_muro_kNm2: +pY.toFixed(4) };
      if (pY !== 0) for (let k = 0; k < nNiv; k++) for (let i = 0; i < ejesX.length; i++) {
        const eid = elementoPilar.get(`${k},${i},0`);
        const w = pY * tributario(ejesX, i) * factorPlanta(k + 1).sx;
        if (eid != null && w !== 0) lcY.loads.push({ type: 'dist', elemId: eid, dir: 'globalY', w: +w.toFixed(6) });
      }
      lcYwind = lcY;
    }
    loadCases.push(lcW); lcWId = lcW.id;
    if (lcYwind) loadCases.push(lcYwind);
  }
  if (cargas.seismic && reglas.loads?.seismic?.metodo === 'NBR15421') {
    // NBR 15421:2023 spectrum (preset Brasil): ag, ground class, occupancy category and R from the spec.
    let esp = null;
    try { esp = responseSpectrum(spec, reglas); }
    catch (e) { esp = { _error: e.message }; addWarning('omitted', `Espectro NBR 15421 não gerado (${e.message}); o caso sísmico fica sem curva.`); }
    loadCases.push({ id: ++cnt.loadCases, name: 'Sismo X', loads: [], selfWeight: false, type: 'spectrum', specDir: 'X', _espectro_NBR15421: esp }); lcSxId = cnt.loadCases;
    if (!is2D) { loadCases.push({ id: ++cnt.loadCases, name: 'Sismo Y', loads: [], selfWeight: false, type: 'spectrum', specDir: 'Y', _espectro_NBR15421: esp }); lcSyId = cnt.loadCases; }
  } else if (cargas.seismic) {
    // NCh433 elastic spectrum. Sanitizes parameters (zone/soil/category) with
    // reasonable defaults if missing or invalid, recording the substitution.
    const s = reglas.loads?.seismic || {};
    const sp = { ...(spec.seismic || {}) };
    // Seismic zone by CITY (NCh433) if not explicitly given.
    if (sp.zone == null && ub.city) {
      const zc = s.zonificacion_ciudades?.tabla;
      const key = String(ub.city).toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
      const z = zc ? zc[key] : null;
      if (z != null) { sp.zone = z; addWarning('info', `Seismic zone ${z} assigned by city "${ub.city}" (NCh433).`); }
      else addWarning('omitted', `City "${ub.city}" is not in the zoning table: check the zone by municipality (Table 4.1 / Figure 4.1 NCh433).`);
    }
    if (!(s.soil_table && s.soil_table[sp.soil])) { if (sp.soil != null) addWarning('replacement', `Seismic soil "${sp.soil}" invalid: used D.`); else addWarning('replacement', 'No seismic soil given: used D.'); sp.soil = 'D'; }
    if (!(s.zone_table_Ao_g && s.zone_table_Ao_g[String(sp.zone)])) { if (sp.zone != null) addWarning('replacement', `Seismic zone "${sp.zone}" invalid: used 2.`); else addWarning('replacement', 'No seismic zone given: used zone 2.'); sp.zone = 2; }
    if (!(s.category_table && s.category_table[sp.category])) { sp.category = 'II'; }
    let esp = null;
    try { esp = responseSpectrum({ ...spec, seismic: sp }, reglas); }
    catch (e) { esp = { _error: e.message }; addWarning('omitted', `Could not build the NCh433 spectrum (${e.message}); the seismic case has no curve.`); }
    loadCases.push({ id: ++cnt.loadCases, name: 'Sismo X', loads: [], selfWeight: false, type: 'spectrum', specDir: 'X', _espectro_NCh433: esp }); lcSxId = cnt.loadCases;
    if (!is2D) { loadCases.push({ id: ++cnt.loadCases, name: 'Sismo Y', loads: [], selfWeight: false, type: 'spectrum', specDir: 'Y', _espectro_NCh433: esp }); lcSyId = cnt.loadCases; }
  }

  // ── Seismic mass on diaphragms (CM + fraction of CV) ──────────────────────
  if (usarDiaf) {
    const fracCV = (reglas.loads?.seismic_mass?.live_load_fraction) ?? 0.25;
    for (let k = 1; k <= nNiv; k++) {
      const A = areaPiso(k);
      const nodosNivel = [];
      let sx = 0, sy = 0;
      for (let i = 0; i < ejesX.length; i++)
        for (let j = 0; j < ejesY.length; j++) {
          const id = nodeId.get(key(k, i, j)); nodosNivel.push(id);
          const nd = nodes[id - 1]; sx += nd.x; sy += nd.y;
        }
      const cm = { x: +(sx / nodosNivel.length).toFixed(6), y: +(sy / nodosNivel.length).toFixed(6) };
      const W = (qCMk(k) + fracCV * qCVk(k)) * A;   // kN (without steel self-weight, minor)
      const m = +(W / G_GRAV).toFixed(6);            // tonnes
      const { sx: fx, sy: fy } = factorPlanta(k);
      const Lx = Lx_inf * fx, Ly = is2D ? 0 : Ly_inf * fy;
      const Icm = +(m * (Lx * Lx + Ly * Ly) / 12).toFixed(6);
      diaphragms.push({ id: ++cnt.diaphragms, z: zNivel[k], nodes: nodosNivel, cm, mass: { m, Icm }, eccentricity: { ex: 0, ey: 0 } });
    }
  }

  // ── NCh3171 combinations (LRFD) over the created cases ────────────────────
  const addCombo = (name, pares) => {
    const factors = pares.filter(([id]) => id != null).map(([lcId, factor]) => ({ lcId, factor }));
    combinations.push({ id: ++cnt.combinations, name, factors });
  };
  addCombo('1.4CM', [[lcCM.id, 1.4]]);
  addCombo('1.2CM+1.6CV', [[lcCM.id, 1.2], [lcCV.id, 1.6]]);
  if (lcNvId) addCombo('1.2CM+1.6N+1.0CV', [[lcCM.id, 1.2], [lcNvId, 1.6], [lcCV.id, 1.0]]);
  if (lcWId)  { addCombo('1.2CM+1.0W+1.0CV', [[lcCM.id, 1.2], [lcWId, 1.0], [lcCV.id, 1.0]]);
                addCombo('0.9CM+1.0W', [[lcCM.id, 0.9], [lcWId, 1.0]]); }
  if (lcSxId) { addCombo('1.2CM+1.0Ex+1.0CV', [[lcCM.id, 1.2], [lcSxId, 1.0], [lcCV.id, 1.0]]);
                addCombo('0.9CM+1.0Ex', [[lcCM.id, 0.9], [lcSxId, 1.0]]); }
  if (lcSyId) { addCombo('1.2CM+1.0Ey+1.0CV', [[lcCM.id, 1.2], [lcSyId, 1.0], [lcCV.id, 1.0]]);
                addCombo('0.9CM+1.0Ey', [[lcCM.id, 0.9], [lcSyId, 1.0]]); }

  // ── Assemble .s3d model ───────────────────────────────────────────────────
  return {
    version: '1.0',
    units: 'kN-m',
    mode: is2D ? '2D' : '3D',
    nodes, elements, materials, sections, diaphragms, loadCases, combinations,
    grids: { x: ejesX, y: ejesY, z: zNivel },
    _counters: { ...cnt },
    _generado: {
      por: 'assistant/generator.js',
      reglas: reglas._meta?.version,
      resumen: `${nodes.length} nodes, ${elements.length} elements, ${loadCases.length} cases, ${combinations.length} combinations`,
      resumenT: { k: '{nn} nudos, {ne} elementos, {nc} casos, {ncb} combinaciones', v: { nn: nodes.length, ne: elements.length, nc: loadCases.length, ncb: combinations.length } },
    },
    _warnings: warnings,   // [{type:'replacement'|'estimated'|'omitted'|'info', msg}] (Spanish labels by design)
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// LIGHT TIMBER FRAME typology (stud walls + joists)
//   Studs (vertical) + bottom/top plates (horizontal) per level; perimeter and/or
//   interior walls with openings (door/window: the studs of the opening are omitted
//   and a lintel is placed). Floor/roof joists supported on the walls, loaded by
//   tributary width (1 direction).
//   Deterministic and resilient: never fails on missing data.
// ──────────────────────────────────────────────────────────────────────────────
export function generateStudWalls(spec, libs) {
  const materiales = libs.materiales || [];
  const matPorNombre = new Map(materiales.map((m) => [String(m.nombre).trim(), m]));
  const warnings = [];
  const addWarning = (tipo, msg) => warnings.push({ tipo, msg });

  // ── Material (steel/timber/concrete; default timber if not given) ──
  const pickMat = (n) => {
    const r = resolveFlexMaterial(n, materiales, addWarning);
    if (r) return r;
    const def = matPorNombre.get('Pino Radiata');
    addWarning('replacement', `Material ${n == null ? '(not given)' : `"${n}"`}: used Radiata Pine by default (framing). For steel framing specify material 'acero' or 'S275'.`);
    return def ? rowToMaterial(def) : { name: 'Pino Radiata', E: 1.0e7, G: 6.25e5, nu: 0.3, rho: 0.45 };
  };
  const mat = pickMat((spec.sections || {}).material); mat.id = 1;
  const esAcero = /acero|s\d{3}|a\d{3}/i.test(mat.name);

  // ── Sections (timber sizes) ──
  const tb = spec.stud_walls || {};
  const ep = spec.floors || {};
  const pickSec = (spec, label, defKey) => {
    const r = sizeToSection(spec, label);
    if (r) { if (spec) addWarning('info', `${label}: ${r.etiqueta}.`); return r.sec; }
    addWarning('replacement', `${label}: size ${spec == null ? '(not given)' : `"${spec}"`} not recognized: used ${defKey}" by default.`);
    return sizeToSection(defKey, label).sec;
  };
  const secStud = pickSec(tb.nominal_size, 'Stud/chord', esAcero ? '2x4' : '2x4'); secStud.id = 1;
  const secJoist = pickSec(ep.nominal_size, 'Vigueta', esAcero ? '2x8' : '2x8'); secJoist.id = 2;
  if (esAcero) addWarning('info', `Steel framing: used material ${mat.name}. Sizes are modeled as equivalent solid rectangular sections (a real metalcon C-profile has lower inertia for the same depth).`);

  // ── Base geometry ──
  const geo = spec.geometry || {};
  const pinf = geo.base_plan || {};
  let Lx = pinf.Lx_m, Ly = pinf.Ly_m;
  if (!(Lx > 0)) { Lx = 6; addWarning('replacement', 'No plan length given (Lx): used 6 m.'); }
  if (!(Ly > 0)) { Ly = 4; addWarning('replacement', 'No plan width given (Ly): used 4 m.'); }
  if (!geo.levels || !geo.levels.length) { geo.levels = [{ height_m: 3 }]; addWarning('replacement', 'No levels defined: 1 level of 3 m.'); }
  const nNiv = geo.levels.length;
  const zNivel = [0];
  for (let k = 0; k < nNiv; k++) zNivel.push(+(zNivel[k] + (geo.levels[k].height_m > 0 ? geo.levels[k].height_m : 3)).toFixed(4));

  const sepStud = tb.spacing_m > 0 ? tb.spacing_m : 0.4;
  const sepJoist = ep.spacing_m > 0 ? ep.spacing_m : 0.6;
  const dirJ = (ep.dir === 'Y') ? 'Y' : 'X';   // direction in which the joists run
  const perim = tb.perimeter !== false;
  const diagOn = tb.diagonals !== false;       // wall bracing (on by default)
  const diagTramos = tb.diagonal_bays >= 2 ? Math.floor(tb.diagonal_bays) : 3; // bays each diagonal spans

  // ── Roof: flat (joists) by default, or gable Warren trusses ──
  const techo = spec.roof || {};
  const techoCercha = /cercha|warren|celos|truss|dos.?agua/.test(String(techo.type || ''));
  const techoCel = /pratt/i.test(String(techo.truss_type || '')) ? 'pratt' : (/howe/i.test(String(techo.truss_type || '')) ? 'howe' : 'warren');
  const dirT = techo.dir === 'Y' ? 'Y' : (techo.dir === 'X' ? 'X' : (Lx <= Ly ? 'X' : 'Y')); // trusses span in this direction
  const sepT = techo.spacing_m > 0 ? techo.spacing_m : 0.6;   // spacing between trusses
  const spanT = dirT === 'X' ? Lx : Ly;   // truss span
  const perpT = dirT === 'X' ? Ly : Lx;   // direction the trusses are spread along

  // ── Node/element registry (with coordinate merging and dedup) ──
  const nodes = [], elements = [];
  let nid = 0, eid = 0;
  const nodeAt = new Map(), elemAt = new Set();
  const rk = (v) => Math.round(v * 1000) / 1000;
  const empot = () => ({ ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 });
  const rotul = () => ({ ux: 1, uy: 1, uz: 1, rx: 0, ry: 0, rz: 0 });
  const baseR = /rotul|pin/.test(String(spec.base_support || '').toLowerCase()) ? rotul : empot;
  const getNode = (x, y, z) => {
    const k = `${rk(x)}|${rk(y)}|${rk(z)}`;
    let id = nodeAt.get(k);
    if (id == null) {
      id = ++nid; nodeAt.set(k, id);
      nodes.push({
        id, x: rk(x), y: rk(y), z: rk(z),
        restraints: rk(z) === 0 ? baseR() : { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 },
        nodeMass: { mx: 0, my: 0, mz: 0 },
        springs: { kux: 0, kuy: 0, kuz: 0, krx: 0, kry: 0, krz: 0 },
      });
    }
    return id;
  };
  const addEl = (n1, n2, secId) => {
    if (n1 == null || n2 == null || n1 === n2) return null;
    const ek = `${Math.min(n1, n2)}-${Math.max(n1, n2)}`;
    if (elemAt.has(ek)) return null;
    elemAt.add(ek);
    const id = ++eid;
    elements.push({ id, n1, n2, matId: 1, secId, releases: Array(12).fill(0) });
    return id;
  };

  // inclusive series [0, sep, 2·sep, …, L] with the last node exactly at L
  const serie = (L, sep) => {
    const a = [0]; let x = sep;
    while (x < L - 1e-6) { a.push(+x.toFixed(4)); x += sep; }
    a.push(+L.toFixed(4));
    return a;
  };
  const merge = (...arrs) => [...new Set(arrs.flat().map((v) => +(+v).toFixed(4)))].sort((p, q) => p - q);

  // Generic wall along an axis. axis='X' → the line runs in X at y=fixed;
  // axis='Y' → runs in Y at x=fixed. coords = plate nodes; studs = stud positions;
  // aberturas = [{a, b, alto, tipo}] (a,b = edges of the opening).
  const buildWall = (axis, fixed, coords, studs, zb, zt, aberturas = []) => {
    const P = (c, z) => axis === 'X' ? getNode(c, fixed, z) : getNode(fixed, c, z);
    // bottom (zb) and top (zt) plates by spans between consecutive nodes
    for (let i = 0; i < coords.length - 1; i++) {
      const c0 = coords[i], c1 = coords[i + 1], mid = (c0 + c1) / 2;
      const enPuerta = aberturas.some((ab) => ab.type !== 'window' && mid > ab.a + 1e-6 && mid < ab.b - 1e-6);
      if (!enPuerta) addEl(P(c0, zb), P(c1, zb), secStud.id);  // bottom plate (no sill at doors)
      addEl(P(c0, zt), P(c1, zt), secStud.id);                 // top plate (continuous)
    }
    // studs (omitted inside an opening)
    for (const c of studs) {
      if (aberturas.some((ab) => c > ab.a + 1e-6 && c < ab.b - 1e-6)) continue;
      addEl(P(c, zb), P(c, zt), secStud.id);
    }
    // jambs + lintel at each opening
    for (const ab of aberturas) {
      const zh = Math.min(zt - 1e-4, zb + ab.alto);
      addEl(P(ab.a, zb), P(ab.a, zh), secStud.id); addEl(P(ab.a, zh), P(ab.a, zt), secStud.id);
      addEl(P(ab.b, zb), P(ab.b, zh), secStud.id); addEl(P(ab.b, zh), P(ab.b, zt), secStud.id);
      addEl(P(ab.a, zh), P(ab.b, zh), secStud.id);   // lintel
    }
    // zigzag bracing diagonals (each diagonal spans diagTramos stud bays → crosses
    // diagTramos−1 studs). Bays that fall over an opening are skipped.
    if (diagOn && studs.length > diagTramos) {
      let sube = true;   // alternates direction to form the zigzag
      for (let j = 0; j + diagTramos < studs.length; j += diagTramos) {
        const cA = studs[j], cB = studs[j + diagTramos];
        const cruzaVano = aberturas.some((ab) => !(cB <= ab.a + 1e-6 || cA >= ab.b - 1e-6));
        if (cruzaVano) { sube = !sube; continue; }
        if (sube) addEl(P(cA, zb), P(cB, zt), secStud.id);
        else addEl(P(cA, zt), P(cB, zb), secStud.id);
        sube = !sube;
      }
    }
  };

  // Positions of studs, joists and trusses (roof)
  const Px = serie(Lx, sepStud), Py = serie(Ly, sepStud);
  const Xj = serie(Lx, sepJoist), Yj = serie(Ly, sepJoist);
  const Tt = techoCercha ? serie(perpT, sepT) : [];   // truss positions (perpendicular to the span)

  // ── Perimeter walls per level ──
  // The truss supports must fall on nodes of the top plate of the last level: that's
  // why the truss positions (Tt) are merged into the walls that support them.
  for (let k = 1; k <= nNiv; k++) {
    const zb = zNivel[k - 1], zt = zNivel[k];
    if (!perim) break;
    const esUltimo = k === nNiv;
    // walls running in X (at y=0 and y=Ly): receive joists if dirJ='Y' (at x=Xj),
    // and truss supports if dirT='Y' (at x=Tt)
    const cx = merge(Px, dirJ === 'Y' ? Xj : [], (esUltimo && dirT === 'Y') ? Tt : []);
    buildWall('X', 0, cx, Px, zb, zt);
    buildWall('X', Ly, cx, Px, zb, zt);
    // walls running in Y (at x=0 and x=Lx): receive joists if dirJ='X' (at y=Yj),
    // and truss supports if dirT='X' (at y=Tt)
    const cy = merge(Py, dirJ === 'X' ? Yj : [], (esUltimo && dirT === 'X') ? Tt : []);
    buildWall('Y', 0, cy, Py, zb, zt);
    buildWall('Y', Lx, cy, Py, zb, zt);
  }

  // ── Interior walls with openings ──
  for (const w of (tb.interior || [])) {
    const k = Math.min(nNiv, Math.max(1, w.level || 1));
    const zb = zNivel[k - 1], zt = zNivel[k];
    const dir = w.dir === 'X' ? 'X' : 'Y';
    const Lrun = dir === 'X' ? Lx : Ly;
    const fixed = Math.min(dir === 'X' ? Ly : Lx, Math.max(0, w.pos_m != null ? w.pos_m : (dir === 'X' ? Ly : Lx) / 2));
    const ab = (w.openings || []).map((o) => {
      const ancho = o.width_m > 0 ? o.width_m : 0.8;
      const c = Math.min(Lrun - ancho / 2, Math.max(ancho / 2, o.center_m != null ? o.center_m : Lrun / 2));
      return { a: +(c - ancho / 2).toFixed(4), b: +(c + ancho / 2).toFixed(4), alto: o.opening_height_m > 0 ? o.opening_height_m : 2.0, type: o.type === 'window' ? 'window' : 'door' };
    });
    const edges = ab.flatMap((o) => [o.a, o.b]);
    const studs = serie(Lrun, sepStud);
    buildWall(dir, fixed, merge(studs, edges), studs, zb, zt, ab);
  }

  // ── Floor joists per level (supported on walls), with tributary width ──
  // If the roof is trussed, the last level does NOT get a flat joist platform.
  const joists = [];   // {elemId, k, L, trib}
  const kJoistMax = techoCercha ? nNiv - 1 : nNiv;
  for (let k = 1; k <= kJoistMax; k++) {
    const z = zNivel[k];
    if (dirJ === 'X') {                  // joists in X (from x=0 to x=Lx), distributed in Y
      for (let j = 0; j < Yj.length; j++) {
        const eid = addEl(getNode(0, Yj[j], z), getNode(Lx, Yj[j], z), secJoist.id);
        joists.push({ elemId: eid, k, L: Lx, trib: tributario(Yj, j) });
      }
    } else {                              // joists in Y (from y=0 to y=Ly), distributed in X
      for (let i = 0; i < Xj.length; i++) {
        const eid = addEl(getNode(Xj[i], 0, z), getNode(Xj[i], Ly, z), secJoist.id);
        joists.push({ elemId: eid, k, L: Ly, trib: tributario(Xj, i) });
      }
    }
  }

  // ── Gable Warren truss roof (integrated over the walls) ──
  // Each truss is a vertical planar lattice spanning spanT, supported at both ends
  // on the top plates; they are spread every sepT and tied together with purlins
  // → stable 3D roof.
  const roofTop = [];   // {elemId, dx, Lsl}  (top chords, for loading)
  let secCordT = null, secDiagT = null;
  if (techoCercha) {
    secCordT = sizeToSection(techo.chord_size || (esAcero ? '2x6' : '2x6'), 'Roof chord').sec; secCordT.id = 3;
    secDiagT = sizeToSection(techo.diagonal_size || '2x4', 'Roof diagonal').sec; secDiagT.id = 4;
    const zT = zNivel[nNiv];
    const usaAltura = techo.ridge_height_m > 0;
    const slopeT = (techo.slope_pct >= 0 ? techo.slope_pct : 10) / 100;
    const hRT = usaAltura ? techo.ridge_height_m : slopeT * (spanT / 2);
    let nT = Math.max(2, Math.round(techo.n_panels || Math.max(4, Math.round(spanT)) )); if (nT % 2) nT += 1;
    const along = (i) => +(i * spanT / nT).toFixed(5);
    const zRoof = (a) => +(a <= spanT / 2 ? (2 * hRT / spanT) * a : (2 * hRT / spanT) * (spanT - a)).toFixed(5);
    const XY = (a, p) => dirT === 'X' ? [a, p] : [p, a];   // (along,perp)→(x,y)
    const topByPos = [];   // per position: list of top-chord nodes (for purlins)
    const botByPos = [];
    for (const p of Tt) {
      const B = [], T = [];
      for (let i = 0; i <= nT; i++) {
        const [bx, by] = XY(along(i), p); B[i] = getNode(bx, by, zT);
        const [tx, ty] = XY(along(i), p); T[i] = getNode(tx, ty, zT + zRoof(along(i)));
      }
      for (let i = 0; i < nT; i++) addEl(B[i], B[i + 1], secCordT.id);                 // bottom chord
      for (let i = 0; i < nT; i++) {                                                    // top chord + load
        const eid = addEl(T[i], T[i + 1], secCordT.id);
        const da = along(i + 1) - along(i);
        const Lsl = Math.hypot(da, zRoof(along(i + 1)) - zRoof(along(i))) || da;
        if (eid != null) roofTop.push({ elemId: eid, dx: da, Lsl });
      }
      weaveTrussWeb(B, T, nT, techoCel, addEl, secDiagT.id);          // Warren/Pratt/Howe web
      if (techoCel === 'warren') addEl(B[nT / 2], T[nT / 2], secDiagT.id);   // king post
      topByPos.push(T); botByPos.push(B);
    }
    // purlins: tie consecutive trusses at each chord node → out-of-plane stability
    for (let s = 0; s + 1 < Tt.length; s++)
      for (let i = 0; i <= nT; i++) {
        addEl(topByPos[s][i], topByPos[s + 1][i], secDiagT.id);
        addEl(botByPos[s][i], botByPos[s + 1][i], secDiagT.id);
      }
  }

  // ── Loads: CM (self-weight + extra) and CV (use) on joists ──
  const cargas = spec.loads || {};
  let qCMadic = cargas.dead_extra_kN_m2;
  if (qCMadic == null) { qCMadic = 0.3; addWarning('estimated', 'Floor additional dead load not given: used 0.3 kN/m² (finishes + ceiling).'); }
  let qCVfloor = cargas.live_load_kN_m2;
  if (qCVfloor == null) { qCVfloor = 2.0; addWarning('estimated', 'Use live load not given: used 2.0 kN/m² (residential, NCh1537).'); }
  const qRoof = 1.0;
  if (!techoCercha && nNiv >= 1) addWarning('info', `Roof (level ${nNiv}) modeled as a flat joist platform with live load ${qRoof} kN/m². For a truss roof specify roof:{type:'truss'}.`);
  if (techoCercha) addWarning('info', `Gabled Warren truss roof (${Tt.length} trusses @${sepT} m, span ${spanT} m, slope ${(((techo.slope_pct >= 0 ? techo.slope_pct : 10)))}%) integrated over the walls.`);
  // flat joists: floor (k<nNiv) uses qCVfloor; if the roof is flat, the last level uses qRoof
  const cvAt = (k) => (k < nNiv ? qCVfloor : qRoof);

  const lcCM = { id: 1, name: 'CM', loads: [], selfWeight: true, type: 'static', specDir: null };
  const lcCV = { id: 2, name: 'CV', loads: [], selfWeight: false, type: 'static', specDir: null };
  for (const j of joists) {
    if (j.elemId == null || !(j.L > 0) || !(j.trib > 0)) continue;
    if (qCMadic > 0) lcCM.loads.push({ type: 'dist', elemId: j.elemId, dir: 'gravity', w: +(qCMadic * j.trib).toFixed(6) });
    const cv = cvAt(j.k);
    if (cv > 0) lcCV.loads.push({ type: 'dist', elemId: j.elemId, dir: 'gravity', w: +(cv * j.trib).toFixed(6) });
  }
  // trussed roof: load on top chords by tributary width (sepT)
  for (const r of roofTop) {
    if (r.elemId == null) continue;
    if (qCMadic > 0) lcCM.loads.push({ type: 'dist', elemId: r.elemId, dir: 'gravity', w: +(qCMadic * sepT * r.dx / r.Lsl).toFixed(6) });
    lcCV.loads.push({ type: 'dist', elemId: r.elemId, dir: 'gravity', w: +(qRoof * sepT * r.dx / r.Lsl).toFixed(6) });
  }
  const loadCases = [lcCM, lcCV];

  // ── Combinations (gravity NCh3171) ──
  const combinations = [
    { id: 1, name: '1.4CM', factors: [{ lcId: 1, factor: 1.4 }] },
    { id: 2, name: '1.2CM+1.6CV', factors: [{ lcId: 1, factor: 1.2 }, { lcId: 2, factor: 1.6 }] },
  ];

  const sections = [secStud, secJoist];
  if (secCordT) sections.push(secCordT);
  if (secDiagT) sections.push(secDiagT);
  return {
    version: '1.0',
    units: 'kN-m',
    mode: '3D',
    nodes, elements,
    materials: [mat],
    sections,
    diaphragms: [],
    loadCases, combinations,
    grids: { x: Px, y: Py, z: zNivel },
    _counters: { nodes: nodes.length, elements: elements.length, materials: 1, sections: sections.length, diaphragms: 0, loadCases: 2, combinations: 2 },
    _generado: {
      por: 'assistant/generator.js (framing)',
      reglas: (libs.reglas && libs.reglas._meta) ? libs.reglas._meta.version : undefined,
      resumen: `framing ${esAcero ? 'steel' : 'timber'} (${mat.name}): ${nodes.length} nodes, ${elements.length} elements, ${joists.length} joists${techoCercha ? `, ${Tt.length} cerchas` : ''}`,
    },
    _warnings: warnings,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// GABLE WARREN TRUSS typology (triangulated roof lattice)
//   Representative planar truss (X–Z plane, 2D mode), loaded by its tributary width
//   (spacing between trusses). Horizontal bottom chord; gable top chord (ridge at
//   the center); Warren web (zigzag diagonals, one per panel, alternating) + king
//   post at the ridge. Resilient.
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Parametric TRANSMISSION TOWER generator (3D spatial lattice) — #53.
 * 4 tapered legs (base→top) over n panels, horizontal rings, X-diagonals per face,
 * cross-arms (cantilevers) for the conductors, base supports and self-weight /
 * wind / cable+ice loads.
 * spec.tower = { altura_m, base_m, cima_m, panels, bracing:'X'|'K',
 *   perfil_montante, perfil_diagonal, rotulado, crossarms:[{z_m, largo_m, carga_vertical_kN, carga_transversal_kN}] }
 */
export function generateTower(spec, libs) {
  const warnings = []; const addWarning = (tipo, msg) => warnings.push({ tipo, msg });
  const T = spec.tower || {};
  const materiales = libs.materiales || [], perfiles = libs.perfiles || [];

  const matRow = resolveFlexMaterial(T.material || (spec.sections || {}).material || 'acero', materiales, addWarning);
  const mat = matRow || { name: 'Acero S275', E: 2.0e8, G: 7.7e7, nu: 0.3, rho: 7.85 }; mat.id = 1;
  const secMont = pickSection(T.chord_profile, perfiles, { b_cm: 12, h_cm: 12 }, 'Tower leg/chord', addWarning); secMont.id = 1;
  const secDiag = pickSection(T.diagonal_profile, perfiles, { b_cm: 8, h_cm: 8 }, 'Tower diagonal', addWarning); secDiag.id = 2;

  const H = T.height_m > 0 ? T.height_m : 30; if (!(T.height_m > 0)) addWarning('replacement', 'Height not given: 30 m.');
  const Bw = T.base_m > 0 ? T.base_m : 6;     if (!(T.base_m > 0)) addWarning('replacement', 'Base width not given: 6 m.');
  const Tw = T.top_m >= 0 ? T.top_m : 1.5;
  const n = Math.max(2, Math.round(T.panels || 8));
  const rotul = T.rotulado === true;
  if (/k/i.test(String(T.bracing || '')) ) addWarning('info', 'K bracing not yet supported: used X.');

  const nodes = [], elements = []; let nid = 0, eid = 0;
  const rk = v => Math.round(v * 1e5) / 1e5;
  const node = (x, y, z, restr) => { const id = ++nid; nodes.push({ id, x: rk(x), y: rk(y), z: rk(z), restraints: restr || { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }, nodeMass: { mx: 0, my: 0, mz: 0 }, springs: { kux: 0, kuy: 0, kuz: 0, krx: 0, kry: 0, krz: 0 } }); return id; };
  const rel = rotul ? [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1] : Array(12).fill(0);
  const addEl = (a, b, secId) => { if (a == null || b == null || a === b) return null; const id = ++eid; elements.push({ id, n1: a, n2: b, matId: 1, secId, releases: [...rel] }); return id; };

  // 4 patas: esquina c en (cx,cy). c: 0=(−,−) 1=(+,−) 2=(+,+) 3=(−,+)
  const cx = [-1, 1, 1, -1], cy = [-1, -1, 1, 1];
  const hwOf = (i) => (Bw + (Tw - Bw) * i / n) / 2;            // half-width at fraction i
  const lvl = [];
  for (let i = 0; i <= n; i++) {
    const z = H * i / n, hw = hwOf(i); lvl[i] = [];
    for (let c = 0; c < 4; c++) {
      const restr = i === 0 ? { ux: 1, uy: 1, uz: 1, rx: rotul ? 0 : 1, ry: rotul ? 0 : 1, rz: rotul ? 0 : 1 } : null;
      lvl[i][c] = node(cx[c] * hw, cy[c] * hw, z, restr);
    }
  }
  for (let c = 0; c < 4; c++) addEl(lvl[0][c], lvl[0][(c + 1) % 4], secMont.id);   // base ring
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 4; c++) addEl(lvl[i][c], lvl[i + 1][c], secMont.id);          // legs
    for (let c = 0; c < 4; c++) addEl(lvl[i + 1][c], lvl[i + 1][(c + 1) % 4], secMont.id);  // upper ring
    for (let c = 0; c < 4; c++) {                                                     // X on each face
      addEl(lvl[i][c], lvl[i + 1][(c + 1) % 4], secDiag.id);
      addEl(lvl[i][(c + 1) % 4], lvl[i + 1][c], secDiag.id);
    }
  }

  // ── Cross-arms (cantilevers) for the conductors, at ±X ──
  const lcCM = { id: 1, name: 'CM (PP)', loads: [], selfWeight: true, type: 'static', specDir: null };
  const lcVi = { id: 2, name: 'Viento', loads: [], selfWeight: false, type: 'static', specDir: null };
  const lcCa = { id: 3, name: 'Cables', loads: [], selfWeight: false, type: 'static', specDir: null };
  const armTips = [];
  for (const cr of (T.crossarms || [])) {
    const zc = cr.z_m, largo = cr.length_m > 0 ? cr.length_m : Bw;
    if (!(zc > 0)) continue;
    const i = Math.max(0, Math.min(n, Math.round(zc / (H / n))));   // nearest level
    const hw = hwOf(i), z = H * i / n;
    for (const sgn of [-1, +1]) {                                   // arm at −X and +X
      const tip = node(sgn * (hw + largo), 0, z);
      const cTop = sgn < 0 ? [3, 0] : [2, 1];    // corners on that side: −X={3,0}, +X={2,1}
      addEl(tip, lvl[i][cTop[0]], secDiag.id);
      addEl(tip, lvl[i][cTop[1]], secDiag.id);
      if (i > 0) { addEl(tip, lvl[i - 1][cTop[0]], secDiag.id); addEl(tip, lvl[i - 1][cTop[1]], secDiag.id); }  // foot tie
      armTips.push(tip);
      const Pv = cr.vertical_load_kN > 0 ? cr.vertical_load_kN : 10;   // conductor + ice
      const Pt = cr.transverse_load_kN > 0 ? cr.transverse_load_kN : 5; // wind on the cable
      lcCa.loads.push({ type: 'nodal', nodeId: tip, F: [Pt, 0, -Pv, 0, 0, 0] });
    }
  }

  // ── Wind on the structure: lateral +X load distributed over the leg nodes ──
  const q = spec.loads?.viento_kPa > 0 ? spec.loads.viento_kPa : 0.5;
  for (let i = 1; i <= n; i++) {
    const hw = hwOf(i), area = (2 * hw) * (H / n);    // tributary projected area of the panel
    const fNode = q * area / 4;                        // to the 4 nodes of the level
    for (let c = 0; c < 4; c++) lcVi.loads.push({ type: 'nodal', nodeId: lvl[i][c], F: [fNode, 0, 0, 0, 0, 0] });
  }
  if (!(spec.loads?.viento_kPa > 0)) addWarning('estimated', 'Wind pressure not given: 0.5 kPa.');

  const combinations = [
    { id: 1, name: '1.2 CM + 1.6 Viento', factors: [{ caseId: 1, factor: 1.2 }, { caseId: 2, factor: 1.6 }, { caseId: 3, factor: 1.2 }] },
    { id: 2, name: 'CM + Viento + Cables (servicio)', factors: [{ caseId: 1, factor: 1 }, { caseId: 2, factor: 1 }, { caseId: 3, factor: 1 }] },
  ];
  addWarning('info', `Torre 3D: ${nodes.length} nodes · ${elements.length} bars · ${n} panels · base ${Bw} m → top ${Tw} m · ${H} m tall${(T.crossarms || []).length ? ` · ${(T.crossarms || []).length} crossarms` : ''}. ${rotul ? 'Pinned (truss).' : 'Rigid joints.'}`);

  return {
    version: '1.0', units: 'kN-m', mode: '3D',
    nodes, elements,
    materials: [{ id: 1, name: mat.name, E: mat.E, G: mat.G, nu: mat.nu, rho: mat.rho, alpha: mat.alpha ?? 1.2e-5 }],
    sections: [secMont, secDiag],
    diaphragms: [], loadCases: [lcCM, lcVi, lcCa], combinations,
    _generado: {
      por: 'assistant/generator.js (transmission tower)',
      reglas: libs.reglas?._meta?.version,
      resumen: `tower ${H} m, base ${Bw}→cima ${Tw} m, ${n} panels, ${(T.crossarms || []).length} crossarms: ${nodes.length} nodes, ${elements.length} bars`,
    },
    _warnings: warnings,
  };
}

export function generateTruss(spec, libs) {
  // If requested in 3D, generate a SPACE WARREN GIRDER (two braced parallel trusses)
  // — stable in 3D and analyzable with discretization, unlike a planar truss embedded
  // in 3D (which is ill-conditioned out of plane).
  if (/3\s*d/i.test(String(spec.mode || ''))) return generateSpaceTruss(spec, libs);

  const materiales = libs.materiales || [];
  const matPorNombre = new Map(materiales.map((m) => [String(m.nombre).trim(), m]));
  const warnings = [];
  const addWarning = (tipo, msg) => warnings.push({ tipo, msg });

  const pickMat = (n) => {
    const r = resolveFlexMaterial(n, materiales, addWarning);
    if (r) return r;
    const def = matPorNombre.get('Pino Radiata');
    addWarning('replacement', `Material ${n == null ? '(not given)' : `"${n}"`}: used Radiata Pine by default (truss). For a steel truss specify material 'acero' or 'S275'.`);
    return def ? rowToMaterial(def) : { name: 'Pino Radiata', E: 1.0e7, G: 6.25e5, nu: 0.3, rho: 0.45 };
  };
  const mat = pickMat((spec.sections || {}).material); mat.id = 1;

  const c = spec.truss || {};
  const perfilPorNombre = new Map((libs.perfiles || []).map((p) => [String(p.nombre).trim().toLowerCase(), p]));
  const pickSec = (spec, label, defKey) => {
    const r = sizeToSection(spec, label);
    if (r) { if (spec) addWarning('info', `${label}: ${r.etiqueta}.`); return r.sec; }
    // steel truss: profile of the catalogue (e.g. Gerdau 'W 150 x 13,0'), as pickSection does for the other typologies
    const pf = typeof spec === 'string' ? perfilPorNombre.get(spec.trim().toLowerCase()) : null;
    if (pf) { addWarning('info', `${label}: profile ${pf.nombre}.`); return profileToSection(pf, pf.nombre); }
    addWarning('replacement', `${label}: size ${spec == null ? '(not given)' : `"${spec}"`} not recognized: used ${defKey}" by default.`);
    return sizeToSection(defKey, label).sec;
  };
  const secCord = pickSec(c.chord_size, 'Chord', '2x6'); secCord.id = 1;
  const secDiag = pickSec(c.diagonal_size, 'Diagonal', '2x4'); secDiag.id = 2;

  // ── Gable geometry ──
  let L = c.span_m > 0 ? c.span_m : 6; if (!(c.span_m > 0)) addWarning('replacement', 'No span given: used 6 m.');
  let n = Math.max(2, Math.round(c.n_panels || 8)); if (n % 2) { n += 1; addWarning('info', `n_panels adjusted to ${n} (even) so the ridge lands on a node.`); }
  const usaAltura = c.ridge_height_m > 0;
  const slope = (c.slope_pct >= 0 ? c.slope_pct : 10) / 100;
  const hR = usaAltura ? c.ridge_height_m : slope * (L / 2);
  if (!usaAltura && c.slope_pct == null) addWarning('replacement', 'No slope given: used 10%.');
  const sep = c.spacing_m > 0 ? c.spacing_m : 0.6;
  const Bx = (i) => +(i * L / n).toFixed(5);
  const roofZ = (x) => +(x <= L / 2 ? (2 * hR / L) * x : (2 * hR / L) * (L - x)).toFixed(5);

  const nodes = [], elements = []; let nid = 0, eid = 0;
  const nodeAt = new Map(), elemAt = new Set();
  const rk = (v) => Math.round(v * 1e5) / 1e5;
  const node = (x, z, restr) => {
    const k = `${rk(x)}|${rk(z)}`;
    let id = nodeAt.get(k);
    if (id == null) {
      id = ++nid; nodeAt.set(k, id);
      nodes.push({ id, x: rk(x), y: 0, z: rk(z), restraints: restr || { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }, nodeMass: { mx: 0, my: 0, mz: 0 }, springs: { kux: 0, kuy: 0, kuz: 0, krx: 0, kry: 0, krz: 0 } });
    } else if (restr) Object.assign(nodes[id - 1].restraints, restr);
    return id;
  };
  const addEl = (n1, n2, secId) => {
    if (n1 == null || n2 == null || n1 === n2) return null;
    const ek = `${Math.min(n1, n2)}-${Math.max(n1, n2)}`;
    if (elemAt.has(ek)) return null; elemAt.add(ek);
    const id = ++eid; elements.push({ id, n1, n2, matId: 1, secId, releases: Array(12).fill(0) }); return id;
  };

  // supports (2D X–Z plane: active DOF ux, uz, ry). Pin at x=0, roller at x=L.
  const empot = /empotr|fix/.test(String(spec.base_support || '').toLowerCase());
  const B = [], T = [];
  for (let i = 0; i <= n; i++) {
    const x = Bx(i);
    let restr = null;
    if (i === 0) restr = empot ? { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 } : { ux: 1, uy: 1, uz: 1, rx: 0, ry: 0, rz: 0 };
    else if (i === n) restr = empot ? { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 } : { ux: 0, uy: 1, uz: 1, rx: 0, ry: 0, rz: 0 };
    B[i] = node(x, 0, restr);
    T[i] = node(x, roofZ(x));   // at i=0 and i=n, roofZ=0 → same node as B (eave)
  }
  for (let i = 0; i < n; i++) addEl(B[i], B[i + 1], secCord.id);     // bottom chord
  const topEls = [];
  for (let i = 0; i < n; i++) topEls[i] = addEl(T[i], T[i + 1], secCord.id);  // top chord (gable)
  const tCel = /pratt/i.test(String(c.truss_type || '')) ? 'pratt' : (/howe/i.test(String(c.truss_type || '')) ? 'howe' : 'warren');
  weaveTrussWeb(B, T, n, tCel, addEl, secDiag.id);                 // Warren/Pratt/Howe web
  if (tCel === 'warren') addEl(B[n / 2], T[n / 2], secDiag.id);      // king post

  // ── Roof loads on the top chord (by tributary width) ──
  // w = q·sep·dx / L_sloped  → preserves the vertical resultant (Σ = q·sep·L).
  const cargas = spec.loads || {};
  let qCM = cargas.dead_extra_kN_m2; if (qCM == null) { qCM = 0.3; addWarning('estimated', 'Roofing weight not given: used 0.3 kN/m².'); }
  let qCV = cargas.live_load_kN_m2; if (qCV == null) { qCV = 1.0; addWarning('estimated', 'Roof live/snow load not given: used 1.0 kN/m².'); }
  const lcCM = { id: 1, name: 'CM', loads: [], selfWeight: true, type: 'static', specDir: null };
  const lcCV = { id: 2, name: 'CV', loads: [], selfWeight: false, type: 'static', specDir: null };
  for (let i = 0; i < n; i++) {
    const xa = Bx(i), xb = Bx(i + 1), dx = xb - xa;
    const Lsl = Math.hypot(xb - xa, roofZ(xb) - roofZ(xa)) || dx;
    if (qCM > 0) lcCM.loads.push({ type: 'dist', elemId: topEls[i], dir: 'gravity', w: +(qCM * sep * dx / Lsl).toFixed(6) });
    if (qCV > 0) lcCV.loads.push({ type: 'dist', elemId: topEls[i], dir: 'gravity', w: +(qCV * sep * dx / Lsl).toFixed(6) });
  }
  const loadCases = [lcCM, lcCV];
  const combinations = [
    { id: 1, name: '1.4CM', factors: [{ lcId: 1, factor: 1.4 }] },
    { id: 2, name: '1.2CM+1.6CV', factors: [{ lcId: 1, factor: 1.2 }, { lcId: 2, factor: 1.6 }] },
  ];

  return {
    version: '1.0', units: 'kN-m', mode: '2D',
    nodes, elements,
    materials: [mat], sections: [secCord, secDiag], diaphragms: [],
    loadCases, combinations,
    grids: { x: B.map((_, i) => Bx(i)), y: [0], z: [0, hR] },
    _counters: { nodes: nodes.length, elements: elements.length, materials: 1, sections: 2, diaphragms: 0, loadCases: 2, combinations: 2 },
    _generado: {
      por: 'assistant/generator.js (Warren truss)',
      reglas: (libs.reglas && libs.reglas._meta) ? libs.reglas._meta.version : undefined,
      resumen: `truss ${tCel} ${L} m, slope ${(slope * 100).toFixed(0)}%, ridge ${hR.toFixed(2)} m, ${nodes.length} nodes, ${elements.length} bars`,
    },
    _warnings: warnings,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// SPACE WARREN GIRDER (3D truss): two parallel planar trusses (gable) separated by
// `ancho_m`, joined by transverse chords (top/bottom) and horizontal bracing in the
// bottom plane. Stable in 3D without tricks → analyzable even when auto-discretized.
// Supports at the 4 base corners (pin at x=0, roller at x=L).
// ──────────────────────────────────────────────────────────────────────────────
export function generateSpaceTruss(spec, libs) {
  const materiales = libs.materiales || [];
  const matPorNombre = new Map(materiales.map((m) => [String(m.nombre).trim(), m]));
  const warnings = [];
  const addWarning = (tipo, msg) => warnings.push({ tipo, msg });

  const pickMat = (n) => {
    const r = resolveFlexMaterial(n, materiales, addWarning);
    if (r) return r;
    const def = matPorNombre.get('Pino Radiata');
    addWarning('replacement', `Material ${n == null ? '(not given)' : `"${n}"`}: used Radiata Pine by default (3D Warren girder).`);
    return def ? rowToMaterial(def) : { name: 'Pino Radiata', E: 1.0e7, G: 6.25e5, nu: 0.3, rho: 0.45 };
  };
  const mat = pickMat((spec.sections || {}).material); mat.id = 1;

  const c = spec.truss || {};
  const perfilPorNombre = new Map((libs.perfiles || []).map((p) => [String(p.nombre).trim().toLowerCase(), p]));
  const pickSec = (spec, label, defKey) => {
    const r = sizeToSection(spec, label);
    if (r) { if (spec) addWarning('info', `${label}: ${r.etiqueta}.`); return r.sec; }
    // steel truss: profile of the catalogue (e.g. Gerdau 'W 150 x 13,0'), as pickSection does for the other typologies
    const pf = typeof spec === 'string' ? perfilPorNombre.get(spec.trim().toLowerCase()) : null;
    if (pf) { addWarning('info', `${label}: profile ${pf.nombre}.`); return profileToSection(pf, pf.nombre); }
    addWarning('replacement', `${label}: size ${spec == null ? '(not given)' : `"${spec}"`} not recognized: used ${defKey}" by default.`);
    return sizeToSection(defKey, label).sec;
  };
  const secCord = pickSec(c.chord_size, 'Chord', '2x6'); secCord.id = 1;
  const secDiag = pickSec(c.diagonal_size, 'Diagonal', '2x4'); secDiag.id = 2;
  const secTra = pickSec(c.transverse_section, 'Transversal/arriostre', '2x4'); secTra.id = 3;

  // ── Geometry ──
  let L = c.span_m > 0 ? c.span_m : 6; if (!(c.span_m > 0)) addWarning('replacement', 'No span given: used 6 m.');
  let n = Math.max(2, Math.round(c.n_panels || 8)); if (n % 2) { n += 1; addWarning('info', `n_panels adjusted to ${n} (even).`); }
  const usaAltura = c.ridge_height_m > 0;
  const slope = (c.slope_pct >= 0 ? c.slope_pct : 10) / 100;
  const hR = usaAltura ? c.ridge_height_m : slope * (L / 2);
  if (!usaAltura && c.slope_pct == null) addWarning('replacement', 'No slope given: used 10%.');
  const sep = c.spacing_m > 0 ? c.spacing_m : 0.6;
  const ancho = c.width_m > 0 ? c.width_m : Math.max(1, +(L / 10).toFixed(2));
  if (!(c.width_m > 0)) addWarning('estimated', `Spacing between trusses not given: used ${ancho} m (span/10).`);
  const Bx = (i) => +(i * L / n).toFixed(5);
  const roofZ = (x) => +(x <= L / 2 ? (2 * hR / L) * x : (2 * hR / L) * (L - x)).toFixed(5);

  const nodes = [], elements = []; let nid = 0, eid = 0;
  const nodeAt = new Map(), elemAt = new Set();
  const rk = (v) => Math.round(v * 1e5) / 1e5;
  const node = (x, y, z, restr) => {
    const k = `${rk(x)}|${rk(y)}|${rk(z)}`;
    let id = nodeAt.get(k);
    if (id == null) {
      id = ++nid; nodeAt.set(k, id);
      nodes.push({ id, x: rk(x), y: rk(y), z: rk(z), restraints: restr || { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }, nodeMass: { mx: 0, my: 0, mz: 0 }, springs: { kux: 0, kuy: 0, kuz: 0, krx: 0, kry: 0, krz: 0 } });
    } else if (restr) Object.assign(nodes[id - 1].restraints, restr);
    return id;
  };
  const addEl = (n1, n2, secId) => {
    if (n1 == null || n2 == null || n1 === n2) return null;
    const ek = `${Math.min(n1, n2)}-${Math.max(n1, n2)}`;
    if (elemAt.has(ek)) return null; elemAt.add(ek);
    const id = ++eid; elements.push({ id, n1, n2, matId: 1, secId, releases: Array(12).fill(0) }); return id;
  };

  const empot = /empotr|fix/.test(String(spec.base_support || '').toLowerCase());
  const tCel = /pratt/i.test(String(c.truss_type || '')) ? 'pratt' : (/howe/i.test(String(c.truss_type || '')) ? 'howe' : 'warren');
  const planes = [0, ancho];
  const Bp = [[], []], Tp = [[], []];   // [plane][i] → node
  const topEls = [[], []];

  planes.forEach((y, p) => {
    for (let i = 0; i <= n; i++) {
      const x = Bx(i);
      let restr = null;
      if (i === 0) restr = empot ? { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 } : { ux: 1, uy: 1, uz: 1 };
      else if (i === n) restr = empot ? { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 } : { ux: 0, uy: 1, uz: 1 };
      Bp[p][i] = node(x, y, 0, restr);
      Tp[p][i] = node(x, y, roofZ(x));
    }
    for (let i = 0; i < n; i++) addEl(Bp[p][i], Bp[p][i + 1], secCord.id);                 // bottom chord
    for (let i = 0; i < n; i++) topEls[p][i] = addEl(Tp[p][i], Tp[p][i + 1], secCord.id);  // top chord
    weaveTrussWeb(Bp[p], Tp[p], n, tCel, addEl, secDiag.id);                              // web of each plane
    if (tCel === 'warren') addEl(Bp[p][n / 2], Tp[p][n / 2], secDiag.id);                   // king post
  });

  // Transverse chords (join the two planes) + bottom horizontal bracing
  for (let i = 0; i <= n; i++) {
    addEl(Bp[0][i], Bp[1][i], secTra.id);   // bottom transverse
    addEl(Tp[0][i], Tp[1][i], secTra.id);   // top transverse
  }
  for (let i = 0; i < n; i++) {             // crosses in the bottom plane (lateral stability)
    if (i % 2 === 0) addEl(Bp[0][i], Bp[1][i + 1], secTra.id);
    else addEl(Bp[1][i], Bp[0][i + 1], secTra.id);
  }

  // ── Roof loads on both top chords (tributary width sep) ──
  const cargas = spec.loads || {};
  let qCM = cargas.dead_extra_kN_m2; if (qCM == null) { qCM = 0.3; addWarning('estimated', 'Roofing weight not given: used 0.3 kN/m².'); }
  let qCV = cargas.live_load_kN_m2; if (qCV == null) { qCV = 1.0; addWarning('estimated', 'Roof live/snow load not given: used 1.0 kN/m².'); }
  const lcCM = { id: 1, name: 'CM', loads: [], selfWeight: true, type: 'static', specDir: null };
  const lcCV = { id: 2, name: 'CV', loads: [], selfWeight: false, type: 'static', specDir: null };
  planes.forEach((y, p) => {
    for (let i = 0; i < n; i++) {
      const xa = Bx(i), xb = Bx(i + 1), dx = xb - xa;
      const Lsl = Math.hypot(xb - xa, roofZ(xb) - roofZ(xa)) || dx;
      if (qCM > 0) lcCM.loads.push({ type: 'dist', elemId: topEls[p][i], dir: 'gravity', w: +(qCM * sep * dx / Lsl).toFixed(6) });
      if (qCV > 0) lcCV.loads.push({ type: 'dist', elemId: topEls[p][i], dir: 'gravity', w: +(qCV * sep * dx / Lsl).toFixed(6) });
    }
  });
  const loadCases = [lcCM, lcCV];
  const combinations = [
    { id: 1, name: '1.4CM', factors: [{ lcId: 1, factor: 1.4 }] },
    { id: 2, name: '1.2CM+1.6CV', factors: [{ lcId: 1, factor: 1.2 }, { lcId: 2, factor: 1.6 }] },
  ];

  return {
    version: '1.0', units: 'kN-m', mode: '3D',
    nodes, elements,
    materials: [mat], sections: [secCord, secDiag, secTra], diaphragms: [],
    loadCases, combinations,
    grids: { x: Bp[0].map((_, i) => Bx(i)), y: [0, ancho], z: [0, hR] },
    _counters: { nodes: nodes.length, elements: elements.length, materials: 1, sections: 3, diaphragms: 0, loadCases: 2, combinations: 2 },
    _generado: {
      por: 'assistant/generator.js (3D Warren girder)',
      reglas: (libs.reglas && libs.reglas._meta) ? libs.reglas._meta.version : undefined,
      resumen: `girder ${tCel} 3D ${L}×${ancho} m, slope ${(slope * 100).toFixed(0)}%, ${nodes.length} nodes, ${elements.length} bars`,
    },
    _warnings: warnings,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// BRIDGE typology — ARCH and CABLE forms (lessons from the examples/verifications)
//   type: 'arch' (deck-top arch with spandrel posts, Salginatobel style) ·
//         'tied_arch'/'bowstring' (tie = deck, vertical hangers) ·
//         'network' (tied arch with CROSSED inclined hangers) ·
//         'cable_stayed'/'cable_stayed' (pylon + fan stays, asymmetric) ·
//         'suspension'/'suspension' (parabolic SAGGING cable + hangers + towers).
//   Learned rules (so the model SOLVES well):
//     · Supports: one end pinned (fixes X) and the other roller → no lateral deck
//       mechanism; arch springings pinned; pylon/tower base fixed.
//     · Suspension cable = parabola with MINIMUM at the center (sags), not a hump.
//     · Network = inclined hangers that cross (offset ±off).
//     · Hangers/cables are modeled with some bending stiffness (surrogate I) so the
//       LINEAR ANALYSIS is stable; the real cable takes its stiffness from the
//       tension → for accuracy, geometric/nonlinear analysis (Kg/NL-lite). Warned.
//     · No orphan nodes (getNode dedups by coordinate; the arch springings reuse the
//       deck nodes).
// ──────────────────────────────────────────────────────────────────────────────
const PUENTE_ARCO_TIPOS = /arco|arch|atirant|bowstring|network|colg|cable|suspen/i;
export function generateArchBridge(spec, libs) {
  const materiales = libs.materiales || [], perfiles = libs.perfiles || [];
  const warnings = []; const addWarning = (t, m) => warnings.push({ type: t, msg: m });
  const sec = spec.sections || {}, p = spec.bridge || {};
  const matByName = new Map(materiales.map((m) => [String(m.nombre).trim().toLowerCase(), m]));
  const pickMat = (n) => { const r = resolveFlexMaterial(n, materiales, addWarning); if (r) return r; const d = matByName.get('s275'); return d ? rowToMaterial(d) : { name: 'S275', E: 2.1e8, G: 8.08e7, nu: 0.3, rho: 7.85 }; };
  const mat = pickMat(sec.material); mat.id = 1;

  const tipo = String(p.type || '').toLowerCase();
  const esColg = /colg|suspen/.test(tipo), esStay = /atirant|cable.?stay/.test(tipo) && !/arco|arch/.test(tipo);
  const esNet = /network/.test(tipo), esBow = /bowstring|arco.?atirant|tied.?arch/.test(tipo) || esNet;
  const esArco = !esColg && !esStay && !esBow;   // deck-top arch by default

  const L = p.length_m > 0 ? p.length_m : 80; if (!(p.length_m > 0)) addWarning('replacement', 'Length not given: 80 m.');
  const W = p.width_m > 0 ? p.width_m : 8;
  const f = p.rise_m > 0 ? p.rise_m : (esColg ? +(L * 0.10).toFixed(2) : +(L / 6).toFixed(2));   // rise/sag
  const Hp = p.pylon_height_m || p.tower_height_m || (esStay ? +(L * 0.25).toFixed(2) : (esColg ? +(L * 0.12).toFixed(2) : f));
  const nseg = Math.max(6, Math.round(p.n_hangers || p.panels_per_span || Math.round(L / 8)));

  // sections
  const sArco = pickSection(p.arch_section ?? p.pylon_section ?? sec.arco, perfiles, { b_cm: 50, h_cm: 90 }, 'Arch/pylon/tower', addWarning); sArco.id = 2;
  const sDeck = pickSection(p.girder_section ?? sec.beams, perfiles, { b_cm: 50, h_cm: 70 }, 'Deck/tie', addWarning); sDeck.id = 3;
  // cable/hanger with surrogate I (linear-analysis stability)
  const sCable = { id: 4, name: 'Cable/hanger', A: 0.02, Iy: 0.02, Iz: 0.02, J: 1e-3, Avy: 0.01, Avz: 0.01, kappay: 0.9, kappaz: 0.9 };
  addWarning('nota', 'Cables/hangers modeled with bending stiffness for a stable LINEAR analysis; for accuracy use the geometric/nonlinear analysis (buckling/Kg or NL-lite).');

  const nodes = [], elements = []; let nid = 0, eid = 0; const nodeAt = new Map(), elemAt = new Set();
  const rk = (v) => Math.round(v * 1e5) / 1e5;
  const getNode = (x, z, restr) => { const k = `${rk(x)}|${rk(z)}`; let id = nodeAt.get(k); if (id == null) { id = ++nid; nodeAt.set(k, id); nodes.push({ id, x: rk(x), y: 0, z: rk(z), restraints: restr || { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }, nodeMass: { mx: 0, my: 0, mz: 0 }, springs: { kux: 0, kuy: 0, kuz: 0, krx: 0, kry: 0, krz: 0 } }); } else if (restr) Object.assign(nodes[id - 1].restraints, restr); return id; };
  const addEl = (n1, n2, s) => { if (n1 == null || n2 == null || n1 === n2) return null; const ek = `${Math.min(n1, n2)}-${Math.max(n1, n2)}`; if (elemAt.has(ek)) return null; elemAt.add(ek); const id = ++eid; elements.push({ id, n1, n2, matId: 1, secId: s, releases: Array(12).fill(0) }); return id; };
  const PIN = { ux: 1, uz: 1 }, ROLL = { uz: 1 }, FIX = { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };
  const dx = L / nseg;
  const X = []; for (let i = 0; i <= nseg; i++) X.push(+(i * dx).toFixed(4));
  const deckEls = [], topEls = [];

  // Deck (z=0), pinned at the left end, roller at the right → no mechanism
  const deck = X.map((x, i) => getNode(x, 0, i === 0 ? PIN : i === nseg ? ROLL : {}));
  for (let i = 0; i < nseg; i++) deckEls.push(addEl(deck[i], deck[i + 1], sDeck.id));

  if (esArco) {
    // Deck-top arch (spandrel posts from the arch to the deck). Pinned springings.
    const zA = (x) => f * (1 - ((x - L / 2) / (L / 2)) ** 2);   // parabola
    // arch BELOW the deck (straight deck on top, arch under it): negative z;
    // springings at the deck ends (reuses those nodes → no orphans)
    const archN = X.map((x, i) => (i === 0 || i === nseg) ? deck[i] : getNode(x, -zA(x)));
    for (let i = 0; i < nseg; i++) topEls.push(addEl(archN[i], archN[i + 1], sArco.id));
    for (let i = 1; i < nseg; i++) addEl(deck[i], archN[i], sCable.id);   // spandrel posts
    addWarning('nota', 'Deck-top arch: the arch works in compression and the posts transfer the deck to the arch.');
  } else if (esBow) {
    // Bowstring / network: arch OVER the deck (tie), vertical or crossed hangers
    const zA = (x) => f * (1 - ((x - L / 2) / (L / 2)) ** 2);
    const arch = X.map((x, i) => (i === 0 || i === nseg) ? deck[i] : getNode(x, zA(x)));
    for (let i = 0; i < nseg; i++) addEl(arch[i], arch[i + 1], sArco.id);
    if (esNet) { const off = Math.max(2, Math.round(nseg / 6)); for (let i = 1; i < nseg; i++) for (const t of [i - off, i + off]) if (t >= 1 && t <= nseg - 1) addEl(arch[i], deck[t], sCable.id); }
    else for (let i = 1; i < nseg; i++) addEl(arch[i], deck[i], sCable.id);   // vertical hangers
    topEls.push(...deckEls);
    addWarning('nota', `${esNet ? 'Network: CROSSED inclined hangers' : 'Bowstring: vertical hangers'}; the deck acts as a tie (takes the arch thrust) → vertical supports only.`);
  } else if (esStay) {
    // Cable-stayed: central pylon, fan stays on both sides
    const xc = +(L / 2).toFixed(4); const ip = Math.round(nseg / 2);
    const base = deck[ip]; nodes[base - 1].restraints = { ...FIX };   // pylon base fixed (pier)
    const top = getNode(xc, Hp);
    addEl(base, top, sArco.id);
    for (let i = 0; i <= nseg; i++) if (i !== ip && Math.abs(i - ip) > 1) addEl(top, deck[i], sCable.id);
    topEls.push(...deckEls);
    addWarning('nota', 'Cable-stayed: the pylon anchors the stays at its head; they work in tension hanging the deck.');
  } else if (esColg) {
    // Suspension: towers at L/5 and 4L/5, SAGGING cable (parabola with minimum at center), hangers
    const xT1 = +(L * 0.2).toFixed(4), xT2 = +(L * 0.8).toFixed(4), Ht = Hp;
    const t1b = getNode(xT1, 0), t1t = getNode(xT1, Ht), t2b = getNode(xT2, 0), t2t = getNode(xT2, Ht);
    nodes[t1b - 1].restraints = { ...FIX }; nodes[t2b - 1].restraints = { ...FIX };
    addEl(t1b, t1t, sArco.id); addEl(t2b, t2t, sArco.id);
    const a1 = getNode(0, 0, FIX), a2 = getNode(L, 0, FIX);   // anchorages
    const zC = (x) => Ht - f * (1 - ((x - (xT1 + xT2) / 2) / ((xT2 - xT1) / 2)) ** 2);   // SAGGING (min at center)
    const cab = [a1, t1t]; for (const x of X) if (x > xT1 + 1e-6 && x < xT2 - 1e-6) cab.push(getNode(x, zC(x))); cab.push(t2t, a2);
    for (let i = 0; i < cab.length - 1; i++) addEl(cab[i], cab[i + 1], sCable.id);
    for (const x of X) if (x > xT1 + 1e-6 && x < xT2 - 1e-6) { const c = getNode(x, zC(x)), d = getNode(x, 0); addEl(c, d, sCable.id); }
    topEls.push(...deckEls);
    addWarning('nota', 'Suspension: the main cable sags (parabola with minimum at center) and anchors at the ends; the hangers hang the deck.');
  }

  // ── Loads: CM (self-weight) + CV (live load on the deck) ──
  const cg = spec.loads || {};
  let qCM = cg.dead_extra_kN_m2; if (qCM == null) { qCM = 2.0; addWarning('estimated', 'Deck weight not given: 2.0 kN/m².'); }
  let qCV = cg.live_load_kN_m2; if (qCV == null) { qCV = 4.0; addWarning('estimated', 'Bridge live load not given: 4.0 kN/m².'); }
  const lcCM = { id: 1, name: 'CM', loads: [], selfWeight: true, type: 'static', specDir: null };
  const lcCV = { id: 2, name: 'CV', loads: [], selfWeight: false, type: 'static', specDir: null };
  for (const e of (topEls.length ? topEls : deckEls)) { if (e == null) continue; lcCM.loads.push({ type: 'dist', elemId: e, dir: 'gravity', w: +(qCM * W).toFixed(6) }); lcCV.loads.push({ type: 'dist', elemId: e, dir: 'gravity', w: +(qCV * W).toFixed(6) }); }

  return {
    version: '1.0', units: 'kN-m', mode: '2D',
    nodes, elements, materials: [mat], sections: [sArco, sDeck, sCable], diaphragms: [],
    loadCases: [lcCM, lcCV],
    combinations: [{ id: 1, name: '1.4CM', factors: [{ lcId: 1, factor: 1.4 }] }, { id: 2, name: '1.2CM+1.6CV', factors: [{ lcId: 1, factor: 1.2 }, { lcId: 2, factor: 1.6 }] }],
    grids: { x: X, y: [0], z: [0, f] },
    _counters: { nodes: nodes.length, elements: elements.length, materials: 1, sections: 3, diaphragms: 0, loadCases: 2, combinations: 2 },
    _generado: { por: 'assistant/generator.js (arch/cable bridge)', reglas: (libs.reglas && libs.reglas._meta) ? libs.reglas._meta.version : undefined, resumen: `bridge ${tipo || 'arch'} ${L}×${W} m, rise ${f} m, ${nseg} segments: ${nodes.length} nodes, ${elements.length} bars` },
    _warnings: warnings,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// BRIDGE typology (deck on piers; continuous girder or truss girders)
//   Deck of length L × width W at height H on piers (frames) every luz_pila.
//   tipo_viga='beam' → continuous longitudinal girders; 'truss' → truss girders
//   (Warren/Pratt/Howe) of depth below the deck. Deterministic and resilient.
// ──────────────────────────────────────────────────────────────────────────────
export function generateBridge(spec, libs) {
  // Arch/cable forms (arch, bowstring, network, cable-stayed, suspension) → own generator
  if (PUENTE_ARCO_TIPOS.test(String((spec.bridge || {}).type || ''))) return generateArchBridge(spec, libs);
  const materiales = libs.materiales || [], perfiles = libs.perfiles || [];
  const warnings = []; const addWarning = (t, m) => warnings.push({ type: t, msg: m });
  const matByName = new Map(materiales.map((m) => [String(m.nombre).trim().toLowerCase(), m]));
  const pickMat = (n) => {
    const r = resolveFlexMaterial(n, materiales, addWarning); if (r) return r;
    const d = matByName.get('s275'); addWarning('replacement', `Material ${n == null ? '(not given)' : `"${n}"`}: used steel S275 (bridge).`);
    return d ? rowToMaterial(d) : { name: 'S275', E: 2.1e8, G: 8.08e7, nu: 0.3, rho: 7.85 };
  };
  const mat = pickMat((spec.sections || {}).material); mat.id = 1;
  const esMadera = /pino|madera/i.test(mat.name);

  const p = spec.bridge || {};
  let L = p.length_m > 0 ? p.length_m : 30; if (!(p.length_m > 0)) addWarning('replacement', 'Bridge length not given: 30 m.');
  let W = p.width_m > 0 ? p.width_m : 5; if (!(p.width_m > 0)) addWarning('replacement', 'Deck width not given: 5 m.');
  const H = p.pier_height_m > 0 ? p.pier_height_m : 5;
  let luzP = p.pier_span_m > 0 ? p.pier_span_m : (p.n_piers >= 2 ? +(L / (p.n_piers - 1)).toFixed(4) : 10);
  if (luzP > L) luzP = L;
  const esCercha = /cercha|celos|warren|pratt|howe|truss/.test(String(p.girder_type || p.type || ''));
  const tCel = /pratt/i.test(String(p.truss_type || p.girder_type || '')) ? 'pratt' : (/howe/i.test(String(p.truss_type || p.girder_type || '')) ? 'howe' : 'warren');
  const canto = p.depth_m > 0 ? p.depth_m : Math.max(0.8, +(luzP / 8).toFixed(2));

  const nodes = [], elements = []; let nid = 0, eid = 0; const nodeAt = new Map(), elemAt = new Set();
  const rk = (v) => Math.round(v * 1e5) / 1e5;
  const getNode = (x, y, z, restr) => {
    const k = `${rk(x)}|${rk(y)}|${rk(z)}`; let id = nodeAt.get(k);
    if (id == null) { id = ++nid; nodeAt.set(k, id); nodes.push({ id, x: rk(x), y: rk(y), z: rk(z), restraints: restr || { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }, nodeMass: { mx: 0, my: 0, mz: 0 }, springs: { kux: 0, kuy: 0, kuz: 0, krx: 0, kry: 0, krz: 0 } }); }
    else if (restr) Object.assign(nodes[id - 1].restraints, restr);
    return id;
  };
  const addEl = (n1, n2, s) => { if (n1 == null || n2 == null || n1 === n2) return null; const ek = `${Math.min(n1, n2)}-${Math.max(n1, n2)}`; if (elemAt.has(ek)) return null; elemAt.add(ek); const id = ++eid; elements.push({ id, n1, n2, matId: 1, secId: s, releases: Array(12).fill(0) }); return id; };
  const serie = (Lt, seg) => { const a = [0]; let x = seg; while (x < Lt - 1e-6) { a.push(+x.toFixed(4)); x += seg; } a.push(+Lt.toFixed(4)); return a; };
  const empot = { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };
  const sec = spec.sections || {};

  // ── CENTRAL GIRDER mode (grillage): 1 longitudinal girder + cross-beams on piers ──
  const esVigaCentral = /central|parrilla|grillage|spine/i.test(String(p.type || p.girder_type || '')) ||
    p.transverse_section != null || sec.vigas_transversales != null || sec.transverse != null;
  if (esVigaCentral) {
    const secLong = pickSection(p.central_beam_section ?? p.girder_section ?? sec.beams ?? sec.longitudinal, perfiles, { b_cm: 50, h_cm: 100 }, 'Longitudinal beam', addWarning); secLong.id = 1;
    const secTransv = pickSection(p.transverse_section ?? sec.vigas_transversales ?? sec.transverse, perfiles, { b_cm: 30, h_cm: 60 }, 'Transverse beam', addWarning); secTransv.id = 2;
    const secCepa = pickSection(p.pier_section ?? sec.columns ?? sec.piers, perfiles, { b_cm: 100, h_cm: 100 }, 'Pier', addWarning); secCepa.id = 3;
    const sepT = p.transverse_spacing_m > 0 ? p.transverse_spacing_m : 2;
    const Xt = serie(L, sepT), Xpc = serie(L, luzP);
    const Xg = [...new Set([...Xt, ...Xpc].map((v) => +v.toFixed(4)))].sort((a, b) => a - b);
    // central longitudinal girder (y=0, z=H)
    for (let i = 0; i < Xg.length - 1; i++) addEl(getNode(Xg[i], 0, H), getNode(Xg[i + 1], 0, H), secLong.id);
    // piers (fixed central column) at each pier position
    for (const xp of Xpc) addEl(getNode(xp, 0, 0, empot), getNode(xp, 0, H), secCepa.id);
    // cross-beams at each Xt (from −W/2 to W/2, through the girder's central node)
    const transvEls = [];
    for (const xt of Xt) { const c = getNode(xt, 0, H); transvEls.push(addEl(getNode(xt, -W / 2, H), c, secTransv.id), addEl(c, getNode(xt, W / 2, H), secTransv.id)); }
    // uniform line load ONLY on the cross-beams
    const cg = spec.loads || {};
    let qL = p.transverse_load_kN_m ?? cg.linea_kN_m ?? cg.load_kN_m;
    if (qL == null) { qL = 10; addWarning('estimated', 'Line load on the transverse beams not given: 10 kN/m.'); }
    const lcCMv = { id: 1, name: 'CM', loads: [], selfWeight: true, type: 'static', specDir: null };
    const lcCVv = { id: 2, name: 'CV', loads: [], selfWeight: false, type: 'static', specDir: null };
    for (const e of transvEls) if (e != null) lcCVv.loads.push({ type: 'dist', elemId: e, dir: 'gravity', w: +qL.toFixed(6) });
    return {
      version: '1.0', units: 'kN-m', mode: '3D',
      nodes, elements, materials: [mat], sections: [secLong, secTransv, secCepa], diaphragms: [],
      loadCases: [lcCMv, lcCVv],
      combinations: [{ id: 1, name: '1.4CM', factors: [{ lcId: 1, factor: 1.4 }] }, { id: 2, name: '1.2CM+1.6CV', factors: [{ lcId: 1, factor: 1.2 }, { lcId: 2, factor: 1.6 }] }],
      grids: { x: Xg, y: [-W / 2, 0, W / 2], z: [0, H] },
      _counters: { nodes: nodes.length, elements: elements.length, materials: 1, sections: 3, diaphragms: 0, loadCases: 2, combinations: 2 },
      _generado: {
        por: 'assistant/generator.js (central-beam bridge)',
        reglas: (libs.reglas && libs.reglas._meta) ? libs.reglas._meta.version : undefined,
        resumen: `bridge central beam ${L} m × ${W} m, transverse @${sepT} m (${Xt.length}), piers @${luzP} m (${Xpc.length}): ${nodes.length} nodes, ${elements.length} bars`,
      },
      _warnings: warnings,
    };
  }

  // ── DECK mode (2 lateral longitudinal girders) ──
  const secGirder = pickSection(p.girder_section ?? sec.beams, perfiles, esMadera ? { b_cm: 15, h_cm: 35 } : { b_cm: 40, h_cm: 80 }, 'Beam/chord', addWarning); secGirder.id = 1;
  const secPila = pickSection(p.pier_section ?? sec.columns, perfiles, { b_cm: 50, h_cm: 50 }, 'Pier', addWarning); secPila.id = 2;
  const secDiag = pickSection(p.diagonal_size, perfiles, esMadera ? { b_cm: 10, h_cm: 20 } : { b_cm: 25, h_cm: 25 }, 'Diagonal/transverse', addWarning); secDiag.id = 3;

  const Xp = serie(L, luzP);             // pier positions
  const ys = [0, W];                      // two girder planes (deck edges)
  const deckZ = H;                        // deck level
  const botZ = esCercha ? +(H - canto).toFixed(4) : H;   // bottom chord / pier support

  // longitudinal deck nodes: for a truss, each span is subdivided into panels
  let Xn;
  if (esCercha) {
    const pPan = Math.max(2, Math.round(p.panels_per_span || Math.max(2, Math.round(luzP / Math.max(0.5, canto)))));
    const set = new Set();
    for (let s = 0; s < Xp.length - 1; s++) { const a = Xp[s], b = Xp[s + 1]; for (let i = 0; i <= pPan; i++) set.add(+(a + (b - a) * i / pPan).toFixed(4)); }
    Xn = [...set].sort((u, v) => u - v);
  } else Xn = Xp.slice();

  // piers (columns) at each Xp and each edge, from z=0 (fixed) to botZ
  for (const xp of Xp) for (const y of ys) addEl(getNode(xp, y, 0, empot), getNode(xp, y, botZ), secPila.id);
  if (esCercha) for (const xp of Xp) addEl(getNode(xp, 0, botZ), getNode(xp, W, botZ), secDiag.id);  // pier cross-tie

  // longitudinal girders / trusses at each edge
  const topEls = [];   // top chord = deck, carries the load
  for (const y of ys) {
    if (!esCercha) {
      for (let i = 0; i < Xn.length - 1; i++) topEls.push(addEl(getNode(Xn[i], y, deckZ), getNode(Xn[i + 1], y, deckZ), secGirder.id));
    } else {
      const B = [], T = [];
      for (let i = 0; i < Xn.length; i++) { B[i] = getNode(Xn[i], y, botZ); T[i] = getNode(Xn[i], y, deckZ); }
      for (let i = 0; i < Xn.length - 1; i++) addEl(B[i], B[i + 1], secGirder.id);                 // bottom chord
      for (let i = 0; i < Xn.length - 1; i++) topEls.push(addEl(T[i], T[i + 1], secGirder.id));    // top chord (deck)
      weaveTrussWeb(B, T, Xn.length - 1, tCel, addEl, secDiag.id);
    }
  }
  // deck cross-beams (at level deckZ) at each longitudinal node
  for (const xn of Xn) addEl(getNode(xn, 0, deckZ), getNode(xn, W, deckZ), secDiag.id);

  // ── Deck loads (CM + CV) on the edge girders, tributary width W/2 ──
  const cargas = spec.loads || {};
  let qCM = cargas.dead_extra_kN_m2; if (qCM == null) { qCM = 2.0; addWarning('estimated', 'Deck weight not given: 2.0 kN/m².'); }
  let qCV = cargas.live_load_kN_m2; if (qCV == null) { qCV = 4.0; addWarning('estimated', 'Bridge live load not given: 4.0 kN/m² (pedestrian/light; for vehicular use NCh3171/AASHTO).'); }
  const lcCM = { id: 1, name: 'CM', loads: [], selfWeight: true, type: 'static', specDir: null };
  const lcCV = { id: 2, name: 'CV', loads: [], selfWeight: false, type: 'static', specDir: null };
  for (const e of topEls) {
    if (e == null) continue;
    lcCM.loads.push({ type: 'dist', elemId: e, dir: 'gravity', w: +(qCM * W / 2).toFixed(6) });
    lcCV.loads.push({ type: 'dist', elemId: e, dir: 'gravity', w: +(qCV * W / 2).toFixed(6) });
  }
  const loadCases = [lcCM, lcCV];
  const combinations = [
    { id: 1, name: '1.4CM', factors: [{ lcId: 1, factor: 1.4 }] },
    { id: 2, name: '1.2CM+1.6CV', factors: [{ lcId: 1, factor: 1.2 }, { lcId: 2, factor: 1.6 }] },
  ];

  return {
    version: '1.0', units: 'kN-m', mode: '3D',
    nodes, elements, materials: [mat], sections: [secGirder, secPila, secDiag], diaphragms: [],
    loadCases, combinations,
    grids: { x: Xp, y: ys, z: [0, botZ, deckZ] },
    _counters: { nodes: nodes.length, elements: elements.length, materials: 1, sections: 3, diaphragms: 0, loadCases: 2, combinations: 2 },
    _generado: {
      por: 'assistant/generator.js (bridge)',
      reglas: (libs.reglas && libs.reglas._meta) ? libs.reglas._meta.version : undefined,
      resumen: `bridge ${L}×${W} m, ${Xp.length} pier lines @${luzP} m, ${esCercha ? `vigas de celosía ${tCel} (canto ${canto} m)` : 'vigas continuas'}: ${nodes.length} nodes, ${elements.length} bars`,
    },
    _warnings: warnings,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// WAREHOUSE / INDUSTRIAL SHED typology (column frames + roof trusses)
//   Frames spaced along (Y): 2 columns (x=0, x=span) + gable roof truss
//   (Warren/Pratt/Howe) over the columns; purlins tie the frames. Integrates
//   "building + trusses". Deterministic and resilient.
// ──────────────────────────────────────────────────────────────────────────────
export function generateWarehouse(spec, libs) {
  const materiales = libs.materiales || [], perfiles = libs.perfiles || [];
  const warnings = []; const addWarning = (t, m) => warnings.push({ type: t, msg: m });
  const matByName = new Map(materiales.map((m) => [String(m.nombre).trim().toLowerCase(), m]));
  const pickMat = (n) => {
    const r = resolveFlexMaterial(n, materiales, addWarning); if (r) return r;
    const d = matByName.get('s275'); addWarning('replacement', `Material ${n == null ? '(not given)' : `"${n}"`}: used steel S275 (warehouse).`);
    return d ? rowToMaterial(d) : { name: 'S275', E: 2.1e8, G: 8.08e7, nu: 0.3, rho: 7.85 };
  };
  const mat = pickMat((spec.sections || {}).material); mat.id = 1;
  const esMadera = /pino|madera/i.test(mat.name);

  const g = spec.warehouse || {};
  const luz = g.span_m > 0 ? g.span_m : 15; if (!(g.span_m > 0)) addWarning('replacement', 'Warehouse span not given: 15 m.');
  // number of frames (≥ 2) prevails over the spacing: spacing = length / (n − 1). n = 1: one representative frame,
  // the spacing being its tributary width (roof and wind loads); no purlins, bracing or sag rods (they need two frames)
  const nPort = Math.round(+g.n_frames || 0);
  const umPortico = nPort === 1;
  const largo = umPortico ? 0 : g.length_m > 0 ? g.length_m : 30;
  if (!umPortico && !(g.length_m > 0)) addWarning('replacement', 'Warehouse length not given: 30 m.');
  const H = g.column_height_m > 0 ? g.column_height_m : 6;
  const sep = nPort >= 2 ? +(largo / (nPort - 1)).toFixed(6) : (g.frame_spacing_m > 0 ? g.frame_spacing_m : 5);
  const tribOf = (f) => umPortico ? sep : tributario(Yf, f);
  if (umPortico) addWarning('info', `Pórtico isolado (vista 3D, cálculo plano X–Z: uy, rx e rz travados — fora do plano não há sistema resistente sem os demais pórticos): largura de influência = ${sep} m (cargas de telhado e vento); terças, contraventamento e correntes não gerados. Cpe do vento com comprimento = ${sep} m — para um pórtico interno de galpão longo, gere o galpão completo.`);
  const slope = (g.slope_pct >= 0 ? g.slope_pct : 15) / 100;
  const hR = g.ridge_height_m > 0 ? g.ridge_height_m : +(slope * (luz / 2)).toFixed(4);
  // end depth of the truss ("montante inicial"): 0 = triangular truss (top chord meets the bottom chord on the
  // column); > 0 = trapezoidal truss, the end post being the column carried up to the top chord (same section,
  // rigid) so the column–truss knee has that depth. hR stays the rise from the eave to the ridge.
  const hE = g.end_depth_m > 0 ? +g.end_depth_m : 0;
  const tCel = /pratt/i.test(String(g.truss_type || '')) ? 'pratt' : (/howe/i.test(String(g.truss_type || '')) ? 'howe' : 'warren');
  // Brazil preset: purlins on every top-chord node, so the panel length is set by the purlin spacing —
  // 1,3 to 1,8 m for trapezoidal sheeting (Manual CBCA de galpões 2.1; tile maker's table). Default 1,8 m.
  const brasilG = libs.reglas?.loads?.wind?.metodo === 'NBR6123';
  const spTerca = g.purlin_spacing_m > 0 ? g.purlin_spacing_m : 1.8;
  let nT;
  if (brasilG && !g.n_panels) {
    nT = 2 * Math.max(2, Math.ceil(Math.hypot(luz / 2, hR) / spTerca - 1e-9));
    if (!(g.purlin_spacing_m > 0)) addWarning('estimated', `Espaçamento das terças não informado: 1,8 m (limite superior para telha trapezoidal, Manual CBCA de galpões; confirme na tabela do fabricante da telha).`);
  } else { nT = Math.max(2, Math.round(g.n_panels || Math.max(4, Math.round(luz)))); if (nT % 2) nT += 1; }

  // sections by function: hot-rolled (Gerdau W/HP of the preset) or cold-formed of NBR 6355 (Ue, L — the
  // js/design/profiles_cf.js catalogue, routed to NBR 14762 by design.cfProps), or concrete {b_cm, h_cm}
  const cfSec = (nm, label) => {
    const c = typeof nm === 'string' ? cfSection(nm.trim()) : null;
    if (!c) return null;
    addWarning('info', `${label}: perfil formado a frio ${nm.trim()} (NBR 6355).`);
    const sh = c.shape || 'Ue', d = c.dims;
    const Avy = sh === 'L' ? d.b * d.t : d.bw * d.t, Avz = sh === 'L' ? d.b * d.t : 2 * d.bf * d.t;
    return { name: nm.trim(), A: c.A, Iz: c.Iz, Iy: c.Iy, J: c.J, Avy: +Avy.toFixed(10), Avz: +Avz.toFixed(10), kappay: 1.0, kappaz: 1.0,
      design: { shape: sh, profile: nm.trim(), cfProps: c } };
  };
  const pickAny = (nm, def, label) => cfSec(nm, label) || pickSection(nm, perfiles, def, label, addWarning);
  // column type: 'simples'/'laminado' (single member, fixed base) | 'treliçado' (lattice) | 'concreto' (precast
  // cantilever, fixed base, steel truss pinned on top) | 'sem' (roof only: trusses on supports)
  const ct = String(g.column_type || '').toLowerCase();
  const tipoPilar = /treli|lattice|truss/.test(ct) ? 'trelicado' : /concr|horm/.test(ct) ? 'concreto'
    : /^(sem|sin|none|no)\b|cobertura|roof/.test(ct) ? 'sem' : 'laminado';
  const secCol = tipoPilar === 'concreto'
    ? (() => { const c = g.column_concrete || {}, b = c.b_cm > 0 ? +c.b_cm : 40, h = c.h_cm > 0 ? +c.h_cm : 40; return rectToSection({ b_cm: b, h_cm: h }, `${b}x${h}`); })()
    : pickAny(g.column_section ?? (spec.sections || {}).columns, esMadera ? { b_cm: 15, h_cm: 20 } : { b_cm: 30, h_cm: 30 }, 'Column');
  secCol.id = 1;
  const secCord = pickAny(g.chord_size, esMadera ? { b_cm: 7.5, h_cm: 15 } : { b_cm: 15, h_cm: 15 }, 'Chord'); secCord.id = 2;
  const secDiag = pickAny(g.diagonal_size, esMadera ? { b_cm: 5, h_cm: 10 } : { b_cm: 10, h_cm: 10 }, 'Diagonal/purlin'); secDiag.id = 3;
  // materials by function (warehouse.materials = { columns, chords, web, purlins, rods }); default = sections.material
  const MM = g.materials || {}, mats = [mat], matKey = new Map([[mat.name.toLowerCase(), 1]]);
  const matIdOf = (nm) => {
    if (!nm) return 1;
    const r = pickMat(nm), k = r.name.toLowerCase();
    if (matKey.has(k)) return matKey.get(k);
    r.id = mats.length + 1; mats.push(r); matKey.set(k, r.id); return r.id;
  };
  const isConc = (id) => { const E = +mats[id - 1].E; return E > 1e7 && E < 6e7; };
  const idMatCol = matIdOf(MM.columns || (tipoPilar === 'concreto' ? 'C30' : null));
  if (tipoPilar === 'concreto' && !isConc(idMatCol)) addWarning('replacement', `Pilar de concreto com material "${mats[idMatCol - 1].name}" (não é concreto) — confira warehouse.materials.columns.`);
  const idMatChord = matIdOf(MM.chords), idMatWeb = matIdOf(MM.web), idMatPurl = matIdOf(MM.purlins), idMatRod = matIdOf(MM.rods);
  // lattice ("treliçado") columns: two chords (outer face x = 0 / span and inner x = w / span − w), horizontals at
  // every module and one alternating diagonal per panel (pinned lacing), two pinned bases — the column of the
  // Forecast/CalcSteel generators. Default 'simples' (single member, fixed base).
  const pilarTrel = tipoPilar === 'trelicado';
  const wCol = g.column_width_m > 0 ? g.column_width_m : 0.5;
  const modCol = g.column_module_m > 0 ? g.column_module_m : 0.5;
  const secLace = pilarTrel ? pickAny(g.column_lacing_section ?? g.diagonal_size, esMadera ? { b_cm: 5, h_cm: 10 } : { b_cm: 10, h_cm: 10 }, 'Travejamento do pilar') : null;
  if (secLace) secLace.id = 6;
  if (pilarTrel && !(wCol < luz / 4)) addWarning('replacement', `Largura do pilar treliçado ${wCol} m incompatível com o vão ${luz} m.`);
  // Brazil preset (or warehouse.bracing = true): X bracing in the end bays and pinned web/purlins —
  // Manual CBCA "Galpões para usos gerais" 2.14/2.15: roof bracing in the end bays against the gable wind,
  // X diagonals with only the tension one acting (compressed one neglected), purlins take the compression;
  // vertical X bracing on the longitudinal lines; round rod ≥ 12 mm (NBR 8800).
  const brasilGalpao = libs.reglas?.loads?.wind?.metodo === 'NBR6123';
  // bracing: 'extremidades' (default with the preset) | 'todos' (every bay) | 'sem' | true/false
  // bracing_bays: bays chosen by the user, numbered 1 … n_frames − 1 from y = 0 (prevails over the mode)
  const baysUser = Array.isArray(g.bracing_bays) && (g.bracing_bays.length || /escolh|chosen/i.test(String(g.bracing)))
    ? [...new Set(g.bracing_bays.map(v => Math.round(+v)).filter(Number.isFinite))].sort((p, q) => p - q) : null;
  const modoContrav = baysUser ? 'escolhidos' : g.bracing === true ? 'extremidades' : g.bracing === false ? 'sem'
    : (typeof g.bracing === 'string' ? (/todo|all/i.test(g.bracing) ? 'todos' : /sem|none|no/i.test(g.bracing) ? 'sem' : 'extremidades') : (brasilGalpao ? 'extremidades' : 'sem'));
  const comContrav = brasilGalpao || modoContrav !== 'sem' || pilarTrel;
  // purlins: cold-formed Ue of NBR 6355 (catalogue in js/design/profiles_cf.js). Pre-sizing d ≥ L/40 (Manual CBCA
  // 2.9: for L = 6 m a 100–150 mm section is expected) — must be checked by NBR 14762.
  let secTerca = null;
  if (comContrav) {
    const ues = cfNames().filter(n => n.startsWith('Ue')).map(n => ({ n, c: cfSection(n) }));
    let pick = g.purlin_section ? ues.find(u => u.n === g.purlin_section) : null;
    if (g.purlin_section && !pick) addWarning('replacement', `Terça "${g.purlin_section}" fora do catálogo NBR 6355: pré-dimensionada.`);
    if (!pick) {
      const dMin = sep / 40;
      const ok = ues.filter(u => u.c.dims.bw >= dMin - 1e-9);
      const bw = Math.min(...ok.map(u => u.c.dims.bw));
      pick = ok.filter(u => u.c.dims.bw === bw).sort((x, y) => Math.abs(x.c.dims.t - 0.002) - Math.abs(y.c.dims.t - 0.002))[0] || ues[ues.length - 1];
      addWarning('estimated', `Terça pré-dimensionada: ${pick.n} (d ≥ L/40 = ${(dMin * 1000).toFixed(0)} mm, Manual CBCA 2.9) — verificar pela NBR 14762.`);
    }
    const c = pick.c;
    secTerca = { id: 5, name: pick.n, A: c.A, Iz: c.Iz, Iy: c.Iy, J: c.J, Avy: +(c.dims.bw * c.dims.t).toFixed(10), Avz: +(2 * c.dims.bf * c.dims.t).toFixed(10),
      kappay: 1.0, kappaz: 1.0, design: { shape: 'Ue', profile: pick.n, cfProps: c } };
  }
  const dRod = (g.bracing_rod_mm > 0 ? g.bracing_rod_mm : 12) / 1000;
  const secRod = { id: 4, name: `Barra redonda φ${Math.round(dRod * 1000)}`, A: +(Math.PI * dRod ** 2 / 4).toFixed(10),
    Iz: +(Math.PI * dRod ** 4 / 64).toFixed(14), Iy: +(Math.PI * dRod ** 4 / 64).toFixed(14), J: +(Math.PI * dRod ** 4 / 32).toFixed(14),
    Avy: +(0.9 * Math.PI * dRod ** 2 / 4).toFixed(10), Avz: +(0.9 * Math.PI * dRod ** 2 / 4).toFixed(10), kappay: 1.0, kappaz: 1.0 };

  const nodes = [], elements = []; let nid = 0, eid = 0; const nodeAt = new Map(), elemAt = new Set();
  const rk = (v) => Math.round(v * 1e5) / 1e5;
  const getNode = (x, y, z, restr) => {
    const k = `${rk(x)}|${rk(y)}|${rk(z)}`; let id = nodeAt.get(k);
    if (id == null) { id = ++nid; nodeAt.set(k, id); nodes.push({ id, x: rk(x), y: rk(y), z: rk(z), restraints: restr || { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }, nodeMass: { mx: 0, my: 0, mz: 0 }, springs: { kux: 0, kuy: 0, kuz: 0, krx: 0, kry: 0, krz: 0 } }); }
    else if (restr) Object.assign(nodes[id - 1].restraints, restr);
    return id;
  };
  const addEl = (n1, n2, s) => { if (n1 == null || n2 == null || n1 === n2) return null; const ek = `${Math.min(n1, n2)}-${Math.max(n1, n2)}`; if (elemAt.has(ek)) return null; elemAt.add(ek); const id = ++eid; elements.push({ id, n1, n2, matId: 1, secId: s, releases: Array(12).fill(0) }); return id; };
  const serie = (Lt, seg) => { const a = [0]; let x = seg; while (x < Lt - 1e-6) { a.push(+x.toFixed(4)); x += seg; } a.push(+Lt.toFixed(4)); return a; };
  const empot = { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };

  // ridge purlins: 'simples' (one purlin on the apex, web vertical) | 'dupla' (one per slope, each web perpendicular to
  // its own slope, gap between them set at launch — usually 10 to 15 cm, CBCA ridge detail with the ridge flashing)
  let cumDupla = /dupl|doubl|dobl/i.test(String(g.ridge_purlins || ''));
  const gapC = g.ridge_purlin_gap_m > 0 ? +g.ridge_purlin_gap_m : 0.15;
  if (cumDupla && !(g.ridge_purlin_gap_m > 0)) addWarning('estimated', 'Afastamento entre as terças da cumeeira não informado: 15 cm (usual 10 a 15 cm; defina no lançamento).');
  if (cumDupla && !(gapC / 2 < 0.9 * luz / nT)) { addWarning('replacement', `Afastamento das terças da cumeeira (${gapC} m) não cabe no painel do banzo: terça única na cumeeira.`); cumDupla = false; }
  const along = (i) => +(i * luz / nT).toFixed(5);
  const zRoof = (a) => +(hE + (a <= luz / 2 ? (2 * hR / luz) * a : (2 * hR / luz) * (luz - a))).toFixed(5);
  const Yf = umPortico ? [0] : serie(largo, sep);          // frame positions
  const frames = [];                      // {T, B, tops}
  const wallEls = new Set();                 // members of the side walls (columns, end posts): wall wind goes there
  const addWall = (n1, n2, s) => { const id = addEl(n1, n2, s); if (id != null) wallEls.add(id); return id; };
  for (const yf of Yf) {
    const PINL = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1];
    if (tipoPilar === 'sem') {
      // roof only: the bottom chord ends rest on supports — fixed x = 0 (ux, uy, uz), sliding x = span (uy, uz);
      // rx held at both (fork support: the truss cannot roll about its own axis)
      getNode(0, yf, H, { ux: 1, uy: 1, uz: 1, rx: 1, ry: 0, rz: 0 });
      getNode(luz, yf, H, { ux: 0, uy: 1, uz: 1, rx: 1, ry: 0, rz: 0 });
    } else if (!pilarTrel) {
      // columns (x=0, x=span) from z=0 (fixed) to H; a concrete column carries the steel truss pinned on top
      for (const x of [0, luz]) {
        const id = addWall(getNode(x, yf, 0, empot), getNode(x, yf, H), secCol.id);
        // truss pinned on the concrete column in the frame plane only (local rz of the vertical member = about global
        // Y); the rotation about X stays held — releasing it lets the truss roll (mechanism found in the audit)
        if (id != null && tipoPilar === 'concreto') elements[id - 1].releases = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
      }
    } else {
      const rot = { ux: 1, uy: 1, uz: 1, rx: 0, ry: 0, rz: 0 };          // pinned base of each chord
      const nk = Math.max(2, Math.ceil(H / modCol - 1e-9)), zk = (k) => +(k * H / nk).toFixed(5);
      for (const [xo, xi] of [[0, wCol], [luz, luz - wCol]]) {
        for (let k = 0; k < nk; k++) {
          addWall(getNode(xo, yf, zk(k), k === 0 ? rot : null), getNode(xo, yf, zk(k + 1)), secCol.id);   // outer chord
          addEl(getNode(xi, yf, zk(k), k === 0 ? rot : null), getNode(xi, yf, zk(k + 1)), secCol.id);   // inner chord
        }
        for (let k = 1; k <= nk; k++) { const id = addEl(getNode(xo, yf, zk(k)), getNode(xi, yf, zk(k)), secLace.id); if (id) elements[id - 1].releases = [...PINL]; }
        for (let k = 0; k < nk; k++) {
          const id = k % 2 ? addEl(getNode(xi, yf, zk(k)), getNode(xo, yf, zk(k + 1)), secLace.id) : addEl(getNode(xo, yf, zk(k)), getNode(xi, yf, zk(k + 1)), secLace.id);
          if (id) elements[id - 1].releases = [...PINL];
        }
      }
    }
    // roof truss: bottom chord at H, gable top chord
    const B = [], T = [], tops = [];
    for (let i = 0; i <= nT; i++) { const x = along(i); B[i] = getNode(x, yf, H); T[i] = getNode(x, yf, +(H + zRoof(x)).toFixed(4)); }
    // end posts: the steel column carried up to the top chord (same section, rigid knee); on a concrete column or
    // with no column the post belongs to the truss (chord section)
    if (hE > 0) {
      const sp = (tipoPilar === 'laminado' || pilarTrel) ? secCol.id : secCord.id, add = tipoPilar === 'sem' ? addEl : addWall;
      add(B[0], T[0], sp); add(B[nT], T[nT], sp);
    }
    // bottom chord (tie) through every panel node and, with lattice columns, the inner chord tops x = w and span − w
    const xsB = [...new Set([...Array.from({ length: nT + 1 }, (_, i) => along(i)), ...(pilarTrel ? [wCol, luz - wCol] : [])].map(v => +v.toFixed(5)))].sort((p, q) => p - q);
    for (let i = 0; i + 1 < xsB.length; i++) addEl(getNode(xsB[i], yf, H), getNode(xsB[i + 1], yf, H), secCord.id);
    // double ridge purlin: two top-chord nodes at span/2 ∓ gap/2 (the apex node stays — web members meet there)
    let TL = null, TR = null;
    if (cumDupla) { const xl = luz / 2 - gapC / 2, xr = luz / 2 + gapC / 2; TL = getNode(xl, yf, +(H + zRoof(xl)).toFixed(4)); TR = getNode(xr, yf, +(H + zRoof(xr)).toFixed(4)); }
    for (let i = 0; i < nT; i++) {
      const pts = cumDupla && i === nT / 2 - 1 ? [T[i], TL, T[i + 1]] : cumDupla && i === nT / 2 ? [T[i], TR, T[i + 1]] : [T[i], T[i + 1]];
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = nodes[pts[k] - 1], b = nodes[pts[k + 1] - 1];
        const e = addEl(pts[k], pts[k + 1], secCord.id);
        const da = +(b.x - a.x).toFixed(6); const Lsl = Math.hypot(da, b.z - a.z) || da;
        tops.push({ elemId: e, dx: da, Lsl });
      }
    }
    weaveTrussWeb(B, T, nT, tCel, addEl, secDiag.id);
    if (tCel === 'warren') addEl(B[nT / 2], T[nT / 2], secDiag.id);   // king post
    // purlin nodes of the frame, eave to eave: the apex replaced by the two ridge nodes when the ridge purlin is double
    const P = cumDupla ? [...T.slice(0, nT / 2), TL, TR, ...T.slice(nT / 2 + 1)] : T;
    frames.push({ T, B, tops, P });
  }
  // sag-rod lines ("linhas de corrente", Manual CBCA de galpões 2.10–2.11): 0, 1 (mid-span) or 2 (thirds) lines per
  // bay along the slope, tying the purlins in their weak direction → Ly = Lb = bay/(n + 1). Flexible = threaded round
  // bar (12,5 mm in small sheds, 16 mm usual — CBCA 2.11), tension only; rigid = cold-formed angle (also compression).
  const nSag = Math.max(0, Math.min(2, Math.round(+g.sag_rod_lines || 0)));
  const sagRigid = /r[ií]gid|rigid/i.test(String(g.sag_rod_type || ''));
  const dSag = (g.sag_rod_mm > 0 ? +g.sag_rod_mm : 12.5) / 1000;
  const secSag = nSag === 0 ? null : sagRigid ? pickAny(g.sag_rod_section || 'L 50x3,00', { b_cm: 5, h_cm: 5 }, 'Corrente rígida')
    : { name: `Corrente φ${String(+(dSag * 1000).toFixed(1)).replace('.', ',')}`, A: +(Math.PI * dSag ** 2 / 4).toFixed(10), Iz: +(Math.PI * dSag ** 4 / 64).toFixed(14),
      Iy: +(Math.PI * dSag ** 4 / 64).toFixed(14), J: +(Math.PI * dSag ** 4 / 32).toFixed(14), Avy: +(0.9 * Math.PI * dSag ** 2 / 4).toFixed(10),
      Avz: +(0.9 * Math.PI * dSag ** 2 / 4).toFixed(10), kappay: 1.0, kappaz: 1.0 };
  if (secSag) secSag.id = 7;
  const frameY = new Set(Yf.map((y) => rk(y)));
  // purlins: tie consecutive frames at each chord node (top chord split at the sag points)
  for (let s = 0; s + 1 < Yf.length; s++) {
    const yA = Yf[s], yB = Yf[s + 1], ys = [yA, ...Array.from({ length: nSag }, (_, k) => yA + (k + 1) * (yB - yA) / (nSag + 1)), yB];
    const line = [], PA = frames[s].P, PB = frames[s + 1].P;
    for (let i = 0; i < PA.length; i++) {
      const tA = nodes[PA[i] - 1], ids = ys.map((y, k) => k === 0 ? PA[i] : k === ys.length - 1 ? PB[i] : getNode(tA.x, y, tA.z));
      for (let k = 0; k + 1 < ids.length; k++) addEl(ids[k], ids[k + 1], secDiag.id);
      line.push(ids);
      // bottom-chord tie; at the eave of a triangular truss B = T and the (split) eave purlin already ties it
      if (!cumDupla && frames[s].B[i] !== frames[s].T[i]) addEl(frames[s].B[i], frames[s + 1].B[i], secDiag.id);
    }
    if (cumDupla) for (let i = 0; i <= nT; i++) if (frames[s].B[i] !== frames[s].T[i]) addEl(frames[s].B[i], frames[s + 1].B[i], secDiag.id);
    if (secSag) {
      const sagEl = (a, b) => { const id = addEl(a, b, secSag.id); if (id != null) { const e = elements[id - 1]; e.releases = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1]; if (!sagRigid) e.cable = true; } };
      // ridge purlin line(s): one (apex) or two (one per slope, double ridge purlin)
      const iRL = nT / 2, iRR = cumDupla ? nT / 2 + 1 : nT / 2, nL = line.length - 1, last = nSag + 1;
      for (let k = 1; k <= nSag; k++) {
        for (let i = 0; i + 1 < iRL; i++) sagEl(line[i][k], line[i + 1][k]);            // T1, left slope
        for (let i = iRR + 1; i < nL; i++) sagEl(line[i][k], line[i + 1][k]);           // T1, right slope
        // T2: to the ridge purlin of its slope at the nearer frame(s) — both when the point is the middle one
        const ends = 2 * k < last ? [0] : 2 * k > last ? [last] : [0, last];
        for (const j of ends) { sagEl(line[iRL - 1][k], line[iRL][j]); sagEl(line[iRR + 1][k], line[iRR][j]); }
      }
    }
  }
  if (secSag) addWarning('info', `Linhas de corrente: ${nSag} por vão (${nSag === 1 ? 'meio do vão' : 'terços'}), ${sagRigid ? `rígidas (${secSag.name})` : `flexíveis (barra redonda φ${String(+(dSag * 1000).toFixed(1)).replace('.', ',')} mm, só tração)`}, do beiral até a terça abaixo da cumeeira (T1) e diagonais até a terça da cumeeira nos pórticos (T2) — Manual CBCA de galpões 2.10–2.11, Fig. 77. Terças contínuas entre correntes e rotuladas nos pórticos: Ly = Lb = vão/${nSag + 1} (hipótese de projeto); na verificação da terça use Lx = vão do pórtico. As terças têm a alma perpendicular ao pano (ângulo β = ±θ; ${cumDupla ? `cumeeira com terça dupla, uma por água, afastadas ${String(+(gapC * 100).toFixed(1)).replace('.', ',')} cm` : 'a da cumeeira, alma vertical'}). LIMITAÇÃO: a telha carrega os banzos — a componente da carga no eixo de menor inércia da terça (g·senθ) e as forças nas correntes não saem da análise: calcule-as como no CBCA 2.11.`);
  if (comContrav) {
    // pin both ends of the truss web and of the purlins (ry, rz released; torsion kept): chords stay continuous
    const PIN = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1];
    for (const e of elements) {
      const a = nodes[e.n1 - 1], b = nodes[e.n2 - 1];
      const isPurlin = Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.y - b.y) > 1e-6;
      const isWeb = e.secId === secDiag.id && Math.abs(a.y - b.y) < 1e-6;
      if (isWeb) e.releases = [...PIN];
      else if (isPurlin) {   // pinned at the frames only; continuous across sag-rod points
        const r = Array(12).fill(0);
        if (frameY.has(rk(a.y))) { r[4] = 1; r[5] = 1; }
        if (frameY.has(rk(b.y))) { r[10] = 1; r[11] = 1; }
        e.releases = r;
      }
      if (isPurlin && secTerca && a.z > H + 1e-6) e.secId = secTerca.id;            // purlins on the top chord (biapoiadas)
      else if (isPurlin && secTerca && Math.abs(a.x) < 1e-6 && Math.abs(a.z - H) < 1e-6) e.secId = secTerca.id;   // eave purlins
      else if (isPurlin && secTerca && Math.abs(a.x - luz) < 1e-6 && Math.abs(a.z - H) < 1e-6) e.secId = secTerca.id;
      // roll angle β of the purlin (solver/timoshenko.js localAxes): web perpendicular to its roof slope, i.e. local y
      // along the slope normal n = (∓sinθ, 0, cosθ). Member along ±Y: default triad ez = (±1, 0, 0), ey = Z →
      // β = atan2(n·ez, n·ey). Ridge purlin (x = luz/2): web vertical (β = 0).
      if (isPurlin && secTerca && e.secId === secTerca.id) {
        const th = Math.atan(2 * hR / luz), sx = a.x < luz / 2 - 1e-6 ? -1 : a.x > luz / 2 + 1e-6 ? 1 : 0;
        const b0 = Math.atan2(sx * Math.sin(th) * Math.sign(b.y - a.y), Math.cos(th)) * 180 / Math.PI;
        if (Math.abs(b0) > 1e-9) { e.beta = +b0.toFixed(4); e.betaOwn = true; }   // own β (not the section default)
      }
    }
    // X bracing (tension-only rods, pinned) in the two end bays: roof plane (top chord) and both side walls
    const nBays = Yf.length - 1;
    if (baysUser) { const bad = baysUser.filter(b => b < 1 || b > nBays); if (bad.length) addWarning('replacement', `Vãos de contraventamento fora de 1…${nBays} ignorados: ${bad.join(', ')}.`); }
    const bays = modoContrav === 'sem' ? [] : modoContrav === 'todos' ? Yf.slice(0, -1).map((_, i) => i)
      : modoContrav === 'escolhidos' ? baysUser.filter(b => b >= 1 && b <= nBays).map(b => b - 1)
      : [...new Set([0, Yf.length - 2])].filter(s => s >= 0 && s + 1 < Yf.length);
    const rod = (n1, n2) => { const id = addEl(n1, n2, secRod.id); if (id != null) { const e = elements[id - 1]; e.releases = [...PIN]; e.cable = true; } };
    for (const s of bays) {
      const A = frames[s], B = frames[s + 1];
      for (let i = 0; i < nT; i++) { rod(A.T[i], B.T[i + 1]); rod(A.T[i + 1], B.T[i]); }   // roof plane, panel by panel
    }
    // side walls (steel columns): in the braced bays; a lattice column needs them anyway (pinned bases and lacing → no
    // longitudinal stiffness — mechanism in Y otherwise), so the end bays get them when no bay is braced. The X goes up
    // to the eave (H + hE) so it meets the roof bracing, which starts at the top chord.
    const wallBays = !(tipoPilar === 'laminado' || pilarTrel) ? [] : bays.length ? bays
      : pilarTrel ? [...new Set([0, Yf.length - 2])].filter(s => s >= 0 && s + 1 < Yf.length) : [];
    if (pilarTrel && !bays.length && wallBays.length) addWarning('replacement', 'Pilar treliçado sem contraventamento: bases e travejamento rotulados não dão rigidez longitudinal — contraventamento vertical das paredes gerado nos vãos extremos.');
    for (const s of wallBays) for (const x of [0, luz]) {
      const yA = Yf[s], yB = Yf[s + 1], zt = +(H + hE).toFixed(5);
      rod(getNode(x, yA, 0), getNode(x, yB, zt)); rod(getNode(x, yB, 0), getNode(x, yA, zt));
    }
    if (tipoPilar === 'laminado' && !wallBays.length && Yf.length > 1) addWarning('info', 'Sem contraventamento vertical: a estabilidade longitudinal vem só da flexão dos pilares engastados (eixo de menor inércia) — confira os deslocamentos em Y.');
    if (!bays.length && Yf.length > 1 && tipoPilar !== 'sem') addWarning('replacement', 'Sem contraventamento no telhado: o vento de empena acima do beiral vai à flexão lateral (fora do plano) das treliças de extremidade — deslocamentos grandes em Y; contravente ao menos os vãos extremos.');
    if (bays.length) addWarning('info', `Contraventamento em X (barra redonda φ${Math.round(dRod * 1000)}, só tração) ${modoContrav === 'todos' ? 'em todos os vãos' : modoContrav === 'escolhidos' ? `nos vãos ${bays.map(b => b + 1).join(', ')} (de ${nBays})` : 'nos vãos extremos'} — telhado e paredes laterais; diagonais da treliça e terças rotuladas (Manual CBCA de galpões 2.14/2.15). Na análise LINEAR as duas diagonais do X trabalham (força ≈ metade em cada); a hipótese "só a tracionada" vale na análise não linear simplificada (barras cable).`);
  }

  // purlins and sag rods: the roofing loads the truss chords (not the purlins), so their analysis forces are not
  // design forces — excluded from the strength check (listed as not verified)
  for (const e of elements) {
    if (e.secId === 7) e.designExcluded = 'Corrente: força não sai da análise (telha carrega os banzos, não as terças) — calcular pelo Manual CBCA de galpões 2.11.';
    else if (e.secId === 5) e.designExcluded = 'Terça: a telha carrega os banzos no modelo — verificar a terça à parte (NBR 14762, flexão oblíqua, Lx = vão, Ly = Lb pelas correntes).';
  }
  // material of each member by its function
  const matOfSec = new Map([[secCol.id, idMatCol], [secCord.id, idMatChord], [secDiag.id, idMatWeb], [4, idMatRod], [5, idMatPurl], [6, idMatCol], [7, idMatRod]]);
  for (const e of elements) e.matId = matOfSec.get(e.secId) ?? 1;
  // layers by function (CYPE "etiquetas"): the generated shed comes split, ready to hide/lock/colour per group
  const LAYERS = [{ id: 1, name: 'padrão', color: '#64748b' }, { id: 2, name: 'Pilares', color: '#2563eb' }, { id: 3, name: 'Banzos', color: '#dc2626' },
    { id: 4, name: 'Montantes e diagonais', color: '#f97316' }, { id: 5, name: 'Terças', color: '#16a34a' }, { id: 6, name: 'Contraventamento', color: '#9333ea' },
    { id: 7, name: 'Travejamento do pilar', color: '#0891b2' }, { id: 8, name: 'Correntes', color: '#ca8a04' }].map(l => ({ ...l, visible: true, locked: false }));
  const layerOfSec = new Map([[secCol.id, 2], [secCord.id, 3], [secDiag.id, 4], [4, 6], [5, 5], [6, 7], [7, 8]]);
  for (const e of elements) e.layer = layerOfSec.get(e.secId) ?? 1;
  const usedLayers = LAYERS.filter(l => l.id === 1 || elements.some(e => e.layer === l.id));
  if (tipoPilar === 'sem') addWarning('info', 'Sem pilares (somente a cobertura): treliças apoiadas no banzo inferior — fixo em x = 0, deslizante em x = vão (rx impedido, apoio em garfo). Vento de paredes e empenas não aplicado; as reações são as ações sobre a estrutura de apoio.');
  if (tipoPilar === 'concreto') addWarning('info', `Pilares de concreto ${secCol.name} cm engastados na base, treliça de aço articulada no topo; sem contraventamento vertical nas paredes (os pilares em balanço resistem).`);

  // ── Roof loads (CM + CV) on the top chords, tributary width sep ──
  const cargas = spec.loads || {};
  let qCM = cargas.dead_extra_kN_m2; if (qCM == null) { qCM = 0.2; addWarning('estimated', 'Roofing weight not given: 0.2 kN/m² (light metal roofing).'); }
  let qCV = cargas.live_load_kN_m2; if (qCV == null) { qCV = 1.0; addWarning('estimated', 'Roof live load not given: 1.0 kN/m².'); }
  const lcCM = { id: 1, name: 'CM', loads: [], selfWeight: true, type: 'static', specDir: null };
  const lcCV = { id: 2, name: 'CV', loads: [], selfWeight: false, type: 'static', specDir: null };
  for (let f = 0; f < Yf.length; f++) {
    const trib = tribOf(f);
    for (const tp of frames[f].tops) {
      if (tp.elemId == null) continue;
      lcCM.loads.push({ type: 'dist', elemId: tp.elemId, dir: 'gravity', w: +(qCM * trib * tp.dx / tp.Lsl).toFixed(6) });
      lcCV.loads.push({ type: 'dist', elemId: tp.elemId, dir: 'gravity', w: +(qCV * trib * tp.dx / tp.Lsl).toFixed(6) });
    }
  }
  const loadCases = [lcCM, lcCV];
  const combinations = [
    { id: 1, name: '1.4CM', factors: [{ lcId: 1, factor: 1.4 }] },
    { id: 2, name: '1.2CM+1.6CV', factors: [{ lcId: 1, factor: 1.2 }, { lcId: 2, factor: 1.6 }] },
  ];

  // ── Wind NBR 6123:2023 (preset Brasil) — 2 directions × each Cpi (the internal pressure acts on all faces) ──
  // p = q·(Cpe − Cpi), positive = toward the surface. Per frame, tributary width along Y. Walls → columns
  // (globalX); gables → the two end columns (globalY, tributary span/2 each); roof → top chord, normal to the
  // slope split into globalX and gravity (w > 0 downward). Wind +X (α = 90°): A windward wall x = 0, B
  // leeward, roof EFI (windward slope) / GHJ. Wind +Y (α = 0°): gable C at y = 0, D at y = length; side walls
  // A1B1 / A2B2 / A3B3 and roof EG / FH / IJ by the frame position (x0 = b/3 or a/4 ≤ 2h, then a/2). −X/−Y by
  // symmetry of the generated shed.
  const regras = libs.reglas || {};
  if (cargas.wind && regras.loads?.wind?.metodo === 'NBR6123') {
    const theta = Math.atan(2 * hR / luz), sn = Math.sin(theta), cs = Math.cos(theta);
    const vi = windLoad({ ...spec, geometry: { ...(spec.geometry || {}), roof_slope_deg: theta * 180 / Math.PI, length_m: umPortico ? sep : largo, width_m: luz } }, regras, H + hE + hR);
    for (const n of vi._notas || []) addWarning('info', `Vento: ${n}`);
    if (!(vi.q_Nm2 > 0)) addWarning('omitted', 'Vento NBR 6123 não calculado (ver avisos): galpão sem casos de vento.');
    else {
      const kN = (v) => (v || 0) / 1000;
      // every column member on the outer face (a single member, or all the outer-chord segments of a lattice column)
      const colAt = (x, yf) => elements.filter(e => { const a = nodes[e.n1 - 1], b = nodes[e.n2 - 1];
        return wallEls.has(e.id) && Math.abs(a.x - x) < 1e-6 && Math.abs(b.x - x) < 1e-6 && Math.abs(a.y - yf) < 1e-6 && Math.abs(b.y - yf) < 1e-6; }).map(e => e.id);
      const roof = (lc, f, trib, pW, pL) => {           // pW windward-slope (x < span/2), pL leeward
        const nH = frames[f].tops.length / 2;
        frames[f].tops.forEach((tp, i) => {
          if (tp.elemId == null) return;
          const p = kN(i < nH ? pW : pL), sx = i < nH ? sn : -sn;
          if (p === 0) return;
          lc.loads.push({ type: 'dist', elemId: tp.elemId, dir: 'globalX', w: +(p * trib * sx).toFixed(6) });
          lc.loads.push({ type: 'dist', elemId: tp.elemId, dir: 'gravity', w: +(p * trib * cs).toFixed(6) });
        });
      };
      let k = 0;
      for (const { cpi, presiones: P } of vi.presiones_por_cpi) {
        const cpiTxt = String(cpi).replace('.', ',');
        const lcX = { id: 3 + k++, name: `Viento X (Cpi ${cpiTxt})`, loads: [], selfWeight: false, type: 'static', specDir: null, _viento: vi, _cpi: cpi };
        // one frame = plane (2D) model: no out-of-plane (gable) wind case
        const lcY = umPortico ? null : { id: 3 + k++, name: `Viento Y (Cpi ${cpiTxt})`, loads: [], selfWeight: false, type: 'static', specDir: null, _viento: vi, _cpi: cpi };
        Yf.forEach((yf, f) => {
          const trib = tribOf(f), c0 = colAt(0, yf), cL = colAt(luz, yf);
          // +X (α = 90°)
          for (const id of c0) lcX.loads.push({ type: 'dist', elemId: id, dir: 'globalX', w: +(kN(P['1']) * trib).toFixed(6) });
          for (const id of cL) lcX.loads.push({ type: 'dist', elemId: id, dir: 'globalX', w: +(-kN(P['4']) * trib).toFixed(6) });
          roof(lcX, f, trib, P.EFI, P.GHJ);
          // +Y (α = 0°): region of the frame measured from the windward gable y = 0
          const reg = yf <= vi.x0_m + 1e-9 ? 1 : yf <= largo / 2 + 1e-9 ? 2 : 3;
          const pS = reg === 1 ? P.A1B1 : reg === 2 ? P.A2B2 : P.A3B3, pR = reg === 1 ? P.EG : reg === 2 ? P.FH : P.IJ;
          for (const id of c0) lcY?.loads.push({ type: 'dist', elemId: id, dir: 'globalX', w: +(kN(pS) * trib).toFixed(6) });
          for (const id of cL) lcY?.loads.push({ type: 'dist', elemId: id, dir: 'globalX', w: +(-kN(pS) * trib).toFixed(6) });
          if (lcY) roof(lcY, f, trib, pR, pR);
          if (f === 0 || f === Yf.length - 1) {          // gables: C (y = 0, pressure +Y) and D (y = length)
            const pG = f === 0 ? kN(P.C) : -kN(P.D);
            for (const c of [...c0, ...cL]) lcY?.loads.push({ type: 'dist', elemId: c, dir: 'globalY', w: +(pG * luz / 2).toFixed(6) });
            // the gable triangle above the eave (area span·rise/2, launch audit D4) on the top chord of the end frame:
            // w(x) = p·h(x), h = height of the triangle at x → trapezoidal per chord segment, resultant p·span·rise/2
            if (lcY && tipoPilar !== 'sem') for (const tp of frames[f].tops) {
              if (tp.elemId == null) continue;
              const e = elements[tp.elemId - 1], a = nodes[e.n1 - 1], b = nodes[e.n2 - 1];
              const h1 = zRoof(a.x) - hE, h2 = zRoof(b.x) - hE, k = tp.dx / tp.Lsl;   // per metre of horizontal width → per metre of the sloped chord
              if (h1 <= 0 && h2 <= 0) continue;
              lcY.loads.push({ type: 'dist', elemId: tp.elemId, dir: 'globalY', w: +(pG * h1 * k).toFixed(6), w2: +(pG * h2 * k).toFixed(6) });
            }
          }
        });
        loadCases.push(lcX, ...(lcY ? [lcY] : []));
      }
      addWarning('info', `Vento NBR 6123: q = ${vi.q_Nm2} N/m² (α = 90°), ${vi.q_empena_Nm2} N/m² (α = 0°); ${loadCases.length - 2} casos (X e Y × Cpi ${vi.cpi.join(' / ')}); −X/−Y por simetria.`);
    }
  }

  // ── Seismic NBR 15421:2023 (preset Brasil) — seismic category A (Tab. 5: zones 0 and 1), 7.3.2 ──
  // Zone 0 (ag < 0,025g): no seismic requirement. Zone 1 (0,025g ≤ ag ≤ 0,05g): horizontal forces
  // Fx = 0,01·wx applied simultaneously to all levels, independently in two orthogonal directions. Here wx is the
  // permanent weight (self-weight of every bar + roofing CM) applied as 1 % of each gravity load, at the same place,
  // horizontally (+X and +Y cases; −X/−Y by symmetry). The roof live load is not included (7.3.2: 25 % of the variable
  // load only in storage/parking areas). Zones 2–4 (categories B/C) need section 9 or a spectral analysis.
  if (cargas.seismic && regras.loads?.seismic?.metodo === 'NBR15421') {
    const sz = spec.seismic || {};
    const ag = sz.ag_g ?? sz.ag;
    const zona = sz.zona ?? sz.zone ?? (ag != null ? (ag < 0.025 ? 0 : ag <= 0.05 ? 1 : ag <= 0.10 ? 2 : ag <= 0.15 ? 3 : 4) : null);
    if (zona == null) addWarning('omitted', 'Sismo NBR 15421: informe seismic.zona ou seismic.ag_g (Fig. 1/Tab. 1) — galpão sem casos de sismo.');
    else if (+zona === 0) addWarning('info', 'Sismo NBR 15421: zona sísmica 0, categoria A — nenhum requisito de resistência sísmica é exigido (7.3.2).');
    else if (+zona === 1) {
      const secById = new Map([secCol, secCord, secDiag, ...(comContrav ? [secRod, secTerca] : []), ...(secLace ? [secLace] : []), ...(secSag ? [secSag] : [])].map(q => [q.id, q]));
      const lcEx = { id: loadCases.length + 1, name: 'Sismo X (NBR 15421 7.3.2)', loads: [], selfWeight: false, type: 'static', specDir: null };
      const lcEy = { id: loadCases.length + 2, name: 'Sismo Y (NBR 15421 7.3.2)', loads: [], selfWeight: false, type: 'static', specDir: null };
      let W = 0;
      const push = (eid, w, L) => {
        if (!(w > 0)) return;
        W += w * L;
        lcEx.loads.push({ type: 'dist', elemId: eid, dir: 'globalX', w: +(0.01 * w).toFixed(6) });
        lcEy.loads.push({ type: 'dist', elemId: eid, dir: 'globalY', w: +(0.01 * w).toFixed(6) });
      };
      const Lof = (e) => { const a = nodes.find(n => n.id === e.n1), b = nodes.find(n => n.id === e.n2); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); };
      const elById = new Map(elements.map(e => [e.id, e]));
      for (const e of elements) push(e.id, (+mats[e.matId - 1]?.rho || 0) * (+secById.get(e.secId)?.A || 0) * 9.80665, Lof(e));   // self-weight (as the solver)
      for (const ld of lcCM.loads) if (ld.type === 'dist' && ld.dir === 'gravity') push(ld.elemId, ld.w, Lof(elById.get(ld.elemId)));
      loadCases.push(lcEx, ...(umPortico ? [] : [lcEy]));
      addWarning('info', `Sismo NBR 15421: zona 1, categoria A — Fx = 0,01·wx (7.3.2) em X e em Y separadamente; peso permanente W = ${W.toFixed(1)} kN → H = ${(0.01 * W).toFixed(2)} kN por direção (sobrecarga de cobertura não incluída). W é só o peso do modelo: some fechamentos, forros, instalações e equipamentos fixos; em armazenamento, 25 % da variável. Requisito mínimo da categoria A.`);
      if (!comContrav) addWarning('omitted', 'Sismo NBR 15421 zona 1: sem contraventamento o galpão não tem sistema resistente declarado na direção Y (7.3.2 exige duas direções ortogonais e mecanismo de torção).');
    } else addWarning('omitted', `Sismo NBR 15421: zona ${zona} (categoria ${+zona === 2 ? 'B' : 'C'}) exige o método das forças horizontais equivalentes (seção 9) ou análise espectral — não gerado para o galpão.`);
  }

  return {
    // a single frame is solved as a plane frame (X–Z: uy, rx, rz locked by the solver) but stays in the 3D view
    version: '1.0', units: 'kN-m', mode: '3D', ...(umPortico ? { planar: true } : {}), layers: usedLayers, activeLayer: 1,
    // only the sections some member uses (roof only: no column section; one frame: no purlin/rod) — lists/quantities
    nodes, elements, materials: mats, sections: [secCol, secCord, secDiag, ...(comContrav ? [secRod, secTerca] : []), ...(secLace ? [secLace] : []), ...(secSag ? [secSag] : [])]
      .filter(q => q && elements.some(e => e.secId === q.id)), diaphragms: [],
    loadCases, combinations,
    grids: { x: [0, luz], y: Yf, z: [0, H, ...(hE > 0 ? [+(H + hE).toFixed(4)] : []), +(H + hE + hR).toFixed(4)] },
    _counters: { nodes: nodes.length, elements: elements.length, materials: mats.length, sections: 3 + (comContrav ? 2 : 0) + (secLace ? 1 : 0) + (secSag ? 1 : 0), diaphragms: 0, loadCases: loadCases.length, combinations: 2 },
    _generado: {
      por: 'assistant/generator.js (warehouse)',
      reglas: (libs.reglas && libs.reglas._meta) ? libs.reglas._meta.version : undefined,
      resumen: `warehouse ${esMadera ? 'madera' : 'acero'} luz ${luz} m × largo ${largo} m, ${Yf.length} frames @${sep} m, trusses ${tCel} pend. ${(slope * 100).toFixed(0)}%: ${nodes.length} nodes, ${elements.length} bars`,
      resumenT: { k: 'nave de {mat}, luz {luz} m × largo {largo} m, {nf} pórticos @{sep} m, cerchas {tc} con pendiente {pend}%: {nn} nudos, {ne} barras',
        v: { mat: esMadera ? 'madera' : 'acero', luz, largo, nf: Yf.length, sep, tc: tCel, pend: +(slope * 100).toFixed(0), nn: nodes.length, ne: elements.length } },
    },
    _warnings: warnings,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// PRIMITIVES typology (FREE structure) — for ANY structure, even those without a
// template (towers, masts, grillages, bridges of N girders…).
//   The assistant places ELEMENTS at coordinates; the code does the engineering:
//   merges nodes by coordinate (members sharing a point are joined), resolves
//   sections/materials, applies loads and validates. Deterministic and safe.
//
//   spec.elements[]:
//     {type:"beam"|"column"|"bar", from:[x,y,z], to:[x,y,z],
//      section:{b_cm,h_cm}|"IPE300"|"2x4", material?, n?, carga_kN_m?}
//     {type:"repeated_beams", desde, hasta, step_dir:"X|Y|Z", paso,
//      n_repeticiones (o hasta_coord), seccion, material?, n?, carga_kN_m?}
//   spec.supports[]: {en:[[x,y,z],…]|z:0, type:"fixed"|"pinned"|"roller"|{ux,…}}
// ──────────────────────────────────────────────────────────────────────────────
export function generateFromPrimitives(spec, libs) {
  const materiales = libs.materiales || [], perfiles = libs.perfiles || [];
  const warnings = []; const addWarning = (t, m) => warnings.push({ type: t, msg: m });
  const matByName = new Map(materiales.map((m) => [String(m.nombre).trim().toLowerCase(), m]));
  const matDefRaw = spec.default_material ?? (spec.sections || {}).material;
  const matDef = resolveFlexMaterial(matDefRaw, materiales, addWarning) ||
    (matByName.get('s275') ? rowToMaterial(matByName.get('s275')) : { name: 'S275', E: 2.1e8, G: 8.08e7, nu: 0.3, rho: 7.85 });

  const materials = [], matId = new Map();
  const useMat = (n) => {
    const r = (n != null ? resolveFlexMaterial(n, materiales, addWarning) : null) || matDef;
    if (!matId.has(r.name)) { const id = materials.length + 1; materials.push({ ...r, id }); matId.set(r.name, id); }
    return matId.get(r.name);
  };
  const sections = [], secId = new Map();
  const useSec = (spec, label) => {
    const s = pickSection(spec, perfiles, { b_cm: 20, h_cm: 40 }, label || 'Sección', addWarning);
    if (!secId.has(s.name)) { const id = sections.length + 1; sections.push({ ...s, id }); secId.set(s.name, id); }
    return secId.get(s.name);
  };

  const nodes = [], elements = []; let nid = 0, eid = 0; const nodeAt = new Map(), elemAt = new Set();
  const rk = (v) => Math.round((+v) * 1e4) / 1e4;
  const getNode = (x, y, z) => {
    const k = `${rk(x)}|${rk(y)}|${rk(z)}`; let id = nodeAt.get(k);
    if (id == null) { id = ++nid; nodeAt.set(k, id); nodes.push({ id, x: rk(x), y: rk(y), z: rk(z), restraints: { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }, nodeMass: { mx: 0, my: 0, mz: 0 }, springs: { kux: 0, kuy: 0, kuz: 0, krx: 0, kry: 0, krz: 0 } }); }
    return id;
  };
  const addEl = (n1, n2, sid, mid) => { if (n1 == null || n2 == null || n1 === n2) return null; const ek = `${Math.min(n1, n2)}-${Math.max(n1, n2)}`; if (elemAt.has(ek)) return null; elemAt.add(ek); const id = ++eid; elements.push({ id, n1, n2, matId: mid, secId: sid, releases: Array(12).fill(0) }); return id; };
  // beam from a→b with n subdivisions (intermediate nodes → better deflection and load sharing)
  const memberBetween = (a, b, sid, mid, n = 1) => {
    n = Math.max(1, Math.round(n || 1)); const out = []; let prev = getNode(a[0], a[1], a[2]);
    for (let i = 1; i <= n; i++) { const t = i / n; const cur = getNode(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); const e = addEl(prev, cur, sid, mid); if (e) out.push(e); prev = cur; }
    return out;
  };

  const lcCM = { id: 1, name: 'CM', loads: [], selfWeight: true, type: 'static', specDir: null };
  const lcCV = { id: 2, name: 'CV', loads: [], selfWeight: false, type: 'static', specDir: null };
  const elemCarga = new Map();   // elemId → w (kN/m) ; rebuilt after the mesh splitting
  const load = (els, w) => { if (!(w > 0)) return; for (const e of els) if (e != null) elemCarga.set(e, +(+w).toFixed(6)); };

  for (const el of (spec.elements || [])) {
    const tipo = String(el.type || 'beam').toLowerCase();
    const sid = useSec(el.section, el.type);
    const mid = useMat(el.material);
    if (/repeat|repet|grilla|paralel/.test(tipo)) {
      if (!Array.isArray(el.from) || !Array.isArray(el.to)) { addWarning('omitted', `Element "${tipo}" without valid from/to: omitted.`); continue; }
      const dir = String(el.step_dir || el.repeat_dir || 'Y').toUpperCase();
      const paso = el.step > 0 ? el.step : 1;
      const idx = dir === 'X' ? 0 : dir === 'Z' ? 2 : 1;
      let nrep = el.n_repeat > 0 ? Math.round(el.n_repeat)
        : (el.to_coord != null ? Math.floor(Math.abs(el.to_coord - el.from[idx]) / paso + 1e-6) + 1 : 1);
      nrep = Math.min(2000, Math.max(1, nrep));
      const all = [];
      for (let r = 0; r < nrep; r++) {
        const off = [0, 0, 0]; off[idx] = paso * r;
        const a = [el.from[0] + off[0], el.from[1] + off[1], el.from[2] + off[2]];
        const b = [el.to[0] + off[0], el.to[1] + off[1], el.to[2] + off[2]];
        all.push(...memberBetween(a, b, sid, mid, el.n || 1));
      }
      load(all, el.load_kN_m);
    } else {
      if (!Array.isArray(el.from) || !Array.isArray(el.to)) { addWarning('omitted', `Element "${tipo}" without valid from/to: omitted.`); continue; }
      load(memberBetween(el.from, el.to, sid, mid, el.n || 1), el.load_kN_m);
    }
  }

  // ── Auto-connection of meshes: joins members that cross or whose endpoint falls
  //    on another member (inserts the crossing node and splits the members). Makes a
  //    grillage/tower connected even when the crossing falls mid-member. ──
  const conectarMalla = () => {
    const tol = 1e-3, tol2 = tol * tol;
    const P = (id) => { const n = nodes[id - 1]; return [n.x, n.y, n.z]; };
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const d2 = (a, b) => { const d = sub(a, b); return dot(d, d); };
    // 1) nodes at interior crossings (mid–mid) of pairs of members
    const seg = elements.map((e) => [P(e.n1), P(e.n2)]);
    for (let i = 0; i < seg.length; i++) for (let j = i + 1; j < seg.length; j++) {
      const [a1, a2] = seg[i], [b1, b2] = seg[j];
      const d1 = sub(a2, a1), d2v = sub(b2, b1), r = sub(a1, b1);
      const A = dot(d1, d1), E = dot(d2v, d2v), F = dot(d2v, r), C = dot(d1, r), B = dot(d1, d2v);
      const den = A * E - B * B; if (Math.abs(den) < 1e-9) continue;
      const s = (B * F - C * E) / den, t = (A * F - B * C) / den;
      if (s <= 1e-4 || s >= 1 - 1e-4 || t <= 1e-4 || t >= 1 - 1e-4) continue;
      const p1 = add(a1, mul(d1, s)), p2 = add(b1, mul(d2v, t));
      if (d2(p1, p2) > tol2) continue;          // skew: they don't intersect
      getNode(p1[0], p1[1], p1[2]);              // creates the crossing node
    }
    // 2) splits each member at the interior collinear nodes (incl. others' endpoints)
    const nuevos = [], seen = new Set(), cargaN = new Map();
    for (const e of elements) {
      const a = P(e.n1), b = P(e.n2), L2 = d2(a, b); if (L2 < 1e-12) continue;
      const on = [];
      for (const n of nodes) {
        if (n.id === e.n1 || n.id === e.n2) continue;
        const p = [n.x, n.y, n.z], tt = dot(sub(p, a), sub(b, a)) / L2;
        if (tt <= 1e-4 || tt >= 1 - 1e-4) continue;
        if (d2(add(a, mul(sub(b, a), tt)), p) > tol2) continue;
        on.push({ id: n.id, t: tt });
      }
      const w = elemCarga.get(e.id);
      on.sort((u, v) => u.t - v.t);
      let prev = e.n1; const seq = [...on.map((o) => o.id), e.n2];
      for (const nid of seq) {
        const ek = `${Math.min(prev, nid)}-${Math.max(prev, nid)}`;
        if (prev !== nid && !seen.has(ek)) { seen.add(ek); const ne = { id: nuevos.length + 1, n1: prev, n2: nid, matId: e.matId, secId: e.secId, releases: Array(12).fill(0) }; nuevos.push(ne); if (w != null) cargaN.set(ne.id, w); }
        prev = nid;
      }
    }
    elements.length = 0; for (const e of nuevos) elements.push(e);
    elemCarga.clear(); for (const [k, v] of cargaN) elemCarga.set(k, v);
  };
  if (elements.length && elements.length < 4000) conectarMalla();

  const presetR = (t) => {
    t = String(t || 'fixed').toLowerCase();
    if (/empotr|fij|fix/.test(t)) return { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };
    if (/rotul|pin|articul/.test(t)) return { ux: 1, uy: 1, uz: 1, rx: 0, ry: 0, rz: 0 };
    if (/rodillo|roller/.test(t)) return { uz: 1 };
    return { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 };
  };
  for (const ap of (spec.supports || [])) {
    const r = (ap.type && typeof ap.type === 'object') ? ap.type : presetR(ap.type || ap.restr);
    const setN = (id) => { if (id != null) nodes[id - 1].restraints = { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0, ...r }; };
    if (Array.isArray(ap.en)) for (const p of ap.en) {
      const id = nodeAt.get(`${rk(p[0])}|${rk(p[1])}|${rk(p[2])}`);
      if (id != null) setN(id); else addWarning('omitted', `Support at (${p.join(',')}) does not match any node.`);
    }
    if (ap.z != null) for (const n of nodes) if (Math.abs(n.z - ap.z) < 1e-4) n.restraints = { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0, ...r };
  }

  // Loads (after the mesh splitting): vertical line load per member → CV case.
  for (const e of elements) { const w = elemCarga.get(e.id); if (w > 0) lcCV.loads.push({ type: 'dist', elemId: e.id, dir: 'gravity', w }); }

  // Validation (does not fail; warns) — key to the improvement loop.
  const usados = new Set(); for (const e of elements) { usados.add(e.n1); usados.add(e.n2); }
  const sueltos = nodes.filter((n) => !usados.has(n.id)).length;
  if (sueltos) addWarning('info', `${sueltos} node(s) with no connected elements.`);
  if (!nodes.some((n) => Object.values(n.restraints).some((v) => v))) addWarning('omitted', 'No supports defined: add "supports" or the model will be unstable.');
  if (!elements.length) addWarning('omitted', 'No element was generated: check "elements" (each one needs from/to).');

  const is2D = spec.mode === '2D';
  return {
    version: '1.0', units: 'kN-m', mode: is2D ? '2D' : '3D',
    nodes, elements, materials: materials.length ? materials : [{ ...matDef, id: 1 }], sections, diaphragms: [],
    loadCases: [lcCM, lcCV],
    combinations: [{ id: 1, name: '1.4CM', factors: [{ lcId: 1, factor: 1.4 }] }, { id: 2, name: '1.2CM+1.6CV', factors: [{ lcId: 1, factor: 1.2 }, { lcId: 2, factor: 1.6 }] }],
    grids: { x: [], y: [], z: [] },
    _counters: { nodes: nodes.length, elements: elements.length, materials: materials.length, sections: sections.length, diaphragms: 0, loadCases: 2, combinations: 2 },
    _generado: {
      por: 'assistant/generator.js (primitives)',
      reglas: (libs.reglas && libs.reglas._meta) ? libs.reglas._meta.version : undefined,
      resumen: `free structure (primitives): ${nodes.length} nodes, ${elements.length} elements, ${materials.length} material(s), ${sections.length} section(s)`,
    },
    _warnings: warnings,
  };
}
