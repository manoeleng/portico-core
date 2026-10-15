// test_nbr8800_angle.mjs — cantoneira simples à compressão pela NBR 8800:2024 (5.3.5.2/5.3.5.3)
//   node tests/test_nbr8800_angle.mjs
// Oráculo: cálculo manual independente (fórmulas fechadas da cantoneira de abas iguais + expressão de
// Ne,yz da 5.3.5.2-b; o código usa a cúbica da 5.3.5.3), MR250, E = 200 GPa, G = 77 GPa, γa1 = 1,10.
// rmín conferido contra o catálogo Gerdau de cantoneiras de abas iguais (2" × 1/4": rz mín = 0,99 cm).
import { fromShape, resolveSectionProps } from '../js/design/section_props.js';
import { nbr8800 } from '../js/design/codes/nbr8800.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

const mat = { Fy: 250e3, Fu: 400e3, E: 200e6, G: 77e6 };   // kN/m²
const secOf = (b, t) => { const g = fromShape('angle', { d: b, b, t }); return resolveSectionProps({ A: g.A, Iz: g.Iz, Iy: g.Iy, J: g.J, design: { shape: 'angle', dims: { d: b, b, t } } }); };
const run = (b, t, L) => nbr8800.check({ demands: { N: -10 }, mat, sec: secOf(b, t), member: { L, Lb: L }, options: { gamma_a1: 1.10 } });

// BR-8800-A1 · L 50,8 × 6,35 (2" × 1/4"), L = 1,0 m — flexão no eixo de menor inércia governa
{
  const r = run(0.0508, 0.00635, 1.0);
  const av = r.avisos.join(' | ');
  assert('A1a. aviso de eixos principais com rmín 0,99 cm (Gerdau: 0,99)', /rmín = 0,99|rmín = 0.99/.test(av), av);
  ok('A1b. χ', r.axial.chi, 0.5845, 0.002);
  ok('A1c. Nc,Rd (kN) — aba compacta (b/t = 8 < 12,73), Aef = Ag', r.axial.capacity, 80.341, 0.002);
  assert('A1d. aviso de excentricidade 5.3.5.4', /5\.3\.5\.4/.test(av));
}
// BR-8800-A2 · L 76,2 × 4,76 (3" × 3/16"), L = 0,5 m — flexo-torção governa (Ne,uz = 220,97 kN < Ne,v = 1 273 kN)
// e aba esbelta: b/t = 16,01 > 0,45·√(E/fy)/√χ = 15,03 (Tab. 4 grupo 3, b = largura total; AL da Tab. 5)
// → bef/b = 0,9685, Aef = 702,77 − 2·(1 − 0,9685)·76,2·4,76 = 679,90 mm², Nc,Rd = 110,78 kN.
{
  const r = run(0.0762, 0.00476, 0.5);
  ok('A2a. χ', r.axial.chi, 0.7169, 0.002);
  ok('A2b. Aef (mm²)', r.axial.Aef * 1e6, 679.90, 0.002);
  ok('A2c. Nc,Rd (kN)', r.axial.capacity, 110.777, 0.002);
}
// A3 · antes da correção o Ne usava os eixos paralelos às abas (rx = 1,55 cm): Nc,Rd tem de ser menor que esse
{
  const s = secOf(0.0508, 0.00635), r = run(0.0508, 0.00635, 1.0);
  const Nleg = Math.PI ** 2 * mat.E * Math.min(s.Iz, s.Iy) / 1.0;
  const l0 = Math.sqrt(s.A * mat.Fy / Nleg), chi = l0 <= 1.5 ? 0.658 ** (l0 * l0) : 0.877 / (l0 * l0);
  assert('A3. resultado mais conservador que pelos eixos das abas', r.axial.capacity < chi * s.A * mat.Fy / 1.1, `${r.axial.capacity} < ${(chi * s.A * mat.Fy / 1.1).toFixed(2)}`);
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
