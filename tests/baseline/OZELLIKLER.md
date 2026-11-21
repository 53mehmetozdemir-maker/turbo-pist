# Turbo Pist — özellik envanteri (altın referans, main @ e771e2a)

Her aşamadan sonra bu listedeki her madde işaretlenir: ✅ çalışıyor · ⚠️ test edilemedi (neden) · ❌ sorunlu.

## 1. Sayfalar ve açılış
1.1 `index.html` (ana oyun) · 1.2 `klasik.html` (eski sürüm, kendi içinde tek dosya) · 1.3 yükleme ekranı · 1.4 favicon, apple-touch-icon, manifest (ana ekrana ekle, tam ekran, yatay) · 1.5 `?oda=KOD` davet linki · 1.6 `?bot` test parametresi · 1.7 `window.__game` test kancası

## 2. Menü
2.1 İsim · 2.2 araç seçimi (kartlar) · 2.3 8 boya rengi · 2.4 harita: Şehir / Pist · 2.5 saat: Gündüz / Akşam / Gece · 2.6 hava: Açık / Yağmurlu · 2.7 oda kodu + 🎲 yeni kod · 2.8 grafik: Düşük / Orta / Yüksek (+ otomatik ilk seçim) · 2.9 vites: Oto / Manuel · 2.10 yardımlar: Açık / Kapalı · 2.11 "Odaya Gir" · 2.12 "Tek Başına Gez/Antrenman" · 2.13 bağlantı durumu notu · 2.14 Kontroller listesi · 2.15 3D model kredileri · 2.16 menü arkasında dönen araç önizlemesi · 2.17 tüm ayarların localStorage'da kalıcılığı

## 3. Araçlar (7)
3.1 Ferrari 458 Spider · 3.2 Ferrari F40 (açılır farlar) · 3.3 Tesla Model 3 Performance (elektrikli) · 3.4 Peugeot e-2008 (elektrikli) · 3.5 Suzuki GSX-R 750 (motosiklet, prosedürel sürücü, yatma, ön takım) · 3.6 Porsche 911 GT3 (992) · 3.7 Honda Civic Type R (FK8)
Her araçta: 3.a gerçek motor/vites/tork değerleri · 3.b motor sesi profili · 3.c far, stop, geri, sinyal lambaları · 3.d iç mekân/kokpit (direksiyon dönüşü, gösterge çizimi) · 3.e iç ve yan aynalar (gerçek yansıma) · 3.f boya rengi değişimi · 3.g egzoz alevi / backfire · 3.h nitro (araç başına) · 3.i hasar: göçük, ön cam çatlağı, kırık far/stop, cam döküntüsü
(Kodda kalan ama menüde olmayan: prosedürel Ducati/bike.js tabanı — GSX-R'nin sürücü/rig'i bunu kullanıyor; `builtin` prosedürel araba — model yüklenemezse yedek)

## 4. Sürüş ve fizik
4.1 120 Hz sabit adımlı fizik + interpolasyon · 4.2 bisiklet modeli + Pacejka lastik · 4.3 oto/manuel vites, devir kesici, kalkış (el freni+gaz) · 4.4 burnout (gaz+fren) · 4.5 el freni drift · 4.6 nitro (bar biter) · 4.7 yüzey tutuşu (asfalt/kaldırım/çim) · 4.8 yağmurda tutuş · 4.9 yokuş fiziği (dağ yolu) · 4.10 duvar/bina/bariyer çarpışması · 4.11 araç–araç çarpışması · 4.12 hasarın sürüşe etkisi (direksiyon çekmesi, güç kaybı) · 4.13 yakıt tüketimi / rejeneratif fren (EV) · 4.14 "R" yola geri dön · 4.15 yardımlar (ABS/TCS benzeri) · 4.16 oyun kolu desteği · 4.17 süspansiyon/gövde yalpası, tekerlek dönüşü

## 5. Kamera ve görüntü
5.1 kamera: Takip / Kokpit / Kaput (C) · 5.2 fare ile etrafa bakma · 5.3 kokpitte aynalar (iç + yan), aynasız araçta alt dikiz şeridi · 5.4 sarsıntı (çarpma) · 5.5 dağda arazi içine girmeyen kamera · 5.6 bloom (yüksek grafik, gece) · 5.7 cubemap araç yansıması (yüksek) · 5.8 HDR gökyüzü/ortam (saate göre) · 5.9 gece: sokak lambaları, bina pencereleri, far ışığı · 5.10 yağmur: damlalar, ekranda damla, ıslak yol · 5.11 yıldızlar · 5.12 FPS'e göre otomatik çözünürlük + efekt kapatma · 5.13 statik birleştirme + mesafe kırpma

