// City services: fuel stations (with EV chargers + convenience store) and repair garages, built on city blocks.
// Each service exposes a world-space zone; the game checks the zone to offer refuelling / charging / repairs.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { blocks, P } from './city.js';

export const SERVICE_DEFS = [
  { i: 4, j: 1, kind: 'garage', name: 'Usta Oto Tamir' },
  { i: 5, j: 7, kind: 'garage', name: 'Hızlı Kaporta & Tamir' },
  { i: 1, j: 5, kind: 'station', name: 'TP Petrol · Batı' },
  { i: 8, j: 3, kind: 'station', name: 'TP Petrol · Doğu' },
  { i: 2, j: 8, kind: 'station', name: 'TP Petrol · Güney' },
];
// mark the blocks before the city is built so it lays asphalt instead of buildings
for (const d of SERVICE_DEFS) { const b = blocks[d.j * 10 + d.i]; b.type = 'lot'; b.service = d.kind; b.serviceName = d.name; }

// ---------- canvas textures ----------
const texCache = {};
function canvasTex(key, w, h, draw, repeat) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return (texCache[key] = t);
}
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
function noise(g, w, h, n, a, dark = true) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${dark ? '0,0,0' : '255,255,255'},${rnd() * a})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } }
// aluminium composite cladding: large panels with dark seams
const cladTex = (base, key) => canvasTex('clad' + key, 512, 512, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h);
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.07)'); gr.addColorStop(1, 'rgba(0,0,0,.08)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 0; x <= w; x += 128) g.fillRect(x - 2, 0, 4, h); for (let y = 0; y <= h; y += 256) g.fillRect(0, y - 2, w, 4);
  g.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 0; x <= w; x += 128) g.fillRect(x + 2, 0, 1, h); noise(g, w, h, 1500, 0.04); }, true);
const brickTex = () => canvasTex('brick', 512, 512, (g, w, h) => { g.fillStyle = '#8a8580'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 16; r++) for (let c = -1; c < 9; c++) { const x = c * 64 + (r % 2) * 32, y = r * 32; const v = 110 + rnd() * 50; g.fillStyle = `rgb(${v + 50},${v * 0.55 + 20},${v * 0.4 + 10})`; g.fillRect(x + 2, y + 2, 60, 28); }
  noise(g, w, h, 4000, 0.12); }, true);
const concreteTex = () => canvasTex('conc', 512, 512, (g, w, h) => { g.fillStyle = '#a9a69f'; g.fillRect(0, 0, w, h); noise(g, w, h, 9000, 0.08); noise(g, w, h, 3000, 0.06, false);
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  for (let k = 0; k < 6; k++) { const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(20,18,15,.35)'); gr.addColorStop(1, 'rgba(20,18,15,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } }, true);
const pegTex = () => canvasTex('peg', 512, 256, (g, w, h) => { g.fillStyle = '#5b6470'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.55)'; for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
  const tools = ['#c9ccd1', '#d23b2f', '#e9b522', '#3c7be0', '#b7bbc0']; for (let k = 0; k < 26; k++) { g.fillStyle = tools[k % 5]; const x = 20 + (k % 13) * 37, y = 30 + Math.floor(k / 13) * 110; g.save(); g.translate(x, y); g.rotate((rnd() - 0.5) * 0.2);
    if (k % 3 === 0) { g.fillRect(-3, 0, 6, 70); g.fillRect(-10, 0, 20, 10); } else if (k % 3 === 1) { g.fillRect(-2, 0, 4, 60); g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); } else { g.fillRect(-4, 20, 8, 55); g.fillRect(-12, 0, 24, 22); } g.restore(); } });
