// test_ca_edificio.mjs — coeficiente de arrasto Ca de edificações paralelepipédicas (NBR 6123:2023 6.1.2, Fig. 4/5)
//   node assistant/test_ca_edificio.mjs
// Oráculo: tabela RATIFICADA pelo Manoel em 15/10/2026 (LEITURA_CA_NBR6123_preenchida.xlsx — digitalização das
// curvas das Fig. 4/5 conferida por ele); os valores abaixo foram digitados da planilha, não lidos do rules.json.
// Pontos fora da grade: interpolação bilinear em log×log refeita à mão (Python):
//   h = 12, ℓ1 = 10, ℓ2 = 20 → ℓ1/ℓ2 = 0,5, h/ℓ1 = 1,2; Fig. 4 células (1,5; 0,6) 0,98, (1,5; 0,4) 0,81, (1; 0,6) 0,93,
//     (1; 0,4) 0,78; t = 0,44966, u = 0,55034 → Ca = 0,8810
//   h = 45, ℓ1 = 12, ℓ2 = 36 → ℓ1/ℓ2 = 1/3, h/ℓ1 = 3,75; células (4; 0,4) 0,92, (4; 0,3) 0,81, (3; 0,4) 0,89, (3; 0,3) 0,79;
//     t = 0,63376, u = 0,22434 → Ca = 0,8450
//   Edifício 10 × 10 m, h = 9 m: ℓ1/ℓ2 = 1, h/ℓ1 = 0,9 → entre (1; 1,0) 1,13 e (0,5; 1,0) 1,01, u = 0,15200 → Ca = 1,1118
import fs from 'node:fs';
import { parseCSV } from '../js/utils/csv.js';
import { caEdificio } from './loads.js';
import { generateModel } from './generator.js';

let fails = 0;
const ok = (name, got, exp, tol) => { const e = Math.abs(got - exp) / (Math.abs(exp) || 1); const p = e <= tol; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const BR = { reglas: JSON.parse(rd('../presets/brasil/rules.json')), perfiles: parseCSV(rd('../presets/brasil/profiles.csv')),
  materiales: parseCSV(rd('../presets/brasil/materials.csv')), sobrecargas: parseCSV(rd('../presets/brasil/live_loads.csv')) };
const W = BR.reglas.loads.wind;
const ca = (h, l1, l2, alta = false) => caEdificio(W, { h, l1, l2, altaTurbulencia: alta });

// (1) nós da grade = planilha ratificada
for (const [h, l1, l2, exp, alta] of [[1, 1, 1, 1.13, false], [10, 1, 0.5, 1.75, false], [1, 1, 0.25, 1.33, false], [30, 1, 2.5, 1.24, false],
                                       [1, 1, 1, 0.91, true], [5, 1, 0.5, 1.21, true]]) {
  ok(`G. ${alta ? 'Fig. 5' : 'Fig. 4'} h/ℓ1 = ${h}, ℓ1/ℓ2 = ${+(l1 / l2).toFixed(3)}`, ca(h, l1, l2, alta).Ca, exp, 1e-9);
}
// (2) fora da grade: bilinear em log×log
ok('I1. h = 12, ℓ1 = 10, ℓ2 = 20', ca(12, 10, 20).Ca, 0.8810, 6e-4);
ok('I2. h = 45, ℓ1 = 12, ℓ2 = 36', ca(45, 12, 36).Ca, 0.8450, 6e-4);
// (3) limites
{
  const r = ca(3, 10, 10);   // h/ℓ1 = 0,3 < 0,5 → linha 0,5: (0,5; 1,0) = 1,01
  ok('L1. h/ℓ1 < 0,5 usa a linha 0,5', r.Ca, 1.01, 1e-9);
  assert('L1b. com aviso', r.avisos.some(a => /0,5/.test(a)));
  assert('L2. ℓ1/ℓ2 > 4: nulo', ca(10, 50, 10).Ca === null);
  assert('L3. h/ℓ1 > 40: nulo', ca(500, 10, 10).Ca === null);
  assert('L4. célula sem curva (coluna 0,2 da Fig. 4): nulo, sem extrapolar', ca(20, 10, 45).Ca === null, ca(20, 10, 45).aviso);
}
// (4) gerador de edifício (preset Brasil): força de vento nos pilares a barlavento = Ca·q·área (6.1.2)
{
  const spec = { mode: '3D', geometry: { levels: [{ height_m: 3 }, { height_m: 3 }, { height_m: 3 }], base_plan: { Lx_m: 10, Ly_m: 10 } },
    sections: { material: 'AR350', beams: 'W 310 x 32,7', columns: 'W 250 x 73,0' }, base_support: 'fixed', rigid_diaphragm: true,
    loads: { dead_extra_kN_m2: 1.5, live_load_kN_m2: 2.0, wind: true }, wind: { V0_m_s: 35, categoria: 'III', grupoS3: '2', a_m: 10, b_m: 10 } };
  const m = generateModel(spec, BR);
  const lc = m.loadCases.find(l => l.name === 'Viento X');
  const N = new Map(m.nodes.map(n => [n.id, n])), E = new Map(m.elements.map(e => [e.id, e]));
  const L = (e) => { const a = N.get(e.n1), b = N.get(e.n2); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); };
  const F = lc.loads.reduce((s, q) => s + q.w * L(E.get(q.elemId)), 0);
  const q = lc._viento.q_Nm2 / 1000;
  ok('E1. ΣF = Ca·q·(10 m × 9 m), Ca = 1,1118', F, 1.1118 * q * 10 * 9, 2e-3);
  assert('E1b. aviso cita Ca e a Fig. 4', m._warnings.some(w => /Ca = 1,11/.test(w.msg) && /Fig\. 4/.test(w.msg)), m._warnings.map(w => w.msg).filter(s => /Vento/.test(s)).join(' | '));
}

