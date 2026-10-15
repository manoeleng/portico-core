// test_timber_deflection.mjs — ELS de deslocamentos da madeira, ABNT NBR 7190-1:2022 seção 8 (Tab. 20 e 21)
//   node tests/test_timber_deflection.mjs
// Oráculo: cálculo manual independente sobre o texto da norma (págs. 77–79 do PDF do acervo,
// Normas_7190-2022\ABNT NBR 7190-1-2022.pdf).
//   Viga biapoiada de madeira serrada, L = 4,0 m, classe de umidade 2 → φ = 0,8 (Tab. 20)
//   δinst,G = 6,0 mm; Q (residencial, ψ1 = 0,4, ψ2 = 0,3) δinst,Q = 5,0 mm
//     δinst = 6,0 + 5,0 = 11,0 mm; limites L/500 = 8,0 e L/300 = 13,33 → 'faixa'
//     δfin  = 6,0·1,8 + 5,0·0,3·1,8 = 10,8 + 2,7 = 13,5 mm; L/300 = 13,33, L/150 = 26,67 → 'faixa'
//     δnet,fin (sem contraflecha) = 13,5; L/350 = 11,43, L/250 = 16,0 → 'faixa'
//     contraflecha 5 mm (≤ 2/3·6 = 4 mm → limitada a 4,0): δnet,fin = 9,5 mm → 'atende'
//   Com vento (ψ1 = 0,3, ψ2 = 0) δinst,V = 3,0 mm:
//     principal Q: 5,0 + 0,3·3,0 = 5,9; principal V: 3,0 + 0,4·5,0 = 5,0 → Q principal, δinst = 11,9 mm
//     δfin inalterado (ψ2 do vento = 0) = 13,5 mm
//   Frágeis (leitura mais severa de 8.2, soma característica sem ψ1 — o PDF tem o parêntese em branco):
//     3,0 + 5,0 = 8,0 mm ≤ min(L/500 = 8,0; 15) → atende (no limite)
//   Forma EN 1995 (informativa, Dias et al. 2019) no T1: 6,0·1,8 + 5,0·(1 + 0,3·0,8) = 10,8 + 6,2 = 17,0 mm
//   Balanço L = 1,2 m, classe 4 (φ = 2,0): δinst,G = 3,0, δinst,Q = 4,0 (ψ2 = 0,3)
//     δinst = 7,0; L/250 = 4,8, L/150 = 8,0 → 'faixa'; δfin = 3·3 + 4·0,3·3 = 12,6; L/75 = 16,0, L/150 = 8,0 → 'faixa'
//     δnet = 12,6; L/125 = 9,6 → 'excede'
//   OSB classe 4: sem φ (Tab. 20) → erro
import { timberDeflectionCheck, creepCoefficient } from '../js/design/timber_deflection.js';

let fails = 0, n = 0;
const ok = (name, got, exp, rel = 0.001) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= rel)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
const eq = (name, got, exp) => { n++; if (got !== exp) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };

ok('T0. φ serrada classe 2 (Tab. 20)', creepCoefficient('serrada', 2), 0.8);
ok('T0b. φ compensado classe 4', creepCoefficient('compensado', 4), 2.5);
{
  const r = timberDeflectionCheck({ L: 4, dG: 0.006, dQ: [{ delta: 0.005, psi1: 0.4, psi2: 0.3 }], material: 'serrada', classeUmidade: 2 });
  ok('T1. δinst', r.inst.delta * 1000, 11.0);
  eq('T1b. δinst entre L/500 e L/300', r.inst.status, 'faixa');
  ok('T1c. δfin', r.fin.delta * 1000, 13.5);
  eq('T1d. δfin entre L/300 e L/150', r.fin.status, 'faixa');
  eq('T1e. δnet,fin entre L/350 e L/250', r.net.status, 'faixa');
  eq('T1f. veredito geral', r.status, 'faixa');
  ok('T1g. δfin pela forma EN 1995 (informativo)', r.finEN * 1000, 17.0);
}
{
  const r = timberDeflectionCheck({ L: 4, dG: 0.006, dQ: [{ delta: 0.005, psi1: 0.4, psi2: 0.3 }], material: 'serrada', classeUmidade: 2, camber: 0.005 });
  ok('T2. contraflecha limitada a 2/3·δG → δnet,fin', r.net.delta * 1000, 9.5);
  eq('T2b. δnet,fin atende', r.net.status, 'atende');
}
{
  const r = timberDeflectionCheck({ L: 4, dG: 0.006, dQ: [{ delta: 0.003, psi1: 0.3, psi2: 0 }, { delta: 0.005, psi1: 0.4, psi2: 0.3 }], phi: 0.8, frageis: true });
  ok('T3. δinst com vento (Q principal)', r.inst.delta * 1000, 11.9);
  eq('T3b. principal = Q', r.principal, 1);
  ok('T3c. δfin (ψ2 do vento = 0)', r.fin.delta * 1000, 13.5);
  ok('T3d. frágeis: soma característica das variáveis', r.frageis.delta * 1000, 8.0);
  eq('T3e. frágeis atende', r.frageis.status, 'atende');
}
{
  const r = timberDeflectionCheck({ L: 1.2, cantilever: true, dG: 0.003, dQ: [{ delta: 0.004, psi1: 0.4, psi2: 0.3 }], classeUmidade: 4 });
  ok('T4. balanço δfin (φ = 2,0)', r.fin.delta * 1000, 12.6);
  eq('T4b. balanço δinst faixa', r.inst.status, 'faixa');
  eq('T4c. balanço δfin faixa', r.fin.status, 'faixa');
  eq('T4d. balanço δnet,fin excede (L/125 = 9,6)', r.net.status, 'excede');
  eq('T4e. veredito geral', r.status, 'excede');
}
{
  const r = timberDeflectionCheck({ L: 4, dG: 0.006, dQ: [{ delta: 0.005, psi1: 0.4, psi2: 0.3 }], phi: 0.8, limites: { inst: 300, fin: 250, net: 300 } });
  eq('T5. limites do projetista: δinst 11,0 ≤ L/300 = 13,33', r.inst.status, 'atende');
  eq('T5b. δfin 13,5 ≤ L/250 = 16,0', r.fin.status, 'atende');
}
{
  // frágeis com folga e com reprovação: L = 5 m → min(L/500 = 10; 15) = 10 mm; ΣδQ = 6 → atende; ΣδQ = 12 → excede
  const f = (dq) => timberDeflectionCheck({ L: 5, dG: 0.002, dQ: [{ delta: dq, psi1: 0.4, psi2: 0.3 }], phi: 0.6, frageis: true }).frageis.status;
  eq('T7. frágeis com folga (6 ≤ 10 mm)', f(0.006), 'atende');
  eq('T7b. frágeis reprova (12 > 10 mm)', f(0.012), 'excede');
  // vão longo: L = 10 m → L/500 = 20 > 15 mm governa; ΣδQ = 16 → excede
  eq('T7c. frágeis, teto de 15 mm governa', timberDeflectionCheck({ L: 10, dQ: [{ delta: 0.016 }], phi: 0.6, frageis: true }).frageis.status, 'excede');
}
eq('T6. OSB classe 4 sem φ', !!timberDeflectionCheck({ L: 4, material: 'osb', classeUmidade: 4 }).erro, true);

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
