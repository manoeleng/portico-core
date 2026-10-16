// connections_dialog.js — "Ligações metálicas" window (menu Assistente): four connection types (barra de treliça em chapa
// de nó, ligação flexível viga–pilar, base de pilar, emenda com talas), inputs on the left, live result on the right:
// figures (elevation / section), summary table (verificação, Sd, Rd, razão, OK/NÃO) and the detailed memory (equation
// with the numbers, clause), plus a printable report (new window → PDF). Calculation: js/design/connections*.js
// (NBR 8800:2024 §6 / NBR 14762:2010 §10, tested against Fakury, Pfeil and Wanderson). Brazil-only: Portuguese texts.
import { trussMemberConnection } from '../design/connections_truss.js?v=7';
import { shearConnection } from '../design/connections_shear.js?v=7';
import { columnBase, TAB18 } from '../design/connections_base.js?v=7';
import { spliceConnection } from '../design/connections_splice.js?v=7';
import { BOLTS_8800 } from '../design/connections.js?v=7';
import { figTruss, figShear, figBase, figSplice, figLmss, figWeldedSplice } from '../design/connections_figs.js?v=7';
import { lcspConnection, baseColumnWeld } from '../design/connections_weld.js?v=7';
import { lmssConnection, weldedSplice } from '../design/connections_rigid.js?v=7';
import { esc } from '../utils/escape.js?v=7';

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const STEELS = { 'MR250 / A36 (250/400)': [250, 400], 'A572 Gr.50 (345/450)': [345, 450], 'USI CIVIL 350 (350/500)': [350, 500], 'ZAR 250 / CF (250/360)': [250, 360], 'A572 Gr.42 (290/415)': [290, 415] };
const BOLT_DIAMS = [['M12', 12], ['½"', 12.7], ['M16', 16], ['⅝"', 15.875], ['M20', 20], ['¾"', 19.05], ['M22', 22], ['⅞"', 22.225], ['M24', 24], ['1"', 25.4], ['M27', 27], ['M30', 30]];

