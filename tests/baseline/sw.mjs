// Service worker + güncelleme + acil çıkış testi (Aşama 3).
// Canlı (/turbo-pist/) ve önizleme (/turbo-pist-onizleme/) AYNI sunucuda (aynı alan adı) çalışır;
// sunucu GitHub Pages gibi her dosyaya "max-age=600" gönderir.
// usage: node baseline/sw.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { launch, MIME, HERE_DIR, KAT } from './lib.mjs';
const REPO = path.resolve(HERE_DIR, '../..'), OUT = '/tmp/tp-sw-test';
const A = '/turbo-pist/', B = '/turbo-pist-onizleme/';
function derle(ad, base, env = {}) {
  const dir = path.join(OUT, ad);
  execFileSync('npx', ['vite', 'build', '--base=' + base, '--outDir', dir, '--logLevel', 'error'], { cwd: REPO, env: { ...process.env, ...env }, stdio: 'inherit' });
  return dir;
}
console.log('derleniyor…');
const D = { A1: derle('A1', A, { VITE_SURUM: 'a1' }), A2: derle('A2', A, { VITE_SURUM: 'a2' }), AK: derle('AK', A, { VITE_SURUM: 'ak', ACIL_SW_KAPAT: '1' }), B1: derle('B1', B, { VITE_SURUM: 'b1', VITE_DEPO_ONEK: 'onizleme_' }) };
const mount = { [A]: D.A1, [B]: D.B1 }; let kapali = false; const istek = [];
const srv = http.createServer((q, r) => {
  if (kapali) { q.socket.destroy(); return; }
  let p = decodeURIComponent(q.url.split('?')[0]); istek.push(p);
  const m = Object.keys(mount).find(k => p.startsWith(k)); if (!m) { r.writeHead(404); r.end(); return; }
  let rel = p.slice(m.length); if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const f = path.join(mount[m], rel); if (!f.startsWith(mount[m]) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' }); fs.createReadStream(f).pipe(r);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const URL0 = `http://127.0.0.1:${srv.address().port}`;
// teşhis: hata olursa tarayıcı konsolu ve başarısız istekler yazdırılır (CI'da sebebi görmek için)
const teshis = [];
let tz0 = Date.now(); const zt = () => ((Date.now() - tz0) / 1000).toFixed(1) + 's ';
const izle = c => { c.on('page', p => { p.on('console', m => { if (!/preload/.test(m.text())) teshis.push(zt() + m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => teshis.push('pageerror: ' + e.message.slice(0, 300))); p.on('requestfailed', q => teshis.push(zt() + 'istek başarısız: ' + q.url().slice(0, 200) + ' ' + (q.failure() || {}).errorText)); }); };
const browser = await launch(); const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } }); izle(ctx);
// Bu test çizimi değil service worker davranışını sınar: iki sayfa aynı anda saniyede 60 kare şehir çizince yazılımsal GPU'da
// (SwiftShader) açılışlar dakikalar sürüyordu (iki çekirdekte sayfalar birbirinin işlemcisini yiyor; service worker'ın etkisi yok:
// tek sayfada SW'li ve SW'siz yeniden yükleme aynı süre). Kare hızı saniyede 4'e indirilir; oyun mantığı aynen çalışır.
// Kullanılmayan sayfa "uyutulur" (__tpUyku): hiç kare çizmez, yalnız bekler. Yeniden yüklenince kendiliğinden uyanır.
await ctx.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window);
  const sira = cb => setTimeout(() => window.__tpUyku ? sira(cb) : raf(cb), 250); window.requestAnimationFrame = sira; });
ctx.setDefaultNavigationTimeout(120000 * KAT); ctx.setDefaultTimeout(60000 * KAT);
// 3b için: sekmede __yavasBekci işareti varsa açılış bekçisinin süresi 1 sn
await ctx.addInitScript(() => { try { if (sessionStorage.getItem('__yavasBekci')) window.__tpBekciMs = 1000; } catch (e) {} });
await ctx.route(/fonts\.googleapis|unpkg|peerjs\.com/, r => r.abort());
const sonuc = []; let bad = 0;
const ok = (ad, kosul, ayrinti = '') => { sonuc.push((kosul ? '✅ ' : '❌ ') + ad + (ayrinti ? ' — ' + ayrinti : '')); if (!kosul) bad++; console.log(sonuc.at(-1)); };
const sleep = ms => new Promise(r => setTimeout(r, ms * KAT));   // TP_ZAMAN_KAT (CI'da 2)
// oyunun açılmasını bekle ve süresini yaz (bu test donmuş saat kullanmaz; yavaş makinede açılış uzun sürebilir)
const oyun = async (p, t = 120000) => { const t0 = Date.now(); await p.waitForFunction(() => !!window.__game && !document.getElementById('loading'), null, { timeout: t * KAT, polling: 300 });
  console.log(`   (açılış ${((Date.now() - t0) / 1000).toFixed(1)} sn)`); };
