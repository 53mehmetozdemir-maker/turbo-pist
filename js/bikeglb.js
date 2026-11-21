// Imported motorcycle models (GLB) on top of the bike rig: the procedural rider, lean, steering head and wheel spin
// come from bike.js; the bodywork, front end and wheels come from the model file.
import * as THREE from 'three';
import { buildBike } from './bike.js';

// model space -> bike frame (+X forward, +Y up, +Z right, ground y=0); split into body / front end / wheels
export function prepareBike(V, scene) {
  const holder = new THREE.Group(); holder.add(scene); holder.rotation.y = V.front === '-z' ? -Math.PI / 2 : Math.PI / 2; holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder); const s = V.length / (box.max.x - box.min.x);
  const P = { body: [], front: [], fwheel: [], rwheel: [] };
  scene.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.scale(s, s, s); g.translate(0, -box.min.y * s, 0);
    const role = V.parts[o.name] || (o.parent && V.parts[o.parent.name]) || 'body'; P[role].push({ geo: g, mat: o.material }); });
  const bb = list => { const b = new THREE.Box3(); for (const p of list) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); } return b; };
  const fb = bb(P.fwheel), rb = bb(P.rwheel);
  const fc = new THREE.Vector3((fb.min.x + fb.max.x) / 2, (fb.max.y - fb.min.y) / 2, (fb.min.z + fb.max.z) / 2), rc = new THREE.Vector3((rb.min.x + rb.max.x) / 2, (rb.max.y - rb.min.y) / 2, (rb.min.z + rb.max.z) / 2);
  // put the front axle where the rig expects it (A) and centre everything laterally
  const dx = V.axleF - fc.x, dz = -(fc.z + rc.z) / 2; for (const k in P) for (const p of P[k]) p.geo.translate(dx, 0, dz); fc.x += dx; rc.x += dx; fc.z += dz; rc.z += dz;
  return { P, fc, rc };
}
export function buildBikeGLB(V, T, color) {
  const b = buildBike(color, { hideBike: true });
  const mats = new Map(); const glass = new THREE.MeshPhysicalMaterial({ color: 0x2a3036, roughness: 0.03, transparent: true, opacity: 0.35, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0xe8eef4, roughness: 0.02, transparent: true, opacity: 0.18, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const pick = m => { const n = m.name || ''; if (mats.has(n)) return mats.get(n); let r;
    if (V.mats.paint.includes(n)) r = b.paint; else if (V.mats.tail.includes(n)) r = b.brakeMat; else if (V.mats.head.includes(n)) r = b.headMat;
    else if (V.mats.glass.includes(n)) r = glass; else if (V.mats.lens.includes(n)) r = lens;
    else { const t = V.tint[n]; r = new THREE.MeshStandardMaterial({ color: t ? t[0] : m.color, metalness: t ? t[1] : 0.1, roughness: t ? t[2] : 0.55, side: THREE.DoubleSide, envMapIntensity: t && t[1] > 0.5 ? 0.9 : 0.4 }); }
    mats.set(n, r); return r; };
  const add = (list, parent, off) => { for (const p of list) { const g = p.geo.clone(); if (off) g.translate(-off.x, -off.y, -off.z); const o = new THREE.Mesh(g, pick(p.mat)); o.castShadow = true; o.receiveShadow = true; parent.add(o); } };
  add(T.P.body, b.body);
  add(T.P.front, b.front, b.HEAD);
  b.fw.position.copy(T.fc).sub(b.HEAD); add(T.P.fwheel, b.fspin, T.fc);
  b.rw.position.copy(T.rc); add(T.P.rwheel, b.rspin, T.rc);
  b.mirrorDefs = V.mirrors || b.mirrorDefs; b.vid = V.id; b.envExtra = [...mats.values()];
  const se = b.setEnvMap; b.setEnvMap = t => { se(t); for (const m of mats.values()) { if (m.envMap !== undefined) { m.envMap = t; m.needsUpdate = true; } } };
  return b;
}
