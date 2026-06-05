/**
 * Tarih Vakfı Dijital Kronolojisi public-safe JSON endpoint.
 *
 * Mirror setup:
 * 1. XlsxMirrorSync.gs keeps a stable native Google Sheet mirror refreshed from
 *    the editor .xlsx file.
 * 2. Paste that mirror Sheet ID into SOURCE_SPREADSHEET_ID.
 * 3. Deploy this Apps Script as a Web App that executes as you.
 * 4. Paste the Web App URL into kronoloji/assets/js/config.js.
 *
 * This endpoint reads values only. It does not publish comments, notes, editor
 * metadata, private Drive links, or the original workbook.
 */

const SOURCE_SPREADSHEET_ID = "PASTE_STABLE_MIRROR_GOOGLE_SHEET_ID_HERE";

const ITEM_COLUMNS = {
  organizational: { text: 1, category: 3, count: 4 },
  event: { text: 2, category: 3, count: 4 },
  publication: { text: 5, category: 6, count: 7 },
};

const EXPECTED_PERIOD_YEAR_RANGES = {
  1: [1990, 1995],
  2: [1996, 2000],
  3: [2001, 2005],
  4: [2006, 2010],
  5: [2011, 2015],
  6: [2016, 2020],
  7: [2021, 2035],
};

const TURKISH_MONTHS = {
  ocak: 1,
  subat: 2,
  "şubat": 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  "mayıs": 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  "ağustos": 8,
  eylul: 9,
  "eylül": 9,
  ekim: 10,
  kasim: 11,
  "kasım": 11,
  aralik: 12,
  "aralık": 12,
};

const REVIEW_MARKERS = ["???", "??", "xxxx", "xxx", "say4", "npt", "belirtilmemiş", "yanlış"];

