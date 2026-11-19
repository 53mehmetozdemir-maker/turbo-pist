// Shared procedural props: trees, people, street lamps.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- small value noise ----
function hash(x, y, z) { let h = x * 374761393 + y * 668265263 + z * 2147483647; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf); let r = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) r += hash(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  return r; }
const fbm = (x, y, z) => vnoise(x, y, z) * 0.6 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.1;
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const prep = g => { const n = g.index ? g.toNonIndexed() : g; return n; };
function setColor(g, f) { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const col = f(p.getX(i), p.getY(i), p.getZ(i)); c.set(col, i * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }
function sphUV(g, yc) { const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = (Math.atan2(p.getZ(i), p.getX(i)) / (Math.PI * 2) + 0.5) * 3; uv[i * 2 + 1] = (p.getY(i) - yc) / 1.5; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; }
function stripUV(g) { if (g.attributes.uv) g.deleteAttribute('uv'); return g; }

// leafy canvas texture used on crowns (gives clumps of leaves instead of flat plastic)
let _leaf = null;
export function leafTex() {
  if (_leaf) return _leaf; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#7f8f6a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const x = Math.random() * 256, y = Math.random() * 256, l = 50 + Math.random() * 120 | 0;
    g.fillStyle = `rgb(${l * 0.85 | 0},${l},${l * 0.7 | 0})`; g.save(); g.translate(x, y); g.rotate(Math.random() * 6.3); g.beginPath(); g.ellipse(0, 0, 5 + Math.random() * 4, 2.2 + Math.random() * 1.5, 0, 0, 7); g.fill(); g.restore(); }
  _leaf = new THREE.CanvasTexture(c); _leaf.wrapS = _leaf.wrapT = THREE.RepeatWrapping; _leaf.colorSpace = THREE.SRGBColorSpace; return _leaf;
}

// ---- deciduous tree: trunk with branches + lumpy multi-lobe crown ----
export function broadleafGeos(det = 1, variant = 0) {
  seed = 11 + variant * 97;
  const tr = []; const trunkH = 2.4;
  const t = new THREE.CylinderGeometry(0.13, 0.22, trunkH + 0.6, 7, 3); t.translate(0, (trunkH + 0.6) / 2, 0);
  { const p = t.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 1.7 + variant) * 0.05); } }
  tr.push(prep(t));
  for (let k = 0; k < 4; k++) { const a = k * 1.6 + rnd(), len = 1.2 + rnd() * 0.6; const b = new THREE.CylinderGeometry(0.04, 0.09, len, 5); b.translate(0, len / 2, 0); b.rotateZ(0.65 + rnd() * 0.3); b.rotateY(a); b.translate(0, trunkH - 0.2 + rnd() * 0.5, 0); tr.push(prep(b)); }
  const trunk = stripUV(mergeGeometries(tr.map(stripUV)));
  const cr = []; const lobes = 7 + Math.floor(rnd() * 3);
  for (let k = 0; k < lobes; k++) {
    const a = rnd() * Math.PI * 2, r = k === 0 ? 0 : 0.7 + rnd() * 0.9, y = 4.1 + (k === 0 ? 0.3 : (rnd() - 0.35) * 1.6), s = k === 0 ? 1.7 : 1.0 + rnd() * 0.6;
    const g = new THREE.IcosahedronGeometry(s, det >= 2 ? 2 : 1); g.scale(1, 0.85, 1); g.translate(Math.cos(a) * r, y, Math.sin(a) * r); cr.push(prep(g)); }
  let crown = mergeGeometries(cr.map(g => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g; })); crown = mergeVertices(crown, 1e-4);
  const p = crown.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const dx = x, dy = y - 4.2, dz = z; const l = Math.hypot(dx, dy, dz) || 1;
    const n = (fbm(x * 1.3 + variant * 5, y * 1.3, z * 1.3) - 0.5) * 0.7; p.setXYZ(i, x + dx / l * n, y + dy / l * n, z + dz / l * n); }
  crown.computeVertexNormals(); sphUV(crown, 4.2);
  setColor(crown, (x, y, z) => { const r = Math.hypot(x, z), h = (y - 2.6) / 3.6; const ao = Math.max(0.35, Math.min(1, 0.45 + h * 0.55 + r * 0.12)); const v = 0.85 + fbm(x * 2, y * 2, z * 2) * 0.3; return [ao * v * 0.92, ao * v, ao * v * 0.82]; });
  return { trunk, crown };
}
// ---- conifer: stacked drooping tiers ----
export function coniferGeos(det = 1, variant = 0) {
  seed = 31 + variant * 53;
  const t = new THREE.CylinderGeometry(0.1, 0.22, 3.2, 6); t.translate(0, 1.6, 0); const trunk = stripUV(prep(t));
  const tiers = []; const n = 6;
  for (let k = 0; k < n; k++) { const f = k / (n - 1); const r = 2.3 * (1 - f * 0.82), h = 2.2 - f * 0.9, y = 1.6 + f * 5.6;
    const c = new THREE.ConeGeometry(r, h, det >= 1 ? 10 : 7, 2, true); c.translate(0, y + h / 2, 0);
    const p = c.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), yy = p.getY(i), z = p.getZ(i); const rr = Math.hypot(x, z); const droop = rr / r; const nn = (vnoise(x * 2 + k, yy * 2, z * 2 + variant) - 0.5) * 0.35 * r;
      p.setXYZ(i, x + x / (rr || 1) * nn, yy - droop * droop * 0.35, z + z / (rr || 1) * nn); }
    tiers.push(prep(c)); }
  let crown = mergeGeometries(tiers.map(g => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g; })); crown = mergeVertices(crown, 1e-4); crown.computeVertexNormals(); sphUV(crown, 4);
  setColor(crown, (x, y, z) => { const rr = Math.hypot(x, z); const ao = Math.max(0.35, Math.min(1, 0.5 + rr * 0.22 + (y - 2) * 0.05)); return [ao * 0.7, ao * 0.9, ao * 0.72]; });
  return { trunk, crown };
}
export function treeMaterials() {
  const lt = leafTex(); lt.repeat.set(2, 2);
  return { bark: new THREE.MeshStandardMaterial({ color: 0x3e3329, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ map: lt, bumpMap: lt, bumpScale: 2.5, vertexColors: true, roughness: 0.95, color: 0xffffff }),
    needle: new THREE.MeshStandardMaterial({ map: lt, bumpMap: lt, bumpScale: 2.0, vertexColors: true, roughness: 0.95, color: 0x8aa080 }) };
}

