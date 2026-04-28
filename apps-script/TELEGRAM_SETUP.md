# Tarih Vakfı Telegram Bot — Setup

This bot lives in the existing Apps Script project alongside `Code.gs`,
`FirestoreClient.gs`, `Mailers.gs`, etc. No separate hosting; the Telegram
webhook posts directly to the Apps Script Web App URL.

The bot token, the Firebase service account, and the webhook URL are the
three secrets that bind this stack together. Two of them (token, service
account) live in **Script Properties** — never in committed files. The third
(webhook URL) is generated at deploy time and registered with Telegram via
`curl`.

---

## 1. Set Script Properties

Open the Apps Script editor → **Project settings** (cog icon) → **Script
Properties** → **Add script property**:

| Key | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | The bot token you got from `@BotFather` (looks like `1234567:AAA-bbb…`). |
| `FIREBASE_SERVICE_ACCOUNT` | The full JSON of a service account key with the `roles/datastore.user` role on the Firestore project. |

> The `FIREBASE_SERVICE_ACCOUNT` property is shared with the existing
> `Mailers.gs` inactivity sweep — if you've already got that working, the
> token is the only new property to add.

If `TELEGRAM_BOT_TOKEN` is missing every bot function short-circuits:
`doPost` returns 200 (Telegram won't retry-bomb), `sendMessage` logs a
warning and returns, the volunteer reminder skips the Telegram branch and
falls back to the email queue, the manager summary is skipped entirely.
Nothing throws.

---

## 2. Deploy as Web App

Apps Script editor → **Deploy** → **New deployment** → ⚙ → **Web app**.

| Field | Value |
| --- | --- |
| Description | `Tarih Vakfı Telegram bot` (or anything memorable). |
| Execute as | **Me** (the Apps Script project owner). |
| Who has access | **Anyone**. (Telegram's webhook fetches anonymously; Firestore writes still go through the service account, so this is safe.) |

Click **Deploy** and copy the **Web app URL**. It looks like:

```
https://script.google.com/macros/s/AKfycb…/exec
```

This URL is what Telegram will POST to.

> **Redeploy is mandatory after every code change.** Apps Script Web Apps
> snapshot the project on each deployment and serve that snapshot. A code
> change you saved in the editor is **not live until you redeploy**:
>
> 1. **Deploy → Manage deployments**.
> 2. Click ✏ next to the existing deployment.
> 3. **Version → New version**, click **Deploy**.
>
> The webhook URL stays the same across redeploys, so you don't need to
> re-run `setWebhook` unless you tear down the deployment.

---

## 3. Register the webhook with Telegram

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=<APPS_SCRIPT_WEB_APP_URL>"
```

Verify:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

The response `url` field should match your Web App URL exactly, and
`pending_update_count` should be 0 (or a small number that drains within a
few seconds).

To **clear** the webhook (e.g., if you're rotating the bot or moving to a
new Apps Script project):

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

---

## 4. Install the full trigger set

`Triggers.gs::createTriggers` is now the single entry point for every
time-based trigger this project owns. Run it once after first deploy and
re-run it any time you need to repair the schedule:

1. Apps Script editor → file dropdown → **Triggers.gs**.
2. Function dropdown → `createTriggers`.
3. Click **Run**. Authorize the script if prompted.

The function is **destructive-idempotent**: it deletes every existing
project trigger first, then recreates the canonical set below. Re-running
it never produces duplicates, and any one-off triggers added by hand will
be wiped — if you've added something outside this function, fold it into
`createTriggers` before re-running.

Canonical trigger set after a clean run:

| Handler | Cadence | Notes |
| --- | --- | --- |
| `processMailQueue` | every 1 hour | Mailers.gs (unchanged) |
| `checkInactiveVolunteers` | every 1 day | Mailers.gs (unchanged) |
| `generateWeeklySummary` | every 7 days | Summaries.gs (unchanged) |
| `keepWarmPing` | every 5 minutes | KeepWarm.gs — see §4a |
| `sendVolunteerWeeklyReminders` | Friday 17:00 Istanbul | Telegram bot reminders |
| `sendManagerWeeklySummary` | Friday 17:05 Istanbul | Telegram bot summary |

Verify under **Triggers** (clock icon in the editor sidebar) — you should
see exactly six rows. Anything else means a previous run left orphans;
re-run `createTriggers` to clean up.

> The legacy `installTelegramTriggers` function (originally in
> `TelegramReminders.gs`, now a thin shim in `Triggers.gs`) still works
> for older setup instructions — it just forwards to `createTriggers`.

### 4a. Keep-warm pattern

Apps Script web apps cold-start when the runtime has been idle for ~5–10
minutes. The first message after a cold period takes 30–40 seconds to
respond, which feels broken from the volunteer's side. The
`keepWarmPing` trigger fires every 5 minutes and pings Telegram's
`getWebhookInfo` endpoint, which keeps the runtime warm and doubles as a
free smoke-test that the webhook URL is still set.

If `keepWarmPing` ever logs `webhook URL is unset`, that means the
webhook was deleted server-side (commonly: someone re-deployed the Web
App with a new URL without re-running `setWebhook`). Re-run the curl
from §3 and the next ping will be quiet again.

**Quota math.** Apps Script free tier allows 6 hours of execution time
per day. A keep-warm ping is ~200 ms.

```
288 pings/day  ×  ~200 ms  =  ~58 s/day
```

That's under 0.3% of the daily quota — negligible alongside everything
else. Increasing the cadence to every 1 minute (the most aggressive
option Apps Script allows) would be ~290 s/day, still <2% of quota.

If you ever want to disable the keep-warm (e.g., to test cold-start
behavior end-to-end), open the **Triggers** screen and delete the
`keepWarmPing` row by hand — it'll come back on the next `createTriggers`
run.

---

## 5. Verify end-to-end

1. Open `https://tarihvakfi.github.io/app/` as an approved volunteer.
2. On the Anasayfa, scroll to **Telegram** card → **Bağlantı kodu al**.
3. Copy the 6-digit code, message your bot in Telegram, paste the code.
4. The bot should reply with the welcome message including your name.
5. Refresh the dashboard — the Telegram card should now show "Telegram:
   bağlı".
6. Send `/rapor` and walk through the conversation. After the final reply
   ("Rapor kaydedildi. Teşekkürler!"), check Firestore:
   - `/reports/{newId}` should exist with `channel: "telegram"`.
   - `/users/{yourUid}.lastReportAt` should be fresh.
   - If you reported on a unit, `/archiveUnits/{unitId}.lastActivityAt` is fresh too.
7. Open the dashboard's Bakım tab → **Telegram tanılama** →
   **Şema doğrulamasını çalıştır**. The result should read
   "Şema eşleşti." (no missing fields, no type drift).

---

## 6. Manually run reminder triggers (testing)

You don't have to wait until Friday to test the reminder logic.

1. Apps Script editor → **TelegramReminders.gs**.
2. Function dropdown → `sendVolunteerWeeklyReminders` (or
   `sendManagerWeeklySummary`).
3. Click **Run**. The first time it'll prompt you to authorize the
   `UrlFetchApp.fetch` and Firestore scopes — accept.
4. Watch **Executions** (`⋯` menu in the left rail) for log output.

Both functions are idempotent within their dedup windows (5 days for
volunteer reminders; the manager summary doesn't dedup but its activity
log entries are informational only). Repeated runs in the same week will
mostly produce skips after the first run.

---

## 7. Troubleshooting

**The bot doesn't reply at all.**
- Check `getWebhookInfo` (above). If `url` is empty or wrong, re-run
  `setWebhook`.
- Check `last_error_message` in `getWebhookInfo`. A 404 usually means the
  Web App was redeployed at a new URL — copy the new URL into `setWebhook`.
- Check Apps Script **Executions** log for `doPost` invocations. If you see
  invocations but no replies, look for thrown errors in the entry detail.

**The bot replies "Bir şey ters gitti."**
- The top-level catch in `doPost` caught a thrown error. Open the
  Executions log; the error message + stack trace are logged via
  `console.error('doPost error: …')`.

**Reports written via Telegram don't show up in coordinator Bugün.**
- Coordinator Bugün reads `/reports` ordered by `createdAt` desc. Confirm
  the new report exists and that `createdAt` is a Firestore Timestamp (not
  a string). The `fsServerTimestamp()` sentinel in `commitReport()` ensures
  this — if you accidentally pass a `new Date().toISOString()` string, the
  comparison will silently break.

**Schema parity check flags missing fields.**
- Open `apps-script/TelegramBot.gs::commitReport` and compare the
  `reportDoc` object against `app/dashboard.js::submitInlineRapor` (the
  `batch.set(reportRef, …)` call). Add the missing field(s) to the bot
  side. Both writes should produce identical shapes.

**"FIREBASE_SERVICE_ACCOUNT missing" in logs.**
- Set the property under Script Properties (step 1 above). The same
  property is consumed by `Mailers.gs::checkInactiveVolunteers`, so if
  inactivity emails work, this should already be set.

**Rate-limited by Telegram.**
- The bot uses `UrlFetchApp.fetch` which honors Apps Script's quotas, not
  Telegram's. If you see 429s in the log, the manager summary recipient
  list is huge or you've manually re-run the reminder a dozen times.
  Throttle by spreading the recipient loop with `Utilities.sleep(200)`
  between sends if needed.

---

## 8. Schema parity verification

The Bakım tab's **Telegram tanılama** card has a **Şema doğrulamasını
çalıştır** button. It reads the most recent 200 `/reports` documents,
splits them by `channel` (`web` vs `telegram`), and compares the field key
sets and primitive types of the first 10 of each. The output flags:

- Fields present in web reports but missing from Telegram.
- Fields present in Telegram reports but missing from web.
- Fields present in both with mismatched JS types (e.g., `string` on web,
  `null` on Telegram).

A clean run says **"Şema eşleşti."** This is the canonical place to verify
that future code changes on either channel haven't drifted apart.

The same logic exists server-side in
`apps-script/TelegramReminders.gs::telegramSchemaParityCheck` for cron-style
verification. It isn't wired to a trigger today — invoke it from the Apps
Script editor when you want a Firestore-side answer (e.g., for a security
review).

---

## 9. Files in this project

| File | Purpose |
| --- | --- |
| `TelegramBot.gs` | `doPost` webhook entrypoint, command dispatch, conversation flow, report commit. |
| `TelegramSession.gs` | `/telegramSessions` CRUD, archive-unit search, materialCategory + volunteer-token helpers. |
| `TelegramAuth.gs` | Link code claim, telegramId resolution, last-seen update. |
| `TelegramReminders.gs` | `sendVolunteerWeeklyReminders`, `sendManagerWeeklySummary`, diagnostics. |
| `KeepWarm.gs` | `keepWarmPing` — every-5-min no-op that prevents doPost cold starts. |
| `Triggers.gs` | Pre-existing. Now owns the full trigger set (mailers + Telegram Friday reminders + keep-warm) via `createTriggers`. Re-running it deletes all triggers and rebuilds the canonical set. |
| `FirestoreClient.gs` | Pre-existing. Extended with `createDocument`, `updateDocument`, `getDocument`, `deleteDocument`, `listDocuments`, `fsServerTimestamp`, filter helpers. |
| `Code.gs` / `Mailers.gs` / `Summaries.gs` | Pre-existing, untouched. |

Bot token: **never committed**. Read from Script Properties at runtime.
