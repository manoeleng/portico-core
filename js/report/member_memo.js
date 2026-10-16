// member_memo.js — memória de cálculo de UMA barra a partir da linha de dimensionamento (design_envelope.js →
// checkElement): dados (seção com a fonte do catálogo, aço com fy/fu/E/G, norma, combinação com os fatores,
// comprimentos destravados e K, γ), propriedades da seção bruta, esforços solicitantes e, para cada estado-limite, Sd,
// Rd, razão, a fórmula com a cláusula e os valores intermediários que a verificação devolveu (χ, λ0, Ne por modo, Aef,
// Wef, MRd por ramo, regime da cortante, parcelas da interação), mais os avisos. Premissas e verificações pendentes
// (row.condicionado e avisos "NÃO verificado / LACUNA / não considerada") vão para o topo e mudam o veredito para
// "atende com ressalvas" (revisor-calculo-nbr, 16/10/2026). Nada é recalculado aqui: só apresentação (forças com
// toDisp/ulbl; áreas em cm², módulos em cm³, comprimentos de seção em mm). Chaves que o módulo não conhece aparecem
// com o nome cru, para a memória nunca esconder um número da verificação.
//   memberMemo(row, { model })  → objeto estruturado;   memoHTML(memo) → HTML;   memoDocx(d, memo) → Word (report.js)
import { esc } from '../utils/escape.js?v=7';
import { i18n } from '../i18n/i18n.js?v=7';
import { localizeNum } from './numfmt.js?v=7';
import { toDisp, ulbl } from '../utils/units.js?v=7';