// ---- people ----
// returns geometries in a standing pose; origin at the feet. Colour channels: white = tintable (instance colour)
export function personGeos(det = 1) {
  const seg = det >= 1 ? 8 : 6;
  // leg (hip pivot at origin, extends down 0.86): trousers tintable, shoe dark
  const leg = new THREE.CapsuleGeometry(0.068, 0.7, 3, seg); leg.translate(0, -0.42, 0);
  { const p = leg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + Math.max(0, y + 0.35) * 0.35; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
  setColor(leg, () => [1, 1, 1]);
  const shoe = new THREE.BoxGeometry(0.11, 0.08, 0.26); shoe.translate(0, -0.84, 0.05); setColor(shoe, () => [0.12, 0.12, 0.13]);
  const legG = mergeGeometries([stripUV(prep(leg)), stripUV(prep(shoe))]);
  // torso: lathe profile hips->waist->chest->shoulders
  const prof = [[0.0, 0.84], [0.16, 0.86], [0.165, 0.95], [0.15, 1.08], [0.18, 1.25], [0.2, 1.38], [0.17, 1.45], [0.06, 1.48], [0.0, 1.49]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.LatheGeometry(prof, seg + 2); torso.scale(1.08, 1, 0.62); setColor(torso, (x, y) => (y < 0.93 ? [0.55, 0.55, 0.58] : [1, 1, 1]));   // belt line slightly darker
  // head + neck (skin)
  const head = new THREE.SphereGeometry(0.105, seg + 2, seg); head.scale(0.88, 1.12, 1.0); head.translate(0, 1.64, 0.01);
  const neck = new THREE.CylinderGeometry(0.045, 0.052, 0.12, 8); neck.translate(0, 1.5, 0);
  const nose = new THREE.ConeGeometry(0.018, 0.04, 5); nose.rotateX(Math.PI / 2); nose.translate(0, 1.63, 0.115);
  const headG = mergeGeometries([stripUV(prep(head)), stripUV(prep(neck)), stripUV(prep(nose))]);
  // hair cap
  const hair = new THREE.SphereGeometry(0.113, seg + 2, seg, 0, Math.PI * 2, 0, Math.PI * 0.55); hair.scale(0.9, 1.12, 1.03); hair.translate(0, 1.655, -0.005);
  const hairG = stripUV(prep(hair));
  // arm (shoulder pivot at origin): sleeve tintable
  const arm = new THREE.CapsuleGeometry(0.048, 0.5, 3, seg - 2); arm.translate(0, -0.29, 0); const armG = stripUV(prep(arm));
  const hand = new THREE.SphereGeometry(0.045, 7, 5); hand.scale(0.8, 1.2, 0.6); hand.translate(0, -0.6, 0); const handG = stripUV(prep(hand));
  return { leg: legG, torso: stripUV(prep(torso)), head: headG, hair: hairG, arm: armG, hand: handG };
}
// seated spectator as one merged mesh with baked colours (tintable shirt, skin head, dark legs)
export function spectatorGeo() {
  const P = personGeos(0);
  const t = P.torso.clone(); t.translate(0, -0.4, 0);
  const h = P.head.clone(); h.translate(0, -0.4, 0); setColor(h, () => [0.95, 0.75, 0.6]);
  const hair = P.hair.clone(); hair.translate(0, -0.4, 0); setColor(hair, () => [0.15, 0.1, 0.07]);
  const thigh = new THREE.BoxGeometry(0.32, 0.14, 0.42); thigh.translate(0, 0.42, 0.18); setColor(thigh, () => [0.18, 0.2, 0.26]);
  const shin = new THREE.BoxGeometry(0.28, 0.42, 0.12); shin.translate(0, 0.21, 0.38); setColor(shin, () => [0.18, 0.2, 0.26]);
  const arms = []; for (const s of [-1, 1]) { const a = new THREE.CapsuleGeometry(0.045, 0.36, 2, 5); a.rotateX(-0.5); a.translate(s * 0.2, 0.75, 0.1); setColor(a, () => [1, 1, 1]); arms.push(stripUV(prep(a))); }
  return mergeGeometries([t, h, hair, stripUV(prep(thigh)), stripUV(prep(shin)), ...arms].map(g => { if (!g.attributes.color) setColor(g, () => [1, 1, 1]); return g; }));
}

// ---- street lamp: plinth, tapered pole, curved arm, luminaire ----
export function lampGeos() {
  const parts = [];
  const base = new THREE.CylinderGeometry(0.2, 0.24, 0.6, 10); base.translate(0, 0.3, 0); parts.push(base);
  const ring = new THREE.CylinderGeometry(0.15, 0.2, 0.12, 10); ring.translate(0, 0.66, 0); parts.push(ring);
  const pole = new THREE.CylinderGeometry(0.065, 0.12, 7.4, 10); pole.translate(0, 0.6 + 3.7, 0); parts.push(pole);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 7.8, 0), new THREE.Vector3(0, 8.45, 0.25), new THREE.Vector3(0, 8.25, 1.85));
  parts.push(new THREE.TubeGeometry(curve, 10, 0.05, 6, false));
  const head = new THREE.CylinderGeometry(0.22, 0.3, 0.14, 12); head.scale(1, 1, 2.1); head.translate(0, 8.2, 2.05); parts.push(head);
  const metal = mergeGeometries(parts.map(g => stripUV(prep(g))));
  const glass = new THREE.CylinderGeometry(0.24, 0.24, 0.03, 12); glass.scale(1, 1, 2.0); glass.translate(0, 8.12, 2.05);
  return { metal, glass: stripUV(prep(glass)) };
}
// traffic signal mast: pole, base, mast arm, signal head with visors and backboard
export function signalGeos() {
  const parts = [];
  const base = new THREE.CylinderGeometry(0.2, 0.26, 0.45, 10); base.translate(0, 0.22, 0); parts.push(base);
  const pole = new THREE.CylinderGeometry(0.1, 0.15, 6.2, 10); pole.translate(0, 3.1, 0); parts.push(pole);
  const arm = new THREE.CylinderGeometry(0.06, 0.09, 6.6, 8); arm.rotateX(Math.PI / 2); arm.translate(0, 5.95, -3.3); parts.push(arm);
  const brace = new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6); brace.rotateX(Math.PI / 2 - 0.42); brace.translate(0, 5.45, -1.1); parts.push(brace);
  const box = new THREE.BoxGeometry(0.34, 1.02, 0.36); box.translate(0.0, 5.3, -5.2); parts.push(box);
  const board = new THREE.BoxGeometry(0.04, 1.3, 0.62); board.translate(0.19, 5.3, -5.2); parts.push(board);
  for (let k = 0; k < 3; k++) { const v = new THREE.CylinderGeometry(0.14, 0.14, 0.2, 10, 1, true, -Math.PI / 2, Math.PI); v.rotateZ(Math.PI / 2); v.rotateX(Math.PI); v.translate(-0.27, 5.66 - k * 0.33 + 0.05, -5.2); parts.push(v); }
  // small pedestrian signal on the pole
  const ped = new THREE.BoxGeometry(0.25, 0.5, 0.25); ped.translate(-0.2, 2.6, 0); parts.push(ped);
  return mergeGeometries(parts.map(g => stripUV(prep(g))));
}
