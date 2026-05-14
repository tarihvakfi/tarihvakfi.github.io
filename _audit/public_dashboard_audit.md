# Public Dashboard Audit

- Workbook: `Tarih Vakfı Gönüllü Ağı.xlsx`
- Generated at: `2026-05-14T20:12:56.853157Z`
- Public period: `11–17 Mayıs haftası · bugüne kadar` (`calendar_week`)

## Files Responsible For The Current Public Path

- Public landing HTML: `index.html`
- Public CSS: `css/landing.css`
- Public JS renderer: `js/landing.js`
- Public config: `js/config.public.js`
- Generated snapshot: `js/snapshot.js`
- Google Apps Script sheet sync/public endpoint: `apps-script/SheetSync.gs`
- GitHub Pages deployment/snapshot refresh: `.github/workflows/deploy.yml`

## Workbook Structure

| Sheet | Classification | Rows | Public headers detected |
|---|---:|---:|---|
| Günlük Akış | activity | 64 | Tarih, Paydaş, Çalışma Alanı, Devam Eden Çalışma, Bilgisayar, Tarayıcı, Notlar |
| PNB 14 [gönüllü] | pnb_detail | 11 | Fon Adı, Kutu No, Dosya No, Belge No, Sayfa Sayısı, Dijital Belge Kodu, Notlar, Tarih, ... |
| PNB I1 [gönüllü] | pnb_detail | 111 | Fon Adı, Kutu No, Dosya No, Belge No, Sayfa Sayısı, Dijital Belge Kodu, Notlar, Tarih, ... |
| PNB I2 [gönüllü] | pnb_detail | 40 | Fon Adı, Kutu No, Dosya No, Belge No, Sayfa Sayısı, Dijital Belge Kodu, Notlar, Tarih, ... |
| PNB 68 [gönüllü] | pnb_detail | 99 | Fon Adı, Kutu No, Dosya No, Belge No, Sayfa, Dijital Belge Kodu, Notlar, Tarih, ... |
| PNB 16 [gönüllü] | pnb_detail | 166 | Fon Adı, Kutu No, Dosya No, Belge No, Sayfa, Dijital Belge Kodu, Notlar, Tarih, ... |
| PNB 15 [gönüllü] | pnb_detail | 704 | Fon Adı, Kutu No, Dosya No, Belge No, Sayfa, Dijital Belge Kodu, Notlar, Tarih, ... |
| PNB [gönüllü] | pnb_detail | 0 | Fon Adı, Kutu No, Dosya No, Belge No, Sayfa Sayısı, Dijital Belge Kodu, Notlar, Tarih, ... |
| PNB [gönüllü] | pnb_detail | 2 | Fon Adı, Kutu No, Dosya No, Belge No, Sayfa Sayısı, Dijital Belge Kodu, Notlar, Tarih, ... |
| PNB Sayısallaştırma | pnb_inventory | 89 | Fon, Kutu, Dosya Sayısı, Belge Sayısı, Sayfa Sayısı, Tarama, Kodlama, Kontrol, ... |
| Günlük Gönüllü Akışı | schedule | 9 | Pazartesi, Salı, Çarşama, Perşembe, Cuma |

## Source Counts

- Detail/page rows in workbook: **1,133**
- Activity rows in Günlük Akış: **64**
- Recorded page units from detail tabs: **1,854**
- Target page units from PNB summary: **77,544**
- Inventory-known box rows: **86**
- Completed boxes by detail/target comparison: **0**

## Selected Period Counts

- Calendar-week records: **219**
- Calendar-week page/detail rows: **205**
- Calendar-week activity rows: **14**
- Calendar-week volunteers represented privately: **6**
- Calendar-week active boxes: **2**
- Rolling 7-day records, computed separately: **222**

## Current Snapshot Comparison

- Checked-in snapshot ticker length: **0**
- Checked-in snapshot stats.donePages: **1854**
- Checked-in snapshot stats.totalPages: **77544**
- Checked-in snapshot weeklyRhythm sum: **n/a**
- Workbook-derived total page units: **1,854**
- Workbook-derived progress: **2.4%**

## Daily Ledger Check

| Date | Weekday | Records | Page/detail | Activity | Volunteers | Boxes |
|---|---|---:|---:|---:|---:|---:|
| 2026-05-11 | Pazartesi | 44 | 40 | 4 | 4 | 1 |
| 2026-05-12 | Salı | 103 | 99 | 4 | 4 | 1 |
| 2026-05-13 | Çarşamba | 69 | 66 | 3 | 3 | 1 |
| 2026-05-14 | Perşembe | 3 | 0 | 3 | 2 | 0 |

## Material Distribution

| Material | Full-period records | Share |
|---|---:|---:|
| Belgeler | 216 | 98.6% |
| Fotoğraflar | 3 | 1.4% |

## Privacy And Data Quality

- Audit report redacts personal names from detail sheet titles.
- Public payload labels contributors anonymously unless explicit public display/consent fields are present.
- Public payload omits emails, raw sheet row IDs, volunteer tokens, and raw private contributor keys.

### Warnings

- `missing_box_targets`: 3 active boxes have no page target.
- `unknown_dates`: 213 rows could not be assigned to a public period.

### Validation

- PASS: summary and snapshot validation checks passed.
