# Sheet Sync — runbook

Live one-way sync from a shared Google Sheet ("Tarih Vakfı Gönüllü Ağı") into Firestore. Implemented in `apps-script/SheetSync.gs` and triggered every 15 minutes by the time trigger registered in `apps-script/Triggers.gs::createTriggers`.

## Design principles

1. **One-way.** Sheet → Firestore only. Nothing in this code path writes back to the sheet.
2. **Additive.** Rows that disappear from the sheet are NOT deleted from Firestore. The mirror doc stays in place; the historical state of every row that ever existed is preserved.
3. **Schema-tolerant.** Renamed/missing/extra columns produce a "degraded" sync log + alert email, never a crash.
4. **Structure-change detection.** Each run captures `{ tabs: [{ name, headers, rowCount }, ...] }` and diffs against the last accepted baseline. Drift triggers a single email per 24 h via the per-subject cooldown.
5. **Sharing-loss detection.** Three consecutive permission failures (≈45 minutes at the 15-minute cadence) pause sync and email the admin.

## Setup — manual steps

The owner of the shared sheet is a foundation colleague, not the user running this project. Doing these in order matters.

### 1. Have a brief conversation with the sheet owner

Send something like this in DM (Turkish, since the foundation works in Turkish):

> Merhaba **[name]**, gönüllü web sitesi için **[sheet name]** sayfasını otomatik olarak okuyacak bir sistem kurdum. Apps Script servis hesabı email'i Viewer olarak ekleneceğinden bilgin olsun. Sayfanın sekmelerini veya sütun yapısını değiştirirseniz lütfen bana haber verin — değişiklik otomatik olarak algılanır ama düzeltmem gerekir.

Wait for verbal/written acknowledgment before continuing. The owner does not get any system-generated mail — only the admin (`SYNC_ALERT_EMAIL`) does.

### 2. Add the service account as Viewer

Open the JSON stored in `FIREBASE_SERVICE_ACCOUNT` and copy its `client_email` (e.g. `firebase-adminsdk-xxxxx@<project>.iam.gserviceaccount.com`). In the sheet, click **Share → Add people**, paste that email, set role to **Viewer**, untick "notify by email", click **Send**.

Service-account scope used for sheet reads: `https://www.googleapis.com/auth/spreadsheets.readonly`. The same JWT flow that already powers `FirestoreClient.gs` is reused; `FirestoreClient.gs::getAccessToken_(scopeOverride)` issues a sheets-scoped token on demand.

### 3. Set Script Properties

In the Apps Script editor: **Project Settings → Script properties → Add property**.

| Key                       | Value                                                  |
| ------------------------- | ------------------------------------------------------ |
| `TARIH_VAKFI_SHEET_ID`    | The sheet ID from its URL (between `/d/` and `/edit`)  |
| `SYNC_ALERT_EMAIL`        | Admin email that receives structure / access alerts    |
| `FIREBASE_SERVICE_ACCOUNT`| Already set — no change needed                         |

### 4. First test run

From the Apps Script editor, **Run → sheetSyncRun**. The first run:

- Reads spreadsheet metadata (one HTTP call) — verifies access.
- Captures the structure snapshot and writes it to `config/sheetSync.lastGoodStructure` as the baseline.
- Walks every tab, reads all rows, writes any new/changed rows to `sheets/{tabSlug}/rows/{rowId}`.
- Writes a `syncLogs` entry with `status: "baseline_set"` (first run) or `status: "ok"` (subsequent runs).
- Does **not** send a structure-change email on the first run, because the baseline didn't exist before.

Verify in Firestore:
- `sheets/gunluk_akis` — exists with `headers`, `name`, `rowCount`, `lastSyncAt`.
- `sheets/gunluk_akis/rows/row2` — first data row of the Günlük Akış tab.
- `config/sheetSync` — has `lastGoodStructure`, `enabled: true`, `consecutiveAccessFailures: 0`.
- `syncLogs/<auto>` — at least one entry with `status: "baseline_set"`.

### 5. Register the 15-minute trigger

In the Apps Script editor, **Run → createTriggers**. This wipes existing triggers and recreates the canonical set, including a 15-minute `sheetSyncRun` trigger. The Triggers screen (clock icon) should show four time-based triggers afterwards: `processMailQueue`, `checkInactiveVolunteers`, `generateWeeklySummary`, `sheetSyncRun`.

## Shared-sheet ownership: special considerations

The sheet owner controls the structure. They may rename tabs, move columns, add or remove tabs without telling anyone. The sync handles this defensively, but the admin still needs a runbook.

### What to do when structure changes

