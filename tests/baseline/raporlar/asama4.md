# Aşama 4 — Multiplayer: TURN (Metered + Worker), H1, sürüm uyarısı, ayrı odalar

Referans: main @ e771e2a (canlı).

## Değişenler
- **TURN (H5):** openrelay'in koda gömülü herkese açık kullanıcı/şifresi kaldırıldı. TURN: Metered ücretsiz plan;
  API anahtarı yalnız Cloudflare Worker'da gizli değişken (`worker/turn.js`). Worker sadece
  `https://53mehmetozdemir-maker.github.io` kökeninden cevap verir, Metered'e en fazla 10 dk'da bir sorar, hata olursa
  yalnız STUN döner. Oyun (`js/net.js` → `iceSunucular()`) Worker'a 4 sn'de ulaşamazsa yalnız STUN ile dener.
  Worker adresi derlemede `VITE_TURN_URL`; **Worker kurulana kadar boş** (sadece STUN).
- **H1:** misafir trafik aracına çarpınca darbe host'a gider (`net.sendHost` → host `traffic.applyHits`, değerler
  doğrulanır/sınırlanır), host'ta araç savrulur, dörtlü yakar, korna çalar; duman ve kaza efekti pakete eklendi
  (paket kayıplı olduğu için sayaçla: kaybolan paket efekti yutmaz, iki kez de oynatmaz; katılınca eski kazalar
  oynamaz). Uzak kaza sesi mesafeyle azalır (30 m içinde tam; tek oyunculuda değişiklik yok).
- **Sürüm uyarısı:** varlık bilgisinde protokol sürümü `pv` (PROTO=2). Farklıysa bir kez "sayfayı yenile" uyarısı.
  Eski sürüm (`pv` yok) uyarı gösteremez; yeni taraf "X eski sürümde, sayfayı yenilemesi lazım" der.
- **Ayrı odalar:** önizleme derlemesi `VITE_ODA_ONEK=onizleme-` → oda kimliği `turbopist-v3-onizleme-KOD`.
  Canlının ön eki **değişmedi** (`turbopist-v3-KOD`): yayından sonra önbellekte eski sürümü olan oyuncular yeni
  sürümdekilerle aynı odaya düşer ve sürüm uyarısını görür. Sürüm bilgisi ön eke yalnız uyumsuz bir değişiklikte
  girer (`PROTO_ANA`); uyumlu sürümleri ayırmak uyarıyı imkânsız kılardı (birbirlerini hiç görmezlerdi).
- Geriye uyumluluk: mesajlara yalnız alan eklendi. Eski host bilinmeyen misafir mesajını yok sayar; eski misafir
  paketteki fazla alanları okumaz (aşağıda gerçek eski kodla sınandı).
- Fizik, sürüş, tek oyunculu oyun: dokunulmadı.

## Sonuçlar
| Test | Sonuç |
|---|---|
| Çok oyunculu (`mp.mjs`, yerel PeerJS sunucusu, 20 kontrol) | ✅ 20/20 |
| Worker birim testi (`worker.mjs`, 11 kontrol) | ✅ 11/11 |
| Fizik (7 araç) | ✅ 7/7 birebir aynı |
| Kayıt (4 + 5 geçiş) | ✅ 9/9 |
| Klavye kısayolları (28) | ✅ 28/28 |
| klasik.html | ✅ aynı |
| Görsel (35) | ✅ 35/35, hepsi %0,00 |
| Service worker (24) | ✅ 24/24 |
| Perf (7 sahne) | ✅ çizim/üçgen birebir aynı; JS ms/kare 6,6–12,6 (ilk ölçümde ilk sahne 14,3 ms / 57 MB çıktı; tekrar ölçümde 12,6 ms / 36 MB → ısınma/çöp toplama gürültüsü) |

### mp.mjs — eski sürüm olarak main'in kendi kodu
- yeni ↔ yeni: aynı odada birbirini görüyor; kurucu/misafir doğru; aynı sürümde uyarı yok.
- TURN listesi Worker adresinden alınıp WebRTC'ye veriliyor.
- H1: misafirin çarptığı araç host'ta kaza yapıyor; misafir onu dörtlülerle ve kaza efektiyle görüyor.
- Host'un çarptığı araç misafirde dörtlülü + efektli.
- Host ayrılınca misafir ana menüye dönüyor, "Oda kurucusu ayrıldı" uyarısı.
- Konsol hatası yok.
- eski host ↔ yeni misafir: bağlanıyor, trafik geliyor, misafire "oda kurucusu eski sürümde" uyarısı;
  **negatif kontrol**: eski host'ta misafirin çarptığı araç kaza yapmıyor (H1 eski sürümde vardı, test yakalıyor);
  yeni misafirin çarpma mesajı eski host'u bozmuyor.
- yeni host ↔ eski misafir: bağlanıyor, host'a "EskiMisafir eski sürümde" uyarısı; eski misafir ek alanlı paketleri
  hatasız okuyup kazayı dörtlülerle görüyor.
- canlı ve önizleme aynı oda koduyla ayrı odalarda (ikisi de kurucu).
- Worker'a ulaşılamayınca yalnız STUN ile yine bağlanıyor.

## Testin yakaladıkları
- sw.mjs'de "yarış duraklatmasında uyarı yok" bir kez kırmızı: duraklatma ekranı ağır yükte geç açılmış, test erken bakmıştı (düğme gizliydi). Kontrol artık ekranı bekliyor ve ayrıntı yazıyor; 24/24.
- Test, PeerJS'in yüklenirken destek sınaması için kendi varsayılan ayarıyla bir bağlantı açtığını gösterdi
  (oyunun bağlantısı değil; test buna göre düzeltildi).

## Sınırlar (bu ortamda test edilemeyen)
- Gerçek internet üzerinden bağlantı (PeerJS bulut sunucusu, mobil veri, TURN'ün gerçekten devreye girmesi):
  elle test listesi kullanıcıda.
- Host ayrılınca oda biter (önceki davranış, değiştirilmedi); misafir menüye döner.
