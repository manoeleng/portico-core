// wind_3d.js — interactive 3D view of the wind study (Three.js, orbit with the mouse): the building (walls, gables,
// the two roof slopes) on a grid floor, dimension labels, the wind directions α = 0° and α = 90° and, in 'cp' mode,
// every zone of Tab. 6/7 coloured by its Cp (Cpe or Cpe − Cpi) with the value. PORTICO palette (slate walls,
// steel-blue roof, teal wind). toPNG() gives a snapshot for the printed report.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WALL1 = 0xdbe4ee, WALL2 = 0xb8c6d6, ROOF = 0x5f7fa3, EDGE = 0x1e293b, WIND = 0x0f766e;
const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('pt-BR', { maximumFractionDigits: d });
// Cp colour: suction blue, pressure red (intensity by |Cp|)
function cpColor(cp) {
  const k = Math.min(1, Math.abs(cp) / 1.5), c0 = cp >= 0 ? [254, 242, 242] : [239, 246, 255], c1 = cp >= 0 ? [220, 38, 38] : [29, 78, 216];
  return new THREE.Color(...c0.map((v, i) => (v + (c1[i] - v) * k) / 255));
}
function label(text, color = '#0f172a', size = 44, bg = 'rgba(255,255,255,.85)') {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  ctx.font = `600 ${size}px Segoe UI, Arial`; const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w; c.height = size + 18; ctx.font = `600 ${size}px Segoe UI, Arial`;
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 12, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.userData.aspect = c.width / c.height; sp.renderOrder = 10;
  return sp;
}

/**
 * @param el     container element
 * @param st     windStudy() result
 * @param opts   { mode: 'geo' | 'cp', alpha: 0 | 90, cpi: number | null, width, height }
 */
