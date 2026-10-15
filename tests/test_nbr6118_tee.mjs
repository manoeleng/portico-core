// test_nbr6118_tee.mjs — viga de seção T de concreto armado (mesa comprimida) pela NBR 6118:2026 (17.2.2)
//   node tests/test_nbr6118_tee.mjs
// Oráculos:
//   Carvalho & Figueiredo Filho (2014), Vol. 1, cap. 3, Exemplos 8 e 9 (pág. 151–154 do PDF do acervo):
//     bf = 170, hf = 20, bw = 18, d = 175 cm, C30, CA-50 (γc = 1,4, γs = 1,15, 0,85·fcd, λ = 0,8)
//     Ex. 8: Md = 6 770 kN·m → bloco na mesa (seção retangular bf) → As = 92,7 cm² (livro, com KZ tabelado);
//            cálculo exato: λx = 0,1297 m < hf, As = 92,40 cm²
//     Ex. 9: Md = 10 000 kN·m → livro (abas + alma): As = 139,25 cm²; o livro classifica como T por x = 0,246 > hf,
//            mas pelo bloco de 17.2.2 λx = 0,1955 < hf = 0,20 (bloco ainda na mesa): exato 139,20 cm² — os dois coincidem
//   Cálculo manual independente (mesmos dados):
//     Md = 12 000 kN·m: retângulo bf daria λx = 0,2376 > hf → T. M1 = 0,85·fcd·hf·(bf − bw)·(d − hf/2) = 9 136,29;
//       alma bw com M2 = 2 863,71 → x/d = 0,4307 ≤ 0,45; As = M1/((d − hf/2)·fyd) + alma = 172,83 cm²
//     MRd com As = 160 cm² (h = 1,85 m): F = As·fyd = 6 956,5 kN; abas 5 537,1 kN → λx = 0,43293 m na alma,
//       x/d = 0,309, εs = 7,8 ‰ (escoando) → MRd = 5 537,1·1,65 + 0,85·fcd·0,18·0,43293·(1,75 − 0,21646) = 11 312,96 kN·m
//     As,mín (17.3.5.2.1): Ac = 0,637 m², yc = 0,53128 m, I = 0,204153 m⁴, W0 (fibra inferior) = 0,154811 m³,
//       Md,mín = 0,8·W0·1,3·fct,m (2,896 MPa) = 466,3 kN·m → As ≈ 6,1 cm² < 0,15 %·Ac = 9,555 cm² → As,mín = 9,555 cm²
import { resolveSectionProps } from '../js/design/section_props.js';
import { nbr6118 } from '../js/design/codes/nbr6118.js';

let fails = 0, n = 0;
const ok = (name, got, exp, rel = 0.002) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= rel)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)}%)`); } else console.log(`ok   ${name}: ${got}`); };
const assert = (name, c) => { n++; if (!c) { fails++; console.log(`FAIL ${name}`); } else console.log(`ok   ${name}`); };

const mat = { fc: 30e3, fyRebar: 500e3 };
const secT = (As) => resolveSectionProps({ design: { shape: 'tee', dims: { d: 1.85, bf: 1.70, tf: 0.20, tw: 0.18 },
  rebar: As ? { layers: [{ As, d: 1.75 }], stirrups: { dia: 10, s: 150, legs: 2 } } : undefined } });
const run = (Mz, As, extra = {}, mem = { mesaComprimida: true }) => nbr6118.check({ demands: { Mz, ...extra }, mat, sec: secT(As), member: { role: 'viga', L: 30, ...mem }, options: {} });

ok('T1. Ex. 8 (Carvalho): As necessária, bloco na mesa', run(6770, 0.0093).flexao.asNec * 1e4, 92.40);
ok('T1b. Ex. 8 contra o livro (92,7 com KZ tabelado; tolerância 0,5 %)', run(6770, 0.0093).flexao.asNec * 1e4, 92.7, 0.005);
ok('T2. Ex. 9 (Carvalho 139,25 cm²)', run(10000, 0.014).flexao.asNec * 1e4, 139.25, 0.001);
ok('T3. Md = 12 000: T (abas + alma)', run(12000, 0.018).flexao.asNec * 1e4, 172.83);
{
  const r = run(11000, 0.0160);
  ok('T4. MRd com As = 160 cm² (compatibilidade, seção T)', r.flexao.capacity, 11312.96, 0.004);
  ok('T4b. x/d da armadura dada', r.flexao.xdArmadura, 0.30923, 0.004);
  ok('T4c. As,mín (0,15 %·Ac)', r.flexao.asMin * 1e4, 9.555);
  assert('T4d. razão finita (verificada)', isFinite(r.flexao.ratio) && r.flexao.ratio < 1);
}
{
  const r = run(11000, 0.0160, { Vy: 500 });
  ok('T5. cortante com bw = 18 cm: VRd2 = 0,27·αv2·fcd·bw·d', r.cortante.VRd2, 0.27 * (1 - 30 / 250) * (30 / 1.4) * 1000 * 0.18 * 1.75);
}
{
  const r = run(11000, 0.0160, { T: 20 });
  assert('T6. T com torção: NÃO verificada (com repartição informada)', !isFinite(r.flexao.ratio) && r.avisos.some(a => /Seção T com torção/.test(a)));
  const r2 = run(11000, 0.0160, { My: 10 });
  assert('T6b. T com My: eixo fraco NÃO verificado', !isFinite(r2.flexaoY.ratio));
}

{
  // sentido do momento (achado da revisão): Mz negativo ou mesa comprimida não declarada → NÃO verificada
  const neg = run(-8000, 0.0160);
  assert('T7. Mz < 0 em T: NÃO verificada', !isFinite(neg.flexao.ratio) && neg.avisos.some(a => /momento negativo/.test(a)));
  const und = run(8000, 0.0160, {}, {});
  assert('T7b. sem member.mesaComprimida: NÃO verificada', !isFinite(und.flexao.ratio) && und.avisos.some(a => /mesaComprimida/.test(a)));
  // armadura dupla pela alma (x/d da alma > 0,45): Md = 14 000 → alma M2 = 4 863,7 > Mlim da alma
  const dup = run(14000, 0.02);
  assert('T7c. armadura dupla pela alma quando x/d > 0,45', dup.flexao.dupla === true && dup.flexao.asLinhaNec > 0);
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
