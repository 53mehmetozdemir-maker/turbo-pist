// Vehicle line-up: real-world figures (mass, power/torque curve, gearing, top speed, drivetrain, size)
// plus the licensed 3D models and how to dress them (paint, lights, glass, wheels, cockpit camera).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// electric motor: constant torque up to base speed, then constant power
const evCurve = (tMax, pKW, maxRpm) => { const out = []; for (let r = 0; r <= maxRpm + 400; r += 400) { const w = Math.max(1, r * Math.PI / 30); out.push([r, Math.min(tMax, pKW * 1000 / w)]); } return out; };

export const VEHICLES = {
  f458: {
    name: 'Ferrari 458 Spider', short: '458', info: '4.5 V8 · 570 PS · 540 Nm · 7 ileri · arkadan itiş',
    builtin: true, sound: { cyl: 8, kind: 'v8' }, credit: 'Ferrari 458 Italia: vicent091036 (three.js örnekleri)',
    spec: { mass: 1505, inertia: 2550, a: 1.42, b: 1.24, cgH: 0.44, r: 0.345,
      gears: [3.08, 2.19, 1.63, 1.29, 1.03, 0.84, 0.69], reverse: 2.9, final: 4.44, idle: 1000, redline: 9000, shiftUp: 8600, shiftDown: 4300, shiftTime: 0.09,
      tq: [[0, 250], [1000, 300], [2000, 380], [3000, 450], [4000, 495], [5000, 525], [6000, 540], [7000, 532], [8000, 500], [9000, 445], [9400, 300]],
      drag: 0.355, downforce: 0.45, brakeForce: 32000, drive: 'rwd', hl: 2.26, hw: 0.95 },
  },
  f40: {
    name: 'Ferrari F40', short: 'F40', info: '2.9 çift turbo V8 · 478 PS · 577 Nm · 5 ileri · arkadan itiş',
    file: 'assets/cars/f40.glb', length: 4.358, front: '+z', sound: { cyl: 8, kind: 'turbo' },
    credit: 'Ferrari F40: Black Snow (Sketchfab, CC-BY-4.0)',
    spec: { mass: 1255, inertia: 2050, a: 1.42, b: 1.03, cgH: 0.42, r: 0.33,
      gears: [2.769, 1.947, 1.512, 1.2, 0.966], reverse: 2.7, final: 3.08, idle: 1000, redline: 7750, shiftUp: 7400, shiftDown: 3800, shiftTime: 0.22,
      tq: [[0, 170], [1500, 230], [2500, 300], [3200, 420], [3800, 540], [4000, 577], [5000, 565], [6000, 545], [7000, 505], [7750, 450], [8100, 300]],
      drag: 0.325, downforce: 0.3, brakeForce: 26000, drive: 'rwd', hl: 2.18, hw: 0.97 },
    mats: { paint: ['material'], tail: ['super_brakelight'], head: ['super_headlight', 'F40_Headlights'], glass: ['F40_Glass', 'F40_Glass.001', 'F40_Window', 'F40_Window.001'] },
    wheelMats: /Rrims|Brake|Scene_-_Root\.002/i,
    cam: { cockpit: [-0.12, 1.0, -0.36], look: [6, 0.82, -0.36], hood: [0.55, 1.12, 0], mirror: [0.2, 1.05, 0] },
  },
  model3: {
    name: 'Tesla Model 3 Performance', short: 'Model 3', info: 'Elektrik · 2 motor · 460 PS · 660 Nm · dört çeker',
    file: 'assets/cars/model3.glb', length: 4.694, front: '+z', sound: { kind: 'ev' },
    credit: 'Tesla Model 3: David_Holiday (Sketchfab, CC-BY-4.0)',
    spec: { mass: 1919, inertia: 3300, a: 1.5, b: 1.375, cgH: 0.5, r: 0.341, ev: true,
      gears: [9.04], reverse: 9.04, final: 1, idle: 0, redline: 18400, shiftUp: 99999, shiftDown: 0, eff: 0.92,
      tq: evCurve(660, 340, 18400), drag: 0.306, downforce: 0.1, brakeForce: 30000, drive: 'awd', awdFront: 0.4, vmax: 261, regen: 120, hl: 2.33, hw: 0.92 },
    mats: { paint: ['CAR_PAINT'], tail: ['Material.002'], head: [], glass: ['Material.017', 'Material.016'] },
    wheelMats: null,
    cam: { cockpit: [-0.15, 1.22, -0.37], look: [6, 1.04, -0.37], hood: [0.9, 1.35, 0], mirror: [0.55, 1.3, 0] },
  },
  e2008: {
    name: 'Peugeot e-2008', short: 'e-2008', info: 'Elektrik · 136 PS · 260 Nm · önden çekiş · 150 km/sa',
    file: 'assets/cars/e2008.glb', length: 4.3, front: '+z', sound: { kind: 'ev' },
    credit: 'Peugeot e-2008: David_Holiday (Sketchfab, CC-BY-4.0)',
    spec: { mass: 1623, inertia: 2700, a: 1.04, b: 1.565, cgH: 0.58, r: 0.334, ev: true,
      gears: [8.6], reverse: 8.6, final: 1, idle: 0, redline: 10500, shiftUp: 99999, shiftDown: 0, eff: 0.92,
      tq: evCurve(260, 100, 10500), drag: 0.475, downforce: 0, brakeForce: 24000, drive: 'fwd', vmax: 150, regen: 70, grip: 0.92, hl: 2.13, hw: 0.88 },
    mats: { paint: ['Bianca_White'], tail: ['2020_Peugeot_e-2008_rouge_vitre'], head: ['2020_Peugeot_e-2008_vehicle_generic_smallspecmap_7'], glass: ['2020_Peugeot_e-2008_glass_clear', '2020_Peugeot_e-2008_vitres_exterieur'] },
    wheelMats: /wheel_tire_01_dm|wheel_black/,
    cam: { cockpit: [-0.1, 1.27, -0.37], look: [6, 1.07, -0.37], hood: [0.9, 1.45, 0], mirror: [0.55, 1.38, 0] },
  },
};
export const VEHICLE_IDS = Object.keys(VEHICLES);

