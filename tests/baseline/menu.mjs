// Menü yerleşimi (H8): her ekran boyutunda, güncelleme düğmesi görünürken/görünmezken, menünün en üstünde ve
// en altında hiçbir öğe başka bir öğeyle kesişmiyor, düğme yazıları sığıyor, menü ekrana sığıyor.
// En alta kaydırılmış ekran görüntüleri: screens/menu/*.png (record → kaydet, check → karşılaştır).
// usage: node baseline/menu.mjs [check|record|kontrol] [boyut süzgeci]   (kontrol: sadece kesişme kontrolü, görüntü yok)
import fs from 'node:fs'; import path from 'node:path'; import { PNG } from 'pngjs'; import pixelmatch from 'pixelmatch';
import { serve, launch, gamePage, sleep, HERE_DIR } from './lib.mjs';
const MODE = process.argv[2] || 'check', DIR = path.join(HERE_DIR, 'screens/menu'), OUTD = path.join(HERE_DIR, '../out/screens/menu');
fs.mkdirSync(DIR, { recursive: true }); fs.mkdirSync(OUTD, { recursive: true });
const BOYUT = [
  ['1920x1080', { width: 1920, height: 1080 }], ['1904x986', { width: 1904, height: 986 }],
  ['1366x768', { width: 1366, height: 768 }], ['1280x720', { width: 1280, height: 720 }],
  ['telefon_yatay', { width: 844, height: 390 }, true], ['telefon_dikey', { width: 390, height: 844 }, true],
];
// Sayfada çalışır: görünür öğelerin kırpılmış kutuları, kesişmeler, sığmayan yazılar
const DENETLE = () => {
  const menu = document.getElementById('menu'), sc = menu.querySelector('.mscroll') || menu;
  const R = e => e.getBoundingClientRect(), kes = (a, b) => ({ l: Math.max(a.left ?? a.l, b.left ?? b.l), t: Math.max(a.top ?? a.t, b.top ?? b.t), r: Math.min(a.right ?? a.r, b.right ?? b.r), b: Math.min(a.bottom ?? a.b, b.bottom ?? b.b) });
  const alan = k => Math.max(0, k.r - k.l) * Math.max(0, k.b - k.t);
  const mr = R(menu), sr = R(sc), hatalar = [];
  if (mr.left < -1 || mr.top < -1 || mr.right > innerWidth + 1 || mr.bottom > innerHeight + 1) hatalar.push(`menü ekrandan taşıyor (${Math.round(mr.left)},${Math.round(mr.top)},${Math.round(mr.right)},${Math.round(mr.bottom)})`);
  const ad = e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '')) + (e.textContent ? ' «' + e.textContent.trim().slice(0, 18) + '»' : '');
  const ogeler = [...menu.querySelectorAll('h1, .sub, label, input, button, .vcard, .sw, .note, summary')]
    .filter(e => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden')
    .map(e => { const r = R(e); const kap = sc.contains(e) && sc !== menu ? kes(r, sr) : kes(r, mr); return { e, r, k: alan(kap) > 0 ? kap : null }; })
    .filter(o => o.k);
  for (let i = 0; i < ogeler.length; i++) for (let j = i + 1; j < ogeler.length; j++) {
    const A = ogeler[i], B = ogeler[j]; if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
    const a = alan(kes(A.k, B.k)); if (a > 2) hatalar.push(`kesişiyor: ${ad(A.e)} ↔ ${ad(B.e)} (${Math.round(a)} px²)`);
  }
  for (const o of ogeler) if (o.e.tagName === 'BUTTON' && !o.e.classList.contains('vcard') && o.e.scrollWidth > o.e.clientWidth + 1) hatalar.push(`yazı sığmıyor: ${ad(o.e)}`);
  return { hatalar, n: ogeler.length, kaydir: Math.round(sc.scrollHeight - sc.clientHeight) };
};
const { srv, url } = await serve(); const browser = await launch(); let bad = 0, fark = 0;
const SUZ = process.argv[3] ? new RegExp(process.argv[3]) : null;
for (const [ad, viewport, touch] of BOYUT.filter(b => !SUZ || SUZ.test(b[0]))) for (const upd of [0, 1]) {
  const { ctx, page } = await gamePage(browser, url, { viewport, touch: !!touch, freeze: true });
  await page.evaluate(() => window.__run(30));
  await page.evaluate(upd => { document.getElementById('updMenu').classList.toggle('hidden', !upd); const r = document.getElementById('rotate'); if (r) r.classList.remove('need'); /* gerçek telefonda dikeyde 'yatay çevir' uyarısı menünün üstünde durur; menünün kendisini sınamak için kaldır */ window.__run(2); }, upd);
  const sc = '#menu .mscroll, #menu';
  const ust = await page.evaluate(DENETLE);
  await page.evaluate(() => { const m = document.getElementById('menu'); const s = m.querySelector('.mscroll') || m; s.scrollTop = 1e6; window.__run(2); });
  const alt = await page.evaluate(DENETLE);
  const sonGorunur = await page.evaluate(() => { const m = document.getElementById('menu'), s = m.querySelector('.mscroll') || m, n = [...s.querySelectorAll('.note')].at(-1); const a = n.getBoundingClientRect(), b = s.getBoundingClientRect(); return a.bottom <= b.bottom + 1 && a.top >= b.top - 1; });
  const h = [...ust.hatalar.map(x => 'üstte ' + x), ...alt.hatalar.map(x => 'altta ' + x)]; if (!sonGorunur) h.push('en alta kaydırınca son satır tam görünmüyor');
  const isim = `${ad}_${upd ? 'guncelleme' : 'normal'}`;
  console.log((h.length ? '❌ ' : '✅ ') + isim.padEnd(28) + `${alt.n} öğe, kaydırma ${alt.kaydir} px` + (h.length ? '\n     ' + [...new Set(h)].slice(0, 6).join('\n     ') : ''));
  if (h.length) bad++;
  if (MODE !== 'kontrol') {
    const shot = await page.screenshot(); const ref = path.join(DIR, isim + '.png');
    if (MODE === 'record') fs.writeFileSync(ref, shot);
    else { fs.writeFileSync(path.join(OUTD, isim + '_yeni.png'), shot);
      if (!fs.existsSync(ref)) { console.log('   (referans yok)'); fark++; }
      else {
        // sadece menü paneli karşılaştırılır: arkadaki 3D sahne (trafik, ağaçlar) sayfa yüklenirken geçen kare sayısına göre
        // oynar; bu testin konusu menünün yerleşimi
        const kr = await page.evaluate(() => { const r = document.getElementById('menu').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); });
        const kirp = png => { const [x, y, w, h] = kr, o = new PNG({ width: w, height: h }); PNG.bitblt(png, o, Math.max(0, x), Math.max(0, y), Math.min(w, png.width - x), Math.min(h, png.height - y), 0, 0); return o; };
        const A = kirp(PNG.sync.read(fs.readFileSync(ref))), B = kirp(PNG.sync.read(shot)); const n = pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0.12 }); const p = 100 * n / (A.width * A.height); if (p > 0.5) fark++; console.log(`   görüntü (menü paneli): %${p.toFixed(2)} fark`); } }
  }
  await ctx.close();
}
await browser.close(); srv.close();
console.log(bad ? `\n${bad} durumda yerleşim hatası` : '\nyerleşim: hepsi temiz'); process.exit(bad || fark ? 1 : 0);
