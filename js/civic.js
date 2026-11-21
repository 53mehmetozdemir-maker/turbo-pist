// Procedural Honda Civic hatchback (6th gen EK, 1998 EK9 Type R spec) — real proportions, no badges.
// Car frame: +X forward, +Y up, +Z right, ground at y=0, origin midway between the axles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCabin } from './interior.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const WB = 2.62, AX = WB / 2, TR = 0.735, RW = 0.298;       // wheelbase 2620 mm, track 1475/1465, 195/55 R15
const ARCH = 0.335;

const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
// sections: [x, [[z,y] x5]] front to back; half profile from the roof/hood centre line down to the sill
function ringAt(pts, r) { const m = pts.length; const i = Math.min(m - 2, Math.max(0, Math.floor(r))), t = r - i;
  const q = j => j < 0 ? [-pts[-j][0], pts[-j][1]] : j >= m ? [2 * pts[m - 1][0] - pts[m - 2][0], 2 * pts[m - 1][1] - pts[m - 2][1]] : pts[j];
  const a = q(i - 1), b = q(i), c = q(i + 1), d = q(i + 2); return [Math.max(0, cr(a[0], b[0], c[0], d[0], t)), cr(a[1], b[1], c[1], d[1], t)]; }
function secAt(secs, x) { // linear between sections by x (sections sorted by descending x)
  let k = 0; while (k < secs.length - 2 && x < secs[k + 1][0]) k++; const A = secs[k], B = secs[k + 1]; const t = Math.min(1, Math.max(0, (A[0] - x) / (A[0] - B[0])));
  return A[1].map((p, i) => [p[0] + (B[1][i][0] - p[0]) * t, p[1] + (B[1][i][1] - p[1]) * t]); }
function surf(secs, x0, x1, r0, r1, off = 0, arches = false, nx = 0, nr = 0, skip = null) {
  nx = nx || Math.max(2, Math.ceil(Math.abs(x0 - x1) / 0.025)); nr = nr || Math.max(2, Math.ceil((r1 - r0) * 8));
  const pos = [], idx = [];
  for (let a = 0; a <= nx; a++) { const x = x0 + (x1 - x0) * a / nx; const pts = secAt(secs, x);
    for (let b = 0; b <= nr; b++) { const [z, y0] = ringAt(pts, r0 + (r1 - r0) * b / nr); let y = y0;
      if (arches && z > 0.6) for (const ax of [AX, -AX]) { const dx = x - ax; if (Math.abs(dx) < ARCH) { const ym = RW + Math.sqrt(ARCH * ARCH - dx * dx); if (y < ym) y = ym; } }
      pos.push(x, y, z); } }
  const W = nr + 1; for (let a = 0; a < nx; a++) for (let b = 0; b < nr; b++) { if (skip && skip(x0 + (x1 - x0) * (a + 0.5) / nx, r0 + (r1 - r0) * (b + 0.5) / nr)) continue; const i = a * W + b; idx.push(i, i + W, i + 1, i + 1, i + W, i + W + 1); }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (off) { const P = g.attributes.position, N = g.attributes.normal; for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + N.getX(i) * off, P.getY(i) + N.getY(i) * off, P.getZ(i) + N.getZ(i) * off); }
  return mirror(g); }
function mirror(g) { const m = g.clone(); m.scale(1, 1, -1); const mi = m.index.array; for (let i = 0; i < mi.length; i += 3) { const t = mi[i]; mi[i] = mi[i + 1]; mi[i + 1] = t; }
  const o = mergeGeometries([g, m]); o.computeVertexNormals(); return o; }
