// typology_wizard.js — Assistant by typology: a gallery of structure types → a parametric form per type with
// LIVE preview (every change rebuilds the spec, runs the deterministic generator with the Brazil preset and
// reloads the model, as the warehouse form does). «Gerar» keeps it, «Cancelar» restores the previous model.
// Types the generator cannot build correctly yet are shown disabled with the reason (missing catalogue data
// or a generator stage still to be written) — never a silent substitution.
import { i18n } from '../i18n/i18n.js?v=7';
import { esc } from '../utils/escape.js?v=7';

const t = (k) => i18n.t(k);

// ── card icons (line drawings, currentColor) ──────────────────────────────────
const svg = (body) => `<svg viewBox="0 0 64 40" width="64" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
const ICON = {
  galpao:   svg('<path d="M6 36V16M58 36V16M6 16L32 6L58 16M6 16H58M12 16L18 13.7V16M24 16L32 6M40 16L32 6M46 16V13.7L52 16"/>'),
  edificio: svg('<path d="M10 36V6M32 36V6M54 36V6M10 6H54M10 16H54M10 26H54M4 36H60"/>'),
  trelica:  svg('<path d="M4 30H60L32 12ZM11 30L18 25.5M18 30V25.5L25 30M25 21V30L32 12V30M39 30V21M39 30L46 25.5V30M46 25.5L53 30"/>'),
  passarela:svg('<path d="M2 18H62M2 26H62M8 18L16 26L24 18L32 26L40 18L48 26L56 18M12 26V38M52 26V38"/>'),
  torre:    svg('<path d="M24 38L29 4H35L40 38M24 38L35 4M40 38L29 4M18 12H46M20 20H44"/>'),
  madeira:  svg('<path d="M6 36V14M58 36V14M6 14L32 4L58 14M14 36V11M22 36V8M30 36V5M38 36V8M46 36V11M6 36H58"/>'),
  alma:     svg('<path d="M6 36V12M58 36V12M6 12L32 4L58 12M6 12L14 14M58 12L50 14"/>'),
  umaagua:  svg('<path d="M8 36V8M56 36V18M8 8L56 18M4 36H60"/>'),
  shed:     svg('<path d="M4 36V10M4 10L22 20V10L40 20V10L58 20V36M4 36H60"/>'),
  arco:     svg('<path d="M6 36V22Q32 -2 58 22V36M4 36H60"/>'),
  mezanino: svg('<path d="M6 36V8M58 36V8M6 8H58M6 22H36M36 22V36M4 36H60"/>'),
};

// ── option helpers ────────────────────────────────────────────────────────────
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
const ACO = (libs) => libs.materiales.filter((m) => /acero/i.test(m.tipo)).map((m) => m.nombre);
const CONC = (libs) => libs.materiales.filter((m) => /hormig/i.test(m.tipo)).map((m) => m.nombre);
const PERFIS = (libs) => libs.perfiles.map((p) => p.nombre);
// NBR 6120 Tab. 10 rows of the preset (value = Lo in kN/m²) — choosing one fills the live-load field
const USOS = (libs) => [['', t('— elegir uso (llena q) —')], ...libs.sobrecargas.filter((s) => +s.Lo_kNm2 > 0)
  .map((s) => [s.Lo_kNm2, `${s.building_type} — ${s.descripcion} (${String(s.Lo_kNm2).replace('.', ',')} kN/m²)`])];
const WIND = [
  { sec: '5. Viento (NBR 6123)' },
  { row: [{ id: 'v0', label: 'V0 (m/s) · 0 = sin viento', num: [35, 1, 0] },
    { id: 'cat', label: 'Categoría', sel: ['I', 'II', 'III', 'IV', 'V'], v: 'III' },
    { id: 's3', label: 'Grupo S3', sel: range(1, 5), v: '2' }] },
];

// ── typology definitions ──────────────────────────────────────────────────────
const EDIFICIO = {
  title: 'Edificio de pórticos (varios pisos)',
  fields: [
    { sec: '1. Geometría' },
    { row: [{ id: 'mode', label: 'Modelo', sel: [['3D', '3D'], ['2D', '2D (pórtico plano)']], v: '3D' },
      { id: 'nlev', label: 'Pisos', num: [3, 1, 1] }, { id: 'hlev', label: 'Altura de piso (m)', num: [3, 0.1, 2] }] },
    { row: [{ id: 'nx', label: 'Vanos en X', num: [3, 1, 1] }, { id: 'lx', label: 'Luz en X (m)', num: [5, 0.25, 1] }] },
    { row: [{ id: 'ny', label: 'Vanos en Y', num: [2, 1, 1] }, { id: 'ly', label: 'Luz en Y (m)', num: [5, 0.25, 1] }], show: (v) => v.mode === '3D' },
    { row: [{ id: 'trib', label: 'Ancho tributario (m)', num: [5, 0.25, 0.5] }], show: (v) => v.mode === '2D' },
    { sec: '2. Sistema y secciones' },
    { row: [{ id: 'sys', label: 'Sistema', sel: [['acero', 'Acero (perfiles Gerdau)'], ['hormigon', 'Hormigón armado']], v: 'acero' }] },
    { row: [{ id: 'mat_s', label: 'Acero', sel: ACO, v: 'AR350' }], show: (v) => v.sys === 'acero' },
    { row: [{ id: 'vig_w', label: 'Vigas', sel: PERFIS, v: 'W 310 x 32,7' }, { id: 'pil_w', label: 'Pilares', sel: PERFIS, v: 'W 250 x 73,0' }], show: (v) => v.sys === 'acero' },
    { row: [{ id: 'mat_c', label: 'Hormigón', sel: CONC, v: 'C30' }], show: (v) => v.sys === 'hormigon' },
    { row: [{ id: 'vb', label: 'Viga b (cm)', num: [20, 1, 12] }, { id: 'vh', label: 'Viga h (cm)', num: [50, 5, 20] },
      { id: 'pb', label: 'Pilar b (cm)', num: [30, 1, 14] }, { id: 'ph', label: 'Pilar h (cm)', num: [30, 1, 14] }], show: (v) => v.sys === 'hormigon' },
    { sec: '3. Vínculos' },
    { row: [{ id: 'base', label: 'Apoyo en la base', sel: [['fixed', 'Empotrado'], ['pinned', 'Articulado']], v: 'fixed' },
      { id: 'diaf', label: 'Diafragma rígido', sel: [['1', 'Sí'], ['0', 'No']], v: '1', show: (v) => v.mode === '3D' }] },
    { sec: '4. Cargas (NBR 6120)' },
    { row: [{ id: 'uso', label: 'Uso (NBR 6120, Tab. 10)', sel: USOS, v: '', fills: 'q' }] },
    { row: [{ id: 'g', label: 'Permanente adicional (kN/m²)', num: [1.5, 0.1, 0] }, { id: 'q', label: 'Sobrecarga (kN/m²)', num: [2, 0.1, 0] }] },
    ...WIND,
    { sec: '6. Sismo (NBR 15421)' },
    { row: [{ id: 'ag', label: 'ag (g) · 0 = sin sismo', num: [0, 0.005, 0] },
      { id: 'soil', label: 'Terreno', sel: ['A', 'B', 'C', 'D', 'E'], v: 'D' },
      { id: 'catS', label: 'Categoría de uso', sel: ['I', 'II', 'III'], v: 'I' },
      { id: 'R', label: 'R (Tab. 6)', num: [3, 0.5, 1.5] }] },
  ],
  spec: (v) => ({
    project: 'edificio', typology: 'frame', mode: v.mode,
    geometry: { levels: Array.from({ length: Math.max(1, Math.round(v.nlev)) }, () => ({ height_m: v.hlev })),
      spans_x: { count: Math.max(1, Math.round(v.nx)), span_m: v.lx },
      ...(v.mode === '3D' ? { spans_y: { count: Math.max(1, Math.round(v.ny)), span_m: v.ly } } : { tributary_width_m: v.trib }) },
    sections: v.sys === 'acero' ? { material: v.mat_s, beams: v.vig_w, columns: v.pil_w }
      : { material: v.mat_c, beams: { b_cm: v.vb, h_cm: v.vh }, columns: { b_cm: v.pb, h_cm: v.ph } },
    base_support: v.base, rigid_diaphragm: v.mode === '3D' && v.diaf === '1',
    loads: { dead_extra_kN_m2: v.g, live_load_kN_m2: v.q, wind: v.v0 > 0, seismic: v.ag > 0 },
    wind: { V0_m_s: v.v0, categoria: v.cat, grupoS3: v.s3 },
    seismic: v.ag > 0 ? { ag: v.ag, soil: v.soil, category: v.catS, R: v.R } : undefined,
  }),
};

const TRELICA = {
  title: 'Cercha de cubierta (acero)',
  fields: [
    { sec: '1. Geometría' },
    { row: [{ id: 'span', label: 'Luz (m)', num: [15, 0.5, 4] }, { id: 'slope', label: 'Pendiente (%)', num: [10, 1, 1] },
      { id: 'np', label: 'Paneles (par)', num: [10, 2, 2] }] },
    { row: [{ id: 'tt', label: 'Tipo', sel: ['warren', 'pratt', 'howe'], v: 'pratt' }, { id: 'sp', label: 'Separación entre cerchas (m)', num: [5, 0.25, 0.5] }] },
    { sec: '2. Perfiles' },
    { row: [{ id: 'mat', label: 'Acero', sel: ACO, v: 'MR250' }] },
    { row: [{ id: 'ch', label: 'Cordones', sel: PERFIS, v: 'W 150 x 13,0' }, { id: 'dg', label: 'Montantes y diagonales', sel: PERFIS, v: 'W 150 x 13,0' }] },
    { sec: '3. Cargas' },
    { row: [{ id: 'g', label: 'Peso de cubierta (kN/m²)', num: [0.15, 0.05, 0] }, { id: 'q', label: 'Sobrecarga de cubierta (kN/m²)', num: [0.25, 0.05, 0] }] },
  ],
  note: 'Cercha plana representativa, cargada por su ancho tributario. Viento: use el generador de galpón (NBR 6123 con Cpe/Cpi).',
  spec: (v) => ({
    project: 'trelica', typology: 'truss', mode: '2D', sections: { material: v.mat },
    truss: { span_m: v.span, slope_pct: v.slope, n_panels: Math.max(2, Math.round(v.np)), spacing_m: v.sp, truss_type: v.tt, chord_size: v.ch, diagonal_size: v.dg },
    loads: { dead_extra_kN_m2: v.g, live_load_kN_m2: v.q },
  }),
};

const PASSARELA = {
  title: 'Pasarela peatonal',
  fields: [
    { sec: '1. Geometría' },
    { row: [{ id: 'tipo', label: 'Esquema', sel: [['deck', 'Tablero (2 vigas longitudinales)'], ['central_beam', 'Viga central + transversales'], ['truss', 'Vigas reticuladas']], v: 'deck' }] },
    { row: [{ id: 'len', label: 'Largo (m)', num: [30, 1, 4] }, { id: 'wid', label: 'Ancho (m)', num: [3, 0.25, 1] }] },
    { row: [{ id: 'psp', label: 'Separación de pilas (m)', num: [15, 1, 4] }, { id: 'ph', label: 'Altura de pilas (m)', num: [5, 0.25, 1] }] },
    { row: [{ id: 'tt', label: 'Celosía', sel: ['warren', 'pratt', 'howe'], v: 'pratt' }, { id: 'dep', label: 'Canto de la viga (m)', num: [2, 0.1, 0.5] }], show: (v) => v.tipo === 'truss' },
    { sec: '2. Sistema y secciones' },
    { row: [{ id: 'sys', label: 'Sistema', sel: [['acero', 'Acero (perfiles Gerdau)'], ['hormigon', 'Hormigón armado']], v: 'acero' }] },
    { row: [{ id: 'mat_s', label: 'Acero', sel: ACO, v: 'MR250' }], show: (v) => v.sys === 'acero' },
    { row: [{ id: 'gw', label: 'Vigas longitudinales / cordones', sel: PERFIS, v: 'W 410 x 60,0' }, { id: 'tw', label: 'Transversales / diagonales', sel: PERFIS, v: 'W 200 x 26,6' }], show: (v) => v.sys === 'acero' },
    { row: [{ id: 'pw', label: 'Pilas', sel: PERFIS, v: 'HP 250 x 62,0' }], show: (v) => v.sys === 'acero' },
    { row: [{ id: 'mat_c', label: 'Hormigón', sel: CONC, v: 'C30' }], show: (v) => v.sys === 'hormigon' },
    { row: [{ id: 'gb', label: 'Viga b (cm)', num: [30, 5, 15] }, { id: 'gh', label: 'Viga h (cm)', num: [80, 5, 30] },
      { id: 'pb', label: 'Pila b (cm)', num: [50, 5, 20] }, { id: 'phh', label: 'Pila h (cm)', num: [50, 5, 20] }], show: (v) => v.sys === 'hormigon' },
    { sec: '3. Cargas (NBR 7188)' },
    { row: [{ id: 'g', label: 'Peso del tablero (kN/m²)', num: [2, 0.1, 0] }, { id: 'q', label: 'Multitud p (kN/m²) — NBR 7188 6.1', num: [5, 0.5, 0] }] },
  ],
  note: 'NBR 7188:2024 6.1: p = 5,0 kN/m² sin coeficiente de impacto. Barandas (6.1/6.2: 2,0 kN/m) y choque de vehículos (6.3: 100 kN) no se generan; puente carretero (TB-450) no disponible.',
  spec: (v) => {
    const aco = v.sys === 'acero';
    const truss = v.tipo === 'truss', central = v.tipo === 'central_beam';
    const beam = aco ? v.gw : { b_cm: v.gb, h_cm: v.gh }, pier = aco ? v.pw : { b_cm: v.pb, h_cm: v.phh };
    return {
      project: 'passarela', typology: 'bridge', mode: '3D', sections: { material: aco ? v.mat_s : v.mat_c },
      bridge: { length_m: v.len, width_m: v.wid, pier_span_m: v.psp, pier_height_m: v.ph,
        type: central ? 'central_beam' : 'deck', ...(central ? {} : { girder_type: truss ? 'truss' : 'beam' }),
        ...(truss ? { truss_type: v.tt, depth_m: v.dep } : {}),
        ...(central ? { central_beam_section: beam, transverse_section: aco ? v.tw : { b_cm: 25, h_cm: 50 } }
          : { girder_section: beam, diagonal_size: aco ? v.tw : { b_cm: 25, h_cm: 25 } }),
        pier_section: pier },
      loads: { dead_extra_kN_m2: v.g, live_load_kN_m2: v.q },
    };
  },
};

// Gallery. ready = the generator builds it with the Brazil preset; otherwise `why` says what is missing.
export const TYPOLOGIES = [
  { id: 'galpao', icon: ICON.galpao, title: 'Galpón con cercha', desc: 'Pórticos con cercha, correas, arriostramientos, viento NBR 6123 y sismo NBR 15421.', ready: true, open: (app) => app.warehouseDialog() },
  { id: 'edificio', icon: ICON.edificio, title: 'Edificio de pórticos', desc: 'Varios pisos en acero o hormigón, diafragma rígido, NBR 6120 / 6123 / 15421.', ready: true, form: EDIFICIO },
  { id: 'trelica', icon: ICON.trelica, title: 'Cercha de cubierta', desc: 'Cercha plana Warren / Pratt / Howe con perfiles Gerdau.', ready: true, form: TRELICA },
  { id: 'passarela', icon: ICON.passarela, title: 'Pasarela peatonal', desc: 'Tablero, viga central o vigas reticuladas sobre pilas; NBR 7188 6.1.', ready: true, form: PASSARELA },
  { id: 'torre', icon: ICON.torre, title: 'Torre reticulada', desc: 'Torre de 4 montantes con diagonales en X.', ready: false, why: 'Falta el catálogo de angulares (cantoneiras Gerdau) en el preset Brasil.' },
  { id: 'madeira', icon: ICON.madeira, title: 'Entramado liviano de madera', desc: 'Muros de montantes, entrepisos y cerchas.', ready: false, why: 'Faltan las clases de resistencia de la NBR 7190 en el preset Brasil.' },
  { id: 'alma', icon: ICON.alma, title: 'Pórtico de alma llena', desc: 'Galpón con vigas de alma llena y cartelas.', ready: false, why: 'Etapa 2 del generador.' },
  { id: 'umaagua', icon: ICON.umaagua, title: 'Galpón a un agua', desc: '', ready: false, why: 'Etapa 2 del generador.' },
  { id: 'shed', icon: ICON.shed, title: 'Cubierta shed', desc: '', ready: false, why: 'Etapa 2 del generador.' },
  { id: 'arco', icon: ICON.arco, title: 'Galpón en arco', desc: '', ready: false, why: 'Etapa 2 del generador.' },
  { id: 'mezanino', icon: ICON.mezanino, title: 'Entrepiso (mezanino)', desc: '', ready: false, why: 'Etapa 2 del generador.' },
];

const PANEL_CSS = 'position:fixed;left:12px;top:70px;width:360px;max-height:calc(100vh - 90px);overflow:auto;z-index:9000;background:var(--bg-elev,#fff);border:1px solid var(--border,#ccc);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:0 12px 12px;font-size:12px';
const head = (title, back) => `<div style="position:sticky;top:0;background:var(--accent,#16a34a);color:#fff;margin:0 -12px 8px;padding:10px 12px;font-weight:600;display:flex;gap:8px;align-items:center">
  ${back ? `<span id="typ-back" style="cursor:pointer" title="${esc(t('Volver a la galería'))}">←</span>` : ''}<span style="flex:1">${esc(title)}</span><span id="typ-close" style="cursor:pointer">✕</span></div>`;

// ── gallery ───────────────────────────────────────────────────────────────────
export function openTypologyWizard(app) {
  document.getElementById('typ-panel')?.remove();
  document.getElementById('wh-panel')?.remove();
  const el = document.createElement('div');
  el.id = 'typ-panel';
  el.style.cssText = PANEL_CSS;
  const card = (ty) => `<button type="button" class="typ-card" data-typ="${ty.id}" ${ty.ready ? '' : 'disabled'}
      title="${esc(ty.ready ? t(ty.desc) : t(ty.why))}"
      style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px;border:1px solid var(--border,#ccc);border-radius:8px;background:transparent;color:${ty.ready ? 'var(--accent,#16a34a)' : 'var(--text-muted,#999)'};cursor:${ty.ready ? 'pointer' : 'not-allowed'};opacity:${ty.ready ? 1 : 0.55};text-align:center">
      ${ty.icon}<b style="font-size:11px;color:var(--text,#222)">${esc(t(ty.title))}</b>
      <small style="font-size:10px;color:var(--text-muted,#888);line-height:1.25">${esc(ty.ready ? t(ty.desc) : t(ty.why))}</small></button>`;
  el.innerHTML = head(t('Asistente por tipología'), false)
    + `<p class="panel-hint" style="margin:0 0 8px">${esc(t('Elija el tipo de estructura; el formulario arma el modelo con vista previa en vivo (preset Brasil).'))}</p>`
    + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${TYPOLOGIES.map(card).join('')}</div>`;
  document.body.appendChild(el);
  el.querySelector('#typ-close').onclick = () => el.remove();
  el.querySelectorAll('.typ-card').forEach((b) => b.addEventListener('click', () => {
    const ty = TYPOLOGIES.find((x) => x.id === b.dataset.typ);
    if (!ty?.ready) return;
    el.remove();
    if (ty.open) ty.open(app); else openTypologyForm(app, ty.form);
  }));
  return el;
}

