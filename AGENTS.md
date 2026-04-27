# AGENTS.md

## Project
This repository hosts a fully free volunteer tracking system for a foundation website deployed on GitHub Pages.

Primary domain:
- https://tarihvakfi.github.io

## Product goal
Build a production-ready, fully static frontend on GitHub Pages, backed by:
- Firebase Authentication (Google sign-in only)
- Cloud Firestore
- Google Apps Script + Google Sheets for email summaries and lightweight automation

## Hard constraints
- Keep the system free to operate for now
- Do NOT use paid-only architecture
- Do NOT use Firebase Cloud Functions
- Do NOT use Firebase Storage
- Do NOT use any private backend server or VPS
- Do NOT introduce Node/Express backend for production runtime
- Frontend must run as static files on GitHub Pages
- Prefer vanilla HTML/CSS/JavaScript unless there is a strong reason otherwise
- Keep dependencies minimal
- Keep setup simple enough for a non-expert maintainer

## Auth and roles
Authentication:
- Google sign-in only

User states:
- pending
- approved
- blocked

Roles:
- volunteer
- coordinator
- admin

## Required app areas
- /auth/   -> sign in / application / waiting approval page
- /app/    -> volunteer dashboard
- /admin/  -> coordinator/admin dashboard

## Volunteer interaction model — report-first
The primary action on the volunteer dashboard is **Rapor Ver**. Volunteers do not pull work from a queue; they log what they did and the system infers the unit's status from the latest report.

Flow:
1. The volunteer presses the large **Rapor Ver** primary CTA on `app/index.html` → `#tab-home`.
2. `#reportModal` opens. Fields, in order: typeahead (archive unit) → ne yaptın? (note ≤ 500 chars) → effort (small/medium/large) → status (in_progress / review / done with `reportedSubstatus` capturing the UX nuance, plus a separated `blocked`) → optional `digitized` checkbox (only visible when `archiveUnits/{id}.digitized == false`) → optional URL.
3. Submit writes a `reports/{id}` doc, denormalizes `archiveUnits/{unitId}` (status + last-activity metadata), updates `users/{uid}.lastReportAt`, and appends an `activityLogs` entry of `type: "report_submitted"`.
4. The "liste dışı / yeni iş" path creates an `archiveUnits/{newId}` with `status == "pending_review"` and `createdByVolunteerId == auth.uid`, then chains the report to that new id.

Just below the CTA, **Son raporların** lists the current volunteer's last 3 reports as continuity from previous sessions. Each row opens the corresponding unit channel.

The kanban view has been moved into a dedicated **Pano** tab and is **read-only for everyone** (volunteers and coordinators). Drag-drop and the ⋮ status-change menu have been removed; status changes flow only through the volunteer's Rapor Ver modal or the existing admin Ayarla path. Pano shows five columns — `Başlanmadı`, `Devam ediyor`, `Gözden geçirme`, `Tamam`, `Takıldım` — plus a side panel of `pending_review` units submitted via "Liste dışı". Each card shows priority via a colored left border (red/yellow/grey), `sourceIdentifier`, a 60-char `contentDescription` excerpt, `suitableFor` pills, and a "Son rapor: X gün önce, {volunteerName}" footer derived from `lastActivityAt` + `lastReporterName`.

The legacy quick / detailed forms remain reachable from the modal footer's "daha fazla seçenek" link.

## Coordinator / admin Bugün view

The staff Bugün tab opens with two coordinator-focused panels rendered above the existing operations hero:

### Son raporlar feed (top panel)
- The 30 most recent `reports` docs across all volunteers, newest first, paged via `startAfter` with a "Daha fazla göster" button.
- Each row: volunteer display name + department, unit `sourceIdentifier` + `status` pill, 80-char note excerpt, time-ago, link icon if `report.url` is set, S/M/L effort badge.
- Clicking a row opens the unit drill modal with full report history.

### Dikkat panel (second panel)
Three collapsible subsections, each with a count in the header:

1. **Takılanlar** — `archiveUnits` where `status == "blocked"`, sorted by most recent `lastActivityAt` first. Shows the unit identifier, who flagged it (`lastReporterName`), how long ago, and the `lastReportNotePreview` (or `blockerNote`).
2. **Uzun süredir dokunulmamış** — `archiveUnits` where `lastActivityAt` is older than 60 days AND `status` is neither `done` nor `pending_review`. Sorted oldest first. Limited to 30 rows in the rendered list to keep the panel scannable.
3. **Sessiz gönüllüler** — `users` where `role == "volunteer"`, `status == "approved"`, `rhythm != "casual"`, and the latest `lastReportAt` is older than 21 days (or null). Each row has a "Hatırlatma gönder" button that opens a `mailto:` link pre-filled with the same warm Turkish nudge copy used by the inactivity panel — the coordinator personalizes and sends it from their own client. This panel supplements the Apps Script inactivity automation and lets coordinators see the list at a glance without waiting for the next email run.

