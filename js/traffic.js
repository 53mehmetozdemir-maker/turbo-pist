// AI traffic on the city lane graph + pedestrians on the sidewalks.
import * as THREE from 'three';
import { personGeos } from './props.js';
import { NB, P, ROAD, LANES, lightState, blocks, SW, CURB, CAR_COLORS, nowS } from './city.js';

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
    const cars = this.cars, peds = this.peds ? this.peds.onRoad : [];
    this.time = (this.time || 0) + dt;
    for (const c of cars) {
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      let gap = 1e9, vl = 0;
      const look = (ox, oy, ovx, ovy, half) => { const dx = ox - c.x, dy = oy - c.y, fwd = dx * ca + dy * sa; if (fwd <= 0 || fwd > 40) return; const lat = Math.abs(-dx * sa + dy * ca); if (lat > 1.9) return;
        const g = fwd - c.len / 2 - half; if (g < gap) { gap = g; vl = Math.max(0, ovx * ca + ovy * sa); } };
      for (const o of cars) if (o !== c) look(o.x, o.y, o.vx / dt, o.vy / dt, o.len / 2);
      const g0 = gap; for (const p of players) look(p.x, p.y, p.vx || 0, p.vy || 0, 2.3); const byPlayer = gap < g0;
      for (const p of peds) look(p.x, p.y, 0, 0, 0.5);   // pedestrians on the crossing have right of way
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
      // turn signals: on from ~45 m before the junction and through the turn
      const nd = c.turn ? c.turn.nd : c.next, rem = c.turn ? 0 : BL - c.s;
      c.sig = (nd === c.d || rem > 45) ? 0 : nd === (c.d + 1) % 4 ? 1 : -1;
      // horn: stuck behind someone on a green light, or cut up by a player
      c.honk = Math.max(0, (c.honk || 0) - dt); c.cool = Math.max(0, (c.cool || 0) - dt);
      const green = c.turn || lightState(axisOf(c.d)) === 0;
      if (c.v < 0.4 && gap < 7 && green) c.wait = (c.wait || 0) + dt; else c.wait = 0;
      if (c.cool <= 0) { const hash = Math.sin(c.id * 12.9898 + Math.floor(this.time)) * 43758.5453 % 1;
        if (c.wait > 3 + Math.abs(hash) * 4) { c.honk = Math.abs(hash) < 0.3 ? 0.9 : 0.35; c.cool = 6 + Math.abs(hash) * 6; c.wait = 0; }
        else if (byPlayer && gap < 5 && c.v > 4 && acc < -4) { c.honk = 0.7; c.cool = 5; } }
      c.segKey = c.i + ',' + c.j + ',' + c.d;
      if (!c.turn && c.s >= BL) { c.s -= BL; this.startTurn(c); }
      else if (c.turn && c.s >= c.turn.len) { c.s -= c.turn.len; const T = c.turn; c.i = T.bi; c.j = T.bj; c.d = T.nd; c.turn = null; this.chooseNext(c); }
      this.place(c);
    }
  }
  // compact state for the network
  pack() { return this.cars.map(c => [Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, Math.round(c.a * 100) / 100, c.brake ? 1 : 0, Math.round(c.v * 10) / 10, c.sig || 0, c.honk > 0 ? 1 : 0]); }
  unpack(arr) { this.remote = arr; this.remoteT = performance.now(); }
  render(dt) {
    const f = this.fleet;
    if (this.remote) {   // follower: interpolate toward host state with prediction
      const age = Math.min(0.3, (performance.now() - this.remoteT) / 1000), k = 1 - Math.exp(-dt * 10);
      this.cars.forEach((c, n) => { const r = this.remote[n]; if (!r) return; const px = r[0] + Math.cos(r[2]) * r[4] * age, py = r[1] + Math.sin(r[2]) * r[4] * age;
        if (Math.hypot(px - c.x, py - c.y) > 15) { c.x = px; c.y = py; c.a = r[2]; }
        const ox = c.x, oy = c.y; c.x += (px - c.x) * k; c.y += (py - c.y) * k; let da = r[2] - c.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; c.a += da * k; c.brake = !!r[3]; c.sig = r[5] || 0; c.honk = r[6] ? 0.2 : 0; c.vx = (c.x - ox); c.vy = (c.y - oy); c.v = r[4]; });
    }
    const ah = this.remote ? 0 : (this.ahead || 0);
    for (const c of this.cars) { const s = (c.v || 0) * ah; f.set(c.id, c.x + Math.cos(c.a) * s, c.y + Math.sin(c.a) * s, c.a, c.brake, true, c.sig || 0); }
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
    for (let k = 0; k < count; k++) { const bi = Math.floor(r() * blocks.length); const side = BL - 2 * 2.3;
      this.peds.push({ k, bi, side, off: r() * side * 4, sp: (0.9 + r() * 0.7) * (r() < 0.5 ? 1 : -1), ph: r() * 6.28, dodge: 0, dv: 0, h: 0.9 + r() * 0.2, x: 0, y: 0, a: 0, leg: null, n: 0 }); }
    this.onRoad = [];
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
  // Pedestrians follow an event-driven itinerary computed only from the shared clock, so every player sees the same crowd:
  // walk along a block's sidewalk to a corner, then sometimes wait for the walk phase and cross the road on the zebra.
  static rand(k, n) { const v = Math.sin(k * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); }
  cornerPos(b, c, inset) { const x0 = b.x0 + inset, y0 = b.y0 + inset, x1 = b.x0 + BL - inset, y1 = b.y0 + BL - inset; return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]][c]; }
  nextLeg(p, t0) {
    const R = Pedestrians.rand, L = p.leg, n = ++p.n, b = blocks[p.bi], dir = p.sp > 0 ? 1 : -1, s = p.side;
    if (!L) { const d = ((p.off % (4 * s)) + 4 * s) % (4 * s); const seg = Math.floor(d / s); const toC = dir > 0 ? (seg + 1) * s - d : d - seg * s;
      return { type: 'walk', t0, t1: t0 + toC / Math.abs(p.sp), d0: d, dir, corner: dir > 0 ? (seg + 1) % 4 : seg }; }
    const corner = L.type === 'walk' ? L.corner : L.type === 'cross' ? L.toCorner : L.corner;
    if (L.type === 'walk' && R(p.k, n) < 0.38) {   // try to cross here
      const opts = [[0, -1], [-1, 0], [1, 0], [0, 1]].filter(([dx, dy]) => (corner === 0 && (dy < 0 || dx < 0)) || (corner === 1 && (dy < 0 || dx > 0)) || (corner === 2 && (dy > 0 || dx > 0)) || (corner === 3 && (dy > 0 || dx < 0)));
      const [dx, dy] = opts[R(p.k, n + 0.5) < 0.5 ? 0 : 1]; const ni = b.bi + dx, nj = b.bj + dy, nb = ni >= 0 && nj >= 0 && ni < NB && nj < NB ? blocks[nj * NB + ni] : null;
      if (nb) { // walking along y crosses the east-west road -> needs the north-south green, and vice versa
        const axis = dy !== 0 ? 'ns' : 'ew', start = axis === 'ew' ? 0 : 13, period = 26; let c = ((t0 % period) + period) % period, el = c - start; if (el < 0) el += period;
        const tw = el <= 2.0 ? t0 : t0 + (period - el);
        const toCorner = dy !== 0 ? [3, 2, 1, 0][corner] : [1, 0, 3, 2][corner];
        if (tw > t0 + 0.05) return { type: 'wait', t0, t1: tw, corner, face: Math.atan2(dy, dx), pend: { nb, toCorner } };
        return this.crossLeg(p, t0, b, corner, nb, toCorner); } }
    if (L.type === 'wait' && L.pend) return this.crossLeg(p, t0, b, L.corner, L.pend.nb, L.pend.toCorner);
    if (R(p.k, n + 0.25) < 0.08) return { type: 'wait', t0, t1: t0 + 2 + R(p.k, n + 0.7) * 6, corner, face: null };   // stop for a moment (phone, window shopping)
    // walk to the next corner of this block
    const d0 = corner * s; return { type: 'walk', t0, t1: t0 + s / Math.abs(p.sp), d0, dir, corner: dir > 0 ? (corner + 1) % 4 : (corner + 3) % 4 };
  }
  crossLeg(p, t0, b, corner, nb, toCorner) { const A = this.cornerPos(b, corner, 2.3), B = this.cornerPos(nb, toCorner, 2.3), len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    p.bi = nb.bj * NB + nb.bi; const sp = Math.max(1.8, Math.abs(p.sp) * 1.25); return { type: 'cross', t0, t1: t0 + len / sp, A, B, toCorner, sp }; }
  posAt(p, t) { const L = p.leg, b = blocks[p.bi], s = p.side;
    if (L.type === 'cross') { const u = Math.min(1, (t - L.t0) / (L.t1 - L.t0)); return [L.A[0] + (L.B[0] - L.A[0]) * u, L.A[1] + (L.B[1] - L.A[1]) * u, Math.atan2(L.B[1] - L.A[1], L.B[0] - L.A[0]), true]; }
    if (L.type === 'wait') { const c = this.cornerPos(b, L.corner, 2.3 + (L.pend ? -0.9 : 0.4)); return [c[0], c[1], L.face ?? p.a, false]; }
    const d = L.d0 + L.dir * Math.abs(p.sp) * (t - L.t0); const [x, y, a0] = this.loopPos(b, s, d, 2.3); return [x, y, L.dir > 0 ? a0 : a0 + Math.PI, true]; }
  loopPos(b, s, d, inset) { const L = s * 4; d = ((d % L) + L) % L; const x0 = b.x0 + inset, y0 = b.y0 + inset, x1 = b.x0 + BL - inset, y1 = b.y0 + BL - inset;
    if (d < s) return [x0 + d, y0, 0]; if (d < 2 * s) return [x1, y0 + d - s, Math.PI / 2]; if (d < 3 * s) return [x1 - (d - 2 * s), y1, Math.PI]; return [x0, y1 - (d - 3 * s), -Math.PI / 2]; }
  update(dt, cars) {
    const t = nowS(), D = this.D; this.onRoad.length = 0;
    if (this.t0 == null) this.t0 = Math.floor(t / 86400) * 86400;   // replay the itinerary from the start of the day: identical on every screen
    this.peds.forEach((p, i) => {
      if (!p.leg) { p.leg = this.nextLeg(p, this.t0); }
      let guard = 0; while (t >= p.leg.t1 && guard++ < 4000) p.leg = this.nextLeg(p, p.leg.t1);
      let [x, y, a, moving] = this.posAt(p, t);
      // dodge away from fast cars that come close (sidewalk drivers!)
      let threat = 0; for (const c of cars) { const dx = c.x - x, dy = c.y - y; if (dx * dx + dy * dy < 49 && (c.speed || 0) > 1.5) threat = 1; }
      p.dv += ((threat ? 1 : 0) - p.dodge) * Math.min(1, dt * (threat ? 8 : 0.6)); p.dodge = Math.max(0, Math.min(1, p.dv));
      if (p.dodge > 0.01) { x += -Math.sin(a) * p.dodge * 1.9 * (p.leg.type === 'cross' ? 0.6 : -1); y += Math.cos(a) * p.dodge * 1.9 * (p.leg.type === 'cross' ? 0.6 : -1); }
      p.x = x; p.y = y; p.a = a;
      const onRoadNow = p.leg.type === 'cross' && !blocks.some(q => x > q.x0 + 0.6 && x < q.x0 + BL - 0.6 && y > q.y0 + 0.6 && y < q.y0 + BL - 0.6); if (onRoadNow) this.onRoad.push(p);
      const sp = p.leg.type === 'cross' ? p.leg.sp : Math.abs(p.sp);
      const walk = threat || !moving ? 0 : 1, sw = Math.sin(t * 6.5 * sp + p.ph) * 0.5 * walk, bob = Math.abs(Math.cos(t * 6.5 * sp + p.ph)) * 0.04 * walk;
      const set = (mesh, idx, ox, oy, oz, rx, rz = 0) => { D.position.set(x, (onRoadNow ? 0 : CURB) + bob, y); D.rotation.set(0, -a + Math.PI / 2, 0); D.scale.set(p.h, p.h, p.h); D.updateMatrix();
        this.M.makeRotationFromEuler(this.E.set(rx, 0, rz)).setPosition(ox, oy, oz); D.matrix.multiply(this.M); mesh.setMatrixAt(idx, D.matrix); };
      set(this.legs, i * 2, -0.09, 0.86, 0, sw); set(this.legs, i * 2 + 1, 0.09, 0.86, 0, -sw);
      set(this.torso, i, 0, 0, 0, 0); set(this.head, i, 0, 0, 0, 0); set(this.hair, i, 0, 0, 0, 0);
      set(this.arms, i * 2, -0.21, 1.4, 0, -sw * 0.8, -0.08); set(this.arms, i * 2 + 1, 0.21, 1.4, 0, sw * 0.8, 0.08);
      set(this.hands, i * 2, -0.21, 1.4, 0, -sw * 0.8, -0.08); set(this.hands, i * 2 + 1, 0.21, 1.4, 0, sw * 0.8, 0.08);
    });
    for (const m of this.meshes) { m.instanceMatrix.needsUpdate = true; }
  }
}