// field specs: [id, label, default, kind] — kind: number (default) | select:[...] | check
const F = {
  trelica: [
    ['h1', 'Barra'], ['tipo', 'Seção da barra', '2L', ['L', '2L', 'U', 'I|I (ligado pela alma)', 'chapa']], ['fab', 'Fabricação', 'lam', ['lam|laminado / soldado (NBR 8800)', 'cf|formado a frio (NBR 14762 se t ≤ 4,75)']],
    ['dI', 'd do perfil I (mm)', 150], ['tfI', 'tf do perfil I (mm)', 4.9], ['b', 'b — aba ligada / alma / largura (mm)', 76.2], ['b2', 'b2 — outra aba / mesa do U (mm)', 76.2], ['t', 't — espessura (mm)', 6.35],
    ['A', 'A de um perfil (mm²) — vazio = calcular', ''], ['ec', 'ec — CG → plano de corte (mm) — vazio = calcular', ''], ['acoB', 'Aço da barra', 'MR250 / A36 (250/400)', Object.keys(STEELS)],
    ['h2', 'Chapa de nó'], ['tg', 'tg (mm)', 9.5], ['acoG', 'Aço da chapa', 'USI CIVIL 350 (350/500)', Object.keys(STEELS)], ['eB', 'eBorda — parafuso → borda da chapa (mm)', 40], ['eLat', 'eLat — linha → borda lateral (mm)', 130.8], ['Lw', 'Lw — Whitmore → solda (mm, compressão)', 102], ['larg', 'largura da chapa na seção dos furos (mm)', ''],
    ['h3', 'Meio de ligação'], ['meio', 'Meio', 'parafuso', ['parafuso', 'solda']],
    ['grade', 'Parafuso', 'ISO 898-1 classe 8.8', Object.keys(BOLTS_8800)], ['db', 'Diâmetro', '20', BOLT_DIAMS.map(([l, v]) => `${v}|${l}`)], ['rosca', 'Rosca no plano de corte', true, 'check'],
    ['n', 'parafusos por linha', 2], ['linhas', 'linhas', 1], ['s', 's — espaçamento (mm)', 100], ['g', 'g — entre linhas (mm)', 0], ['e1', 'e1 — último parafuso → ponta da barra (mm)', 40], ['gHeel', 'gabarito (dorso → linha) (mm)', 46.2],
    ['dw', 'filete dw (mm)', 5], ['L1', 'L1 — filete do dorso (mm)', 100], ['L2', 'L2 — filete da ponta (mm)', 100], ['Lt', 'Lt — filete transversal (mm)', 0], ['eletrodo', 'Eletrodo', 'E70', ['E60', 'E70', 'E80']],
    ['h4', 'Esforço'], ['N', 'NSd (kN; + tração, − compressão)', 200], ['NRd', 'NRd da barra (kN) — 50 %', 365], ['m50', 'Aplicar 50 % de NRd (6.1.5.3, recomendação)', false, 'check'], ['exc45', 'Exceção do 6.1.5.2 (travejamento, tirante, terça, travessa)', false, 'check'],
  ],
  flexivel: [
    ['h1', 'Tipo'], ['ftipo', 'Ligação', 'cantoneira', ['chapa', 'cantoneira']],
    ['h2', 'Viga'], ['tw', 'tw (mm)', 8.8], ['d', 'd (mm)', 410], ['acoV', 'Aço da viga', 'A572 Gr.50 (345/450)', Object.keys(STEELS)],
    ['h3', 'Chapa / cantoneiras'], ['tp', 't da chapa / cantoneira (mm)', 9.5], ['acoP', 'Aço', 'MR250 / A36 (250/400)', Object.keys(STEELS)], ['ab', 'aba na alma b (mm)', 101.6], ['ab2', 'aba no pilar b2 (mm)', 101.6],
    ['a', 'a — face do pilar → linha (mm)', 65], ['ev', 'ev — parafuso extremo → borda (mm)', 40], ['eh', 'eh — linha → borda livre (mm)', 37], ['ebv', 'ebv — linha → extremidade da viga (mm)', ''], ['gc', 'gc — dorso → linha no pilar (mm)', 65],
    ['dw', 'filete chapa–pilar dw (mm)', 6], ['tc', 'espessura do pilar (mesa/alma) (mm)', 15.4], ['fuc', 'fu do pilar (MPa)', 450],
    ['h4', 'Parafusos'], ['grade', 'Parafuso', 'ASTM F3125 A325', Object.keys(BOLTS_8800)], ['db', 'Diâmetro', '19.05', BOLT_DIAMS.map(([l, v]) => `${v}|${l}`)], ['rosca', 'Rosca no plano de corte', true, 'check'], ['n', 'n — parafusos na linha', 4], ['s', 's (mm)', 75],
    ['exc', 'Considerar excentricidade do grupo na alma', true, 'check'],
    ['h6', 'Recorte da viga (viga–viga)'], ['rec', 'Recortes', '0', ['0|sem recorte', '1|1 recorte (mesa superior)', '2|2 recortes']], ['Lh', 'Lh (mm)', 130], ['Lv', 'Lv (mm)', 30], ['bfv', 'bf da viga (mm)', 171], ['tfv', 'tf da viga (mm)', 11.6],
    ['h5', 'Esforço'], ['V', 'VSd (kN)', 400],
  ],
  base: [
    ['h1', 'Pilar I/H'], ['d', 'd (mm)', 200], ['bf', 'bf (mm)', 200], ['tw', 'tw (mm)', 8], ['tf', 'tf (mm)', 12],
    ['h2', 'Placa e chumbadores'], ['btipo', 'Base', '1', ['1|tipo 1 — chumbadores externos', '2|tipo 2 — internos']], ['nb', 'nb — chumbadores', 4], ['db', 'Chumbador (Tab. 18)', '19', TAB18.map((r) => `${r.db}|${r.pol}" (${r.db} mm)`)],
    ['a1', 'a1 (mm) — vazio = Tab. 18', ''], ['a2', 'a2 (mm) — vazio = Tab. 18', 150], ['tp', 'tp — espessura da placa (mm)', 25], ['fyp', 'fy da placa (MPa)', 250],
    ['h3', 'Concreto'], ['fck', 'fck do bloco (MPa)', 25], ['A2A1', 'A2/A1 (6.6.5; ≤ 4 pelo teto)', 4], ['Nb', 'Nb do bloco (mm, opcional)', ''], ['Bb', 'Bb do bloco (mm, opcional)', ''], ['Ab', 'altura Ab do bloco (mm, opcional)', ''],
    ['h4', 'Força cortante'], ['cis', 'Transmissão', 'atrito', ['atrito|atrito (μ = 0,45)', 'placa|placa de cisalhamento (6.7.2.4)', 'arruelas|arruelas soldadas (6.7.2.5)']], ['bv', 'bv (mm)', 100], ['bh', 'bh (mm)', 150], ['tpv', 'tpv (mm)', 25],
    ['h6', 'Solda pilar–placa'], ['dwb', 'filete dw (mm) — 0 = não verificar', 6], ['fyc', 'fy do pilar (MPa)', 345],
    ['h5', 'Esforços'], ['N', 'NSd (kN; + compressão, − tração)', 500], ['M', 'MSd (kN·m, eixo de maior inércia)', 0], ['V', 'VSd (kN)', 50],
  ],
  emenda: [
    ['h1', 'Tipo'], ['etipo', 'Emenda', 'chapa', ['chapa|barra chata / chapa', 'perfilI|perfil I (mesas + alma)']],
    ['h2', 'Peça'], ['b', 'b — largura da chapa / bf (mm)', 204], ['t', 't da chapa / tf (mm)', 12.7], ['d', 'd do perfil I (mm)', 600], ['tw', 'tw do perfil I (mm)', 12.5], ['acoM', 'Aço da peça', 'MR250 / A36 (250/400)', Object.keys(STEELS)],
    ['h3', 'Talas'], ['nt', 'talas na chapa (1 ou 2)', 2], ['bt', 'largura da tala (mm)', 204], ['tt', 'espessura da tala (mm)', 9.5], ['ha', 'altura da tala da alma (mm)', 380], ['tta', 'espessura da tala da alma (mm)', 12.5], ['acoT', 'Aço das talas', 'MR250 / A36 (250/400)', Object.keys(STEELS)], ['folga', 'folga entre peças (mm)', 10],
    ['h4', 'Parafusos (chapa / mesas)'], ['grade', 'Parafuso', 'ASTM A307', Object.keys(BOLTS_8800)], ['db', 'Diâmetro', '22.225', BOLT_DIAMS.map(([l, v]) => `${v}|${l}`)], ['rosca', 'Rosca no plano de corte', true, 'check'],
    ['linhas', 'linhas (transversais à força)', 3], ['ncol', 'parafusos por linha, de cada lado', 2], ['s', 's (mm)', 76], ['g', 'g — entre linhas (mm)', 64], ['e1', 'e1 — parafuso → ponta da peça (mm)', 51], ['et', 'et — parafuso → ponta da tala (mm)', 51], ['e2', 'e2 — linha → borda lateral (mm)', 38],
    ['h5', 'Parafusos da alma (perfil I)'], ['nr', 'linhas na alma', 4], ['nc', 'colunas de cada lado', 2], ['sv', 'sv (mm)', 100], ['sh', 'sh (mm)', 60], ['e1w', 'coluna → ponta da alma (mm)', 40], ['evw', 'parafuso → borda da tala (vertical) (mm)', 40], ['etw', 'coluna → borda da tala (mm)', 40],
    ['h6', 'Esforços'], ['N', 'NSd (kN; + tração)', 430], ['M', 'MSd (kN·m, perfil I)', 0], ['V', 'VSd (kN, perfil I)', 0],
  ],
};
F.lcsp = [
  ['h1', 'Viga apoiada'], ['d', 'd (mm)', 399], ['bf', 'bf (mm)', 140], ['tf', 'tf (mm)', 8.8], ['tw', 'tw (mm)', 6.4], ['acoV', 'Aço da viga', 'A572 Gr.50 (345/450)', Object.keys(STEELS)],
  ['h2', 'Cantoneiras (soldadas na alma)'], ['b', 'aba b (mm)', 76], ['t', 't (mm)', 6.4], ['L', 'comprimento L (mm)', 230], ['ev', 'ev (mm)', 40], ['g', 'gabarito no suporte (mm)', 45], ['acoA', 'Aço', 'MR250 / A36 (250/400)', Object.keys(STEELS)],
  ['dw', 'filete dw (mm)', 5], ['eletrodo', 'Eletrodo', 'E70', ['E60', 'E70', 'E80']],
  ['h3', 'Parafusos no suporte'], ['grade', 'Parafuso', 'ASTM F3125 A325', Object.keys(BOLTS_8800)], ['db', 'Diâmetro', '19.05', BOLT_DIAMS.map(([l, v]) => `${v}|${l}`)], ['n', 'n por cantoneira', 3], ['s', 's (mm)', 75], ['ts', 't do suporte (mm)', 15], ['fus', 'fu do suporte (MPa)', 450],
  ['h4', 'Recorte'], ['rec', 'Recortes', '0', ['0|sem recorte', '1|1 recorte', '2|2 recortes']], ['Lh', 'Lh (mm)', 130], ['Lv', 'Lv (mm)', 30],
  ['h5', 'Esforço'], ['V', 'VSd (kN)', 300],
];
F.lmss = [
  ['h1', 'Viga'], ['d', 'd (mm)', 258], ['bf', 'bf (mm)', 146], ['tf', 'tf (mm)', 9.1], ['tw', 'tw (mm)', 6.1], ['Zx', 'Zx (cm³) — vazio = calcular', 428.5], ['acoV', 'Aço da viga', 'A572 Gr.50 (345/450)', Object.keys(STEELS)],
  ['h2', 'Pilar'], ['dc', 'd (mm)', 308], ['bfc', 'bf (mm)', 305], ['tfc', 'tf (mm)', 15.4], ['twc', 'tw (mm)', 9.9], ['rc', 'raio de concordância r (mm)', 0], ['acoP', 'Aço do pilar', 'A572 Gr.50 (345/450)', Object.keys(STEELS)],
  ['lados', 'Vigas no nó', '1', ['1|um lado', '2|dois lados']], ['ext', 'Nó no topo do pilar (extremidade)', false, 'check'],
  ['h3', 'Soldas e reforços'], ['dw', 'filete da alma dw (mm)', 6], ['reforco', 'chapas de reforço do painel (mm, cada lado; 0 = sem)', 0],
  ['h4', 'Esforços'], ['M', 'MSd (kN·m)', 100], ['V', 'VSd (kN)', 50], ['N', 'NSd da viga (kN)', 0], ['M2', 'MSd da outra viga (kN·m, 2 lados)', 0], ['Ncol', 'NSd do pilar (kN, compressão)', 0], ['Vcol', 'VSd do pilar no nó (kN)', 0],
];
F.emendaS = [
  ['h1', 'Perfil'], ['d', 'd (mm)', 258], ['bf', 'bf (mm)', 146], ['tf', 'tf (mm)', 9.1], ['tw', 'tw (mm)', 6.1], ['aco', 'Aço', 'A572 Gr.50 (345/450)', Object.keys(STEELS)],
  ['h2', 'Solda'], ['pen', 'Penetração', 'total', ['total|total', 'parcial|parcial']], ['te', 'garganta efetiva (parcial, mm)', 6], ['eletrodo', 'Eletrodo', 'E70', ['E60', 'E70', 'E80']],
  ['h3', 'Esforços'], ['N', 'NSd (kN; + tração)', 50], ['M', 'MSd (kN·m)', 60], ['V', 'VSd (kN)', 40],
];
const TABS = [['trelica', 'Barra de treliça × chapa de nó'], ['flexivel', 'Viga–pilar flexível'], ['lcsp', 'Flexível soldada (LCSP)'], ['lmss', 'Rígida soldada (LMSS)'], ['base', 'Base de pilar (6.7)'], ['emenda', 'Emenda com talas'], ['emendaS', 'Emenda soldada']];

