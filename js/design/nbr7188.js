// ──────────────────────────────────────────────────────────────────────────────
// nbr7188.js — CARGA MÓVEL RODOVIÁRIA da ABNT NBR 7188:2024 (3ª edição, 17/01/2024)
//
// Fonte: C:\projetos\_referencias\NBR_7188_2024_...pdf (+ nbr7188-2024.txt), conferida no PDF:
//   · 5.1.1  TB-450: veículo-tipo de 450 kN, 6 rodas, P = 75 kN, 3 eixos a 1,5 m, área de
//            ocupação 18,0 m² (3,0 × 6,0 m), circundada por p = 5 kN/m² (Figura 1).
//            TB-240 (vicinais/particulares, a critério da autoridade): P = 40 kN, p = 4,0 kN/m².
//            Q = P·CIV·CNF·CIA;  q = p·CIV·CNF·CIA.
//            +10 % nas cargas móveis em anel rodoviário / acesso portuário < 100 km (a critério
//            da autoridade competente).
//   · Figura 1  rodas a 2,00 m (bitola), 0,50 m da roda à borda do veículo (0,50 + 2,00 + 0,50 = 3,0 m);
//            eixos a 1,50 m e 1,50 m das bordas dianteira/traseira (4 × 1,50 = 6,0 m).
//   · 5.1.2  passeio: 3 kN/m² concomitante (sem CIV/CNF/CIA); 5 kN/m² para elementos que suportam
//            diretamente o passeio.
//   · 5.1.3.1 CIV = 1,35 (vão < 10 m); CIV = 1 + 1,06·(20/(LIV + 50)) (10 ≤ vão ≤ 200 m); > 200 m:
//            estudo específico. LIV = vão (isostática), média aritmética dos vãos (contínua),
//            comprimento do balanço (balanço). Estrutura enterrada: CIV decresce linearmente de CIV
//            (hcob = 0) a 1,00 (hcob ≥ 2,50 m).
//   · 5.1.3.2 CNF = 1 − 0,05·(n − 2), 1,0 ≥ CNF ≥ 0,9; n = parte inteira de b/3,5 (4.2.1),
//            b = largura carregada incluindo acostamentos e faixas de segurança. Largura não
//            determinada → CNF = 1,0. Não se aplica a elementos transversais (lajes, transversinas).
//   · 5.1.3.3 CIA = 1,25 (concreto ou mista) / 1,15 (aço) — SÓ para lajes e transversinas ligadas à
//            laje a menos de 5,0 m da junta/descontinuidade; demais elementos CIA = 1,0.
//            (Na 2013 o CIA valia para todas as seções a menos de 5 m da junta — mudou.)
//
// Trem-tipo longitudinal de uma viga (formato do oae-kit, C:\projetos\oae-kit\src\oaekit\calc\
// trem_tipo.py): 3 eixos de carga Paxle a 1,5/3,0/4,5 m da borda traseira de uma "área do veículo"
// de 6,0 m; fora dela a carga distribuída qExt, dentro dela qInt (a multidão circunda o veículo,
// 5.1.1). A posição longitudinal e a parte da multidão que entra (só onde agrava) ficam com a
// envoltória por linha de influência (moving_load.js · trainEnvelopeFromIL).
// Unidades: kN, m.
// ──────────────────────────────────────────────────────────────────────────────

export const NBR7188_EDITION = 'ABNT NBR 7188:2024';

// 5.1.1 + Figura 1. offsets dos eixos a partir da borda traseira da área de 6,0 m.
export const VEHICLES = {
  'TB-450': { name: 'TB-450', P: 75, p: 5.0 },
  'TB-240': { name: 'TB-240', P: 40, p: 4.0 },
};
export const VEHICLE_GEOM = {
  length: 6.0, width: 3.0,
  axleOffsets: [1.5, 3.0, 4.5],     // eixos a 1,50 m (Figura 1, seção B-B)
  wheelY: [0.5, 2.5],               // rodas a 0,50 m da borda lateral, bitola 2,00 m (Figura 1)
  wheelsPerAxle: 2,
};
export const SIDEWALK_CONCURRENT = 3.0;   // kN/m², 5.1.2 a)
export const SIDEWALK_LOCAL = 5.0;        // kN/m², 5.1.2 b)

