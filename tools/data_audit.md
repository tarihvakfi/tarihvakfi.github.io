# Data audit — missing pending applications & old reports

**Date:** 2026-04-28
**Scope:** Investigation only — no production code changed.

## TL;DR — root cause

A single unhandled `TypeError` thrown by `lr()` halts the entire post-auth data-load chain. As a result, **`lp()`, `la()`, `lu()`, and `loadStaffRecentReports()` never run**, so:

- The Yönetim "Onay bekleyen başvurular" card stays in its initial empty state and `pendingApplicationCount` stays at `0`, which also collapses the corresponding line out of the Bugün → Dikkat card.
- The Bugün "Son raporlar" card stays empty (its preferred cache `staffRecentDocs` is never populated, and the fallback render via `renderHomeOverview` is not called after `rd` populates).
- The Yönetim "Tüm gönüllüler" card stays empty (`renderYonetimUserDirectory` runs against an `allUsers` cache that wasn't refreshed by `lu()`).
- The Yönetim "Duyurular" list stays empty (`la()` never runs).
- `syncRouteFromHash()` never runs, so the URL hash isn't applied on initial load.

The Firestore queries themselves are correct. The data is in Firestore. The browser never asks for it because the code throws halfway through the load sequence.

---

## The throw

`app/dashboard.js:3927` (also `:3937` and `:3945`) — inside `async function lr()`:

```js
async function lr() {
  const staff = isStaff();
  rd = {};
  if (staff) {
    const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(80)));
    snap.docs.forEach((item) => { rd[item.id] = item.data(); });
    document.getElementById("reportsTitle").textContent = "Tüm raporlar";   // ← line 3927: THROWS
  } else {
    ...
    document.getElementById("reportsTitle").textContent = "Raporlarım";    // ← line 3937: same throw, volunteer path
  }
  ...
  document.getElementById("reportsList").innerHTML = ...                    // ← line 3945: same throw
  renderHomeOverview();                                                     // never reached
}
```

`#reportsTitle` and `#reportsList` were inside the `<section id="tab-reports">` block that was **deleted in Prompt N** when the standalone Rapor Yaz tab went away. `getElementById(...)` now returns `null`; `null.textContent = "..."` throws `TypeError: Cannot set properties of null`.

Confirmed by `grep -n "reportsTitle\|reportsList" app/index.html` → no matches.

### Auth chain that gets killed

`app/dashboard.js:6472–6493` — the `onAuthStateChanged` callback runs these in order, awaiting each:

```js
await loadAllUsers();        // OK — runs
await reloadPnb();           // OK — runs
ld.classList.add("hidden");
tb.classList.remove("hidden");
await lh();                  // OK — guards added in Prompt N
await lt();                  // OK — #tasksList exists in new Yönetim
await lr();                  // ❌ THROWS on line 3927
await la();                  // never runs → announcements not loaded
if (staff) {
  await lp();                // never runs → pending users never queried
  await lu();                // never runs → user directory not refreshed
  await loadStaffRecentReports(true);  // never runs → staffRecentDocs stays []
}
if (isAdmin()) {
  await loadPendingReviewUnits();      // never runs → admin pending-review queue empty
}
loadNotifs();                          // never runs
syncRouteFromHash();                   // never runs → URL hash ignored on load
```

There's no `try/catch` around any of these. The thrown `TypeError` propagates up to the async callback, which silently rejects (no `.catch` handler). The user sees a half-loaded dashboard.

Note: `rd` IS populated before the throw (line 3926 runs before 3927), so report data exists in memory. But `renderHomeOverview()` on line 3946 never fires, so the Bugün renderer never sees the populated cache. The earlier `renderHomeOverview` calls inside `lh()` and `lt()` ran when `rd` was still `{}`, which is why Bugün shows "Henüz rapor yok."

---

## Per-query review

### 1. `lp()` — Yönetim "Onay bekleyen başvurular"

**Location:** `app/dashboard.js:3963–3989`

```js
const snap = await getDocs(query(
  collection(db, "users"),
  where("status", "==", "pending"),
  limit(50)
));
```

**Verdict: query is correct.** Filters only on `status == "pending"`, no department / role / createdAt restriction. With `limit(50)` it would surface the first 50 pending applications. The function is *never invoked* under current conditions because of the `lr()` throw above; once that's fixed, this should populate the card and update `pendingApplicationCount`, which in turn drives the Bugün → Dikkat "yeni gönüllü onayı bekliyor" line.

**Render path:**
- writes the row HTML to `#pendingUsers` (✓ exists in `app/index.html:514`)
- toggles `#yonetimPendingCard.hidden` based on count (✓ exists)
- updates `#yonetimPendingCount` text (✓ exists)
- adds a `.count-badge` to `[data-tab="yonetim"]` (✓ exists)

No data is read but unrendered.

### 2. `loadStaffRecentReports(reset)` — Bugün "Son raporlar"

**Location:** `app/dashboard.js:766–805`

```js
let q;
if (staffRecentLastDoc) {
  q = query(collection(db, "reports"), orderBy("createdAt", "desc"), startAfter(staffRecentLastDoc), limit(30));
} else {
  q = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(30));
}
```

**Verdict: query is correct.** Pulls all reports across the whole project, newest first, paginated 30 at a time. Coordinator/admin permissions are granted by `firestore.rules:237–242` (any approved coordinator/admin can `read` any `reports` doc). This function is *never invoked* in the current run because the auth chain dies at `lr()` first.

**Caveat:** `orderBy("createdAt", "desc")` will silently exclude any report doc that lacks a `createdAt` field. Every code path that creates reports does set `createdAt: serverTimestamp()`, so this should be safe — but it's worth a manual check that no historic report doc is missing the field.

**Render path** (when invoked):
- writes to `#staffRecentList` / `#staffRecentMoreBtn` / `#staffRecentMessage`. **These IDs no longer exist** in the HTML (they were inside the deleted old `staffRecentPanel` block). The function has `if (list)` guards so it doesn't throw, but it also doesn't render anywhere visible.
- DOES populate the in-memory `staffRecentDocs` array.
- DOES call `renderStaffRecentReports()` (which targets the same dead IDs) — no visible output.

The renderer that *does* read this cache is `renderCoordinatorRecentReports()` at `app/dashboard.js:2536–2556`:

```js
let docs = [];
if (Array.isArray(staffRecentDocs) && staffRecentDocs.length) {
  docs = staffRecentDocs.slice(0, 8).map((d) => ({ id: d.id, ...d.data }));
} else {
  docs = Object.entries(rd || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (toDateFromTs(b.createdAt)?.getTime() || 0) - (toDateFromTs(a.createdAt)?.getTime() || 0))
    .slice(0, 8);
}
```

Two failure modes today:
- `staffRecentDocs` is empty (because `loadStaffRecentReports` never ran).
- The fallback to `rd` should still work because `rd` IS populated (lr() runs the fetch before the throw). But `renderCoordinatorRecentReports` is only called from `renderBugun()`, which is only called from `renderHomeOverview()` — and the only `renderHomeOverview()` call after `rd` populates is the one *inside* `lr()` after the failing line. So it never runs.

**Cumulative effect:** Bugün → Son raporlar shows "Henüz rapor yok." (the `<p class="sv-log-empty">` shipped in the static HTML at `app/index.html:88`).

### 3. `lr()` — volunteer-side reports + global `rd` cache

**Location:** `app/dashboard.js:3921–3947`

Staff query: `query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(80))` — correct, no extra filters.

Volunteer query: `query(collection(db, "reports"), where("userUid", "==", cu.uid), limit(40))` plus a coworker fallback — correct.

The fetch itself succeeds. The throw on the post-fetch DOM writes (lines 3927/3937/3945) is the problem. See "The throw" above.

### 4. `lu()` — Yönetim "Tüm gönüllüler" cache refresh

**Location:** `app/dashboard.js:3991–3998`

```js
const snap = await getDocs(query(
  collection(db, "users"),
  orderBy("createdAt", "desc"),
  limit(300)
));
allUsers = snap.docs.map(...);
renderYonetimUserDirectory();
renderActivityPanel();
```

**Verdict: query has a subtle filter.** `orderBy("createdAt", "desc")` will silently exclude any user doc whose `createdAt` field is missing or has a non-timestamp type. The collection should have `createdAt` on every doc (the signup flow writes it, and the import tools do too), but old hand-created admin records or pre-Prompt-A docs may not. If you see fewer users than expected in Yönetim, this is the prime suspect.

The same caveat applies to `loadAllUsers()` at line 3754 (also uses `orderBy("createdAt", "desc")`).

**Suggested manual check:** in the Firebase console, run a Firestore query on `users` *without* `orderBy` and compare doc counts to what `lu()` returns.

`lu()` is also never invoked under current conditions (auth chain dies at `lr()`).

### 5. `renderYonetimUserDirectory()` — display filter

**Location:** `app/dashboard.js:4003–4086`

```js
const enriched = (allUsers || [])
  .filter((u) => u?.data && u.data.role && u.data.status === "approved")
  ...
```

**Verdict: intentionally hides non-approved users.** The "Tüm gönüllüler" card is approved-only by design — pending users live in their own card (Section 1). Two consequences worth flagging to the user:

1. **No status badge on pending users in this list.** If a pending user later gets approved, they'll appear here. There's no "pending" pill in this list and no escape hatch for staff to see "all users including pending" from one place.
2. **Users with `status == "blocked"`** are also filtered out. There's no UI surface for them at all. Probably not what the spec intends but not the immediate "missing data" issue.

### 6. `renderPano()` — does it filter reports / users?

**Location:** `app/dashboard.js:696–736`

`renderPano` operates on `archiveUnits` (not reports, not users). It filters out `pending_review` units by status, then groups by `panoBucket(unit)`. No report or user filtering. Not relevant to the missing-data issue.

The `#tab-pano` section was deleted in Prompt N, so `renderPano` writes into null elements (every write is guarded by `if (body)`/`if (count)`). Dead but harmless.

### 7. `loadArchiveUnits()` — orderBy / where

**Location:** `app/dashboard.js:4605–4628`

```js
query(collection(db, "archiveUnits"),
  where("projectId", "==", PNB_PROJECT_ID),
  limit(250))
```

No `orderBy`, no other filters. This is correct and runs successfully (it's earlier in the auth chain, before `lr()` throws). The `archiveUnits` cache and `archiveById` index are populated.

---

## Other affected code paths

### Tab routing not initialized on first load

`syncRouteFromHash()` is the last line of the auth callback (line 6492). Because `lr()` throws first, it never runs. **Side effect:** the URL hash is ignored on initial page load. The user lands on whichever tab is `.active` in the static HTML (which is none — `<button class="tab volunteer-tab" data-tab="anasayfa">Anasayfa</button>` doesn't have `.active` since the rewrite). So the dashboard may render with no active tab section visible at all on first load for some browsers, until the user clicks a tab. The `hashchange` listener (line 6496) is registered outside the callback, so it works for subsequent navigations — but only after the user manually clicks a tab.

### Dikkat card "yeni gönüllü onayı bekliyor" line

`computeCoordinatorAttentionItems()` at `app/dashboard.js:2401` reads `pendingApplicationCount`. Since `lp()` never runs, this stays `0`, so the line is omitted from the Dikkat card. Other Dikkat lines (silent volunteers, blocked units, stale units, pending-review units) read from `allUsers` and `archiveUnits` caches, which **were** populated successfully (loadAllUsers + reloadPnb both run before lr()). Those lines should still render correctly.

### Manual "Yenile" button on Bugün

There IS an escape hatch the user might not have tried: the small `↻` button in the Bugün → Son raporlar header (`#bugunRecentRefresh`). Its click handler at `app/dashboard.js:5499` calls `loadStaffRecentReports(true)` then `renderCoordinatorRecentReports()`. Clicking that button **should** populate the Son raporlar list, since it bypasses the broken auth-chain path. Worth asking the user to try it as a confirmation that the Firestore query side is healthy.

---

## Total expected counts — manual checks needed

I cannot read Firestore from this dev environment. The repo only contains the **client** Firebase config (`js/config.firebase.js`) and `firestore.rules` — no admin SDK, no service-account credentials, no `firebase` CLI session. The Browser-side SDK won't work from a Node process either (it needs an authenticated user session and a browser-like environment).

Please run these manual checks in the Firebase console (or `gcloud firestore` if you have CLI access):

1. **`users` collection, status breakdown:**
   ```
   users where status == "pending"     → expected count: ?
   users where status == "approved"    → expected count: ?
   users where status == "blocked"     → expected count: ?
   users (total docs, no filter)        → expected count: ?
   users without `createdAt` field      → run a one-off scan
   ```
   If `users` (no filter) ≠ sum of the three statuses, you have docs with `status` set to something else (or missing). If the no-filter count > what `lu()` returns when it does run, suspect docs missing `createdAt`.

2. **`reports` collection:**
   ```
   reports (total docs)                → expected count: ?
   reports where reportType == "unit"  → expected count: ?
   reports where reportType == "project_general"     → expected count: ?
   reports where reportType == "foundation_general"  → expected count: ?
   reports without reportType field    → legacy docs from before Prompt K
   ```
   Legacy reports without `reportType` are still picked up by `reportTypeOf(r)` which infers from `archiveUnitId` / `projectId`. They should render fine.

3. **`archiveUnits` collection:**
   ```
   archiveUnits where projectId == "pnb"                    → expected count: ?
   archiveUnits where projectId == "pnb" AND status == "blocked"  → ?
   archiveUnits where projectId == "pnb" AND status == "pending_review"  → ?
   archiveUnits where assignedToUids != []                  → manual check
   ```
   Last one is harder — Firestore can't query "non-empty array" directly; you'd run a one-off scan that checks `assignedToUids.length > 0`.

If the user has the Firebase console handy, the fastest sanity check is: open the Firestore data tab, click `users`, and look for any doc with `status: "pending"`. If there's at least one, the data exists and the bug is purely client-side (the lr() throw).

---

## What to fix when you're ready

1. **Primary**: replace the three unguarded DOM writes in `lr()` (lines 3927, 3937, 3945) with `?.` chains or `if (el)` guards, matching the pattern already used in `lh()` (lines 3897–3901). Same for any other surviving references to deleted IDs (e.g. `rf()` at line 4930 — only matters if a button still calls it).
2. **Defense-in-depth**: wrap each `await` in the auth callback (lines 6472–6488) in a `try/catch` so one stage's failure can't kill subsequent ones. Log the failure to console with which stage it was so future regressions are noisy.
3. **Stale-state fix**: trigger a `renderBugun()` (or `renderHomeOverview()`) call from `sw()` after the DOM is shown, OR call `renderHomeOverview()` once at the very end of the auth callback so the populated `rd` cache gets reflected even if no individual stage re-rendered.
4. **Optional**: drop `orderBy("createdAt", "desc")` from `lu()` and `loadAllUsers()`, sort client-side after the fetch, so docs missing the field aren't silently excluded.
5. **Optional UX**: add a "+pending kişi" badge or strip in the Yönetim "Tüm gönüllüler" card so coordinators have one place to see everyone.