1. The sync run that caught the change writes a `syncLogs` entry with `status: "structure_changed"` and emails `SYNC_ALERT_EMAIL` with subject `[Tarih Vakfı] Sheet structure changed`.
2. Subsequent runs continue to mirror data using the new structure (best-effort) but stay flagged as `degraded`. Renamed columns will land under their new field-name keys; downstream readers may need to be updated.
3. Open the Bakım panel → "Sheet senkronizasyonu" card. The yellow indicator + the alert block at the top describes what changed.
4. Confirm with the sheet owner that the change was intentional. If it was a mistake, ask them to revert and the next sync will detect that as another change (back to the original).
5. Once verified, click **Yapıyı yeniden kabul et**. The button copies the function name `sheetSyncAcceptCurrentStructure` to your clipboard and shows a toast — paste it into the Apps Script editor's function picker and click **Run**. The function:
   - Captures the current structure as the new baseline.
   - Clears the alert cooldown so the next genuine drift can re-alert immediately.
   - Resets `consecutiveAccessFailures` to 0.
   - Re-enables sync if it had been paused.
   - Runs `sheetSyncRun()` once so the mirror picks up any data shifted by the restructure.

### What to do when sharing is lost

1. After three consecutive failed reads (~45 minutes at 15-min cadence), `sheetSyncRun` writes `status: "paused"` and emails subject `[Tarih Vakfı] Sheet access lost — sync stopped`.
2. The Bakım panel shows a red dot and an "access" alert block.
3. Verify with the sheet owner. Most likely reasons:
   - They removed the share intentionally — coordinate a fix.
   - They moved the sheet into a Drive the service account can't reach — ask for the new share, or re-share the moved file with the service account.
   - The sheet was deleted — restore from version history if possible.
4. Re-add the service account email as Viewer.
5. Click **Senkronizasyonu yeniden başlat** in the Bakım panel. Same clipboard-copy / paste-and-run mechanism as above; runs `sheetSyncResume()` which flips `enabled` back to `true` and zeroes the failure counter. The next 15-minute trigger picks up normal sync.

### Conversation script for the sheet owner

(Same as section 1 above — kept here for copy-paste convenience.)

> Merhaba **[name]**, gönüllü web sitesi için **[sheet name]** sayfasını otomatik olarak okuyacak bir sistem kurdum. Apps Script servis hesabı email'i Viewer olarak eklendi. Sayfanın sekmelerini veya sütun yapısını değiştirirseniz lütfen bana haber verin — değişiklik otomatik olarak algılanır ama düzeltmem gerekir.

The sheet owner is **never** notified by the system — only the admin (`SYNC_ALERT_EMAIL`) gets alerts. Communication with the owner stays human-to-human.

## Firestore data model

```
config/
  sheetSync                                 ← single config doc
    enabled                  : boolean
    lastGoodStructure        : { tabs: [{ name, headers[], rowCount }] }
    lastSyncAt               : ISO timestamp string
    lastSyncStatus           : "ok" | "degraded" | "structure_changed"
                                | "access_denied" | "paused" | "skipped"
    lastSyncSummary          : { durationMs, tabs[], totalWritten,
                                  totalSkipped, structureChanges[] }
    consecutiveAccessFailures: integer
    alertCooldown            : { [subject]: ISO timestamp string }
    updatedAt                : server timestamp

syncLogs/                                   ← append-only run log
  {logId}
    status     : "ok" | "degraded" | "baseline_set" | "structure_changed"
                  | "access_denied" | "paused" | "tab_error" | "skipped"
                  | "alert_email_failed" | "baseline_accepted" | "resumed"
    details    : { ... }                    ← shape depends on status
    createdAt  : server timestamp

sheets/
  {tabSlug}                                 ← one parent doc per source tab
    name      : "PNB 14 Betül"               (original tab title)
    headers   : ["Fon Adı", "Kutu No", ...]
    rowCount  : 6                            (data rows, not including header)
    lastSyncAt: server timestamp
    rows/
      row{N}                                ← one doc per data row
        {camelCaseFromHeader} : <cell value>
        ...
        _sourceTab    : "PNB 14 Betül"
        _sourceRow    : 2                    (1-based, matches sheet UI)
        _sourceHeaders: ["Fon Adı", ...]    (header row at sync time)
        _contentHash  : sha1(headers+row)    (skip-write key)
        _syncedAt     : server timestamp
        _history      : [<prior shapes>]    (capped at 10 entries)
```

### Key naming

- **Tab slug:** ASCII-folded, lowercased, non-alphanumerics → underscore. `"PNB 14 Betül"` → `pnb_14_betul`. `"Günlük Akış"` → `gunluk_akis`. Tabs that differ only in Turkish casing collapse to the same slug — flagged as a structural error (would manifest as duplicate writes; cap on writes per tab is the safety net).
- **Field key from header:** ASCII-folded camelCase. `"Çalışma Alanı"` → `calismaAlani`. Empty header columns get `column1`, `column2`, … as a fallback. Duplicate camelCased headers within a single tab get suffixed (`_2`, `_3`) and produce a warning.

### Why row content hash + per-row history (instead of pure append)

The natural "additive only" implementation would be: every sync writes a new doc per non-empty row, never updates anything. That's clean but it inflates Firestore by ~400 docs every 15 minutes — most of which are duplicates of unchanged rows.

