// CURRENTLY DISABLED. Webhook removed and triggers deleted on 28 Apr 2026
// due to Apps Script latency (1+ min response times). Revive when migrating
// to a proper backend (Cloud Run / Vercel / etc.).

/**
 * KeepWarm.gs — eliminate Apps Script web-app cold-start delay for the bot.
 *
 * Apps Script deallocates the doPost runtime after ~5–10 minutes of
 * inactivity. The first message after a cold period takes 30–40 seconds to
 * respond, which feels broken from the user's side. A 5-minute time-based
 * trigger pinging this no-op function keeps the runtime warm so doPost
 * answers in the usual sub-second window.
 *
 * Why getWebhookInfo as the side effect: it's a free, unauthenticated
 * Telegram API call that doubles as a smoke check. If the webhook URL has
 * somehow been unset (e.g., the Apps Script deployment was deleted and
 * recreated under a new URL without re-running setWebhook), this surfaces
 * the gap in the execution log instead of waiting for the next user
 * message to fail silently.
 *
 * Quota math:
 *   5-min cadence → 288 pings/day → ~58 sec/day at ~200 ms each.
 *   Apps Script free quota is 6 hours/day. Negligible cost.
 *
 * Trigger registration lives in Triggers.gs::createTriggers(). Re-running
 * that function is the supported way to install / repair the schedule.
 */

function keepWarmPing() {
  const token = PropertiesService.getScriptProperties()
    .getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) return;

  try {
    const response = UrlFetchApp.fetch(
      'https://api.telegram.org/bot' + token + '/getWebhookInfo',
      { muteHttpExceptions: true }
    );
    const text = response.getContentText();
    const result = JSON.parse(text);

    // If Telegram replies but the webhook URL is unset, log so the next
    // operator looking at execution history knows to re-run setWebhook.
    if (result && result.ok && result.result && !result.result.url) {
      console.warn('keepWarmPing: webhook URL is unset');
    }
  } catch (err) {
    // Don't propagate — keep-warm should never throw, even on transient
    // network blips. The execution log captures the message either way.
    console.error('keepWarmPing failed: ' + (err && err.message));
  }
}
