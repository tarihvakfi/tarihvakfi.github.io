#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "js", "config.public.js");
const SNAPSHOT_PATH = path.join(ROOT, "js", "snapshot.js");
const LATEST_LIMIT = 50;
const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
const TR_WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

async function main() {
  const endpoint = readEndpointUrl();
  const existingSnapshot = readSnapshotPayload();
  const livePayload = await fetchPublicPayload(endpoint);
  const liveMode = livePayload?.publicSummary?.period?.mode;

  let outputPayload = livePayload;
  if (liveMode !== "rolling_7_days") {
    outputPayload = repairRollingPayload(livePayload, existingSnapshot);
    console.log(
      `Endpoint returned ${liveMode || "unknown"}; synthesized rolling_7_days snapshot from public data.`
    );
  }

  if (outputPayload?.publicSummary?.period?.mode !== "rolling_7_days") {
    throw new Error("Could not produce a rolling_7_days public snapshot.");
  }

  writeSnapshot(outputPayload);
  console.log(`Snapshot refreshed: ${outputPayload.publicSummary.period.label}`);
}

function readEndpointUrl() {
  const config = fs.readFileSync(CONFIG_PATH, "utf8");
  const match = config.match(/window\.__SHEETSYNC_URL__\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("Could not find __SHEETSYNC_URL__ in js/config.public.js");
  return match[1];
}

async function fetchPublicPayload(endpoint) {
  const url = new URL(endpoint);
  url.searchParams.set("public", "1");
  url.searchParams.set("period", "rolling_7_days");
  url.searchParams.set("t", String(Date.now()));

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Endpoint failed: HTTP ${response.status}`);
  const body = await response.json();
  if (!body || body.ok !== true) {
    throw new Error(`Endpoint returned not ok: ${JSON.stringify(body).slice(0, 300)}`);
  }
  const payload = body.data || body;
  if (!payload?.publicSummary) throw new Error("Endpoint payload is missing publicSummary.");
  return payload;
}

function readSnapshotPayload() {
  if (!fs.existsSync(SNAPSHOT_PATH)) return null;
  const text = fs.readFileSync(SNAPSHOT_PATH, "utf8");
  const primary = text.match(/window\.TVF_PUBLIC_DATA\s*=\s*(\{.*?\})\s*;\s*window\.__SNAPSHOT__/s);
  if (primary) return JSON.parse(primary[1]);
  const fallback = text.match(/window\.__SNAPSHOT__\s*=\s*(\{.*\})\s*;\s*$/s);
  if (!fallback) return null;
  const obj = JSON.parse(fallback[1]);
  return obj.data || obj;
}

function repairRollingPayload(livePayload, snapshotPayload) {
  const liveSummary = livePayload?.publicSummary;
  const livePeriod = liveSummary?.period || {};
  const endISO = toISODate(livePeriod.endDate || livePayload.generatedAt || new Date());
  if (!endISO) throw new Error("Cannot infer rolling period end date.");
  const startISO = addDaysISO(endISO, -6);

  const liveDays = dayMapFromSummary(liveSummary, startISO, endISO);
  const snapshotDays = dayMapFromSummary(snapshotPayload?.publicSummary, startISO, endISO);
  const latestRows = usableLatestRows(livePayload.latestActivity, startISO, endISO);
  const latestDays = buildLatestDayMap(latestRows.usable, liveDays, startISO, endISO);

  const days = dateRangeISO(startISO, endISO).map((iso) => {
    return clone(liveDays[iso] || latestDays[iso] || snapshotDays[iso] || emptyDay(iso));
  });

  const byMaterial = buildMaterialRows(days);
  const byVolunteer = buildVolunteerRows(days);
  const byBox = buildBoxRows(days, [
    liveSummary?.byBox,
    snapshotPayload?.publicSummary?.byBox,
  ]);
  const totals = buildTotals(liveSummary?.totals || {}, days, byMaterial, byVolunteer, byBox);
  const latestActivity = mergeLatestActivity(livePayload.latestActivity, snapshotPayload?.latestActivity, startISO, endISO);

  const warnings = [...(liveSummary?.warnings || [])];
  pushWarning(warnings, {
    code: "workflow_repaired_rolling_period",
    message:
      "Apps Script endpoint returned a non-rolling period; GitHub Actions synthesized the rolling seven-day snapshot from public day summaries and latestActivity.",
  });
  if (latestRows.futureCount > 0) {
    pushWarning(warnings, {
      code: "future_latest_activity_filtered",
      message: `${latestRows.futureCount} future-dated latestActivity rows were excluded from the public snapshot refresh.`,
    });
  }
  if (latestRows.coverageMayBeCapped) {
    pushWarning(warnings, {
      code: "latest_activity_cap_may_truncate_rolling_snapshot",
      message:
        "The endpoint latestActivity feed reached its cap before the rolling window start; redeploy Apps Script for a full rolling aggregate.",
    });
  }
  if (latestRows.normalizedPageRows > 0) {
    pushWarning(warnings, {
      code: "latest_activity_page_units_normalized",
      message:
        `${latestRows.normalizedPageRows} page_detail latestActivity rows were counted as one public page row each while repairing the rolling snapshot.`,
    });
  }

  const repairedSummary = {
    ...liveSummary,
    generatedAt: liveSummary?.generatedAt || livePayload.generatedAt,
    source: {
      ...(liveSummary?.source || {}),
      recordsAreFullAggregate: true,
      volunteerCredit:
        liveSummary?.source?.volunteerCredit || "credit-visible, ID-safe volunteer display",
    },
    period: {
      mode: "rolling_7_days",
      startDate: startISO,
      endDate: endISO,
      label: `Güncel dönem · ${dateRangeLabel(startISO, endISO)}`,
      isPartial: false,
    },
    totals,
    byDay: days,
    byMaterial,
    byVolunteer,
    byBox,
    highlights: buildHighlights(days, byMaterial),
    warnings,
  };

  return {
    ...livePayload,
    generatedAt: livePayload.generatedAt || repairedSummary.generatedAt,
    publicSummary: repairedSummary,
    trackSummary: livePayload.trackSummary || snapshotPayload?.trackSummary,
    latestActivity,
  };
}

function dayMapFromSummary(summary, startISO, endISO) {
  const map = {};
  for (const day of Array.isArray(summary?.byDay) ? summary.byDay : []) {
    const iso = toISODate(day.dateISO);
    if (iso && iso >= startISO && iso <= endISO) {
      map[iso] = { ...clone(day), dateISO: iso };
    }
  }
  return map;
}

function usableLatestRows(rows, startISO, endISO) {
  const usable = [];
  let futureCount = 0;
  let rawCount = 0;
  let normalizedPageRows = 0;
  let oldestNonFutureISO = null;

  for (const row of Array.isArray(rows) ? rows : []) {
    rawCount += 1;
    const iso = toISODate(row.dateISO || row.when);
    if (!iso) continue;
    if (iso > endISO) {
      futureCount += 1;
      continue;
    }
    if (!oldestNonFutureISO || iso < oldestNonFutureISO) oldestNonFutureISO = iso;
    if (iso < startISO) continue;
    const label = publicLabel(row.volunteerLabel);
    if (!label) continue;
    const normalized = normalizeLatestRow(row, iso, label);
    if (Number(row.pagesDone || 0) !== Number(normalized.pagesDone || 0)) normalizedPageRows += 1;
    usable.push(normalized);
  }

  return {
    usable,
    futureCount,
    normalizedPageRows,
    coverageMayBeCapped: rawCount >= LATEST_LIMIT && oldestNonFutureISO && oldestNonFutureISO > startISO,
  };
}

function buildLatestDayMap(rows, liveDays, startISO, endISO) {
  const grouped = {};
  for (const row of rows) {
    const iso = toISODate(row.dateISO || row.when);
    if (!iso || iso < startISO || iso > endISO || liveDays[iso]) continue;
    if (!grouped[iso]) grouped[iso] = [];
    grouped[iso].push(row);
  }
  return Object.fromEntries(Object.entries(grouped).map(([iso, dayRows]) => [iso, dayFromLatestRows(iso, dayRows)]));
}

function dayFromLatestRows(iso, rows) {
  const contributors = {};
  const materialCounts = {};
  const boxLabels = [];
  const times = [];
  let pageRows = 0;
  let activityRows = 0;
  let pagesDone = 0;

  for (const row of rows) {
    const label = publicLabel(row.volunteerLabel);
    if (!label) continue;
    const isPage = row.kind === "page";
    const pageUnits = Number(row.pagesDone || (isPage ? 1 : 0));
    if (isPage) pageRows += 1;
    else activityRows += 1;
    pagesDone += pageUnits;
    if (row.when) times.push(String(row.when));

    const material = String(row.material || "belgeler").trim() || "belgeler";
    materialCounts[material] = (materialCounts[material] || 0) + 1;
    if (row.boxLabel) addUnique(boxLabels, String(row.boxLabel));

    const key = foldName(label);
    if (!contributors[key]) {
      contributors[key] = {
        label,
        publicRole: row.publicRole || "",
        records: 0,
        pageRows: 0,
        activityRows: 0,
        pagesDone: 0,
      };
    }
    contributors[key].records += 1;
    contributors[key].pageRows += isPage ? 1 : 0;
    contributors[key].activityRows += isPage ? 0 : 1;
    contributors[key].pagesDone += pageUnits;
    if (!contributors[key].publicRole && row.publicRole) contributors[key].publicRole = row.publicRole;
  }

  const contributorRows = Object.values(contributors).sort((a, b) => b.records - a.records || trCompare(a.label, b.label));
  return {
    dateISO: iso,
    weekdayTR: weekdayTR(iso),
    dayNumber: Number(iso.slice(8, 10)),
    records: pageRows + activityRows,
    pageRows,
    activityRows,
    pagesDone,
    volunteersCount: contributorRows.length,
    volunteerNames: contributorRows.map((item) => item.label),
    coordination: [],
    contributors: contributorRows,
    boxesCount: boxLabels.length,
    boxLabels,
    materials: materialRowsFromCounts(materialCounts),
    firstTime: times.length ? times.slice().sort()[0] : null,
    lastTime: times.length ? times.slice().sort().at(-1) : null,
    summarySentence: contributorRows.length
      ? `Bugün ${pageRows + activityRows} katkı kaydı görünür oldu.`
      : "Bugün için görünür katkı yok.",
  };
}

function buildMaterialRows(days) {
  const counts = {};
  for (const day of days) {
    for (const item of Array.isArray(day.materials) ? day.materials : []) {
      const material = item.material || item.label;
      if (!material) continue;
      if (!counts[material]) counts[material] = { material, label: item.label || material, count: 0 };
      counts[material].count += Number(item.count || 0);
    }
  }
  return withPercents(Object.values(counts).sort((a, b) => b.count - a.count || trCompare(a.label, b.label)));
}

function buildVolunteerRows(days) {
  const rows = {};
  for (const day of days) {
    for (const item of [...(day.contributors || []), ...(day.coordination || [])]) {
      const label = publicLabel(item.label);
      if (!label) continue;
      const key = foldName(label);
      if (!rows[key]) {
        rows[key] = {
          label,
          publicRole: item.publicRole || "",
          records: 0,
          pageRows: 0,
          activityRows: 0,
          pagesDone: 0,
          boxes: [],
          boxBreakdown: [],
        };
      }
      rows[key].records += Number(item.records || 0);
      rows[key].pageRows += Number(item.pageRows || 0);
      rows[key].activityRows += Number(item.activityRows || 0);
      rows[key].pagesDone += Number(item.pagesDone || 0);
      if (!rows[key].publicRole && item.publicRole) rows[key].publicRole = item.publicRole;
      for (const box of day.boxLabels || []) addUnique(rows[key].boxes, box);
    }
  }
  return Object.values(rows)
    .map((row) => ({
      ...row,
      topBox: row.boxes[0] || null,
      boxBreakdown: row.boxes.map((boxLabel) => ({ boxLabel, records: 1 })),
    }))
    .sort((a, b) => b.records - a.records || trCompare(a.label, b.label));
}

function buildBoxRows(days, templateGroups) {
  const templates = {};
  for (const group of templateGroups) {
    for (const row of Array.isArray(group) ? group : []) {
      const label = row.boxLabel || row.label || (row.box ? `Kutu ${row.box}` : "");
      if (label) templates[foldName(label)] = clone(row);
    }
  }

  const rows = {};
  for (const day of days) {
    for (const boxLabel of day.boxLabels || []) {
      const key = foldName(boxLabel);
      if (!rows[key]) {
        const template = templates[key] || {};
        rows[key] = {
          ...template,
          box: template.box || boxLabel.replace(/^Kutu\s+/i, ""),
          boxLabel,
          label: template.label || boxLabel,
          done: template.done ?? 0,
          target: template.target ?? null,
          percent: template.percent ?? null,
          remaining: template.remaining ?? null,
          records: 0,
          pageRows: 0,
          activityRows: 0,
          periodRecords: 0,
          periodPageRows: 0,
          periodPagesDone: 0,
          contributors: [],
          topContributors: [],
          contributorsCount: 0,
          lastActivityDate: null,
          materialCounts: [],
          materials: [],
          _materialCounts: {},
        };
      }
      const row = rows[key];
      row.records += Number(day.records || 0);
      row.pageRows += Number(day.pageRows || 0);
      row.activityRows += Number(day.activityRows || 0);
      row.periodRecords += Number(day.records || 0);
      row.periodPageRows += Number(day.pageRows || 0);
      row.periodPagesDone += Number(day.pagesDone || 0);
      if (!row.lastActivityDate || day.dateISO > row.lastActivityDate) row.lastActivityDate = day.dateISO;
      for (const item of day.materials || []) {
        const material = item.material || item.label;
        if (!material) continue;
        row._materialCounts[material] = (row._materialCounts[material] || 0) + Number(item.count || 0);
      }
      mergeBoxContributors(row, day.contributors || []);
    }
  }

  return Object.values(rows)
    .map((row) => {
      row.contributors.sort((a, b) => b.records - a.records || trCompare(a.label, b.label));
      row.topContributors = row.contributors.slice(0, 4);
      row.contributorsCount = row.contributors.length;
      row.materialCounts = materialRowsFromCounts(row._materialCounts || {});
      row.materials = row.materialCounts;
      delete row._materialCounts;
      return row;
    })
    .sort((a, b) => b.periodPagesDone - a.periodPagesDone || trCompare(a.label, b.label));
}

function mergeBoxContributors(boxRow, contributors) {
  const byKey = Object.fromEntries((boxRow.contributors || []).map((item) => [foldName(item.label), item]));
  for (const item of contributors) {
    const label = publicLabel(item.label);
    if (!label) continue;
    const key = foldName(label);
    if (!byKey[key]) {
      byKey[key] = { label, publicRole: item.publicRole || "", records: 0, pageRows: 0, pagesDone: 0 };
      boxRow.contributors.push(byKey[key]);
    }
    byKey[key].records += Number(item.records || 0);
    byKey[key].pageRows += Number(item.pageRows || 0);
    byKey[key].pagesDone += Number(item.pagesDone || 0);
    if (!byKey[key].publicRole && item.publicRole) byKey[key].publicRole = item.publicRole;
  }
}

function buildTotals(baseTotals, days, byMaterial, byVolunteer, byBox) {
  const records = sum(days, "records");
  const pageRows = sum(days, "pageRows");
  const activityRows = sum(days, "activityRows");
  const periodPagesDone = sum(days, "pagesDone");
  const pagesDone = Number(baseTotals.pagesDone || 0);
  const pagesTarget = Number(baseTotals.pagesTarget || 0);
  return {
    ...baseTotals,
    records,
    pageRows,
    activityRows,
    periodPagesDone,
    pagesDone,
    pagesTarget,
    progressPercent: pagesTarget ? round1((pagesDone / pagesTarget) * 100) : 0,
    boxesActive: byBox.length,
    volunteersActive: byVolunteer.length,
    volunteers: byVolunteer.length,
    materials: byMaterial.length,
  };
}

function buildHighlights(days, byMaterial) {
  const busiestDay = days.slice().sort((a, b) => Number(b.records || 0) - Number(a.records || 0))[0] || null;
  return {
    busiestDay,
    latestDate: days.slice().reverse().find((day) => Number(day.records || 0) > 0)?.dateISO || null,
    topMaterial: byMaterial[0] || null,
    firstCompletedBox: null,
  };
}

function mergeLatestActivity(liveRows, snapshotRows, startISO, endISO) {
  const live = filterLatestActivity(liveRows, startISO, endISO);
  const liveDates = new Set(live.map((row) => row.dateISO));
  const snapshot = filterLatestActivity(snapshotRows, startISO, endISO)
    .filter((row) => !liveDates.has(row.dateISO));
  return live.concat(snapshot)
    .sort((a, b) => String(b.when || b.dateISO || "").localeCompare(String(a.when || a.dateISO || "")))
    .slice(0, LATEST_LIMIT);
}

function filterLatestActivity(rows, startISO, endISO) {
  const filtered = [];
  for (const row of Array.isArray(rows) ? rows : []) {
      const iso = toISODate(row.dateISO || row.when);
      const label = publicLabel(row.volunteerLabel);
      if (!iso || !label || iso < startISO || iso > endISO) continue;
      filtered.push(normalizeLatestRow(row, iso, label));
  }
  return filtered;
}

function normalizeLatestRow(row, iso, label) {
  const normalized = { ...clone(row), dateISO: iso, volunteerLabel: label };
  normalized.pagesDone = latestPageUnits(row);
  return normalized;
}

function latestPageUnits(row) {
  if (row.kind !== "page") return 0;
  const units = Number(row.pagesDone || 0);
  if (row.recordType === "page_detail" && units > 1) return 1;
  return units > 0 ? units : 1;
}

function writeSnapshot(payload) {
  const output = [
    "// Auto-generated public Gönüllü Emek Günlüğü snapshot.",
    "// Contains full aggregates plus a capped latestActivity feed; no raw workbook rows.",
    `window.TVF_PUBLIC_DATA = ${JSON.stringify(payload)};`,
    "window.__SNAPSHOT__ = {ok:true,generatedAt:window.TVF_PUBLIC_DATA.generatedAt,data:window.TVF_PUBLIC_DATA};",
    "",
  ].join("\n");
  fs.writeFileSync(SNAPSHOT_PATH, output, "utf8");
}

function emptyDay(iso) {
  return {
    dateISO: iso,
    weekdayTR: weekdayTR(iso),
    dayNumber: Number(iso.slice(8, 10)),
    records: 0,
    pageRows: 0,
    activityRows: 0,
    pagesDone: 0,
    volunteersCount: 0,
    volunteerNames: [],
    coordination: [],
    contributors: [],
    boxesCount: 0,
    boxLabels: [],
    materials: [],
    firstTime: null,
    lastTime: null,
    summarySentence: "Bugün için görünür katkı yok.",
  };
}

function materialRowsFromCounts(counts) {
  return withPercents(
    Object.entries(counts)
      .map(([material, count]) => ({ material, label: labelForMaterial(material), count }))
      .sort((a, b) => b.count - a.count || trCompare(a.label, b.label))
  );
}

function withPercents(rows) {
  const total = rows.reduce((count, row) => count + Number(row.count || 0), 0);
  return rows.map((row) => ({
    ...row,
    percent: total ? round1((Number(row.count || 0) / total) * 100) : 0,
  }));
}

function dateRangeISO(startISO, endISO) {
  const days = [];
  let cursor = startISO;
  while (cursor <= endISO) {
    days.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return days;
}

function addDaysISO(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toISODate(value) {
  if (!value) return "";
  const text = String(value);
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function weekdayTR(iso) {
  return TR_WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

function dateRangeLabel(startISO, endISO) {
  const start = new Date(`${startISO}T12:00:00Z`);
  const end = new Date(`${endISO}T12:00:00Z`);
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${TR_MONTHS[start.getUTCMonth()]}`;
  }
  return `${start.getUTCDate()} ${TR_MONTHS[start.getUTCMonth()]} – ${end.getUTCDate()} ${TR_MONTHS[end.getUTCMonth()]}`;
}

function publicLabel(value) {
  const label = String(value || "").replace(/\s+/g, " ").trim();
  if (!label) return "";
  if (
    label === "Adı belirtilmeyen gönüllü" ||
    label === "İsmini gizlemeyi tercih eden gönüllü" ||
    label === "Adi belirtilmeyen gonullu" ||
    label === "Ismini gizlemeyi tercih eden gonullu"
  ) return "";
  if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(label)) return "";
  return label;
}

function labelForMaterial(material) {
  const folded = foldName(material);
  if (folded === "belgeler") return "Belgeler";
  if (folded === "fotograflar") return "Fotoğraflar";
  return material;
}

function foldName(value) {
  return String(value || "")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİI]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function addUnique(items, value) {
  if (value && items.indexOf(value) < 0) items.push(value);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function trCompare(left, right) {
  return String(left || "").localeCompare(String(right || ""), "tr");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function pushWarning(warnings, warning) {
  if (!warnings.some((item) => item.code === warning.code)) warnings.push(warning);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
