# Cleanup Plan

## Removed

- `_demos/`: static visual experiments, not used by the live dashboard.
- `.claude/`: local assistant settings, not public dashboard source.
- `css/main.css`: legacy generic app/auth styling; `404.html` now uses `css/site.css`.
- `AGENTS.md`: legacy implementation notes for the retired volunteer-management app.
- `_audit/public_dashboard_audit.md`: replaced by `_audit/output/public_dashboard_audit.md`.
- `docs/APPS_SCRIPT_SETUP.md`, `docs/PNB_IMPORT.md`, `docs/SETUP.md`: Firebase/admin/import docs not needed for this public dashboard repo.
- `apps-script/SHEET_SYNC_README.md`: replaced by `apps-script/README.md`.

## Kept

- `index.html`, `404.html`
- `assets/`
- `css/site.css`
- `js/` public dashboard modules
- `.github/workflows/deploy.yml`
- `apps-script/SheetSync.gs`
- `tools/` audit and validation scripts
- `_audit/output/` generated audit outputs

## Archived

Nothing was archived into `_archive/`; the working tree already lacked the old `auth/`, `app/`, `admin/`, and `firebase/` directories. Clearly unused demos and legacy docs were deleted to keep the repo minimal.

## Rationale

The repository now serves one product: the static public Tarih Vakfı Gönüllü Emek Günlüğü dashboard. PNB digitization is represented as the current priority work item, not as the only foundation volunteer work. Historical Firebase/Firestore volunteer-management architecture is not required for GitHub Pages rendering, Excel audit, or Apps Script public payload generation.
