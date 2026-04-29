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

## Dashboard tab structure (Prompt P — assignment surfaces removed, staff PNB tab dropped)

The dashboard collapses to **2–4 tabs by role**:

| Role         | Tabs (in order)                          | Default landing |
|--------------|------------------------------------------|-----------------|
| volunteer    | Anasayfa · PNB · Duyurular              | `#anasayfa`    |
| coordinator  | Bugün · Yönetim                          | `#bugun`       |
| admin        | Bugün · Yönetim · Bakım                  | `#bugun`       |

**Coordinator/admin no longer have a PNB tab.** The kanban view is no longer a primary management surface — staff read the report stream on Bugün to see what's happening. Volunteers still have PNB as their project workspace. A coordinator who manually navigates to `/app/#pnb` is redirected to `#bugun` by `resolveTab()`.

**Assignment surfaces are removed across coordinator/admin views (Prompt P).** The data model still carries `assignedToUids` / `assignedToEmails` on `archiveUnits` and the rules' `selfClaimArchiveUnit` / `selfReleaseArchiveUnit` paths stay in `firestore.rules` as a hedge against future revival, but no UI displays them: removed in this prompt are the unit drill modal's "Atanan gönüllüler" panel and the in-edit assign select (kept hidden for the legacy save path), the channel-side stat row labelled "Atanan", the staff archive-card "Atanan: …" chip + assign select, the table-header "Atanan" column, the `Atanmamış arşiv birimi` warning text, and the side-effect in the task-create handler that used to write back into `archiveUnit.assignedToUids`. Tasks (the `tasks` collection) keep their own `assignedToUid` field and surface it as "→ {name}" inside the Yönetim feed — tasks are explicit one-off coordination items, not archive-unit assignments.

Old tabs `Pano`, `İşler`, and `Rapor Yaz` are **gone**:
- The Pano kanban moved under the PNB tab — both volunteer and coordinator now share `#tab-pnb`, with `#volunteerPnbView` and `#staffPnbView` blocks gated by `body.volunteer-shell` / `body.staff-shell`.
- "İşler" — the assigned-tasks-for-staff card (`#adminTaskForm` + `#tasksList`) moved into Yönetim → Görevler. The volunteer kanban view stays under PNB.
- "Rapor Yaz" — coordinators have **no tab** for this. They use the inline `+ Rapor yaz` icon button at the top right of the Bugün header which opens `#coordinatorReportModal`, a thin modal hosting a fresh `renderInlineRaporForm({ showProjectPicker: true })` instance.

Volunteers continue to see their **Anasayfa** (project-agnostic inline form + Son raporların log + Aktif projeler card). Coordinators land on **Bugün** (greeting + Dikkat single-card + Son raporlar 8-row log).

### Hash routing
Tab names are URL hashes. `sw(name)` writes the chosen tab to `location.hash` via `history.replaceState`; `syncRouteFromHash()` reads on load and on `hashchange`. `resolveTab(name)` enforces role gating — if a volunteer types `/app/#yonetim` or `#bakim`, they're redirected to their default `#anasayfa`. Coordinators on `#anasayfa` get bumped to `#bugun`. Aliases keep older anchor links working: `home` → `anasayfa` (or `bugun` for staff), `pano` → `pnb`, `reports` → `anasayfa` (or `bugun`), `announcements` → `duyurular`, `management` → `yonetim`, `maintenance` → `bakim`.

### Bugün (coordinator/admin home)
Three things live here, all in `renderBugun()`:

1. **Header** — greeting `Merhaba, {firstName}` + `Bugün {date}, {weekday} · Tarih Vakfı`. Top right: a `+ Rapor yaz` button that opens `#coordinatorReportModal` (an inline form for the rare case a coordinator wants to log a report for themself).
2. **Dikkat card** (`#dikkatCard`) — single card with one line per attention category. Lines hide entirely when the underlying count is zero. When everything is zero, a single `✓ Bugün dikkat edilecek bir şey yok.` line replaces the list. Items: pending volunteer applications, silent volunteers (≥21 days no report), blocked units, stale units (60+ days inactive, not done/pending_review), pending-review (Liste dışı queue) units. Each line has either an inline-expand action (showing a per-row sublist with action buttons like "Hatırlatma gönder") or a direct navigation action.
3. **Son raporlar card** (`#bugunRecentCard`) — coordinator-wide compact log, 8 rows max, click-to-expand for the full note + URL. Reuses the `.sv-log-row` primitives from the volunteer side, plus a `.bugun-recent-name` column for the volunteer's name. Refresh icon-button in the header re-pulls via `loadStaffRecentReports(true)`. "Tümünü göster →" link at the bottom (TODO: full reports history view).
4. **Future**: project-volunteer summary card — placeholder kept in the markup as a comment, hidden until a second project comes online.

