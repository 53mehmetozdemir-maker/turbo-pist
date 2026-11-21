// Regions outside the city: a ring motorway (otoyol) around the city, the coastal road (sahil yolu) with beach and sea on
// the west leg, a winding mountain road (dağ yolu) climbing to a summit lookout, and a car park / drift area.
// Provides meshes, ground height, surface type, collisions, highway traffic and the world map.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SIZE, CAR_COLORS } from './city.js';

export const WORLD_MIN = -1400, WORLD_MAX = 2500;
const RING = { x0: -150, y0: -150, x1: SIZE + 150, y1: SIZE + 150, R: 140 };
const HW = { median: 1.5, lane: 3.6, lanes: 3, shoulder: 2.6 };   // motorway cross-section
const HW_HALF = HW.median + 0.6 + HW.lane * HW.lanes + HW.shoulder; // 15.5 m
const SEA_X = -232, SHORE_X = -176;

// ---------------- geometry helpers ----------------
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function resample(pts, step, closed) {   // even spacing along a polyline
  const P = closed ? [...pts, pts[0]] : pts, out = []; let carry = 0;
  for (let i = 0; i < P.length - 1; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], L = Math.hypot(bx - ax, by - ay); let d = carry;
    while (d < L) { const t = d / L; out.push([ax + (bx - ax) * t, ay + (by - ay) * t]); d += step; } carry = d - L; }
  if (!closed) out.push(P[P.length - 1]); return out;
}
function catmull(ctrl, perSeg = 24) { const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) { const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < perSeg; k++) { const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } }
  out.push(ctrl[ctrl.length - 1]); return out; }
// frames along a polyline: position, tangent, normal (to the right of travel), arc length
function frames(pts, closed) { const n = pts.length, F = []; let s = 0;
  for (let i = 0; i < n; i++) { const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    F.push({ x: pts[i][0], y: pts[i][1], tx, ty, nx: -ty, ny: tx, s }); }
  if (closed) F.total = s + Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]); else F.total = s; return F; }
function roundedRect(r) { const pts = [], { x0, y0, x1, y1, R } = r, arc = (cx, cy, a0) => { for (let k = 0; k <= 16; k++) { const a = a0 + k / 16 * Math.PI / 2; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } };
  pts.push([x0 + R, y0]); pts.push([x1 - R, y0]); arc(x1 - R, y0 + R, -Math.PI / 2); pts.push([x1, y1 - R]); arc(x1 - R, y1 - R, 0); pts.push([x0 + R, y1]); arc(x0 + R, y1 - R, Math.PI / 2); pts.push([x0, y0 + R]); arc(x0 + R, y0 + R, Math.PI);
  return pts; }

