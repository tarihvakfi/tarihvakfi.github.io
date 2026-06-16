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

const SOURCE_SPREADSHEET_ID = "1_UxaP20_KQjjhBhOKY-UBX2DdnkMMelAQh7dIPcCUFs";
const SITE_CONTENT_SHEET_NAME = "Site Metinleri";
const CORRECTION_SHEET_NAME = "Düzeltme Önerileri";
const CORRECTION_NOTIFICATION_EMAILS = "info@tarihvakfi.org.tr,arif.solmaz@gmail.com";

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

const ACTIVITY_CODE_INFO = {
  "İÇ": ["Toplantılar", "İç toplantı"],
  "İKO": ["Toplantılar", "İç kongre ve genel kurul"],
  KON: ["Toplantılar", "Konuşma / konferans / söyleşi"],
  PAN: ["Toplantılar", "Panel / forum / açık oturum"],
  ATA: ["Toplantılar", "Atölye / çalıştay"],
  SMN: ["Toplantılar", "Seminer / kurs"],
  SEM: ["Toplantılar", "Sempozyum"],
  KGR: ["Toplantılar", "Kongre"],
  YYA: ["Yayınlar", "Yurt Yayınları"],
  TVY: ["Yayınlar", "Tarih Vakfı yayınları"],
  ANS: ["Yayınlar", "Ansiklopediler"],
  DER: ["Yayınlar", "Dergiler"],
  "İST": ["Yayınlar", "İstanbul dergisi"],
  TT: ["Yayınlar", "Toplumsal Tarih"],
  TTA: ["Yayınlar", "Toplumsal Tarih Akademi"],
  NPT: ["Yayınlar", "New Perspectives on Turkey"],
  "BÜL": ["Yayınlar", "Bültenler"],
  TVH: ["Yayınlar", "Tarih Vakfı’ndan Haberler Bülteni"],
  "DŞE": ["Yayınlar", "Deniz Şenliği Bülteni"],
  YTB: ["Yayınlar", "Yerel Tarih Bülteni"],
  "TÇE": ["Yayınlar", "Tarihçe Gençler Tarih Yazıyor Yarışması Bülteni"],
  BRO: ["Yayınlar", "Broşürler"],
  BEL: ["Yayınlar", "Belgeseller"],
  SER: ["Toplantı ve yayın dışı etkinlikler", "Sergiler"],
  GEZ: ["Toplantı ve yayın dışı etkinlikler", "Kültür gezileri"],
  FES: ["Toplantı ve yayın dışı etkinlikler", "Festival / şenlik"],
  YAR: ["Toplantı ve yayın dışı etkinlikler", "Yarışmalar"],
  ANM: ["Toplantı ve yayın dışı etkinlikler", "Anma"],
  KNS: ["Toplantı ve yayın dışı etkinlikler", "Konser"],
  "SİN": ["Toplantı ve yayın dışı etkinlikler", "Sinema gösterimi"],
  YER: ["Projeler", "Yerel tarih projesi"],
  KUT: ["Projeler", "Kurum tarihi projesi"],
  KNT: ["Projeler", "Kent tarihi / kent müzesi projesi"],
  TEP: ["Projeler", "Tarih eğitimi projesi"],
  ARB: ["BBM", "Arşiv bağışı"],
  "KİB": ["BBM", "Kitap bağışı"],
};

