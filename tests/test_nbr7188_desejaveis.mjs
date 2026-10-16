// test_nbr7188_desejaveis.mjs — complementos da NBR 7188:2024 no PORTICO (itens desejáveis da revisão):
//   5.2.1 frenagem/aceleração, 5.2.2 centrífuga, 5.1.3.1 CIV = 1,00 enterrado, 5.1.1 homogeneização,
//   Anexo A veículo especial, posição transversal pelo EFEITO e refino do extremo da envoltória.
// ORÁCULO: expressões da norma calculadas à mão (abaixo) e varreduras de força bruta escritas AQUI, sobre linhas de
// influência analíticas — independentes do código testado.
//   Frenagem (5.2.1) Hfr = 0,05·p·B·L·CNF ≥ 0,30·(6·P):
//     TB-450, B = 7, L = 20, CNF = 1: 0,05·5·7·20 = 35 < 0,30·450 = 135 → 135 kN
//     TB-450, B = 10, L = 100, CNF = 1 (n = 2): 0,05·5·10·100 = 250 > 135 → 250 kN
//     TB-240, B = 7, L = 20: 0,05·4·7·20 = 28 < 0,30·240 = 72 → 72 kN
//   Centrífuga (5.2.2): R = 150 → 2,4·75 = 180; R = 200 → 180; R = 600 → 480·75/600 = 60; R = 1500 → 24; R = 1600 → 0
//   Homogeneização (5.1.1), biapoiada L = 40 m, b = 7 m: CIV = 1 + 1,06·20/90 = 1,2355556; Q = 92,666667;
//     q = 6,177778; roda = Q − q·18/6 = 74,133333 → eixo 148,266667; q·b = 43,244444 kN/m em todo o vão;
//     M meio (LI triangular, pico 10, área 200): eixo central no pico, os outros em η = 9,25:
//     148,266667·28,5 + 43,244444·200 = 4225,600 + 8648,889 = 12874,489 kN·m
//   Anexo A: 2 × 16 eixos de 160 kN a 1,55 m, 15 m entre grupos — M no meio de biapoiada de 70 m por varredura
//     de força bruta (passo 1 mm) sobre a LI analítica; rodas da Figura A.1 com LI transversal (conta à mão abaixo).
//   +10 % (5.1.1) também na frenagem e na centrífuga: 1,10·135 = 148,5 kN; 1,10·180 = 198 kN.
globalThis.window = globalThis;
const R = new URL('../', import.meta.url).href;
const { frenagem, centrifuga, civ, homogAllowed, loads7188, trainWholeDeck, trainFromTransverseIL, trainSpecialAnnexA, wheelHomog }
  = await import(R + 'js/design/nbr7188.js');
