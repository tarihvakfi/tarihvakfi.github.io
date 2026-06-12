const DATA_URL = "assets/data/chronology_public.json";
const CSV_URL = "assets/data/chronology_public.csv";
const CONTENT_URL = "assets/data/site_content.json";

const KIND_LABELS = {
  event: "Etkinlik",
  publication: "Yayın",
  organizational: "Örgütsel iş",
  project: "Proje",
  chronology: "Kronoloji",
  unknown: "Belirsiz",
};

const STATUS_LABELS = {
  verified: "Doğrulanmış",
  needs_review: "Gözden geçirilecek",
  uncertain_date: "Tarih belirsiz",
  uncertain_category: "Kategori belirsiz",
  empty_or_invalid: "Geçersiz",
};

const KIND_COLORS = {
  event: "#4d6475",
  publication: "#8a2f2f",
  organizational: "#626b45",
  project: "#6f5f8f",
  chronology: "#a26f26",
  unknown: "#7b7169",
};

const STATUS_COLORS = {
  verified: "#4f7b5b",
  needs_review: "#a26f26",
  uncertain_date: "#b56a5e",
  uncertain_category: "#6f5f8f",
  empty_or_invalid: "#7b7169",
};

const ACTIVITY_GROUPS = ["Toplantılar", "Yayınlar", "Toplantı ve yayın dışı etkinlikler", "Projeler", "BBM"];

const ACTIVITY_GROUP_LABELS = {
  Toplantılar: "Toplantılar",
  Yayınlar: "Yayınlar",
  "Toplantı ve yayın dışı etkinlikler": "Etkinlikler",
  Projeler: "Projeler",
  BBM: "BBM",
};

const ACTIVITY_GROUP_COLORS = {
  Toplantılar: "#4d6475",
  Yayınlar: "#8a2f2f",
  "Toplantı ve yayın dışı etkinlikler": "#a26f26",
  Projeler: "#626b45",
  BBM: "#7b7169",
};

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

const PAGE_SIZE = 100;
const LIVE_REFRESH_TIMEOUT_MS = 12000;
const PERIOD_LABELS_BY_NUMBER = {
  1: "1. Dönem (1991–1995)",
  2: "2. Dönem (1996–2000)",
  3: "3. Dönem (2001–2005)",
  4: "4. Dönem (2006–2010)",
  5: "5. Dönem (2011–2015)",
  6: "6. Dönem (2016–2020)",
  7: "7. Dönem (2021–2026)",
};
const KIND_ID_PREFIXES = {
  event: "eve",
  publication: "pub",
  organizational: "org",
  project: "pro",
  chronology: "chr",
  unknown: "unk",
};
const LEGACY_CONTENT_GUARDS = {
  "archive.footer.note": ["kayıt ID, erişim tarihi"],
  "methodology.citation.text_1": ["kayıt [id], erişim tarihi"],
  "citation.format": ["kayıt {id}, erişim tarihi"],
  "filters.all_activity_codes": ["Tüm faaliyet kodları"],
};
let allRecords = [];
let siteContent = {};
let archivePage = 1;
let dashboardPage = 1;
let archiveView = "cards";
let currentPage = "";
let liveRefreshAttempted = false;
let staticAliasRecords = [];

document.addEventListener("DOMContentLoaded", () => {
  markCurrentNav();
  boot().catch((error) => {
    document.querySelector("main")?.insertAdjacentHTML(
      "afterbegin",
      `<div class="error">Veri yüklenemedi. Siteyi yerel olarak görüntülerken <code>python3 -m http.server</code> ile açmayı deneyin.<br>${escapeHtml(error.message)}</div>`,
    );
  });
});

async function boot() {
  currentPage = document.body.dataset.page;
  const [records, content] = await Promise.all([loadData(), loadSiteContent()]);
  allRecords = records;
  siteContent = content;
  applySiteContent();
  if (currentPage === "home") initHome();
  if (currentPage === "timeline") initTimeline();
  if (currentPage === "archive") initArchive();
  if (currentPage === "dashboard") initDashboard();
  if (currentPage === "item") initItem();
  if (currentPage === "methodology") initMethodology();
  if (currentPage === "data") initDataPage();
  refreshLiveDataInBackground();
}

async function loadData() {
  const staticSource = { label: "static", url: DATA_URL, options: {} };
  const liveSource = getLiveSource();
  const sources = [staticSource, liveSource].filter(Boolean);

  let lastError;
  for (const source of sources) {
    try {
      const rows = await loadRowsFromSource(source);
      let records = normalizeRows(rows);
      if (source.label === "static") {
        staticAliasRecords = records;
      }
      if (source.label === "live") {
        records = attachStaticAliases(records, staticAliasRecords);
      }
      window.TVK_CHRONOLOGY_DATA_SOURCE = source.label;
      return records;
    } catch (error) {
      lastError = error;
      console.warn("Chronology data source failed", error);
    }
  }
  throw lastError || new Error("No chronology data source available");
}

async function loadRowsFromSource(source) {
  const payload = await fetchPayload(source);
  const rows = extractRows(payload);
  if (!Array.isArray(rows)) {
    throw new Error(`${source.label}: response does not contain a record array`);
  }
  return rows;
}

async function loadSiteContent() {
  try {
    const response = await fetch(CONTENT_URL);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = await response.json();
    return extractContent(payload);
  } catch (error) {
    console.warn("Site content source failed", error);
    return {};
  }
}

function getLiveSource() {
  const config = window.TVK_CHRONOLOGY_CONFIG || {};
  if (!config.liveDataUrl || config.preferLiveData === false) return null;
  return {
    label: "live",
    url: appendCacheBust(config.liveDataUrl),
    options: { cache: "no-store" },
    timeoutMs: LIVE_REFRESH_TIMEOUT_MS,
  };
}

