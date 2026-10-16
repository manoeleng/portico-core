// test_nbr14762_vz.mjs — cortante paralela às mesas (Vz) de U/Ue formados a frio pela NBR 8800:2024 5.4.3.5 (referência
// externa: a NBR 14762:2010 9.8.3 só trata alma — decisão do Manoel, 16/10/2026, como nas abas das cantoneiras)
//   node tests/test_nbr14762_vz.mjs
// Oráculo: cálculo manual (E = 20 000 kN/cm², kv = 1,2, γa1 = 1,10), h = parte plana da mesa b = bf − (t + ri), Aw = 2·b·t
// (revisor-calculo-nbr 16/10/2026: a mais segura das duas leituras; o texto da 8800 usa bf):
//   fy = 25: λp = 1,10·√(kv·E/fy) = 34,082; λr = 1,37·√(kv·E/fy) = 42,448; λ = b/t; Vpl = 0,60·2·b·t·fy
//   U 150x75x2,65: b = 6,97, λ = 26,30 ≤ λp → Vpl = 55,412 kN → VRd = 50,374 kN
//   Ue 150x60x20x2,00: b = 5,60, λ = 28,0 ≤ λp → Vpl = 33,6 kN → VRd = 30,545 kN (enrijecedor desprezado)
//   U 100x50x1,20: b = 4,76, λ = 39,667 (λp < λ ≤ λr) → VRk = (λp/λ)·Vpl = 0,85921·17,136 → VRd = 13,385 kN
//   U 100x50x1,20 com fy = 34,5 (regime elástico; nenhum perfil do catálogo passa de λr com fy = 25): λp = 29,013,
//   λr = 36,134 < λ = 39,667 → VRk = 1,24·(λp/λ)²·Vpl = 1,24·0,53496·23,648 → VRd = 14,261 kN
import { nbr14762 } from '../js/design/codes/nbr14762.js';
import { cfSection } from '../js/design/profiles_cf.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol) => { n++; const d = (got - exp) / Math.abs(exp); if (!(Math.abs(d) <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (Δ ${(d * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(4)} (Δ ${(d * 100).toFixed(2)} %)`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const mat = { Fy: 250e3, Fu: 400e3, E: 2e8, G: 7.7e7 };
const run = (nm, demands, m = mat) => nbr14762.check({ demands, mat: m, sec: { ...cfSection(nm), coldFormed: true }, member: { L: 1.6, Lx: 1.6, Ly: 1.6, Lz: 1.6, Cb: 1 } });
for (const [nm, exp, regime, m] of [['U 150x75x2,65', 50.374, 'plastificação'], ['Ue 150x60x20x2,00', 30.545, 'plastificação'], ['U 100x50x1,20', 13.385, 'inelástico'],
  ['U 100x50x1,20', 14.261, 'elástico', { ...mat, Fy: 345e3 }]]) {
  const r = run(nm, { Vz: 2 }, m);
  ok(`${nm}: VRd (Vz) kN`, r.corteZ.capacity, exp, 1e-3);
  yes(`${nm}: regime ${regime}`, r.corteZ.regime === regime, r.corteZ.regime);
  ok(`${nm}: razão = 2/VRd`, r.corteZ.ratio, 2 / exp, 1e-3);
  yes(`${nm}: aviso da referência externa`, r.avisos.some((a) => /5\.4\.3\.5/.test(a)));
}
{ const r = run('U 150x75x2,65', { Vz: 0 }); yes('Vz = 0: razão 0, sem aviso', r.corteZ.ratio === 0 && !r.avisos.some((a) => /5\.4\.3\.5/.test(a))); }
{ const r = run('U 150x75x2,65', { Vy: 5 }); yes('Vy (alma) segue a 9.8.3 (kv = 5)', r.corteY.kv === 5 && r.corteY.capacity > 0); }
console.log(fails ? `\n${fails}/${n} FALHA(S)` : `\nOK ${n}/${n}`);
process.exit(fails ? 1 : 0);
