// connections_3d.js — markers of the designed connections in the 3D viewport: one constant-size glyph per connection
// (green = atende, red = não atende, letter = type), placed on the bar near the node for member-end connections and at the
// node for node connections; click → callback with the row (detail of the connection); floating legend with a filter by
// type. Works with the live result rows of the "Ligações do modelo" window and with the rows saved in the model
// (model.connectionDesign). Pure presentation: no calculation here. Optional simplified geometry of the pieces (plates,
// bolts, anchor rods, welds) from js/design/connections_geom.js, merged into one mesh per material.
import * as THREE from 'three';
import { connectionPrimitives, makeContext } from '../design/connections_geom.js?v=7';
import { topology } from '../design/connections_model.js?v=7';
import { modelTopology } from './connections_model_dialog.js?v=7';

export const TYPE_INFO = {
  base: ['B', 'Base de pilar (6.7)'], basePerna: ['P', 'Base de perna de pilar treliçado'], baseUnica: ['P', 'Base de pilar treliçado (placa única)'],
  soldaBase: ['W', 'Solda pilar–placa'], flexivel: ['F', 'Viga–pilar / viga–viga flexível'], lmss: ['R', 'Rígida soldada (LMSS)'],
  trelica: ['T', 'Barra × chapa de nó'], chapaBanzo: ['S', 'Solda chapa de nó–banzo'], emenda: ['E', 'Emenda com talas'], emendaSoldada: ['E', 'Emenda soldada'],
};
const END_TYPES = new Set(['trelica', 'flexivel', 'lmss']);
const PX = 22;                                           // marker size on screen (px)
const COLORS = { plate: 0x94a3b8, bolt: 0x1e293b, anchor: 0x78716c, weld: 0xf97316 };

/** triangles (model coords) of the primitives, mapped to Three by vp.m2t; one merged BufferGeometry per material */
function meshesOf(vp, prims) {
  const pos = { plate: [], bolt: [], anchor: [], weld: [] };
  const T = (p) => vp.m2t(p[0], p[1], p[2]);
  const quad = (arr, a, b, c, d) => { for (const v of [a, b, c, a, c, d]) arr.push(v.x, v.y, v.z); };
  for (const q of prims) {
    const arr = pos[q.m] || pos.plate;
    if (q.k === 'box') {
      const [u, v, w] = q.a, [hu, hv, hw] = q.h;
      const P = (su, sv, sw) => T([0, 1, 2].map((i) => q.c[i] + su * hu * u[i] + sv * hv * v[i] + sw * hw * w[i]));
      const c = [P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)];
      for (const [a, b, cc, d] of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) quad(arr, c[a], c[b], c[cc], c[d]);
    } else {
      const ax = q.ax, ref = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      let e1 = [ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]];
      const l = Math.hypot(...e1); e1 = e1.map((x) => x / l);
      const e2 = [ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]];
      const N = 8, ring = (s) => Array.from({ length: N }, (_, k) => { const t = 2 * Math.PI * k / N, cs = Math.cos(t) * q.r, sn = Math.sin(t) * q.r;
        return T([0, 1, 2].map((i) => q.c[i] + s * q.h * ax[i] + cs * e1[i] + sn * e2[i])); });
      const A = ring(-1), B = ring(1), cA = T(q.c.map((x, i) => x - q.h * ax[i])), cB = T(q.c.map((x, i) => x + q.h * ax[i]));
      for (let k = 0; k < N; k++) { const k2 = (k + 1) % N; quad(arr, A[k], A[k2], B[k2], B[k]);
        for (const v of [cA, A[k2], A[k], cB, B[k], B[k2]]) arr.push(v.x, v.y, v.z); }
    }
  }
  const out = [];
  for (const [m, arr] of Object.entries(pos)) {
    if (!arr.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: COLORS[m], side: THREE.DoubleSide }));
    mesh.renderOrder = 5; mesh.userData.connGeom = m; out.push(mesh);
  }
  return out;
}

