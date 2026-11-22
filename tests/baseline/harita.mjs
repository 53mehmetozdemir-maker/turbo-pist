// Büyük harita yerleşimi (H6): her boyutta yan panel ekranda, "Kapat" düğmesi tam görünür, liste öğeleri
// kesişmiyor, harita kullanılabilir büyüklükte. Görüntüler: out/screens/harita/*.png
// usage: node baseline/harita.mjs
import fs from 'node:fs'; import path from 'node:path'; import { serve, launch, gamePage, HERE_DIR } from './lib.mjs';
const OUTD = path.join(HERE_DIR, '../out/screens/harita'); fs.mkdirSync(OUTD, { recursive: true });
const BOYUT = [['640x360', { width: 640, height: 360 }], ['telefon_yatay', { width: 844, height: 390 }, true], ['1366x768', { width: 1366, height: 768 }], ['dikey_390x844', { width: 390, height: 844 }]];
const { srv, url } = await serve(); const b = await launch(); let bad = 0;
for (const [ad, viewport, touch] of BOYUT) {
  const { ctx, page } = await gamePage(b, url, { viewport, touch: !!touch });
  await page.evaluate(() => { window.__run(20); window.__game.startFree(); window.__run(20); const r = document.getElementById('rotate'); if (r) r.classList.remove('need'); });
  await page.evaluate(() => { window.__game.toggleBigMap(true); window.__run(10); });
  const s = await page.evaluate(() => {
    const R = e => e.getBoundingClientRect(), h = [], side = document.querySelector('#bigMap .side'), cv = document.querySelector('#bigMap canvas'), kapat = document.querySelector('#bigMap .close');
    const sr = R(side), cr = R(cv); side.scrollTop = 1e6; const kr = R(kapat);
    if (sr.right > innerWidth + 1 || sr.bottom > innerHeight + 1 || sr.left < -1 || sr.top < -1) h.push('yan panel ekrandan taşıyor');
    if (kr.bottom > Math.min(innerHeight, sr.bottom) + 1 || kr.top < sr.top - 1 || kr.height < 20) h.push('Kapat düğmesi tam görünmüyor');
    if (cr.width < 200 || cr.height < 150) h.push(`harita çok küçük (${Math.round(cr.width)}×${Math.round(cr.height)})`);
    const lr = R(document.getElementById('bmList')), kirp = (e, r) => document.getElementById('bmList').contains(e) ? { left: Math.max(r.left, lr.left), right: Math.min(r.right, lr.right), top: Math.max(r.top, lr.top), bottom: Math.min(r.bottom, lr.bottom) } : r;
    // liste kendi içinde kayar: kaydırma alanının dışında kalan (görünmeyen) öğeler kırpılır
    const el = [...side.querySelectorAll('.item, h3, button')].filter(e => e.offsetParent), it = el.map(e => kirp(e, R(e)));
    for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++) { if (el[i].contains(el[j]) || el[j].contains(el[i])) continue; const a = it[i], c = it[j]; const w = Math.min(a.right, c.right) - Math.max(a.left, c.left), y = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); if (w > 1 && y > 1) h.push('liste öğeleri kesişiyor'); }
    side.scrollTop = 0; return { h: [...new Set(h)], harita: `${Math.round(cr.width)}×${Math.round(cr.height)}`, panel: `${Math.round(sr.width)}×${Math.round(sr.height)}` }; });
  await page.screenshot({ path: path.join(OUTD, ad + '.png') });
  console.log((s.h.length ? '❌ ' : '✅ ') + ad.padEnd(16) + `harita ${s.harita}, panel ${s.panel}` + (s.h.length ? ' — ' + s.h.join('; ') : '')); if (s.h.length) bad++;
  await ctx.close();
}
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
