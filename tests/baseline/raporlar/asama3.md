# Aşama 3 — Service worker, güncelleme uyarısı, kayıt sürümü (H9a)

Referans: main @ e771e2a (canlı; görsel referans yazı tipli, Aşama 2'den).

## Değişenler
- **Service worker** (`pwa/sw.js` şablonu → derlemede `dist/sw.js`, dosya listesi + içerikten türeyen sürüm):
  - Sayfalar önce ağdan (`no-cache` ile sunucuya doğrulatılır; GitHub Pages'in 10 dk önbelleği güncellemeden sonra eski HTML vermesin), 5 sn'de cevap yoksa ya da çevrimdışıysa önbellekten.
  - `app/` altındaki hash'li dosyalar önce önbellekten.
  - Çekirdek (~4,9 MB: kod, Ferrari, şehir dokuları, yazı tipleri, ikonlar) kurulumda; çoğu açılışta zaten indiği için tarayıcı önbelleğinden gelir. Diğer araçlar ve HDR'ler (~9,7 MB) ilk kullanımda; sayfanın zaten indirdikleri veri harcamadan alınır.
  - Güncellemede aynı adlı hash'li dosyalar eski önbellekten kopyalanır: sadece değişen iner.
  - Kayıt oyun açıldıktan 3 sn sonra (açılış indirmeleriyle yarışmasın). `npm run dev`'de yok.
- **Kapsam ayrımı:** önbellek adları `tp|<kapsam yolu>|surum-<sürüm>`; SW yalnızca kendi ön ekini okur/siler. Kapsamlar `/turbo-pist/` ve `/turbo-pist-onizleme/` (sonda `/` olduğu için biri diğerini kapsamaz).
- **Güncelleme uyarısı** (`js/surum.js`): yeni sürüm arka planda iner, kendiliğinden devreye girmez. "🔄 Yeni sürüm hazır" yalnızca ana menüde ve serbest sürüşün duraklatma ekranında görünür (izin listesi: `menu`, `free`). Yarış, geri sayım, lobi, sonuç ekranında görünmez; zorla basılsa da yenilemez. Serbest sürüşte önce kaydeder.
- **Acil çıkış:**
  1. Açılış bekçisi (`index.html` başında, oyun kodundan bağımsız): sayfa SW'den geldiyse ve oyun açılamazsa (hata ya da 45 sn) oturumda bir kez önbelleği temizleyip ağdan açar; yine olmazsa "Temiz yükle" düğmesi.
  2. `?sifirla` / `sifirla.html`: SW'yi ve bu kapsamın önbelleğini siler, kayıtlara dokunmaz. SW bu adreslere hiç karışmaz.
  3. Sunucudan: `yayin.yml` → Run workflow → `acil_sw_kapat`. Kendini kaldıran SW yayınlanır; o derleme SW'yi yeniden kaydetmez (döngü yok).
- **Kayıt sürümü (H9a)** — `js/save.js`: `v` alanı, adım adım geçiş tablosu; daha yeni sürümün kaydı (v > 1) bozulmaz, bilinmeyen alanlar korunur; okunamayan kayıt `tp8_save_bozuk`'a bir kez yedeklenir; yanlış türdeki alanlar onarılır. Geçişler sadece ekleme yapar → eski oyun sürümü yeni kaydı okuyabilir.
- **Önizleme depolaması (H16):** önizleme derlemesi `VITE_DEPO_ONEK=onizleme_` ile kendi anahtarlarına yazar; kendi kaydı yoksa canlıdakini okur, ona hiç yazmaz.
- `assets/brick_rough.jpg` silindi (H15).
- Oyun mantığı, fizik, sürüş: dokunulmadı.

## Sonuçlar
| Test | Sonuç |
|---|---|
| Fizik (7 araç) | ✅ 7/7 birebir aynı |
| Görsel (35) | ✅ 35/35, hepsi %0,00 |
| Kayıtlar (4 eski örnek) | ✅ 4/4 |
| Kayıt geçişi (5 yeni örnek: v0, v1, gelecek sürüm, bozuk JSON, yanlış türler) | ✅ 5/5 |
| Klavye kısayolları (28) | ✅ 28/28, konsol hatası 0 |
| klasik.html | ✅ aynı, %0,00 |
| Service worker (`sw.mjs`, 24 kontrol) | ✅ 24/24 (aşağıda) |
| Perf (7 sahne) | ✅ çizim/üçgen birebir aynı; JS ms/kare 6,5–12,0 |

### sw.mjs — canlı ve önizleme aynı sunucuda, GitHub Pages gibi `max-age=600`
- İki ayrı SW kaydı; her sayfayı kendi SW'si yönetiyor; önbellek adları kapsamla ön ekli.
- Önizleme canlının kaydını okuyor, kendi anahtarına yazıyor; canlı kayıt değişmiyor.
- Sunucu kapalıyken oyun önbellekten açılıyor.
- Yeni sürüm: serbest sürüşte iniyor, sayfa yenilenmiyor, uyarı ekranda yok → serbest duraklatmada ve menüde görünüyor → geri sayımda ve yarış duraklatmasında görünmüyor; geri sayımda düğmeye zorla basılsa da yenilenmiyor; yarış sürerken yenilenmiyor → menüde "Yenile" → yeni sürüm açılıyor; canlının eski önbelleği siliniyor, önizlemeninki yerinde.
- Önbellekteki oyun kodu bozulunca bekçi temizleyip ağdan açıyor; önizlemeye dokunmuyor.
- `?sifirla`: canlının SW'si ve önbelleği kalkıyor, kayıt duruyor, önizleme yerinde.
- Acil kapatma SW'si: canlıda SW ve önbellek kalkıyor, oyun ağdan açılıyor, döngü yok.
- Bütün bunlardan sonra önizleme aynı SW ve önbellekle sağlam.

## Testlerin yakaladığı ve düzeltilenler
- Geri sayımda oyun modu `race` değil `countdown`: uyarı kuralı "yarışta değilse göster" olarak yazılmıştı → izin listesine çevrildi (sadece menü + serbest sürüş).
- SW kaydı nesne döndürmezse (`register()` → `undefined`) konsola hata düşüyordu → koruma eklendi.
- Test zamanlaması: bir çalıştırmada duraklatma ekranı ağır yük altında 500 ms'den geç açıldı, test erken baktı → artık ekranın açılmasını bekliyor (son çalıştırma 24/24).
- Test tasarımı: gerçek zamanlı bekleme sırasında trafik oyuncunun aracına çarpabiliyordu, rölantide yakıt gidiyordu → kayıt testleri değerleri yükleme anında okuyor; yakıt ±0,0005 toleranslı.

## Bilinen sınır
- Aynı anda iki sekme açıkken biri yeni sürümü devreye alırsa, diğer sekme eski sayfayla kalır ve uyarı orada da görünür. O sekme yenilenmeden, daha önce açmadığı bir araca geçerse o aracın eski dosyası sunucuda olmayabilir.