// (5) direção real do vento e caso Y (planta 10 × 20 m, h = 9 m):
//   X: ℓ1 = Ly = 20, ℓ2 = 10 → ℓ1/ℓ2 = 2, h/ℓ1 = 0,45 < 0,5 → linha 0,5: (2,0; 0,5) = 1,15 (planilha)
//   Y: ℓ1 = Lx = 10, ℓ2 = 20 → ℓ1/ℓ2 = 0,5, h/ℓ1 = 0,9: células (1; 0,6) 0,93, (1; 0,4) 0,78, (0,5; 0,6) 0,83,
//      (0,5; 0,4) 0,71; t = 0,44966, u = 0,15200 → Ca = 0,8494 (à mão)
{
  const spec = { mode: '3D', geometry: { levels: [{ height_m: 3 }, { height_m: 3 }, { height_m: 3 }], base_plan: { Lx_m: 10, Ly_m: 20 } },
    sections: { material: 'AR350', beams: 'W 310 x 32,7', columns: 'W 250 x 73,0' }, base_support: 'fixed', rigid_diaphragm: true,
    loads: { dead_extra_kN_m2: 1.5, live_load_kN_m2: 2.0, wind: true }, wind: { V0_m_s: 35, categoria: 'III', grupoS3: '2', a_m: 20, b_m: 10 } };
  const m = generateModel(spec, BR);
  const N = new Map(m.nodes.map(n => [n.id, n])), E = new Map(m.elements.map(e => [e.id, e]));
  const L = (e) => { const a = N.get(e.n1), b = N.get(e.n2); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); };
  const sum = (lc, dir) => lc.loads.filter(q => q.dir === dir).reduce((s, q) => s + q.w * L(E.get(q.elemId)), 0);
  const X = m.loadCases.find(l => l.name === 'Viento X'), Y = m.loadCases.find(l => l.name === 'Viento Y');
  const q = X._viento.q_Nm2 / 1000;
  assert('D0. caso Viento Y gerado (preset Brasil, 3D)', !!Y);
  ok('D1. vento X: ΣF = 1,15·q·(20 × 9)', sum(X, 'globalX'), 1.15 * q * 20 * 9, 2e-3);
  ok('D2. vento Y: ΣF = 0,8494·q·(10 × 9)', sum(Y, 'globalY'), 0.8494 * q * 10 * 9, 2e-3);
  assert('D3. combinações com V90 (Viento Y)', m.combinations.some(c => c.factors.some(f => f.lcId === Y.id)));
  assert('D4. aviso de 6.1.4 (excentricidade não gerada)', m._warnings.some(w => /6\.1\.4/.test(w.msg)));
}
{
  // h = 60, ℓ1 = 30, ℓ2 = 10: ℓ1/ℓ2 = 3 (não atende 6.1.3.1-a) → Fig. 4 (2,0; 3,0) = 1,41 (planilha), não a Fig. 5 (1,26)
  const r = caEdificio(W, { h: 60, l1: 30, l2: 10, altaTurbulencia: true });
  ok('D5. alta turbulência com ℓ1/ℓ2 = 3: Ca da Fig. 4 (6.1.3.1-a)', r.Ca, 1.41, 1e-9);
  assert('D5b. com aviso', r.fig === 'Fig. 4' && r.avisos.some(a => /6\.1\.3\.1/.test(a)));
}