// flat end cap from a section outline (both halves), facing +x (dir 1) or -x (dir -1)
function cap(pts, x, dir) { // dense grid clamped to the section outline (so it can be bent afterwards)
  const pl = []; for (let b = 0; b <= 48; b++) pl.push(ringAt(pts, (pts.length - 1) * b / 48)); const ys = pl.map(p => p[1]); const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const wAt = y => { let w = 0; for (let i = 0; i < pl.length - 1; i++) { const [za, ya] = pl[i], [zb, yb] = pl[i + 1]; if ((y - ya) * (y - yb) <= 0 && ya !== yb) w = Math.max(w, za + (zb - za) * (y - ya) / (yb - ya)); } return w; };
  const g = new THREE.PlaneGeometry(1, 1, 40, 30); const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const u = P.getX(i) * 2, v = P.getY(i) + 0.5; const y = y0 + (y1 - y0) * v; const w = wAt(y); P.setXYZ(i, x, y, u * w); }
  g.computeVertexNormals(); const n = g.attributes.normal; if (Math.sign(n.getX(Math.floor(P.count / 2))) !== dir) { const ia = g.index.array; for (let i = 0; i < ia.length; i += 3) { const t = ia[i]; ia[i] = ia[i + 1]; ia[i + 1] = t; } g.computeVertexNormals(); }
  return g; }
const panel = (w, h, x, y, z = 0, seg = 24) => new THREE.PlaneGeometry(w, h, seg, 1).rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2).translate(x, y, z);
const box = (sx, sy, sz, x, y, z) => new THREE.BoxGeometry(sx, sy, sz, 1, 1, Math.max(1, Math.round(sz / 0.08))).translate(x, y, z);
function rbox(w, h, d, r, x, y, z) { const s = new THREE.Shape(); const W = w / 2, H = h / 2; s.moveTo(-W + r, -H); s.lineTo(W - r, -H); s.quadraticCurveTo(W, -H, W, -H + r); s.lineTo(W, H - r); s.quadraticCurveTo(W, H, W - r, H); s.lineTo(-W + r, H); s.quadraticCurveTo(-W, H, -W, H - r); s.lineTo(-W, -H + r); s.quadraticCurveTo(-W, -H, -W + r, -H);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, -d / 2); g.rotateY(Math.PI / 2); g.translate(x, y, z); return g; }

function tyre(R, wd) { const pts = []; const r0 = R - 0.112; pts.push(new THREE.Vector2(r0, -wd / 2 + 0.01));
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI; const c = Math.cos(a), s = Math.sin(a); pts.push(new THREE.Vector2(R - 0.03 + c * 0.03, s * wd / 2 * (Math.abs(s) > 0.7 ? 1 : 1))); }
  pts.push(new THREE.Vector2(r0, wd / 2 - 0.01)); return new THREE.LatheGeometry(pts, 40).rotateX(Math.PI / 2); }
function rim(R, wd, spokes = 5, open = 0.4) { const parts = [new THREE.CylinderGeometry(R, R, wd, 40, 1, true).rotateX(Math.PI / 2), new THREE.TorusGeometry(R - 0.004, 0.009, 6, 40).translate(0, 0, wd / 2)];
  const face = new THREE.Shape(); face.absarc(0, 0, R - 0.01, 0, Math.PI * 2, false);
  for (let k = 0; k < spokes; k++) { const a0 = k * Math.PI * 2 / spokes + open / 2, a1 = a0 + Math.PI * 2 / spokes - open; const h = new THREE.Path(); h.moveTo(Math.cos(a0) * 0.07, Math.sin(a0) * 0.07);
    h.absarc(0, 0, R - 0.03, a0 + 0.12, a1 - 0.12, false); h.lineTo(Math.cos(a1) * 0.075, Math.sin(a1) * 0.075); face.holes.push(h); }
  const fg = new THREE.ExtrudeGeometry(face, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 }); fg.translate(0, 0, wd / 2 - 0.035); parts.push(fg);
  parts.push(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20).rotateX(Math.PI / 2).translate(0, 0, wd / 2 - 0.005));
  return mergeGeometries(parts.map(g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; })); }


