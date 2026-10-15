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
const run = (b, t, L, trelica) => nbr8800.check({ demands: { N: -10 }, mat, sec: secOf(b, t), member: { L, Lb: L, ...(trelica ? { cantoneira: { trelica } } : {}) }, options: { gamma_a1: 1.10 } });

// BR-8800-A1 · L 50,8 × 6,35 (2" × 1/4"), L = 1,0 m — flexão no eixo de menor inércia governa
{
  const r = run(0.0508, 0.00635, 1.0, 'concentrica');
  const av = r.avisos.join(' | ');
  assert('A1a. aviso de eixos principais com rmín 0,99 cm (Gerdau: 0,99)', /rmín = 0,99|rmín = 0.99/.test(av), av);
  ok('A1b. χ', r.axial.chi, 0.5845, 0.002);
  ok('A1c. Nc,Rd (kN) — aba compacta (b/t = 8 < 12,73), Aef = Ag', r.axial.capacity, 80.341, 0.002);
}
// BR-8800-A2 · L 76,2 × 4,76 (3" × 3/16"), L = 0,5 m — flexo-torção governa (Ne,uz = 220,97 kN < Ne,v = 1 273 kN)
// e aba esbelta: b/t = 16,01 > 0,45·√(E/fy)/√χ = 15,03 (Tab. 4 grupo 3, b = largura total; AL da Tab. 5)
// → bef/b = 0,9685, Aef = 702,77 − 2·(1 − 0,9685)·76,2·4,76 = 679,90 mm², Nc,Rd = 110,78 kN.
{
  const r = run(0.0762, 0.00476, 0.5, 'concentrica');
  ok('A2a. χ', r.axial.chi, 0.7169, 0.002);
  ok('A2b. Aef (mm²)', r.axial.Aef * 1e6, 679.90, 0.002);
  ok('A2c. Nc,Rd (kN)', r.axial.capacity, 110.777, 0.002);
}
// A3 · antes da correção o Ne usava os eixos paralelos às abas (rx = 1,55 cm): Nc,Rd tem de ser menor que esse
{
  const s = secOf(0.0508, 0.00635), r = run(0.0508, 0.00635, 1.0, 'concentrica');
  const Nleg = Math.PI ** 2 * mat.E * Math.min(s.Iz, s.Iy) / 1.0;
  const l0 = Math.sqrt(s.A * mat.Fy / Nleg), chi = l0 <= 1.5 ? 0.658 ** (l0 * l0) : 0.877 / (l0 * l0);
  assert('A3. resultado mais conservador que pelos eixos das abas', r.axial.capacity < chi * s.A * mat.Fy / 1.1, `${r.axial.capacity} < ${(chi * s.A * mat.Fy / 1.1).toFixed(2)}`);
}

// BR-8800-A4 · cantoneira ligada por UMA aba — 5.3.5.4 (comprimento destravado equivalente), cálculo manual
// independente, conferido pelo revisor (15/10/2026). rx1 = raio em torno do eixo paralelo à aba ligada.
//   L 50,8 × 6,35, L = 1 m: rx1 = 15,47 mm, L/rx1 = 64,7 ≤ 80
//     plana:    Lx1,eq = 72·rx1 + 0,75·L = 1 863,6 mm → Ne = 82,23 kN, χ = 0,4632 → Nc,Rd = 63,67 kN
//     espacial: Lx1,eq = 60·rx1 + 0,80·L = 1 728,0 mm → Ne = 95,64 kN, χ = 0,5160 → Nc,Rd = 70,93 kN
//   L 76,2 × 4,76, L = 0,5 m (b/t = 16 < 0,71·√(E/fy) = 20,1 → sem flexo-torção, 5.3.5.4.4):
//     plana:    Lx1,eq = 2 092,9 mm → Ne = 180,29 kN, χ = 0,6651, Aef = 694,36 mm² → Nc,Rd = 104,95 kN
//     espacial: Lx1,eq = 1 831,6 mm → Ne = 235,41 kN, χ = 0,7317, Aef = 675,90 mm² → Nc,Rd = 112,40 kN
{
  ok('A4a. L 2" plana Nc,Rd', run(0.0508, 0.00635, 1.0, 'plana').axial.capacity, 63.671, 0.002);
  ok('A4b. L 2" espacial Nc,Rd', run(0.0508, 0.00635, 1.0, 'espacial').axial.capacity, 70.927, 0.002);
  ok('A4c. L 3" plana Nc,Rd', run(0.0762, 0.00476, 0.5, 'plana').axial.capacity, 104.953, 0.002);
  ok('A4d. L 3" espacial Nc,Rd', run(0.0762, 0.00476, 0.5, 'espacial').axial.capacity, 112.400, 0.002);
  const d = run(0.0508, 0.00635, 1.0);
  ok('A4e. ligação não declarada → o menor (plana)', d.axial.capacity, 63.671, 0.002);
  assert('A4f. aviso de ligação não declarada', d.avisos.some(a => /não declarada/.test(a)));
}
// A5 · 5.3.5.4.1-d: Lx1,eq/rx1 > 200 → flexo-compressão (5.3.5.4.5), nunca aprova
{ const r = run(0.0508, 0.00635, 3.5, 'plana');
  assert('A5. fora de 5.3.5.4.1 → NÃO verificado', !isFinite(r.axial.ratio) && r.avisos.some(a => /5\.3\.5\.4\.5/.test(a)), r.avisos.join(' | ')); }

