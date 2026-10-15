// test_profiles_nbr5884.mjs — perfis soldados VS/CVS/CS (PLANO_BRASIL 8.1)
//   node tests/test_profiles_nbr5884.mjs
// Oráculo: ABNT NBR 5884:2005, Tab. B.1 (CS), B.2 (CVS) e B.3 (VS), lidas nas páginas escaneadas do PDF
// do acervo (_referencias). A = cm², I = cm⁴, Zx = cm³, It = cm⁴. A tabela arredonda a 3–4 algarismos
// (A a 0,1 cm²) → tolerância 0,5 %. A geometria vem da biblioteca do usuário; as propriedades, de fromShape.
import { CATALOG, catalogNames, profileToSection } from '../js/design/profiles.js';
import { resolveSectionProps } from '../js/design/section_props.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

// (a) famílias e quantidades da biblioteca
assert('a1. VS com 98 perfis', catalogNames('VS').length === 98, String(catalogNames('VS').length));
assert('a2. CVS com 90 perfis', catalogNames('CVS').length === 90, String(catalogNames('CVS').length));
assert('a3. CS com 108 perfis', catalogNames('CS').length === 108, String(catalogNames('CS').length));
assert('a4. todos marcados soldado', ['VS', 'CVS', 'CS'].every(f => Object.values(CATALOG[f]).every(p => p.fabricacao === 'soldado')));
assert('a5. tf 12,3 da biblioteca corrigido (VS 750 x 108, Tab. B.3)', !!CATALOG.VS['VS 750 x 320 (12.5/8)'] && !CATALOG.VS['VS 750 x 320 (12.3/8)']);

// (b) amostra contra a NBR 5884:2005 — [nome, perfil NBR, A, Ix, Iy, Zx, It (null = não conferido)]
const NBR = [
  ['CS 200 x 200 (8/6.3)', 'CS 200x34 (B.1)', 43.5, 3278, 1067, 361, null],
  ['CS 300 x 300 (9.5/8)', 'CS 300x62 (B.1)', 79.5, 13509, 4276, 986, null],
  ['CS 400 x 400 (12.5/9.5)', 'CS 400x106 (B.1)', 135.6, 41727, 13336, 2271, null],
  ['CS 500 x 500 (16/12.5)', 'CS 500x172 (B.1)', 218.5, 104414, 33341, 4556, 168],
  ['CS 600 x 600 (19/16)', 'CS 600x250 (B.1)', 317.9, 216146, 68419, 7887, 354],
  ['CVS 300 x 200 (9.5/8)', 'CVS 300x47 (B.2)', 60.5, 9499, 1266, 710, 16.4],
  ['CVS 350 x 250 (12.5/9.5)', 'CVS 350x73 (B.2)', 93.4, 20524, 3258, 1306, null],
  ['CVS 400 x 300 (12.5/9.5)', 'CVS 400x87 (B.2)', 110.6, 32339, 5628, 1787, 50.1],
  ['CVS 650 x 450 (19/16)', 'CVS 650x211 (B.2)', 268.9, 200828, 28877, 6893, null],
  ['VS 450 x 200 (9.5/6.3)', 'VS 450x51 (B.3)', 65.2, 22640, 1268, 1130, 15.1],
  ['VS 500 x 250 (9.5/6.3)', 'VS 500x61 (B.3)', 77.8, 34416, 2475, 1529, null],
  ['VS 600 x 300 (12.5/8)', 'VS 600x95 (B.3)', 121, 77401, 5627, 2864, 49.1],
  ['VS 1000 x 400 (12.5/8)', 'VS 1000x140 (B.3)', 178, 305593, 13337, 6839, null],
];
for (const [n, ref, A, Ix, Iy, Zx, It] of NBR) {
  const s = profileToSection(n);
  assert(`${n} existe`, !!s); if (!s) continue;
  const p = resolveSectionProps(s);
  ok(`${n} A — ${ref}`, s.A * 1e4, A, 0.005);
  ok(`${n} Ix — ${ref}`, s.Iz * 1e8, Ix, 0.005);
  ok(`${n} Iy — ${ref}`, s.Iy * 1e8, Iy, 0.005);
  ok(`${n} Zx — ${ref}`, p.Zz * 1e6, Zx, 0.005);
  if (It != null) ok(`${n} It — ${ref}`, s.J * 1e8, It, 0.005);
  assert(`${n} fabricacao soldado chega ao dimensionamento`, p.fabricacao === 'soldado' && !!p.dims);
}

// (c) famílias europeias inalteradas (sem fabricacao)
assert('c1. IPE/HEA/HEB sem fabricacao', ['IPE', 'HEA', 'HEB'].every(f => Object.values(CATALOG[f]).every(p => !p.fabricacao)));
assert('c2. IPE300 design só shape/dims/profile', Object.keys(profileToSection('IPE300').design).join() === 'shape,dims,profile');

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
