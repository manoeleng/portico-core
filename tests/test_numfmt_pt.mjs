import { localizeNum, numFmt, csvSep, csvLocalize } from '../js/report/numfmt.js';
let fail = 0;
const eq = (n, a, b) => { if (a === b) console.log('✓ ' + n); else { fail++; console.log('✗ ' + n + ' → ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); } };

eq('pt 3 casas', numFmt(1234.5678, 3, 'pt'), '1234,568');
eq('es 3 casas', numFmt(1234.5678, 3, 'es'), '1234.568');
eq('en 3 casas', numFmt(1234.5678, 3, 'en'), '1234.568');
eq('pt exponencial', localizeNum((1.2345e-5).toExponential(2), 'pt'), '1,23e-5');
eq('es exponencial', localizeNum((1.2345e-5).toExponential(2), 'es'), '1.23e-5');
eq('pt dash', localizeNum('—', 'pt'), '—');
eq('sep pt', csvSep('pt'), ';');
eq('sep es', csvSep('es'), ',');
eq('sep en', csvSep('en'), ',');

const csv = '# PORTICO — Resultados\r\n#\r\n# NodeID, Ux, Uy\r\n1, 1.500000e-3, -2.000000e+0\r\n' +
  'elem,seccion,DC\n3,"W 10, x",0.8500\n';
eq('csv es idêntico', csvLocalize(csv, 'es'), csv);
eq('csv en idêntico', csvLocalize(csv, 'en'), csv);
eq('csv pt',
  csvLocalize(csv, 'pt'),
  '# PORTICO — Resultados\r\n#\r\n# NodeID;Ux;Uy\r\n1;1,500000e-3;-2,000000e+0\r\n' +
  'elem;seccion;DC\n3;"W 10, x";0,8500\n');

if (fail) { console.log(`\n${fail} falha(s)`); process.exit(1); }
console.log('\nOK');
