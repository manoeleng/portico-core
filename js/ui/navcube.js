// navcube.js — NavCube (view cube) of the 3D viewport: a small cube in the top-right corner that turns with the
// camera; clicking a FACE, an EDGE or a CORNER turns the camera to look from that side (kept target and distance,
// short animation). Faces in MODEL axes (Z up): Topo +Z, Base −Z, Frente −Y (the X–Z elevation seen from −Y),
// Fundos +Y, Direita +X, Esquerda −X. Hidden in 2D projects and in 2D elevations.
// Three.js space = model with y ↔ z swapped (viewport.m2t): model +Z is three +y, model +Y is three +z.
import * as THREE from 'three';
import { i18n } from '../i18n/i18n.js?v=7';

const SIZE = 140;                    // px

export class NavCube {
  constructor(vp) {
    this.vp = vp;
    const host = vp.container.parentElement || vp.container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'navcube';
    this.canvas.title = i18n.t('Cubo de navegación: clic en una cara, arista o vértice para ver desde ese lado');
    Object.assign(this.canvas.style, { position: 'absolute', right: '10px', top: '70px', width: SIZE + 'px', height: SIZE + 'px',
      zIndex: 5, cursor: 'pointer' });
    host.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(SIZE, SIZE, false);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dl = new THREE.DirectionalLight(0xffffff, 0.5); dl.position.set(2, 3, 4); this.scene.add(dl);
    this.cam = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 10);   // room for the axis tags
    this._hover = null;
    this._build();
    this._ray = new THREE.Raycaster();
    this.canvas.addEventListener('pointermove', (e) => this._onMove(e));
    this.canvas.addEventListener('pointerleave', () => this._setHover(null));
    this.canvas.addEventListener('click', (e) => this._onClick(e));
    // the cube must not start an orbit/selection of the main viewport
    for (const ev of ['pointerdown', 'mousedown', 'wheel', 'contextmenu']) this.canvas.addEventListener(ev, (e) => e.stopPropagation());
  }

  // text sprite for the axis tips ("+X" …)
  _tag(text, color) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = color; g.font = 'bold 48px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    sp.scale.set(0.8, 0.4, 1);
    return sp;
  }

  // SkyCiv-like look (reference images of the user, 15/10/2026): light grey see-through cube with DASHED edges, no
  // face labels, and the global axes from the centre through the faces with a round tip and a "+X/+Y/+Z" tag —
  // X red, Y green, Z blue, in MODEL axes (Z up; three: model Y is +z, model Z is +y).
  _build() {
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xbfc5ce, transparent: true, opacity: 0.7, depthWrite: false }));
    this.scene.add(this.cube);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(this.cube.geometry),
      new THREE.LineDashedMaterial({ color: 0x3f4753, dashSize: 0.1, gapSize: 0.06 }));
    edges.computeLineDistances();
    this.cube.add(edges);
    // hover marker: translucent box on the face / edge / corner under the mouse
    this._mark = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.45, depthTest: false }));
    this._mark.visible = false; this.scene.add(this._mark);
    // axes: centre → beyond the face, round tip, tag
    for (const [d, col, css, txt] of [[[1, 0, 0], 0xdc2626, '#dc2626', '+X'], [[0, 0, 1], 0x16a34a, '#16a34a', '+Y'], [[0, 1, 0], 0x2563eb, '#2563eb', '+Z']]) {
      const v = new THREE.Vector3(...d), tip = v.clone().multiplyScalar(1.12);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), tip]),
        new THREE.LineBasicMaterial({ color: col, depthTest: false }));
      line.renderOrder = 2; this.scene.add(line);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: col, depthTest: false }));
      dot.position.copy(tip); dot.renderOrder = 2; this.scene.add(dot);
      const tag = this._tag(txt, css); tag.position.copy(v.clone().multiplyScalar(1.42)); tag.renderOrder = 3; this.scene.add(tag);
    }
  }

  // direction (three space, from the target to the eye) of the face / edge / corner at a local hit point
  _dirAt(p) {
    const t = 0.45;                                               // half size 0,6: outer 12,5 % band = edge / corner
    const d = [p.x, p.y, p.z].map((c) => (Math.abs(c) > t ? Math.sign(c) : 0));
    // the face actually hit always counts
    const k = [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)].reduce((b, v, i, a) => (v > a[b] ? i : b), 0);
    d[k] = Math.sign([p.x, p.y, p.z][k]) || 1;
    return new THREE.Vector3(...d);
  }

  _pick(e) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(ndc, this.cam);
    const hit = this._ray.intersectObject(this.cube, false)[0];
    return hit ? this._dirAt(this.cube.worldToLocal(hit.point.clone())) : null;
  }

  _setHover(d) {
    this._hover = d;
    if (!d) { this._mark.visible = false; return; }
    const s = (c) => (c ? 0.34 : 1.24);                          // thin along the picked axes, full across the others
    this._mark.scale.set(s(d.x), s(d.y), s(d.z));
    this._mark.position.set(d.x * 0.45, d.y * 0.45, d.z * 0.45);
    this._mark.visible = true;
  }

  _onMove(e) { this._setHover(this._pick(e)); }

  _onClick(e) {
    const d = this._pick(e);
    if (d) this.lookFrom(d.normalize());
  }

  /** turns the main camera to look at its target from direction `dir` (three space, target → eye), animated. */
  lookFrom(dir) {
    const vp = this.vp, cam = vp._camera, ctl = vp._controls, tgt = ctl.target.clone();
    const dist = cam.position.distanceTo(tgt) || 10;
    const from = cam.position.clone().sub(tgt).normalize(), to = dir.clone().normalize();
    // the orbit controls keep three +y (model Z) as "up": a top / bottom view is nudged a hair off the pole, towards
    // three −z, so that the screen top is model +Y (plan view as drawn on paper)
    if (Math.abs(to.y) > 0.999) to.set(0, Math.sign(to.y), -1e-3).normalize();
    const q1 = new THREE.Quaternion().setFromUnitVectors(from, to), q0 = new THREE.Quaternion();
    const t0 = performance.now(), T = 320;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / T), e2 = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const q = q0.clone().slerp(q1, e2);
      cam.position.copy(tgt).add(from.clone().applyQuaternion(q).multiplyScalar(dist));
      cam.up.set(0, 1, 0); cam.lookAt(tgt); ctl.update();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** called every frame by the viewport */
  render() {
    const vp = this.vp;
    const hide = vp.app?.model?.mode === '2D' || !!vp._elevation;
    this.canvas.style.display = hide ? 'none' : '';
    if (hide) return;
    const cam = vp._camera, tgt = vp._controls.target;
    const dir = cam.position.clone().sub(tgt).normalize();
    this.cam.position.copy(dir.multiplyScalar(4));
    this.cam.up.copy(cam.up);
    this.cam.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.cam);
  }
}
