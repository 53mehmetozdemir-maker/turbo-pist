// Procedural Ducati Panigale V4 S (2022-24 shape, no logos) with a tucked rider.
// Car frame: +X forward, +Y up, +Z right, ground at y=0, origin midway between the axles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const A = 0.71, B = 0.759;                 // axle positions (wheelbase 1.469 m)
const RF = 0.300, RR = 0.336;               // 120/70 ZR17 front, 200/60 ZR17 rear
const HEAD = new THREE.Vector3(0.42, 0.97, 0);   // steering head (24° rake)

const ni = g => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
function between(geo, a, b) { const d = new THREE.Vector3().subVectors(b, a); const L = d.length(); geo.scale(1, L, 1); geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return geo; }
const tube = (a, b, r, seg = 8) => between(new THREE.CylinderGeometry(r, r, 1, seg), a, b);
const caps = (a, b, r) => { const L = a.distanceTo(b); const g = new THREE.CapsuleGeometry(r, Math.max(0.01, L), 4, 10); g.scale(1, 1 / (L + 2 * r) * (L + 2 * r), 1); const d = new THREE.Vector3().subVectors(b, a).normalize(); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g; };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// open-bottomed loft for fairing / tail: sections (x, halfWidth, yTop, yBottom)
function shell(secs, openDeg = 70, seg = 18) {
  const rings = secs.map(([x, w, yt, yb]) => { const pts = []; const mid = (yt + yb) / 2, hh = (yt - yb) / 2; const a0 = -Math.PI / 2 + openDeg * Math.PI / 360, a1 = Math.PI * 1.5 - openDeg * Math.PI / 360;
    for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; const c = Math.cos(a), s = Math.sin(a); const sc = Math.sign(c) * Math.pow(Math.abs(c), s < 0 ? 0.9 : 0.7), ss = Math.sign(s) * Math.pow(Math.abs(s), 0.85); pts.push([x, mid + hh * ss, w * sc]); } return pts; });
  const pos = [], idx = []; for (const r of rings) for (const p of r) pos.push(...p); const n = seg + 1;
  for (let s = 0; s < rings.length - 1; s++) for (let i = 0; i < seg; i++) { const a = s * n + i, bb = a + 1, c = a + n, d = c + 1; idx.push(a, bb, c, bb, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function tyre(R, wd) { const pts = []; const r0 = R - wd * 0.62; pts.push(new THREE.Vector2(r0, -wd / 2));
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI; pts.push(new THREE.Vector2(R - wd / 2 + Math.cos(a) * wd / 2, Math.sin(a) * wd / 2)); }
  pts.push(new THREE.Vector2(r0, wd / 2)); return new THREE.LatheGeometry(pts, 32).rotateX(Math.PI / 2); }
function rim(R, wd) { const parts = [new THREE.TorusGeometry(R, 0.012, 6, 32).translate(0, 0, wd / 2 - 0.01), new THREE.TorusGeometry(R, 0.012, 6, 32).translate(0, 0, -wd / 2 + 0.01), new THREE.CylinderGeometry(R, R, wd - 0.02, 32, 1, true).rotateX(Math.PI / 2),
    new THREE.CylinderGeometry(0.045, 0.045, wd + 0.04, 12).rotateX(Math.PI / 2)];
  for (let k = 0; k < 3; k++) for (const o of [-0.12, 0.12]) { const s = new THREE.BoxGeometry(0.022, R - 0.04, 0.02); s.translate(0, (R - 0.04) / 2 + 0.03, 0); s.rotateZ(k * Math.PI * 2 / 3 + o); parts.push(s); }
  return mergeGeometries(parts.map(ni)); }
const disc = r => { const g = new THREE.RingGeometry(0.05, r, 32); return mergeGeometries([g, g.clone().rotateY(Math.PI)].map(ni)); };

let _plate = null;
function plateTex() { if (_plate) return _plate; const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#f5f5f5'; g.beginPath(); g.ellipse(64, 64, 60, 56, 0, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = 'bold 92px Inter,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', 64, 70); _plate = new THREE.CanvasTexture(c); _plate.colorSpace = THREE.SRGBColorSpace; return _plate; }

// ---- smooth loft surface: sections [x, [[z,y], ...]] each a half profile from the top centre line outwards/down.
// Catmull-Rom across the ring (mirrored phantom at the centre line) and along the sections; mirrored to both sides.
const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
function crArr(arr, s, get) { const n = arr.length; const i = Math.min(n - 2, Math.max(0, Math.floor(s))), t = s - i;
  const P = k => get(arr[Math.max(0, Math.min(n - 1, k))], k); return cr(P(i - 1), P(i), P(i + 1), P(i + 2), t); }
function surfPt(secs, s, r) { // s: section param [0, n-1], r: ring param [0, m-1]
  const ring = k => { const sec = secs[Math.max(0, Math.min(secs.length - 1, k))]; const pts = sec[1]; const m = pts.length; const i = Math.min(m - 2, Math.max(0, Math.floor(r))), t = r - i;
    const q = j => j < 0 ? [-pts[-j][0], pts[-j][1]] : pts[Math.min(m - 1, j)]; const a = q(i - 1), b = q(i), c = q(i + 1), d = q(i + 2);
    return [sec[0], cr(a[1], b[1], c[1], d[1], t), Math.max(0, cr(a[0], b[0], c[0], d[0], t))]; };
  const n = secs.length; const i = Math.min(n - 2, Math.max(0, Math.floor(s))), t = s - i; const R = [ring(i - 1), ring(i), ring(i + 1), ring(i + 2)];
  if (i === 0) R[0] = R[1].map((v, k) => 2 * v - R[2][k]); if (i + 2 >= n) R[3] = R[2].map((v, k) => 2 * v - R[1][k]);
  return [0, 1, 2].map(k => cr(R[0][k], R[1][k], R[2][k], R[3][k], t)); }
function loft(secs, s0 = 0, s1 = secs.length - 1, r0 = 0, r1 = secs[0][1].length - 1, off = 0, ns = 0, nr = 0) {
  ns = ns || Math.max(2, Math.ceil((s1 - s0) * 7)); nr = nr || Math.max(2, Math.ceil((r1 - r0) * 6));
  const pos = [], idx = [];
  for (let a = 0; a <= ns; a++) for (let b = 0; b <= nr; b++) { const p = surfPt(secs, s0 + (s1 - s0) * a / ns, r0 + (r1 - r0) * b / nr); pos.push(p[0], p[1], p[2]); }
  const W = nr + 1; for (let a = 0; a < ns; a++) for (let b = 0; b < nr; b++) { const i = a * W + b; idx.push(i, i + W, i + 1, i + 1, i + W, i + W + 1); }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (off) { const P = g.attributes.position, N = g.attributes.normal; for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + N.getX(i) * off, P.getY(i) + N.getY(i) * off, P.getZ(i) + N.getZ(i) * off); }
  const m = g.clone(); m.scale(1, 1, -1); const mi = m.index.array; for (let i = 0; i < mi.length; i += 3) { const t = mi[i]; mi[i] = mi[i + 1]; mi[i + 1] = t; }
  g = mergeGeometries([g, m]); g.computeVertexNormals(); return g; }
// tapered box beam between two points (h = height at a/b, w = width)
function beam(a, b, h0, h1, w) { const g = new THREE.BoxGeometry(1, 1, w, 4, 1, 1); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i) + 0.5; P.setY(i, P.getY(i) * (h0 + (h1 - h0) * x)); P.setX(i, x); }
  const d = new THREE.Vector3().subVectors(b, a); g.scale(d.length(), 1, 1); g.rotateZ(Math.atan2(d.y, d.x)); g.translate(a.x, a.y, a.z); g.computeVertexNormals(); return g; }

