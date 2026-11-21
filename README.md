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
- three.js ve PeerJS npm'den gelir; dışarıdan (unpkg vb.) kod yüklenmez.
- `assets/` olduğu gibi kopyalanır; derlenen JS `dist/app/` altına hash'li adla çıkar.

## Yayın

- `main`'e push → `.github/workflows/yayin.yml` derleyip GitHub Pages'e yayınlar.
- Önizleme: https://53mehmetozdemir-maker.github.io/turbo-pist-onizleme/ (ayrı repo).

## Testler

`tests/baseline/README.md` — fizik, görsel, kayıt, klavye kısayolu ve performans karşılaştırmaları.
Derlenmiş oyuna karşı çalıştırmak için: `npx vite build --base=/ --outDir /tmp/dist-test` ve ardından `GAME_ROOT=/tmp/dist-test node baseline/<test>.mjs check`.
