// wind_dialog.js — "Vento NBR 6123" window (Notus-like): inputs → live study (js/design/wind_report.js) with the
// vertical profile, Cpe/Cpi tables, pressures per zone and the zone figures, plus a printable report (new window,
// print → PDF). The calculation is the validated one of assistant/loads.js (tests/test_lit_acoes.mjs,
// tests/test_wind_report.mjs). Brazil-only module: texts in Portuguese.
import { windStudy } from '../design/wind_report.js?v=7';
import { figIsometrica, figVistas, figParedes, figTelhado, figCorte, figCpeMedio, figPerfil } from '../design/wind_figs.js?v=7';
import { esc } from '../utils/escape.js?v=7';
import { mountWind3D } from './wind_3d.js?v=7';

const nf = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const sg = (v) => (v > 0 ? '+' : '') + nf(v, 2);
const S3TXT = {
  1: 'Grupo 1 — edificações cuja ruína total ou parcial pode afetar a segurança ou possibilidade de socorro após tempestade (hospitais, quartéis, centrais de comunicação…)',
  2: 'Grupo 2 — edificações de alto fator de ocupação (escolas, hotéis, comércio…)',
  3: 'Grupo 3 — edificações para residências, comércio e indústria com fator de ocupação normal',
  4: 'Grupo 4 — edificações e instalações industriais com baixo fator de ocupação (depósitos, silos…)',
  5: 'Grupo 5 — edificações temporárias, estruturas dos grupos 1 a 4 durante a construção',
};
const CPI = {
  quatro: { txt: 'Quatro faces igualmente permeáveis: −0,3 ou 0 (6.3.2.1-b)', v: [-0.3, 0] },
  duas: { txt: 'Duas faces opostas permeáveis, outras impermeáveis: +0,2 e −0,3 (6.3.2.1-a)', v: [0.2, -0.3] },
  manual: { txt: 'Informar valores (aberturas dominantes, 6.3.2.1-c)', v: null },
};

function tables(st) {
  const P = st.perfil.map((p) => `<tr><td>${nf(p.z)}</td><td>${nf(p.S2, 3)}</td><td>${nf(p.Vk)}</td><td>${nf(p.q, 1)}</td></tr>`).join('');
  const head = st.cpis.map((c) => `<th>Cp (Cpi ${sg(c)})</th><th>p [kN/m²]</th>`).join('');
  const Z = (alpha, roof) => st.zonas.filter((z) => z.alpha === alpha && /^(E|F|G|I)/.test(z.z) === roof)
    .map((z) => `<tr><td><b>${esc(z.z)}</b></td><td>${esc(z.onde)}</td><td>${sg(z.cpe)}</td>${z.por.map((p) => `<td>${sg(p.cp)}</td><td>${nf(p.p, 3)}</td>`).join('')}</tr>`).join('');
  const sec = (title, alpha, roof) => `<h4>${title}</h4><table class="wt"><tr><th>Zona</th><th>Região</th><th>Cpe</th>${head}</tr>${Z(alpha, roof)}</table>`;
  const cm = st.cpeMedioTelhado.filter((c) => c.cpe != null).map((c) => `<tr><td>${esc(c.zona.replace(/_/g, ' '))}</td><td>${sg(c.cpe)}</td></tr>`).join('');
  return { P, sec, cm };
}

