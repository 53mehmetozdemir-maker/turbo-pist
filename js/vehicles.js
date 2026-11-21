// Vehicle line-up: real-world figures (mass, power/torque curve, gearing, top speed, drivetrain, size)
// plus the licensed 3D models and how to dress them (paint, lights, glass, wheels, cockpit camera).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader, DRACO_GLTF_CONFIG } from 'three/addons/loaders/DRACOLoader.js';
import { buildBike } from './bike.js';
import { prepareBike, buildBikeGLB } from './bikeglb.js';
import { buildCabin, navTex } from './interior.js';

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
    cam: { cockpit: [-0.252, 1.0, -0.36], look: [6, 0.82, -0.36], hood: [0.418, 1.12, 0], mirror: [0.168, 1.02, 0] },
    mirrors: { in: { c: [0.254, 1.009, -0.005], n: [-1, -0.07, 0], w: 0.18, h: 0.045 }, L: { c: [0.586, 0.791, -0.932], n: [-0.9, 0, 0.44], w: 0.12, h: 0.06 } },
    sw: { c: [0.453, 0.70, -0.33], n: [-0.84, 0.54, 0], r: 0.19, t: 0.05 },
    dash: [{ c: [0.655, 0.749, -0.364], n: [-1, 0, 0], w: 0.085, h: 0.085, kind: 'tach', max: 10000 }, { c: [0.655, 0.749, -0.272], n: [-1, 0, 0], w: 0.085, h: 0.085, kind: 'speedo', max: 360 }],
    exhaust: { y: 0.36, z: [-0.07, 0, 0.07] },
    cabin: [[-0.85, 0.3, 0], [0.75, 1.16, 0.84]], trimColor: 0x26272a,
    popups: { x0: 1.74, y0: 0.62, z: 0.6, len: 0.15, w: 0.33, slope: -0.35, open: 1.5 },
    tint: { f40seat: [0x7a1414, 0, 0.85], F40_Cockpit: [0x2a2a2c, 0, 0.9] },
    lightBoxes: [{ mat: 'F40_Cockpit', min: [-0.55, 0.12, 0.12], max: [0.08, 0.84, 0.56], as: 'f40seat' }],
    tailDiscs: [{ c: [-2.021, 0.648, -0.528], n: [-1, -0.03, -0.07], r: 0.08 }], darken: ['F40_GridD', 'F40_Grid', 'F40_Vehiclelight'],
  },
  model3: {
    exhaust: { y: 0.33, z: [-0.35, 0.35], ev: true },
    name: 'Tesla Model 3 Performance', short: 'Model 3', info: 'Elektrik · 2 motor · 460 PS · 660 Nm · dört çeker',
    file: 'assets/cars/model3.glb', length: 4.694, front: '+z', sound: { kind: 'ev' },
    credit: 'Tesla Model 3: David_Holiday (Sketchfab, CC-BY-4.0)',
    spec: { mass: 1919, inertia: 3300, a: 1.5, b: 1.375, cgH: 0.5, r: 0.341, ev: true,
      gears: [9.04], reverse: 9.04, final: 1, idle: 0, redline: 18400, shiftUp: 99999, shiftDown: 0, eff: 0.92,
      tq: evCurve(660, 340, 18400), drag: 0.306, downforce: 0.1, brakeForce: 30000, drive: 'awd', awdFront: 0.4, vmax: 261, regen: 120, grip: 0.92, hl: 2.33, hw: 0.92 },
    mats: { paint: ['CAR_PAINT'], tail: ['Material.002'], head: ['Glass'], glass: ['Material.017', 'Material.016'] }, darken: ['Material.007'],
    tint: { 'Material.012': [0x9aa0a8, 0.9, 0.28, 1], 'Material.013': [0x111111, 0, 0.9], 'Material.009': [0x2a2d31, 0.6, 0.4] },
    lightBoxes: [{ mat: 'Material.005', min: [-9, 0.6, 0.2], max: [-1.9, 1.2, 0.95], as: 'tail' }],
    wheelMats: null,
    cam: { cockpit: [-0.2, 1.27, -0.37], look: [6, 1.06, -0.37], hood: [0.9, 1.35, 0], mirror: [0.55, 1.3, 0] },
    mirrors: { in: { c: [0.36, 1.265, 0.0], n: [-0.99, -0.08, -0.12], w: 0.2, h: 0.05, housing: true, frame: 0.008, arm: 0.035 }, L: { c: [0.52, 1.005, -0.952], n: [-0.89, 0, 0.46], w: 0.14, h: 0.085 } },
    backTrim: true, cabin: [[-1.95, 0.3, 0], [1.0, 1.45, 0.95]], trimColor: 0x15171c,
    kit: { hide: [[-1.9, 0.2, -0.7], [1.02, 1.26, 0.7]], opt: { xDash: 1.1, xFace: 0.66, yTop: 0.93, yFloor: 0.3, halfW: 0.72, zDrv: -0.37, seatX: -0.42, seatY: 0.56, back: 0.28, roofY: 1.42, xVisor: null,
      doorZ: 0.83, xDoorF: 0.8, xDoorR: -0.4, rear: { x: -1.2, y: 0.5, w: 1.32 }, cluster: null, screen: { c: [0.668, 0.972, -0.01], w: 0.3, h: 0.18, tilt: -0.233, stand: true },
      sw: { c: [0.47, 0.93, -0.37], n: [-0.92, 0.4, 0], r: 0.185 }, shifter: 'none', trimKind: 'carbon', style: 'tesla', roofBar: { x: -0.32, y: 1.37 }, tintRoof: { x0: -1.6, x1: 0.35, y: 1.42, w: 1.2 }, shelf: { x0: -1.98, x1: -1.5, y: 0.98 }, col: { dash: 0x16181e, low: 0x0f1014, seat: 0x15171c, ins: '#22252b', stitch: '#4a4e56', amb: 0xffffff } } },
    dash: [{ c: [0.655, 0.975, -0.01], n: [-0.97, 0.23, 0], w: 0.3, h: 0.18, kind: 'tesla' }],
  },
  e2008: {
    exhaust: { y: 0.38, z: [-0.38, 0.38], ev: true },
    name: 'Peugeot e-2008', short: 'e-2008', info: 'Elektrik · 136 PS · 260 Nm · önden çekiş · 150 km/sa',
    file: 'assets/cars/e2008.glb', length: 4.3, front: '+z', sound: { kind: 'ev' },
    credit: 'Peugeot e-2008: David_Holiday (Sketchfab, CC-BY-4.0)',
    spec: { mass: 1623, inertia: 2700, a: 1.04, b: 1.565, cgH: 0.58, r: 0.334, ev: true,
      gears: [8.6], reverse: 8.6, final: 1, idle: 0, redline: 10500, shiftUp: 99999, shiftDown: 0, eff: 0.92,
      tq: evCurve(260, 100, 10500), drag: 0.475, downforce: 0, brakeForce: 24000, drive: 'fwd', vmax: 150, regen: 70, grip: 0.82, hl: 2.13, hw: 0.88 },
    lightBoxes: [{ mat: '2020_Peugeot_e-2008_black', min: [-9, 0.98, 0.42], max: [-1.75, 1.2, 0.8], as: 'tail' }, { mat: '2020_Peugeot_e-2008_glass_clear', min: [-9, 0.98, 0.35], max: [-1.8, 1.15, 0.8], as: 'tail' }, { mat: '2020_Peugeot_e-2008_black', min: [1.6, 0.78, 0.5], max: [9, 0.95, 0.8], as: 'head' }, { mat: '2020_Peugeot_e-2008_vehicle_generic_smallspecmap_7', min: [1.5, 0.55, 0.15], max: [9, 1.1, 0.95], as: 'head' }, { mat: '2020_Peugeot_e-2008_chrome_0', min: [-1.5, 0.45, 0], max: [1.05, 1.3, 0.74], as: 'e2trim' }, { mat: '2020_Peugeot_e-2008_wheel_black', min: [-1.6, 0.45, 0], max: [1.1, 1.35, 0.76], as: 'e2dash' }],
    mats: { paint: ['Bianca_White'], tail: ['2020_Peugeot_e-2008_rouge_vitre'], head: [], glass: ['2020_Peugeot_e-2008_glass_clear', '2020_Peugeot_e-2008_vitres_exterieur'] },
    navs: [{ c: [0.582, 1.045, 0.035], n: [-0.97, 0.15, -0.18], w: 0.235, h: 0.1 }],
    tint: { '2020_Peugeot_e-2008_int': [0x2e2f33, 0, 0.75], '2020_Peugeot_e-2008_vehicle_generic_smallspecmap_7': [0x45474c, 0.4, 0.45], e2trim: [0x6a6d73, 0.7, 0.35], e2dash: [0x34363a, 0, 0.7], Color_M08: [0x2a2b2e, 0, 0.6] },
    wheelMats: /wheel_tire_01_dm|wheel_black/,
    cam: { cockpit: [-0.1, 1.27, -0.37], look: [6, 1.07, -0.37], hood: [0.9, 1.45, 0], mirror: [0.55, 1.3, 0] },
    mirrors: { in: { c: [0.528, 1.282, 0.003], n: [-0.99, -0.08, -0.12], w: 0.2, h: 0.05 }, L: { c: [0.576, 1.078, -0.866], n: [-0.92, 0, 0.4], w: 0.15, h: 0.095 } },
    sw: { c: [0.40, 0.985, -0.37], n: [-0.85, 0.53, 0], r: 0.19, t: 0.05 },
    dash: [{ c: [0.73, 1.048, -0.343], n: [-0.95, 0.3, 0], w: 0.16, h: 0.06, kind: 'peugeot' }],
  },
};
VEHICLES.gsxr = {
  name: 'Suzuki GSX-R 750', short: 'GSX-R 750', info: 'Motosiklet · 750 cc sıralı dört · 150 PS / 13.200 d/dk · 86 Nm · 6 ileri · 190 kg',
  proc: 'bikeglb', file: 'assets/cars/gsxr.glb', length: 2.06, front: '-z', axleF: 0.70, sound: { cyl: 4, kind: 'i4moto' },
  credit: 'Suzuki GSX-R 750: kullanıcının gönderdiği model',
  parts: { 'Srad750.001': 'fwheel', 'Srad750001': 'fwheel', 'Srad750.004': 'rwheel', 'Srad750004': 'rwheel', 'Srad750.006': 'front', 'Srad750006': 'front' },
  mats: { paint: ['Car_Paint_-_Red.001'], tail: ['Matte__FFFF3C00__spec_RR_'], head: ['Material.003'], glass: ['Matte__662F2F2F__spec_trans_'], lens: ['Matte__6BFFFFFF__prim_spec_trans_', 'Matte__57CCCCCC__trans_'] },
  tint: { 'Car_Paint_-_Black': [0x0c0c0d, 0.3, 0.25], 'renan__spec_': [0x111113, 0.2, 0.5], 'Roue': [0x101010, 0, 0.9], 'Material': [0xa9adb2, 0.95, 0.35], 'Material.001': [0x111111, 0, 0.8],
    'aluminium__spec_': [0xa8adb3, 0.9, 0.3], 'Matte__FFAAAAAA__env_29_spec_': [0xd9dde2, 1, 0.12], 'Matte__FFCCCCCC__env_50_': [0xd9dde2, 1, 0.12], 'Matte__FFAAAAAA__env_11_spec_': [0xb0b4b8, 0.9, 0.25],
    'Motor': [0x1c1c1e, 0.5, 0.45], 'Echape': [0x6d6f72, 0.9, 0.3], 'metalpipegold__spec_': [0xb48a3a, 1, 0.3], 'Matte__FFCCCCCC': [0x1b1b1d, 0.2, 0.5], 'Matte__FF292929': [0x161616, 0, 0.5],
    'Matte__FF00FFC8__spec_FR_': [0x1a1c20, 0.9, 0.08], 'Matte__FFFFFFFF__env_6_spec_': [0x0f0f10, 0.3, 0.35], 'Matte__FFFFFFFF': [0x2a2a2c, 0.2, 0.4], 'renan': [0x151515, 0, 0.7], 'Material.004': [0x111111, 0, 0.8], 'Material.002': [0x6a0000, 0, 0.3] },
  spec: { mass: 270, inertia: 290, muRear: 1.55, Bf: 9, a: 0.70, b: 0.736, cgH: 0.6, r: 0.315, track: 0,
    gears: [2.785, 2.052, 1.714, 1.5, 1.347, 1.208], reverse: 2.785, final: 5.14, eff: 0.9, idle: 1200, redline: 14000, shiftUp: 13800, shiftDown: 8000, shiftTime: 0.05,
    tq: [[0, 32], [2000, 45], [4000, 58], [6000, 68], [8000, 76], [10000, 83], [11200, 86], [12000, 85], [13200, 81], [14000, 74], [14500, 50]],
    drag: 0.2, roll: 3, downforce: 0.03, brakeForce: 3200, brakeBias: 0.78, drive: 'rwd', vmax: 285, grip: 1.03, hl: 1.03, hw: 0.36 },
};
VEHICLES.gt3 = {
  name: 'Porsche 911 GT3 (992)', short: '911 GT3', info: '4.0 atmosferik boxer 6 · 510 PS / 8.400 d/dk · 470 Nm · 7 ileri PDK · arkadan itiş · 9.000 d/dk',
  file: 'assets/cars/gt3.glb', length: 4.573, front: '+z', sound: { cyl: 6, kind: 'f6' }, keepStd: true,
  credit: 'Porsche 911 GT3 (2022): kullanıcının gönderdiği model',
  spec: { mass: 1510, inertia: 2350, a: 1.5, b: 0.957, cgH: 0.45, r: 0.352,
    gears: [3.75, 2.38, 1.72, 1.34, 1.11, 0.96, 0.84], reverse: 3.3, final: 4.47, idle: 950, redline: 9000, shiftUp: 8800, shiftDown: 4500, shiftTime: 0.07,
    tq: [[0, 230], [1500, 320], [2500, 380], [3500, 420], [4500, 440], [5500, 460], [6100, 470], [7000, 462], [8000, 445], [8400, 430], [9000, 400], [9300, 260]],
    drag: 0.33, downforce: 0.5, brakeForce: 33000, drive: 'rwd', vmax: 318, grip: 1.04, hl: 2.29, hw: 0.93 },
  mats: { paint: ['Azul Tubarão'], tail: ['Luz de Freio'], head: ['Farol', 'Led Farol', 'DRL'], glass: ['Vidro'] },
  wheelMats: null,
  cam: { cockpit: [-0.33, 1.04, -0.338], look: [6, 0.86, -0.338], hood: [0.9, 1.02, 0], mirror: [0.25, 1.1, 0] },
  mirrors: { in: { c: [0.2, 1.11, 0], n: [-0.99, -0.1, 0], w: 0.2, h: 0.05 }, L: { c: [0.27, 0.89, -0.91], n: [-0.95, 0, 0.3], w: 0.17, h: 0.08 } },
  sw: { c: [0.256, 0.783, -0.338], n: [-0.91, 0.41, 0], r: 0.19, t: 0.06 },
  cabin: [[-1.0, 0.3, 0], [0.75, 1.25, 0.85]], trimColor: 0x18191b,
};
VEHICLES.civic = {
  name: 'Honda Civic Type R (FK8)', short: 'Civic Type R', info: '2.0 VTEC Turbo K20C1 · 320 PS · 400 Nm · 6 ileri manuel · önden çekiş · 272 km/sa',
  file: 'assets/cars/civic.glb', length: 4.557, front: '+z', sound: { cyl: 4, kind: 'k20t' },
  credit: 'Honda Civic Type R FK8: CGTrader ücretsiz model',
  spec: { mass: 1450, inertia: 2350, a: 1.03, b: 1.67, cgH: 0.5, r: 0.3275,
    gears: [3.625, 2.115, 1.529, 1.125, 0.911, 0.734], reverse: 3.3, final: 4.111, idle: 850, redline: 7000, shiftUp: 6800, shiftDown: 3000, shiftTime: 0.12,
    tq: [[0, 180], [1500, 260], [2000, 340], [2500, 400], [4500, 400], [5000, 385], [5500, 370], [6000, 355], [6500, 350], [7000, 320], [7300, 200]],
    drag: 0.34, downforce: 0.12, brakeForce: 26000, drive: 'fwd', vmax: 272, grip: 1.0, hl: 2.28, hw: 0.94 },
  mats: { paint: ['FK8.Paint'], tail: ['Material.010'], head: ['Material.007'], glass: ['FK8.Windshield'] },
  tint: { 'FK8.HeadlightGlass': [0xe8eef4, 0.1, 0.03, 1.4, 0.18], 'Material.009': [0x8a4a00, 0, 0.3] },
  wheelMats: null,
  cam: { cockpit: [-0.2, 1.13, -0.357], look: [6, 0.98, -0.357], hood: [0.9, 1.32, 0], mirror: [0.45, 1.25, 0] },
  mirrors: { in: { c: [0.33, 1.33, 0], n: [-0.99, -0.08, 0], w: 0.21, h: 0.055, housing: true }, L: { c: [0.47, 1.07, -0.99], n: [-0.95, 0, 0.3], w: 0.16, h: 0.09 } },
  sw: { c: [0.41, 0.918, -0.357], n: [-0.88, 0.47, 0], r: 0.19, t: 0.06 },
  cabin: [[-1.6, 0.35, 0], [0.9, 1.4, 0.88]], trimColor: 0x1a1b1e,
};
export const VEHICLE_IDS = Object.keys(VEHICLES);