// ---------------- textures ----------------
function canvasTex(w, h, draw, rep = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
let seed = 911; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function asphalt(g, w, h, base = '#3b3d41') { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < w * h / 18; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${rnd() * 0.22})` : `rgba(255,255,255,${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } }
// road surface texture across the full width: u = 0..1 across (left to right of travel), v repeats along the road
function roadTex(kind) {
  const W = 1024, H = 1024;
  return canvasTex(W, H, (g) => { asphalt(g, W, H, kind === 'pad' ? '#35373b' : '#3a3c40');
    const line = (u, w, col, dash) => { g.fillStyle = col; const x = u * W - w / 2; if (!dash) g.fillRect(x, 0, w, H); else for (let y = 0; y < H; y += dash[0] + dash[1]) g.fillRect(x, y, w, dash[0]); };
    const wear = () => { for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(58,60,64,${rnd() * 0.5})`; g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 2 + rnd() * 3); } };
    const WH = 'rgba(236,236,230,.95)', YE = 'rgba(240,190,40,.95)';
    if (kind === 'hw') {   // full motorway width 2*HW_HALF: shoulder | 3 lanes | median | 3 lanes | shoulder
      const T = 2 * HW_HALF, U = m => (m + HW_HALF) / T, px = m => m / T * W;
      g.fillStyle = '#8e8c86'; g.fillRect(U(-HW.median) * W, 0, px(2 * HW.median), H);          // concrete median strip
      for (const sg of [-1, 1]) { const e = sg * (HW.median + 0.6 + HW.lane * 3);
        line(U(e), px(0.2), WH); line(U(sg * (HW.median + 0.35)), px(0.15), YE);
        for (const k of [1, 2]) line(U(sg * (HW.median + 0.6 + HW.lane * k)), px(0.15), WH, [Math.round(H * 4 / 12), Math.round(H * 8 / 12)]);
        // rumble strip texture on the shoulder edge
        for (let y = 0; y < H; y += 10) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(U(e + sg * 0.5) * W - px(0.25), y, px(0.5), 4); } }
      wear();
    } else if (kind === 'road2') {   // 2+2 lanes 16 m like the city
      const T = 16, U = m => (m + 8) / T, px = m => m / T * W;
      line(U(-0.17), px(0.15), YE); line(U(0.17), px(0.15), YE); line(U(-7.3), px(0.15), WH); line(U(7.3), px(0.15), WH);
      line(U(-3.5), px(0.15), WH, [Math.round(H * 3 / 12), Math.round(H * 9 / 12)]); line(U(3.5), px(0.15), WH, [Math.round(H * 3 / 12), Math.round(H * 9 / 12)]); wear();
    } else if (kind === 'mtn') {    // 1+1 lanes, 9 m: solid centre line (no overtaking on the mountain), edge lines
      const T = 9, U = m => (m + 4.5) / T, px = m => m / T * W;
      line(U(0), px(0.15), WH); line(U(-3.9), px(0.15), WH); line(U(3.9), px(0.15), WH);
      for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(20,20,20,.5)'; g.lineWidth = 2; g.beginPath(); let x = rnd() * W, y = rnd() * H; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 40; y += rnd() * 40; g.lineTo(x, y); } g.stroke(); }   // patched cracks
      wear();
    }
  });
}

// ---------------- the region layout ----------------
const ringPts = resample(roundedRect(RING), 4, true);
const ringF = frames(ringPts, true);
// link roads from the city edge to the motorway, plus the branches to the mountain and the drift park
const LINK_HALF = 8;
const links = [
  { name: 'Kuzey Bağlantı Yolu', a: [SIZE / 2, -8], b: [SIZE / 2, RING.y0 + HW_HALF - 0.5] },
  { name: 'Güney Bağlantı Yolu', a: [SIZE / 2, SIZE + 8], b: [SIZE / 2, RING.y1 - HW_HALF + 0.5] },
  { name: 'Sahil Bağlantı Yolu', a: [-8, SIZE / 2], b: [RING.x0 + HW_HALF - 0.5, SIZE / 2] },
  { name: 'Doğu Bağlantı Yolu', a: [SIZE + 8, SIZE / 2], b: [RING.x1 - HW_HALF + 0.5, SIZE / 2] },
];
// mountain road: branches off the east leg of the motorway and climbs in hairpins to the summit lookout
const MTN_HALF = 4.5;
const mtnCtrl = [[RING.x1 + HW_HALF - 1, 300], [RING.x1 + 70, 300], [1330, 318], [1420, 282], [1468, 205], [1446, 145], [1392, 118], [1385, 62], [1440, 25], [1530, 22], [1612, 58], [1668, 28], [1660, -40], [1600, -78], [1560, -125], [1590, -180], [1680, -205], [1770, -196], [1812, -200]];
const mtnPts = resample(catmull(mtnCtrl, 30), 3, false); const mtnF = frames(mtnPts, false);
// drift park + car park
const PAD = { x0: 1205, y0: 860, x1: 1470, y1: 1105 };
const padLink = { name: 'Drift Park Yolu', a: [RING.x1 + HW_HALF - 1, 980], b: [PAD.x0 + 1, 980], half: 7 };

// ---------------- natural terrain (mountain) ----------------
function hash2(x, y) { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const bumps = [[1640, -20, 55, 520], [2250, -520, 230, 480], [2300, 260, 190, 420], [1900, -820, 200, 420], [1320, -560, 120, 300], [2080, 560, 90, 300], [1620, 560, 40, 220]];
function natural(x, y) { if (x < 1180) return 0; let h = 0; for (const [bx, by, bh, br] of bumps) { const d2 = ((x - bx) ** 2 + (y - by) ** 2) / (br * br); h += bh * Math.exp(-d2 * 1.6); }
  h += (vnoise(x / 90, y / 90) - 0.5) * 26 + (vnoise(x / 30, y / 30) - 0.5) * 6;
  return Math.max(0, h) * smooth(1180, 1300, x) * (1 - smooth(640, 840, y)); }
// road profile: a steady climb (≈8.5 %) with gentle transitions at both ends; the mountain is shaped around the road
{ const L = mtnF.total, G = 0.085; let h = 0; mtnF[0].h = 0;
  for (let i = 1; i < mtnF.length; i++) { const s = (mtnF[i].s + mtnF[i - 1].s) / 2, ds = mtnF[i].s - mtnF[i - 1].s; h += G * smooth(50, 140, s) * (1 - smooth(L - 90, L - 15, s)) * ds; mtnF[i].h = h; } }
const MTN_TOP = mtnF[mtnF.length - 1].h;
const SUMMIT = { x: 1836, y: -202, r: 26, h: MTN_TOP };
// nearest point on the mountain road (spatial grid)
const mGrid = new Map(), MG = 40;
mtnF.forEach((f, i) => { const k = Math.floor(f.x / MG) + ',' + Math.floor(f.y / MG); (mGrid.get(k) || mGrid.set(k, []).get(k)).push(i); });
function nearestMtn(x, y, R = 2) { const gx = Math.floor(x / MG), gy = Math.floor(y / MG); let best = null, bd = 1e18;
  for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) { const L = mGrid.get((gx + i) + ',' + (gy + j)); if (!L) continue; for (const k of L) { const f = mtnF[k], d = (f.x - x) ** 2 + (f.y - y) ** 2; if (d < bd) { bd = d; best = k; } } }
  if (best == null) return null;
  // refine on the two neighbouring segments
  const f = mtnF[best]; let s = f.s, h = f.h, lat = (x - f.x) * f.nx + (y - f.y) * f.ny, along = (x - f.x) * f.tx + (y - f.y) * f.ty;
  const nb = mtnF[Math.max(0, Math.min(mtnF.length - 1, best + (along > 0 ? 1 : -1)))]; const segL = Math.abs(nb.s - f.s) || 1, t = Math.max(0, Math.min(1, Math.abs(along) / segL));
  h = f.h + (nb.h - f.h) * t; return { i: best, d: Math.abs(lat), dist: Math.sqrt(bd), h, s: f.s + (nb.s - f.s) * t, lat }; }
const SIDE = 0.42;   // hillside slope falling away from the road (ridge road)
function ridge(x, y) {   // the highest of the hillside 'cones' below every nearby road point (continuous across hairpins)
  const gx = Math.floor(x / MG), gy = Math.floor(y / MG); let best = -1e9;
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const L = mGrid.get((gx + i) + ',' + (gy + j)); if (!L) continue;
    for (const k of L) { const f = mtnF[k], d = Math.hypot(f.x - x, f.y - y); const v = f.h - SIDE * Math.max(0, d - MTN_HALF - 3); if (v > best) best = v; } }
  const ds = Math.hypot(x - SUMMIT.x, y - SUMMIT.y); best = Math.max(best, SUMMIT.h - 0.6 - SIDE * Math.max(0, ds - SUMMIT.r - 2));
  return best; }
export function terrainH(x, y) {
  if (x < 1170 || x > WORLD_MAX + 50 || y < WORLD_MIN - 50 || y > 900) return x < SHORE_X ? -1.6 * smooth(SHORE_X, SEA_X + 6, x) : 0;
  let h = Math.max(natural(x, y), ridge(x, y) * smooth(1170, 1200, x));
  const ds = Math.hypot(x - SUMMIT.x, y - SUMMIT.y);
  if (ds < SUMMIT.r + 6) { const w = smooth(SUMMIT.r, SUMMIT.r + 6, ds); h = SUMMIT.h + 0.05 + (h - SUMMIT.h - 0.05) * w; }
  const n = nearestMtn(x, y); if (n) { const w = smooth(MTN_HALF + 0.8, MTN_HALF + 3, n.d); h = n.h + 0.04 + (h - n.h - 0.04) * w; }
  return h;
}

// ---------------- road lookup: surface & names ----------------
function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
function ringInfo(x, y) {   // distance to the motorway centreline + which leg
  const { x0, y0, x1, y1, R } = RING; const cx = Math.max(x0 + R, Math.min(x1 - R, x)), cy = Math.max(y0 + R, Math.min(y1 - R, y));
  let d; if ((x < x0 + R || x > x1 - R) && (y < y0 + R || y > y1 - R)) d = Math.abs(Math.hypot(x - cx, y - cy) - R);
  else d = Math.min(Math.abs(x - x0), Math.abs(x - x1), Math.abs(y - y0), Math.abs(y - y1));
  const leg = Math.abs(x - x0) < 40 && y > y0 + R * 0.4 && y < y1 - R * 0.4 ? 'w' : Math.abs(x - x1) < 40 ? 'e' : y < SIZE / 2 ? 'n' : 's';
  return { d, leg }; }
export function regionSurface(x, y) {
  if (ringInfo(x, y).d < HW_HALF) return 0;
  for (const L of links) if (distSeg(x, y, L.a[0], L.a[1], L.b[0], L.b[1]) < LINK_HALF) return 0;
  if (distSeg(x, y, padLink.a[0], padLink.a[1], padLink.b[0], padLink.b[1]) < padLink.half) return 0;
  if (x > PAD.x0 && x < PAD.x1 && y > PAD.y0 && y < PAD.y1) return 0;
  if (x > 1170) { if (Math.hypot(x - SUMMIT.x, y - SUMMIT.y) < SUMMIT.r) return 0; const n = nearestMtn(x, y, 1); if (n && n.d < MTN_HALF) return 0; }
  return 4;
}
export function regionName(x, y) {
  const r = ringInfo(x, y); if (r.d < HW_HALF + 4) return r.leg === 'w' ? { name: 'Sahil Yolu', area: 'Sahil' } : { name: { n: 'O-1 Kuzey Otoyolu', e: 'O-1 Doğu Otoyolu', s: 'O-1 Güney Otoyolu' }[r.leg], area: 'Otoyol' };
  for (const L of links) if (distSeg(x, y, L.a[0], L.a[1], L.b[0], L.b[1]) < LINK_HALF + 3) return { name: L.name, area: 'Şehir Çıkışı' };
  if ((x > PAD.x0 - 5 && x < PAD.x1 && y > PAD.y0 && y < PAD.y1) || distSeg(x, y, padLink.a[0], padLink.a[1], padLink.b[0], padLink.b[1]) < 9) return { name: 'TP Drift Park & Otopark', area: 'Drift Alanı' };
  if (x > 1170) { if (Math.hypot(x - SUMMIT.x, y - SUMMIT.y) < SUMMIT.r + 8) return { name: 'Zirve Seyir Terası', area: 'Dağ Yolu · ' + Math.round(MTN_TOP) + ' m' }; const n = nearestMtn(x, y, 1); if (n && n.d < 14) return { name: 'Kartal Tepe Dağ Yolu', area: 'Dağ Yolu · ' + Math.round(n.h) + ' m' }; return { name: 'Kartal Tepe', area: 'Dağlık Alan' }; }
  if (x < RING.x0 - HW_HALF) return { name: 'Altın Kum Plajı', area: 'Sahil' };
  return { name: 'Şehir Dışı', area: 'Kırsal' };
}

// ---------------- collisions (segment walls) ----------------
const walls = [], wGrid = new Map(), WG = 30;
function addWall(ax, ay, bx, by) { const id = walls.length; walls.push([ax, ay, bx, by]);
  const x0 = Math.floor(Math.min(ax, bx) / WG) - 1, x1 = Math.floor(Math.max(ax, bx) / WG) + 1, y0 = Math.floor(Math.min(ay, by) / WG) - 1, y1 = Math.floor(Math.max(ay, by) / WG) + 1;
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const k = i + ',' + j; (wGrid.get(k) || wGrid.set(k, []).get(k)).push(id); } }
function wallsAlong(F, off, skip, closed) {   // a wall offset from a centreline; skip(s) -> true leaves a gap
  const n = F.length, lim = closed ? n : n - 1;
  for (let i = 0; i < lim; i++) { const a = F[i], b = F[(i + 1) % n]; if (skip && (skip(a) || skip(b))) continue; addWall(a.x + a.nx * off, a.y + a.ny * off, b.x + b.nx * off, b.y + b.ny * off); } }
export function collideRegions(car) {
  for (const c of car.corners()) {
    if (c.x < WORLD_MIN) car.contact(c, -1, 0, WORLD_MIN - c.x); else if (c.x > WORLD_MAX) car.contact(c, 1, 0, c.x - WORLD_MAX);
    if (c.y < WORLD_MIN) car.contact(c, 0, -1, WORLD_MIN - c.y); else if (c.y > WORLD_MAX) car.contact(c, 0, 1, c.y - WORLD_MAX);
    if (c.x < SEA_X + 10) car.contact(c, 1, 0, SEA_X + 10 - c.x);
    const L = wGrid.get(Math.floor(c.x / WG) + ',' + Math.floor(c.y / WG)); if (!L) continue;
    for (const id of L) { const [ax, ay, bx, by] = walls[id]; const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; let t = ((c.x - ax) * dx + (c.y - ay) * dy) / L2; if (t < 0 || t > 1) continue;
      const px = ax + dx * t, py = ay + dy * t, ox = c.x - px, oy = c.y - py, d = Math.hypot(ox, oy), R = 0.35; if (d >= R) continue;
      // push the corner back to the side of the wall the car's centre is on
      let nx = -dy, ny = dx; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl; const side = Math.sign((car.x - px) * nx + (car.y - py) * ny) || 1; nx *= side; ny *= side;
      const sd = ox * nx + oy * ny; car.contact(c, -nx, -ny, R - sd); } }
}

// ---------------- highway traffic ----------------
export class HighwayTraffic {
  constructor(fleet, perLane = 5) {
    this.fleet = fleet; this.cars = []; this.L = ringF.total;
    for (let dir = 0; dir < 2; dir++) for (let lane = 0; lane < 3; lane++) for (let k = 0; k < perLane; k++) {
      const kind = ['sedan', 'sedan', 'suv', 'hatch', 'van', 'sedan'][(k + lane * 2 + dir) % 6], color = CAR_COLORS[(k * 5 + lane * 3 + dir * 7) % CAR_COLORS.length];
      const v0 = [23, 28, 34][lane] + (k % 3) * 1.2;
      this.cars.push({ dir, lane, s: (k + lane * 0.33 + dir * 0.17) / perLane * this.L, v: v0, v0, kind, len: fleet.shape(kind).L, id: fleet.add(kind, color), x: 0, y: 0, a: 0, vx: 0, vy: 0, brake: false, sig: 0, hw: true }); }
    for (const c of this.cars) this.place(c);
  }
  frameAt(s) { const L = this.L; s = ((s % L) + L) % L; let lo = 0, hi = ringF.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ringF[m].s <= s) lo = m; else hi = m - 1; }
    const a = ringF[lo], b = ringF[(lo + 1) % ringF.length], segL = (b.s > a.s ? b.s : L) - a.s, t = Math.min(1, (s - a.s) / (segL || 1));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx: a.tx + (b.tx - a.tx) * t, ty: a.ty + (b.ty - a.ty) * t, nx: a.nx + (b.nx - a.nx) * t, ny: a.ny + (b.ny - a.ny) * t }; }
  place(c) { const f = this.frameAt(c.s), off = (HW.median + 0.6 + HW.lane * (c.lane + 0.5)) * (c.dir ? -1 : 1);
    const x = f.x + f.nx * off, y = f.y + f.ny * off, a = Math.atan2(f.ty, f.tx) + (c.dir ? Math.PI : 0); c.vx = x - c.x; c.vy = y - c.y; c.x = x; c.y = y; c.a = a; }
  step(dt, players) {
    const L = this.L;
    for (const c of this.cars) {
      let gap = 1e9, vl = 0;
      for (const o of this.cars) { if (o === c || o.dir !== c.dir || o.lane !== c.lane) continue; let d = c.dir ? c.s - o.s : o.s - c.s; d = ((d % L) + L) % L; const g = d - (c.len + o.len) / 2; if (g < gap) { gap = g; vl = o.v; } }
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      for (const p of players) { const dx = p.x - c.x, dy = p.y - c.y, fwd = dx * ca + dy * sa; if (fwd <= 0 || fwd > 70) continue; if (Math.abs(-dx * sa + dy * ca) > 2.2) continue; const g = fwd - c.len / 2 - 2.3; if (g < gap) { gap = g; vl = Math.max(0, (p.vx || 0) * ca + (p.vy || 0) * sa); } }
      const a = 1.6, b = 3.5, s0 = 3, T = 1.3, ss = s0 + c.v * T + c.v * (c.v - vl) / (2 * Math.sqrt(a * b));
      let acc = a * (1 - Math.pow(c.v / c.v0, 4) - (gap < 1e8 ? Math.pow(ss / Math.max(gap, 0.1), 2) : 0)); acc = Math.max(-9, acc); c.brake = acc < -1.2;
      c.v = Math.max(0, c.v + acc * dt); c.s += (c.dir ? -1 : 1) * c.v * dt; c.s = ((c.s % L) + L) % L; this.place(c);
    }
  }
}

// ---------------- meshes ----------------
function ribbon(F, half, hAt, uv = true, closed = false, lift = 0.03, vScale = 12) {   // flat road strip following the frames
  const P = [], U = [], I = []; const n = F.length, cnt = closed ? n + 1 : n;
  for (let k = 0; k < cnt; k++) { const f = F[k % n], h = hAt(f) + lift, s = k === n ? F.total : f.s;
    P.push(f.x - f.nx * half, h, f.y - f.ny * half, f.x + f.nx * half, h, f.y + f.ny * half); U.push(0, s / vScale, 1, s / vScale);
    if (k > 0) { const a = (k - 1) * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); return g; }
function sweep(F, profile, off, hAt, closed = false, skip = null) {   // extrude a 2D profile [[lateral, up],...] along the frames, offset sideways
  const P = [], I = [], m = profile.length, n = F.length, cnt = closed ? n + 1 : n; let row = 0, prevOk = false;
  for (let k = 0; k < cnt; k++) { const f = F[k % n], ok = !(skip && skip(f)); if (!ok) { prevOk = false; continue; } const h = hAt(f);
    for (const [lx, ly] of profile) P.push(f.x + f.nx * (off + lx), h + ly, f.y + f.ny * (off + lx));
    if (prevOk) { const a = (row - 1) * m, b = row * m; for (let j = 0; j < m - 1; j++) I.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1); }
    row++; prevOk = true; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return g; }

export function buildRegions(scene, quality, grassMat) {
  const group = new THREE.Group(); scene.add(group); const glow = [];
  // flat grass everywhere outside the mountain heightfield and the beach
  if (grassMat) for (const [x0, y0, x1, y1] of [[-168, WORLD_MIN, 1172, WORLD_MAX], [1170, 898, WORLD_MAX, WORLD_MAX]]) { const m = grassMat.clone(); m.map = grassMat.map.clone(); m.map.repeat.set((x1 - x0) / 10, (y1 - y0) / 10); m.map.needsUpdate = true;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, -0.02, (y0 + y1) / 2), m); g.receiveShadow = true; group.add(g); }
  const low = quality === 'low';
  const std = o => new THREE.MeshStandardMaterial(o);
  const hwTex = roadTex('hw'), r2Tex = roadTex('road2'), mtTex = roadTex('mtn'), padTex = canvasTex(1024, 1024, (g, w, h) => { asphalt(g, w, h, '#36383c');
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(12,12,12,${0.15 + rnd() * 0.3})`; g.lineWidth = 6 + rnd() * 8; g.beginPath(); const cx = rnd() * w, cy = rnd() * h, r = 60 + rnd() * 260; g.arc(cx, cy, r, rnd() * 6, rnd() * 6 + 1 + rnd() * 3); g.stroke(); } });   // tyre marks
  const roadM = t => std({ map: t, roughness: 0.86, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 });
  const flat = () => 0;
  // ---- motorway ring + links ----
  group.add(mesh(ribbon(ringF, HW_HALF, flat, true, true, 0.02, 12), roadM(hwTex)));
  for (const L of links) { const F = frames(resample([L.a, L.b], 4, false), false); group.add(mesh(ribbon(F, LINK_HALF, flat, true, false, 0.025, 12), roadM(r2Tex))); L.F = F; }
  { const F = frames(resample([padLink.a, padLink.b], 4, false), false); group.add(mesh(ribbon(F, padLink.half, flat, true, false, 0.025, 12), roadM(r2Tex))); }
  // gaps in the barriers where roads join
  const near = (f, x, y, r) => Math.hypot(f.x - x, f.y - y) < r;
  const joins = [...links.map(L => L.b), mtnCtrl[0], padLink.a];
  const atJoin = r => f => joins.some(([x, y]) => near(f, x, y, r));
  // concrete median (Jersey barrier) with a gap at each junction for U-turns
  const jersey = [[-0.3, 0], [-0.22, 0.25], [-0.09, 0.82], [0.09, 0.82], [0.22, 0.25], [0.3, 0]];
  const concrete = std({ color: 0xb8b5ad, roughness: 0.9, side: THREE.DoubleSide });
  group.add(mesh(sweep(ringF, jersey, 0, flat, true, atJoin(HW_HALF + 14)), concrete, true));
  wallsAlong(ringF, 0, atJoin(HW_HALF + 14), true); wallsAlong(ringF, 0.25, atJoin(HW_HALF + 14), true); wallsAlong(ringF, -0.25, atJoin(HW_HALF + 14), true);
  // steel W-beam guardrails on both edges (gaps at junctions); posts instanced
  const steel = std({ color: 0xc4c9ce, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide });
  const rail = [[0, 0.52], [0.06, 0.6], [0.0, 0.68], [0.06, 0.76], [0, 0.84]];
  const postGeo = new THREE.BoxGeometry(0.12, 0.8, 0.12).translate(0, 0.4, 0); const posts = [];
  const guard = (F, off, skip, closed, hAt = flat, side = 1) => { const prof = rail.map(([l, u]) => [l * side, u]); group.add(mesh(sweep(F, prof, off, hAt, closed, skip), steel, false, true));
    wallsAlong(F, off, skip, closed); F.forEach((f, i) => { if (i % 2 || (skip && skip(f))) return; posts.push([f.x + f.nx * (off - side * 0.1), hAt(f), f.y + f.ny * (off - side * 0.1)]); }); };
  const gapAt = (off, r) => f => joins.some(([x, y]) => Math.hypot(f.x + f.nx * off - x, f.y + f.ny * off - y) < r);
  guard(ringF, HW_HALF + 0.3, gapAt(HW_HALF + 0.3, 12), true, flat, 1);
  guard(ringF, -(HW_HALF + 0.3), gapAt(-(HW_HALF + 0.3), 12), true, flat, -1);
  // ---- mountain road ----
  const mH = f => f.h;
  group.add(mesh(ribbon(mtnF, MTN_HALF, mH, true, false, 0.04, 9), roadM(mtTex)));
  const mSkip = f => f.s < 40;
  guard(mtnF, MTN_HALF + 0.5, mSkip, false, mH, 1); guard(mtnF, -(MTN_HALF + 0.5), mSkip, false, mH, -1);
  // summit lookout plaza with a railing (open towards the road)
  { const g = new THREE.CircleGeometry(SUMMIT.r, 48).rotateX(-Math.PI / 2).translate(SUMMIT.x, SUMMIT.h + 0.05, SUMMIT.y); const m = std({ map: padTex.clone(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 }); m.map.repeat.set(3, 3); group.add(mesh(g, m));
    const end = mtnF[mtnF.length - 1], entry = Math.atan2(end.y - SUMMIT.y, end.x - SUMMIT.x); const ring = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2; ring.push([SUMMIT.x + Math.cos(a) * (SUMMIT.r - 0.5), SUMMIT.y + Math.sin(a) * (SUMMIT.r - 0.5), a]); }
    const RF = frames(ring.map(p => [p[0], p[1]]), false); RF.forEach((f, i) => { f.a = ring[i][2]; f.h = SUMMIT.h; });
    const gapF = f => { let d = Math.abs(f.a - entry); d = Math.min(d, Math.PI * 2 - d); return d < 0.32; };
    guard(RF, 0, gapF, false, () => SUMMIT.h + 0.04, 1);
    // viewpoint: coin telescope, bench, sign
    const tel = new THREE.Group(); tel.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 10).translate(0, 0.55, 0), steel)); const head = mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.5, 12).rotateZ(Math.PI / 2).translate(0, 1.2, 0), std({ color: 0x2c64c8, roughness: 0.4, metalness: 0.4 })); tel.add(head);
    tel.position.set(SUMMIT.x - Math.cos(entry) * (SUMMIT.r - 2.5), SUMMIT.h, SUMMIT.y - Math.sin(entry) * (SUMMIT.r - 2.5)); tel.rotation.y = -entry; group.add(tel);
    const sign = signPanel(['ZİRVE SEYİR TERASI', `Kartal Tepe · ${Math.round(MTN_TOP)} m`], '#5a3b1e', '#ffe9c4', 6, 1.6); sign.position.set(SUMMIT.x + Math.cos(entry + 0.6) * (SUMMIT.r - 3), SUMMIT.h + 2.2, SUMMIT.y + Math.sin(entry + 0.6) * (SUMMIT.r - 3)); sign.rotation.y = -entry - 0.6 + Math.PI / 2; group.add(sign);
    const legs = new THREE.BoxGeometry(0.15, 2.2, 0.15); for (const s of [-1, 1]) { const l = mesh(legs, std({ color: 0x4a3018, roughness: 0.9 })); l.position.copy(sign.position).add(new THREE.Vector3(Math.cos(-sign.rotation.y) * s * 2.6, -1.1, Math.sin(-sign.rotation.y) * s * 2.6)); group.add(l); } }
  // ---- terrain: mountain heightfield with grass/rock colouring ----
  { const X0 = 1170, X1 = WORLD_MAX, Y0 = WORLD_MIN, Y1 = 900, st = low ? 14 : 9; const nx = Math.ceil((X1 - X0) / st), ny = Math.ceil((Y1 - Y0) / st);
    const g = new THREE.PlaneGeometry(X1 - X0, Y1 - Y0, nx, ny).rotateX(-Math.PI / 2); const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + (X0 + X1) / 2, y = pos.getZ(i) + (Y0 + Y1) / 2; const h = terrainH(x, y); pos.setXYZ(i, x, h - 0.04, y); }
    g.computeVertexNormals(); const nrm = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const ny2 = nrm.getY(i), h = pos.getY(i), rock = smooth(0.86, 0.7, ny2) * 0.9 + smooth(110, 170, h) * 0.6, k = Math.min(1, rock); const v = 0.9 + hash2(i, 3) * 0.2;
      col[i * 3] = (0.42 * (1 - k) + 0.55 * k) * v; col[i * 3 + 1] = (0.55 * (1 - k) + 0.52 * k) * v; col[i * 3 + 2] = (0.3 * (1 - k) + 0.48 * k) * v; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const gt = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#9aa58a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '40,60,25' : '200,200,170'},${rnd() * 0.25})`; c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } });
    gt.repeat.set((X1 - X0) / 12, (Y1 - Y0) / 12); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (X1 - X0) / 12, uv.getY(i) * (Y1 - Y0) / 12); gt.repeat.set(1, 1);
    const tm = mesh(g, std({ map: gt, vertexColors: true, roughness: 0.95 })); tm.receiveShadow = true; group.add(tm);
    // pine forest on the mountain, kept off the road
    const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6).translate(0, 1.2, 0), crownG = mergeGeometries([new THREE.ConeGeometry(2.0, 4.2, 8).translate(0, 4.0, 0), new THREE.ConeGeometry(1.6, 3.6, 8).translate(0, 5.8, 0), new THREE.ConeGeometry(1.1, 2.8, 8).translate(0, 7.4, 0)]);
    const N = low ? 900 : 2200, trunks = new THREE.InstancedMesh(trunkG, std({ color: 0x4b3420, roughness: 1 }), N), crowns = new THREE.InstancedMesh(crownG, std({ color: 0x2d5a2c, roughness: 0.95, flatShading: true }), N);
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), pv = new THREE.Vector3(), cc = new THREE.Color(); let n = 0;
    for (let t = 0; t < N * 6 && n < N; t++) { const x = X0 + 30 + rnd() * (X1 - X0 - 40), y = Y0 + 20 + rnd() * (Y1 - Y0 - 60); const nm = nearestMtn(x, y, 1); if (nm && nm.d < 14) continue; if (Math.hypot(x - SUMMIT.x, y - SUMMIT.y) < SUMMIT.r + 12) continue;
      if (x > PAD.x0 - 20 && x < PAD.x1 + 20 && y > PAD.y0 - 20) continue; if (x < RING.x1 + HW_HALF + 25) continue;
      const h = terrainH(x, y); if (h > 165 || (h < 2 && rnd() < 0.7)) continue; const s = 0.7 + rnd() * 0.7; q.setFromAxisAngle(up, rnd() * 6.28); sc.set(s, s * (0.9 + rnd() * 0.3), s); pv.set(x, h - 0.2, y); M4.compose(pv, q, sc);
      trunks.setMatrixAt(n, M4); crowns.setMatrixAt(n, M4); crowns.setColorAt(n, cc.setHSL(0.3 + rnd() * 0.06, 0.38 + rnd() * 0.15, 0.2 + rnd() * 0.1)); n++; }
    trunks.count = crowns.count = n; crowns.castShadow = !low; group.add(trunks, crowns); }
  // ---- coast: beach + sea ----
  { const sand = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#d9c79c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 26000; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '120,100,60' : '255,250,230'},${rnd() * 0.25})`; c.fillRect(rnd() * w, rnd() * h, 1, 1); } });
    const Y0 = WORLD_MIN, Y1 = WORLD_MAX, g = new THREE.PlaneGeometry(SHORE_X - SEA_X + 40, Y1 - Y0, 14, 60).rotateX(-Math.PI / 2); const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + (SHORE_X + SEA_X - 40) / 2 + 20, y = pos.getZ(i) + (Y0 + Y1) / 2; pos.setXYZ(i, x, terrainH(x, y) - 0.03, y); }
    g.computeVertexNormals(); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * (Y1 - Y0) / 10);
    group.add(mesh(g, std({ map: sand, roughness: 1 })));
    const water = std({ color: 0x1f6f8b, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.92, envMapIntensity: 1.4 });
    const sea = mesh(new THREE.PlaneGeometry(4000, Y1 - Y0 + 2000).rotateX(-Math.PI / 2).translate(SEA_X + 8 - 2000, -0.75, (Y0 + Y1) / 2), water); group.add(sea); sea.receiveShadow = false;
    // foam line
    const foam = mesh(new THREE.PlaneGeometry(4, Y1 - Y0).rotateX(-Math.PI / 2).translate(SEA_X + 7, -0.72, (Y0 + Y1) / 2), new THREE.MeshBasicMaterial({ color: 0xe8f4f8, transparent: true, opacity: 0.55, depthWrite: false })); group.add(foam);
    // palms, umbrellas, lifeguard tower along the beach
    const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 7, 7).translate(0, 3.5, 0); trunkG.rotateZ(0.08);
    const leaf = new THREE.PlaneGeometry(4.2, 0.9, 6, 1); { const p = leaf.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 2.1; p.setXYZ(i, x, -0.06 * x * x, p.getY(i) * (1 - x / 5)); } leaf.computeVertexNormals(); }
    const fronds = []; for (let k = 0; k < 8; k++) fronds.push(leaf.clone().rotateZ(0.25).rotateY(k / 8 * Math.PI * 2).translate(0.55, 7.05, 0)); const crown = mergeGeometries(fronds);
    const NP = 90, T = new THREE.InstancedMesh(trunkG, std({ color: 0x8a6a46, roughness: 1 }), NP), C = new THREE.InstancedMesh(crown, std({ color: 0x3f7f2f, roughness: 0.85, side: THREE.DoubleSide }), NP);
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), pv = new THREE.Vector3();
    for (let k = 0; k < NP; k++) { const y = RING.y0 + 40 + k / NP * (RING.y1 - RING.y0 - 80) + (rnd() - 0.5) * 12, x = RING.x0 - HW_HALF - 4 - rnd() * 9; const s = 0.8 + rnd() * 0.45; q.setFromAxisAngle(up, rnd() * 6.28); sc.set(s, s, s); pv.set(x, 0, y); M4.compose(pv, q, sc); T.setMatrixAt(k, M4); C.setMatrixAt(k, M4); }
    T.castShadow = C.castShadow = !low; group.add(T, C);
    const cols = [0xe63946, 0x1d6fd8, 0xf1c40f, 0x2a9d8f, 0xffffff];
    for (let k = 0; k < 26; k++) { const y = RING.y0 + 80 + rnd() * (RING.y1 - RING.y0 - 160), x = SHORE_X - 14 - rnd() * 24, h = terrainH(x, y); const u = new THREE.Group();
      u.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6).translate(0, 1.2, 0), steel)); u.add(mesh(new THREE.ConeGeometry(1.4, 0.5, 10, 1, true).translate(0, 2.4, 0), std({ color: cols[k % 5], roughness: 0.7, side: THREE.DoubleSide })));
      const towel = mesh(new THREE.PlaneGeometry(0.9, 1.8).rotateX(-Math.PI / 2).translate(0.9, 0.03, 0.3), std({ color: cols[(k + 2) % 5], roughness: 0.9 })); u.add(towel); u.position.set(x, h, y); u.rotation.y = rnd() * 6; group.add(u); }
    const tower = new THREE.Group(); for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) tower.add(mesh(new THREE.BoxGeometry(0.12, 3, 0.12).translate(dx, 1.5, dz), std({ color: 0xffffff, roughness: 0.8 })));
    tower.add(mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2).translate(0, 3.8, 0), std({ color: 0xd62828, roughness: 0.7 }))); tower.add(mesh(new THREE.ConeGeometry(1.8, 0.8, 4).rotateY(Math.PI / 4).translate(0, 5, 0), std({ color: 0xf1f1f1, roughness: 0.7 })));
    tower.position.set(SHORE_X - 20, terrainH(SHORE_X - 20, SIZE / 2 + 60), SIZE / 2 + 60); group.add(tower); }
  // ---- drift park + car park ----
  { const g = new THREE.PlaneGeometry(PAD.x1 - PAD.x0, PAD.y1 - PAD.y0).rotateX(-Math.PI / 2).translate((PAD.x0 + PAD.x1) / 2, 0.03, (PAD.y0 + PAD.y1) / 2); const m = std({ map: padTex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 }); m.map = padTex.clone(); m.map.repeat.set((PAD.x1 - PAD.x0) / 40, (PAD.y1 - PAD.y0) / 40); m.map.needsUpdate = true;
    group.add(mesh(g, m));
    // paint: two drift circles, a figure-eight link, slalom line, car park stalls, big lettering
    const paint = canvasTex(2048, 2048, (c, w, h) => { const sx = w / (PAD.x1 - PAD.x0), sy = h / (PAD.y1 - PAD.y0), X = x => (x - PAD.x0) * sx, Y = y => (y - PAD.y0) * sy;
      c.lineWidth = 0.35 * sx; c.strokeStyle = 'rgba(245,245,240,.9)'; for (const [cx, cy] of [[1270, 1000], [1340, 1000]]) { c.beginPath(); c.arc(X(cx), Y(cy), 26 * sx, 0, 7); c.stroke(); c.setLineDash([3 * sx, 3 * sx]); c.beginPath(); c.arc(X(cx), Y(cy), 6 * sx, 0, 7); c.stroke(); c.setLineDash([]); }
      c.strokeStyle = 'rgba(240,190,40,.95)'; c.lineWidth = 0.4 * sx; c.beginPath(); c.rect(X(PAD.x0 + 3), Y(PAD.y0 + 3), (PAD.x1 - PAD.x0 - 6) * sx, (PAD.y1 - PAD.y0 - 6) * sy); c.stroke();
      // car park stalls along the north side
      c.strokeStyle = 'rgba(245,245,240,.9)'; c.lineWidth = 0.15 * sx; for (let x = PAD.x0 + 20; x < PAD.x1 - 20; x += 2.8) { c.beginPath(); c.moveTo(X(x), Y(PAD.y0 + 6)); c.lineTo(X(x), Y(PAD.y0 + 11.5)); c.stroke(); c.beginPath(); c.moveTo(X(x), Y(PAD.y0 + 20)); c.lineTo(X(x), Y(PAD.y0 + 25.5)); c.stroke(); }
      c.fillStyle = 'rgba(245,245,240,.85)'; c.font = `900 ${9 * sx}px Inter,Arial`; c.textAlign = 'center'; c.fillText('DRIFT', X(1420), Y(990)); c.font = `900 ${5 * sx}px Inter,Arial`; c.fillText('OTOPARK', X(1250), Y(PAD.y0 + 17.5)); c.fillText('P', X(1440), Y(PAD.y0 + 17.5));
      // slalom start box
      c.fillStyle = 'rgba(245,245,240,.9)'; for (let k = 0; k < 8; k++) c.fillRect(X(1215 + k * 0.8), Y(1080), 0.4 * sx, 6 * sy);
    }, false);
    const pm = mesh(new THREE.PlaneGeometry(PAD.x1 - PAD.x0, PAD.y1 - PAD.y0).rotateX(-Math.PI / 2).translate((PAD.x0 + PAD.x1) / 2, 0.045, (PAD.y0 + PAD.y1) / 2), std({ map: paint, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); group.add(pm);
    // tyre-stack walls around the pad (gap at the entrance), cones on the slalom
    const tyreG = new THREE.TorusGeometry(0.33, 0.14, 6, 12).rotateX(Math.PI / 2), tyres = [];
    const edge = [[PAD.x0, PAD.y0], [PAD.x1, PAD.y0], [PAD.x1, PAD.y1], [PAD.x0, PAD.y1], [PAD.x0, PAD.y0]];
    for (let e = 0; e < 4; e++) { const [ax, ay] = edge[e], [bx, by] = edge[e + 1], L = Math.hypot(bx - ax, by - ay); let open = false;
      for (let d = 0; d < L; d += 0.95) { const x = ax + (bx - ax) * d / L, y = ay + (by - ay) * d / L; if (e === 3 && Math.abs(y - 980) < 10) { open = true; continue; } for (let k = 0; k < 3; k++) tyres.push([x, 0.15 + k * 0.27, y]); } }
    addWall(PAD.x0, PAD.y0, PAD.x1, PAD.y0); addWall(PAD.x1, PAD.y0, PAD.x1, PAD.y1); addWall(PAD.x1, PAD.y1, PAD.x0, PAD.y1); addWall(PAD.x0, PAD.y1, PAD.x0, 990); addWall(PAD.x0, 970, PAD.x0, PAD.y0);
    const TI = new THREE.InstancedMesh(tyreG, std({ color: 0x151515, roughness: 0.9 }), tyres.length); const M4 = new THREE.Matrix4(); tyres.forEach((t, i) => { M4.makeTranslation(t[0], t[1], t[2]); TI.setMatrixAt(i, M4); }); group.add(TI);
    const coneG = mergeGeometries([new THREE.ConeGeometry(0.22, 0.7, 12).translate(0, 0.38, 0), new THREE.BoxGeometry(0.5, 0.04, 0.5).translate(0, 0.02, 0)]);
    const cones = []; for (let k = 0; k < 14; k++) cones.push([1225 + k * 14, 1090]); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; cones.push([1270 + Math.cos(a) * 6, 1000 + Math.sin(a) * 6], [1340 + Math.cos(a) * 6, 1000 + Math.sin(a) * 6]); }
    const CI = new THREE.InstancedMesh(coneG, std({ color: 0xff5a1f, roughness: 0.6 }), cones.length); cones.forEach(([x, y], i) => { M4.makeTranslation(x, 0.03, y); CI.setMatrixAt(i, M4); }); group.add(CI);
    // light masts with glowing heads, a grandstand and the park sign
    const mastM = std({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.7 }), headM = std({ color: 0x222, emissive: 0xfff4e0, emissiveIntensity: 0.2 }); headM.userData.base = 0.2; headM.userData.night = 3; glow.push(headM);
    for (const [x, y] of [[PAD.x0 + 6, PAD.y0 + 30], [PAD.x1 - 6, PAD.y0 + 30], [PAD.x0 + 6, PAD.y1 - 6], [PAD.x1 - 6, PAD.y1 - 6], [(PAD.x0 + PAD.x1) / 2, PAD.y1 - 6]]) { const m = mesh(new THREE.CylinderGeometry(0.18, 0.3, 18, 8).translate(x, 9, y), mastM); group.add(m);
      const h = mesh(new THREE.BoxGeometry(2.6, 0.5, 1.2).translate(x, 18.2, y), headM); group.add(h); }
    const stand = new THREE.Group(); for (let k = 0; k < 5; k++) stand.add(mesh(new THREE.BoxGeometry(34, 0.5, 1.4).translate(0, 0.25 + k * 0.55, k * 1.3), std({ color: k % 2 ? 0x9aa0a6 : 0xb5bbc1, roughness: 0.8 })));
    stand.add(mesh(new THREE.BoxGeometry(34, 0.2, 7).translate(0, 4.6, 2.6), std({ color: 0xd62828, roughness: 0.6 }))); for (const s of [-16.5, 16.5]) stand.add(mesh(new THREE.BoxGeometry(0.2, 4.6, 0.2).translate(s, 2.3, 5.8), mastM));
    stand.position.set(1330, 0, PAD.y1 + 3); group.add(stand);
    const sign = signPanel(['TP DRIFT PARK', 'Otopark · Drift · Slalom'], '#111318', '#ffd32a', 14, 3.2); sign.position.set(PAD.x0 - 2, 6, 1000); sign.rotation.y = -Math.PI / 2; group.add(sign);
    for (const s of [-1, 1]) group.add(mesh(new THREE.BoxGeometry(0.3, 6, 0.3).translate(PAD.x0 - 2.2, 3, 1000 + s * 6.4), mastM)); }
  // ---- motorway furniture: lamp posts on the median, overhead gantry signs ----
  { const N = Math.floor(ringF.length / 12), poleG = mergeGeometries([new THREE.CylinderGeometry(0.11, 0.16, 11, 8).translate(0, 5.5, 0), new THREE.BoxGeometry(0.12, 0.12, 4.4).translate(0, 10.9, 0)]);
    const headG = mergeGeometries([new THREE.BoxGeometry(0.7, 0.16, 0.36).translate(0, 10.85, 2.3), new THREE.BoxGeometry(0.7, 0.16, 0.36).translate(0, 10.85, -2.3)]);
    const poles = new THREE.InstancedMesh(poleG, std({ color: 0x8d949b, roughness: 0.45, metalness: 0.7 }), N); const lm = std({ color: 0x333, emissive: 0xffd9a0, emissiveIntensity: 0.15 }); lm.userData.base = 0.15; lm.userData.night = 3.2; glow.push(lm);
    const heads = new THREE.InstancedMesh(headG, lm, N); const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3(); let n = 0;
    for (let i = 0; i < ringF.length && n < N; i += 12) { const f = ringF[i]; if (atJoin(HW_HALF + 14)(f)) continue; q.setFromAxisAngle(up, -Math.atan2(f.ty, f.tx)); pv.set(f.x, 0.8, f.y); M4.compose(pv, q, one); poles.setMatrixAt(n, M4); heads.setMatrixAt(n, M4); n++; }
    poles.count = heads.count = n; group.add(poles, heads);
    // gantries
    const gantry = (s, dir, lines) => { const f = ringF[Math.round(s / 4) % ringF.length]; const gr = new THREE.Group(); const gm = std({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.6 });
      for (const o of [-1, 1]) gr.add(mesh(new THREE.BoxGeometry(0.35, 7.6, 0.35).translate(0, 3.8, o * (HW_HALF + 1)), gm)); gr.add(mesh(new THREE.BoxGeometry(0.5, 0.8, HW_HALF * 2 + 2.4).translate(0, 7.2, 0), gm));
      lines.forEach((L, k) => { const p = signPanel(L, '#0b6b3a', '#ffffff', 9.5, 2.6); p.position.set(dir * -0.3, 5.6, (k ? -1 : 1) * (HW.median + 0.6 + HW.lane * 1.5)); p.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; gr.add(p); });
      gr.position.set(f.x, 0, f.y); gr.rotation.y = -Math.atan2(f.ty, f.tx); group.add(gr); };
    const sAt = (x, y) => { let b = 0, bd = 1e9; ringF.forEach((f, i) => { const d = (f.x - x) ** 2 + (f.y - y) ** 2; if (d < bd) { bd = d; b = i; } }); return ringF[b].s; };
    gantry(sAt(RING.x1, 110), 1, [['← DAĞ YOLU', 'Kartal Tepe · 200 m'], ['ŞEHİR MERKEZİ →', 'Doğu Çıkışı 400 m']]);
    gantry(sAt(RING.x1, 780), 1, [['← DRIFT PARK', 'Otopark · 200 m'], ['GÜNEY OTOYOLU ↓', 'Sahil Yolu 3 km']]);
    gantry(sAt(720, RING.y1), 1, [['SAHİL YOLU ↑', 'Altın Kum Plajı 2 km'], ['ŞEHİR MERKEZİ →', 'Güney Çıkışı 200 m']]);
    gantry(sAt(RING.x0, 720), 1, [['KUZEY OTOYOLU ↑', 'Dağ Yolu 4 km'], ['ŞEHİR MERKEZİ →', 'Sahil Çıkışı 200 m']]); }
  if (posts.length) { const PI = new THREE.InstancedMesh(postGeo, steel, posts.length); const M4 = new THREE.Matrix4(); posts.forEach((p, i) => { M4.makeTranslation(p[0], p[1], p[2]); PI.setMatrixAt(i, M4); }); group.add(PI); }
  function setNight(f) { for (const m of glow) m.emissiveIntensity = m.userData.base + (m.userData.night - m.userData.base) * f; }
  return { group, setNight };
}
function mesh(g, m, cast = false, recv = true) { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
function signPanel(lines, bg, fg, w, h) { const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((t, k) => { g.font = `${k ? 700 : 900} ${k ? c.height * 0.2 : c.height * 0.32}px Inter,Arial`; g.fillText(t, c.width / 2, c.height * (lines.length === 1 ? 0.5 : k ? 0.72 : 0.36)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.12 });
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.6 })); back.rotation.y = Math.PI; back.position.z = -0.03; o.add(back); return o; }

