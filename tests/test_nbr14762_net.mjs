// test_nbr14762_net.mjs — NBR 14762:2010 9.6.2 b/c: ruptura da seção líquida fora e na região da ligação (Ct de perfis)
//   node tests/test_nbr14762_net.mjs
// Fonte: NBR 14762:2010 9.6.2 (págs. 40–42 do PDF do acervo): b) An0·fu/1,35; c) Ct·An·fu/1,65; Ct de perfis:
//   parafusados — todos os elementos conectados (≥ 2 parafusos) 1,0; parafusos numa única seção 2,5·d/g ≤ 1;
//   U/L sem todos os elementos conectados 1 − 1,2·x/L (≤ 0,9; abaixo de 0,4 a ligação NÃO é permitida);
//   soldados — U com soldas longitudinais 1 − 0,36·x/L (≤ 0,9; < 0,5 não permitida).
// Oráculo de literatura: Manual CBCA "Estruturas Compostas por Perfis Formados a Frio", Ex. 01 (pág. 44):
//   L 125×6,3, A = 15,1 cm², fy = 24, fu = 40 kN/cm², parafusos 16 mm, L = 10 cm, x = 4,19 cm, An = 10,4 cm²
//   escoamento 15,1·24/1,1 = 329,45 kN; Ct = 1 − 1,2·4,19/10 = 0,4972 (o livro arredonda para 0,5 → 126,1 kN)
//   → Nt,Rd = 0,4972·10,4·40/1,65 = 125,35 kN (exato; tolerância 0,7 % contra o livro)
// Divergências do mesmo manual com a norma (não usadas como oráculo): Ex. 02/03 usam γ = 1,35 na ruptura NA região da
//   ligação (a norma dá 1,65 em 9.6.2 c) e o Ex. 03 adota Ct = 0,4 como piso quando a norma proíbe a ligação.
import { nbr14762, ctPerfil14762 } from '../js/design/codes/nbr14762.js';

let fails = 0, n = 0;
const ok = (name, got, exp, rel = 1e-4) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= rel)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)}%)`); } else console.log(`ok   ${name}: ${got}`); };
const assert = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name}${info ? ' · ' + info : ''}`); } else console.log(`ok   ${name}`); };
const mat = { Fy: 240e3, Fu: 400e3, E: 200e6, G: 77e6 };
const secL = { shape: 'L', A: 15.1e-4, dims: { d: 0.125, b: 0.125, t: 0.0063 } };
const run = (sl, sec = secL) => nbr14762.check({ demands: { N: 50 }, mat, sec, member: { L: 3, secaoLiquida: sl }, options: {} });

{
  const r = run({ An: 10.4e-4, ligacao: 'parafusada', nDirecao: 2, x: 0.0419, Lc: 0.10, tipo: 'L' });
  ok('T1. Ex. 01 (CBCA): Ct·An·fu/1,65 governa', r.axial.capacity, 125.35, 2e-4);
  ok('T1b. contra o livro (126,1 com Ct arredondado 0,5)', r.axial.capacity, 126.1, 0.007);
  ok('T1c. Ct = 0,4972', r.axial.Ct, 0.4972, 1e-3);
  assert('T1d. fórmula cita 9.6.2 c', /9\.6\.2 c/.test(r.axial.formula));
}
{
  const r = run({ An: 14.0e-4, ligacao: 'parafusada', nDirecao: 3, todosConectados: true });
  ok('T2. todos os elementos conectados: Ct = 1 → 14,0·40/1,65 = 339,39 > 329,45 → escoamento', r.axial.capacity, 329.45, 2e-4);
  const b = run({ An0: 12.0e-4 });
  ok('T3. An0 fora da ligação: 12·40/1,35 = 355,56 > escoamento → 329,45', b.axial.capacity, 329.45, 2e-4);
  const b2 = run({ An0: 10.0e-4 });
  ok('T3b. An0 = 10 cm²: 10·40/1,35 = 296,30 governa', b2.axial.capacity, 296.30, 2e-4);
}
{
  // Ex. 03 (geometria): L = 4 cm, x = 2,48 → Ct = 1 − 1,2·0,62 = 0,256 < 0,4 → ligação NÃO permitida pela norma
  const r = run({ An: 7.47e-4, ligacao: 'parafusada', nDirecao: 2, x: 0.0248, Lc: 0.04, tipo: 'L' });
  assert('T4. Ct < 0,4: ligação não permitida → NÃO verificada', !isFinite(r.axial.ratio) && r.avisos.some(a => /não permitida/.test(a)));
}
// Ct isolado (comprimentos em cm)
ok('C1. parafusos numa única seção: 2,5·d/g = 2,5·1,6/8 = 0,5', ctPerfil14762({ ligacao: 'parafusada', nDirecao: 1, d: 1.6, g: 8 }).Ct, 0.5, 1e-12);
ok('C2. U soldado (longitudinais): 1 − 0,36·2/6 = 0,88', ctPerfil14762({ ligacao: 'soldada', x: 2, Lc: 6, tipo: 'U' }).Ct, 0.88, 1e-12);
ok('C3. U soldado: limite superior 0,9', ctPerfil14762({ ligacao: 'soldada', x: 0.5, Lc: 10, tipo: 'U' }).Ct, 0.9, 1e-12);
assert('C4. U soldado com Ct < 0,5: não permitida', !!ctPerfil14762({ ligacao: 'soldada', x: 8, Lc: 4, tipo: 'U' }).erro);
ok('C5. só soldas transversais: 1,0', ctPerfil14762({ ligacao: 'soldada', soldas: 'transversais' }).Ct, 1, 1e-12);
assert('C6. sem Ct nem ligação: erro', !!ctPerfil14762({}).erro);
{
  const r = nbr14762.check({ demands: { N: 50 }, mat, sec: secL, member: { L: 3 }, options: {} });
  assert('C7. sem secaoLiquida: aviso de 9.6.2 b/c não verificada', r.avisos.some(a => /9\.6\.2 b\/c/.test(a)));
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
