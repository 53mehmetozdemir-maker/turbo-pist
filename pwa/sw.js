// Turbo Pist service worker (şablon). vite.config.js derlemede sürümü ve dosya listesini doldurur.
//
// Kapsam ve önbellek adları: önizleme (/turbo-pist-onizleme/) ve canlı (/turbo-pist/) aynı alan adında;
// CacheStorage alan adı başına ortaktır. Bu yüzden her önbellek adı kapsamın yoluyla başlar
// ("tp|/turbo-pist/|…") ve bu SW yalnızca kendi ön ekindeki önbellekleri okur/siler.
//
// Strateji:
//  - Sayfalar (index.html, klasik.html): önce ağ (5 sn), olmazsa önbellek → çevrimiçiyken hep en yeni HTML.
//  - dist/app/ altındaki her şey içerik özetli (hash) adlı ve değişmez: önce önbellek.
//  - Kurulumda çekirdek dosyalar (DOSYALAR: sayfalar, kod, menüdeki Ferrari, şehir dokuları, yazı tipleri,
//    ikonlar) önbelleğe alınır; bunların çoğu açılışta zaten indiği için tarayıcı önbelleğinden gelir.
//    Diğer araçlar ve HDR'ler (ISTEGE) ilk kullanıldıklarında önbelleğe girer (mobil veriyi boşa harcamamak için).
//  - Güncellemede önceki sürümde aynı adla duran hash'li dosyalar ağdan değil eski önbellekten kopyalanır:
//    sadece değişen iner, daha önce kullanılmış araçlar da yeni sürümde önbellekte kalır.
//  - Yeni sürüm kendiliğinden devreye girmez (skipWaiting yok): sayfa uygun anda (menü/duraklatma,
//    oyuncu "Yenile"ye basınca) SKIP_WAITING mesajı yollar. Yarış ortasında asla.
//  - Acil çıkış: sifirla.html, ?sifirla ve sw.js her zaman ağdan gelir (bu SW onlara karışmaz).
const SURUM = '__SURUM__';
const DOSYALAR = __DOSYALAR__;          // çekirdek: kurulumda (kapsama göre göreli yollar)
const ISTEGE = __ISTEGE__;              // ilk kullanımda; güncellemede eskiden taşınır
const KAPSAM = new URL(self.registration.scope);
const ONEK = 'tp|' + KAPSAM.pathname + '|';
const ONBELLEK = ONEK + 'surum-' + SURUM;
const SAYFALAR = ['', 'index.html', 'klasik.html'];

const tam = rel => new URL(rel, KAPSAM).href;
const benim = ad => ad.startsWith(ONEK);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const yeni = await caches.open(ONBELLEK);
    const eskiler = (await caches.keys()).filter(a => benim(a) && a !== ONBELLEK);
    const al = async (rel, opsiyonel) => {
      const url = tam(rel);
      if (await yeni.match(url)) return;
      let yanit = null;
      // hash'li dosya önceki sürümde varsa onu kopyala (içerik aynı olduğu garanti)
      if (rel.startsWith('app/')) for (const a of eskiler) { yanit = await (await caches.open(a)).match(url); if (yanit) break; }
      if (!yanit) {
        if (opsiyonel) {
          // sayfa bu dosyayı zaten indirdiyse (ör. seçili araç) tarayıcı önbelleğinden al; ağa çıkma
          try { const h = await fetch(url, { cache: 'only-if-cached', mode: 'same-origin' }); if (h.ok) await yeni.put(url, h); } catch (e) {}
          return;
        }
        // hash'li dosyanın içeriği adıyla sabit: tarayıcı önbelleğindeki kopya geçerli (ekstra veri yok);
        // adı sabit dosyalar (sayfalar, ikonlar) sunucuya sorularak tazelenir
        yanit = await fetch(url, { cache: rel.startsWith('app/') ? 'default' : 'no-cache' });
        if (!yanit.ok) throw new Error(rel + ' ' + yanit.status);
      }
      await yeni.put(url, yanit);
    };
    const sira = [...DOSYALAR];   // aynı anda 4 indirme: oyunun kendi yüklemesini boğmasın
    await Promise.all([0, 1, 2, 3].map(async () => { while (sira.length) await al(sira.shift()); }));
    for (const rel of ISTEGE) await al(rel, true);     // sadece eski önbellekte varsa taşı
    // "/" adresi index.html ile aynı sayfa
    const idx = await yeni.match(tam('index.html')); if (idx) await yeni.put(tam(''), idx.clone());
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const a of await caches.keys()) if (benim(a) && a !== ONBELLEK) await caches.delete(a);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data && e.data.tip === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.tip === 'SURUM') e.source && e.source.postMessage({ tip: 'SURUM', surum: SURUM, onbellek: ONBELLEK });
});

async function onbellekte(url) { const c = await caches.open(ONBELLEK); return c.match(url, { ignoreSearch: true }); }

async function sayfa(req, rel) {
  try {
    // no-cache: GitHub Pages her dosyayı 10 dk önbelleklenebilir gönderir; sayfa her seferinde sunucuya
    // doğrulatılır (değişmediyse 304, veri harcamaz). Yoksa güncellemeden sonra eski HTML gelebilirdi.
    const ag = await Promise.race([fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }), new Promise((_, r) => setTimeout(() => r(new Error('zaman aşımı')), 5000))]);
    if (ag.ok) return ag;
    return (await onbellekte(tam(rel))) || ag;
  } catch (err) {
    return (await onbellekte(tam(rel))) || (await onbellekte(tam('index.html'))) || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== KAPSAM.origin || !url.pathname.startsWith(KAPSAM.pathname)) return;
  const rel = url.pathname.slice(KAPSAM.pathname.length);
  if (rel === 'sw.js' || rel === 'sifirla.html' || url.searchParams.has('sifirla')) return;   // acil çıkış: hep ağ
  if (req.mode === 'navigate' || SAYFALAR.includes(rel)) { e.respondWith(sayfa(req, rel || 'index.html')); return; }
  e.respondWith((async () => {
    const c = await onbellekte(req.url); if (c) return c;
    const ag = await fetch(req);
    if (ag.ok && rel.startsWith('app/')) { const k = await caches.open(ONBELLEK); k.put(req.url, ag.clone()); }
    return ag;
  })());
});