function doGet(event) {
  try {
    if (event && event.parameter && event.parameter.health === "1") {
      return jsonResponse({
        ok: true,
        generatedAt: new Date().toISOString(),
        mirror: typeof getMirrorStatus === "function" ? getMirrorStatus() : {},
      });
    }
    const records = normalizeChronology();
    return jsonResponse({
      generatedAt: new Date().toISOString(),
      recordCount: records.length,
      records,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

function normalizeChronology() {
  if (!SOURCE_SPREADSHEET_ID || SOURCE_SPREADSHEET_ID.indexOf("PASTE_") === 0) {
    throw new Error("Set SOURCE_SPREADSHEET_ID to the native Google Sheet ID.");
  }
  const spreadsheet = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  const records = [];
  spreadsheet.getSheets().forEach((sheet) => {
    const match = sheet.getName().match(/^\s*([1-7])\.\s*D[ÖO]NEM\s*$/i);
    if (!match) return;

    const periodNumber = Number(match[1]);
    const values = sheet.getDataRange().getValues();
    const displays = sheet.getDataRange().getDisplayValues();
    let currentDate = { display: "", start_date: "", end_date: "", year: "", note: "missing", exact: false };
    let currentYear = "";

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const sourceRow = rowIndex + 1;
      const rawDateValue = values[rowIndex][0];
      const rawDateDisplay = cleanText(displays[rowIndex][0]);
      const inheritedDate = !rawDateDisplay;
      if (!inheritedDate) {
        currentDate = parseDateValue(rawDateValue, rawDateDisplay, currentYear);
        if (currentDate.year) currentYear = currentDate.year;
      }
      const effectiveDate = inheritedDate ? currentDate : parseDateValue(rawDateValue, rawDateDisplay, currentYear);

      Object.keys(ITEM_COLUMNS).forEach((itemKind) => {
        const columns = ITEM_COLUMNS[itemKind];
        const rawText = cleanText(displays[rowIndex][columns.text]);
        if (!rawText) return;

        const category = publicText(displays[rowIndex][columns.category]);
        const description = publicText(rawText);
        const title = makeTitle(description);
        const id = `tvk-${pad(periodNumber, 2)}-${pad(sourceRow, 4)}-${itemKind.slice(0, 3)}`;
        const outsideExpectedPeriod = yearOutsideExpectedPeriod(periodNumber, effectiveDate.year);
        let status = verificationStatus(rawText, category, effectiveDate, inheritedDate);
        if (outsideExpectedPeriod) status = "needs_review";

        const publicNotes = [];
        if (inheritedDate) publicNotes.push("Tarih bilgisi önceki satır bağlamından taşındı.");
        if (["month_year", "month_range", "season_or_broad_range", "broad_date"].indexOf(effectiveDate.note) >= 0) {
          publicNotes.push("Tarih kesin gün bilgisi içermiyor.");
        }
        if (status === "uncertain_category") publicNotes.push("Kategori elle gözden geçirilmeli.");
        if (hasReviewMarker(rawText, category)) publicNotes.push("Kaynak hücrede inceleme işareti var.");
        if (outsideExpectedPeriod) publicNotes.push("Yıl, dönem için beklenen aralığın dışında görünüyor.");

        records.push({
          id,
          period: sheet.getName(),
          sheet_name: sheet.getName(),
          item_kind: itemKind,
          category,
          title,
          description,
          date_display: effectiveDate.display,
          start_date: effectiveDate.start_date,
          end_date: effectiveDate.end_date,
          year: effectiveDate.year,
          source_sheet: sheet.getName(),
          source_row: sourceRow,
          verification_status: status,
          public_note: publicNotes.join(" "),
          raw_text: rawText,
        });
      });
    }
  });
  return records;
}

function parseDateValue(value, displayValue, contextYear) {
  const display = cleanText(displayValue || value);
  if (!display) return { display: "", start_date: "", end_date: "", year: "", note: "missing", exact: false };
  if (Object.prototype.toString.call(value) === "[object Date]" && !Number.isNaN(value.getTime())) {
    const iso = Utilities.formatDate(value, "UTC", "yyyy-MM-dd");
    return { display: iso, start_date: iso, end_date: "", year: iso.slice(0, 4), note: "", exact: true };
  }
  const yearMatch = display.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : String(contextYear || "");
  const lower = display.toLocaleLowerCase("tr-TR");

  const dayMonth = display.match(/\b(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)(?:\s+((?:19|20)\d{2}))?\b/);
  if (dayMonth) {
    const month = monthNumber(dayMonth[3]);
    const parsedYear = dayMonth[4] || year;
    if (month && parsedYear) {
      const start = isoDate(parsedYear, month, dayMonth[1]);
      const end = dayMonth[2] && dayMonth[2] !== dayMonth[1] ? isoDate(parsedYear, month, dayMonth[2]) : "";
      return {
        display,
        start_date: start,
        end_date: end,
        year: String(parsedYear),
        note: dayMonth[4] ? "" : "year_from_context",
        exact: Boolean(start),
      };
    }
  }

  const monthHits = Object.keys(TURKISH_MONTHS).filter((month) => new RegExp(`\\b${month}\\b`, "i").test(lower));
  if (monthHits.length && year) {
    const distinctMonths = {};
    monthHits.forEach((month) => { distinctMonths[TURKISH_MONTHS[month]] = true; });
    return {
      display,
      start_date: "",
      end_date: "",
      year: String(year),
      note: Object.keys(distinctMonths).length > 1 ? "month_range" : "month_year",
      exact: false,
    };
  }

  if (yearMatch && display === yearMatch[0]) {
    return { display, start_date: "", end_date: "", year: yearMatch[0], note: "year_only", exact: false };
  }
  if (yearMatch) {
    return { display, start_date: "", end_date: "", year: yearMatch[0], note: "broad_date", exact: false };
  }
  return { display, start_date: "", end_date: "", year: "", note: "unparsed", exact: false };
}

function verificationStatus(rawText, category, parsedDate, inheritedDate) {
  if (!rawText) return "empty_or_invalid";
  if (!parsedDate.year || parsedDate.note === "unparsed" || parsedDate.note === "missing") return "uncertain_date";
  if (!category) return "uncertain_category";
  if (hasReviewMarker(rawText, category)) return "needs_review";
  if (inheritedDate && !parsedDate.exact) return "uncertain_date";
  if (["month_year", "month_range", "season_or_broad_range", "broad_date"].indexOf(parsedDate.note) >= 0) return "uncertain_date";
  return "verified";
}

function yearOutsideExpectedPeriod(periodNumber, year) {
  if (!year || !String(year).match(/^\d+$/)) return false;
  const range = EXPECTED_PERIOD_YEAR_RANGES[periodNumber];
  if (!range) return false;
  const parsedYear = Number(year);
  return parsedYear < range[0] || parsedYear > range[1];
}

function hasReviewMarker() {
  const text = Array.prototype.slice.call(arguments).join(" ").toLocaleLowerCase("tr-TR");
  return REVIEW_MARKERS.some((marker) => text.indexOf(marker) >= 0);
}

function publicText(value) {
  let text = cleanText(value);
  const replacements = {
    TVyayINLAR: "YAYINLAR",
    "TV YAYINLAR": "YAYINLAR",
    "TVyayınları": "yayınları",
    "TVyayınlar": "yayınlar",
    "TVyayına": "yayına",
    "TVyayını": "yayını",
    "TVyayın": "yayın",
    "TVyayımlandı": "yayımlandı",
    "TVyayımlan": "yayımlan",
  };
  Object.keys(replacements).forEach((bad) => {
    text = text.split(bad).join(replacements[bad]);
  });
  return text;
}

function makeTitle(description) {
  const text = publicText(description);
  if (text.length <= 140) return text;
  return `${text.slice(0, 137).trim()}...`;
}

function monthNumber(token) {
  return TURKISH_MONTHS[String(token || "").toLocaleLowerCase("tr-TR")];
}

function isoDate(year, month, day) {
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(parsed.getTime())) return "";
  return Utilities.formatDate(parsed, "UTC", "yyyy-MM-dd");
}

function cleanText(value) {
  return String(value === null || value === undefined ? "" : value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function pad(value, length) {
  return String(value).padStart(length, "0");
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
