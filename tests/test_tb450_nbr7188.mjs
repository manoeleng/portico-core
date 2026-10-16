// test_tb450_nbr7188.mjs — trem-tipo TB-450/TB-240 da ABNT NBR 7188:2024 + envoltória por linha de influência
//
// ORÁCULO (independente do código): cálculo manual com as expressões da NBR 7188:2024 e linhas de
// influência analíticas; conferido por varredura de força bruta num script Python separado
// (scratchpad ponte/oraculo_tb450.py — não importa nada do PORTICO).
//
// Coeficientes (5.1.3): CIV = 1,35 (vão < 10 m); CIV = 1 + 1,06·20/(LIV + 50) (10–200 m);
//   CNF = 1 − 0,05(n − 2) ∈ [0,9; 1,0], n = int(b/3,5); CIA = 1,25 concreto/mista, 1,15 aço, só laje
//   e transversina a < 5 m da junta, demais 1,0.
// Caso A — biapoiada L = 20 m, viga única = tabuleiro inteiro b = 7,0 m (n = 2 → CNF = 1,0), CIA = 1,0:
//   CIV = 1 + 1,06·20/70 = 1,302857;  Q = 75·1,302857 = 97,714 kN;  q = 5·1,302857 = 6,5143 kN/m²
//   eixo = 2Q = 195,4286 kN;  qExt = q·b = 45,600 kN/m;  qInt = q·(b − 3) = 26,0571 kN/m
//   M no meio (LI triângulo, pico L/4 = 5; veículo centrado, eixos em 8,5/10/11,5 m → η = 4,25/5/4,25;
//     área da LI = L²/8 = 50; área sob a faixa do veículo [7, 13] = 25,5):
//     M = 195,4286·(5 + 2·4,25) + 45,6·(50 − 25,5) + 26,0571·25,5 = 2638,286 + 1117,200 + 664,457
//       = 4419,943 kN·m
//   Reação no apoio esquerdo (LI 1 − x/L; 1º eixo sobre o apoio, faixa do veículo [−1,5; 4,5]):
//     R = 195,4286·(1 + 0,925 + 0,85) + 45,6·(10 − 3,99375) + 26,0571·3,99375
//       = 542,314 + 273,885 + 104,066 = 920,265 kN
// Caso B — TB-240 (P = 40 kN, p = 4,0 kN/m²), mesmo vão: M = 104,2286·13,5 + 36,48·24,5 + 20,8457·25,5
//       = 2832,411 kN·m
// Caso C — contínua 2 × 20 m (EI constante), momento no apoio central. LIV = média dos vãos = 20 m.
//   LI (Müller-Breslau): M_B(x) = −x(L² − x²)/(4L²) no vão 1, simétrica no vão 2.
//   Envoltória mínima por varredura de força bruta no Python: M_B,mín = −3171,25 kN·m
//   (eixos em 27,0/28,5/30,0 m); máxima = 0 (LI toda negativa).
import { Model } from '../js/model/model.js';
import { buildLane, responseReaction, responseSection, computeMovingLoad, trainEnvelopeFromIL } from '../js/solver/moving_load.js';
import { civ, cnf, cia, livFromSpans, loads7188, trainWholeDeck, trainFromTransverseIL, VEHICLE_GEOM } from '../js/design/nbr7188.js';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '  OK ' : 'FAIL '} ${m}`); if (!c) fails++; };
const rel = (a, b, tol, m) => ok(Math.abs(a - b) <= tol * Math.abs(b) + 1e-9, `${m}  (obtido ${a.toFixed(4)} × esperado ${b.toFixed(4)})`);

globalThis.window = globalThis;
await import('../lib/numeric.js');
globalThis.window.numeric = globalThis.numeric;

// ── Coeficientes (5.1.3) ─────────────────────────────────────────────────────
console.log('\n── Coeficientes NBR 7188:2024 5.1.3 ─────────────────────');
rel(civ(5), 1.35, 1e-12, 'CIV(5 m) = 1,35');
rel(civ(9.99), 1.35, 1e-12, 'CIV(9,99 m) = 1,35');
rel(civ(10), 1 + 1.06 * 20 / 60, 1e-12, 'CIV(10 m) = 1,353333');
rel(civ(20), 1.302857142857, 1e-10, 'CIV(20 m) = 1,302857');
rel(civ(200), 1.0848, 1e-10, 'CIV(200 m) = 1,0848');
let threw = false; try { civ(250); } catch { threw = true; }
ok(threw, 'CIV(250 m) exige estudo específico (erro)');
rel(civ(20, { hcob: 1.25 }), (1.302857142857 + 1) / 2, 1e-10, 'CIV enterrado hcob = 1,25 m: metade do caminho até 1,00');
rel(civ(20, { hcob: 3 }), 1.0, 1e-12, 'CIV enterrado hcob ≥ 2,50 m = 1,00');
rel(livFromSpans([20, 30, 25], 'continua'), 25, 1e-12, 'LIV contínua = média dos vãos');
rel(cnf(7), 1.0, 1e-12, 'CNF b = 7,0 m (n = 2) = 1,00');
rel(cnf(10.5), 0.95, 1e-12, 'CNF b = 10,5 m (n = 3) = 0,95');
rel(cnf(14), 0.90, 1e-12, 'CNF b = 14,0 m (n = 4) = 0,90');
rel(cnf(20), 0.90, 1e-12, 'CNF b = 20,0 m (n = 5) limitado a 0,90');
rel(cnf(3.4), 1.0, 1e-12, 'CNF b = 3,4 m (n = 0) limitado a 1,00');
rel(cnf(null), 1.0, 1e-12, 'CNF largura não determinada = 1,00');
rel(cnf(14, { transversal: true }), 1.0, 1e-12, 'CNF elemento transversal = 1,00');
rel(cia({ nearJoint: true, element: 'laje', material: 'concreto' }), 1.25, 1e-12, 'CIA laje de concreto junto à junta = 1,25');
rel(cia({ nearJoint: true, element: 'transversina', material: 'aco' }), 1.15, 1e-12, 'CIA transversina de aço junto à junta = 1,15');
rel(cia({ nearJoint: true, element: 'outro', material: 'concreto' }), 1.0, 1e-12, 'CIA longarina junto à junta = 1,00 (2024)');
rel(cia({ nearJoint: false, element: 'laje' }), 1.0, 1e-12, 'CIA laje longe da junta = 1,00');
const L450 = loads7188({ vehicle: 'TB-450', LIV: 20, b: 7 });
rel(L450.Q, 97.7142857, 1e-8, 'TB-450 Q = 75·CIV = 97,714 kN');
rel(L450.q, 6.5142857, 1e-8, 'TB-450 q = 5·CIV = 6,514 kN/m²');
rel(loads7188({ vehicle: 'TB-450', LIV: 20, b: 7, plus10: true }).Q, 107.4857143, 1e-8, '+10 % (anel rodoviário/porto): Q = 107,486 kN');
const tA = trainWholeDeck({ Q: L450.Q, q: L450.q, b: 7 });
rel(tA.axles[0].P, 195.4285714, 1e-8, 'eixo = 2Q = 195,429 kN');
rel(tA.qExt, 45.6, 1e-10, 'qExt = q·b = 45,600 kN/m');
rel(tA.qInt, 26.0571429, 1e-8, 'qInt = q·(b − 3) = 26,057 kN/m');
ok(JSON.stringify(tA.axles.map(a => a.offset)) === '[1.5,3,4.5]' && tA.length === 6, 'geometria: eixos a 1,5 m, área de 6,0 m (Figura 1)');

// ── Envoltória sobre LI analítica (sem MEF) ─────────────────────────────────
console.log('\n── Envoltória sobre LI analítica ────────────────────────');
{
  const s = [0, 10, 20], il = { s, value: [0, 5, 0] };
  const e = trainEnvelopeFromIL(il, tA);
  rel(e.max, 4419.942857, 1e-9, 'M meio, LI triangular exata');
  rel(e.atMax, 7, 1e-9, 'veículo centrado (borda traseira em 7,0 m)');
  ok(Math.abs(e.min) < 1e-9, 'mínimo = 0 (LI sem parte negativa)');
  const eR = trainEnvelopeFromIL({ s: [0, 20], value: [1, 0] }, tA);
  rel(eR.max, 920.265, 1e-9, 'reação esquerda, LI 1 − x/L');
}

// ── MEF: biapoiada 20 m (40 elementos de 0,5 m) ─────────────────────────────
const E = 3e7, I = 0.5, A = 1.0;
function beam(spans, nPerSpan) {
  const m = new Model(); m.mode = '2D'; m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'C', E, G: E / 2.4, nu: 0.2, rho: 0 });
  const sec = m.addSection({ name: 'V', A, Iy: I, Iz: I, J: 1e-2, Avy: 1e3, Avz: 1e3, kappay: 1, kappaz: 1 });
  const nodes = []; let x = 0;
  nodes.push(m.addNode(0, 0, 0, { ux: 1, uz: 1 }));
  for (const Ls of spans) {
    for (let i = 1; i <= nPerSpan; i++) nodes.push(m.addNode(x + Ls * i / nPerSpan, 0, 0, i === nPerSpan ? { uz: 1 } : {}));
    x += Ls;
  }
  const elems = [];
  for (let i = 0; i < nodes.length - 1; i++) elems.push(m.addElement(nodes[i].id, nodes[i + 1].id, mat.id, sec.id));
  return { m, nodes, elems };
}

console.log('\n── MEF: biapoiada L = 20 m, TB-450 tabuleiro inteiro b = 7 m ──');
{
  const B = beam([20], 40), laneIds = B.elems.map(e => e.id);
  const tr = trainWholeDeck({ Q: L450.Q, q: L450.q, b: 7 });
  const rM = computeMovingLoad(B.m, { mode: 'bridge', nPos: 201, respType: 'section', elemId: B.elems[20].id, xi: 0, key: 'Mz',
    label: 'M meio', unit: 'kN·m', laneIds, bridgeTrain: tr });
  const Mext = Math.abs(rM.max) > Math.abs(rM.min) ? rM.max : rM.min;
  rel(Math.abs(Mext), 4419.942857, 1e-4, 'M meio do vão (cálculo manual 4419,94 kN·m)');
  const rR = computeMovingLoad(B.m, { mode: 'bridge', nPos: 201, respType: 'reaction', nodeId: B.nodes[0].id, comp: 'Fz',
    label: 'R esq', unit: 'kN', laneIds, bridgeTrain: tr });
  rel(rR.max, 920.265, 1e-4, 'reação esquerda máx (cálculo manual 920,27 kN)');
  ok(rR.min > -1e-6, `reação esquerda mín ≥ 0 (${rR.min.toFixed(4)})`);

  const L240 = loads7188({ vehicle: 'TB-240', LIV: 20, b: 7 });
  const t240 = trainWholeDeck({ Q: L240.Q, q: L240.q, b: 7 });
  const r240 = computeMovingLoad(B.m, { mode: 'bridge', nPos: 201, respType: 'section', elemId: B.elems[20].id, xi: 0, key: 'Mz',
    label: 'M meio', unit: 'kN·m', laneIds, bridgeTrain: t240 });
  rel(Math.max(Math.abs(r240.max), Math.abs(r240.min)), 2832.411429, 1e-4, 'TB-240: M meio do vão (cálculo manual 2832,41 kN·m)');
}

console.log('\n── MEF: contínua 2 × 20 m, M no apoio central ─────────────');
{
  const C = beam([20, 20], 40), laneIds = C.elems.map(e => e.id);
  const Lc = loads7188({ vehicle: 'TB-450', LIV: livFromSpans([20, 20], 'continua'), b: 7 });
  const tr = trainWholeDeck({ Q: Lc.Q, q: Lc.q, b: 7 });
  const r = computeMovingLoad(C.m, { mode: 'bridge', nPos: 401, respType: 'section', elemId: C.elems[40].id, xi: 0, key: 'Mz',
    label: 'M_B', unit: 'kN·m', laneIds, bridgeTrain: tr });
  // convenção de sinal do Mz do PORTICO: o lado com carga só "negativa" (tração em cima) é o de maior módulo
  const hog = Math.abs(r.max) > Math.abs(r.min) ? r.max : r.min, other = Math.abs(r.max) > Math.abs(r.min) ? r.min : r.max;
  rel(Math.abs(hog), 3171.246, 1e-3, 'M_B extremo (força bruta, LI analítica: −3171,25 kN·m)');
  ok(Math.abs(other) < 1e-6 * Math.abs(hog), `outro extremo = 0 (LI de sinal único) (${other.toExponential(2)})`);
}

// ── Trem da longarina por LI transversal (regra da alavanca, 2 longarinas) ──
console.log('\n── Trem da longarina por LI transversal ─────────────────');
{
  // Duas longarinas em y = 0 e y = 4 m, pista de −1 a 5 m. Reação da longarina 1 (alavanca):
  // η(y) = 1 − y/4 → η(−1) = 1,25, η(5) = −0,25. Veículo encostado em y = −1: rodas em −0,5 e 1,5 m:
  // Ση = 1,125 + 0,625 = 1,75 → eixo = 1,75Q.  ∫η⁺ na pista = ∫_{−1}^{4} (1 − y/4) dy = 3,125 m.
  // Faixa do veículo [−1, 2]: ∫ = 3 − (4 − 1)/8 = 2,625 → fora: 0,5 m → qInt = 0,5q, qExt = 3,125q.
  const Q = 100, q = 10;
  const t = trainFromTransverseIL({ Q, q, ys: [-1, 5], eta: [1.25, -0.25], lane: [-1, 5] });
  rel(t.axles[0].P, 175, 1e-9, 'eixo = Q·Ση = 1,75·100 = 175 kN');
  rel(t.qExt, 31.25, 1e-9, 'qExt = q·3,125 = 31,25 kN/m');
  rel(t.qInt, 5.0, 1e-9, 'qInt = q·0,5 = 5,0 kN/m');
  rel(t.yVehicle, -1, 1e-9, 'veículo encostado na borda (y = −1 m)');
}

console.log(fails === 0 ? '\n✔ Todos os asserts passaram\n' : `\n✗ ${fails} falharam\n`);
process.exit(fails ? 1 : 0);
