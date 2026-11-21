// Shared harness: serves the game folder, freezes time & randomness (without touching game code),
// and maps the CDN URLs (unpkg) to local npm copies so the tests do not depend on the network.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = process.env.GAME_ROOT || path.resolve(HERE, '../..');        // folder with index.html
export const NM = process.env.NM || path.resolve(HERE, '../node_modules');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.ktx2': 'image/ktx2', '.webp': 'image/webp' };
export function serve(root = ROOT, port = 0) {
  return new Promise(res => { const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(r); });
    srv.listen(port, '127.0.0.1', () => res({ srv, url: `http://127.0.0.1:${srv.address().port}` })); }); }
export async function launch() {
  return chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
// deterministic page: virtual clock advanced one 60 Hz tick per animation frame, seeded Math.random, frame hold/step control
export const FREEZE = `(()=>{ let seed=12345; Math.random=()=>{ seed=(seed*16807)%2147483647; return (seed-1)/2147483646; };
  const T0=1763730000000; let pt=0; const step=1000/60; Date.now=()=>T0+Math.round(pt); performance.now=()=>pt;
  const raf=window.requestAnimationFrame.bind(window); const q=[]; window.__frames=0; window.__hold=true; window.__budget=0;
  window.requestAnimationFrame=cb=>raf(()=>{ if(window.__hold||window.__budget<=0){ q.push(cb); return; } window.__budget--; pt+=step; window.__frames++; cb(pt); });
  window.__run=n=>new Promise(res=>{ window.__budget=n; const f0=window.__frames; window.__hold=false; const c=q.splice(0); for(const cb of c) window.requestAnimationFrame(cb);
    const chk=()=>{ if(window.__frames-f0>=n){ window.__hold=true; res(window.__frames); } else setTimeout(chk,5); }; chk(); });
  window.__errors=[]; addEventListener('error',e=>window.__errors.push(String(e.message))); addEventListener('unhandledrejection',e=>window.__errors.push('promise: '+String(e.reason)));
})();`;
export async function gamePage(browser, base, { viewport = { width: 960, height: 540 }, storage = {}, touch = false, freeze = true, query = '', onPage = null } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
  if (freeze) await ctx.addInitScript(FREEZE);
  await ctx.addInitScript(`try{ localStorage.clear(); const s=${JSON.stringify(storage)}; for(const k in s) localStorage.setItem(k,s[k]); }catch(e){}`);
  await ctx.route('https://unpkg.com/three@0.187.0/**', r => { const p = path.join(NM, 'three', r.request().url().split('three@0.187.0/')[1].split('?')[0]); fs.existsSync(p) ? r.fulfill({ path: p, contentType: MIME[path.extname(p)] || 'application/octet-stream' }) : r.fulfill({ status: 404 }); });
  await ctx.route('https://unpkg.com/peerjs@1.5.4/**', r => r.fulfill({ path: path.join(NM, 'peerjs/dist/peerjs.min.js'), contentType: 'text/javascript' }));
  const page = await ctx.newPage(); const log = []; page.on('console', m => { if (m.type() === 'error') log.push(m.text()); }); page.on('pageerror', e => log.push('pageerror: ' + e.message));
  if (onPage) onPage(page);
  await page.goto(base + '/' + query, { waitUntil: 'load', timeout: 120000 }); await page.waitForFunction(() => !!window.__game, null, { timeout: 120000, polling: 200 });
  return { ctx, page, log };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const HERE_DIR = HERE;
