// Ultra ↔ Yüksek (Aşama 5): aynı sahne, aynı kare — Ferrari 458, şehir, gündüz, fren lambaları yanık (el freni) ve
// egzoz alevi (nitro) anında. Ultra'nın tek farkı ortam gölgelendirmesi (GTAO) olmalı. GTAO sahneyi yalnız KOYULAŞTIRIR:
// İki ölçü: (1) Ultra'da Yüksek'ten belirgin biçimde DAHA PARLAK piksel (ışık halesi, yola yayılan parlama) hata.
// (2) Işık/efektlerin görüntüye KATKISI aynı kalmalı: her kalitede aynı kare bir kez saydam/efekt malzemeleri gizlenerek,
// bir kez tam çizilir; fark = efektin katkısı (alev, lamba parıltısı, kıvılcım, yola vuran kırmızı bloom). Bu katkı Ultra'da
// Yüksek'ten farklıysa (alev kararmış, hale büyümüş) hata. Altındaki katı yüzeyin koyulaşması (GTAO) serbesttir.
// Işık efektleri toplamalı karışımla çizilir: katkıları arka plandan bağımsızdır, bu yüzden birebir aynı kalmalıdır. (Cam gibi
// normal saydam yüzeylerin katkısı arka plana bağlıdır; arka plan GTAO ile koyulaşınca doğal olarak değişir, ölçüye girmez.)
// Gündüz ve gece ayrı ayrı denenir (gece fren ışığı parıltısı baskındır).
// usage: node baseline/ultra.mjs [ZAMAN=day|night]      (görüntüler: out/screens/ultra/)
import fs from 'node:fs'; import path from 'node:path'; import { PNG } from 'pngjs';
import { serve, launch, gamePage, HERE_DIR, KAT } from './lib.mjs';
const OUTD = path.join(HERE_DIR, '../out/screens/ultra'); fs.mkdirSync(OUTD, { recursive: true });
const ESIK = 45, SINIR = 0.2, EFEKT_SINIR = 2, IZ = 30;   // RGB toplamında 45'ten fazla fark; parlama görüntünün en fazla %0,2'si; efekt katkısı piksellerinin en fazla %2'si değişebilir; katkı >30 olan piksel efekt izidir
// %2 payı: ton eşleme ve bloom eşiği doğrusal değil; aynı ışık GTAO ile koyulaşan zeminde ekranda bir tık belirgin görünür
// (doğru sonuç: gece 15 piksellik tek satır, %1,1). Hatalı derlemeler %7–29 arası çıkar.
const { srv, url } = await serve(); const b = await launch(); let hepsi = true;
for (const zaman of (process.env.ZAMAN || 'day,night').split(',')) {
const shot = {}, efektsiz = {}; const bilgi = {}; const ek = zaman === 'day' ? '' : '_' + zaman;
for (const q of ['high', 'ultra']) {
  const { ctx, page, log } = await gamePage(b, url, { storage: { tp3_quality: q, tp7_veh: 'f458', tp3_cam: '0', tp4_time: zaman, tp6_wx: 'clear' }, viewport: { width: 640, height: 360 } });
  await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 180000, polling: 300 });
  // kareler birer birer ilerletilir (bu ortamda çok kareli __run(n) bazen takılıyor)
  const kare = async n => { for (let i = 0; i < n; i++) await page.evaluate(() => window.__run(1)); };
  // oyunun gerçek zamanlı zamanlayıcıları (setTimeout) donmuş test saatine bağlı değil: kareler yavaş ilerleyen kalitede
  // farklı karelere denk gelip sahneyi ayrıştırmasın diye, araç yerleştirilmeden önce gerçek zamanda beklenir
  await page.evaluate(() => window.__game.startFree()); await kare(3); await page.waitForTimeout(8000 * KAT);
  await page.evaluate(() => { const P = window.__game.phys; P.reset(150, 3.5, 0); P.vx = P.vy = 0; P.nitro = 1; }); await kare(30);   // kamera aracın arkasına yumuşak geçişle oturur
  // tuşlar sayfaya ULAŞMADAN kare ilerletilmez (sayfa gölgelendirici derlerken meşgulse tuş olayı gecikir → kareler tuşsuz geçer)
  await page.evaluate(() => { window.__tus = new Set(); addEventListener('keydown', e => window.__tus.add(e.code), true); });
  for (const k of ['KeyW', 'KeyN', 'Space']) await page.keyboard.down(k);
  await page.waitForFunction(() => ['KeyW', 'KeyN', 'Space'].every(k => window.__tus.has(k)), null, { timeout: 120000, polling: 100 });
  await kare(8);   // alev ve fren lambası ilk karelerde yanar
  bilgi[q] = await page.evaluate(() => { const g = window.__game; return { kalite: g.quality, nitro: g.phys.nitroOn, el: +g.phys.hand.toFixed(2), gtao: !!(g.composer && g.composer.passes.some(p => p.gtaoMaterial)) }; });
  // aynı karede (kare ilerletmeden) yeniden çiz: bir kez tam, bir kez ışık efektleri (toplamalı malzemeler) gizli
  const ciz = gizle => page.evaluate(g0 => { const g = window.__game, gz = [];
    if (g0) g.scene.traverse(o => { for (const m of [].concat(o.material || [])) if (m.visible && m.blending === 2 /* THREE.AdditiveBlending */) { m.visible = false; gz.push(m); } });
    try { g.composer ? g.composer.render() : g.renderer.render(g.scene, g.camera); } finally { for (const m of gz) m.visible = true; } }, gizle);
  await ciz(false); shot[q] = await page.screenshot(); fs.writeFileSync(path.join(OUTD, q + ek + '.png'), shot[q]);
  await ciz(true); efektsiz[q] = await page.screenshot(); fs.writeFileSync(path.join(OUTD, q + ek + '_efektsiz.png'), efektsiz[q]);
  bilgi[q].hata = log.filter(l => !/ERR_|Failed to load/.test(l)).length;
  await ctx.close();
}
const H = PNG.sync.read(shot.high), U = PNG.sync.read(shot.ultra), H0 = PNG.sync.read(efektsiz.high), U0 = PNG.sync.read(efektsiz.ultra);
const D = new PNG({ width: H.width, height: H.height });
let parlak = 0, koyu = 0, efekt = 0, efektBozuk = 0;
for (let i = 0; i < H.data.length; i += 4) {
  let d = 0, iz = 0, kd = 0;
  for (let c = 0; c < 3; c++) { const cH = H.data[i + c] - H0.data[i + c], cU = U.data[i + c] - U0.data[i + c];
    d += U.data[i + c] - H.data[i + c]; iz += Math.abs(cH); kd += Math.abs(cU - cH); }
  const e = iz > IZ; if (e) { efekt++; if (kd > ESIK) efektBozuk++; }
  const p = d > ESIK, k = d < -ESIK; if (p) parlak++; if (k) koyu++;
  const kirmizi = p || (e && kd > ESIK);
  D.data[i] = kirmizi ? 255 : H.data[i] * 0.3; D.data[i + 1] = (!kirmizi && k) ? 160 : H.data[i + 1] * 0.3; D.data[i + 2] = (!kirmizi && e) ? 200 : H.data[i + 2] * 0.3; D.data[i + 3] = 255;
}
fs.writeFileSync(path.join(OUTD, 'fark' + ek + '.png'), PNG.sync.write(D));   // kırmızı: hata (parlama ya da değişen efekt katkısı), mavi: efekt izi (değişmemiş), yeşil: GTAO koyulaşması
const n = H.width * H.height, pp = 100 * parlak / n, kp = 100 * koyu / n, ep = efekt ? 100 * efektBozuk / efekt : 0;
const kosul = bilgi.high.nitro && bilgi.ultra.nitro && bilgi.high.el > 0 && bilgi.ultra.gtao && !bilgi.high.gtao && efekt > 50;
console.log(`— ${zaman === 'day' ? 'gündüz' : 'gece'} —`); console.log('durum:', JSON.stringify(bilgi));
console.log(`Ultra'da daha parlak piksel: %${pp.toFixed(2)} (sınır %${SINIR}) · efekt izi ${efekt} piksel, katkısı değişen %${ep.toFixed(1)} (sınır %${EFEKT_SINIR}) · koyulaşan (GTAO): %${kp.toFixed(2)}`);
const ok = kosul && pp <= SINIR && ep <= EFEKT_SINIR && !bilgi.high.hata && !bilgi.ultra.hata;
console.log(ok ? '✅ Ultra, Yüksek ile aynı; tek fark ortam gölgelendirmesi' : '❌ Ultra ışıkları/efektleri değiştiriyor' + (kosul ? '' : ' (ya da senaryo kurulamadı)'));
hepsi = hepsi && ok;
}
await b.close(); srv.close();
process.exit(hepsi ? 0 : 1);
