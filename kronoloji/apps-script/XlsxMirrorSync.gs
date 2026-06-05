/**
 * Mirrors the working Drive .xlsx file into a stable native Google Sheet.
 *
 * Editors keep working in the original .xlsx. This script periodically converts
 * that latest .xlsx to a temporary Google Sheet, copies its sheets into the
 * stable mirror, and trashes the temporary conversion file.
 *
 * Requires the Advanced Google service "Drive API" enabled in Apps Script.
 */

const SOURCE_XLSX_FILE_ID = "PASTE_CURRENT_XLSX_FILE_ID_HERE";
const MIRROR_SPREADSHEET_ID = "PASTE_STABLE_MIRROR_GOOGLE_SHEET_ID_HERE";

function refreshMirror() {
  if (!SOURCE_XLSX_FILE_ID || SOURCE_XLSX_FILE_ID.indexOf("PASTE_") === 0) {
    throw new Error("Set SOURCE_XLSX_FILE_ID to the current Drive .xlsx file ID.");
  }
  if (!MIRROR_SPREADSHEET_ID || MIRROR_SPREADSHEET_ID.indexOf("PASTE_") === 0) {
    throw new Error("Set MIRROR_SPREADSHEET_ID to the stable native Google Sheet mirror ID.");
  }

  const tempTitle = `TV KRONOLOJI temp conversion ${Utilities.formatDate(new Date(), "Europe/Istanbul", "yyyy-MM-dd HH:mm:ss")}`;
  const tempFile = Drive.Files.copy(
    {
      title: tempTitle,
      mimeType: "application/vnd.google-apps.spreadsheet",
    },
    SOURCE_XLSX_FILE_ID,
  );

  try {
    const tempSpreadsheet = SpreadsheetApp.openById(tempFile.id);
    const mirrorSpreadsheet = SpreadsheetApp.openById(MIRROR_SPREADSHEET_ID);
    replaceMirrorSheets_(tempSpreadsheet, mirrorSpreadsheet);
    PropertiesService.getScriptProperties().setProperties({
      LAST_MIRROR_REFRESH_AT: new Date().toISOString(),
      LAST_MIRROR_SOURCE_FILE_ID: SOURCE_XLSX_FILE_ID,
      LAST_MIRROR_TEMP_FILE_ID: tempFile.id,
    });
    return {
      ok: true,
      mirrorSpreadsheetId: MIRROR_SPREADSHEET_ID,
      refreshedAt: new Date().toISOString(),
      sheetCount: mirrorSpreadsheet.getSheets().length,
    };
  } finally {
    DriveApp.getFileById(tempFile.id).setTrashed(true);
  }
}

function installHourlyMirrorRefresh() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "refreshMirror")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("refreshMirror")
    .timeBased()
    .everyHours(1)
    .create();
}

function getMirrorStatus() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return {
    mirrorSpreadsheetId: MIRROR_SPREADSHEET_ID,
    sourceXlsxFileId: SOURCE_XLSX_FILE_ID,
    lastMirrorRefreshAt: props.LAST_MIRROR_REFRESH_AT || "",
  };
}

function replaceMirrorSheets_(sourceSpreadsheet, mirrorSpreadsheet) {
  const placeholder = mirrorSpreadsheet.insertSheet(`_refresh_${Date.now()}`);

  mirrorSpreadsheet.getSheets().forEach((sheet) => {
    if (sheet.getSheetId() !== placeholder.getSheetId()) {
      mirrorSpreadsheet.deleteSheet(sheet);
    }
  });

  sourceSpreadsheet.getSheets().forEach((sourceSheet) => {
    const copied = sourceSheet.copyTo(mirrorSpreadsheet);
    copied.setName(uniqueSheetName_(mirrorSpreadsheet, sourceSheet.getName(), copied.getSheetId()));
  });

  mirrorSpreadsheet.deleteSheet(placeholder);

  const firstSheet = mirrorSpreadsheet.getSheets()[0];
  if (firstSheet) {
    mirrorSpreadsheet.setActiveSheet(firstSheet);
  }
}

function uniqueSheetName_(spreadsheet, desiredName, copiedSheetId) {
  const cleanName = String(desiredName || "Sheet").slice(0, 90);
  const existing = spreadsheet
    .getSheets()
    .filter((sheet) => sheet.getSheetId() !== copiedSheetId)
    .map((sheet) => sheet.getName());

  if (existing.indexOf(cleanName) === -1) return cleanName;

  let index = 2;
  let candidate = `${cleanName.slice(0, 85)} ${index}`;
  while (existing.indexOf(candidate) !== -1) {
    index += 1;
    candidate = `${cleanName.slice(0, 85)} ${index}`;
  }
  return candidate;
}
