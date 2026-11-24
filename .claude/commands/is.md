---
description: Ekiple bir iş yap (özellik, düzeltme, tasarım). Örnek: /is GT3'e çalışan göstergeler ekle
---

Kullanıcının isteği: $ARGUMENTS

`CLAUDE.md`'deki "İş akışı: ekip" bölümünü baştan sona uygula. Sen yöneticisin:

1. İsteği bir cümleyle yeniden yaz, kabul kriterlerini çıkar. Gerçekten belirsizse tek bir soru sor, değilse başla.
   `tests/baseline/HATALAR.md`'de ilgili madde varsa (M1, P3, G1 gibi) onu kullan.
   **Etki listesini** çıkar (bu değişiklik başka nereleri etkileyebilir).
2. `is/<kisa-ad>` dalını aç.
2b. Ekranda görünen bir şey varsa önce `tasarimci`dan **tasarım taslağı** al.
3. `gelistirici` ajanına işi kabul kriterleri, etki listesi ve taslakla birlikte ver.
4. Ardından `test-uzmani`, `denetci` ve görünen bir değişiklikse `tasarimci` ajanlarını aynı anda çalıştır.
5. Bulguları geliştiriciye geri ver; temiz çıkana kadar en fazla 3 tur.
6. Tam test setini koştur, dalı push et, önizlemeye al.
7. Kullanıcıya kısa rapor ver ve main'e birleştirme için onayını bekle (`⏸ ONAY BEKLİYORUM`).

Fizik/sürüş değişecekse geliştiriciyi çağırmadan önce kullanıcıya ne değişeceğini sade dille anlat ve onay al.
