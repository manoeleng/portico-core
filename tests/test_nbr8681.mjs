// test_nbr8681.mjs — BR-8681-01: combinaciones NBR generadas para G+Q+V (PLANO_BRASIL 3.2)
//   node test_nbr8681.mjs
// Valores esperados calculados A MANO a partir de las tablas (no con el código):
//   concreto: NBR 6118:2026 Tab. 11.1 (γg 1,4; γq 1,4; T 1,2) · Tab. 11.2 (ψ)
//   acero:    NBR 8800:2024 Tab. 1 (γg agrupadas 1,35; γq 1,50; V 1,40; T 1,20) · Tab. 2 (ψ)
//   ψ residencial 0,5/0,4/0,3 · comercial 0,7/0,6/0,4 · viento 0,6/0,3/0 · temperatura 0,6/0,5/0,3
//   sismo: NBR 15421:2023 5.4 (γg 1,2; γq 1,0; γexc 1,0; viento no se combina)
import { nbrCombinations } from '../js/design/combinations_nbr.js';

let fails = 0;
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
const same = (a, b) => { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return ka.join() === kb.join() && ka.every(k => Math.abs(a[k] - b[k]) < 1e-9); };
const has = (list, f) => list.some(c => same(c.factores, f));
const show = (list) => list.map(c => c.nombre).join(' | ');