function formHTML(tab) {
  return F[tab].map(([id, lbl, def, kind]) => {
    if (id.startsWith('h')) return `<h4 style="margin:10px 0 4px">${esc(lbl)}</h4>`;
    const fid = `cn-${tab}-${id}`;
    if (kind === 'check') return `<label style="display:flex;gap:6px;align-items:center;margin:3px 0" data-f="${id}"><input type="checkbox" id="${fid}" ${def ? 'checked' : ''}> ${esc(lbl)}</label>`;
    if (Array.isArray(kind)) return `<div class="prop-field" data-f="${id}"><label>${esc(lbl)}</label><select id="${fid}">${kind.map((o) => { const [v, t] = String(o).split('|'); return `<option value="${esc(v)}" ${String(v) === String(def) ? 'selected' : ''}>${esc(t ?? v)}</option>`; }).join('')}</select></div>`;
    return `<div class="prop-field" data-f="${id}"><label>${esc(lbl)}</label><input type="number" id="${fid}" value="${def}" step="any"></div>`;
  }).join('');
}

function readTab(root, tab) {
  const v = {};
  for (const [id, , , kind] of F[tab]) {
    if (id.startsWith('h')) continue;
    const el = root.querySelector(`#cn-${tab}-${id}`); if (!el) continue;
    if (kind === 'check') v[id] = el.checked;
    else if (Array.isArray(kind)) v[id] = el.value;
    else { const x = parseFloat(String(el.value).replace(',', '.')); v[id] = isFinite(x) ? x : undefined; }
  }
  return v;
}
const steel = (k) => { const [fy, fu] = STEELS[k]; return { fy, fu }; };

