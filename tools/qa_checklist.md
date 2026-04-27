# Report-first launch — manual QA checklist

Run through these before announcing the new flow to volunteers. Each box is a
single user-visible scenario; check the box only when both the happy path and
the listed failure modes behave correctly.

## Setup

- [ ] You have access to Firebase Console for the production project (or a
      pre-prod copy seeded from a recent backup).
- [ ] You have at least three test accounts: one volunteer, one coordinator,
      one admin. Each is signed into a separate browser profile or device.
- [ ] At least one PNB archive unit has `digitized == false` and one has
      `digitized == true`, so the Ankara filter has something to filter against.
- [ ] At least one approved volunteer has not submitted a report in 22+ days
      (so the "Sessiz gönüllüler" subsection has a row to render).
- [ ] At least one archive unit's `lastActivityAt` is older than 60 days and
      its `status` is not `done` / `pending_review` (so the
      "Uzun süredir dokunulmamış" subsection has a row to render).

## 1. End-to-end Rapor Yaz against a real PNB unit

- [ ] Sign in as the test volunteer.
- [ ] On Bugün, the large "Rapor Yaz" primary button is the first call to
      action; no self-claim banner is visible.
- [ ] Click "Rapor Yaz". The modal opens with the typeahead focused.
- [ ] Type a known PNB `sourceIdentifier` substring. Results appear within
      ~250 ms with priority dot + `suitableFor` pills.
- [ ] Pick a unit. Selection chip replaces the input. Note textarea gets focus.
- [ ] Type a one-line note, pick effort = Normal, status = Devam ediyor.
- [ ] Submit.
- [ ] Toast "Rapor kaydedildi. Teşekkürler." appears; modal closes.
- [ ] "Son raporların" list now shows the report at the top (without a page
      reload).
- [ ] Open Firestore Console → `reports` → newest doc has `unitId`,
      `unitSnapshot`, `note`, `effort`, `status`, `reportedSubstatus`,
      `volunteerId`, plus the legacy `userUid` / `archiveUnitId` mirror.
- [ ] The corresponding `archiveUnits/{id}` doc shows updated `status`,
      `lastActivityAt`, `lastReporterId/Name`, `lastReportNotePreview`, and
      `latestReportAt` (legacy mirror).
- [ ] `users/{uid}.lastReportAt` and `lastSeenAt` are within the last minute.
- [ ] `activityLogs` has a `report_submitted` entry pointing at the report.

## 2. "Liste dışı / yeni bir iş" submission

- [ ] As the test volunteer, open Rapor Yaz. Click "Liste dışı / yeni bir iş".
- [ ] The two text inputs (Kaynak/Tanım, Kısa açıklama) replace the typeahead.
- [ ] Fill both, write a note, pick effort + status, submit.
- [ ] Submit succeeds; toast appears.
- [ ] Sign in as admin in another browser. Open Bakım tab.
- [ ] "Gözden geçirme bekleyen yeni işler" lists the new doc with the
      volunteer's name, the supplied source/desc, and three buttons.
- [ ] Click "Onayla ve ledger'a al". Pick priority + suitableFor codes.
      Submit. Toast "Yeni iş sıraya alındı." Bakım list refreshes; the unit
      now has `status: "not_started"` and the supplied metadata.
- [ ] Repeat the liste-dışı submission, then exercise "Var olan iş paketine
      birleştir" against an existing unit. Verify: the original report's
      `archiveUnitId` is rewritten to the target id, the target unit's
      `notes` field gets a `[Birleştirildi: …]` line appended, and the
      pending unit doc is deleted.
- [ ] Repeat once more and exercise "Sil" with the confirm dialog.

## 3. Mobile viewport

- [ ] Open Chrome DevTools device emulation at 375×667 (iPhone SE class).
- [ ] As the volunteer, the Bugün primary CTA fits the viewport without
      horizontal scroll. The "Rapor Yaz" button is at least 44 px tall.
- [ ] Open the modal: it should fill the viewport (no rounded corners on
      narrow screens), all tap targets are ≥ 44 px, and the segmented
      effort/status buttons stack into one column on width ≤ 600 px.
- [ ] The note textarea grows on input; the character counter is visible.
- [ ] The keyboard does not push the submit button off-screen.
- [ ] Closing the modal with the system back gesture or the Kapat button
      asks for confirmation only if the note has unsaved content.

## 4. Ankara digitized filter

