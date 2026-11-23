# Altın referans (main @ e771e2a)

Bu klasördeki her şey değişiklik yapılmadan önceki oyundan kaydedildi. Her aşamadan sonra hepsi yeniden koşturulur; tek bir kırmızı bile varsa sonraki aşamaya geçilmez.

| Dosya | Ne |
|---|---|
| OZELLIKLER.md | Tüm özelliklerin envanteri (her aşamada işaretlenir) |
| HATALAR.md | Bilinen hatalar ve hangi aşamada düzeltilecekleri |
| physics.json | 7 araç × 30 sn × 120 Hz fizik izi (gaz, viraj, el freni, nitro, fren, geri, duvara ve araca çarpma); her adımın SHA-256 özeti |
| screens/*.png | 35 sabit ekran görüntüsü (her araç takip+kokpit, kaput, saat/hava, pist, bölgeler, servisler, harita, duraklatma, telefon, 1366×768 menü) |
| saves/*.json + saves_expected.json | Gerçek kayıt örnekleri ve yüklenince beklenen değerler |
| perf.json | İndirme boyutu, açılış süresi; 7 sahnede çizim çağrısı, üçgen, bellek, kare başına JS süresi |

## Çalıştırma
```
cd tests && npm ci
node baseline/physics.mjs check     # birebir aynı olmalı
node baseline/visual.mjs check      # her görüntü ≤ %0,5 piksel farkı; farklar tests/out/screens/ altına
node baseline/saves.mjs check
node baseline/keys.mjs check        # 28 klavye kısayolu kontrolü, hepsi ✅ olmalı (~2 dk)
node baseline/klasik.mjs check      # klasik.html: hatasız açılış, PeerJS, menü görüntüsü
node baseline/menu.mjs [check|record|kontrol]   # menü yerleşimi: 6 boyut × güncelleme düğmesi var/yok, kesişme + sığma kontrolü
node baseline/karsilastir.mjs <main> <derleme>    # bir hata canlıda da var mı: aynı senaryo, görüntü + fizik karşılaştırması
node baseline/saglamlik.mjs        # bağlam kaybı, sekme gizlenmesi, hata çubuğu, efekt zinciri bırakma, Ultra
node baseline/bellek.mjs           # araç değiştirdikçe GPU belleği büyümüyor
node baseline/harita.mjs           # büyük harita yerleşimi (4 boyut)
node baseline/mp.mjs                # çok oyunculu: yerel PeerJS sunucusu, yeni↔yeni, eski↔yeni, H1, ayrı odalar (~8 dk)
node baseline/worker.mjs            # TURN aracısı (Worker) birim testi
node baseline/sw.mjs                # service worker: kapsam ayrımı, çevrimdışı, yavaş açılış, güncelleme, acil çıkış (kendi derler, ~10 dk)
node baseline/ultra.mjs             # Ultra ↔ Yüksek: ışık/efekt katkısı aynı, tek fark ortam gölgelendirmesi (gündüz+gece)
node baseline/perf.mjs check        # hiçbir sahne daha yavaş olmamalı
```
Testler zamanı (60 Hz sanal saat) ve rastgeleliği oyunun koduna dokunmadan sabitler; three.js/PeerJS'i yerel npm kopyasından verir.
Tarayıcının dış ağı kapalıdır (yalnız 127.0.0.1); çok oyunculu test kendi yerel PeerJS sunucusunu kurar.

## Tarayıcı: sade Chrome for Testing 153.0.8010.12 + SwiftShader (Aşama 6, H24)
Referans görüntüler bu sürümle ve Chrome'un kendi yazılımsal GPU'su SwiftShader ile çekildi. Başka bir sürücü (gerçek ekran
kartı, Mesa/lavapipe…) farklı piksel üretir; bu yüzden test, oyun sayfası açılınca sürücüyü denetler ve SwiftShader değilse
açık bir mesajla durur. Tarayıcı yolu `CHROME` ile verilir (varsayılan `/usr/bin/google-chrome`). Bir ortamın Chrome'u
sarmalayıcı betik arkasındaysa ve WebGL'i başka sürücüye yönlendiriyorsa, betiği değil sade ikiliyi ver
(ör. bu geliştirme ortamında `CHROME=/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome`).
Gerçek FPS burada ölçülmez; gerçek cihazda ayrıca kontrol edilir.

`TP_ZAMAN_KAT=2`: yavaş makinede gerçek-zaman beklemelerini ve süre sınırlarını uzatır (sonuçlar donmuş saate bağlı, değişmez).

## CI (Aşama 6): `.github/workflows/testler.yml`
- `altyapi`'ya her push'ta, her PR'da ve elle (`workflow_dispatch`, istenirse yalnız seçili testler: `sadece: sw,mp`).
- Canlı yayın (`yayin.yml`) ve önizleme (`turbo-pist-onizleme/onizleme.yml`) yayından önce bunu çağırır: **bir test
  kırmızıysa yayın başlamaz.** Tek istisna canlıdaki acil service worker kapatma (acil çıkış her zaman çalışmalı).
- İlk adım bütün test dosyalarının sözdizimi denetimi; sonra tek test derlemesi; sonra 14 test ayrı makinelerde paralel.
- perf yalnız uyarı verir (süreler makineye göre oynar).
- Kırmızı bir testin görüntüleri iş günlüğüne base64 JPEG olarak da yazılır ("Kırmızı görüntüler günlüğe" adımı) ve
  artifact olarak yüklenir.
- Secret yok. Tarayıcı ve bütün eylemler sabit sürüm/commit ile.

## Aşama 1'den sonra: derlenmiş oyuna karşı
Oyun artık Vite ile derleniyor; testler derlenmiş klasöre karşı çalışır:
```
cd .. && npx vite build --base=/ --outDir /tmp/dist-test && cd tests
export GAME_ROOT=/tmp/dist-test
node baseline/physics.mjs check   # (ve diğerleri)
```
Yavaş ağ ölçümü: `node baseline/agyavas.mjs 3` (≈4G, açılış dosyalarının iniş süresi).

Görsel referans canlıdaki yazı tipleriyle çekilmiştir. main'in kodundan yeniden çekmek gerekirse
`GFONTS=1` ver (Google Fonts istekleri aynı yazı tipi dosyalarıyla yanıtlanır):
`GAME_ROOT=<main kopyası> GFONTS=1 node baseline/visual.mjs record`

Aşama raporları: `raporlar/`.
