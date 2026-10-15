// test_nbr8800_net.mjs — ruptura da seção líquida pela NBR 8800:2024 (5.2.2-b, 5.2.3–5.2.5)
//   node tests/test_nbr8800_net.mjs
// Oráculo: cálculo manual independente (texto da norma lido nas págs. 56–59 do PDF do acervo).
//   MR250 (fy = 250, fu = 400 MPa), γa1 = 1,10, γa2 = 1,35.
//   L 50,8 × 6,35 (abas iguais, sem raio): Ag = 6,35·(2·50,8 − 6,35) = 604,84 mm²
//     ec = (50,8·6,35·3,175 + 44,45·6,35·28,575)/604,84 = 15,028 mm (CG ao plano da aba ligada, Fig. 4)
//     uma linha de furos φ17,5 (+2,0 mm, 5.2.4.1-a): An = 604,84 − 19,5·6,35 = 481,01 mm²
//     escoamento: Ag·fy/γa1 = 137,463 kN
//     ℓc = 50 mm: Ct = 1 − 15,028/50 = 0,6994 > Ac/Ag = 50,8·6,35/604,84 = 0,5333 → 0,6994·481,01·0,4/1,35 = 99,685 kN
//     ℓc = 20 mm: Ct = 0,2486 < 0,5333 → piso Ac/Ag (último parágrafo de 5.2.5) → 76,012 kN
//     caso a): Ct = 1,00 → 481,01·0,4/1,35 = 142,52 kN > 137,463 → escoamento governa
//   Tubo φ88,9 × 4, chapa concêntrica tc = 10 mm (rasgo 10 + 2 mm nas duas paredes), ℓc = 100 mm:
//     A = π·(88,9·4 − 16) = 1 066,88 mm², An = 1 066,88 − 2·12·4 = 970,88 mm²
//     ec = D/π − tc/2 = 23,298 mm (Fig. 7), Ct = [1 + (0,23298)^3,2]^−10 = 0,9102 (5.2.5-e)
//     → 0,9102·970,88·0,4/1,35 = 261,847 kN (sem piso Ac/Ag: tubo) > Ag·fy/γa1 = 242,473 kN (escoamento governa)
import { fromShape, resolveSectionProps } from '../js/design/section_props.js';
import { nbr8800 } from '../js/design/codes/nbr8800.js';