const { trainEnvelopeFromIL, computeMovingLoad } = await import(R + 'js/solver/moving_load.js');
await import(R + 'lib/numeric.js');
globalThis.window.numeric = globalThis.numeric;
const { Model } = await import(R + 'js/model/model.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${m}: ${a} × ${b}`);

// 5.2.1 / 5.2.2
near(frenagem({ vehicle: 'TB-450', B: 7, L: 20, CNF: 1 }).Hfr, 135, 1e-12, 'Hfr TB-450 7 × 20 m (mínimo 0,30·6P)');
near(frenagem({ vehicle: 'TB-450', B: 10, L: 100, CNF: 1 }).Hfr, 250, 1e-12, 'Hfr TB-450 10 × 100 m (distribuída)');
near(frenagem({ vehicle: 'TB-240', B: 7, L: 20, CNF: 1 }).Hfr, 72, 1e-12, 'Hfr TB-240 (mínimo)');
for (const [Rc, H] of [[150, 180], [200, 180], [600, 60], [1500, 24], [1600, 0], [null, 0]]) near(centrifuga({ vehicle: 'TB-450', R: Rc }), H, 1e-12, `Hfc R = ${Rc}`);
near(frenagem({ vehicle: 'TB-450', B: 7, L: 20, CNF: 1, plus10: true }).Hfr, 148.5, 1e-12, 'Hfr com +10 % (5.1.1 majora p e P)');
near(centrifuga({ vehicle: 'TB-450', R: 150, plus10: true }), 198, 1e-12, 'Hfc com +10 %');
// 5.1.3.1 enterrada
near(civ(20, { enterrada: true }), 1.0, 0, 'CIV infraestrutura enterrada = 1,00');
near(loads7188({ vehicle: 'TB-450', LIV: 20, b: 7, enterrada: true }).Q, 75, 1e-12, 'Q enterrada = P (CIV = 1)');
// 5.1.1 homogeneização
ok(!homogAllowed(29.9).ok && homogAllowed(30).ok && !homogAllowed(40, { transversal: true }).ok, 'homogeneização só com vão ≥ 30 m e nunca em laje/transversina');
{
  const L = loads7188({ vehicle: 'TB-450', LIV: 40, b: 7 });
  near(wheelHomog(L.Q, L.q), 74.133333333, 1e-9, 'roda homogeneizada Q − 3q');
  const t = trainWholeDeck({ Q: L.Q, q: L.q, b: 7, homog: true });
  near(t.qInt, t.qExt, 1e-12, 'homogeneizado: carga distribuída também na área do veículo');
  const e = trainEnvelopeFromIL({ s: [0, 20, 40], value: [0, 10, 0] }, t);
  near(e.max, 12874.488889, 1e-8, 'M meio 40 m homogeneizado (manual 12874,489 kN·m)');
}
// Anexo A — força bruta
{
  const t = trainSpecialAnnexA();
  ok(t.axles.length === 32 && t.axles.every((a) => a.P === 160) && Math.abs(t.length - 61.5) < 1e-9 && t.qExt === 0 && t.qInt === 0, 'Anexo A: 32 × 160 kN, 61,5 m, sem carga distribuída');
  const offs = []; for (let i = 0; i < 16; i++) offs.push(i * 1.55); for (let i = 0; i < 16; i++) offs.push(23.25 + 15 + i * 1.55);
  const eta = (x) => (x < 0 || x > 70 ? 0 : x <= 35 ? x / 2 : (70 - x) / 2);
  let bf = 0; for (let r = -61.5; r <= 70; r += 0.001) { let m = 0; for (const o of offs) m += 160 * eta(r + o); if (m > bf) bf = m; }
  const e = trainEnvelopeFromIL({ s: [0, 35, 70], value: [0, 17.5, 0] }, t);
  near(e.max, bf, 1e-6, 'Anexo A: M meio do vão 70 m × força bruta');
  // com LI transversal η = 1 − y/6 numa pista de 6 m, veículo centrado (A.1.2 b): rodas em 1,4 + (0,1; 0,4; 0,9; 1,2; 2,0;
  // 2,3; 2,8; 3,1) → Σy = 24 → Ση = 8 − 24/6 = 4 → eixo = 20·4 = 80 kN
  const tt = trainSpecialAnnexA({ transverse: { ys: [0, 6], eta: [1, 0], axisY: 3 } });
  near(tt.sumEta, 4, 1e-12, 'Anexo A com LI transversal: Ση = 4'); near(tt.axles[0].P, 80, 1e-12, 'eixo = 20 kN·Ση = 80 kN');
}
// refino do extremo (D1): com qInt ≠ qExt e grade grossa, o resultado não fica abaixo da força bruta fina
{
  const t = trainWholeDeck({ Q: 97.714, q: 6.514, b: 7 });
  const s = [0, 7, 20], v = [0, 4.55, 0];                                     // LI de momento em x = 7 m (biapoiada 20 m)
  const etaL = (x) => (x < 0 || x > 20 ? 0 : x <= 7 ? 4.55 * x / 7 : 4.55 * (20 - x) / 13);
  const area = (a, b) => { let acc = 0, n = 400, h = (b - a) / n; for (let i = 0; i < n; i++) acc += etaL(a + (i + 0.5) * h) * h; return acc; };
  const A = area(0, 20);
  let bf = -Infinity;
  for (let r = -6; r <= 20; r += 0.002) {
    let c = 0; for (const ax of t.axles) c += ax.P * etaL(r + ax.offset);
    const Av = area(Math.max(0, r), Math.min(20, r + 6));
    bf = Math.max(bf, c + t.qExt * (A - Av) + t.qInt * Av);
  }
  const e = trainEnvelopeFromIL({ s, value: v }, t, { nPos: 9 });
  ok(e.max >= bf - 1e-3 && e.max <= bf + 1e-3, `refino do extremo com grade grossa (nPos 9): ${e.max.toFixed(4)} × força bruta ${bf.toFixed(4)}`);
}
// posição transversal pelo EFEITO (D2) — biapoiada 20 m, M no meio (MEF), LI transversal não linear
{
  // η = 1 em [0, 3] (veículo em y = 0: Ση = 2, faixa do veículo cobre área 3) e picos estreitos de 0,95 em 3,5 e 5,5
  // (veículo em y = 3: Ση = 1,9, faixa com área ≈ 0,4): o maior Ση perde para a posição que deixa a multidão em [0, 3]
  const Q = 100, q = 10, ys = [0, 3, 3.4, 3.5, 3.6, 5.4, 5.5, 5.6, 6], etaT = [1, 1, 0, 0.95, 0, 0, 0.95, 0, 0];
  const tr = trainFromTransverseIL({ Q, q, ys, eta: etaT, lane: [0, 6] });
  ok(tr.yVehicle <= 0.5 + 1e-9 && Math.abs(tr.sumEta - 2) < 1e-9 && tr.candidates.length > 2, `maior Ση = 2 com o veículo em y ≤ 0,5 (${tr.yVehicle})`);
  // oráculo: para cada posição candidata, M meio por varredura de força bruta sobre a LI analítica (pico 5)
  const etaL = (x) => (x < 0 || x > 20 ? 0 : x <= 10 ? x / 2 : (20 - x) / 2);
  const area = (a, b) => { a = Math.max(0, a); b = Math.min(20, b); if (b <= a) return 0; let acc = 0, n = 200, h = (b - a) / n; for (let i = 0; i < n; i++) acc += etaL(a + (i + 0.5) * h) * h; return acc; };
  let bfBest = -Infinity, bfY = null;
  for (const c of tr.candidates) {
    let best = -Infinity;
    for (let r = -6; r <= 20; r += 0.01) { let m = 0; for (const ax of c.axles) m += ax.P * etaL(r + ax.offset); const Av = area(r, r + 6); m += c.qExt * (50 - Av) + c.qInt * Av; best = Math.max(best, m); }
    if (best > bfBest) { bfBest = best; bfY = c.yVehicle; }
  }
  const m = new Model(); m.mode = '2D'; m.materials.clear(); m.sections.clear();
  const mat = m.addMaterial({ name: 'C', E: 3e7, G: 1.25e7, nu: 0.2, rho: 0 });
  const sec = m.addSection({ name: 'V', A: 1, Iy: 0.5, Iz: 0.5, J: 1e-2, Avy: 1e3, Avz: 1e3, kappay: 1, kappaz: 1 });
  const nodes = [m.addNode(0, 0, 0, { ux: 1, uz: 1 })];
  for (let i = 1; i <= 40; i++) nodes.push(m.addNode(i * 0.5, 0, 0, i === 40 ? { uz: 1 } : {}));
  const els = []; for (let i = 0; i < 40; i++) els.push(m.addElement(nodes[i].id, nodes[i + 1].id, mat.id, sec.id));
  const r = computeMovingLoad(m, { mode: 'bridge', nPos: 201, respType: 'section', elemId: els[20].id, xi: 0, key: 'Mz', label: 'M', unit: 'kN·m', laneIds: els.map((e) => e.id), bridgeTrain: tr });
  const Mx = Math.max(Math.abs(r.max), Math.abs(r.min)), yv = Math.abs(r.max) >= Math.abs(r.min) ? r.yVehicleMax : r.yVehicleMin;
  near(Mx, bfBest, 2e-3, `M meio pela posição de maior efeito × força bruta (y = ${bfY})`);
  ok(Math.abs(yv - bfY) < 1e-9 && yv > 1, `posição escolhida pelo efeito (y = ${yv}), não pela de maior Ση (y = ${tr.yVehicle})`);
}
console.log(`test_nbr7188_desejaveis: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
