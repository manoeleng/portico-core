// connections_model_dialog.js — "Ligações do modelo": maps the connections of the analysed model (bases, flexible beams,
// truss members on gusset plates, splices chosen by the user), pre-sizes each one for all ULS combinations
// (js/design/connections_model.js) and shows the table + the detailed memory of each connection; printable report with
// all of them. Requires an analysis with combinations. Brazil-only module: texts in Portuguese.
import { designAll, DEFAULTS, topology, spliceCandidates } from '../design/connections_model.js?v=7';
import { profileToSection } from '../design/profiles.js?v=7';
import { angleProps } from '../design/cf_geom.js?v=7';
import { figTruss, figShear, figBase, figSplice } from '../design/connections_figs.js?v=7';
import { resultHTML, CSS } from './connections_dialog.js?v=7';
import { esc } from '../utils/escape.js?v=7';

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const TIPO = { base: 'Base de pilar (6.7)', flexivel: 'Viga–pilar / viga–viga flexível', trelica: 'Barra de treliça × chapa de nó', emenda: 'Emenda com talas' };
const FIG = { base: figBase, flexivel: figShear, trelica: figTruss, emenda: figSplice };
const ULS = (name) => /^ELU/i.test(name) || (!/^ELS/i.test(name) && !/servi(ç|c)o/i.test(name));

/** plain topology of the app model (lengths mm, stresses MPa) */
export function modelTopology(app) {
  const m = app.model, avisos = [];
  const nodes = [...m.nodes.values()].map((n) => { const rest = Object.values(n.restraints || {}).some((v) => v), spr = Object.values(n.springs || {}).some((v) => v > 0);
    return { id: n.id, x: n.x, y: n.y, z: n.z, support: rest || spr, springRest: spr && !rest }; });
  const secCache = new Map(); let matWarn = false;
  const elems = [...m.elements.values()].map((el) => {
    const sec = m.sections.get(el.secId), mat = m.materials.get(el.matId);
    if (!secCache.has(el.secId)) secCache.set(el.secId, sec?.design?.shape ? sec.design : profileToSection(sec?.name || '')?.design || null);
    const d = secCache.get(el.secId), cf = d?.cfProps;
    const toMM = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, typeof v === 'number' ? v * 1000 : v]));
    const shape = d?.shape === 'Cr' || d?.shape === 'Z' ? d.shape : d?.shape;
    let dims = cf ? toMM(cf.dims) : toMM(d?.dims), A = cf ? cf.A * 1e6 : (sec?.A ? sec.A * 1e6 : undefined), ec;
    if (shape === '2L') { const a = angleProps({ b: dims.b, t: dims.t, ri: dims.ri ?? dims.t }); ec = a.xg; }
    else if (shape === 'L' && cf) ec = cf.xg * 1000;
    else if ((shape === 'U' || shape === 'Ue') && cf) ec = cf.xg * 1000;
    else if (shape === 'channel') ec = (d.xc ?? 0) * 1000 || undefined;
    if (!mat?.design?.Fy) matWarn = true;
    return { id: el.id, n1: el.n1, n2: el.n2, rel: el.releases || Array(12).fill(0), cable: !!el.cable, excluded: !!el.designExcluded,
      shape, dims, A, ec, fy: mat?.design?.Fy ?? 250, fu: mat?.design?.Fu ?? 400, name: sec?.name || `seção ${el.secId}` };
  });
  if (matWarn) avisos.push('Há materiais sem fy/fu de projeto: adotados 250/400 MPa (MR250/A36). Ajuste o material na biblioteca se for outro aço.');
  return { topo: { nodes, elems }, avisos };
}
export function modelCombos(app) {
  if (!app._resultsByCase) { try { app._reconstructResultsFromCache(); } catch { /* none */ } }
  const by = app._resultsByCase; if (!by) return [];
  return [...app.model.combinations.values()].filter((c) => ULS(c.name)).map((c) => by.get('C' + c.id) && { name: c.name, res: by.get('C' + c.id) })
    .filter(Boolean).map(({ name, res }) => ({ name, ef: (id) => { try { return res.getElemForces(id); } catch { return null; } }, R: (id) => { try { return res.getReaction(id); } catch { return null; } } }));
}

