// test_cpe_multiplos.mjs — Cpe de telhados de calha central e múltiplos (NBR 6123:2023 Tab. 9–12)
//   node assistant/test_cpe_multiplos.mjs
// Oráculo: células das Tabelas 9, 10, 11 e 12 da NBR 6123:2023 (págs. 23–26 do PDF do acervo),
// conferidas na imagem da página; interpolação em θ = média aritmética das linhas vizinhas.
import { readFileSync } from 'node:fs';
import { cpeTelhadoMultiplo } from './loads.js';

const rules = JSON.parse(readFileSync(new URL('../presets/brasil/rules.json', import.meta.url), 'utf8'));
const w = rules.loads.wind;
let fails = 0;
const eq = (name, got, exp) => { const p = JSON.stringify(got) === JSON.stringify(exp); if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`); };

// Tab. 9 — a/b = 2, h'p/h ≤ 0,05: α = 90° EF −0,8 / GH −0,3; α = 0° EG −0,4 / FH +0,2
eq('9a. calha a/b=2 α=90°', cpeTelhadoMultiplo(w, 'calha', { alpha: 90, a_b: 2, hp_h: 0.05 }).ce, { EF: -0.8, GH: -0.3 });
eq('9b. calha a/b=2 α=0°', cpeTelhadoMultiplo(w, 'calha', { alpha: 0, a_b: 2, hp_h: 0.05 }).ce, { EG: -0.4, FH: 0.2 });
eq('9c. calha a/b=1, h\'p/h=0,15 α=0°', cpeTelhadoMultiplo(w, 'calha', { alpha: 0, a_b: 1, hp_h: 0.15 }).ce, { EG: -0.7, FH: -0.3 });
eq('9d. a/b=1,5 fora da tabela → null', cpeTelhadoMultiplo(w, 'calha', { alpha: 0, a_b: 1.5, hp_h: 0.05 }).ce, null);
// Tab. 10 — θ = 10°, α = 0°: a* −1,1 … z* −0,4; θ = 45°: a* +0,3; α = 90°: b1 −0,8, b2 −0,6, b3 −0,2
eq('10a. simétrico θ=10°', cpeTelhadoMultiplo(w, 'simetrico', { alpha: 0, theta: 10 }).ce, { a: -1.1, b: -0.6, c: -0.4, d: -0.3, m: -0.3, n: -0.3, x: -0.3, z: -0.4 });
eq('10b. simétrico θ=45° a*', cpeTelhadoMultiplo(w, 'simetrico', { alpha: 0, theta: 45 }).ce.a, 0.3);
eq('10c. simétrico θ=25° (entre 20° e 30°) a*', cpeTelhadoMultiplo(w, 'simetrico', { alpha: 0, theta: 25 }).ce.a, -0.45);
eq('10d. α=90° faixas', cpeTelhadoMultiplo(w, 'simetrico', { alpha: 90, theta: 20 }).ce, { b1: -0.8, b2: -0.6, b3: -0.2 });
eq('10e. θ=60° fora → null', cpeTelhadoMultiplo(w, 'simetrico', { alpha: 0, theta: 60 }).ce, null);
// Tab. 11 — α = 0°: a* +0,6 … z* −0,3; α = 180°: a* −0,5 … z* −0,1
eq('11a. assimétrico 60° α=0°', cpeTelhadoMultiplo(w, 'assimetrico60', { alpha: 0 }).ce, { a: 0.6, b: -0.7, c: -0.7, d: -0.4, m: -0.3, n: -0.2, x: -0.1, z: -0.3 });
eq('11b. assimétrico 60° α=180°', cpeTelhadoMultiplo(w, 'assimetrico60', { alpha: 180 }).ce, { a: -0.5, b: -0.3, c: -0.3, d: -0.3, m: -0.4, n: -0.6, x: -0.6, z: -0.1 });
// Tab. 12 — θ = 30°: α = 0° a* +0,7, z* −0,2; α = 180° z* +0,1; α = 90° b1 −0,9, b3 −0,3
eq('12a. shed θ=30° α=0°', cpeTelhadoMultiplo(w, 'shed', { alpha: 0, theta: 30 }).ce, { a: 0.7, b: -0.7, c: -0.6, d: -0.4, m: 0.1, n: -0.2, x: 0.1, z: -0.2 });
eq('12b. shed θ=30° α=180° z*', cpeTelhadoMultiplo(w, 'shed', { alpha: 180, theta: 30 }).ce.z, 0.1);
eq('12c. shed θ=30° α=90°', cpeTelhadoMultiplo(w, 'shed', { alpha: 90, theta: 30 }).ce, { b1: -0.9, b2: -0.6, b3: -0.3 });
eq('12d. shed θ=5° fora → null', cpeTelhadoMultiplo(w, 'shed', { alpha: 0, theta: 5 }).ce, null);
{ const r = cpeTelhadoMultiplo(w, 'simetrico', { alpha: 0, theta: 25 });
  eq('13. interpolação sinalizada nas notas', r.notas.some(n => /interpolado/.test(n)), true); }

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
