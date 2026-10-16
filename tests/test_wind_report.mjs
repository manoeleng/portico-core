// test_wind_report.mjs — módulo de vento (estudo NBR 6123:2023 para relatório, js/design/wind_report.js)
//   node tests/test_wind_report.mjs
// Oráculo de literatura: CBCA, Pravia/Drehmer/Mesacasa Jr., "Galpões para usos gerais", 4ª ed. 2010, pp. 22–27 —
// galpão 15 × 54 m, pé-direito 6 m, θ = 10° (cumeeira 7,32 m), V0 = 40 m/s, S1 = 1, cat. III, classe C, S3 = 0,95
// (depósito → grupo 4 da 2023), Cpi +0,2 / −0,3: S2(7,3 m) = 0,85; Vk = 32,30 m/s; q = 639,54 N/m²; Cpe paredes
// A1/B1 −0,8, A2/B2 −0,4, A3/B3 −0,2, C +0,7, D −0,3, A +0,7, B −0,5, C1/D1 −0,9, C2/D2 −0,5; telhado EG −0,8,
// FH −0,6, IJ −0,2, EFI −1,2, GHJ −0,4; x0 = 12 m (2h com h = 6 m); Cp 90° com Cpi +0,2: A +0,5, B −0,7, EF −1,4,
// GH −0,6 (Figs. 41/42). Geometria das zonas (NBR 6123:2023 Tab. 6/7, figuras): C1/D1 = mín(2h; b/2) = 7,5 m;
// y = mín(h; 0,15b) = 2,25 m; faixa do cpe médio das paredes = mín(0,2b; h) = 3,0 m.
import fs from 'node:fs';
import { windStudy, svgParedes, svgTelhado, svgPerfil, s2At } from '../js/design/wind_report.js';
import * as WF from '../js/design/wind_figs.js';
const w = JSON.parse(fs.readFileSync(new URL('../presets/brasil/rules.json', import.meta.url), 'utf8')).loads.wind;
let fails = 0, n = 0;
const ok = (name, got, exp, tol) => { n++; const d = Math.abs(got - exp); if (!(d <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
const yes = (name, c) => { n++; if (!c) { fails++; console.log(`FAIL ${name}`); } else console.log(`ok   ${name}`); };
const st = windStudy({ obra: 'CBCA', V0: 40, S1: 1, categoria: 'III', grupoS3: 4, a: 54, b: 15, hBeiral: 6, theta: 10, cpi: [0.2, -0.3] }, w);
ok('W1. topo = 6 + 7,5·tg10° = 7,322 m', st.hTop, 6 + 7.5 * Math.tan(10 * Math.PI / 180), 1e-3);
ok('W2. S2(7,3 m) [CB p.23] (tabela 2 decimais)', st.res.S2, 0.85, 0.0051);
ok('W3. q [CB p.23] (N/m²; S2 arredondado na fonte)', st.res.q_Nm2, 639.54, 0.0128 * 639.54);
ok('W4. x0 = 12 m [CB p.24]', st.geo.x0, 12, 1e-9);
ok('W5. C1/D1 = mín(2h; b/2) = 7,5 m (Tab. 6)', st.geo.xC1, 7.5, 1e-9);
ok('W6. y = mín(h; 0,15b) = 2,25 m (Tab. 7)', st.geo.y, 2.25, 1e-9);
ok('W7. faixa cpe médio = mín(0,2b; h) = 3,0 m (Tab. 6 Nota 4)', st.geo.faixaParede, 3.0, 1e-9);
const Z = Object.fromEntries(st.zonas.map((z) => [z.z, z]));
for (const [k, v] of [['A1/B1', -0.8], ['A2/B2', -0.4], ['A3/B3', -0.2], ['C', 0.7], ['D', -0.3], ['A', 0.7], ['B', -0.5], ['C1/D1', -0.9], ['C2/D2', -0.5],
  ['EG', -0.8], ['FH', -0.6], ['IJ', -0.2], ['EFI', -1.2], ['GHJ', -0.4]]) ok(`W8. Cpe ${k} [CB pp.24–25]`, Z[k].cpe, v, 1e-9);
for (const [k, v] of [['A', 0.5], ['B', -0.7], ['EFI', -1.4], ['GHJ', -0.6]]) ok(`W9. Cp ${k} com Cpi +0,2 [CB Fig.41]`, Z[k].por.find((p) => p.cpi === 0.2).cp, v, 1e-9);
ok('W10. p EFI (Cpi +0,2) = q·Cp (kN/m²)', Z.EFI.por.find((p) => p.cpi === 0.2).p, st.res.q_Nm2 / 1000 * -1.4, 1e-3);
ok('W11. perfil: S2 no topo = S2 do cálculo', st.perfil[st.perfil.length - 1].S2, st.res.S2, 1e-3);
ok('W12. s2At(5 m) = s2At(3 m) (constante abaixo de 5 m, Tab. 3)', s2At(w, 'III', 'C', 3), s2At(w, 'III', 'C', 5), 1e-12);
yes('W13. figuras SVG geradas (paredes 0°/90°, telhado 0°/90°, perfil)', [svgParedes(st, 0), svgParedes(st, 90), svgTelhado(st, 0), svgTelhado(st, 90), svgPerfil(st)].every((s) => /^<svg[\s\S]*<\/svg>$/.test(s)));
yes('W14. cpe médio do telhado lido da Tab. 7 (faixa de θ)', st.cpeMedioTelhado.length > 0 && st.cpeMedioTelhado.some((c) => c.cpe === -1.4));
// figuras (blocos de carga): SVG válido, sem NaN, e os valores do CBCA nas figuras
{ const figs = [WF.figIsometrica(st), WF.figVistas(st), WF.figParedes(st, 90), WF.figParedes(st, 0), WF.figTelhado(st, 90), WF.figTelhado(st, 0),
    WF.figCorte(st, 90, 0.2, 'cp'), WF.figCorte(st, 0, -0.3, 'cp', { r: 1 }), WF.figCorte(st, 90, 0.2, 'q', { spacing: 6 }), WF.figCorte(st, 90, 0.2, 'cpi'), WF.figCpeMedio(st), WF.figPerfil(st)];
  yes('W15. 12 figuras SVG (isométrica, vistas, paredes, telhado, cortes Cp/q/Cpi, Cpe médio, perfil)', figs.every((f) => /^<svg[\s\S]*<\/svg>$/.test(f) && !/NaN|undefined/.test(f)));
  yes('W16. paredes 90°: Cpe A 0,7, C1 0,9 e C2 0,5 nos blocos [CB pp.24–25]', />0,7</.test(figs[2]) && />0,9</.test(figs[2]) && />0,5</.test(figs[2]));
  yes('W17. corte 90° com Cpi +0,2: EFI 1,4 e A 0,5 (Cp) [CB Fig.41]', />1,4</.test(figs[6]) && />0,5</.test(figs[6]));
  const qEFI = Math.abs(st.res.q_Nm2 / 1000 * -1.4 * 6);
  yes('W18. força no pórtico (6 m): EFI = q·1,4·6 kN/m [CB p.27 Tab.01: 5,38]', figs[8].includes(qEFI.toLocaleString('pt-BR', { maximumFractionDigits: 3 })) && Math.abs(qEFI - 5.38) < 0.03); }
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