### PNB tab — staff view
Coordinators / admins on `#tab-pnb` see `#staffPnbView`:
1. **İlerleme** — same dark progress card volunteers see, but with `staff*` IDs.
2. **İş Akışı** — read-only 5-column kanban (drag-drop is wired through the existing dragstart/drop handlers). Search input above the board (`#staffPnbBoardSearch`) Turkish-normalizes against `sourceIdentifier`, `seriesNo`, `boxNo`, `contentDescription`, etc.
3. **Bu projedeki gönüllüler** — list of every approved volunteer who has reported on a PNB unit (or a `project_general` PNB report) at least once in the last 90 days. Sortable by recent activity / name / report count. First 20 shown; "+N daha" hint for overflow.

### Yönetim — four sections, all stacked
1. **Onay bekleyen başvurular** — pending users. Card auto-hides when count == 0 so it doesn't take up empty space.
2. **Tüm gönüllüler** — searchable, filterable, sortable list. Filter pills: Hepsi · Aktif · Yavaşlayan · Sessiz. Search by name / email / department. Sort by name / last activity / reports / department. Each row is a `<details>` with a compact summary; clicking expands the existing `rur()` edit card so write semantics stay identical to the previous Yönetim → Ekip listesi panel. Includes a `+ Yeni gönüllü ekle` expander.
3. **Duyurular** — `+ Yeni duyuru yaz` button reveals the existing `#announcementForm`. Below: full announcements history (`#yonetimAnnouncementsList`).
4. **Görevler** — `+ Yeni görev ata` button reveals `#adminTaskForm`. Below: list of staff coordination tasks (`#tasksList`).

### Bakım — admin only, four sections
1. PNB import aracı (existing).
2. **User enrichment import** (TODO: full preview + commit flow). Accepts `tools/enrichment_preview_updates.json` and `tools/enrichment_preview_prereg.json`. The UI shell is in place; the commit handler is a TODO.
3. Pending review queue (existing — Liste dışı flow).
4. **Veri sağlığı** (TODO: per-collection doc counts, last-write timestamps).

(Earlier role-shell description from Prompt H follows below, kept as historical record of the volunteer-side simplification.)

### Anasayfa
Project-agnostic landing page. Renders the same regardless of which projects exist. From top to bottom:
1. Greeting (`Merhaba, {firstName}` + `Tarih Vakfı · {date}` subtitle).
2. **Rapor Yaz** card (`#anasayfaInlineRapor`) — the inline form is rendered directly into the page; there is no "open" button. Same six elements as the old modal (typeahead, note, status pills, link, submit). The typeahead is unfiltered (all projects the volunteer can access) and the "Tüm iş paketlerini göster" toggle is shown.
3. **Son raporların** — last 3 reports by the current volunteer.
4. **Aktif projeler** (`#vpProjectsList`) — one card per project the volunteer can access. Each card has the project name, a one-line description (read from `projects/{projectId}.shortDescription` if present, otherwise the registry default in `PROJECT_TAB_REGISTRY`), and a "Bu projeye git →" link that switches to that project's tab. New projects appear automatically as `volunteerProjectIds()` expands.

The legacy Bugün widgets (`.wa-prog`, `.sv-actions`, `.sv-work`, `.wa-cta`) were removed from the volunteer Anasayfa in Prompt J; the staff Bugün still uses its own blocks (`#homeHero`, `#kbBoard`, `#homeWorkGrid`, `#homeAnnouncements`).

### Project tab factory (PNB and beyond)
`renderVolunteerProjectTab(projectId)` is the single function that populates a project's tab. Today PNB is the only project; future projects need:

1. An entry in `PROJECT_TAB_REGISTRY` (name, fallback description).
2. An HTML block inside the corresponding `#tab-{tabId}` section with `vp-{projectId}-*` IDs (header, progress card, four stat tiles, an empty `<div id="{projectId}InlineRapor" class="card inline-rapor-card">` for the form, kanban columns).
3. `volunteerProjectIds()` returning that project id for the user.
4. A call to `ensureInlineRaporForm("{projectId}InlineRapor", { projectFilter: "{projectId}", showProjectToggle: false })` once the volunteer's profile loads (today this happens for `pnb` from `renderVolunteerReportPrimary()` — extend there).

