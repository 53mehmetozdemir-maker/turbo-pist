// Turbo Pist derleme ayarı.
// - JS (three, peerjs dahil) paketlenir, dosya adlarına içerik özeti (hash) eklenir.
// - assets/, ikonlar ve manifest olduğu gibi kopyalanır (oyun bunları çalışma anında göreli yolla yükler).
// - Draco çözücüyü three'nin DRACOLoader'ı kendi paketinden gösterir; Vite onu hash'li adla çıkarır.
// - klasik.html modül kullanmayan eski tek dosya; PeerJS'i node_modules'tan vendor/ altına kopyalanır.
// Böylece dışarıdan (unpkg) hiçbir şey yüklenmez.
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = import.meta.dirname;
const NM = path.join(ROOT, 'node_modules');
// çıktıda yol → kaynak
const VENDOR = {
  'vendor/peerjs.min.js': path.join(NM, 'peerjs/dist/peerjs.min.js'),
};
const STATIC = ['assets', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
const MIME = { '.js': 'text/javascript', '.wasm': 'application/wasm' };

function kopyalar() {
  let outDir;
  return {
    name: 'turbo-pist-kopyalar',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    // geliştirme sunucusu: /vendor/ isteklerini node_modules'tan karşıla
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let url = decodeURIComponent((req.url || '').split('?')[0]);
        if (url.startsWith(server.config.base)) url = url.slice(server.config.base.length);
        url = url.replace(/^\/+/, '');
        for (const [dst, src] of Object.entries(VENDOR)) {
          if (url !== dst && !url.startsWith(dst + '/')) continue;
          const f = fs.statSync(src).isDirectory() ? path.join(src, url.slice(dst.length)) : src;
          if (!f.startsWith(src) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) break;
          res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
          fs.createReadStream(f).pipe(res); return;
        }
        next();
      });
    },
    closeBundle() {
      for (const s of STATIC) fs.cpSync(path.join(ROOT, s), path.join(outDir, s), { recursive: true });
      for (const [dst, src] of Object.entries(VENDOR)) fs.cpSync(src, path.join(outDir, dst), { recursive: true });
    },
  };
}

export default defineConfig({
  base: '/turbo-pist/',
  publicDir: false,
  plugins: [kopyalar()],
  server: { watch: { ignored: ['**/tests/**'] } },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'app',                // oyunun kendi assets/ klasörüyle karışmasın
    emptyOutDir: true,
    assetsInlineLimit: 0,
    // CSS yazıldığı gibi kalsın: Lightning CSS küçültücüsü backdrop-filter'ı silip sadece
    // -webkit- önekini bırakıyordu (Chrome'da telefon tuşlarının buzlu cam efekti kayboluyordu).
    cssMinify: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: { index: path.join(ROOT, 'index.html'), klasik: path.join(ROOT, 'klasik.html') },
    },
  },
});