async function fetchPayload(source) {
  const response = await fetchWithTimeout(source.url, source.options || {}, source.timeoutMs);
  if (!response.ok) {
    throw new Error(`${source.label}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 0) {
  if (!timeoutMs) return fetch(url, options);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function refreshLiveDataInBackground() {
  const liveSource = getLiveSource();
  if (!liveSource || window.TVK_CHRONOLOGY_DATA_SOURCE === "live") return;
  liveRefreshAttempted = true;
  try {
    const payload = await fetchPayload(liveSource);
    const rows = extractRows(payload);
    if (!Array.isArray(rows)) {
      throw new Error("live: response does not contain a record array");
    }
    allRecords = attachStaticAliases(normalizeRows(rows), staticAliasRecords);
    const liveContent = extractContent(payload);
    if (Object.keys(liveContent).length) {
      siteContent = { ...siteContent, ...liveContent };
      applySiteContent();
    }
    window.TVK_CHRONOLOGY_DATA_SOURCE = "live";
    refreshCurrentPage();
  } catch (error) {
    console.warn("Chronology live refresh failed", error);
    if (currentPage === "item") initItem();
  }
}

function refreshCurrentPage() {
  if (currentPage === "home") {
    renderMetrics("homeMetrics", allRecords);
    renderOverviewText();
    renderYearChart("homeYearChart", allRecords);
    renderPeriodChart("homePeriodChart", allRecords);
    renderKindChart("homeKindChart", allRecords);
    renderQualityChart("homeQualityChart", allRecords);
    renderRecentRecords("homeRecords", sortRecords(allRecords).slice(0, 8));
  }
  if (currentPage === "timeline") {
    setupFilterOptions("timeline", allRecords);
    renderTimeline();
  }
  if (currentPage === "archive") {
    setupFilterOptions("archive", allRecords);
    renderArchive();
  }
  if (currentPage === "dashboard") {
    setupFilterOptions("dashboard", allRecords);
    renderDashboard();
  }
  if (currentPage === "item") initItem();
  if (currentPage === "methodology") renderMetrics("methodMetrics", allRecords);
  if (currentPage === "data") renderMetrics("dataMetrics", allRecords);
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.chronology_public)) return payload.chronology_public;
  return null;
}

function extractContent(payload) {
  if (!payload || Array.isArray(payload)) return {};
  const source = payload.content || payload.siteContent || payload.site_content || payload;
  if (!source || Array.isArray(source) || typeof source !== "object") return {};
  return Object.entries(source).reduce((acc, [key, value]) => {
    const cleanKey = String(key || "").trim();
    if (cleanKey && value !== undefined && value !== null && !isLegacyContentValue(cleanKey, value)) {
      acc[cleanKey] = String(value);
    }
    return acc;
  }, {});
}

function isLegacyContentValue(key, value) {
  const needles = LEGACY_CONTENT_GUARDS[key];
  if (!needles) return false;
  const text = String(value || "").toLocaleLowerCase("tr-TR");
  return needles.some((needle) => text.includes(needle.toLocaleLowerCase("tr-TR")));
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const enriched = row.activity_code ? row : { ...row, ...assignActivityCode(row.item_kind, row.category, row.raw_text, row.description) };
    const sourceSheet = cleanRecordValue(enriched.source_sheet || enriched.sheet_name || enriched.period);
    const sourceRow = Number(enriched.source_row || 0);
    const period = normalizePeriodLabel(enriched.period || sourceSheet);
    const itemKind = cleanRecordValue(enriched.item_kind || "unknown");
    const normalized = {
      ...enriched,
      period,
      source_sheet: sourceSheet,
      source_row: sourceRow || enriched.source_row,
      item_kind: itemKind,
    };
    return {
      ...normalized,
      _aliases: recordAliases(normalized),
      _year: /^\d+$/.test(normalized.year || "") ? Number(normalized.year) : null,
      _sourceRow: Number(normalized.source_row || 0),
      _search: normalize(
        [
          normalized.id,
          normalized.period,
          normalized.source_sheet,
          normalized.item_kind,
          normalized.category,
          normalized.activity_code,
          normalized.activity_code_base,
          normalized.activity_group,
          normalized.activity_label,
          normalized.title,
          normalized.description,
          normalized.date_display,
          normalized.year,
          normalized.verification_status,
        ].join(" "),
      ),
    };
  });
}

function cleanRecordValue(value) {
  return String(value || "").trim();
}

function normalizePeriodLabel(value) {
  const periodNumber = periodNumberFromText(value);
  return periodNumber && PERIOD_LABELS_BY_NUMBER[periodNumber] ? PERIOD_LABELS_BY_NUMBER[periodNumber] : cleanRecordValue(value);
}

function periodNumberFromText(value) {
  const match = cleanRecordValue(value).match(/^([1-7])\.\s*D[öoÖO]NEM/i);
  return match ? Number(match[1]) : null;
}

function recordAliases(row) {
  return unique([row.id, row.legacy_id, row.legacyId, liveStyleRecordId(row)].filter(Boolean).map(normalizeRecordId));
}

function liveStyleRecordId(row) {
  const periodNumber = periodNumberFromText(row.period || row.source_sheet || row.sheet_name);
  const sourceRow = Number(row.source_row || row._sourceRow || 0);
  const prefix = KIND_ID_PREFIXES[row.item_kind] || cleanRecordValue(row.item_kind).slice(0, 3).toLocaleLowerCase("en-US");
  if (!periodNumber || !sourceRow || !prefix) return "";
  return `tvk-${padNumber(periodNumber, 2)}-${padNumber(sourceRow, 4)}-${prefix}`;
}

function padNumber(value, length) {
  return String(value).padStart(length, "0");
}

function normalizeRecordId(value) {
  try {
    return decodeURIComponent(String(value || "").trim()).toLocaleLowerCase("en-US");
  } catch {
    return String(value || "").trim().toLocaleLowerCase("en-US");
  }
}

function findRecordById(id) {
  const normalizedId = normalizeRecordId(id);
  if (!normalizedId) return null;
  return allRecords.find((row) => (row._aliases || recordAliases(row)).includes(normalizedId)) || null;
}

function attachStaticAliases(records, staticRecords) {
  if (!staticRecords.length) return records;
  const liveIds = new Map(records.map((row) => [normalizeRecordId(row.id), row]));
  const aliasesByRecord = new Map(records.map((row) => [row, [...(row._aliases || recordAliases(row))]]));
  const uniqueLiveKeys = uniqueRecordKeyMap(records);
  const uniqueStaticKeys = uniqueRecordKeyMap(staticRecords);

  staticRecords.forEach((staticRecord) => {
    const aliases = staticRecord._aliases || recordAliases(staticRecord);
    const exactLiveRecord = liveIds.get(normalizeRecordId(liveStyleRecordId(staticRecord)));
    const keyedLiveRecord = recordMatchingUniqueKey(staticRecord, uniqueLiveKeys, uniqueStaticKeys);
    const target = exactLiveRecord || keyedLiveRecord;
    if (!target) return;
    aliasesByRecord.set(target, unique([...(aliasesByRecord.get(target) || []), ...aliases]));
  });

  return records.map((row) => ({ ...row, _aliases: aliasesByRecord.get(row) || row._aliases || recordAliases(row) }));
}

function uniqueRecordKeyMap(records) {
  const counts = new Map();
  records.forEach((row) => {
    recordMatchKeys(row).forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
  });
  const matches = new Map();
  records.forEach((row) => {
    recordMatchKeys(row).forEach((key) => {
      if (counts.get(key) === 1) matches.set(key, row);
    });
  });
  return matches;
}

function recordMatchingUniqueKey(row, liveKeys, staticKeys) {
  for (const key of recordMatchKeys(row)) {
    if (staticKeys.get(key) === row && liveKeys.has(key)) return liveKeys.get(key);
  }
  return null;
}

function recordMatchKeys(row) {
  const periodNumber = periodNumberFromText(row.period || row.source_sheet || row.sheet_name);
  const sourceRow = Number(row.source_row || row._sourceRow || 0);
  if (!periodNumber || !sourceRow) return [];
  const keys = [`row:${periodNumber}:${sourceRow}`];
  const titleKey = normalize(row.title || row.description || row.raw_text || "").slice(0, 120);
  if (titleKey) keys.unshift(`title:${periodNumber}:${sourceRow}:${titleKey}`);
  return keys;
}

function shouldWaitForLiveRecord(id) {
  return Boolean(id && getLiveSource() && window.TVK_CHRONOLOGY_DATA_SOURCE !== "live" && !liveRefreshAttempted);
}

function appendCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

function markCurrentNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.dataset.page === page) link.setAttribute("aria-current", "page");
  });
}

function applySiteContent() {
  const pageTitle = contentText(`${currentPage}.meta.title`, document.title);
  if (pageTitle) document.title = pageTitle;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute("content", contentText(`${currentPage}.meta.description`, contentText("site.description", metaDescription.getAttribute("content") || "")));
  }

  document.querySelectorAll(".brand").forEach((brand) => {
    const mark = brand.querySelector(".brand-mark");
    brand.textContent = contentText("nav.brand", "Tarih Vakfı Dijital Kronolojisi");
    if (mark) brand.prepend(mark, " ");
  });

  const navLabels = {
    timeline: "nav.timeline",
    archive: "nav.archive",
    dashboard: "nav.dashboard",
    methodology: "nav.methodology",
    data: "nav.data",
  };
  Object.entries(navLabels).forEach(([pageName, key]) => {
    document.querySelectorAll(`.nav-links a[data-page="${pageName}"]`).forEach((link) => {
      link.textContent = contentText(key, link.textContent);
    });
  });

  document.querySelectorAll("[data-content]").forEach((element) => {
    const key = element.getAttribute("data-content") || "";
    element.textContent = contentText(key, compactText(element.textContent));
  });
  document.querySelectorAll("[data-content-html]").forEach((element) => {
    const key = element.getAttribute("data-content-html") || "";
    element.innerHTML = contentText(key, element.innerHTML);
  });
  document.querySelectorAll("[data-content-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-content-placeholder") || "";
    element.setAttribute("placeholder", contentText(key, element.getAttribute("placeholder") || ""));
  });
  document.querySelectorAll("[data-content-aria-label]").forEach((element) => {
    const key = element.getAttribute("data-content-aria-label") || "";
    element.setAttribute("aria-label", contentText(key, element.getAttribute("aria-label") || ""));
  });
}

function contentText(key, fallback = "") {
  const value = siteContent[key];
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function contentFormat(key, values, fallback = "") {
  return formatTemplate(contentText(key, fallback), values);
}

function formatTemplate(template, values) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => {
    return values[name] === undefined || values[name] === null ? match : values[name];
  });
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function initHome() {
  renderMetrics("homeMetrics", allRecords);
  renderOverviewText();
  renderYearChart("homeYearChart", allRecords);
  renderPeriodChart("homePeriodChart", allRecords);
  renderKindChart("homeKindChart", allRecords);
  renderQualityChart("homeQualityChart", allRecords);
  renderRecentRecords("homeRecords", sortRecords(allRecords).slice(0, 8));
}

function initTimeline() {
  setupFilterOptions("timeline", allRecords);
  addFilterListeners(["timelineSearch", "timelineKind", "timelinePeriod", "timelineStatus", "timelineCode", "timelineYearFrom", "timelineYearTo"], renderTimeline);
  renderTimeline();
}

function initArchive() {
  setupFilterOptions("archive", allRecords);
  addFilterListeners(["archiveSearch", "archiveKind", "archivePeriod", "archiveStatus", "archiveCode", "archiveYearFrom", "archiveYearTo", "archiveSort"], () => {
    archivePage = 1;
    renderArchive();
  });
  document.querySelectorAll("[data-archive-view]").forEach((button) => {
    button.addEventListener("click", () => {
      archiveView = button.dataset.archiveView || "cards";
      document.querySelectorAll("[data-archive-view]").forEach((item) => item.classList.toggle("active", item === button));
      renderArchive();
    });
  });
  renderArchive();
}

function initDashboard() {
  renderMetrics("dashboardMetrics", allRecords);
  setupFilterOptions("dashboard", allRecords);
  addFilterListeners(["dashboardSearch", "dashboardKind", "dashboardPeriod", "dashboardStatus", "dashboardCode", "dashboardYearFrom", "dashboardYearTo"], () => {
    dashboardPage = 1;
    renderDashboard();
  });
  renderDashboard();
}

function addFilterListeners(ids, handler) {
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener("input", handler);
    element.addEventListener("change", handler);
  });
}

function initItem() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const record = findRecordById(id);
  const target = document.getElementById("itemDetail");
  if (!target) return;
  if (!record) {
    if (shouldWaitForLiveRecord(id)) {
      target.innerHTML = `<div class="loading">${escapeHtml(contentText("item.loading_live", "Canlı veri kontrol ediliyor."))}</div>`;
      return;
    }
    target.innerHTML = `<div class="error">${escapeHtml(contentFormat("item.not_found", { id: id || "" }, `Bu kimlikle kayıt bulunamadı: ${id || ""}`))}</div>`;
    return;
  }
  document.title = `${record.title || record.id} | Tarih Vakfı Dijital Kronolojisi`;
  const citation = makeCitation(record);
  target.innerHTML = `
    <section class="record-detail">
      <article class="detail-box">
        <p class="eyebrow">${escapeHtml(record.date_display || record.year || "Tarih belirsiz")}</p>
        <h1>${escapeHtml(record.title || record.raw_text || record.id)}</h1>
        <div class="item-meta">
          ${badge(record.item_kind, "kind")}
          ${badge(record.verification_status, "status")}
          ${activityBadge(record)}
          <span class="badge">${escapeHtml(record.period || "")}</span>
          <span class="badge">${escapeHtml(record.category || "Kategori yok")}</span>
        </div>
        <p class="lead">${escapeHtml(record.description || record.raw_text || "")}</p>
        ${record.public_note ? `<div class="note">${escapeHtml(record.public_note)}</div>` : ""}
      </article>
      <aside class="detail-box">
        <h2>${escapeHtml(contentText("item.info.title", "Kayıt Bilgisi"))}</h2>
        <dl class="detail-list">
          ${detailRow(contentText("item.field.id", "Kayıt ID"), record.id)}
          ${detailRow(contentText("item.field.period", "Dönem"), record.period)}
          ${detailRow(contentText("item.field.kind", "Tür"), KIND_LABELS[record.item_kind] || record.item_kind)}
          ${detailRow(contentText("item.field.category", "Kategori"), record.category || contentText("common.unspecified", "Belirtilmemiş"))}
          ${detailRow(contentText("item.field.activity_code", "Faaliyet kodu"), activityText(record))}
          ${detailRow(contentText("item.field.activity_status", "Kod durumu"), activityStatusText(record))}
          ${detailRow(contentText("item.field.date", "Tarih"), record.date_display || record.year || contentText("common.unspecified", "Belirtilmemiş"))}
          ${detailRow(contentText("item.field.source", "Kaynak"), contentFormat("item.source_format", { sheet: record.source_sheet, row: record.source_row }, `${record.source_sheet}, satır ${record.source_row}`))}
          ${detailRow(contentText("item.field.status", "Durum"), STATUS_LABELS[record.verification_status] || record.verification_status)}
        </dl>
        <button class="button" type="button" data-copy="${escapeAttr(citation)}">${escapeHtml(contentText("record.copy_citation", "Atıfı kopyala"))}</button>
        <p class="copy-status" id="copyStatus"></p>
        <p><a href="contribute.html">${escapeHtml(contentText("item.suggest_correction", "Bu kayıt için düzeltme öner"))}</a></p>
      </aside>
    </section>
  `;
  attachCopyButtons();
}

function initMethodology() {
  renderMetrics("methodMetrics", allRecords);
}

function initDataPage() {
  renderMetrics("dataMetrics", allRecords);
}

function renderOverviewText() {
  const total = allRecords.length;
  const yearRange = getYearRange(allRecords).join("-");
  setText(
    "overviewSentence",
    contentFormat(
      "home.overview_sentence",
      { total: total.toLocaleString("tr-TR"), year_range: yearRange },
      `${total.toLocaleString("tr-TR")} kayıt, ${yearRange} aralığındaki dönemler ve kaynak satırları korunarak yayınlanıyor.`,
    ),
  );
}

function renderMetrics(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const counts = countBy(records, (row) => row.item_kind);
  const statuses = countBy(records, (row) => row.verification_status);
  const [minYear, maxYear] = getYearRange(records);
  const cards = [
    [contentText("metrics.total_records", "Toplam kayıt"), records.length.toLocaleString("tr-TR")],
    [contentText("metrics.year_range", "Yıl aralığı"), minYear && maxYear ? `${minYear}-${maxYear}` : "-"],
    [contentText("metrics.events", "Etkinlik"), (counts.event || 0).toLocaleString("tr-TR")],
    [contentText("metrics.publications", "Yayın"), (counts.publication || 0).toLocaleString("tr-TR")],
    [contentText("metrics.organizational", "Örgütsel iş"), (counts.organizational || 0).toLocaleString("tr-TR")],
    [
      contentText("metrics.review", "Gözden geçirme"),
      ((statuses.needs_review || 0) + (statuses.uncertain_date || 0) + (statuses.uncertain_category || 0)).toLocaleString("tr-TR"),
    ],
  ];
  target.innerHTML = cards
    .map(([label, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`)
    .join("");
}

function setupFilterOptions(prefix, records) {
  fillSelect(`${prefix}Kind`, unique(records.map((row) => row.item_kind)), contentText("filters.all_kinds", "Tüm türler"), KIND_LABELS);
  fillSelect(`${prefix}Period`, unique(records.map((row) => row.period)), contentText("filters.all_periods", "Tüm dönemler"));
  fillSelect(`${prefix}Status`, unique(records.map((row) => row.verification_status)), contentText("filters.all_statuses", "Tüm durumlar"), STATUS_LABELS);
  fillSelect(
    `${prefix}Code`,
    unique(records.map((row) => row.activity_code_base || row.activity_code)),
    contentText("filters.all_activity_codes", "Tüm kodlar"),
    activityCodeLabels(records),
  );
  setYearRangeDefaults(prefix, records);
}

function setYearRangeDefaults(prefix, records) {
  const [minYear, maxYear] = getYearRange(records);
  const from = document.getElementById(`${prefix}YearFrom`);
  const to = document.getElementById(`${prefix}YearTo`);
  if (from && minYear) {
    from.min = minYear;
    from.max = maxYear || minYear;
    if (!from.dataset.readyDefaultApplied && !from.value) {
      from.value = minYear;
      from.dataset.readyDefaultApplied = "true";
    }
  }
  if (to && maxYear) {
    to.min = minYear || maxYear;
    to.max = maxYear;
    if (!to.dataset.readyDefaultApplied && !to.value) {
      to.value = maxYear;
      to.dataset.readyDefaultApplied = "true";
    }
  }
}

function renderTimeline() {
  const filtered = sortRecords(filterRecords("timeline", allRecords));
  const target = document.getElementById("timelineList");
  setText(
    "timelineCount",
    contentFormat(
      "timeline.result_count",
      { count: filtered.length.toLocaleString("tr-TR") },
      `${filtered.length.toLocaleString("tr-TR")} kayıt gösteriliyor. Filtre uygulanmadığında tüm kamu verisi listelenir.`,
    ),
  );
  if (!target) return;
  if (!filtered.length) {
    target.innerHTML = `<div class="error">${escapeHtml(contentText("common.no_results", "Bu filtrelerle kayıt bulunamadı."))}</div>`;
    return;
  }
  const groups = groupBy(filtered, (row) => row.year || "Tarihsiz");
  target.innerHTML = Object.entries(groups)
    .map(([year, rows]) => `
      <section class="year-group">
        <div class="year-sticky">${escapeHtml(year)}</div>
        <div class="year-items">
          ${rows.map(renderItemCard).join("")}
        </div>
      </section>
    `)
    .join("");
}

function renderArchive() {
  let filtered = filterRecords("archive", allRecords);
  filtered = sortRecords(filtered, document.getElementById("archiveSort")?.value || "chronological");
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  archivePage = Math.min(archivePage, pageCount);
  const start = (archivePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  setText(
    "archiveCount",
    contentFormat(
      "archive.result_count",
      {
        count: filtered.length.toLocaleString("tr-TR"),
        start: (start + 1).toLocaleString("tr-TR"),
        end: Math.min(start + PAGE_SIZE, filtered.length).toLocaleString("tr-TR"),
      },
      `${filtered.length.toLocaleString("tr-TR")} kayıt bulundu. ${start + 1}-${Math.min(start + PAGE_SIZE, filtered.length)} arası gösteriliyor.`,
    ),
  );
  const target = document.getElementById("archiveResults");
  if (!target) return;
  if (!filtered.length) {
    target.innerHTML = `<div class="error">${escapeHtml(contentText("common.no_results", "Bu filtrelerle kayıt bulunamadı."))}</div>`;
    renderPagination("archivePagination", 1, 1, () => {});
    return;
  }
  target.innerHTML = archiveView === "table" ? renderArchiveTable(visible) : `<div class="archive-grid">${visible.map(renderItemCardWithActions).join("")}</div>`;
  renderPagination("archivePagination", archivePage, pageCount, (page) => {
    archivePage = page;
    renderArchive();
  });
  attachCopyButtons();
}

function renderDashboard() {
  const filtered = filterRecords("dashboard", allRecords);
  renderMetrics("dashboardMetrics", filtered);
  setText(
    "dashboardCount",
    contentFormat(
      "dashboard.result_count",
      { count: filtered.length.toLocaleString("tr-TR") },
      `${filtered.length.toLocaleString("tr-TR")} kayıt seçili. Grafikler ve tablo aynı filtreleri kullanır.`,
    ),
  );
  renderYearChart("dashboardYearChart", filtered);
  renderPeriodChart("dashboardPeriodChart", filtered);
  renderCategoryChart("dashboardCategoryChart", filtered);
  renderQualityChart("dashboardQualityChart", filtered);
  renderDashboardTable(filtered);
}

function renderDashboardTable(records) {
  const sorted = sortRecords(records);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  dashboardPage = Math.min(dashboardPage, pageCount);
  const start = (dashboardPage - 1) * PAGE_SIZE;
  const visible = sorted.slice(start, start + PAGE_SIZE);
  const target = document.getElementById("dashboardTable");
  if (!target) return;
  target.innerHTML = renderArchiveTable(visible);
  renderPagination("dashboardPagination", dashboardPage, pageCount, (page) => {
    dashboardPage = page;
    renderDashboard();
  });
}

function filterRecords(prefix, records) {
  const search = normalize(document.getElementById(`${prefix}Search`)?.value || "");
  const kind = document.getElementById(`${prefix}Kind`)?.value || "";
  const period = document.getElementById(`${prefix}Period`)?.value || "";
  const status = document.getElementById(`${prefix}Status`)?.value || "";
  const activityCode = document.getElementById(`${prefix}Code`)?.value || "";
  const yearFrom = Number(document.getElementById(`${prefix}YearFrom`)?.value || "");
  const yearTo = Number(document.getElementById(`${prefix}YearTo`)?.value || "");
  return records.filter((row) => {
    if (search && !row._search.includes(search)) return false;
    if (kind && row.item_kind !== kind) return false;
    if (period && row.period !== period) return false;
    if (status && row.verification_status !== status) return false;
    if (activityCode && (row.activity_code_base || row.activity_code) !== activityCode) return false;
    if (yearFrom && (!row._year || row._year < yearFrom)) return false;
    if (yearTo && (!row._year || row._year > yearTo)) return false;
    return true;
  });
}

function sortRecords(records, sort = "chronological") {
  const rows = [...records];
  rows.sort((a, b) => {
    if (sort === "reverse") return dateSortValue(b) - dateSortValue(a) || a.id.localeCompare(b.id, "tr");
    if (sort === "category") return (a.category || "").localeCompare(b.category || "", "tr") || dateSortValue(a) - dateSortValue(b);
    if (sort === "period") return (a.period || "").localeCompare(b.period || "", "tr") || dateSortValue(a) - dateSortValue(b);
    return dateSortValue(a) - dateSortValue(b) || (a.period || "").localeCompare(b.period || "", "tr") || a._sourceRow - b._sourceRow;
  });
  return rows;
}

function dateSortValue(row) {
  if (row.start_date && /^\d{4}-\d{2}-\d{2}$/.test(row.start_date)) {
    return Number(row.start_date.replaceAll("-", ""));
  }
  if (row._year) return row._year * 10000 + 9999;
  return 99999999;
}

function renderItemCard(row) {
  return `
    <a class="item-card" href="item.html?id=${encodeURIComponent(row.id)}">
      <div class="item-meta">
        <span class="badge">${escapeHtml(row.date_display || row.year || "Tarih belirsiz")}</span>
        ${badge(row.item_kind, "kind")}
        ${badge(row.verification_status, "status")}
        ${activityBadge(row)}
        <span class="badge">${escapeHtml(row.period || "")}</span>
      </div>
      <p class="item-title">${escapeHtml(row.title || row.raw_text || row.id)}</p>
      <p class="item-description">${escapeHtml(trimText(row.description || row.raw_text || "", 260))}</p>
    </a>
  `;
}

function renderItemCardWithActions(row) {
  return `
    <article class="item-card">
      <div class="item-meta">
        <span class="badge">${escapeHtml(row.date_display || row.year || "Tarih belirsiz")}</span>
        ${badge(row.item_kind, "kind")}
        ${badge(row.verification_status, "status")}
        ${activityBadge(row)}
        <span class="badge">${escapeHtml(row.period || "")}</span>
      </div>
      <p class="item-title"><a href="item.html?id=${encodeURIComponent(row.id)}">${escapeHtml(row.title || row.raw_text || row.id)}</a></p>
      <p class="item-description">${escapeHtml(trimText(row.description || row.raw_text || "", 320))}</p>
      <div class="hero-actions">
        <a class="button secondary" href="item.html?id=${encodeURIComponent(row.id)}">${escapeHtml(contentText("record.open", "Kaydı aç"))}</a>
        <button class="button ghost" type="button" data-copy="${escapeAttr(makeCitation(row))}">${escapeHtml(contentText("record.copy_citation", "Atıfı kopyala"))}</button>
      </div>
    </article>
  `;
}

function renderArchiveTable(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(contentText("table.date", "Tarih"))}</th>
            <th>${escapeHtml(contentText("table.title", "Başlık"))}</th>
            <th>${escapeHtml(contentText("table.kind", "Tür"))}</th>
            <th>${escapeHtml(contentText("table.activity_code", "Faaliyet kodu"))}</th>
            <th>${escapeHtml(contentText("table.category", "Kategori"))}</th>
            <th>${escapeHtml(contentText("table.period", "Dönem"))}</th>
            <th>${escapeHtml(contentText("table.status", "Durum"))}</th>
            <th>${escapeHtml(contentText("table.source", "Kaynak"))}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.date_display || row.year || "")}</td>
                  <td><a href="item.html?id=${encodeURIComponent(row.id)}">${escapeHtml(row.title || row.id)}</a></td>
                  <td>${escapeHtml(KIND_LABELS[row.item_kind] || row.item_kind)}</td>
                  <td>${escapeHtml(activityText(row))}</td>
                  <td>${escapeHtml(row.category || "")}</td>
                  <td>${escapeHtml(row.period || "")}</td>
                  <td>${escapeHtml(STATUS_LABELS[row.verification_status] || row.verification_status)}</td>
                  <td>${escapeHtml(`${row.source_sheet}, ${row.source_row}`)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRecentRecords(targetId, rows) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = `<div class="archive-grid">${rows.map(renderItemCard).join("")}</div>`;
}

