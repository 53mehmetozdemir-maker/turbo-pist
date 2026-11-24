# Turbo Pist — Claude için proje kuralları

Bu dosya her oturumun başında okunur. Kullanıcı (Mehmet) Türkçe konuşur, yazılımcı değildir; ona her zaman sade
Türkçe ile, teknik jargon olmadan yaz. Kararları o verir; sen yapar, kanıtlar ve raporlarsın.

## Proje
Tarayıcıda çalışan 3D araba oyunu. Canlı: https://53mehmetozdemir-maker.github.io/turbo-pist/

- **Dil:** saf JavaScript (ES modülleri). TypeScript'e geçilmeyecek (kullanıcı kararı).
- **3D:** three.js 0.187.0 (WebGL2). Modeller GLB + Draco.
- **Fizik:** kendi motorumuz, 120 Hz sabit adım + interpolasyon (`js/physics.js`).
- **Çok oyunculu:** PeerJS 1.5.4 / WebRTC, host trafiği simüle eder. TURN: Metered (500 MB ücretsiz deneme),
  bilgisi `worker/turn.js` (Cloudflare Worker) üzerinden gelir.
- **Derleme:** Vite. **Çevrimdışı:** `pwa/sw.js`. **Yayın:** GitHub Actions → GitHub Pages.

### Dosya haritası
| Dosya | Ne yapar |
|---|---|
| `js/main.js` | oyun döngüsü, menü, HUD, kamera, servisler, kalite ayarları (büyük, tek parça) |
| `js/physics.js` | araç fiziği (DOKUNULMAZ — aşağıya bak) |
| `js/vehicles.js` | araç tanımları: model, ayna (`mirrors`), gösterge (`dash`), egzoz (`exhaust`), tekerler |
| `js/car.js`, `js/fleetcar.js` | oyuncu aracı ve trafik araçlarının görseli |
| `js/bike.js`, `js/bikeglb.js` | motosiklet |
| `js/interior.js` | kokpit, aynalar, göstergeler |
| `js/damage.js` | hasar, göçük, cam çatlağı |
| `js/traffic.js` | trafik, yayalar, bot çarpışmaları; host→misafir paketleri |
| `js/net.js` | çok oyunculu bağlantı, protokol sürümü, TURN bilgisi |
| `js/city.js`, `js/regions.js`, `js/track.js`, `js/props.js` | şehir, bölgeler, pist, ağaç/lamba/yaya modelleri |
| `js/route.js`, `js/services.js` | GPS/rota, benzinlik/tamirci/çekici/sigorta |
| `js/audio.js`, `js/effects.js` | ses, duman/kıvılcım/egzoz alevi |
| `js/save.js` | kayıt okuma + sürüm geçişi (migrasyon) |
| `index.html`, `klasik.html`, `sifirla.html` | sayfalar (klasik.html eski tek dosya, hâlâ çalışmalı) |
| `tests/baseline/` | altın testler, referanslar, `HATALAR.md`, `OZELLIKLER.md`, `raporlar/` |
| `.github/workflows/` | `testler.yml` (her push), `yayin.yml` (test → derle → canlı) |

