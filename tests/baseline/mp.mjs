// Çok oyunculu test (Aşama 4): yerel PeerJS sunucusu + aynı tarayıcıda ayrı bağlamlar (ayrı localStorage).
// İnternet/TURN gerektirmez (aynı makinede doğrudan WebRTC). Gerçek ağ (mobil veri, TURN) testi elle yapılır.
// Eski sürüm olarak main'in KENDİ kodu (canlıdaki sürüm, git worktree) kullanılır: geriye uyumluluk gerçek kodla sınanır.
// usage: node baseline/mp.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { PeerServer } from 'peer';
import { launch, MIME, HERE_DIR, NM } from './lib.mjs';
const REPO = path.resolve(HERE_DIR, '../..'), OUT = '/tmp/tp-mp-test', ESKI = '/tmp/tp-mp-eski';
const A = '/turbo-pist/', B = '/turbo-pist-onizleme/', E = '/eski/';
const derle = (ad, base, env = {}) => { const dir = path.join(OUT, ad); execFileSync('npx', ['vite', 'build', '--base=' + base, '--outDir', dir, '--logLevel', 'error'], { cwd: REPO, env: { ...process.env, ...env }, stdio: 'inherit' }); return dir; };
const D = {};
const SAHTE_ICE = [{ urls: 'stun:127.0.0.1:3478' }, { urls: 'turn:127.0.0.1:3478', username: 'test', credential: 'test' }];
const srv = http.createServer((q, r) => { const p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/ice') { r.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); r.end(JSON.stringify(SAHTE_ICE)); return; }
  const m = Object.keys(D).find(k => p.startsWith(k)); if (!m) { r.writeHead(404); r.end(); return; }
  let rel = p.slice(m.length); if (rel === '' || rel.endsWith('/')) rel += 'index.html'; const f = path.join(D[m], rel);
  if (!f.startsWith(D[m]) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const URL0 = `http://127.0.0.1:${srv.address().port}`;
console.log('derleniyor…');
D[A] = derle('canli', A, { VITE_TURN_URL: URL0 + '/ice' });                                  // Worker yerine sahte /ice
D[B] = derle('onizleme', B, { VITE_ODA_ONEK: 'onizleme-', VITE_DEPO_ONEK: 'onizleme_', VITE_TURN_URL: URL0 + '/yok' });   // Worker'a ulaşılamıyor
if (!fs.existsSync(ESKI)) execFileSync('git', ['worktree', 'add', '-f', ESKI, 'e771e2a'], { cwd: REPO, stdio: 'inherit' });
D[E] = ESKI;
const psrv = await new Promise(r => PeerServer({ port: 0, path: '/peerjs', host: '127.0.0.1' }, r));
const PS = { host: '127.0.0.1', port: psrv.address().port, path: '/peerjs', secure: false, key: 'peerjs' };
const browser = await launch();
// Her sayfaya: yerel PeerJS sunucusu (yeni kod: __tpPeerSunucu; eski kod: window.Peer'i saran kanca), bildirim kaydı
const KANCA = `(() => { window.__tpPeerSunucu = ${JSON.stringify(PS)}; window.__toasts = []; window.__rtc = [];
  // (PeerJS yüklenirken destek sınaması için kendi varsayılan ayarıyla bir bağlantı açar; o da burada görünür)
  const R = window.RTCPeerConnection; window.RTCPeerConnection = class extends R { constructor(c, ...a) { window.__rtc.push(JSON.stringify((c && c.iceServers) || [])); super(c, ...a); } };
  let P; Object.defineProperty(window, 'Peer', { configurable: true, get: () => P, set: v => { P = class extends v { constructor(a, b) { if (typeof a === 'object') super(Object.assign({}, a, window.__tpPeerSunucu)); else super(a, Object.assign({}, b, window.__tpPeerSunucu)); } }; } });
  new MutationObserver(() => { const t = document.getElementById('toast'); if (t && t.textContent) window.__toasts.push(t.textContent); }).observe(document, { subtree: true, childList: true, characterData: true }); })();`;
async function oyuncu(yol, ad, kod) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, serviceWorkers: 'block' });
  await ctx.addInitScript(KANCA);
  await ctx.addInitScript(`try{ localStorage.setItem('tp_name', ${JSON.stringify(ad)}); localStorage.setItem('tp_code', ${JSON.stringify(kod)}); localStorage.setItem('tp4_map','city'); localStorage.setItem('tp3_quality','low'); }catch(e){}`);
  await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await ctx.route('https://unpkg.com/three@0.187.0/**', r => { const p = path.join(NM, 'three', r.request().url().split('three@0.187.0/')[1].split('?')[0]); fs.existsSync(p) ? r.fulfill({ path: p, contentType: MIME[path.extname(p)] || 'application/octet-stream' }) : r.fulfill({ status: 404 }); });
  await ctx.route('https://unpkg.com/peerjs@1.5.4/**', r => r.fulfill({ path: path.join(NM, 'peerjs/dist/peerjs.min.js'), contentType: 'text/javascript' }));
  const page = await ctx.newPage(); const hatalar = [];
  page.on('pageerror', e => hatalar.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource|WebGL|GL Driver/.test(m.text())) hatalar.push(m.text()); });
  await page.goto(URL0 + yol); await page.waitForFunction(() => window.__game && !document.getElementById('loading') && !document.getElementById('joinBtn').disabled, null, { timeout: 180000, polling: 300 });
  return { ctx, page, hatalar, ad };
}
const gir = async o => { await o.page.click('#joinBtn'); await o.page.waitForFunction(() => window.__game.mode === 'free', null, { timeout: 60000, polling: 300 }); };
const gorur = (o, n = 1, t = 45000) => o.page.waitForFunction(n => window.__game.remotes.size === n, n, { timeout: t, polling: 300 }).then(() => true, () => false);
const toastVar = (o, re) => o.page.evaluate(src => window.__toasts.some(t => new RegExp(src).test(t)), re.source);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sonuc = []; let bad = 0; const ok = (ad, k, d = '') => { sonuc.push((k ? '✅ ' : '❌ ') + ad + (d ? ' — ' + d : '')); if (!k) bad++; console.log(sonuc.at(-1)); };
// Oyuncuyu bir trafik aracının 7 m arkasına koyup 18 m/s ile çarptır; aracın sırası döner
async function carp(o) {
  return o.page.evaluate(() => { const g = window.__game, P = g.phys, cars = g.world.traffic.all();
    let n = -1, best = 1e9; cars.forEach((c, i) => { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < best && !c.crash && c.v > 2 && c.v < 12) { best = d; n = i; }   // 18 m/s ile yetişilebilir hızda olsun (otoyol araçları daha hızlı) });
    if (n < 0) n = 0; const c = cars[n]; P.reset(c.x - Math.cos(c.a) * 7, c.y - Math.sin(c.a) * 7, c.a); P.vx = Math.cos(c.a) * 18; P.vy = Math.sin(c.a) * 18; return n; });
}
const kazaHost = (o, n) => o.page.waitForFunction(n => (window.__game.world.traffic.all()[n].crash || 0) > 0, n, { timeout: 15000, polling: 100 }).then(() => true, () => false);
const kazaMisafir = (o, n) => o.page.waitForFunction(n => { const c = window.__game.world.traffic.all()[n]; return c.sig === 2 && c.fxSeen > 0; }, n, { timeout: 15000, polling: 100 }).then(() => true, () => false);

try {
  // 1) yeni host + yeni misafir
  const h = await oyuncu(A, 'Host', 'TP4A'); await gir(h);
  const m = await oyuncu(A, 'Misafir', 'TP4A'); await gir(m);
  ok('yeni ↔ yeni: aynı odada birbirini görüyor', await gorur(h) && await gorur(m));
  ok('host kurucu, misafir değil', await h.page.evaluate(() => !!window.__game && document.getElementById('hNet').textContent.includes('oda kurucusu')) && !(await m.page.evaluate(() => document.getElementById('hNet').textContent.includes('oda kurucusu'))));
  await sleep(1500);
  ok('aynı sürümde uyarı yok', !(await toastVar(h, /sürüm/)) && !(await toastVar(m, /sürüm/)));
  ok('TURN listesi Worker adresinden alınıp WebRTC\'ye veriliyor', await m.page.evaluate(() => window.__rtc.some(c => c.includes('turn:127.0.0.1:3478'))));
  ok('misafir host\'un trafiğini alıyor', await m.page.evaluate(() => !!window.__game.world.traffic.remote && window.__game.world.traffic.remote.length > 10));
  // 2) H1: misafir bot araca çarpıyor → host'ta kaza, misafirde dörtlü + efekt
  const n1 = await carp(m);
  ok('H1: misafirin çarptığı araç host\'ta kaza yapıyor', await kazaHost(h, n1), 'araç #' + n1);
  ok('H1: misafir o aracı dörtlülerle ve kaza efektiyle görüyor', await kazaMisafir(m, n1));
  // 3) host çarpıyor → misafir görüyor
  const n2 = await carp(h);
  const hk = await kazaHost(h, n2), mk = hk && await kazaMisafir(m, n2);
  const d2 = await h.page.evaluate(n => { const c = window.__game.world.traffic.all()[n], P = window.__game.phys; return { crash: c.crash || 0, mesafe: +Math.hypot(c.x - P.x, c.y - P.y).toFixed(1), hiz: +P.speed.toFixed(1) }; }, n2);
  ok('host\'un çarptığı araç host\'ta kaza yapıyor', hk, 'araç #' + n2 + ' ' + JSON.stringify(d2));
  if (hk) ok('host\'un çarptığı araç misafirde dörtlülü + efektli', mk, 'araç #' + n2);
  // 4) host ayrılıyor
  await h.page.keyboard.press('Escape'); await sleep(500); await h.page.click('#pauseMenuBtn');
  const ayrildi = await m.page.waitForFunction(() => window.__game.mode === 'menu', null, { timeout: 30000, polling: 300 }).then(() => true, () => false);
  ok('host ayrılınca misafir ana menüye dönüyor ve uyarılıyor', ayrildi && await toastVar(m, /Oda kurucusu ayrıldı/));
  ok('yeni sürüm sayfalarında konsol hatası yok', !h.hatalar.length && !m.hatalar.length, [...h.hatalar, ...m.hatalar].slice(0, 2).join(' | '));
  await h.ctx.close(); await m.ctx.close();
  // 5) ESKİ host (main) + yeni misafir
  const eh = await oyuncu(E, 'EskiHost', 'TP4B'); await gir(eh);
  const ym = await oyuncu(A, 'YeniMisafir', 'TP4B'); await gir(ym);
  ok('eski host ↔ yeni misafir: bağlanıyor', await gorur(eh) && await gorur(ym));
  await sleep(1500);
  ok('yeni misafire "oda kurucusu eski sürümde" uyarısı', await toastVar(ym, /Oda kurucusunun oyunu eski sürümde/));
  ok('yeni misafir eski host\'un trafiğini alıyor', await ym.page.evaluate(() => !!window.__game.world.traffic.remote && window.__game.world.traffic.remote.length > 10));
  const n5 = await carp(ym); await sleep(3000);
  ok('negatif kontrol: ESKİ host\'ta misafirin çarptığı araç kaza YAPMIYOR (H1 eski sürümde vardı)', !(await kazaHost(eh, n5)));
  ok('yeni misafirin çarpma mesajı eski host\'u bozmuyor', !eh.hatalar.length && await eh.page.evaluate(() => window.__game.remotes.size === 1), eh.hatalar.slice(0, 2).join(' | '));
  await eh.ctx.close(); await ym.ctx.close();
  // 6) yeni host + ESKİ misafir
  const yh = await oyuncu(A, 'YeniHost', 'TP4C'); await gir(yh);
  const em = await oyuncu(E, 'EskiMisafir', 'TP4C'); await gir(em);
  ok('yeni host ↔ eski misafir: bağlanıyor', await gorur(yh) && await gorur(em));
  await sleep(1500);
  ok('yeni host\'a "EskiMisafir eski sürümde" uyarısı', await toastVar(yh, /EskiMisafir eski sürümde/));
  const n6 = await carp(yh); await kazaHost(yh, n6); await sleep(1500);
  ok('eski misafir yeni paketleri (ek alanlarla) hatasız okuyor ve kazayı dörtlülerle görüyor', !em.hatalar.length && await em.page.evaluate(n => window.__game.world.traffic.all()[n].sig === 2, n6), em.hatalar.slice(0, 2).join(' | '));
  await yh.ctx.close(); await em.ctx.close();
  // 7) önizleme ↔ canlı aynı kodla aynı odaya düşmüyor
  const lc = await oyuncu(A, 'Canli', 'TP4D'); await gir(lc);
  const oz = await oyuncu(B, 'Onizleme', 'TP4D'); await gir(oz);
  const ayri = !(await gorur(lc, 1, 12000)) && !(await gorur(oz, 1, 1000));
  ok('canlı ve önizleme aynı oda koduyla ayrı odalarda (ikisi de kurucu)', ayri && await oz.page.evaluate(() => document.getElementById('hNet').textContent.includes('oda kurucusu')));
  const oz2 = await oyuncu(B, 'Onizleme2', 'TP4D'); await gir(oz2);
  const g1 = await gorur(oz, 1, 60000), g2 = await gorur(oz2, 1, 5000);
  const d7 = await oz2.page.evaluate(() => ({ rtc: window.__rtc, mod: window.__game.mode, net: document.getElementById('hNet').textContent, t: window.__toasts.slice(-3) }));
  ok('Worker\'a ulaşılamayınca yalnız STUN ile yine bağlanıyor (önizleme ↔ önizleme)', g1 && g2 && d7.rtc.some(c => c.includes('stun.relay.metered.ca') && !c.includes('turn:')) && !d7.rtc.some(c => c.includes('127.0.0.1')), JSON.stringify({ g1, g2, ...d7 }));
  await lc.ctx.close(); await oz.ctx.close(); await oz2.ctx.close();
} catch (e) { ok('test tamamlandı', false, e.message.split('\n')[0]); }
await browser.close(); srv.close(); psrv.close(); setTimeout(() => process.exit(bad ? 1 : 0), 500);
console.log(`\n${sonuc.length - bad}/${sonuc.length} geçti`); process.exit(bad ? 1 : 0);
