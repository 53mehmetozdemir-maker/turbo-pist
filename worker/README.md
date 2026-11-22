# TURN aracısı (Cloudflare Worker) — kurulum

İki oyuncu doğrudan bağlanamadığında (mobil veri, sıkı NAT) bağlantı bir TURN sunucusu üzerinden geçer.
TURN: **Metered ücretsiz deneme planı** (kart istemez). ⚠️ Bu plan **ayda sadece 500 MB** TURN trafiği veriyor (giriş + çıkış; eskiden 20 GB'tı). Metered API anahtarı **asla** repoya ya da oyunun koduna girmez;
Cloudflare Worker'da gizli değişken olarak durur. Oyun Worker'a sorar, Worker Metered'den ICE listesini getirir.

> ⚠️ API anahtarını kimseyle paylaşma, sohbete yapıştırma. Sadece Cloudflare'deki gizli değişken kutusuna yazılır.
> Bana (ya da koda) yalnızca **Worker adresi** lazım; o gizli değil.

## 1. Metered hesabı ve API anahtarı
1. https://www.metered.ca adresine git → sağ üstte **Sign Up**.
2. E-posta ve şifreyle kaydol (kart istemez). Uygulama adı (App Name) sorarsa `turbopist` gibi kısa bir ad yaz;
   adresin `turbopist.metered.live` olur. Bu adı bir yere not et.
3. Panelde soldan **TURN Server**'a gir. Plan sorarsa **Free** planı seç.
4. **Credentials** bölümünde **Add Credential** (ya da **Create Credential**) → etiket olarak `oyun` yaz → oluştur.
5. Oluşan satırda **Show API Key** (ya da **Get Credential → API Key**) düğmesine bas → çıkan uzun anahtarı kopyala.
   Bu anahtarı birazdan Cloudflare'e yapıştıracaksın.

## 2. Cloudflare Worker
1. https://dash.cloudflare.com → giriş yap.
2. Soldaki menüde **Compute (Workers)** → **Workers & Pages** → **Create** (Oluştur).
   > Bu adımda kart ya da ücretli plan isterse **dur**, devam etme; bana yaz.
3. **Start with Hello World!** (ya da **Create Worker**) → ad olarak `turbo-pist-turn` yaz → **Deploy**.
4. Açılan sayfada **Edit code** (Kodu düzenle) → soldaki dosyanın (worker.js) içini tamamen sil →
   bu repodaki `worker/turn.js` dosyasının içeriğini olduğu gibi yapıştır → sağ üstte **Deploy**.
5. Worker sayfasına geri dön → **Settings** → **Variables and Secrets** → **Add**:
   - Tür **Text**, ad `METERED_APP`, değer: 1. bölümde not ettiğin uygulama adı (ör. `turbopist`) → kaydet.
   - Tür **Secret**, ad `METERED_API_KEY`, değer: Metered'den kopyaladığın API anahtarı → kaydet.
   - Gerekirse **Deploy** düğmesine bas ki değişkenler devreye girsin.
6. Worker sayfasının üstünde adresi görürsün: `https://turbo-pist-turn.<hesap-adın>.workers.dev`.
   Bu adresin sonuna `/ice` ekleyip tarayıcıda açarsan `{"hata":"izin yok"}` görmelisin — bu **doğru**:
   Worker sadece oyunun sayfasından gelen isteklere cevap verir.
7. Bana sadece Worker adresini yaz (ör. `https://turbo-pist-turn.ahmet.workers.dev`). Oyunun derlemesine ben eklerim.

## Ayrıntılar
- Uç nokta: `GET /ice`. Sadece `https://53mehmetozdemir-maker.github.io` kökeninden (canlı + önizleme) cevap verir.
  Yerelde (`npm run dev`) denemek istersen `IZINLI_KAYNAKLAR` (Text) değişkenine
  `https://53mehmetozdemir-maker.github.io,http://localhost:5173` yaz.
- Metered'e en fazla 10 dakikada bir sorulur (Cloudflare önbelleği); Workers ücretsiz planında günde 100.000 istek var.
- Metered'e ulaşılamazsa ya da değişkenler eksikse yalnız STUN listesi döner: oyun çalışır, sadece zor ağlarda
  bağlantı kurulamayabilir. Oyun da Worker'a 4 sn'de ulaşamazsa aynı şekilde yalnız STUN ile dener.
- TURN kullanıcı adı/parolası WebRTC'nin çalışması için tarayıcıya gitmek zorunda (her TURN kurulumunda böyledir);
  korunan şey Metered **API anahtarı** ve hesabın.
- Birim testi: `cd tests && node baseline/worker.mjs`.

## Kota (500 MB/ay) dolarsa ne olur
- TURN yalnızca iki oyuncu **doğrudan bağlanamadığında** kullanılır; çoğu bağlantı (aynı ağ, çoğu ev ağı) TURN'süz kurulur
  ve kotadan yemez. Kota, sadece zor ağlardaki (bazı mobil operatörler, sıkı NAT) oyuncuların trafiğiyle dolar.
- Kota dolunca Metered TURN sunucusu bağlantıyı reddeder; Worker yine liste döndürür (`X-TP-Kaynak: metered`).
  Tarayıcı TURN'ü deneyip olmayınca doğrudan yolu (STUN) kullanır: **oyun STUN'a düşer**, normal ağlarda oynanmaya devam eder.
  Bu durum `tests/baseline/mp.mjs`'de sınanıyor: ICE listesindeki TURN sunucusuna ulaşılamazken iki oyuncu yine bağlanıyor.
- TURN'ün **gerçekten gerektiği** ağda (iki taraf da doğrudan bağlanamıyorsa) bağlantı kurulamaz: oyun takılmaz,
  15 sn sonra "Odaya bağlanılamadı (zaman aşımı) · Wi-Fi'da tekrar dene" der ve menüde kalır.
- Kullanımı izlemek için: Metered paneli → TURN Server → kullanım (Usage).

## İleride Cloudflare Realtime TURN'e geçiş (kart istediği için şimdilik kullanılmıyor)
Sadece Worker değişir; oyunun kodu değişmez (oyun Worker'dan hazır `iceServers` listesi alıyor).
1. Cloudflare panelinde Realtime → TURN → TURN anahtarı oluştur: **Key ID** ve **API Token** verir.
2. Worker değişkenleri: `CF_TURN_KEY_ID` (Text), `CF_TURN_API_TOKEN` (Secret). Metered değişkenleri silinebilir.
3. `worker/turn.js`'te Metered isteğinin yerine:
   ```js
   const m = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.CF_TURN_KEY_ID}/credentials/generate-ice-servers`, {
     method: 'POST', headers: { Authorization: `Bearer ${env.CF_TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
     body: JSON.stringify({ ttl: 86400 }) });
   const liste = (await m.json()).iceServers;   // cevap { iceServers: [...] } biçiminde
   ```
4. Cloudflare kimlik bilgileri süreli (ttl): Worker önbelleği (`ONBELLEK_SN`, 10 dk) ttl'den kısa kalmalı — öyle.
5. `node baseline/worker.mjs` testindeki sahte Metered cevabını yeni biçime göre güncelle.
