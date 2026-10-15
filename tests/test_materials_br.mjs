// test_materials_br.mjs — materiales NBR del catálogo (PLANO_BRASIL 8.2)
//   node test_materials_br.mjs
// Esperados calculados A MANO desde las normas:
//   acero NBR 8800:2024 4.6.2.9 (E 200 000 MPa, G 77 000 MPa) y Tab. A.1 (NBR 7007)
//   concreto NBR 6118:2026 8.2.8: Eci = 5600·√fck (αE = 1), Ecs = αi·Eci, αi = 0,8 + 0,2·fck/80
//     C25: Eci = 5600·5 = 28 000; αi = 0,8625 → Ecs = 24 150 MPa
//     C30: Eci = 5600·5,4772 = 30 672; αi = 0,875 → Ecs = 26 838 MPa
//     C50: Eci = 5600·7,0711 = 39 598; αi = 0,925 → Ecs = 36 628 MPa
import { getMaterialDef } from '../js/design/materials_catalog.js';
import { resolveMaterial } from '../js/design/material_props.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };

{
  const M = resolveMaterial(getMaterialDef('Aço MR250'));
  assert('1a. MR250 → familia steel', M.family === 'steel');
  ok('1b. fy = 250 MPa (kN/m²)', M.Fy, 250e3, 1e-9);
  ok('1c. fu = 400 MPa (kN/m²)', M.Fu, 400e3, 1e-9);
  ok('1d. E = 200 GPa', M.E, 2.0e8, 1e-9);
  ok('1e. G = 77 GPa', getMaterialDef('Aço MR250').G, 7.7e7, 1e-9);
}
{
  ok('2a. AR350 fu = 450', resolveMaterial(getMaterialDef('Aço AR350')).Fu, 450e3, 1e-9);
  ok('2b. AR350 COR fu = 485', resolveMaterial(getMaterialDef('Aço AR350 COR')).Fu, 485e3, 1e-9);
  ok('2c. AR415 fy = 415', resolveMaterial(getMaterialDef('Aço AR415')).Fy, 415e3, 1e-9);
}
for (const [n, Ecs] of [['Concreto C25', 24150], ['Concreto C30', 26838], ['Concreto C50', 36628]]) {
  const d = getMaterialDef(n), M = resolveMaterial(d);
  assert(`3. ${n} → familia concrete`, M.family === 'concrete');
  ok(`3. ${n} Ecs (MPa)`, d.E / 1000, Ecs, 2e-4);
  ok(`3. ${n} Gc = Ecs/2,4`, d.G, d.E / 2.4, 1e-12);
  ok(`3. ${n} ρ = 2,5 t/m³`, d.rho, 2.5, 1e-12);
}

console.log(fails ? `\n${fails} FALLA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
