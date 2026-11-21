// Turbo Pist derleme ayarı.
// - JS (three, peerjs dahil) paketlenir, dosya adlarına içerik özeti (hash) eklenir.
// - Modeller, dokular, HDR'ler kodda new URL(..., import.meta.url) ile gösterilir; Vite onları hash'li adla dist/app/ altına çıkarır.
// - İkonlar ve manifest olduğu gibi kopyalanır (adları sabit kalmalı).
// - Draco çözücüyü three'nin DRACOLoader'ı kendi paketinden gösterir; Vite onu hash'li adla çıkarır.
// - klasik.html modül kullanmayan eski tek dosya; PeerJS'i node_modules'tan vendor/ altına kopyalanır.
// Böylece dışarıdan (unpkg) hiçbir şey yüklenmez.
// - sw.js pwa/sw.js şablonundan üretilir (dosya listesi + sürüm). ACIL_SW_KAPAT=1 → pwa/sw-acil-kapat.js.
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = import.meta.dirname;
const NM = path.join(ROOT, 'node_modules');
// çıktıda yol → kaynak
const VENDOR = {
  'vendor/peerjs.min.js': path.join(NM, 'peerjs/dist/peerjs.min.js'),
};
const STATIC = ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'sifirla.html'];
// service worker'ın önbelleğe ALMADIĞI dosyalar: acil çıkış sayfası (hep ağdan gelmeli), kullanılmayan
// (glTF olmayan) Draco çözücüsü, .woff yedekleri (her tarayıcı woff2 alır)
const SW_DISI = f => f === 'sifirla.html' || /\.woff$/.test(f);
const MIME = { '.js': 'text/javascript', '.wasm': 'application/wasm' };

function kopyalar() {
  let outDir, paket = null, istege = new Set();
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
    // service worker için sürümün dosya listesi (Vite'in ürettikleri)
    generateBundle(_, bundle) {
      paket = []; istege = new Set();
      for (const f of Object.values(bundle)) {
        const kaynak = (f.originalFileNames || []).join(' ');
        if (f.type === 'asset' && /libs\/draco\/(?!gltf\/)/.test(kaynak)) continue;     // kullanılmayan çözücü
        paket.push(f.fileName);
        // ilk kullanımda önbelleğe girenler: menüde olmayan araçlar ve HDR'ler (mobil veriyi boşa harcamamak için)
        if (/assets\/cars\/.*\.glb$|\.hdr$/.test(kaynak)) istege.add(f.fileName);
      }
    },
    closeBundle() {
      for (const s of STATIC) fs.cpSync(path.join(ROOT, s), path.join(outDir, s), { recursive: true });
      for (const [dst, src] of Object.entries(VENDOR)) fs.cpSync(src, path.join(outDir, dst), { recursive: true });
      if (!paket) return;
      // sw.js: dosya listesi + içerikten türeyen sürüm (aynı içerik → aynı sürüm → gereksiz güncelleme yok)
      const dosyalar = [...new Set(['index.html', 'klasik.html', ...paket, ...STATIC, ...Object.keys(VENDOR)])].filter(f => !SW_DISI(f) && fs.existsSync(path.join(outDir, f))).sort();   // (Vite CSS-only parçaların boş JS'ini siler)
      const ozet = crypto.createHash('sha256');
      for (const f of dosyalar) ozet.update(f + '\0' + crypto.createHash('sha256').update(fs.readFileSync(path.join(outDir, f))).digest('hex') + '\n');
      const surum = ozet.digest('hex').slice(0, 12);
      const sablon = process.env.ACIL_SW_KAPAT === '1' ? 'pwa/sw-acil-kapat.js' : 'pwa/sw.js';
      const sw = fs.readFileSync(path.join(ROOT, sablon), 'utf8').replace("const SURUM = '__SURUM__';", `const SURUM = '${surum}';`).replace('const DOSYALAR = __DOSYALAR__;', 'const DOSYALAR = ' + JSON.stringify(dosyalar.filter(f => !istege.has(f))) + ';')
        .replace('const ISTEGE = __ISTEGE__;', 'const ISTEGE = ' + JSON.stringify(dosyalar.filter(f => istege.has(f))) + ';');
      fs.writeFileSync(path.join(outDir, 'sw.js'), sw);
      fs.writeFileSync(path.join(outDir, 'sw-surum.txt'), surum + '\n');
    },
  };
}

// Açılışta mutlaka gereken dosyaları HTML'de önceden istet: JS inip çalışana kadar beklemesinler.
// (Ferrari menüde görünen araç, şehir dokuları, Draco çözücü; three ve oyun kodu modulepreload.)
// Diğer araçlar ve HDR'ler zaten seçilince/sürüşe başlayınca yükleniyor, onlara dokunulmaz.
const ON_YUKLE = [
  [/assets\/ferrari\.glb$/, 'fetch'],
  [/assets\/ferrari_ao\.png$/, 'image-cors'],   // three'nin TextureLoader'ı crossOrigin=anonymous ister
  [/assets\/(grass|brick|brick_bump)\.jpg$/, 'image'],
  [/libs\/draco\/gltf\/draco_(wasm_wrapper\.js|decoder\.wasm)$/, 'fetch'],
];
function onYukleme() {
  return {
    name: 'turbo-pist-on-yukleme', apply: 'build',
    transformIndexHtml: { order: 'post', handler(html, ctx) {
      if (!ctx.bundle || !/index\.html$/.test(ctx.filename)) return html;
      const base = ctx.server ? '/' : (this.environment?.config?.base ?? '/');
      const tags = [];
      for (const f of Object.values(ctx.bundle)) {
        if (f.type === 'chunk' && (f.name === 'three' || f.name === 'main')) tags.push({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: base + f.fileName }, injectTo: 'head' });
        if (f.type !== 'asset') continue;
        const src = (f.originalFileNames || []).join(' ');
        for (const [re, as] of ON_YUKLE) if (re.test(src)) {
          const attrs = as === 'image' ? { rel: 'preload', as } : { rel: 'preload', as: as === 'image-cors' ? 'image' : as, crossorigin: 'anonymous' };
          tags.push({ tag: 'link', attrs: { ...attrs, href: base + f.fileName }, injectTo: 'head' });
        }
      }
      return tags;
    } },
  };
}

export default defineConfig({
  base: '/turbo-pist/',
  // acil kapatma derlemesi service worker'ı yeniden kaydetmesin (yoksa kapat → kaydet → kapat döngüsü)
  define: { 'import.meta.env.VITE_SW_KAPALI': JSON.stringify(process.env.ACIL_SW_KAPAT === '1' ? '1' : '') },
  publicDir: false,
  plugins: [kopyalar(), onYukleme()],
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
      // three.js ve PeerJS ayrı dosyada: oyun kodu güncellenince oyuncu bunları yeniden indirmez.
      output: { manualChunks: id => id.includes('node_modules/three/') ? 'three' : id.includes('node_modules/peerjs') ? 'peerjs' : undefined },
    },
  },
});
