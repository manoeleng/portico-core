// test_i18n_pt.mjs — paridad del diccionario PT (pt-BR) con el EN (PLANO_BRASIL 1.7)
//   node test_i18n_pt.mjs
import { EN } from '../js/i18n/dict.en.js';
import { PT } from '../js/i18n/dict.pt.js';

let fails = 0;
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
const list = (a) => a.slice(0, 10).map(k => JSON.stringify(k)).join(', ') + (a.length > 10 ? ` … (+${a.length - 10})` : '');

const enKeys = Object.keys(EN), ptKeys = Object.keys(PT);

// (1) Mismas claves en los dos diccionarios.
{
  const missing = enKeys.filter(k => !(k in PT));
  const extra = ptKeys.filter(k => !(k in EN));
  assert(`1a. toda clave de EN existe en PT (${enKeys.length})`, missing.length === 0, missing.length ? 'faltan: ' + list(missing) : '');
  assert(`1b. toda clave de PT existe en EN (${ptKeys.length})`, extra.length === 0, extra.length ? 'sobran: ' + list(extra) : '');
}
// (2) Ningún valor PT vacío.
{
  const empty = ptKeys.filter(k => typeof PT[k] !== 'string' || !PT[k].trim());
  assert('2. ningún valor PT vacío', empty.length === 0, empty.length ? list(empty) : '');
}
// (3) Placeholders, código y emojis se conservan: los mismos tokens que en EN.
{
  const RX = /\$\{[^}]*\}|\{[^}\s]*\}|%[sd]|\p{Extended_Pictographic}/gu;
  const toks = (s) => (String(s).match(RX) || []).sort().join('|');
  const bad = ptKeys.filter(k => k in EN && toks(PT[k]) !== toks(EN[k]));
  assert('3. placeholders/emojis iguales a EN', bad.length === 0, bad.length ? list(bad) : '');
}
// (4) Glosario: términos en español que no pueden quedar en PT.
{
  const RX = /\b(Hormig[oó]n|Columna|Losa|Pandeo|Volcamiento|Cuant[ií]a|Recubrimiento|Memoria de c[aá]lculo|Empotramiento|Fundaci[oó]n)\b/i;
  const bad = ptKeys.filter(k => RX.test(PT[k]));
  assert('4. glosario NBR (sin términos en español)', bad.length === 0, bad.length ? list(bad) : '');
}

console.log(fails ? `\n${fails} FALLA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
