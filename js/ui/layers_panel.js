// layers_panel.js — "Camadas" and "Categorias" in the left model tree (CYPE 3D "Etiquetas" / "Categorias"):
// active layer (receives new members), colour, visible, locked, rename, add/remove; categories on/off; colour the
// structure by layer. Every change updates the model (saved in the .s3d) and re-applies the visibility.
import { i18n } from '../i18n/i18n.js?v=7';
import { esc } from '../utils/escape.js?v=7';
import { ensureLayers, addLayer, removeLayer, CATEGORIES } from '../model/layers.js?v=7';

const t = (k) => i18n.t(k);
const CAT_LABEL = { nos: 'Nodos', pilares: 'Pilares', vigas: 'Vigas', diagonales: 'Diagonales', diagonais: 'Diagonales', placas: 'Placas', panos: 'Paños' };

export function renderLayersPanel(app) {
  const box = document.getElementById('mt-layers'), cbox = document.getElementById('mt-cats');
  if (!box || !cbox) return;
  const m = app.model;
  ensureLayers(m);
  const count = new Map();
  for (const e of m.elements.values()) count.set(e.layer ?? 1, (count.get(e.layer ?? 1) || 0) + 1);
  box.innerHTML = `
    <table class="ly-tbl"><colgroup><col class="c-act"><col class="c-col"><col><col class="c-vis"><col class="c-lock"><col class="c-del"></colgroup><thead><tr><th title="${esc(t('Capa activa: recibe los elementos nuevos'))}">${esc(t('Activa'))}</th><th></th><th>${esc(t('Referencia'))}</th><th class="ly-vis-all" style="cursor:pointer" title="${esc(t('Visible — clic: mostrar u ocultar todas las capas'))}">👁</th><th title="${esc(t('Bloqueada (no seleccionable)'))}">🔒</th><th></th></tr></thead><tbody>
    ${m.layers.map(l => `<tr data-ly="${l.id}">
      <td><input type="radio" name="ly-active" class="ly-act" ${l.id === m.activeLayer ? 'checked' : ''}></td>
      <td><input type="color" class="ly-col" value="${esc(l.color)}" title="${esc(t('Color de la capa'))} (${count.get(l.id) || 0} ${esc(t('elemento(s)'))})"></td>
      <td><input type="text" class="ly-name" readonly value="${esc(l.name)}" title="${esc(l.id === 1 ? t('Capa padrão: nombre fijo') : t('Doble clic para renombrar'))}"></td>
      <td><input type="checkbox" class="ly-vis" ${l.visible !== false ? 'checked' : ''}></td>
      <td><input type="checkbox" class="ly-lock" ${l.locked ? 'checked' : ''}></td>
      <td>${l.id === 1 ? '' : `<button class="ly-del" title="${esc(t('Eliminar capa (sus elementos pasan a la capa padrão)'))}">✕</button>`}</td></tr>`).join('')}
    </tbody></table>
    <label class="ly-colorby"><input type="checkbox" id="ly-colorby" ${m.layerView.colorByLayer ? 'checked' : ''}> ${esc(t('Representar la estructura con los colores de las capas'))}</label>
    <label class="ly-colorby"><input type="checkbox" id="ly-colorsec" ${m.layerView.colorBySection ? 'checked' : ''}> ${esc(t('Representar la estructura con los colores de las secciones'))}</label>`;
  cbox.innerHTML = CATEGORIES.map(c => `<label class="ly-cat"><input type="checkbox" data-cat="${c}" ${m.layerView.categories[c] !== false ? 'checked' : ''}> ${esc(t(CAT_LABEL[c] || c))}</label>`).join('');

  const changed = () => { app.markDirty(); app.viewport.applyLayers(); app.refreshLoads(); renderLayersPanel(app); };
  const lay = (el) => m.layers.find(l => l.id === +el.closest('tr').dataset.ly);
  box.querySelectorAll('.ly-act').forEach(r => r.addEventListener('change', () => { m.activeLayer = lay(r).id; changed(); }));
  box.querySelectorAll('.ly-col').forEach(r => r.addEventListener('change', () => { lay(r).color = r.value; changed(); }));
  // name: the default layer (id 1) is fixed; the others become editable only on double click (no accidental rename);
  // Enter / leaving the field commits, Esc cancels
  box.querySelectorAll('.ly-name').forEach(r => {
    if (lay(r).id === 1) return;
    r.addEventListener('dblclick', () => { r.readOnly = false; r.classList.add('editing'); r.focus(); r.select(); });
    const done = (commit) => {
      if (r.readOnly) return;
      r.readOnly = true; r.classList.remove('editing');
      const v = r.value.trim();
      if (commit && v && v !== lay(r).name) { lay(r).name = v; changed(); } else r.value = lay(r).name;
    };
    r.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') done(false); });
    r.addEventListener('blur', () => done(true));
  });
  box.querySelectorAll('.ly-vis').forEach(r => r.addEventListener('change', () => { lay(r).visible = r.checked; changed(); }));
  // eye header: all layers on/off (all visible → hide all; otherwise show all)
  box.querySelector('.ly-vis-all')?.addEventListener('click', () => { const on = !m.layers.every(l => l.visible !== false); for (const l of m.layers) l.visible = on; changed(); });
  box.querySelectorAll('.ly-lock').forEach(r => r.addEventListener('change', () => { lay(r).locked = r.checked; changed(); }));
  box.querySelectorAll('.ly-del').forEach(b => b.addEventListener('click', () => { app.snapshot?.(); removeLayer(m, lay(b).id); changed(); }));
  box.querySelector('#ly-colorby')?.addEventListener('change', (e) => { m.layerView.colorByLayer = e.target.checked; if (e.target.checked) m.layerView.colorBySection = false; changed(); app.viewport.refreshExtrusion?.(); });
  box.querySelector('#ly-colorsec')?.addEventListener('change', (e) => { m.layerView.colorBySection = e.target.checked; if (e.target.checked) m.layerView.colorByLayer = false; changed(); app.viewport.refreshExtrusion?.(); });
  cbox.querySelectorAll('[data-cat]').forEach(r => r.addEventListener('change', () => { m.layerView.categories[r.dataset.cat] = r.checked; changed(); }));
  const add = document.getElementById('mt-layer-add');
  if (add && !add._wired) {
    add._wired = true;
    add.addEventListener('click', () => {
      const palette = ['#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#f59e0b', '#14b8a6', '#ec4899', '#84cc16'];
      addLayer(app.model, null, palette[(app.model.layers.length - 1) % palette.length]);
      app.markDirty(); renderLayersPanel(app);
    });
  }
}
