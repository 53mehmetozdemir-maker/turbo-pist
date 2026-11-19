// Procedural city: street grid, sidewalks, buildings, props, traffic lights, collisions.
import * as THREE from 'three';

export const NB = 10;            // blocks per side
export const P = 100;            // road-to-road pitch (m)
export const ROAD = 16;          // road width: 2 lanes each way
export const SW = 4.5;           // sidewalk width
export const CURB = 0.15;        // curb height
export const LANES = [1.75, 5.25];
const BL = P - ROAD;             // block size (84)
export const SIZE = NB * P;
export const BOUND = { min: -60, max: SIZE + 60 };
export const H_NAMES = ['Sahil Yolu','Cumhuriyet Cd.','İstiklal Cd.','Atatürk Bulvarı','Bağdat Cd.','Barbaros Bulvarı','Halaskargazi Cd.','Fevzi Çakmak Cd.','İnönü Cd.','Menderes Cd.','Gazi Bulvarı'];
export const V_NAMES = ['Lale Sk.','Papatya Sk.','Çınar Cd.','Gül Sk.','Valikonağı Cd.','Akasya Cd.','Rıhtım Cd.','Söğüt Sk.','Nergis Sk.','Leylak Sk.','Ihlamur Sk.'];

let seed = 1337; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pick = a => a[Math.floor(rnd() * a.length)];

// ---------- block layout ----------
export const blocks = [];
for (let bj = 0; bj < NB; bj++) for (let bi = 0; bi < NB; bi++) {
  const r = Math.hypot(bi + 0.5 - NB / 2, bj + 0.5 - NB / 2);
  const district = r < 2.0 ? 'downtown' : r < 3.7 ? 'mid' : 'outer';
  blocks.push({ bi, bj, x0: bi * P + ROAD / 2, y0: bj * P + ROAD / 2, district, type: 'buildings', boxes: [], circles: [] });
}
const B = (i, j) => blocks[j * NB + i];
for (const [i, j] of [[6, 3], [1, 7], [8, 8], [2, 2], [8, 1]]) B(i, j).type = 'park';
for (const [i, j] of [[3, 6], [7, 6], [0, 4], [5, 8], [9, 4]]) B(i, j).type = 'lot';

// ---------- queries ----------
function onRoadAxis(v) { const k = Math.round(v / P); return k >= 0 && k <= NB && Math.abs(v - k * P) < ROAD / 2; }
const inCity = (x, y) => x > -ROAD / 2 && y > -ROAD / 2 && x < SIZE + ROAD / 2 && y < SIZE + ROAD / 2;
export function blockAt(x, y) { const bi = Math.floor(x / P), bj = Math.floor(y / P); if (bi < 0 || bj < 0 || bi >= NB || bj >= NB) return null;
  const b = B(bi, bj); const lx = x - b.x0, ly = y - b.y0; if (lx < 0 || ly < 0 || lx > BL || ly > BL) return null; return b; }
// 0 asphalt, 3 sidewalk/plaza, 4 grass
export function surfaceAt(x, y) {
  if (!inCity(x, y)) return 4;
  if (onRoadAxis(x) || onRoadAxis(y)) return 0;
  const b = blockAt(x, y); if (!b) return 0;
  const lx = x - b.x0, ly = y - b.y0;
  if (lx < SW || ly < SW || lx > BL - SW || ly > BL - SW) return 3;
  if (b.type === 'park') return 4; if (b.type === 'lot') return 0; return 3;
}
export function streetName(x, y) {
  const kx = Math.round(x / P), ky = Math.round(y / P);
  const onV = Math.abs(x - kx * P) < ROAD / 2 + SW && kx >= 0 && kx <= NB, onH = Math.abs(y - ky * P) < ROAD / 2 + SW && ky >= 0 && ky <= NB;
  if (onV && onH) return V_NAMES[kx] + ' / ' + H_NAMES[ky];
  if (onH) return H_NAMES[ky]; if (onV) return V_NAMES[kx];
  const b = blockAt(x, y); if (b) return b.type === 'park' ? 'Park' : b.type === 'lot' ? 'Otopark' : (b.district === 'downtown' ? 'Şehir Merkezi' : b.district === 'mid' ? 'Çarşı' : 'Mahalle');
  return 'Şehir dışı';
}
export function district(x, y) { const r = Math.hypot(x / P - NB / 2, y / P - NB / 2); return r < 2 ? 'Şehir Merkezi' : r < 3.7 ? 'Çarşı' : 'Mahalle'; }
// nearest lane point for respawn: returns {x,y,a}
export function nearestLane(x, y) {
  const kx = Math.max(0, Math.min(NB, Math.round(x / P))), ky = Math.max(0, Math.min(NB, Math.round(y / P)));
  const dx = Math.abs(x - kx * P), dy = Math.abs(y - ky * P);
  if (dx < dy) { const yy = Math.max(ROAD, Math.min(SIZE - ROAD, y)); return { x: kx * P - LANES[1], y: yy, a: Math.PI / 2 }; }
  const xx = Math.max(ROAD, Math.min(SIZE - ROAD, x)); return { x: xx, y: ky * P + LANES[1], a: 0 };
}
// traffic-light phase from the shared clock: returns 'ns'/'ew' state 0 green 1 yellow 2 red
export function lightState(axis, t = Date.now() / 1000) {
  const c = ((t % 26) + 26) % 26;
  const ew = c < 10 ? 0 : c < 12.5 ? 1 : 2, ns = c < 13 ? 2 : c < 23 ? 0 : c < 25.5 ? 1 : 2;
  return axis === 'ew' ? ew : ns;
}

