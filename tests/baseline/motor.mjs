// Motosiklet ön takımı (M1): direksiyon sağa çevrilince ön teker ve gidon da SAĞA dönmeli, sola çevrilince sola.
// Ölçüm: ön takımın ileri yönü (+X) ön takımın dönüşüyle döndürülür; motosiklet çerçevesinde +Z sağdır.
// Sağ direksiyonda yan bileşen > 0, sol direksiyonda < 0 olmalı. Fizik direksiyonunun işareti de yazdırılır.
// usage: node baseline/motor.mjs
import { serve, launch, gamePage, sleep } from './lib.mjs';
const { srv, url } = await serve();
const b = await launch(); let bad = 0;
// kareler tek tek ilerletilir (çok kareli __run zaman zaman takılıyor)
const kare = async (p, n) => { for (let i = 0; i < n; i++) await p.evaluate(() => window.__run(1)); };
const ok = (ad, k, d = '') => { if (!k) bad++; console.log((k ? '✅ ' : '❌ ') + ad + (d ? ' — ' + d : '')); };
const { ctx, page } = await gamePage(b, url, { storage: { tp7_veh: 'gsxr', tp4_map: 'city' } });
await sleep(2500); await kare(page, 2); await sleep(1500);
await page.evaluate(() => window.__game.startFree()); await kare(page, 5);
const olc = async tus => {
  await page.keyboard.down(tus); await kare(page, 40);
  const r = await page.evaluate(() => { const g = window.__game, f = g.model.front.quaternion, [x, y, z, w] = [f.x, f.y, f.z, f.w];
    // v = (1,0,0) döndürülmüş: z bileşeni = 2(xz - wy)
    return { steer: +g.phys.steer.toFixed(3), yan: +(2 * (x * z - w * y)).toFixed(4) }; });
  await page.keyboard.up(tus); await kare(page, 40); return r; };
const sag = await olc('KeyD'), sol = await olc('KeyA');
ok('sağa çevirince (D) ön takım sağa dönüyor', sag.steer > 0 && sag.yan > 0, JSON.stringify(sag));
ok('sola çevirince (A) ön takım sola dönüyor', sol.steer < 0 && sol.yan < 0, JSON.stringify(sol));
await ctx.close(); await b.close(); srv.close();
console.log(bad ? `❌ ${bad} kontrol kırmızı` : '✅ ön takım direksiyonla aynı yöne dönüyor'); process.exit(bad ? 1 : 0);
