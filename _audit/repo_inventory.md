# Repo Inventory

Generated before cleanup during the public Sayım Defteri refactor.

## Current Top-Level Tree

See `_audit/output/repo_tree_before.txt` for the captured tree before cleanup. At the time of inspection, the repository contained:

```text
.
├─ .claude/
├─ .github/workflows/deploy.yml
├─ 404.html
├─ AGENTS.md
├─ README.md
├─ _audit/
├─ _demos/
├─ apps-script/
├─ assets/
├─ css/
├─ docs/
├─ index.html
├─ js/
└─ tools/
```

## Files Used By The Public Homepage

- `index.html`
- `404.html`
- `assets/favicon.svg`
- `css/site.css`
- `js/config.public.js`
- `js/snapshot.js`
- `js/utils.js`
- `js/volunteer-credit.js`
- `js/aggregate.js`
- `js/render-dashboard.js`
- `js/data-loader.js`

## Files Referenced By `index.html`

- External fonts from Google Fonts.
- `assets/favicon.svg`
- `css/site.css`
- `js/config.public.js`
- `js/snapshot.js`
- `js/utils.js`
- `js/volunteer-credit.js`
- `js/aggregate.js`
- `js/render-dashboard.js`
- `js/data-loader.js`

## Files Referenced By JS/CSS

- `js/data-loader.js` reads `window.TVF_PUBLIC_DATA`, `window.__SNAPSHOT__`, and `window.__SHEETSYNC_URL__`.
- `js/render-dashboard.js` consumes `window.TVFUtils` and `window.TVFVolunteerCredit`.
- `js/aggregate.js` consumes `window.TVFUtils`.
- `css/site.css` has no local `url(...)` asset references.

## Required For GitHub Pages Deployment

- `.github/workflows/deploy.yml`
- `index.html`
- `404.html`
- `assets/`
- `css/`
- `js/`
- `README.md` and `docs/` for maintainers.

## Required For Apps Script Sync

- `apps-script/SheetSync.gs`
- `apps-script/appsscript.json`
- `apps-script/README.md`

`SheetSync.gs` is now a public-dashboard-only endpoint. The public site consumes only the `?public=1` payload:

```js
{
  publicSummary,
  latestActivity,
  generatedAt,
  content
}
```

## Legacy Firebase/Auth/App/Admin Material

No `auth/`, `app/`, `admin/`, or `firebase/` directories existed in the working tree. Legacy architecture descriptions remained in:

- `AGENTS.md`
- `docs/SETUP.md`
- `docs/DEPLOYMENT.md`
- `docs/APPS_SCRIPT_SETUP.md`
- `docs/PNB_IMPORT.md`
- `apps-script/SHEET_SYNC_README.md`
- portions of the old `README.md`

These are not needed for the public dashboard repo and should be removed or replaced with public-dashboard documentation.

## Apparent Unused Files

- `_demos/*.html`
- `.claude/settings.local.json`
- `css/main.css`
- `AGENTS.md`
- `_audit/public_dashboard_audit.md`
- old Firebase/setup docs listed above

## Files That Should Never Be Public

- `_audit/input/`
- Excel or XLS exports (`*.xlsx`, `*.xls`)
- `.env`, `.env.*`
- `secrets.*`
- `credentials.*`
- `service-account*.json`
- `token*.json`
- raw Google Sheet exports
- emails, private volunteer IDs, private notes, raw row IDs, or credentials

## Recommended Clean Target Tree

```text
.
├─ index.html
├─ 404.html
├─ README.md
├─ .gitignore
├─ .github/workflows/deploy.yml
├─ assets/
│  ├─ img/
│  └─ icons/
├─ css/site.css
├─ js/
│  ├─ config.public.js
│  ├─ snapshot.js
│  ├─ data-loader.js
│  ├─ aggregate.js
│  ├─ volunteer-credit.js
│  ├─ render-dashboard.js
│  └─ utils.js
├─ apps-script/
│  ├─ SheetSync.gs
│  ├─ appsscript.json
│  └─ README.md
├─ tools/
│  ├─ audit_public_dashboard.py
│  ├─ validate_public_summary.py
│  └─ requirements.txt
├─ docs/
│  ├─ PUBLIC_DASHBOARD.md
│  ├─ DATA_SCHEMA.md
│  ├─ DEPLOYMENT.md
│  └─ CLEANUP_PLAN.md
└─ _audit/
   ├─ README.md
   └─ output/
```
