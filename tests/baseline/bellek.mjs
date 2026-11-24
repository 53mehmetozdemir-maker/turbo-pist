// Bellek (Aşama 5): araç değiştirdikçe GPU belleği büyümemeli. 1. tur şablonları önbelleğe yükler (meşru artış);
// 2. ve 3. turda geometri/doku sayısı artmamalı. WebGL hatası ve konsol hatası olmamalı.
// usage: node baseline/bellek.mjs
import { serve, launch, gamePage, sleep } from './lib.mjs';
const { srv, url } = await serve(); const b = await launch();
const { ctx, page, log } = await gamePage(b, url, { freeze: false, viewport: { width: 640, height: 360 } }); await sleep(2500);
const TUM = ['f458', 'f40', 'model3', 'e2008', 'gsxr', 'gt3', 'civic'];
// CI parçalara böler: BELLEK_ARACLAR="f40,model3" → f458 (başlangıç aracı) + bu araçlar arasında döner.
// Parçaların birleşimi 7 aracın hepsini kapsar (testler.yml). Boşsa 7 aracın hepsi (yerel/tam koşu).
const IDS = process.env.BELLEK_ARACLAR ? ['f458', ...process.env.BELLEK_ARACLAR.split(',').filter(x => x && x !== 'f458')] : TUM;
if (IDS.some(i => !TUM.includes(i))) { console.log('❌ bilinmeyen araç: ' + IDS); process.exit(1); }
console.log('araçlar:', IDS.join(' '));
const mem = () => page.evaluate(() => { const m = window.__game.renderer.info.memory; return [m.geometries, m.textures]; });
const sec = async id => { await page.evaluate(i => document.querySelectorAll('#vSel .vcard')[i].click(), TUM.indexOf(id));
  await page.waitForFunction(id => { const c = document.querySelector('#vSel .vcard.on'); return c && c.querySelector('b').textContent && window.__game.model && !document.getElementById('toast').textContent.includes('yükleniyor'); }, id, { timeout: 90000, polling: 200 }).catch(() => {}); await sleep(600); };
const turlar = [];
// 0. tur ısınma (sayılmaz): hızlı makinede 1. turun sonunda bazı gecikmeli içerik henüz kurulmamış olabiliyor (CI'da
// 1→2. tur +49, 2→3. tur +1 ölçüldü: sızıntı değil, gecikmeli kurulum). Sızıntı her turda büyür; 1→3 farkı onu yakalar.
for (const id of [...IDS.slice(1), IDS[0]]) await sec(id); console.log('tur 0 (ısınma)');
for (let t = 1; t <= 3; t++) { for (const id of [...IDS.slice(1), IDS[0]]) await sec(id); turlar.push(await mem()); console.log('tur', t, 'geometri', turlar.at(-1)[0], 'doku', turlar.at(-1)[1]); }
const gl = await page.evaluate(() => { const g = window.__game.renderer.getContext(); return g.getError(); });
await page.screenshot({ path: '/tmp/bellek_son.png' });
const hatalar = log.filter(l => !/ERR_|Failed to load resource/.test(l));
await b.close(); srv.close();
const art = [turlar[2][0] - turlar[0][0], turlar[2][1] - turlar[0][1]];
const ok = art[0] <= 2 && art[1] <= 1 && gl === 0 && !hatalar.length;
console.log((ok ? '✅' : '❌') + ` 1. turdan 3. tura artış: geometri ${art[0]}, doku ${art[1]} · WebGL hata kodu ${gl} · konsol hatası ${hatalar.length}` + (hatalar.length ? ' — ' + hatalar[0] : ''));
process.exit(ok ? 0 : 1);