// (1) Concreto, G+Q+V0, residencial
{
  const r = nbrCombinations({ family: 'concrete', cases: ['G', 'Q', 'V0'] });
  assert('1a. código NBR6118:2026', r.code === 'NBR6118:2026');
  assert('1b. ELU Q principal: 1,4G + 1,4Q + 0,84V0 (1,4·0,6)', has(r.elu, { G: 1.4, Q: 1.4, V0: 0.84 }), show(r.elu));
  assert('1c. ELU V principal: 1,4G + 1,4V0 + 0,7Q (1,4·0,5)', has(r.elu, { G: 1.4, V0: 1.4, Q: 0.7 }));
  assert('1d. ELU G favorable: 1,0G + 1,4V0', has(r.elu, { G: 1.0, V0: 1.4 }));
  // 15/10/2026: a variável secundária favorável não atua (NBR 8681:2025 4.2.2.1.1) → cada combinação também sem ela:
  // e G favorável (1,0) com TODA principal (5.1.3.1, revisão 15/10/2026): Q princ. {−, V0} × (1,4G; 1,0G) = 4 +
  // V0 princ. {−, Q} × (1,4G; 1,0G) = 4 → 8 (antes 3; achado da validação contra Fakury 2017 4.4.1)
  assert('1e. ELU total = 8', r.elu.length === 8, String(r.elu.length));
  assert('1e3. G favorável com Q principal: 1,0G + 1,4Q', has(r.elu, { G: 1.0, Q: 1.4 }));
  assert('1e2. ELU sem o vento secundário: 1,4G + 1,4Q', has(r.elu, { G: 1.4, Q: 1.4 }));
  // ELS-QP com os subconjuntos (variável favorável não atua): G e G + 0,3Q (ψ2 do vento = 0)
  assert('1f. ELS-QP: G e G + 0,3Q', r.qp.length === 2 && has(r.qp, { G: 1, Q: 0.3 }) && has(r.qp, { G: 1 }), show(r.qp));
  assert('1g. ELS-FREQ Q principal: G + 0,4Q', has(r.freq, { G: 1, Q: 0.4 }), show(r.freq));
  assert('1h. ELS-FREQ V principal: G + 0,3V0 + 0,3Q', has(r.freq, { G: 1, V0: 0.3, Q: 0.3 }));
  assert('1i. ELS-RARA: G + Q + 0,3V0', has(r.rara, { G: 1, Q: 1, V0: 0.3 }), show(r.rara));
  assert('1j. ELS-RARA: G + V0 + 0,4Q', has(r.rara, { G: 1, V0: 1, Q: 0.4 }));
  assert('1k. sin sismo → sin ELU excepcional', r.exc.length === 0);
}
// (2) Acero, G+Q+V0, residencial
{
  const r = nbrCombinations({ family: 'steel', cases: ['G', 'Q', 'V0'] });
  assert('2a. código NBR8800:2024', r.code === 'NBR8800:2024');
  assert('2b. ELU: 1,35G + 1,5Q + 0,84V0 (1,4·0,6)', has(r.elu, { G: 1.35, Q: 1.5, V0: 0.84 }), show(r.elu));
  assert('2c. ELU: 1,35G + 1,4V0 + 0,75Q (1,5·0,5)', has(r.elu, { G: 1.35, V0: 1.4, Q: 0.75 }));
  assert('2d. ELU: 1,0G + 1,4V0', has(r.elu, { G: 1.0, V0: 1.4 }));
}
// (3) Dos direcciones de viento: nunca juntas
{
  const r = nbrCombinations({ family: 'concrete', cases: ['G', 'Q', 'V0', 'V90'] });
  assert('3a. ninguna combinación con V0 y V90 juntos', r.lista.every(c => !(('V0' in c.factores) && ('V90' in c.factores))));
  // Q princ. {−, V0, V90} × (1,4G; 1,0G) = 6 + V0 princ. {−, Q} × 2 = 4 + V90 × 2 = 4 → 14
  assert('3b. 14 ELU (secundárias em todos os subconjuntos, um vento por vez, G des/favorável)', r.elu.length === 14, show(r.elu));
  assert('3c. 1,4G + 1,4Q + 0,84V90', has(r.elu, { G: 1.4, Q: 1.4, V90: 0.84 }));
}
// (4) Uso comercial (acero): ψ0 = 0,7
{
  const r = nbrCombinations({ family: 'steel', cases: ['G', 'Q', 'V0'], uso: 'comercial' });
  assert('4a. 1,35G + 1,4V0 + 1,05Q (1,5·0,7)', has(r.elu, { G: 1.35, V0: 1.4, Q: 1.05 }), show(r.elu));
  assert('4b. ELS-QP: G + 0,4Q', has(r.qp, { G: 1, Q: 0.4 }));
}
// (5) Temperatura (concreto): γ 1,2; ψ0 0,6
{
  const r = nbrCombinations({ family: 'concrete', cases: ['G', 'Q', 'T'] });
  assert('5a. 1,4G + 1,4Q + 0,72T (1,2·0,6)', has(r.elu, { G: 1.4, Q: 1.4, T: 0.72 }), show(r.elu));
  assert('5b. 1,4G + 1,2T + 0,7Q', has(r.elu, { G: 1.4, T: 1.2, Q: 0.7 }));
}
// (6) Sismo — NBR 15421:2023 5.4
{
  const r = nbrCombinations({ family: 'concrete', cases: ['G', 'Q', 'V0', 'E0'] });
  assert('6a. 1,2G + 1,0E0 + 0,5Q (ψ0,ef = ψ0, por defecto)', has(r.exc, { G: 1.2, E0: 1, Q: 0.5 }), show(r.exc));
  assert('6b. 1,0G + 1,0E0', has(r.exc, { G: 1.0, E0: 1 }));
  assert('6c. viento no entra en la excepcional', r.exc.every(c => !('V0' in c.factores)));
  assert('6d. sismo no entra en ELU normal ni ELS', [...r.elu, ...r.qp, ...r.freq, ...r.rara].every(c => !('E0' in c.factores)));
  const r2 = nbrCombinations({ family: 'steel', cases: ['G', 'Q', 'E0'], psiSismo: 'psi2' });
  assert('6e. opción ψ2: 1,2G + 1,0E0 + 0,3Q', has(r2.exc, { G: 1.2, E0: 1, Q: 0.3 }), show(r2.exc));
}
// (7) Cobertura: ψ de NBR 8681:2025 Tab. 6 (0,8/0,7/0,6)
{
  const r = nbrCombinations({ family: 'steel', cases: ['G', 'Qcob', 'V0'] });
  assert('7a. 1,35G + 1,4V0 + 1,2Qcob (1,5·0,8)', has(r.elu, { G: 1.35, V0: 1.4, Qcob: 1.2 }), show(r.elu));
}
// (8) Formato rules.json y errores
{
  const r = nbrCombinations({ family: 'concrete', cases: ['G', 'Q'] });
  assert('8a. lista = elu+exc+qp+freq+rara', r.lista.length === r.elu.length + r.exc.length + r.qp.length + r.freq.length + r.rara.length);
  assert('8b. cada item tiene nombre y factores', r.lista.every(c => typeof c.nombre === 'string' && c.factores && typeof c.factores.G === 'number'));
  let e1 = false; try { nbrCombinations({ family: 'timber', cases: ['G'] }); } catch { e1 = true; }
  let e2 = false; try { nbrCombinations({ family: 'steel', cases: ['Q'] }); } catch { e2 = true; }
  assert('8c. familia inválida lanza error', e1);
  assert('8d. sin G lanza error', e2);
}

