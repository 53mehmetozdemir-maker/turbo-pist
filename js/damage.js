// Visible damage for any vehicle model: dents in the bodywork around the impact point, a cracked windscreen,
// broken head/tail lamps with glass debris. Everything can be fully repaired.
import * as THREE from 'three';

const SKIP = /interior|leather|alcantara|seat|steer|dash|glass|window|brake|caliper|disc|tyre|tire|rubber|wheel|rim|light|lamp|led|emiss|engine|mirror_glass|badge|logo|plate|chassis|under/i;
function deformables(m) {
  if (m.dmg) return m.dmg;
  const list = [], skipRoots = new Set([...(m.wheels || []), ...(m.pivots || []), m.steer, m.interior, m.flames, m.gauge].filter(Boolean));
  m.body.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(m.body.matrixWorld).invert();
  const walk = o => { if (skipRoots.has(o)) return;
    if (o.isMesh && !o.isSprite && o.geometry && o.geometry.attributes.position) { const mt = o.material, nm = (mt && mt.name || '') + ' ' + o.name;
      if (mt && !mt.isMeshBasicMaterial && !mt.isShaderMaterial && !mt.transparent && !(mt.transmission > 0) && !SKIP.test(nm) && o.geometry.attributes.position.count >= 12) {
        const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); list.push({ o, rel, inv: rel.clone().invert(), scale: new THREE.Vector3().setFromMatrixScale(rel) }); } }
    for (const c of o.children) walk(c); };
  for (const c of m.body.children) walk(c);
  return (m.dmg = { list, orig: new Map(), crack: null, crackN: 0 });
}

const _v = new THREE.Vector3(), _inv = new THREE.Matrix4(), _p = new THREE.Vector3();
// lx, lz: impact point in car coordinates (x forward, z right); strength 0..3
export function dentModel(m, lx, lz, strength, halfL = 2.2, halfW = 0.95) {
  if (!m || !m.body) return; const D = deformables(m);
  const R = 0.35 + 0.22 * strength, amt = 0.05 * strength, maxOff = 0.16;
  // push direction: from the impact point towards the middle of the car (mostly horizontal)
  const dir = new THREE.Vector3(-lx / halfL, 0, -lz / halfW); if (dir.lengthSq() < 1e-6) dir.set(-1, 0, 0); dir.normalize();
  const hitY = 0.6;
  const _d = new THREE.Vector3();
  for (const it of D.list) { const o = it.o;
    let g = o.geometry; _p.set(lx, hitY, lz).applyMatrix4(it.inv);
    const sc = (it.scale.x + it.scale.y + it.scale.z) / 3 || 1, Rl = R / sc, amtL = amt / sc, maxL = maxOff / sc;
    _d.copy(dir).transformDirection(it.inv);   // push direction in the mesh's own space
    if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox;
    if (_p.x < bb.min.x - Rl || _p.x > bb.max.x + Rl || _p.y < bb.min.y - Rl * 2 || _p.y > bb.max.y + Rl * 2 || _p.z < bb.min.z - Rl || _p.z > bb.max.z + Rl) continue;
    if (!D.orig.has(o)) { g = o.geometry = g.clone(); D.orig.set(o, new Float32Array(g.attributes.position.array)); }
    const a = o.geometry.attributes.position.array, O = D.orig.get(o); let changed = false; const R2 = Rl * Rl;
    for (let i = 0; i < a.length; i += 3) { const dx = a[i] - _p.x, dy = (a[i + 1] - _p.y) * 0.6, dz = a[i + 2] - _p.z; const d2 = dx * dx + dy * dy + dz * dz; if (d2 > R2) continue;
      const f = 1 - Math.sqrt(d2) / Rl, k = amtL * f * f * (0.75 + 0.5 * Math.abs(Math.sin(O[i] * 37 / sc + O[i + 2] * 53 / sc)));
      a[i] += _d.x * k; a[i + 1] += _d.y * k - k * 0.2; a[i + 2] += _d.z * k;
      const ox = a[i] - O[i], oy = a[i + 1] - O[i + 1], oz = a[i + 2] - O[i + 2], ol = Math.hypot(ox, oy, oz); if (ol > maxL) { const s = maxL / ol; a[i] = O[i] + ox * s; a[i + 1] = O[i + 1] + oy * s; a[i + 2] = O[i + 2] + oz * s; }
      changed = true; }
    if (changed) { o.geometry.attributes.position.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingSphere(); }
  }
}

