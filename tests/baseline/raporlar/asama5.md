# Aşama 5 — Çalışma anı sağlamlığı

Referans: main @ e771e2a (canlı) + onaylı menü referansları (H8).

## Değişenler
- **Bellek (H20):** araç değişiminde ve çok oyunculuda oyuncu ayrılınca eski aracın GPU kaynakları bırakılıyor
  (`aracBirak()`). Sadece başka hiçbir yerde kullanılmayanlar: yeni araç, diğer oyuncuların araçları ve önbellekteki
  şablonlar korunur; ayna/yansıma hedefleri ve ortam haritası hiç bırakılmaz. (three.js bırakılmış bir kaynağı tekrar
  kullanılırsa kendiliğinden yeniden yükler: yanlış bırakma bozulma değil, sadece yeniden yükleme demek.)
  Önce: her geçişte ~5–100 geometri birikiyordu. Sonra: 3 tur (21 geçiş) sonunda +1 geometri, +0 doku.
- **Efekt zinciri (H2):** düşük FPS'te kapanınca geçişler ve render target'ları bırakılıyor.
- **Ultra (H3):** yeni grafik seçeneği = Yüksek + ortam gölgelendirmesi (GTAO). Otomatik seçim Ultra'yı seçmez.
  Ayrıntı kodu Ultra'da Yüksek gibi davranır (15 ayrı kalite kontrolüne dokunulmadı).
- **WebGL bağlamı kaybı:** oyun kaydedilir, "Grafik bağlantısı koptu" paneli; bağlam dönünce sayfa yeniden yüklenir
  (three.js özel hedefleri kendiliğinden geri kuramaz), dönmezse "Yeniden yükle" düğmesi.
- **Sekme gizlenince:** ses askıya alınır (arka planda motor sesi çalmaz); tek oyunculuda serbest sürüş/yarış
  duraklatılır. Çok oyunculuda duraklatma herkesi durdurduğu için otomatik duraklatılmaz.
- **Hata çubuğu:** açılıştan sonra yakalanmayan hata/söz reddi → küçük bildirim + "Kaydet ve yenile" / "Kapat";
  10 sn'de en fazla bir kez; tarayıcı eklentilerinin hataları sayılmaz.
- **H6 büyük harita:** kısa yatay ekranda (telefon yatay, 640×360) harita ve liste yan yana, liste kaydırılabilir.
- **H7 yarış göstergesi:** yarışta yakıt satırı gizli. (İlk kayıttaki "hasar da kullanılmıyor" yanlıştı: yarışta hasar
  birikiyor ve direksiyonu/gücü etkiliyor; HASAR göstergesi kalıyor.)
- Fizik, sürüş, oyun mantığı: dokunulmadı.

## Testler (yeni)
| Test | Ne sınıyor |
|---|---|
| `bellek.mjs` | 7 araç × 3 tur: 1. turdan sonra geometri/doku artmıyor, WebGL hatası yok |
| `saglamlik.mjs` (12) | bağlam kaybı → panel + kayıt → geri gelince yeniden yükleme, kayıt duruyor; sekme gizlenince duraklat; hata çubuğu, kısma, "Kaydet ve yenile"; efekt zinciri bırakma; Ultra GTAO etkin |
| `harita.mjs` | 4 boyutta yan panel ekranda, Kapat görünür, liste öğeleri kesişmiyor, harita kullanılabilir (eski derlemede 640×360'ı yakalıyor) |

## Test altyapısı düzeltmeleri
- `gamePage` başlangıç kaydını her sayfa yüklemesinde siliyordu → yeniden yükleme testlerinde kayıt kayboluyordu.
  Artık sekme başına bir kez yazılıyor.
- Bu ortam çok yavaş (dışarıdan tek tıklama >10 sn sürebiliyor): zaman sınırlı kontroller sayfa içinde ms'ler içinde
  yapılıyor; yeniden yükleme beklemeleri 120 sn.
- Harita kontrolü ilk sürümde kaydırma alanının dışındaki (görünmeyen) öğeleri de sayıyordu → kırpılıyor.