// (9) Sem duplicatas: G + Q + V0 + V90 — com Q principal, ψ2 do vento = 0 e o G + 0,4Q (ψ1 residencial)
//     sairia uma vez por direção de vento (achado da ficha BR-8681, 15/10/2026)
{
  const r = nbrCombinations({ family: 'concrete', cases: ['G', 'Q', 'V0', 'V90'] });
  const key = o => JSON.stringify(Object.entries(o).sort());
  for (const grp of ['elu', 'exc', 'qp', 'freq', 'rara']) {
    const ks = r[grp].map(c => key(c.factores));
    assert(`9. ${grp} sem combinações repetidas`, new Set(ks).size === ks.length, show(r[grp]));
  }
  assert('9b. G + 0,4Q presente uma vez no frequente', r.freq.filter(c => key(c.factores) === key({ G: 1, Q: 0.4 })).length === 1);
}

// (10) NBR 15421:2023 8.5 — direção das forças sísmicas (texto lido na pág. 17–18 do PDF do acervo):
//      padrão = cada direção separada, sem superposição; categoria C + irregularidade Tipo 3 (Tab. 7) =
//      100 % numa direção + 30 % na ortogonal. Concreto, residencial: γg,exc = 1,2; ψ0,Q = 0,5.
{
  const key = o => JSON.stringify(Object.entries(o).sort());
  const has2 = (arr, f) => arr.some(c => key(c.factores) === key(f));
  const d = nbrCombinations({ family: 'concrete', cases: ['G', 'Q', 'E0', 'E90'] });
  assert('10a. padrão: nenhuma combinação com E0 e E90 juntos', d.exc.every(c => !(c.factores.E0 && c.factores.E90)), show(d.exc));
  const o = nbrCombinations({ family: 'concrete', cases: ['G', 'Q', 'E0', 'E90'], sismoOrtogonal: true });
  assert('10b. 1,2G + 1,0E0 + 0,3E90 + 0,5Q', has2(o.exc, { G: 1.2, E0: 1, E90: 0.3, Q: 0.5 }), show(o.exc));
  assert('10c. 1,2G + 1,0E0 − 0,3E90 + 0,5Q', has2(o.exc, { G: 1.2, E0: 1, E90: -0.3, Q: 0.5 }));
  assert('10d. 1,2G + 1,0E90 ± 0,3E0 + 0,5Q', has2(o.exc, { G: 1.2, E90: 1, E0: 0.3, Q: 0.5 }) && has2(o.exc, { G: 1.2, E90: 1, E0: -0.3, Q: 0.5 }));
  assert('10e. G favorável: 1,0G + 1,0E0 + 0,3E90', has2(o.exc, { G: 1, E0: 1, E90: 0.3 }));
  // por direção: com Q [1,2G+E+ψQ, G+E, ±0,3E⊥ em cada uma (4)] = 6 + sem Q [1,2G+E, 1,2G+E ± 0,3E⊥] = 3 → 9 × 2 = 18
  assert('10f. 18 combinações excepcionais (2 direções × 9)', o.exc.length === 18, String(o.exc.length));
}

console.log(fails ? `\n${fails} FALLA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
