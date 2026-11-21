// Save compatibility: real save files of the current format must load exactly (money, per-vehicle fuel/damage, dents, records).
// usage: node baseline/saves.mjs [record|check]
import fs from 'node:fs'; import path from 'node:path'; import { serve, launch, gamePage, sleep, HERE_DIR } from './lib.mjs';
const MODE = process.argv[2] || 'check', DIR = path.join(HERE_DIR, 'saves'), OUT = path.join(HERE_DIR, 'saves_expected.json');
const { srv, url } = await serve(); const browser = await launch(); const res = {};
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) {
  const s = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); const storage = { tp7_veh: s.veh }; if (s.save) storage.tp8_save = JSON.stringify(s.save);
  const { ctx, page } = await gamePage(browser, url, { storage, freeze: false });
  await sleep(2500); await page.evaluate(() => window.__game.startFree()); await sleep(3000);
  const st = await page.evaluate(() => { const g = window.__game, m = g.model; return { money: Math.round(g.SAVE.money), km: +g.SAVE.km.toFixed(3), best: g.SAVE.best, econ2: g.SAVE.econ2 || 0,
    fuel: +(g.phys.fuel ?? 1).toFixed(4), damage: +g.phys.damage.toFixed(1), dents: !!(m.dmg && m.dmg.orig.size), crack: !!(m.dmg && m.dmg.crack) }; });
  // persists across a reload
  await page.evaluate(() => window.__game.saveGame()); const raw = await page.evaluate(() => localStorage.getItem('tp8_save'));
  st.persisted = !!raw && JSON.parse(raw).money === st.money;
  res[f] = st; console.log(f.padEnd(28), JSON.stringify(st)); await ctx.close();
}
await browser.close(); srv.close();
if (MODE === 'record') { fs.writeFileSync(OUT, JSON.stringify(res, null, 1)); console.log('kaydedildi'); }
else { const ref = JSON.parse(fs.readFileSync(OUT, 'utf8')); let bad = 0; for (const k in ref) { const ok = JSON.stringify(ref[k]) === JSON.stringify(res[k]); if (!ok) bad++; console.log(ok ? '✅' : '❌', k, ok ? '' : 'beklenen ' + JSON.stringify(ref[k]) + ' bulunan ' + JSON.stringify(res[k])); } process.exit(bad ? 1 : 0); }