/**
 * CIV (5.1.3.1).
 * @param {number} LIV  vão para o CIV, m (ver livFromSpans)
 * @param {object} [o]  { hcob }  espessura de cobertura de estrutura enterrada, m
 */
export function civ(LIV, o = {}) {
  if (!(LIV > 0)) throw new Error('NBR 7188: LIV deve ser > 0');
  if (LIV > 200) throw new Error('NBR 7188 5.1.3.1: vão > 200 m exige estudo específico do CIV');
  let c = LIV < 10 ? 1.35 : 1 + 1.06 * (20 / (LIV + 50));
  if (o.hcob != null && o.hcob > 0) c = o.hcob >= 2.5 ? 1.0 : c + (1.0 - c) * (o.hcob / 2.5);
  return c;
}

/**
 * LIV (5.1.3.1): vão (isostática), média aritmética dos vãos (contínua), balanço (balanço).
 * @param {number[]} spans  vãos, m
 * @param {'isostatica'|'continua'|'balanco'} type
 */
export function livFromSpans(spans, type = 'isostatica') {
  if (!spans.length) throw new Error('NBR 7188: informe os vãos');
  if (type === 'continua') return spans.reduce((a, b) => a + b, 0) / spans.length;
  return spans[0];
}

/**
 * CNF (5.1.3.2). b = largura carregada (m) da hipótese de carga; null → 1,0.
 * transversal = true (laje, transversina) → 1,0.
 */
export function cnf(b, { transversal = false } = {}) {
  if (transversal || b == null || !(b > 0)) return 1.0;
  const n = Math.floor(b / 3.5 + 1e-9);
  return Math.min(1.0, Math.max(0.9, 1 - 0.05 * (n - 2)));
}

/**
 * CIA (5.1.3.3).
 * @param {object} o { nearJoint (a < 5 m da junta), element: 'laje'|'transversina'|'outro',
 *                     material: 'concreto'|'mista'|'aco' }
 */
export function cia({ nearJoint = false, element = 'outro', material = 'concreto' } = {}) {
  if (!nearJoint || (element !== 'laje' && element !== 'transversina')) return 1.0;
  return material === 'aco' ? 1.15 : 1.25;
}

/**
 * Cargas ponderadas Q (por roda) e q (kN/m²), 5.1.1.
 * @param {object} o { vehicle: 'TB-450'|'TB-240', LIV, b, transversal, ciaOpts, hcob, plus10 }
 */
export function loads7188(o) {
  const v = VEHICLES[o.vehicle || 'TB-450'];
  if (!v) throw new Error(`NBR 7188: veículo desconhecido ${o.vehicle}`);
  const CIV = o.CIV ?? civ(o.LIV, { hcob: o.hcob });
  const CNF = o.CNF ?? cnf(o.b, { transversal: o.transversal });
  const CIA = o.CIA ?? cia(o.ciaOpts);
  const k10 = o.plus10 ? 1.10 : 1.0;   // anel rodoviário / acesso portuário (5.1.1)
  const k = CIV * CNF * CIA * k10;
  return { vehicle: v.name, P: v.P, p: v.p, CIV, CNF, CIA, k10, k, Q: v.P * k, q: v.p * k };
}

/**
 * Trem-tipo longitudinal de uma viga que representa o TABULEIRO INTEIRO (largura carregada b):
 * eixo = 2 rodas → Paxle = 2Q; fora do veículo qExt = q·b; ao lado do veículo qInt = q·(b − 3,0).
 * Passeios (5.1.2 a), sem coeficientes): bSidewalk total, somado a qExt e qInt.
 */
export function trainWholeDeck({ Q, q, b, bSidewalk = 0, pSidewalk = SIDEWALK_CONCURRENT }) {
  if (!(b >= VEHICLE_GEOM.width)) throw new Error('NBR 7188: largura carregada b < 3,0 m (largura do veículo)');
  const qs = pSidewalk * bSidewalk;
  return {
    length: VEHICLE_GEOM.length,
    axles: VEHICLE_GEOM.axleOffsets.map(offset => ({ offset, P: VEHICLE_GEOM.wheelsPerAxle * Q })),
    qExt: q * b + qs, qInt: q * (b - VEHICLE_GEOM.width) + qs,
  };
}

