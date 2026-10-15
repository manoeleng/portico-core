// test_section_beta.mjs — default roll angle of a section with per-member override (model.js)
//   node tests/test_section_beta.mjs
// Expected by definition (RFEM "section rotation" + member override): members follow sec.beta unless they have their
// own β (betaOwn, any value including 0); β = null returns a member to the section; changing the section of a member
// without own β takes the new section's default; new members of the section start with its default.
import { Model } from '../js/model/model.js';
let fails = 0, n = 0;
const eq = (name, got, exp) => { n++; if (got !== exp) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
const m = new Model(); m.materials.clear(); m.sections.clear();
const mat = m.addMaterial({ name: 'S', E: 2e8, G: 8e7, nu: 0.3, rho: 7.85 });
const s1 = m.addSection({ name: 'A', A: 1, Iz: 1, Iy: 1, J: 1 }), s2 = m.addSection({ name: 'B', A: 1, Iz: 1, Iy: 1, J: 1 });
const N = [0, 1, 2, 3].map((x) => m.addNode(x, 0, 0).id);
const e1 = m.addElement(N[0], N[1], mat.id, s1.id), e2 = m.addElement(N[1], N[2], mat.id, s1.id);
m.updateSection(s1.id, { beta: 90 });
eq('B1. barra sem β próprio segue a seção', +m.elements.get(e1.id).beta, 90);
m.updateElement(e2.id, { beta: 0 });
m.updateSection(s1.id, { beta: -90 });
eq('B2. seção muda: barra sem β próprio acompanha', +m.elements.get(e1.id).beta, -90);
eq('B3. barra com β próprio = 0 não muda', +m.elements.get(e2.id).beta || 0, 0);
m.updateElement(e2.id, { beta: null });
eq('B4. β = null volta à seção', +m.elements.get(e2.id).beta, -90);
m.updateSection(s2.id, { beta: 30 }); m.updateElement(e1.id, { secId: s2.id });
eq('B5. troca de seção herda o β da nova', +m.elements.get(e1.id).beta, 30);
const e3 = m.addElement(N[2], N[3], mat.id, s2.id);
eq('B6. barra nova nasce com o β da seção', +m.elements.get(e3.id).beta, 30);
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
