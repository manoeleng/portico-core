// test_profiles_br.mjs — perfis brasileiros laminados W/HP (Gerdau), propriedades tabeladas (PLANO_BRASIL 8.1)
//   node tests/test_profiles_br.mjs
import fs from 'fs';
import { CATALOG, catalogNames, profileToSection } from '../js/design/profiles.js';
import { resolveSectionProps, fromShape } from '../js/design/section_props.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

const CSV = 'C:/projetos/StructPro-Pro/src/StructPro.Sections/data/laminados-gerdau.csv';
const rows = {};
if (fs.existsSync(CSV)) {
  const L = fs.readFileSync(CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  const hdr = L[0].split(';');
  for (const l of L.slice(1)) { const c = l.split(';'); const o = {}; hdr.forEach((k, i) => { o[k] = i < 2 ? c[i] : parseFloat(c[i]); }); rows[o.Nome] = o; }
} else { fails++; console.log('✗ CSV de origem não encontrado: ' + CSV); }

// (a) famílias e quantidades
assert('a1. família W com 81 perfis', catalogNames('W').length === 81, String(catalogNames('W').length));
assert('a2. família HP com 7 perfis', catalogNames('HP').length === 7, String(catalogNames('HP').length));
assert('a3. 88 perfis no CSV, todos no catálogo', Object.keys(rows).length === 88 && Object.keys(rows).every(n => CATALOG.W[n] || CATALOG.HP[n]));

// (b)+(c) 3 perfis vs CSV
for (const n of ['W 150 x 13,0', 'W 410 x 38,8', 'HP 310 x 125,0']) {
  const r = rows[n]; const s = profileToSection(n);
  assert(`${n}: existe`, !!r && !!s);
  if (!r || !s) continue;
  ok(`${n} A`, s.A, r.A_cm2 * 1e-4, 1e-9);
  ok(`${n} Iz (=Ix cat.)`, s.Iz, r.Ix_cm4 * 1e-8, 1e-9);
  ok(`${n} Iy`, s.Iy, r.Iy_cm4 * 1e-8, 1e-9);
  ok(`${n} J (=It)`, s.J, r.It_cm4 * 1e-8, 1e-9);
  const p = resolveSectionProps(s);
  ok(`${n} Zz`, p.Zz, r.Zx_cm3 * 1e-6, 1e-9);
  ok(`${n} Sz`, p.Sz, r.Wx_cm3 * 1e-6, 1e-9);
  ok(`${n} Zy`, p.Zy, r.Zy_cm3 * 1e-6, 1e-9);
  ok(`${n} Sy`, p.Sy, r.Wy_cm3 * 1e-6, 1e-9);
  ok(`${n} Cw`, p.Cw, r.Cw_cm6 * 1e-12, 1e-9);
  ok(`${n} rz`, p.rz, r.rx_cm * 1e-2, 1e-9);
  ok(`${n} ry`, p.ry, r.ry_cm * 1e-2, 1e-9);
  ok(`${n} lambdaWeb = h/tw`, p.lambdaWeb, r.h_cm / r.tw_cm, 1e-9);
  ok(`${n} lambdaFlange = bf/2tf`, p.lambdaFlange, r.bf_cm / (2 * r.tf_cm), 1e-9);
  assert(`${n} fabricacao laminado`, p.fabricacao === 'laminado');
  ok(`${n} A em resolveSectionProps (modelo)`, p.A, r.A_cm2 * 1e-4, 1e-9);
}

// (d) famílias existentes inalteradas: IPE300 == fromShape direto, sem campos extras
{
  const s = profileToSection('IPE300'); const g = fromShape('I', { d: 300 / 1000, bf: 150 / 1000, tw: 7.1 / 1000, tf: 10.7 / 1000 });
  ok('d1. IPE300 A', s.A, g.A, 0); ok('d2. IPE300 Iz', s.Iz, g.Iz, 0);
  ok('d3. IPE300 Iy', s.Iy, g.Iy, 0); ok('d4. IPE300 J', s.J, g.J, 0);
  ok('d5. IPE300 Avy', s.Avy, g.Avz_web, 0); ok('d6. IPE300 Avz', s.Avz, g.Avy_flange, 0);
  assert('d7. IPE300 design só shape/dims/profile', Object.keys(s.design).join() === 'shape,dims,profile');
  assert('d8. famílias europeias sem tab', ['IPE', 'HEA', 'HEB', 'CHS', 'RHS/SHS'].every(f => Object.values(CATALOG[f]).every(p => !p.tab)));
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