function renderPagination(targetId, current, total, onChange) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = `
    <button class="button ghost" type="button" data-page-prev ${current <= 1 ? "disabled" : ""}>${escapeHtml(contentText("pagination.previous", "Önceki"))}</button>
    <span>${current} / ${total}</span>
    <button class="button ghost" type="button" data-page-next ${current >= total ? "disabled" : ""}>${escapeHtml(contentText("pagination.next", "Sonraki"))}</button>
  `;
  target.querySelector("[data-page-prev]")?.addEventListener("click", () => onChange(Math.max(1, current - 1)));
  target.querySelector("[data-page-next]")?.addEventListener("click", () => onChange(Math.min(total, current + 1)));
}

function renderYearChart(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const years = unique(records.map((row) => row.year).filter(Boolean)).sort((a, b) => Number(a) - Number(b));
  const kinds = ["event", "publication", "organizational"];
  const isHomeChart = targetId === "homeYearChart";
  const data = years.map((year) => {
    const rows = records.filter((row) => row.year === year);
    return {
      label: year,
      values: Object.fromEntries(kinds.map((kind) => [kind, rows.filter((row) => row.item_kind === kind).length])),
    };
  });
  target.innerHTML = stackedBarSvg(data, kinds, {
    height: isHomeChart ? 260 : 300,
    minWidth: isHomeChart ? 960 : 760,
    labelEvery: years.length > 18 ? 5 : 1,
    showValues: !isHomeChart,
    rotateLabels: false,
    ariaLabel: "Yıllara göre kayıt sayısı grafiği",
  });
}

