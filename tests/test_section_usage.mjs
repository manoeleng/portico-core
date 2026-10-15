// test_section_usage.mjs — use of a section (model.sectionUsage / removeUnusedSections)
//   node tests/test_section_usage.mjs
// Oracle by hand: two members of 3 m and 4 m (3-4-5 diagonal = 5 m for the third) with A = 10 cm², ρ = 7,85 t/m³:
//   section 1 → 2 members, L = 3 + 4 = 7 m, mass = 7,85·0,001·7·1000 = 54,95 kg; section 2 → 1 member (5 m),
//   section 3 unused → removed by removeUnusedSections; a used section cannot be removed.
import { Model } from '../js/model/model.js';
let fails = 0, n = 0;
const ok = (name, got, exp) => { n++; if (Math.abs(got - exp) > 1e-9 * Math.max(1, Math.abs(exp))) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
const m = new Model(); m.materials.clear(); m.sections.clear();
const mat = m.addMaterial({ name: 'S', E: 2e8, G: 8e7, nu: 0.3, rho: 7.85 });
const s1 = m.addSection({ name: 'A', A: 0.001, Iz: 1e-6, Iy: 1e-6, J: 1e-8 }), s2 = m.addSection({ name: 'B', A: 0.001, Iz: 1e-6, Iy: 1e-6, J: 1e-8 });
const s3 = m.addSection({ name: 'C', A: 0.002, Iz: 1e-6, Iy: 1e-6, J: 1e-8 });
const a = m.addNode(0, 0, 0).id, b = m.addNode(3, 0, 0).id, c = m.addNode(3, 4, 0).id;
m.addElement(a, b, mat.id, s1.id); m.addElement(b, c, mat.id, s1.id); m.addElement(a, c, mat.id, s2.id);
const u1 = m.sectionUsage(s1.id), u2 = m.sectionUsage(s2.id), u3 = m.sectionUsage(s3.id);
ok('U1. seção 1: 2 barras', u1.count, 2); ok('U1b. L = 7 m', u1.length, 7); ok('U1c. massa = 54,95 kg', u1.mass, 54.95);
ok('U2. seção 2: L = 5 m', u2.length, 5); ok('U3. seção 3 sem uso', u3.count, 0);
n++; if (m.removeSection(s1.id).ok !== false) { fails++; console.log('FAIL U4. excluiu seção em uso'); } else console.log('ok   U4. seção em uso não é excluída');
const gone = m.removeUnusedSections();
n++; if (gone.join() !== 'C' || m.sections.size !== 2) { fails++; console.log('FAIL U5', gone); } else console.log('ok   U5. apagar não usadas remove só C');
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
