// Visual reference: fixed camera/state screenshots for every map, vehicle, time, weather and camera mode.
// usage: node baseline/visual.mjs [record|check] [filter]
import fs from 'node:fs'; import path from 'node:path'; import { PNG } from 'pngjs'; import pixelmatch from 'pixelmatch';
import { serve, launch, gamePage, sleep, HERE_DIR } from './lib.mjs';
const MODE = process.argv[2] || 'check', FILTER = process.argv[3] || '';
const DIR = path.join(HERE_DIR, 'screens'), OUTD = path.join(HERE_DIR, '..', 'out', 'screens'); fs.mkdirSync(DIR, { recursive: true }); fs.mkdirSync(OUTD, { recursive: true });
const VEH = ['f458', 'f40', 'model3', 'e2008', 'gsxr', 'gt3', 'civic'];
const S = (veh = 'f458', o = {}) => ({ veh, map: 'city', time: 'day', wx: 'clear', cam: 0, ...o });
const SHOTS = [
  ['menu', S('f458', { start: 'none' })],
  ...VEH.map(v => ['arac_' + v + '_takip', S(v)]), ...VEH.map(v => ['arac_' + v + '_kokpit', S(v, { cam: 1 })]),
  ['kaput_f458', S('f458', { cam: 2 })],
  ['sehir_aksam', S('f458', { time: 'dusk' })], ['sehir_gece', S('f458', { time: 'night' })], ['sehir_yagmur', S('f458', { wx: 'rain' })], ['sehir_gece_yagmur', S('f458', { time: 'night', wx: 'rain' })],
  ['pist_gunduz', S('f458', { map: 'track', start: 'race' })], ['pist_gece', S('f458', { map: 'track', time: 'night', start: 'race' })], ['pist_yagmur', S('f458', { map: 'track', wx: 'rain', start: 'race' })],
  ['otoyol', S('f458', { at: [300, -144.3, 0] })], ['dag_yolu', S('f458', { at: 'mtn' })], ['zirve', S('f458', { at: 'summit' })], ['drift_parki', S('f458', { at: [1240, 1040, 0] })],
  ['sahil', S('f458', { at: [-144.3, 600, -Math.PI / 2] })], ['benzinlik', S('f458', { at: 'fuel' })], ['tamirci', S('f458', { at: 'repair' })], ['benzinlik_gece', S('f458', { at: 'fuel', time: 'night' })],
  ['buyuk_harita', S('f458', { ui: 'map' })], ['duraklat', S('f458', { ui: 'pause' })],
  ['telefon', S('f458', { touch: true })], ['laptop_1366_menu', S('f458', { start: 'none', vp: [1366, 768] })],
].filter(([n]) => n.includes(FILTER));
const { srv, url } = await serve(); const browser = await launch(); let bad = 0; const report = [];
for (const [name, s] of SHOTS) {
  const vp = s.vp ? { width: s.vp[0], height: s.vp[1] } : s.touch ? { width: 844, height: 390 } : { width: 640, height: 360 };
  const { ctx, page, log } = await gamePage(browser, url, { viewport: vp, touch: !!s.touch, storage: { tp7_veh: s.veh, tp4_map: s.map, tp4_time: s.time, tp6_wx: s.wx, tp3_cam: String(s.cam) } });
  try {
    await sleep(2500); await page.evaluate(() => window.__run(2)); await sleep(1500);
    if (s.start === 'race') { await page.click('#soloBtn'); }
    else if (s.start !== 'none') await page.evaluate(() => window.__game.startFree());
    await page.evaluate(() => window.__run(2)); await sleep(2500);    // let textures/HDR/models finish loading (real time, game held)
    if (s.at) await page.evaluate(at => { const g = window.__game, R = g.REGDBG; let p = at;
      if (at === 'mtn') { const f = R.mtnF[Math.floor(R.mtnF.length * 0.45)]; p = [f.x + f.nx * 2, f.y + f.ny * 2, Math.atan2(f.ty, f.tx)]; }
      if (at === 'summit') p = [R.SUMMIT.x - 12, R.SUMMIT.y, Math.PI];
      if (at === 'fuel' || at === 'repair') { const k = at === 'repair' ? 'repair' : 'fuel'; const sv = g.world.services.find(q => q.kind === k); p = [sv.x, sv.y, sv.a]; }
      g.phys.reset(p[0], p[1], p[2]); g.phys.vx = g.phys.vy = 0; }, s.at);
    await page.evaluate(() => window.__run(12)); await sleep(1200); await page.evaluate(() => window.__run(8));
    if (s.ui === 'map') { await page.evaluate(() => window.__game.toggleBigMap(true)); await page.evaluate(() => window.__run(3)); }
    if (s.ui === 'pause') { await page.keyboard.press('Escape'); await page.evaluate(() => window.__run(3)); }
    const buf = await page.screenshot(); const errs = (await page.evaluate(() => window.__errors)).concat(log.filter(l => !/ERR_TUNNEL|ERR_CONNECTION|peerjs|0\.peerjs/i.test(l)));
    const ref = path.join(DIR, name + '.png');
    if (MODE === 'record') { fs.writeFileSync(ref, buf); report.push([name, 'kaydedildi', errs.length ? errs.slice(0, 2).join(' / ') : '']); }
    else { const A = PNG.sync.read(fs.readFileSync(ref)), B = PNG.sync.read(buf); let diffPct = 100;
      if (A.width === B.width && A.height === B.height) { const D = new PNG({ width: A.width, height: A.height }); const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.12 }); diffPct = 100 * n / (A.width * A.height);
        if (n > 0) { fs.writeFileSync(path.join(OUTD, name + '_fark.png'), PNG.sync.write(D)); fs.writeFileSync(path.join(OUTD, name + '_yeni.png'), buf); } }
      const ok = diffPct <= 0.5; if (!ok) bad++; report.push([name, (ok ? '✅ ' : '❌ ') + diffPct.toFixed(2) + '% fark', errs.slice(0, 2).join(' / ')]); }
  } catch (e) { bad++; report.push([name, '❌ hata', String(e.message).slice(0, 160)]); }
  console.log(report[report.length - 1].join('  |  ')); await ctx.close();
}
await browser.close(); srv.close(); process.exit(bad ? 1 : 0);
