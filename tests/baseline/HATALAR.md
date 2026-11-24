# Bilinen hatalar ve kusurlar (geçiş sırasında düzeltilecek)

Her madde ayrı commit ile düzeltilir; düzeltme sürüşü değiştiriyorsa önce onay alınır ve fizik referansı yalnızca onaydan sonra yenilenir.

| # | Alan | Sorun | Durum |
|---|------|-------|-------|
| H1 | Multiplayer | Misafir bot araca çarpınca impuls host'a gitmiyor (trafiği host simüle ediyor); duman/kıvılcım misafirde görünmüyor (pack() içinde yok) | ✅ Aşama 4: misafir darbeyi host'a yollar (doğrulanıp sınırlanır), host uygular; duman + kaza efekti pakette (kayba dayanıklı sayaç); uzak kaza sesi mesafeyle azalır. `mp.mjs` (eski sürümde bozuk olduğu negatif kontrolle kanıtlı) |
| H2 | Grafik | Efektler otomatik kapanınca composer/bloom render target'ları dispose edilmiyor (GPU bellek sızıntısı); efektler bir daha açılamıyor | ✅ Aşama 5: `composerBirak()` geçişleri ve render target'ları bırakıyor (`saglamlik.mjs`: doku sayısı düşüyor) |
| H3 | Grafik | `if(false)` ile kapalı GTAO kodu | ✅ Aşama 5: yeni **Ultra** grafik seçeneği = Yüksek + GTAO; otomatik seçim Ultra'yı seçmez (`saglamlik.mjs`) |
| H4 | Altyapı | three.js, PeerJS ve Draco çözücü unpkg'den geliyor; unpkg çökerse oyun açılmıyor (klasik.html dahil) | ✅ Aşama 1: hepsi npm (sabit sürüm) + derleme; klasik.html dahil dışarıdan kod yüklenmiyor |
| H5 | Multiplayer | TURN için herkese açık openrelay kullanıcı/şifresi koda gömülü, güvenilmez | ✅ Aşama 4 (kod): openrelay kaldırıldı; TURN Metered (ücretsiz) + Cloudflare Worker aracı, anahtar Worker'da gizli. Worker kuruldu (`https://turbo-pist-turn.53mehmetozdemir.workers.dev/ice`), GitHub'dan doğrulandı: `X-TP-Kaynak: metered`, 4 TURN sunucusu, başka köken 403 |
| H6 | Arayüz | Büyük harita kısa/küçük pencerede (örn. 640×360) yan panel aşağı kayıp listeyi gösteremiyor | ✅ Aşama 5: kısa yatay ekranda harita + liste yan yana, liste kaydırılabilir; `harita.mjs` 4 boyut (eski derlemede 640×360'ı yakalıyor) |
| H7 | Arayüz | Yarış modunda yakıt kullanılmadığı hâlde HUD'da YAKIT çubuğu görünüyor | ✅ Aşama 5: yarışta yakıt satırı gizli, kutu kısalıyor. **Düzeltme:** ilk kayıtta hasarın da kullanılmadığı yazıyordu, yanlış — yarışta hasar birikiyor ve direksiyonu/gücü etkiliyor (`physics.js`), HASAR göstergesi kalıyor |
| H8 | Arayüz | Kısa ekranda (≤ 400 px yükseklik) menüde boya renkleri sabit başlat düğmelerinin altında kalıyor (kaydırınca görünüyor). Aynı sorun 1366×768 dizüstünde de var: menünün altındaki bağlantı notunun üst satırları "Odaya Gir / Tek Başına Gez" düğmelerinin arkasında kalıyor (`screens/laptop_1366_menu.png`) | ✅ Menü kısmı düzeltildi (yeni referans onayını bekliyor): menü = kaydırılan içerik + altta sabit düğme bölümü (düğmeler artık içeriğin üstünde süzülmüyor); GRAFİK tam satır, VİTES/YARDIMLAR yan yana, dar ekranda alt alta; `menu.mjs` 6 boyut × güncelleme var/yok × üst/alt: kesişme yok, yazılar sığıyor. Büyük harita (H6) ayrı |
| H9a | Kayıt | Kayıt formatında sürüm alanı yok; ileride format değişirse eski kayıtlar bozulabilir | ✅ Aşama 3: `js/save.js` — `v` alanı, adım adım geçiş, daha yeni sürümün kaydı korunur, bozuk kayıt `tp8_save_bozuk`'a yedeklenir, yanlış türdeki alanlar onarılır |
| H9b | Kayıt | Aracın konumu kaydedilmiyor (her açılışta başlangıç noktası) | **Altyapı bittikten sonra ayrı iş** (şimdilik sadece listede) |
| H10 | Multiplayer | Diğer oyuncunun aracındaki göçük/hasar karşı tarafa yansımıyor | **Altyapı bittikten sonra ayrı iş** (şimdilik sadece listede) |
| H11 | Kod | js/caddy.js hiçbir yerden yüklenmiyor (Caddy menüden kaldırıldı). Kullanıcı kararı: dosya silinmeyecek, olduğu gibi kalacak. (fleetcar.js → car.js'te, props.js → city.js, track.js, traffic.js'te kullanılıyor.) | karar verildi: dokunulmayacak |
| H12 | Test ortamı | FPS sayacı test sırasında "0 FPS" gösteriyor (sanal saat; oyun hatası değil) | — |
| H13 | Bağımlılık | Yazı tipleri (Bungee, Inter) Google Fonts'tan geliyordu; çevrimdışı/PWA'da ve Google'a erişilemeyen ağlarda yedek yazı tipine düşüyordu | ✅ Aşama 2: @fontsource/bungee 5.3.0 + @fontsource/inter 5.3.0 (aynı aile ve kalınlıklar), `fonts.css` |
| H14 | Derleme | Vite 8'in CSS küçültücüsü `backdrop-filter`'ı silip sadece `-webkit-` önekini bırakıyordu → telefon tuşlarında buzlu cam kayboluyordu (görsel testte %0,35 fark olarak yakalandı) | ✅ Aşama 1'de düzeltildi: `cssMinify: false`, CSS kaynakla birebir aynı |
| H15 | Kullanılmayan dosya | `assets/brick_rough.jpg` hiçbir yerden yüklenmiyordu | ✅ Aşama 3: silindi (onayınla; git geçmişinde duruyor) |
| H16 | Önizleme | Önizleme canlıyla aynı alan adında olduğu için aynı localStorage'ı kullanıyordu: önizlemede oynamak canlıdaki parayı/kaydı değiştiriyordu | ✅ Aşama 3: önizleme derlemesi `onizleme_` ön ekiyle yazar, canlıyı sadece okur (klasik.html hariç: o eski tek dosya, sadece isim/ayar tutuyor) |
| H17 | Multiplayer | Önizleme ve canlı oyuncular aynı oda koduyla aynı odaya düşebiliyordu | ✅ Aşama 4: önizleme oda ön eki `turbopist-v3-onizleme-` (canlı değişmedi: önbellekte eski sürümü olan oyuncular da aynı odaya düşsün) |
| H18 | Multiplayer | Sürüm farkı fark edilmiyordu | ✅ Aşama 4: protokol sürümü `pv`; farklıysa "sayfayı yenile" uyarısı (eski sürüm alan göndermediği için yeni taraf uyarır). Uyumsuz değişiklikte `PROTO_ANA` artırılır → oda ön eki değişir |
| H19 | Multiplayer | Metered ücretsiz TURN planı artık **ayda sadece 500 MB'lık deneme** (20 GB değil). Kota dolarsa: Worker yine liste verir, TURN sunucusu reddeder, oyun STUN'a düşer (normal ağlarda oynanır); TURN'ün şart olduğu ağlarda 15 sn sonra "Odaya bağlanılamadı · Wi-Fi'da tekrar dene" | **Bilinen sınır.** Kullanım Metered panelinden izlenmeli; gerekirse Cloudflare TURN'e geçiş (`worker/README.md`, sadece Worker değişir) |
| H20 | Bellek | Araç değişiminde ve çok oyunculuda oyuncu ayrılınca eski aracın GPU kaynakları bırakılmıyordu (her geçişte ~5–100 geometri birikiyordu) | ✅ Aşama 5: `aracBirak()` — sadece başka yerde kullanılmayanlar bırakılır (şablonlar, ayna/yansıma hedefleri, ortam haritası korunur); `bellek.mjs`: 3 tur sonunda +1 geometri, +0 doku |
| H21 | Sağlamlık | WebGL bağlamı kaybı, sekme gizlenmesi ve açılış sonrası yakalanmayan hatalar için hiçbir işlem yoktu (oyun donuyor/sessizce bozuluyordu; arka planda motor sesi çalıyordu) | ✅ Aşama 5: bağlam kaybında kaydet + panel, geri gelince yeniden yükle; sekme gizlenince ses askıda, tek oyunculuda duraklat; hata çubuğu + "Kaydet ve yenile" (`saglamlik.mjs`) |
| H22 | Grafik | Aşama 5 Ultra: GTAO sahnenin bitmiş görüntüsünü (ışık sprite'ları, egzoz alevi, kıvılcımlar dahil) gölgelendirmeyle çarpıyordu; sprite'lar GTAO'nun normal/derinlik ön çizimine katı cisim gibi giriyordu → bazı kartlarda stop lambası çevresinde büyük kırmızı hale, yola yayılan parlama, bozuk alev, kaportada koyu çizgiler. Eski Ultra testi yalnız "daha parlak piksel" sayıyordu, kararan efektleri görmüyordu. | ✅ Aşama 5 düzeltmesi: sıra katı sahne → GTAO (yerinde çarpma, 0..1 kıstırılmış, asla aydınlatmaz) → saydam/ışık efektleri (Yüksek'teki sırayla, aynı derinlikle) → bloom. GTAO'ya ait nesneler yalıtılmış rastgele üreteçle kurulur. `ultra.mjs`: gündüz+gece, efekt katkısı karşılaştırması; aşama 5 derlemesinde %9,9 / %29,1 (❌), düzeltilmişte %0,3 / %1,1 (✅, sınır %2) |
| H23 | Sağlamlık | Aşama 3 açılış bekçisi: service worker'dan gelen açılış 45 sn'yi aşınca bozuk sayıyordu → önbelleği silip SW'yi kaldırıp yeniden yüklüyordu. Yavaş cihazda her oturumda her şey baştan iniyordu; çevrimdışıyken oyun hiç açılamıyordu. CI'daki sw testi bunu yakaladı (yavaş makinede çevrimdışı açılış takıldı). | ✅ Aşama 6: süre sınırı yalnız oyun kodu hiç çalışmaya başlamadıysa (`__tpKodBasladi`); çevrimdışıyken önbellek hiç silinmez. `sw.mjs` 3b: bekçi 1 sn'ye indirilip yavaş açılış denenir; eski bekçide 22 oyun dosyası yeniden indi + bekçi uyarısı (❌), yenide 0 (✅) |
| H24 | Test | Referans görüntüler bu geliştirme ortamının Chrome sarmalayıcısıyla çekilmişti: sarmalayıcı WebGL'i ortama özel, yamalı bir Mesa sürücüsüne (lavapipe) yönlendiriyor ve `--use-angle=swiftshader` bayrağını siliyordu. GitHub'da bu sürücü yok → görüntüler CI'da tutmazdı. | ✅ Aşama 6: testler her yerde sade Chrome for Testing 153.0.8010.12 + SwiftShader (Chrome'un kendi yazılımsal sürücüsü) ile; referanslar bununla yeniden çekildi (onaya sunuldu) |
| H25 | Çok oyunculu | Canlıya geçişte mp testi bir kez kırmızı: "misafirin çarptığı araç host'ta kaza yapıyor" (aynı kod önceki 5 koşuda yeşildi). İlk şüphe: misafir çarpmayı aracın dizideki SIRA NUMARASIYLA bildiriyordu; iki taraftaki listeler farklı kurulursa yanlış araç kaza yapabilirdi. Ölçüm (8 deneme, her çarpmada misafirin gönderdiği/host'un aldığı numara ve konum): numaralar her seferinde aynı araca denk geldi (fark ≤ 1,3 m), yanlış araca kaza 0 — sıra kayması bu koşullarda **gözlenmedi**. Kaçan denemede misafir araca hiç değmemişti (senaryo ıskası). CI'daki tek kaçışın kesin sebebi günlükte yoktu. | ✅ Yine de yapısal düzeltme: her trafik aracının kalıcı kimliği (`tid`); host saniyede bir pakete ekler (`ti`); misafir çarpmayı kimlikle bildirir; host kimliksiz ya da bilinmeyen kimlikli darbeyi **yok sayar** (yanlış araca asla uygulanmaz). PROTO 3 (ana sürüm aynı). mp testi: yanlış araç kaza yapmıyor; kimliksiz/bilinmeyen kimlik yok sayılıyor; sıra numarası yanlış + kimlik doğru → kimliğin aracı; ıskada başka araçla yeniden deneme; kırmızıda host'a ulaşan darbeler günlüğe |

## Oyun düzeltmeleri — altyapı sonrası
Önizlemede gerçek cihazda bulundu (22.11.2026). Hepsi **canlıda (main e771e2a) da var**, altyapı bozmadı. Kanıt:
(1) ilgili kod (`physics.js`, `bike.js`, `bikeglb.js`, `interior.js`, `effects.js`, `damage.js`) main'den beri hiç değişmedi;
(2) `tests/baseline/karsilastir.mjs`: main ile altyapı aynı donmuş saatle — 7 araç × takip/kokpit görüntüsü %0,00 fark,
çizim/üçgen aynı; yüksek hızda fren, hasarlı düz sürüş, gaz+fren 7 araçta fizik birebir aynı. **Altyapı bitene kadar dokunulmuyor.**

| # | Araç | Sorun | Koddan/ölçümden ilk bulgu |
|---|---|---|---|
| M1 | GSX-R 750 | Sağa çevirince ön teker görsel olarak sola dönüyor | ✅ Düzeltildi (`is/m1-on-teker`): ön takım, kafa borusundan ön tekere (aşağı) bakan eksen etrafında `-steer` ile dönüyordu; aşağı bakan eksende bu ters yön demek. İşaret çevrildi, miktar (0,7) aynı. Prosedürel motosiklet de aynı iskeleti kullanıyor. Test `motor.mjs`: önce sağ direksiyonda ön takım yanı −0,39 (❌), sonra +0,39 (✅). Fizik değişmedi. |
| M2 | GSX-R 750 | Yüksek hızda frende denge kaybı | Düz frende fizik kararlı (50 m/s → yön 0); sorun yatış/direksiyonla birlikte ya da görselde aranmalı |
| M3 | GSX-R 750 | Hasarda sürekli sağa çekme, motorda fazla | Ölçüldü: hasar 60, 4 sn düz gazda motor 0,46 rad sapıyor (F40: 0,10). Motora ayrı/az katsayı gerekli |
| M4 | GSX-R 750 | Aynalar bembeyaz | Motorun ayna tanımı yok (`mirrors`), model malzemesi düz beyaz |
| M5 | GSX-R 750 | Gösterge çalışmıyor (10 km/s'de 0) | Motorun gösterge tanımı yok (`dash`); ekrandaki rakam modelin sabit dokusu |
| M6 | GSX-R 750 | **Yeni özellik:** Ctrl ile wheelie; telefon ve oyun kolu karşılığı | — (fizik + animasyon + giriş; sürüş hissini değiştirir) |
| M7 | GSX-R 750 | (genel kontrolde bulundu) Egzozdan bir şey çıkmıyor | Egzoz tanımı yok (`exhaust`) |
| P1 | 911 GT3 | Tekerlekler dönmüyor | `wheelMats: null` ve parça adları teker kalıbına uymuyor → teker pivotları bulunamıyor (muhtemel) |
| P2 | 911 GT3 | Egzozdan alev/duman yok | Egzoz tanımı yok (`exhaust`) |
| P3 | 911 GT3 | Kokpitte aynalar yanlış yerde | `mirrors` koordinatları modele uymuyor; iç dikiz aynası tavanda havada |
| P4 | 911 GT3 | Kokpit göstergeleri çalışmıyor | Gösterge tanımı yok (`dash`) |
| P5 | 911 GT3 | Ön cam kenarı ve torpidoda beyaz üçgenler | Kokpit görüntüsünde doğrulandı; malzeme eşlemesinde kalan parçalar (model/kaplama) |
| P6 | 911 GT3 | Kokpitte FPS 46 (diğerleri 60) | Kokpitte çizim çağrısı/üçgen diğerleriyle aynı ölçüldü → geometri değil; malzeme (`keepStd`) / ayna maliyeti incelenecek. Gerçek cihazda ölçülmeli |
| C1 | Civic Type R | Egzozdan bir şey çıkmıyor | Egzoz tanımı yok (`exhaust`) |
| C2 | Civic Type R | Gaz+fren patinajı yok (önden çekişte ön teker dönmeli) | Ölçüldü: gaz+fren 4 sn → Civic hiç kıpırdamıyor (hız 0), F40/GT3 patinajla ilerliyor. Burnout mantığı arkadan itiş varsayıyor (muhtemel) |
| C3 | Civic Type R | Kokpitte aynalar yanlış yerde | İç dikiz aynası yansımasız soluk dikdörtgen görünüyor |
| C4 | Civic Type R | Kokpit göstergeleri çalışmıyor | Gösterge tanımı yok (`dash`) |
| G1 | Şehir (çizim) | Bazı kamera açılarında yolun asfaltı yerine altındaki çimen görünüyor (SwiftShader'da e2008 takip, GSX-R kokpit ve **telefon görünümü** — Düşük kalite, Ferrari bile; 6. aşama CI'da bulundu). main'de de var. | Asfalt çiziliyor, çimen 2 cm altında olmasına rağmen derinlik testini geçip üstüne çiziliyor (çimeni gizleyince yol görünüyor). Muhtemel sebep: bölge çimeni ~1,3×3 km tek dört köşeli düzlem; kameraya çok yakın dev üçgenlerde derinlik ara değerleme hatası 2 cm'yi aşıyor. Chrome ekran kartı hızlandırması olmayan oyuncularda SwiftShader kullanır → bu oyuncular görebilir. Telefonlar otomatik Düşük kaliteyi seçiyor ve mobil kartların derinlik hassasiyeti çoğu zaman daha düşük → telefon oyuncularında da görülme olasılığı yüksek; gerçek telefonda kontrol edilmeli. Önerilen düzeltme (görüntü değişmeden): çimen düzlemini şehir karesinin altında boş bırakmak (yol ile örtüşme kalmaz) ya da düzlemleri parçalara bölmek |

**Genel kontrol (7 araç, kokpit):**
| Araç | Gösterge | Aynalar | Egzoz |
|---|---|---|---|
| Ferrari 458 | ✅ (kendi kadranı) | ✅ | ✅ alev |
| Ferrari F40 | ✅ | ✅ | ✅ |
| Tesla Model 3 | ✅ ekran (23 km/s) | ✅ | elektrikli (yok, doğru) |
| Peugeot e-2008 | ✅ ekran (15 km/s) | ✅ | elektrikli (yok, doğru) |
| GSX-R 750 | ❌ M5 | ❌ M4 | ❌ M7 |
| 911 GT3 | ❌ P4 | ❌ P3 | ❌ P2 |
| Civic Type R | ❌ C4 | ❌ C3 | ❌ C1 |
