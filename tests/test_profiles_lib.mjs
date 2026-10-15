// test_profiles_lib.mjs — cantoneiras e tubos circulares da biblioteca do usuário (PLANO_BRASIL 8.1)
//   node tests/test_profiles_lib.mjs
// Oráculos: catálogo Gerdau "Cantoneiras de abas iguais" (_referencias/Catalogos_Tabelas) e
// Fakury/Silva/Caldas–Vallourec, "Projeto de Estruturas de Edificações com Perfis Tubulares" (Aco/),
// exemplo do TC 168,3 × 16 (Ag = 76,6 cm², r = 5,41 cm).
// Tolerâncias: tubo 0,5 % (geometria exata, tabela arredondada); cantoneira 2,5 % — a geometria nominal
// não tem raio de concordância nem de borda (L 50 × 5: Ix +2,3 % sobre o catálogo).
import { catalogNames, profileToSection } from '../js/design/profiles.js';
import { resolveSectionProps } from '../js/design/section_props.js';
import { rhsEN10219 } from '../js/design/rhs_en10219.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

assert('a1. 89 cantoneiras', catalogNames('L (cantoneira)').length === 89, String(catalogNames('L (cantoneira)').length));
assert('a2. 850 tubos circulares', catalogNames('Tubo circular').length === 850, String(catalogNames('Tubo circular').length));

// [nome, referência Gerdau, A cm², Ix cm⁴, rx cm]
for (const [n, ref, A, Ix, rx] of [
  ['L 50.8 x 50.8 x 6.35', '2" × 1/4"', 6.06, 14.6, 1.55],
  ['L 101.6 x 101.6 x 9.52', '4" × 3/8"', 18.45, 183, 3.12],
  ['L 152.4 x 152.4 x 12.7', '6" × 1/2"', 37.09, 828, 4.72],
  ['L 50 x 50 x 5', '50 × 5 mm', 4.80, 11.0, 1.54],
]) {
  const s = profileToSection(n); assert(`${n} existe`, !!s); if (!s) continue;
  ok(`${n} A — Gerdau ${ref}`, s.A * 1e4, A, 0.025);
  ok(`${n} Ix — Gerdau ${ref}`, s.Iz * 1e8, Ix, 0.025);
  ok(`${n} rx — Gerdau ${ref}`, Math.sqrt(s.Iz / s.A) * 100, rx, 0.025);
  assert(`${n} forma angle com d, b, t`, s.design.shape === 'angle' && s.design.dims.t > 0);
}
{
  const s = profileToSection('TUBO ⌀168.3 x 16');
  ok('TC 168,3 × 16 Ag — Fakury/Vallourec', s.A * 1e4, 76.6, 0.005);
  ok('TC 168,3 × 16 r — Fakury/Vallourec', Math.sqrt(s.Iz / s.A) * 100, 5.41, 0.005);
  assert('TC forma pipe', s.design.shape === 'pipe');
}

