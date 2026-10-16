// memo_viewer.js — visualizador A4 da memória de cálculo de uma barra (member_memo.js), no padrão de folha do
// escritório (modelo do Manoel: memorial do Viaduto AlphaVille, tpl_mc002.html): folhas A4 separadas com moldura,
// quadro de cabeçalho (empresa | obra / documento–assunto / cálculo–verificação | folha / revisão / data / código) e
// rodapé; o conteúdo é paginado — cada bloco (tabela, verificação) vai inteiro para a folha seguinte quando não cabe,
// título de seção nunca fica sozinho no pé da folha e os avisos quebram item a item. «Imprimir / PDF» abre as mesmas
// folhas numa janela com @page A4; «Fechar» = Esc ou clique fora das folhas.
import { i18n } from '../i18n/i18n.js?v=7';
import { memoHTML } from '../report/member_memo.js?v=7';

const t = (k) => i18n.t(k);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// sheet styles (light paper, independent of the app theme); frame/header after tpl_mc002.html
export const MEMO_PAPER_CSS = `
  .sheet{width:210mm;height:297mm;background:#fff;color:#111417;position:relative;flex:none;font-family:"Arimo","Arial","Liberation Sans",sans-serif;}
  .frame{position:absolute;inset:8mm 8mm 8mm 10mm;border:1.2pt solid #000;display:flex;flex-direction:column;}
  .hdr{border-collapse:collapse;width:100%;table-layout:fixed;font-size:7pt;}
  .hdr td{border:.75pt solid #000;padding:1.2mm 2mm;vertical-align:middle;}
  .hdr .lbl{display:block;font-size:5.6pt;letter-spacing:.06em;color:#5a6168;text-transform:uppercase;}
  .hdr .val{display:block;font-size:8.2pt;font-weight:700;line-height:1.2;}
  .hdr .emp{text-align:center;} .hdr .emp b{display:block;font-size:10pt;letter-spacing:.04em;line-height:1.15;} .hdr .emp i{font-style:normal;font-size:6pt;color:#5a6168;}
  .hdr .c{text-align:center;}
  .content{flex:1 1 auto;overflow:hidden;min-height:0;padding:4mm 5mm 2mm;font-size:9pt;line-height:1.36;}
  .ftr{border-top:.75pt solid #000;display:flex;justify-content:space-between;gap:4mm;padding:1.2mm 3mm;font-size:6pt;color:#5a6168;}
  .content .memo{border:none;padding:0;margin:0;}
  .content .memo-h{font-size:11.5pt;font-weight:700;margin:0 0 3mm;padding:1.6mm 2mm;background:#eef2f6;border-left:3pt solid #000;}
  .content .memo-sub{font-size:10pt;font-weight:700;margin:3.5mm 0 1.5mm;}
  .content .memo-t{width:100%;border-collapse:collapse;margin:1mm 0 2mm;font-size:8pt;font-variant-numeric:tabular-nums;}
  .content .memo-t td{border:.5pt solid #444;padding:.8mm 1.4mm;vertical-align:top;}
  .content .memo-t td:first-child{background:#eef2f6;width:42%;}
  .content .memo-blk{margin:2.5mm 0;}
  .content .memo-blk-h{display:flex;justify-content:space-between;gap:3mm;flex-wrap:wrap;font-size:9pt;padding:1mm 1.6mm;background:#eef2f6;border:.5pt solid #444;border-bottom:none;}
  .content .memo-blk .memo-t{margin-top:0;}
  .content .memo-f{font-style:italic;color:#333;margin:1mm 0 1.2mm;font-size:8pt;}
  .content .memo-norma{font-size:8pt;color:#0a3a57;margin:1mm 0 .6mm;}
  .content .memo-t3 td:first-child{width:28%;} .content .memo-t3 td:nth-child(2){width:18%;white-space:nowrap;} .content .memo-ref{font-size:7.2pt;color:#333;}
  .content .memo-th td{background:#dfe6ee!important;font-weight:700;font-size:7.4pt;}
  .content .memo-av{margin:0 0 2mm;padding-left:5mm;font-size:7.8pt;color:#333;}
  .content .memo-av li{margin:0 0 .8mm;}
  .content .r-ok{color:#15803d;} .content .r-warn{color:#a15c00;} .content .r-bad{color:#a4161a;font-weight:700;}`;

// atomic units of the memo, in order: a section title glued to the unit that follows it; the notes list item by item
function units(memoEl) {
  const out = [];
  let pendingSub = null;
  for (const ch of [...memoEl.children]) {
    if (ch.classList.contains('memo-sub')) { pendingSub = ch; continue; }
    const parts = ch.tagName === 'UL' ? [...ch.children].map((li) => { const u = document.createElement('ul'); u.className = ch.className; u.appendChild(li); return u; }) : [ch];
    parts.forEach((p, i) => out.push(i === 0 && pendingSub ? [pendingSub, p] : [p]));
    pendingSub = null;
  }
  if (pendingSub) out.push([pendingSub]);
  return out;
}