// ---------------- world map (whole area, 0.5 px per metre) ----------------
export function worldMapCanvas(cityMap) {
  const k = 0.5, S = Math.round((WORLD_MAX - WORLD_MIN) * k), c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.setTransform(k, 0, 0, k, -WORLD_MIN * k, -WORLD_MIN * k);
  g.fillStyle = '#3d5a30'; g.fillRect(WORLD_MIN, WORLD_MIN, WORLD_MAX - WORLD_MIN, WORLD_MAX - WORLD_MIN);
  g.fillStyle = '#2a6f8f'; g.fillRect(WORLD_MIN, WORLD_MIN, SEA_X - WORLD_MIN, WORLD_MAX - WORLD_MIN); g.fillStyle = '#d8c79c'; g.fillRect(SEA_X, WORLD_MIN, SHORE_X - SEA_X + 10, WORLD_MAX - WORLD_MIN);
  // mountain shading
  for (let x = 1180; x < WORLD_MAX; x += 16) for (let y = WORLD_MIN; y < 900; y += 16) { const h = natural(x, y); if (h < 3) continue; const v = Math.min(1, h / 190); g.fillStyle = `rgb(${Math.round(61 + v * 70)},${Math.round(90 + v * 40)},${Math.round(48 + v * 60)})`; g.fillRect(x, y, 16, 16); }
  const road = (F, w, col, closed) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); F.forEach((f, i) => i ? g.lineTo(f.x, f.y) : g.moveTo(f.x, f.y)); if (closed) g.closePath(); g.stroke(); };
  road(ringF, HW_HALF * 2 + 8, '#2a2c30', true); road(ringF, HW_HALF * 2, '#e0a43a', true); road(ringF, 2, '#7a5418', true);
  for (const L of links) { g.strokeStyle = '#5a5e66'; g.lineWidth = 16; g.beginPath(); g.moveTo(...L.a); g.lineTo(...L.b); g.stroke(); }
  g.strokeStyle = '#5a5e66'; g.lineWidth = 14; g.beginPath(); g.moveTo(...padLink.a); g.lineTo(...padLink.b); g.stroke();
  road(mtnF, 16, '#2a2c30'); road(mtnF, 10, '#f2f2f2');
  g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(SUMMIT.x, SUMMIT.y, SUMMIT.r, 0, 7); g.fill();
  g.fillStyle = '#5c6068'; g.fillRect(PAD.x0, PAD.y0, PAD.x1 - PAD.x0, PAD.y1 - PAD.y0); g.strokeStyle = '#ffd32a'; g.lineWidth = 3; for (const [cx, cy] of [[1270, 1000], [1340, 1000]]) { g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.stroke(); }
  // the city map on top
  g.drawImage(cityMap.canvas, -cityMap.offset, -cityMap.offset);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas: c, offset: -WORLD_MIN, k };
}
export const REGION_POIS = [
  { kind: 'drift', name: 'TP Drift Park & Otopark', x: 1330, y: 960 },
  { kind: 'summit', name: 'Kartal Tepe · Zirve', x: SUMMIT.x, y: SUMMIT.y },
  { kind: 'mountain', name: 'Dağ Yolu Girişi', x: RING.x1 + 40, y: 300 },
  { kind: 'beach', name: 'Altın Kum Plajı · Sahil Yolu', x: RING.x0, y: SIZE / 2 + 120 },
  { kind: 'highway', name: 'O-1 Otoyol · Kuzey', x: SIZE / 2 + 150, y: RING.y0 },
];
export const REGION_RING = RING;

// respawn helper: nearest drivable spot on the motorway / mountain road, facing along the road
export function nearestRoadSpot(x, y) { let best = null, bd = 1e18;
  for (const F of [ringF, mtnF]) for (let i = 0; i < F.length; i += 2) { const f = F[i], d = (f.x - x) ** 2 + (f.y - y) ** 2; if (d < bd) { bd = d; best = { f, F }; } }
  const f = best.f; let off = 0; if (best.F === ringF) { const side = Math.sign((x - f.x) * f.nx + (y - f.y) * f.ny) || 1; off = side * (HW.median + 0.6 + HW.lane * 1.5); }
  const a = Math.atan2(f.ty, f.tx) + (off < 0 ? Math.PI : 0); return { x: f.x + f.nx * off, y: f.y + f.ny * off, a }; }
export const _dbg = { ringF, mtnF, SUMMIT, PAD, links, padLink };
