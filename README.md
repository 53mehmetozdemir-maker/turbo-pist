# Turbo Pist 3D

Tarayıcıda çalışan, kurulum gerektirmeyen bir 3B sürüş oyunu (three.js). Şehirde serbest dolaş, pistte yarış,
arkadaşlarınla aynı şehirde birlikte sür. Bilgisayarda klavye ya da oyun koluyla, telefonda dokunmatik kontrollerle oynanır;
ilk açılıştan sonra internetsiz de açılır.

- **Oyna:** https://53mehmetozdemir-maker.github.io/turbo-pist/
- **Önizleme (yayına girmemiş sürüm):** https://53mehmetozdemir-maker.github.io/turbo-pist-onizleme/
- Eski 2B sürüm: `…/turbo-pist/klasik.html`

## Oyunda neler var

- **7 araç:** Ferrari 458 Spider, Ferrari F40, Porsche 911 GT3 (992), Honda Civic Type R (FK8), Tesla Model 3 Performance,
  Peugeot e-2008, Suzuki GSX-R 750 (motosiklet). Her birinin kendi motor, vites ve tork değerleri ve sentezlenmiş motor sesi var.
  Kokpitte çalışan göstergeler ve gerçek yansımalı aynalar, 8 boya rengi, nitro, egzoz alevi.
- **Fizik:** saniyede 120 adım. Lastik modeli, yüzeye göre tutuş (asfalt, kaldırım, çim, ıslak yol), yokuşlar,
  çarpışmalar ve sürüşü etkileyen hasar (göçük, çatlak cam, kırık far). Otomatik ya da manuel vites, el freniyle drift,
  burnout. Sürüş yardımları açılıp kapatılabilir.
- **Şehir ve çevresi:** 10×10 bloklu şehir, sokak ve semt adları, trafik ışıkları. Çevre otoyolu, sahil yolu ve plaj,
  Kartal Tepe dağ yolu ve zirve terası, drift parkı. Gündüz, akşam ve gece; açık ya da yağmurlu hava.
- **Canlı şehir:** ışıklara uyan, sinyal veren, korna çalan trafik; yaya geçidinden geçen yayalar. Çarpılan araç savrulur
  ve dörtlülerini yakar.
- **Ekonomi:** sürdükçe ve drift yaptıkça para kazanılır. Benzinlik ve şarj istasyonu, tamirci, çekici. Yakıt ve hasar
  kayıtlı kalır.
- **Harita:** dönen mini harita, büyük harita (M), yol ağı üzerinde GPS rotası ve hedef işareti.
- **Yarış:** pist haritasında geri sayım, tur ve sıra göstergesi, kontrol noktaları, araç başına rekor.
- **Çok oyunculu:** oda kodu ya da davet linkiyle (`?oda=KOD`) aynı şehirde birlikte sürüş. Trafik herkeste aynı.

## Kontroller

| Tuş | İşlev | Tuş | İşlev |
|---|---|---|---|
| W / ↑ | gaz | C | kamera: takip → kokpit → kaput |
| S / ↓ | fren; dururken geri | L | farlar |
| A D / ← → | direksiyon | H | korna |
| Space | el freni | M | büyük harita |
| N / Shift | nitro | R | yola geri dön |
| E X / Q Z | manuel vites yükselt / düşür | T | arkadaşının yanına git |
| F | benzinlikte yakıt al, tamircide tamir | G | çekici (yakıt bitince) |
| K | ses aç / kapat | Esc | duraklat |

Fareyle etrafa bakılabilir; oyun kolu da desteklenir. **Telefonda:** analog direksiyon pedi (ya da telefonu eğerek
sürüş), gaz ve fren pedalları, el freni, nitro, korna ve vites tuşları. Ekran yatay tutulmalıdır.

**Grafik kalitesi:** Düşük, Orta, Yüksek, Ultra. İlk açılışta cihaza göre otomatik seçilir, menüden değiştirilir.
Ultra, Yüksek'e ek olarak yalnızca ortam gölgelendirmesi (GTAO) ekler; ışıklar ve efektler Yüksek'le aynıdır.

## Geliştirme

Gerekenler: Node.js 22.12 veya üstü.

```
npm ci            # bağımlılıklar (sürümler package-lock.json'da sabit)
npm run dev       # http://localhost:5173/turbo-pist/ — kaydettikçe yenilenir
npm run build     # dist/ klasörüne derler
npm run preview   # derlenmiş hali yerelde açar
```

