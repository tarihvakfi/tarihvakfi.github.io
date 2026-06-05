const DATA_URL = "assets/data/chronology_public.json";
const CSV_URL = "assets/data/chronology_public.csv";

const KIND_LABELS = {
  event: "Etkinlik",
  publication: "Yayın",
  organizational: "Örgütsel iş",
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

const PAGE_SIZE = 100;
let allRecords = [];
let archivePage = 1;
let dashboardPage = 1;
let archiveView = "cards";

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
  allRecords = await loadData();
  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "timeline") initTimeline();
  if (page === "archive") initArchive();
  if (page === "dashboard") initDashboard();
  if (page === "item") initItem();
  if (page === "methodology") initMethodology();
  if (page === "data") initDataPage();
}

async function loadData() {
  const config = window.TVK_CHRONOLOGY_CONFIG || {};
  const sources = [];
  if (config.liveDataUrl && config.preferLiveData !== false) {
    sources.push({ label: "live", url: appendCacheBust(config.liveDataUrl), options: { cache: "no-store" } });
  }
  sources.push({ label: "static", url: DATA_URL, options: {} });

  let lastError;
  for (const source of sources) {
    try {
      const response = await fetch(source.url, source.options);
      if (!response.ok) {
        throw new Error(`${source.label}: ${response.status} ${response.statusText}`);
      }
      const payload = await response.json();
      const rows = extractRows(payload);
      if (!Array.isArray(rows)) {
        throw new Error(`${source.label}: response does not contain a record array`);
      }
      window.TVK_CHRONOLOGY_DATA_SOURCE = source.label;
      return normalizeRows(rows);
    } catch (error) {
      lastError = error;
      console.warn("Chronology data source failed", error);
    }
  }
  throw lastError || new Error("No chronology data source available");
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.chronology_public)) return payload.chronology_public;
  return null;
}

function normalizeRows(rows) {
  return rows.map((row) => ({
    ...row,
    _year: /^\d+$/.test(row.year || "") ? Number(row.year) : null,
    _sourceRow: Number(row.source_row || 0),
    _search: normalize(
      [
        row.id,
        row.period,
        row.item_kind,
        row.category,
        row.title,
        row.description,
        row.date_display,
        row.year,
        row.verification_status,
      ].join(" "),
    ),
  }));
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
  ["timelineSearch", "timelineKind", "timelinePeriod", "timelineStatus", "timelineYearFrom", "timelineYearTo"].forEach(
    (id) => document.getElementById(id)?.addEventListener("input", renderTimeline),
  );
  renderTimeline();
}

function initArchive() {
  setupFilterOptions("archive", allRecords);
  ["archiveSearch", "archiveKind", "archivePeriod", "archiveStatus", "archiveYearFrom", "archiveYearTo", "archiveSort"].forEach(
    (id) => document.getElementById(id)?.addEventListener("input", () => {
      archivePage = 1;
      renderArchive();
    }),
  );
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
  ["dashboardSearch", "dashboardKind", "dashboardPeriod", "dashboardStatus", "dashboardYearFrom", "dashboardYearTo"].forEach(
    (id) => document.getElementById(id)?.addEventListener("input", () => {
      dashboardPage = 1;
      renderDashboard();
    }),
  );
  renderDashboard();
}

function initItem() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const record = allRecords.find((row) => row.id === id);
  const target = document.getElementById("itemDetail");
  if (!target) return;
  if (!record) {
    target.innerHTML = `<div class="error">Bu kimlikle kayıt bulunamadı: <code>${escapeHtml(id || "")}</code></div>`;
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
          <span class="badge">${escapeHtml(record.period || "")}</span>
          <span class="badge">${escapeHtml(record.category || "Kategori yok")}</span>
        </div>
        <p class="lead">${escapeHtml(record.description || record.raw_text || "")}</p>
        ${record.public_note ? `<div class="note">${escapeHtml(record.public_note)}</div>` : ""}
      </article>
      <aside class="detail-box">
        <h2>Kayıt Bilgisi</h2>
        <dl class="detail-list">
          ${detailRow("Kayıt ID", record.id)}
          ${detailRow("Dönem", record.period)}
          ${detailRow("Tür", KIND_LABELS[record.item_kind] || record.item_kind)}
          ${detailRow("Kategori", record.category || "Belirtilmemiş")}
          ${detailRow("Tarih", record.date_display || record.year || "Belirtilmemiş")}
          ${detailRow("Kaynak", `${record.source_sheet}, satır ${record.source_row}`)}
          ${detailRow("Durum", STATUS_LABELS[record.verification_status] || record.verification_status)}
        </dl>
        <button class="button" type="button" data-copy="${escapeAttr(citation)}">Atıfı kopyala</button>
        <p class="copy-status" id="copyStatus"></p>
        <p><a href="contribute.html">Bu kayıt için düzeltme öner</a></p>
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
  setText("overviewSentence", `${total.toLocaleString("tr-TR")} kayıt, ${yearRange} aralığındaki dönemler ve kaynak satırları korunarak yayınlanıyor.`);
}