function renderPeriodChart(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const periods = unique(records.map((row) => row.period)).sort((a, b) => a.localeCompare(b, "tr"));
  const data = periods.map((period) => {
    const rows = records.filter((row) => row.period === period);
    return {
      label: shortPeriodLabel(period),
      detail: periodRangeLabel(period),
      values: Object.fromEntries(ACTIVITY_GROUPS.map((group) => [group, rows.filter((row) => row.activity_group === group).length])),
    };
  });
  target.innerHTML = stackedHorizontalBarSvg(data, ACTIVITY_GROUPS, {
    labels: ACTIVITY_GROUP_LABELS,
    colors: ACTIVITY_GROUP_COLORS,
    ariaLabel: "Dönemlere göre faaliyet alanları grafiği",
  });
}

function renderKindChart(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const counts = countBy(records, (row) => row.item_kind);
  const data = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ label: KIND_LABELS[key] || key, value, color: KIND_COLORS[key] || "#7b7169" }));
  target.innerHTML = kindDonutSvg(data);
}

function renderCategoryChart(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const byLabel = records.reduce((acc, row) => {
    const label = activityChartLabel(row);
    if (!acc[label]) acc[label] = { value: 0, code: row.activity_code_base || "", group: row.activity_group || "" };
    acc[label].value += 1;
    return acc;
  }, {});
  const data = Object.entries(byLabel)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 16)
    .map(([label, item]) => ({ label, value: item.value, color: ACTIVITY_GROUP_COLORS[item.group] || "#8a2f2f", detail: item.code }));
  target.innerHTML = horizontalBarSvg(data, { height: Math.max(390, data.length * 42), labelWidth: 285, width: 980, rowHeight: 42, barHeight: 24 });
}

