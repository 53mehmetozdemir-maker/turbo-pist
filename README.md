# turbo-pist

Turbo Pist 3D — tarayıcıda çalışan three.js yarış/serbest sürüş oyunu.
(Ayrıntılı tanıtım Aşama 7'de eklenecek.)

## Geliştirme

Gerekenler: Node.js 22.12 veya üstü.

```
npm ci            # bağımlılıklar (sürümler package-lock.json'da sabit)
npm run dev       # http://localhost:5173/turbo-pist/ — kaydettikçe yenilenir
npm run build     # dist/ klasörüne derler
npm run preview   # derlenmiş hali yerelde açar
```

- `index.html` ana oyun, `klasik.html` eski 2D sürüm; ikisi de derlenir.
- three.js, PeerJS ve yazı tipleri (Bungee, Inter) npm'den gelir; dışarıdan (unpkg, Google Fonts) bir şey yüklenmez.
- Modeller, dokular ve HDR'ler kodda `new URL('../assets/…', import.meta.url)` ile gösterilir; derlenen her şey `dist/app/` altına hash'li adla çıkar.
  Yeni bir asset eklerken de bu kalıbı kullan (düz `'assets/…'` yazısı derlemeye girmez).
- Açılışta gereken dosyalar (Ferrari, şehir dokuları, Draco çözücü, three, oyun kodu) HTML'de önceden istenir (`vite.config.js` → `ON_YUKLE`).

## Yayın

- `main`'e push → `.github/workflows/yayin.yml` derleyip GitHub Pages'e yayınlar.
- Önizleme: https://53mehmetozdemir-maker.github.io/turbo-pist-onizleme/ (ayrı repo).

## Testler

`tests/baseline/README.md` — fizik, görsel, kayıt, klavye kısayolu ve performans karşılaştırmaları.
Derlenmiş oyuna karşı çalıştırmak için: `npx vite build --base=/ --outDir /tmp/dist-test` ve ardından `GAME_ROOT=/tmp/dist-test node baseline/<test>.mjs check`.
