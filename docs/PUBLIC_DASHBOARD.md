# Tarih Vakfı Gönüllü Emek Günlüğü

## Sections

1. Brand masthead: Tarih Vakfı logo, Gönüllü Emek Günlüğü title, last sync, selected period.
2. Hero: rolling-seven-day foundation volunteer-work headline and one-sentence contribution/page/activity summary.
3. KPI strip: contribution records, archive detail rows, activity records, visible contributors, active boxes, total progress.
4. Priority work context: short public explanation of PNB digitization as the current priority work item, while the page still covers other foundation volunteer work.
5. Gönüllü katkıları ve koordinasyon: credit-visible named contributors and coordinator roles.
6. Güncel dönem günlüğü: date-driven daily ledger with volunteer and coordination lines separated.
7. Aktif kutular: all-time progress, rolling-seven-day page/detail contribution, remaining pages, contributors, last activity, material.
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
  mode: "rolling_7_days",
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD",
  label: "Güncel dönem · 2–8 Haziran",
  isPartial: false
}
```

The public page uses a rolling selected period, avoiding calendar-week reset artifacts at midnight on Monday.

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
