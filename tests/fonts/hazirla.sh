#!/bin/sh
# Testlerin yazı tiplerini hazırlar: npm'den sabit sürümle gelen woff2 dosyalarını (Inter, Noto Color Emoji) TTF'ye açar.
# Chrome sistem yazı tipi olarak woff2 okuyamıyor; woff2 yalnız sıkıştırma katmanı, glif verisi birebir aynı kalır.
# Gerekir: tests/ içinde `npm ci`, Python'da fonttools==4.60.1 ve brotli==1.1.0 (CI kurar). Çıktı: tests/fonts/ttf/ (git'e girmez).
set -eu
cd "$(dirname "$0")"
rm -rf ttf && mkdir ttf
for f in ../node_modules/@fontsource/inter/files/*.woff2 ../node_modules/@fontsource/noto-color-emoji/files/*.woff2; do
  python3 -c "import sys; from fontTools.ttLib import woff2; woff2.decompress(sys.argv[1], sys.argv[2])" "$f" "ttf/$(basename "$f" .woff2).ttf"
done
echo "$(ls ttf | wc -l) yazı tipi dosyası hazır (tests/fonts/ttf)"