export function mountWind3D(el, st, opts = {}) {
  const W = opts.width || el.clientWidth || 560, H = opts.height || 360;
  const { a, b, hBeiral: h } = st.inp, hT = st.hTop, span = Math.max(a, b, hT);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W, H); renderer.setClearColor(0xffffff, 1);
  el.innerHTML = ''; el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(-0.6 * span, 1.4 * span, 1.1 * span); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, span * 40);
  cam.position.set(-a * 0.42 - span * 0.15, hT * 2.4 + span * 0.32, -b * 1.5 - span * 0.42);   // windward corner: wall A (z = 0) and gable C (x = 0)
  const ctl = new OrbitControls(cam, renderer.domElement); ctl.target.set(a / 2, hT * 0.4, b / 2); ctl.enableDamping = true; ctl.update();
  // floor: grid + soft shadow
  const grid = new THREE.GridHelper(span * 3, 30, 0xcbd5e1, 0xe2e8f0); grid.position.set(a / 2, 0, b / 2); scene.add(grid);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(a * 1.08, b * 1.08), new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.08 }));
  sh.rotation.x = -Math.PI / 2; sh.position.set(a / 2 + 0.04 * a, 0.01, b / 2 + 0.05 * b); scene.add(sh);
  const grp = new THREE.Group(); scene.add(grp);
  // polygon (planar, convex or the gable pentagon) → mesh + edges
  const poly = (pts, color, val = null) => {
    const g = new THREE.BufferGeometry(), pos = [];
    for (let i = 1; i + 1 < pts.length; i++) pos.push(...pts[0], ...pts[i], ...pts[i + 1]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    grp.add(new THREE.Mesh(g, val != null ? new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })));
    const e = []; for (let i = 0; i < pts.length; i++) e.push(...pts[i], ...pts[(i + 1) % pts.length]);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(e, 3));
    grp.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: EDGE })));
    if (val != null) {
      const c = pts.reduce((s, p) => s.map((v, i) => v + p[i] / pts.length), [0, 0, 0]);
      const n = new THREE.Vector3().fromArray(g.attributes.normal.array, 0);
      const l = label(fmt(val), val >= 0 ? '#b91c1c' : '#1d4ed8', 48); const s = span * 0.055;
      l.scale.set(s * l.userData.aspect, s, 1); l.position.set(c[0] + n.x * 0.3, c[1] + n.y * 0.3, c[2] + n.z * 0.3); scene.add(l);
    }
  };
  const cpMode = opts.mode === 'cp', alpha = opts.alpha ?? 90, cpi = opts.cpi;
  const zv = (z) => { const q = st.zonas.find((x) => x.z === z); if (!q) return 0; return cpi == null ? q.cpe : q.por.find((p) => p.cpi === cpi)?.cp ?? q.cpe; };
  const col = (z, base) => (cpMode ? cpColor(zv(z)) : base), val = (z) => (cpMode ? zv(z) : null);
  // walls: long walls at z = 0 (A side, windward for 90°) and z = b; gables at x = 0 (C, windward for 0°) and x = a
  if (cpMode && alpha === 0) {
    const x0 = st.geo.x0, cuts = [[0, x0, 'A1/B1'], [x0, a / 2, 'A2/B2'], [a / 2, a, 'A3/B3']];
    for (const [x1, x2, z] of cuts) for (const zz of [0, b]) poly([[x1, 0, zz], [x2, 0, zz], [x2, h, zz], [x1, h, zz]], col(z), val(z));
    poly([[0, 0, 0], [0, 0, b], [0, h, b], [0, hT, b / 2], [0, h, 0]], col('C'), val('C'));
    poly([[a, 0, 0], [a, 0, b], [a, h, b], [a, hT, b / 2], [a, h, 0]], col('D'), val('D'));
    for (const [x1, x2, z] of [[0, x0, 'EG'], [x0, a / 2, 'FH'], [a / 2, a, 'IJ']]) {
      poly([[x1, h, 0], [x2, h, 0], [x2, hT, b / 2], [x1, hT, b / 2]], col(z), val(z));
      poly([[x1, hT, b / 2], [x2, hT, b / 2], [x2, h, b], [x1, h, b]], col(z), val(z));
    }
  } else {
    poly([[0, 0, 0], [a, 0, 0], [a, h, 0], [0, h, 0]], col('A', WALL1), val('A'));
    poly([[0, 0, b], [a, 0, b], [a, h, b], [0, h, b]], col('B', WALL1), val('B'));
    if (cpMode) {
      const c1 = st.geo.xC1, ridge = (z) => (z <= b / 2 ? h + (hT - h) * z / (b / 2) : h + (hT - h) * (b - z) / (b / 2));
      for (const xx of [0, a]) {
        poly([[xx, 0, 0], [xx, 0, c1], [xx, ridge(c1), c1], [xx, h, 0]], col('C1/D1'), val('C1/D1'));
        poly([[xx, 0, c1], [xx, 0, b], [xx, h, b], ...(c1 < b / 2 ? [[xx, hT, b / 2]] : []), [xx, ridge(c1), c1]], col('C2/D2'), val('C2/D2'));
      }
    } else for (const xx of [0, a]) poly([[xx, 0, 0], [xx, 0, b], [xx, h, b], [xx, hT, b / 2], [xx, h, 0]], WALL2);
    poly([[0, h, 0], [a, h, 0], [a, hT, b / 2], [0, hT, b / 2]], col('EFI', ROOF), val('EFI'));
    poly([[0, hT, b / 2], [a, hT, b / 2], [a, h, b], [0, h, b]], col('GHJ', ROOF), val('GHJ'));
  }
  // dimension labels
  const dimLbl = (txt, p) => { const l = label(txt, '#334155', 44); const s = span * 0.05; l.scale.set(s * l.userData.aspect, s, 1); l.position.set(...p); scene.add(l); };
  dimLbl(`a = ${fmt(a)} m`, [a / 2, 0.02, -span * 0.12]); dimLbl(`b = ${fmt(b)} m`, [-span * 0.12, 0.02, b / 2]);
  dimLbl(`H = ${fmt(h)} m`, [a + span * 0.05, h / 2, 0]); dimLbl(`${fmt(hT)} m (topo)`, [-span * 0.04, hT + span * 0.03, b / 2]);
  // wind arrows (teal) α = 0° along +x onto the gable x = 0, α = 90° along +z onto the wall z = 0
  const arrow = (dir, origin, txt, show) => {
    if (!show) return;
    const L = span * 0.35, ar = new THREE.ArrowHelper(new THREE.Vector3(...dir).normalize(), new THREE.Vector3(...origin), L, WIND, L * 0.22, L * 0.12); scene.add(ar);
    const l = label(txt, '#0f766e', 42, null); const s = span * 0.045; l.scale.set(s * l.userData.aspect, s, 1);
    l.position.set(origin[0] + dir[0] * L * 0.4, origin[1] + span * 0.06, origin[2] + dir[2] * L * 0.4); scene.add(l);
  };
  arrow([1, 0, 0], [-span * 0.45, h * 0.6, b / 2], 'α = 0°', !cpMode || alpha === 0);
  arrow([0, 0, 1], [a / 2, h * 0.6, -span * 0.45], 'α = 90°', !cpMode || alpha === 90);
  let alive = true;
  const loop = () => { if (!alive || !el.isConnected) { renderer.dispose(); return; } ctl.update(); renderer.render(scene, cam); requestAnimationFrame(loop); };
  loop();
  return {
    toPNG() { renderer.render(scene, cam); return renderer.domElement.toDataURL('image/png'); },
    dispose() { alive = false; renderer.dispose(); },
  };
}