function glyph(letter, ok, cache) {
  const key = letter + (ok ? '1' : '0');
  if (cache.has(key)) return cache.get(key);
  const N = 64, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.fillStyle = ok ? '#16a34a' : '#dc2626'; g.strokeStyle = '#ffffff'; g.lineWidth = 5;
  g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 4, 0, 2 * Math.PI); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.font = 'bold 34px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, N / 2, N / 2 + 2);
  const tex = new THREE.CanvasTexture(cv); cache.set(key, tex); return tex;
}
/** normalize a live row ({ c, ok, ratio, desc }) or a saved row ({ id, tipo, node, elem, ok, ratio, desc }) */
const norm = (r) => r.c ? { id: r.c.id, tipo: r.c.tipo, node: r.c.node, elem: r.c.elem, o: r.c.o, ok: !!r.ok, ratio: r.ratio, desc: r.desc, row: r }
  : { id: r.id, tipo: r.tipo, node: r.node, elem: r.elem, o: r.o, ok: !!r.ok, ratio: r.ratio, desc: r.desc, row: r };

/** markers position: member-end types sit on the bar at min(0,25 m; 0,3·L) from the node; node types stack above the node */
function positionOf(vp, model, q, stackIndex) {
  const n = model.nodes.get(q.node); if (!n) return null;
  const P = vp.m2t(n.x, n.y, n.z);
  const e = model.elements.get(q.elem);
  if (END_TYPES.has(q.tipo) && e) {
    const a = model.nodes.get(e.n1), b = model.nodes.get(e.n2); if (!a || !b) return P;
    const far = e.n1 === q.node ? b : a, Q = vp.m2t(far.x, far.y, far.z), L = P.distanceTo(Q);
    return P.clone().add(Q.clone().sub(P).normalize().multiplyScalar(Math.min(0.25, 0.3 * L)));
  }
  return P.add(new THREE.Vector3(0, 0.18 * stackIndex, 0));   // Three y = model Z (up)
}