// ── generic parametric form with live preview ─────────────────────────────────
export async function openTypologyForm(app, def) {
  document.getElementById('typ-panel')?.remove();
  const libs = await app._loadAssistantLibraries('brasil');
  const { generateModel } = await import('../../assistant/generator.js?v=7');
  const prev = app.serializer.toJSON(app.model), prevName = app._fileName;
  const opts = (o) => (typeof o === 'function' ? o(libs) : o).map((x) => (Array.isArray(x) ? x : [x, x]));
  const fieldHTML = (f) => {
    const wrap = (inner) => `<div class="prop-field" data-fid="${f.id}"><label>${esc(t(f.label))}</label>${inner}</div>`;
    if (f.num) return wrap(`<input type="number" id="typ-${f.id}" value="${f.num[0]}" step="${f.num[1]}" min="${f.num[2]}">`);
    return wrap(`<select id="typ-${f.id}">${opts(f.sel).map(([v, l]) => `<option value="${esc(v)}" ${v === f.v ? 'selected' : ''}>${esc(t(l))}</option>`).join('')}</select>`);
  };
  const rows = def.fields.map((it, i) => it.sec
    ? `<div style="margin:10px 0 4px;font-size:11px;font-weight:600;color:var(--accent);text-transform:uppercase">${esc(t(it.sec))}</div>`
    : `<div class="prop-row cols${Math.min(it.row.length, 4)}" data-row="${i}">${it.row.map(fieldHTML).join('')}</div>`).join('');
  const el = document.createElement('div');
  el.id = 'typ-panel';
  el.style.cssText = PANEL_CSS;
  el.innerHTML = head(t(def.title), true) + rows
    + (def.note ? `<p class="panel-hint" style="margin:8px 0 0">${esc(t(def.note))}</p>` : '')
    + `<small id="typ-status" style="display:block;margin:8px 0;color:var(--text-muted)"></small>
<div style="display:flex;gap:8px;justify-content:flex-end">
  <button type="button" id="typ-cancel" class="btn-secondary">${esc(t('Cancelar'))}</button>
  <button type="button" id="typ-ok" class="btn-primary">✓ ${esc(t('Generar modelo'))}</button></div>`;
  document.body.appendChild(el);

  const fields = def.fields.flatMap((it) => it.row || []);
  const vals = () => Object.fromEntries(fields.map((f) => {
    const inp = el.querySelector('#typ-' + f.id);
    return [f.id, f.num ? parseFloat(String(inp.value).replace(',', '.')) : inp.value];
  }));
  const applyShow = () => {
    const v = vals();
    def.fields.forEach((it, i) => {
      if (!it.row) return;
      const r = el.querySelector(`[data-row="${i}"]`);
      if (r) r.style.display = it.show && !it.show(v) ? 'none' : '';
      for (const f of it.row) if (f.show) { const c = el.querySelector(`[data-fid="${f.id}"]`); if (c) c.style.display = f.show(v) ? '' : 'none'; }
    });
  };
  let last = null, timer = null;
  const preview = () => {
    applyShow();
    try {
      last = generateModel(def.spec(vals()), libs);
      app._loadJSON(JSON.stringify(last), (last.project || 'modelo') + '.s3d');
      const ws = (last._warnings || []).filter((w) => w.type !== 'info').length;
      el.querySelector('#typ-status').textContent = `${last._generado?.resumenT ? i18n.tf(last._generado.resumenT.k, last._generado.resumenT.v) : (last._generado?.resumen || '')} · ${last.loadCases.length} ${t('casos')} · ${last.combinations.length} ${t('combinaciones')}${ws ? ` · ${ws} ${t('avisos')}` : ''}`;
    } catch (e) { last = null; el.querySelector('#typ-status').textContent = e.message; }
  };
  // a «fills» select copies its value into another field (e.g. NBR 6120 use → live load)
  for (const f of fields) if (f.fills) el.querySelector('#typ-' + f.id).addEventListener('change', (e) => {
    if (e.target.value !== '') el.querySelector('#typ-' + f.fills).value = e.target.value;
  });
  el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(preview, 350); });
  el.addEventListener('change', () => { clearTimeout(timer); timer = setTimeout(preview, 50); });
  const restore = () => { app._loadJSON(prev, prevName || 'nuevo'); el.remove(); };
  el.querySelector('#typ-close').onclick = restore;
  el.querySelector('#typ-cancel').onclick = restore;
  el.querySelector('#typ-back').onclick = () => { restore(); openTypologyWizard(app); };
  el.querySelector('#typ-ok').onclick = () => { if (last) { app.markDirty(); app._showWarnings(last._warnings || []); } el.remove(); };
  app._typSpec = () => def.spec(vals());   // exposed for tests
  preview();
  return el;
}