// windscreen crack: a decal built from the car's own windscreen triangles (so it fits the glass exactly),
// UV-mapped across the screen, with a procedural impact star: radial cracks, concentric rings and fine spider lines
function crackCanvas(n, seed) {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const spots = [[0.30, 0.42], [0.68, 0.55], [0.48, 0.30], [0.80, 0.35]];
  for (let k = 0; k < n; k++) { const cx = spots[k][0] * W + (r() - 0.5) * 60, cy = spots[k][1] * H + (r() - 0.5) * 40, big = 0.7 + r() * 0.6;
    const line = (pts, w, a) => { g.lineWidth = w + 1.2; g.strokeStyle = `rgba(20,24,28,${a * 0.35})`; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      g.lineWidth = w; g.strokeStyle = `rgba(240,246,250,${a})`; g.stroke(); };
    const rays = 16 + Math.floor(r() * 8), ends = [];
    for (let a = 0; a < rays; a++) { let x = cx, y = cy, ang = a / rays * Math.PI * 2 + (r() - 0.5) * 0.35; const L = (90 + r() * 260) * big, pts = [[x, y]];
      for (let t = 0; t < L; t += 9) { ang += (r() - 0.5) * 0.28; x += Math.cos(ang) * 9; y += Math.sin(ang) * 9; pts.push([x, y]);
        if (r() < 0.05) { let bx = x, by = y, ba = ang + (r() < 0.5 ? 1 : -1) * (0.4 + r() * 0.5); const bp = [[bx, by]]; for (let u = 0; u < 40 + r() * 70; u += 8) { ba += (r() - 0.5) * 0.3; bx += Math.cos(ba) * 8; by += Math.sin(ba) * 8; bp.push([bx, by]); } line(bp, 0.8, 0.55); } }
      line(pts, a % 3 ? 1.1 : 1.6, 0.8); ends.push(ang); }
    for (let ring = 1; ring <= 4; ring++) { const rr = ring * (13 + ring * 6) * big; for (let a = 0; a < rays; a++) { if (r() < 0.25) continue; const a0 = a / rays * Math.PI * 2, a1 = (a + 1) / rays * Math.PI * 2, pts = [];
        for (let t = 0; t <= 4; t++) { const an = a0 + (a1 - a0) * t / 4, q = rr * (0.9 + r() * 0.2); pts.push([cx + Math.cos(an) * q, cy + Math.sin(an) * q]); } line(pts, 0.9, 0.6); } }
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 22 * big); gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(0.5, 'rgba(230,236,240,.35)'); gr.addColorStop(1, 'rgba(230,236,240,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 22 * big, 0, 7); g.fill(); }
  return c;
}
function windscreenGeometry(m) {
  const ck = m.cockpit || [0, 1.1, -0.37], inv = new THREE.Matrix4().copy(m.body.matrixWorld).invert(); m.body.updateMatrixWorld(true);
  const P = [], N = []; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  m.body.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const mt = o.material, nm = (mt && mt.name || '') + ' ' + o.name;
    if (!mt || !(/glass|window|windscreen|windshield/i.test(nm) || (mt.transmission > 0) || (mt.transparent && mt.opacity < 0.7 && !mt.isMeshBasicMaterial))) return; if (/lamp|light|head|tail|mirror/i.test(nm)) return;
    const M = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), pos = o.geometry.attributes.position, idx = o.geometry.index, cnt = idx ? idx.count : pos.count;
    for (let i = 0; i < cnt; i += 3) { const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(M); b.fromBufferAttribute(pos, i1).applyMatrix4(M); c.fromBufferAttribute(pos, i2).applyMatrix4(M);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)); if (n.lengthSq() < 1e-12) continue; n.normalize();
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
      if (Math.abs(n.x) < 0.3 || Math.abs(n.z) > 0.75 || cx < ck[0] + 0.05 || cx > ck[0] + 1.8 || cy < ck[1] - 0.5 || cy > ck[1] + 0.45) continue;
      if (n.x < 0) n.negate(); P.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); for (let k = 0; k < 3; k++) N.push(n.x, n.y, n.z); } });
  if (P.length < 27) return null;
  let z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < P.length; i += 3) { z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); }
  const uv = []; for (let i = 0; i < P.length; i += 3) { P[i] += N[i] * 0.004; P[i + 1] += N[i + 1] * 0.004; P[i + 2] += N[i + 2] * 0.004; uv.push((P[i + 2] - z0) / (z1 - z0), (P[i + 1] - y0) / (y1 - y0)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
}
export function crackWindscreen(m, n) {
  if (!m || !m.body || m.bike) return; const D = deformables(m); n = Math.min(4, n); if (n <= D.crackN) return; D.crackN = n;
  if (!D.crack) { const geo = windscreenGeometry(m); if (!geo) return; const tex = new THREE.CanvasTexture(crackCanvas(n, 99)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const pl = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    pl.renderOrder = 4; m.body.add(pl); D.crack = pl; }
  else { D.crack.material.map.image = crackCanvas(n, 99); D.crack.material.map.needsUpdate = true; }
}
export function repairModel(m) {
  if (!m || !m.dmg) return; const D = m.dmg;
  for (const [o, O] of D.orig) { o.geometry.attributes.position.array.set(O); o.geometry.attributes.position.needsUpdate = true; o.geometry.computeVertexNormals(); }
  if (D.crack) { D.crack.parent && D.crack.parent.remove(D.crack); D.crack.material.map.dispose(); D.crack = null; } D.crackN = 0;
  if (m.lamps) for (const k of ['head', 'tail', 'rev']) for (const s of m.lamps[k]) s.userData.broken = false;
  m.lampsBroken = 0;
}
// break the lamp(s) closest to the impact; returns how many broke
export function breakLamps(m, lx, lz) {
  if (!m || !m.lamps) return 0; let n = 0;
  const groups = lx > 0 ? ['head'] : ['tail', 'rev'];
  for (const k of groups) for (const s of m.lamps[k]) { if (s.userData.broken) continue; const dz = Math.abs(s.position.z - lz); if (dz < 0.75 || Math.abs(lz) < 0.3) { s.userData.broken = true; n++; } }
  m.lampsBroken = (m.lampsBroken || 0) + n; return n;
}