const t = (k) => i18n.t(k);
const num = (v, d = 2) => (v == null || !Number.isFinite(+v)) ? '—' : localizeNum((+v).toFixed(d), i18n.getLocale());
const tiny = (v) => Math.abs(+v) < 5e-7;   // numerical noise (e.g. 1e-18) is shown as 0, not as a value
// value kinds: F force (kN), M moment (kN·m), A area (m² → cm²), W modulus (m³ → cm³), L length (m), mm (m → mm),
// '' dimensionless
const KIND = {
  F: (v) => { if (tiny(v)) return `0 ${ulbl('F')}`; const x = toDisp(v, 'F'); return `${num(x, Math.abs(x) < 1 ? 3 : 2)} ${ulbl('F')}`; },
  M: (v) => tiny(v) ? `0 ${ulbl('M')}` : `${num(toDisp(v, 'M'), 3)} ${ulbl('M')}`,
  A: (v) => `${num(v * 1e4, 2)} cm²`, W: (v) => `${num(v * 1e6, 2)} cm³`, L: (v) => `${num(v, 3)} m`, mm: (v) => `${num(v * 1e3, 2)} mm`,
  '': (v) => num(v, 4),
};
// known keys of the check blocks → [label (i18n key), kind]
const LBL = {
  modo: ['Modo'], modoGlobal: ['Modo global'], eixo: ['Eje'], ramo: ['Rama'], comp: ['Lado comprimido'], dir: ['Dirección'],
  regime: ['Régimen'], porPerfil: ['Por perfil'],
  chi: ['χ (pandeo global)', ''], lambda0: ['λ0 (esbeltez reducida)', ''], Ne: ['Ne (crítica elástica)', 'F'], Nex: ['Nex', 'F'],
  Ney: ['Ney', 'F'], Nez: ['Nez', 'F'], Nexz: ['Nexz (flexo-torsión)', 'F'], Neyz: ['Neyz (flexo-torsión)', 'F'],
  Nzf: ['Nex — flexão em relação a x (Ix da tabela, sem Steiner)', 'F'], Nt: ['Nt (torção pura)', 'F'],
  Ne1: ['Ne1 (eixo principal 1)', 'F'], Ne2: ['Ne2 (eixo principal 2)', 'F'], Ne1z: ['Ne1z (flexo-torção)', 'F'],
  lambdaP: ['λp (esbeltez da aba)', ''], Aef: ['Aef (área efectiva)', 'A'], NcRdGlobal: ['Nc,Rd (pandeo global)', 'F'], NcRd: ['Nc,Rd', 'F'],
  NcRdIsolado: ['Nc,Rd 2 × perfil aislado', 'F'], y0: ['y0 (centro de torsión)', 'mm'], r0: ['r0 (radio polar)', 'mm'],
  Wef: ['Wef (módulo efectivo)', 'W'], Wc: ['Wc (módulo de la fibra comprimida)', 'W'], WcEf: ['Wc,ef', 'W'],
  MRdEsc: ['MRd (inicio de fluencia)', 'M'], MRdFLT: ['MRd (FLT)', 'M'], Me: ['Me (momento crítico elástico)', 'M'],
  chiFLT: ['χFLT', ''], Cs: ['Cs', ''], Cm: ['Cm', ''], Cb: ['Cb', ''],
  kv: ['kv', ''], ht: ['h/t', ''], h: ['h (parte plana)', 'mm'], lp: ['λp (límite plástico)', ''], lr: ['λr (límite inelástico)', ''],
  lim108: ['1,08·√(E·kv/fy)', ''], lim140: ['1,40·√(E·kv/fy)', ''],
  j: ['j (Anexo E)', 'mm'],
};
// ANCHORS — NBR 14762:2010 item and expression of every intermediate value, by block family (axial compression,
// axial tension, flexure, shear, interaction); read from the standard (PDF in C:\projetos\_referencias, pages 34–58):
// 9.6.2/9.6.3 tension; 9.7.2 χ, λ0, Nc,Rd; 9.7.2.1 a)–c) Nex, Ney, Nez, r0; 9.7.2.2 a)–b) monosymmetric (axis x of
// symmetry; "if y is the axis of symmetry, y→x in a), x→y and x0→y0 in b)"); 9.7.3 distortional; 9.7.4 KL/r ≤ 200;
// 9.7.5 built-up; 9.2.2 effective width (Tab. 5 AA, Tab. 6 AL); 9.8.2.1 Wef; 9.8.2.2 Me, λ0, χFLT, Wc,ef; Anexo E
// (monosymmetric about the axis perpendicular to symmetry); 9.8.2.3 distortional; 9.8.3 shear (kv = 5,0 without
// stiffeners, h/t limits 1,08 and 1,4·(E·kv/fy)^0,5); 9.8.4 M + V; 9.9 combined N + M.
const REF14762 = {
  comp: {
    _: ['9.7', 'Nc,Rd = menor de 9.7.2 (global) e 9.7.3 (distorcional)'],
    chi: ['9.7.2', 'χ = 0,658^(λ0²) se λ0 ≤ 1,5; χ = 0,877/λ0² se λ0 > 1,5'], lambda0: ['9.7.2', 'λ0 = (A·fy/Ne)^0,5'],
    Ne: ['9.7.2.1 / 9.7.2.2', 'Ne = menor valor entre os modos'], Nex: ['9.7.2.1 a)', 'Nex = π²·E·Ix/(Kx·Lx)²'],
    Ney: ['9.7.2.1 b) / 9.7.2.2 a)', 'Ney = π²·E·Iy/(Ky·Ly)²'], Nez: ['9.7.2.1 c)', 'Nez = [π²·E·Cw/(Kz·Lz)² + G·J]/r0²'],
    Nexz: ['9.7.2.2 b)', 'Nexz = (Nex + Nez)/{2[1 − (x0/r0)²]}·[1 − (1 − 4·Nex·Nez·[1 − (x0/r0)²]/(Nex + Nez)²)^0,5]'],
    Nzf: ['9.7.2.2 a) (y de simetria: y → x)', 'Nex = π²·E·Ix/(Kx·Lx)²'],
    Neyz: ['9.7.2.2 b) (y de simetria: x → y, x0 → y0)', 'Neyz = (Ney + Nez)/{2[1 − (y0/r0)²]}·[1 − (1 − 4·Ney·Nez·[1 − (y0/r0)²]/(Ney + Nez)²)^0,5]'],
    Nt: ['9.7.2.1 c) com Cw = 0', 'Nt = G·J/r0²'], Ne1: ['9.7.2.2 a)', 'π²·E·I1/(K·L)²'], Ne2: ['9.7.2.2 a)', 'π²·E·I2/(K·L)²'],
    Ne1z: ['9.7.2.2 b)', 'flexo-torção em torno do eixo de simetria (principal 1)'],
    r0: ['9.7.2.1', 'r0 = (rx² + ry² + x0² + y0²)^0,5'], y0: ['9.7.2.1', 'distância centro de torção — centroide'],
    Aef: ['9.7.2; 9.2.2 (MLE)', 'Aef com bef de 9.2.2 para σ = χ·fy'], lambdaP: ['9.2.2.1 (Tab. 6)', 'λp = (b/t)/[0,95·(k·E/σ)^0,5]'],
    NcRdGlobal: ['9.7.2', 'Nc,Rd = χ·Aef·fy/γ, γ = 1,20'], NcRd: ['9.7.2', 'Nc,Rd = χ·Aef·fy/γ, γ = 1,20'],
    NcRdIsolado: ['9.7.5', '2 × Nc,Rd do perfil isolado'],
    esbeltez: ['9.7.4; 9.7.5', 'KL/r ≤ 200; perfil componente < ½ λ do conjunto (presilhas)'], distorcional: ['9.3; 9.7.3', 'Nc,Rd = χdist·A·fy/1,20'],
  },
  trac: { _: ['9.6.2 a); 9.6.3', 'Nt,Rd = A·fy/γ, γ = 1,10 (escoamento da seção bruta); L/r ≤ 300 recomendado'], esbeltez: ['9.6.3', 'L/r ≤ 300 (recomendação; também para cada perfil de barra composta)'] },
  flex: {
    _: ['9.8.2', 'MRd = menor de 9.8.2.1, 9.8.2.2 e 9.8.2.3'],
    Wef: ['9.8.2.1 a); 9.2.2', 'Wef da seção efetiva (MLE)'], MRdEsc: ['9.8.2.1', 'MRd = Wef·fy/γ, γ = 1,10'],
    Me: ['9.8.2.2 / Anexo E', 'Me = Cb·r0·(Ney·Nez)^0,5 (flexão em torno do eixo de simetria); Anexo E (eixo perpendicular à simetria)'],
    lambda0: ['9.8.2.2', 'λ0 = (Wc·fy/Me)^0,5'], chiFLT: ['9.8.2.2', 'λ0 ≤ 0,6: 1,0; 0,6 < λ0 < 1,336: 1,11(1 − 0,278·λ0²); λ0 ≥ 1,336: 1/λ0²'],
    Wc: ['9.8.2.2', 'módulo elástico da seção bruta, fibra extrema comprimida'], WcEf: ['9.8.2.2 a); 9.2.2', 'Wc,ef para σ = χFLT·fy'],
    MRdFLT: ['9.8.2.2', 'MRd = χFLT·Wc,ef·fy/γ, γ = 1,10'], Cb: ['9.8.2.2', 'Cb = 12,5·Mmáx/(2,5·Mmáx + 3MA + 4MB + 3MC); 1,0 a favor da segurança'],
    Cs: ['Anexo E', 'sinal conforme a fibra comprimida'], j: ['Anexo E (E.2.1)', 'j = [∫x³dA + ∫xy²dA]/(2·Iy) + x0; entra em Me = (Cs·Nex/Cm)·[j + Cs·(j² + r0²·Nez/Nex)^0,5] (E.2)'], Cm: ['Anexo E (E.2)', 'Cm = 0,6 − 0,4·(M1/M2); 1,0 se um momento intermediário supera M2'], dist: ['9.3; 9.8.2.3', 'MRd = χdist·W·fy/1,10'],
  },
  shear: {
    _: ['9.8.3', 'VRd = 0,6·fy·h·t/γ (h/t ≤ 1,08·(E·kv/fy)^0,5); 0,65·t²·(kv·fy·E)^0,5/γ; 0,905·E·kv·t³/h/γ; γ = 1,10'],
    kv: ['9.8.3', 'kv = 5,0 (alma sem enrijecedores transversais)'], ht: ['9.8.3', 'h = parte plana da alma'], h: ['9.8.3', 'altura da parte plana'],
    lim108: ['9.8.3', '1,08·(E·kv/fy)^0,5'], lim140: ['9.8.3', '1,4·(E·kv/fy)^0,5'],
  },
  shear8800: {
    _: ['NBR 8800:2024 5.4.3.4 / 5.4.3.5 (referência externa)', 'VRd = 0,6·fy·Aw/γa1 (plastificação), γa1 = 1,10'],
    kv: ['NBR 8800:2024 5.4.3.4/5.4.3.5', 'kv = 1,2'], ht: ['NBR 8800:2024 5.4.3.5', 'h = parte plana, t = espessura'],
    lp: ['NBR 8800:2024 5.4.3.1', 'λp = 1,10·(kv·E/fy)^0,5'], lr: ['NBR 8800:2024 5.4.3.1', 'λr = 1,37·(kv·E/fy)^0,5'],
  },
  inter: { _: ['9.9', 'NSd/NRd + Mx,Sd/Mx,Rd + My,Sd/My,Rd ≤ 1,0'], parcelas: ['9.9', 'parcelas N + Mx + My'] },
  mv: { _: ['9.8.4', '(MSd/MRd)² + (VSd/VRd)² ≤ 1,0 (barra sem enrijecedores de alma)'] },
};
function refFamily(key, b) {
  if (key === 'axial') return /tra[çc]/i.test(b.modo || '') ? 'trac' : 'comp';
  if (key === 'flexaoX' || key === 'flexaoY' || key === 'bending') return 'flex';
  if (key === 'corteY' || key === 'corteZ' || key === 'shear') return /8800/.test(b.formula || '') ? 'shear8800' : 'shear';
  if (key === 'interaction') return 'inter';
  if (key === 'interactionMV') return 'mv';
  return null;
}
const refTxt = (r) => r ? `${r[0]} — ${r[1]}` : '';

