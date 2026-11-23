# Aşama 6 — CI: testler her push'ta ve yayından önce

## Ne yapıldı
- **`.github/workflows/testler.yml`:**
  - Ne zaman koşar: `altyapi`'ya her push'ta, PR'da, elle (istenirse yalnız seçili testler) ve başka iş akışlarından çağrılınca (`workflow_call`, sınanacak commit girdisiyle).
  - Akış: sözdizimi denetimi → tek test derlemesi → 14 test ayrı makinelerde paralel.
  - perf yalnız uyarı verir.
  - Tarayıcı sabit: Chrome for Testing 153.0.8010.12. Sürüm, kurulumdan sonra doğrulanır.
  - Bütün eylemler commit kimliğiyle sabitlendi.
- **Canlı yayın (`yayin.yml`):** önce testler. Kırmızıysa derleme ve yayın başlamaz. Tek istisna acil service worker kapatma (acil çıkış her zaman çalışmalı).
- **Önizleme (`turbo-pist-onizleme/onizleme.yml`):** `KAYNAK`'taki commit'in testleri koşar, yeşilse derlenip yayınlanır.
- **Çok oyunculu test:** kendi yerel PeerJS sunucusuyla koşar. Tarayıcının dış ağı kapalı (yalnız 127.0.0.1 ve WebRTC'nin `.local` adları), dış servise bağlı değil.
- **Süreler:** `TP_ZAMAN_KAT` (CI'da 2) gerçek-zaman beklemelerini ve süre sınırlarını uzatır. Sonuçlar donmuş test saatine bağlı olduğu için değişmez.

## CI'ın ilk koşularında bulunanlar

| # | Ne | Oyunu etkiliyor mu | Sonuç |
|---|---|---|---|
| H23 | Açılış bekçisi (Aşama 3) 45 sn'yi aşan açılışı bozuk sayıyordu | **Evet:** yavaş cihazda önbellek silinip her şey baştan iniyordu; çevrimdışıyken oyun hiç açılamıyordu | Düzeltildi (aşağıda) |
| H24 | Referans görüntüler bu geliştirme ortamının Chrome sarmalayıcısıyla, ortama özel yamalı bir Mesa sürücüsüyle çekilmişti | Hayır (test) | Testler her yerde sade Chrome + SwiftShader; referanslar yeniden çekildi (onaya sunuldu); sürücü denetimi eklendi |
| G1 | Bazı açılarda yolun asfaltı yerine altındaki çimen görünüyor (SwiftShader'da e2008 takip, GSX-R kokpit, telefon görünümü — Düşük kalite) | **Evet** (ekran kartı hızlandırması olmayan oyuncular SwiftShader kullanır); **main'de de var** | Kurala göre "Oyun düzeltmeleri — altyapı sonrası"na yazıldı, dokunulmadı |
| — | sw testinde `swHazir` hiç beklemiyordu (async fonksiyon verilen `waitForFunction`, dönen Promise'i "doğru" sayıyor) | Hayır (test) | Node tarafında yoklama |
| — | sw testinde iki sayfa aynı anda 60 kare çizince yazılımsal GPU'da açılışlar dakikalar sürüyordu | Hayır: tek sayfada service worker'lı ve service worker'sız yeniden yükleme aynı süre (16,9 / 17,2 sn) | Testte kare hızı 4/sn, kullanılmayan sayfa "uyutuluyor": çevrimdışı açılış 148 → 12 sn |
| — | mp: ağ kuralı WebRTC'nin `.local` adlarını da engelliyordu | Hayır (test) | `.local` ve `localhost` açık |
| — | saglamlik: efekt zinciri ölçümü ilk kareden önceye denk gelebiliyordu | Hayır (test) | 10 kare çizilmesi bekleniyor |
| — | `mp.mjs` Aşama 5 commit'inde sözdizimi hatalıydı | Hayır (test) | Düzeltildi; CI'ın ilk adımı sözdizimi denetimi |

## H23 düzeltmesi
- Süre sınırı yalnızca oyun kodu hiç çalışmaya başlamadıysa uygulanıyor (`js/main.js` ilk satırı `__tpKodBasladi`). Kod başladıysa yavaşlık bozukluk sayılmaz.
- Çevrimdışıyken önbellek hiç silinmez.
- Hata olayıyla kurtarma aynen duruyor ("bozuk önbellek" testi yeşil).
- `sw.mjs` 3b: bekçi süresi 1 sn'ye indirilir, açılış ondan uzun sürer. Kanıt olarak sunucuya oyun dosyası isteği gelmemeli ve bekçi uyarısı çıkmamalı.

| Bekçi | Sunucudan yeniden inen oyun dosyası | Bekçi uyarısı | Sonuç |
|---|---|---|---|
| Eski (Aşama 3) | 22 | 1 | ❌ |
| Yeni | 0 | 0 | ✅ |

## Bilinen sınırlar
- Önizleme iş akışı test iş akışını `@altyapi` dalından çağırır (GitHub `uses:` içinde değişken kabul etmiyor). Altyapı main'e birleşince `@main` yapılmalı.
- Tarayıcı zip'inin SHA-256 özeti her koşuda günlüğe yazılıyor; sürüm numarası ayrıca doğrulanıyor.
