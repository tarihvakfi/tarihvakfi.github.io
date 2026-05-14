# Tarih Vakfı · Sayım Defteri

Bu repo, Pertev Naili Boratav arşivi için kamuya açık ve tamamen statik bir **Sayım Defteri** panosu yayınlar. Amaç, paylaşılan Google Sheet / Excel verisindeki çalışmayı doğru özetlemek, gönüllü emeğini isimleriyle görünür kılmak ve teknik kimlikleri kamuya açmamaktır.

## Mimari

- `index.html` GitHub Pages üzerinde çalışan statik pano.
- `apps-script/SheetSync.gs` Google Sheet’i okur ve `?public=1` endpoint’iyle güvenli kamu payload’ı üretir.
- `js/snapshot.js` ilk boyama için statik yedek veridir; GitHub Actions veya yerel audit script ile yenilenir.
- `js/data-loader.js` önce snapshot’ı kullanır, sonra yapılandırılmış Apps Script endpoint’inden canlı veriyi dener.
- `tools/audit_public_dashboard.py` yerel Excel kopyasından aynı kamu özetini üretir ve denetim raporu yazar.

Üretim runtime’ında Firebase, oturum açma, özel backend, Node/Express sunucu veya ücretli servis gerekmez.

## Kamuya Açık Veri Sözleşmesi

```js
window.TVF_PUBLIC_DATA = {
  generatedAt,
  publicSummary,
  latestActivity
};
```

`publicSummary` tüm toplamların kaynağıdır. `latestActivity` yalnızca “Son 50 hareket” akışıdır ve hiçbir toplam bu sınırlı feed’den hesaplanmaz.

## Gönüllü Kredisi

Pano **credit-visible, ID-safe volunteer display** kullanır:

- Sheet’te gerçek insan adı varsa gösterilir.
- `publicDisplayName` / `kamusal_ad` gibi açık kamu adı varsa önceliklidir.
- E-posta, UUID, uzun hex hash, opaque veritabanı ID’si veya machine token isim olarak gösterilmez.
- Kullanılabilir ad yoksa `Adı belirtilmeyen gönüllü` yazılır.
- Açık opt-out alanı varsa `İsmini gizlemeyi tercih eden gönüllü` yazılır.

Önerilen opt-out alanları: `public_credit = no`, `credit_visible = false`, `hide_name = yes`.

## Kamuya Açılmayanlar

- e-posta adresleri
- raw volunteer/user IDs
- UUID, hash, token, sheet row IDs
- özel notlar
- ham spreadsheet export’u
- Apps Script veya Google credential/secrets

## Yerel Kurulum

```bash
python -m pip install -r tools/requirements.txt
python tools/audit_public_dashboard.py
python tools/validate_public_summary.py
python3 -m http.server 8000
```

Önizleme:

```text
http://localhost:8000/
http://localhost:8000/?debug=1
```

Yerel Excel’den snapshot yenilemek:

```bash
python tools/audit_public_dashboard.py --write-snapshot
python tools/validate_public_summary.py --snapshot
```

## Dosya Yapısı

```text
.
├─ index.html
├─ 404.html
├─ .github/workflows/deploy.yml
├─ assets/
├─ css/site.css
├─ js/
│  ├─ config.public.js
│  ├─ snapshot.js
│  ├─ data-loader.js
│  ├─ aggregate.js
│  ├─ volunteer-credit.js
│  ├─ render-dashboard.js
│  └─ utils.js
├─ apps-script/
├─ tools/
├─ docs/
└─ _audit/
```

## Bakım Kontrol Listesi

1. Sheet yapısı değiştiyse `python tools/audit_public_dashboard.py` çalıştırın.
2. `_audit/output/public_dashboard_audit.md` içindeki uyarıları okuyun.
3. `python tools/validate_public_summary.py --snapshot` ile snapshot’ı doğrulayın.
4. Yerelde `/?debug=1` ile adların, dönem etiketinin, günlük toplamların ve aktif kutuların doğru göründüğünü kontrol edin.
5. Apps Script endpoint’i değişirse `js/config.public.js` ve `.github/workflows/deploy.yml` içindeki URL’yi güncelleyin.

Dağıtım ayrıntıları için [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) dosyasına bakın.
