// main (canlı) ↔ altyapı: aynı senaryo, aynı donmuş saat. Bir hata canlıda da var mı? Görüntüler/durum aynıysa evet.
// usage: GFONTS=1 node baseline/karsilastir.mjs <main klasörü> <altyapı derlemesi>
import fs from 'node:fs'; import { PNG } from 'pngjs'; import pixelmatch from 'pixelmatch';
import { serve, launch, gamePage } from './lib.mjs';
const [, , KOK_A, KOK_B] = process.argv; const OUT = '/tmp/karsilastir'; fs.mkdirSync(OUT, { recursive: true });
const ARAC = ['f458', 'f40', 'model3', 'e2008', 'gsxr', 'gt3', 'civic'];
const browser = await launch(); const sonuc = {};
async function senaryo(kok, etiket) {
  const { srv, url } = await serve(kok); const r = {};
  for (const v of ARAC) for (const cam of [0, 1]) {
    const { ctx, page } = await gamePage(browser, url, { storage: { tp7_veh: v, tp3_cam: String(cam) }, viewport: { width: 960, height: 540 } });
    const E = (f, a) => page.evaluate(f, a); const run = n => E(n => window.__run(n), n);
    await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 180000, polling: 200 });
    await E(() => window.__game.startFree()); await run(20);
    await E(() => { const P = window.__game.phys; P.reset(150, 3.5, 0); P.vx = 2.78; P.vy = 0; }); await run(5);
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await run(30);
    const info = await E(() => { const g = window.__game; return { calls: g.renderer.info.render.calls, tri: g.renderer.info.render.triangles, hiz: +g.phys.speed.toFixed(3), steer: +g.phys.steer.toFixed(3) }; });
    const png = await page.screenshot(); fs.writeFileSync(`${OUT}/${etiket}_${v}_${cam ? 'kokpit' : 'takip'}.png`, png);
    await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD');
    r[`${v}_${cam ? 'kokpit' : 'takip'}`] = { info, png };
    // fizik senaryoları (sadece takip kamerasında bir kez)
    if (cam === 0) {
      // çizim yapmadan doğrudan 120 Hz fizik adımı (physics.mjs ile aynı yöntem)
      const iz = (kur, girdi, n) => E(([kur, girdi, n]) => { const P = window.__game.phys; P.manual = false; P.assists = true; new Function('P', kur)(P);
        const o = []; for (let i = 0; i < n; i++) { P.step(1 / 120, Object.assign({ steer: 0, gas: 0, brake: 0, hand: false, nitro: false, analog: false, horn: false }, girdi), []); if (i % 12 === 0) o.push([P.x, P.y, P.a, P.speed, P.rpm, P.gear].map(x => +(+x).toFixed(5))); } return o; }, [kur, girdi, n]);
      r[`${v}_fren_yuksek_hiz`] = { iz: await iz('P.reset(300,3.5,0); P.damage=0; P.vx=50; P.vy=0;', { brake: 1 }, 480) };
      r[`${v}_hasarli_duz`] = { iz: await iz('P.reset(300,3.5,0); P.damage=60; P.vx=20; P.vy=0;', { gas: 1 }, 480) };
      r[`${v}_gaz_fren_patinaj`] = { iz: await iz('P.reset(300,3.5,0); P.damage=0; P.vx=0; P.vy=0;', { gas: 1, brake: 1 }, 480) };
    }
    await ctx.close();
  }
  srv.close(); return r;
}
console.log('main çalışıyor…'); const A = await senaryo(KOK_A, 'main'); console.log('altyapı çalışıyor…'); const B = await senaryo(KOK_B, 'altyapi');
await browser.close(); let farkli = 0;
for (const k of Object.keys(A)) {
  if (A[k].png) { const a = PNG.sync.read(A[k].png), b = PNG.sync.read(B[k].png); const n = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.12 }); const p = 100 * n / (a.width * a.height);
    const ayni = p <= 0.5 && JSON.stringify(A[k].info) === JSON.stringify(B[k].info); if (!ayni) farkli++;
    console.log((ayni ? '= ' : '≠ ') + k.padEnd(24) + ` görüntü %${p.toFixed(2)} · çizim ${A[k].info.calls}/${B[k].info.calls} · üçgen ${A[k].info.tri}/${B[k].info.tri} · hız ${A[k].info.hiz}/${B[k].info.hiz} · direksiyon ${A[k].info.steer}/${B[k].info.steer}`); }
  else { const ayni = JSON.stringify(A[k].iz) === JSON.stringify(B[k].iz); if (!ayni) farkli++; const s = A[k].iz.at(-1); console.log((ayni ? '= ' : '≠ ') + k.padEnd(24) + ` fizik ${ayni ? 'birebir aynı' : 'FARKLI'} · son: x ${s[0]} y ${s[1]} yön ${s[2]} hız ${s[3]} devir ${s[4]}`); }
}
console.log(farkli ? `\n${farkli} durumda fark var` : '\nhepsi birebir aynı: bu senaryolarda görülen her şey canlıda da aynı'); process.exit(0);
