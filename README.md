# Tarih Vakfı · Sayım Defteri

Bu repo şu anda GitHub Pages üzerinde çalışan kamuya açık, statik bir **Sayım Defteri** panosu içerir. Pano, Pertev Naili Boratav arşivi için paylaşılan Google Sheet / Excel verisini özetler; kişisel kimlikleri, e-posta adreslerini, ham satır kimliklerini ve özel notları kamuya açmaz.

## Güncel Mimari

- `/` → statik GitHub Pages panosu (`index.html`, `css/landing.css`, `js/landing.js`)
- `apps-script/SheetSync.gs` → Google Sheet'i okuyan ve `?public=1` ile kamuya güvenli özet dönen Apps Script
- `js/snapshot.js` → GitHub Actions veya yerel audit script tarafından üretilen, ilk boyamada kullanılan güvenli yedek veri
- `.github/workflows/deploy.yml` → saatlik snapshot yenileme ve GitHub Pages dağıtımı
- `tools/audit_public_dashboard.py` → yerel Excel denetimi, Markdown audit raporu, snapshot üretimi ve doğrulama

Firebase / Firestore tabanlı gönüllü yönetimi bu repo geçmişinde tasarlanmış daha geniş bir mimaridir. Kamuya açık Sayım Defteri bugün login gerektirmez ve canlı sayfa özetlerini Google Sheet / Apps Script hattından alır.

## Veri Sözleşmesi

Apps Script ve yerel audit script aynı kamuya güvenli şekli üretir:

```js
publicSummary = {
  generatedAt,
  period,
  totals,
  byDay,
  byMaterial,
  byBox,
  byVolunteer,
  highlights,
  warnings
}
```

`latestActivity` yalnızca son hareket satırı için sınırlı bir akıştır. Toplamlar, günlük kartlar, malzeme dağılımı, gönüllü sayıları ve kutu ilerlemesi bu sınırlı akıştan hesaplanmaz.

## Dönem Mantığı

Kamu panosu tek bir dönem kullanır:

- `period.mode = "calendar_week"`
- Etiket örneği: `11–17 Mayıs haftası · bugüne kadar`
- Günlük haftanın adı doğrudan `dateISO` değerinden türetilir.

Audit script rolling 7 günü ayrıca hesaplar, fakat kamu panosunda haftalık özetle karıştırmaz.

## Gizlilik

Gönüllü görünümü şu sırayla seçilir:

1. `publicDisplayName` / `kamusalAd` gibi açık kamu adı varsa onu kullanır.
2. Adın gösterilmesine açık izin veren bir alan varsa yalnızca ilk adı kullanır.
3. İzin yoksa `Bir gönüllü` veya `Gönüllü katkısı` gösterir.

E-posta, UUID, uzun hex değer, opaque alfanümerik ID ve ham sheet satır tanımları kamu payload'ına yazılmaz. Katkı sayıları korunur; bu yüzden gerçek emek hiçbir zaman `0 gönüllü` gibi görünmez.

Önerilen sheet alanları:

- `publicDisplayName`
- `publicDisplayAllowed`
- `publicConsent`
- `adGorunsun`

Bu alanlar yoksa pano güvenli varsayılan olarak anonim gösterir.

## Yerel Audit Ve Snapshot

Özel workbook dosyaları repoya konmaz. Yerel giriş dosyası şu klasöre bırakılır:

```bash
_audit/input/
```

Audit raporu ve doğrulama:

```bash
/Users/arf/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 tools/audit_public_dashboard.py
```

Yerel Excel'den `js/snapshot.js` üretmek:

```bash
/Users/arf/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 tools/audit_public_dashboard.py --write-snapshot
```

Sadece doğrulama:

```bash
/Users/arf/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 tools/audit_public_dashboard.py --validate-only
```

Doğrulama şunları kontrol eder:

- `sum(byDay.records) == totals.records`
- malzeme toplamları dönem kayıtlarıyla uyumlu
- kamu gönüllü etiketlerinde e-posta, UUID, hash veya opaque ID yok
- kayıt bulunan hiçbir gün `0 gönüllü` göstermiyor
- en yoğun gün etiketi gerçek tarihle eşleşiyor
- özetler sınırlı feed'den hesaplanmıyor
- toplam ilerleme yüzdesi doğru yuvarlanıyor
- `js/snapshot.js` geçerli JS ve güvenli JSON taşıyor

## Yerel Önizleme

Statik dosya olduğu için basit bir sunucu yeterlidir:

```bash
python3 -m http.server 8000
```

Sonra:

```text
http://localhost:8000/
http://localhost:8000/?debug=1
```

`?debug=1` veya localhost üzerinde veri kalitesi notları görünür.

## Dağıtım

1. `apps-script/SheetSync.gs` içeriğini Apps Script projesine yayınlayın.
2. Web app deployment'ını yenileyin.
3. GitHub Actions `Deploy to GitHub Pages` workflow'unu çalıştırın.

Workflow, Apps Script endpoint'i henüz `publicSummary` üretmiyorsa mevcut güvenli `js/snapshot.js` dosyasını korur.
