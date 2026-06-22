# Deployment

## GitHub Pages

Repo `main` branch’ine push edildiğinde `.github/workflows/deploy.yml` çalışır.

Workflow:

1. Repo’yu checkout eder.
2. Apps Script endpoint’inden `?public=1&period=rolling_7_days` payload’ını çeker.
3. Payload `rolling_7_days` dönemi içeriyorsa `js/snapshot.js` dosyasını üretir. Endpoint hâlâ eski takvim haftası döndürüyorsa workflow public `byDay` ve `latestActivity` verisinden geçici rolling snapshot üretir; tam ve kalıcı sonuç için Apps Script yeniden deploy edilmelidir.
4. `.nojekyll` ekler.
5. Statik siteyi GitHub Pages artifact’i olarak yükler.

## Apps Script Endpoint

Canlı endpoint `js/config.public.js` içinde:

```js
window.__SHEETSYNC_URL__ = "https://script.google.com/macros/s/.../exec";
```

Workflow endpoint URL’yi `js/config.public.js` içinden okur. Endpoint değişirse bu dosyayı güncellemek yeterlidir.

## Snapshot Refresh

Yerel Excel kopyasından snapshot üretmek:

```bash
python tools/audit_public_dashboard.py --period rolling_7_days --write-snapshot
python tools/validate_public_summary.py --snapshot
```

GitHub Actions canlı Apps Script endpoint’inden snapshot üretir. Endpoint geçici olarak başarısız olursa checked-in snapshot korunur.

Endpoint eski Apps Script deployment’ı yüzünden `calendar_week_to_date` döndürürse yerelde aynı yenilemeyi test etmek için:

```bash
node tools/refresh_public_snapshot.mjs
python tools/validate_public_summary.py --snapshot
```

## Local Testing

```bash
python -m pip install -r tools/requirements.txt
python tools/audit_public_dashboard.py
python tools/validate_public_summary.py
python tools/validate_public_summary.py --snapshot
python3 -m http.server 8000
```

Sonra:

```text
http://localhost:8000/
http://localhost:8000/?debug=1
```

## After Deploy Checks

- Dönem etiketi tek mantıkla görünmeli: `Güncel dönem · 2–8 Haziran` gibi rolling aralık.
- Gönüllü isimleri gerçek adlarla görünmeli.
- Teknik ID, e-posta, UUID, hash görünmemeli.
- Günlük toplamlar headline toplamıyla eşleşmeli.
- Aktif kutular done/target/remaining göstermeli.
- Apps Script redeploy sonrası “Son 50 hareket” dışındaki hiçbir bölüm capped feed’den hesaplanmamalı.