// ∫ max(η,0) dy sobre [a,b] de uma polilinha (ys crescente) — exata (cruzamentos por zero).
function integPos(ys, eta, a, b) {
  let s = 0;
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = Math.max(ys[i], a), y1 = Math.min(ys[i + 1], b);
    if (y1 <= y0) continue;
    const f = (y) => eta[i] + (eta[i + 1] - eta[i]) * (y - ys[i]) / (ys[i + 1] - ys[i]);
    const e0 = f(y0), e1 = f(y1);
    if (e0 >= 0 && e1 >= 0) s += 0.5 * (e0 + e1) * (y1 - y0);
    else if (e0 > 0 || e1 > 0) { const yc = y0 + (y1 - y0) * e0 / (e0 - e1); s += e0 > 0 ? 0.5 * e0 * (yc - y0) : 0.5 * e1 * (y1 - yc); }
  }
  return s;
}
function interp(ys, eta, y) {
  if (y <= ys[0]) return eta[0];
  for (let i = 0; i < ys.length - 1; i++) if (y <= ys[i + 1]) return eta[i] + (eta[i + 1] - eta[i]) * (y - ys[i]) / (ys[i + 1] - ys[i]);
  return eta[eta.length - 1];
}

/**
 * Trem-tipo longitudinal de UMA longarina a partir da sua linha de influência TRANSVERSAL de
 * reação (Courbon, Engesser, Fauchart, alavanca — fornecida pelo usuário): mesmo método do
 * oae-kit (calc/trem_tipo.py): para cada posição do veículo na pista,
 *   Paxle = Q·Σ η(rodas);  qExt = q·∫η⁺ (pista) + p_passeio·∫η⁺ (passeios);
 *   qInt = q·∫η⁺ (pista fora da faixa de 3,0 m do veículo) + p_passeio·∫η⁺ (passeios).
 * Escolhe a posição transversal de MAIOR Paxle (desempate: maior qInt) — decisão registrada em
 * PLANO_BRASIL (o oae-kit escolhe pelo momento no meio do vão de uma biapoiada).
 * @param {object} o { Q, q, ys, eta (polilinha, ys crescente), lane: [y0,y1] pista,
 *                     sidewalks: [[ya,yb],…], pSidewalk, step }
 */
export function trainFromTransverseIL(o) {
  const { Q, q, ys, eta } = o;
  const [y0, y1] = o.lane;
  const w = VEHICLE_GEOM.width, step = o.step || 0.05;
  if (y1 - y0 < w) throw new Error('NBR 7188: pista mais estreita que o veículo (3,0 m)');
  const pS = o.pSidewalk ?? SIDEWALK_CONCURRENT;
  const qPas = (o.sidewalks || []).reduce((acc, [a, b]) => acc + pS * integPos(ys, eta, a, b), 0);
  const qLane = q * integPos(ys, eta, y0, y1);
  let best = null;
  const nPos = Math.max(1, Math.round((y1 - w - y0) / step));
  for (let i = 0; i <= nPos; i++) {
    const yv = y0 + (y1 - w - y0) * i / nPos;
    const sEta = VEHICLE_GEOM.wheelY.reduce((acc, dy) => acc + interp(ys, eta, yv + dy), 0);
    const qInt = q * (integPos(ys, eta, y0, yv) + integPos(ys, eta, yv + w, y1)) + qPas;
    if (!best || sEta > best.sEta + 1e-12 || (Math.abs(sEta - best.sEta) <= 1e-12 && qInt > best.qInt)) best = { yv, sEta, qInt };
  }
  return {
    length: VEHICLE_GEOM.length,
    axles: VEHICLE_GEOM.axleOffsets.map(offset => ({ offset, P: Q * best.sEta })),
    qExt: qLane + qPas, qInt: best.qInt, yVehicle: best.yv, sumEta: best.sEta,
  };
}
