function generateWeeklySummary() {
  const sheet = getSheet(SHEET_NAMES.weekly);
  sheet.clearContents();

  const rows = [
    ['generatedAt', new Date()],
    ['pendingApplications', '=COUNTIF(Logs!C:C,"application_pending")'],
    ['approvedUsers', '=COUNTIF(Logs!C:C,"user_approved")'],
    ['submittedReports', '=COUNTIF(Logs!C:C,"report_submitted")']
  ];

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  appendLog('weekly_summary_generated', { rowCount: rows.length }, '');
}
