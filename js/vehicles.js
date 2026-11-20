// Vehicle line-up: real-world figures (mass, power/torque curve, gearing, top speed, drivetrain, size)
// plus the licensed 3D models and how to dress them (paint, lights, glass, wheels, cockpit camera).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { buildBike } from './bike.js';

// electric motor: constant torque up to base speed, then constant power
const evCurve = (tMax, pKW, maxRpm) => { const out = []; for (let r = 0; r <= maxRpm + 400; r += 400) { const w = Math.max(1, r * Math.PI / 30); out.push([r, Math.min(tMax, pKW * 1000 / w)]); } return out; };

export const VEHICLES = {
  f458: {
    name: 'Ferrari 458 Spider', short: '458', info: '4.5 V8 · 570 PS · 540 Nm · 7 ileri · arkadan itiş',
    builtin: true, sound: { cyl: 8, kind: 'v8' }, credit: 'Ferrari 458 Italia: vicent091036 (three.js örnekleri)',
    spec: { mass: 1505, inertia: 2550, a: 1.42, b: 1.24, cgH: 0.44, r: 0.345,
      gears: [3.08, 2.19, 1.63, 1.29, 1.03, 0.84, 0.69], reverse: 2.9, final: 4.44, idle: 1000, redline: 9000, shiftUp: 8600, shiftDown: 4300, shiftTime: 0.09,
      tq: [[0, 250], [1000, 300], [2000, 380], [3000, 450], [4000, 495], [5000, 525], [6000, 540], [7000, 532], [8000, 500], [9000, 445], [9400, 300]],
      drag: 0.33, downforce: 0.45, brakeForce: 32000, drive: 'rwd', hl: 2.26, hw: 0.95 },
  },
  f40: {
    name: 'Ferrari F40', short: 'F40', info: '2.9 çift turbo V8 · 478 PS · 577 Nm · 5 ileri · arkadan itiş',
    file: 'assets/cars/f40.glb', length: 4.358, front: '+z', sound: { cyl: 8, kind: 'turbo' },
    credit: 'Ferrari F40: Black Snow (Sketchfab, CC-BY-4.0)',
    spec: { mass: 1255, inertia: 2050, a: 1.42, b: 1.03, cgH: 0.42, r: 0.33,
      gears: [2.769, 1.947, 1.512, 1.2, 0.966], reverse: 2.7, final: 3.08, idle: 1000, redline: 7750, shiftUp: 7400, shiftDown: 3800, shiftTime: 0.22,
      tq: [[0, 170], [1500, 230], [2500, 300], [3200, 420], [3800, 540], [4000, 577], [5000, 565], [6000, 545], [7000, 505], [7750, 450], [8100, 300]],
      drag: 0.30, downforce: 0.3, brakeForce: 26000, drive: 'rwd', grip: 0.97, hl: 2.18, hw: 0.97 },
    mats: { paint: ['material'], tail: ['super_brakelight'], head: ['super_headlight', 'F40_Headlights'], glass: ['F40_Glass', 'F40_Glass.001', 'F40_Window', 'F40_Window.001'] },
    wheelMats: /Rrims|Brake|Scene_-_Root\.002/i,
    cam: { cockpit: [-0.12, 1.0, -0.36], look: [6, 0.82, -0.36], hood: [0.55, 1.12, 0], mirror: [0.3, 1.02, 0] },
    mirrors: { in: { c: [0.386, 1.009, -0.005], n: [-1, -0.07, 0], w: 0.18, h: 0.045 }, L: { c: [0.718, 0.791, -0.932], n: [-0.9, 0, 0.44], w: 0.12, h: 0.06 } },
    sw: { c: [0.585, 0.70, -0.33], n: [-0.84, 0.54, 0], r: 0.19, t: 0.05 },
    dash: [{ c: [0.787, 0.749, -0.364], n: [-1, 0, 0], w: 0.085, h: 0.085, kind: 'tach', max: 10000 }, { c: [0.787, 0.749, -0.272], n: [-1, 0, 0], w: 0.085, h: 0.085, kind: 'speedo', max: 360 }],
    exhaust: { y: 0.36, z: [-0.07, 0, 0.07] },
    tailDiscs: [{ c: [-1.889, 0.648, -0.528], n: [-1, -0.03, -0.07], r: 0.08 }], darken: ['F40_GridD', 'F40_Grid', 'F40_Vehiclelight'],
  },
  model3: {
    name: 'Tesla Model 3 Performance', short: 'Model 3', info: 'Elektrik · 2 motor · 460 PS · 660 Nm · dört çeker',
    file: 'assets/cars/model3.glb', length: 4.694, front: '+z', sound: { kind: 'ev' },
    credit: 'Tesla Model 3: David_Holiday (Sketchfab, CC-BY-4.0)',
    spec: { mass: 1919, inertia: 3300, a: 1.5, b: 1.375, cgH: 0.5, r: 0.341, ev: true,
      gears: [9.04], reverse: 9.04, final: 1, idle: 0, redline: 18400, shiftUp: 99999, shiftDown: 0, eff: 0.92,
      tq: evCurve(660, 340, 18400), drag: 0.306, downforce: 0.1, brakeForce: 30000, drive: 'awd', awdFront: 0.4, vmax: 261, regen: 120, grip: 0.92, hl: 2.33, hw: 0.92 },
    mats: { paint: ['CAR_PAINT'], tail: ['Material.002'], head: ['Glass'], glass: ['Material.017', 'Material.016'] }, darken: ['Material.007'],
    lightBoxes: [{ mat: 'Material.005', min: [-9, 0.6, 0.2], max: [-1.9, 1.2, 0.95], as: 'tail' }],
    wheelMats: null,
    cam: { cockpit: [-0.15, 1.22, -0.37], look: [6, 1.04, -0.37], hood: [0.9, 1.35, 0], mirror: [0.55, 1.3, 0] },
    mirrors: { in: { c: [0.62, 1.335, 0.0], n: [-0.99, -0.05, -0.12], w: 0.22, h: 0.055, housing: true }, L: { c: [0.52, 1.005, -0.952], n: [-0.89, 0, 0.46], w: 0.14, h: 0.085 } },
    sw: { c: [0.47, 0.93, -0.37], n: [-0.92, 0.4, 0], r: 0.2, t: 0.05 },
    dash: [{ c: [0.655, 0.975, -0.01], n: [-0.97, 0.23, 0], w: 0.3, h: 0.18, kind: 'tesla' }],
  },
  e2008: {
    name: 'Peugeot e-2008', short: 'e-2008', info: 'Elektrik · 136 PS · 260 Nm · önden çekiş · 150 km/sa',
    file: 'assets/cars/e2008.glb', length: 4.3, front: '+z', sound: { kind: 'ev' },
    credit: 'Peugeot e-2008: David_Holiday (Sketchfab, CC-BY-4.0)',
    spec: { mass: 1623, inertia: 2700, a: 1.04, b: 1.565, cgH: 0.58, r: 0.334, ev: true,
      gears: [8.6], reverse: 8.6, final: 1, idle: 0, redline: 10500, shiftUp: 99999, shiftDown: 0, eff: 0.92,
      tq: evCurve(260, 100, 10500), drag: 0.475, downforce: 0, brakeForce: 24000, drive: 'fwd', vmax: 150, regen: 70, grip: 0.82, hl: 2.13, hw: 0.88 },
    lightBoxes: [{ mat: '2020_Peugeot_e-2008_black', min: [-9, 0.98, 0.42], max: [-1.75, 1.2, 0.8], as: 'tail' }, { mat: '2020_Peugeot_e-2008_black', min: [1.6, 0.78, 0.5], max: [9, 0.95, 0.8], as: 'head' }],
    mats: { paint: ['Bianca_White'], tail: [], head: ['2020_Peugeot_e-2008_vehicle_generic_smallspecmap_7'], glass: ['2020_Peugeot_e-2008_glass_clear', '2020_Peugeot_e-2008_vitres_exterieur'] },
    wheelMats: /wheel_tire_01_dm|wheel_black/,
    cam: { cockpit: [-0.1, 1.27, -0.37], look: [6, 1.07, -0.37], hood: [0.9, 1.45, 0], mirror: [0.55, 1.3, 0] },
    mirrors: { in: { c: [0.528, 1.282, 0.003], n: [-0.99, -0.08, -0.12], w: 0.2, h: 0.05 }, L: { c: [0.576, 1.078, -0.866], n: [-0.92, 0, 0.4], w: 0.15, h: 0.095 } },
    sw: { c: [0.40, 0.985, -0.37], n: [-0.85, 0.53, 0], r: 0.19, t: 0.05 },
    dash: [{ c: [0.73, 1.048, -0.343], n: [-0.95, 0.3, 0], w: 0.16, h: 0.06, kind: 'peugeot' }],
  },
};
VEHICLES.rr1000 = {
  name: 'Süper Spor 1000 RR', short: 'RR 1000', info: 'Motosiklet · 999 cc sıralı 4 · 210 PS · 113 Nm · 6 ileri · 197 kg',
  proc: 'bike', sound: { cyl: 4, kind: 'i4' }, credit: 'Süper Spor 1000 RR: Turbo Pist için özel tasarım',
  spec: { mass: 272, inertia: 300, muRear: 1.6, Bf: 9, a: 0.70, b: 0.757, cgH: 0.62, r: 0.32, track: 0,
    gears: [2.647, 2.091, 1.727, 1.5, 1.36, 1.261], reverse: 2.647, final: 4.373, eff: 0.9, idle: 1300, redline: 14600, shiftUp: 14200, shiftDown: 8200, shiftTime: 0.05,
    tq: [[0, 40], [2000, 55], [4000, 72], [6000, 85], [8000, 98], [10000, 110], [11000, 113], [12000, 112], [13500, 109], [14600, 100], [15000, 60]],
    drag: 0.19, roll: 3, downforce: 0.03, brakeForce: 3300, brakeBias: 0.78, drive: 'rwd', vmax: 303, grip: 1.05, hl: 1.05, hw: 0.35 },
};
export const VEHICLE_IDS = Object.keys(VEHICLES);

