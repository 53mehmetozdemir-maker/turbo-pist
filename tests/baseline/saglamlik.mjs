// Çalışma anı sağlamlığı (Aşama 5): WebGL bağlamı kaybı, sekme gizlenmesi, yakalanmayan hata, efekt zinciri bırakma (H2), Ultra/GTAO (H3).
// usage: node baseline/saglamlik.mjs
import { serve, launch, gamePage, sleep } from './lib.mjs';
const { srv, url } = await serve(); const b = await launch(); let bad = 0;
const ok = (a, k, d = '') => { console.log((k ? '✅ ' : '❌ ') + a + (d ? ' — ' + d : '')); if (!k) bad++; };
const hazir = p => p.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 180000, polling: 300 });
const gorunur = (p, id) => p.evaluate(id => !document.getElementById(id).classList.contains('hidden'), id);
try {
  // 1) WebGL bağlamı kaybı
  { const { ctx, page, log } = await gamePage(b, url, { freeze: false }); await hazir(page);
    await page.evaluate(() => { window.__game.startFree(); window.__game.phys.reset(150, 3.5, 0); window.__game.SAVE.km = 1234.5; });
    await page.evaluate(() => { window.__kayip = window.__game.renderer.getContext().getExtension('WEBGL_lose_context'); window.__kayip.loseContext(); });
    await sleep(800);
    ok('bağlam kaybında "Grafik bağlantısı koptu" paneli', await gorunur(page, 'glLost'));
    ok('bağlam kaybında oyun kaydedildi', await page.evaluate(() => JSON.parse(localStorage.getItem('tp8_save')).km === 1234.5));
    const nav = page.waitForNavigation({ timeout: 120000 }).then(() => true, () => false);
    await page.evaluate(() => window.__kayip.restoreContext());
    const yeniden = await nav; if (yeniden) await hazir(page);
    const d1 = yeniden ? await page.evaluate(() => ({ km: window.__game.SAVE.km, ls: JSON.parse(localStorage.getItem('tp8_save')).km })) : null;
    ok('bağlam geri gelince oyun yeniden yüklenip açıldı, kayıt duruyor', yeniden && d1.km === 1234.5, JSON.stringify({ yeniden, d1 }));
    ok('konsol hatası yok (bağlam kaybı)', !log.filter(l => !/ERR_|Failed to load|CONTEXT_LOST|context lost|WebGL/i.test(l)).length, log.slice(0, 2).join(' | '));
    await ctx.close(); }
  // 2) sekme gizlenince (tek oyunculu serbest sürüş) duraklat
  { const { ctx, page } = await gamePage(b, url, { freeze: false }); await hazir(page);
    await page.evaluate(() => window.__game.startFree()); await sleep(500);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(300); ok('sekme gizlenince tek oyunculuda duraklatıldı', await gorunur(page, 'pause'));
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(300); ok('sekme geri gelince duraklatma ekranında bekliyor (kendiliğinden devam etmez)', await gorunur(page, 'pause'));
    await ctx.close(); }
  // 3) yakalanmayan hata → bildirim çubuğu, "Kaydet ve yenile"
  { const { ctx, page } = await gamePage(b, url, { freeze: false }); await hazir(page);
    await page.evaluate(() => { window.__game.startFree(); window.__game.SAVE.km = 777.25; setTimeout(() => { throw new Error('deneme hatası'); }); }); await sleep(500);
    ok('yakalanmayan hata: bildirim çubuğu ve mesaj', await gorunur(page, 'errBar') && (await page.textContent('#errMsg')).includes('deneme hatası'));
    // kısma: kapattıktan hemen sonra gelen ikinci hata çubuğu yeniden açmaz (zamandan bağımsız: aynı anda peş peşe)
    // (bu ortam çok yavaş: dışarıdan tıklama bile 10 sn sürebilir → hata, kapatma ve ikinci hata sayfa içinde ms'ler içinde)
    await page.evaluate(() => new Promise(r => { setTimeout(() => { throw new Error('x1'); }, 1); setTimeout(() => document.getElementById('errClose').click(), 5);
      setTimeout(() => { throw new Error('x2'); }, 10); setTimeout(r, 60); })); await sleep(300);
    ok('kapattıktan sonra gelen hata çubuğu 10 sn içinde yeniden açmıyor', !(await gorunur(page, 'errBar')));
    await page.evaluate(() => Promise.reject(new Error('söz reddi'))).catch(() => {});
    const nav = page.waitForNavigation({ timeout: 120000 }).then(() => true, () => false);
    await page.evaluate(() => { document.getElementById('errBar').classList.remove('hidden'); }); await page.click('#errReload');
    const y = await nav; if (y) await hazir(page);
    const d3 = y ? await page.evaluate(() => window.__game.SAVE.km) : null;
    ok('"Kaydet ve yenile": kaydedip yeniledi', y && d3 === 777.25, JSON.stringify({ yeniden: y, km: d3 }));
    await ctx.close(); }
  // 4) düşük FPS'te efekt zinciri kapanınca kaynakları bırakılıyor (H2)
  { const { ctx, page } = await gamePage(b, url, { freeze: false, storage: { tp3_quality: 'high' } }); await hazir(page);
    await page.evaluate(() => window.__game.startFree());
    // efekt zincirinin render hedefleri ilk çizimde GPU'ya yüklenir: ölçmeden önce birkaç kare gerçekten çizilmiş olmalı
    // (hızlı makinede ölçüm ilk kareden önceye denk gelip "bırakılacak bir şey yok" görünüyordu)
    const k0 = await page.evaluate(() => window.__game.renderer.info.render.frame);
    await page.waitForFunction(k0 => window.__game.renderer.info.render.frame >= k0 + 10, k0, { timeout: 120000, polling: 100 });
    const once = await page.evaluate(() => ({ c: !!window.__game.composer, t: window.__game.renderer.info.memory.textures }));
    // düşük FPS tetiği bu ortamda çalışmaz (odak/FPS koşulu); bırakma işleminin kendisi doğrudan çağrılır
    const kapandi = await page.evaluate(() => { window.__game.composerBirak(); return !window.__game.composer; }); await page.waitForTimeout(1500);
    const sonra = await page.evaluate(() => window.__game.renderer.info.memory.textures);
    ok('düşük FPS: efekt zinciri kapandı ve render hedefleri bırakıldı (doku sayısı düştü)', once.c && kapandi && sonra < once.t, `vardı ${once.c}, kapandı ${kapandi}, doku ${once.t} → ${sonra}`);
    await ctx.close(); }
  // 5) Ultra: GTAO etkin, hatasız çiziyor
  { const { ctx, page, log } = await gamePage(b, url, { freeze: true, storage: { tp3_quality: 'ultra' } }); await hazir(page);
    await page.evaluate(() => { window.__game.startFree(); window.__run(10); });
    const u = await page.evaluate(() => ({ q: window.__game.quality, ao: !!(window.__game.composer && window.__game.composer.passes.some(p => p.gtaoMaterial)) }));
    const btn = await page.evaluate(() => document.querySelector('#qSeg button.on')?.dataset.v);
    ok('Ultra seçili: GTAO geçişi etkin, menüde Ultra işaretli', u.q === 'ultra' && u.ao && btn === 'ultra', JSON.stringify({ ...u, btn }));
    ok('Ultra: konsol hatası yok', !log.filter(l => !/ERR_|Failed to load/.test(l)).length, log.slice(0, 2).join(' | '));
    await page.screenshot({ path: '/tmp/ultra.png' }); await ctx.close(); }
} catch (e) { ok('test tamamlandı', false, e.message.split('\n')[0]); }
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