// forged 5 split-spoke wheel
function rim2(R, wd) { const parts = [new THREE.TorusGeometry(R, 0.011, 6, 40).translate(0, 0, wd / 2 - 0.01), new THREE.TorusGeometry(R, 0.011, 6, 40).translate(0, 0, -wd / 2 + 0.01), new THREE.CylinderGeometry(R, R, wd - 0.02, 40, 1, true).rotateX(Math.PI / 2),
    new THREE.CylinderGeometry(0.055, 0.055, wd * 0.7, 16).rotateX(Math.PI / 2)];
  for (let k = 0; k < 3; k++) for (const o of [-0.2, 0.2]) { const s = beam(V3(0.05, 0, 0), V3(R - 0.004, 0, 0), 0.05, 0.022, 0.03); s.rotateZ(o); s.rotateZ(k * Math.PI * 2 / 3); parts.push(s); }
  for (let k = 0; k < 3; k++) { const s = beam(V3(0.05, 0, 0), V3(R * 0.55, 0, 0), 0.06, 0.04, 0.032); s.rotateZ(k * Math.PI * 2 / 3); parts.push(s); }
  return mergeGeometries(parts.map(ni)); }
function wavyDisc(r, ri) { const sh = new THREE.Shape(); const n = 24; for (let i = 0; i <= n * 4; i++) { const a = i / (n * 4) * Math.PI * 2; const rr = r - (Math.sin(a * n) > 0.3 ? 0.006 : 0); i ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const h = new THREE.Path(); h.absarc(0, 0, ri, 0, Math.PI * 2, true); sh.holes.push(h); for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2, rr = (r + ri) / 2 + (k % 2) * 0.012; const p = new THREE.Path(); p.absarc(Math.cos(a) * rr, Math.sin(a) * rr, 0.0045, 0, Math.PI * 2, true); sh.holes.push(p); }
  return new THREE.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -0.0025); }

