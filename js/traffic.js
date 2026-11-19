// AI traffic on the city lane graph + pedestrians on the sidewalks.
import * as THREE from 'three';
import { personGeos } from './props.js';
import { NB, P, ROAD, LANES, lightState, blocks, SW, CURB, CAR_COLORS } from './city.js';

const BL = P - ROAD;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const right = d => [-DIRS[d][1], DIRS[d][0]];
const axisOf = d => (d % 2 === 0 ? 'ew' : 'ns');
let seed = 4242; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function segPoint(i, j, d, lane, s) { const [dx, dz] = DIRS[d], [rx, rz] = right(d), off = LANES[lane];
  return [i * P + dx * (ROAD / 2 + s) + rx * off, j * P + dz * (ROAD / 2 + s) + rz * off]; }
const valid = (i, j) => i >= 0 && j >= 0 && i <= NB && j <= NB;

export class Traffic {
  constructor(fleet, count) {
    this.fleet = fleet; this.cars = []; this.remote = null;
    for (let k = 0; k < count; k++) this.spawn();
  }
  spawn() {
    for (let tries = 0; tries < 50; tries++) {
      const i = Math.floor(rnd() * (NB + 1)), j = Math.floor(rnd() * (NB + 1)), d = Math.floor(rnd() * 4);
      if (!valid(i + DIRS[d][0], j + DIRS[d][1])) continue;
      const lane = rnd() < 0.5 ? 0 : 1, s = 5 + rnd() * (BL - 25);
      if (this.cars.some(c => c.i === i && c.j === j && c.d === d && c.lane === lane && Math.abs(c.s - s) < 12)) continue;
      const kind = ['sedan', 'sedan', 'sedan', 'suv', 'hatch', 'hatch', 'van'][Math.floor(rnd() * 7)];
      const color = rnd() < 0.08 ? '#f0c419' : CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)];
      const c = { i, j, d, lane, s, v: 8, v0: 11 + rnd() * 4, turn: null, next: null, kind, len: this.fleet.shape(kind).L, id: this.fleet.add(kind, color), x: 0, y: 0, a: 0, brake: false, vx: 0, vy: 0 };
      this.chooseNext(c); this.place(c); this.cars.push(c); return;
    }
  }
  chooseNext(c) {
    const bi = c.i + DIRS[c.d][0], bj = c.j + DIRS[c.d][1];
    const opts = [];
    const add = (nd, w) => { if (valid(bi + DIRS[nd][0], bj + DIRS[nd][1])) for (let k = 0; k < w; k++) opts.push(nd); };
    add(c.d, 3);
    if (c.lane === 1) add((c.d + 1) % 4, 2); else add((c.d + 3) % 4, 2);
    if (!opts.length) { add((c.d + 1) % 4, 1); add((c.d + 3) % 4, 1); }
    c.next = opts.length ? opts[Math.floor(rnd() * opts.length)] : (c.d + 2) % 4;
  }
  startTurn(c) {
    const bi = c.i + DIRS[c.d][0], bj = c.j + DIRS[c.d][1], nd = c.next;
    const E = segPoint(c.i, c.j, c.d, c.lane, BL), X = segPoint(bi, bj, nd, c.lane, 0);
    const [dx, dz] = DIRS[c.d]; const k = (X[0] - E[0]) * dx + (X[1] - E[1]) * dz; const C = nd === c.d ? [(E[0] + X[0]) / 2, (E[1] + X[1]) / 2] : [E[0] + dx * k, E[1] + dz * k];
    let len = 0, px = E[0], pz = E[1]; for (let t = 1; t <= 10; t++) { const q = bez(E, C, X, t / 10); len += Math.hypot(q[0] - px, q[1] - pz); px = q[0]; pz = q[1]; }
    c.turn = { E, C, X, len, t: 0, bi, bj, nd };
  }
  place(c) {
    let x, y, a;
    if (c.turn) { const T = c.turn, u = Math.min(1, c.s / T.len); [x, y] = bez(T.E, T.C, T.X, u); const q = bez(T.E, T.C, T.X, Math.min(1, u + 0.02)), p0 = bez(T.E, T.C, T.X, Math.max(0, u - 0.02)); a = Math.atan2(q[1] - p0[1], q[0] - p0[0]); }
    else { [x, y] = segPoint(c.i, c.j, c.d, c.lane, c.s); a = Math.atan2(DIRS[c.d][1], DIRS[c.d][0]); }
    c.vx = (x - c.x) ; c.vy = (y - c.y); c.x = x; c.y = y; c.a = a;
  }
  // players: [{x,y,vx,vy}]
  step(dt, players) {
    const cars = this.cars;
    for (const c of cars) {
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      let gap = 1e9, vl = 0;
      const look = (ox, oy, ovx, ovy, half) => { const dx = ox - c.x, dy = oy - c.y, fwd = dx * ca + dy * sa; if (fwd <= 0 || fwd > 40) return; const lat = Math.abs(-dx * sa + dy * ca); if (lat > 1.9) return;
        const g = fwd - c.len / 2 - half; if (g < gap) { gap = g; vl = Math.max(0, ovx * ca + ovy * sa); } };
      for (const o of cars) if (o !== c) look(o.x, o.y, o.vx / dt, o.vy / dt, o.len / 2);
      for (const p of players) look(p.x, p.y, p.vx || 0, p.vy || 0, 2.3);
      // red light: virtual stopped car at the stop line
      if (!c.turn) { const stopS = BL - 5.4 - c.len / 2, toStop = stopS - c.s; const st = lightState(axisOf(c.d));
        // yellow: stop only if it can be done comfortably (4 m/s^2), otherwise commit
        if (st !== 0 && c.commit !== c.segKey) { const canStop = toStop > c.v * c.v / 8 - 0.5; if (st === 2 || canStop) { if (toStop > -0.5 && toStop < gap) { gap = Math.max(0.01, toStop + 1.5); vl = 0; } } else c.commit = c.segKey; }
        if (st === 0) c.commit = null;
        // left turn: yield to oncoming traffic
        if (c.next === (c.d + 3) % 4 && toStop < 6 && toStop > -1) { const bi = c.i + DIRS[c.d][0], bj = c.j + DIRS[c.d][1], od = (c.d + 2) % 4;
          const conflict = cars.some(o => o !== c && ((!o.turn && o.d === od && o.i + DIRS[od][0] === bi && o.j + DIRS[od][1] === bj && BL - o.s < 38 && o.v > 0.5 && o.next !== (od + 3) % 4) || (o.turn && o.turn.bi === bi && o.turn.bj === bj && o.d === od && o.turn.nd === od)));
          if (conflict && toStop + 1.5 < gap) { gap = Math.max(0.01, toStop + 1.5); vl = 0; } }
        // slow for the coming turn
        if (c.next !== c.d) { const vt = 6.5; const rem = BL - c.s; c.vlim = Math.sqrt(vt * vt + 2 * 3 * Math.max(0, rem)); } else c.vlim = 99; }
      else c.vlim = c.turn.nd === c.d ? 99 : 6.5;
      const v0 = Math.min(c.v0, c.vlim), a = 1.8, b = 3.2, s0 = 2.2, T = 1.1;
      const ss = s0 + c.v * T + c.v * (c.v - vl) / (2 * Math.sqrt(a * b));
      let acc = a * (1 - Math.pow(c.v / Math.max(v0, 0.1), 4) - (gap < 1e8 ? Math.pow(ss / Math.max(gap, 0.1), 2) : 0));
      acc = Math.max(-9, acc); c.brake = acc < -1;
      c.v = Math.max(0, c.v + acc * dt); c.s += c.v * dt;
      c.segKey = c.i + ',' + c.j + ',' + c.d;
      if (!c.turn && c.s >= BL) { c.s -= BL; this.startTurn(c); }
      else if (c.turn && c.s >= c.turn.len) { c.s -= c.turn.len; const T = c.turn; c.i = T.bi; c.j = T.bj; c.d = T.nd; c.turn = null; this.chooseNext(c); }
      this.place(c);
    }
  }
  // compact state for the network
  pack() { return this.cars.map(c => [Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, Math.round(c.a * 100) / 100, c.brake ? 1 : 0, Math.round(c.v * 10) / 10]); }
  unpack(arr) { this.remote = arr; this.remoteT = performance.now(); }
  render(dt) {
    const f = this.fleet;
    if (this.remote) {   // follower: interpolate toward host state with prediction
      const age = Math.min(0.3, (performance.now() - this.remoteT) / 1000), k = 1 - Math.exp(-dt * 10);
      this.cars.forEach((c, n) => { const r = this.remote[n]; if (!r) return; const px = r[0] + Math.cos(r[2]) * r[4] * age, py = r[1] + Math.sin(r[2]) * r[4] * age;
        if (Math.hypot(px - c.x, py - c.y) > 15) { c.x = px; c.y = py; c.a = r[2]; }
        const ox = c.x, oy = c.y; c.x += (px - c.x) * k; c.y += (py - c.y) * k; let da = r[2] - c.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; c.a += da * k; c.brake = !!r[3]; c.vx = (c.x - ox); c.vy = (c.y - oy); c.v = r[4]; });
    }
    for (const c of this.cars) f.set(c.id, c.x, c.y, c.a, c.brake);
  }
  // obstacles for the player's physics
  obstacles(dt) { return this.cars.map(c => ({ x: c.x, y: c.y, a: c.a, vx: Math.cos(c.a) * c.v, vy: Math.sin(c.a) * c.v })); }
}
function bez(A, C, B, t) { const u = 1 - t; return [u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]]; }

