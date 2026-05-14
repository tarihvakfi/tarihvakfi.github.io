# Apps Script Public Sync

`SheetSync.gs` reads the shared Google Sheet and exposes a public `?public=1` JSON payload for the static dashboard.

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
    highlights,
    warnings
  },
  latestActivity: [],
  content: {}
}
```

`publicSummary` is the full aggregate. `latestActivity` is capped at 50 rows and is used only for the latest-feed section.

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
3. Ensure `appsscript.json` uses the listed readonly spreadsheet scope.
4. Deploy as Web App.
5. Execute as the foundation account.
6. Access: Anyone.
7. Copy the `/exec` URL into `js/config.public.js` and `.github/workflows/deploy.yml`.

## Refresh Schedule

GitHub Actions calls `?public=1` hourly and bakes the response into `js/snapshot.js`. The page also tries the live endpoint in the browser after rendering the snapshot.