// ---------- loading & preparing a model once per vehicle type ----------
const cache = {};
let loader = null;
function getLoader() { if (loader) return loader; const d = new DRACOLoader(); d.setDecoderPath(window.DRACO_PATH || DRACO_GLTF_CONFIG); loader = new GLTFLoader(); loader.setDRACOLoader(d); return loader; }
export function _tpl(id){ return cache[id] && cache[id].tpl; }
export function vehicleReady(id) { const V = VEHICLES[id]; return !!V && (V.builtin || (V.proc && !V.file) || !!(cache[id] && cache[id].tpl)); }
export function loadVehicle(id) {
  const V = VEHICLES[id]; if (!V || V.builtin || (V.proc && !V.file)) return Promise.resolve(true);
  if (cache[id]) return cache[id].p;
  const c = cache[id] = {}; c.p = getLoader().loadAsync(V.file).then(g => { c.tpl = V.proc === 'bikeglb' ? prepareBike(V, g.scene) : prepare(V, g.scene); return true; }).catch(e => { console.warn('araç yüklenemedi', id, e); delete cache[id]; return false; });
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
    for (let t = 0; t < pos.count; t += 3) { let nx = 0, ny = 0, nz = 0; if (cls.length > 3) { const ax = pos.getX(t + 1) - pos.getX(t), ay = pos.getY(t + 1) - pos.getY(t), az = pos.getZ(t + 1) - pos.getZ(t), bx = pos.getX(t + 2) - pos.getX(t), by = pos.getY(t + 2) - pos.getY(t), bz = pos.getZ(t + 2) - pos.getZ(t); nx = ay * bz - az * by; ny = az * bx - ax * bz; nz = ax * by - ay * bx; }
      const k = cls((pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3, (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3, (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3, nx, ny, nz); (out[k] ??= []).push(t); }
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
  // drop stray triangles that are not part of the wheel (body bits caught by the quadrant split) so the pivot sits on the real axle
  for (let q = 0; q < 4; q++) { const list = wheelParts[q]; if (!list.length) continue; const cs = [];
    for (const p of list) { const P = p.geo.attributes.position; for (let t = 0; t < P.count; t += 3) cs.push([(P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3, (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3, (P.getZ(t) + P.getZ(t + 1) + P.getZ(t + 2)) / 3]); }
    const med = k => { const a = cs.map(c => c[k]).sort((u, v) => u - v); return a[a.length >> 1]; }; const m = [med(0), med(1), med(2)];
    const ds = cs.map(c => Math.hypot(c[0] - m[0], c[1] - m[1])).sort((u, v) => u - v); const r = Math.min(0.45, ds[Math.floor(ds.length * 0.97)]);
    const keep = [], stray = []; for (const p of list) { const sp = splitTris(p.geo, (x, y, z) => (Math.hypot(x - m[0], y - m[1]) < r * 1.12 + 0.02 && Math.abs(z - m[2]) < 0.3) ? 'k' : 's'); if (sp.k) keep.push({ geo: sp.k, mat: p.mat }); if (sp.s) stray.push({ geo: sp.s, mat: p.mat }); }
    if (keep.length) { wheelParts[q] = keep; for (const st of stray) body.push(st); } }
  // wheel centres from the rolling parts' bounds; axle positions define the car's x origin
  const wheels = wheelParts.map(list => { const b = new THREE.Box3(); for (const p of list) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); } const c = b.isEmpty() ? null : b.getCenter(new THREE.Vector3()); if (c) c.y = (b.max.y - b.min.y) / 2 + b.min.y; return { c, list, r: b.isEmpty() ? 0.33 : (b.max.y - b.min.y) / 2 }; });
  const fx = wheels[0].c && wheels[1].c ? (wheels[0].c.x + wheels[1].c.x) / 2 : 1.35, rx = wheels[2].c && wheels[3].c ? (wheels[2].c.x + wheels[3].c.x) / 2 : -1.35;
  const mid = (fx + rx) / 2;
  for (const p of body) p.geo.translate(-mid, 0, 0);
  for (const w of wheels) { if (!w.c) continue; w.c.x -= mid; for (const p of w.list) { p.geo.translate(-mid, 0, 0); p.geo.translate(-w.c.x, -w.c.y, -w.c.z); } }
  // some source models ship with the front wheels turned (toe/steer baked in): find each wheel's axle direction and square it up
  for (const w of wheels) { if (!w.c) continue; const pts = []; for (const p of w.list) { const P = p.geo.attributes.position; const st = Math.max(1, Math.floor(P.count / 3000)); for (let i = 0; i < P.count; i += st) pts.push([P.getX(i), P.getY(i), P.getZ(i)]); }
    let best = 0, bv = Infinity; for (let t = -0.35; t <= 0.35; t += 0.0025) { const c = Math.cos(t), sn = Math.sin(t); let m = 0, v = 0; for (const q of pts) m += -sn * q[0] + c * q[2]; m /= pts.length; for (const q of pts) { const d = -sn * q[0] + c * q[2] - m; v += d * d; } if (v < bv) { bv = v; best = t; } }
    const zw = () => { const b2 = new THREE.Box3(); for (const p of w.list) { p.geo.computeBoundingBox(); b2.union(p.geo.boundingBox); } return b2.max.z - b2.min.z; };
    if (Math.abs(best) > 0.004) { const w0 = zw(); for (const p of w.list) p.geo.rotateY(best); if (zw() > w0 - 0.01) { for (const p of w.list) p.geo.rotateY(-best); best = 0; } }
    const bb = new THREE.Box3(); for (const p of w.list) { p.geo.computeBoundingBox(); bb.union(p.geo.boundingBox); } const off = bb.getCenter(new THREE.Vector3()); off.y = 0;
    for (const p of w.list) p.geo.translate(-off.x, 0, -off.z); w.c.x += off.x; w.c.z += off.z; w.toe = best; }
  // left/right wheels share one axle line: average their positions so the car tracks straight
  for (const [a, b] of [[0, 1], [2, 3]]) { const A = wheels[a].c, B = wheels[b].c; if (!A || !B) continue; const x = (A.x + B.x) / 2, y = (A.y + B.y) / 2, z = (Math.abs(A.z) + Math.abs(B.z)) / 2; A.set(x, y, Math.sign(A.z) * z); B.set(x, y, Math.sign(B.z) * z); }
  // light lenses that share a material with trim: carve them out by region
  if (V.kit && V.kit.hide) { const [mn, mx] = V.kit.hide; const keep = [...((V.mats && V.mats.paint) || []), ...((V.mats && V.mats.glass) || [])];
    for (let i = body.length - 1; i >= 0; i--) { const p = body[i]; if (keep.includes(p.mat.name || '')) continue;
      const sp = splitTris(p.geo, (x, y, z) => (x > mn[0] && x < mx[0] && y > mn[1] && y < mx[1] && Math.abs(z) < mx[2]) ? 'h' : 'k'); if (!sp.h) continue; if (sp.k) body[i] = { geo: sp.k, mat: p.mat }; else body.splice(i, 1); } }
  for (const lb of V.lightBoxes || []) for (let i = body.length - 1; i >= 0; i--) { const p = body[i]; if ((p.mat.name || '') !== lb.mat || p.role) continue;
    const sp = splitTris(p.geo, (x, y, z) => { const zz = Math.abs(z); return (x >= lb.min[0] && x <= lb.max[0] && y >= lb.min[1] && y <= lb.max[1] && zz >= lb.min[2] && zz <= lb.max[2]) ? 'l' : 'o'; });
    if (sp.l) { body.splice(i, 1); body.push({ geo: sp.l, mat: p.mat, role: lb.as }); if (sp.o) body.push({ geo: sp.o, mat: p.mat }); } }
  // body-colour faces that look into the cabin (inside of the roof, door shells, pillars) become dark trim
  if (V.cabin) { const [mn, mx] = V.cabin; const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2; const paintN = (V.mats && V.mats.paint) || [];
    for (let i = body.length - 1; i >= 0; i--) { const p = body[i]; if (!paintN.includes(p.mat.name || '') || p.role) continue;
      const sp = splitTris(p.geo, (x, y, z, nx, ny, nz) => { if (x < mn[0] || x > mx[0] || y < mn[1] || y > mx[1] || Math.abs(z) > mx[2]) return 'o';
        return (nx * (x - cx) + ny * (y - cy) * 1.6 + nz * z) < 0 ? 't' : 'o'; });
      if (sp.t) { body.splice(i, 1); body.push({ geo: sp.t, mat: p.mat, role: 'cabtrim' }); if (sp.o) body.push({ geo: sp.o, mat: p.mat }); } } }
  // steering wheel: triangles within a disc around the column axis become their own pivot
  let swParts = null; if (V.sw) { const c0 = new THREE.Vector3(...V.sw.c), ax = new THREE.Vector3(...V.sw.n).normalize(); swParts = [];
    for (let i = body.length - 1; i >= 0; i--) { const p = body[i]; const sp = splitTris(p.geo, (x, y, z) => { const d = new THREE.Vector3(x, y, z).sub(c0); const a = d.dot(ax); const r = d.addScaledVector(ax, -a).length(); return (Math.abs(a) < V.sw.t && r < V.sw.r) ? 's' : 'b'; });
      if (sp.s) { for (const g of [sp.s]) { g.translate(-c0.x, -c0.y, -c0.z); swParts.push({ geo: g, mat: p.mat }); } if (sp.b) body[i] = { geo: sp.b, mat: p.mat }; else body.splice(i, 1); } } }
  // tame glossy/metallic interior & trim materials (they glow gold in the sun otherwise)
  const seen = new Map(); const fix = (p, wheel) => { const m = p.mat; if (!m || !m.isMeshStandardMaterial) return; if (seen.has(m)) { p.mat = seen.get(m); return; }
    const lum0 = m.color ? (m.color.r + m.color.g + m.color.b) / 3 : 1; const chrome0 = /chrom|metal|rim|cerchi/i.test(m.name || '');
    if (!V.keepStd && !wheel && !chrome0 && !m.transparent && !m.map && !(V.mats && V.mats.paint && V.mats.paint.includes(m.name))) { // dark trim/interior: matte, no sun glare (it turned the cabins olive/gold)
      const col = m.color.clone(); const lm = (col.r + col.g + col.b) / 3; if (lm < 0.03) col.setScalar(0.03); const l = new THREE.MeshLambertMaterial({ color: col, side: m.side, name: m.name }); seen.set(m, l); p.mat = l; return; }
    const n = m.clone(); const lum = n.color ? (n.color.r + n.color.g + n.color.b) / 3 : 1; const chrome = /chrom|metal|rim|cerchi/i.test(m.name || '');
    if (!chrome) { n.metalness = Math.min(n.metalness, 0.1); n.roughness = Math.max(n.roughness, lum < 0.5 ? 0.6 : 0.4); }
    n.envMapIntensity = chrome ? 1 : 0.35; if (V.keepStd && !chrome && lum < 0.06 && !wheel) { n.roughness = Math.max(n.roughness, 0.8); n.envMapIntensity = 0.12; } seen.set(m, n); p.mat = n; };
  for (const p of body) fix(p); for (const w of wheels) for (const p of w.list) fix(p, true); if (swParts) for (const p of swParts) fix(p);
  return { body, wheels, sw: swParts, wb: fx - rx, len: all.max.x - all.min.x, rearX: all.min.x - cx - mid };
}

const shadowTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.filter = 'blur(7px)'; g.fillStyle = 'rgba(0,0,0,.8)'; g.beginPath(); g.roundRect(16, 12, 96, 40, 14); g.fill(); t = new THREE.CanvasTexture(c); return t; }; })();