// ---------------- pedestrians ----------------
export class Pedestrians {
  constructor(scene, count) {
    const skin = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
    const shirts = [0x2e86c1, 0xc0392b, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xecf0f1, 0x34495e, 0xe67e22, 0x16a085, 0x7f8c8d];
    const pants = [0x2c3e50, 0x1b2631, 0x5d6d7e, 0x34495e, 0x6e2c00];
    this.peds = [];
    let pr = 99; const r = () => { pr = (pr * 16807) % 2147483647; return pr / 2147483647; };
    for (let k = 0; k < count; k++) { const b = blocks[Math.floor(r() * blocks.length)]; const side = BL - 2 * 2.3;
      this.peds.push({ b, side, off: r() * side * 4, sp: (0.9 + r() * 0.7) * (r() < 0.5 ? 1 : -1), ph: r() * 6.28, dodge: 0, dv: 0, h: 0.9 + r() * 0.2, x: 0, y: 0, a: 0 }); }
    const hairs = [0x1a120c, 0x2b1d14, 0x4a3020, 0x0d0d0d, 0x6b4a2a, 0x8a8580, 0xb08850];
    const G = personGeos(1);
    const mk = (g, n, vc) => { const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: !!vc }), n); m.frustumCulled = false; m.castShadow = false; scene.add(m); return m; };
    this.legs = mk(G.leg, count * 2, true); this.torso = mk(G.torso, count, true); this.head = mk(G.head, count); this.hair = mk(G.hair, count); this.arms = mk(G.arm, count * 2); this.hands = mk(G.hand, count * 2);
    this.meshes = [this.legs, this.torso, this.head, this.hair, this.arms, this.hands];
    const c = new THREE.Color();
    this.peds.forEach((p, i) => { const pc = pants[Math.floor(r() * pants.length)], sc = shirts[Math.floor(r() * shirts.length)], sk = skin[Math.floor(r() * skin.length)];
      this.legs.setColorAt(i * 2, c.set(pc)); this.legs.setColorAt(i * 2 + 1, c.set(pc)); this.torso.setColorAt(i, c.set(sc)); this.arms.setColorAt(i * 2, c.set(sc)); this.arms.setColorAt(i * 2 + 1, c.set(sc));
      this.head.setColorAt(i, c.set(sk)); this.hands.setColorAt(i * 2, c.set(sk)); this.hands.setColorAt(i * 2 + 1, c.set(sk)); this.hair.setColorAt(i, c.set(hairs[Math.floor(r() * hairs.length)])); });
    this.D = new THREE.Object3D(); this.M = new THREE.Matrix4(); this.E = new THREE.Euler();
  }
  // loop position around the block's sidewalk (inset 2.3 m from the kerb)
  loopPos(p, d, inset) { const b = p.b, s = p.side, L = s * 4; d = ((d % L) + L) % L; const x0 = b.x0 + inset, y0 = b.y0 + inset, x1 = b.x0 + BL - inset, y1 = b.y0 + BL - inset;
    if (d < s) return [x0 + d, y0, 0]; if (d < 2 * s) return [x1, y0 + d - s, Math.PI / 2]; if (d < 3 * s) return [x1 - (d - 2 * s), y1, Math.PI]; return [x0, y1 - (d - 3 * s), -Math.PI / 2]; }
  update(dt, cars) {
    const t = Date.now() / 1000, D = this.D;
    this.peds.forEach((p, i) => {
      const d = p.off + p.sp * t;
      // dodge away from fast cars that come close (sidewalk drivers!)
      let threat = 0; for (const c of cars) { const dx = c.x - p.x, dy = c.y - p.y; if (dx * dx + dy * dy < 49 && (c.speed || 0) > 1.5) threat = 1; }
      p.dv += ((threat ? 1 : 0) - p.dodge) * Math.min(1, dt * (threat ? 8 : 0.6)); p.dodge = Math.max(0, Math.min(1, p.dv));
      const inset = 2.3 + p.dodge * 1.9;
      const [x, y, a0] = this.loopPos(p, d, inset); const a = p.sp > 0 ? a0 : a0 + Math.PI;
      p.x = x; p.y = y; p.a = a;
      const walk = threat ? 0 : 1, sw = Math.sin(t * 6.5 * Math.abs(p.sp) + p.ph) * 0.5 * walk, bob = Math.abs(Math.cos(t * 6.5 * Math.abs(p.sp) + p.ph)) * 0.04 * walk;
      const set = (mesh, idx, ox, oy, oz, rx, rz = 0) => { D.position.set(x, CURB + bob, y); D.rotation.set(0, -a + Math.PI / 2, 0); D.scale.set(p.h, p.h, p.h); D.updateMatrix();
        this.M.makeRotationFromEuler(this.E.set(rx, 0, rz)).setPosition(ox, oy, oz); D.matrix.multiply(this.M); mesh.setMatrixAt(idx, D.matrix); };
      set(this.legs, i * 2, -0.09, 0.86, 0, sw); set(this.legs, i * 2 + 1, 0.09, 0.86, 0, -sw);
      set(this.torso, i, 0, 0, 0, 0); set(this.head, i, 0, 0, 0, 0); set(this.hair, i, 0, 0, 0, 0);
      set(this.arms, i * 2, -0.21, 1.4, 0, -sw * 0.8, -0.08); set(this.arms, i * 2 + 1, 0.21, 1.4, 0, sw * 0.8, 0.08);
      set(this.hands, i * 2, -0.21, 1.4, 0, -sw * 0.8, -0.08); set(this.hands, i * 2 + 1, 0.21, 1.4, 0, sw * 0.8, 0.08);
    });
    for (const m of this.meshes) { m.instanceMatrix.needsUpdate = true; }
  }
}
