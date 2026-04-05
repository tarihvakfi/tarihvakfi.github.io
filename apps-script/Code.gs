/**
 * Configuration sheet names.
 */
const SHEET_NAMES = {
  mailQueue: 'MailQueue',
  logs: 'Logs',
  weekly: 'WeeklySummary'
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tarih Vakfi')
    .addItem('Mail kuyruğunu işle', 'processMailQueue')
    .addItem('Haftalık özet oluştur', 'generateWeeklySummary')
    .addToUi();
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet not found: ${name}`);
  return sheet;
}

function appendLog(action, detail, email) {
  const sheet = getSheet(SHEET_NAMES.logs);
  sheet.appendRow([new Date(), email || '', action, JSON.stringify(detail || {})]);
}

function enqueueMail(type, recipient, subject, body, metadata) {
  const sheet = getSheet(SHEET_NAMES.mailQueue);
  sheet.appendRow([
    new Date(),
    type,
    recipient,
    subject,
    body,
    'queued',
    JSON.stringify(metadata || {})
  ]);
}
