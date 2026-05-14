# Public Dashboard

## Sections

- Masthead and hero: selected period and last sync.
- Truth strip: records, page/detail rows, activity rows, material count, active volunteers, active boxes.
- KPI row: total progress, pages done/target, inventory-known boxes, active boxes, completed boxes.
- Signals: record split, busiest day, material focus.
- Material distribution: full selected-period counts.
- Daily ledger: date-driven weekdays, records, page/detail, activity, volunteers and names, boxes.
- Gönüllü katkıları: credit-visible volunteer totals and box breakdowns.
- Active boxes: done/target/percent/remaining, contributors, last activity, material counts.
- Son 50 hareket: capped latest feed only.
- Debug diagnostics: visible on localhost or `?debug=1`.

## Aggregation Logic

All summaries use `publicSummary`. The latest feed is never used for totals.

`kayıt` means all public rows/events in the selected period.

`sayfa/detay` means PNB detail rows.

`faaliyet` means rows from `Günlük Akış`.

## Period Logic

The public page uses one `publicSummary.period` everywhere:

```js
{
  mode: "calendar_week_to_date",
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD",
  label: "11–17 Mayıs haftası · bugüne kadar",
  isPartial: true
}
```

Rolling 7 days is computed by the audit script for comparison but not mixed into the weekly page.

## Visual Principles

The site keeps an archival/newspaper tone: strong typography, restrained rules, quiet red accent, dense but readable operations data. Cards are used for repeated operational items; sections remain editorial and unframed.