function compute(tab, v) {
  if (tab === 'trelica') {
    const sB = steel(v.acoB), sG = steel(v.acoG);
    const lam = v.fab === 'lam';
    const secao = v.tipo === 'U' ? { tipo: 'U', bw: v.b, bf: v.b2, t: v.t, A: v.A, ec: v.ec, laminado: lam, ...sB }
      : v.tipo === 'I' ? { tipo: 'I', d: v.dI, bf: v.b2, tf: v.tfI, tw: v.t, t: v.t, bw: v.dI - 2 * v.tfI, A: v.A, laminado: true, ...sB }
      : { tipo: v.tipo, b: v.b, b2: v.b2, t: v.t, A: v.A, ec: v.ec, laminado: lam, ...sB };
    return { r: trussMemberConnection({ secao, chapa: { t: v.tg, ...sG, eBorda: v.eB, eLat: v.eLat, Lw: v.Lw, largura: v.larg },
      meio: v.meio, par: { grade: v.grade, db: +v.db, n: v.n, linhas: v.linhas, s: v.s, g: v.g || 0, e1: v.e1, gHeel: v.gHeel, rosca: v.rosca },
      sol: { dw: v.dw, L1: v.L1 || 0, L2: v.L2 || 0, Lt: v.Lt || 0, eletrodo: v.eletrodo }, N: v.N, opts: { NRdBarra: v.NRd, minimo50: v.m50, excecao45: v.exc45 } }), figs: figTruss };
  }
  if (tab === 'flexivel') {
    const sV = steel(v.acoV), sP = steel(v.acoP), par = { grade: v.grade, db: +v.db, n: v.n, s: v.s, rosca: v.rosca };
    const viga = { tw: v.tw, d: v.d, bf: v.bfv, tf: v.tfv, ...sV };
    const recorte = +v.rec ? { n: +v.rec, Lh: v.Lh, Lv: v.Lv, ya: 75 } : null;
    if (v.ftipo === 'chapa') return { r: shearConnection({ tipo: 'chapa', V: v.V, viga, chapa: { t: v.tp, ...sP, ev: v.ev, eh: v.eh, a: v.a, ebv: v.ebv }, solda: { dw: v.dw, eletrodo: 'E70' }, pilar: { t: v.tc }, par }), figs: figShear };
    return { r: shearConnection({ tipo: 'cantoneira', V: v.V, viga, cant: { b: v.ab, b2: v.ab2, t: v.tp, ...sP, ev: v.ev, eh: v.eh, a: v.a, gc: v.gc, ebv: v.ebv }, pilar: { t: v.tc, fu: v.fuc }, par, opts: { excentricidade: v.exc }, recorte }), figs: figShear };
  }
  if (tab === 'lcsp') {
    const sV = steel(v.acoV), sA = steel(v.acoA);
    return { r: lcspConnection({ viga: { d: v.d, bf: v.bf, tf: v.tf, tw: v.tw, ...sV }, cant: { b: v.b, t: v.t, L: v.L, ev: v.ev, g: v.g, ...sA }, solda: { dw: v.dw, eletrodo: v.eletrodo },
      suporte: { t: v.ts, fu: v.fus }, par: { grade: v.grade, db: +v.db, n: v.n, s: v.s }, V: v.V, recorte: +v.rec ? { n: +v.rec, Lh: v.Lh, Lv: v.Lv } : null }), figs: figShear };
  }
  if (tab === 'lmss') {
    const sV = steel(v.acoV), sP = steel(v.acoP);
    return { r: lmssConnection({ viga: { d: v.d, bf: v.bf, tf: v.tf, tw: v.tw, Zx: v.Zx ? v.Zx * 1e3 : undefined, ...sV }, pilar: { d: v.dc, bf: v.bfc, tf: v.tfc, tw: v.twc, r: v.rc || 0, ...sP },
      M: v.M, V: v.V, N: v.N || 0, M2: v.M2 || 0, Ncol: v.Ncol || 0, Vcol: v.Vcol || 0, lados: +v.lados, extremidade: v.ext, solda: { dw: v.dw, eletrodo: 'E70' }, reforco: v.reforco || 0 }), figs: figLmss };
  }
  if (tab === 'emendaS') {
    const sA = steel(v.aco);
    return { r: weldedSplice({ perfil: { d: v.d, bf: v.bf, tf: v.tf, tw: v.tw, ...sA }, N: v.N || 0, M: v.M || 0, V: v.V || 0, penetracao: v.pen, garganta: v.te, eletrodo: v.eletrodo }), figs: figWeldedSplice };
  }
  if (tab === 'base') {
    if (v.dwb > 0) {
      const rb = columnBase({ pilar: { d: v.d, bf: v.bf, tw: v.tw, tf: v.tf }, tipo: +v.btipo, nb: v.nb, db: +v.db, a1: v.a1, a2: v.a2, placa: { fy: v.fyp, tp: v.tp },
        concreto: { fck: v.fck, A2A1: v.A2A1, Nb: v.Nb, Bb: v.Bb, Ab: v.Ab }, N: v.N, M: v.M || 0, V: v.V || 0, cis: { tipo: v.cis, bv: v.bv, bh: v.bh, tpv: v.tpv } });
      const rw = baseColumnWeld({ pilar: { d: v.d, bf: v.bf, tw: v.tw, tf: v.tf, fy: v.fyc, fu: 450 }, tp: v.tp, dw: v.dwb, eletrodo: 'E70', N: v.N, M: v.M || 0, V: v.V || 0 });
      const checks = [...rb.checks, ...rw.checks], calc = checks.filter((c) => !c.info), res = calc.filter((c) => !c.det || c.res), gov = res.reduce((a, c) => (!a || c.ratio > a.ratio ? c : a), null);
      return { r: { ...rb, checks, avisos: [...rb.avisos, ...rw.avisos], ok: calc.every((c) => c.ok), ratioMax: gov?.ratio || 0, governa: gov }, figs: figBase };
    }
    return { r: columnBase({ pilar: { d: v.d, bf: v.bf, tw: v.tw, tf: v.tf }, tipo: +v.btipo, nb: v.nb, db: +v.db, a1: v.a1, a2: v.a2, placa: { fy: v.fyp, tp: v.tp },
      concreto: { fck: v.fck, A2A1: v.A2A1, Nb: v.Nb, Bb: v.Bb, Ab: v.Ab }, N: v.N, M: v.M || 0, V: v.V || 0, cis: { tipo: v.cis, bv: v.bv, bh: v.bh, tpv: v.tpv } }), figs: figBase };
  }
  const sM = steel(v.acoM), sT = steel(v.acoT);
  if (v.etipo === 'chapa') return { r: spliceConnection({ tipo: 'chapa', folga: v.folga, N: v.N, membro: { b: v.b, t: v.t, ...sM }, talas: { n: v.nt, b: v.bt, t: v.tt, ...sT },
    par: { grade: v.grade, db: +v.db, rosca: v.rosca, linhas: v.linhas, ncol: v.ncol, s: v.s, g: v.g, e1: v.e1, et: v.et, e2: v.e2 } }), figs: figSplice };
  return { r: spliceConnection({ tipo: 'perfilI', folga: v.folga, N: v.N || 0, M: v.M || 0, V: v.V || 0, perfil: { d: v.d, bf: v.b, tf: v.t, tw: v.tw, ...sM },
    talaMesa: { t: v.tt, b: v.bt, ...sT }, talaAlma: { h: v.ha, t: v.tta, ...sT },
    parMesa: { grade: v.grade, db: +v.db, rosca: v.rosca, linhas: v.linhas, ncol: v.ncol, s: v.s, g: v.g, e1: v.e1, et: v.et, e2: v.e2 },
    parAlma: { grade: v.grade, db: +v.db, rosca: v.rosca, nr: v.nr, nc: v.nc, sv: v.sv, sh: v.sh, e1w: v.e1w, ev: v.evw, et: v.etw } }), figs: figSplice };
}