// ---------- collisions ----------
function addBox(b, x0, y0, x1, y1) { b.boxes.push([x0, y0, x1, y1]); }
export const cityWorld = {
  surface(x, y, car) { return surfaceAt(x, y); },
  collide(car) {
    for (const c of car.corners()) {
      if (c.x < BOUND.min) car.contact(c, -1, 0, BOUND.min - c.x); else if (c.x > BOUND.max) car.contact(c, 1, 0, c.x - BOUND.max);
      if (c.y < BOUND.min) car.contact(c, 0, -1, BOUND.min - c.y); else if (c.y > BOUND.max) car.contact(c, 0, 1, c.y - BOUND.max);
      const bi = Math.floor(c.x / P), bj = Math.floor(c.y / P);
      for (let di = -1; di <= 0; di++) for (let dj = -1; dj <= 0; dj++) {   // props near block edges live in neighbours
        const ii = bi + (di ? (c.x - bi * P < ROAD ? -1 : 0) : 0), jj = bj + (dj ? (c.y - bj * P < ROAD ? -1 : 0) : 0);
        if ((di && ii === bi) || (dj && jj === bj)) continue;
        if (ii < 0 || jj < 0 || ii >= NB || jj >= NB) continue;
        const b = B(ii, jj);
        for (const [x0, y0, x1, y1] of b.boxes) {
          if (c.x <= x0 || c.x >= x1 || c.y <= y0 || c.y >= y1) continue;
          const l = c.x - x0, r = x1 - c.x, t = c.y - y0, bt = y1 - c.y, m = Math.min(l, r, t, bt);
          if (m === l) car.contact(c, 1, 0, l); else if (m === r) car.contact(c, -1, 0, r); else if (m === t) car.contact(c, 0, 1, t); else car.contact(c, 0, -1, bt);
        }
        for (const [cx, cy, cr] of b.circles) { const dx = cx - c.x, dy = cy - c.y, d = Math.hypot(dx, dy); if (d < cr && d > 1e-4) car.contact(c, dx / d, dy / d, cr - d); }
      }
    }
  }
};

