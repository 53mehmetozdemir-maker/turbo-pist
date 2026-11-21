// Service worker kaydı + "yeni sürüm hazır" uyarısı.
//
// Kurallar:
//  - Oyun ASLA kendiliğinden yenilenmez. Yeni sürüm arka planda iner; uyarı yalnızca ana menüde ve
//    serbest sürüşün duraklatma ekranında görünür (yarış/geri sayım duraklatmasında görünmez). Oyuncu basınca
//    serbest sürüşteyse önce kaydedilir, sonra yenilenir.
//  - Kayıt oyun açıldıktan 3 sn sonra yapılır: önbelleğe alma açılış indirmeleriyle yarışmasın.
//  - Sadece derlenmiş sürümde (npm run dev'de service worker yok).
const SURUM = import.meta.env.VITE_SURUM || 'yerel';
const BASE = import.meta.env.BASE_URL;
let reg = null, hazir = false;

export function surumBaslat() {
  window.__tpSurum = SURUM;
  try { sessionStorage.removeItem('tp_kurtarma'); } catch (e) {}   // açılış başarılı: acil kurtarma tekrar kullanılabilir
  document.querySelectorAll('.updBtn').forEach(b => b.addEventListener('click', yenile));
  const pause = document.getElementById('pause');
  if (pause) new MutationObserver(gorunurluk).observe(pause, { attributes: true, attributeFilter: ['class'] });
  if (!import.meta.env.PROD || import.meta.env.VITE_SW_KAPALI || !('serviceWorker' in navigator)) return;
  setTimeout(kaydet, 3000);
}

async function kaydet() {
  const ilkDenetci = navigator.serviceWorker.controller;
  try { reg = await navigator.serviceWorker.register(BASE + 'sw.js', { scope: BASE, updateViaCache: 'none' }); }
  catch (e) { console.warn('Service worker kaydedilemedi:', e && e.message); return; }
  if (!reg) return;                 // bazı tarayıcı kısıtlamalarında (ör. SW engelli) kayıt nesnesi gelmez
  window.__tpSW = reg;
  if (reg.waiting && navigator.serviceWorker.controller) bekleyenVar();
  reg.addEventListener('updatefound', () => {
    const w = reg.installing; if (!w) return;
    w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) bekleyenVar(); });
  });
  // Başka bir sekme yeni sürümü devreye aldıysa bu sekme eski sayfayla kalır: uygun anda yenilemesi için uyar.
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (ilkDenetci && !yenileniyor) bekleyenVar(); });
  // Düzenli kontrol (sadece indirir, yenilemez): sekme öne gelince ve saatte bir.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
}

function bekleyenVar() { hazir = true; gorunurluk(); }

// İzin listesi: yalnızca ana menü ve serbest sürüş. Yarış, geri sayım, lobi, sonuç: asla.
const izinli = () => { const m = window.__game && window.__game.mode; return m === 'menu' || m === 'free'; };

function gorunurluk() {
  const serbest = window.__game && window.__game.mode === 'free';
  const m = document.getElementById('updMenu'), p = document.getElementById('updPause');
  if (m) m.classList.toggle('hidden', !hazir);
  if (p) p.classList.toggle('hidden', !hazir || !serbest);
}

let yenileniyor = false;
function yenile() {
  const g = window.__game;
  if (!izinli()) return;                                      // yarışta, geri sayımda, lobide asla
  try { if (g && g.mode === 'free') g.saveGame(); } catch (e) {}
  yenileniyor = true;
  const w = reg && reg.waiting;
  if (!w) { location.reload(); return; }
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  w.postMessage({ tip: 'SKIP_WAITING' });
}