export function buildBike(color) {
  const root = new THREE.Group(); const leanG = new THREE.Group(); root.add(leanG); const body = new THREE.Group(); leanG.add(body);
  const DS = THREE.DoubleSide;
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1, side: DS });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xeef0f2, metalness: 0.1, roughness: 0.32, clearcoat: 1, envMapIntensity: 0.8, side: DS });
  const black = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.6, metalness: 0.1, side: DS });
  const satin = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.45, metalness: 0.35, side: DS });
  const carbon = new THREE.MeshPhysicalMaterial({ color: 0x18191c, roughness: 0.3, metalness: 0.4, clearcoat: 1, side: DS });
  const alu = new THREE.MeshStandardMaterial({ color: 0xa4aab2, roughness: 0.32, metalness: 0.9 });
  const engM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 });
  const ti = new THREE.MeshStandardMaterial({ color: 0x7d7f86, roughness: 0.22, metalness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a62a, roughness: 0.25, metalness: 1 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.35, metalness: 0.7 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.88 });
  const discM = new THREE.MeshStandardMaterial({ color: 0xc2c6cc, roughness: 0.28, metalness: 1, side: DS });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x2a3540, roughness: 0.02, transparent: true, opacity: 0.5, clearcoat: 1, side: DS, depthWrite: false });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff0800, emissiveIntensity: 0.6, roughness: 0.15, toneMapped: false, side: DS });
  const headMat = new THREE.MeshPhysicalMaterial({ color: 0xc8d0d8, emissive: 0xfff1d6, emissiveIntensity: 0.15, roughness: 0.08, metalness: 0.85, clearcoat: 1, side: DS });
  const add = (g, m, p = body, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; p.add(o); return o; };

  // --- bodywork (full fairing, tank, seat unit) ---
  const FAIR = [
    [0.985, [[0, 0.785], [0.012, 0.783], [0.02, 0.770], [0.016, 0.752]]],
    [0.93, [[0, 0.838], [0.05, 0.830], [0.072, 0.795], [0.06, 0.730]]],
    [0.84, [[0, 0.900], [0.085, 0.885], [0.125, 0.825], [0.105, 0.690]]],
    [0.72, [[0, 0.955], [0.12, 0.935], [0.175, 0.850], [0.155, 0.668]]],
    [0.58, [[0, 1.000], [0.145, 0.975], [0.205, 0.860], [0.19, 0.640]]],
    [0.46, [[0, 1.010], [0.16, 0.985], [0.218, 0.840], [0.205, 0.585]]],
    [0.36, [[0, 0.990], [0.16, 0.965], [0.222, 0.780], [0.205, 0.420]]],
    [0.22, [[0, 0.930], [0.15, 0.910], [0.212, 0.700], [0.195, 0.310]]],
    [0.08, [[0, 0.860], [0.13, 0.840], [0.185, 0.640], [0.170, 0.320]]]];
  add(loft(FAIR, 0, 8, 1.0, 3), paint);                                  // fairing sides & nose (top under the screen/tank is open)
  add(loft(FAIR, 0, 3.4, 0, 1.0), paint);                                  // nose top
  add(loft(FAIR, 5.9, 7.2, 2.0, 2.3, 0.003), satin, body, false);         // side duct
  add(loft(FAIR, 0.5, 1.9, 1.35, 2.25, 0.003), black, body, false);      // intake under the lights
  add(loft(FAIR, 0.55, 1.85, 1.38, 1.62, 0.005), headMat, body, false);   // slim DRL / headlight blade
  add(loft(FAIR, 5.2, 7.6, 2.6, 3.0, 0.003), black, body, false);         // lower side opening (radiator)
  for (const s of [-1, 1]) for (const [x0, y0, sp] of [[0.76, 0.72, 0.075], [0.68, 0.68, 0.065]]) { const w = new THREE.BoxGeometry(0.14, 0.016, sp); w.translate(0, 0, s * sp / 2); w.rotateY(s * -0.2); w.rotateX(s * 0.25); w.translate(x0, y0, s * 0.16); add(w, carbon, body, false); }   // winglets
  const TANK = [
    [0.50, [[0, 0.985], [0.10, 0.980], [0.17, 0.93], [0.17, 0.83]]],
    [0.38, [[0, 1.040], [0.13, 1.025], [0.20, 0.95], [0.19, 0.82]]],
    [0.22, [[0, 1.045], [0.14, 1.025], [0.205, 0.94], [0.18, 0.80]]],
    [0.08, [[0, 1.000], [0.13, 0.985], [0.185, 0.90], [0.16, 0.78]]],
    [-0.02, [[0, 0.915], [0.11, 0.905], [0.15, 0.86], [0.13, 0.78]]]];
  add(loft(TANK), paint);
  const SEAT = [[0.0, [[0, 0.905], [0.08, 0.90], [0.125, 0.87], [0.12, 0.82]]], [-0.18, [[0, 0.885], [0.10, 0.88], [0.135, 0.85], [0.13, 0.80]]], [-0.40, [[0, 0.895], [0.09, 0.89], [0.12, 0.86], [0.11, 0.82]]]];
  add(loft(SEAT), satin);
  const TAIL = [
    [-0.30, [[0, 0.885], [0.115, 0.88], [0.15, 0.845], [0.135, 0.78]]],
    [-0.50, [[0, 0.965], [0.10, 0.96], [0.13, 0.91], [0.115, 0.83]]],
    [-0.66, [[0, 1.02], [0.08, 1.015], [0.105, 0.97], [0.09, 0.89]]],
    [-0.78, [[0, 1.05], [0.05, 1.047], [0.07, 1.015], [0.06, 0.955]]],
    [-0.81, [[0, 1.05], [0.03, 1.048], [0.045, 1.025], [0.04, 0.985]]]];
  add(loft(TAIL), paint);
  add(loft(TAIL, 0.05, 1.3, 0.0, 0.9, 0.005), satin, body, false);                                     // black rider seat
  const cowl = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2); cowl.scale(0.13, 0.05, 0.095); cowl.translate(-0.62, 1.0, 0); add(cowl, paint);   // red pillion cowl
  for (const s of [-1, 1]) { const led = new THREE.BoxGeometry(0.22, 0.012, 0.01); led.rotateZ(-0.33); led.translate(-0.70, 0.94, s * 0.083); add(led, brakeMat, body, false); }   // LED tail strips along the cut-outs
  // seat-unit underside and tail light
  add(shell([[-0.36, 0.12, 0.81, 0.77], [-0.80, 0.04, 0.99, 0.97]], 300, 8), black, body, false);
  const tl = new THREE.BoxGeometry(0.012, 0.02, 0.07); tl.translate(-0.812, 1.012, 0); add(tl, brakeMat, body, false);
  for (const s of [-1, 1]) { const ind = new THREE.BoxGeometry(0.035, 0.012, 0.018); ind.translate(-0.74, 0.70, s * 0.07); add(ind, new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xff8800, emissiveIntensity: 0.3 }), body, false); }
  add(beam(V3(-0.42, 0.8, 0), V3(-0.74, 0.70, 0), 0.03, 0.02, 0.05), black);   // number-plate hugger arm
  add(new THREE.BoxGeometry(0.008, 0.11, 0.17).translate(-0.74, 0.64, 0), black); add(new THREE.BoxGeometry(0.004, 0.09, 0.15).translate(-0.745, 0.64, 0), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 }));
  // belly pan
  add(shell([[0.38, 0.17, 0.36, 0.20], [0.18, 0.19, 0.33, 0.16], [-0.06, 0.15, 0.36, 0.22]], 200, 12), paint, body, false);
  // windscreen (smoked, curved)
  add(loft([[0.80, [[0, 0.915], [0.06, 0.905], [0.105, 0.885]]], [0.66, [[0, 1.05], [0.075, 1.035], [0.13, 0.985]]], [0.54, [[0, 1.125], [0.07, 1.11], [0.125, 1.05]]], [0.50, [[0, 1.135], [0.06, 1.125], [0.11, 1.08]]]]), glass, body, false);
  // race number on the tail sides

  add(new THREE.BoxGeometry(0.05, 0.28, 0.36).rotateZ(0.2).translate(0.36, 0.52, 0), satin);   // radiator
  // --- twin-spar frame, engine, swingarm, exhaust ---
  const frameM = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.4, metalness: 0.6 });   // Urban Grey 'front frame'
  for (const s of [-1, 1]) { add(beam(V3(0.42, 0.92, s * 0.07), V3(0.12, 0.80, s * 0.17), 0.1, 0.12, 0.04), frameM);
    add(beam(V3(-0.05, 0.80, s * 0.11), V3(-0.55, 0.84, s * 0.08), 0.03, 0.02, 0.02), black); }       // subframe
  add(shell([[0.02, 0.15, 0.86, 0.56], [-0.18, 0.14, 0.86, 0.6], [-0.40, 0.11, 0.88, 0.72]], 200, 12), satin, body, false);   // covers under the seat (airbox / shock)
  const crank = new THREE.BoxGeometry(0.34, 0.24, 0.30); crank.translate(0.12, 0.36, 0); add(crank, engM);
  const engG = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.42, metalness: 0.7 }), camM = new THREE.MeshStandardMaterial({ color: 0x8c8f95, roughness: 0.3, metalness: 0.9 });
  const fb = new THREE.BoxGeometry(0.22, 0.2, 0.30); fb.rotateZ(1.3); fb.translate(0.30, 0.42, 0); add(fb, engG);                 // front bank (near horizontal)
  const rb2 = new THREE.BoxGeometry(0.2, 0.24, 0.30); rb2.rotateZ(-0.27); rb2.translate(0.03, 0.62, 0); add(rb2, engG);           // rear bank (near vertical)
  for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.15, 0.04, 0.07).rotateZ(-0.27).translate(0.0, 0.75, s * 0.08), camM); add(new THREE.BoxGeometry(0.04, 0.14, 0.07).rotateZ(1.3 - Math.PI / 2).translate(0.43, 0.46, s * 0.08), camM); }
  for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.17, 0.004, 0.31).translate(0.12, 0.27 + k * 0.03, 0), engG);   // case ribs
  add(new THREE.BoxGeometry(0.2, 0.06, 0.2).translate(0.12, 0.2, 0), engG);   // sump
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 28).rotateX(Math.PI / 2).translate(0.03, 0.40, 0.165), new THREE.MeshStandardMaterial({ color: 0xc9bea6, roughness: 0.45, metalness: 0.5 }));   // champagne clutch cover
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20).rotateX(Math.PI / 2).translate(0.16, 0.36, -0.16), satin);    // alternator cover
  for (let k = 0; k < 4; k++) { const z = -0.105 + k * 0.07; add(tube(V3(0.34, 0.60, z), V3(0.42, 0.40, z * 0.8), 0.018), ti); add(tube(V3(0.42, 0.40, z * 0.8), V3(0.30, 0.17, z * 0.4), 0.018), ti); }
  add(beam(V3(0.25, 0.20, 0), V3(-0.30, 0.24, 0), 0.10, 0.08, 0.24), engM);                     // under-engine silencer
  for (const s of [-1, 1]) add(beam(V3(0.10, 0.21, s * 0.125), V3(-0.28, 0.25, s * 0.125), 0.06, 0.045, 0.01), new THREE.MeshStandardMaterial({ color: 0x55575d, roughness: 0.35, metalness: 0.9 }));   // titanium heat shields
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12).rotateZ(Math.PI / 2).translate(-0.33, 0.24, s * 0.06), ti);
  add(beam(V3(-0.12, 0.45, -0.13), V3(-B, RR, -0.11), 0.13, 0.09, 0.06), engM);   // single-sided swingarm
  add(beam(V3(-0.14, 0.40, -0.13), V3(-0.45, 0.33, -0.12), 0.07, 0.05, 0.04), engM);
  add(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 20).rotateX(Math.PI / 2).translate(-B, RR, -0.1), engM);   // eccentric hub
  add(tube(V3(-0.12, 0.45, -0.14), V3(-0.12, 0.45, 0.14), 0.035), alu);
  add(tube(V3(-0.10, 0.62, 0), V3(-0.22, 0.42, 0), 0.028), gold); add(tube(V3(-0.13, 0.57, 0), V3(-0.19, 0.47, 0), 0.04), satin);   // rear shock + spring
  for (const s of [-1, 1]) { add(tube(V3(-0.17, 0.40, s * 0.12), V3(-0.17, 0.40, s * 0.21), 0.011), alu); add(beam(V3(-0.10, 0.48, s * 0.13), V3(-0.22, 0.36, s * 0.13), 0.05, 0.03, 0.012), alu); }   // rearsets
  add(tube(V3(0.0, 0.34, -0.155), V3(-B, RR + 0.06, -0.155), 0.008, 4), satin); add(tube(V3(0.0, 0.28, -0.155), V3(-B, RR - 0.06, -0.155), 0.008, 4), satin);   // chain
  add(new THREE.CylinderGeometry(0.085, 0.085, 0.008, 32).rotateX(Math.PI / 2).translate(-B, RR, -0.155), satin);
  // --- mirrors (on the fairing), TFT dash ---
  const mdefs = { L: { c: [0.568, 1.03, -0.28], n: [-1, 0, 0], w: 0.108, h: 0.047, fixed: true, ellipse: true } };
  for (const s of [-1, 1]) { const hs = new THREE.SphereGeometry(1, 20, 12, Math.PI / 2, Math.PI); hs.scale(0.03, 0.026, 0.058); hs.translate(0.57, 1.03, s * 0.28); add(hs, black); const rim = new THREE.TorusGeometry(1, 0.06, 6, 32); rim.rotateY(Math.PI / 2); rim.scale(0.05, 0.026, 0.058); rim.translate(0.5695, 1.03, s * 0.28); add(rim, black); add(beam(V3(0.62, 0.95, s * 0.19), V3(0.58, 1.02, s * 0.255), 0.02, 0.015, 0.012), black); }
  const dcv = document.createElement('canvas'); dcv.width = 256; dcv.height = 150; const dtex = new THREE.CanvasTexture(dcv); dtex.colorSpace = THREE.SRGBColorSpace;
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.076), new THREE.MeshBasicMaterial({ map: dtex, toneMapped: false })); dash.position.set(0.53, 1.02, 0); dash.lookAt(0.28, 1.21, 0); body.add(dash);
  const dh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.03), black); dh.position.set(0.53, 1.02, 0); dh.lookAt(0.28, 1.21, 0); dh.translateZ(-0.017); body.add(dh);
  // --- front end: steers about the head axis ---
  const steerAxis = new THREE.Vector3(A - HEAD.x, RF - HEAD.y, 0).normalize();
  const front = new THREE.Group(); front.position.copy(HEAD); body.add(front);
  const fl = (x, y, z) => V3(x - HEAD.x, y - HEAD.y, z);
  for (const s of [-1, 1]) { add(tube(fl(0.43, 1.0, s * 0.1), fl(0.55, 0.70, s * 0.1), 0.027, 14), gold, front); add(tube(fl(0.55, 0.70, s * 0.1), fl(A, RF, s * 0.1), 0.031, 14), satin, front);
    add(new THREE.BoxGeometry(0.07, 0.05, 0.025).translate(...fl(A - 0.01, RF + 0.01, s * 0.1).toArray()), satin, front); }
  add(new THREE.BoxGeometry(0.1, 0.025, 0.26).translate(...fl(0.43, 1.005, 0).toArray()), alu, front);
  add(new THREE.BoxGeometry(0.08, 0.025, 0.24).translate(...fl(0.47, 0.90, 0).toArray()), alu, front);
  for (const s of [-1, 1]) { add(tube(fl(0.43, 0.985, s * 0.11), fl(0.39, 0.975, s * 0.24), 0.011), black, front); add(tube(fl(0.39, 0.975, s * 0.21), fl(0.38, 0.973, s * 0.27), 0.017), rubber, front);
    add(new THREE.SphereGeometry(0.012, 8, 6).translate(...fl(0.38, 0.973, s * 0.275).toArray()), alu, front); }
  const fender = shell([[A + 0.16, 0.06, RF + 0.04, RF + 0.025], [A + 0.05, 0.068, RF + 0.07, RF + 0.05], [A - 0.1, 0.066, RF + 0.05, RF + 0.03], [A - 0.2, 0.06, RF - 0.02, RF - 0.04]], 170, 10); fender.translate(-HEAD.x, -HEAD.y, 0); add(fender, carbon, front);
  const fw = new THREE.Group(); fw.position.copy(fl(A, RF, 0)); front.add(fw); const fspin = new THREE.Group(); fw.add(fspin);
  add(tyre(RF, 0.12), rubber, fspin); add(rim2(RF - 0.085, 0.085), rimM, fspin);
  for (const s of [-1, 1]) { add(wavyDisc(0.16, 0.10).translate(0, 0, s * 0.062), discM, fspin, false); add(new THREE.CylinderGeometry(0.1, 0.1, 0.004, 24, 1, true).rotateX(Math.PI / 2).translate(0, 0, s * 0.062), gold, fspin, false);
    const cal = beam(V3(-0.05, 0.13, 0), V3(-0.15, 0.03, 0), 0.05, 0.04, 0.032); cal.translate(0, 0, s * 0.082); add(cal, alu, fw); }
  // --- rear wheel ---
  const rw = new THREE.Group(); rw.position.set(-B, RR, 0); body.add(rw); const rspin = new THREE.Group(); rw.add(rspin);
  add(tyre(RR, 0.19), rubber, rspin); add(rim2(RR - 0.105, 0.14), rimM, rspin); add(wavyDisc(0.11, 0.065).translate(0, 0, -0.085), discM, rspin, false);
  add(beam(V3(-0.06, -0.03, -0.1), V3(-0.12, 0.03, -0.1), 0.04, 0.035, 0.025), alu, rw); add(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 6).rotateX(Math.PI / 2).translate(0, 0, 0.09), alu, rspin);
  // --- rider (tucked), hidden in the helmet camera ---
  const rider = new THREE.Group(); body.add(rider);
  const suit = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.55, metalness: 0.05 }), suitC = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.4 }), suitW = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.45 });
  const helmet = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f4, roughness: 0.22, clearcoat: 1 }), visor = new THREE.MeshPhysicalMaterial({ color: 0x0b0d12, roughness: 0.04, metalness: 0.75, clearcoat: 1 });
  const hip = V3(-0.30, 1.0, 0), sh0 = V3(0.13, 1.15, 0);
  const torso = caps(hip, sh0, 0.15); torso.scale(1, 0.85, 1.25); torso.translate(0, (hip.y + sh0.y) / 2 * 0.15, 0); add(torso, suit, rider);
  const back = caps(V3(-0.24, 1.07, 0), V3(0.06, 1.19, 0), 0.1); back.scale(1, 0.8, 1.05); back.translate(0, 0.2, 0); add(back, suitC, rider);   // coloured back panel
  const hump = new THREE.SphereGeometry(1, 16, 10); hump.scale(0.14, 0.07, 0.09); hump.rotateZ(0.35); hump.translate(0.06, 1.25, 0); add(hump, suit, rider);   // aero hump
  add(new THREE.CylinderGeometry(0.055, 0.06, 0.08, 12).rotateZ(-1.1).translate(0.21, 1.2, 0), suit, rider);   // neck
  const hl = new THREE.SphereGeometry(0.14, 24, 16); hl.scale(1.12, 0.98, 0.93); hl.translate(0.30, 1.235, 0); add(hl, helmet, rider);
  const chin = new THREE.SphereGeometry(0.1, 16, 10); chin.scale(0.9, 0.7, 0.95); chin.translate(0.38, 1.17, 0); add(chin, helmet, rider);
  const vz = new THREE.SphereGeometry(0.142, 24, 10, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.36, Math.PI * 0.2); vz.rotateY(Math.PI / 2); vz.scale(1.12, 0.98, 0.93); vz.translate(0.30, 1.235, 0); add(vz, visor, rider);
  const spoiler = new THREE.BoxGeometry(0.08, 0.02, 0.14); spoiler.rotateZ(0.3); spoiler.translate(0.17, 1.33, 0); add(spoiler, helmet, rider);
  for (const s of [-1, 1]) { const shp = V3(0.12, 1.16, s * 0.19), el = V3(0.27, 1.0, s * 0.235), hd = V3(0.385, 0.985, s * 0.245);
    add(new THREE.SphereGeometry(0.062, 12, 10).translate(shp.x, shp.y + 0.01, shp.z), suit, rider);
    add(caps(shp, el, 0.052), suit, rider); add(caps(el, hd, 0.043), suit, rider); add(new THREE.SphereGeometry(0.045, 10, 8).translate(el.x, el.y - 0.01, el.z + s * 0.01), suitW, rider);
    const glove = new THREE.SphereGeometry(1, 10, 8); glove.scale(0.055, 0.035, 0.04); glove.translate(hd.x, hd.y + 0.005, hd.z); add(glove, black, rider);
    const kn = V3(0.07, 0.80, s * 0.235), ft = V3(-0.17, 0.42, s * 0.19);
    add(caps(V3(-0.27, 0.97, s * 0.11), kn, 0.075), suit, rider); add(caps(kn, ft, 0.052), suit, rider);
    add(caps(V3(-0.22, 0.95, s * 0.14), V3(0.0, 0.84, s * 0.22), 0.05), suitC, rider);   // coloured thigh panel
    const boot = new THREE.BoxGeometry(0.21, 0.08, 0.075); boot.rotateZ(-0.35); boot.translate(ft.x + 0.0, ft.y - 0.02, ft.z); add(boot, black, rider);
    add(caps(V3(-0.1, 0.55, s * 0.205), ft, 0.058), black, rider);
    const kp = new THREE.SphereGeometry(1, 10, 8); kp.scale(0.06, 0.05, 0.03); kp.translate(kn.x + 0.03, kn.y - 0.03, s * 0.29); add(kp, suitW, rider); }
  // soft contact shadow
  const sc = document.createElement('canvas'); sc.width = 128; sc.height = 32; const sg = sc.getContext('2d'); sg.filter = 'blur(6px)'; sg.fillStyle = 'rgba(0,0,0,.75)'; sg.beginPath(); sg.ellipse(64, 16, 52, 8, 0, 0, 7); sg.fill();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; shadow.renderOrder = 2; root.add(shadow);
  // nitro flame from the can
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.45, 10).rotateZ(Math.PI / 2 + 0.5), new THREE.MeshBasicMaterial({ color: 0x66b3ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.set(-0.62, 0.50, 0.17); flame.visible = false; body.add(flame);

  const stand = new THREE.Group(); body.add(stand); add(tube(V3(-0.02, 0.36, -0.13), V3(-0.12, 0.03, -0.26), 0.012), alu, stand); add(new THREE.BoxGeometry(0.06, 0.01, 0.04).translate(-0.125, 0.025, -0.265), alu, stand);
  const q = new THREE.Quaternion(); let lean = 0;
  return { root, body, leanG, rider, stand, paint, brakeMat, headMat, flames: [flame], wheels: [], pivots: [], steer: new THREE.Object3D(), interior: new THREE.Group(), lowerMesh: null, origPos: null, color, vid: 'v4s', bike: true,
    mirrorDefs: mdefs, gauge: { canvas: null, tex: {}, ctx: null },
    setEnvMap(t) { for (const m of [paint, white, glass, helmet, visor, carbon, headMat, suitC]) { m.envMap = t; m.needsUpdate = true; } },
    cockpit: [0.28, 1.21, 0], cockpitLook: [6, 0.55, 0], hood: [0.62, 1.0, 0], mirror: [0.45, 1.1, 0],
    setLean(target, dt) { lean += (target - lean) * Math.min(1, dt * 7); leanG.rotation.x = lean; return lean; },
    drawDash(rpm, kmh, gear) { const g = dcv.getContext('2d'), W = 256, H = 150; g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
      const f = Math.min(1, rpm / 15000); const n = 30; for (let i = 0; i < n; i++) { const on = i / n < f; g.fillStyle = on ? (i > n * 0.8 ? '#ff3030' : i > n * 0.6 ? '#ffb020' : '#30e070') : '#1a2020'; g.fillRect(10 + i * 7.9, 12 + (1 - Math.sin(i / n * Math.PI * 0.5)) * 18, 6, 22); }
      g.fillStyle = '#fff'; g.font = 'bold 56px Inter,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(String(kmh), 14, 118); g.font = '600 16px Inter,sans-serif'; g.fillStyle = '#9ab'; g.fillText('km/h', 16, 138);
      g.fillStyle = '#ffd400'; g.font = 'bold 72px Inter,sans-serif'; g.textAlign = 'right'; g.fillText(gear, 242, 124); dtex.needsUpdate = true; },
    setPose(steer, ang) { q.setFromAxisAngle(steerAxis, -steer * 0.7); front.quaternion.copy(q); fspin.rotation.z = -ang[0] * (RR / RF); rspin.rotation.z = -ang[2]; } };
}
