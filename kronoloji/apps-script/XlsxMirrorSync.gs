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
const PRESERVED_MIRROR_SHEET_NAMES = ["Site Metinleri"];

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
  const sourcePreservedSheetNames = new Set(
    sourceSpreadsheet
      .getSheets()
      .filter((sheet) => PRESERVED_MIRROR_SHEET_NAMES.indexOf(sheet.getName()) !== -1)
      .map((sheet) => sheet.getName()),
  );

  mirrorSpreadsheet.getSheets().forEach((sheet) => {
    const shouldKeepPreservedSheet =
      PRESERVED_MIRROR_SHEET_NAMES.indexOf(sheet.getName()) !== -1 && !sourcePreservedSheetNames.has(sheet.getName());
    if (sheet.getSheetId() !== placeholder.getSheetId() && !shouldKeepPreservedSheet) {
      mirrorSpreadsheet.deleteSheet(sheet);
    }
  });

  sourceSpreadsheet.getSheets().forEach((sourceSheet) => {
    if (PRESERVED_MIRROR_SHEET_NAMES.indexOf(sourceSheet.getName()) !== -1) {
      copySiteContentSheet_(sourceSheet, mirrorSpreadsheet);
      return;
    }
    const copied = sourceSheet.copyTo(mirrorSpreadsheet);
    copied.setName(uniqueSheetName_(mirrorSpreadsheet, sourceSheet.getName(), copied.getSheetId()));
  });

  ensurePreservedMirrorSheets_(mirrorSpreadsheet);
  mirrorSpreadsheet.deleteSheet(placeholder);

  const firstSheet = mirrorSpreadsheet.getSheets()[0];
  if (firstSheet) {
    mirrorSpreadsheet.setActiveSheet(firstSheet);
  }
}

function copySiteContentSheet_(sourceSheet, mirrorSpreadsheet) {
  const existing = mirrorSpreadsheet.getSheetByName(sourceSheet.getName());
  if (existing) {
    mirrorSpreadsheet.deleteSheet(existing);
  }

  const target = mirrorSpreadsheet.insertSheet(sourceSheet.getName());
  const values = normalizeSiteContentRows_(sourceSheet.getDataRange().getDisplayValues());
  target.getRange(1, 1, values.length, 3).setValues(values);
  target.setFrozenRows(1);
  target.autoResizeColumns(1, 3);
}

function normalizeSiteContentRows_(values) {
  if (!values || !values.length) {
    return [["key", "value", "note"]];
  }

  const header = values[0].map((cell) => String(cell || "").trim().toLocaleLowerCase("tr-TR"));
  const keyIndex = header.indexOf("key");
  const valueIndex = header.indexOf("value");
  const noteIndex = header.indexOf("note");
  const rows = [["key", "value", "note"]];

  values.slice(1).forEach((row) => {
    const key = keyIndex >= 0 ? row[keyIndex] : row[0];
    const value = valueIndex >= 0 ? row[valueIndex] : row[1];
    const note = noteIndex >= 0 ? row[noteIndex] : row[2];
    if (String(key || "").trim() || String(value || "").trim() || String(note || "").trim()) {
      rows.push([key || "", value || "", note || ""]);
    }
  });

  return rows.length > 1 ? rows : [["key", "value", "note"]];
}

function ensurePreservedMirrorSheets_(spreadsheet) {
  PRESERVED_MIRROR_SHEET_NAMES.forEach((sheetName) => {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }
    const headerValues = sheet.getRange(1, 1, 1, 3).getDisplayValues()[0].join("");
    if (!headerValues) {
      sheet.getRange(1, 1, 1, 3).setValues([["key", "value", "note"]]);
      sheet.setFrozenRows(1);
    }
  });
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