let fails = 0, n = 0;
const ok = (name, got, exp, rel = 0.002) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= rel)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)}%)`); } else console.log(`ok   ${name}: ${got}`); };
const assert = (name, c) => { n++; if (!c) { fails++; console.log(`FAIL ${name}`); } else console.log(`ok   ${name}`); };
const mat = { Fy: 250e3, Fu: 400e3, E: 200e6, G: 77e6 };   // kN/m²

const b = 0.0508, t = 0.00635;
const g = fromShape('angle', { d: b, b, t });
const sL = resolveSectionProps({ A: g.A, Iz: g.Iz, Iy: g.Iy, J: g.J, design: { shape: 'angle', dims: { d: b, b, t } } });
const An = 481.01e-6;
const run = (secaoLiquida, sec = sL, opts = {}) => nbr8800.check({ demands: { N: 50 }, mat, sec, member: { L: 1.5, secaoLiquida, ...opts }, options: { gamma_a1: 1.10, gamma_a2: 1.35 } });

{
  const r = run(undefined);
  ok('N1. sem área líquida: só escoamento', r.axial.capacity, 137.463);
  assert('N1b. aviso de 5.2.2-b não verificada', r.avisos.some(a => /5\.2\.2-b\) não verificada/.test(a)));
}
{
  const r = run({ An, lc: 0.050 });
  ok('N2. cantoneira, ℓc = 50 mm, ec automático (5.2.5-c)', r.axial.capacity, 99.685);
  assert('N2b. fórmula cita 5.2.2-b', /5\.2\.2-b/.test(r.axial.formula));
}
ok('N3. cantoneira, ℓc = 20 mm: piso Ac/Ag', run({ An, lc: 0.020 }).axial.capacity, 76.012);
ok('N4. caso a): escoamento governa', run({ An, caso: 'a' }).axial.capacity, 137.463);
{
  const r = run({ An });
  ok('N5. cantoneira sem Ct nem ℓc: Ct = Ac/Ag (limite inferior) = N3', r.axial.capacity, 76.012);
  assert('N5b. aviso do Ct = Ac/Ag adotado', r.avisos.some(a => /adotado Ct = Ac\/Ag/.test(a)));
}
{
  const s = fromShape('I', { d: 0.2, bf: 0.1, tf: 0.008, tw: 0.006 });
  const sI = s && resolveSectionProps({ A: s.A, Iz: s.Iz, Iy: s.Iy, J: s.J, Cw: s.Cw, design: { shape: 'I', dims: { d: 0.2, bf: 0.1, tf: 0.008, tw: 0.006 } } });
  const r = sI && run({ An: 0.5 * s.A }, sI);
  assert('N5c. perfil I sem Ct nem ℓc: ruptura NÃO verificada (sem aprovar com Ct = 1)', r && r.avisos.some(a => /NÃO verificada/.test(a)) && !/seção líquida/.test(r.axial.modo));
}
{
  const r = run({ An, Ct: 1.2 });
  ok('N5d. Ct informado 1,2 limitado a 1 (escoamento governa)', r.axial.capacity, 137.463);
  assert('N5e. aviso de Ct fora de [0; 1]', r.avisos.some(a => /fora de \[0; 1\]/.test(a)));
}
{
  // L 100 × 75 × 8 ligada pela aba MENOR (75), uma linha de furos φ17,5, ℓc = 60 mm (cálculo manual):
  //   Ag = 8·(175 − 8) = 1 336 mm², ec = (75·8·4 + 92·8·54)/1 336 = 31,545 mm, An = 1 336 − 19,5·8 = 1 180 mm²
  //   Ct = 1 − 31,545/60 = 0,4743 > Ac/Ag = 600/1 336 = 0,4491 → 0,4743·1 180·0,4/1,35 = 165,812 kN < 303,636 (escoamento)
  const gU = fromShape('angle', { d: 0.100, b: 0.075, t: 0.008 });
  const sU = resolveSectionProps({ A: gU.A, Iz: gU.Iz, Iy: gU.Iy, J: gU.J, design: { shape: 'angle', dims: { d: 0.100, b: 0.075, t: 0.008 } } });
  ok('N9. abas desiguais, aba menor ligada, ℓc = 60 mm', run({ An: 1180e-6, lc: 0.060 }, sU, { cantoneira: { abaLigada: 'menor' } }).axial.capacity, 165.812);
}
ok('N6. Ct informado (0,6994) = N2', run({ An, Ct: 0.6994 }).axial.capacity, 99.685);
{
  const D = 0.0889, tt = 0.004;
  const p = fromShape('pipe', { D, t: tt });
  const sP = resolveSectionProps({ A: p.A, Iz: p.Iz, Iy: p.Iy, J: p.J, design: { shape: 'pipe', dims: { D, t: tt } } });
  const r = run({ An: 970.88e-6, ec: 0.023298, lc: 0.100 }, sP);
  ok('N7. tubo com chapa concêntrica (5.2.5-e): Nt,Rd da seção líquida', r.axial.secaoLiquida.NRd, 261.847);
  ok('N7b. tubo: escoamento governa (1 066,88·0,25/1,10 = 242,473 kN)', r.axial.capacity, 242.473);
}
{
  const r = nbr8800.check({ demands: { N: 50 }, mat: { Fy: 250e3, E: 200e6 }, sec: sL, member: { L: 1.5, secaoLiquida: { An, lc: 0.05 } }, options: {} });
  assert('N8. sem fu: aviso e escoamento', r.avisos.some(a => /não tem fu/.test(a)) && Math.abs(r.axial.capacity - 137.463) < 0.01);
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
