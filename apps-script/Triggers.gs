function createTriggers() {
  const functions = [
    { name: 'processMailQueue', everyHours: 1 },
    { name: 'generateWeeklySummary', everyDays: 7 }
  ];

  const existing = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  functions.forEach(item => {
    if (existing.includes(item.name)) return;
    if (item.everyHours) {
      ScriptApp.newTrigger(item.name).timeBased().everyHours(item.everyHours).create();
    } else if (item.everyDays) {
      ScriptApp.newTrigger(item.name).timeBased().everyDays(item.everyDays).create();
    }
  });
}