// ---------- textures ----------
function tex(w, h, draw, opts = {}) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (!opts.linear) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
function noise(g, w, h, base, amp, n, sz = 2) { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const v = (Math.random() - 0.5) * amp; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; const s = sz * (0.5 + Math.random()); g.fillRect(Math.random() * w, Math.random() * h, s, s); } }
// facade: 4 floors x 4 bays per tile (12 m x 12.8 m)
function facade(style) {
  const W = 512, H = 512, fx = W / 4, fy = H / 4;
  const lit = [];
  const draw = (g, emissive) => {
    if (emissive) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    else if (style === 'glass') { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#5f8fa8'); gr.addColorStop(0.5, '#2c4f66'); gr.addColorStop(1, '#4b7690'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    else if (style === 'brick') { g.fillStyle = '#8a4433'; g.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 ? 0 : 10; x < W; x += 20) { g.fillStyle = `rgba(${90 + Math.random() * 60},${40 + Math.random() * 25},${30 + Math.random() * 20},.55)`; g.fillRect(x, y, 18, 6); } }
    else noise(g, W, H, style === 'office' ? '#b9bcc0' : style === 'beige' ? '#d8c6a3' : style === 'white' ? '#e8e8e4' : '#a9a49c', 0.12, 6000, 3);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = c * fx, y = r * fy; const on = lit[r * 4 + c] ??= Math.random() < 0.38;
      let wx, wy, ww, wh;
      if (style === 'glass') { wx = x + 3; wy = y + 3; ww = fx - 6; wh = fy - 6; }
      else if (style === 'office') { wx = x; wy = y + fy * 0.3; ww = fx; wh = fy * 0.5; }
      else if (style === 'white') { wx = x + fx * 0.08; wy = y + fy * 0.18; ww = fx * 0.84; wh = fy * 0.66; }
      else { wx = x + fx * 0.22; wy = y + fy * 0.2; ww = fx * 0.56; wh = fy * 0.6; }
      if (emissive) { if (on) { g.fillStyle = `hsl(${38 + Math.random() * 14},${60 + Math.random() * 30}%,${55 + Math.random() * 20}%)`; g.fillRect(wx + 2, wy + 2, ww - 4, wh - 4); } continue; }
      if (style === 'glass') { g.fillStyle = 'rgba(20,40,55,.35)'; g.fillRect(x, y, fx, 3); g.fillRect(x, y, 3, fy); g.fillStyle = `rgba(200,230,255,${0.05 + Math.random() * 0.15})`; g.fillRect(wx, wy, ww, wh); continue; }
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);        // frame shadow
      const gl = g.createLinearGradient(wx, wy, wx + ww, wy + wh); gl.addColorStop(0, '#2b3b4a'); gl.addColorStop(0.6, '#152230'); gl.addColorStop(1, '#3a5266'); g.fillStyle = gl; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = style === 'brick' ? '#efe8dc' : 'rgba(240,240,240,.9)';
      if (style !== 'office') { g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx - 4, wy + wh, ww + 8, 5); }
      if (style === 'beige' && r % 2 === 0) { g.fillStyle = 'rgba(60,50,40,.7)'; g.fillRect(wx - 8, wy + wh * 0.62, ww + 16, 3); for (let k = 0; k < 8; k++) g.fillRect(wx - 8 + k * (ww + 16) / 7, wy + wh * 0.62, 2, wh * 0.38); }
      if (Math.random() < 0.25 && style !== 'office') { g.fillStyle = `rgba(${200 + Math.random() * 50},${180 + Math.random() * 60},${150 + Math.random() * 60},.55)`; g.fillRect(wx + 2, wy + 2, ww / 2 - 4, wh - 4); } // curtain
    }
    if (style === 'office' && !emissive) { g.fillStyle = 'rgba(0,0,0,.15)'; for (let r = 0; r < 4; r++) g.fillRect(0, r * fy + fy * 0.8, W, 4); }
  };
  const map = tex(W, H, g => draw(g, false)), em = tex(W, H, g => draw(g, true));
  return { map, em };
}
const SHOP_NAMES = [['MARKET','CAFE'],['ECZANE','FIRIN'],['KUAFÖR','BANKA'],['LOKANTA','OPTİK'],['KİTAP','BUTİK'],['DÖNER','TEKNOLOJİ'],['PASTANE','ÇİÇEKÇİ'],['KASAP','SPOR']];
function shopTex(variant = 0) {
  const W = 512, H = 180; const colors = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98', '#17202a', '#d35400', '#117a65'];
  const lit = []; const signs = [];
  const draw = (g, em) => {
    g.fillStyle = em ? '#000' : '#6b6560'; g.fillRect(0, 0, W, H);
    for (let s = 0; s < 2; s++) { const x = s * W / 2; const col = signs[s] ??= pick(colors);
      if (!em) { g.fillStyle = col; g.fillRect(x + 4, 6, W / 2 - 8, 34); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = 'bold 22px sans-serif'; g.fillText(SHOP_NAMES[(variant * 2 + Math.floor(s / 1)) % SHOP_NAMES.length][s], x + 20, 31); }
      else { g.fillStyle = col; g.globalAlpha = 0.9; g.fillRect(x + 4, 6, W / 2 - 8, 34); g.globalAlpha = 1; }
      const gx = x + 10, gy = 52, gw = W / 2 - 20, gh = H - 60;
      if (em) { const lg = g.createLinearGradient(0, gy, 0, gy + gh); lg.addColorStop(0, '#fff1cf'); lg.addColorStop(0.5, '#d9a860'); lg.addColorStop(1, '#5a3a18'); g.fillStyle = lg; g.fillRect(gx, gy, gw, gh);
        g.fillStyle = 'rgba(0,0,0,.55)'; for (let k = 0; k < 3; k++) g.fillRect(gx + 6, gy + gh * (0.35 + k * 0.2), gw - 12, 5);   // shelves
        for (let k = 0; k < 3; k++) { const px = gx + 15 + Math.random() * (gw - 40); g.fillRect(px, gy + gh * 0.45, 12, gh * 0.55); g.beginPath(); g.arc(px + 6, gy + gh * 0.4, 6, 0, 7); g.fill(); }   // people
        g.fillStyle = '#000'; g.fillRect(gx + gw * 0.62, gy, 4, gh); g.fillRect(gx, gy, gw, 4); continue; }
      const gr = g.createLinearGradient(gx, gy, gx + gw, gy + gh); gr.addColorStop(0, '#3d4c58'); gr.addColorStop(1, '#1b252e'); g.fillStyle = gr; g.fillRect(gx, gy, gw, gh);
      g.fillStyle = '#222'; g.fillRect(gx + gw * 0.62, gy, 4, gh); g.fillRect(gx, gy, gw, 4);
      for (let k = 0; k < 6; k++) { g.fillStyle = `hsla(${Math.random() * 360},40%,60%,.35)`; g.fillRect(gx + 8 + Math.random() * gw * 0.5, gy + gh * 0.5 + Math.random() * gh * 0.3, 14, 18); }
    }
  };
  return { map: tex(W, H, g => draw(g, false)), em: tex(W, H, g => draw(g, true)) };
}

// ---------- geometry helpers ----------
class GeoBuf { constructor() { this.p = []; this.n = []; this.u = []; this.c = null; }
  quad(a, b, c, d, n, uv) { // a,b,c,d CCW seen from outside
    this.p.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) this.n.push(...n);
    const [u0, v0, u1, v1] = uv; this.u.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1); }
  build() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); return g; } }
