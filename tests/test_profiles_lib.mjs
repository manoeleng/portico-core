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

// U laminado Gerdau — catálogo "Tabela de Bitolas" 01/23 (_referencias/Catalogos_Tabelas), valores
// tabelados transferidos sem cálculo; Zy = Wy (conservador, Z ≥ W). r = √(I/A) fecha nas 7 bitolas.
assert('u1. 7 perfis U (8" e 10"/12" pesados fora por inconsistência da fonte)', catalogNames('U (Gerdau)').length === 7);
for (const [n, A, Ix, Iy, Wx, Wy] of [['U 4" x 8,04', 10.1, 159.5, 13.1, 31.4, 4.61], ['U 10" x 22,77', 29, 2800, 95, 221, 19]]) {
  const s = profileToSection(n), p = resolveSectionProps(s);
  ok(`${n} A`, s.A * 1e4, A, 1e-9); ok(`${n} Ix`, s.Iz * 1e8, Ix, 1e-9); ok(`${n} Iy`, s.Iy * 1e8, Iy, 1e-9);
  ok(`${n} Wx`, p.Sz * 1e6, Wx, 1e-9); ok(`${n} Wy`, p.Sy * 1e6, Wy, 1e-9); ok(`${n} Zy = Wy`, p.Zy * 1e6, Wy, 1e-9);
  assert(`${n} forma channel, laminado`, p.shape === 'channel' && p.fabricacao === 'laminado');
  ok(`${n} rx = √(Ix/A) (coerência da fonte)`, Math.sqrt(Ix / A), s.design.rz * 100, 0.01);
}

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