export function buildCivic(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.12, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.8, side: THREE.BackSide, envMapIntensity: 0.1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.55, metalness: 0.1 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.82 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x08090a, roughness: 0.1, clearcoat: 1, envMapIntensity: 1.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.12, metalness: 1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0f1a16, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.4, envMapIntensity: 0.7, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff0800, emissiveIntensity: 0.6, roughness: 0.15, toneMapped: false });
  const headMat = new THREE.MeshPhysicalMaterial({ color: 0xc4cbd2, emissive: 0xfff1d6, emissiveIntensity: 0.15, roughness: 0.1, metalness: 0.85, clearcoat: 1, envMapIntensity: 1.3 });
  const lensClear = new THREE.MeshPhysicalMaterial({ color: 0xdfe6ee, roughness: 0.03, transmission: 0, transparent: true, opacity: 0.35, clearcoat: 1, envMapIntensity: 1.5, depthWrite: false });
  const amber = new THREE.MeshStandardMaterial({ color: 0x8a4a00, emissive: 0xff8a00, emissiveIntensity: 0.12, roughness: 0.2 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.35, metalness: 0.2 });          // Type R white 5-spoke
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const add = (g, m, p = body, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; p.add(o); return o; };

  // ---- body shell (EK hatch: low wedge nose, steep A-pillar, long flat roof, near-vertical hatch) ----
  const R = (x, ry, rw, by, bw, sy, sw, ly, lw) => [x, [[0, ry], [rw * 0.55, ry - 0.006], [rw, ry - 0.022], [rw + (bw - rw) * 0.45, ry - Math.min(0.08, (ry - by) * 0.32)], [bw, by], [sw + 0.006, by - 0.09], [sw, sy], [lw, ly]]];
  const S = [
    R(2.165, 0.655, 0.46, 0.64, 0.66, 0.44, 0.73, 0.22, 0.70),
    R(2.13, 0.70, 0.56, 0.69, 0.76, 0.46, 0.80, 0.21, 0.78),
    R(2.02, 0.745, 0.62, 0.735, 0.80, 0.48, 0.835, 0.21, 0.81),
    R(1.70, 0.80, 0.64, 0.79, 0.825, 0.50, 0.845, 0.22, 0.82),
    R(1.25, 0.85, 0.63, 0.84, 0.83, 0.51, 0.847, 0.23, 0.82),
    R(0.98, 0.875, 0.62, 0.865, 0.83, 0.52, 0.847, 0.23, 0.82),
    R(0.62, 1.10, 0.60, 0.88, 0.815, 0.53, 0.847, 0.23, 0.82),
    R(0.25, 1.30, 0.585, 0.89, 0.80, 0.53, 0.846, 0.23, 0.82),
    R(0.02, 1.355, 0.58, 0.895, 0.795, 0.53, 0.846, 0.23, 0.82),
    R(-0.85, 1.35, 0.575, 0.91, 0.79, 0.54, 0.845, 0.24, 0.82),
    R(-1.10, 1.315, 0.565, 0.92, 0.785, 0.55, 0.842, 0.25, 0.815),
    R(-1.40, 1.19, 0.55, 0.93, 0.775, 0.56, 0.835, 0.26, 0.81),
    R(-1.68, 1.03, 0.535, 0.935, 0.76, 0.56, 0.82, 0.28, 0.79),
    R(-1.86, 0.965, 0.52, 0.93, 0.74, 0.56, 0.80, 0.29, 0.77),
    R(-1.99, 0.935, 0.50, 0.915, 0.70, 0.56, 0.76, 0.31, 0.73)];
  const XF = 2.165, XR = -1.99;
  const winX = [[0.86, -0.38], [-0.47, -1.12]];
  const shellGeo = surf(S, XF, XR, 0, 7, 0, true, 0, 56, (x, r) => (x < 0.97 && x > 0.04 && r < 2.9) || (x < -1.08 && x > -1.80 && r < 2.95) || (r > 3.12 && r < 3.9 && winX.some(([a, b]) => x < a - 0.01 && x > b + 0.01)));
  add(shellGeo, paint); add(shellGeo, trim, body, false);
  add(cap(S[0][1], XF, 1), paint); add(cap(S[S.length - 1][1], XR, -1), paint);
  // glass: windscreen, door glass, quarter light, hatch glass; black frit / pillars behind
  add(surf(S, 0.975, 0.03, 0, 2.92, 0.004), glass, body, false);
  add(surf(S, 0.86, -0.38, 3.12, 3.92, 0.004), glass, body, false);
  add(surf(S, -0.47, -1.12, 3.12, 3.9, 0.004), glass, body, false);
  add(surf(S, -1.07, -1.81, 0, 2.97, 0.004), glass, body, false);
  add(surf(S, 0.86, -1.2, 3.04, 3.95, 0.002), black, body, false);
  add(surf(S, 0.86, -1.16, 3.96, 4.02, 0.003), black, body, false);            // black window-line rubber (no chrome on the EK)
  add(surf(S, -0.36, -0.47, 3.05, 3.98, 0.004), black, body, false);        // B pillar (black)
  add(surf(S, -1.05, -1.82, 2.92, 3.02, 0.003), black, body, false);         // hatch glass seal
  add(surf(S, -1.12, -1.22, 3.05, 3.98, 0.004), black, body, false);        // C pillar edge
  // panel gaps, door handle, fuel flap
  for (const x of [0.92, -0.42]) add(surf(S, x + 0.004, x - 0.004, 4.05, 6.85, 0.0015), black, body, false);
  for (const s of [-1, 1]) { add(box(0.15, 0.03, 0.02, -0.22, 0.86, s * 0.85), black); }
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.006, 20).rotateX(Math.PI / 2).translate(-1.45, 0.78, 0.843), paint);
  add(surf(S, 1.96, -1.94, 6.6, 7, 0.004, true), plastic, body, false);       // sills
  // side mouldings (body-coloured on the Type R), rocker
  add(surf(S, 2.0, -1.9, 5.6, 5.75, 0.006, true), paint, body, false);
  // ---- front: wide teardrop headlamps sweeping into the wings, slim grille, Type R bumper ----
  const fx = XF + 0.004;
  const shapePanel = (pts, x, mat) => { const sh = new THREE.Shape(); pts.forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y)); sh.closePath();
    let g = new THREE.ShapeGeometry(sh, 4); g = g.toNonIndexed(); const tess = []; const P = g.attributes.position;
    for (let t = 0; t < P.count; t += 3) { const v = [0, 1, 2].map(k => new THREE.Vector3(P.getX(t + k), P.getY(t + k), 0)); const sub = (a, b, c, d) => { const w = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)); if (d > 4 || w < 0.05) { tess.push(a, b, c); return; } const ab = a.clone().lerp(b, 0.5), bc = b.clone().lerp(c, 0.5), ca = c.clone().lerp(a, 0.5); sub(a, ab, ca, d + 1); sub(ab, b, bc, d + 1); sub(ca, bc, c, d + 1); sub(ab, bc, ca, d + 1); }; sub(...v, 0); }
    const out = new THREE.BufferGeometry().setFromPoints(tess.map(v => new THREE.Vector3(x, v.y, -v.x))); out.computeVertexNormals(); return add(out, mat, body, false); };
  for (const s of [-1, 1]) {
    const L = [[0.17, 0.555], [0.40, 0.545], [0.62, 0.56], [0.735, 0.59], [0.75, 0.63], [0.67, 0.648], [0.42, 0.652], [0.19, 0.645]].map(([z, y]) => [s * z, y]);
    shapePanel(L, fx + 0.005, headMat);                                                                    // chrome reflector bowl (multi-reflector)
    shapePanel(L.map(([z, y]) => [z * 0.985 + s * 0.004, y * 0.995 + 0.003]), fx + 0.011, lensClear);    // clear lens
    for (const zc of [0.30, 0.52]) add(new THREE.TorusGeometry(0.045, 0.004, 6, 24).rotateY(Math.PI / 2).translate(fx + 0.008, 0.598, s * zc), gloss, body, false);   // reflector rings behind the clear lens
    shapePanel([[0.63, 0.59], [0.72, 0.607], [0.735, 0.632], [0.66, 0.645]].map(([z, y]) => [s * z, y]), fx + 0.008, amber);   // corner indicator
    // round fog lamps in the bumper
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 20).rotateZ(Math.PI / 2).translate(fx + 0.003, 0.33, s * 0.6), headMat, body, false);
    add(new THREE.TorusGeometry(0.048, 0.008, 6, 20).rotateY(Math.PI / 2).translate(fx + 0.004, 0.33, s * 0.6), black, body, false);
  }
  shapePanel([[-0.16, 0.575], [0.16, 0.575], [0.18, 0.64], [-0.18, 0.64]], fx + 0.004, gloss);              // slim grille between the lamps
  for (let k = 0; k < 3; k++) add(panel(0.32, 0.006, fx + 0.008, 0.59 + k * 0.016, 0, 12), black, body, false);
  add(new THREE.CylinderGeometry(0.026, 0.026, 0.006, 20).rotateZ(Math.PI / 2).translate(fx + 0.01, 0.607, 0), chrome, body, false);   // badge disc (logo-free)
  // big lower intake (Type R) + licence plate
  const hc = document.createElement('canvas'); hc.width = hc.height = 64; const hg = hc.getContext('2d'); hg.fillStyle = '#0a0a0b'; hg.fillRect(0, 0, 64, 64); hg.strokeStyle = '#26272a'; hg.lineWidth = 4; for (let k = -64; k < 64; k += 16) { hg.beginPath(); hg.moveTo(k, 0); hg.lineTo(k + 64, 64); hg.stroke(); hg.beginPath(); hg.moveTo(k + 64, 0); hg.lineTo(k, 64); hg.stroke(); }
  const hTex = new THREE.CanvasTexture(hc); hTex.wrapS = hTex.wrapT = THREE.RepeatWrapping; hTex.repeat.set(16, 3); const mesh = new THREE.MeshStandardMaterial({ map: hTex, roughness: 0.6 });
  const intake = shapePanel([[-0.48, 0.25], [0.48, 0.25], [0.44, 0.40], [-0.44, 0.40]], fx + 0.003, mesh);
  { const P = intake.geometry.attributes.position, uv = []; for (let i = 0; i < P.count; i++) uv.push(P.getZ(i) + 0.6, P.getY(i)); intake.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); }
  add(rbox(0.52, 0.11, 0.008, 0.008, fx + 0.008, 0.47, 0), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
  add(box(0.04, 0.03, 1.36, fx - 0.012, 0.215, 0), plastic);                                                    // front lip
  // ---- rear: wraparound tail lamps on the corners, garnish between, Type R roof spoiler ----
  const rx = XR - 0.004;
  for (const s of [-1, 1]) {
    add(rbox(0.26, 0.20, 0.03, 0.03, rx - 0.008, 0.82, s * 0.58), brakeMat, body, false);                // red
    add(rbox(0.09, 0.09, 0.034, 0.02, rx - 0.012, 0.79, s * 0.61), amber, body, false);                  // amber indicator
    add(rbox(0.08, 0.06, 0.034, 0.02, rx - 0.012, 0.79, s * 0.50), new THREE.MeshPhysicalMaterial({ color: 0xe8ecf0, roughness: 0.1, emissive: 0x000000 }), body, false);   // reverse lamp
    // wrap onto the rear quarter
    const w = new THREE.BoxGeometry(0.16, 0.18, 0.02); w.translate(-1.92, 0.82, s * 0.76); w.rotateY(0); add(w, brakeMat, body, false); }
  add(rbox(0.68, 0.11, 0.02, 0.01, rx - 0.006, 0.84, 0), gloss, body, false);                             // black garnish between the lamps
  add(rbox(0.52, 0.11, 0.008, 0.008, rx - 0.004, 0.66, 0), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
  add(rbox(1.5, 0.24, 0.06, 0.05, rx - 0.012, 0.42, 0), paint);                                                       // body-coloured rear bumper
  add(box(0.012, 0.012, 1.46, rx - 0.045, 0.53, 0), black);
  { const sp = new THREE.BoxGeometry(0.30, 0.035, 1.12); sp.rotateZ(0.18); sp.translate(-1.12, 1.33, 0); add(sp, paint); add(new THREE.BoxGeometry(0.04, 0.012, 0.3).translate(-1.2, 1.345, 0), brakeMat, body, false); }   // roof spoiler + 3rd brake light
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.22, 0.05, 0.03).translate(-1.15, 1.29, s * 0.55), paint);   // spoiler side plates
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 14).rotateZ(Math.PI / 2).translate(XR - 0.03, 0.27, -0.42), chrome);    // single tail pipe (left)
  // ---- mirrors (body-coloured, door mounted) ----
  for (const s of [-1, 1]) { const h = new RoundedBoxGeometry(0.09, 0.12, 0.2, 4, 0.035); h.translate(0.78, 0.98, s * 0.93); add(h, paint); add(new RoundedBoxGeometry(0.01, 0.105, 0.18, 4, 0.03).translate(0.733, 0.98, s * 0.93), black); add(box(0.08, 0.05, 0.08, 0.82, 0.93, s * 0.86), black); }
  const mdefs = { in: { c: [0.38, 1.27, 0], n: [-0.99, -0.08, 0], w: 0.22, h: 0.055, housing: true }, L: { c: [0.727, 0.98, -0.93], n: [-1, 0, 0], w: 0.17, h: 0.095, fixed: true, rad: 36 } };
  // ---- arches, underbody ----
  for (const ax of [AX, -AX]) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(ARCH + 0.005, ARCH + 0.005, 0.24, 24, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(ax, RW, s * 0.73), plastic, body, false);
  add(box(4.0, 0.02, 1.6, 0.08, 0.22, 0), plastic, body, false);
  // ---- cabin: 90s Honda dash, red Recaro buckets, Momo-style wheel, titanium knob ----
  const interior = new THREE.Group(); body.add(interior);
  const cab = buildCabin({ xDash: 0.98, xFace: 0.58, yTop: 0.97, yFloor: 0.33, halfW: 0.74, zDrv: -0.37, seatX: -0.25, seatY: 0.6, back: 0.26, roofY: 1.32, xVisor: 0.12,
    doorZ: 0.80, xDoorF: 0.88, xDoorR: -0.36, rear: { x: -0.82, y: 0.52, w: 1.2 }, cluster: { c: [0.52, 0.985, -0.37], w: 0.30, h: 0.1 }, screen: null,
    sw: { c: [0.30, 0.86, -0.37], n: [-0.85, 0.53, 0], r: 0.18 }, shifter: 'stick', trimKind: 'carbon', col: { dash: 0x1b1c1e, low: 0x151618, seat: 0xa3121b, ins: '#c01622', stitch: '#202020', amb: 0x000000 } });
  interior.add(cab.group); const swIn = cab.swG.userData.inner, swAxisC = cab.swAxis;
  add(new THREE.BoxGeometry(1.1, 0.012, 1.06).translate(-0.45, 1.32, 0), new THREE.MeshStandardMaterial({ color: 0x6a6c70, roughness: 0.95 }), interior);
  // analogue cluster: white-faced tach to 10 000 rpm, red zone at 8 400
  const dcv = document.createElement('canvas'); dcv.width = 384; dcv.height = 140; const dtex = new THREE.CanvasTexture(dcv); dtex.colorSpace = THREE.SRGBColorSpace;
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.105), new THREE.MeshBasicMaterial({ map: dtex, toneMapped: false })); dash.position.set(0.515, 0.985, -0.37); dash.rotation.y = -Math.PI / 2; interior.add(dash);
  // ---- wheels ----
  const tyreG = tyre(RW, 0.195), rimG = rim(0.19, 0.16, 5, 0.62), discG = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 28).rotateX(Math.PI / 2);
  const discM = new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.35, metalness: 0.9 });
  const pivots = []; const unsprung = new THREE.Group(); root.add(unsprung);
  for (const [x, s] of [[AX, -1], [AX, 1], [-AX, -1], [-AX, 1]]) { const steerG = new THREE.Group(); steerG.position.set(x, RW, s * TR); unsprung.add(steerG); const spin = new THREE.Group(); steerG.add(spin);
    const side = new THREE.Group(); side.scale.z = s; spin.add(side); add(tyreG, rubber, side); add(rimG, alloy, side); add(discG.clone(), discM, side, false);
    const cal = box(0.06, 0.1, 0.05, 0, 0, 0.02); cal.translate(x > 0 ? -0.09 : 0.09, 0.05, 0); const cm = add(cal, x > 0 ? new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.5 }) : black, steerG); cm.scale.z = s;
    pivots.push({ steerG, spin, front: x > 0 }); }
  const sc = document.createElement('canvas'); sc.width = 128; sc.height = 64; const sg = sc.getContext('2d'); sg.filter = 'blur(7px)'; sg.fillStyle = 'rgba(0,0,0,.8)'; sg.beginPath(); sg.roundRect(14, 12, 100, 40, 14); sg.fill();
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; sh.renderOrder = 2; unsprung.add(sh);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.4, 10).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66b3ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.set(XR - 0.25, 0.27, -0.42); flame.visible = false; body.add(flame);
  // plan-view rounding of nose and tail; the nose also drops (wedge)
  const done = new Set(); body.traverse(o => { if (!o.isMesh || done.has(o.geometry) || o.parent !== body) return; done.add(o.geometry); const P = o.geometry.attributes.position; let ch = false;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i); if (x > 1.85) { const f = Math.min(1, (x - 1.85) / 0.32); P.setX(i, x - 0.16 * z * z * f - 0.25 * Math.max(0, y - 0.45) * f); ch = true; } else if (x < -1.80) { P.setX(i, x + 0.09 * z * z * Math.min(1, (-1.80 - x) / 0.19)); ch = true; } }
    if (ch) { P.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingSphere(); } });
  const envMats = [paint, glass, gloss, chrome, headMat, alloy, lensClear]; const tq = new THREE.Quaternion();
  return { root, body, paint, brakeMat, headMat, flames: [flame], wheels: [], mirrorDefs: mdefs, pivots: [], steer: new THREE.Object3D(), interior, lowerMesh: null, origPos: null, color, vid: 'civic',
    gauge: { canvas: null, tex: {}, ctx: null },
    setEnvMap(t) { for (const m of envMats) { m.envMap = t; m.needsUpdate = true; } },
    cockpit: [-0.17, 1.12, -0.37], cockpitLook: [6, 0.92, -0.37], hood: [1.0, 1.15, 0], mirror: [0.5, 1.25, 0],
    drawDash(rpm, kmh, gear) { const g = dcv.getContext('2d'), W = dcv.width, H = dcv.height; g.fillStyle = '#0a0a0b'; g.fillRect(0, 0, W, H);
      const dial = (cx, r, v, max, step, red, lab) => { g.fillStyle = '#f2f1ec'; g.beginPath(); g.arc(cx, 72, r, 0, 7); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 3; g.stroke();
        const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, A = q => a0 + (a1 - a0) * q / max;
        if (red) { g.strokeStyle = '#d4141e'; g.lineWidth = 6; g.beginPath(); g.arc(cx, 72, r - 6, A(red), a1); g.stroke(); }
        g.fillStyle = '#111'; g.font = 'bold 12px Inter,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let q = 0; q <= max; q += step) { const a = A(q); g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 4), 72 + Math.sin(a) * (r - 4)); g.lineTo(cx + Math.cos(a) * (r - 12), 72 + Math.sin(a) * (r - 12)); g.stroke(); g.fillText(String(lab(q)), cx + Math.cos(a) * (r - 22), 72 + Math.sin(a) * (r - 22)); }
        const a = A(Math.min(max, v)); g.strokeStyle = '#e8211b'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, 72); g.lineTo(cx + Math.cos(a) * (r - 8), 72 + Math.sin(a) * (r - 8)); g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.arc(cx, 72, 5, 0, 7); g.fill(); };
      dial(105, 64, rpm, 10000, 1000, 8400, q => q / 1000); dial(W - 105, 64, kmh, 240, 20, 0, q => q % 40 ? '' : q);
      g.fillStyle = '#d4141e'; g.font = 'bold 13px Inter,Arial'; g.textAlign = 'center'; g.fillText('VTEC', 105, 104); g.fillStyle = '#ffd400'; g.font = 'bold 26px Inter,Arial'; g.fillText(gear, W / 2, 72); dtex.needsUpdate = true; },
    setPose(steer, ang) { pivots.forEach((p, i) => { if (p.front) p.steerG.rotation.y = -steer; p.spin.rotation.z = -ang[i]; }); tq.setFromAxisAngle(swAxisC, -steer * 7); swIn.quaternion.copy(tq); } };
}
