// test_spectra_registry.mjs — registro de espectros (PLANO_BRASIL 5.5): NCh433 via registro debe ser
// IDÉNTICO (bit a bit) a la llamada directa a nch433_spectrum.buildSpectrum.
//   node tests/test_spectra_registry.mjs
import { buildSpectrum } from '../js/design/nch433_spectrum.js';
import { getSpectrum, listSpectra, defaultSpectrumId } from '../js/design/spectra/index.js';

let fails = 0;
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

assert('1. NCh433 registrado y por defecto', !!getSpectrum('NCh433') && defaultSpectrumId() === 'NCh433');
assert('2. listSpectra incluye NCh433', listSpectra().some(s => s.id === 'NCh433'));
let n = 0;
for (const soil of ['A', 'B', 'C', 'D', 'E']) for (const zone of [1, 2, 3]) for (const category of ['I', 'II', 'III'])
  for (const Tstar of [null, 0.35, 1.2]) for (const applyRstar of [true, false]) {
    const o = { soil, zone, category, Tstar, applyRstar };
    const a = JSON.stringify(buildSpectrum(o)), b = JSON.stringify(getSpectrum('NCh433').build(o));
    if (a !== b) { fails++; console.log(`✗ diferente: ${JSON.stringify(o)}`); }
    n++;
  }
assert(`3. ${n} combinaciones idénticas (registro × directo)`, fails === 0);

console.log(fails ? `\n${fails} FALLA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