// walls of an axis-aligned prism from y=h0 to h1; tile size tw x th (m); random u offset
function walls(buf, x0, z0, x1, z1, h0, h1, tw, th, uo = 0) {
  const v0 = h0 / th, v1 = h1 / th;
  buf.quad([x0, h0, z1], [x1, h0, z1], [x1, h1, z1], [x0, h1, z1], [0, 0, 1], [uo, v0, uo + (x1 - x0) / tw, v1]);
  buf.quad([x1, h0, z0], [x0, h0, z0], [x0, h1, z0], [x1, h1, z0], [0, 0, -1], [uo, v0, uo + (x1 - x0) / tw, v1]);
  buf.quad([x1, h0, z1], [x1, h0, z0], [x1, h1, z0], [x1, h1, z1], [1, 0, 0], [uo, v0, uo + (z1 - z0) / tw, v1]);
  buf.quad([x0, h0, z0], [x0, h0, z1], [x0, h1, z1], [x0, h1, z0], [-1, 0, 0], [uo, v0, uo + (z1 - z0) / tw, v1]);
}
function top(buf, x0, z0, x1, z1, h, s = 6) { buf.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], [x0 / s, z1 / s, x1 / s, z0 / s]); }
function colQuad(buf, x0, z0, x1, z1, y, col) { buf.p.push(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0); for (let i = 0; i < 6; i++) { buf.n.push(0, 1, 0); buf.u.push(0, 0); buf.c.push(...col); } }