const FALLBACK_ACTIVITY_CODES = {
  meeting: ["ÖTY", "Toplantılar", "Öteki toplantı"],
  publication: ["ÖTY", "Yayınlar", "Öteki yayın"],
  event: ["ÖTG", "Toplantı ve yayın dışı etkinlikler", "Öteki gösteri / etkinlik"],
  project: ["ÖTP", "Projeler", "Öteki proje"],
  bbm: ["ÖTB", "BBM", "Öteki BBM faaliyeti"],
};

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
    const content = readSiteContent();
    return jsonResponse({
      generatedAt: new Date().toISOString(),
      recordCount: records.length,
      content,
      records,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

function doPost(event) {
  try {
    const parameters = event && event.parameter ? event.parameter : {};
    if (parameters.form_type !== "chronology_correction") {
      return jsonResponse({
        ok: false,
        error: "Unsupported form type.",
      });
    }
    const submission = normalizeCorrectionSubmission(event);
    const result = appendCorrectionSubmission(submission);
    notifyCorrectionSubmission(submission);
    return jsonResponse({
      ok: true,
      row: result.row,
      receivedAt: submission.received_at,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

function normalizeCorrectionSubmission(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const parameterLists = event && event.parameters ? event.parameters : {};
  return {
    received_at: new Date().toISOString(),
    record_id: cleanText(parameters.record_id),
    record_title: cleanText(parameters.record_title),
    topics: fieldList(parameterLists, parameters, "topics").join(", "),
    current_value: cleanText(parameters.current_value),
    proposed_correction: cleanText(parameters.proposed_correction),
    evidence: cleanText(parameters.evidence),
    source_link: cleanText(parameters.source_link),
    name: cleanText(parameters.name),
    email: cleanText(parameters.email),
    note: cleanText(parameters.note),
    consent: cleanText(parameters.consent),
    page_url: cleanText(parameters.page_url),
  };
}

function fieldList(parameterLists, parameters, key) {
  const values = parameterLists && parameterLists[key] ? parameterLists[key] : [parameters[key]];
  return values.map(cleanText).filter(Boolean);
}

function appendCorrectionSubmission(submission) {
  if (!SOURCE_SPREADSHEET_ID || SOURCE_SPREADSHEET_ID.indexOf("PASTE_") === 0) {
    throw new Error("Set SOURCE_SPREADSHEET_ID before accepting correction submissions.");
  }
  const spreadsheet = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  const sheet = ensureCorrectionSheet(spreadsheet);
  sheet.appendRow([
    submission.received_at,
    submission.record_id,
    submission.record_title,
    submission.topics,
    submission.current_value,
    submission.proposed_correction,
    submission.evidence,
    submission.source_link,
    submission.name,
    submission.email,
    submission.note,
    submission.consent,
    submission.page_url,
  ]);
  return { row: sheet.getLastRow() };
}

function ensureCorrectionSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CORRECTION_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CORRECTION_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Alınma zamanı",
      "Kayıt ID",
      "Kayıt başlığı",
      "Düzeltme konusu",
      "Mevcut bilgi",
      "Önerilen düzeltme",
      "Kaynak / kanıt",
      "Kaynak bağlantısı veya künyesi",
      "Ad soyad",
      "E-posta",
      "Not",
      "İzin",
      "Sayfa URL",
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notifyCorrectionSubmission(submission) {
  try {
    MailApp.sendEmail({
      to: CORRECTION_NOTIFICATION_EMAILS,
      subject: `Kronoloji düzeltme önerisi: ${submission.record_id || "kayıt ID yok"}`,
      body: [
        `Kayıt ID: ${submission.record_id}`,
        `Kayıt başlığı: ${submission.record_title}`,
        `Düzeltme konusu: ${submission.topics}`,
        "",
        "Mevcut bilgi:",
        submission.current_value,
        "",
        "Önerilen düzeltme:",
        submission.proposed_correction,
        "",
        "Kaynak / kanıt:",
        submission.evidence,
        "",
        `Kaynak bağlantısı veya künyesi: ${submission.source_link}`,
        `Ad soyad: ${submission.name}`,
        `E-posta: ${submission.email}`,
        "",
        "Not:",
        submission.note,
        "",
        `Sayfa URL: ${submission.page_url}`,
        `Alınma zamanı: ${submission.received_at}`,
      ].join("\n"),
    });
  } catch (error) {
    console.warn("Correction notification email failed", error);
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
        const activity = assignActivityCode(itemKind, category, rawText, description);
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
          ...activity,
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

function readSiteContent() {
  if (!SOURCE_SPREADSHEET_ID || SOURCE_SPREADSHEET_ID.indexOf("PASTE_") === 0) return {};
  const spreadsheet = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SITE_CONTENT_SHEET_NAME);
  if (!sheet) return {};
  const values = sheet.getDataRange().getDisplayValues();
  const content = {};
  values.slice(1).forEach((row) => {
    const key = cleanText(row[0]);
    const value = cleanText(row[1]);
    if (!key || key.indexOf("#") === 0) return;
    content[key] = value;
  });
  return content;
}

function activityKey(value) {
  return cleanText(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasAnyCodeTerm(haystack) {
  const terms = Array.prototype.slice.call(arguments, 1);
  return terms.some((term) => {
    const key = activityKey(term);
    return key && new RegExp(`\\b${escapeRegExp(key)}\\b`).test(haystack);
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectLocationCode(haystack) {
  if (hasAnyCodeTerm(haystack, "ankara")) return "ANK";
  if (hasAnyCodeTerm(haystack, "izmir")) return "İZM";
  if (hasAnyCodeTerm(haystack, "antalya")) return "ANT";
  if (hasAnyCodeTerm(haystack, "yurtdışı", "yurt dışı", "diyarbakır", "eskişehir", "adana", "bodrum", "çanakkale")) return "ÖTE";
  return "";
}

function activityChoice(baseCode, haystack, group, label, status, note) {
  const info = ACTIVITY_CODE_INFO[baseCode] || ["", ""];
  const locationCode = detectLocationCode(haystack);
  return {
    activity_code: locationCode ? `${baseCode} ${locationCode}` : baseCode,
    activity_code_base: baseCode,
    activity_location_code: locationCode,
    activity_group: group || info[0],
    activity_label: label || info[1],
    activity_code_status: status || "mapped",
    activity_code_note: note || "",
  };
}

function fallbackActivity(kind, haystack, note) {
  const fallback = FALLBACK_ACTIVITY_CODES[kind];
  return activityChoice(fallback[0], haystack, fallback[1], fallback[2], "needs_review", note);
}

function assignActivityCode(itemKind, category, rawText, description) {
  const haystack = activityKey([itemKind, category, rawText, description].join(" "));
  const fallbackNote = "Kod, kaynak kategori/metinden otomatik önerildi; elle kontrol edilmeli.";

  if (itemKind === "publication") {
    if (hasAnyCodeTerm(haystack, "toplumsal tarih akademi", "tta")) return activityChoice("TTA", haystack);
    if (hasAnyCodeTerm(haystack, "toplumsal tarih", "d toplumsal tarih", "d toplumsal tarihi")) return activityChoice("TT", haystack);
    if (hasAnyCodeTerm(haystack, "istanbul dergisi", "d istanbul dergisi")) return activityChoice("İST", haystack);
    if (hasAnyCodeTerm(haystack, "new perspectives", "npt")) return activityChoice("NPT", haystack);
    if (hasAnyCodeTerm(haystack, "tarih vakfindan haberler", "haberler bulteni")) return activityChoice("TVH", haystack);
    if (hasAnyCodeTerm(haystack, "deniz senligi bulteni")) return activityChoice("DŞE", haystack);
    if (hasAnyCodeTerm(haystack, "yerel tarih bulteni")) return activityChoice("YTB", haystack);
    if (hasAnyCodeTerm(haystack, "tarihce gencler", "tarihce")) return activityChoice("TÇE", haystack);
    if (hasAnyCodeTerm(haystack, "bulten")) return activityChoice("BÜL", haystack);
    if (hasAnyCodeTerm(haystack, "yurt yayinlari", "yurt yayin")) return activityChoice("YYA", haystack);
    if (hasAnyCodeTerm(haystack, "vakif yayinlari", "tarih vakfi yayinlari")) return activityChoice("TVY", haystack);
    if (hasAnyCodeTerm(haystack, "ansiklopedi")) return activityChoice("ANS", haystack);
    if (hasAnyCodeTerm(haystack, "brosur")) return activityChoice("BRO", haystack);
    if (hasAnyCodeTerm(haystack, "belgesel")) return activityChoice("BEL", haystack);
    if (hasAnyCodeTerm(haystack, "dergi")) return activityChoice("DER", haystack);
    return fallbackActivity("publication", haystack, fallbackNote);
  }

  if (hasAnyCodeTerm(haystack, "arsiv")) return activityChoice("ARB", haystack);
  if (hasAnyCodeTerm(haystack, "kitap bagisi", "kitap bagis")) return activityChoice("KİB", haystack);
  if (hasAnyCodeTerm(haystack, "bagis")) return fallbackActivity("bbm", haystack, fallbackNote);

  if (hasAnyCodeTerm(haystack, "kurum tarihi", "p kurum")) return activityChoice("KUT", haystack);
  if (hasAnyCodeTerm(haystack, "yerel tarih projesi", "yerel tarih")) return activityChoice("YER", haystack);
  if (hasAnyCodeTerm(haystack, "kent muzesi", "kent tarihi", "kent bellegi")) return activityChoice("KNT", haystack);
  if (hasAnyCodeTerm(haystack, "tarih egitimi", "ders kitabi", "ders kitaplari", "ogrenci")) return activityChoice("TEP", haystack);
  if (hasAnyCodeTerm(haystack, "proje", "p diger", "arastirma")) return fallbackActivity("project", haystack, fallbackNote);

  if (hasAnyCodeTerm(haystack, "ic toplanti")) return activityChoice("İÇ", haystack);
  if (hasAnyCodeTerm(haystack, "genel kurul", "olagan genel kurul", "ic kongre")) return activityChoice("İKO", haystack);
  if (hasAnyCodeTerm(haystack, "kongre")) return activityChoice("KGR", haystack);
  if (hasAnyCodeTerm(haystack, "konferans", "konusma", "soylesi")) return activityChoice("KON", haystack);
  if (hasAnyCodeTerm(haystack, "panel", "forum", "acik oturum")) return activityChoice("PAN", haystack);
  if (hasAnyCodeTerm(haystack, "atolye", "calistay", "workshop")) return activityChoice("ATA", haystack);
  if (hasAnyCodeTerm(haystack, "seminer", "kurs")) return activityChoice("SMN", haystack);
  if (hasAnyCodeTerm(haystack, "sempozyum")) return activityChoice("SEM", haystack);
  if (hasAnyCodeTerm(haystack, "sergi")) return activityChoice("SER", haystack);
  if (hasAnyCodeTerm(haystack, "gezi")) return activityChoice("GEZ", haystack);
  if (hasAnyCodeTerm(haystack, "festival", "senlik")) return activityChoice("FES", haystack);
  if (hasAnyCodeTerm(haystack, "yarisma", "yaris", "odul")) {
    return activityChoice("YAR", haystack, null, null, hasAnyCodeTerm(haystack, "odul") ? "needs_review" : "mapped");
  }
  if (hasAnyCodeTerm(haystack, "anma")) return activityChoice("ANM", haystack);
  if (hasAnyCodeTerm(haystack, "konser")) return activityChoice("KNS", haystack);
  if (hasAnyCodeTerm(haystack, "sinema", "film gosterimi")) return activityChoice("SİN", haystack);

  if (itemKind === "organizational") return fallbackActivity("meeting", haystack, fallbackNote);
  return fallbackActivity("event", haystack, fallbackNote);
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