const SKIP = new Set(['demand', 'capacity', 'ratio', 'formula', 'adim', 'verificado', 'parcelas', 'esbeltez', 'composta', 'distorcional', 'dist', 'motivo']);
const val = (k, v) => { const [, kind] = LBL[k] || []; return typeof v === 'number' ? (KIND[kind ?? ''] || KIND[''])(v) : String(v); };

function items(o, R = null) {
  const out = [], other = [], ref = (k) => refTxt(R?.[k]);
  for (const [k, v] of Object.entries(o || {})) {
    if (SKIP.has(k) || v == null || typeof v === 'object') continue;
    (LBL[k] ? out : other).push([LBL[k] ? t(LBL[k][0]) : k, val(k, v), ref(k)]);
  }
  if (o?.esbeltez) out.push([t('Esbeltez (λ / límite)'), Object.entries(o.esbeltez).filter(([k]) => k !== 'limite').map(([k, v]) => `${k} ${num(v, 1)}`).join(' · ') + ` / ${num(o.esbeltez.limite, 0)}`, ref('esbeltez')]);
  for (const [d, k] of [[o?.distorcional, 'distorcional'], [o?.dist, 'dist']]) if (d) out.push([t('Pandeo distorsional'), d.dispensada ? `${t('dispensado')} — ${d.motivo || ''}` : Object.entries(d).filter(([, v]) => typeof v === 'number').map(([kk, v]) => `${kk} ${num(v, 3)}`).join(' · '), ref(k)]);
  if (o?.composta) for (const [k, v] of Object.entries(o.composta)) if (v != null && typeof v !== 'object') out.push([`${LBL[k] ? t(LBL[k][0]) : k} — ${t('seção composta')}`, val(k, v), ref(k)]);
  if (o?.parcelas) out.push([t('Parcelas'), Object.entries(o.parcelas).map(([k, v]) => `${k} ${num(v, 3)}`).join(' + '), ref('parcelas')]);
  if (o?.verificado === false && o?.motivo) out.push([t('No verificado'), o.motivo, '']);
  return { out, other };
}

