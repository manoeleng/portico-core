// ──────────────────────────────────────────────────────────────────────────────
// num — leitura de números digitados em campos de TEXTO (PLANO_BRASIL 3.4).
//
// Aceita vírgula ou ponto como separador decimal ("2,5" = "2.5"); com os dois, o último
// é o decimal e o outro é separador de milhar ("1.234,5" = "1,234.5" = 1234.5).
// O valor armazenado é sempre Number (ponto). Campos type="number" não passam por
// aqui: o navegador já entrega .value com ponto.
// ──────────────────────────────────────────────────────────────────────────────

export function parseNum(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if (c >= 0 && d >= 0) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c >= 0) s = s.replace(',', '.');
  return parseFloat(s);
}
