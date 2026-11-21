// ACİL KAPATMA service worker'ı. Normalde KULLANILMAZ.
// Bir sürüm oyuncuları takılı bıraktıysa: yayin.yml'yi "acil_sw_kapat" seçeneğiyle elle çalıştır
// (Actions → yayin → Run workflow → kutucuğu işaretle). O derlemede dist/sw.js bu dosyayla değişir.
// Tarayıcı sw.js'yi her sayfa açılışında ağdan kontrol eder (updateViaCache: 'none'); bunu görünce:
// kendi kapsamındaki önbellekleri siler, kaydını kaldırır ve açık sekmeleri yeniden yükler →
// oyun service worker'sız, doğrudan ağdan açılır. Diğer kapsama (önizleme/canlı) dokunmaz.
const KAPSAM = new URL(self.registration.scope), ONEK = 'tp|' + KAPSAM.pathname + '|';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const a of await caches.keys()) if (a.startsWith(ONEK)) await caches.delete(a);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
  })());
});
