// test_beam_spans.mjs — agrupamento de vãos/balanços e flecha em relação aos apoios (js/design/beam_spans.js)
//   node tests/test_beam_spans.mjs
// Oráculo: linhas elásticas analíticas (resistência dos materiais), com qL⁴/EI = 1 m para simplificar:
//   biapoiada, carga uniforme: w(x) = (x/L)·(1 − 2(x/L)² + (x/L)³)/24 · (qL⁴/EI) → máx 5/384 = 0,0130208 em x = L/2
//   balanço engastado, carga uniforme: w(ξ) = (ξ⁴ − 4ξ³ + 6ξ²)/24 → ponta 1/8 = 0,125
// A viga é discretizada em vários elementos: a flecha por corda de elemento perderia quase tudo.
import { beamSpans, spanDeflection } from '../js/design/beam_spans.js';

let fails = 0, n = 0;
const ok = (name, got, exp, rel = 1e-6) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= rel)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
const eq = (name, got, exp) => { n++; if (got !== exp) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };

// shape → node/element displacement functions (deflection −z, plus a rigid translation to test the reference)
const make = (nodes, elements, w, rigid = [0, 0, 0]) => {
  const N = new Map(nodes.map(p => [p.id, p]));
  const at = (x) => [rigid[0], rigid[1], rigid[2] - w(x)];
  const nodeDisp = (id) => at(N.get(id).x);
  const elemDisp = (eid, xi) => { const e = elements.find(q => q.id === eid); const x = N.get(e.n1).x + xi * (N.get(e.n2).x - N.get(e.n1).x); const u = at(x); return { ux: u[0], uy: u[1], uz: u[2] }; };
  return { nodeDisp, elemDisp };
};

{
  // biapoiada L = 4 m em 4 elementos (nós a cada 1 m), apoios uz nos extremos
  const L = 4, nodes = [0, 1, 2, 3, 4].map((x, i) => ({ id: i + 1, x, y: 0, z: 3, restraints: { uz: i === 0 || i === 4 ? 1 : 0 } }));
  const elements = [1, 2, 3, 4].map(i => ({ id: i, n1: i, n2: i + 1 }));
  const sp = beamSpans({ nodes, elements });
  eq('S1. um vão', sp.length, 1);
  eq('S1b. tipo vão', sp[0].kind, 'vao');
  ok('S1c. L = 4', sp[0].L, 4);
  const w = (x) => { const r = x / L; return r * (1 - 2 * r * r + r ** 3) / 24; };
  const { nodeDisp, elemDisp } = make(nodes, elements, w, [0.002, 0, -0.01]);
  ok('S1d. flecha máx = 5/384 (meio do vão, nó intermediário)', spanDeflection(sp[0], nodeDisp, elemDisp), 5 / 384);
}
{
  // balanço L = 2 m em 2 elementos, engaste no nó 1 (uz restrito), ponta livre
  const L = 2, nodes = [0, 1, 2].map((x, i) => ({ id: i + 1, x, y: 0, z: 3, restraints: i === 0 ? { ux: 1, uy: 1, uz: 1, rx: 1, ry: 1, rz: 1 } : {} }));
  const elements = [{ id: 1, n1: 1, n2: 2 }, { id: 2, n1: 2, n2: 3 }];
  const sp = beamSpans({ nodes, elements });
  eq('S2. um balanço', sp.length === 1 && sp[0].kind, 'balanco');
  ok('S2b. L do balanço', sp[0].L, 2);
  const w = (x) => { const r = x / L; return (r ** 4 - 4 * r ** 3 + 6 * r * r) / 24; };
  const { nodeDisp, elemDisp } = make(nodes, elements, w);
  ok('S2c. flecha da ponta = 1/8', spanDeflection(sp[0], nodeDisp, elemDisp), 0.125);
}
{
  // viga sobre dois pilares (apoio = nó ligado a elemento vertical), vão 5 m + balanço 1,5 m à direita
  const nodes = [{ id: 1, x: 0, y: 0, z: 3 }, { id: 2, x: 2.5, y: 0, z: 3 }, { id: 3, x: 5, y: 0, z: 3 }, { id: 4, x: 6.5, y: 0, z: 3 },
    { id: 11, x: 0, y: 0, z: 0, restraints: { uz: 1 } }, { id: 13, x: 5, y: 0, z: 0, restraints: { uz: 1 } }];
  const elements = [{ id: 1, n1: 1, n2: 2 }, { id: 2, n1: 2, n2: 3 }, { id: 3, n1: 3, n2: 4 }, { id: 10, n1: 11, n2: 1 }, { id: 11, n1: 13, n2: 3 }];
  const sp = beamSpans({ nodes, elements }).sort((a, b) => b.L - a.L);
  eq('S3. vão + balanço', sp.map(s => `${s.kind}:${s.L}`).join(','), 'vao:5,balanco:1.5');
  eq('S3b. elementos do vão', sp[0].elements.join(','), '1,2');
}
{
  // banzo inferior de treliça (4 painéis de 2 m) com diagonais e montantes, apoiado só nos extremos (uz):
  // diagonais/montantes NÃO viram apoio → um único vão de 8 m (flecha global do banzo)
  const nodes = [0, 2, 4, 6, 8].map((x, i) => ({ id: i + 1, x, y: 0, z: 0, restraints: { uz: i === 0 || i === 4 ? 1 : 0 } }))
    .concat([0, 2, 4, 6, 8].map((x, i) => ({ id: i + 11, x, y: 0, z: 1 })));
  const elements = [1, 2, 3, 4].map(i => ({ id: i, n1: i, n2: i + 1 }))
    .concat([1, 2, 3, 4, 5].map(i => ({ id: 20 + i, n1: i, n2: i + 10 })))           // montantes (verticais)
    .concat([1, 2, 3, 4].map(i => ({ id: 30 + i, n1: i, n2: i + 11 })));            // diagonais
  const sp = beamSpans({ nodes, elements }).filter(x => x.elements.every(id => id < 10));
  eq('S5. banzo de treliça: diagonais não são apoio', sp.map(x => `${x.kind}:${x.L}`).join(','), 'vao:8');
}
{
  // linha sem apoio nenhum: ignorada
  const nodes = [{ id: 1, x: 0, y: 0, z: 3 }, { id: 2, x: 3, y: 0, z: 3 }];
  eq('S4. sem apoio: nenhum vão', beamSpans({ nodes, elements: [{ id: 1, n1: 1, n2: 2 }] }).length, 0);
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
