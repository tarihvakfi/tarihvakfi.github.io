# Apps Script Public Sync

`SheetSync.gs` reads the shared Google Sheet and exposes a public `?public=1&period=rolling_7_days` JSON payload for the static dashboard.

## Public Payload

```js
{
  publicSummary: {
    generatedAt,
    source,
    period,
    totals,
    byDay,
    byMaterial,
    byBox,
    byVolunteer,
    byTrack,
    highlights,
    warnings
  },
  trackSummary: {
    generatedAt,
    source,
    monthsActive,
    peopleCount,
    people,
    tracks: [
      { key, label, sessions, byMonth, peopleCount, people }
    ]
  },
  latestActivity: [],
  content: {}
}
```

`publicSummary` is the full aggregate. `latestActivity` is capped at 50 rows and is used only for the latest-feed section.
`byDay[].contributors[].workRows` carries a capped, public-safe per-person work detail for contextual hover cards.
`trackSummary` is computed directly from the full `Günlük Akış` sheet so the `Çalışma izleri` table does not infer work areas from volunteer totals.

The main page uses `rolling_7_days` so the visible dashboard does not reset to zero at the start of a calendar week.

## Volunteer Card Tab

Run `refreshVolunteerProfileTab()` manually in Apps Script to create or refresh the `Gönüllü Kartları` tab in the live archive workbook. Existing volunteer-entered fields are preserved; generated identity and contribution metrics are refreshed from the archive sheets.

When `Kart Yayında` is `Evet`, public-safe fields from that tab are emitted under `content.volunteerProfiles` and merged into the site’s volunteer cards.

## Privacy And Credit

The public display mode is **credit-visible, ID-safe volunteer display**:

- real names in `Paydaş` / `Kaydı Oluşuran` are shown;
- explicit public display names are honored;
- public roles in `role`, `görev`, `publicRole`, `displayRole`, `coordinator`, or `koordinatör` are shown with the credited person;
- explicit opt-out fields hide the name;
- emails, UUIDs, hashes, opaque IDs, and tokens are suppressed;
- rows without a usable name remain in totals, but do not create a public volunteer identity.

The endpoint must not emit emails, raw row IDs, private notes, URLs, scanner labels, private volunteer IDs, credentials, or raw spreadsheet rows.

## Deployment

1. Open the Apps Script project.
2. Paste/update `SheetSync.gs`.
3. Ensure `appsscript.json` uses the listed spreadsheet scope.
4. Deploy as Web App.
5. Execute as the foundation account.
6. Access: Anyone.
7. Copy the `/exec` URL into `js/config.public.js` and `.github/workflows/deploy.yml`.

## Refresh Schedule

GitHub Actions calls `?public=1&period=rolling_7_days` hourly and bakes the response into `js/snapshot.js`. The page also tries the live endpoint in the browser after rendering the snapshot.

## Digitization Transition Bridge

`DigitizationBridgeSync.gs` is the temporary bridge between the original working file and the new digitization/reporting workbook.

Purpose:

- volunteers keep working in **Tarih Vakfı Gönüllü Ağı** during the transition;
- the new workbook is rebuilt daily from that source;
- `/pilot/` reads the new workbook, so the public report follows the latest copied state;
- normalized tabs stay transferable for AtoM/Omeka/Baserow-style export work.

Daily generated target tabs:

- `01 Gönüllü Günlüğü`
- `02 Tarama Satır Girişi`
- `04 Web Özeti`
- `05 AtoM Aktarım`

The bridge also mirrors these operational tabs from the old workbook into the new workbook:

- `Günlük Akış`
- `PNB Sayısallaştırma`
- `Haftalık Plan`

The bridge does **not** overwrite `03 Kontrol ve Onay`. That tab remains available for coordinator review, correction, and approval records.

One-time setup:

1. Open the Google Apps Script project used by the foundation Google account.
2. Add/paste `DigitizationBridgeSync.gs`.
3. Run `runDigitizationBridgeSync` once and approve Google permissions.
4. Check the new workbook: `98 Senkron Günlüğü` should show `Tamamlandı`.
5. Run `installDigitizationBridgeDailyTrigger` once.

Daily behavior:

- The trigger runs once per day around 07:00 Türkiye time.
- Rows are rebuilt from the old workbook, so appended rows, edited rows, and deleted rows are all reflected.
- Volunteers should not edit the generated target tabs during the transition; their source of truth remains the old workbook until cutover.

Cutover:

When volunteers move to the new workbook, remove the trigger with `removeDigitizationBridgeDailyTrigger`. After that, the generated tabs can become the working tabs.
