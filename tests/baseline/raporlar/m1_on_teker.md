# M1 — Motosikletin ön tekeri ters dönüyordu

**İş:** GSX-R 750'de direksiyon sağa çevrilince ön teker ve gidon görsel olarak sola dönüyordu. Fizik doğruydu
(motosiklet sağa gidiyordu), yalnız görüntü tersti.

**Sebep:** `js/bike.js` ön takımı, kafa borusundan ön tekere doğru (aşağı ve ileri) bakan bir eksen etrafında
`-steer × 0,7` açısıyla döndürüyordu. Arabalarda tekerler yukarı bakan dikey eksen etrafında `-steer` ile döner;
eksen ters yöne (aşağı) baktığı için aynı işaret motosiklette ters dönüş üretiyordu.

**Düzeltme:** işaret çevrildi (`+steer × 0,7`); dönüş miktarı aynı. GSX-R ve prosedürel motosiklet aynı iskeleti kullanır.

**Etki listesi ve kontrol:**

| Etkilenebilecek | Sonuç |
|---|---|
| Ön takım yönü (yeni `motor.mjs`) | önce: sağ direksiyonda −0,39 ❌ · sonra: +0,39 ✅ (sol: +0,39 ❌ → −0,39 ✅) |
| Fizik (7 araç) | ✅ birebir aynı |
| Kayıt, klavye kısayolları | ✅ |
| GSX-R takip ve kokpit referans görüntüleri (düz giderken) | ✅ %0,00 |
| Diğer 6 araç | kod ortak değil (arabalar `car.js`/`vehicles.js`); tam set CI'da |
| Çok oyunculu (diğer oyuncunun motosikleti) | aynı `setPose` kullanılıyor → aynı düzeltme |
| Telefonda eğerek sürüş | direksiyon değerini değiştirmiyor, yalnız görüntü |