// blocks in the order of the memorial; flexaoX/flexaoY/corteY/corteZ (NBR) or bending/shear (other codes)
const BLOCKS = [
  ['axial', 'Fuerza axial', 'F'], ['flexaoX', 'Flexión — eje fuerte', 'M'], ['flexaoY', 'Flexión — eje débil', 'M'],
  ['corteY', 'Cortante Vy', 'F'], ['corteZ', 'Cortante Vz', 'F'], ['interaction', 'Interacción N + M', ''], ['interactionMV', 'Interacción M + V', ''],
];
const BLOCKS_GEN = [['axial', 'Fuerza axial', 'F'], ['bending', 'Flexión', 'M'], ['shear', 'Cortante', 'F'], ['interaction', 'Interacción', '']];
// pending premises / checks not made: shown at the top, and "atende" becomes "atende com ressalvas"
const PEND = /NÃO verificad|não verificad|LACUNA|NÃO coberta|não coberta|não é considerada|não considerada|NÃO considerad|não é leitura literal|sem qualificação estrutural/;

export function memberMemo(row, { model } = {}) {
  const el = model?.elements?.get(row.id), mat = el ? model.materials.get(el.matId) : null, md = mat?.design || {};
  const sec = el ? model.sections?.get(el.secId) : null, cf = sec?.design?.cfProps || null;
  const fl = row.flamb || {}, f = row.forces || {}, dsg = el?.design || {};
  const is14762 = /14762/.test(row.metodo || '');
  // cold-formed: the code is NBR 14762; NBR 8800 only as external reference (the dispatcher label says 8800)
  const norma = is14762
    ? `ABNT NBR 14762:2010 (${t('método da largura efetiva')}) — ${t('referência externa')}: ABNT NBR 8800:2024 (${t('cortante')} 5.4.3.4/5.4.3.5; ${t('comprimentos destravados')} 4.10.6.1)`
    : `${row.codigoLabel || row.code || ''}${row.metodo ? ` — ${row.metodo}` : ''}`;
  const comb = model?.combinations ? [...model.combinations.values()].find((c) => c.name === row.combo) : null;
  const combTxt = comb ? comb.factors.map(({ lcId, factor }) => `${num(factor, 2)} × ${model.loadCases.get(lcId)?.name ?? lcId}`).join(' + ') : '';
  const dados = [
    [t('Sección'), `${row.sec}${cf?.fonte ? ` — ${cf.fonte}` : ''}`],
    [t('Material'), `${row.mat}${md.Fy ? ` — fy = ${num(md.Fy, 0)} MPa, fu = ${num(md.Fu, 0)} MPa` : ''}${mat?.E ? `, E = ${num(mat.E / 1e3, 0)} MPa` : ''}${mat?.G ? `, G = ${num(mat.G / 1e3, 0)} MPa` : ''}`],
    [t('Norma / método'), norma],
    [t('Combinación determinante'), `${row.combo || '—'}${combTxt ? ` = ${combTxt}` : ''}`],
    [t('Longitud del tramo'), KIND.L(f.L)],
    [t('Longitudes no arriostradas'), `Lx = ${num(fl.Lx, 2)} · Ly = ${num(fl.Ly, 2)} · Lb = ${num(fl.Lb, 2)} · Lz = ${num(fl.Lz, 2)} m${fl.auto ? ` (${t('automático')})` : ''}; K = 1`],
  ];
  if (dsg.presilhas?.l1) dados.push([t('Presillas'), `l1 = ${num(dsg.presilhas.l1, 3)} m`]);
  if (dsg.contencaoTorcao) dados.push([t('Contención a la torsión'), t('declarada (Lb = Lz = Ly)')]);
  if (is14762 && md.Fy && md.Fu) dados.push([t('Relação fu/fy (4.1.1)'), `${num(md.Fu / md.Fy, 2)} ${md.Fu / md.Fy >= 1.08 ? '≥' : '<'} 1,08`]);
  if (is14762) dados.push([t('Trabalho a frio (Anexo B)'), t('não considerado: fy nominal do aço (a favor da segurança)')]);
  if (is14762) dados.push([t('Coeficientes de ponderação γ (NBR 14762:2010)'), `${t('tração')} 1,10 (${t('escoamento')}, 9.6.2 a) · ${t('compressão')} 1,20 (9.7) · ${t('flexão e cortante')} 1,10 (9.8)`]);
  // gross section (catalogue): x = major axis of the code (local z of the model), y = minor
  const props = [];
  if (cf) {
    const d = cf.dims || {};
    props.push([t('Dimensões'), Object.entries(d).filter(([, v]) => typeof v === 'number' && v > 0).map(([k, v]) => `${k} = ${num(v * 1e3, 2)}`).join(' · ') + ' mm']);
    if (cf.A != null) props.push(['A', `${num(cf.A * 1e4, 2)} cm²`]);
    if (cf.Iz != null) props.push(['Ix · Iy', `${num(cf.Iz * 1e8, 2)} · ${num(cf.Iy * 1e8, 2)} cm⁴`]);
    if (cf.Sz != null) props.push(['Wx · Wy', `${num(cf.Sz * 1e6, 2)} · ${num(cf.Sy * 1e6, 2)} cm³`]);
    if (cf.rz != null) props.push(['rx · ry', `${num(cf.rz * 1e2, 2)} · ${num(cf.ry * 1e2, 2)} cm`]);
    if (cf.J != null) props.push(['J', `${num(cf.J * 1e8, 4)} cm⁴`]);
    if (cf.Cw != null) props.push(['Cw', `${num(cf.Cw * 1e12, 1)} cm⁶`]);
    for (const k of ['xg', 'x0', 'r0']) if (cf[k] != null) props.push([k, `${num(cf[k] * 1e3, 2)} mm`]);
    if (cf.shape === '2L' || /^2L /.test(row.sec)) props.push([t('Seção composta 2L'), t('Cw = 0 e J = 2·J1 (premissas da verificação como seção composta, 9.7.2.2)')]);
  }
  const esforcos = [
    ['N', `${KIND.F(Math.abs(f.N || 0))} ${(f.N || 0) < 0 ? `(${t('compresión')})` : (f.N || 0) > 0 ? `(${t('tracción')})` : ''}`],
    ['Vy', KIND.F(f.Vy || 0)], ['Vz', KIND.F(f.Vz || 0)], [`Mz (Msd,x — ${t('eixo forte')})`, KIND.M(f.Mz || 0)], [`My (Msd,y — ${t('eixo fraco')})`, KIND.M(f.My || 0)],
  ];
  const list = row.flexaoX || row.corteY ? BLOCKS : BLOCKS_GEN;
  const blocos = [];
  for (const [k, tit, kind] of list) {
    const b = row[k]; if (!b || typeof b !== 'object') continue;
    const fam = is14762 ? refFamily(k, b) : null, R = fam ? REF14762[fam] : null;
    const { out, other } = items(b, R);
    const adim = !!b.adim || !kind, fmtV = (v) => adim ? num(v, 3) : KIND[kind](v);
    blocos.push({ key: k, titulo: t(tit) + (b.porPerfil ? ` — ${t('Sd e Rd do conjunto; valores intermediários por perfil')}` : ''), ratio: b.ratio,
      Sd: fmtV(b.demand), Rd: fmtV(b.capacity), adim, formula: b.formula || '', norma: R?._ ? `${/NBR/.test(R._[0]) ? '' : 'NBR 14762:2010 '}${R._[0]} — ${R._[1]}` : '',
      itens: out, outros: other });
  }
  const avisos0 = row.avisos || [];
  const pend = [...(row.condicionado ? [row.condicionado] : []), ...avisos0.filter((a) => PEND.test(a))];
  const avisos = avisos0.filter((a) => !PEND.test(a));
  const ok = row.ratioMax <= 1;
  const veredito = !ok ? t('NO CUMPLE') : pend.length ? t('ATENDE COM RESSALVAS') : row.ratioMax > 0.9 ? t('cumple (ajustado)') : t('cumple');
  return { id: row.id, sec: row.sec, ratioMax: row.ratioMax, governs: row.governs, ok, veredito, pend, dados, props, esforcos,
    notaEsforcos: t('Envolvente: |máximo| ao longo da barra na combinação determinante. Nas verificações, os momentos de cantoneiras são projetados nos eixos principais e, nas barras compostas, divididos por perfil (ver avisos); em U/Ue o sentido de My vem do diagrama.'),
    blocos, avisos };
}

