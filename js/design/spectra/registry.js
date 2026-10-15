// ──────────────────────────────────────────────────────────────────────────────
// spectra/registry.js — Registry of pluggable SEISMIC DESIGN SPECTRA (PLANO_BRASIL 5.5).
//
// Same idea as design/registry.js: each code registers { id, label, build(params) } where build
// returns { curve:[{T,Sa}], text, Sa0, params, ... } (the shape of nch433_spectrum.buildSpectrum).
// NCh433 is registered by js/design/spectra/index.js with the existing buildSpectrum, unchanged.
// ──────────────────────────────────────────────────────────────────────────────

const _spectra = new Map();
let _default = null;

export function registerSpectrum(spec) {
  if (!spec || !spec.id || typeof spec.build !== 'function') throw new Error('Spectrum needs { id, build }.');
  _spectra.set(spec.id, spec);
  if (!_default) _default = spec.id;
  return spec;
}
export function getSpectrum(id) { return _spectra.get(id ?? _default) || null; }
export function listSpectra() { return [..._spectra.values()]; }
export function setDefaultSpectrum(id) { if (_spectra.has(id)) _default = id; }
export function defaultSpectrumId() { return _default; }
