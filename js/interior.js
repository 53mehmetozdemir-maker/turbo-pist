// Procedural car cabin kit: sculpted dashboard, binnacle, touchscreen, vents, centre console,
// bolstered seats, door cards, steering wheel, pedals, visors and rear bench.
// Car frame: +X forward, +Y up, +Z right. Everything is sized from a few measurements of the real car.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const rb = (w, h, d, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

let _tex = {};
function quiltTex(base, line) { const k = base + line; if (_tex[k]) return _tex[k]; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128); g.strokeStyle = line; g.lineWidth = 2; g.setLineDash([5, 3]);
  for (let y = 16; y < 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  g.setLineDash([]); g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 4; y < 128; y += 8) for (let x = (y / 8 % 2) * 4 + 2; x < 128; x += 8) g.fillRect(x, y, 1.5, 1.5);   // perforation
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_tex[k] = t); }
function grainTex() { if (_tex.grain) return _tex.grain; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = 200 + Math.random() * 55; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return (_tex.grain = t); }
export function navTex() { if (_tex.nav) return _tex.nav; const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#10161f'; g.fillRect(0, 0, 512, 320); g.fillStyle = '#16212e'; for (let i = 0; i < 14; i++) g.fillRect((i * 97) % 480, (i * 61) % 300, 40 + (i * 13) % 50, 30 + (i * 7) % 40);
  g.strokeStyle = '#2c3a4c'; g.lineWidth = 7; for (const [a, b, c2, d] of [[0, 90, 512, 120], [0, 230, 512, 200], [140, 0, 170, 320], [360, 0, 330, 320], [0, 20, 300, 320]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); }
  g.strokeStyle = '#3b9bff'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(256, 300); g.lineTo(250, 214); g.lineTo(336, 204); g.lineTo(346, 40); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(256, 262); g.lineTo(242, 292); g.lineTo(256, 284); g.lineTo(270, 292); g.closePath(); g.fill();
  g.fillStyle = 'rgba(8,12,18,.88)'; g.fillRect(0, 0, 512, 44); g.fillStyle = '#e8eef6'; g.font = '600 22px Inter,sans-serif'; g.fillText('↱ 350 m  Çınar Cd.', 14, 30); g.textAlign = 'right'; g.fillText('22°C', 498, 30);
  g.fillStyle = 'rgba(8,12,18,.88)'; g.fillRect(0, 276, 512, 44); g.textAlign = 'left'; g.fillStyle = '#9fb3c8'; g.font = '500 18px Inter,sans-serif'; g.fillText('♪  Radyo · 98.4', 14, 304); g.textAlign = 'right'; g.fillText('🌡 21.5   ❄ A/C', 498, 304);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_tex.nav = t); }

/* opt: { xDash, xFace, yTop, yFloor, halfW, zDrv, seatX, seatY, back, roofY, xVisor, doorZ, xDoorF, xDoorR, rear:{x,y,w}|null,
          col:{dash,low,seat,ins,stitch,trim,amb}, trimKind:'alu'|'black'|'wood', screen:{c,w,h,tilt}|null, cluster:{c,w,h}|null,
          sw:{c,n,r,flat}, console:true, shifter:'dsg'|'none'|'stick', doors:true } */
