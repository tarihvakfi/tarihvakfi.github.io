# Data Schema

## Expected Sheets

- `Günlük Akış`: activity/report rows.
- `PNB Sayısallaştırma`: inventory/summary rows with box targets.
- `PNB ...`: detail rows for boxes and volunteers.
- `Günlük Gönüllü Akışı`: schedule/reference sheet; not counted as public activity.

## Common Columns

Date fields:

- `Tarih`
- ISO-like date strings or Turkish dates such as `11 Mayıs 2026`

Volunteer/name fields:

- `Paydaş`
- `Kaydı Oluşuran`
- `Kaydı Oluşturan`
- `publicDisplayName`
- `kamusal_ad`
- `first_name`, `last_name`

Opt-out fields:

- `public_credit = no`
- `credit_visible = false`
- `hide_name = yes`

Box fields:

- `Kutu`
- `Kutu No`

Material/category fields:

- `Fon`
- `Fon Adı`
- `Çalışma Alanı`
- `Devam Eden Çalışma`
- `Dijital Belge Kodu`
- `Notlar`

Target/done fields:

- `Sayfa Sayısı`
- `Sayfa`
- `Dosya Sayısı`
- `Belge Sayısı`

## Volunteer Display

The public payload shows real names unless the value is unsafe or an explicit opt-out is present. Unsafe values include emails, UUIDs, long hex strings, opaque database IDs, Apps Script/Firebase/Google tokens, and values with too little human-readable name structure.

Rows without usable names are counted in totals, hidden from normal public recognition lists, and surfaced only in `?debug=1` diagnostics.
