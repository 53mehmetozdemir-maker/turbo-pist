// Yavaş ağda (≈4G: 10 Mbit/s indirme, 40 ms gecikme): menü için gereken bütün dosyaların inmesi ne zaman bitti
// (tarayıcının kaynak zamanlaması; işlemci hızından büyük ölçüde bağımsız) ve menü ne zaman hazır oldu.
// usage: GAME_ROOT=... node baseline/agyavas.mjs [tekrar=2]
import { serve, launch, sleep } from './lib.mjs';
const N = +(process.argv[2] || 2); const { srv, url } = await serve(); const b = await launch(); const out = [];
for (let i = 0; i < N; i++) {
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }); const page = await ctx.newPage(); let bytes = 0;
  page.on('response', async r => { try { bytes += (await r.body()).length; } catch (e) {} });
  const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 10e6 / 8, uploadThroughput: 5e6 / 8 });
  const t0 = Date.now(); await page.goto(url + '/', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 180000, polling: 50 });
  const ready = Date.now() - t0;
  const net = await page.evaluate(() => { const r = performance.getEntriesByType('resource').filter(e => !/\.hdr|favicon|peerjs\.com/.test(e.name)); return { end: Math.round(Math.max(...r.map(e => e.responseEnd))), kb: Math.round(r.reduce((a, e) => a + (e.encodedBodySize || 0), 0) / 1024), n: r.length }; });
  out.push(net.end); console.log('dosyalar indi:', net.end, 'ms (' + net.n + ' dosya, ' + net.kb + ' KB) · menü hazır:', ready, 'ms'); await ctx.close();
}
console.log('indirme bitişi ortalama:', Math.round(out.reduce((a, c) => a + c, 0) / out.length), 'ms'); await b.close(); srv.close();