export function buildCabin(o) {
  const G = new THREE.Group();
  const col = Object.assign({ dash: 0x1f2023, low: 0x141517, seat: 0x1b1c1f, ins: '#2a2b2f', stitch: '#5b5d63', trim: 0x9ea3a9, amb: 0x5aa8ff }, o.col || {});
  const dashM = new THREE.MeshStandardMaterial({ color: col.dash, roughness: 0.78, roughnessMap: grainTex() });
  const lowM = new THREE.MeshStandardMaterial({ color: col.low, roughness: 0.85 });
  const seatM = new THREE.MeshStandardMaterial({ color: col.seat, roughness: 0.55 });
  const insM = new THREE.MeshStandardMaterial({ map: quiltTex(col.ins, col.stitch), roughness: 0.7 });
  const carbonTex = () => { if (_tex.carbon) return _tex.carbon; const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const gr = g.createLinearGradient(x * 8, y * 8, x * 8 + 8, y * 8 + 8); const a = (x + y) % 2 ? ['#2a2c30', '#121315'] : ['#121315', '#2a2c30']; gr.addColorStop(0, a[0]); gr.addColorStop(1, a[1]); g.fillStyle = gr; g.fillRect(x * 8, y * 8, 8, 8); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 1.5); t.colorSpace = THREE.SRGBColorSpace; return (_tex.carbon = t); };
  const trimM = o.trimKind === 'carbon' ? new THREE.MeshPhysicalMaterial({ map: carbonTex(), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }) : o.trimKind === 'wood' ? new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.35 }) : o.trimKind === 'black' ? new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.08, clearcoat: 1 }) : new THREE.MeshStandardMaterial({ color: col.trim, roughness: 0.32, metalness: 0.85 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.06, clearcoat: 1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.2, metalness: 1 });
  const ambM = new THREE.MeshBasicMaterial({ color: col.amb, toneMapped: false });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.9 });
  // a cabin sits in the shade of its roof: keep the sky/environment light on these surfaces low so they stay dark and natural
  const shade = m => { if (m && 'envMapIntensity' in m && !m.isMeshBasicMaterial) m.envMapIntensity = Math.min(m.envMapIntensity ?? 1, m.metalness > 0.5 ? 0.35 : 0.12); return m; };
  const add = (g, m, p = G) => { const o2 = new THREE.Mesh(g, shade(m)); o2.receiveShadow = true; p.add(o2); return o2; };
  const { xDash, xFace, yTop, yFloor, halfW } = o;

  // ---- dashboard: one sculpted profile swept across the cabin ----
  const pr = new THREE.Shape(); pr.moveTo(xDash, yTop - 0.04); pr.quadraticCurveTo((xDash + xFace) / 2, yTop + 0.012, xFace + 0.03, yTop);
  pr.quadraticCurveTo(xFace - 0.01, yTop - 0.01, xFace, yTop - 0.06); pr.quadraticCurveTo(xFace + 0.01, yTop - 0.2, xFace + 0.1, yTop - 0.3);
  pr.lineTo(xFace + 0.2, yFloor + 0.2); pr.lineTo(xDash + 0.05, yFloor + 0.2); pr.lineTo(xDash, yTop - 0.12); pr.closePath();
  const dg = new THREE.ExtrudeGeometry(pr, { depth: halfW * 2, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 3, curveSegments: 10 }); dg.translate(0, 0, -halfW);
  add(dg, dashM);
  const faceX = y => { const t = (yTop - 0.06 - y) / 0.24; return xFace + 0.035 * Math.max(0, Math.min(1, t)) - 0.016; };   // approx face position below the lip
  // decor strip + ambient light line across the face (gap behind the wheel)
  const yS = yTop - 0.115; const zCl = o.zDrv;
  const TS = o.style === 'tesla';
  const strips = TS ? [[-halfW + 0.02, halfW - 0.02]] : [[-halfW + 0.04, zCl - 0.2], [zCl + 0.2, halfW - 0.04]];
  for (const [z0, z1] of strips) { if (z1 <= z0) continue;
    add(new THREE.BoxGeometry(0.012, TS ? 0.05 : 0.035, z1 - z0).translate(faceX(yS) - 0.004, yS, (z0 + z1) / 2), trimM);
    add(new THREE.BoxGeometry(0.004, 0.004, z1 - z0).translate(faceX(yS - 0.03) - 0.006, yS - 0.028, (z0 + z1) / 2), ambM); }
  // air vents (louvred)
  const vent = (z, w) => { const yv = yTop - 0.085; const x = faceX(yv) - 0.008; add(rb(0.02, 0.07, w, 0.012).translate(x, yv, z), gloss);
    for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.012, 0.005, w - 0.02).translate(x - 0.006, yv - 0.024 + k * 0.016, z), lowM);
    add(new THREE.BoxGeometry(0.01, 0.06, 0.006).translate(x - 0.012, yv, z), chrome); };
  if (TS) { // Tesla: one hidden full-width vent slot just above the decor band, no visible louvres
    const yv = yS + 0.042; add(new THREE.BoxGeometry(0.02, 0.012, halfW * 2 - 0.06).translate(faceX(yv) - 0.002, yv, 0), new THREE.MeshBasicMaterial({ color: 0x020203 }));
    add(new THREE.BoxGeometry(0.014, 0.003, halfW * 2 - 0.08).translate(faceX(yv) - 0.006, yv - 0.003, 0), lowM); }
  else { vent(-0.12, 0.13); vent(0.12, 0.13); vent(-halfW + 0.13, 0.12); vent(halfW - 0.13, 0.12); }
  // glovebox seam & passenger knee pad
  add(new THREE.BoxGeometry(0.004, 0.004, 0.4).translate(xFace + 0.075, yTop - 0.255, -o.zDrv), lowM);
  // ---- instrument binnacle ----
  if (o.cluster) { const [cx, cy, cz] = o.cluster.c, w = o.cluster.w, h = o.cluster.h;
    const hood = new THREE.CylinderGeometry(0.06, 0.06, w + 0.06, 20, 1, true, 0, Math.PI); hood.rotateX(Math.PI / 2); hood.rotateZ(Math.PI / 2); hood.scale(1.1, 0.75, 1); hood.translate(cx + 0.02, cy + h / 2 - 0.01, cz);
    add(hood, dashM).material = new THREE.MeshStandardMaterial({ color: col.dash, roughness: 0.8, side: THREE.DoubleSide });
    add(rb(0.025, h + 0.02, w + 0.03, 0.01).translate(cx + 0.016, cy, cz), gloss); }
  // ---- centre touchscreen ----
  if (o.screen) { const [sx, sy, sz] = o.screen.c, w = o.screen.w, h = o.screen.h; const S = new THREE.Group(); S.position.set(sx, sy, sz); S.rotation.z = o.screen.tilt || 0; G.add(S);
    add(rb(0.022, h + 0.02, w + 0.02, 0.008), gloss, S); const scr = add(new THREE.PlaneGeometry(w, h).rotateY(-Math.PI / 2).translate(-0.0115, 0, 0), new THREE.MeshBasicMaterial({ map: navTex(), toneMapped: false }), S); scr.material.color.setScalar(0.85);
    if (o.screen.stand) add(rb(0.05, 0.08, 0.06, 0.01).translate(0.03, -h / 2 - 0.02, 0), lowM, S);
    // climate strip under the screen
    if (!TS) for (let k = -2; k <= 2; k++) add(rb(0.014, 0.018, 0.035, 0.006).translate(0.01, -h / 2 - 0.035, k * 0.045), gloss, S); }
  // ---- centre console ----
  if (o.console !== false) { const cw = 0.24, top = yFloor + 0.32, arm = yFloor + 0.44; const xA = o.seatX + 0.05, xB = o.seatX - 0.32;
    const cp = new THREE.Shape(); cp.moveTo(xFace + 0.12, yTop - 0.28); cp.quadraticCurveTo(xFace - 0.05, top + 0.02, xFace - 0.2, top); cp.lineTo(xA, top); cp.quadraticCurveTo(xA - 0.01, arm, xA - 0.04, arm); cp.lineTo(xB, arm); cp.lineTo(xB, yFloor); cp.lineTo(xFace + 0.12, yFloor); cp.closePath();
    const cg = new THREE.ExtrudeGeometry(cp, { depth: cw, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 8 }); cg.translate(0, 0, -cw / 2); add(cg, lowM);
    add(rb(xA - xB - 0.02, 0.05, cw + 0.02, 0.02).translate((xA + xB) / 2 - 0.02, arm + 0.02, 0), seatM);   // padded armrest lid
    add(new THREE.BoxGeometry(xA - (xFace - 0.2) - 0.04, 0.006, cw - 0.04).translate((xA + xFace - 0.2) / 2, top + 0.015, 0), trimM);   // trim panel
    for (const dz of [-0.055, 0.055]) add(new THREE.CylinderGeometry(0.038, 0.038, 0.004, 20).translate(xA - 0.09, top + 0.02, dz), rubber);   // cupholders
    if (TS) { add(new THREE.BoxGeometry(xA - (xFace - 0.2), 0.008, cw - 0.02).translate((xA + xFace - 0.2) / 2, top + 0.018, 0), new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.18, metalness: 0.2 })); for (const dz of [-0.05, 0.05]) add(rb(0.15, 0.006, 0.075, 0.004).translate(xFace - 0.26, top + 0.024, dz), rubber); }
    else add(rb(0.12, 0.006, 0.16, 0.003).translate(xFace - 0.27, top + 0.02, 0), rubber);   // phone pad
    if (o.shifter === 'dsg') { add(rb(0.06, 0.03, 0.05, 0.01).translate(xA - 0.21, top + 0.03, 0), gloss); add(rb(0.04, 0.03, 0.025, 0.01).translate(xA - 0.21, top + 0.055, 0), chrome); }
    else if (o.shifter === 'stick') { add(new THREE.CylinderGeometry(0.008, 0.01, 0.12, 8).translate(xA - 0.2, top + 0.07, 0), chrome); add(new THREE.SphereGeometry(0.025, 14, 10).translate(xA - 0.2, top + 0.13, 0), gloss); }
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 20).translate(xA - 0.33 < xFace - 0.2 ? xA - 0.15 : xA - 0.33, top + 0.02, 0.07), chrome);   // drive-mode dial
  }
  // ---- seats ----
  const seat = (x, z, w = 0.5) => { const S = new THREE.Group(); S.position.set(x, o.seatY, z); G.add(S);
    add(rb(0.38, 0.1, w - 0.1, 0.03).translate(0, -0.05, 0), seatM, S);
    const ins = add(rb(0.34, 0.012, w - 0.22, 0.004).translate(0, 0.0, 0), insM, S);
    for (const s of [-1, 1]) { const b = rb(0.4, 0.11, 0.075, 0.035); b.rotateX(s * 0.25); b.translate(0, -0.01, s * (w / 2 - 0.05)); add(b, seatM, S); }
    add(rb(0.42, 0.14, w - 0.04, 0.02).translate(-0.01, -0.15, 0), lowM, S);   // base
    const B = new THREE.Group(); B.position.set(-0.2, -0.02, 0); B.rotation.z = o.back || 0.26; S.add(B);
    add(rb(0.09, 0.6, w - 0.08, 0.035).translate(-0.03, 0.31, 0), seatM, B);
    add(rb(0.012, 0.48, w - 0.2, 0.004).translate(0.017, 0.3, 0), insM, B);
    for (const s of [-1, 1]) { const b = rb(0.1, 0.5, 0.085, 0.04); b.rotateY(s * 0.35); b.translate(0.005, 0.28, s * (w / 2 - 0.055)); add(b, seatM, B); }
    add(rb(0.08, 0.17, 0.26, 0.04).translate(-0.02, 0.72, 0), seatM, B);
    for (const dz of [-0.07, 0.07]) add(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 8).translate(-0.03, 0.62, dz), chrome, B);
    return S; };
  seat(o.seatX, o.zDrv); seat(o.seatX, -o.zDrv);
  if (o.rear) { const { x, y, w } = o.rear; const R = new THREE.Group(); R.position.set(x, y, 0); G.add(R);
    add(rb(0.45, 0.12, w, 0.04).translate(0, -0.06, 0), seatM, R); add(rb(0.4, 0.012, w - 0.16, 0.004).translate(0, 0.002, 0), insM, R);
    const B = new THREE.Group(); B.position.set(-0.24, 0, 0); B.rotation.z = 0.22; R.add(B); add(rb(0.1, 0.58, w, 0.04).translate(0, 0.3, 0), seatM, B);
    for (const dz of [-w / 3, 0, w / 3]) add(rb(0.07, 0.13, 0.22, 0.03).translate(0, 0.66, dz), seatM, B);
    add(rb(0.25, 0.012, 0.06, 0.004).translate(0, 0.0, -w / 2 + 0.2), chrome, R); }
  // ---- door cards ----
  if (o.doors !== false) for (const s of [-1, 1]) { const z = s * o.doorZ, L = o.xDoorF - o.xDoorR, xm = (o.xDoorF + o.xDoorR) / 2; const yB = yTop - 0.02, h = yB - (yFloor + 0.1);
    add(rb(L, h, 0.04, 0.02).translate(xm, yFloor + 0.1 + h / 2, z), lowM);
    add(rb(L - 0.06, 0.12, 0.03, 0.015).translate(xm, yB - 0.08, z - s * 0.02), dashM);                    // upper soft pad
    add(new THREE.BoxGeometry(L - 0.1, TS ? 0.045 : 0.012, 0.012).translate(xm, yB - 0.15, z - s * 0.036), trimM);       // decor strip
    add(new THREE.BoxGeometry(L - 0.12, 0.004, 0.004).translate(xm, yB - 0.165, z - s * 0.04), ambM);       // ambient line
    add(rb(0.34, 0.05, 0.09, 0.02).translate(xm - 0.08, yB - 0.25, z - s * 0.05), seatM);                   // armrest
    add(rb(0.09, 0.025, 0.02, 0.008).translate(o.xDoorF - 0.2, yB - 0.13, z - s * 0.04), chrome);           // opener
    add(rb(L - 0.25, 0.1, 0.05, 0.02).translate(xm, yFloor + 0.2, z - s * 0.035), rubber);                  // pocket
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.006, 24).rotateX(Math.PI / 2).translate(o.xDoorF - 0.18, yFloor + 0.3, z - s * 0.022), rubber);   // speaker
    for (let k = 0; k < 2; k++) add(rb(0.03, 0.006, 0.02, 0.003).translate(xm - 0.14 + k * 0.045, yB - 0.22, z - s * 0.095), gloss); }   // window switches
  // ---- steering wheel (wheel pivots about its column) ----
  const swc = new THREE.Vector3(...o.sw.c), swn = new THREE.Vector3(...o.sw.n).normalize(), R0 = o.sw.r || 0.185;
  const swG = new THREE.Group(); swG.position.copy(swc); G.add(swG); const inner = new THREE.Group(); swG.add(inner); swG.userData.inner = inner;
  const orient = new THREE.Group(); orient.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), swn); inner.add(orient);
  const wheelM = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.5 });
  if (o.sw.flat) { const pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; let x = Math.cos(a) * R0, y = Math.sin(a) * R0; if (y < -R0 * 0.78) y = -R0 * 0.78; pts.push(new THREE.Vector3(x, y, 0)); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.018, 10, true), wheelM, orient); }
  else add(new THREE.TorusGeometry(R0, 0.018, 12, 56), wheelM, orient);
  add(new THREE.TorusGeometry(R0, 0.0195, 6, 24, 0.9).rotateZ(Math.PI * 0.5 - 0.45), wheelM, orient);   // thicker grip at top
  const hub = rb(0.13, 0.1, 0.05, 0.02); hub.translate(0, -0.01, 0.01); add(hub, wheelM, orient);
  if (TS) for (const sx of [-1, 1]) { const sc = new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16); sc.rotateZ(Math.PI / 2); sc.translate(sx * 0.1, 0.0, 0.022); add(sc, chrome, orient); }
  for (const [a, len] of (TS ? [[0, R0 - 0.06], [Math.PI, R0 - 0.06]] : [[0, R0 - 0.06], [Math.PI, R0 - 0.06], [-Math.PI / 2, R0 - 0.05]])) { const sp = rb(len, 0.045, 0.02, 0.008); sp.translate(0.06 + len / 2 - 0.02, 0, 0); sp.rotateZ(a); add(sp, wheelM, orient);
    if (a !== -Math.PI / 2) for (let k = 0; k < 3; k++) { const bt = rb(0.016, 0.012, 0.006, 0.003); bt.translate(0.085 + k * 0.02, 0.008, 0.012); bt.rotateZ(a); add(bt, gloss, orient); } }
  add(new THREE.BoxGeometry(0.03, 0.004, 0.004).translate(0, -0.035, 0.037), chrome, orient);
  const col0 = new THREE.CylinderGeometry(0.045, 0.06, 0.22, 16); col0.rotateX(Math.PI / 2); col0.translate(0, 0, -0.13); const cm = new THREE.Mesh(col0, lowM); cm.quaternion.copy(orient.quaternion); swG.add(cm);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(rb(0.05, 0.012, 0.012, 0.004).translate(s * 0.075, 0, 0), lowM); st.quaternion.copy(orient.quaternion); st.position.copy(swn.clone().multiplyScalar(-0.07)); swG.add(st); }   // stalks
  // ---- pedals, floor, visors, roof console ----
  add(new THREE.BoxGeometry(0.03, 0.08, 0.1).rotateZ(-0.5).translate(xFace + 0.26, yFloor + 0.13, o.zDrv + 0.05), rubber);
  add(new THREE.BoxGeometry(0.03, 0.12, 0.05).rotateZ(-0.4).translate(xFace + 0.27, yFloor + 0.15, o.zDrv + 0.17), rubber);
  add(new THREE.BoxGeometry(xFace - (o.rear ? o.rear.x - 0.4 : o.seatX - 0.5), 0.012, halfW * 2).translate((xFace + (o.rear ? o.rear.x - 0.4 : o.seatX - 0.5)) / 2, yFloor + 0.035, 0), rubber);
  if (o.xVisor) { for (const s of [-1, 1]) add(rb(0.2, 0.022, 0.36, 0.01).translate(o.xVisor, o.roofY - 0.04, s * 0.37), new THREE.MeshStandardMaterial({ color: 0x8a8c90, roughness: 0.9 }));
    add(rb(0.16, 0.035, 0.22, 0.015).translate(o.xVisor - 0.05, o.roofY - 0.035, 0), lowM); }
  if (o.shelf) add(new THREE.BoxGeometry(o.shelf.x1 - o.shelf.x0, 0.02, halfW * 2 + 0.1).translate((o.shelf.x0 + o.shelf.x1) / 2, o.shelf.y, 0), lowM);   // parcel shelf
  // tinted glass roof: blocks most of the sun like the real UV/IR-coated glass (shadow caster only, never drawn in colour)
  if (o.tintRoof) { const r = new THREE.Mesh(new THREE.BoxGeometry(o.tintRoof.x1 - o.tintRoof.x0, 0.01, o.tintRoof.w), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    r.position.set((o.tintRoof.x0 + o.tintRoof.x1) / 2, o.tintRoof.y, 0); r.castShadow = true; r.renderOrder = -1; G.add(r); }
  if (o.roofBar) add(rb(0.12, 0.05, o.roofBar.w || halfW * 1.5, 0.02).translate(o.roofBar.x, o.roofBar.y, 0), lowM);   // structural crossbar between the glass roof panels
  for (const pl of o.pillars || []) for (const s of [-1, 1]) add(rb(pl.w, pl.y1 - pl.y0, 0.03, 0.012).translate(pl.x, (pl.y0 + pl.y1) / 2, s * pl.z), lowM);   // pillar trims
  return { group: G, swG, swAxis: swn };
}
