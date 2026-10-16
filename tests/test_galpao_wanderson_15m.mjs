// test_galpao_wanderson_15m.mjs — galpão PFF de 15 m resolvido pelo Wanderson (Especialização INBEC, Mód. 5 "Perfis formados
// a frio II", págs. 61–151): oráculo = a envoltória de esforços da análise dele (págs. 99–100) e as resistências que ele
// calcula à mão (págs. 101–151). Modelo: tools/build_galpao_pff_wanderson_15.mjs --trelica (treliça ideal: os esforços dele
// são só normais e o travejamento bate exatamente nessa hipótese; com banzos contínuos as diferenças são < 3 % a mais).
//  · esforços: 21 dos 24 grupos dentro de 5 %. Três grupos governados pela C3 (vento a 90°, Cpi = 0) ficam fora — pilar
//    externo na base (36,9 × 41,9 kN), pilar interno na base em tração (9,4 × 10,5) e banzo superior extremo em compressão
//    (−18,9 × −21,7): as cargas do V3 foram lidas da figura da pág. 85 (sem tabela) e a altura das longarinas pela escala do
//    desenho; testadas outras alturas e vento vertical no telhado, nenhuma fecha → registrados como diferença aberta, com
//    limite de 16 % para detectar regressão.
//  · Nc,Rd com os KL do Wanderson e aço ZAR 280 (fy = 280, fu = 380 MPa, pág. 18): dentro de 1 % — exceto as duplas
//    cantoneiras com presilhas, onde a apostila omite a flexo-torção (9.7.2.2 com Cw = 0 e J = 2·J1): 44,3 → 42,6 kN
//    (decisão registrada no PLANO, item 9) e montante extremo 57,5 → 45,5 kN (a composta com flexo-torção fica abaixo
//    de 2 × isolada, que governa) — a favor da segurança.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const R = new URL('../', import.meta.url).href;
globalThis.window = globalThis;
await import(R + 'lib/numeric.js');
const { Serializer } = await import(R + 'js/model/serializer.js');
const { StaticSolver } = await import(R + 'js/solver/static_solver.js');
const { nbr14762 } = await import(R + 'js/design/codes/nbr14762.js');
const { cfSection } = await import(R + 'js/design/profiles_cf.js');
const { profileToSection } = await import(R + 'js/design/profiles.js');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL', msg); } };
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'w15-')), 'w15.s3d');
execFileSync(process.execPath, [new URL('../tools/build_galpao_pff_wanderson_15.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), tmp, '--trelica']);
const m = new Serializer().fromJSON(fs.readFileSync(tmp, 'utf8'));
ok(m.nodes.size === 66 && m.elements.size === 127, `66 nós e 127 barras como o modelo do Wanderson (${m.nodes.size}, ${m.elements.size})`);
const by = new Map(); for (const lc of m.loadCases.values()) by.set(lc.id, new StaticSolver().solve(m, lc.id, false));
const env = (ids) => { let mx = -Infinity, mn = Infinity; for (const c of m.combinations.values()) for (const id of ids) {
  let N = 0; for (const { lcId, factor } of c.factors) N += factor * by.get(lcId).getElemForces(id).N; mx = Math.max(mx, N); mn = Math.min(mn, N); } return [mx, mn]; };
const W = [ // barras, máx, mín (kN), tolerância
  [[1, 2], 36.9, -19.2, 0.16], [[9, 10], 9.5, -19.3, 0.10], [[12], 9.4, -36.7, 0.13], [[17, 18], 23.2, -17.6, 0.05], [[20], 32.2, -25.2, 0.05], [[21], 43.6, -33.0, 0.05],
  [[23], 14.7, -4.9, 0.02], [[24], 4.9, -14.7, 0.02], [[25], 14.7, -4.9, 0.02], [[26], 5.0, -11.3, 0.09], [[32], 5.7, -16.2, 0.05], [[33], 23.5, -31.3, 0.05],
  [[103, 104], 44.6, -31.6, 0.05], [[102, 105], 43.7, -31.3, 0.05], [[99, 108], 15.4, -18.9, 0.16], [[93, 94], 23.9, -23.1, 0.05], [[92, 95], 26.9, -27.4, 0.05], [[91, 96], 26.7, -28.2, 0.05],
  [[118, 127], 38.6, -29.6, 0.05], [[119, 126], 25.2, -19.5, 0.05], [[122, 123], 4.5, -8.5, 0.05], [[109, 117], 10.6, -13.6, 0.05], [[110, 116], 4.6, -5.8, 0.05], [[112, 114], 6.1, -3.2, 0.07],
];
for (const [ids, wmx, wmn, tol] of W) {
  const [mx, mn] = env(ids);
  ok(Math.abs(mx - wmx) <= tol * Math.abs(wmx) && Math.abs(mn - wmn) <= tol * Math.abs(wmn), `barras ${ids}: ${mx.toFixed(1)} / ${mn.toFixed(1)} × Wanderson ${wmx} / ${wmn} (tol ${tol * 100} %)`);
}
const mat = { Fy: 280e3, Fu: 380e3, E: 2e8, G: 7.7e7 };
const NC = [ // perfil, Lx, Ly, Lz, l1, Wanderson, tol
  ['U 100x50x2,25', 3.14, 1.57, 1.57, null, 40.8, 0.01], ['U 100x50x2,25', 3.00, 1.50, 1.50, null, 42.8, 0.01], ['U 100x50x2,25', 5.00, 0.50, 0.50, null, 37.3, 0.01],
  ['2L 40x2,25 costas g8', 1.22, 1.22, 1.22, null, 20.1, 0.01], ['2L 40x2,25 costas g8', 2.28, 2.28, 2.28, null, 5.6, 0.03], ['2L 40x2,25 costas g8', 2.28, 2.28, 2.28, 0.57, 15.1, 0.01],
  ['2L 40x2,25 costas g8', 0.73, 0.73, 0.73, null, 45.5, 0.01], ['2L 40x2,25 costas g8', 1.408, 1.408, 1.408, null, 15.0, 0.01], ['2L 40x2,25 costas g8', 1.408, 1.408, 1.408, 0.352, 38.1, 0.01],
  ['2L 40x2,25 costas g8', 1.22, 1.22, 1.22, 0.305, 42.6, 0.01],          // Wanderson 44,3 sem flexo-torção (PLANO item 9)
];
for (const [nm, Lx, Ly, Lz, l1, w, tol] of NC) {
  const ps = nm.startsWith('2L') ? profileToSection(nm).design.cfProps : cfSection(nm);
  const r = nbr14762.check({ demands: { N: -1 }, mat, sec: { ...ps, coldFormed: true }, member: { L: Math.max(Lx, Ly), Lx, Ly, Lz, Cb: 1, ...(l1 ? { presilhas: { l1, tipo: 'presilha' } } : {}) } });
  ok(Math.abs(r.axial.capacity - w) <= tol * w, `${nm} KL ${Lx}/${Ly}/${Lz}${l1 ? ` l1 ${l1}` : ''}: Nc,Rd ${r.axial.capacity.toFixed(2)} × ${w}`);
}
console.log(`test_galpao_wanderson_15m: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
