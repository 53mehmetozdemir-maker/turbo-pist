// Low-poly but properly proportioned road cars for traffic and parking.
// Built from a side profile (beltline, sill, roof) + plan width, with rounded-rectangle
// cross-sections. Paint/trim is baked as vertex colour (instance colour tints the paint only).
// Local axes: +X forward, +Y up, +Z right. Ground at y=0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ss = t => t * t * (3 - 2 * t);
function prof(pts) { return x => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return lerp(pts[i - 1][1], pts[i][1], ss(t)); } return pts[pts.length - 1][1]; }; }

export const SPECS = {
  sedan: { L: 4.62, a: 1.36, b: 1.34, R: 0.315, sill: 0.2,
    w: prof([[-2.31, 0.66], [-2.24, 0.82], [-2.0, 0.885], [-1.4, 0.9], [1.5, 0.9], [2.0, 0.86], [2.22, 0.78], [2.31, 0.6]]),
    belt: prof([[-2.31, 0.66], [-2.27, 0.9], [-2.05, 0.99], [-1.5, 1.0], [-0.8, 0.99], [0.9, 0.95], [1.5, 0.89], [2.05, 0.8], [2.24, 0.74], [2.31, 0.5]]),
    bumpF: 0.26, bumpR: 0.28, xa: 0.92, xb1: 0.22, xb2: -0.88, xc: -1.52, roof: 1.45, gIn: 0.15 },
  hatch: { L: 4.06, a: 1.24, b: 1.26, R: 0.30, sill: 0.19,
    w: prof([[-2.03, 0.7], [-1.97, 0.84], [-1.75, 0.87], [1.35, 0.87], [1.8, 0.83], [1.96, 0.76], [2.03, 0.6]]),
    belt: prof([[-2.03, 0.7], [-2.0, 0.96], [-1.8, 1.0], [0.75, 0.95], [1.3, 0.88], [1.8, 0.8], [1.97, 0.74], [2.03, 0.52]]),
    bumpF: 0.25, bumpR: 0.27, xa: 0.78, xb1: 0.12, xb2: -1.55, xc: -1.93, roof: 1.47, gIn: 0.14 },
  suv: { L: 4.62, a: 1.4, b: 1.36, R: 0.37, sill: 0.3,
    w: prof([[-2.31, 0.76], [-2.25, 0.88], [-2.05, 0.93], [1.6, 0.93], [2.05, 0.9], [2.24, 0.82], [2.31, 0.66]]),
    belt: prof([[-2.31, 0.8], [-2.28, 1.06], [-2.1, 1.12], [0.95, 1.08], [1.55, 1.02], [2.1, 0.96], [2.26, 0.9], [2.31, 0.66]]),
    bumpF: 0.36, bumpR: 0.38, xa: 1.02, xb1: 0.42, xb2: -1.98, xc: -2.2, roof: 1.73, gIn: 0.13 },
  van: { L: 4.9, a: 1.62, b: 1.42, R: 0.33, sill: 0.26,
    w: prof([[-2.45, 0.86], [-2.4, 0.95], [1.9, 0.95], [2.25, 0.9], [2.4, 0.8], [2.45, 0.66]]),
    belt: prof([[-2.45, 0.9], [-2.42, 1.08], [-2.3, 1.1], [1.25, 1.08], [1.75, 1.0], [2.25, 0.92], [2.4, 0.84], [2.45, 0.6]]),
    bumpF: 0.32, bumpR: 0.34, xa: 1.3, xb1: 0.62, xb2: -2.36, xc: -2.42, roof: 1.98, gIn: 0.08 },
};

// greenhouse roof height along x
function roofH(S, x) {
  const b = S.belt(x) - 0.012;
  if (x >= S.xa || x <= S.xc) return b;
  if (x > S.xb1) { const t = (S.xa - x) / (S.xa - S.xb1); return lerp(b, S.roof, 1 - Math.pow(1 - t, 1.5)); }
  if (x < S.xb2) { const t = (x - S.xc) / (S.xb2 - S.xc); return lerp(b, S.roof, 1 - Math.pow(1 - t, 1.8)); }
  const m = (S.xb1 + S.xb2) / 2, h = (S.xb1 - S.xb2) / 2, u = (x - m) / h; return S.roof - 0.03 * u * u;
}
function sill(S, x) {
  let y = S.sill;
  if (x > S.a + S.R + 0.25) y = lerp(S.sill, S.bumpF, ss(Math.min(1, (x - S.a - S.R - 0.25) / (S.L / 2 - S.a - S.R - 0.25))));
  if (x < -S.b - S.R - 0.25) y = lerp(S.sill, S.bumpR, ss(Math.min(1, (-S.b - S.R - 0.25 - x) / (S.L / 2 - S.b - S.R - 0.25))));
  const AR = S.R + 0.07;
  for (const xw of [S.a, -S.b]) { const d = x - xw; if (Math.abs(d) < AR) y = Math.max(y, S.R + Math.sqrt(AR * AR - d * d) * 0.96); }
  return y;
}
// station positions, denser at the ends and around wheel arches
function stations(S, n) {
  const xs = []; for (let i = 0; i <= n; i++) { const t = i / n; const u = 0.5 - 0.5 * Math.cos(Math.PI * t); xs.push(lerp(-S.L / 2, S.L / 2, lerp(t, u, 0.45))); }
  return xs;
}

