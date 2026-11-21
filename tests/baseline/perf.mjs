// Performance reference: download size & load time, then per scene draw calls, triangles, GPU memory objects, JS heap and JS time per frame.
// (Software renderer here: real FPS has to be checked on a real device; these numbers compare builds fairly.)
// usage: node baseline/perf.mjs [record|check]
import fs from 'node:fs'; import path from 'node:path'; import { serve, launch, gamePage, sleep, HERE_DIR } from './lib.mjs';
const MODE = process.argv[2] || 'check', OUT = path.join(HERE_DIR, 'perf.json');
const SCENES = [['sehir_merkez', [503.5, 496.5, 0]], ['sehir_kose', [150, 3.5, 0]], ['benzinlik', 'fuel'], ['otoyol', [300, -144.3, 0]], ['dag', [1500, 150, 0]], ['drift', [1240, 1040, 0]], ['sahil', [-144.3, 600, -Math.PI / 2]]];
const { srv, url } = await serve(); const browser = await launch(); const out = { load: {}, scenes: {} };
// 1) cold load: bytes and time until the game object exists
{ let bytes = 0, reqs = 0; const t0 = Date.now();
  const { ctx, page, log } = await gamePage(browser, url, { viewport: { width: 640, height: 360 }, freeze: false, onPage: pg => pg.on('response', async r => { try { const b = await r.body(); bytes += b.length; reqs++; } catch (e) {} }) });
  const tReady = Date.now() - t0; await page.evaluate(() => window.__game.startFree()); await sleep(5000);
  out.load = { bytes_kb: Math.round(bytes / 1024), requests: reqs, ms_to_game: tReady, console_errors: log.filter(e => !/ERR_TUNNEL|ERR_CONNECTION/.test(e)).length };
  console.log('yükleme', JSON.stringify(out.load)); await ctx.close(); }
// 2) scenes
const { ctx, page } = await gamePage(browser, url, { viewport: { width: 640, height: 360 }, storage: { tp7_veh: 'f458' } });
await sleep(2000); await page.evaluate(() => window.__game.startFree()); await page.evaluate(() => window.__run(3)); await sleep(2000);
const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
for (const [name, at] of SCENES) {
  await page.evaluate(at => { const g = window.__game; let p = at; if (at === 'fuel') { const s = g.world.services.find(q => q.kind === 'fuel'); p = [s.x, s.y, s.a]; } g.phys.reset(p[0], p[1], p[2]); }, at);
  await page.evaluate(() => window.__run(6));
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const info = await page.evaluate(async () => { const r = window.__game.renderer; r.info.autoReset = false; r.info.reset(); await window.__run(10); const i = { calls: r.info.render.calls / 10, tris: r.info.render.triangles / 10, geo: r.info.memory.geometries, tex: r.info.memory.textures, progs: r.info.programs.length }; r.info.autoReset = true; return i; });
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const sc = { draw_calls: Math.round(info.calls), tris_k: Math.round(info.tris / 1000), geometries: info.geo, textures: info.tex, programs: info.progs, js_ms_per_frame: +((m1.ScriptDuration - m0.ScriptDuration) * 1000 / 10).toFixed(1), heap_mb: +(m1.JSHeapUsedSize / 1048576).toFixed(1) };
  out.scenes[name] = sc; console.log(name.padEnd(13), JSON.stringify(sc));
}
await browser.close(); srv.close();
if (MODE === 'record') { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('kaydedildi'); }
else { const ref = JSON.parse(fs.readFileSync(OUT, 'utf8')); let bad = 0;
  for (const k in ref.scenes) { const a = ref.scenes[k], b = out.scenes[k]; const worse = b.draw_calls > a.draw_calls * 1.05 + 5 || b.tris_k > a.tris_k * 1.05 + 5 || b.js_ms_per_frame > a.js_ms_per_frame * 1.25 + 2;
    if (worse) bad++; console.log(worse ? '❌' : '✅', k, `çizim ${a.draw_calls}→${b.draw_calls}  üçgen ${a.tris_k}k→${b.tris_k}k  js ${a.js_ms_per_frame}→${b.js_ms_per_frame} ms  bellek ${a.heap_mb}→${b.heap_mb} MB`); }
  console.log('indirme', ref.load.bytes_kb, '→', out.load.bytes_kb, 'KB, açılış', ref.load.ms_to_game, '→', out.load.ms_to_game, 'ms'); process.exit(bad ? 1 : 0); }
