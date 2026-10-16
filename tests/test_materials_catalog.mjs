// test_materials_catalog.mjs — Brazilian material library (js/design/materials_catalog.js)
//   node tests/test_materials_catalog.mjs
// Oracles from the standards (values read in the acervo, independent of the code):
//   NBR 8800:2024 4.6.2.9: E = 200 000 MPa, G = 77 000 MPa, ρ = 7 850 kg/m³; MR250 fy 250 / fu 400 MPa.
//   NBR 6118:2026 8.2.8: C30 → Eci = 5600·√30 = 30 672 MPa, αi = 0,8 + 0,2·30/80 = 0,875 → Ecs = 26 838 MPa.
//   NBR 7190-1:2022 Tab. 3: C24 E0,m 11 GPa, Gm 0,7 GPa, ρm 420 kg/m³; D60 E0,m 17 GPa, Gm 1,1 GPa, ρm 840 kg/m³.
import { getMaterialDef, catalogMaterials } from '../js/design/materials_catalog.js';
import { timberClass7190 } from '../js/design/codes/nbr7190.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-6) => { n++; if (!(Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)))) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
const mr = getMaterialDef('Aço MR250');
ok('M1. MR250 E (kN/m²)', mr.E, 2.0e8); ok('M1b. G', mr.G, 7.7e7); ok('M1c. ρ (t/m³)', mr.rho, 7.85); ok('M1d. fy', mr.design.Fy, 250); ok('M1e. fu', mr.design.Fu, 400);
const c30 = getMaterialDef('Concreto C30');
ok('M2. C30 Ecs (kN/m²)', c30.E, 0.875 * 5600 * Math.sqrt(30) * 1000, 1e-9);
const c24 = getMaterialDef('Madeira C24'), d60 = getMaterialDef('Madeira D60');
ok('M3. C24 E0,m', c24.E, 11e6); ok('M3b. C24 Gm', c24.G, 0.7e6); ok('M3c. C24 ρm', c24.rho, 0.42);
ok('M4. D60 E0,m', d60.E, 17e6); ok('M4b. D60 Gm', d60.G, 1.1e6); ok('M4c. D60 ρm', d60.rho, 0.84);
// consistency with the design module (same Tab. 3): E0,m of every class
for (const r of catalogMaterials({ tipo: 'madeira', norma: 'NBR 7190-1:2022' })) {
  const cls = getMaterialDef(r.name).design.classe7190, t = timberClass7190(cls);
  ok(`M5. ${cls}: E0,m catálogo = módulo NBR 7190`, getMaterialDef(r.name).E, t.E0med, 1e-9);
}
n++; const br = catalogMaterials({ norma: 'NBR 7190-1:2022' }).length; if (br !== 20) { fails++; console.log('FAIL M6. 20 classes', br); } else console.log('ok   M6. 20 classes de madeira');
// ASTM A572 para perfis laminados — NBR 8800:2024 Anexo A, Tab. A.2 (lida no PDF da norma): fy / fu (MPa)
for (const [g, fy, fu] of [[42, 290, 415], [50, 345, 450], [55, 380, 485], [60, 415, 520], [65, 450, 550]]) {
  const m = getMaterialDef(`Aço A572 Gr.${g}`);
  ok(`A572-${g}. fy`, m.design.Fy, fy); ok(`A572-${g}. fu`, m.design.Fu, fu); ok(`A572-${g}. E`, m.E, 2.0e8);
}
n++; if (!/Tab\. A\.2/.test(getMaterialDef('Aço A572 Gr.50').catalog?.norma || '')) { fails++; console.log('FAIL A572 norma'); } else console.log('ok   A572 norma = NBR 8800 Tab. A.2');
n++; if (!getMaterialDef('Aço MR250').catalog?.norma?.startsWith('NBR 8800')) { fails++; console.log('FAIL M7. norma'); } else console.log('ok   M7. material do catálogo leva a norma');
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