function sheetHTML(meta) {
  return `<div class="frame"><table class="hdr"><colgroup><col style="width:24%"><col style="width:33%"><col style="width:25%"><col style="width:18%"></colgroup>
    <tr><td rowspan="3" class="emp"><b>${esc(meta.empresa)}</b><i>${esc(meta.sub)}</i></td>
        <td colspan="2"><span class="lbl">${t('Obra')}</span><span class="val">${esc(meta.obra)}</span></td>
        <td class="c"><span class="lbl">${t('Folha')}</span><span class="val fl">—</span></td></tr>
    <tr><td colspan="2"><span class="lbl">${t('Documento / assunto')}</span><span class="val">${esc(meta.documento)}</span></td>
        <td class="c"><span class="lbl">${t('Revisão')}</span><span class="val">${esc(meta.rev || '—')}</span></td></tr>
    <tr><td><span class="lbl">${t('Cálculo / verificação')}</span><span class="val">${esc(meta.calc || '—')}${meta.verif ? ' | ' + esc(meta.verif) : ''}</span></td>
        <td class="c"><span class="lbl">${t('Data')}</span><span class="val">${esc(meta.data)}</span></td>
        <td class="c"><span class="lbl">${t('Código')}</span><span class="val">${esc(meta.cod || '—')}</span></td></tr></table>
    <div class="content"><div class="memo"></div></div>
    <div class="ftr"><span>${esc(meta.footerL)}</span><span>${esc(meta.footerR)}</span></div></div>`;
}

/** builds the A4 sheets inside `host` (must be in the document, to measure) and returns them */
export function paginateMemo(host, memo, meta) {
  const src = document.createElement('div'); src.innerHTML = memoHTML(memo);
  const memoEl = src.querySelector('.memo');
  const sheets = [];
  const newSheet = () => {
    const s = document.createElement('section'); s.className = 'sheet'; s.innerHTML = sheetHTML(meta);
    host.appendChild(s); sheets.push(s); return s.querySelector('.content .memo');
  };
  const over = (body) => { const c = body.parentElement; return c.scrollHeight > c.clientHeight + 1; };
  let body = newSheet();
  for (const u of units(memoEl)) {
    u.forEach((n) => body.appendChild(n));
    if (over(body) && body.children.length > u.length) { body = newSheet(); u.forEach((n) => body.appendChild(n)); }   // whole unit to the next sheet
    if (over(body)) body.parentElement.style.overflow = 'visible';   // a single unit taller than a sheet: shown, never cut
  }
  sheets.forEach((s, i) => { s.querySelector('.fl').textContent = `${i + 1} / ${sheets.length}`; });
  return sheets;
}

export function openMemoViewer(memo, meta = {}) {
  const M = { empresa: 'PORTICO', sub: '', obra: '', documento: `${t('Memoria de cálculo de la barra')} #${memo.id}`, calc: '', verif: '',
    data: new Date().toLocaleDateString('pt-BR'), rev: '', cod: '', footerL: '', footerR: '', ...meta };
  document.getElementById('memo-viewer')?.remove();
  const ov = document.createElement('div');
  ov.id = 'memo-viewer';
  ov.innerHTML = `<style>
    #memo-viewer{position:fixed;inset:0;z-index:9000;background:#dfe3e8;display:flex;flex-direction:column;}
    #memo-viewer .mv-bar{display:flex;gap:8px;align-items:center;padding:8px 16px;background:#f4f6f8;color:#1b2530;border-bottom:1px solid rgba(20,30,45,.18);}
    #memo-viewer .mv-bar b{margin-right:auto;font-size:13px;}
    #memo-viewer .mv-bar span{font-size:12px;}
    #memo-viewer .mv-bar button{padding:4px 12px;cursor:pointer;}
    #memo-viewer .mv-scroll{flex:1;overflow:auto;padding:24px 16px 48px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:24px;}
    #memo-viewer .sheet{box-shadow:0 2px 10px rgba(20,30,45,.18);}
    ${MEMO_PAPER_CSS}</style>
    <div class="mv-bar"><b>${esc(M.documento)}</b><span class="mv-n"></span>
      <button class="mv-print">🖨 ${t('Imprimir / PDF')}</button><button class="mv-close">✕ ${t('Cerrar')}</button></div>
    <div class="mv-scroll"></div>`;
  document.body.appendChild(ov);
  const sheets = paginateMemo(ov.querySelector('.mv-scroll'), memo, M);
  ov.querySelector('.mv-n').textContent = `${sheets.length} ${t('página(s)')} A4`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.querySelector('.mv-close').addEventListener('click', close);
  ov.querySelector('.mv-scroll').addEventListener('click', (e) => { if (e.target.classList.contains('mv-scroll')) close(); });
  ov.querySelector('.mv-print').addEventListener('click', () => {
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!doctype html><html lang="${i18n.getLocale()}"><head><meta charset="utf-8"><title>${esc(M.documento)}</title>
      <style>@page{size:A4;margin:0} html,body{margin:0;background:#fff} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .sheet{height:296.8mm;overflow:hidden;break-after:page;page-break-after:always} .sheet:last-child{break-after:auto;page-break-after:auto} ${MEMO_PAPER_CSS}</style></head>
      <body>${sheets.map((s) => s.outerHTML).join('')}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  });
  return ov;
}
