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
