// Save compatibility: real save files of the current format must load exactly (money, per-vehicle fuel/damage, dents, records).
// usage: node baseline/saves.mjs [record|check]
import fs from 'node:fs'; import path from 'node:path'; import { serve, launch, gamePage, sleep, HERE_DIR } from './lib.mjs';
const MODE = process.argv[2] || 'check', DIR = path.join(HERE_DIR, 'saves'), OUT = path.join(HERE_DIR, 'saves_expected.json');
const { srv, url } = await serve(); const browser = await launch(); const res = {};
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) {
  const s = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); const storage = { tp7_veh: s.veh }; if (s.save) storage.tp8_save = JSON.stringify(s.save);
  // donmuş saat: yükleme için gerçek zamanlı beklenir ama oyun yalnız 3 kare ilerler. Eskiden startFree'den sonra 3 sn gerçek
  // zamanlı bekleniyordu; o arada trafik araca çarpabiliyordu (CI'da bir kez: hasar 80 → 85,4, km 5 → 5,001).
  const { ctx, page } = await gamePage(browser, url, { storage });
  await sleep(2500); await page.evaluate(() => window.__run(2)); await sleep(1500);
  await page.evaluate(() => window.__game.startFree()); await page.evaluate(() => window.__run(3)); await sleep(500);
  const st = await page.evaluate(() => { const g = window.__game, m = g.model; return { money: Math.round(g.SAVE.money), km: +g.SAVE.km.toFixed(3), best: g.SAVE.best, econ2: g.SAVE.econ2 || 0,
    fuel: +(g.phys.fuel ?? 1).toFixed(4), damage: +g.phys.damage.toFixed(1), dents: !!(m.dmg && m.dmg.orig.size), crack: !!(m.dmg && m.dmg.crack) }; });
  // persists across a reload
  await page.evaluate(() => window.__game.saveGame()); const raw = await page.evaluate(() => localStorage.getItem('tp8_save'));
  st.persisted = !!raw && JSON.parse(raw).money === st.money;
  res[f] = st; console.log(f.padEnd(28), JSON.stringify(st)); await ctx.close();
}
// Sürüm geçişi (H9a): elle yazılmış beklentiler (saves_gecis/*.json → "bekle")
const GD = path.join(HERE_DIR, 'saves_gecis'); let gbad = 0; const gres = [];
for (const f of fs.existsSync(GD) ? fs.readdirSync(GD).filter(f => f.endsWith('.json')).sort() : []) {
  const s = JSON.parse(fs.readFileSync(path.join(GD, f), 'utf8')); const storage = { tp7_veh: s.veh }; if (s.save) storage.tp8_save = JSON.stringify(s.save); if (s.raw != null) storage.tp8_save = s.raw;
  const { ctx, page, log } = await gamePage(browser, url, { storage, freeze: false });
  await sleep(2500);
  // yükleme anında oku (beklersek trafik çarpabilir, rölantide yakıt gider): startFree → hemen kaydet+oku
  const st = await page.evaluate(() => { const g = window.__game; g.startFree(); g.saveGame(); const w = JSON.parse(localStorage.getItem('tp8_save')); return { money: Math.round(g.SAVE.money), km: +g.SAVE.km.toFixed(3), econ2: g.SAVE.econ2 || 0, fuel: +(g.phys.fuel ?? 1).toFixed(4), damage: +g.phys.damage.toFixed(1), v: w.v, w, yedek: localStorage.getItem('tp8_save_bozuk') }; });
  const b = s.bekle, errs = []; for (const k of ['money', 'km', 'econ2', 'fuel', 'damage', 'v']) if (k === 'fuel' ? Math.abs(st[k] - b[k]) > 0.005 : st[k] !== b[k]) errs.push(`${k}: ${b[k]} bekleniyordu, ${st[k]} bulundu`);
  if (b.korunan) for (const k in b.korunan) if (JSON.stringify(st.w[k]) !== JSON.stringify(b.korunan[k])) errs.push(`korunmadı: ${k}`);
  if ('yedek' in b && st.yedek !== b.yedek) errs.push('bozuk kayıt yedeklenmedi'); if (!('yedek' in b) && st.yedek != null) errs.push('gereksiz yedek');
  if (log.filter(l => !/ERR_TUNNEL|ERR_CONNECTION|Kayıt okunamadı/.test(l)).length) errs.push('konsol hatası: ' + log[0]);
  if (errs.length) gbad++; gres.push((errs.length ? '❌ ' : '✅ ') + 'geçiş ' + f + (errs.length ? ' — ' + errs.join('; ') : '')); await ctx.close();
}
await browser.close(); srv.close();
if (MODE === 'record') { fs.writeFileSync(OUT, JSON.stringify(res, null, 1)); console.log('kaydedildi'); }
else { const ref = JSON.parse(fs.readFileSync(OUT, 'utf8')); let bad = 0; for (const k in ref) { const yak = o => o && { ...o, fuel: Math.round(o.fuel * 1000) };   // yakıt: gerçek zamanlı bekleme sırasında rölantide ~0,0001 oynayabilir
    const ok = JSON.stringify(yak(ref[k])) === JSON.stringify(yak(res[k])); if (!ok) bad++; console.log(ok ? '✅' : '❌', k, ok ? '' : 'beklenen ' + JSON.stringify(ref[k]) + ' bulunan ' + JSON.stringify(res[k])); } for (const l of gres) console.log(l); process.exit(bad || gbad ? 1 : 0); }