const PAINT = [1, 1, 1], TRIM = [0.045, 0.047, 0.05], CHROME = [0.55, 0.56, 0.58], BLACKOUT = [0.02, 0.02, 0.025];

// grid of rings -> indexed geometry with smooth normals, then per-face classification
function gridGeo(rings, closed) {
  const nS = rings.length, nR = rings[0].length; const pos = [];
  for (const r of rings) for (const p of r) pos.push(p[0], p[1], p[2]);
  const idx = []; const faces = [];
  const cols = closed ? nR : nR - 1;
  for (let s = 0; s < nS - 1; s++) for (let k = 0; k < cols; k++) { const k1 = (k + 1) % nR;
    const a = s * nR + k, b = s * nR + k1, c = (s + 1) * nR + k, d = (s + 1) * nR + k1; idx.push(a, c, b, b, c, d); faces.push([s, k], [s, k]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return { g: g.toNonIndexed(), faces };
}
function split(geo, faces, classify) {   // classify(s,k,cx,cy,cz) -> colour array or 'glass' or null(drop)
  const p = geo.attributes.position.array, n = geo.attributes.normal.array; const out = { body: { p: [], n: [], c: [] }, glass: { p: [], n: [] } };
  for (let f = 0; f < faces.length; f++) { const o = f * 9; const cx = (p[o] + p[o + 3] + p[o + 6]) / 3, cy = (p[o + 1] + p[o + 4] + p[o + 7]) / 3, cz = (p[o + 2] + p[o + 5] + p[o + 8]) / 3;
    const cl = classify(faces[f][0], faces[f][1], cx, cy, cz); if (cl == null) continue;
    const dst = cl === 'glass' ? out.glass : out.body;
    for (let j = 0; j < 9; j++) { dst.p.push(p[o + j]); dst.n.push(n[o + j]); }
    if (cl !== 'glass') for (let v = 0; v < 3; v++) dst.c.push(...cl); }
  const mk = (d, col) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(d.n, 3)); if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(d.c, 3)); return g; };
  return { body: mk(out.body, true), glass: mk(out.glass, false) };
}
function colored(g, col) { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(col, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }

export function buildFleetCar(kind, det = 1) {
  const S = SPECS[kind];
  const xs = stations(S, Math.round(46 * det));
  // ---- lower body: rounded-rectangle sections ----
  const sideN = Math.max(3, Math.round(4 * det));
  const ring = x => { const w = S.w(x), y0 = sill(S, x), y1 = Math.max(y0 + 0.08, S.belt(x)); const h = y1 - y0;
    const rb = Math.min(0.11, h * 0.3), rt = Math.min(0.09, h * 0.25), tum = 0.035;
    const R = []; // right half from bottom centre to top centre
    R.push([0, y0]); R.push([w * 0.55, y0]);
    for (let i = 0; i <= sideN; i++) { const a = -Math.PI / 2 + i / sideN * Math.PI / 2; R.push([w - rb + Math.cos(a) * rb, y0 + rb + Math.sin(a) * rb]); }
    const ys = lerp(y0 + rb, y1 - rt, 0.62); R.push([w + 0.006, ys]);
    for (let i = 0; i <= sideN; i++) { const a = i / sideN * Math.PI / 2; R.push([w - tum - rt + Math.cos(a) * rt, y1 - rt + Math.sin(a) * rt]); }
    R.push([w * 0.5, y1 + 0.004]); R.push([0, y1 + 0.006]);
    const full = []; for (const [z, y] of R) full.push([x, y, z]); for (let i = R.length - 2; i >= 1; i--) full.push([x, R[i][1], -R[i][0]]);
    return full; };
  const rings = xs.map(ring);
  // close the ends by collapsing the first/last ring towards its centre
  const cap = (r, dx, sq, zs) => { const lo = Math.min(...r.map(q => q[1])), hi = Math.max(...r.map(q => q[1])), mid = lo + (hi - lo) * 0.45; return r.map(p => [p[0] + dx, lerp(p[1], mid, sq), p[2] * zs]); };
  const r0 = rings[0], r1 = rings[rings.length - 1];
  rings.unshift(cap(r0, -0.03, 0.12, 0.88)); rings.unshift(cap(r0, -0.05, 0.55, 0.5));
  rings.push(cap(r1, 0.03, 0.12, 0.88)); rings.push(cap(r1, 0.05, 0.55, 0.5));
  const lower = gridGeo(rings, true);
  const nR = rings[0].length;
  const m = (nR + 2) / 2 - 1, hi = i => (i <= m ? i : nR - i), lowMax = 2 + sideN;   // ring index from the bottom centre
  const lowerParts = split(lower.g, lower.faces, (s, k, x, y, z) => (Math.max(hi(k), hi((k + 1) % nR)) <= lowMax ? TRIM : PAINT));
  // ---- greenhouse: belt -> roof edge -> roof ----
  const gx = xs.filter(x => x <= S.xa + 0.001 && x >= S.xc - 0.001); if (gx[0] > S.xc) gx.unshift(S.xc); if (gx[gx.length - 1] < S.xa) gx.push(S.xa);
  const gRing = x => { const b = S.belt(x) - 0.012, h = roofH(S, x), wb = S.w(x) - 0.05, wt = wb - S.gIn; const t = h - b;
    const R = [[wb, b], [lerp(wb, wt, 0.92), b + t * 0.86], [wt - 0.03, b + t * 0.97], [wt - 0.1, h], [0, h + 0.012]];
    const full = []; for (const [z, y] of R) full.push([x, y, z]); for (let i = R.length - 2; i >= 0; i--) full.push([x, R[i][1], -R[i][0]]); return full; };
  const gr = gridGeo(gx.map(gRing), false);
  const xB = lerp(S.xb1, S.xb2, kind === 'hatch' ? 0.42 : 0.47);
  const grParts = split(gr.g, gr.faces, (s, k, x, y, z) => {
    const b = S.belt(x), h = roofH(S, x); const isSide = k === 0 || k === 7, isEdge = k === 1 || k === 6, isTop = !isSide && !isEdge;
    if (isTop) { if (x > S.xb1 - 0.04 || x < S.xb2 + 0.04) return 'glass'; return PAINT; }
    if (isEdge) return (x > S.xb1 + 0.02 || x < S.xb2 - 0.04) ? TRIM : PAINT;     // A/C pillar edges dark, drip rail painted
    // side windows: behind the A-pillar line, ahead of the C-pillar line, B-pillar blacked out
    const rel = (y - b) / Math.max(0.05, S.roof - b);
    const aLine = S.xa - rel * (S.xa - S.xb1) - 0.07, cLine = S.xc + rel * (S.xb2 - S.xc) + (kind === 'van' ? 0.04 : 0.16);
    if (x > aLine || x < cLine) return TRIM;
    if (Math.abs(x - xB) < 0.055) return BLACKOUT;
    if (kind === 'van' && x < S.xb1 - 1.1) return PAINT;                          // panel van: no rear side glass
    return 'glass'; });
  // ---- details ----
  const dt = [];
  const fx = S.L / 2, rx = -S.L / 2;
  // grille + lower intake
  const gy = lerp(S.bumpF, S.belt(fx - 0.12), 0.55);
  dt.push(colored(new THREE.BoxGeometry(0.06, 0.13, S.w(fx - 0.1) * 0.95).translate(fx - 0.07, gy, 0), TRIM));
  dt.push(colored(new THREE.BoxGeometry(0.06, 0.07, S.w(fx - 0.1) * 1.1).translate(fx - 0.08, S.bumpF + 0.09, 0), TRIM));
  // mirrors (painted shell, dark arm)
  for (const s of [-1, 1]) { const mx = S.xa - 0.12, my = S.belt(mx) + 0.065, mz = s * (S.w(mx) + 0.05);
    const shell = new THREE.SphereGeometry(0.11, 8, 6); shell.scale(0.55, 0.6, 1); shell.translate(mx, my, mz); dt.push(colored(shell, PAINT));
    dt.push(colored(new THREE.BoxGeometry(0.08, 0.035, 0.1).translate(mx + 0.02, my - 0.06, s * (S.w(mx) - 0.01)), TRIM));
    // door seams + handles
    const doors = kind === 'van' ? [S.xa - 0.05, xB + 0.02, xB - 0.9] : kind === 'hatch' ? [S.xa - 0.04, xB - 0.05] : [S.xa - 0.04, xB, S.xc + 0.28];
    for (const x of doors) { const y0 = sill(S, x) + 0.08, y1 = S.belt(x) - 0.01; dt.push(colored(new THREE.BoxGeometry(0.012, y1 - y0, 0.012).translate(x, (y0 + y1) / 2, s * (S.w(x) + 0.004)), TRIM)); }
    for (const x of [xB + 0.12, kind === 'hatch' ? null : xB - 0.62].filter(v => v != null)) dt.push(colored(new THREE.BoxGeometry(0.15, 0.028, 0.02).translate(x, S.belt(x) - 0.11, s * (S.w(x) + 0.006)), CHROME));
    // side window chrome strip along the belt
    dt.push(colored(new THREE.BoxGeometry(S.xa - S.xc - 0.35, 0.018, 0.015).translate((S.xa + S.xc) / 2 - 0.05, S.belt((S.xa + S.xc) / 2) + 0.004, s * (S.w(0) - 0.045)), CHROME));
  }
  const body = mergeGeometries([lowerParts.body, grParts.body, ...dt]);
  const glass = mergeGeometries([grParts.glass]);
  // ---- lamps ----
  const hl = [], tl = [];
  for (const s of [-1, 1]) {
    const z = s * (S.w(fx - 0.15) - 0.26), x = fx - 0.11, y = S.belt(x) - 0.075;
    const h = new THREE.BoxGeometry(0.16, 0.075, 0.38); h.rotateY(s * 0.32); h.translate(x, y, z); hl.push(h);
    const x2 = rx + 0.075, y2 = S.belt(x2 + 0.05) - 0.1, z2 = s * (S.w(x2) - 0.3);
    tl.push(new THREE.BoxGeometry(0.1, 0.1, 0.36).translate(x2, y2, z2));
    const x3 = rx + 0.2; tl.push(new THREE.BoxGeometry(0.2, 0.09, 0.02).translate(x3, y2, s * (S.w(x3) - 0.012)));
  }
  tl.push(new THREE.BoxGeometry(0.04, 0.025, 0.42).translate(S.xc - 0.04, roofH(S, S.xc + 0.06) + 0.02, 0));   // third brake light
  const plates = [new THREE.PlaneGeometry(0.52, 0.112).rotateY(Math.PI / 2).translate(fx + 0.052, S.bumpF + 0.17, 0),
    new THREE.PlaneGeometry(0.52, 0.112).rotateY(-Math.PI / 2).translate(rx - 0.052, lerp(S.bumpR, S.belt(rx + 0.1), 0.45), 0)];
  return { S, body, glass, head: mergeGeometries(hl), tail: mergeGeometries(tl), plate: mergeGeometries(plates) };
}

export function tireGeo(R, wd, seg) {
  const pts = [], r0 = R * 0.66, sh = 0.04; pts.push(new THREE.Vector2(r0, -wd / 2));
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI; pts.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, (wd / 2) * Math.sin(a) * 0.98)); }
  pts.push(new THREE.Vector2(r0, wd / 2)); const g = new THREE.LatheGeometry(pts, seg); g.rotateX(Math.PI / 2); return g;
}
export function rimGeo(R, seg) {   // alloy face pointing +Z
  const ni = p => { const n = p.index ? p.toNonIndexed() : p; if (n.attributes.uv) n.deleteAttribute('uv'); return n; };
  const parts = [new THREE.CylinderGeometry(R * 0.64, R * 0.64, 0.03, seg).rotateX(Math.PI / 2)];
  parts.push(new THREE.CylinderGeometry(R * 0.15, R * 0.17, 0.05, 10).rotateX(Math.PI / 2).translate(0, 0, 0.03));
  for (let k = 0; k < 5; k++) { const s = new THREE.BoxGeometry(R * 0.14, R * 0.47, 0.03); s.translate(0, R * 0.37, 0.025); s.rotateZ(k * Math.PI * 2 / 5); parts.push(s); }
  parts.push(new THREE.TorusGeometry(R * 0.635, 0.014, 5, seg).translate(0, 0, 0.02));
  return mergeGeometries(parts.map(ni));
}
