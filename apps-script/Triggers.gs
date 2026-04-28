/**
 * Triggers.gs — single source of truth for all time-based triggers in this
 * Apps Script project.
 *
 * createTriggers() is the maintenance entry point. Running it from the
 * Apps Script editor (Run → createTriggers) does two things, in order:
 *
 *   1. Deletes EVERY existing project trigger. This is destructive — any
 *      one-off trigger added by hand outside this function is wiped. The
 *      tradeoff is durable idempotency: re-running the function always
 *      produces exactly the trigger set defined below, with no risk of
 *      duplicates accumulating across re-runs.
 *
 *   2. Recreates the canonical set:
 *
 *      handler                          | cadence
 *      ---------------------------------+--------------------------------
 *      processMailQueue                 | every 1 hour
 *      checkInactiveVolunteers          | every 1 day
 *      generateWeeklySummary            | every 7 days
 *
 *      (Telegram bot triggers — keepWarmPing every 5 min,
 *       sendVolunteerWeeklyReminders + sendManagerWeeklySummary every
 *       Friday 17:00 Europe/Istanbul — are currently DISABLED. See the
 *       commented block inside the function body for the revival path.
 *       Decommissioned 28 Apr 2026 because Apps Script cold-start
 *       latency made the conversational bot unusable.)
 *
 * The three active handlers (processMailQueue, generateWeeklySummary,
 * checkInactiveVolunteers) are unchanged from pre-Telegram days.
 *
 * After this function runs, the Triggers screen (clock icon in the editor)
 * should show three rows. Anything else means a previous run left orphans;
 * re-run createTriggers() to clean up.
 */

function createTriggers() {
  // 1. Wipe the slate. Apps Script returns ALL project triggers, including
  // ones added by hand. The destructive intent is documented above.
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  // 2. Recreate the canonical set. Each entry below builds one trigger.
  //
  // For Friday-at-5pm-Istanbul triggers we use onWeekDay + atHour +
  // inTimezone. The .nearMinute() call sets the minute-within-hour offset
  // (5 minutes between the two Friday handlers so a single fire window
  // doesn't try to run them simultaneously and bump the 6-min execution
  // cap).

  ScriptApp.newTrigger('processMailQueue')
    .timeBased().everyHours(1)
    .create();

  ScriptApp.newTrigger('checkInactiveVolunteers')
    .timeBased().everyDays(1)
    .create();

  ScriptApp.newTrigger('generateWeeklySummary')
    .timeBased().everyDays(7)
    .create();

  // -- Telegram bot triggers disabled 28 Apr 2026 ---------------------------
  // The bot stack (TelegramBot.gs / TelegramSession.gs / TelegramAuth.gs /
  // TelegramReminders.gs / KeepWarm.gs) is currently disabled — Apps Script
  // cold-start latency made the conversational flow unusable (1+ minute
  // response times). The handler functions still exist; only the
  // triggers below are commented out so re-running createTriggers() does
  // not resurrect them. To revive: uncomment these blocks AND migrate the
  // bot to a real backend (Cloud Run / Vercel / Cloudflare Workers) AND
  // set window.FEATURE_FLAGS.telegramSection = true on the dashboard.
  // ------------------------------------------------------------------------

  // ScriptApp.newTrigger('keepWarmPing')
  //   .timeBased().everyMinutes(5)
  //   .create();

  // let volunteerReminderBuilder = ScriptApp.newTrigger('sendVolunteerWeeklyReminders')
  //   .timeBased()
  //   .onWeekDay(ScriptApp.WeekDay.FRIDAY)
  //   .atHour(17)
  //   .inTimezone('Europe/Istanbul');
  // if (typeof volunteerReminderBuilder.nearMinute === 'function') {
  //   volunteerReminderBuilder = volunteerReminderBuilder.nearMinute(0);
  // }
  // volunteerReminderBuilder.create();

  // let managerSummaryBuilder = ScriptApp.newTrigger('sendManagerWeeklySummary')
  //   .timeBased()
  //   .onWeekDay(ScriptApp.WeekDay.FRIDAY)
  //   .atHour(17)
  //   .inTimezone('Europe/Istanbul');
  // if (typeof managerSummaryBuilder.nearMinute === 'function') {
  //   managerSummaryBuilder = managerSummaryBuilder.nearMinute(5);
  // }
  // managerSummaryBuilder.create();
}

/**
 * Deprecated alias kept so the original TELEGRAM_SETUP.md instructions
 * (and anyone who already bookmarked this name) keep working. Calls into
 * createTriggers, which now owns the full trigger set.
 */
function installTelegramTriggers() {
  createTriggers();
}
