// ──────────────────────────────────────────────────────────────────────────────
// csv — CSV reader for the assistant libraries (profiles, materials, live loads).
//
// RFC 4180 subset: comma separator, fields in double quotes may contain commas and ""
// (escaped quote); lines starting with # are comments. The Brazil preset needs it:
// "W 150 x 13,0" and NBR 6120 descriptions contain commas.
// ──────────────────────────────────────────────────────────────────────────────

export function parseCSVLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCSV(txt) {
  const lines = String(txt).split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  if (!lines.length) return [];
  const head = parseCSVLine(lines[0]);
  return lines.slice(1).map(l => { const c = parseCSVLine(l); return Object.fromEntries(head.map((h, i) => [h, c[i]])); });
}