The current design:
- Doc id = `row{N}` (the sheet's 1-based row index).
- A SHA-1 hash of the row content is stored on the doc. If the next sync sees the same hash for the same row, it's a no-op — no Firestore write at all.
- If the hash changes (cell edited), the prior doc body is pushed onto a `_history` array (capped at 10 entries) and the doc is overwritten with the new content. Past states are preserved without storage growing unboundedly.
- Sheet rows that disappear leave the Firestore doc in place. A `_seen` field could be added later if surfaces need to distinguish "currently in sheet" vs. "was in sheet, now gone".

## Test plan

Run after any change to `SheetSync.gs`, `Triggers.gs`, or `firestore.rules`.

### Scenario 1 — normal sync (happy path)

**Setup:** Service account is Viewer on the sheet, structure matches `lastGoodStructure`.

1. From the editor, run `sheetSyncRun()`.
2. Verify in Firestore:
   - `config/sheetSync.lastSyncStatus == "ok"`.
   - `config/sheetSync.lastSyncSummary.totalWritten` is `0` if nothing changed, or the number of edited rows.
   - A new `syncLogs/<auto>` entry with `status: "ok"`.
   - `sheets/{slug}/rows/row{N}` docs match the sheet contents.
3. Edit a single cell in the sheet, save it, run `sheetSyncRun()` again.
4. Verify the matching `sheets/{slug}/rows/row{N}` was updated, with the prior shape pushed onto `_history`.

### Scenario 2 — structure change

**Setup:** Add or rename a column in any tab, or rename a tab.

1. Run `sheetSyncRun()`.
2. Verify:
   - `config/sheetSync.lastSyncStatus == "degraded"`.
   - `config/sheetSync.lastSyncSummary.structureChanges` is a non-empty array of human-readable strings.
   - `syncLogs/<auto>` has an entry with `status: "structure_changed"` and the same change list under `details.changes`.
   - An email arrived at `SYNC_ALERT_EMAIL` with subject `[Tarih Vakfı] Sheet structure changed`.
   - The Bakım panel "Sheet senkronizasyonu" card shows yellow dot + the alert block.
3. Open Bakım, click **Yapıyı yeniden kabul et**. Run `sheetSyncAcceptCurrentStructure()` from the editor (the button copies the function name to clipboard).
4. Verify:
   - `config/sheetSync.lastGoodStructure` now matches the current structure.
   - `config/sheetSync.alertCooldown` is empty.
   - A `syncLogs/<auto>` entry with `status: "baseline_accepted"`.
   - The next `sheetSyncRun()` returns `status: "ok"`.
5. Re-run `sheetSyncRun()` immediately. Verify it does NOT send another email (cooldown is irrelevant once the baseline is accepted, but this also tests that no spurious change is detected).

### Scenario 3 — access loss

**Setup:** Remove the service account from the sheet's share list.

1. Run `sheetSyncRun()`.
2. Verify:
   - `config/sheetSync.consecutiveAccessFailures == 1`.
   - `syncLogs/<auto>` entry with `status: "access_denied"`.
   - No email yet (threshold is 3).
3. Run again twice more.
4. Verify after the 3rd run:
   - `config/sheetSync.consecutiveAccessFailures == 3`.
   - `config/sheetSync.enabled == false`.
   - `syncLogs/<auto>` entry with `status: "paused"`.
   - Email arrived at `SYNC_ALERT_EMAIL` with subject `[Tarih Vakfı] Sheet access lost — sync stopped`.
   - The Bakım panel shows a red dot + the "access" alert block.
5. Re-add the service account as Viewer on the sheet.
6. Click **Senkronizasyonu yeniden başlat**. Run `sheetSyncResume()` from the editor.
7. Verify:
   - `config/sheetSync.enabled == true`.
   - `config/sheetSync.consecutiveAccessFailures == 0`.
   - The next `sheetSyncRun()` succeeds with `status: "ok"`.

### Scenario 4 — alert cooldown

**Setup:** Trigger the same alert (structure change) twice within 24 h.

1. Make a structure change, run `sheetSyncRun()`. Email is sent.
2. Without accepting the baseline, run `sheetSyncRun()` again.
3. Verify the second run still flags `degraded` and writes a `structure_changed` log entry, but does NOT send a second email (`alertCooldown[subject]` blocks it).

### Scenario 5 — empty / pre-padded tabs

**Setup:** A tab whose data rows are all blank (e.g. `PNB Arda` in the seed sheet has only the header row).

1. Run `sheetSyncRun()`.
2. Verify the tab parent doc `sheets/pnb_arda` exists with `rowCount: 0` but no `rows/row*` subdocs are written.
3. Add a fully-blank row to the tab, run again. Verify `skipped` count increments and no `rows/row{N}` doc is created for that blank row.

### Scenario 6 — admin baseline-reset

Useful when the structure was changed legitimately and the admin wants to take the new shape without first triggering a degraded run.

1. From the editor, run `sheetSyncAcceptCurrentStructure()` directly.
2. Verify it captures the current snapshot, runs a normal sync, and lands `status: "ok"`.
