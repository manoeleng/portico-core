// spectra/index.js — registers the built-in spectra. NCh433 (DS61) keeps its single source of truth in
// js/design/nch433_spectrum.js; it is wrapped here without any change to its results.
import { registerSpectrum, getSpectrum, listSpectra, setDefaultSpectrum, defaultSpectrumId } from './registry.js?v=7';
import { buildSpectrum as buildNCh433 } from '../nch433_spectrum.js?v=7';

registerSpectrum({ id: 'NCh433', label: 'NCh433 Of.1996 Mod.2009 / DS61', build: buildNCh433 });

export { registerSpectrum, getSpectrum, listSpectra, setDefaultSpectrum, defaultSpectrumId };
