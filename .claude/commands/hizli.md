---
description: Ekip çağırmadan küçük bir değişiklik yap (yazı, renk, küçük ayar). Örnek: /hizli menüdeki "Tek Başına Gez" yazısını "Serbest Sür" yap
---

Kullanıcının isteği: $ARGUMENTS

Bu küçük bir iş; ekip ajanlarını çağırma, kendin yap. Ama `CLAUDE.md`'deki değişmez kurallar aynen geçerli.

1. `is/<kisa-ad>` dalını aç, değişikliği yap (en küçük değişiklik).
2. Derle ve hızlı test setini (`physics`, `saves`, `keys`) + değişiklikle ilgili testi koştur. Görünen bir değişiklikse
   `visual.mjs check` ve gerekiyorsa `menu.mjs check` de koştur; bilerek değişen görüntüleri kullanıcıya göster.
3. Dalı push et, önizlemeye al. GitHub testlerini bekleme; hedef 10 dakika.
4. Kısa rapor ver ve main'e birleştirme için onay bekle (`⏸ ONAY BEKLİYORUM`).

İş sandığından büyük çıkarsa (fizik, çok oyunculu, birden fazla dosyada mantık değişikliği) dur ve `/is` ile ekiple
yapmayı öner.