Staff PNB content (`#pnbHero`, `#pnbStats`, `#pnbOpsGrid`, `#pnbArchivePanel`, `#adminTaskForm`, `#generalTaskPanel`) remains untouched and is only visible on `body.staff-shell`. The volunteer block (`#volunteerPnbView`) is only visible on `body.volunteer-shell`. Both blocks live in the same `#tab-pnb` section.

### Volunteer PNB tab content
1. Header: project name, italic Boratav line, one-line description.
2. Project progress dark card (the `wa-prog` clone, with `vpPnb*` IDs).
3. Four stat cards (`Sıradaki iş` / `Üstümdeki iş` / `Bu hafta` / `Aktif gönüllü`) — same data sources as the staff Bugün stats but written to the PNB-namespaced IDs.
4. **Rapor Yaz (bu proje için)** inline form (`#pnbInlineRapor`) — rendered directly into the page by `renderInlineRaporForm({ projectFilter: "pnb", showProjectToggle: false })`. The typeahead is locked to PNB and the "tüm iş paketlerini göster" toggle is omitted entirely.
5. Read-only 5-column kanban (`Başlanmadı / Devam ediyor / Gözden geçirme / Tamam / Takıldım`). No pending side panel — that stays admin-only on the staff Pano.

`loadArchiveUnits` was widened in Prompt H to load all project units for volunteers (not just assigned). The Rapor Yaz typeahead and the volunteer kanban both rely on the full project list. Firestore rules already permitted this read since Prompt C; no rule change needed.

## Rapor Yaz inline-form flow (Prompts J + K)

Report-first is an **inline** flow — no modal, no overlay, no backdrop. The same form is rendered into both the Anasayfa card (`#anasayfaInlineRapor`) and per-project tab cards (e.g. `#pnbInlineRapor`), already on screen and ready to type into.

### Three report shapes (Prompt K)
Every report falls into exactly one of these. The shape is computed at submit time from which fields are set, then stored on the report doc as `reportType`:

| `reportType`            | when                                  | side effects |
|-------------------------|---------------------------------------|--------------|
| `unit`                  | `unitId` set                          | updates `archiveUnits/{unitId}` (status + last-activity metadata), publishes a `publicTicker` entry with `materialCategory` derived from the unit's `seriesNo`, refreshes `publicProjectStats/{projectId}`, logs `report_submitted` |
| `project_general`       | `projectId` set, `unitId` null        | does NOT touch any archiveUnit, publishes a `publicTicker` entry with `materialCategory: "genel"`, does NOT refresh `publicProjectStats` (project totals are unit-driven), logs `project_general_report_submitted` |
| `foundation_general`    | both null                             | does NOT touch any archiveUnit, does NOT publish to `publicTicker` (the ticker is project-themed), logs `foundation_general_report_submitted` |

**Why these three.** Within a project, valid work doesn't always attach to a specific archive unit — meetings, reviews, coordination, volunteer onboarding, Drive folder cleanup, etc. The `project_general` shape captures that. And general foundation work (website, translation, foundation events) doesn't belong to any project at all — the `foundation_general` shape captures that, and is intentionally excluded from the public ticker since the ticker is project-themed.

`reportTypeOf(reportDoc)` derives the shape for legacy docs (pre-Prompt K) that don't have the field, falling back to `unit` if `archiveUnitId` is set, else `project_general` if `projectId` is set, else `foundation_general`.

