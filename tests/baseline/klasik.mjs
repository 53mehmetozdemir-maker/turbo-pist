// klasik.html (eski 2D sürüm): hatasız açılış, PeerJS yüklü (Odaya Gir aktif), menü görüntüsü aynı.
// usage: node baseline/klasik.mjs [record|check]
import fs from 'node:fs'; import path from 'node:path'; import { PNG } from 'pngjs'; import pixelmatch from 'pixelmatch';
import { serve, launch, FREEZE, HERE_DIR, ROOT, NM, googleFonts, surucuDenetle } from './lib.mjs';
const MODE = process.argv[2] || 'check', REF = path.join(HERE_DIR, 'screens/klasik_menu.png'), OUT = path.join(HERE_DIR, 'klasik_expected.json');
const { srv, url } = await serve(); const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, serviceWorkers: 'block' }); await ctx.addInitScript(FREEZE);
await ctx.addInitScript(`try{ localStorage.clear(); }catch(e){}`); await googleFonts(ctx);
await ctx.route('https://unpkg.com/peerjs@1.5.4/**', r => r.fulfill({ path: path.join(NM, 'peerjs/dist/peerjs.min.js'), contentType: 'text/javascript' }));
const page = await ctx.newPage(); const log = []; const ext = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_CONNECTION/.test(m.text())) log.push(m.text()); }); page.on('pageerror', e => log.push('pageerror: ' + e.message));
page.on('request', q => { const u = new URL(q.url()); if (u.hostname !== '127.0.0.1' && !/fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) ext.push(u.hostname); });
await page.goto(url + '/klasik.html', { waitUntil: 'load' }); await surucuDenetle(page); await page.evaluate(() => window.__run ? window.__run(30) : 0);
const res = await page.evaluate(() => ({ peer: typeof Peer === 'function', joinEnabled: !document.getElementById('joinBtn').disabled, menuVisible: !document.getElementById('menu').classList.contains('hidden') }));
res.errors = log.length; const shot = await page.screenshot(); await browser.close(); srv.close();
console.log(JSON.stringify(res), 'dış alan adları:', [...new Set(ext)].join(',') || '-');
if (MODE === 'record') { fs.writeFileSync(REF, shot); fs.writeFileSync(OUT, JSON.stringify(res, null, 1)); console.log('kaydedildi'); process.exit(0); }
const ref = JSON.parse(fs.readFileSync(OUT, 'utf8')); const A = PNG.sync.read(fs.readFileSync(REF)), B = PNG.sync.read(shot);
const n = pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0.12 }), pct = 100 * n / (A.width * A.height);
const okState = JSON.stringify(ref) === JSON.stringify(res), okShot = pct <= 0.5;
console.log(okState ? '✅ durum aynı' : '❌ durum: ' + JSON.stringify(ref) + ' → ' + JSON.stringify(res)); console.log((okShot ? '✅ ' : '❌ ') + 'menü görüntüsü ' + pct.toFixed(2) + '% fark');
process.exit(okState && okShot ? 0 : 1);