| Klasör / dosya | İçerik |
|---|---|
| `index.html` | ana oyun: arayüz, yükleme ekranı, açılış bekçisi |
| `js/main.js` | oyun döngüsü, sahne, kamera, menü ve HUD |
| `js/physics.js` · `vehicles.js` | araç fiziği · araç tanımları (motor, vites, ses profili) |
| `js/city.js` · `regions.js` · `track.js` | şehir · şehir dışı bölgeler (otoyol, sahil, dağ, drift parkı) · yarış pisti |
| `js/traffic.js` · `services.js` · `route.js` | trafik ve yayalar · benzinlik, tamirci, çekici · GPS rotası |
| `js/net.js` | çok oyunculu (PeerJS) |
| `js/save.js` · `surum.js` | sürümlü kayıt · service worker kaydı ve güncelleme uyarısı |
| `assets/` | araç modelleri, dokular, HDR gökyüzleri |
| `pwa/` | service worker şablonu ve acil kapatma sürümü |
| `klasik.html` | eski 2B sürüm (tek dosya) |
| `worker/` | TURN için Cloudflare Worker (`worker/README.md`) |
| `tests/` | altın testler (`tests/baseline/README.md`) |

- three.js, PeerJS ve yazı tipleri (Bungee, Inter) npm'den gelir; dışarıdan (unpkg, Google Fonts) bir şey yüklenmez.
- Modeller, dokular ve HDR'ler kodda `new URL('../assets/…', import.meta.url)` ile gösterilir; derlenen her şey `dist/app/`
  altına hash'li adla çıkar. Yeni bir asset eklerken de bu kalıbı kullan (düz `'assets/…'` yazısı derlemeye girmez).
- Açılışta gereken dosyalar (Ferrari, şehir dokuları, Draco çözücü, three, oyun kodu) HTML'de önceden istenir
  (`vite.config.js` → `ON_YUKLE`).
- Repoya ve oyunun koduna hiçbir gizli anahtar girmez.

## Yayın akışı

```
altyapi / iş dalı ──push──▶ testler (CI)
        │
        ├─▶ önizleme: turbo-pist-onizleme reposundaki KAYNAK dosyasına commit kimliği yazılır
        │      → o commit'in testleri koşar → yeşilse derlenip önizlemeye yayınlanır
        │
        └─▶ main'e birleştirme (yalnız onayla) → testler → yeşilse canlıya yayın + yayin-YYYYMMDD-HHMM etiketi
```

- **Testler yayının kapısıdır:** bir test kırmızıysa ne önizleme ne canlı yayın başlar (`.github/workflows/testler.yml`).
  Tek istisna, aşağıdaki acil service worker kapatmadır.
- **Önizleme:** ayrı repo, aynı alan adı. Kayıtları `onizleme_` ön ekiyle yazar (canlı kaydı okur ama ona yazmaz),
  çok oyunculuda ayrı odalarda oynar, service worker'ı ve önbelleği canlıdan ayrıdır.
- **Geri dönüş:** her canlı yayın `yayin-YYYYMMDD-HHMM` etiketi alır. Önceki bir sürüme dönmek için geçmişi
  silmeden o etiketin içeriğini yeni bir commit olarak main'e alın:
  ```
  git switch main && git pull
  git restore --source=yayin-YYYYMMDD-HHMM --staged --worktree .
  git commit -m "Geri dönüş: yayin-YYYYMMDD-HHMM" && git push
  ```
  Bu push normal yayın gibi önce testlerden geçer.

## Çevrimdışı oyun ve güncellemeler (service worker)

- Oyun ilk açılıştan birkaç saniye sonra kendini önbelleğe alır; sonra internetsiz de açılır.
  Menüdeki Ferrari, kod, dokular ve yazı tipleri hemen; diğer araçlar ve gökyüzü dosyaları ilk kullanıldıklarında.
- Yeni sürüm yayınlanınca arka planda iner. Oyun **asla kendiliğinden yenilenmez**: "🔄 Yeni sürüm hazır"
  düğmesi yalnızca ana menüde ve serbest sürüşün duraklatma ekranında görünür (yarışta ve geri sayımda görünmez).
- Önizleme ve canlının service worker'ları ve önbellekleri kapsam yoluna göre ayrılır (`tp|/turbo-pist/|…`).
- Kayıt biçiminin sürümü var (`js/save.js`); eski kayıtlar otomatik yükseltilir, daha yeni sürümün kaydı bozulmaz,
  okunamayan kayıt silinmeden yedeklenir.

