// Procedural 1000cc superbike (own design, unbranded) with a tucked rider.
// Car frame: +X forward, +Y up, +Z right, ground at y=0, origin midway between the axles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const A = 0.70, B = 0.757;                 // axle positions (wheelbase 1.457 m)
const RF = 0.300, RR = 0.322;               // 120/70 ZR17 front, 200/55 ZR17 rear
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

export function buildBike(color) {
  const root = new THREE.Group(); const leanG = new THREE.Group(); root.add(leanG); const body = new THREE.Group(); leanG.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.3, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1, side: THREE.DoubleSide });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, metalness: 0.1, roughness: 0.35, clearcoat: 1, envMapIntensity: 0.8, side: THREE.DoubleSide });
  const black = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.35, metalness: 0.5 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.9 });
  const ti = new THREE.MeshStandardMaterial({ color: 0x6e7076, roughness: 0.25, metalness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const discM = new THREE.MeshStandardMaterial({ color: 0xb7bbc1, roughness: 0.3, metalness: 1, side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1b2833, roughness: 0.03, transparent: true, opacity: 0.55, clearcoat: 1, side: THREE.DoubleSide });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff1010, emissiveIntensity: 0.6, roughness: 0.15 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, emissive: 0xfff1d6, emissiveIntensity: 0.15, roughness: 0.05, metalness: 0.3 });
  const add = (g, m, p = body, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; p.add(o); return o; };

  // --- fairing, tank, tail ---
  const F = [[0.95, 0.02, 0.71, 0.69], [0.89, 0.075, 0.78, 0.63], [0.79, 0.13, 0.88, 0.55], [0.66, 0.18, 0.97, 0.45], [0.50, 0.21, 1.0, 0.35], [0.34, 0.215, 0.96, 0.30], [0.18, 0.19, 0.90, 0.31], [0.06, 0.16, 0.86, 0.34]];
  add(shell(F, 60, 24), paint);
  add(shell(F.slice(2, 7).map(([x, w, yt, yb]) => [x, w + 0.004, yb + (yt - yb) * 0.42, yb + (yt - yb) * 0.30]), 0, 24), white, body, false);   // side stripe
  add(shell([[0.5, 0.17, 0.36, 0.22], [0.25, 0.19, 0.34, 0.2], [0.0, 0.15, 0.36, 0.24]], 200, 10), black, body, false);   // belly pan
  const tank = new THREE.SphereGeometry(1, 24, 14); tank.scale(0.25, 0.13, 0.19); tank.translate(0.12, 0.93, 0); add(tank, paint);
  add(shell([[0.02, 0.17, 0.92, 0.70], [-0.30, 0.14, 0.95, 0.74], [-0.60, 0.10, 1.00, 0.82], [-0.86, 0.05, 1.02, 0.92]], 40, 14), paint);
  const seat = new THREE.BoxGeometry(0.42, 0.06, 0.22); seat.translate(-0.20, 0.93, 0); add(seat, black);
  const winds = shell([[0.64, 0.22, 1.03, 0.97], [0.52, 0.2, 1.12, 1.03], [0.42, 0.16, 1.17, 1.11]], 220, 10); add(winds, glass, body, false);
  // headlights (twin slits) and tail light
  for (const s of [-1, 1]) { const h = new THREE.BoxGeometry(0.1, 0.035, 0.05); h.rotateY(s * 0.6); h.rotateZ(-0.3); h.translate(0.875, 0.755, s * 0.055); add(h, headMat, body, false); }
  const ram = new THREE.BoxGeometry(0.04, 0.04, 0.05); ram.translate(0.93, 0.69, 0); add(ram, black, body, false);
  const tl = new THREE.BoxGeometry(0.03, 0.035, 0.09); tl.translate(-0.87, 0.95, 0); add(tl, brakeMat, body, false);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.02, 0.02).translate(-0.8, 0.86, s * 0.11), new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xff8800, emissiveIntensity: 0.3 }), body, false);
  // race number on the tail sides
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), new THREE.MeshStandardMaterial({ map: plateTex(), roughness: 0.4 })); p.position.set(-0.48, 0.89, s * 0.123); p.rotation.y = s > 0 ? 0 : Math.PI; p.rotation.x = 0; body.add(p); }
  // --- frame, engine, swingarm, exhaust ---
  for (const s of [-1, 1]) { add(tube(V3(0.42, 0.93, s * 0.07), V3(0.12, 0.80, s * 0.17), 0.035), alu); add(tube(V3(0.12, 0.80, s * 0.17), V3(-0.12, 0.52, s * 0.13), 0.035), alu); }
  const eng = new THREE.BoxGeometry(0.38, 0.32, 0.30); eng.translate(0.12, 0.44, 0); add(eng, carbon);
  const headC = new THREE.BoxGeometry(0.22, 0.14, 0.28); headC.rotateZ(0.5); headC.translate(0.26, 0.66, 0); add(headC, carbon);
  for (let k = 0; k < 4; k++) add(tube(V3(0.33, 0.62, -0.1 + k * 0.067), V3(0.36, 0.22, -0.06 + k * 0.04), 0.017), ti);
  add(tube(V3(0.3, 0.2, 0), V3(-0.25, 0.27, 0.1), 0.04), ti);
  const can = new THREE.CylinderGeometry(0.06, 0.07, 0.36, 14); between(can, V3(-0.25, 0.3, 0.17), V3(-0.55, 0.46, 0.17)); add(can, ti);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10).rotateZ(Math.PI / 2).translate(-0.565, 0.47, 0.17), carbon);
  for (const s of [-1, 1]) add(tube(V3(-0.12, 0.45, s * 0.12), V3(-B, RR, s * 0.12), 0.03, 6), alu);
  add(tube(V3(-0.12, 0.45, -0.13), V3(-0.12, 0.45, 0.13), 0.03), alu);
  add(tube(V3(-0.15, 0.55, 0), V3(-0.32, 0.36, 0), 0.03), gold);                     // rear shock
  // pegs, chain
  for (const s of [-1, 1]) add(tube(V3(-0.22, 0.36, s * 0.13), V3(-0.22, 0.36, s * 0.22), 0.012), alu);
  add(tube(V3(0.02, 0.33, 0.14), V3(-B, RR, 0.14), 0.01, 4), black); add(tube(V3(0.02, 0.27, 0.14), V3(-B, RR - 0.07, 0.14), 0.01, 4), black);
  // --- mirrors, dash ---
  const mdefs = { L: { c: [0.497, 1.07, -0.285], n: [-0.97, 0.05, 0.22], w: 0.095, h: 0.042 } };
  for (const s of [-1, 1]) { const hs = new THREE.BoxGeometry(0.04, 0.05, 0.11); hs.translate(0.52, 1.07, s * 0.285); add(hs, paint); add(tube(V3(0.56, 1.0, s * 0.22), V3(0.53, 1.06, s * 0.27), 0.008), black); }
  const dcv = document.createElement('canvas'); dcv.width = 256; dcv.height = 150; const dtex = new THREE.CanvasTexture(dcv); dtex.colorSpace = THREE.SRGBColorSpace;
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.076), new THREE.MeshBasicMaterial({ map: dtex, toneMapped: false })); dash.position.set(0.47, 1.06, 0); dash.rotation.order = 'YXZ'; dash.rotation.y = -Math.PI / 2; dash.rotation.x = -0.75; body.add(dash);
  add(new THREE.BoxGeometry(0.04, 0.09, 0.15).rotateZ(0.75).translate(0.485, 1.05, 0), black);
  // --- front end: steers about the head axis ---
  const steerAxis = new THREE.Vector3(A - HEAD.x, RF - HEAD.y, 0).normalize();
  const front = new THREE.Group(); front.position.copy(HEAD); body.add(front);
  const fl = (x, y, z) => V3(x - HEAD.x, y - HEAD.y, z);
  for (const s of [-1, 1]) { add(tube(fl(0.43, 1.0, s * 0.1), fl(0.56, 0.68, s * 0.1), 0.028, 10), gold, front); add(tube(fl(0.56, 0.68, s * 0.1), fl(A, RF, s * 0.1), 0.024, 10), alu, front); }
  add(new THREE.BoxGeometry(0.1, 0.03, 0.26).translate(...fl(0.44, 1.0, 0).toArray()), alu, front);
  for (const s of [-1, 1]) { add(tube(fl(0.41, 0.985, s * 0.11), fl(0.37, 0.975, s * 0.25), 0.012), black, front); add(tube(fl(0.37, 0.975, s * 0.22), fl(0.37, 0.975, s * 0.27), 0.018), rubber, front); }
  const fender = shell([[A + 0.2, 0.07, RF + 0.08, RF + 0.06], [A, 0.08, RF + 0.1, RF + 0.07], [A - 0.2, 0.07, RF + 0.06, RF + 0.04]], 170, 8); fender.translate(-HEAD.x, -HEAD.y, 0); add(fender, paint, front);
  const fw = new THREE.Group(); fw.position.copy(fl(A, RF, 0)); front.add(fw); const fspin = new THREE.Group(); fw.add(fspin);
  add(tyre(RF, 0.12), rubber, fspin); add(rim(RF - 0.07, 0.09), gold, fspin);
  for (const s of [-1, 1]) { add(disc(0.16).translate(0, 0, s * 0.065), discM, fspin, false); const cal = new THREE.BoxGeometry(0.08, 0.12, 0.03); cal.translate(-0.12, 0.08, s * 0.08); add(cal, gold, fw); }
  // --- rear wheel ---
  const rw = new THREE.Group(); rw.position.set(-B, RR, 0); body.add(rw); const rspin = new THREE.Group(); rw.add(rspin);
  add(tyre(RR, 0.19), rubber, rspin); add(rim(RR - 0.075, 0.15), gold, rspin); add(disc(0.11).translate(0, 0, -0.09), discM, rspin, false);
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 24).rotateX(Math.PI / 2).translate(0, 0, 0.13), alu, rspin);
  // --- rider (tucked), hidden in the helmet camera ---
  const rider = new THREE.Group(); body.add(rider);
  const suit = new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.6 }), suitC = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const helmet = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f4, roughness: 0.25, clearcoat: 1 }), visor = new THREE.MeshPhysicalMaterial({ color: 0x0d0f14, roughness: 0.05, metalness: 0.6, clearcoat: 1 });
  const hips = V3(-0.24, 1.0, 0), chest = V3(0.12, 1.12, 0);
  add(caps(hips, chest, 0.16), suit, rider); add(caps(V3(-0.2, 1.05, 0), V3(0.08, 1.17, 0), 0.12), suitC, rider);
  const hl = new THREE.SphereGeometry(0.135, 20, 14); hl.scale(1.1, 1, 0.95); hl.translate(0.22, 1.22, 0); add(hl, helmet, rider);
  const vz = new THREE.SphereGeometry(0.137, 20, 10, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.35, Math.PI * 0.25); vz.rotateY(Math.PI / 2); vz.scale(1.1, 1, 0.95); vz.translate(0.22, 1.22, 0); add(vz, visor, rider);
  for (const s of [-1, 1]) { const sh = V3(0.12, 1.14, s * 0.17), el = V3(0.25, 0.99, s * 0.22), hd = V3(0.37, 0.985, s * 0.24);
    add(caps(sh, el, 0.05), suit, rider); add(caps(el, hd, 0.045), suit, rider); add(new THREE.SphereGeometry(0.045, 10, 8).translate(hd.x, hd.y, hd.z), black, rider);
    const kn = V3(0.08, 0.78, s * 0.24), ft = V3(-0.21, 0.42, s * 0.2);
    add(caps(V3(-0.22, 0.98, s * 0.11), kn, 0.075), suit, rider); add(caps(kn, ft, 0.055), suit, rider);
    add(new THREE.BoxGeometry(0.2, 0.07, 0.08).translate(ft.x - 0.02, ft.y - 0.04, ft.z), black, rider);
    add(new THREE.SphereGeometry(0.04, 8, 6).translate(kn.x + 0.02, kn.y - 0.03, s * 0.3), new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.4 }), rider); }
  // soft contact shadow
  const sc = document.createElement('canvas'); sc.width = 128; sc.height = 32; const sg = sc.getContext('2d'); sg.filter = 'blur(6px)'; sg.fillStyle = 'rgba(0,0,0,.75)'; sg.beginPath(); sg.ellipse(64, 16, 52, 8, 0, 0, 7); sg.fill();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; shadow.renderOrder = 2; root.add(shadow);
  // nitro flame from the can
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.45, 10).rotateZ(Math.PI / 2 + 0.5), new THREE.MeshBasicMaterial({ color: 0x66b3ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.set(-0.76, 0.58, 0.17); flame.visible = false; body.add(flame);

  const q = new THREE.Quaternion(); let lean = 0;
  return { root, body, leanG, rider, paint, brakeMat, headMat, flames: [flame], wheels: [], pivots: [], steer: new THREE.Object3D(), interior: new THREE.Group(), lowerMesh: null, origPos: null, color, vid: 'rr1000', bike: true,
    mirrorDefs: mdefs, gauge: { canvas: null, tex: {}, ctx: null },
    setEnvMap(t) { for (const m of [paint, white, glass, helmet, visor]) { m.envMap = t; m.needsUpdate = true; } },
    cockpit: [0.12, 1.24, 0], cockpitLook: [6, 0.9, 0], hood: [0.6, 1.02, 0], mirror: [0.4, 1.1, 0],
    setLean(target, dt) { lean += (target - lean) * Math.min(1, dt * 7); leanG.rotation.x = lean; return lean; },
    drawDash(rpm, kmh, gear) { const g = dcv.getContext('2d'), W = 256, H = 150; g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
      const f = Math.min(1, rpm / 15000); const n = 30; for (let i = 0; i < n; i++) { const on = i / n < f; g.fillStyle = on ? (i > n * 0.8 ? '#ff3030' : i > n * 0.6 ? '#ffb020' : '#30e070') : '#1a2020'; g.fillRect(10 + i * 7.9, 12 + (1 - Math.sin(i / n * Math.PI * 0.5)) * 18, 6, 22); }
      g.fillStyle = '#fff'; g.font = 'bold 56px Inter,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(String(kmh), 14, 118); g.font = '600 16px Inter,sans-serif'; g.fillStyle = '#9ab'; g.fillText('km/h', 16, 138);
      g.fillStyle = '#ffd400'; g.font = 'bold 72px Inter,sans-serif'; g.textAlign = 'right'; g.fillText(gear, 242, 124); dtex.needsUpdate = true; },
    setPose(steer, ang) { q.setFromAxisAngle(steerAxis, -steer * 0.7); front.quaternion.copy(q); fspin.rotation.z = -ang[0] * (RR / RF); rspin.rotation.z = -ang[2]; } };
}
