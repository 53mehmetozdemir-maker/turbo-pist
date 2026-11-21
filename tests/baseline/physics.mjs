// Physics determinism: fixed start + scripted 120 Hz inputs, 30 s per vehicle; every step recorded and hashed.
// usage: node baseline/physics.mjs [record|check]
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { serve, launch, gamePage, HERE_DIR } from './lib.mjs';
const MODE = process.argv[2] || 'check'; const OUT = path.join(HERE_DIR, 'physics.json');
const VEH = ['f458', 'f40', 'model3', 'e2008', 'gsxr', 'gt3', 'civic'];
const SIM = `(async()=>{ const g=__game, P=g.phys; P.manual=false; P.assists=true; P.fuelUse=true;
  const inp=i=>{ const t=i/120, o={steer:0,gas:0,brake:0,hand:false,nitro:false,analog:false,horn:false};
    if(t<5) o.gas=1; else if(t<8){ o.gas=1; o.steer=0.6; } else if(t<10){ o.gas=0.6; o.hand=true; o.steer=-0.8; } else if(t<12){ o.gas=1; o.nitro=true; }
    else if(t<15) o.brake=1; else if(t<18){ o.gas=0.8; o.steer=-0.5; } else if(t<20){ o.brake=1; } else if(t<22){ o.brake=1; }   // brake past standstill: reverse (auto)
    else if(t<26) o.gas=1; else o.gas=1;
    return o; };
  const rows=[]; const h=[]; const rec=(i)=>{ const r=[P.x,P.y,P.a,P.speed,P.rpm,P.gear,P.damage,P.fuel]; h.push(r.join(',')); if(i%12===0) rows.push(r); };
  const obs={x:330,y:3.5,a:0,vx:0,vy:0};
  P.reset(150,3.5,0); P.damage=0; P.fuel=1; P.nitro=1;
  for(let i=0;i<3600;i++){ if(i===2640){ P.reset(150,-4,Math.PI/2); }      // 22 s: drive into a building
    if(i===3120){ P.reset(300,3.5,0); }                                   // 26 s: drive into a parked car
    P.step(1/120, inp(i), i>=3120?[obs]:[]); rec(i); }
  return { rows, all:h.join(';') }; })()`;
const { srv, url } = await serve(); const browser = await launch(); const result = {};
for (const v of VEH) {
  const { ctx, page, log } = await gamePage(browser, url, { storage: { tp7_veh: v, tp4_map: 'city', tp4_time: 'day', tp6_wx: 'clear' } });
  await page.evaluate(() => window.__game.startFree()); await page.evaluate(() => window.__run(30));   // world built, a few frames, then hold the game loop
  const r = await page.evaluate(SIM); const hash = crypto.createHash('sha256').update(r.all).digest('hex');
  result[v] = { hash, rows: r.rows }; const last = r.rows[r.rows.length - 1];
  console.log(v.padEnd(7), hash.slice(0, 16), 'son: x', last[0].toFixed(2), 'y', last[1].toFixed(2), 'hız', last[3].toFixed(2), 'hasar', last[6].toFixed(1), log.length ? '| konsol: ' + log.slice(0, 2).join(' / ') : '');
  await ctx.close();
}
await browser.close(); srv.close();
if (MODE === 'record') { fs.writeFileSync(OUT, JSON.stringify(result)); console.log('kaydedildi', OUT); }
else { const ref = JSON.parse(fs.readFileSync(OUT, 'utf8')); let bad = 0;
  for (const v of VEH) { if (ref[v].hash === result[v].hash) { console.log('✅', v, 'birebir aynı'); continue; }
    let worst = 0, at = -1; ref[v].rows.forEach((row, i) => row.forEach((x, k) => { const d = Math.abs(x - result[v].rows[i][k]) / Math.max(1, Math.abs(x)); if (d > worst) { worst = d; at = i; } }));
    const ok = worst < 1e-6; if (!ok) bad++; console.log(ok ? '✅' : '❌', v, 'hash farklı, en büyük göreli fark', worst.toExponential(2), 'adım', at * 12); }
  process.exit(bad ? 1 : 0); }
