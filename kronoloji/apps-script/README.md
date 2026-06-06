# Kronoloji XLSX Mirror Sync

Use this when editors continue working in the current Google Drive `.xlsx`
file, but the public website needs a native Google Sheets source.

## What This Does

```text
Current Drive .xlsx file
  -> scheduled mirror refresh
  -> stable native Google Sheet mirror
  -> public-safe JSON endpoint
  -> tarihvakfi.github.io/kronoloji/
```

The public site never reads the raw `.xlsx` directly.
The endpoint also adds standardized `Faaliyet Kodları` fields to every public
chronology record while preserving the original source category.
Site headings, captions, footer notes, and similar public copy can be edited in
the mirrored workbook through a `Site Metinleri` sheet.

## One-Time Setup

### 1. Keep the current `.xlsx` as the editor master

Editors keep using their existing Drive file and link.

Also keep the `Faaliyet Kodları` tab in this `.xlsx`, because the mirror will
copy whatever is in the editor master.

Add a `Site Metinleri` tab in this `.xlsx` with these columns:

```text
key | value | note
```

The site reads `key` from column A and `value` from column B. Column C is only
for editor notes. The checked-in fallback file
`kronoloji/assets/data/site_content.json` lists the supported keys.

`refreshMirror` copies this tab into the mirror with the same A/B/C structure.
If the `.xlsx` does not include `Site Metinleri`, the existing mirror tab is
preserved instead.

### 2. Create a blank mirror Google Sheet

Create a new Google Sheet named:

```text
TV KRONOLOJI - SITE MIRROR
```

This mirror is technical. Do not edit it manually; the sync will overwrite its
tabs.

Copy the mirror Sheet ID from:

```text
https://docs.google.com/spreadsheets/d/MIRROR_SHEET_ID/edit
```

### 3. Create Apps Script project

In Google Drive, create a new Apps Script project, then add these files:

- `XlsxMirrorSync.gs`
- `ChronologyPublicApi.gs`
- `appsscript.json`

Set these constants:

```js
const SOURCE_XLSX_FILE_ID = "CURRENT_XLSX_FILE_ID";
const MIRROR_SPREADSHEET_ID = "MIRROR_SHEET_ID";
const SOURCE_SPREADSHEET_ID = "MIRROR_SHEET_ID";
```

The current `.xlsx` ID is the part after `/d/` in the Office-mode URL.

### 4. Enable the Advanced Drive API

In Apps Script:

1. Open **Services**.
2. Add **Drive API**.
3. Use identifier `Drive`.

The included `appsscript.json` also records this dependency.

### 5. Run the first mirror refresh

Run:

```js
refreshMirror
```

Authorize the script. Then open the mirror Sheet and confirm it has the same
tabs as the `.xlsx`.

### 6. Install hourly refresh

Run:

```js
installHourlyMirrorRefresh
```

From now on, the mirror refreshes about once per hour.

### 7. Deploy public JSON endpoint

Deploy the Apps Script as a Web App:

- Execute as: **Me**
- Who has access: **Anyone**

Open:

```text
WEB_APP_URL?health=1
```

Expected:

```json
{"ok":true,"generatedAt":"..."}
```

Open:

```text
WEB_APP_URL
```

Expected shape:

```json
{
  "generatedAt": "...",
  "recordCount": 2020,
  "records": []
}
```

### 8. Connect `/kronoloji/`

Paste the Web App URL into:

```text
kronoloji/assets/js/config.js
```

```js
window.TVK_CHRONOLOGY_CONFIG = {
  liveDataUrl: "WEB_APP_URL",
  preferLiveData: true,
};
```

Commit and push the repo.

## Everyday Editing

Editors keep editing the current `.xlsx`.

The mirror updates hourly. The website updates when the visitor reloads the
page after the mirror has refreshed.

For urgent updates, run `refreshMirror` manually in Apps Script.

## Rules

- Edit chronology data only in the `.xlsx` master.
- Edit `Site Metinleri` in the `.xlsx` master when that tab exists there.
- Do not publish the raw `.xlsx`.
- Do not expose internal comments, private notes, or editor metadata.
- The website receives only sanitized fields from `ChronologyPublicApi.gs`.