These panels read entirely from the in-memory `archiveUnits` and `allUsers` caches that `reloadPnb()` and `loadAllUsers()` already maintain — no extra Firestore read costs beyond the staff `Son raporlar` paged feed.

## Pending review flow (admin Bakım)

Volunteers can create `archiveUnits` with `status == "pending_review"` via the "Liste dışı / yeni bir iş" path in the report modal. The Bakım tab now opens with a "Gözden geçirme bekleyen yeni işler" card listing every such doc, sorted newest first. Each row offers three actions:

- **Onayla ve ledger'a al** — opens a small modal that prompts for `priority` and a comma-separated `suitableFor` list, then `updateDoc` flips the unit to `status: "not_started"` with the supplied metadata. Logged as `pending_unit_approved` in `activityLogs`.
- **Var olan iş paketine birleştir** — opens a target picker, then for each `reports` doc with `archiveUnitId == pendingId` rewrites it to point at the chosen target (`archiveUnitId` + `unitId`), appends the pending unit's `sourceIdentifier` + `contentDescription` into the target's `notes`, and deletes the pending doc. Logged as `pending_unit_merged`.
- **Sil** — confirm, then `deleteDoc`. Logged as `pending_unit_deleted`.

All three writes flow through admin paths only (rules unchanged from Prompt C — admins can update/delete archiveUnits; coordinators cannot).

### Physical-archive access (`users.canWorkInPerson`)

The Rapor Ver typeahead filters which units a volunteer sees by default:

- `digitized == true` units are visible to everyone.
- `digitized == false` (physical) units are visible only when `users.{uid}.canWorkInPerson == true`.
- A "Tüm iş paketlerini göster" toggle below the search input bypasses the filter so a remote volunteer can preview the physical pipeline.
- A friendly empty-state message tells remote volunteers that nothing is digitized yet when both the catalog is empty and the toggle is off.

`canWorkInPerson` is admin-write-only — volunteers cannot self-edit it (not in `userSelfEditableFields()`) and coordinators are blocked by the `affectedKeys().hasAny([...])` guard alongside `specialty` / `availabilityDays`. The admin user editor in Yönetim → Ekip listesi exposes a checkbox; coordinators see a read-only badge. There is no backfill — Gülistan or another coordinator flips the ~5–10 in-person volunteers manually after launch.

#### Why we removed the city-based filter

An earlier version of the typeahead used `users.city == "ankara"` as a proxy for "remote" and limited those volunteers to digitized units. This was wrong: most İstanbul-based volunteers also work remotely, so anyone with `city == "istanbul"` was getting physical units they couldn't actually pick up. The fix is `canWorkInPerson` (a direct boolean about physical access), not a guess derived from city. `users.city` stays on the document as display-only context for coordinators (still useful for travel logistics, slot planning, etc.) but is not consulted by any filter.

### Self-claim is deprecated but retained
Self-claim Firestore rules (`selfClaimArchiveUnit`, `selfReleaseArchiveUnit`) and the `handleSelfClaim` / `handleSelfRelease` JS helpers are intentionally left in place. The volunteer dashboard no longer surfaces them: `renderHomeQueueCta` and the `[data-self-claim]` / `[data-self-release]` click delegation are gated behind `window.FEATURE_FLAGS.selfClaim`, initialized to `false` in `app/index.html`.

**Why kept**: report-first might turn out to encourage too much duplicate work (two volunteers picking the same kutu without realizing it). The retained queue is the cheapest way to A/B-test a fix — flip the flag, the banner reappears.

**How to revive**: edit `app/index.html` and either change the default to `selfClaim: true` or set the flag at runtime (`window.FEATURE_FLAGS = { selfClaim: true }`) before `dashboard.js` loads. No JS or rules edits needed.

**What stays compiled-in**:
- Firestore rules: `selfClaimArchiveUnit()`, `selfReleaseArchiveUnit()` in `firebase/firestore.rules`.
- JS: `handleSelfClaim`, `handleSelfRelease`, `pickNextQueueUnit`, the legacy banner render inside `renderHomeQueueCta`.
- HTML: the `#svSelfClaim` placeholder element in `app/index.html`.

**What was retired**: nothing was deleted. There is no remaining production write that depends on a self-claim ever happening — the report-first flow is fully self-contained.

## Data model
Use Firestore collections:
- users
- tasks
- reports
- archiveUnits
- announcements
- activityLogs

### `reports` — fields used by the report-first flow
Both new and legacy fields are written so existing list/feed renderers and Firestore rules continue to work:

