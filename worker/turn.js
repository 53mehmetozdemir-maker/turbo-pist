// Turbo Pist — TURN bilgisi aracısı (Cloudflare Worker).
//
// Oyun, iki oyuncu doğrudan bağlanamadığında (mobil veri, sıkı NAT) Metered TURN sunucusu üzerinden
// bağlanır. Metered API anahtarı ASLA repoya ya da oyunun koduna girmez: bu Worker'da gizli değişken
// (Secret) olarak durur. Oyun bu Worker'a sorar, Worker Metered'den ICE sunucu listesini alıp verir.
//
// Cloudflare panelinde tanımlanacak değişkenler (Settings → Variables and Secrets):
//   METERED_APP      (Text)    Metered uygulama adı, ör. "turbopist"  → turbopist.metered.live
//   METERED_API_KEY  (Secret)  Metered TURN kimlik bilgisinin API anahtarı
//   IZINLI_KAYNAKLAR (Text, isteğe bağlı) virgülle ayrılmış izinli sayfa kökenleri;
//                    boşsa: https://53mehmetozdemir-maker.github.io
//
// Uç nokta: GET /ice  →  [{urls, username?, credential?}, …]
// Sadece izinli kökenlerden gelen isteklere cevap verir; Metered'e her istekte değil, en fazla
// 10 dakikada bir sorar (Cloudflare önbelleği). Metered'e ulaşılamazsa yalnız STUN listesi döner
// (oyun yine çalışır, sadece zor ağlarda bağlantı kurulamayabilir).
const VARSAYILAN_KOKEN = 'https://53mehmetozdemir-maker.github.io';
const YEDEK = [{ urls: 'stun:stun.relay.metered.ca:80' }, { urls: 'stun:stun.l.google.com:19302' }];
const ONBELLEK_SN = 600;

function izinli(env, origin) {
  const liste = (env.IZINLI_KAYNAKLAR || VARSAYILAN_KOKEN).split(',').map(s => s.trim()).filter(Boolean);
  return !!origin && liste.includes(origin);
}
function cevap(govde, durum, origin, ek = {}) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...ek };
  if (origin) { h['Access-Control-Allow-Origin'] = origin; h['Access-Control-Allow-Methods'] = 'GET, OPTIONS'; h['Access-Control-Max-Age'] = '86400'; }
  return new Response(JSON.stringify(govde), { status: durum, headers: h });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), origin = req.headers.get('Origin');
    if (url.pathname !== '/ice') return cevap({ hata: 'bulunamadı' }, 404, null);
    if (!izinli(env, origin)) return cevap({ hata: 'izin yok' }, 403, null);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' } });
    if (req.method !== 'GET') return cevap({ hata: 'yöntem' }, 405, origin);
    if (!env.METERED_APP || !env.METERED_API_KEY) return cevap(YEDEK, 200, origin, { 'X-TP-Kaynak': 'yedek-ayar-yok' });
    // Cloudflare önbelleği: Metered'e en fazla 10 dakikada bir sor (anahtar önbellek adresinde geçmez)
    const anahtar = new Request('https://tp-turn.onbellek/ice/' + encodeURIComponent(env.METERED_APP));
    const cache = caches.default;
    let r = await cache.match(anahtar);
    if (!r) {
      try {
        const m = await fetch(`https://${env.METERED_APP}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(env.METERED_API_KEY)}`);
        if (!m.ok) throw new Error('metered ' + m.status);
        const liste = await m.json();
        if (!Array.isArray(liste) || !liste.length) throw new Error('metered boş liste');
        r = new Response(JSON.stringify(liste), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + ONBELLEK_SN } });
        ctx.waitUntil(cache.put(anahtar, r.clone()));
      } catch (e) {
        return cevap(YEDEK, 200, origin, { 'X-TP-Kaynak': 'yedek-hata' });
      }
    }
    return cevap(await r.json(), 200, origin, { 'X-TP-Kaynak': 'metered' });
  },
};
