# Boratav Arşivi Gönüllü Emek Günlüğü

## Sections

1. Brand masthead: Tarih Vakfı logo, Gönüllü Emek Günlüğü title, last sync, selected period.
2. Hero: weekly archive-work headline and one-sentence contribution/page/activity summary.
3. KPI strip: contribution records, archive detail rows, activity records, visible contributors, active boxes, total progress.
4. Pertev Naili Boratav Arşivi context: short public explanation of the archive.
5. Gönüllü katkıları ve koordinasyon: credit-visible named contributors and coordinator roles.
6. Haftanın günlüğü: date-driven daily ledger with volunteer and coordination lines separated.
7. Aktif kutular: all-time progress, this-week page/detail contribution, remaining pages, contributors, last activity, material.
8. Malzeme dağılımı: full selected-period material counts.
9. Son hareketler: short grouped movement summaries.
10. Tarih Vakfı hakkında: concise institutional boilerplate and official source links.
11. Footer: website, address, public-data note, source links.

Debug diagnostics are hidden in normal public mode and appear only with `?debug=1`.

## Aggregation Logic

All summaries use `publicSummary`. The latest feed is never used for totals.

`katkı kaydı` means all public rows/events in the selected period.

`sayfa/detay` means PNB detail rows.

`faaliyet` means rows from `Günlük Akış`.

Rows without a usable public name remain in totals but do not create a public person card or latest-feed identity.

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

The site keeps an archival/newspaper tone with the Tarih Vakfı visual identity: serif headlines, thin rules, cream paper tones, burgundy accents from `assets/img/tarih-vakfi-logo.png`, and restrained operational density.

Core CSS identity variables:

```css
--tv-burgundy: #601040;
--tv-burgundy-dark: #3f0929;
--tv-burgundy-soft: #8a2a62;
--tv-cream: #fbf7f1;
--tv-paper: #fffdf8;
--tv-ink: #211a1d;
--tv-muted: #74686e;
--tv-line: #e8dbe2;
```