function renderQualityChart(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const counts = countBy(records, (row) => row.verification_status);
  const data = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ label: STATUS_LABELS[key] || key, value, color: STATUS_COLORS[key] || "#7b7169" }));
  target.innerHTML = horizontalBarSvg(data, { height: 230 });
}

function shortPeriodLabel(period) {
  const match = String(period || "").match(/^(\d+)\.\s*Dönem/i);
  return match ? `${match[1]}. Dönem` : String(period || "Dönem");
}

function periodRangeLabel(period) {
  const match = String(period || "").match(/\(([^)]+)\)/);
  return match ? match[1] : "";
}

function activityChartLabel(row) {
  const baseCode = row.activity_code_base || row.activity_code || "";
  const compactLabels = {
    "İÇ": "İç toplantı",
    "İKO": "Genel kurul / iç kongre",
    KON: "Konferans / söyleşi",
    PAN: "Panel / forum",
    ATA: "Atölye / çalıştay",
    SMN: "Seminer / kurs",
    SEM: "Sempozyum",
    KGR: "Kongre",
    YYA: "Yurt Yayınları",
    TVY: "Tarih Vakfı yayınları",
    ANS: "Ansiklopediler",
    DER: "Dergiler",
    "İST": "İstanbul dergisi",
    TT: "Toplumsal Tarih",
    TTA: "Toplumsal Tarih Akademi",
    NPT: "New Perspectives on Turkey",
    "BÜL": "Bültenler",
    TVH: "Haberler bülteni",
    "DŞE": "Deniz Şenliği bülteni",
    YTB: "Yerel Tarih bülteni",
    "TÇE": "Tarihçe bülteni",
    BRO: "Broşürler",
    BEL: "Belgeseller",
    SER: "Sergiler",
    GEZ: "Kültür gezileri",
    FES: "Festival / şenlik",
    YAR: "Yarışmalar",
    ANM: "Anma",
    KNS: "Konser",
    "SİN": "Sinema gösterimi",
    YER: "Yerel tarih projesi",
    KUT: "Kurum tarihi projesi",
    KNT: "Kent tarihi / müze",
    TEP: "Tarih eğitimi projesi",
    ARB: "Arşiv bağışı",
    "KİB": "Kitap bağışı",
    "ÖTG": "Diğer etkinlikler",
    "ÖTP": "Diğer projeler",
    "ÖTB": "Diğer BBM",
  };
  if (baseCode === "ÖTY" && row.activity_group === "Yayınlar") return "Diğer yayınlar";
  if (baseCode === "ÖTY" && row.activity_group === "Toplantılar") return "Diğer toplantılar";
  return compactLabels[baseCode] || row.activity_label || baseCode || "Kod belirtilmemiş";
}