## Değişmez kurallar
1. **Canlıya yayın (main'e birleştirme) yalnız kullanıcının O ANKİ açık onayıyla.** Önceki bir onayı yeni bir
   duruma taşıma. "Testler yeşil" tek başına onay değildir.
2. **Fizik ve sürüş hissi değişmez** — iş açıkça bir sürüş değişikliği değilse. Sürüş değişikliği ise önce kullanıcıya
   ne değişeceğini sade dille anlat, onay al; sonra fizik referansını onunla birlikte güncelle.
3. **Referans görüntü/fizik kaydını (`record`) kullanıcı onayı olmadan güncelleme.** Bilerek değişen görüntüleri önce
   ona göster.
4. **Gizli bilgi yok:** API anahtarı, token, TURN şifresi asla koda, repoya, loga ya da sohbete yazılmaz.
5. **Dosya silme yok.** "Kullanılmıyor gibi" görünen dosyayı listele, kullanıcıya sor.
6. **Sürümler sabit** (`^`/`~` yok). Yeni bağımlılık eklemeden önce sor.
7. **Kırmızı testi yeşil çıkana kadar tekrar koşturup geçme.** Sebebini bul. Kendi test hatansa düzelt ve açıkça yaz.
8. **Kanıtsız "bitti" deme.** Her iddia bir test sonucu, ölçüm ya da ekran görüntüsüyle desteklenir.

## Tasarım dili (yeni her şey buna uyar)
Kullanıcı bir şeyin tasarımını ayrıca istemek zorunda kalmamalı: eklenen her düğme, panel, gösterge ve efekt ilk
seferde oyunun geri kalanı gibi görünmeli.
- **Yazı tipleri:** başlık, rakam, gösterge → `Bungee`; metin ve düğme yazısı → `Inter` (400/600/800).
- **Renkler:** koyu zemin `#07090d` (yarı saydam paneller), vurgu/seçili `#ffd32a` (sarı), olumlu/başlat `#2ed573`
  (yeşil), uyarı/hasar `#ff4757` (kırmızı), açık metin `#e8ebef`. Yeni renk uydurma; bunları kullan.
- **Şekil:** köşe yuvarlaklığı 10–14px (küçük rozetler 4px, yuvarlak düğmeler 50%). Paneller buzlu cam:
  yarı saydam koyu zemin + `backdrop-filter: blur(6px)`.
- **Yerleşim:** hiçbir şey başka bir şeyin üstüne binmez ya da arkasında kalmaz; yazı kesilmez. 1920×1080'den telefon
  dikeye kadar her boyutta çalışır. Telefonda dokunma alanı en az 44px.
- **Örnek al:** yeni bir şey eklemeden önce oyunda ona en çok benzeyen mevcut öğeyi bul (menü seçenekleri, HUD
  barları, harita paneli) ve onun stilini kopyala.

## Yan etki kuralı: "başka bir şeyi bozma"
Her iş başlamadan önce yönetici bir **etki listesi** çıkarır: bu değişiklik başka nereleri etkileyebilir?
Her zaman şunları düşün: diğer 6 araç, motosiklet, tüm modlar (menü/serbest/yarış/geri sayım/çok oyunculu),
telefon kontrolleri, gece/yağmur, Düşük/Orta/Yüksek/Ultra kalite, kayıt dosyası, eski sürümdeki oyuncular,
`klasik.html`. Test uzmanı bu listedeki her maddeyi kontrol eder; listede olmayan bir yerde fark çıkarsa bu bir bulgudur.

## İş akışı: ekip
Kullanıcı bir iş istediğinde (özellik, düzeltme, tasarım) sen **yöneticisin**. İşi `.claude/agents/` altındaki ekibe
dağıtırsın; kendin büyük kod yazmazsın. Küçük işler (bir yazıyı değiştirmek, bir rengi düzeltmek) için kullanıcı
"ekipsiz" derse ya da iş açıkça önemsizse ekibi çağırmadan kendin yap, yine testleri koştur.

1. **Anla ve planla.** İsteği bir cümleyle yeniden yaz. Belirsizse en fazla bir soru sor. Kabul kriterlerini yaz
   ("bitti sayılması için ne doğru olmalı"). `HATALAR.md`'de ilgili madde varsa numarasını kullan.
   **Etki listesini** çıkar (yukarıdaki kural).
2. **Dal aç:** `is/<kisa-ad>` (ör. `is/motor-wheelie`). main'e doğrudan yazılmaz.
2b. **Tasarım taslağı (ekranda görünen bir şey eklenecekse, koddan ÖNCE):** `tasarimci` nasıl görünmesi gerektiğini
   yazar: nereye konacak, hangi mevcut öğeye benzeyecek, hangi renk/yazı tipi, telefonda nasıl duracak.
   Geliştirici bu taslağa göre yapar; böylece tasarım sonradan düzeltilmez, ilk seferde doğru olur.
3. **Geliştirici** (`gelistirici`) işi kabul kriterleri, etki listesi ve (varsa) tasarım taslağıyla yapar.
4. **Kontrol — üçü aynı anda:**
   - `test-uzmani`: yeni davranışın testini yazar, ilgili altın testleri koşturur, gerekiyorsa main ile karşılaştırır.
   - `tasarimci`: görünen bir değişiklikse masaüstü + telefon ekran görüntüleriyle bakar.
   - `denetci`: kodu okur; mantık, çok oyunculu senkron, performans, bellek, güvenlik.
5. **Düzeltme turu.** Bulgular geliştiriciye döner. En fazla 3 tur; 3 turda temizlenmezse dur, kullanıcıya durumu
   ve seçenekleri yaz.
6. **Push + önizleme + rapor (CI'ı bekleme).** Yerel testler yeşilse dalı push et, önizlemeye al (önizleme
   reposundaki `KAYNAK` dosyasına dalın commit'ini yaz) ve kullanıcıya **hemen** kısa rapor ver. GitHub tam seti
   arkada koşar; raporda "GitHub testleri sürüyor" de. CI sonucu gelince tek satırla bildir; kırmızıysa sebebini
   bul, düzelt, tekrar push et.
7. **Onay gelince** main'e birleştir. CI o dal için henüz bitmediyse ya da kırmızıysa birleştirme; kullanıcıya
   "testler bitince canlıya alıyorum" de ve bitince birleştir. Yayın iş akışı testleri tekrar koşar, yeşilse canlıya
   çıkar ve etiketler.

**Süre hedefi:** İstekten rapora **en fazla 15 dakika.** Bunu aşacak bir iş ise (büyük özellik, çok dosya) başta
kullanıcıya tahmini süreyi söyle ve işi 15 dakikalık parçalara böl; her parça bitince rapor ver.

**Birden fazla istek:** Kullanıcı bir iş sürerken yeni bir şey isterse onu bekletme. Yeni iş başka dosyalara
dokunuyorsa ayrı dalda paralel başlat (ayrı geliştirici, ayrı worktree). Aynı dosyalara (özellikle `js/main.js`)
dokunuyorsa sıraya al ve kullanıcıya "şu iş bitince başlıyorum (~X dk)" de.

**Paralel çalışma:** Birbirinden bağımsız ve farklı dosyalara dokunan işleri aynı anda yaptırabilirsin (ör. yeni araç
+ ses düzeltmesi). Her geliştiriciyi ayrı worktree'de çalıştır. `js/main.js`, `js/physics.js` ya da `js/net.js`'e
dokunan iki işi asla paralel yaptırma.

## Test komutları
Ayrıntı: `tests/baseline/README.md`. Testler derlenmiş oyuna karşı koşar:
```
npx vite build --base=/ --outDir /tmp/dist-test
cd tests && npm ci && export GAME_ROOT=/tmp/dist-test
```
**Hız kuralı:** Bu ortamda ekran kartı yok; tam set yerelde 1,5–2 saat sürer. Tam seti GitHub zaten her push'ta ve
her yayından önce koşuyor, bu yüzden **tam seti yerelde koşturma.** Yerelde sadece:
- **Hızlı set (her değişiklikte, ~10 dk):** `physics.mjs check`, `saves.mjs check`, `keys.mjs check`.
- **İşle ilgili testler:** yeni yazılan test + etki listesindeki maddelere karşılık gelen testler. Ekranda görünen bir
  değişiklikse `visual.mjs`/`menu.mjs`'yi yalnız ilgili ekranlarla sınırlı koştur.
- CI'da uzun testler parçalı koşar (görsel 5+1, menü 6, bellek 3 parça; `testler.yml`). Yeni görsel görüntü eklersen
  uygun parçanın düzenli ifadesine ekle; eklemezsen "visual-kalan" parçasında yine test edilir.
- **Tam set (yalnız CI'da):** yukarıdakiler + `visual.mjs check`, `menu.mjs check`, `klasik.mjs check`, `mp.mjs`,
  `sw.mjs`, `saglamlik.mjs`, `bellek.mjs`, `harita.mjs`, `ultra.mjs`, `worker.mjs`, `perf.mjs check`. Rapor CI'ı
  beklemez; ama CI yeşil olmadan main'e birleştirme yapılmaz.
- Çok oyunculu (`mp.mjs`) bu ortamda dış PeerJS'e ulaşamaz; çok oyunculu bir değişiklikte yerel sunucuyla koştur.
- Aynı testi iki ajan koşturmasın: testleri test uzmanı koşturur; geliştirici yalnız hızlı seti koşturur.
- **"Bu hata canlıda da var mı?":** `karsilastir.mjs <main> <derleme>`.
- Tarayıcı: Chrome for Testing 153.0.8010.12 + SwiftShader; yavaş makinede `TP_ZAMAN_KAT=2`.
- Uzun komutlara zaman aşımı koy. Arka plana atılan iş, tur biterse kapatılabilir: sonucu beklemeden turu bitirme.

## Kullanıcıya rapor formatı
- Kullanıcıyı bekleten bir şey varsa mesajın **en başına** `⏸ ONAY BEKLİYORUM` yaz.
- Kısa tut: ne yapıldı (2–4 madde), test tablosu, bulunan sorunlar, ondan ne istendiği.
- Gerçek cihaz gerektiren şeyleri (gerçek FPS, telefon hissi, farklı ağdan çok oyunculu) ayrıca belirt; kullanıcı test
  etmeyi sevmez, en kısa listeyi ver.
- `HATALAR.md` ve `OZELLIKLER.md`'yi güncel tut; her iş için `tests/baseline/raporlar/` altına kısa rapor yaz.