// U laminado Gerdau — o PRODUTO Gerdau é a referência: "Tabela de Bitolas" 01/23 / "Barras e Perfis" 2009
// (_referencias/Catalogos_Tabelas). Zx, Zy, J e Cw (não publicados pela Gerdau) vêm do perfil C equivalente da
// AISC Shapes Database v16.0. U 8": ry = √(Iy/A) com Iy e A da Gerdau (a linha traz 1,42, que não fecha).
assert('u1. 12 perfis U (3" a 12")', catalogNames('U (Gerdau)').length === 12);
// [nome, A cm², Ix cm⁴, Iy cm⁴, Wx cm³, Wy cm³, rx cm, ry cm] — valores da Gerdau
for (const [n, A, Ix, Iy, Wx, Wy, rx, ry] of [['U 3" x 6,10', 7.78, 68.9, 8.2, 18.1, 3.32, 2.98, 1.03], ['U 6" x 15,60', 19.9, 632, 36, 82.9, 9.24, 5.63, 1.34],
  ['U 10" x 29,76', 37.9, 3290, 117, 259, 21.6, 9.31, 1.76], ['U 12" x 30,80', 39.3, 5370, 161, 352, 28.3, 11.7, 2.03]]) {
  const s = profileToSection(n), p = resolveSectionProps(s);
  ok(`${n} A (Gerdau)`, s.A * 1e4, A, 1e-9); ok(`${n} Ix`, s.Iz * 1e8, Ix, 1e-9); ok(`${n} Iy`, s.Iy * 1e8, Iy, 1e-9);
  ok(`${n} Wx`, p.Sz * 1e6, Wx, 1e-9); ok(`${n} Wy`, p.Sy * 1e6, Wy, 1e-9); ok(`${n} rx`, p.rz * 100, rx, 1e-9); ok(`${n} ry`, p.ry * 100, ry, 1e-9);
  assert(`${n} forma channel, laminado`, p.shape === 'channel' && p.fabricacao === 'laminado');
}
{ const s = profileToSection('U 8" x 17,10'), p = resolveSectionProps(s);
  ok('u2. U 8" × 17,10 Iy (Gerdau)', s.Iy * 1e8, 54.1, 1e-9);
  ok('u2. U 8" × 17,10 ry = √(54,10/21,68)', p.ry * 100, Math.sqrt(54.1 / 21.68), 1e-9);
  // complemento AISC (C200X17.1): Zx 158 cm³, Zy 25,7 cm³, J 5,41 cm⁴, Cw 4 430 cm⁶
  ok('u2. Zx (AISC)', p.Zz * 1e6, 158, 1e-9); ok('u2. Zy (AISC)', p.Zy * 1e6, 25.7, 1e-9);
  ok('u2. J (AISC)', s.J * 1e8, 5.41, 1e-9); ok('u2. Cw (AISC 4,43·10⁹ mm⁶)', p.Cw * 1e12, 4430, 1e-9); }

// Tubos retangulares (biblioteca, 406) com raios de canto — EN 10219-2:2019 A.3, conferido contra a Tab. B.3
// (pág. 36 do PDF do acervo) e contra o exemplo 3.7.10 do livro de perfis tubulares (TR 200 × 150 × 8:
// Ix 2829, Iy 1816, J 3665 — fecham com os raios de conformação a frio 2,5T / 1,5T).
assert('r1. 406 tubos retangulares', catalogNames('Tubo retangular').length === 406);
for (const [H, B, T, A, Iyy, Izz, Wpl, It] of [[200, 100, 6, 33.6, 1703, 577, 213, 1417], [200, 100, 10, 52.6, 2444, 818, 318, 2154],
  [200, 120, 8, 46.4, 2386, 1079, 298, 2507], [180, 100, 4, 21.3, 926, 374, 126, 854], [160, 80, 12.5, 47.0, 1185, 396, 208, 1129]]) {
  const r = rhsEN10219(H, B, T), n = `RHS ${H}×${B}×${T} (EN 10219-2 Tab. B.3)`;
  ok(`${n} A`, r.A * 1e4, A, 0.005); ok(`${n} Iyy`, r.Iyy * 1e8, Iyy, 0.005); ok(`${n} Izz`, r.Izz * 1e8, Izz, 0.005);
  ok(`${n} Wpl,yy`, r.Wplyy * 1e6, Wpl, 0.005); ok(`${n} It`, r.It * 1e8, It, 0.005);
}
{ const r = rhsEN10219(200, 150, 8);
  ok('TR 200×150×8 Ix — livro 3.7.10', r.Iyy * 1e8, 2829, 0.002); ok('TR 200×150×8 Iy — livro', r.Izz * 1e8, 1816, 0.002); ok('TR 200×150×8 J — livro', r.It * 1e8, 3665, 0.002); }
{ const s = profileToSection('TUBO 100 x 100 x 6.3'), p = resolveSectionProps(s), r = rhsEN10219(100, 100, 6.3);
  assert('r2. tubo do catálogo usa as propriedades com raios', !!s && Math.abs(s.A - r.A) < 1e-12 && Math.abs(p.Zz - r.Wplyy) < 1e-12, s ? String(s.A) : 'sem perfil'); }

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
