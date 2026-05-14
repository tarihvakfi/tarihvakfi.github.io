# Deployment

## GitHub Pages

Repo `main` branch’ine push edildiğinde `.github/workflows/deploy.yml` çalışır.

Workflow:

1. Repo’yu checkout eder.
2. `.nojekyll` ekler.
3. Apps Script endpoint’inden `?public=1` payload’ını çeker.
4. Payload `publicSummary` içeriyorsa `js/snapshot.js` dosyasını üretir.
5. Snapshot içinde e-posta, `volunteerToken`, raw sheet row ID gibi yasaklı değerleri arar.
6. Statik siteyi GitHub Pages artifact’i olarak yükler.

## Apps Script Endpoint

Canlı endpoint `js/config.public.js` içinde:

```js
window.__SHEETSYNC_URL__ = "https://script.google.com/macros/s/.../exec";
```

Aynı URL `.github/workflows/deploy.yml` içindeki `SHEETSYNC_URL` ortam değişkeninde de bulunur. Endpoint değişirse ikisi birlikte güncellenmelidir.

## Snapshot Refresh

Yerel Excel kopyasından snapshot üretmek:

```bash
python tools/audit_public_dashboard.py --write-snapshot
python tools/validate_public_summary.py --snapshot
```

GitHub Actions canlı Apps Script endpoint’inden snapshot üretir. Endpoint geçici olarak başarısız olursa checked-in snapshot korunur.

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

- Dönem etiketi tek mantıkla görünmeli: `11–17 Mayıs haftası · bugüne kadar` veya `Son 7 gün`.
- Gönüllü isimleri gerçek adlarla görünmeli.
- Teknik ID, e-posta, UUID, hash görünmemeli.
- Günlük toplamlar headline toplamıyla eşleşmeli.
- Aktif kutular done/target/remaining göstermeli.
- “Son 50 hareket” dışındaki hiçbir bölüm capped feed’den hesaplanmamalı.