- [ ] In Firestore Console, set the test volunteer's `users/{uid}.city = "ankara"`.
- [ ] Sign in as that volunteer (sign out + back in to refresh `cp`).
- [ ] Open Rapor Yaz. The typeahead dropdown shows the notice
      "Ankara'da olduğun için yalnızca dijitalleştirilmiş kutular gösteriliyor."
- [ ] Search results contain ONLY units with `digitized == true`. Verify by
      cross-referencing two known-non-digitized box numbers — they must NOT
      appear.
- [ ] Reset `city` back to its original value when finished.

## 5. Turkish characters in the typeahead

- [ ] Pick a PNB unit whose `sourceIdentifier` or `contentDescription`
      contains a dotted-İ, undotted-ı, or another diacritic
      (ş, ğ, ü, ö, ç, â, î, û).
- [ ] In the typeahead, type the term using the *opposite* casing or with
      ASCII fall-back (e.g. `iSTANBUL` for "İstanbul", `sile` for "Şile").
      The unit should still match — Turkish normalization runs during
      matching only.
- [ ] Confirm the typed input is preserved verbatim in the input field
      (no auto-rewrite of dotted/undotted i).
- [ ] Confirm arrow-down + Enter selects a result without modifying the
      typed text.

## 6. Pano is read-only and shows correct data

- [ ] Sign in as the volunteer. Click the "Pano" tab.
- [ ] Five columns render: Başlanmadı / Devam ediyor / Gözden geçirme /
      Tamam / Takıldım. The pending side panel renders on the right
      (or below on narrow viewports).
- [ ] Cards show a colored left border that matches their priority
      (red = high, yellow = medium, grey = low).
- [ ] Cards show `sourceIdentifier`, a 60-char `contentDescription` clamp,
      `suitableFor` pills (if any), and a "Son rapor: X gün önce, {name}"
      footer.
- [ ] Try to drag a card. It must NOT move. Right-click / long-press
      reveals no context menu specific to status changes.
- [ ] Click a card. The unit drill modal opens with the new metadata
      block, status timeline, and a "Rapor Yaz (bu iş paketi için)"
      button. Pressing it closes the drill and opens the report modal
      with the unit pre-selected.
- [ ] Sign in as the coordinator. Pano renders the same way. No drag,
      no ⋮ menu.

## 7. Dikkat panel populates correctly

- [ ] Sign in as the coordinator. Bugün opens with two staff-only top
      panels: "Son raporlar" and "Dikkat".
- [ ] **Takılanlar**: the unit you marked `status = "blocked"` appears
      with its reporter name, time-ago, and `lastReportNotePreview`
      excerpt. The count chip in the summary matches.
- [ ] **Uzun süredir dokunulmamış**: your seeded 60-day-stale unit
      appears, oldest first. Done units and pending_review units do NOT
      appear here.
- [ ] **Sessiz gönüllüler**: the seeded 22-day-silent volunteer appears
      with their last-report info. A "Hatırlatma gönder" button is
      visible. Clicking it opens the system mail client with a pre-filled
      `mailto:` URL — no email is auto-sent.
- [ ] Casual-rhythm volunteers (`users.rhythm == "casual"`) do NOT appear
      in "Sessiz gönüllüler" even if they have not reported in months.
- [ ] Click a row in "Takılanlar" or "Uzun süredir dokunulmamış" — the
      unit drill modal opens with the full report history.

## 8. Self-claim feature flag

- [ ] In an empty browser DevTools console on `/app/`, run
      `console.log(window.FEATURE_FLAGS.selfClaim)`. Expect `false`.
- [ ] Sign in as the volunteer. The self-claim banner is not present.
- [ ] In DevTools, run `window.FEATURE_FLAGS.selfClaim = true` and call
      `location.reload()`. After reload, the legacy banner reappears on
      Bugün when the volunteer has zero or 2+ open units.
- [ ] Reset the flag (close tab) and confirm the banner is hidden again.

## 9. Smoke checks

- [ ] Sign-out / sign-in cycle works for all three test accounts.
- [ ] Admin Activity panel still shows "Aktif / Yavaşlayan / Durmuş /
      Serbest tempo" buckets correctly (it reads `users.lastReportAt`
      which the new flow keeps current).
- [ ] Apps Script `checkInactiveVolunteers` trigger (or a manual run)
      sends one inactivity reminder per silent volunteer using the new
      "Son raporundan bu yana yaklaşık X gün geçti…" copy.
- [ ] PNB Excel importer (`tools/pnb_excel_to_import.py` → admin Bakım)
      still works end-to-end.

## When all boxes are checked

You are clear to announce the new flow to volunteers. If any box stays
unchecked, log the issue in the project tracker before the rollout call.
