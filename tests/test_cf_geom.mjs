// test_cf_geom.mjs — calculator of cold-formed section properties from the dimensions (js/design/cf_geom.js)
//   node tests/test_cf_geom.mjs
// Oráculo: as tabelas da ABNT NBR 6355:2012 (Ue Tab. A.3, U Tab. A.2, L Tab. A.1, transcritas em
// js/design/profiles_cf.js) — todas as linhas com t ≤ 4,75 mm (faixa de aplicação: parede fina; os perfis dobrados dos
// catálogos vão até 4,75 mm; acima disso o modelo de linha média perde precisão — b/t baixo — e não é usado).
// Tolerâncias: arredondamento da tabela e o modelo de cantos — A ±0,6 %, Ix/Iy ±1 %, I1/I2 ±1,5 %, xg ±0,03 cm,
// x0 ±3,5 % (o x0 tabelado mistura a convenção de canto; entra só em Nexz), Cw ±0,5 % (cantos vivos, como a norma).
import { CF_PROFILES } from '../js/design/profiles_cf.js';
import { channelProps, angleProps } from '../js/design/cf_geom.js';
let fails = 0, n = 0; const worst = {};
const chk = (name, key, got, exp, tol, abs = false) => {
  n++; const d = abs ? Math.abs(got - exp) : Math.abs(got - exp) / Math.abs(exp);
  worst[key] = Math.max(worst[key] || 0, d);
  if (!(d <= tol)) { fails++; console.log(`FAIL ${name} ${key}: ${got.toFixed(4)} × ${exp} (Δ ${(abs ? d : d * 100).toFixed(3)}${abs ? '' : ' %'})`); }
};
const cm = 10, cm2 = 100, cm4 = 1e4, cm6 = 1e6;
for (const [name, p] of Object.entries(CF_PROFILES)) {
  const d = p.dims;
  if (!(d.t * 1000 <= 4.75 + 1e-9)) continue;
  if (p.shape === 'Ue' || p.shape === 'U') {
    const g = channelProps({ bw: d.bw * 1000, bf: d.bf * 1000, t: d.t * 1000, D: p.shape === 'Ue' ? d.D * 1000 : 0, ri: (d.ri ?? d.t) * 1000 });
    chk(name, 'A', g.A / cm2, p.A * 1e4, 0.006); chk(name, 'Ix', g.Ix / cm4, p.Iz * 1e8, 0.01); chk(name, 'Iy', g.Iy / cm4, p.Iy * 1e8, 0.01);
    chk(name, 'xg', g.xg / cm, p.xg * 100, 0.03, true); chk(name, 'x0', g.x0 / cm, p.x0 * 100, 0.035);
    if (p.Cw > 0) chk(name, 'Cw', g.Cw / cm6, p.Cw * 1e12, 0.005);
  } else if (p.shape === 'L') {
    const g = angleProps({ b: d.b * 1000, t: d.t * 1000, ri: (d.ri ?? d.t) * 1000 });
    chk(name, 'A', g.A / cm2, p.A * 1e4, 0.006); chk(name, 'Ix', g.Ix / cm4, p.Iz * 1e8, 0.01);
    if (p.I1) { chk(name, 'I1', g.I1 / cm4, p.I1 * 1e8, 0.015); chk(name, 'I2', g.I2 / cm4, p.I2 * 1e8, 0.015); }
    chk(name, 'xg', g.xg / cm, p.xg * 100, 0.03, true); chk(name, 'x0', g.x0 / cm, p.x0 * 100, 0.035);
  }
}
console.log('maior desvio:', Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, +(['xg'].includes(k) ? v : v * 100).toFixed(3)])));
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
