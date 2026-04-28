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
 *      keepWarmPing                     | every 5 minutes
 *      sendVolunteerWeeklyReminders     | Friday 17:00 Europe/Istanbul
 *      sendManagerWeeklySummary         | Friday 17:05 Europe/Istanbul
 *
 * The five existing handlers (processMailQueue, generateWeeklySummary,
 * checkInactiveVolunteers, sendVolunteerWeeklyReminders,
 * sendManagerWeeklySummary) are unchanged. The new addition is
 * keepWarmPing — see KeepWarm.gs for what it does and why.
 *
 * After this function runs, the Triggers screen (clock icon in the editor)
 * should show six rows. Anything else means a previous run left orphans;
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

  ScriptApp.newTrigger('keepWarmPing')
    .timeBased().everyMinutes(5)
    .create();

  let volunteerReminderBuilder = ScriptApp.newTrigger('sendVolunteerWeeklyReminders')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(17)
    .inTimezone('Europe/Istanbul');
  if (typeof volunteerReminderBuilder.nearMinute === 'function') {
    volunteerReminderBuilder = volunteerReminderBuilder.nearMinute(0);
  }
  volunteerReminderBuilder.create();

  let managerSummaryBuilder = ScriptApp.newTrigger('sendManagerWeeklySummary')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(17)
    .inTimezone('Europe/Istanbul');
  if (typeof managerSummaryBuilder.nearMinute === 'function') {
    managerSummaryBuilder = managerSummaryBuilder.nearMinute(5);
  }
  managerSummaryBuilder.create();
}

/**
 * Deprecated alias kept so the original TELEGRAM_SETUP.md instructions
 * (and anyone who already bookmarked this name) keep working. Calls into
 * createTriggers, which now owns the full trigger set.
 */
function installTelegramTriggers() {
  createTriggers();
}