export function openConnectionsModelDialog(app) {
  document.getElementById('connm-panel')?.remove();
  const el = document.createElement('div');
  el.id = 'connm-panel';
  el.style.cssText = 'position:fixed;left:50%;top:60px;transform:translateX(-50%);width:min(1560px,98vw);height:calc(100vh - 70px);z-index:9000;background:var(--bg-elev,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#ccc);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;flex-direction:column;font-size:12px';
  const combos = modelCombos(app);
  const { topo, avisos: avTopo } = modelTopology(app);
  const cands = spliceCandidates(topology(topo));
  const P = { ...DEFAULTS };
  const num = (id, lbl, v, step = 0.5) => `<div class="prop-field"><label>${lbl}</label><input type="number" id="${id}" value="${v}" step="${step}"></div>`;
  el.innerHTML = `
  <div style="background:var(--accent,#0ea5e9);color:#fff;padding:10px 14px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;font-weight:600">
    <span>Ligações do modelo — mapeamento e pré-dimensionamento (NBR 8800:2024 §6 / NBR 14762 §10)</span><span id="cm-close" style="cursor:pointer">✕</span></div>
  <div style="display:flex;flex:1;min-height:0">
    <div style="width:310px;overflow:auto;padding:10px;border-right:1px solid var(--border2,#e2e8f0)">
      <p class="panel-hint">${combos.length} combinação(ões) de ELU com resultados · ${topo.elems.length} barras · ${topo.nodes.length} nós</p>
      <h4>Viga–pilar flexível</h4>
      <div class="prop-field"><label>Tipo</label><select id="cm-flex"><option value="cantoneira">cantoneira dupla (Gerdau LCPP)</option><option value="chapa">chapa simples</option></select></div>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cm-exc" checked> Excentricidade do grupo na alma (conservador; Gerdau despreza)</label>
      <h4>Parafusos</h4>
      <div class="prop-field"><label>NBR 8800</label><select id="cm-p88"><option>ASTM F3125 A325</option><option>ISO 898-1 classe 8.8</option><option>ASTM A307</option></select></div>
      <div class="prop-field"><label>NBR 14762 (t ≤ 4,75 mm)</label><select id="cm-p14"><option>ASTM A307</option><option>ASTM F3125 A325</option><option>ISO 898-1 classe 8.8</option></select></div>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cm-rosca" checked> Rosca no plano de corte</label>
      <h4>Chapa de nó</h4>
      <div class="prop-row cols2">${num('cm-tg', 'espessura mínima (mm)', P.chapaNoMin)}${num('cm-lw', 'Lw — Whitmore → solda (mm)', P.Lw, 5)}</div>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cm-m50"> 50 % de NRd da barra (6.1.5.3, recomendação)</label>
      <h4>Bases</h4>
      <div class="prop-row cols2">${num('cm-fck', 'fck do bloco (MPa)', P.fck, 1)}${num('cm-a2', 'A2/A1 (6.6.5)', P.A2A1, 0.25)}</div>
      ${num('cm-fyp', 'fy da placa de base (MPa)', P.fyPlaca, 5)}
      <h4>Emendas (marque os nós)</h4>
      <div id="cm-spl" style="max-height:160px;overflow:auto;border:1px solid var(--border2,#e2e8f0);border-radius:6px;padding:4px">${cands.length ? cands.map((c) => `<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-spl="${c.node}"> nó ${c.node} — ${esc(c.name)}</label>`).join('') : '<span class="panel-hint">nenhum nó com 2 barras colineares da mesma seção</span>'}</div>
      <div style="display:flex;gap:6px;margin-top:10px"><button class="btn-primary" id="cm-run" style="flex:1">Dimensionar ligações</button><button id="cm-rep">🖨 Relatório</button></div>
      <p class="panel-hint" style="margin-top:8px">Geometria pré-dimensionada: a primeira, na ordem de custo, que atende a todas as combinações de ELU (s = 3db, bordas da Tab. 16, gabaritos AISC 1-7A, viga–pilar Gerdau, chapas comerciais). Conferir no projeto; o desenho de fabricação fica com o Detalhador.</p>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;min-width:0">
      <div id="cm-tab" style="flex:0 0 auto;max-height:45%;overflow:auto;padding:8px 12px;border-bottom:1px solid var(--border2,#e2e8f0)"></div>
      <div id="cm-det" style="flex:1;overflow:auto;padding:10px 14px"></div>
    </div>
  </div>`;
  document.body.appendChild(el);
  const style = document.createElement('style');
  style.textContent = `#connm-panel .wt{border-collapse:collapse;width:100%}#connm-panel .wt td,#connm-panel .wt th{border:1px solid #cbd5e1;padding:2px 6px;text-align:left;vertical-align:top}
    #connm-panel .wt th{background:rgba(148,163,184,.18);position:sticky;top:0}#connm-panel tr[data-row]{cursor:pointer}#connm-panel tr[data-row]:hover{background:rgba(14,165,233,.08)}
    #cm-det h3{margin:16px 0 6px;color:#0369a1;font-size:13px}#cm-det h4{margin:10px 0 4px;font-size:12px}#cm-det .row{display:flex;gap:12px;flex-wrap:wrap}#cm-det svg{max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:6px}
    #cm-det .note{opacity:.75;font-size:11px}#cm-det .eq{font-family:ui-monospace,Consolas,monospace;font-size:11px;white-space:pre-wrap;margin-left:10px;opacity:.9}#cm-det .ck{margin:4px 0 8px}`;
  el.appendChild(style);
  const $ = (s) => el.querySelector(s);
  let out = null;
  const title = (row) => `${row.c.id} — ${TIPO[row.c.tipo]} — nó ${row.c.node}, barra ${row.c.elem}`;
  const detail = (row) => {
    if (!row.r) return `<h2>${esc(title(row))}</h2><p class="panel-hint">${esc(row.erro || 'sem resultado')}</p>`;
    let figs = []; try { figs = FIG[row.c.tipo](row.r.geo); } catch { figs = []; }
    return `${row.nota ? `<p style="color:${row.ok ? '#b45309' : '#b91c1c'}"><b>${esc(row.nota)}</b></p>` : ''}${row.req ? `<p><b>${esc(row.req)}</b></p>` : ''}<p><b>Geometria adotada:</b> ${esc(row.desc || '')} · <b>combinação que governa:</b> ${esc(row.D?.combo || '—')}${row.D ? ` (N = ${nf(row.D.N)} kN, V = ${nf(row.D.V)} kN, M = ${nf(row.D.M, 3)} kN·m)` : ''}${row.D?.Mw > 0.05 * Math.max(row.D.M, 1e-9) && row.c.tipo !== 'trelica' ? ` · <span style="color:#b45309">momento no eixo de menor inércia ${nf(row.D.Mw, 3)} kN·m não considerado</span>` : ''}</p>` + resultHTML(row.r, figs, title(row));
  };
  const table = () => {
    const rows = out.rows, nok = rows.filter((r) => !r.ok).length;
    const count = Object.keys(TIPO).map((t) => `${TIPO[t]}: ${rows.filter((r) => r.c.tipo === t).length}`).join(' · ');
    return `<p><b>${rows.length} ligações</b> (${count}) · ${nok ? `<b style="color:#b91c1c">${nok} não atendem</b>` : '<b style="color:#15803d">todas atendem</b>'}</p>
    ${[...avTopo, ...out.avisos].length ? `<details><summary>${[...avTopo, ...out.avisos].length} observação(ões)</summary><ul>${[...avTopo, ...out.avisos].map((a) => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}
    <table class="wt"><tr><th>Ligação</th><th>Tipo</th><th>Nó</th><th>Barra / perfil</th><th>Geometria adotada</th><th>Combinação</th><th>Razão</th><th></th></tr>
    ${rows.map((r, i) => `<tr data-row="${i}"${r.ok ? '' : ' style="background:rgba(220,38,38,.08)"'}><td>${esc(r.c.id)}</td><td>${esc(TIPO[r.c.tipo])}</td><td>${r.c.node}</td><td>${r.c.elem} — ${esc(out.T.elems.find((e) => e.id === r.c.elem)?.name || '')}</td><td>${esc(r.desc || r.erro || '—')}</td><td>${esc(r.D?.combo || '—')}</td><td>${nf(r.ratio, 3)}</td><td>${r.ok ? '<b style="color:#15803d">OK</b>' : '<b style="color:#b91c1c">NÃO</b>'}</td></tr>`).join('')}</table>`;
  };
  const run = () => {
    if (!combos.length) { $('#cm-tab').innerHTML = '<p class="panel-hint">Rode a análise com combinações de ELU (Análise → Combinações NBR 8681) antes de dimensionar as ligações.</p>'; return; }
    const v = (id) => parseFloat(String($(id).value).replace(',', '.'));
    const spliceNodes = new Set([...el.querySelectorAll('[data-spl]')].filter((x) => x.checked).map((x) => +x.dataset.spl));
    Object.assign(P, { ligacaoFlexivel: $('#cm-flex').value, excentricidade: $('#cm-exc').checked, parafuso8800: $('#cm-p88').value, parafuso14762: $('#cm-p14').value,
      rosca: $('#cm-rosca').checked, chapaNoMin: v('#cm-tg'), Lw: v('#cm-lw'), minimo50: $('#cm-m50').checked, fck: v('#cm-fck'), A2A1: v('#cm-a2'), fyPlaca: v('#cm-fyp'), spliceNodes });
    $('#cm-tab').innerHTML = '<p class="panel-hint">Dimensionando…</p>';
    setTimeout(() => {
      try { out = designAll(topo, combos, P); }
      catch (e) { $('#cm-tab').innerHTML = `<p class="panel-hint">Erro: ${esc(e.message)}</p>`; return; }
      $('#cm-tab').innerHTML = table();
      el.querySelectorAll('[data-row]').forEach((tr) => tr.addEventListener('click', () => { $('#cm-det').innerHTML = detail(out.rows[+tr.dataset.row]); }));
      const first = out.rows.findIndex((r) => !r.ok); if (out.rows.length) $('#cm-det').innerHTML = detail(out.rows[first >= 0 ? first : 0]);
    }, 20);
  };
  $('#cm-run').onclick = run;
  $('#cm-close').onclick = () => el.remove();
  $('#cm-rep').onclick = () => {
    if (!out) return;
    const obra = app._fileName || 'Modelo';
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ligações — ${esc(obra)}</title><style>${CSS}.pb{page-break-before:always}</style></head><body>
      <button class="noprint" onclick="window.print()">🖨 Imprimir / salvar PDF</button>
      <h2>Ligações metálicas — ${esc(obra)}</h2><p class="note">PORTICO · ${new Date().toLocaleDateString('pt-BR')} · NBR 8800:2024 §6 / NBR 14762:2010 §10 · pré-dimensionamento automático para ${combos.length} combinações de ELU</p>
      ${table().replace(/ data-row="\d+"/g, '')}
      ${out.rows.map((r) => `<div class="pb">${detail(r)}</div>`).join('')}</body></html>`;
    window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
  };
  if (combos.length) run(); else $('#cm-tab').innerHTML = '<p class="panel-hint">Sem resultados de combinações de ELU: rode a análise primeiro.</p>';
}