function renderMetrics(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const counts = countBy(records, (row) => row.item_kind);
  const statuses = countBy(records, (row) => row.verification_status);
  const [minYear, maxYear] = getYearRange(records);
  const cards = [
    ["Toplam kayıt", records.length.toLocaleString("tr-TR")],
    ["Yıl aralığı", minYear && maxYear ? `${minYear}-${maxYear}` : "-"],
    ["Etkinlik", (counts.event || 0).toLocaleString("tr-TR")],
    ["Yayın", (counts.publication || 0).toLocaleString("tr-TR")],
    ["Örgütsel iş", (counts.organizational || 0).toLocaleString("tr-TR")],
    ["Gözden geçirme", ((statuses.needs_review || 0) + (statuses.uncertain_date || 0) + (statuses.uncertain_category || 0)).toLocaleString("tr-TR")],
  ];
  target.innerHTML = cards
    .map(([label, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`)
    .join("");
}

function setupFilterOptions(prefix, records) {
  fillSelect(`${prefix}Kind`, unique(records.map((row) => row.item_kind)), "Tüm türler", KIND_LABELS);
  fillSelect(`${prefix}Period`, unique(records.map((row) => row.period)), "Tüm dönemler");
  fillSelect(`${prefix}Status`, unique(records.map((row) => row.verification_status)), "Tüm durumlar", STATUS_LABELS);
}

function renderTimeline() {
  const filtered = sortRecords(filterRecords("timeline", allRecords));
  const target = document.getElementById("timelineList");
  setText("timelineCount", `${filtered.length.toLocaleString("tr-TR")} kayıt gösteriliyor. Filtre uygulanmadığında tüm kamu verisi listelenir.`);
  if (!target) return;
  if (!filtered.length) {
    target.innerHTML = `<div class="error">Bu filtrelerle kayıt bulunamadı.</div>`;
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
    `${filtered.length.toLocaleString("tr-TR")} kayıt bulundu. ${start + 1}-${Math.min(start + PAGE_SIZE, filtered.length)} arası gösteriliyor.`,
  );
  const target = document.getElementById("archiveResults");
  if (!target) return;
  if (!filtered.length) {
    target.innerHTML = `<div class="error">Bu filtrelerle kayıt bulunamadı.</div>`;
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
  setText("dashboardCount", `${filtered.length.toLocaleString("tr-TR")} kayıt seçili. Grafikler ve tablo aynı filtreleri kullanır.`);
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
  const yearFrom = Number(document.getElementById(`${prefix}YearFrom`)?.value || "");
  const yearTo = Number(document.getElementById(`${prefix}YearTo`)?.value || "");
  return records.filter((row) => {
    if (search && !row._search.includes(search)) return false;
    if (kind && row.item_kind !== kind) return false;
    if (period && row.period !== period) return false;
    if (status && row.verification_status !== status) return false;
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
        <span class="badge">${escapeHtml(row.period || "")}</span>
      </div>
      <p class="item-title"><a href="item.html?id=${encodeURIComponent(row.id)}">${escapeHtml(row.title || row.raw_text || row.id)}</a></p>
      <p class="item-description">${escapeHtml(trimText(row.description || row.raw_text || "", 320))}</p>
      <div class="hero-actions">
        <a class="button secondary" href="item.html?id=${encodeURIComponent(row.id)}">Kaydı aç</a>
        <button class="button ghost" type="button" data-copy="${escapeAttr(makeCitation(row))}">Atıfı kopyala</button>
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
            <th>Tarih</th>
            <th>Başlık</th>
            <th>Tür</th>
            <th>Kategori</th>
            <th>Dönem</th>
            <th>Durum</th>
            <th>Kaynak</th>
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
    <button class="button ghost" type="button" data-page-prev ${current <= 1 ? "disabled" : ""}>Önceki</button>
    <span>${current} / ${total}</span>
    <button class="button ghost" type="button" data-page-next ${current >= total ? "disabled" : ""}>Sonraki</button>
  `;
  target.querySelector("[data-page-prev]")?.addEventListener("click", () => onChange(Math.max(1, current - 1)));
  target.querySelector("[data-page-next]")?.addEventListener("click", () => onChange(Math.min(total, current + 1)));
}

function renderYearChart(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const years = unique(records.map((row) => row.year).filter(Boolean)).sort((a, b) => Number(a) - Number(b));
  const kinds = ["event", "publication", "organizational"];
  const data = years.map((year) => {
    const rows = records.filter((row) => row.year === year);
    return {
      label: year,
      values: Object.fromEntries(kinds.map((kind) => [kind, rows.filter((row) => row.item_kind === kind).length])),
    };
  });
  target.innerHTML = stackedBarSvg(data, kinds, { height: 300, rotateLabels: years.length > 18 });
}

function renderPeriodChart(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const periods = unique(records.map((row) => row.period)).sort((a, b) => a.localeCompare(b, "tr"));
  const kinds = ["event", "publication", "organizational"];
  const data = periods.map((period) => {
    const rows = records.filter((row) => row.period === period);
    return {
      label: period.replace(" DÖNEM", ""),
      values: Object.fromEntries(kinds.map((kind) => [kind, rows.filter((row) => row.item_kind === kind).length])),
    };
  });
  target.innerHTML = stackedBarSvg(data, kinds, { height: 280 });
}

function renderKindChart(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const counts = countBy(records, (row) => row.item_kind);
  const data = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ label: KIND_LABELS[key] || key, value, color: KIND_COLORS[key] || "#7b7169" }));
  target.innerHTML = horizontalBarSvg(data, { height: 220 });
}