// ---------- loading & preparing a model once per vehicle type ----------
const cache = {};
let loader = null;
function getLoader() { if (loader) return loader; const d = new DRACOLoader(); d.setDecoderPath(window.DRACO_PATH || 'https://unpkg.com/three@0.187.0/examples/jsm/libs/draco/gltf/'); loader = new GLTFLoader(); loader.setDRACOLoader(d); return loader; }
export function _tpl(id){ return cache[id] && cache[id].tpl; }
export function vehicleReady(id) { const V = VEHICLES[id]; return !!V && (V.builtin || !!(cache[id] && cache[id].tpl)); }
export function loadVehicle(id) {
  const V = VEHICLES[id]; if (!V || V.builtin) return Promise.resolve(true);
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
  // tame glossy/metallic interior & trim materials (they glow gold in the sun otherwise)
  const seen = new Map(); const fix = p => { const m = p.mat; if (!m || !m.isMeshStandardMaterial) return; if (seen.has(m)) { p.mat = seen.get(m); return; }
    const n = m.clone(); const lum = n.color ? (n.color.r + n.color.g + n.color.b) / 3 : 1; const chrome = /chrom|metal|rim|cerchi/i.test(m.name || '');
    if (!chrome) { n.metalness = Math.min(n.metalness, lum < 0.2 ? 0.15 : 0.5); if (lum < 0.2) n.roughness = Math.max(n.roughness, 0.55); }
    n.envMapIntensity = chrome ? 1 : 0.6; seen.set(m, n); p.mat = n; };
  for (const p of body) fix(p); for (const w of wheels) for (const p of w.list) fix(p);
  return { body, wheels, wb: fx - rx, len: all.max.x - all.min.x };
}

const shadowTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.filter = 'blur(7px)'; g.fillStyle = 'rgba(0,0,0,.8)'; g.beginPath(); g.roundRect(16, 12, 96, 40, 14); g.fill(); t = new THREE.CanvasTexture(c); return t; }; })();

// one drivable instance with its own paint / light materials
export function buildVehicle(id, color) {
  const V = VEHICLES[id], T = cache[id] && cache[id].tpl; if (!T) return null;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.25, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff1010, emissiveIntensity: 0.6, roughness: 0.15 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, emissive: 0xfff1d6, emissiveIntensity: 0.15, roughness: 0.05, metalness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0e1216, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.45, envMapIntensity: 1.5, clearcoat: 1 });
  const M = V.mats || {}; const has = (list, n) => list && list.includes(n);
  const pick = mat => { const n = mat.name || ''; if (has(M.paint, n)) return paint; if (has(M.tail, n)) return brakeMat; if (has(M.head, n)) return headMat; if (has(M.glass, n)) return glass; return mat; };
  const envMats = new Set([paint, glass]);
  for (const p of T.body) { const m = new THREE.Mesh(p.geo, pick(p.mat)); m.castShadow = m.material !== glass; m.receiveShadow = true; body.add(m); }
  const unsprung = new THREE.Group(); root.add(unsprung);
  const pivots = T.wheels.map((w, i) => { const steerG = new THREE.Group(), spin = new THREE.Group(); steerG.add(spin); if (w.c) steerG.position.copy(w.c); unsprung.add(steerG);
    for (const p of w.list) { const m = new THREE.Mesh(p.geo, pick(p.mat)); m.castShadow = true; spin.add(m); } return { steerG, spin, front: i < 2 }; });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(T.len + 0.5, 2.3), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; sh.renderOrder = 2; unsprung.add(sh);
  const cam = V.cam || {};
  return { root, body, paint, brakeMat, headMat, flames: [], wheels: [], pivots: [], steer: new THREE.Object3D(), interior: new THREE.Group(), lowerMesh: null, origPos: null, color, vid: id,
    gauge: { canvas: null, tex: {}, ctx: null },
    setEnvMap(t) { for (const m of envMats) { m.envMap = t; m.needsUpdate = true; } },
    cockpit: cam.cockpit, cockpitLook: cam.look, hood: cam.hood, mirror: cam.mirror,
    setPose(steer, ang) { pivots.forEach((p, i) => { if (p.front) p.steerG.rotation.y = -steer; p.spin.rotation.z = -ang[i]; }); } };
}