| Field | Notes |
| --- | --- |
| `unitId` | new — points to `archiveUnits/{id}` |
| `unitSnapshot` | new — `{ sourceIdentifier, contentDescription }`, denormalized so the report stays readable if the unit is renamed/deleted |
| `note` | new — free-text note, ≤ 500 chars |
| `effort` | new — `small | medium | large` |
| `status` | new — derived from the volunteer's button choice (`in_progress | review | done | blocked`) |
| `reportedSubstatus` | new — UX nuance: `started | ongoing | review | done | blocked` |
| `url` | new — optional link, or `null` |
| `volunteerId`, `volunteerName` | new — owner identity |
| `projectId` | unchanged |
| `userUid`, `userEmail`, `archiveUnitId`, `taskId`, `summary`, `workStatus`, `source = "report_first"` | legacy fields, kept for backwards compatibility with quick/detailed flows and the existing rules path |
| `createdAt`, `updatedAt` | server timestamps |

### `archiveUnits` — fields written by the report-first flow
Volunteers can only update the keys whitelisted by `reportFirstUnitUpdate()` in `firestore.rules`:

- `status` — set from the volunteer's status button.
- `lastActivityAt` — server timestamp on every report.
- `lastReporterId`, `lastReporterName` — denormalized so admin lists don't need a join.
- `lastReportNotePreview` — first 80 chars of the volunteer's note.
- `digitized` — opt-in boolean; flipped to `true` when the volunteer ticks the (conditional) digitized checkbox. Ankara typeahead filters on this.
- `latestReportAt` — kept synchronized for backwards compatibility with the kanban / lanes / sparkline rendering paths.
- `updatedAt`.

### `archiveUnits` — fields populated by import / used for typeahead matching
- `sourceIdentifier`, `priority`, `suitableFor`, `city`, `contentDescription`, `materialType`, `pageCount`, `documentCount`, `folderCount`, `projectId` — populated by the PNB importer; consumed by the report modal's typeahead and pill rendering.
- `createdByVolunteerId` — set when a volunteer submits a "liste dışı" pending unit; lets coordinators triage them.

### Volunteer profile fields on `users`
The following optional fields are populated from PNB import data and used for matching volunteers to archive units. All are additive — existing non-null values are never overwritten by automated imports. See `docs/FIRESTORE_SCHEMA.md` for the full list.

- `specialty`: string[] — codes drawn from a fixed list (`dijitallestirme`, `osmanlica`, `teknik_destek`, `web_altyapi`, `gonullu_koordinasyonu`, `arsivcilik`, `dokumantasyon_sistemi`, `gorsel_isitsel_envanter`, `mimari_projeler_envanteri`, `dijital_envanter`, `gecmis_envanter_ayiklama`).
- `availabilityDays`: string[] — half-day slot codes `mon-am` … `fri-pm`.
- `profession`, `university`, `projectExpectation`: string — free text from the paydaş workbook.
- `city`: string — restricted to `istanbul` or `ankara`. Other values are flagged for review, not written.

Read access: a user reads their own fields; coordinators and admins read everyone's (cross-department, since specialty matching spans departments). Write access for `specialty` and `availabilityDays` is admin-only — volunteers request changes through a coordinator.

## Security
- Enforce authorization with Firestore security rules
- Never rely on hidden buttons alone
- Volunteers can only read/write their own allowed records
- Coordinators can manage users/tasks/reports only for their department
- Admins can manage everything
- Pending users must not access volunteer/admin data

## Email automation
Use Google Apps Script + Google Sheets for:
- new application notification
- approval email
- task assignment email
- weekly summary email
- inactivity reminder email

## Code quality
- Keep files small and readable
- Add clear comments only where necessary
- Avoid dead code
- Avoid unnecessary abstractions
- Prefer maintainable folder structure
- Add defensive error handling and user-facing messages

## Deliverables
Always keep these files updated:
- README.md
- docs/SETUP.md
- docs/FIRESTORE_SCHEMA.md
- docs/SECURITY_RULES.md
- docs/APPS_SCRIPT_SETUP.md
- docs/DEPLOYMENT.md

## Workflow
When implementing:
1. Inspect repository structure first
2. Propose or create a clean folder structure
3. Implement incrementally
4. Validate links and paths for GitHub Pages
5. Add placeholder config instructions where secrets are needed
6. Add deployment instructions
7. Summarize what remains for manual console setup

## Manual setup assumptions
Assume the maintainer will manually:
- create the Firebase project
- enable Google provider
- add authorized domains
- paste Firebase config
- deploy Apps Script
- create triggers
- connect Google Sheets

## Important
Do not hardcode secrets.
Use clear placeholders for environment-specific values.
Prefer solutions that can be understood and maintained by a small nonprofit team.