// ---------- loading & preparing a model once per vehicle type ----------
const cache = {};
let loader = null;
function getLoader() { if (loader) return loader; const d = new DRACOLoader(); d.setDecoderPath(window.DRACO_PATH || 'https://unpkg.com/three@0.187.0/examples/jsm/libs/draco/gltf/'); loader = new GLTFLoader(); loader.setDRACOLoader(d); return loader; }
export function _tpl(id){ return cache[id] && cache[id].tpl; }
export function vehicleReady(id) { const V = VEHICLES[id]; return !!V && (V.builtin || V.proc || !!(cache[id] && cache[id].tpl)); }
export function loadVehicle(id) {
  const V = VEHICLES[id]; if (!V || V.builtin || V.proc) return Promise.resolve(true);
  if (cache[id]) return cache[id].p;
  const c = cache[id] = {}; c.p = getLoader().loadAsync(V.file).then(g => { c.tpl = prepare(V, g.scene); return true; }).catch(e => { console.warn('araç yüklenemedi', id, e); delete cache[id]; return false; });
  return c.p;
}

// bake every mesh into the car frame (+X forward, +Y up, +Z right, ground at y=0, axle midpoint at x=0)
// and split wheels into four pivots so they can roll and steer
function prepare(V, scene) {
  const holder = new THREE.Group(); holder.add(scene);
  holder.rotation.y = V.front === '+z' ? Math.PI / 2 : -Math.PI / 2;
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder); const size = box.getSize(new THREE.Vector3());
  const s = V.length / size.x;
  const parts = [];
  const named = o => { let n = o; while (n) { if (/wheel|tyre|tire|rim|roue|^cal/i.test(n.name || '')) return true; n = n.parent; } return false; };
  scene.traverse(o => { if (!o.isMesh) return; let geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.scale(s, s, s); if (geo.index) geo = geo.toNonIndexed();
    const mn = o.material.name || ''; parts.push({ geo, mat: o.material, named: named(o), bymat: !!(V.wheelMats && V.wheelMats.test(mn)) }); });
  // ground + centre
  const all = new THREE.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); all.union(p.geo.boundingBox); }
  const cx = (all.min.x + all.max.x) / 2, cz = (all.min.z + all.max.z) / 2, gy = all.min.y;
  for (const p of parts) p.geo.translate(-cx, -gy, -cz);
  // split triangles of a geometry by a classifier -> {key: geometry}
  const splitTris = (g, cls) => { const pos = g.attributes.position, out = {};
    for (let t = 0; t < pos.count; t += 3) { const k = cls((pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3, (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3, (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3); (out[k] ??= []).push(t); }
    const res = {}; for (const [k, tris] of Object.entries(out)) { const ng = new THREE.BufferGeometry();
      for (const name of Object.keys(g.attributes)) { const a = g.attributes[name], arr = new a.array.constructor(tris.length * 3 * a.itemSize); let i = 0; for (const t of tris) for (let v = 0; v < 3; v++) for (let c = 0; c < a.itemSize; c++) arr[i++] = a.array[(t + v) * a.itemSize + c]; ng.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized)); }
      res[k] = ng; } return res; };
  const quad = (x, y, z) => (x > 0 ? 0 : 2) + (z > 0 ? 1 : 0);
  const wheelParts = [[], [], [], []]; const body = [];
  // 1) parts whose node says "wheel": split by quadrant
  const hasNamed = parts.some(p => p.named);
  for (const p of parts) if (p.named || (!hasNamed && p.bymat)) { for (const [k, g] of Object.entries(splitTris(p.geo, quad))) wheelParts[+k].push({ geo: g, mat: p.mat }); p.used = true; }
  // provisional wheel circles
  const circ = wheelParts.map(list => { const b = new THREE.Box3(); for (const p of list) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); } return b.isEmpty() ? null : { c: b.getCenter(new THREE.Vector3()), r: (b.max.y - b.min.y) / 2 }; });
  // 2) parts picked by material (tyres/rims merged with other bits): only triangles inside a wheel circle
  for (const p of parts) { if (p.used) continue;
    if (p.bymat && circ.every(c => c)) { const parts2 = splitTris(p.geo, (x, y, z) => { for (let q = 0; q < 4; q++) { const c = circ[q]; if (Math.hypot(x - c.c.x, y - c.c.y) < c.r * 1.08 && Math.abs(z - c.c.z) < 0.22) return q; } return 'b'; });
      for (const [k, g] of Object.entries(parts2)) { if (k === 'b') body.push({ geo: g, mat: p.mat }); else wheelParts[+k].push({ geo: g, mat: p.mat }); } }
    else body.push(p); }
  // wheel centres from the rolling parts' bounds; axle positions define the car's x origin
  const wheels = wheelParts.map(list => { const b = new THREE.Box3(); for (const p of list) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); } const c = b.isEmpty() ? null : b.getCenter(new THREE.Vector3()); if (c) c.y = (b.max.y - b.min.y) / 2 + b.min.y; return { c, list, r: b.isEmpty() ? 0.33 : (b.max.y - b.min.y) / 2 }; });
  const fx = wheels[0].c && wheels[1].c ? (wheels[0].c.x + wheels[1].c.x) / 2 : 1.35, rx = wheels[2].c && wheels[3].c ? (wheels[2].c.x + wheels[3].c.x) / 2 : -1.35;
  const mid = (fx + rx) / 2;
  for (const p of body) p.geo.translate(-mid, 0, 0);
  for (const w of wheels) { if (!w.c) continue; w.c.x -= mid; for (const p of w.list) { p.geo.translate(-mid, 0, 0); p.geo.translate(-w.c.x, -w.c.y, -w.c.z); } }
  // light lenses that share a material with trim: carve them out by region
  for (const lb of V.lightBoxes || []) for (let i = body.length - 1; i >= 0; i--) { const p = body[i]; if ((p.mat.name || '') !== lb.mat || p.role) continue;
    const sp = splitTris(p.geo, (x, y, z) => { const zz = Math.abs(z); return (x >= lb.min[0] && x <= lb.max[0] && y >= lb.min[1] && y <= lb.max[1] && zz >= lb.min[2] && zz <= lb.max[2]) ? 'l' : 'o'; });
    if (sp.l) { body.splice(i, 1); body.push({ geo: sp.l, mat: p.mat, role: lb.as }); if (sp.o) body.push({ geo: sp.o, mat: p.mat }); } }
  // steering wheel: triangles within a disc around the column axis become their own pivot
  let swParts = null; if (V.sw) { const c0 = new THREE.Vector3(...V.sw.c), ax = new THREE.Vector3(...V.sw.n).normalize(); swParts = [];
    for (let i = body.length - 1; i >= 0; i--) { const p = body[i]; const sp = splitTris(p.geo, (x, y, z) => { const d = new THREE.Vector3(x, y, z).sub(c0); const a = d.dot(ax); const r = d.addScaledVector(ax, -a).length(); return (Math.abs(a) < V.sw.t && r < V.sw.r) ? 's' : 'b'; });
      if (sp.s) { for (const g of [sp.s]) { g.translate(-c0.x, -c0.y, -c0.z); swParts.push({ geo: g, mat: p.mat }); } if (sp.b) body[i] = { geo: sp.b, mat: p.mat }; else body.splice(i, 1); } } }
  // tame glossy/metallic interior & trim materials (they glow gold in the sun otherwise)
  const seen = new Map(); const fix = (p, wheel) => { const m = p.mat; if (!m || !m.isMeshStandardMaterial) return; if (seen.has(m)) { p.mat = seen.get(m); return; }
    const lum0 = m.color ? (m.color.r + m.color.g + m.color.b) / 3 : 1; const chrome0 = /chrom|metal|rim|cerchi/i.test(m.name || '');
    if (!wheel && !chrome0 && !m.transparent && !m.map && !(V.mats && V.mats.paint && V.mats.paint.includes(m.name))) { // dark trim/interior: matte, no sun glare (it turned the cabins olive/gold)
      const l = new THREE.MeshLambertMaterial({ color: m.color, side: m.side, name: m.name }); seen.set(m, l); p.mat = l; return; }
    const n = m.clone(); const lum = n.color ? (n.color.r + n.color.g + n.color.b) / 3 : 1; const chrome = /chrom|metal|rim|cerchi/i.test(m.name || '');
    if (!chrome) { n.metalness = Math.min(n.metalness, 0.1); n.roughness = Math.max(n.roughness, lum < 0.5 ? 0.6 : 0.4); }
    n.envMapIntensity = chrome ? 1 : 0.35; seen.set(m, n); p.mat = n; };
  for (const p of body) fix(p); for (const w of wheels) for (const p of w.list) fix(p, true); if (swParts) for (const p of swParts) fix(p);
  return { body, wheels, sw: swParts, wb: fx - rx, len: all.max.x - all.min.x, rearX: all.min.x - cx - mid };
}

const shadowTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.filter = 'blur(7px)'; g.fillStyle = 'rgba(0,0,0,.8)'; g.beginPath(); g.roundRect(16, 12, 96, 40, 14); g.fill(); t = new THREE.CanvasTexture(c); return t; }; })();

// one drivable instance with its own paint / light materials
export function buildVehicle(id, color) {
  const V = VEHICLES[id]; if (V && V.proc === 'bike') return buildBike(color);
  const T = cache[id] && cache[id].tpl; if (!T) return null;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.25, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff0800, emissiveIntensity: 0.6, roughness: 0.15, toneMapped: false });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, emissive: 0xfff1d6, emissiveIntensity: 0.15, roughness: 0.05, metalness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0e1216, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.45, envMapIntensity: 1.5, clearcoat: 1 });
  const M = V.mats || {}; const has = (list, n) => list && list.includes(n);
  const darkM = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.85, metalness: 0 });
  const pick = mat => { const n = mat.name || ''; if (V.darken && V.darken.includes(n)) return darkM; if (has(M.paint, n)) return paint; if (has(M.tail, n)) return brakeMat; if (has(M.head, n)) return headMat; if (has(M.glass, n)) return glass; return mat; };
  const envMats = new Set([paint, glass]);
  for (const p of T.body) { const m = new THREE.Mesh(p.geo, p.role === 'tail' ? brakeMat : p.role === 'head' ? headMat : pick(p.mat)); m.castShadow = m.material !== glass; m.receiveShadow = true; body.add(m); }
  const unsprung = new THREE.Group(); root.add(unsprung);
  const pivots = T.wheels.map((w, i) => { const steerG = new THREE.Group(), spin = new THREE.Group(); steerG.add(spin); if (w.c) steerG.position.copy(w.c); unsprung.add(steerG);
    for (const p of w.list) { const m = new THREE.Mesh(p.geo, pick(p.mat)); m.castShadow = true; spin.add(m); } return { steerG, spin, front: i < 2 }; });
  let swG = null, swAxis = null; if (T.sw && T.sw.length) { swG = new THREE.Group(); swG.position.set(...V.sw.c); swAxis = new THREE.Vector3(...V.sw.n).normalize(); const inner = new THREE.Group(); swG.add(inner); for (const p of T.sw) inner.add(new THREE.Mesh(p.geo, pick(p.mat))); body.add(swG); swG.userData.inner = inner; }
  const flames = []; if (V.exhaust) { const fm = new THREE.MeshBasicMaterial({ color: 0x66b3ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const z of V.exhaust.z) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.55, 10).rotateZ(Math.PI / 2), fm); f.position.set(T.rearX - 0.22, V.exhaust.y, z); f.visible = false; body.add(f); flames.push(f); } }
  for (const td of V.tailDiscs || []) for (const s of [1, -1]) { const n = new THREE.Vector3(td.n[0], td.n[1], td.n[2] * s).normalize(); const d = new THREE.Mesh(new THREE.CircleGeometry(td.r, 28), brakeMat);
    d.position.set(td.c[0], td.c[1], td.c[2] * s).addScaledVector(n, 0.012); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); body.add(d); }
  const dash = (V.dash || []).map(d => { const cv = document.createElement('canvas'); cv.width = Math.round(256 * Math.max(1, d.w / d.h)); cv.height = Math.round(cv.width * d.h / d.w); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const geo = d.kind === 'tach' || d.kind === 'speedo' ? new THREE.CircleGeometry(d.w / 2, 40) : new THREE.PlaneGeometry(d.w, d.h); const n = new THREE.Vector3(...d.n).normalize(); const u = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).normalize(), w = new THREE.Vector3().crossVectors(n, u);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, w, n)); mesh.position.set(...d.c).addScaledVector(n, 0.003); body.add(mesh);
    return { d, cv, g: cv.getContext('2d'), tex }; });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(T.len + 0.5, 2.3), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; sh.renderOrder = 2; unsprung.add(sh);
  const cam = V.cam || {};
  const tq = new THREE.Quaternion();
  return { root, body, paint, brakeMat, headMat, flames, wheels: [], mirrorDefs: V.mirrors, drawDash: dash.length ? (rpm, kmh, gear, nitro) => { for (const D of dash) drawDash(D, rpm, kmh, gear, nitro); } : null, pivots: [], steer: new THREE.Object3D(), interior: new THREE.Group(), lowerMesh: null, origPos: null, color, vid: id,
    gauge: { canvas: null, tex: {}, ctx: null },
    setEnvMap(t) { for (const m of envMats) { m.envMap = t; m.needsUpdate = true; } },
    cockpit: cam.cockpit, cockpitLook: cam.look, hood: cam.hood, mirror: cam.mirror,
    setPose(steer, ang) { pivots.forEach((p, i) => { if (p.front) p.steerG.rotation.y = -steer; p.spin.rotation.z = -ang[i]; });
      if (swG) { tq.setFromAxisAngle(swAxis, steer * 7); swG.userData.inner.quaternion.copy(tq); } } };
}