function renderCategoryChart(targetId, records) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const counts = countBy(records, (row) => row.category || "Kategori belirtilmemiş");
  const data = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([label, value]) => ({ label, value, color: "#8a2f2f" }));
  target.innerHTML = horizontalBarSvg(data, { height: Math.max(280, data.length * 30) });
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

function stackedBarSvg(data, keys, options = {}) {
  if (!data.length) return `<div class="loading">Bu filtrelerle grafik verisi yok.</div>`;
  const height = options.height || 280;
  const width = Math.max(760, data.length * 34 + 90);
  const chartTop = 22;
  const chartBottom = height - 58;
  const chartLeft = 50;
  const chartRight = width - 18;
  const chartHeight = chartBottom - chartTop;
  const gap = 8;
  const barWidth = Math.max(9, (chartRight - chartLeft) / data.length - gap);
  const max = Math.max(...data.map((item) => keys.reduce((sum, key) => sum + (item.values[key] || 0), 0)), 1);
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
          return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${KIND_COLORS[key] || "#7b7169"}"><title>${escapeHtml(item.label)} ${escapeHtml(KIND_LABELS[key] || key)}: ${value}</title></rect>`;
        })
        .join("");
      const labelY = chartBottom + 18;
      const label = options.rotateLabels
        ? `<text class="bar-label" x="${x + barWidth / 2}" y="${labelY}" transform="rotate(45 ${x + barWidth / 2} ${labelY})">${escapeHtml(item.label)}</text>`
        : `<text class="bar-label" x="${x + barWidth / 2}" y="${labelY}" text-anchor="middle">${escapeHtml(item.label)}</text>`;
      return `${parts}<text class="bar-value" x="${x + barWidth / 2}" y="${Math.max(chartTop + 12, y - 5)}" text-anchor="middle">${total}</text>${label}`;
    })
    .join("");
  return `
    <div style="overflow-x:auto">
      <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Kayıt sayısı grafiği">
        <line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#ded4c7" />
        ${bars}
      </svg>
    </div>
    ${legend(keys.map((key) => ({ label: KIND_LABELS[key] || key, color: KIND_COLORS[key] || "#7b7169" })))}
  `;
}

function horizontalBarSvg(data, options = {}) {
  if (!data.length) return `<div class="loading">Bu filtrelerle grafik verisi yok.</div>`;
  const width = 760;
  const rowHeight = 30;
  const height = options.height || Math.max(220, data.length * rowHeight + 34);
  const left = 190;
  const right = width - 58;
  const max = Math.max(...data.map((item) => item.value), 1);
  const rows = data
    .map((item, index) => {
      const y = 22 + index * rowHeight;
      const barWidth = ((right - left) * item.value) / max;
      return `
        <text class="bar-label" x="${left - 10}" y="${y + 14}" text-anchor="end">${escapeHtml(trimText(item.label, 26))}</text>
        <rect x="${left}" y="${y}" width="${barWidth}" height="18" rx="3" fill="${item.color}" />
        <text class="bar-value" x="${left + barWidth + 7}" y="${y + 14}">${item.value}</text>
      `;
    })
    .join("");
  return `
    <div style="overflow-x:auto">
      <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Yatay çubuk grafik">
        ${rows}
      </svg>
    </div>
  `;
}

function legend(items) {
  return `<div class="legend">${items.map((item) => `<span><i class="swatch" style="background:${item.color}"></i>${escapeHtml(item.label)}</span>`).join("")}</div>`;
}

function fillSelect(id, values, allLabel, labels = {}) {
  const select = document.getElementById(id);
  if (!select) return;
  const sorted = values.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "tr"));
  select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>${sorted
    .map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(labels[value] || value)}</option>`)
    .join("")}`;
}

function badge(value, type) {
  const label = type === "kind" ? KIND_LABELS[value] || value : STATUS_LABELS[value] || value;
  const css = type === "kind" ? `kind-${value}` : `status-${value}`;
  return `<span class="badge ${css}">${escapeHtml(label || "")}</span>`;
}

function detailRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "")}</dd></div>`;
}

function makeCitation(row) {
  const accessed = new Date().toLocaleDateString("tr-TR");
  return `Tarih Vakfı Dijital Kronolojisi, kayıt ${row.id}, erişim tarihi ${accessed}.`;
}

function attachCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button.getAttribute("data-copy") || "";
      try {
        await navigator.clipboard.writeText(text);
        setText("copyStatus", "Atıf kopyalandı.");
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
