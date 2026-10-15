// test_nbr6118_torsion_open.mjs — torção de seção composta de retângulos (17.5.1.4.2) e de perfis abertos de
// parede fina (17.5.2) pela NBR 6118:2026
//   node tests/test_nbr6118_torsion_open.mjs
// Oráculo: cálculo manual independente sobre o texto da norma (nbr6118-2026.txt do acervo, 17.5.1.4–17.5.2.4).
//   Seção T: alma 0,20 × 0,60 m e mesa 0,80 × 0,12 m; TSd = 20 kN·m; c1 = 0,04 m; C30 (fcd = 21,43 MPa); θ = 45°
//     a³b: alma 0,2³·0,6 = 0,00480; mesa 0,12³·0,8 = 0,0013824 → parcelas 0,77640 / 0,22360
//     alma: TSd1 = 15,528; A/u = 0,075 < 2c1 → he = 0,075, Ae = 0,12·0,52 = 0,0624; TRd2 = 0,5·0,88·21,43·10³·Ae·he = 44,126
//     mesa: TSd2 = 4,472; A/u = 0,0522 < 2c1 → he = min(0,0522; 0,12 − 0,08) = 0,040, Ae = 0,72·0,04 = 0,0288; TRd2 = 10,862
//     razões 0,3519 / 0,4117 → governa a mesa
//   Perfil U de paredes opostas (17.5.2.3): T = 30 kN·m no meio do vão, L = 6 m, z = 0,9 m, Ecs = 26 838 MPa
//     (C30, αE = 1: Eci = 5600·√30 = 30 672, αi = 0,875), G = Ecs/2,4, I1 = 0,002, I2 = 0,0015 m⁴, J = 0,0006 m⁴
//     F = T/z = 33,333 kN; biapoiada com EI/2: a1 = F·L³/(48·0,5·E·I1) = 5,589 mm, a2 = 7,452 mm
//     θ = (a1 + a2)/z = 0,014490 rad → r = T/θ = 2 070,36 kN·m/rad
//     uniforme: 4·0,15·G·J/L = 670,95 kN·m/rad → flexo-torção é a mais rígida (pode desprezar a uniforme, 17.5.2.2)
//     biengastada: r = 4 × 2 070,36 = 8 281,44
//     resistência (17.5.2.4): FRd = [120; 110], FSd = [70; 80] → ΔFRd,mín = 30 kN → TRd = 30·0,9 = 27 kN·m; T/TRd = 1,111
import { torsionCompositeRects, openSectionTorsion } from '../js/design/codes/nbr6118.js';

let fails = 0, n = 0;
const ok = (name, got, exp, rel = 0.001) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= rel)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
const eq = (name, got, exp) => { n++; if (got !== exp) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };

{
  const r = torsionCompositeRects({ TSd: 20, rects: [{ b: 0.20, h: 0.60 }, { b: 0.80, h: 0.12 }], c1: 0.04, fck: 30, fcd: 30 / 1.4, fywd: 435 });
  ok('C1. parcela da alma', r.parts[0].share, 0.77640);
  ok('C1b. TRd2 da alma', r.parts[0].TRd2, 44.126);
  ok('C1c. TRd2 da mesa (he = b − 2c1)', r.parts[1].TRd2, 10.862);
  ok('C1d. razão governante (mesa)', r.ratio, 0.41173);
}
{
  const E = 26838e3, base = { T: 30, L: 6, z: 0.9, E, G: E / 2.4, J: 0.0006, I1: 0.002, I2: 0.0015 };
  const r = openSectionTorsion({ ...base, FRd: [120, 110], FSd: [70, 80] });
  ok('P1. a1 (mm)', r.a1 * 1000, 5.589);
  ok('P1b. rigidez à flexo-torção r = T/θ', r.rFlexo, 2070.36);
  ok('P1c. rigidez à torção uniforme 4·0,15·GJ/L', r.rUnif, 670.95);
  eq('P1d. mecanismo mais rígido', r.mecanismo, 'flexo-torção');
  ok('P1e. TRd = ΔFRd,mín·z', r.TRd, 27.0);
  ok('P1f. razão T/TRd', r.ratio, 1.1111);
  ok('P2. biengastada: 4× mais rígida', openSectionTorsion({ ...base, apoio: 'biengastada' }).rFlexo, 8281.44);
  eq('P3. paredes flexíveis: torção uniforme governa', openSectionTorsion({ ...base, I1: 1e-5, I2: 1e-5 }).mecanismo, 'torção uniforme');
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
