# Canlıya geçiş planı (altyapi → main)

Bugün canlı: `main` @ e771e2a. GitHub Pages bunu daldan (klasik yöntem) yayınlıyor; derleme ve service worker yok.
Geçişten sonra: `main` = altyapı. Yayın GitHub Actions'tan yapılır (`yayin.yml`: önce testler, sonra derleme ve yayın).
Birleştirme düz ileri sarma olacak (main, altyapı'nın doğrudan atası; çakışma yok).

## A. Geçiş öncesi koşullar (hepsi ✅ olmadan başlanmaz)
- [ ] Kullanıcının gerçek cihaz testleri sorunsuz (telefon kontrolleri, uçak modunda açılış, `?sifirla`, mobil veriden çok oyunculu)
- [ ] Son altyapı commit'inde CI 15/15 yeşil
- [ ] Önizleme o commit'te ve kullanıcı kontrol etti
- [ ] main'e geçişten beri dokunulmadı (hâlâ e771e2a; değiştiyse önce o değişiklik altyapıya taşınır)

## B. Geçiş günü — sıra
1. **Geri dönüş noktası:** canlı commit e771e2a'ya `canli-oncesi-<tarih>` etiketi ve `yedek/canli-e771e2a` dalı.
   İkisinin de uzak depoda göründüğü doğrulanır. (Etiket bu ortamdan gönderilemezse dal yeterli; etiket GitHub
   arayüzünden de oluşturulabilir.)
2. **Sürüm uyuşmazlığı testi:** son commit'te mp testi. Eski canlı kodu (e771e2a) ↔ yeni kod, iki yönde: bağlanma,
   uyarılar, eski misafirin yeni paketleri okuması. Geçişte sekmesi açık kalan eski sürüm oyuncularının durumunu bu temsil eder.
3. **Geri dönüş denemeleri** (canlıya dokunmadan):
   - **3a. Yeni sürümler arasında geri dönüş** (README'deki yol): önizlemede `KAYNAK` bir önceki yeşil commit'e alınır
     → yayın → oyuncunun tarayıcısında eski sürüm iner ("Yeni sürüm hazır" akışı, kayıt korunur) → tekrar son commit'e dönülür.
   - **3b. Tam geri dönüş (e771e2a'ya):** yerelde, oyuncu tarayıcısı benzetimiyle. Yeni sürüm açılır, service worker
     kurulur. Sonra sunucu e771e2a'nın dosyalarını ve bir "service worker kapatma" dosyası (`sw.js` = `pwa/sw-acil-kapat.js`)
     verir. Beklenen sonuç: oyuncu eski oyunu görür, service worker ve önbellek kalkar, kayıt korunur. Yeni sürümün yazdığı
     kayıt (sürüm alanı `v` eklenmiş) eski kodda da okunuyor mu, bu denemede ayrıca doğrulanır.
4. **⏸ Panel adımı (kullanıcı):** Settings → Pages → Build and deployment → Source: **GitHub Actions**.
   Tıklama tıklama tarif edilir ve beklenir. Beklenen: yeni yayına kadar son yayın görünmeye devam eder. Bu, ayar
   değiştikten hemen sonra canlı adreste kontrol edilir; site düştüyse birleştirmeye (5) hemen geçilir.
5. **Birleştirme:** `git push origin altyapi:main` (düz ileri sarma). `yayin.yml` başlar: testler → derleme → yayın →
   `yayin-YYYYMMDD-HHMM` etiketi.
6. **Yayın sonrası kontroller:**
   - canlı adreste yeni sürüm açılıyor; `surum.txt` = birleştirilen commit;
   - service worker kuruluyor; ikinci açılış önbellekten;
   - eski sürüm sekmesi açık bir oyuncuyla çok oyunculu (uyarı çıkıyor, bağlanıyor);
   - kayıtlar (para, araçlar) yeni sürümde aynen geliyor;
   - `klasik.html` açılıyor.
7. **Sonra:** önizleme iş akışının test bağlantısı `@altyapi` → `@main`. Altyapı sonrası oyun düzeltmeleri (M/P/C, G1)
   için yeni dal açılır.

## C. Bir şey ters giderse
| Durum | Ne yapılır |
|---|---|
| Testler kırmızı, yayın başlamadı | Canlı eski hâlinde kalır (yayın başlamaz). Sorun düzeltilip tekrar push edilir. |
| Yeni sürüm yayında ama hatalı (oyuncular açabiliyor) | Düzeltme ya da README'deki geri dönüş (önceki `yayin-…` etiketinin içeriği yeni commit olarak). Not: geçişin ilk yayınından önce `yayin-…` etiketi yoktur; o durumda bir alttaki satır uygulanır. |
| Oyuncular takılı kaldı (açılmıyor) | Actions → yayin → Run workflow → `acil_sw_kapat` (testleri beklemez) |
| Tamamen eski sürüme dönülmeli | 1) ⏸ Panel: Pages Source → **Deploy from a branch**, `main` / root. 2) main'e e771e2a'nın içeriği + kök `sw.js` olarak service worker kapatma dosyası tek commit (3b'de denenen hâl). Oyuncuların service worker'ı kendini kaldırır, eski oyun açılır, kayıtlar korunur. |

## Geçiş günü kayıtları (24.11.2026)
- **B1 geri dönüş noktası:** `yedek/canli-e771e2a` dalı uzak depoda (e771e2a). Etiket bu ortamdan gönderilemiyor
  (sunucu bağlantıyı kesiyor); istenirse GitHub → Releases'tan e771e2a'ya eklenebilir.
- **B3b tam geri dönüş** (`tests/baseline/geri_donus.mjs`, yerel, Chrome 153 + SwiftShader):

| Kontrol | Kapatma dosyasıyla (plan) | Kapatma dosyası olmadan (karşı deneme) |
|---|---|---|
| Eski oyun açılıyor | ✅ | ✅ |
| Kayıt eski kodda: para 43210, araç yakıt/hasar | ✅ aynen | ✅ aynen |
| Service worker kalkıyor | ✅ | ❌ kalıyor |
| Önbellek siliniyor | ✅ (1 → 0) | ❌ kalıyor (çevrimdışıyken önbellekteki yeni sürüm açılabilir) |
| Sayfa hatası | yok | yok |

  Sonuç: tam geri dönüşte kök `sw.js` olarak kapatma dosyası şart; plandaki yol doğrulandı.
- **B2 sürüm uyuşmazlığı:** son commit'te mp, eski canlı kod (e771e2a) ↔ yeni kod, iki yönde ✅ (bağlanma, uyarılar,
  eski misafirin yeni paketleri okuması).
- **B3a yeni sürümler arası geri dönüş:** önizleme c4222e9 → dff9796 (geri) → 27d2375 (ileri); her adımda testler → yayın ✅.
- **B4 panel:** Pages Source → GitHub Actions (kullanıcının isteğiyle Claude yaptı); site eski yayınla açık kaldı ✅.
- **B5 ilk birleştirme (27d2375):** yayın, mp'deki bir kontrol kırmızı yandığı için **durdu**; canlı eski sürümde kaldı.
  Kullanıcı kararı: önce düzelt (H25, `HATALAR.md`), sonra yayınla. Düzeltme + mp testi GitHub'da 10 bağımsız koşuda
  10/10 yeşil (24/24); tam test koşusu 15/15.
- **B5 birleştirme (a04bd21):** yayın 18/18 ✅, etiket `yayin-20261124-1321`.
- **B6 yayın sonrası (canlı, Chrome):** `surum.txt` = a04bd21 ✅ · yeni derleme ve Ultra menüde ✅ · service worker kuruldu,
  canlı önbelleği önizlemeden ayrı ✅ · tarayıcıdaki mevcut kayıt aynen geldi ✅ · ikinci açılışta 21 oyun dosyasının
  21'i önbellekten, ağdan 0 ✅ · `klasik.html` açılıyor ✅. Eski sekmeyle çok oyunculu: mp testindeki eski ↔ yeni
  senaryoları (gerçek eski kodla) ✅; iki gerçek cihazla deneme kullanıcıda.
- **B7:** önizleme iş akışı testleri artık `@main`'den çağırıyor; önizleme KAYNAK = a04bd21.
