# turbo-pist

Turbo Pist 3D — tarayıcıda çalışan three.js yarış/serbest sürüş oyunu.
(Ayrıntılı tanıtım Aşama 7'de eklenecek.)

## Geliştirme

Gerekenler: Node.js 22.12 veya üstü.

```
npm ci            # bağımlılıklar (sürümler package-lock.json'da sabit)
npm run dev       # http://localhost:5173/turbo-pist/ — kaydettikçe yenilenir
npm run build     # dist/ klasörüne derler
npm run preview   # derlenmiş hali yerelde açar
```

- `index.html` ana oyun, `klasik.html` eski 2D sürüm; ikisi de derlenir.
- three.js, PeerJS ve yazı tipleri (Bungee, Inter) npm'den gelir; dışarıdan (unpkg, Google Fonts) bir şey yüklenmez.
- Modeller, dokular ve HDR'ler kodda `new URL('../assets/…', import.meta.url)` ile gösterilir; derlenen her şey `dist/app/` altına hash'li adla çıkar.
  Yeni bir asset eklerken de bu kalıbı kullan (düz `'assets/…'` yazısı derlemeye girmez).
- Açılışta gereken dosyalar (Ferrari, şehir dokuları, Draco çözücü, three, oyun kodu) HTML'de önceden istenir (`vite.config.js` → `ON_YUKLE`).

## Yayın

- `main`'e push → `.github/workflows/yayin.yml` derleyip GitHub Pages'e yayınlar.
- Önizleme: https://53mehmetozdemir-maker.github.io/turbo-pist-onizleme/ (ayrı repo).

## Çevrimdışı oyun ve güncellemeler (service worker)

- Oyun ilk açılıştan birkaç saniye sonra kendini önbelleğe alır; sonra internetsiz de açılır.
  Menüdeki Ferrari, kod, dokular ve yazı tipleri hemen; diğer araçlar ve gökyüzü dosyaları ilk kullanıldıklarında.
- Yeni sürüm yayınlanınca arka planda iner. Oyun **asla kendiliğinden yenilenmez**: "🔄 Yeni sürüm hazır"
  düğmesi sadece ana menüde ve serbest sürüşün duraklatma ekranında görünür (yarışta/geri sayımda görünmez).
- Önizleme ve canlı aynı alan adında: service worker'lar ve önbellekler kapsam yoluna göre ayrılır
  (`tp|/turbo-pist/|…`). Önizleme derlemesi kayıtları `onizleme_` ön ekiyle yazar; canlı kaydı okur ama ona yazmaz.
- Kayıt biçiminin sürümü var (`js/save.js`); eski kayıtlar otomatik yükseltilir, daha yeni sürümün kaydı bozulmaz.

### Acil çıkış (bir sürüm oyuncuları takılı bırakırsa)
1. **Kendiliğinden:** oyun önbellekten açılamazsa (hata ya da 45 sn) bir kez önbelleği temizleyip ağdan açar.
2. **Oyuncu:** adrese `?sifirla` ekler (ör. `…/turbo-pist/?sifirla`) ya da `…/turbo-pist/sifirla.html` açar.
   Service worker ve önbellek silinir, kayıtlar kalır.
3. **Herkes için, sunucudan:** GitHub → Actions → **yayin** → Run workflow → **acil_sw_kapat** kutusunu işaretle → Run.
   O yayın bütün oyuncularda service worker'ı kaldırır, oyun doğrudan ağdan açılır. Sorun düzelince normal yayın yap
   (kutusuz); service worker yeniden kurulur.

## Çok oyunculu

- PeerJS (WebRTC, eşler arası). Odayı ilk açan kurucu (host) olur, trafiği o simüle eder.
- Bağlantı kurulamayan ağlar (mobil veri, sıkı NAT) için TURN: Metered ücretsiz deneme planı (**ayda sadece 500 MB**),
  Cloudflare Worker üzerinden (`worker/README.md`): https://turbo-pist-turn.53mehmetozdemir.workers.dev/ice.
  Kota dolarsa oyun STUN'a düşer (çoğu ağda oynanır); TURN'ün şart olduğu ağlarda bağlantı kurulamaz. API anahtarı Worker'da gizli; oyunun koduna/repoya girmez. Worker adresi derlemede
  `VITE_TURN_URL` ile verilir; boşsa sadece STUN.
- Protokol sürümü (`js/net.js` → `PROTO`): mesajlara yalnız alan eklenir; farklı sürümdeki oyunculara
  "sayfayı yenile" uyarısı çıkar. Uyumsuz değişiklikte `PROTO_ANA` artırılır (oda ön eki değişir).
- Önizleme derlemesi `VITE_ODA_ONEK=onizleme-` ile ayrı odalarda oynar.

## Testler

`tests/baseline/README.md` — fizik, görsel, kayıt, klavye kısayolu, service worker ve performans testleri.
Derlenmiş oyuna karşı çalıştırmak için: `npx vite build --base=/ --outDir /tmp/dist-test` ve ardından `GAME_ROOT=/tmp/dist-test node baseline/<test>.mjs check`.
