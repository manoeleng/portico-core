// test_i18n_tf.mjs — mensagens com número embutido (i18n.tf) e as notas/resumos que as usam (PLANO_BRASIL item 9)
//   node tests/test_i18n_tf.mjs
globalThis.document = { documentElement: {}, body: null };   // setLocale re-translates the DOM; none in node
const { i18n } = await import('../js/i18n/i18n.js');
const { predimensionar } = await import('../js/design/autodesign.js');
const { EN } = await import('../js/i18n/dict.en.js');
const { PT } = await import('../js/i18n/dict.pt.js');

let fails = 0, n = 0;
const eq = (name, got, exp) => { n++; if (got !== exp) { fails++; console.log(`FAIL ${name}:\n  ${got}\n≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };

const show = (p) => i18n.tf(p.notaT.k, p.notaT.v);
const madeira = predimensionar({ tipo: 'viga', material: 'timber', L: 4 });   // h = ⌈(4/17)/0,025⌉·0,025 = 0,250; b = ⌈0,0833/0,025⌉·0,025 = 0,100
const pilar = predimensionar({ tipo: 'columna', material: 'concrete', N: 800, fc: 25 });   // Ag = 800/8750 = 0,0914 → a = 0,35

i18n.setLocale('es');
eq('F1. es: texto de origem (igual à nota antiga)', show(madeira), madeira.nota);
eq('F1b. es: pilar H.A. igual à nota antiga', show(pilar), pilar.nota);
i18n.setLocale('pt');
eq('F2. pt: nota de madeira', show(madeira), 'madeira: h≈L/17=250 mm, b≈h/3=100 mm');
eq('F2b. pt: pilar de concreto', show(pilar), 'pilar de concreto armado: Ac≈N/(0,35·fck) → 35×35 cm');
eq('F3. pt: valor string traduzido', i18n.tf('nave de {mat}, luz {luz} m × largo {largo} m, {nf} pórticos @{sep} m, cerchas {tc} con pendiente {pend}%: {nn} nudos, {ne} barras',
  { mat: 'acero', luz: 20, largo: 30, nf: 6, sep: 6, tc: 'pratt', pend: 10, nn: 120, ne: 300 }),
  'galpão de aço, vão 20 m × comprimento 30 m, 6 pórticos a cada 6 m, treliças pratt com inclinação 10%: 120 nós, 300 barras');
eq('F4b. pt: vírgula decimal', i18n.tf('{x} m', { x: 7.5 }), '7,5 m');
eq('F4. placeholder sem valor fica visível', i18n.tf('{x} y {y}', { x: 1 }), '1 y {y}');
i18n.setLocale('en');
eq('F5b. en: ponto decimal', i18n.tf('{x} m', { x: 7.5 }), '7.5 m');
eq('F5. en: resumo do edifício', i18n.tf('{nn} nudos, {ne} elementos, {nc} casos, {ncb} combinaciones', { nn: 1, ne: 2, nc: 3, ncb: 4 }), '1 nodes, 2 elements, 3 cases, 4 combinations');
// every template key keeps the same placeholders in EN and PT
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
const bad = Object.keys(PT).filter(k => /\{\w+\}/.test(k) && (ph(PT[k]) !== ph(k) || ph(EN[k] || '') !== ph(k)));
eq('F6. placeholders iguais em ES/EN/PT', bad.join(' | '), '');

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