// (6) q pela classe da fachada atingida (5.3.2): planta 15 (X) × 30 (Y), h = 9 → classe B pela fachada de 30 m (q),
//   classe A pela de 15 m (q_empena). X: ℓ1 = 30, ℓ2 = 15 → ℓ1/ℓ2 = 2, h/ℓ1 = 0,3 → linha 0,5: Ca = 1,15, com q (B);
//   Y: ℓ1 = 15, ℓ2 = 30 → ℓ1/ℓ2 = 0,5, h/ℓ1 = 0,6: t = 0,44966, u = 0,73697 → Ca = 0,7988 (à mão), com q_empena (A)
{
  const spec = { mode: '3D', geometry: { levels: [{ height_m: 3 }, { height_m: 3 }, { height_m: 3 }], base_plan: { Lx_m: 15, Ly_m: 30 } },
    sections: { material: 'AR350', beams: 'W 310 x 32,7', columns: 'W 250 x 73,0' }, base_support: 'fixed', rigid_diaphragm: true,
    loads: { dead_extra_kN_m2: 1.5, live_load_kN_m2: 2.0, wind: true }, wind: { V0_m_s: 35, categoria: 'III', grupoS3: '2' } };
  const m = generateModel(spec, BR);
  const N = new Map(m.nodes.map(n => [n.id, n])), E = new Map(m.elements.map(e => [e.id, e]));
  const L = (e) => { const a = N.get(e.n1), b = N.get(e.n2); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); };
  const sum = (lc, dir) => lc.loads.filter(q => q.dir === dir).reduce((s, q) => s + q.w * L(E.get(q.elemId)), 0);
  const X = m.loadCases.find(l => l.name === 'Viento X'), Y = m.loadCases.find(l => l.name === 'Viento Y');
  const v = X._viento;
  assert('Q0. classes diferentes (B pela fachada de 30 m, A pela de 15 m)', v.classe === 'B' && v.classe_empena === 'A', `${v.classe}/${v.classe_empena}`);
  ok('Q1. vento X (fachada de 30 m): ΣF = 1,15·q·30·9', sum(X, 'globalX'), 1.15 * v.q_Nm2 / 1000 * 30 * 9, 2e-3);
  ok('Q2. vento Y (fachada de 15 m): ΣF = 0,7988·q_empena·15·9', sum(Y, 'globalY'), 0.7988 * v.q_empena_Nm2 / 1000 * 15 * 9, 2e-3);
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