### Acil çıkış (bir sürüm oyuncuları takılı bırakırsa)
1. **Kendiliğinden:** önbellekten gelen sayfa açılamazsa bir kez önbelleği temizleyip ağdan açar. "Açılamadı" sayılan
   durumlar: bir yükleme hatası ya da oyun kodunun 45 saniyede hiç çalışmaya başlamaması. Yavaş açılış bozukluk
   sayılmaz; çevrimdışıyken önbellek hiç silinmez.
2. **Oyuncu:** adrese `?sifirla` ekler (ör. `…/turbo-pist/?sifirla`) ya da `…/turbo-pist/sifirla.html` açar.
   Service worker ve önbellek silinir, kayıtlar kalır.
3. **Herkes için, sunucudan:** GitHub → Actions → **yayin** → Run workflow → **acil_sw_kapat** kutusunu işaretle → Run.
   O yayın bütün oyuncularda service worker'ı kaldırır ve oyun doğrudan ağdan açılır. Testleri beklemez, çünkü acil
   çıkış her zaman çalışmalıdır. Sorun düzelince normal yayın yapın (kutusuz); service worker yeniden kurulur.

## Çok oyunculu

- PeerJS (WebRTC, eşler arası). Odayı ilk açan kurucu (host) olur, trafiği o simüle eder.
- Bağlantı kurulamayan ağlar (mobil veri, sıkı NAT) için TURN: Metered ücretsiz deneme planı (**ayda yalnızca 500 MB**),
  Cloudflare Worker üzerinden (`worker/README.md`): https://turbo-pist-turn.53mehmetozdemir.workers.dev/ice.
  Kota dolarsa oyun STUN'a düşer (çoğu ağda oynanır); TURN'ün şart olduğu ağlarda bağlantı kurulamaz ve oyuncuya
  "Wi-Fi'da tekrar dene" önerisi gösterilir. API anahtarı Worker'da gizlidir. Worker adresi derlemede `VITE_TURN_URL` ile
  verilir; boşsa yalnızca STUN.
- Protokol sürümü (`js/net.js` → `PROTO`): mesajlara yalnızca alan eklenir, eski sürümler yeni mesajları okuyabilir;
  farklı sürümdeki oyunculara "sayfayı yenile" uyarısı çıkar. Uyumsuz bir değişiklikte `PROTO_ANA` artırılır
  (oda ön eki değişir, eski ve yeni sürüm aynı odaya düşmez).

## Testler

Oyunun bugünkü davranışını "altın referans" olarak saklayan ve her değişiklikte onunla karşılaştıran testler:
fizik (7 araç, birebir aynı sonuç), klavye kısayolları, kayıt, 35 görüntülük görsel karşılaştırma, menü yerleşimi
(6 ekran boyutu), büyük harita, Ultra ↔ Yüksek, service worker ve çevrimdışı açılış, çok oyunculu (eski ↔ yeni sürüm
uyumu dahil), TURN Worker, sağlamlık, bellek ve performans.

- GitHub'da her push'ta ve her yayından önce 14 test paralel koşar (`.github/workflows/testler.yml`); elle yalnız seçili
  testler de koşturulabilir (Actions → testler → Run workflow → `sadece: sw,mp`).
- Testler her yerde aynı tarayıcı (Chrome for Testing 153.0.8010.12), aynı yazılımsal grafik sürücüsü (SwiftShader) ve
  aynı yazı tipleriyle çalışır; yerel ve GitHub sonuçları piksel piksel aynıdır.
- Yerelde çalıştırma, referans güncelleme ve her testin ayrıntısı: `tests/baseline/README.md`.

## Bilinen sorunlar

`tests/baseline/HATALAR.md`: bulunan hatalar ve durumları. Altyapı işinden sonra ele alınacak oyun düzeltmeleri
"Oyun düzeltmeleri — altyapı sonrası" başlığındadır (araç sorunları M/P/C ve çizim sorunu G1).

## Krediler

3B modeller: Ferrari 458 Italia – vicent091036 (three.js örnekleri) · Ferrari F40 – Black Snow · Tesla Model 3 ve
Peugeot e-2008 – David_Holiday (Sketchfab, CC-BY-4.0) · Honda Civic Type R FK8 – CGTrader (ücretsiz) · Porsche 911 GT3 ve
Suzuki GSX-R 750 – oyuncunun gönderdiği modeller · Gökyüzü: Poly Haven (CC0). Oyunun menüsünde de listelenir.
