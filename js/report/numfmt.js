// numfmt.js — number/CSV locale helpers (no DOM; the locale comes in as a parameter).
// 'pt': decimal comma, no thousands separator; CSV field separator ';'.
// 'es' / 'en': identical to the historical output (identity).

/** Decimal-point → comma for 'pt'; any other locale returns the string unchanged. */
export function localizeNum(s, locale) {
  return locale === 'pt' ? String(s).replace('.', ',') : String(s);
}

/** (+v).toFixed(dec), localized. */
export function numFmt(v, dec, locale) {
  return localizeNum((+v).toFixed(dec), locale);
}

export function csvSep(locale) { return locale === 'pt' ? ';' : ','; }

const NUM_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

function splitFields(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { q = !q; cur += c; }
    else if (c === ',' && !q) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Converts a comma-separated CSV text (as built by the exporters) to the locale's convention.
 * 'es'/'en': returns the input untouched. 'pt': ';' separator + decimal comma on numeric
 * fields; free-text '#' comment lines are kept, '# A, B, C' column-header comments get ';'.
 */
export function csvLocalize(csv, locale) {
  if (locale !== 'pt') return csv;
  return csv.replace(/^.*$/gm, line => {
    if (line.startsWith('#')) {
      return /^# ?[\w.]+(, ?[\w.]+)+$/.test(line) ? line.replace(/, ?/g, ';') : line;
    }
    if (line === '') return line;
    return splitFields(line).map(f => {
      const t = f.trim();
      return NUM_RE.test(t) ? t.replace('.', ',') : t;
    }).join(';');
  });
}