// BR-8800-A6 · cantoneira de ABAS DESIGUAIS L 100 (vertical) × 75 (horizontal) × 8, L = 1,5 m, MR250 — cálculo manual
// independente (NBR 8800:2024 5.3.5.4.2/5.3.5.4.3, último parágrafo; lido na pág. 50–51 do PDF). be/bs = 1,333.
//   ligada pela MENOR (75): rx1 (eixo ∥ aba de 75) = 31,772 mm, rmín = 16,171 mm, L/rx1 = 47,21
//     plana:    a) 72·rx1 + 0,75·L = 3 412,6 + 4·(1,333² − 1)·rx1 = 98,8 → 3 511,5 > 0,95·L·rx1/rmín = 2 799,8
//               Ne = 215,90 kN, χ = 0,5234 → Nc,Rd = 158,910 kN
//     espacial: 3 106,3 + 6·(…)·rx1 = 148,3 → 3 254,6 > 0,82·L·rx1/rmín = 2 416,6 → Nc,Rd = 174,094 kN
//   ligada pela MAIOR (100), plana: rx1 = 22,161 mm, L/rx1 = 67,69 → Leq = 2 720,6, Ne = 174,98 kN → Nc,Rd = 136,579 kN
{
  const g = fromShape('angle', { d: 0.100, b: 0.075, t: 0.008 });
  const sU = resolveSectionProps({ A: g.A, Iz: g.Iz, Iy: g.Iy, J: g.J, design: { shape: 'angle', dims: { d: 0.100, b: 0.075, t: 0.008 } } });
  const runU = (trelica, abaLigada) => nbr8800.check({ demands: { N: -10 }, mat, sec: sU, member: { L: 1.5, Lb: 1.5, cantoneira: { trelica, abaLigada } }, options: { gamma_a1: 1.10 } });
  ok('A6a. abas desiguais, menor ligada, plana Nc,Rd', runU('plana', 'menor').axial.capacity, 158.910, 0.002);
  ok('A6b. abas desiguais, menor ligada, espacial Nc,Rd', runU('espacial', 'menor').axial.capacity, 174.094, 0.002);
  ok('A6c. abas desiguais, maior ligada, plana Nc,Rd', runU('plana').axial.capacity, 136.579, 0.002);
  assert('A6d. aviso cita a aba menor', runU('plana', 'menor').avisos.some(a => /MENOR/.test(a)));
  // piso 0,95·Lx1·rx1/rmín governa (L = 3 m; sugestão da revisão): L/rx1 = 94,42 > 80 → 32·rx1 + 1,25·L = 4 766,7
  // + 98,8 = 4 865,6 < 0,95·L·rx1/rmín = 5 599,5 = Lx1,eq (Leq/rx1 = 176,2 ≤ 200) → Ne = 84,90 kN, χ = 0,2229 → 67,692 kN
  const run3 = nbr8800.check({ demands: { N: -10 }, mat, sec: sU, member: { L: 3, Lb: 3, cantoneira: { trelica: 'plana', abaLigada: 'menor' } }, options: { gamma_a1: 1.10 } });
  ok('A6e. menor ligada, plana, L = 3 m: piso 0,95·L·rx1/rmín governa', run3.axial.capacity, 67.692, 0.002);
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
