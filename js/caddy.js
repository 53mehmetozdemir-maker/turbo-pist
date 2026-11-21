// Procedural Volkswagen Caddy (5th gen, 2021+) — real proportions, no badges.
// Car frame: +X forward, +Y up, +Z right, ground at y=0, origin midway between the axles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCabin } from './interior.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const WB = 2.755, AX = WB / 2, TR = 0.79, RW = 0.33;        // wheelbase, half track, 205/60 R16
const ARCH = 0.375;

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
function rim(R, wd) { const parts = [new THREE.CylinderGeometry(R, R, wd, 40, 1, true).rotateX(Math.PI / 2), new THREE.TorusGeometry(R - 0.004, 0.009, 6, 40).translate(0, 0, wd / 2)];
  const face = new THREE.Shape(); face.absarc(0, 0, R - 0.01, 0, Math.PI * 2, false);
  for (let k = 0; k < 5; k++) { const a0 = k * Math.PI * 2 / 5 + 0.2, a1 = a0 + Math.PI * 2 / 5 - 0.4; const h = new THREE.Path(); h.moveTo(Math.cos(a0) * 0.07, Math.sin(a0) * 0.07);
    h.absarc(0, 0, R - 0.03, a0 + 0.12, a1 - 0.12, false); h.lineTo(Math.cos(a1) * 0.075, Math.sin(a1) * 0.075); face.holes.push(h); }
  const fg = new THREE.ExtrudeGeometry(face, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 }); fg.translate(0, 0, wd / 2 - 0.035); parts.push(fg);
  parts.push(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20).rotateX(Math.PI / 2).translate(0, 0, wd / 2 - 0.005));
  return mergeGeometries(parts.map(g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; })); }