function bodyHTML(st, spacing, view3d = null) {
  const r = st.res, g = st.geo, { P, sec, cm } = tables(st);
  const row = (...figs) => `<div class="row">${figs.map((f) => `<div>${f}</div>`).join('')}</div>`;
  const cortesCp = st.cpis.map((c) => row(figCorte(st, 90, c, 'cp'), figCorte(st, 0, c, 'cp', { r: 1 }))).join('');
  const forcas = spacing > 0 ? st.cpis.map((c) => row(figCorte(st, 90, c, 'q', { spacing }), figCorte(st, 0, c, 'q', { r: 1, spacing }))).join('') : '';
  return `
  <h3>1. Geometria</h3>
  ${view3d === 'live' ? `<div class="row" style="align-items:center;gap:8px"><label>Vista 3D: <select id="wd-3dmode">${[['geo', 'Geometria'], ['cpe90', 'Cpe — α = 90°'], ['cpe0', 'Cpe — α = 0°'], ...st.cpis.flatMap((c) => [[`cp90_${c}`, `Cp — α = 90°, Cpi ${sg(c)}`], [`cp0_${c}`, `Cp — α = 0°, Cpi ${sg(c)}`]])].map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></label><span class="note">arraste para girar · roda do mouse para aproximar</span></div><div id="wd-3d" style="width:600px;height:380px;border:1px solid #e2e8f0;border-radius:6px"></div>` : view3d ? `<img src="${view3d}" width="600" alt="vista 3D">` : figIsometrica(st)}${row(figVistas(st))}
  <table class="wt">
    <tr><td>a × b (planta)</td><td>${nf(st.inp.a)} × ${nf(st.inp.b)} m</td><td>H (beiral, Detalhe I) / topo</td><td>${nf(st.inp.hBeiral)} / ${nf(st.hTop)} m</td></tr>
    <tr><td>θ (inclinação do telhado)</td><td>${nf(st.inp.theta, 1)}°</td><td>h/b · a/b</td><td>${nf(g.hb, 3)} · ${nf(g.ab, 3)}</td></tr>
    <tr><td>A1,B1 = x0 = máx(b/3; a/4) ≤ 2h</td><td>${nf(g.x0, 3)} m</td><td>C1,D1 = mín(2h; b/2)</td><td>${nf(g.xC1, 3)} m</td></tr>
    <tr><td>y = mín(h; 0,15b) (telhado)</td><td>${nf(g.y, 3)} m</td><td>faixa do cpe médio das paredes = mín(0,2b; h)</td><td>${nf(g.faixaParede, 3)} m</td></tr>
  </table>
  <h3>2. Velocidade característica e pressão dinâmica (NBR 6123:2023, 5)</h3>
  <table class="wt">
    <tr><td>V0 (isopletas, Fig. 1)</td><td>${nf(r.V0)} m/s</td><td>S1 (fator topográfico, 5.2)</td><td>${nf(r.S1, 2)}</td></tr>
    <tr><td>Categoria de rugosidade (5.3.1)</td><td>${esc(r.categoria)}</td><td>Classe (5.3.2) — α = 90° / 0°</td><td>${esc(r.classe)} / ${esc(r.classe_empena)}</td></tr>
    <tr><td>S2 no topo (z = ${nf(st.hTop)} m)</td><td>${nf(r.S2, 3)} / ${nf(r.S2_empena, 3)}</td><td>S3 (Tab. 4, grupo ${esc(String(st.inp.grupoS3))})</td><td>${nf(r.S3, 2)}</td></tr>
    <tr><td>Vk = V0·S1·S2·S3 (α = 90°)</td><td>${nf(r.Vk)} m/s</td><td>q = 0,613·Vk² (α = 90° / 0°)</td><td><b>${nf(r.q_Nm2, 1)} / ${nf(r.q_empena_Nm2, 1)} N/m²</b></td></tr>
  </table>
  <div class="row"><div>${figPerfil(st)}</div><div><h4>Perfil vertical (classe ${esc(r.classe)})</h4><table class="wt"><tr><th>z [m]</th><th>S2</th><th>Vk [m/s]</th><th>q [N/m²]</th></tr>${P}</table></div></div>
  <h3>3. Coeficientes de pressão externa — paredes (Tab. 6)</h3>
  ${row(figParedes(st, 90), figParedes(st, 0))}
  <h3>4. Coeficientes de pressão externa — telhado (Tab. 7)</h3>
  ${row(figTelhado(st, 90), figTelhado(st, 0))}${row(figCorte(st, 90, null, 'cpe'), figCorte(st, 0, null, 'cpe', { r: 1 }))}
  ${row(figCpeMedio(st))}
  <h4>Cpe médio (sucções locais, para telhas, terças e fixações)</h4>
  <table class="wt"><tr><td>Paredes (faixa de ${nf(g.faixaParede, 3)} m a barlavento)</td><td>${sg(st.cpeMedioParede)}</td></tr>${cm}</table>
  <p class="note">Telhado: faixa de θ = ${nf(st.thetaRows[0])}°–${nf(st.thetaRows[1])}° da Tab. 7; adotado o valor mais negativo da faixa (a tabela não prescreve interpolação).</p>
  <h3>5. Coeficientes de pressão interna (6.3)</h3>
  ${row(...st.cpis.map((c) => figCorte(st, 90, c, 'cpi')))}
  <h3>6. Combinações Cp = Cpe − Cpi e pressões p = q·Cp</h3>
  ${cortesCp}
  ${sec('Paredes — vento a 0° (q de α = 0°)', 0, false)}
  ${sec('Paredes — vento a 90° (q de α = 90°)', 90, false)}
  ${sec('Telhado — vento a 0°', 0, true)}
  ${sec('Telhado — vento a 90°', 90, true)}
  ${spacing > 0 ? `<h3>7. Forças atuantes no pórtico (faixa de ${nf(spacing)} m)</h3>${forcas}` : '<p class="note">Informe a distância entre pórticos para as forças atuantes no pórtico (kN/m).</p>'}
  ${st.notas.length ? `<h3>Observações</h3><ul>${st.notas.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  <p class="note">ABNT NBR 6123:2023 — Forças devidas ao vento em edificações: 5 (Vk, S1, S2 Tab. 1/3, S3 Tab. 4), 6.3 (Cpi), Tab. 6 (paredes), Tab. 7 (telhados de duas águas). S2 tomado no topo da edificação (a favor da segurança). Cálculo do PORTICO validado contra Gonçalves et al. (EESC/USP) e CBCA Galpões (2010). Responsabilidade técnica: o engenheiro que assina o projeto.</p>`;
}

const CSS = `body{font:12px/1.4 system-ui,sans-serif;color:#0f172a;margin:16px}h2{margin:0 0 4px}h3{margin:16px 0 6px;color:#0369a1;font-size:13px}h4{margin:10px 0 4px;font-size:12px}
.wt{border-collapse:collapse;width:100%;margin:2px 0}.wt td,.wt th{border:1px solid #cbd5e1;padding:2px 6px;text-align:left}.wt th{background:#f1f5f9}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}.note{color:#475569;font-size:11px}@media print{.noprint{display:none}}`;

export async function openWindDialog(app) {
  document.getElementById('wind-panel')?.remove();
  const libs = await app._loadAssistantLibraries('brasil');
  const w = libs.reglas?.loads?.wind;
  const el = document.createElement('div');
  el.id = 'wind-panel';
  el.style.cssText = 'position:fixed;left:50%;top:60px;transform:translateX(-50%);width:min(1100px,96vw);height:calc(100vh - 80px);z-index:9000;background:var(--bg-elev,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#ccc);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;flex-direction:column;font-size:12px';
  const num = (id, lbl, v, step = 0.1) => `<div class="prop-field"><label>${lbl}</label><input type="number" id="${id}" value="${v}" step="${step}" min="0"></div>`;
  const sel = (id, lbl, opts) => `<div class="prop-field"><label>${lbl}</label><select id="${id}">${opts}</select></div>`;
  el.innerHTML = `
  <div style="background:var(--accent,#0ea5e9);color:#fff;padding:10px 14px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;font-weight:600">
    <span>Vento — ABNT NBR 6123:2023 (edificação retangular, telhado de duas águas)</span><span id="wd-close" style="cursor:pointer">✕</span></div>
  <div style="display:flex;flex:1;min-height:0">
    <div style="width:300px;overflow:auto;padding:10px;border-right:1px solid var(--border2,#e2e8f0)">
      <div class="prop-field"><label>Obra</label><input type="text" id="wd-obra" value="${esc(app._fileName || 'Galpão')}"></div>
      <div class="prop-row cols2">${num('wd-v0', 'V0 (m/s) — Fig. 1', 35, 1)}${num('wd-s1', 'S1 (5.2)', 1.0, 0.05)}</div>
      <div class="prop-row cols2">${sel('wd-cat', 'Categoria (5.3.1)', ['I', 'II', 'III', 'IV', 'V'].map((c) => `<option ${c === 'IV' ? 'selected' : ''}>${c}</option>`).join(''))}
        ${sel('wd-s3', 'Grupo S3 (Tab. 4)', [1, 2, 3, 4, 5].map((g) => `<option value="${g}" ${g === 3 ? 'selected' : ''} title="${esc(S3TXT[g])}">${g}</option>`).join(''))}</div>
      <p class="panel-hint" id="wd-s3txt" style="margin:2px 0 6px"></p>
      <div class="prop-row cols2">${num('wd-a', 'a — comprimento (m)', 30, 0.5)}${num('wd-b', 'b — largura (m)', 15, 0.5)}</div>
      <div class="prop-row cols2">${num('wd-h', 'h — altura do beiral (m)', 6, 0.1)}${num('wd-th', 'θ — inclinação (°)', 10, 0.5)}</div>
      <div class="prop-row cols1">${num('wd-sp', 'Distância entre pórticos (m) — forças no pórtico', 5, 0.5)}</div>
      ${sel('wd-cpi', 'Pressão interna Cpi (6.3)', Object.entries(CPI).map(([k, o]) => `<option value="${k}">${esc(o.txt)}</option>`).join(''))}
      <div class="prop-field" id="wd-cpiman-w" style="display:none"><label>Cpi (separados por ;)</label><input type="text" id="wd-cpiman" value="0,8; -0,5"></div>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn-primary" id="wd-rep" style="flex:1">🖨 Relatório</button>
      </div>
      <p class="panel-hint" style="margin-top:8px">Edificação de planta retangular e telhado de duas águas simétrico (θ = 0 para telhado plano). Telhados múltiplos, uma água e marquises: fora desta versão.</p>
    </div>
    <div id="wd-out" style="flex:1;overflow:auto;padding:10px 14px"></div>
  </div>`;
  document.body.appendChild(el);
  const style = document.createElement('style');
  style.textContent = `#wd-out h2{margin:0 0 4px}#wd-out h3{margin:16px 0 6px;color:#0369a1;font-size:13px}#wd-out h4{margin:10px 0 4px;font-size:12px}
    #wd-out .wt{border-collapse:collapse;width:100%;margin:2px 0}#wd-out .wt td,#wd-out .wt th{border:1px solid #cbd5e1;padding:2px 6px;text-align:left}
    #wd-out .wt th{background:rgba(148,163,184,.18)}#wd-out .row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}#wd-out .note{opacity:.75;font-size:11px}
    #wd-out svg{background:#fff;border-radius:6px}`;
  el.appendChild(style);
  const $ = (id) => el.querySelector('#' + id), n = (id) => parseFloat(String($(id).value).replace(',', '.'));
  const inputs = () => {
    const k = $('wd-cpi').value;
    const cpi = k === 'manual' ? String($('wd-cpiman').value).split(/[;\s]+/).map((s) => parseFloat(s.replace(',', '.'))).filter(isFinite) : CPI[k].v;
    return { obra: $('wd-obra').value, V0: n('wd-v0'), S1: n('wd-s1'), categoria: $('wd-cat').value, grupoS3: +$('wd-s3').value,
      a: n('wd-a'), b: n('wd-b'), hBeiral: n('wd-h'), theta: n('wd-th'), cpi: cpi.length ? cpi : [-0.3, 0] };
  };
  let last = null, lastSp = 0, view3d = null;
  const update = () => {
    $('wd-cpiman-w').style.display = $('wd-cpi').value === 'manual' ? '' : 'none';
    $('wd-s3txt').textContent = S3TXT[+$('wd-s3').value];
    const inp = inputs();
    if (!(inp.V0 > 0 && inp.a > 0 && inp.b > 0 && inp.hBeiral > 0)) { $('wd-out').innerHTML = '<p class="panel-hint">Informe V0, a, b e h.</p>'; return; }
    try {
      const st = windStudy(inp, w);
      if (st.erro) { $('wd-out').innerHTML = `<p class="panel-hint">${esc(st.erro)}</p>`; return; }
      last = st; lastSp = n('wd-sp');
      const keep = $('wd-out').querySelector('#wd-3dmode')?.value || 'geo';
      $('wd-out').innerHTML = `<h2>${esc(inp.obra)}</h2>` + bodyHTML(st, n('wd-sp'), 'live');
      const sel3 = $('wd-out').querySelector('#wd-3dmode'); if ([...sel3.options].some((o) => o.value === keep)) sel3.value = keep;
      const mount = () => {
        const m = sel3.value, mm = /^(cpe|cp)(90|0)(?:_(.+))?$/.exec(m);
        view3d = mountWind3D($('wd-out').querySelector('#wd-3d'), st, mm ? { mode: 'cp', alpha: +mm[2], cpi: mm[1] === 'cp' ? +mm[3] : null, width: 600, height: 380 } : { mode: 'geo', width: 600, height: 380 });
      };
      sel3.addEventListener('change', mount); mount();
    } catch (e) { $('wd-out').innerHTML = `<p class="panel-hint">Erro: ${esc(e.message)}</p>`; }
  };
  el.querySelectorAll('input,select').forEach((i) => i.addEventListener('input', update));
  $('wd-close').onclick = () => el.remove();
  $('wd-rep').onclick = () => {
    if (!last) return;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Vento NBR 6123 — ${esc(last.inp.obra)}</title><style>${CSS}</style></head><body>
      <button class="noprint" onclick="window.print()">🖨 Imprimir / salvar PDF</button>
      <h2>Ação do vento — ${esc(last.inp.obra)}</h2><p class="note">ABNT NBR 6123:2023 · PORTICO · ${new Date().toLocaleDateString('pt-BR')}</p>${bodyHTML(last, lastSp, view3d?.toPNG?.() || null)}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank');
  };
  update();
}
