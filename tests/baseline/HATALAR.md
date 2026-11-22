# Bilinen hatalar ve kusurlar (geçiş sırasında düzeltilecek)

Her madde ayrı commit ile düzeltilir; düzeltme sürüşü değiştiriyorsa önce onay alınır ve fizik referansı yalnızca onaydan sonra yenilenir.

| # | Alan | Sorun | Durum |
|---|------|-------|-------|
| H1 | Multiplayer | Misafir bot araca çarpınca impuls host'a gitmiyor (trafiği host simüle ediyor); duman/kıvılcım misafirde görünmüyor (pack() içinde yok) | ✅ Aşama 4: misafir darbeyi host'a yollar (doğrulanıp sınırlanır), host uygular; duman + kaza efekti pakette (kayba dayanıklı sayaç); uzak kaza sesi mesafeyle azalır. `mp.mjs` (eski sürümde bozuk olduğu negatif kontrolle kanıtlı) |
| H2 | Grafik | Efektler otomatik kapanınca composer/bloom render target'ları dispose edilmiyor (GPU bellek sızıntısı); efektler bir daha açılamıyor | Aşama 5 |
| H3 | Grafik | `if(false)` ile kapalı GTAO kodu (silinmeyecek; "Ultra" kaliteye bağlanacak) | Aşama 5 |
| H4 | Altyapı | three.js, PeerJS ve Draco çözücü unpkg'den geliyor; unpkg çökerse oyun açılmıyor (klasik.html dahil) | ✅ Aşama 1: hepsi npm (sabit sürüm) + derleme; klasik.html dahil dışarıdan kod yüklenmiyor |
| H5 | Multiplayer | TURN için herkese açık openrelay kullanıcı/şifresi koda gömülü, güvenilmez | ✅ Aşama 4 (kod): openrelay kaldırıldı; TURN Metered (ücretsiz) + Cloudflare Worker aracı, anahtar Worker'da gizli. Worker kuruldu (`https://turbo-pist-turn.53mehmetozdemir.workers.dev/ice`), GitHub'dan doğrulandı: `X-TP-Kaynak: metered`, 4 TURN sunucusu, başka köken 403 |
| H6 | Arayüz | Büyük harita kısa/küçük pencerede (örn. 640×360) yan panel aşağı kayıp listeyi gösteremiyor | Aşama 5 |
| H7 | Arayüz | Yarış modunda yakıt/hasar kullanılmadığı hâlde HUD'da YAKIT ve HASAR barları görünüyor | Aşama 5 |
| H8 | Arayüz | Kısa ekranda (≤ 400 px yükseklik) menüde boya renkleri sabit başlat düğmelerinin altında kalıyor (kaydırınca görünüyor). Aynı sorun 1366×768 dizüstünde de var: menünün altındaki bağlantı notunun üst satırları "Odaya Gir / Tek Başına Gez" düğmelerinin arkasında kalıyor (`screens/laptop_1366_menu.png`) | Aşama 5 |
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
