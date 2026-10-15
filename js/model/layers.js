// layers.js — layers ("etiquetas" of CYPE 3D) and categories of the model, pure helpers.
//   model.layers      = [{ id, name, color, visible, locked }]  (id 1 = default layer, never deleted)
//   model.activeLayer = id that receives the new members
//   model.layerView   = { colorByLayer, categories: { nos, pilares, vigas, diagonais, placas, panos } }
//   elem.layer        = layer id (missing → 1)
// Category of a member by its orientation: column (|dz|/L ≥ 0,95), beam (≤ 0,05), diagonal otherwise.

export const DEFAULT_LAYER = Object.freeze({ id: 1, name: 'padrão', color: '#64748b', visible: true, locked: false });
export const CATEGORIES = ['nos', 'pilares', 'vigas', 'diagonais', 'placas', 'panos'];

export function ensureLayers(model) {
  if (!Array.isArray(model.layers) || !model.layers.length) model.layers = [{ ...DEFAULT_LAYER }];
  if (!model.layers.some((l) => l.id === 1)) model.layers.unshift({ ...DEFAULT_LAYER });
  if (!model.layers.some((l) => l.id === model.activeLayer)) model.activeLayer = 1;
  const lv = model.layerView || {};
  model.layerView = { colorByLayer: !!lv.colorByLayer, colorBySection: !lv.colorByLayer && !!lv.colorBySection, categories: Object.fromEntries(CATEGORIES.map((c) => [c, lv.categories?.[c] !== false])) };
  return model.layers;
}

export function layerById(model, id) {
  return (model.layers || []).find((l) => l.id === id) || (model.layers || []).find((l) => l.id === 1) || DEFAULT_LAYER;
}

export function categoryOf(model, elem) {
  const a = model.nodes.get(elem.n1), b = model.nodes.get(elem.n2);
  if (!a || !b) return 'diagonais';
  const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1, k = Math.abs(b.z - a.z) / L;
  return k >= 0.95 ? 'pilares' : k <= 0.05 ? 'vigas' : 'diagonais';
}

/** Is the member drawn (its layer visible and its category on)? */
export function elemShown(model, elem) {
  const cats = model.layerView?.categories || {};
  return layerById(model, elem.layer ?? 1).visible !== false && cats[categoryOf(model, elem)] !== false;
}

export function elemLocked(model, elem) { return layerById(model, elem.layer ?? 1).locked === true; }

/** New layer → its id. */
export function addLayer(model, name, color) {
  ensureLayers(model);
  const id = model.layers.reduce((m, l) => Math.max(m, l.id), 0) + 1;
  model.layers.push({ id, name: name || `Camada ${id}`, color: color || '#3b82f6', visible: true, locked: false });
  return id;
}

/** Removes a layer (not the default one); its members go to the default layer. */
export function removeLayer(model, id) {
  if (id === 1) return false;
  model.layers = (model.layers || []).filter((l) => l.id !== id);
  for (const e of model.elements.values()) if (e.layer === id) e.layer = 1;
  if (model.activeLayer === id) model.activeLayer = 1;
  return true;
}

// Colour of a section (CSI/Robot "display colour"): its own `color`, else a fixed palette by id (stable across sessions).
export const SECTION_PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'];
export function sectionColor(model, secId) {
  const s = model?.sections?.get(secId);
  return s?.color || SECTION_PALETTE[((+secId || 1) - 1) % SECTION_PALETTE.length];
}