export function buildCaddy(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.3, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.8, side: THREE.BackSide, envMapIntensity: 0.1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.55, metalness: 0.1 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.85 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x08090a, roughness: 0.1, clearcoat: 1, envMapIntensity: 1.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.12, metalness: 1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0e1418, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.42, envMapIntensity: 0.7, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff0800, emissiveIntensity: 0.6, roughness: 0.15, toneMapped: false });
  const headMat = new THREE.MeshPhysicalMaterial({ color: 0xc4cbd2, emissive: 0xfff1d6, emissiveIntensity: 0.15, roughness: 0.12, metalness: 0.85, clearcoat: 1, envMapIntensity: 1.3 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0xb5bac0, roughness: 0.3, metalness: 0.9 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const cabin = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.8, envMapIntensity: 0.1 }), cabin2 = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.75, envMapIntensity: 0.1 });
  const add = (g, m, p = body, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; p.add(o); return o; };

  // ---- body shell ----
  // ring: roof centre, roof crown, roof edge, roof radius, belt (window sill), shoulder, side, sill
  const R = (x, ry, rw, by, bw, sy, sw, ly, lw) => [x, [[0, ry], [rw * 0.55, ry - 0.008], [rw, ry - 0.03], [rw + (bw - rw) * 0.45, ry - Math.min(0.09, (ry - by) * 0.3)], [bw, by], [sw + 0.007, by - 0.11], [sw, sy], [lw, ly]]];
  const S = [
    R(2.29, 0.87, 0.50, 0.84, 0.70, 0.46, 0.79, 0.24, 0.76),
    R(2.255, 0.94, 0.60, 0.91, 0.82, 0.48, 0.885, 0.23, 0.86),
    R(2.14, 0.975, 0.68, 0.94, 0.88, 0.52, 0.918, 0.24, 0.89),
    R(1.75, 1.03, 0.72, 0.985, 0.905, 0.56, 0.928, 0.26, 0.90),
    R(1.32, 1.085, 0.72, 1.03, 0.912, 0.58, 0.928, 0.27, 0.90),
    R(1.18, 1.11, 0.70, 1.045, 0.912, 0.59, 0.928, 0.27, 0.90),
    R(0.85, 1.42, 0.70, 1.055, 0.905, 0.60, 0.928, 0.27, 0.90),
    R(0.52, 1.73, 0.70, 1.065, 0.898, 0.61, 0.928, 0.27, 0.90),
    R(0.34, 1.80, 0.71, 1.07, 0.895, 0.61, 0.928, 0.27, 0.90),
    R(-1.4, 1.82, 0.72, 1.075, 0.895, 0.62, 0.926, 0.28, 0.90),
    R(-2.08, 1.80, 0.71, 1.08, 0.885, 0.62, 0.915, 0.31, 0.885),
    R(-2.21, 1.77, 0.68, 1.07, 0.86, 0.62, 0.89, 0.33, 0.86)];
  const XF = 2.29, XR = -2.21;
  const winX = [[0.98, 0.06], [-0.06, -1.08], [-1.20, -1.98]];
  const shellGeo = surf(S, XF, XR, 0, 7, 0, true, 0, 56, (x, r) => (x < 1.15 && x > 0.37 && r < 2.88) || (r > 3.12 && r < 3.9 && winX.some(([a, b]) => x < a - 0.01 && x > b + 0.01)));
  add(shellGeo, paint); add(shellGeo, trim, body, false);   // inside of the panels reads as dark trim from the cabin
  add(cap(S[0][1], XF, 1), paint); add(cap(S[S.length - 1][1], XR, -1), paint);
  // glass: windscreen, side windows, rear window
  add(surf(S, 1.165, 0.36, 0, 2.9, 0.004), glass, body, false);
  add(surf(S, 0.98, 0.06, 3.12, 3.92, 0.004), glass, body, false);        // front door
  add(surf(S, -0.06, -1.08, 3.10, 3.92, 0.004), glass, body, false);      // sliding door
  add(surf(S, -1.20, -1.98, 3.10, 3.9, 0.004), glass, body, false);     // rear quarter
  add(surf(S, 1.0, -2.0, 3.04, 3.95, 0.002), black, body, false);        // black greenhouse / pillars behind the glass
  add(surf(S, 0.98, -2.0, 3.96, 4.03, 0.003), chrome, body, false);       // belt-line trim
  for (const x of [0.02, -1.14]) add(surf(S, x + 0.05, x - 0.05, 3.05, 3.98, 0.004), black, body, false);   // B / C pillars
  // panel gaps & handles
  for (const x of [1.04, 0.0, -1.12]) add(surf(S, x + 0.004, x - 0.004, 4.05, 6.85, 0.0015), black, body, false);
  for (const x of [0.12, -0.98]) add(box(0.17, 0.035, 0.03, x, 1.0, 0.935).clone().applyMatrix4(new THREE.Matrix4()), black).geometry;
  for (const x of [0.12, -0.98]) add(box(0.17, 0.035, 0.03, x, 1.0, -0.935), black);
  add(surf(S, -0.4, -1.2, 4.0, 4.06, 0.003), black, body, false);       // sliding-door rail
  // roof rails
  for (const s of [-1, 1]) { add(box(2.2, 0.035, 0.05, -0.75, 1.84, s * 0.64), black); for (const x of [0.25, -1.9]) add(box(0.12, 0.05, 0.05, x, 1.815, s * 0.64), black); }
  // lower cladding & sills
  add(surf(S, 2.2, -2.15, 6.7, 7, 0.004, true), plastic, body, false);
  // ---- front fascia (drawn on the nose cap) ----
  const fx = XF + 0.004;
  const shapePanel = (pts, x, mat, seg = 16) => { const sh = new THREE.Shape(); pts.forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y)); sh.closePath();
    let g = new THREE.ShapeGeometry(sh, 4); g = g.toNonIndexed(); // densify in z so the panel can follow the curved nose
    const tess = []; const P = g.attributes.position; for (let t = 0; t < P.count; t += 3) { const v = [0, 1, 2].map(k => new THREE.Vector3(P.getX(t + k), P.getY(t + k), 0)); const sub = (a, b, c, d) => { const w = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)); if (d > 4 || w < 0.06) { tess.push(a, b, c); return; } const ab = a.clone().lerp(b, 0.5), bc = b.clone().lerp(c, 0.5), ca = c.clone().lerp(a, 0.5); sub(a, ab, ca, d + 1); sub(ab, b, bc, d + 1); sub(ca, bc, c, d + 1); sub(ab, bc, ca, d + 1); }; sub(...v, 0); }
    const out = new THREE.BufferGeometry().setFromPoints(tess.map(v => new THREE.Vector3(x, v.y, -v.x))); out.computeVertexNormals(); return add(out, mat, body, false); };
  // slim headlights joined by a narrow grille with a chrome bar
  shapePanel([[-0.40, 0.80], [0.40, 0.80], [0.42, 0.855], [-0.42, 0.855]], fx + 0.003, gloss);
  add(panel(0.84, 0.012, fx + 0.006, 0.795, 0, 24), chrome);
  for (const s of [-1, 1]) {
    shapePanel([[0.40, 0.765], [0.80, 0.80], [0.84, 0.865], [0.42, 0.865]].map(([z, y]) => [s * z, y]), fx + 0.004, headMat);          // lens
    shapePanel([[0.44, 0.775], [0.78, 0.805], [0.81, 0.855], [0.45, 0.855]].map(([z, y]) => [s * z, y]), fx + 0.006, gloss);            // dark inner housing
    shapePanel([[0.45, 0.846], [0.80, 0.846], [0.81, 0.856], [0.45, 0.856]].map(([z, y]) => [s * z, y]), fx + 0.009, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));   // LED eyebrow
    for (const zc of [0.53, 0.66]) { const pj = new THREE.CylinderGeometry(0.028, 0.03, 0.02, 16).rotateZ(Math.PI / 2); pj.translate(fx + 0.012, 0.815, s * zc); add(pj, headMat, body, false); }
    shapePanel([[0.62, 0.30], [0.80, 0.30], [0.80, 0.50], [0.70, 0.52]].map(([z, y]) => [s * z, y]), fx + 0.003, plastic);              // corner vents
    add(panel(0.12, 0.02, fx + 0.006, 0.36, s * 0.72, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));        // fog / DRL slit
  }
  // big trapezoid lower intake with a honeycomb mesh
  const hc = document.createElement('canvas'); hc.width = hc.height = 64; const hg = hc.getContext('2d'); hg.fillStyle = '#0a0a0b'; hg.fillRect(0, 0, 64, 64); hg.strokeStyle = '#2a2b2e'; hg.lineWidth = 3;
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const cx = x * 24 + (y % 2) * 12, cy = y * 21; hg.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; hg[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 11, cy + Math.sin(a) * 11); } hg.closePath(); hg.stroke(); }
  const hTex = new THREE.CanvasTexture(hc); hTex.wrapS = hTex.wrapT = THREE.RepeatWrapping; hTex.repeat.set(14, 4); const honey = new THREE.MeshStandardMaterial({ map: hTex, roughness: 0.6 });
  const intake = shapePanel([[-0.56, 0.27], [0.56, 0.27], [0.48, 0.52], [-0.48, 0.52]], fx + 0.003, honey);
  { const P = intake.geometry.attributes.position, uv = []; for (let i = 0; i < P.count; i++) uv.push(P.getZ(i) + 0.6, P.getY(i)); intake.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); }
  add(rbox(0.52, 0.11, 0.008, 0.01, fx + 0.008, 0.62, 0), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));   // plate
  add(box(0.05, 0.04, 1.4, fx - 0.01, 0.245, 0), plastic);                  // splitter lip
  // ---- rear ----
  const rx = XR - 0.004;
  add(panel(1.26, 0.5, rx - 0.004, 1.43), glass, body, false); add(panel(1.3, 0.54, rx - 0.002, 1.43), gloss, body, false);   // tailgate window
  for (const s of [-1, 1]) { add(rbox(0.16, 0.46, 0.03, 0.03, rx - 0.008, 1.18, s * 0.79), brakeMat, body, false);    // tall pillar lamps
    add(rbox(0.06, 0.36, 0.012, 0.02, rx - 0.026, 1.18, s * 0.79), new THREE.MeshStandardMaterial({ color: 0x220000, roughness: 0.2 }), body, false); }
  add(box(0.3, 0.025, 0.07, rx + 0.02, 1.72, 0), brakeMat);                // third brake light (roof spoiler)
  add(box(0.14, 0.06, 1.38, -2.2, 1.72, 0), paint);                        // spoiler
  add(rbox(0.52, 0.11, 0.008, 0.01, rx - 0.004, 0.86, 0), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
  add(box(0.06, 0.3, 1.76, rx - 0.02, 0.46, 0), plastic);           // rear bumper
  add(panel(1.5, 0.008, rx - 0.003, 1.08), black);                  // tailgate shut line
  add(box(0.06, 0.02, 0.12, rx - 0.02, 0.78, 0), chrome);                  // tailgate handle
  // ---- mirrors ----
  for (const s of [-1, 1]) { const h = new RoundedBoxGeometry(0.1, 0.16, 0.25, 4, 0.04); h.translate(0.995, 1.17, s * 1.0); add(h, paint); add(new RoundedBoxGeometry(0.012, 0.142, 0.232, 4, 0.034).translate(0.946, 1.17, s * 1.0), black);
    add(box(0.06, 0.04, 0.12, 1.06, 1.1, s * 0.93), black); }
  const mdefs = { in: { c: [0.56, 1.645, 0], n: [-0.99, -0.08, 0], w: 0.25, h: 0.065, housing: true }, L: { c: [0.94, 1.17, -1.0], n: [-1, 0, 0], w: 0.21, h: 0.124, fixed: true, rad: 46 } };
  // ---- wheel arches, underbody ----
  for (const ax of [AX, -AX]) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(ARCH + 0.005, ARCH + 0.005, 0.28, 24, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).rotateY(0).translate(ax, RW, s * 0.78), plastic, body, false);
  add(box(4.3, 0.02, 1.7, 0.04, 0.26, 0), plastic, body, false);
  // ---- cabin ----
  const interior = new THREE.Group(); body.add(interior);
  const cab = buildCabin({ xDash: 1.12, xFace: 0.70, yTop: 1.13, yFloor: 0.42, halfW: 0.78, zDrv: -0.37, seatX: -0.05, seatY: 0.74, back: 0.24, roofY: 1.79, xVisor: 0.5,
    doorZ: 0.85, xDoorF: 1.0, xDoorR: 0.08, rear: { x: -0.95, y: 0.76, w: 1.4 }, cluster: { c: [0.672, 1.165, -0.37], w: 0.27, h: 0.1 }, screen: { c: [0.66, 1.19, 0.02], w: 0.25, h: 0.15, tilt: -0.1, stand: true },
    sw: { c: [0.45, 1.0, -0.37], n: [-0.88, 0.47, 0], r: 0.185 }, shifter: 'dsg', trimKind: 'alu', col: { dash: 0x222326, low: 0x18191b, seat: 0x232427, ins: '#34363b', stitch: '#7a7d84', amb: 0x6fb6ff } });
  interior.add(cab.group); const swIn = cab.swG.userData.inner, swAxisC = cab.swAxis;
  add(new THREE.BoxGeometry(2.55, 0.015, 1.6).translate(-0.85, 1.775, 0), new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.9 }), interior);   // headliner
  add(new THREE.BoxGeometry(0.06, 0.6, 1.5).translate(-1.55, 1.0, 0), cabin, interior);   // luggage-area partition behind the bench
  // digital cockpit
  const dcv = document.createElement('canvas'); dcv.width = 384; dcv.height = 150; const dtex = new THREE.CanvasTexture(dcv); dtex.colorSpace = THREE.SRGBColorSpace;
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.1), new THREE.MeshBasicMaterial({ map: dtex, toneMapped: false })); dash.position.set(0.658, 1.165, -0.37); dash.rotation.y = -Math.PI / 2; interior.add(dash);
  // ---- wheels ----
  const tyreG = tyre(RW, 0.205), rimG = rim(0.217, 0.17), discG = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 28).rotateX(Math.PI / 2);
  const discM = new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.35, metalness: 0.9 });
  const pivots = []; const unsprung = new THREE.Group(); root.add(unsprung);
  for (const [x, s] of [[AX, -1], [AX, 1], [-AX, -1], [-AX, 1]]) { const steerG = new THREE.Group(); steerG.position.set(x, RW, s * TR); unsprung.add(steerG); const spin = new THREE.Group(); steerG.add(spin);
    const side = new THREE.Group(); side.scale.z = s; spin.add(side);
    add(tyreG, rubber, side); add(rimG, alloy, side); add(discG.clone().translate(0, 0, 0.0), discM, side, false);
    const cal = box(0.07, 0.12, 0.05, 0, 0, 0.02); cal.translate(x > 0 ? -0.1 : 0.1, 0.06, 0); const cm = add(cal, black, steerG); cm.scale.z = s;
    pivots.push({ steerG, spin, front: x > 0 }); }
  // contact shadow
  const sc = document.createElement('canvas'); sc.width = 128; sc.height = 64; const sg = sc.getContext('2d'); sg.filter = 'blur(7px)'; sg.fillStyle = 'rgba(0,0,0,.8)'; sg.beginPath(); sg.roundRect(14, 12, 100, 40, 14); sg.fill();
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 2.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; sh.renderOrder = 2; unsprung.add(sh);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.4, 10).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66b3ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.set(XR - 0.15, 0.3, -0.55); flame.visible = false; body.add(flame);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12).rotateZ(Math.PI / 2).translate(XR + 0.02, 0.3, -0.55), chrome);

  // round the nose and tail in plan view (applied to everything hung on the body near the ends)
  const done = new Set(); body.traverse(o => { if (!o.isMesh || done.has(o.geometry) || o.parent !== body) return; done.add(o.geometry); const P = o.geometry.attributes.position; let ch = false;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i); if (x > 1.95) { const f = Math.min(1, (x - 1.95) / 0.34); P.setX(i, x - 0.13 * z * z * f - 0.42 * Math.max(0, y - 0.5) * f); ch = true; } else if (x < -2.0) { P.setX(i, x + 0.07 * z * z * Math.min(1, (-2.0 - x) / 0.21)); ch = true; } }
    if (ch) { P.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingSphere(); } });
  const envMats = [paint, glass, gloss, chrome, headMat, alloy]; const tq = new THREE.Quaternion(), zAx = new THREE.Vector3(0, 0, 1);
  return { root, body, paint, brakeMat, headMat, flames: [flame], wheels: [], mirrorDefs: mdefs, pivots: [], steer: new THREE.Object3D(), interior, lowerMesh: null, origPos: null, color, vid: 'caddy',
    gauge: { canvas: null, tex: {}, ctx: null },
    setEnvMap(t) { for (const m of envMats) { m.envMap = t; m.needsUpdate = true; } },
    cockpit: [0.02, 1.47, -0.37], cockpitLook: [6, 1.06, -0.37], hood: [1.2, 1.55, 0], mirror: [0.8, 1.6, 0],
    drawDash(rpm, kmh, gear) { const g = dcv.getContext('2d'), W = dcv.width, H = dcv.height; const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1a2e'); bg.addColorStop(1, '#04070d'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const arc = (cx, v, max, col) => { g.lineWidth = 9; g.strokeStyle = '#1c2a3c'; g.beginPath(); g.arc(cx, 92, 56, Math.PI * 0.8, Math.PI * 2.2); g.stroke(); g.strokeStyle = col; g.beginPath(); g.arc(cx, 92, 56, Math.PI * 0.8, Math.PI * 0.8 + Math.PI * 1.4 * Math.min(1, v / max)); g.stroke(); };
      arc(70, kmh, 200, '#4fb3ff'); arc(W - 70, rpm, 5000, rpm > 4300 ? '#ff5a4f' : '#4fb3ff');
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 34px Inter,sans-serif'; g.fillText(String(kmh), 70, 92); g.font = '600 13px Inter,sans-serif'; g.fillStyle = '#8fb6dc'; g.fillText('km/h', 70, 122);
      g.fillStyle = '#fff'; g.font = 'bold 24px Inter,sans-serif'; g.fillText((rpm / 1000).toFixed(1), W - 70, 92); g.font = '600 13px Inter,sans-serif'; g.fillStyle = '#8fb6dc'; g.fillText('x1000/dk', W - 70, 122);
      g.fillStyle = '#fff'; g.font = 'bold 44px Inter,sans-serif'; g.fillText(gear, W / 2, 80); g.font = '600 13px Inter,sans-serif'; g.fillStyle = '#8fb6dc'; g.fillText('DSG', W / 2, 116); dtex.needsUpdate = true; },
    setPose(steer, ang) { pivots.forEach((p, i) => { if (p.front) p.steerG.rotation.y = -steer; p.spin.rotation.z = -ang[i]; }); tq.setFromAxisAngle(swAxisC, -steer * 7); swIn.quaternion.copy(tq); } };
}