const shutterTex = () => canvasTex('shut', 256, 256, (g, w, h) => { g.fillStyle = '#b8bcc2'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#d9dce0'); gr.addColorStop(0.6, '#a7abb1'); gr.addColorStop(1, '#6f747a'); g.fillStyle = gr; g.fillRect(0, y, w, 16); } }, true);
const stripeTex = () => canvasTex('stripe', 128, 128, (g, w, h) => { g.fillStyle = '#f1c40f'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + 32, 0); g.lineTo(k * 64 + 32 + 128, h); g.lineTo(k * 64 + 128, h); g.fill(); } }, true);
function textTex(key, w, h, draw) { return canvasTex(key, w, h, draw); }
const roundRect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const logo = (g, x, y, s) => { g.save(); g.translate(x, y); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, s, 0, 7); g.fill(); g.fillStyle = '#16a34a'; g.beginPath(); g.arc(0, 0, s * 0.82, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = `900 ${s * 0.9}px Inter,Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TP', 0, s * 0.06); g.restore(); };

export function buildServices(scene) {
  const group = new THREE.Group(); scene.add(group); const list = [], glow = [];
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const em = (color, base = 0.25) => { const m = std({ color: 0x222222, emissive: color, emissiveIntensity: base, roughness: 0.4 }); m.userData.base = base; glow.push(m); return m; };
  const M = {
    white: std({ color: 0xf4f5f7, roughness: 0.42, metalness: 0.15 }),
    cladW: std({ map: cladTex('#eef0f2', 'w'), roughness: 0.38, metalness: 0.25 }),
    cladG: std({ map: cladTex('#1b9a4f', 'g'), roughness: 0.4, metalness: 0.25 }),
    cladD: std({ map: cladTex('#3a3f47', 'd'), roughness: 0.5, metalness: 0.3 }),
    brick: std({ map: brickTex(), roughness: 0.9 }),
    red: std({ color: 0xd3262c, roughness: 0.4, metalness: 0.1 }),
    green: std({ color: 0x17924a, roughness: 0.4, metalness: 0.1 }),
    dark: std({ color: 0x24262b, roughness: 0.55, metalness: 0.2 }),
    rubber: std({ color: 0x141414, roughness: 0.85 }),
    steel: std({ color: 0xa4aab2, roughness: 0.3, metalness: 0.9 }),
    chrome: std({ color: 0xe8ecf0, roughness: 0.12, metalness: 1 }),
    concrete: std({ map: concreteTex(), roughness: 0.92 }),
    glass: std({ color: 0x6f8fa3, roughness: 0.05, metalness: 0.85, transparent: true, opacity: 0.42, depthWrite: false }),
    frame: std({ color: 0x2c3036, roughness: 0.35, metalness: 0.8 }),
    yellow: std({ color: 0xf2b705, roughness: 0.45, metalness: 0.2 }),
    blue: std({ color: 0x1463d8, roughness: 0.4, metalness: 0.1 }),
    stripe: std({ map: stripeTex(), roughness: 0.6 }),
    peg: std({ map: pegTex(), roughness: 0.7 }),
    shutter: std({ map: shutterTex(), roughness: 0.45, metalness: 0.7 }),
    paint: std({ color: 0xf2f2f2, roughness: 0.7 }),
    paintY: std({ color: 0xf2c200, roughness: 0.7 }),
    lightP: em(0xffffff, 0.35), ledG: em(0x22ff88, 0.8), ledB: em(0x3aa0ff, 0.8),
  };
  // night light pools: soft additive patches on the ground where the canopy / bay lights shine
  const poolTex = canvasTex('pool', 256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const pools = []; const poolMat = (c, k) => { const m = new THREE.MeshBasicMaterial({ map: poolTex, color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); m.userData.k = k; pools.push(m); return m; };
  const decal = (tex, opts = {}) => new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, ...opts });
  for (const d of SERVICE_DEFS) {
    const b = blocks[d.j * 10 + d.i]; const X = b.x0, Y = b.y0, G0 = 0.17;
    const add = (m, u, y, v) => { m.position.set(X + u, y, Y + v); group.add(m); return m; };
    const box = (u0, v0, u1, v1, y0, y1, mat, collide = false, round = 0) => {
      const geo = round ? new RoundedBoxGeometry(u1 - u0, y1 - y0, v1 - v0, 2, round) : new THREE.BoxGeometry(u1 - u0, y1 - y0, v1 - v0);
      const m = add(new THREE.Mesh(geo, mat), (u0 + u1) / 2, (y0 + y1) / 2, (v0 + v1) / 2); m.castShadow = y1 - y0 > 0.4; m.receiveShadow = true;
      if (collide) b.boxes.push([X + u0, Y + v0, X + u1, Y + v1]); return m; };
    // wall with texture scaled to metres (so panels keep their size)
    const wall = (u0, v0, u1, v1, y0, y1, mat, collide = true, tile = 4) => { const m = box(u0, v0, u1, v1, y0, y1, mat.clone(), collide);
      if (m.material.map) { m.material.map = m.material.map.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set(Math.max(u1 - u0, v1 - v0) / tile, (y1 - y0) / tile); } return m; };
    const cyl = (r0, r1, h, mat, u, y, v, seg = 16) => { const m = add(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat), u, y, v); m.castShadow = true; return m; };
    const floorDecal = (tex, u, v, w, h, rot = 0, mat) => { const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || decal(tex)), u, G0 + 0.012, v); m.rotation.set(-Math.PI / 2, 0, rot); m.receiveShadow = true; return m; };
    const line = (u0, v0, u1, v1, mat = M.paint) => { const m = add(new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.12, u1 - u0), Math.max(0.12, v1 - v0)), mat), (u0 + u1) / 2, G0 + 0.008, (v0 + v1) / 2); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; };
    const panel = (tex, u, v, y, w, h, rotY = 0, emissive = 0.9) => { const mt = std({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: emissive * 0.35, roughness: 0.35 }); mt.userData.base = emissive * 0.35; mt.userData.night = emissive; glow.push(mt);
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mt), u, y, v); m.rotation.y = rotY; return m; };
    const pool = (u, v, w, h, c = 0xfff4e0, k = 0.5) => { const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), poolMat(c, k)), u, G0 + 0.02, v); m.rotation.x = -Math.PI / 2; m.renderOrder = 3; return m; };
    const bollard = (u, v) => { cyl(0.11, 0.11, 1.0, M.stripe, u, G0 + 0.5, v, 12); cyl(0.12, 0.12, 0.04, M.dark, u, G0 + 1.02, v, 12); b.circles && b.circles.push([X + u, Y + v, 0.18]); };
    // oil stains on the ground
    const stainTex = canvasTex('stain', 256, 256, (g, w, h) => { for (let k = 0; k < 5; k++) { const x = 60 + rnd() * 136, y = 60 + rnd() * 136, r = 20 + rnd() * 50, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(12,10,8,.55)'); gr.addColorStop(0.6, 'rgba(12,10,8,.25)'); gr.addColorStop(1, 'rgba(12,10,8,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });

    if (d.kind === 'station') {
      // ---------- canopy ----------
      const cu0 = 20, cu1 = 64, cv0 = 13, cv1 = 37, ch = 5.6, cfh = 1.1;
      box(cu0 + 0.4, cv0 + 0.4, cu1 - 0.4, cv1 - 0.4, ch + 0.15, ch + cfh - 0.15, M.white);
      const fascia = textTex('fascia', 2048, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#22b35e'); gr.addColorStop(1, '#138a43'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffffff'; g.fillRect(0, h - 18, w, 6); g.fillStyle = '#f5d000'; g.fillRect(0, h - 12, w, 12);
        logo(g, w / 2 - 230, 56, 40); g.fillStyle = '#fff'; g.font = '900 64px Inter,Arial'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('TP PETROL', w / 2 - 175, 58); });
      const fMat = std({ map: fascia, emissiveMap: fascia, emissive: 0xffffff, emissiveIntensity: 0.08, roughness: 0.35, metalness: 0.2 }); fMat.userData.base = 0.08; fMat.userData.night = 0.7; glow.push(fMat);
      const fz = (u0, v0, u1, v1, rep) => { const m = box(u0, v0, u1, v1, ch, ch + cfh, fMat.clone()); m.material.map = fascia.clone(); m.material.map.wrapS = THREE.RepeatWrapping; m.material.map.repeat.set(rep, 1); m.material.map.needsUpdate = true; m.material.emissiveMap = m.material.map; glow.push(m.material); m.material.userData = fMat.userData; };
      const rp = L => Math.max(1, Math.round(L / (cfh * 16))); fz(cu0, cv0 - 0.3, cu1, cv0 + 0.1, rp(cu1 - cu0)); fz(cu0, cv1 - 0.1, cu1, cv1 + 0.3, rp(cu1 - cu0)); fz(cu0 - 0.3, cv0, cu0 + 0.1, cv1, rp(cv1 - cv0)); fz(cu1 - 0.1, cv0, cu1 + 0.3, cv1, rp(cv1 - cv0));
      // recessed LED panels under the canopy
      for (let u = cu0 + 3; u < cu1 - 2; u += 5.5) for (let v = cv0 + 3; v < cv1 - 2; v += 5) { const l = add(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), M.lightP), u + 0.7, ch + 0.13, v + 0.7); l.rotation.x = Math.PI / 2; }
      for (let u = cu0 + 6; u < cu1; u += 11) for (let v = cv0 + 6; v < cv1; v += 12) pool(u, v, 16, 16, 0xfff6e8, 0.32);
      pool(61.5, 45, 34, 8, 0xeaf6ff, 0.35); pool(18, 53, 26, 9, 0xcfe6ff, 0.25);
      // ---------- pump islands ----------
      const pumpFace = textTex('pumpface', 256, 384, (g, w, h) => { g.fillStyle = '#f4f5f7'; g.fillRect(0, 0, w, h); g.fillStyle = '#17924a'; g.fillRect(0, 0, w, 70); logo(g, 46, 35, 24); g.fillStyle = '#fff'; g.font = '900 30px Inter,Arial'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('TP PETROL', 80, 37);
        roundRect(g, 26, 92, w - 52, 120, 10); g.fillStyle = '#0f1216'; g.fill(); g.fillStyle = '#7dff9e'; g.font = '700 22px monospace'; g.textAlign = 'right';
        g.fillText('TUTAR ₺   0,00', w - 40, 122); g.fillText('LİTRE      0,00', w - 40, 152); g.fillStyle = '#ffd25a'; g.fillText('BİRİM ₺  46,90', w - 40, 184);
        const cols = [['#22a34a', 'KURŞUNSUZ 95'], ['#1d6fd8', 'MOTORİN'], ['#222', 'LPG']]; cols.forEach(([c, t], k) => { roundRect(g, 26, 232 + k * 46, w - 52, 38, 8); g.fillStyle = c; g.fill(); g.fillStyle = '#fff'; g.font = '800 18px Inter,Arial'; g.textAlign = 'center'; g.fillText(t, w / 2, 252 + k * 46); }); });
      const pfMat = std({ map: pumpFace, roughness: 0.35, metalness: 0.15, emissiveMap: pumpFace, emissive: 0xffffff, emissiveIntensity: 0.05 }); pfMat.userData.base = 0.05; pfMat.userData.night = 0.35; glow.push(pfMat);
      let _pl = null; const nozzleCols = [M.green, M.blue, M.dark];
      for (const u of [29, 42, 55]) {
        box(u - 1.0, cv0 + 2.2, u + 1.0, cv1 - 2.2, G0, G0 + 0.22, M.concrete, true, 0.08);   // island kerb
        box(u - 1.02, cv0 + 2.18, u + 1.02, cv0 + 2.6, G0, G0 + 0.23, M.stripe); box(u - 1.02, cv1 - 2.6, u + 1.02, cv1 - 2.18, G0, G0 + 0.23, M.stripe);
        box(u - 0.28, cv0 + 2.8, u + 0.28, cv0 + 3.36, G0, ch + 0.2, M.cladW); box(u - 0.28, cv1 - 3.36, u + 0.28, cv1 - 2.8, G0, ch + 0.2, M.cladW);  // canopy columns
        bollard(u - 0.6, cv0 + 2.0); bollard(u + 0.6, cv0 + 2.0); bollard(u - 0.6, cv1 - 2.0); bollard(u + 0.6, cv1 - 2.0);
        for (const v of [cv0 + 8, cv1 - 8]) {
          const yb = G0 + 0.22;
          box(u - 0.5, v - 0.75, u + 0.5, v + 0.75, yb, yb + 0.25, M.dark, false, 0.04);                    // plinth
          const body = box(u - 0.42, v - 0.7, u + 0.42, v + 0.7, yb + 0.25, yb + 2.0, M.white, false, 0.06);   // cabinet
          box(u - 0.45, v - 0.74, u + 0.45, v + 0.74, yb + 2.0, yb + 2.42, M.green, false, 0.06);              // header
          for (const s of [-1, 1]) {
            const f = add(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.62), pfMat), u + s * 0.425, yb + 1.15, v); f.rotation.y = s * Math.PI / 2;
            const hl = add(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3), panelLogo()), u + s * 0.455, yb + 2.21, v); hl.rotation.y = s * Math.PI / 2;
            for (let k = 0; k < 3; k++) { const vz = v - 0.45 + k * 0.45;   // nozzles in their holsters + hoses
              box(u + s * 0.43, vz - 0.08, u + s * 0.52, vz + 0.08, yb + 0.95, yb + 1.12, M.dark);
              const nz = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 8), nozzleCols[k]), u + s * 0.55, yb + 1.12, vz); nz.rotation.z = s * 0.5;
              const p0 = new THREE.Vector3(X + u + s * 0.43, yb + 1.85, Y + vz), p3 = new THREE.Vector3(X + u + s * 0.58, yb + 0.98, Y + vz);
              const curve = new THREE.CubicBezierCurve3(p0, new THREE.Vector3(p0.x + s * 0.5, p0.y - 0.2, p0.z), new THREE.Vector3(p3.x + s * 0.55, yb + 0.15, p3.z), p3);
              const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.022, 6), M.rubber); hose.castShadow = true; group.add(hose); } }
          b.boxes.push([X + u - 0.5, Y + v - 0.75, X + u + 0.5, Y + v + 0.75]);
        }
      }
      function panelLogo() { if (_pl) return _pl; const t = textTex('hdr', 512, 96, (g, w, h) => { g.fillStyle = '#17924a'; g.fillRect(0, 0, w, h); logo(g, 60, 48, 32); g.fillStyle = '#fff'; g.font = '900 52px Inter,Arial'; g.textBaseline = 'middle'; g.fillText('TP PETROL', 110, 52); });
        const m = std({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.4 }); m.userData.base = 0.1; m.userData.night = 0.8; glow.push(m); return (_pl = m); }
      // lane arrows on the forecourt
      const arrow = textTex('arrow', 128, 256, (g, w, h) => { g.fillStyle = '#f2f2f2'; g.beginPath(); g.moveTo(64, 6); g.lineTo(120, 90); g.lineTo(84, 90); g.lineTo(84, 250); g.lineTo(44, 250); g.lineTo(44, 90); g.lineTo(8, 90); g.closePath(); g.fill(); });
      for (const u of [23, 35.5, 48.5, 61]) { floorDecal(arrow, u, 8, 1.2, 2.4, Math.PI); floorDecal(arrow, u, 42, 1.2, 2.4, Math.PI); }
      // ---------- EV chargers ----------
      const evBay = textTex('evbay', 256, 512, (g, w, h) => { g.fillStyle = 'rgba(22,163,74,.55)'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2f2f2'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h + 20);
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(140, 170); g.lineTo(90, 270); g.lineTo(126, 270); g.lineTo(110, 350); g.lineTo(170, 240); g.lineTo(134, 240); g.closePath(); g.fill(); g.font = '900 52px Inter,Arial'; g.textAlign = 'center'; g.fillText('EV', w / 2, 440); });
      const evFace = textTex('evface', 256, 512, (g, w, h) => { g.fillStyle = '#e9edf1'; g.fillRect(0, 0, w, h); roundRect(g, 38, 70, w - 76, 150, 14); g.fillStyle = '#0b1220'; g.fill();
        g.fillStyle = '#5fb8ff'; g.font = '800 30px Inter,Arial'; g.textAlign = 'center'; g.fillText('HAZIR', w / 2, 125); g.font = '600 22px Inter,Arial'; g.fillStyle = '#9fd3ff'; g.fillText('150 kW DC', w / 2, 165); g.fillText('9,50 ₺/kWh', w / 2, 198);
        g.fillStyle = '#1463d8'; g.fillRect(0, 0, w, 44); g.fillStyle = '#fff'; g.font = '900 26px Inter,Arial'; g.fillText('⚡ TP ŞARJ', w / 2, 31); roundRect(g, 90, 300, 76, 76, 38); g.fillStyle = '#20252c'; g.fill(); });
      const evMat = std({ map: evFace, emissiveMap: evFace, emissive: 0xffffff, emissiveIntensity: 0.06, roughness: 0.3, metalness: 0.2 }); evMat.userData.base = 0.06; evMat.userData.night = 0.45; glow.push(evMat);
      for (let k = 0; k < 4; k++) { const u = 9 + k * 5.5, v = 50;
        floorDecal(evBay, u, 53.2, 3.9, 6.2, 0, decal(evBay));
        box(u - 0.38, v - 0.5, u + 0.38, v + 0.12, G0, G0 + 0.16, M.concrete);
        const pillar = box(u - 0.3, v - 0.36, u + 0.3, v, G0 + 0.16, G0 + 2.05, M.white, false, 0.08);
        const f = add(new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.12), evMat), u, G0 + 1.25, v + 0.005);
        box(u - 0.31, v - 0.38, u + 0.31, v - 0.3, G0 + 0.2, G0 + 2.0, M.ledB);   // side LED strip
        const coil = add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 20), M.rubber), u + 0.34, G0 + 0.95, v - 0.18); coil.rotation.y = Math.PI / 2;
        box(u + 0.3, v - 0.26, u + 0.38, v - 0.1, G0 + 1.2, G0 + 1.42, M.dark);
        b.boxes.push([X + u - 0.38, Y + v - 0.5, X + u + 0.38, Y + v + 0.12]); bollard(u - 0.7, v - 0.3); bollard(u + 0.7, v - 0.3); }
      const evSign = textTex('evsign', 512, 192, (g, w, h) => { g.fillStyle = '#1463d8'; roundRect(g, 0, 0, w, h, 24); g.fill(); g.fillStyle = '#fff'; g.font = '900 96px Inter,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚡ ŞARJ', w / 2, 82); g.font = '700 36px Inter,Arial'; g.fillText('Hızlı DC · 150 kW', w / 2, 154); });
      panel(evSign, 18, 49.2, 3.2, 3.6, 1.35, Math.PI); cyl(0.06, 0.06, 3.0, M.steel, 16, G0 + 1.5, 49.3, 8); cyl(0.06, 0.06, 3.0, M.steel, 20, G0 + 1.5, 49.3, 8);
      // ---------- convenience store ----------
      const su0 = 46, su1 = 77, sv0 = 46, sv1 = 72, sh = 4.8;
      wall(su0, sv0 + 0.4, su0 + 0.4, sv1, G0, sh, M.cladW); wall(su1 - 0.4, sv0 + 0.4, su1, sv1, G0, sh, M.cladW); wall(su0, sv1 - 0.4, su1, sv1, G0, sh, M.cladW);
      b.boxes.push([X + su0, Y + sv0, X + su1, Y + sv1]);
      box(su0 - 0.2, sv0 - 1.4, su1 + 0.2, sv1 + 0.2, sh, sh + 0.25, M.white);                  // roof slab with overhang
      const storeSign = textTex('store', 4096, 132, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#22b35e'); gr.addColorStop(1, '#138a43'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        logo(g, 110, 66, 50); g.fillStyle = '#fff'; g.font = '900 80px Inter,Arial'; g.textBaseline = 'middle'; g.fillText('TP MARKET', 190, 70); g.textAlign = 'right'; g.font = '700 54px Inter,Arial'; g.fillText('7/24 AÇIK  ·  KAHVE  ·  ATIŞTIRMALIK  ·  ŞARKÜTERİ', w - 70, 70); });
      panel(storeSign, (su0 + su1) / 2, sv0 - 1.48, sh - 0.35, su1 - su0, 1.0, Math.PI, 1);
      box(su0, sv0 - 1.45, su1, sv0 - 1.4, sh - 0.9, sh + 0.25, M.green);
      // glass storefront with mullions and an automatic door
      for (let u = su0 + 0.4; u <= su1 - 0.4 + 1e-6; u += 3.05) box(u - 0.06, sv0 + 0.25, u + 0.06, sv0 + 0.4, G0, sh - 0.9, M.frame);
      box(su0 + 0.4, sv0 + 0.25, su1 - 0.4, sv0 + 0.4, G0, G0 + 0.35, M.frame); box(su0 + 0.4, sv0 + 0.25, su1 - 0.4, sv0 + 0.4, sh - 1.0, sh - 0.9, M.frame);
      const gl = box(su0 + 0.4, sv0 + 0.3, su1 - 0.4, sv0 + 0.34, G0 + 0.35, sh - 1.0, M.glass); gl.castShadow = false; gl.renderOrder = 2;
      box((su0 + su1) / 2 - 1.2, sv0 + 0.2, (su0 + su1) / 2 + 1.2, sv0 + 0.45, sh - 1.35, sh - 1.0, M.dark);
      // interior: lit ceiling, shelves with products, fridges, counter
      const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(su1 - su0 - 1, sv1 - sv0 - 1), M.lightP), (su0 + su1) / 2, sh - 0.05, (sv0 + sv1) / 2); ceil.rotation.x = Math.PI / 2;
      const shelfTex = textTex('shelf', 512, 256, (g, w, h) => { g.fillStyle = '#d8dadd'; g.fillRect(0, 0, w, h); const cols = ['#e63946', '#f1c40f', '#2a9d8f', '#457b9d', '#f4a261', '#8e44ad', '#ffffff', '#27ae60'];
        for (let r = 0; r < 4; r++) { g.fillStyle = '#8b9096'; g.fillRect(0, r * 64 + 58, w, 6); for (let x = 4; x < w - 10; x += 10 + rnd() * 8) { g.fillStyle = cols[Math.floor(rnd() * cols.length)]; const hh = 24 + rnd() * 28; g.fillRect(x, r * 64 + 58 - hh, 8 + rnd() * 6, hh); } } });
      const shelfMat = std({ map: shelfTex, roughness: 0.6 });
      for (let k = 0; k < 4; k++) { const u = su0 + 5 + k * 5.5; const sm = box(u - 0.45, sv0 + 6, u + 0.45, sv1 - 5, G0, G0 + 1.8, shelfMat); }
      const fridge = textTex('fridge', 512, 256, (g, w, h) => { g.fillStyle = '#e8f6ff'; g.fillRect(0, 0, w, h); for (let c = 0; c < 4; c++) { g.strokeStyle = '#333'; g.lineWidth = 6; g.strokeRect(c * 128 + 3, 3, 122, h - 6);
        for (let r = 0; r < 5; r++) for (let x = 0; x < 9; x++) { g.fillStyle = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#111'][(r + x + c) % 5]; g.fillRect(c * 128 + 12 + x * 12, 14 + r * 48, 8, 34); } } });
      const fm = std({ map: fridge, emissiveMap: fridge, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.2 }); fm.userData.base = 0.25; fm.userData.night = 0.6; glow.push(fm);
      const fr = add(new THREE.Mesh(new THREE.PlaneGeometry(su1 - su0 - 4, 2.2), fm), (su0 + su1) / 2, G0 + 1.1, sv1 - 0.42); fr.rotation.y = Math.PI;
      box(su0 + 1.2, sv0 + 1.5, su0 + 7, sv0 + 2.4, G0, G0 + 1.05, M.cladD); box(su0 + 1.2, sv0 + 1.5, su0 + 7, sv0 + 2.4, G0 + 1.05, G0 + 1.1, M.chrome);
      // forecourt furniture: ATM, ice chest, air/water, bins
      box(su1 - 3, sv0 - 0.4, su1 - 2, sv0 + 0.25, G0, G0 + 2.0, M.blue, true, 0.05); panel(textTex('atm', 128, 256, (g, w, h) => { g.fillStyle = '#0c2340'; g.fillRect(0, 0, w, h); g.fillStyle = '#5fb8ff'; g.fillRect(14, 30, 100, 70); g.fillStyle = '#fff'; g.font = '800 26px Inter'; g.textAlign = 'center'; g.fillText('ATM', 64, 140); }), su1 - 2.5, sv0 - 0.41, G0 + 1.3, 0.8, 1.2, Math.PI, 0.6);
      box(su0 + 1, sv0 - 0.9, su0 + 3, sv0 - 0.1, G0, G0 + 1.1, M.white, true, 0.06); panel(textTex('ice', 256, 96, (g, w, h) => { g.fillStyle = '#1d6fd8'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 54px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BUZ ❄', w / 2, h / 2); }), su0 + 2, sv0 - 0.91, G0 + 0.8, 1.6, 0.6, Math.PI, 0.3);
      box(9, 40, 10, 41, G0, G0 + 1.5, M.red, true, 0.08); panel(textTex('air', 256, 128, (g, w, h) => { g.fillStyle = '#c0262c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 46px Inter'; g.textAlign = 'center'; g.fillText('HAVA', w / 2, 56); g.font = '700 34px Inter'; g.fillText('SU', w / 2, 104); }), 9.5, 39.99, G0 + 1.1, 0.8, 0.45, Math.PI, 0.2);
      for (const u of [30, 43, 56]) cyl(0.25, 0.22, 0.85, M.cladD, u + 1.6, G0 + 0.42, cv0 + 2.4, 14);
      // AC units on the roof
      for (const u of [52, 60, 68]) box(u, 60, u + 2.2, 62.2, sh + 0.25, sh + 1.2, M.steel);
      // ---------- price totem ----------
      const tot = textTex('totem', 384, 768, (g, w, h) => { g.fillStyle = '#121418'; g.fillRect(0, 0, w, h); g.fillStyle = '#17924a'; g.fillRect(0, 0, w, 230); logo(g, w / 2, 100, 70); g.fillStyle = '#fff'; g.font = '900 52px Inter'; g.textAlign = 'center'; g.fillText('TP PETROL', w / 2, 210);
        const rows = [['K.SUZ 95', '46,90', '#7dff9e'], ['MOTORİN', '48,10', '#ffd25a'], ['LPG', '23,60', '#9fd3ff'], ['⚡ DC', '9,50', '#5fb8ff']];
        rows.forEach(([n, p, c], k) => { const y = 300 + k * 118; g.fillStyle = '#1d2026'; g.fillRect(20, y - 50, w - 40, 96); g.fillStyle = '#e5e7eb'; g.font = '800 34px Inter'; g.textAlign = 'left'; g.fillText(n, 36, y + 12); g.fillStyle = c; g.font = '700 58px monospace'; g.textAlign = 'right'; g.fillText(p, w - 34, y + 18); }); });
      box(73.6, 3.2, 77.4, 4.0, G0, G0 + 0.9, M.concrete, true); box(73.9, 3.3, 77.1, 3.9, G0 + 0.9, G0 + 7.6, M.cladD);
      panel(tot, 75.5, 3.28, G0 + 4.4, 3.0, 6.0, Math.PI, 1);
      { const bk = add(new THREE.Mesh(new THREE.PlaneGeometry(3.0, 6.0), M.cladD), 75.5, G0 + 4.4, 3.92); }
      // perimeter planters with shrubs to frame the lot
      for (const [u0, v0, u1, v1] of [[0.6, 62, 40, 63.4], [0.6, 63.4, 2, 83.4]]) { box(u0, v0, u1, v1, G0, G0 + 0.45, M.concrete, true); for (let u = u0 + 0.8; u < u1 - 0.4; u += 1.6) for (let v = v0 + 0.7; v < v1 - 0.3; v += 1.6) { const s = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), std({ color: 0x3f7a35, roughness: 0.9, flatShading: true })), u, G0 + 0.85, v); s.scale.y = 0.8; s.castShadow = true; } }
      list.push({ kind: 'fuel', name: d.name, x: X + 35.5, y: Y + 25, rect: [X + cu0, Y + cv0, X + cu1, Y + cv1] });
      list.push({ kind: 'charge', name: d.name + ' Şarj', x: X + 17.5, y: Y + 53.5, rect: [X + 5, Y + 50, X + 32, Y + 58] });
    } else {
      // ---------- repair garage: three bays with roller shutters, office, tool walls ----------
      const u0 = 10, u1 = 74, v0 = 36, v1 = 68, h = 6.6, ou = 58;   // office from ou..u1
      wall(u0, v1 - 0.5, u1, v1, G0, h, M.brick); wall(u0, v0, u0 + 0.5, v1, G0, h, M.brick); wall(u1 - 0.5, v0, u1, v1, G0, h, M.brick);
      wall(ou, v0, ou + 0.4, v1, G0, h, M.cladW);                                                 // office partition
      box(u0 - 0.3, v0 - 0.6, u1 + 0.3, v1 + 0.3, h, h + 0.35, M.cladD);                       // roof
      // front fascia with lightbox sign
      wall(u0 - 0.3, v0 - 0.6, u1 + 0.3, v0 + 0.1, h - 1.6, h + 0.35, M.cladD, false, 6);
      const gSign = textTex('garage' + d.name, 4096, 205, (g, w, h2) => { const gr = g.createLinearGradient(0, 0, 0, h2); gr.addColorStop(0, '#e2353b'); gr.addColorStop(1, '#a8181d'); g.fillStyle = gr; g.fillRect(0, 0, w, h2);
        g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = '900 120px Inter,Arial'; const t1 = '🔧 ' + d.name.toLocaleUpperCase('tr-TR'); const w1 = g.measureText(t1).width; g.fillText(t1, 60, 100);
        const t2 = 'MEKANİK · KAPORTA · BOYA · LASTİK'; let fs = 72; g.font = `700 ${fs}px Inter,Arial`; const room = w - 60 - (60 + w1 + 80); const w2 = g.measureText(t2).width; if (w2 > room) { fs = Math.floor(fs * room / w2); g.font = `700 ${fs}px Inter,Arial`; }
        g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(60 + w1 + 38, 45, 5, 115); g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(t2, w - 60, 105); });
      panel(gSign, (u0 + u1) / 2, v0 - 0.62, h - 0.62, 26, 1.3, Math.PI, 1);
      // bay piers and raised shutters (rolled into their boxes)
      const bays = [[u0 + 0.5, 26], [26, 42], [42, ou]];
      for (const [a, c] of bays) { box(c - 0.5, v0, c + 0.5, v0 + 0.8, G0, h - 1.6, M.brick.clone(), true);
        box(a + 0.5, v0 + 0.05, c - 0.5, v0 + 0.75, h - 2.3, h - 1.6, M.cladD);                       // shutter roll box
        box(a + 0.6, v0 + 0.3, c - 0.6, v0 + 0.4, h - 2.6, h - 2.3, M.shutter);                        // bottom rail of the raised shutter
        for (const gu of [a + 0.55, c - 0.55]) box(gu - 0.06, v0 + 0.2, gu + 0.06, v0 + 0.5, G0, h - 2.3, M.steel); }   // guide rails
      // ceiling: white panels with a grid, and the roof structure
      const ceilTex = canvasTex('ceil', 256, 256, (g, w, h2) => { g.fillStyle = '#e6e7e9'; g.fillRect(0, 0, w, h2); g.fillStyle = '#b9bcc1'; g.fillRect(0, 0, w, 4); g.fillRect(0, 0, 4, h2); noise(g, w, h2, 1200, 0.05); }, true);
      { const cm = std({ map: ceilTex.clone(), roughness: 0.9 }); cm.map.repeat.set((ou - u0) / 2.5, (v1 - v0) / 2.5); cm.map.needsUpdate = true;
        const ce = add(new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0, v1 - v0), cm), (u0 + u1) / 2, h - 0.06, (v0 + v1) / 2); ce.rotation.x = Math.PI / 2; }
      for (let u = u0 + 8; u < u1; u += 8) box(u - 0.15, v0 + 0.5, u + 0.15, v1 - 0.5, h - 0.5, h - 0.06, M.frame);
      // office: glazed front, door, reception
      box(ou + 0.4, v0 + 0.3, u1 - 0.5, v0 + 0.36, G0 + 0.9, h - 1.8, M.glass).renderOrder = 2;
      box(ou + 0.4, v0 + 0.25, u1 - 0.5, v0 + 0.4, G0, G0 + 0.9, M.cladW, true);
      for (let u = ou + 0.4; u <= u1 - 0.5 + 1e-6; u += 3.9) box(u - 0.05, v0 + 0.25, u + 0.05, v0 + 0.4, G0 + 0.9, h - 1.8, M.frame);
      const offC = add(new THREE.Mesh(new THREE.PlaneGeometry(u1 - ou - 1, v1 - v0 - 1), M.lightP), (ou + u1) / 2, h - 0.05, (v0 + v1) / 2); offC.rotation.x = Math.PI / 2;
      box(ou + 2, v0 + 4, ou + 9, v0 + 5, G0, G0 + 1.1, M.cladD); box(ou + 11, v0 + 8, ou + 14, v0 + 10, G0, G0 + 0.8, M.dark);
      // floor: polished concrete with yellow bay lines, oil stains, entrance text
      const fl = add(new THREE.Mesh(new THREE.PlaneGeometry(ou - u0 - 0.5, v1 - v0 - 0.5), M.concrete.clone()), (u0 + ou) / 2, G0 + 0.006, (v0 + v1) / 2); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true;
      fl.material.map = M.concrete.map.clone(); fl.material.map.repeat.set(6, 4); fl.material.map.needsUpdate = true;
      const entry = textTex('entry', 1024, 160, (g, w, h2) => { g.fillStyle = '#f2c200'; g.font = '900 120px Inter,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SERVİS GİRİŞİ', w / 2, h2 / 2); });
      floorDecal(entry, (u0 + ou) / 2, v0 - 4, 14, 2.2, Math.PI);
      for (const [a, c] of bays) { const uc = (a + c) / 2;
        line(a + 1.2, v0 + 1, a + 1.35, v1 - 2, M.paintY); line(c - 1.35, v0 + 1, c - 1.2, v1 - 2, M.paintY);
        floorDecal(stainTex, uc + (rnd() - 0.5) * 2, 52 + (rnd() - 0.5) * 3, 3.5, 3.5, rnd() * 6);
        // two-post lift: columns, carriages, swing arms
        for (const s of [-1, 1]) { const pu = uc + s * 3.4; box(pu - 0.28, 50.5, pu + 0.28, 51.3, G0, h - 1.2, M.yellow, false, 0.04); box(pu - 0.34, 50.4, pu + 0.34, 51.4, G0, G0 + 0.12, M.dark);
          box(pu - 0.18, 51.3, pu + 0.18, 51.6, G0 + 0.45, G0 + 0.9, M.dark);
          for (const dv of [-1, 1]) { const vv = 50.9 + dv * 0.25; box(Math.min(pu, pu - s * 1.9), vv - 0.07, Math.max(pu, pu - s * 1.9), vv + 0.07, G0 + 0.5, G0 + 0.6, M.steel);
            cyl(0.13, 0.13, 0.08, M.rubber, pu - s * 1.85, G0 + 0.64, vv, 12); }
          b.circles && b.circles.push([X + pu, Y + 50.9, 0.45]); }
        box(uc - 3.4, 50.75, uc + 3.4, 51.05, h - 1.35, h - 1.15, M.yellow);   // overhead beam
        const lamp = add(new THREE.Mesh(new THREE.PlaneGeometry(5, 0.35), M.lightP), uc, h - 0.04, 48); lamp.rotation.x = Math.PI / 2;
        const lamp2 = add(new THREE.Mesh(new THREE.PlaneGeometry(5, 0.35), M.lightP), uc, h - 0.04, 58); lamp2.rotation.x = Math.PI / 2; }
      for (const [a, c] of bays) pool((a + c) / 2, 52, 15, 30, 0xf4f8ff, 0.4); pool((ou + u1) / 2, 52, 15, 30, 0xfff2dc, 0.3); pool(34, 30, 40, 10, 0xffffff, 0.18);
      // back wall: pegboards, workbench, tool chests, tyre rack, compressor, oil drums
      const pg = add(new THREE.Mesh(new THREE.PlaneGeometry(ou - u0 - 3, 2.0), M.peg), (u0 + ou) / 2, G0 + 2.6, v1 - 0.52); pg.rotation.y = Math.PI;
      box(u0 + 2, v1 - 1.5, u0 + 14, v1 - 0.5, G0 + 0.9, G0 + 1.0, M.steel); box(u0 + 2.1, v1 - 1.45, u0 + 13.9, v1 - 0.55, G0, G0 + 0.9, M.cladD);
      for (let k = 0; k < 4; k++) { const u = u0 + 16 + k * 1.25; box(u, v1 - 1.3, u + 1.1, v1 - 0.55, G0, G0 + 1.25, M.red, false, 0.04);
        for (let r = 0; r < 5; r++) box(u + 0.05, v1 - 1.31, u + 1.05, v1 - 1.3, G0 + 0.15 + r * 0.22, G0 + 0.3 + r * 0.22, M.chrome); }
      box(u0 + 0.6, 40, u0 + 1.4, 48, G0, G0 + 2.6, M.frame); for (let k = 0; k < 10; k++) { const t = add(new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.12, 8, 18), M.rubber), u0 + 1.0, G0 + 0.45 + (k % 2) * 1.2, 40.6 + Math.floor(k / 2) * 1.5); t.rotation.y = Math.PI / 2; }
      cyl(0.32, 0.32, 1.2, M.red, u0 + 1.2, G0 + 0.6, 62.5, 18); box(u0 + 0.8, 61.8, u0 + 1.6, 63.2, G0 + 1.2, G0 + 1.5, M.dark);
      for (let k = 0; k < 3; k++) { cyl(0.3, 0.3, 0.9, [M.blue, M.green, M.dark][k], ou - 1.5 - k * 0.7, G0 + 0.45, v1 - 1.2, 16); }
      // exterior apron
      floorDecal(stainTex, 30, 30, 4, 4, 1); floorDecal(stainTex, 48, 27, 3, 3, 2);
      for (const u of [u0 + 0.5, 26, 42, ou]) { bollard(u, v0 - 1.2); }
      list.push({ kind: 'repair', name: d.name, x: X + 34, y: Y + 46, rect: [X + u0 + 1, Y + v0 - 4, X + ou, Y + v1 - 1] });
    }
  }
  function setNight(f) { for (const m of pools) m.opacity = m.userData.k * f; for (const m of glow) { const n = m.userData.night ?? m.userData.base * 4; m.emissiveIntensity = m.userData.base + (n - m.userData.base) * f; } }
  return { group, list, setNight };
}
export const SERVICE_STYLE = { fuel: { color: '#22c55e', icon: '⛽', label: 'Benzinlik' }, charge: { color: '#3b82f6', icon: '⚡', label: 'Şarj' }, repair: { color: '#ef4444', icon: '🔧', label: 'Tamirci' },
  drift: { color: '#f59e0b', icon: '🏁', label: 'Drift alanı · otopark' }, summit: { color: '#8b5cf6', icon: '⛰️', label: 'Dağ yolu zirvesi' }, mountain: { color: '#65a30d', icon: '🌲', label: 'Dağ yolu' },
  beach: { color: '#0ea5e9', icon: '🏖️', label: 'Sahil yolu' }, highway: { color: '#eab308', icon: '🛣️', label: 'Otoyol' } };