// waitForFunction'a async fonksiyon verilirse dönen Promise 'doğru' sayılıp HİÇ beklemeden geçiyordu (açılışlar yavaşken fark
// edilmedi). Koşul Node tarafında yoklanır.
const swHazir = async (p, t = 90000) => { const son = Date.now() + t * KAT;
  for (;;) { if (await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration('./'); return !!(r && r.active && !r.installing && navigator.serviceWorker.controller); }).catch(() => false)) return;
    if (Date.now() > son) throw new Error('service worker hazır olmadı (' + p.url() + ')'); await new Promise(r => setTimeout(r, 500)); } };
const onbellekler = p => p.evaluate(async () => (await caches.keys()).sort());
const kayitlar = p => p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname).sort());
const gorunur = (p, id) => p.evaluate(id => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && e.offsetParent !== null; }, id);

try {
  // 1) kapsamlar ve önbellek adları karışmıyor
  const pA = await ctx.newPage(); await pA.goto(URL0 + A); await oyun(pA); await swHazir(pA);
  await pA.evaluate(() => localStorage.setItem('tp8_save', JSON.stringify({ v: 1, money: 11111, veh: {}, km: 0, best: {}, econ2: 1 })));
  const pB = await ctx.newPage(); await pB.goto(URL0 + B); await oyun(pB); await swHazir(pB);
  const k1 = await onbellekler(pA);
  ok('iki ayrı service worker kaydı (canlı + önizleme)', JSON.stringify(await kayitlar(pA)) === JSON.stringify([A, B].sort()), JSON.stringify(await kayitlar(pA)));
  ok('canlı sayfayı canlının SW\'si yönetiyor', (await pA.evaluate(() => navigator.serviceWorker.controller.scriptURL)).endsWith(A + 'sw.js'));
  ok('önizleme sayfasını önizlemenin SW\'si yönetiyor', (await pB.evaluate(() => navigator.serviceWorker.controller.scriptURL)).endsWith(B + 'sw.js'));
  ok('önbellek adları kapsamla ön ekli, birer tane', k1.length === 2 && k1.some(a => a.startsWith('tp|' + A + '|surum-')) && k1.some(a => a.startsWith('tp|' + B + '|surum-')), JSON.stringify(k1));
  const bOnbellek = k1.find(a => a.startsWith('tp|' + B));
  // 2) önizleme canlının kaydını okuyor ama ona yazmıyor
  ok('önizleme canlı kaydını okuyor', (await pB.evaluate(() => window.__game.SAVE.money)) === 11111);
  await pB.evaluate(() => { window.__game.SAVE.money = 777; window.__game.saveGame(); });
  const dep = await pB.evaluate(() => ({ canli: JSON.parse(localStorage.getItem('tp8_save')).money, onz: JSON.parse(localStorage.getItem('onizleme_tp8_save')).money }));
  ok('önizleme kendi anahtarına yazıyor, canlı kayıt değişmedi', dep.canli === 11111 && dep.onz === 777, JSON.stringify(dep));
  await pB.evaluate(() => { window.__tpUyku = true; });   // önizleme sayfası 8. adıma kadar beklemede (yeniden yüklenince uyanır)
  // 3) çevrimdışı açılış
  kapali = true; await pA.reload(); await oyun(pA); kapali = false;
  ok('sunucu kapalıyken oyun önbellekten açılıyor', await pA.evaluate(() => !!window.__game && window.__tpSurum === 'a1'));
  // 3b) yavaş açılış (H23): bekçi süresi 1 sn'ye indirilir; açılış ondan uzun sürer ama oyun kodu çalışmaya başladığı için
  //     bozukluk sayılmamalı (önbellek silinmemeli, SW kalmalı). Eskiden yavaş cihazda önbellek silinip her şey baştan iniyordu,
  //     çevrimdışıyken de oyun hiç açılamıyordu.
  //     Kanıt: adım boyunca sunucuya oyun dosyası (app/) isteği gelmez (önbellek sağlamsa hepsi önbellekten) ve bekçi uyarısı çıkmaz.
  //     (Önbellek silinip yeniden kurulsa da aynı adla geri gelir; o yüzden önbellek adına bakmak yetmez.)
  const i0 = istek.length, t0 = teshis.length;
  await pA.evaluate(() => sessionStorage.setItem('__yavasBekci', '1')); await pA.reload(); await oyun(pA);
  await sleep(1500);
  const yavas = await pA.evaluate(async () => ({ denetci: !!navigator.serviceWorker.controller, onbellek: (await caches.keys()).filter(a => a.startsWith('tp|/turbo-pist/|')).length }));
  await pA.evaluate(() => sessionStorage.removeItem('__yavasBekci'));
  yavas.appIstek = istek.slice(i0).filter(u => u.startsWith(A + 'app/')).length; yavas.bekciUyarisi = teshis.slice(t0).filter(m => /Açılış başarısız/.test(m)).length;
  ok('yavaş açılış: bekçi önbelleği silmedi (oyun dosyaları önbellekten geldi), SW duruyor', yavas.appIstek === 0 && yavas.bekciUyarisi === 0 && yavas.denetci && yavas.onbellek === 1, JSON.stringify(yavas));
  // 4) yeni sürüm: serbest sürüşte ve yarışta zorla yenileme yok; uyarı sadece menü/serbest duraklatmada
  mount[A] = D.A2; await pA.evaluate(() => { window.__isaret = 1; window.__game.startFree(); });
  await swHazir(pA); await pA.evaluate(() => window.__tpSW.update());
  await pA.waitForFunction(() => !!(window.__tpSW && window.__tpSW.waiting), null, { timeout: 90000 * KAT, polling: 500 });
  await sleep(3000);
  ok('yeni sürüm indi, serbest sürüşte sayfa yenilenmedi, uyarı ekranda yok', await pA.evaluate(() => window.__isaret === 1 && window.__game.mode === 'free') && !(await gorunur(pA, 'updPause')) && !(await gorunur(pA, 'updMenu')));
  await pA.keyboard.press('Escape');
  await pA.waitForFunction(() => !document.getElementById('pause').classList.contains('hidden'), null, { timeout: 10000 * KAT, polling: 100 }).catch(() => {});
  await sleep(300);
  const d4 = await pA.evaluate(() => ({ mod: window.__game.mode, duraklat: !document.getElementById('pause').classList.contains('hidden'), dugme: document.getElementById('updPause').className, bekleyen: !!window.__tpSW.waiting }));
  ok('serbest sürüş duraklatmasında "Kaydet ve yenile" görünüyor', await gorunur(pA, 'updPause'), JSON.stringify(d4));
  await pA.click('#pauseMenuBtn'); await sleep(500);
  ok('ana menüde "Yeni sürüm hazır" görünüyor', await gorunur(pA, 'updMenu'));
  await pA.click('#mSeg button[data-v="track"]').catch(() => {}); await pA.click('#soloBtn'); await sleep(800);
  const gs = await pA.evaluate(() => window.__game.mode); await pA.keyboard.press('Escape'); await sleep(300);
  // oyun geri sayımda duraklatmaz; uyarı hiçbir yerde görünmemeli, gizli düğmeye zorla basılsa da yenilenmemeli
  ok('geri sayımda uyarı yok', gs === 'countdown' && !(await gorunur(pA, 'updPause')) && !(await gorunur(pA, 'updMenu')), 'mod=' + gs);
  await pA.evaluate(() => { document.getElementById('updPause').click(); document.getElementById('updMenu').click(); });
  await sleep(2000); ok('geri sayımda "Yenile"ye zorla basılsa da yenilenmedi', await pA.evaluate(() => window.__isaret === 1));
  await pA.waitForFunction(() => window.__game.mode === 'race', null, { timeout: 60000 * KAT, polling: 300 });
  await pA.keyboard.press('Escape');
  await pA.waitForFunction(() => !document.getElementById('pause').classList.contains('hidden'), null, { timeout: 10000 * KAT, polling: 100 }).catch(() => {});
  await sleep(300);
  const d5 = await pA.evaluate(() => ({ mod: window.__game.mode, duraklat: !document.getElementById('pause').classList.contains('hidden'), dugme: document.getElementById('updPause').className }));
  ok('yarış duraklatmasında uyarı yok', d5.mod === 'race' && d5.duraklat && !(await gorunur(pA, 'updPause')), JSON.stringify(d5));
  await pA.keyboard.press('Escape'); await sleep(6000);
  ok('yarış sürerken sayfa yenilenmedi', await pA.evaluate(() => window.__isaret === 1 && window.__game.mode === 'race'));
  await pA.keyboard.press('Escape'); await pA.click('#pauseMenuBtn'); await sleep(500);
  await pA.click('#mSeg button[data-v="city"]').catch(() => {});
  const nav = pA.waitForNavigation({ timeout: 60000 * KAT }); await pA.click('#updMenu'); await nav; await oyun(pA);
  ok('menüde "Yenile" → yeni sürüm açıldı', await pA.evaluate(() => window.__tpSurum === 'a2' && window.__isaret === undefined));
  await swHazir(pA); const k2 = await onbellekler(pA);
  ok('canlının eski sürüm önbelleği silindi, önizlemeninki yerinde', k2.filter(a => a.startsWith('tp|' + A)).length === 1 && !k1.includes(k2.find(a => a.startsWith('tp|' + A))) && k2.includes(bOnbellek), JSON.stringify(k2));
  // 5) acil çıkış 1: önbellekteki oyun kodu bozuk → açılış bekçisi temizleyip ağdan açar
  const ana = await pA.evaluate(() => document.querySelector('link[rel=modulepreload][href*="/app/main-"]').href);
  await pA.evaluate(async u => { const ad = (await caches.keys()).find(a => a.startsWith('tp|/turbo-pist/|')); await (await caches.open(ad)).put(u, new Response('throw new Error("bozuk sürüm")', { headers: { 'Content-Type': 'text/javascript' } })); }, ana);
  await pA.reload(); await oyun(pA, 180000);
  const kurtar = await pA.evaluate(async () => ({ oyun: !!window.__game, bayrak: sessionStorage.getItem('tp_kurtarma'), denetci: !!navigator.serviceWorker.controller }));
  ok('bozuk önbellek: bekçi önbelleği temizledi, oyun ağdan açıldı', kurtar.oyun && kurtar.bayrak === null, JSON.stringify(kurtar));
  ok('bozuk önbellek kurtarması önizlemeye dokunmadı', (await onbellekler(pA)).includes(bOnbellek) && (await kayitlar(pA)).includes(B));
  // 6) acil çıkış 2: ?sifirla
  await swHazir(pA); const para = await pA.evaluate(() => localStorage.getItem('tp8_save'));
  await pA.goto(URL0 + A + '?sifirla'); await pA.waitForURL(/sifirla\.html/, { timeout: 30000 * KAT });
  await pA.waitForFunction(() => /Tamam/.test(document.getElementById('durum').textContent), null, { timeout: 30000 * KAT, polling: 50 });
  const s6 = { kayit: await kayitlar(pA), onb: await onbellekler(pA) };   // oyun açılıp SW'yi yeniden kurmadan önce
  await pA.waitForURL(URL0 + A, { timeout: 30000 * KAT }); await oyun(pA);
  ok('?sifirla: canlının SW\'si ve önbelleği kalktı, oyun açıldı', !s6.kayit.includes(A) && !s6.onb.some(a => a.startsWith('tp|' + A)), JSON.stringify(s6));
  ok('?sifirla: önizlemenin SW\'si ve önbelleği yerinde', s6.kayit.includes(B) && s6.onb.includes(bOnbellek));
  ok('?sifirla: kayıt silinmedi', (await pA.evaluate(() => localStorage.getItem('tp8_save'))) === para);
  // 7) acil çıkış 3: sunucudan acil kapatma SW'si
  await swHazir(pA); mount[A] = D.AK;
  await pA.reload();
  // kapatma SW'si devreye girince sekmeyi bir kez daha yeniler: durum oturana kadar bekle
  let s7 = {}; for (let i = 0; i < 90; i++) { await sleep(2000); try { s7 = await pA.evaluate(async () => ({ oyun: !!window.__game && !document.getElementById('loading'), kayit: (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname), onb: await caches.keys(), denetci: !!navigator.serviceWorker.controller, surum: window.__tpSurum })); } catch (e) { continue; } if (s7.oyun && !s7.denetci && !s7.kayit.includes('/turbo-pist/')) break; }
  ok('acil kapatma: canlıda SW yok, önbellek yok, oyun ağdan açık', !s7.kayit.includes(A) && !s7.onb.some(a => a.startsWith('tp|' + A)) && !s7.denetci && s7.surum === 'ak', JSON.stringify(s7));
  await sleep(5000);
  ok('acil kapatma: döngüye girmedi (yeniden kayıt yok)', !(await kayitlar(pA)).includes(A));
  // 8) önizleme her şeyden sonra sağlam
  await pB.reload(); await oyun(pB); await swHazir(pB);
  ok('önizleme sağlam: kendi SW\'si ve aynı önbellek', (await pB.evaluate(() => window.__tpSurum)) === 'b1' && (await onbellekler(pB)).includes(bOnbellek));
} catch (e) { ok('test tamamlandı', false, e.message.split('\n')[0]); console.log('--- teşhis (son 40) ---\n' + teshis.slice(-40).join('\n'));
  console.log('--- sunucuya gelen son istekler ---\n' + istek.slice(-25).join('\n'));
  for (const p of ctx.pages()) try { console.log('--- sayfa', p.url(), JSON.stringify(await p.evaluate(async () => {
    const ks = await caches.keys(); const ic = {}; for (const k of ks) ic[k] = (await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname.split('/').pop()).sort();
    return { yukleme: (document.getElementById('loading') || {}).textContent, oyun: !!window.__game, surum: window.__tpSurum, yonetici: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL, onbellek: ic };
  }))); } catch (e2) { console.log('sayfa okunamadı', e2.message); } }
await browser.close(); srv.close();
console.log(`\n${sonuc.length - bad}/${sonuc.length} geçti`); process.exit(bad ? 1 : 0);