export class ConnectionMarkers {
  constructor(vp, { onPick = null, onTable = null } = {}) { this.vp = vp; this.onPick = onPick; this.onTable = onTable; this.sprites = []; this.meshes = []; this.cache = new Map(); this.hidden = new Set(); this.geomOn = true; }
  /** simplified pieces of the visible types; rebuilt when the type filter changes */
  _geometry() {
    for (const m of this.meshes) { this.vp._scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.meshes = [];
    if (!this.geomOn || !this._rows) return;
    if (!this._ctx) { const { topo } = modelTopology({ model: this._model }); this._ctx = makeContext(this._model, topology(topo)); }
    const rows = this._rows.filter((r) => !this.hidden.has((r.c || r).tipo));
    const prims = connectionPrimitives(rows, this._ctx).flatMap((x) => x.prims);
    for (const m of meshesOf(this.vp, prims)) { this.vp._scene.add(m); this.meshes.push(m); }
    this.nPrims = prims.length;
  }
  show(rows, model) {
    this.clear(false);
    this._rows = rows; this._model = model; this._ctx = null;
    const scene = this.vp._scene, perNode = new Map();
    this.items = rows.map(norm);
    for (const q of this.items) {
      const k = END_TYPES.has(q.tipo) ? 0 : (perNode.set(q.node, (perNode.get(q.node) ?? -1) + 1), perNode.get(q.node));
      const pos = positionOf(this.vp, model, q, k); if (!pos) continue;
      const [letter] = TYPE_INFO[q.tipo] || ['?'];
      const mat = new THREE.SpriteMaterial({ map: glyph(letter, q.ok, this.cache), depthTest: false, transparent: true, sizeAttenuation: false });
      const s = new THREE.Sprite(mat); s.position.copy(pos); s.renderOrder = 20; s.userData.conn = q;
      // constant screen size: the viewport keeps the world size of one pixel for sizeAttenuation = false sprites
      s.onBeforeRender = () => { const k = (this.vp._nodePxFactor || 0.002) * PX; s.scale.set(k, k, 1); };
      s.visible = !this.hidden.has(q.tipo);
      scene.add(s); this.sprites.push(s);
    }
    this._geometry();
    this._listen(); this._legend();
    this.vp._needsRender = true;
  }
  _listen() {
    const el = this.vp._renderer.domElement;
    if (this._down) return;
    this._down = (ev) => { this._p0 = [ev.clientX, ev.clientY]; };
    this._up = (ev) => {
      if (!this._p0 || Math.hypot(ev.clientX - this._p0[0], ev.clientY - this._p0[1]) > 4) return;    // drag, not click
      const r = el.getBoundingClientRect(), ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.vp._camera);
      const hit = ray.intersectObjects(this.sprites.filter((s) => s.visible), false)[0];
      if (hit && this.onPick) { ev.stopPropagation(); this.onPick(hit.object.userData.conn); }
    };
    el.addEventListener('pointerdown', this._down, true); el.addEventListener('pointerup', this._up, true);
  }
  _legend() {
    document.getElementById('conn3d-legend')?.remove();
    const box = document.createElement('div'); box.id = 'conn3d-legend';
    box.style.cssText = 'position:absolute;right:12px;bottom:40px;z-index:50;background:var(--bg-elev,#141b27);color:var(--text,#e6edf3);border:1px solid var(--border,#334);border-radius:8px;padding:8px 10px;font:12px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);max-width:300px';
    const by = {}; for (const q of this.items) { const k = q.tipo; by[k] = by[k] || { n: 0, nao: 0 }; by[k].n++; if (!q.ok) by[k].nao++; }
    const tot = this.items.length, nao = this.items.filter((q) => !q.ok).length;
    box.innerHTML = `<div style="font-weight:600;margin-bottom:4px">Ligações no 3D — ${tot} (<span style="color:#16a34a">${tot - nao} OK</span>${nao ? ` · <span style="color:#dc2626">${nao} NÃO</span>` : ''})</div>
      ${Object.entries(by).map(([k, v]) => `<label style="display:flex;gap:6px;align-items:center;margin:2px 0"><input type="checkbox" data-t="${k}" ${this.hidden.has(k) ? '' : 'checked'}><b style="display:inline-block;width:16px;text-align:center">${(TYPE_INFO[k] || ['?'])[0]}</b> ${(TYPE_INFO[k] || [, k])[1]}: ${v.n}${v.nao ? ` <span style="color:#dc2626">(${v.nao} NÃO)</span>` : ''}</label>`).join('')}
      <label style="display:flex;gap:6px;align-items:center;margin:6px 0 2px;border-top:1px solid var(--border,#334);padding-top:6px"><input type="checkbox" id="conn3d-geom" ${this.geomOn ? 'checked' : ''}> Peças (geometria simplificada)</label>
      <div style="display:flex;gap:6px;margin-top:6px">${this.onTable ? '<button id="conn3d-tab" style="flex:1">Tabela</button>' : ''}<button id="conn3d-off" style="flex:1">Ocultar</button></div>
      <div style="opacity:.7;margin-top:4px;font-size:11px">clique num marcador para ver a ligação · peças só para visualização (sem enrijecedores, recortes e arruelas)</div>`;
    (this.vp.container || this.vp._renderer.domElement.parentElement).appendChild(box);
    box.querySelectorAll('[data-t]').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) this.hidden.delete(cb.dataset.t); else this.hidden.add(cb.dataset.t);
      for (const s of this.sprites) s.visible = !this.hidden.has(s.userData.conn.tipo);
      this._geometry();
      this.vp._needsRender = true;
    }));
    box.querySelector('#conn3d-geom').addEventListener('change', (ev) => { this.geomOn = ev.target.checked; this._geometry(); this.vp._needsRender = true; });
    box.querySelector('#conn3d-off').onclick = () => this.clear();
    box.querySelector('#conn3d-tab')?.addEventListener('click', () => this.onTable?.());
  }
  clear(removeLegend = true) {
    for (const s of this.sprites) { this.vp._scene.remove(s); s.material.dispose(); }
    this.sprites = [];
    for (const m of this.meshes) { this.vp._scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.meshes = [];
    if (removeLegend) {
      document.getElementById('conn3d-legend')?.remove();
      const el = this.vp._renderer?.domElement;
      if (el && this._down) { el.removeEventListener('pointerdown', this._down, true); el.removeEventListener('pointerup', this._up, true); }
      this._down = this._up = null;
    }
    this.vp._needsRender = true;
  }
}
