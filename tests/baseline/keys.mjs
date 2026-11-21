// Every keyboard shortcut tested on its own effect (game state, not just "no error").
// usage: node baseline/keys.mjs [record|check]
import fs from 'node:fs'; import path from 'node:path'; import { serve, launch, gamePage, sleep, HERE_DIR } from './lib.mjs';
const MODE = process.argv[2] || 'check', OUT = path.join(HERE_DIR, 'keys_expected.json');
const SPY = `(()=>{ window.__osc=0; const s=OscillatorNode.prototype.start; OscillatorNode.prototype.start=function(...a){ window.__osc++; return s.apply(this,a); }; })();`;
const { srv, url } = await serve(); const browser = await launch(); const res = {};
const { ctx, page, log } = await gamePage(browser, url, { storage: { tp7_veh: 'f458', tp3_cam: '0', tp3_quality: 'low' }, viewport: { width: 400, height: 225 } });
await ctx.addInitScript(SPY); await page.evaluate(SPY);
const E = (f, a) => page.evaluate(f, a); const run = n => E(n => window.__run(n), n);
const toast = () => E(() => document.getElementById('toast').textContent.trim());
const tap = async (k, frames = 3) => { await page.keyboard.press(k); await run(frames); };
const hold = async (k, frames) => { await page.keyboard.down(k); await run(frames); const s = await state(); await page.keyboard.up(k); await run(2); return s; };
const state = () => E(() => { const P = window.__game.phys; return { throttle: +P.throttle.toFixed(2), brake: +P.brake.toFixed(2), steer: +P.steer.toFixed(3), hand: +(+P.hand).toFixed(2), nitroOn: !!P.nitroOn, gear: P.gear, speed: +P.speed.toFixed(2) }; });
const at = p => E(p => { const P = window.__game.phys; P.reset(p[0], p[1], p[2]); P.vx = P.vy = 0; }, p);
await sleep(2000); await page.click('#soloBtn'); await run(3); await sleep(2000); await run(3);
let T0 = Date.now(); const R = (k, v) => { res[k] = v; console.log(k.padEnd(22), JSON.stringify(v), ((Date.now() - T0) / 1000).toFixed(1) + 's'); T0 = Date.now(); };
// driving keys
for (const [k, name] of [['KeyW', 'W gaz'], ['ArrowUp', '↑ gaz'], ['KeyS', 'S fren'], ['ArrowDown', '↓ fren'], ['KeyA', 'A sol'], ['ArrowLeft', '← sol'], ['KeyD', 'D sağ'], ['ArrowRight', '→ sağ']]) {
  await at([150, 3.5, 0]); if (/fren/.test(name)) await E(() => { window.__game.phys.vx = 15; }); const s = await hold(k, /fren/.test(name) ? 4 : 12); R(name, { throttle: s.throttle > 0.5, brake: s.brake > 0.5, steer: Math.sign(Math.round(s.steer * 100)) }); }
{ await at([150, 3.5, 0]); await run(2); await page.keyboard.down('KeyS'); await run(40); const rv = await E(() => window.__game.phys.reversing); await page.keyboard.up('KeyS'); await run(2); R('S dururken geri', { reversing: rv }); }
await at([150, 3.5, 0]); { await page.keyboard.down('KeyW'); await run(20); const s = await hold('Space', 8); await page.keyboard.up('KeyW'); R('Space el freni', { hand: s.hand > 0.5 }); }
for (const k of ['KeyN', 'ShiftLeft']) { await at([150, 3.5, 0]); await E(() => { window.__game.phys.nitro = 1; }); await page.keyboard.down('KeyW'); await run(15); const s = await hold(k, 8); await page.keyboard.up('KeyW'); R((k === 'KeyN' ? 'N' : 'Shift') + ' nitro', { nitroOn: s.nitroOn }); }
// manual gears
await E(() => { window.__game.phys.manual = true; }); await at([150, 3.5, 0]); await run(2);
for (const k of ['KeyE', 'KeyX', 'KeyQ', 'KeyZ']) { const g0 = (await state()).gear; await tap(k, 25); const g1 = (await state()).gear; R(k[3] + ' vites', { delta: g1 - g0 }); }
await E(() => { window.__game.phys.manual = false; });
// camera, sound, lights, horn
{ const seq = []; for (let i = 0; i < 3; i++) { await tap('KeyC'); seq.push(await E(() => localStorage.getItem('tp3_cam'))); } R('C kamera', { seq }); }
{ await tap('KeyK'); const a = await toast(); await tap('KeyK'); const b = await toast(); R('K ses', { a, b }); }
{ await tap('KeyL'); const a = await toast(); await tap('KeyL'); const b = await toast(); R('L far', { a, b }); }
{ const o0 = await E(() => window.__osc); await hold('KeyH', 10); const o1 = await E(() => window.__osc); R('H korna', { oscillatorsStarted: o1 > o0 }); }
// map + ESC
{ await tap('KeyM'); const open = await E(() => window.__game.toggleBigMap2()); await tap('Escape'); const closedByEsc = !(await E(() => window.__game.toggleBigMap2())); const pausedAfterMapEsc = await E(() => !document.getElementById('pause').classList.contains('hidden'));
  await tap('KeyM'); await tap('KeyM'); const closedByM = !(await E(() => window.__game.toggleBigMap2())); R('M harita', { open, closedByEsc, pausedAfterMapEsc, closedByM }); }
{ await tap('Escape'); const p1 = await E(() => !document.getElementById('pause').classList.contains('hidden')); await tap('Escape'); const p2 = await E(() => !document.getElementById('pause').classList.contains('hidden')); R('ESC duraklat', { pause: p1, resume: !p2 }); }
// R: back to the road from a pavement/grass spot
{ await at([150, 30, 0.7]); await run(2); const before = await E(() => window.__game.openWorld.surface(window.__game.phys.x, window.__game.phys.y)); await tap('KeyR'); const after = await E(() => window.__game.openWorld.surface(window.__game.phys.x, window.__game.phys.y)); R('R yola dön', { before, after }); }
// T: go to friend (solo: no friend)
{ await tap('KeyT'); R('T arkadaşa git', { toast: await toast() }); }
// F at the fuel station, F at the garage
{ await E(() => { const g = window.__game, s = g.world.services.find(q => q.kind === 'fuel'); g.phys.reset(s.x, s.y, s.a); g.phys.fuel = 0.4; g.SAVE.money = 5000; }); await run(3); await tap('KeyF'); await run(60); const f = await E(() => +window.__game.phys.fuel.toFixed(2)); R('F yakıt', { fuelRose: f > 0.45 }); }
{ await E(() => { const g = window.__game, s = g.world.services.find(q => q.kind === 'repair'); g.phys.reset(s.x, s.y, s.a); g.phys.damage = 40; }); await run(3); await tap('KeyF'); await run(110); const d = await E(() => window.__game.phys.damage); R('F tamir', { repaired: d === 0 }); }
// G tow when the tank is empty
{ await at([700, 350, 0]); await E(() => { window.__game.phys.fuel = 0; window.__game.SAVE.money = 5000; }); await run(2); const m0 = await E(() => window.__game.SAVE.money); await tap('KeyG'); const st = await E(() => { const g = window.__game; return { moved: Math.hypot(g.phys.x - 700, g.phys.y - 350) > 20, money: g.SAVE.money }; }); R('G çekici', { moved: st.moved, paid: m0 - st.money }); }
const errs = (await E(() => window.__errors)).concat(log.filter(l => !/ERR_TUNNEL|ERR_CONNECTION/.test(l))); R('konsol hataları', errs.length);
await browser.close(); srv.close();
if (MODE === 'record') { fs.writeFileSync(OUT, JSON.stringify(res, null, 1)); console.log('kaydedildi'); }
else { const ref = JSON.parse(fs.readFileSync(OUT, 'utf8')); let bad = 0; for (const k in ref) { const ok = JSON.stringify(ref[k]) === JSON.stringify(res[k]); if (!ok) bad++; console.log(ok ? '✅' : '❌', k, ok ? '' : JSON.stringify(ref[k]) + ' → ' + JSON.stringify(res[k])); } process.exit(bad ? 1 : 0); }
