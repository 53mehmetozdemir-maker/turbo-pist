// Tam geri dönüş denemesi (canlıya geçiş planı 3b): altyapı canlıya girdikten sonra eski canlı sürüme (e771e2a) dönülürse
// oyuncunun tarayıcısında ne olur? Oyuncu yeni sürümü açmış, service worker kurulmuş, kayıt yeni biçimde yazılmış olsun.
// Sonra sunucu eski sürümün dosyalarını + kök sw.js olarak pwa/sw-acil-kapat.js verir (geri dönüş commit'i budur).
// Beklenen: oyuncu eski oyunu görür, service worker ve önbellek kalkar, kayıt (para, hasar) eski kodda aynen okunur.
// usage: node baseline/geri_donus.mjs [eski-commit, varsayılan e771e2a]   ·   SWSIZ=1: kapatma dosyası olmadan (karşı deneme)
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { execFileSync } from 'node:child_process';
import { launch, MIME, NM, KAT, googleFonts } from './lib.mjs';
const REPO = path.resolve(import.meta.dirname, '../..'), ESKI_C = process.argv[2] || 'e771e2a';
const YENI = '/tmp/tp-geri/yeni', ESKI = '/tmp/tp-geri/eski', A = '/turbo-pist/';
fs.rmSync('/tmp/tp-geri', { recursive: true, force: true }); fs.mkdirSync('/tmp/tp-geri');
console.log('yeni sürüm derleniyor…'); execFileSync('npx', ['vite', 'build', '--outDir', YENI, '--emptyOutDir', '--logLevel', 'warn'], { cwd: REPO, stdio: 'inherit' });
// eski sürümün dosyaları (git'ten, çalışma ağacına dokunmadan) + geri dönüş commit'indeki kök sw.js
execFileSync('sh', ['-c', `mkdir -p ${ESKI} && git archive ${ESKI_C} | tar -x -C ${ESKI}`], { cwd: REPO });
if (process.env.SWSIZ !== '1') fs.copyFileSync(path.join(REPO, 'pwa/sw-acil-kapat.js'), path.join(ESKI, 'sw.js'));
let kok = YENI; const istek = [];
const srv = http.createServer((q, r) => { const p = decodeURIComponent(q.url.split('?')[0]); istek.push((kok === YENI ? 'yeni ' : 'eski ') + p);
  if (!p.startsWith(A)) { r.writeHead(404); r.end(); return; } let rel = p.slice(A.length); if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const f = path.join(kok, rel); if (!f.startsWith(kok) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const U = `http://127.0.0.1:${srv.address().port}${A}`;
const b = await launch(); const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
ctx.setDefaultTimeout(60000 * KAT); ctx.setDefaultNavigationTimeout(180000 * KAT);
// eski sürüm three/peerjs/yazı tiplerini CDN'den ister: yerel npm kopyaları verilir (canlıda CDN'den gelir)
await ctx.route('https://unpkg.com/three@0.187.0/**', r => { const p = path.join(NM, 'three', r.request().url().split('three@0.187.0/')[1].split('?')[0]); fs.existsSync(p) ? r.fulfill({ path: p, contentType: MIME[path.extname(p)] || 'application/octet-stream' }) : r.fulfill({ status: 404 }); });
await ctx.route('https://unpkg.com/peerjs@1.5.4/**', r => r.fulfill({ path: path.join(NM, 'peerjs/dist/peerjs.min.js'), contentType: 'text/javascript' }));
await googleFonts(ctx);
const page = await ctx.newPage(); const hatalar = []; page.on('pageerror', e => hatalar.push(e.message));
let bad = 0; const ok = (ad, kosul, ek = '') => { if (!kosul) bad++; console.log((kosul ? '✅ ' : '❌ ') + ad + (ek ? ' — ' + ek : '')); };
const bekle = async (fn, arg, t, ad) => { const son = Date.now() + t * KAT; for (;;) { try { if (await page.evaluate(fn, arg)) return true; } catch (e) { /* sayfa yenileniyor */ } if (Date.now() > son) { console.log('   (zaman aşımı: ' + ad + ')'); return false; } await new Promise(r => setTimeout(r, 500)); } };
try {
  // 1) yeni sürüm: aç, service worker kurulsun, kayıt yeni biçimde yazılsın
  await page.goto(U); await bekle(() => !!window.__game && !document.getElementById('loading'), null, 180000, 'yeni açılış');
  ok('yeni sürüm: service worker kuruldu ve sayfayı yönetiyor', await bekle(() => !!navigator.serviceWorker.controller, null, 90000, 'SW'));
  const yeniKayit = await page.evaluate(() => { const g = window.__game; g.SAVE.money = 43210; g.SAVE.veh.f458 = { fuel: 0.42, damage: 33 }; g.saveGame(); return JSON.parse(localStorage.getItem('tp8_save')); });
  ok('yeni sürüm kaydı yeni biçimde (sürüm alanı v)', yeniKayit.v >= 1 && yeniKayit.money === 43210, JSON.stringify({ v: yeniKayit.v, money: yeniKayit.money }));
  const onbellek0 = await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('tp|')).length);
  // 2) geri dönüş commit'i yayında: sunucu artık eski sürümü + kapatma sw.js'yi veriyor. Oyuncu sayfayı yeniler.
  kok = ESKI; const i0 = istek.length;
  await page.reload();
  // kapatma SW'si kurulur → önbelleği siler, kaydını kaldırır, sekmeyi yeniden yükler → eski oyun ağdan açılır
  const kalkti = await bekle(async () => !navigator.serviceWorker.controller && (await navigator.serviceWorker.getRegistrations()).length === 0, null, 120000, 'SW kalkması');
  ok('service worker kendini kaldırdı (kayıt yok, sayfa yönetilmiyor)', kalkti);
  const onbellek1 = await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('tp|')).length);
  ok('oyunun önbellekleri silindi', onbellek0 > 0 && onbellek1 === 0, `önce ${onbellek0}, sonra ${onbellek1}`);
  ok('kapatma dosyası (sw.js) sunucudan istendi', istek.slice(i0).some(s => s === 'eski ' + A + 'sw.js'));
  // eski oyun açıldı mı (eski sürümde app/ derleme klasörü yok, Ultra seçeneği yok)
  await bekle(() => !!window.__game && !document.getElementById('loading'), null, 180000, 'eski açılış');
  const eski = await page.evaluate(() => ({ oyun: !!window.__game, ultra: !!document.querySelector('#qSeg button[data-v="ultra"]'), app: [...document.scripts].some(s => s.src.includes('/app/')),
    para: window.__game && window.__game.SAVE && Math.round(window.__game.SAVE.money), kayit: JSON.parse(localStorage.getItem('tp8_save') || 'null') }));
  ok('eski oyun açıldı (derleme klasörü yok, Ultra seçeneği yok)', eski.oyun && !eski.app && !eski.ultra, JSON.stringify({ oyun: eski.oyun, app: eski.app, ultra: eski.ultra }));
  ok('kayıt eski kodda okundu: para aynen', eski.para === 43210, 'para ' + eski.para);
  ok('kayıt kaybolmadı, araç verileri (yakıt/hasar) duruyor', !!eski.kayit && eski.kayit.money === 43210 && JSON.stringify((eski.kayit.veh || {}).f458) === JSON.stringify({ fuel: 0.42, damage: 33 }), JSON.stringify(eski.kayit && eski.kayit.veh && eski.kayit.veh.f458));
  ok('sayfa hatası yok', !hatalar.length, hatalar.slice(0, 2).join(' | '));
} catch (e) { ok('deneme tamamlandı', false, e.message.split('\n')[0]); }
await b.close(); srv.close();
console.log(bad ? `❌ ${bad} kontrol kırmızı` : '✅ tam geri dönüş çalışıyor'); process.exit(bad ? 1 : 0);