// one drivable instance with its own paint / light materials
export function buildVehicle(id, color) {
  const V = VEHICLES[id]; if (V && V.proc === 'bike') return buildBike(color); if (V && V.proc === 'bikeglb') { const T = cache[id] && cache[id].tpl; return T ? buildBikeGLB({ ...V, id }, T, color) : null; } 
  const T = cache[id] && cache[id].tpl; if (!T) return null;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.25, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff0800, emissiveIntensity: 0.6, roughness: 0.15, toneMapped: false });
  const headMat = new THREE.MeshPhysicalMaterial({ color: 0xc4cbd2, emissive: 0xfff1d6, emissiveIntensity: 0.08, roughness: 0.12, metalness: 0.85, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0e1216, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.45, envMapIntensity: 1.5, clearcoat: 1 });
  const M = V.mats || {}; const has = (list, n) => list && list.includes(n);
  const darkM = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.85, metalness: 0 });
  const tints = {}; for (const [k, t] of Object.entries(V.tint || {})) tints[k] = new THREE.MeshStandardMaterial({ color: t[0], metalness: t[1], roughness: t[2], envMapIntensity: t[3] ?? (t[1] > 0.5 ? 0.6 : 0.2), ...(t[4] != null ? { transparent: true, opacity: t[4], depthWrite: false } : {}) });
  tints.cabtrim = tints.cabtrim || new THREE.MeshStandardMaterial({ color: V.trimColor || 0x1f2023, roughness: 0.92, envMapIntensity: 0.1 });
  const pick = mat => { const n = mat.name || ''; if (tints[n]) return tints[n]; if (V.darken && V.darken.includes(n)) return darkM; if (has(M.paint, n)) return paint; if (has(M.tail, n)) return brakeMat; if (has(M.head, n)) return headMat; if (has(M.glass, n)) return glass; return mat; };
  const envMats = new Set([paint, glass, headMat, ...Object.values(tints)]);
  // single-sided shell panels vanish when seen from inside (you'd see the sky through the roof and doors): give them a dark back face
  const glassIn = new THREE.MeshPhysicalMaterial({ color: 0x1a2026, roughness: 0.05, transparent: true, opacity: 0.14, side: THREE.BackSide, depthWrite: false, envMapIntensity: 0.6 });   // faint tint/reflection seen from inside
  const backTrim = new THREE.MeshStandardMaterial({ color: V.trimColor || 0x1c1d20, roughness: 0.92, side: THREE.BackSide, envMapIntensity: 0.1 });
  for (const p of T.body) { const m = new THREE.Mesh(p.geo, p.role === 'tail' ? brakeMat : p.role === 'head' ? headMat : (p.role && tints[p.role]) ? tints[p.role] : pick(p.mat)); m.castShadow = m.material !== glass; m.receiveShadow = true; body.add(m);
    if (m.material === glass) { const gi = new THREE.Mesh(p.geo, glassIn); gi.renderOrder = 1; body.add(gi); }
    const mm = m.material; if (V.backTrim && mm !== glass && mm !== brakeMat && mm !== headMat && !mm.transparent && (mm.side ?? 0) === THREE.FrontSide && !mm.isMeshBasicMaterial) { const bk = new THREE.Mesh(p.geo, backTrim); bk.receiveShadow = true; body.add(bk); } }
  const unsprung = new THREE.Group(); root.add(unsprung);
  const pivots = T.wheels.map((w, i) => { const steerG = new THREE.Group(), spin = new THREE.Group(); steerG.add(spin); if (w.c) steerG.position.copy(w.c); unsprung.add(steerG);
    for (const p of w.list) { const m = new THREE.Mesh(p.geo, pick(p.mat)); m.castShadow = true; spin.add(m); } return { steerG, spin, front: i < 2 }; });
  let swG = null, swAxis = null; if (T.sw && T.sw.length) { swG = new THREE.Group(); swG.position.set(...V.sw.c); swAxis = new THREE.Vector3(...V.sw.n).normalize(); const inner = new THREE.Group(); swG.add(inner); for (const p of T.sw) inner.add(new THREE.Mesh(p.geo, pick(p.mat))); body.add(swG); swG.userData.inner = inner; }
  for (const nv of V.navs || []) { const n = new THREE.Vector3(...nv.n).normalize(); const u = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).normalize(), w = new THREE.Vector3().crossVectors(n, u);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(nv.w, nv.h), new THREE.MeshBasicMaterial({ map: navTex(), toneMapped: false, color: 0xd8d8d8 })); sm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, w, n)); sm.position.set(...nv.c).addScaledVector(n, 0.004); body.add(sm); }
  if (V.kit) { const cab = buildCabin(V.kit.opt); body.add(cab.group); swG = cab.swG; swAxis = cab.swAxis; }
  const flames = []; if (V.exhaust) { const fm = new THREE.MeshBasicMaterial({ color: V.exhaust.ev ? 0x8f7bff : 0x66b3ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
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
  // pop-up headlights (F40): each pod hinges at its rear edge, lies flush in the bonnet when off and swings up when the lights come on
  const pods = []; let popK = 0;
  const popLampM = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, emissive: 0xfff3dc, emissiveIntensity: 0, roughness: 0.1, metalness: 0.4, toneMapped: false });
  if (V.popups) { const P = V.popups; const glowC = document.createElement('canvas'); glowC.width = glowC.height = 64; { const g = glowC.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.15, 'rgba(255,250,235,.8)'); r.addColorStop(0.45, 'rgba(255,240,210,.15)'); r.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
    const glowT = new THREE.CanvasTexture(glowC); const blk = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.55 });
    for (const sd of [-1, 1]) { const hinge = new THREE.Group(); hinge.position.set(P.x0, P.y0, sd * P.z); body.add(hinge);
      const L = P.len, W = P.w, H = 0.085; const pod = new THREE.Group(); hinge.add(pod);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(L, 0.012, W).translate(L / 2 - 0.002, -0.004, 0), paint); lid.castShadow = true; pod.add(lid);
      const box = new THREE.Mesh(new THREE.BoxGeometry(L - 0.01, H, W - 0.012).translate(L / 2, -H / 2 - 0.008, 0), blk); pod.add(box);
      // lamp face on the underside: two round reflectors that point forward once the pod is up
      for (const dz of [-W * 0.24, W * 0.24]) { const r = Math.min(W * 0.19, L * 0.38); const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.006, 24).translate(L * 0.5, -H - 0.011, dz), new THREE.MeshStandardMaterial({ color: 0x8b9096, metalness: 1, roughness: 0.25 })); pod.add(ring);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.008, 24).translate(L * 0.5, -H - 0.013, dz), popLampM); pod.add(lens);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 })); sp.position.set(L * 0.5, -H - 0.06, dz); sp.scale.set(0.5, 0.5, 1); pod.add(sp); pods.push({ hinge, sp }); }
      hinge.userData.closed = P.slope; }
    for (const p of pods) { p.hinge.rotation.z = p.hinge.userData.closed; p.hinge.visible = false; } }
  const setPopups = (on, dt) => { if (!pods.length) return; popK = Math.max(0, Math.min(1, popK + (on ? 1 : -1) * dt / 0.7)); const e = popK * popK * (3 - 2 * popK);
    for (const p of pods) { p.hinge.visible = popK > 0.001; p.hinge.rotation.z = p.hinge.userData.closed + e * (V.popups.open - p.hinge.userData.closed); p.sp.material.opacity = Math.max(0, (e - 0.7) / 0.3) * 0.9; }
    popLampM.emissiveIntensity = Math.max(0, (e - 0.6) / 0.4) * 4; };
  return { root, body, paint, brakeMat, headMat, glassMat: glass, cabinBox: V.cabin || V.cabinBox || null, flames, setPopups, hasPopups: !!V.popups, wheels: [], mirrorDefs: V.mirrors, drawDash: dash.length ? (rpm, kmh, gear, nitro) => { for (const D of dash) drawDash(D, rpm, kmh, gear, nitro); } : null, pivots: [], steer: new THREE.Object3D(), interior: new THREE.Group(), lowerMesh: null, origPos: null, color, vid: id,
    gauge: { canvas: null, tex: {}, ctx: null },
    setEnvMap(t) { for (const m of envMats) { m.envMap = t; m.needsUpdate = true; } },
    cockpit: cam.cockpit, cockpitLook: cam.look, hood: cam.hood, mirror: cam.mirror,
    setPose(steer, ang) { pivots.forEach((p, i) => { if (p.front) p.steerG.rotation.y = -steer; p.spin.rotation.z = -ang[i]; });
      if (swG) { tq.setFromAxisAngle(swAxis, -steer * 7); swG.userData.inner.quaternion.copy(tq); } } };
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
  if (d.kind === 'tesla') { // real Model 3 layout: left third = driving visualisation + speed/gear, right = map
    const L = W * 0.36; g.fillStyle = '#16181c'; g.fillRect(0, 0, L, H); g.drawImage(navTex().image, L, 0, W - L, H);
    g.fillStyle = '#f2f3f5'; g.font = `700 ${H * 0.2 | 0}px Inter,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(String(kmh), L * 0.5, H * 0.26);
    g.font = `500 ${H * 0.055 | 0}px Inter,sans-serif`; g.fillStyle = '#8a9099'; g.fillText('KM/H', L * 0.5, H * 0.33);
    ['P', 'R', 'N', 'D'].forEach((k, i) => { g.fillStyle = k === gear ? '#f2f3f5' : '#4b5058'; g.font = `700 ${H * 0.06 | 0}px Inter,sans-serif`; g.fillText(k, L * 0.32 + i * L * 0.12, H * 0.08); });
    g.fillStyle = '#2b2e34'; g.beginPath(); g.moveTo(L * 0.18, H); g.lineTo(L * 0.44, H * 0.4); g.lineTo(L * 0.56, H * 0.4); g.lineTo(L * 0.82, H); g.fill();
    g.strokeStyle = '#6b7079'; g.lineWidth = 2; g.setLineDash([10, 10]); g.lineDashOffset = -(performance.now() / 1000 * kmh) % 20; for (const sx of [0.32, 0.68]) { g.beginPath(); g.moveTo(L * sx, H); g.lineTo(L * (0.5 + (sx - 0.5) * 0.25), H * 0.42); g.stroke(); } g.setLineDash([]);
    g.fillStyle = '#d8dbe0'; g.beginPath(); g.roundRect(L * 0.42, H * 0.66, L * 0.16, H * 0.24, 8); g.fill(); g.fillStyle = '#9aa0a8'; g.fillRect(L * 0.44, H * 0.72, L * 0.12, H * 0.06);
    g.fillStyle = '#3ddc84'; g.fillRect(L * 0.08, H * 0.94, L * 0.22, H * 0.02); g.fillStyle = '#8a9099'; g.font = `500 ${H * 0.045 | 0}px Inter,sans-serif`; g.textAlign = 'left'; g.fillText('82%', L * 0.33, H * 0.965);
    g.fillStyle = 'rgba(10,12,16,.85)'; g.fillRect(0, H * 0.985, W, H * 0.015); D.tex.needsUpdate = true; return; }
  if (d.kind === 'peugeot') { g.fillStyle = '#06080c'; g.fillRect(0, 0, W, H); const pw = Math.max(-0.3, Math.min(1, rpm / 10500));
    g.strokeStyle = '#1a2a3a'; g.lineWidth = H * 0.1; g.beginPath(); g.arc(W * 0.22, H * 0.62, H * 0.38, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
    g.strokeStyle = '#2ec4ff'; g.beginPath(); g.arc(W * 0.22, H * 0.62, H * 0.38, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * pw)); g.stroke();
    g.fillStyle = '#fff'; g.font = `800 ${H * 0.42 | 0}px Inter,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(kmh), W * 0.5, H * 0.5);
    g.font = `600 ${H * 0.13 | 0}px Inter,sans-serif`; g.fillStyle = '#8fa3b8'; g.fillText('km/h', W * 0.5, H * 0.85); g.fillStyle = '#2ec4ff'; g.font = `800 ${H * 0.26 | 0}px Inter,sans-serif`; g.fillText(gear, W * 0.82, H * 0.5);
    D.tex.needsUpdate = true; }
}
