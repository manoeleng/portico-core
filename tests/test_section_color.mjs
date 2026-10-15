// test_section_color.mjs — colour by section (js/model/layers.js sectionColor; layerView.colorBySection)
//   node tests/test_section_color.mjs
// Expected by definition: a section's own colour wins; otherwise the palette entry (id−1) mod 10 — stable; the two
// colour modes are exclusive and colorBySection survives ensureLayers (file load).
import { Model } from '../js/model/model.js';
import { sectionColor, SECTION_PALETTE, ensureLayers } from '../js/model/layers.js';
let fails = 0, n = 0;
const eq = (name, got, exp) => { n++; if (got !== exp) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
const m = new Model(); m.sections.clear();
const a = m.addSection({ name: 'A', A: 1, Iz: 1, Iy: 1, J: 1 }), b = m.addSection({ name: 'B', A: 1, Iz: 1, Iy: 1, J: 1, color: '#123456' });
eq('C1. paleta pelo id', sectionColor(m, a.id), SECTION_PALETTE[(a.id - 1) % SECTION_PALETTE.length]);
eq('C2. cor própria prevalece', sectionColor(m, b.id), '#123456');
eq('C3. id 11 volta ao início da paleta', sectionColor(m, 11), SECTION_PALETTE[0]);
m.layerView = { colorBySection: true, categories: {} }; ensureLayers(m);
eq('C4. colorBySection preservado', m.layerView.colorBySection, true);
m.layerView = { colorByLayer: true, colorBySection: true, categories: {} }; ensureLayers(m);
eq('C5. modos exclusivos (camada vence)', m.layerView.colorBySection, false);
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
