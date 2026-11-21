# Aşama 2 — Asset hattı + yazı tipleri (H13)

Referans: main @ e771e2a (canlı). Karşılaştırılan: altyapi dalı, `vite build --base=/` çıktısı.

## Ölçüp uygulamadıklarım (veriyle)
| Plan maddesi | Ölçüm | Karar |
|---|---|---|
| Meshopt (Draco yerine) | 7 modelin hepsinde daha büyük: ham +%40–70, gzip'le de çoğunda büyük (ör. Ferrari 1642 → 2424 KB) | Uygulanmadı, Draco kalıyor |
| KTX2 dokular | Modellerdeki dokular toplam ~140 KB; KTX2 çözücüsü ~600 KB. Şehir dokuları canvas'a çiziliyor, KTX2'ye uygun değil | Uygulanmadı |
| WebP (çim, tuğla) | Aynı kalitede (PSNR ≥ 38 dB) WebP JPEG'den %5–45 büyük (çim 532 → 652 KB) | Uygulanmadı |
| Geç yükleme | Diğer 6 araç seçilince, HDR'ler sürüşe başlayınca yükleniyordu | Zaten vardı, dokunulmadı |

## Değişenler
- **Yazı tipleri (H13):** `@fontsource/bungee` 5.3.0 + `@fontsource/inter` 5.3.0, sabit sürüm; aynı aileler ve kalınlıklar (Bungee 400, Inter 400/600/800). `fonts.css`, iki sayfada da Google Fonts satırının yerine geçti.
- **Hash'li asset adları:** modeller, dokular, HDR'ler `new URL('../assets/…', import.meta.url)` ile gösteriliyor (`js/vehicles.js`, `js/car.js`, `js/city.js`, `js/main.js`). Güncellemede tarayıcı eski dosyayı önbellekten vermez; 3. aşamadaki service worker için de gerekli. `assets/` artık olduğu gibi kopyalanmıyor.
- **Önceden yükleme:** Ferrari, şehir dokuları, Draco çözücü, three ve oyun kodu HTML'de `preload`/`modulepreload` ile isteniyor; JS inip çalışana kadar beklemiyorlar. Her dosyanın tek kez indiği ve tarayıcının "kullanılmayan preload" uyarısı vermediği doğrulandı.
- **Parçalara ayırma:** three (818 KB) ve PeerJS (91 KB) ayrı dosyada. Oyun kodu (314 KB) değişince oyuncu sadece onu yeniden indirir (önce 1222 KB).
- Oyun mantığı, fizik, sürüş: dokunulmadı.

## Yeni altın referans (görsel)
Bu ortamda Google Fonts engelli olduğu için eski referans görüntüleri yedek yazı tipiyle çekilmişti. Yeni referans **main'in kendi kodu** ile, Google Fonts istekleri aynı yazı tipi dosyalarıyla yanıtlanarak çekildi (`GFONTS=1`): canlıda oyuncunun gördüğü görüntü. Eski set git geçmişinde.

## Sonuçlar
| Test | Sonuç |
|---|---|
| Fizik (7 araç) | ✅ 7/7 birebir aynı |
| Görsel (35 görüntü, yazı tipli canlı referansa karşı) | ✅ 35/35, hepsi %0,00 |
| Kayıtlar (4) | ✅ 4/4 |
| Klavye kısayolları (28) | ✅ 28/28 |
| klasik.html | ✅ durum aynı, görüntü %0,00 (yazı tipli) |
| Geliştirme sunucusu | ✅ iki sayfa açılıyor, yazı tipleri yüklü |
| Konsol hatası | ✅ 0 |
| Perf (7 sahne: çizim/üçgen) | ✅ birebir aynı; JS ms/kare 6,6–12,0 |

## Yavaş ağ (≈4G: 10 Mbit/s, 40 ms), 3 tekrar ortalaması
| | Aşama 1 | Aşama 2 |
|---|---|---|
| Açılış dosyalarının inişi bitti | 4661 ms | 3713 ms (−%20) |
| İnen | 4048 KB | 4259 KB (+210 KB yazı tipi, canlıda Google'dan zaten iniyordu) |

Not: `perf.mjs`'nin "indirme" sayısı (3857 → 5768 KB) oyun nesnesi oluştuğu ana kadar inenleri sayar; önceden yükleme Ferrari ve Draco'yu o andan önceye çektiği için büyüdü. Toplam indirme aynı.

## Test altyapısı düzeltmesi
Test sunucusunun MIME tablosunda `.css`/`.woff2` yoktu; CSS reddediliyordu (klasik.html'de %1,67 fark olarak yakalandı). Eklendi.