### Shared component: `renderInlineRaporForm({ container, showProjectPicker, fixedProjectId, onSubmitSuccess })`
A single factory in `app/dashboard.js` builds every form instance — fixing a bug in one fixes them all. State is closure-private; DOM lookups are scoped via `container.querySelector` so two instances coexist without ID collisions. Each call returns a handle attached to the container as `container.__inlineRaporHandle` with `{ selectUnitById, reset, refreshResults }`. Use `ensureInlineRaporForm(containerId, opts)` for idempotent mounting (won't blow away in-progress input on rerender).

- `showProjectPicker: true` (Anasayfa) — render a row of pills, one per accessible project (today: just `Pertev Naili Boratav`) plus a `Genel vakıf çalışması` pill. The unit picker stays hidden until a real project pill is picked.
- `fixedProjectId: "pnb"` (PNB tab) — no project pills; the unit picker is shown immediately, filtered to that project. `state.projectPick` is fixed to the project id and reset to it on every form reset.

The drill modal's "Rapor Yaz (bu iş paketi için)" shortcut closes the drill, switches to the PNB tab, and calls `selectUnitById(unitId)` on that form. `selectUnitById` auto-selects the unit's project first (so the section is visible) then the unit itself.

### Field order
1. **Ne yaptın?** required textarea, 500-char counter. Submit button stays disabled until the note has ≥ 3 trimmed chars.
2. **Hangi proje için?** *(Anasayfa only, optional)* — row of project pills + a foundation pill. Pills toggle (tapping the active one clears the choice). No pill selected = same as foundation = `projectId: null`. Helper text below explains the blank state.
3. **Hangi iş paketi?** *(optional, only visible when a real project is in scope)* — same Turkish-normalized typeahead, same `canWorkInPerson` + `digitized` filter logic, same `Tüm iş paketlerini göster` toggle. Liste dışı still appears at the bottom of the dropdown when the term has zero matches; it requires a project context (otherwise the new unit has no parent project) and is blocked with a friendly error if invoked without one.
4. **Durum:** two pills — `Devam ediyor` (default) and `Tamamlandı`. Mapped to `status: "in_progress" | "done"`. Always rendered regardless of unit selection — for project_general / foundation_general reports the status is metadata on the report doc, not applied anywhere. Note: the `blocked` status is intentionally **not** a volunteer-side choice (Prompt L) — it's coordinator-only and reaches archiveUnits via admin tooling. Existing reports with `status: "blocked"` continue to render correctly throughout the app.
5. **Link (varsa):** optional URL input.
6. **Gönder** submit button.

The success/error banner sits between the heading and the form body. Green banner auto-clears after 3s; red banner stays until the next interaction.

### Validation
- Note required, ≥ 3 chars (submit button disabled below the threshold).
- Liste dışı path additionally requires a non-empty `Kaynak / Tanım` AND a project context (otherwise we don't know which project the new pending_review unit belongs to).
- No other field is required. Project pill optional (Anasayfa). Unit picker always optional, even when visible.

### Submit behavior
On success: form resets fully (note empties, status returns to `Devam ediyor`, search clears, link clears, project pill clears on Anasayfa, unit section re-hides on Anasayfa), green banner shows for 3s, `reloadPnb()` + `lr()` refresh in-memory caches so Son raporların and the kanban pick up the new report immediately. The success callback receives `{ unitId, reportId, reportType }`.

On failure: all field values are preserved, red banner shows the error, the volunteer can retry without retyping.

### Notice scoping
The "Şu an dijitalleştirilmiş iş paketi yok…" empty-state is rendered **only inside the typeahead dropdown** when (a) the dropdown is open, (b) the volunteer has no `canWorkInPerson` and the show-all toggle is off, and (c) the catalog has zero digitized non-done units. The dropdown auto-hides on input blur (180 ms grace for click events on dropdown items), so the notice never sits on the page outside the picker. The "Tüm iş paketlerini göster" toggle similarly lives inside the unit picker, not floating on the page.

### Display of the three shapes
In both the volunteer's "Son raporların" and the coordinator "Son raporlar" feed, each row gets a small colored type pill on the left:

| `reportType`         | row title                          | pill |
|----------------------|------------------------------------|------|
| `unit`               | unit identifier                    | `Kutu` (primary blue) |
| `project_general`    | `{ProjectName} (genel)`            | `Genel` (warm amber) |
| `foundation_general` | `Vakıf çalışması`                  | `Vakıf` (muted gray) |

Row clicks on unit reports open the drill; clicks on the other two shapes are no-ops today (no useful drill view exists for those).

### Earlier history (kept for context)
- Prompt J — replaced the `#reportModal` overlay with the inline card.
- Prompt H — removed the `Başladım` status (collapsed into Devam ediyor), the `Gözden geçirme için hazır` status (removed from the volunteer surface), and deprecated the `reportedSubstatus` field.

## Volunteer interaction model — report-first
The primary action on the volunteer dashboard is **Rapor Yaz**. Volunteers do not pull work from a queue; they log what they did and the system infers the unit's status from the latest report.

Flow:
1. The volunteer lands on `app/index.html` → `#tab-home`. The Rapor Yaz form is **already on screen** as an inline card; no button-press is needed to "open" it. The same form is also embedded in the PNB tab (`#tab-pnb`), pre-filtered to that project.
2. Fields, in order: typeahead (archive unit) → ne yaptın? (note ≤ 500 chars) → status (`in_progress` / `done` / `blocked`) → optional URL → submit. Effort is no longer a UI control; submissions write `effort: "medium"` silently for backwards compatibility.
3. Submit writes a `reports/{id}` doc, denormalizes `archiveUnits/{unitId}` (status + last-activity metadata), updates `users/{uid}.lastReportAt`, and appends an `activityLogs` entry of `type: "report_submitted"`.
4. The "liste dışı / yeni iş" path creates an `archiveUnits/{newId}` with `status == "pending_review"` and `createdByVolunteerId == auth.uid`, then chains the report to that new id. This option only appears in the typeahead dropdown when the volunteer typed something AND zero units matched.

Just below the inline form on Anasayfa, **Son raporların** lists the current volunteer's last 3 reports as continuity from previous sessions. Each row opens the corresponding unit channel.

The kanban view has been moved into a dedicated **Pano** tab and is **read-only for everyone** (volunteers and coordinators). Drag-drop and the ⋮ status-change menu have been removed; status changes flow only through the volunteer's Rapor Yaz form or the existing admin Ayarla path. Pano shows five columns — `Başlanmadı`, `Devam ediyor`, `Gözden geçirme`, `Tamam`, `Takıldım` — plus a side panel of `pending_review` units submitted via "Liste dışı". Each card shows priority via a colored left border (red/yellow/grey), `sourceIdentifier`, a 60-char `contentDescription` excerpt, `suitableFor` pills, and a "Son rapor: X gün önce, {volunteerName}" footer derived from `lastActivityAt` + `lastReporterName`.

For power users, the legacy detailed Rapor Yaz form remains accessible to staff via the staff-only Rapor Yaz tab (`#tab-reports`).

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

## Public landing page (root `index.html`)

The public site at `/` is informational. It does not require Firebase Auth and reads only from two purpose-built collections that contain no PII:

- **`publicProjectStats/{projectId}`** — one doc per project. Aggregate numbers only: `totalPages`, `donePages`, `totalUnits`, `doneUnits`, `updatedAt`. Refreshed by `publishProjectStats()` in `app/dashboard.js` after each report-submit batch commits, and seeded by the PNB importer.
- **`publicTicker/{entryId}`** — append-only stream. Each entry has exactly five fields: `createdAt`, `effort` (∈ `small|medium|large`), `materialCategory` (a coarse category derived from the unit's `seriesNo` — see `materialCategoryFromSeriesNo()`), `projectId`, `volunteerToken`. Schema is enforced by Firestore rules so a compromised client cannot smuggle volunteer names or note text in.

### Why two extra collections instead of opening `reports`
Firestore rules grant read at the document level, not the field level. Exposing `reports` publicly would leak `volunteerName`, `note`, and `url` along with `createdAt`/`effort`. A separate denormalized surface is the only way to honor "public read of these fields, private read of these other fields" in the same collection's docs.

### `volunteerToken` privacy property
`volunteerToken = SHA-256(volunteerId | YYYY-MM | "tarih-vakfi-public-ticker").slice(0, 16)`. It lets the landing page compute "X distinct contributors in the last 30 days" by counting unique tokens — but a public reader cannot reverse the hash to a volunteerId, and the token rotates each calendar month so long-term cross-month tracking of any one volunteer is not possible. The full 32-byte hash is truncated to 16 hex chars (64 bits) — collision risk across the foundation's entire volunteer pool is negligible.

### `materialCategory` derivation
The lookup map in `materialCategoryFromSeriesNo()` (in `app/dashboard.js`) maps Boratav archive series-number prefixes to coarse Turkish category labels: `170` → `mektuplar`, `120.5` → `kitap metinleri`, `110` → `ders notları`, `220`/`I.01` → `fotoğraflar`, etc. Anything unmapped falls through to `belgeler`. Update the map when new series numbers come online.

### What is NOT exposed to the public page
- `reports` (entire collection) — closed.
- `archiveUnits` — closed (carries `lastReporterName` + `lastReportNotePreview`, both private).
- `users`, `projectPeople`, `availability`, `activityLogs` — all closed.
- The landing's `js/landing.js` reads only `publicProjectStats/pnb` and the `publicTicker` collection. If either query fails or returns nothing, the relevant section is hidden gracefully — there is never a "0%" placeholder or an error message rendered to the visitor.

### Stylesheet scoping
The landing page uses `<body class="landing">`. All styles in `css/landing.css` are prefixed with `body.landing` (or with the unique `.lp-*` namespace) so they don't bleed into `/app/`, which is still rendered on top of Tabler.

## Pending review flow (admin Bakım)

Volunteers can create `archiveUnits` with `status == "pending_review"` via the "Liste dışı / yeni bir iş" path in the inline Rapor Yaz form. The Bakım tab now opens with a "Gözden geçirme bekleyen yeni işler" card listing every such doc, sorted newest first. Each row offers three actions:

- **Onayla ve ledger'a al** — opens a small modal that prompts for `priority` and a comma-separated `suitableFor` list, then `updateDoc` flips the unit to `status: "not_started"` with the supplied metadata. Logged as `pending_unit_approved` in `activityLogs`.
- **Var olan iş paketine birleştir** — opens a target picker, then for each `reports` doc with `archiveUnitId == pendingId` rewrites it to point at the chosen target (`archiveUnitId` + `unitId`), appends the pending unit's `sourceIdentifier` + `contentDescription` into the target's `notes`, and deletes the pending doc. Logged as `pending_unit_merged`.
- **Sil** — confirm, then `deleteDoc`. Logged as `pending_unit_deleted`.

All three writes flow through admin paths only (rules unchanged from Prompt C — admins can update/delete archiveUnits; coordinators cannot).

### Physical-archive access (`users.canWorkInPerson`)

The Rapor Yaz typeahead filters which units a volunteer sees by default:

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

### Telegram bot is disabled but retained
The Apps Script Telegram bot (Prompt S/T) was decommissioned on 28 Apr 2026. Apps Script web-app cold-start latency made the conversational flow unusable: the first message after ~10 minutes of idle took 30–40 seconds to respond, and even with a 5-minute keep-warm trigger we routinely saw 1+ minute round-trips during execution-quota contention. None of the remaining channels (web report-first, email reminders) depend on the bot.

**What was disabled, in order of decommission**:
1. **Telegram webhook** — removed via `deleteWebhook` against the bot token. The Apps Script web-app deployment was left in place, but no longer receives updates.
2. **Apps Script triggers** — `keepWarmPing`, `sendVolunteerWeeklyReminders`, `sendManagerWeeklySummary` deleted from the project. The handler functions stayed; only the trigger registrations went. `Triggers.gs::createTriggers` now omits these (commented-out blocks document the revival path).
3. **Dashboard UI** — both surfaces gated behind `window.FEATURE_FLAGS.telegramSection`, default `false` (set in `app/index.html`):
   - Volunteer Anasayfa link card (`#tgLinkCard`) — markup hidden via `data-telegram-section hidden`; `renderTelegramCard()` call short-circuited.
   - Admin Bakım diagnostic (`#tgDiagnosticCard`) — same hidden attribute; the lazy-load on `sw("bakim")` and the click handlers (`tgGenCodeBtn`, `tgUnlinkBtn`, `tgCodeCopyBtn`, `tgDiagnosticRefresh`, `tgSchemaCheckBtn`) all wrapped in the flag check.
4. **Firestore rules + collections** — left untouched. `match /telegramSessions/...` and `match /telegramLinkCodes/...` keep their locked-down rules; `users/{uid}.telegramId` remains a self-editable field. Any stragglers in those two collections are harmless and tiny.

**What stays compiled-in**:
- Apps Script: `apps-script/TelegramBot.gs`, `TelegramSession.gs`, `TelegramAuth.gs`, `TelegramReminders.gs`, `KeepWarm.gs`. Each carries a `// CURRENTLY DISABLED. ...` banner at the top.
- Apps Script: `FirestoreClient.gs` extensions (`createDocument`, `updateDocument`, `getDocument`, `deleteDocument`, `listDocuments`, `fsServerTimestamp`, filter builders) — these are general-purpose REST helpers and are useful even without the bot.
- JS: `renderTelegramCard`, `generateTelegramCode`, `showTelegramCode`, `unlinkTelegram`, `renderTelegramDiagnosticCounts`, `runTelegramSchemaCheck`, plus the click delegation block inside the global handler. All gated.
- HTML: `#tgLinkCard` and `#tgDiagnosticCard` containers, plus the Bakım `#tgDiagnosticCounts` / `#tgSchemaCheckResult` slots. All `hidden`.
- CSS: the `.tg-link-card`, `.tg-link-state`, `.tg-code`, `.tg-diag-row` rules in `css/dashboard.css` — dead but harmless.
- `apps-script/TELEGRAM_SETUP.md` — kept verbatim as the revival runbook.

**Revival checklist** (when a real backend is in place):
1. Host the bot logic on Cloud Run / Vercel / Cloudflare Workers / similar — anywhere that gives sub-second cold starts. The Apps Script `.gs` files can serve as a reference implementation; in practice you'll want to port to TypeScript / Node and use the Firebase Admin SDK instead of the REST helpers in `FirestoreClient.gs`.
2. Re-register the webhook against the new backend URL: `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=<NEW_BACKEND_URL>"`. Verify with `getWebhookInfo`.
3. Flip the dashboard flag: edit `app/index.html` and change `telegramSection: false` to `telegramSection: true` in the FEATURE_FLAGS init. The HTML containers' `hidden` attributes will need to be removed (or the JS gated rendering can replace them at runtime — that's a small refactor).
4. Re-enable the volunteer reminder + manager summary triggers — these can stay in Apps Script (they're scheduled jobs, not webhook handlers, so cold-start latency doesn't matter). Uncomment the three blocks inside `Triggers.gs::createTriggers` and re-run the function.

No data migration is required. The link-code → users.telegramId flow still works as designed; the only thing missing was a fast doPost.

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
| `reportType` | new (Prompt K) — `"unit" \| "project_general" \| "foundation_general"`. Derived at write time from which fields are set; stored on the doc for clean querying. Pre-Prompt K docs lack the field; `reportTypeOf(doc)` infers it from `archiveUnitId` / `projectId` for backwards compatibility. |
| `projectId` | nullable — set on `unit` and `project_general` reports; `null` on `foundation_general`. |
| `projectName` | new (Prompt K) — denormalized display name so old reports stay readable if a project is renamed. |
| `unitId` | nullable — points to `archiveUnits/{id}` for `unit` reports, `null` otherwise. |
| `unitSnapshot` | nullable — `{ sourceIdentifier, contentDescription }`, denormalized so the report stays readable if the unit is renamed/deleted. `null` for `project_general` and `foundation_general`. |
| `note` | new — free-text note, ≤ 500 chars (≥ 3 enforced client-side) |
| `effort` | new — written as `"medium"` for every report (the effort UI was retired in Prompt J). |
| `status` | new — derived from the volunteer's button choice (`in_progress \| done \| blocked`). On non-unit reports it's metadata only — no archiveUnit is updated. |
| `url` | new — optional link, or `null` |
| `volunteerId`, `volunteerName` | owner identity. For coordinator-on-behalf submissions, points at the *credited* volunteer, not the coordinator. |
| `workDate` | new (Prompt W) — YYYY-MM-DD calendar date the work happened. Volunteer-picked, defaults to today (Istanbul), can be backdated up to 30 days. Server-validated by `isValidWorkDateRange()` in `firestore.rules` on both create and update. |
| `submittedBy` | new (Prompt W) — UID of the user who actually filed the report. Equals `volunteerId` for self-submits; differs when a coordinator submits on behalf of someone else. Audit-invariant — Firestore rules block updates to it. |
| `editedAt` | new (Prompt W) — ISO timestamp of the most recent edit, `null` if never edited. Denormalized from `editHistory[-1].editedAt` for query convenience. |
| `editHistory` | new (Prompt W) — append-only array. Each entry: `{ editedAt, editedByUid, editedByName, changes }` where `changes` is `{ fieldName: { from, to } }`. |
| `userUid`, `userEmail`, `archiveUnitId`, `taskId`, `summary`, `workStatus` | legacy fields, kept for backwards compatibility with quick/detailed flows and the existing rules path |
| `source` | `"report_first"` for self-submits; `"coordinator_logged"` for coordinator-on-behalf submits. |
| `createdAt`, `updatedAt` | server timestamps. `createdAt` is set once on creation and never modifiable — Firestore rules lock it on update. |

#### Two-timestamp model: workDate vs createdAt
- **`workDate`** — calendar date the volunteer says the work was done. Used by:
  - "Son raporların" volunteer log row primary date.
  - "Bugün → Son raporlar" coordinator feed primary date.
  - Unit drill report headline date.
  - `Mailers.checkInactiveVolunteers` (via `getLatestWorkDateForVolunteer` in `FirestoreClient.gs`) — so a volunteer who logs three weeks of past work all at once doesn't immediately get a "you've been silent" nudge.
- **`createdAt`** — server timestamp of when the report was submitted. Used by:
  - Firestore rules' 24-hour edit window check (the volunteer can only self-edit within 24h of submission, regardless of `workDate`).
  - Unit drill "Detaylar" expander (audit footer + editHistory chronology).
  - `publicTicker` entries (the public landing's recent-activity stream is about flow of submissions, not historical work dates).
  - Pagination cursors (`startAfter`) on the staff `loadStaffRecentReports` feed.

For a same-day submission the two are equal. They diverge for backdated reports.

#### 24-hour volunteer self-edit window
Volunteers can edit their own reports for 24 hours after submission. The Düzenle button on each "Son raporların" row is gated client-side by `canEditReport(r)` (`now - createdAt < 24h && r.userUid === cu.uid`), and Firestore rules mirror the same window via `request.time < resource.data.createdAt + duration.value(24, 'h')`. Past 24h, the button disappears and a stale-context save attempt fails with the user-facing message:

> Bu raporu artık düzenleyemezsin. Bir düzeltme yazmak için yeni bir rapor oluştur veya bir koordinatöre yaz.

Coordinators and admins bypass the window — they can edit any report at any time. `volunteerId`, `createdAt`, and `submittedBy` stay locked across all edit branches so the audit chain can't be rewritten.

#### Coordinator-on-behalf submission
Staff get a "Kim adına yazıyorsun?" typeahead at the top of the inline form (`renderInlineRaporForm`, gated on `isStaff()`). Default is "Kendim ({coordinator's name})". Picking a different volunteer routes the submit so:
- `volunteerId` / `userUid` / `userEmail` / `volunteerName` → the picked volunteer's identity.
- `submittedBy` → the coordinator's uid.
- `users/{pickedVolunteer}.lastReportAt` advances (so the silent-volunteer detection sees them as recently active), not the coordinator's.
- `archiveUnits/{unitId}.lastReporterId` shows the coordinator's uid (so the rule's `request.auth.uid` check passes), but `lastReporterName` shows the volunteer's name.
- `source` is `"coordinator_logged"` instead of `"report_first"`.
- Activity log writes `report_submitted` with `metadata.onBehalfOfUid` populated.

Display surfaces add a provenance label when `submittedBy !== volunteerId`:
- Volunteer's own "Son raporların" row prepends a small `Koordinatör tarafından yazıldı` badge before the note preview.
- Coordinator's Bugün feed expand block shows `Koordinatör {Coordinator Name} tarafından, {Volunteer Name} için`.
- Unit drill timeline rows show the same on-behalf line.

#### `editHistory` schema
```
editHistory: [
  {
    editedAt: ISO 8601 string,        // wall-clock at the time of edit
    editedByUid: string,              // uid of whoever clicked Save
    editedByName: string,             // denormalized display name
    changes: {                        // only fields that actually changed
      [fieldName]: { from, to }
    }
  },
  ...
]
```

Top-level `editedAt` (a Firestore server timestamp) mirrors the most recent entry's `editedAt` for cheap "edited / not edited" queries — this is why the per-entry `editedAt` is an ISO string (Firestore can't embed `serverTimestamp()` inside an array element). The `(düzenlendi)` suffix on log rows reads from the top-level `editedAt`. The unit drill's per-report Detaylar expander renders the full chronology in newest-first order.

**`publicTicker` materialCategory.** `unit` reports use `materialCategoryFromSeriesNo(unit.seriesNo)` (e.g. `mektuplar`, `kitap metinleri`, `belgeler`). `project_general` reports use the literal `"genel"` so the public landing renderer can distinguish "general project work" from a specific archive category. `foundation_general` reports skip `publicTicker` entirely (the ticker is project-themed). The Firestore rule on `publicTicker` only requires `materialCategory` to be a string, so `"genel"` is accepted without a rule change.

**`publicProjectStats`.** Refreshed only on `unit` reports (since project totals are unit-driven). `project_general` and `foundation_general` reports don't move project totals.

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
- `sourceIdentifier`, `priority`, `suitableFor`, `city`, `contentDescription`, `materialType`, `pageCount`, `documentCount`, `folderCount`, `projectId` — populated by the PNB importer; consumed by the inline Rapor Yaz form's typeahead and pill rendering.
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