function codeKey(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasAnyCodeTerm(haystack, ...terms) {
  return terms.some((term) => {
    const key = codeKey(term);
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

function activityChoice(baseCode, haystack, group, label, status = "mapped", note = "") {
  const info = ACTIVITY_CODE_INFO[baseCode] || ["", ""];
  const locationCode = detectLocationCode(haystack);
  return {
    activity_code: locationCode ? `${baseCode} ${locationCode}` : baseCode,
    activity_code_base: baseCode,
    activity_location_code: locationCode,
    activity_group: group || info[0],
    activity_label: label || info[1],
    activity_code_status: status,
    activity_code_note: note,
  };
}

function fallbackActivity(kind, haystack, note) {
  const fallback = FALLBACK_ACTIVITY_CODES[kind];
  return activityChoice(fallback[0], haystack, fallback[1], fallback[2], "needs_review", note);
}

function assignActivityCode(itemKind, category, rawText, description) {
  const haystack = codeKey([itemKind, category, rawText, description].join(" "));
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

function stackedBarSvg(data, keys, options = {}) {
  if (!data.length) return `<div class="loading">Bu filtrelerle grafik verisi yok.</div>`;
  const height = options.height || 280;
  const labels = options.labels || KIND_LABELS;
  const colors = options.colors || KIND_COLORS;
  const width = Math.max(options.minWidth || 760, data.length * (options.stepWidth || 30) + 92);
  const chartTop = 24;
  const chartBottom = height - 46;
  const chartLeft = 56;
  const chartRight = width - 18;
  const chartHeight = chartBottom - chartTop;
  const gap = options.gap == null ? 7 : options.gap;
  const barWidth = Math.max(9, (chartRight - chartLeft) / data.length - gap);
  const max = Math.max(...data.map((item) => keys.reduce((sum, key) => sum + (item.values[key] || 0), 0)), 1);
  const labelEvery = Math.max(1, Number(options.labelEvery || 1));
  const tickFractions = [0, 0.25, 0.5, 0.75, 1];
  const ticks = tickFractions
    .map((fraction) => {
      const y = chartBottom - fraction * chartHeight;
      const value = Math.round(max * fraction);
      return `
        <line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="#eadfce" stroke-width="1" />
        <text class="axis-tick" x="${chartLeft - 9}" y="${y + 4}" text-anchor="end">${value}</text>
      `;
    })
    .join("");
  const bars = data
    .map((item, index) => {
      let y = chartBottom;
      const x = chartLeft + index * (barWidth + gap);
      const total = keys.reduce((sum, key) => sum + (item.values[key] || 0), 0);
      const parts = keys
        .map((key) => {
          const value = item.values[key] || 0;
          const h = (value / max) * chartHeight;
          y -= h;
          return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${colors[key] || "#7b7169"}"><title>${escapeHtml(item.label)} ${escapeHtml(labels[key] || key)}: ${value}</title></rect>`;
        })
        .join("");
      const labelY = chartBottom + 20;
      const nextItem = data[index + 1];
      const nextIsLast = index === data.length - 2;
      const numericLabel = Number(item.label);
      const numericNextLabel = Number(nextItem && nextItem.label);
      const collidesWithLast = nextIsLast
        && Number.isFinite(numericLabel)
        && Number.isFinite(numericNextLabel)
        && Math.abs(numericNextLabel - numericLabel) <= 1;
      const shouldShowLabel = (index % labelEvery === 0 || index === data.length - 1) && !collidesWithLast;
      const label = shouldShowLabel
        ? `<text class="bar-label" x="${x + barWidth / 2}" y="${labelY}" text-anchor="middle">${escapeHtml(item.label)}</text>`
        : "";
      const value = options.showValues === false
        ? ""
        : `<text class="bar-value" x="${x + barWidth / 2}" y="${Math.max(chartTop + 12, y - 5)}" text-anchor="middle">${total}</text>`;
      return `${parts}${value}${label}`;
    })
    .join("");
  return `
    <div style="overflow-x:auto">
      <svg class="chart" style="min-width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(options.ariaLabel || "Kayıt sayısı grafiği")}">
        ${ticks}
        <line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#ded4c7" />
        <line x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartBottom}" stroke="#ded4c7" />
        ${bars}
      </svg>
    </div>
    ${legend(keys.map((key) => ({ label: labels[key] || key, color: colors[key] || "#7b7169" })))}
  `;
}

function stackedHorizontalBarSvg(data, keys, options = {}) {
  if (!data.length) return `<div class="loading">Bu filtrelerle grafik verisi yok.</div>`;
  const labels = options.labels || KIND_LABELS;
  const colors = options.colors || KIND_COLORS;
  const totals = data.map((item) => keys.reduce((sum, key) => sum + (item.values[key] || 0), 0));
  const max = Math.max(...totals, 1);
  const rows = data
    .map((item, index) => {
      const total = totals[index];
      const scaledWidth = Math.max(3, (total / max) * 100);
      const segments = keys
        .filter((key) => item.values[key])
        .map((key) => {
          const value = item.values[key] || 0;
          const percent = total ? (value / total) * 100 : 0;
          return `<span class="stacked-segment" style="width:${percent}%;background:${escapeAttr(colors[key] || "#7b7169")}" title="${escapeAttr(`${item.label} ${labels[key] || key}: ${value}`)}"></span>`;
        })
        .join("");
      return `
        <div class="stacked-row">
          <span class="stacked-label"><strong>${escapeHtml(item.label)}</strong>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}</span>
          <span class="stacked-track">
            <span class="stacked-scale" style="width:${scaledWidth}%">${segments}</span>
          </span>
          <strong class="stacked-value">${total.toLocaleString("tr-TR")}</strong>
        </div>
      `;
    })
    .join("");
  return `
    <div class="stacked-list" role="img" aria-label="${escapeAttr(options.ariaLabel || "Katmanlı yatay çubuk grafik")}">
      ${rows}
    </div>
    ${legend(keys.map((key) => ({ label: labels[key] || key, color: colors[key] || "#7b7169" })))}
  `;
}

function kindDonutSvg(data) {
  if (!data.length) return `<div class="loading">Bu filtrelerle grafik verisi yok.</div>`;
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = data
    .map((item) => {
      const value = Number(item.value || 0);
      const length = total ? (value / total) * circumference : 0;
      const segment = `
        <circle class="kind-donut-segment"
          cx="64" cy="64" r="${radius}"
          stroke="${escapeAttr(item.color)}"
          stroke-dasharray="${Math.max(0, length - 1.5)} ${circumference}"
          stroke-dashoffset="${-offset}">
          <title>${escapeHtml(item.label)}: ${value.toLocaleString("tr-TR")}</title>
        </circle>`;
      offset += length;
      return segment;
    })
    .join("");
  const rows = data
    .map((item) => {
      const value = Number(item.value || 0);
      const percent = total ? Math.round((value / total) * 1000) / 10 : 0;
      return `
        <div class="kind-donut-row">
          <span class="swatch" style="background:${escapeAttr(item.color)}"></span>
          <span>${escapeHtml(item.label)}</span>
          <strong>${value.toLocaleString("tr-TR")}</strong>
          <small>%${String(percent).replace(".", ",")}</small>
        </div>`;
    })
    .join("");
  return `
    <div class="kind-donut" role="img" aria-label="Kayıt türü dağılımı">
      <div class="kind-donut-figure">
        <svg class="kind-donut-svg" viewBox="0 0 128 128" aria-hidden="true">
          <circle class="kind-donut-bg" cx="64" cy="64" r="${radius}"></circle>
          <g transform="rotate(-90 64 64)">${segments}</g>
        </svg>
        <div class="kind-donut-center">
          <strong>${total.toLocaleString("tr-TR")}</strong>
          <span>kayıt</span>
        </div>
      </div>
      <div class="kind-donut-list">${rows}</div>
    </div>
  `;
}

function horizontalBarSvg(data, options = {}) {
  if (!data.length) return `<div class="loading">Bu filtrelerle grafik verisi yok.</div>`;
  const max = Math.max(...data.map((item) => item.value), 1);
  return `
    <div class="bar-list" role="img" aria-label="Yatay çubuk grafik">
      ${data
    .map((item, index) => {
      const percent = Math.max(1.5, (item.value / max) * 100);
      const value = Number(item.value).toLocaleString("tr-TR");
      return `
        <div class="bar-row" title="${escapeAttr(item.detail ? `${item.label} (${item.detail}): ${value}` : `${item.label}: ${value}`)}">
          <span class="bar-list-label">${escapeHtml(trimText(item.label, options.labelMax || 34))}</span>
          <span class="bar-track">
            <span class="bar-fill" style="width:${percent}%; background:${escapeAttr(item.color)}"></span>
          </span>
          <strong class="bar-list-value">${escapeHtml(value)}</strong>
        </div>
      `;
    })
    .join("")}
    </div>
  `;
}

function legend(items) {
  return `<div class="legend">${items.map((item) => `<span><i class="swatch" style="background:${item.color}"></i>${escapeHtml(item.label)}</span>`).join("")}</div>`;
}

function fillSelect(id, values, allLabel, labels = {}) {
  const select = document.getElementById(id);
  if (!select) return;
  const selected = select.value;
  const sorted = values.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "tr"));
  select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>${sorted
    .map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(labels[value] || value)}</option>`)
    .join("")}`;
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

function badge(value, type) {
  const label = type === "kind" ? KIND_LABELS[value] || value : STATUS_LABELS[value] || value;
  const css = type === "kind" ? `kind-${value}` : `status-${value}`;
  return `<span class="badge ${css}">${escapeHtml(label || "")}</span>`;
}

function activityBadge(row) {
  if (!row.activity_code) return `<span class="badge">Kod yok</span>`;
  const review = row.activity_code_status === "needs_review" ? " kod-review" : "";
  return `<span class="badge activity-code${review}" title="${escapeAttr(row.activity_label || "")}">${escapeHtml(row.activity_code)}</span>`;
}

function activityText(row) {
  if (!row.activity_code) return "";
  const label = row.activity_label ? ` - ${row.activity_label}` : "";
  return `${row.activity_code}${label}`;
}

function activityStatusText(row) {
  if (!row.activity_code_status) return "";
  const status =
    row.activity_code_status === "needs_review" ? contentText("activity.status.needs_review", "Elle kontrol edilmeli") : contentText("activity.status.mapped", "Eşlendi");
  return row.activity_code_note ? `${status}. ${row.activity_code_note}` : status;
}

function activityCodeLabels(records) {
  return records.reduce((labels, row) => {
    const code = row.activity_code_base || row.activity_code;
    if (code && !labels[code]) labels[code] = `${code} - ${activityChartLabel(row)}`;
    return labels;
  }, {});
}

function detailRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "")}</dd></div>`;
}

function makeCitation(row) {
  const accessed = new Date().toLocaleDateString("tr-TR");
  const title = row.title || row.raw_text || row.id;
  const date = row.date_display || row.year || contentText("common.unspecified", "Belirtilmemiş");
  const kind = KIND_LABELS[row.item_kind] || row.item_kind || "";
  const source = contentFormat("item.source_format", { sheet: row.source_sheet, row: row.source_row }, `${row.source_sheet}, satır ${row.source_row}`);
  const url = new URL(`item.html?id=${encodeURIComponent(row.id)}`, window.location.href).href;
  const fallback = `Tarih Vakfı Dijital Kronolojisi, "{title}", {date}, {kind}, kayıt {id}, kaynak: {source}, {url}, erişim tarihi {accessed}.`;
  const configured = contentText("citation.format", fallback);
  const template = /\{(title|date|kind|source|url)\}/.test(configured) ? configured : fallback;
  return formatTemplate(template, { id: row.id, title, date, kind, source, url, accessed });
}

function attachCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button.getAttribute("data-copy") || "";
      try {
        await navigator.clipboard.writeText(text);
        setText("copyStatus", contentText("copy.success", "Atıf kopyalandı."));
      } catch {
        setText("copyStatus", text);
      }
    });
  });
}

function getYearRange(records) {
  const years = records.map((row) => row._year).filter(Boolean).sort((a, b) => a - b);
  return years.length ? [years[0], years[years.length - 1]] : ["", ""];
}

function countBy(records, fn) {
  return records.reduce((acc, row) => {
    const key = fn(row) || "";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function groupBy(records, fn) {
  return records.reduce((acc, row) => {
    const key = fn(row);
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function normalize(value) {
  return String(value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

function trimText(value, max) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text;
}

function setText(id, value) {
  const target = document.getElementById(id);
  if (target) target.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
