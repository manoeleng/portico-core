// test_profiles_lib.mjs — cantoneiras e tubos circulares da biblioteca do usuário (PLANO_BRASIL 8.1)
//   node tests/test_profiles_lib.mjs
// Oráculos: catálogo Gerdau "Cantoneiras de abas iguais" (_referencias/Catalogos_Tabelas) e
// Fakury/Silva/Caldas–Vallourec, "Projeto de Estruturas de Edificações com Perfis Tubulares" (Aco/),
// exemplo do TC 168,3 × 16 (Ag = 76,6 cm², r = 5,41 cm).
// Tolerâncias: tubo 0,5 % (geometria exata, tabela arredondada); cantoneira 2,5 % — a geometria nominal
// não tem raio de concordância nem de borda (L 50 × 5: Ix +2,3 % sobre o catálogo).
import { catalogNames, profileToSection } from '../js/design/profiles.js';

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

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
