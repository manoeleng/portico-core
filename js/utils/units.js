// units.js — DISPLAY units (what the user reads and types). The model, the solvers and the design codes always work
// in kN, m (and kN/m², kN·m …): coefficients, load tables (NBR 6120) and material values are in those units. This
// module only converts at the interface — a value typed in tf is stored in kN, a stored kN is shown in tf.
//
// Systems: 'kN-m' (identity) and 'tf-m' (1 tf = 9,80665 kN — the tonne-force: 1000 kgf with standard gravity
// gₙ = 9,80665 m/s², CGPM 1901/BIPM SI Brochure). The length unit is the metre in both, so EVERY quantity that
// contains a force scales by the same factor; masses (t = kN·s²/m), lengths, angles and dimensionless ratios do not
// change.
//
// Kinds (label in each system):
//   F  force             kN        tf            M   moment            kN·m      tf·m
//   W  force / length    kN/m      tf/m          Q   force / area      kN/m²     tf/m²   (pressure, stress, E, G)
//   K  transl. stiffness kN/m      tf/m          KR  rot. stiffness    kN·m/rad  tf·m/rad
//   KW subgrade modulus  kN/m/m    tf/m/m        G   unit weight       kN/m³     tf/m³
//   MW moment / length   kN·m/m    tf·m/m        (plates)

export const KN_PER_TF = 9.80665;

const LBL = {
  F: ['kN', 'tf'], M: ['kN·m', 'tf·m'], W: ['kN/m', 'tf/m'], Q: ['kN/m²', 'tf/m²'],
  K: ['kN/m', 'tf/m'], KR: ['kN·m/rad', 'tf·m/rad'], KW: ['kN/m/m', 'tf/m/m'], G: ['kN/m³', 'tf/m³'],
  MW: ['kN·m/m', 'tf·m/m'],
};

let _sys = 'kN-m';
const _listeners = new Set();

/** Normalizes legacy / alias names: 'ton-m', 'tf-m', 'tf' → 'tf-m'; anything else → 'kN-m'. */
export function normUnits(s) { return /^(ton|tf)/i.test(String(s || '')) ? 'tf-m' : 'kN-m'; }
export function setUnits(s) {
  const n = normUnits(s);
  if (n === _sys) return;
  _sys = n;
  for (const fn of _listeners) try { fn(_sys); } catch { /* listener error must not break the switch */ }
}
export function getUnits() { return _sys; }
export function isTf() { return _sys === 'tf-m'; }
export function onUnitsChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }

const f = () => (_sys === 'tf-m' ? 1 / KN_PER_TF : 1);
/** stored (kN-based) → displayed value. `kind` is documentary: every force-bearing kind scales alike. */
export function toDisp(v, kind = 'F') { void kind; const x = +v; return Number.isFinite(x) ? x * f() : v; }
/** typed (displayed) → stored (kN-based) value. */
export function fromDisp(v, kind = 'F') { void kind; const x = +v; return Number.isFinite(x) ? x / f() : v; }
/** unit label of a kind in the current system. */
export function ulbl(kind = 'F') { return (LBL[kind] || LBL.F)[_sys === 'tf-m' ? 1 : 0]; }
/** displayed value formatted with `dec` decimals (comma decimal separator in pt) — plus the unit when `withUnit`. */
export function fmtU(v, kind = 'F', dec = 2, withUnit = true) {
  const x = toDisp(v, kind);
  const s = Number.isFinite(+x) ? (+x).toFixed(dec) : String(x);
  return withUnit ? `${s} ${ulbl(kind)}` : s;
}

/**
 * Attributes of an <input> that shows a stored (kN-based) value: value rounded to 6 significant digits in tf-m
 * (exact in kN-m) + the exact stored value in data-kn. readIn() returns the exact value when the field was not
 * edited — re-saving a form never drifts the values it did not touch.
 */
export function inVal(v, kind = 'F') {
  const x = +v;
  const disp = !Number.isFinite(x) ? String(v ?? '') : _sys === 'tf-m' ? String(+toDisp(x, kind).toPrecision(6)) : String(x);
  return `value="${disp}" data-kn="${Number.isFinite(x) ? x : ''}" data-disp="${disp}"`;
}
/** stored (kN-based) value of an <input> filled with inVal (or a plain one): exact if untouched, else fromDisp(typed). */
export function readIn(el, kind = 'F', fallback = 0) {
  if (!el) return fallback;
  const raw = String(el.value ?? '');
  if (el.dataset && el.dataset.kn !== undefined && el.dataset.kn !== '' && raw === el.dataset.disp) return +el.dataset.kn;
  const x = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(x) ? fromDisp(x, kind) : fallback;
}