// ---------- build ----------
export function buildCity(scene, quality, fleet) {
  const group = new THREE.Group(); scene.add(group);
  const styles = ['glass', 'office', 'white', 'beige', 'brick'];
  const F = {}; for (const s of styles) F[s] = facade(s);
  const SHOPS = 4; const shops = []; for (let v = 0; v < SHOPS; v++) shops.push(shopTex(v));
  const mats = {}, bufs = {};
  for (const s of styles) { mats[s] = new THREE.MeshStandardMaterial({ map: F[s].map, emissiveMap: F[s].em, emissive: 0xffffff, emissiveIntensity: 0, roughness: s === 'glass' ? 0.12 : 0.85, metalness: s === 'glass' ? 0.75 : 0.05, envMapIntensity: s === 'glass' ? 1.3 : 0.6 }); bufs[s] = new GeoBuf(); }
  for (let v = 0; v < SHOPS; v++) { mats['shop' + v] = new THREE.MeshStandardMaterial({ map: shops[v].map, emissiveMap: shops[v].em, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5, metalness: 0.2 }); bufs['shop' + v] = new GeoBuf(); }
  const roofTex = tex(256, 256, (g, w, h) => noise(g, w, h, '#57585a', 0.25, 9000, 2));
  mats.roof = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.95 }); bufs.roof = new GeoBuf();
  // ground: grass outside, asphalt for the city
  const grassTex = tex(512, 512, (g, w, h) => { noise(g, w, h, '#4f7d35', 0.18, 40000, 2); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '30,60,20' : '110,150,60'},${Math.random() * .22})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 14, 0, 7); g.fill(); } });
  grassTex.repeat.set(220, 220);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(SIZE / 2, -0.02, SIZE / 2); ground.receiveShadow = true; group.add(ground);
  const asphaltTex = tex(512, 512, (g, w, h) => { noise(g, w, h, '#3c3e42', 0.2, 30000, 2); for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .12})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 10 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill(); } g.strokeStyle = 'rgba(15,15,15,.35)'; g.lineWidth = 1.5; for (let i = 0; i < 12; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - .5) * 40; y += (Math.random() - .5) * 40; g.lineTo(x, y); } g.stroke(); } });
  asphaltTex.repeat.set((SIZE + ROAD) / 9, (SIZE + ROAD) / 9);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(SIZE + ROAD, SIZE + ROAD), new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2; road.position.set(SIZE / 2, 0, SIZE / 2); road.receiveShadow = true; group.add(road);

  // ---- road markings (vertex coloured quads) ----
  const mk = new GeoBuf(); mk.c = [];
  const WHITE = [0.92, 0.92, 0.9], YEL = [0.95, 0.75, 0.15];
  for (let k = 0; k <= NB; k++) for (let s = 0; s < NB; s++) {
    const a = s * P + ROAD / 2, b = (s + 1) * P - ROAD / 2, c = k * P;
    for (const horiz of [true, false]) {
      const Q = (u0, u1, v0, v1, col) => horiz ? colQuad(mk, u0, c + v0, u1, c + v1, 0.012, col) : colQuad(mk, c + v0, u0, c + v1, u1, 0.012, col);
      const edge = k === 0 || k === NB;
      Q(a + 5, b - 5, -0.25, -0.1, YEL); Q(a + 5, b - 5, 0.1, 0.25, YEL);                          // double yellow
      for (let u = a + 6; u < b - 7; u += 9) { Q(u, u + 3, 3.4, 3.56, WHITE); Q(u, u + 3, -3.56, -3.4, WHITE); } // lane dashes
      Q(a + 0.5, b - 0.5, 7.3, 7.45, WHITE); Q(a + 0.5, b - 0.5, -7.45, -7.3, WHITE);               // edge lines
      // stop lines and zebra crossings at both ends
      Q(b - 5.2, b - 4.7, 0.3, 7.2, WHITE); Q(a + 4.7, a + 5.2, -7.2, -0.3, WHITE);
      for (let z = -7; z < 7; z += 1.2) { Q(b - 4.2, b - 0.6, z, z + 0.6, WHITE); Q(a + 0.6, a + 4.2, z, z + 0.6, WHITE); }
      if (edge) {}
    }
  }
  // parking lot stalls
  for (const b of blocks) if (b.type === 'lot') { for (let row = 0; row < 3; row++) { const z = b.y0 + 12 + row * 22; for (let x = b.x0 + 8; x < b.x0 + BL - 8; x += 2.8) { colQuad(mk, x, z - 2.6, x + 0.12, z + 2.6, 0.17, WHITE); } } }
  const marks = new THREE.Mesh(mk.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  marks.receiveShadow = true; group.add(marks);

  // ---- sidewalks / block slabs ----
  const tileTex = tex(256, 256, (g, w, h) => { noise(g, w, h, '#a8a49c', 0.12, 4000, 2); g.strokeStyle = 'rgba(60,55,50,.35)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } });
  const slab = new GeoBuf(), curbB = new GeoBuf(), grassB = new GeoBuf(), lotB = new GeoBuf();
  for (const b of blocks) {
    const x0 = b.x0, z0 = b.y0, x1 = b.x0 + BL, z1 = b.y0 + BL;
    walls(curbB, x0, z0, x1, z1, 0, CURB, 1, 1); top(slab, x0, z0, x1, z1, CURB, 2);
    if (b.type === 'park') top(grassB, x0 + SW, z0 + SW, x1 - SW, z1 - SW, CURB + 0.01, 14);
    if (b.type === 'lot') top(lotB, x0 + SW, z0 + SW, x1 - SW, z1 - SW, CURB + 0.005, 9);
  }
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xbdbab3, roughness: 0.8 });
  const addM = (buf, mat, recv = true, cast = false) => { const m = new THREE.Mesh(buf.build(), mat); m.receiveShadow = recv; m.castShadow = cast; group.add(m); return m; };
  addM(slab, new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.85 })); addM(curbB, curbMat);
  const g2 = grassTex.clone(); g2.repeat.set(1, 1); g2.needsUpdate = true; addM(grassB, new THREE.MeshStandardMaterial({ map: g2, roughness: 1 }));
  const a2 = asphaltTex.clone(); a2.repeat.set(1, 1); a2.needsUpdate = true; addM(lotB, new THREE.MeshStandardMaterial({ map: a2, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }));

  // ---- buildings ----
  const roofProps = []; let tallest = { h: 0 };
  for (const b of blocks) {
    if (b.type !== 'buildings') continue;
    const inner0x = b.x0 + SW, inner0z = b.y0 + SW, size = BL - 2 * SW;
    const nx = b.district === 'downtown' ? (rnd() < 0.5 ? 1 : 2) : b.district === 'mid' ? 2 + (rnd() < 0.4 ? 1 : 0) : 3;
    const nz = b.district === 'downtown' ? (rnd() < 0.5 ? 1 : 2) : b.district === 'mid' ? 2 : 3 + (rnd() < 0.5 ? 1 : 0);
    const cut = (n) => { const c = [0]; for (let i = 1; i < n; i++) c.push(i / n + (rnd() - 0.5) * 0.12); c.push(1); return c; };
    const cx = cut(nx), cz = cut(nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      // only parcels touching the block edge get buildings in outer districts (courtyards inside)
      if (b.district === 'outer' && i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
      const m = b.district === 'downtown' ? 2 + rnd() * 3 : 0.8 + rnd() * 1.5;
      let x0 = inner0x + cx[i] * size + m, x1 = inner0x + cx[i + 1] * size - m, z0 = inner0z + cz[j] * size + m, z1 = inner0z + cz[j + 1] * size - m;
      if (x1 - x0 < 8 || z1 - z0 < 8) continue;
      const style = b.district === 'downtown' ? (rnd() < 0.6 ? 'glass' : pick(['office', 'white'])) : b.district === 'mid' ? pick(['office', 'white', 'beige', 'beige', 'glass']) : pick(['brick', 'beige', 'white', 'brick']);
      const floors = b.district === 'downtown' ? 14 + Math.floor(rnd() * rnd() * 40) : b.district === 'mid' ? 5 + Math.floor(rnd() * 10) : 2 + Math.floor(rnd() * 4);
      let h = 4.2 + floors * 3.2; const uo = Math.floor(rnd() * 4) * 0.25;
      const shopBand = style !== 'glass' || rnd() < 0.5;
      if (shopBand) { walls(bufs['shop' + Math.floor(rnd() * SHOPS)], x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, 0, 4.2, 12, 4.2, Math.floor(rnd() * 2) * 0.5); top(bufs.roof, x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, 4.2); }
      const h0 = shopBand ? 4.2 : 0;
      // towers get setbacks
      if (b.district === 'downtown' && h > 70) {
        const h1 = h * (0.55 + rnd() * 0.15); walls(bufs[style], x0, z0, x1, z1, h0, h1, 12, 12.8, uo); top(bufs.roof, x0, z0, x1, z1, h1);
        const s = Math.min(x1 - x0, z1 - z0) * (0.12 + rnd() * 0.08); x0 += s; x1 -= s; z0 += s; z1 -= s;
        walls(bufs[style], x0, z0, x1, z1, h1, h, 12, 12.8, uo); top(bufs.roof, x0, z0, x1, z1, h);
      } else { walls(bufs[style], x0, z0, x1, z1, h0, h, 12, 12.8, uo); top(bufs.roof, x0, z0, x1, z1, h); }
      // parapet
      walls(bufs.roof, x0, z0, x1, z1, h, h + 0.9, 6, 6);
      addBox(b, x0 - 0.2, z0 - 0.2, x1 + 0.2, z1 + 0.2);
      // rooftop props
      const nprops = Math.floor((x1 - x0) * (z1 - z0) / 220);
      for (let k = 0; k < nprops; k++) roofProps.push([x0 + 2 + rnd() * (x1 - x0 - 4), h, z0 + 2 + rnd() * (z1 - z0 - 4), rnd() < 0.7 ? 0 : 1]);
      if (h > tallest.h) tallest = { h, x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    }
  }
  for (const k of [...styles, 'shop0', 'shop1', 'shop2', 'shop3', 'roof']) { const m = addM(bufs[k], mats[k], true, quality !== 'low'); }
  // roof props (AC units, water tanks) + antenna on the tallest tower
  const acGeo = new THREE.BoxGeometry(2.2, 1.4, 1.6); acGeo.translate(0, 0.7 + 0.9, 0);
  const tankGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.4, 10); tankGeo.translate(0, 2.1, 0);
  const acs = new THREE.InstancedMesh(acGeo, new THREE.MeshStandardMaterial({ color: 0x9a9da2, roughness: 0.6, metalness: 0.4 }), roofProps.length || 1);
  const tanks = new THREE.InstancedMesh(tankGeo, new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.9 }), roofProps.length || 1);
  const D = new THREE.Object3D(); let ai = 0, ti = 0;
  for (const [x, h, z, t] of roofProps) { D.position.set(x, h, z); D.rotation.set(0, rnd() < 0.5 ? 0 : Math.PI / 2, 0); D.scale.set(1, 1, 1); D.updateMatrix(); if (t) tanks.setMatrixAt(ti++, D.matrix); else acs.setMatrixAt(ai++, D.matrix); }
  acs.count = ai; tanks.count = ti; group.add(acs, tanks);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 30, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 })); ant.position.set(tallest.x, tallest.h + 15, tallest.z); group.add(ant);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); beacon.position.set(tallest.x, tallest.h + 30.5, tallest.z); group.add(beacon);

  // ---- street furniture ----
  const lamps = [], trees = [], hydrants = [], bins = [], benches = [];
  for (const b of blocks) {
    const x0 = b.x0, z0 = b.y0, x1 = b.x0 + BL, z1 = b.y0 + BL, e = 0.8;
    for (let t = 10; t < BL - 6; t += 24) {
      for (const [x, z, a] of [[x0 + t, z0 + e, Math.PI], [x0 + t, z1 - e, 0], [x0 + e, z0 + t + 12, Math.PI / 2], [x1 - e, z0 + t + 12, -Math.PI / 2]]) { lamps.push([x, z, a]); b.circles.push([x, z, 0.3]); }
      if (b.district !== 'downtown' || b.type === 'park') for (const [x, z] of [[x0 + t + 12, z0 + 1.6], [x0 + t + 12, z1 - 1.6], [x0 + 1.6, z0 + t], [x1 - 1.6, z0 + t]]) { if (x > x1 - 4 || z > z1 - 4) continue; trees.push([x, z, 0.8 + rnd() * 0.4]); b.circles.push([x, z, 0.45]); }
    }
    hydrants.push([x0 + 3, z0 + 1.2]); b.circles.push([x0 + 3, z0 + 1.2, 0.3]);
    if (b.type !== 'park') for (let k = 0; k < 3; k++) { const x = x0 + 15 + rnd() * (BL - 30), z = rnd() < 0.5 ? z0 + 3.6 : z1 - 3.6; bins.push([x, z]); b.circles.push([x, z, 0.35]); }
    if (b.type === 'park') {
      for (let k = 0; k < 40; k++) { const x = x0 + 10 + rnd() * (BL - 20), z = z0 + 10 + rnd() * (BL - 20); if (Math.abs(x - (x0 + BL / 2)) < 4 || Math.abs(z - (z0 + BL / 2)) < 4) continue; trees.push([x, z, 0.9 + rnd() * 0.8]); b.circles.push([x, z, 0.5]); }
      const f = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.8, 24), curbMat); f.position.set(x0 + BL / 2, 0.55, z0 + BL / 2); f.castShadow = true; f.receiveShadow = true; group.add(f);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0x3b6e8f, metalness: 0.4, roughness: 0.05 })); w.position.set(x0 + BL / 2, 0.9, z0 + BL / 2); group.add(w);
      b.circles.push([x0 + BL / 2, z0 + BL / 2, 4.6]);
      // cross paths
      top(slab, x0 + BL / 2 - 2, z0 + SW, x0 + BL / 2 + 2, z1 - SW, CURB + 0.02, 2); top(slab, x0 + SW, z0 + BL / 2 - 2, x1 - SW, z0 + BL / 2 + 2, CURB + 0.02, 2);
      for (const [dx, dz, a] of [[6, 3.2, 0], [-6, -3.2, Math.PI], [3.2, -6, Math.PI / 2], [-3.2, 6, -Math.PI / 2]]) benches.push([x0 + BL / 2 + dx, z0 + BL / 2 + dz, a]);
    }
  }
  // paths were added to slab after its mesh was built: rebuild a small extra mesh
  const lampPole = new THREE.CylinderGeometry(0.09, 0.14, 8, 8); lampPole.translate(0, 4, 0);
  const lampArm = new THREE.BoxGeometry(0.1, 0.1, 2.2); lampArm.translate(0, 7.9, 1.0);
  const lampHead = new THREE.BoxGeometry(0.35, 0.16, 0.8); lampHead.translate(0, 7.8, 2.0);
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.7, roughness: 0.4 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffd9a0, emissiveIntensity: 0.0, roughness: 0.3 });
  const inst = (geo, mat, list, f, cast = false) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); list.forEach((it, i) => { f(D, it); D.updateMatrix(); m.setMatrixAt(i, D.matrix); }); m.count = list.length; m.castShadow = cast; group.add(m); return m; };
  const lampF = (D, [x, z, a]) => { D.position.set(x, CURB, z); D.rotation.set(0, -a, 0); D.scale.set(1, 1, 1); };
  inst(lampPole, metal, lamps, lampF, quality === 'high'); inst(lampArm, metal, lamps, lampF); inst(lampHead, headMat, lamps, lampF);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.6, 6); trunkGeo.translate(0, 1.3, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.2, quality === 'high' ? 1 : 0); crownGeo.translate(0, 4.2, 0);
  const treeF = (D, [x, z, s]) => { D.position.set(x, CURB, z); D.rotation.set(0, x * 13.1 % 6.28, 0); D.scale.set(s, s * (0.9 + (z % 1) * 0.3), s); };
  inst(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x4d3420, roughness: 1 }), trees, treeF);
  inst(crownGeo, new THREE.MeshStandardMaterial({ color: 0x3c6e2a, roughness: 1, flatShading: true }), trees, treeF, quality === 'high');
  const hyd = new THREE.CylinderGeometry(0.16, 0.2, 0.75, 8); hyd.translate(0, 0.38, 0);
  inst(hyd, new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 }), hydrants, (D, [x, z]) => { D.position.set(x, CURB, z); D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); });
  const binG = new THREE.CylinderGeometry(0.3, 0.26, 0.95, 10); binG.translate(0, 0.48, 0);
  inst(binG, new THREE.MeshStandardMaterial({ color: 0x2d5a3a, roughness: 0.6 }), bins, (D, [x, z]) => { D.position.set(x, CURB, z); D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); });
  const benchG = new THREE.BoxGeometry(1.8, 0.45, 0.5); benchG.translate(0, 0.45, 0);
  inst(benchG, new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 0.8 }), benches, (D, [x, z, a]) => { D.position.set(x, CURB, z); D.rotation.set(0, a, 0); D.scale.set(1, 1, 1); });
  // park paths mesh
  const pathB = new GeoBuf(); for (const b of blocks) if (b.type === 'park') { const x0 = b.x0, z0 = b.y0, x1 = b.x0 + BL, z1 = b.y0 + BL; top(pathB, x0 + BL / 2 - 2, z0 + SW, x0 + BL / 2 + 2, z1 - SW, CURB + 0.03, 2); top(pathB, x0 + SW, z0 + BL / 2 - 2, x1 - SW, z0 + BL / 2 + 2, CURB + 0.03, 2); }
  addM(pathB, new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.85 }));

  // ---- traffic lights: one mast arm per approach, pole on the drivers' right before the junction ----
  const tl = [];
  for (let i = 0; i <= NB; i++) for (let j = 0; j <= NB; j++) {
    const cx = i * P, cz = j * P, o = ROAD / 2 + 1.0;
    if (i > 0) tl.push({ x: cx - o, z: cz + o, a: 0, axis: 'ew' });             // moving +x
    if (i < NB) tl.push({ x: cx + o, z: cz - o, a: Math.PI, axis: 'ew' });      // moving -x
    if (j > 0) tl.push({ x: cx - o, z: cz - o, a: Math.PI / 2, axis: 'ns' });   // moving +z
    if (j < NB) tl.push({ x: cx + o, z: cz + o, a: -Math.PI / 2, axis: 'ns' }); // moving -z
  }
  for (const t of tl) { const b = blockAt(t.x + Math.sign(t.x - Math.round(t.x / P) * P) * 0.5, t.z + Math.sign(t.z - Math.round(t.z / P) * P) * 0.5); if (b) b.circles.push([t.x, t.z, 0.3]); }
  // local frame: +x = travel direction, +z = drivers' right, so the arm reaches over the lanes along -z
  const tPole = new THREE.CylinderGeometry(0.13, 0.16, 6, 8); tPole.translate(0, 3, 0);
  const tArm = new THREE.BoxGeometry(0.12, 0.12, 7); tArm.translate(0, 5.9, -3.5);
  const tBox = new THREE.BoxGeometry(0.35, 1.05, 0.38); tBox.translate(0.05, 5.3, -5.2);
  const tlF = (D, t) => { D.position.set(t.x, CURB, t.z); D.rotation.set(0, -t.a, 0); D.scale.set(1, 1, 1); };
  const tlMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.5, roughness: 0.5 });
  inst(tPole, tlMat, tl, tlF, quality === 'high'); inst(tArm, tlMat, tl, tlF); inst(tBox, tlMat, tl, tlF);
  const bulb = new THREE.SphereGeometry(0.12, 6, 4);
  const bulbs = [0, 1, 2].map(k => { const g = bulb.clone(); g.translate(-0.15, 5.65 - k * 0.33, -5.2); const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), tl.length); tl.forEach((t, i) => { tlF(D, t); D.updateMatrix(); m.setMatrixAt(i, D.matrix); m.setColorAt(i, new THREE.Color(0, 0, 0)); }); group.add(m); return m; });
  const ON = [new THREE.Color(3, 0.2, 0.15), new THREE.Color(3, 1.8, 0.1), new THREE.Color(0.2, 3, 0.6)], OFF = [new THREE.Color(0.25, 0.03, 0.03), new THREE.Color(0.25, 0.18, 0.02), new THREE.Color(0.02, 0.2, 0.06)];
  let lastPhase = '';
  function updateLights() {
    const ew = lightState('ew'), ns = lightState('ns'), key = ew + '' + ns; if (key === lastPhase) return; lastPhase = key;
    tl.forEach((t, i) => { const st = t.axis === 'ew' ? ew : ns; // st: 0 green 1 yellow 2 red -> bulbs top red(0) mid yellow(1) bottom green(2)
      bulbs[0].setColorAt(i, st === 2 ? ON[0] : OFF[0]); bulbs[1].setColorAt(i, st === 1 ? ON[1] : OFF[1]); bulbs[2].setColorAt(i, st === 0 ? ON[2] : OFF[2]); });
    for (const b of bulbs) b.instanceColor.needsUpdate = true;
  }
  updateLights();

  // ---- parked cars in lots ----
  const parked = [];
  if (fleet) for (const b of blocks) if (b.type === 'lot') for (let row = 0; row < 3; row++) { const z = b.y0 + 12 + row * 22; for (let x = b.x0 + 8; x < b.x0 + BL - 10; x += 2.8) { if (rnd() < 0.35) continue;
        const kind = pick(['sedan', 'sedan', 'suv', 'hatch']); const S = fleet.shape(kind); const cx = x + 1.4, cz = z + (rnd() < 0.5 ? 0 : 0);
        const id = fleet.add(kind, pick(CAR_COLORS)); const a = rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2; fleet.set(id, cx, cz, a, false); parked.push(id);
        b.boxes.push([cx - 0.95, cz - S.L / 2, cx + 0.95, cz + S.L / 2]); } }

  // ---- city edge: hedges + distant hills ----
  const hedge = new THREE.MeshStandardMaterial({ color: 0x2f5a24, roughness: 1 });
  for (const [x, z, w, d] of [[SIZE / 2, BOUND.min - 1, SIZE + 130, 2], [SIZE / 2, BOUND.max + 1, SIZE + 130, 2], [BOUND.min - 1, SIZE / 2, 2, SIZE + 130], [BOUND.max + 1, SIZE / 2, 2, SIZE + 130]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), hedge); m.position.set(x, 1.1, z); group.add(m); }
  const hillGeo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const hillMats = [0x56724a, 0x4d6a44, 0x617d50, 0x6b7f5a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 22; k++) { const a = (k + ring * 0.5) / 22 * Math.PI * 2 + rnd() * 0.1, r = 1200 + ring * 380 + rnd() * 200;
    const h = new THREE.Mesh(hillGeo, hillMats[Math.floor(rnd() * 4)]); const w = 220 + rnd() * 260; h.scale.set(w, (60 + rnd() * 110) * (1 + ring * 0.8), w * (0.6 + rnd() * 0.5)); h.rotation.y = rnd() * 3;
    h.position.set(SIZE / 2 + Math.cos(a) * r, -2, SIZE / 2 + Math.sin(a) * r); group.add(h); }

  // ---- night ----
  const windowMats = styles.map(s => mats[s]), shopMats = [0, 1, 2, 3].map(v => mats['shop' + v]);
  function setNight(f) { for (const m of windowMats) m.emissiveIntensity = f * 1.1; for (const m of shopMats) m.emissiveIntensity = f * 0.6; headMat.emissiveIntensity = f * 4; }

  return { group, lamps, updateLights, setNight, parked };
}
export const CAR_COLORS = ['#f2f2f2', '#f2f2f2', '#1b1c1f', '#1b1c1f', '#9ea3a8', '#9ea3a8', '#5b6066', '#1f3a5f', '#7a1f1f', '#d7c9a7', '#2f4f3a', '#f0c419'];

// city map image for the minimap (1 px = 1 m)
export function cityMapCanvas() {
  const S = SIZE + 2 * 80, c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d');
  g.translate(80, 80); g.fillStyle = '#3d5a30'; g.fillRect(-80, -80, S, S);
  g.fillStyle = '#5a5e66'; g.fillRect(-ROAD / 2, -ROAD / 2, SIZE + ROAD, SIZE + ROAD);
  for (const b of blocks) { g.fillStyle = b.type === 'park' ? '#4e7d3a' : b.type === 'lot' ? '#6c7078' : '#9a9590'; g.fillRect(b.x0, b.y0, BL, BL);
    if (b.type === 'buildings') { g.fillStyle = b.district === 'downtown' ? '#c9c2b6' : '#b7b0a5'; for (const [x0, y0, x1, y1] of b.boxes) g.fillRect(x0, y0, x1 - x0, y1 - y0); } }
  return { canvas: c, offset: 80 };
}