// show only the fields relevant to the current choices
function visibility(root, tab, v) {
  const show = (id, on) => { const el = root.querySelector(`[data-f="${id}"]`); if (el) el.style.display = on ? '' : 'none'; };
  if (tab === 'trelica') {
    const bolt = v.meio === 'parafuso';
    for (const id of ['grade', 'db', 'rosca', 'n', 'linhas', 's', 'g', 'e1', 'gHeel', 'eB', 'eLat']) show(id, bolt);
    for (const id of ['dw', 'L1', 'L2', 'Lt', 'eletrodo']) show(id, !bolt);
    show('b2', v.tipo !== 'chapa'); show('gHeel', bolt && (v.tipo === 'L' || v.tipo === '2L')); show('dI', v.tipo === 'I'); show('tfI', v.tipo === 'I'); show('fab', v.tipo !== 'I');
  } else if (tab === 'flexivel') {
    const ch = v.ftipo === 'chapa';
    for (const id of ['ab', 'ab2', 'gc', 'exc', 'fuc', 'rec']) show(id, !ch); show('dw', ch);
    for (const id of ['Lh', 'Lv', 'bfv', 'tfv']) show(id, !ch && +v.rec > 0);
  } else if (tab === 'base') { for (const id of ['bv', 'bh', 'tpv']) show(id, v.cis === 'placa'); }
  else { const I = v.etipo === 'perfilI'; for (const id of ['d', 'tw', 'ha', 'tta', 'nr', 'nc', 'sv', 'sh', 'e1w', 'evw', 'etw', 'M', 'V']) show(id, I); show('nt', !I); }
}