## 6. Şehir ve bölgeler
6.1 10×10 blok şehir, sokak/semt adları · 6.2 trafik ışıkları · 6.3 park halindeki araçlar · 6.4 parklar, çeşmeler · 6.5 çevre otoyolu (3+3 şerit, refüj, bariyer, tabelalar, aydınlatma) · 6.6 4 şehir bağlantı yolu · 6.7 sahil yolu, plaj, deniz, palmiyeler, şemsiyeler, cankurtaran kulesi · 6.8 Kartal Tepe dağ yolu (yokuş, korkuluk, orman) + zirve seyir terası · 6.9 drift parkı + otopark (çemberler, koniler, lastik bariyer, tribün, direkler) · 6.10 gece ışık havuzları · 6.11 pist haritası (yarış)

## 7. Canlı şehir
7.1 şehir trafiği (IDM takip, ışıklara uyma, sola dönüşte yol verme) · 7.2 sinyal verme · 7.3 korna (bekleme, önü kesilince) · 7.4 otoyol trafiği · 7.5 yayalar (kaldırım, yaya geçidinden yeşilde geçiş, araçtan kaçma) · 7.6 trafiğin yayalara yol vermesi · 7.7 bot araçlara çarpma: savrulma, dönme, dörtlü, korna, duman, döküntü, şeride geri dönme · 7.8 trafik/yaya herkeste aynı (saat tabanlı)

## 8. Ekonomi ve servisler
8.1 para (cüzdan) · 8.2 sürüş geliri (100 m'de ₺25, hızlıda ×2) · 8.3 drift parası · 8.4 yarış ödülleri · 8.5 3 benzinlik (pompa, market, totem, EV şarj) · 8.6 yakıt alma / şarj (F, araç tipine göre) · 8.7 2 tamirci (F, ücret hasara göre) · 8.8 sigorta (para yetmezse) · 8.9 çekici (G) · 8.10 düşük yakıt/yakıt bitti uyarıları · 8.11 servis bilgi kutusu

## 9. Harita ve GPS
9.1 dönen minimap (hıza göre yakınlaşma) · 9.2 servis ikonları · 9.3 M büyük harita (sürükle, tekerlek/pinch zoom, listeden seçim, tıklayarak hedef) · 9.4 yol ağı üzerinde rota (Dijkstra) · 9.5 minimapte mor GPS çizgisi · 9.6 hedefte 3D ışık sütunu · 9.7 kalan mesafe kutusu · 9.8 hedefe varış

## 10. Yarış modu
10.1 başlangıç ışıkları/geri sayım · 10.2 tur/sıra/zaman HUD · 10.3 kontrol noktaları · 10.4 en iyi tur · 10.5 araç başına rekor (kayıtta) · 10.6 sonuç ekranı · 10.7 yarışta yakıt/hasar kapalı

## 11. Multiplayer
11.1 oda kur/katıl (PeerJS) · 11.2 lobi, hazır olma · 11.3 davet linkini kopyala · 11.4 şehirde birlikte serbest sürüş · 11.5 "arkadaşına git" (T) · 11.6 ESC/duraklatma herkeste · 11.7 hava/saat değişimi herkeste · 11.8 trafik host'tan senkron · 11.9 oyuncu adı/renk · 11.10 diğer oyuncunun aracı (model, farlar, korna)

## 12. Kayıt
12.1 `tp8_save`: para, araç başına yakıt+hasar, km, rekorlar, econ2 bayrağı · 12.2 5 sn'de bir + sayfa kapanırken + menüye dönerken kayıt · 12.3 yeniden açınca hasar göçükleriyle geri gelir · 12.4 ayar anahtarları (tp7_veh, tp3_cam, tp4_time, tp4_map, tp6_wx, tp8_tilt …)

## 13. Ses
13.1 sentezlenmiş motor sesleri (V8, V12, F6, I4, VTEC, turbo, elektrik, motosiklet I4) · 13.2 vites, kesici, backfire · 13.3 lastik sesi/patinaj · 13.4 çarpma sesi · 13.5 korna (oyuncu + trafik, konumsal) · 13.6 K ile sessiz

## 14. HUD ve arayüz
14.1 analog hız/devir göstergesi + vites · 14.2 yakıt/nitro/hasar barları · 14.3 sokak adı · 14.4 cüzdan · 14.5 hedef kutusu · 14.6 toast mesajları · 14.7 duraklatma menüsü (kamera, saat, hava, vites, ses, devam, yola dön, ana menü) · 14.8 responsive ölçekleme (--ui / --up), iki sütunlu menü, sabit başlat düğmeleri

## 15. Telefon
15.1 dokunmatik algılama, yatay ekran uyarısı · 15.2 analog direksiyon pedi · 15.3 eğerek sürüş (izinli) · 15.4 gaz/fren pedalları · 15.5 el freni, nitro, korna, vites +/- · 15.6 üst tuşlar (duraklat, kamera, harita, far, geri dön) · 15.7 servis ve çekici tuşları (bağlama göre) · 15.8 titreşim
