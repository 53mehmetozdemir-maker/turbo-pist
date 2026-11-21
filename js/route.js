// GPS routing (GTA style): one road graph for the city grid, the link roads, the motorway ring, the mountain road and
// the drift park; Dijkstra finds the shortest drive, and the route is returned as a polyline that follows the roads.
import { _dbg as R } from './regions.js';
const P = 100, NB = 10;
let G = null;
function build() {
  const nodes = [], adj = [];
  const add = (x, y) => { nodes.push([x, y]); adj.push([]); return nodes.length - 1; };
  const link = (a, b) => { const d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]); adj[a].push([b, d]); adj[b].push([a, d]); };
  // city intersections
  const city = []; for (let j = 0; j <= NB; j++) for (let i = 0; i <= NB; i++) city.push(add(i * P, j * P));
  const C = (i, j) => city[j * (NB + 1) + i];
  for (let j = 0; j <= NB; j++) for (let i = 0; i <= NB; i++) { if (i < NB) link(C(i, j), C(i + 1, j)); if (j < NB) link(C(i, j), C(i, j + 1)); }
  // motorway ring (every 4th frame ≈ 16 m), closed
  const ring = []; for (let k = 0; k < R.ringF.length; k += 4) ring.push(add(R.ringF[k].x, R.ringF[k].y));
  for (let k = 0; k < ring.length; k++) link(ring[k], ring[(k + 1) % ring.length]);
  const nearestOf = (list, x, y) => { let b = list[0], bd = 1e18; for (const n of list) { const d = (nodes[n][0] - x) ** 2 + (nodes[n][1] - y) ** 2; if (d < bd) { bd = d; b = n; } } return b; };
  // link roads: city intersection -> motorway
  for (const L of R.links) { const a = nearestOf(city, L.a[0], L.a[1]), b = add(L.b[0], L.b[1]); link(a, b); link(b, nearestOf(ring, L.b[0], L.b[1])); }
  // mountain road (every 5th frame) + summit
  const mtn = []; for (let k = 0; k < R.mtnF.length; k += 5) mtn.push(add(R.mtnF[k].x, R.mtnF[k].y)); const lastM = R.mtnF[R.mtnF.length - 1]; mtn.push(add(lastM.x, lastM.y));
  for (let k = 0; k < mtn.length - 1; k++) link(mtn[k], mtn[k + 1]); link(mtn[0], nearestOf(ring, nodes[mtn[0]][0], nodes[mtn[0]][1]));
  link(mtn[mtn.length - 1], add(R.SUMMIT.x, R.SUMMIT.y));
  // drift park
  const pa = add(R.padLink.a[0], R.padLink.a[1]), pb = add(R.padLink.b[0], R.padLink.b[1]), pc = add((R.PAD.x0 + R.PAD.x1) / 2, (R.PAD.y0 + R.PAD.y1) / 2);
  link(nearestOf(ring, R.padLink.a[0], R.padLink.a[1]), pa); link(pa, pb); link(pb, pc);
  G = { nodes, adj };
}
const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)); return [Math.hypot(px - ax - dx * t, py - ay - dy * t), ax + dx * t, ay + dy * t]; };
// snap a point to the nearest road edge: returns the projection and the edge's two nodes
function snap(x, y) { let best = null;
  for (let a = 0; a < G.nodes.length; a++) for (const [b] of G.adj[a]) { if (b < a) continue; const [d, px, py] = segDist(x, y, G.nodes[a][0], G.nodes[a][1], G.nodes[b][0], G.nodes[b][1]); if (!best || d < best.d) best = { d, px, py, a, b }; }
  return best; }
export function findRoute(x0, y0, x1, y1) {
  if (!G) build(); const N = G.nodes, s = snap(x0, y0), t = snap(x1, y1); if (!s || !t) return [[x0, y0], [x1, y1]];
  // same edge: drive straight along it
  if ((s.a === t.a && s.b === t.b)) return [[x0, y0], [s.px, s.py], [t.px, t.py], [x1, y1]];
  const n = N.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const heap = []; const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const v of [s.a, s.b]) { const d = Math.hypot(N[v][0] - s.px, N[v][1] - s.py); if (d < dist[v]) { dist[v] = d; push(d, v); } }
  const goal = new Map([[t.a, Math.hypot(N[t.a][0] - t.px, N[t.a][1] - t.py)], [t.b, Math.hypot(N[t.b][0] - t.px, N[t.b][1] - t.py)]]);
  let bestEnd = -1, bestCost = Infinity;
  while (heap.length) { const [d, u] = pop(); if (done[u]) continue; done[u] = 1; if (d >= bestCost) break;
    if (goal.has(u) && d + goal.get(u) < bestCost) { bestCost = d + goal.get(u); bestEnd = u; }
    for (const [v, w] of G.adj[u]) { const nd = d + w; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push(nd, v); } } }
  if (bestEnd < 0) return [[x0, y0], [x1, y1]];
  const path = []; for (let v = bestEnd; v >= 0; v = prev[v]) path.push(N[v]); path.reverse();
  const out = [[x0, y0], [s.px, s.py], ...path, [t.px, t.py], [x1, y1]];
  out.length_m = bestCost; return out;
}
export function routeLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