const badge = (ok) => ok ? '<b style="color:#15803d">OK</b>' : '<b style="color:#b91c1c">NÃO</b>';
export function resultHTML(r, figs, title) {
  const calc = r.checks.filter((c) => !c.info);
  const fmtV = (c) => c.det ? `${nf(c.valor, 2)} ${c.tipo === 'min' ? '≥' : '≤'} ${nf(c.lim, 2)} ${c.un}` : `${nf(c.Sd, 2)} / ${nf(c.Rd, 2)} ${c.un}`;
  const sum = `<table class="wt"><tr><th>Grupo</th><th>Verificação</th><th>Cláusula</th><th>Solicitante / resistente</th><th>Razão</th><th></th></tr>${calc.map((c) => `<tr${c.ok ? '' : ' style="background:rgba(220,38,38,.08)"'}><td>${esc(c.g)}</td><td>${esc(c.nome)}</td><td>${esc(c.ref)}</td><td>${fmtV(c)}</td><td>${isFinite(c.ratio) ? nf(c.ratio, 3) : '—'}</td><td>${badge(c.ok)}</td></tr>`).join('')}</table>`;
  const groups = [...new Set(r.checks.map((c) => c.g))];
  const det = groups.map((g) => `<h4>${esc(g)}</h4>${r.checks.filter((c) => c.g === g).map((c) => `<div class="ck"><div><b>${esc(c.nome)}</b> <span class="note">(${esc(c.ref)})</span>${c.info ? '' : ` — razão ${isFinite(c.ratio) ? nf(c.ratio, 3) : '—'} ${badge(c.ok)}`}</div><div class="eq">${esc(c.eq)}</div></div>`).join('')}`).join('');
  const gov = r.governa;
  return `<h2>${esc(title)}</h2>
  <p><b>Norma:</b> ${r.norma === '14762' ? 'ABNT NBR 14762:2010 §10 (parte mais fina ≤ 4,75 mm) com NBR 8800:2024 onde aplicável' : 'ABNT NBR 8800:2024 §6'}${r.caso ? ` · <b>caso ${esc(r.caso)}</b>` : ''} · <b>${r.ok ? '<span style="color:#15803d">ATENDE</span>' : '<span style="color:#b91c1c">NÃO ATENDE</span>'}</b>${gov ? ` · razão máxima ${nf(r.ratioMax, 3)} (${esc(gov.nome)})` : ''}</p>
  <div class="row">${figs.map((f) => `<div>${f}</div>`).join('')}</div>
  <h3>Resumo das verificações</h3>${sum}
  ${r.avisos.length ? `<h3>Observações</h3><ul>${r.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
  <h3>Memória de cálculo</h3>${det}
  <p class="note">Unidades: mm, MPa, kN, kN·m. γa1 = 1,10; γa2 = 1,35; γw2 = 1,35; γc = 1,4 (combinações normais). Critérios de literatura declarados no texto (decisão B): seção de Whitmore e Cts das faixas externas (Fakury, Silva e Caldas 2017), método elástico para grupos excêntricos. Figuras esquemáticas — não substituem o desenho de fabricação. Responsabilidade técnica: o engenheiro que assina o projeto.</p>`;
}

export const CSS = `body{font:12px/1.4 system-ui,sans-serif;color:#0f172a;margin:16px}h2{margin:0 0 4px}h3{margin:16px 0 6px;color:#0369a1;font-size:13px}h4{margin:10px 0 4px;font-size:12px}
.wt{border-collapse:collapse;width:100%;margin:2px 0}.wt td,.wt th{border:1px solid #cbd5e1;padding:2px 6px;text-align:left;vertical-align:top}.wt th{background:#f1f5f9}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}.note{color:#475569;font-size:11px}.ck{margin:4px 0 8px}.eq{font-family:ui-monospace,Consolas,monospace;font-size:11px;white-space:pre-wrap;color:#1e293b;margin-left:10px}@media print{.noprint{display:none}}`;

export function openConnectionsDialog(app) {
  document.getElementById('conn-panel')?.remove();
  const el = document.createElement('div');
  el.id = 'conn-panel';
  el.style.cssText = 'position:fixed;left:50%;top:60px;transform:translateX(-50%);width:min(1560px,98vw);height:calc(100vh - 70px);z-index:9000;background:var(--bg-elev,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#ccc);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;flex-direction:column;font-size:12px';
  el.innerHTML = `
  <div style="background:var(--accent,#0ea5e9);color:#fff;padding:10px 14px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;font-weight:600">
    <span>Ligações metálicas — NBR 8800:2024 §6 / NBR 14762:2010 §10</span><span id="cn-close" style="cursor:pointer">✕</span></div>
  <div style="display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid var(--border2,#e2e8f0)">${TABS.map(([k, t], i) => `<button class="${i ? '' : 'btn-primary'}" data-tab="${k}" style="padding:4px 10px">${esc(t)}</button>`).join('')}</div>
  <div style="display:flex;flex:1;min-height:0">
    <div style="width:320px;overflow:auto;padding:10px;border-right:1px solid var(--border2,#e2e8f0)">
      <div class="prop-field"><label>Obra / ligação</label><input type="text" id="cn-obra" value="${esc(app?._fileName || 'Ligação')}"></div>
      ${TABS.map(([k], i) => `<div class="cn-form" data-form="${k}" style="${i ? 'display:none' : ''}">${formHTML(k)}</div>`).join('')}
      <div style="display:flex;gap:6px;margin-top:10px"><button class="btn-primary" id="cn-rep" style="flex:1">🖨 Relatório</button></div>
      <p class="panel-hint" style="margin-top:8px">A norma sai da parte mais fina: ≤ 4,75 mm → NBR 14762 §10; senão NBR 8800 §6. Valores padrão: exemplos de Fakury (10.14.3, 10.14.8.2) e Pfeil (3.5.1).</p>
    </div>
    <div id="cn-out" style="flex:1;overflow:auto;padding:10px 14px"></div>
  </div>`;
  document.body.appendChild(el);
  const style = document.createElement('style');
  style.textContent = `#cn-out h2{margin:0 0 4px}#cn-out h3{margin:16px 0 6px;color:#0369a1;font-size:13px}#cn-out h4{margin:10px 0 4px;font-size:12px}
    #cn-out .wt{border-collapse:collapse;width:100%;margin:2px 0}#cn-out .wt td,#cn-out .wt th{border:1px solid #cbd5e1;padding:2px 6px;text-align:left;vertical-align:top}
    #cn-out .wt th{background:rgba(148,163,184,.18)}#cn-out .row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}#cn-out .note{opacity:.75;font-size:11px}
    #cn-out svg{border-radius:6px;max-width:100%;height:auto;border:1px solid #e2e8f0}#cn-out .ck{margin:4px 0 8px}#cn-out .eq{font-family:ui-monospace,Consolas,monospace;font-size:11px;white-space:pre-wrap;margin-left:10px;opacity:.9}`;
  el.appendChild(style);
  const $ = (s) => el.querySelector(s);
  let tab = 'trelica', last = null;
  const update = () => {
    const v = readTab(el, tab); visibility(el, tab, v);
    try { const { r, figs } = compute(tab, v); const title = `${$('#cn-obra').value} — ${TABS.find((t) => t[0] === tab)[1]}`;
      last = { r, figs: figs(r.geo), title }; $('#cn-out').innerHTML = resultHTML(r, last.figs, title); }
    catch (e) { last = null; $('#cn-out').innerHTML = `<p class="panel-hint">Dados incompletos ou inválidos: ${esc(e.message)}</p>`; }
  };
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab; el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('btn-primary', x === b));
    el.querySelectorAll('.cn-form').forEach((f) => { f.style.display = f.dataset.form === tab ? '' : 'none'; }); update();
  }));
  el.querySelectorAll('input,select').forEach((i) => i.addEventListener('input', update));
  $('#cn-close').onclick = () => el.remove();
  $('#cn-rep').onclick = () => {
    if (!last) return;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(last.title)}</title><style>${CSS}</style></head><body>
      <button class="noprint" onclick="window.print()">🖨 Imprimir / salvar PDF</button><p class="note">PORTICO · ${new Date().toLocaleDateString('pt-BR')}</p>${resultHTML(last.r, last.figs, last.title)}</body></html>`;
    window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
  };
  update();
}