const cls = (r) => !(r <= 1) ? 'r-bad' : r > 0.9 ? 'r-warn' : 'r-ok';
const RESP = 'Resultado de programa: a conferência e a responsabilidade técnica (ART) são do engenheiro responsável.';
export function memoHTML(m) {
  const kv = (rows) => rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');
  const kv3 = (rows) => rows.map(([a, b, r]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td class="memo-ref">${esc(r || '')}</td></tr>`).join('');
  const blk = m.blocos.map((b) => `
    <div class="memo-blk"><div class="memo-blk-h"><b>${esc(b.titulo)}</b> <span class="${cls(b.ratio)}">${b.adim ? `${esc(b.Sd)} ≤ 1` : `Sd/Rd = ${esc(b.Sd)} / ${esc(b.Rd)}`} → <b>${num(b.ratio, 3)}</b></span></div>
      ${b.norma ? `<div class="memo-norma">${esc(b.norma)}</div>` : ''}
      ${b.formula ? `<div class="memo-f">${esc(b.formula)}</div>` : ''}
      ${b.itens.length || b.outros.length ? `<table class="memo-t memo-t3"><tr class="memo-th"><td>${t('Grandeza')}</td><td>${t('Valor')}</td><td>${t('Item da norma — expressão')}</td></tr>${kv3(b.itens)}${kv3(b.outros)}</table>` : ''}</div>`).join('');
  return `<div class="memo">
    <div class="memo-h">${t('Barra')} #${m.id} — ${esc(m.sec)} · <span class="${m.ok && m.pend.length ? 'r-warn' : cls(m.ratioMax)}">${t('D/C máx')} ${num(m.ratioMax, 3)} (${esc(t(String(m.governs ?? '—')))}) — ${esc(m.veredito)}</span></div>
    ${m.pend.length ? `<div class="memo-sub r-warn">${t('Premissas e verificações pendentes')}</div><ul class="memo-av">${m.pend.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    <table class="memo-t">${kv(m.dados)}</table>
    ${m.props.length ? `<div class="memo-sub">${t('Propriedades da seção bruta')}</div><table class="memo-t">${kv(m.props)}</table>` : ''}
    <div class="memo-sub">${t('Esfuerzos solicitantes de cálculo')}</div><table class="memo-t">${kv(m.esforcos)}</table>
    <div class="memo-f">${esc(m.notaEsforcos)}</div>
    <div class="memo-sub">${t('Verificaciones')}</div>${blk}
    ${m.avisos.length ? `<div class="memo-sub">${t('Avisos de la verificación')}</div><ul class="memo-av">${m.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    <div class="memo-f">${t(RESP)}</div>
  </div>`;
}

/** Word: d = docx builder of report.js (heading / paragraph / table) */
export function memoDocx(d, m) {
  const col = (r) => !(r <= 1) ? 'DC2626' : r > 0.9 ? 'B45309' : '15803D';
  d.heading(`${t('Barra')} #${m.id} — ${m.sec}`, 3);
  d.paragraph([{ text: `${t('D/C máx')} ${num(m.ratioMax, 3)} (${t(String(m.governs ?? '—'))}) — ${m.veredito}`, bold: true, color: m.ok && m.pend.length ? 'B45309' : col(m.ratioMax) }]);
  if (m.pend.length) { d.paragraph([{ text: t('Premissas e verificações pendentes'), bold: true, color: 'B45309' }]); for (const a of m.pend) d.paragraph([{ text: `• ${a}`, color: 'B45309' }]); }
  d.table([t('Dato'), t('Valor')], m.dados.map(([a, b]) => [a, b]));
  if (m.props.length) d.table([t('Propriedades da seção bruta'), t('Valor')], m.props);
  d.table([t('Esfuerzo'), t('Valor')], m.esforcos.map(([a, b]) => [a, b]));
  d.paragraph([{ text: m.notaEsforcos, italic: true, color: '5C6A7D' }]);
  for (const b of m.blocos) {
    d.paragraph([{ text: `${b.titulo}: ${b.adim ? `${b.Sd} ≤ 1` : `Sd/Rd = ${b.Sd} / ${b.Rd}`} → ${num(b.ratio, 3)}`, bold: true, color: col(b.ratio) }]);
    if (b.norma) d.paragraph([{ text: b.norma, color: '0A3A57' }]);
    if (b.formula) d.paragraph([{ text: b.formula, italic: true, color: '5C6A7D' }]);
    if (b.itens.length || b.outros.length) d.table([t('Grandeza'), t('Valor'), t('Item da norma — expressão')], [...b.itens, ...b.outros].map(([a, v, r]) => [a, v, r || '']));
  }
  if (m.avisos.length) for (const a of m.avisos) d.paragraph([{ text: `• ${a}`, color: '5C6A7D' }]);
  d.paragraph([{ text: t(RESP), italic: true, color: '5C6A7D' }]);
}

/** the most loaded member of each section (memorial: one memo per section group) */
export function criticalPerSection(filas) {
  const by = new Map();
  for (const r of filas || []) if (!by.has(r.sec) || r.ratioMax > by.get(r.sec).ratioMax) by.set(r.sec, r);
  return [...by.values()].sort((a, b) => b.ratioMax - a.ratioMax);
}