// live instrument faces drawn on canvases laid over the model's own dials / screens
function drawDash(D, rpm, kmh, gear, nitro) {
  const { d, cv, g } = D, W = cv.width, H = cv.height;
  if (d.kind === 'tach' || d.kind === 'speedo') { const c = W / 2, R = c - 4; const val = d.kind === 'tach' ? rpm : kmh, max = d.max;
    g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, W, H); g.strokeStyle = '#bbb'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, R, 0, 7); g.stroke();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, A = v => a0 + (a1 - a0) * Math.min(1, v / max); const step = d.kind === 'tach' ? 1000 : 20, big = d.kind === 'tach' ? 1000 : 40;
    for (let v = 0; v <= max; v += step) { const a = A(v), r0 = R - (v % big === 0 ? 26 : 16); g.strokeStyle = d.kind === 'tach' && v >= 7750 ? '#e33' : '#eee'; g.lineWidth = v % big === 0 ? 5 : 2; g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * (R - 6), c + Math.sin(a) * (R - 6)); g.stroke();
      if (v % big === 0) { g.fillStyle = '#eee'; g.font = 'bold 24px Inter,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.kind === 'tach' ? v / 1000 : v, c + Math.cos(a) * (R - 48), c + Math.sin(a) * (R - 48)); } }
    g.fillStyle = '#ddd'; g.font = 'bold 15px Inter,sans-serif'; g.fillText(d.kind === 'tach' ? 'RPM x1000' : 'km/h', c, c + 52);
    g.save(); g.translate(c, c); g.rotate(A(val)); g.fillStyle = '#ff7a10'; g.beginPath(); g.moveTo(-14, -4); g.lineTo(R - 18, -1.5); g.lineTo(R - 18, 1.5); g.lineTo(-14, 4); g.fill(); g.restore();
    g.fillStyle = '#222'; g.beginPath(); g.arc(c, c, 14, 0, 7); g.fill(); D.tex.needsUpdate = true; return; }
  if (d.kind === 'tesla') { g.fillStyle = '#f3f4f6'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.font = `800 ${H * 0.34 | 0}px Inter,sans-serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(String(kmh), W * 0.06, H * 0.42);
    g.font = `600 ${H * 0.08 | 0}px Inter,sans-serif`; g.fillStyle = '#666'; g.fillText('km/h', W * 0.06, H * 0.52);
    ['P', 'R', 'N', 'D'].forEach((k, i) => { g.fillStyle = k === gear ? '#111' : '#bbb'; g.font = `700 ${H * 0.09 | 0}px Inter,sans-serif`; g.fillText(k, W * 0.06 + i * W * 0.045, H * 0.66); });
    // simple car-and-road visualisation
    g.fillStyle = '#d9dce1'; g.beginPath(); g.moveTo(W * 0.42, H); g.lineTo(W * 0.6, H * 0.12); g.lineTo(W * 0.66, H * 0.12); g.lineTo(W * 0.98, H); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.setLineDash([12, 12]); g.lineDashOffset = -(performance.now() / 1000 * kmh) % 24; g.beginPath(); g.moveTo(W * 0.7, H); g.lineTo(W * 0.63, H * 0.12); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#9aa0a8'; g.beginPath(); g.roundRect(W * 0.6, H * 0.62, W * 0.12, H * 0.28, 10); g.fill();
    g.fillStyle = '#3b82f6'; g.fillRect(W * 0.06, H * 0.78, W * 0.3 * 0.82, H * 0.035); g.strokeStyle = '#999'; g.lineWidth = 2; g.strokeRect(W * 0.06, H * 0.78, W * 0.3, H * 0.035);
    g.fillStyle = '#444'; g.font = `600 ${H * 0.06 | 0}px Inter,sans-serif`; g.fillText('82%  ·  402 km', W * 0.06, H * 0.9); D.tex.needsUpdate = true; return; }
  if (d.kind === 'peugeot') { g.fillStyle = '#06080c'; g.fillRect(0, 0, W, H); const pw = Math.max(-0.3, Math.min(1, rpm / 10500));
    g.strokeStyle = '#1a2a3a'; g.lineWidth = H * 0.1; g.beginPath(); g.arc(W * 0.22, H * 0.62, H * 0.38, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
    g.strokeStyle = '#2ec4ff'; g.beginPath(); g.arc(W * 0.22, H * 0.62, H * 0.38, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * pw)); g.stroke();
    g.fillStyle = '#fff'; g.font = `800 ${H * 0.42 | 0}px Inter,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(kmh), W * 0.5, H * 0.5);
    g.font = `600 ${H * 0.13 | 0}px Inter,sans-serif`; g.fillStyle = '#8fa3b8'; g.fillText('km/h', W * 0.5, H * 0.85); g.fillStyle = '#2ec4ff'; g.font = `800 ${H * 0.26 | 0}px Inter,sans-serif`; g.fillText(gear, W * 0.82, H * 0.5);
    D.tex.needsUpdate = true; }
}
