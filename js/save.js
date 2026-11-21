// Kayıt (localStorage 'tp8_save') okuma + sürüm geçişi (migrasyon).
//
// Biçim: { v, money, veh:{<araç>:{fuel,damage}}, km, best:{<araç>:ms}, econ2 }
//   v yok  → sürüm 0 (Aşama 3 öncesi bütün kayıtlar). Alanlar aynı; sadece v=1 eklenir.
//   v = 1  → bu sürüm.
//   v > 1  → daha yeni bir oyun sürümünün kaydı (ör. önizleme ya da güncelleme sonrası eski sekme):
//            bilinen alanlar okunur, bilinmeyen alanlar ve v olduğu gibi korunur (kayıt tüm nesne
//            olarak yazıldığı için hiçbir şey silinmez, sürüm düşürülmez).
//
// Kurallar: geçişler sadece ekleme yapar, alan silmez/yeniden adlandırmaz; böylece eski oyun
// sürümü de yeni kaydı okuyabilir. Yeni bir geçiş eklerken GECISLER'e bir adım ekle ve
// SAVE_VERSION'ı artır; tests/baseline/saves/ altına o sürümden örnek kayıt koy.
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'tp8_save', BOZUK_KEY = 'tp8_save_bozuk';

const GECISLER = {
  0: s => s,            // v0 → v1: biçim aynı, sadece sürüm alanı eklenir
};

const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const num = x => typeof x === 'number' && Number.isFinite(x);

// store: {get(k), set(k,v)}. Döner: kayıt nesnesi (varsayılan değerler main.js'te atanır).
export function loadSave(store) {
  const raw = store.get(SAVE_KEY);
  if (raw == null) return { v: SAVE_VERSION };
  let s;
  try { s = JSON.parse(raw); } catch (e) { s = undefined; }
  if (!isObj(s)) {
    // Okunamayan kayıt: sessizce kaybolmasın, bir kez yedeklenir (üzerine yazılmaz).
    if (store.get(BOZUK_KEY) == null) store.set(BOZUK_KEY, raw);
    console.warn('Kayıt okunamadı, yedeklendi:', BOZUK_KEY);
    return { v: SAVE_VERSION };
  }
  // Tür onarımı: bozuk alan oyunu NaN'a sürüklemesin (varsayılanı main.js atar).
  if (s.money != null && !num(s.money)) delete s.money;
  if (s.km != null && !num(s.km)) delete s.km;
  if (s.veh != null && !isObj(s.veh)) delete s.veh;
  if (s.best != null && !isObj(s.best)) delete s.best;
  let v = num(s.v) ? Math.floor(s.v) : 0;
  while (v < SAVE_VERSION) { s = GECISLER[v](s); v++; s.v = v; }
  return s;
}
