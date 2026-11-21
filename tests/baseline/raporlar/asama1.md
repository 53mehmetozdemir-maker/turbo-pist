# Aşama 1 — Vite derleme + GitHub Actions (unpkg kaldırıldı)

Referans: main @ e771e2a (canlı). Aşama 1 noktası: altyapi @ 1ac04e2. Ölçülen: altyapi dalı, `vite build --base=/` çıktısı.

## Değişenler
- `package.json` + `package-lock.json`: three 0.187.0, peerjs 1.5.4, vite 8.3.8 (hepsi sabit).
- `vite.config.js`: index.html + klasik.html derlenir; JS `dist/app/` altına hash'li; `assets/`, ikonlar, manifest olduğu gibi kopyalanır; CSS küçültülmez (H14).
- `index.html`: unpkg PeerJS satırı ve importmap kaldırıldı (ikon/manifest satırlarına `vite-ignore`).
- `klasik.html`: PeerJS `vendor/peerjs.min.js`'ten (npm kopyası).
- `js/net.js`: `import { Peer } from 'peerjs'`.
- `js/car.js`, `js/vehicles.js`: Draco çözücü three'nin kendi paketinden (`DRACO_GLTF_CONFIG`, aynı glTF çözücüsü).
- `.github/workflows/yayin.yml`: main'e push'ta derleyip Pages'e yayınlar (main'e birleşmeden çalışmaz).
- Oyun mantığı, fizik, sürüş: dokunulmadı.

## Sonuçlar
| Test | Sonuç |
|---|---|
| Fizik (7 araç, 30 sn, 120 Hz, SHA-256) | ✅ 7/7 birebir aynı |
| Görsel (35 görüntü) | ✅ 35/35, hepsi %0,00 fark |
| Kayıtlar (4 örnek) | ✅ 4/4 |
| Klavye kısayolları (28 kontrol) | ✅ 28/28 |
| klasik.html (durum + görüntü) | ✅ aynı, %0,00 |
| Geliştirme sunucusu (`npm run dev`) | ✅ iki sayfa hatasız açılıyor |
| Konsol hatası | ✅ 0 |

## Performans
| | main | Aşama 1 |
|---|---|---|
| İndirme | 7324 KB | 3857 KB |
| İstek sayısı | 54 | 10 |
| Oyuna giriş (SwiftShader) | 9237 ms | 9417 ms (ölçüm gürültüsü) |
| Çizim çağrısı / üçgen (7 sahne) | — | birebir aynı |
| JS ms/kare | 6,8–13,7 | 6,0–11,4 |

## Notlar
- `dist/app/` içinde three'nin kullanılmayan (glTF olmayan) Draco çözücü dosyaları da duruyor (~1 MB disk); hiç indirilmiyor.
- Dışarıdan kalan: Google Fonts (H13, karar bekliyor) ve çok oyunculu buluşma sunucusu peerjs.com (Aşama 4).
