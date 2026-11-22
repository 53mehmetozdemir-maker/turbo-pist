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
node baseline/mp.mjs                # çok oyunculu: yerel PeerJS sunucusu, yeni↔yeni, eski↔yeni, H1, ayrı odalar (~8 dk)
node baseline/worker.mjs            # TURN aracısı (Worker) birim testi
node baseline/sw.mjs                # service worker: kapsam ayrımı, çevrimdışı, güncelleme, acil çıkış (kendi derler, ~15 dk)
node baseline/perf.mjs check        # hiçbir sahne daha yavaş olmamalı
```
Testler zamanı (60 Hz sanal saat) ve rastgeleliği oyunun koduna dokunmadan sabitler; three.js/PeerJS'i yerel npm kopyasından verir. Yazılım tabanlı WebGL (SwiftShader) kullanıldığı için gerçek FPS burada ölçülmez; gerçek cihazda ayrıca kontrol edilir.

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
