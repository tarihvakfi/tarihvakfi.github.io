/**
 * Boratav Arşivi Gönüllü Emek Günlüğü public sheet endpoint.
 *
 * Reads the shared Google Sheet and emits only a public dashboard payload:
 *   - publicSummary: full aggregate object
 *   - latestActivity: capped latest feed
 *   - content: optional public copy overrides
 *
 * It does not expose raw spreadsheet rows, emails, technical IDs, private
 * notes, scanner/computer fields, URLs, credentials, or volunteer tokens.
 */

const TVF_TIMEZONE = 'Europe/Istanbul';
const TVF_PROJECT_ID = 'pnb';
const TVF_LATEST_LIMIT = 50;
const TVF_TR_WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const TVF_TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const TVF_UNNAMED = 'Adı belirtilmeyen gönüllü';
const TVF_HIDDEN = 'İsmini gizlemeyi tercih eden gönüllü';
const TVF_PUBLIC_ROLE_BY_NAME = {
  'gulistan eren': 'Gönüllü Koordinatörü'
};

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (params.public !== '1') {
      return tvfJson_({ ok: true, service: 'Boratav Arşivi Gönüllü Emek Günlüğü', hint: 'Add ?public=1' });
    }
    const data = buildPublicDashboardPayload_();
    return tvfJson_({ ok: true, generatedAt: data.generatedAt, data: data });
  } catch (err) {
    return tvfJson_({ ok: false, error: String((err && err.message) || err) });
  }
}

function buildPublicDashboardPayload_() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('TARIH_VAKFI_SHEET_ID');
  if (!sheetId) throw new Error('TARIH_VAKFI_SHEET_ID is not set');
  const workbook = readWorkbook_(sheetId);
  const inventory = buildInventory_(workbook.rowsBySheet);
  const inventoryTotals = computeInventoryTotals_(workbook.rowsBySheet);
  const records = collectPublicRecords_(workbook.rowsBySheet, inventory);
  const generatedAt = new Date();
  const summary = buildPublicSummaryFromRows(records, inventory, inventoryTotals, generatedAt, 'calendar_week_to_date');
  return {
    generatedAt: summary.generatedAt,
    publicSummary: summary,
    latestActivity: latestActivity_(records, TVF_LATEST_LIMIT),
    content: {},
    stats: {
      projects: {
        pnb: {
          totalPages: summary.totals.pagesTarget,
          donePages: summary.totals.pagesDone,
          cataloguedBoxes: summary.totals.boxesCatalogued,
          doneUnits: null,
          totalUnits: null
        }
      }
    },
    ticker: []
  };
}

function buildPublicSummaryFromRows(records, inventory, inventoryTotals, now, mode) {
  const period = selectedPeriod_(now, mode || 'calendar_week_to_date');
  const periodRecords = records.filter(function (record) {
    return record.dateISO && record.dateISO >= period.startDate && record.dateISO <= period.endDate;
  });
  const pageRecords = periodRecords.filter(function (record) { return record.kind === 'page'; });
  const activityRecords = periodRecords.filter(function (record) { return record.kind === 'activity'; });
  const allPageRecords = records.filter(function (record) { return record.kind === 'page'; });

  const rowsByDay = {};
  periodRecords.forEach(function (record) {
    if (!rowsByDay[record.dateISO]) rowsByDay[record.dateISO] = [];
    rowsByDay[record.dateISO].push(record);
  });
  const byDay = dateRange_(period.startDate, period.endDate).map(function (iso) {
    return daySummary_(iso, rowsByDay[iso] || []);
  });

  const materialCounts = {};
  periodRecords.forEach(function (record) { inc_(materialCounts, record.material || 'belgeler', 1); });

  const recordsByBox = {};
  pageRecords.forEach(function (record) {
    const key = normalizeBox_(record.box);
    if (!key) return;
    if (!recordsByBox[key]) recordsByBox[key] = [];
    recordsByBox[key].push(record);
  });

  const byBox = Object.keys(recordsByBox).map(function (key) {
    const rows = recordsByBox[key];
    const info = inventory[key] || {
      box: rows[0].box,
      targetPages: 0,
      summaryDonePages: 0,
      detailDonePages: 0,
      lastActivityDate: null
    };
    const contributorCounts = {};
    rows.forEach(function (record) {
      const ckey = record.privateKey || 'unnamed';
      if (!contributorCounts[ckey]) contributorCounts[ckey] = { labels: [], roles: [], records: 0, pagesDone: 0 };
      contributorCounts[ckey].labels.push(record.publicLabel);
      contributorCounts[ckey].roles.push(record.publicRole || '');
      contributorCounts[ckey].records += 1;
      contributorCounts[ckey].pagesDone += Number(record.pageUnits || 0);
    });
    const contributors = Object.keys(contributorCounts).sort(function (a, b) {
      return contributorCounts[b].records - contributorCounts[a].records;
    }).map(function (ckey) {
      const label = preferredVolunteerLabel_(contributorCounts[ckey].labels);
      if (!isPublicNamedLabel_(label)) return null;
      return {
        label: label,
        publicRole: preferredPublicRole_(contributorCounts[ckey].roles || [], label),
        records: contributorCounts[ckey].records,
        pageRows: contributorCounts[ckey].records,
        pagesDone: contributorCounts[ckey].pagesDone
      };
    }).filter(Boolean).slice(0, 5);
    const material = {};
    rows.forEach(function (record) { inc_(material, record.material || 'belgeler', 1); });
    const done = Math.max(Number(info.summaryDonePages || 0), Number(info.detailDonePages || 0));
    const target = Number(info.targetPages || 0);
    return {
      box: info.box || rows[0].box,
      boxLabel: 'Kutu ' + (info.box || rows[0].box),
      label: 'Kutu ' + (info.box || rows[0].box),
      boxTitle: 'Kutu ' + (info.box || rows[0].box),
      done: done,
      target: target > 0 ? target : null,
      percent: target > 0 ? round1_((Math.min(done, target) / target) * 100) : null,
      remaining: target > 0 ? Math.max(0, target - done) : null,
      records: rows.length,
      pageRows: rows.length,
      activityRows: 0,
      periodRecords: rows.length,
      periodPageRows: rows.length,
      periodPagesDone: rows.reduce(function (sum, record) { return sum + Number(record.pageUnits || 1); }, 0),
      materialCounts: counterToRows_(material),
      materials: counterToRows_(material),
      contributors: contributors,
      topContributors: contributors,
      contributorsCount: contributors.length,
      lastActivityDate: info.lastActivityDate || rows[0].dateISO,
      lastActivityLabel: info.lastActivityDate ? formatDayMonth_(parseIsoDate_(info.lastActivityDate)) : null,
      status: target > 0 && done >= target ? 'completed' : (done > 0 || rows.length > 0 ? 'active' : 'inventory'),
      targetMissing: target <= 0,
      overTarget: target > 0 && done > target
    };
  }).sort(function (a, b) {
    return b.periodPagesDone - a.periodPagesDone || String(a.box).localeCompare(String(b.box));
  });

  const byVolunteerGroups = {};
  periodRecords.forEach(function (record) {
    const key = record.privateKey || 'unnamed';
    if (!byVolunteerGroups[key]) byVolunteerGroups[key] = [];
    byVolunteerGroups[key].push(record);
  });
  const byVolunteer = Object.keys(byVolunteerGroups).sort(function (a, b) {
    return byVolunteerGroups[b].length - byVolunteerGroups[a].length || a.localeCompare(b);
  }).map(function (key) {
    const rows = byVolunteerGroups[key];
    const label = preferredVolunteerLabel_(rows.map(function (record) { return record.publicLabel; }));
    if (!isPublicNamedLabel_(label)) return null;
    const role = preferredPublicRole_(rows.map(function (record) { return record.publicRole; }), label);
    const pageRows = rows.filter(function (record) { return record.kind === 'page'; });
    const boxCounts = {};
    pageRows.forEach(function (record) {
      if (record.box) inc_(boxCounts, 'Kutu ' + record.box, 1);
    });
    const boxes = Object.keys(boxCounts).sort(function (a, b) { return boxCounts[b] - boxCounts[a]; });
    return {
      label: label,
      publicRole: role,
      records: rows.length,
      pageRows: pageRows.length,
      activityRows: rows.length - pageRows.length,
      pagesDone: pageRows.reduce(function (sum, record) { return sum + Number(record.pageUnits || 1); }, 0),
      topBox: boxes[0] || null,
      boxes: boxes.slice(0, 4),
      boxBreakdown: boxes.slice(0, 4).map(function (boxLabel) {
        return { boxLabel: boxLabel, records: boxCounts[boxLabel] };
      })
    };
  }).filter(Boolean);
  const namedVolunteerKeys = {};
  periodRecords.forEach(function (record) {
    if (record.privateKey && isPublicNamedLabel_(record.publicLabel)) namedVolunteerKeys[record.privateKey] = true;
  });

  const targetPages = Number(inventoryTotals.totalPages || 0);
  const pagesDone = allPageRecords.reduce(function (sum, record) { return sum + Number(record.pageUnits || 0); }, 0);
  const inventoryBoxes = Object.keys(inventory).map(function (key) { return inventory[key]; }).filter(function (box) {
    return box.targetPages || box.files || box.documents;
  });
  const completedBoxes = inventoryBoxes.filter(function (box) {
    const done = Math.max(Number(box.summaryDonePages || 0), Number(box.detailDonePages || 0));
    return Number(box.targetPages || 0) > 0 && done >= Number(box.targetPages || 0);
  });
  const warnings = buildWarnings_(records, inventory, byDay, periodRecords, pagesDone, targetPages);
  const byMaterial = counterToRows_(materialCounts);
  const busiestDay = byDay.slice().sort(function (a, b) { return b.records - a.records; })[0] || null;

  return {
    generatedAt: isoDateTime_(now),
    source: {
      name: 'Tarih Vakfı Gönüllü Ağı',
      projectId: TVF_PROJECT_ID,
      recordsAreFullAggregate: true,
      latestActivityCap: TVF_LATEST_LIMIT,
      volunteerCredit: 'credit-visible, ID-safe volunteer display'
    },
    period: period,
    totals: {
      records: periodRecords.length,
      pageRows: pageRecords.length,
      activityRows: activityRecords.length,
      periodPagesDone: pageRecords.reduce(function (sum, record) { return sum + Number(record.pageUnits || 1); }, 0),
      pagesDone: pagesDone,
      pagesTarget: targetPages,
      progressPercent: targetPages > 0 ? round1_((pagesDone / targetPages) * 100) : 0,
      boxesTotal: inventoryBoxes.length || null,
      boxesCatalogued: inventoryTotals.cataloguedBoxes || inventoryBoxes.length,
      boxesActive: Object.keys(recordsByBox).length,
      boxesCompleted: completedBoxes.length,
      boxesRemaining: inventoryBoxes.length ? Math.max(0, inventoryBoxes.length - completedBoxes.length) : null,
      volunteersActive: Object.keys(namedVolunteerKeys).length,
      volunteers: Object.keys(namedVolunteerKeys).length,
      materials: byMaterial.length
    },
    byDay: byDay,
    byMaterial: byMaterial,
    byBox: byBox,
    byVolunteer: byVolunteer,
    highlights: {
      busiestDay: busiestDay,
      latestDate: periodRecords.length ? periodRecords[0].dateISO : null,
      topMaterial: byMaterial[0] || null,
      firstCompletedBox: null
    },
    warnings: warnings
  };
}

function readWorkbook_(sheetId) {
  const metadata = fetchSheetsApi_(sheetId, '?fields=sheets(properties(title))');
  const titles = ((metadata.sheets || []).map(function (sheet) {
    return sheet.properties && sheet.properties.title;
  }) || []).filter(Boolean);
  const rowsBySheet = {};
  const sheetInfo = [];
  titles.forEach(function (title) {
    const matrix = readSheetValues_(sheetId, title + '!A1:Z5000');
    const rows = rowsFromMatrix_(title, matrix);
    rowsBySheet[title] = rows.rows;
    sheetInfo.push({ title: title, classification: classifySheet_(title), rows: rows.rows.length, headers: rows.headers });
  });
  return { sheetInfo: sheetInfo, rowsBySheet: rowsBySheet };
}

function readSheetValues_(sheetId, range) {
  const encoded = '/values/' + encodeURIComponent(range);
  const result = fetchSheetsApi_(sheetId, encoded);
  return result.values || [];
}

function fetchSheetsApi_(sheetId, suffix) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sheetId) + suffix;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Sheets API failed (' + code + '): ' + response.getContentText());
  return JSON.parse(response.getContentText());
}

function rowsFromMatrix_(title, matrix) {
  if (!matrix || matrix.length < 1) return { headers: [], rows: [] };
  const rawHeaders = matrix[0] || [];
  const headers = rawHeaders.map(function (header, idx) {
    return headerToKey_(header) || ('column' + (idx + 1));
  });
  const rows = [];
  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] || [];
    if (raw.every(function (value) { return value == null || String(value).trim() === ''; })) continue;
    const row = { _sourceRow: i + 1, _sheet: title, _sheetSlug: slugify_(title) };
    headers.forEach(function (key, idx) { row[key] = raw[idx] == null ? null : raw[idx]; });
    rows.push(row);
  }
  return {
    headers: rawHeaders.filter(function (header) { return header != null && String(header).trim() !== ''; }),
    rows: rows
  };
}

function buildInventory_(rowsBySheet) {
  const inventory = {};
  Object.keys(rowsBySheet).forEach(function (title) {
    if (classifySheet_(title) !== 'pnb_inventory') return;
    rowsBySheet[title].forEach(function (row) {
      const box = publicBoxLabel_(row.kutu || row.kutuNo);
      const key = normalizeBox_(box);
      if (!key) return;
      const pages = parseDoneTotal_(row.sayfaSayisi);
      inventory[key] = {
        box: box,
        targetPages: Math.round(pages.total || 0),
        summaryDonePages: Math.round(pages.done || 0),
        detailDonePages: 0,
        pageRows: 0,
        files: Math.round(numberOrZero_(row.dosyaSayisi)),
        documents: Math.round(numberOrZero_(row.belgeSayisi)),
        lastActivityDate: null,
        labels: {}
      };
    });
  });
  return inventory;
}

function computeInventoryTotals_(rowsBySheet) {
  const totals = { totalPages: 0, totalUnits: 0, totalFiles: 0, cataloguedBoxes: 0 };
  Object.keys(rowsBySheet).forEach(function (title) {
    if (classifySheet_(title) !== 'pnb_inventory') return;
    rowsBySheet[title].forEach(function (row) {
      const pages = parseDoneTotal_(row.sayfaSayisi);
      totals.totalPages += pages.total;
      totals.totalUnits += numberOrZero_(row.belgeSayisi);
      totals.totalFiles += numberOrZero_(row.dosyaSayisi);
      const box = publicBoxLabel_(row.kutu || row.kutuNo);
      if (box && (pages.total > 0 || numberOrZero_(row.belgeSayisi) > 0 || numberOrZero_(row.dosyaSayisi) > 0)) {
        totals.cataloguedBoxes += 1;
      }
    });
  });
  return {
    totalPages: Math.round(totals.totalPages),
    totalUnits: Math.round(totals.totalUnits),
    totalFiles: Math.round(totals.totalFiles),
    cataloguedBoxes: totals.cataloguedBoxes
  };
}

function collectPublicRecords_(rowsBySheet, inventory) {
  const records = [];
  Object.keys(rowsBySheet).forEach(function (title) {
    const classification = classifySheet_(title);
    const rows = rowsBySheet[title];
    if (classification === 'pnb_detail') {
      const hasSayfaSayisi = rows.some(function (row) { return row.sayfaSayisi != null && String(row.sayfaSayisi).trim() !== ''; });
      const sheetPerson = personFromTitle_(title);
      rows.forEach(function (row) {
        const enriched = copyObject_(row);
        enriched._sheetPerson = sheetPerson;
        const label = getVolunteerDisplayName_(enriched);
        const publicRole = getPublicRole_(enriched, label);
        const when = parseSheetDate_(row.tarih);
        const pageUnits = hasSayfaSayisi ? Math.max(1, Math.round(parseDoneTotal_(row.sayfaSayisi).done || parseDoneTotal_(row.sayfaSayisi).total || 1)) : 1;
        const box = publicBoxLabel_(row.kutu || row.kutuNo);
        const rec = {
          kind: 'page',
          sourceType: 'page_detail',
          dateISO: when ? isoDate_(when) : null,
          when: when,
          material: materialCategory_(row),
          projectId: TVF_PROJECT_ID,
          privateKey: contributorKey_(label),
          publicLabel: label,
          publicRole: publicRole,
          creditStatus: creditStatus_(enriched),
          box: box,
          pageUnits: pageUnits
        };
        records.push(rec);
        const boxKey = normalizeBox_(box);
        if (boxKey) {
          if (!inventory[boxKey]) {
            inventory[boxKey] = { box: box, targetPages: 0, summaryDonePages: 0, detailDonePages: 0, pageRows: 0, files: 0, documents: 0, lastActivityDate: null, labels: {} };
          }
          inventory[boxKey].detailDonePages += pageUnits;
          inventory[boxKey].pageRows += 1;
          if (when && (!inventory[boxKey].lastActivityDate || isoDate_(when) > inventory[boxKey].lastActivityDate)) {
            inventory[boxKey].lastActivityDate = isoDate_(when);
          }
        }
      });
    } else if (classification === 'activity') {
      rows.forEach(function (row) {
        const label = getVolunteerDisplayName_(row);
        const publicRole = getPublicRole_(row, label);
        const when = parseSheetDate_(row.tarih);
        records.push({
          kind: 'activity',
          sourceType: 'activity',
          dateISO: when ? isoDate_(when) : null,
          when: when,
          material: materialCategory_(row),
          projectId: projectIdFromRow_(row),
          privateKey: contributorKey_(label),
          publicLabel: label,
          publicRole: publicRole,
          creditStatus: creditStatus_(row),
          box: '',
          pageUnits: 0
        });
      });
    }
  });
  return records;
}

function latestActivity_(records, limit) {
  return records.filter(function (record) {
    return record.when instanceof Date && !isNaN(record.when.getTime()) && isPublicNamedLabel_(record.publicLabel);
  }).sort(function (a, b) {
    return b.when.getTime() - a.when.getTime();
  }).slice(0, limit || TVF_LATEST_LIMIT).map(function (record) {
    return {
      when: isoDateTime_(record.when),
      dateISO: record.dateISO,
      kind: record.kind,
      recordType: record.sourceType,
      material: record.material,
      projectId: record.projectId,
      volunteerLabel: record.publicLabel,
      publicRole: record.publicRole || '',
      boxLabel: record.box ? ('Kutu ' + record.box) : null,
      pagesDone: record.pageUnits
    };
  });
}

function daySummary_(dateISO, rows) {
  const pageRows = rows.filter(function (record) { return record.kind === 'page'; });
  const activityRows = rows.filter(function (record) { return record.kind === 'activity'; });
  const volunteers = {};
  const boxes = {};
  const materials = {};
  let first = null;
  let last = null;
  rows.forEach(function (record) {
    if (!volunteers[record.privateKey]) volunteers[record.privateKey] = [];
    volunteers[record.privateKey].push(record);
    if (record.box) boxes[normalizeBox_(record.box)] = 'Kutu ' + record.box;
    inc_(materials, record.material || 'belgeler', 1);
    if (record.when && (!first || record.when.getTime() < first.getTime())) first = record.when;
    if (record.when && (!last || record.when.getTime() > last.getTime())) last = record.when;
  });
  const contributors = Object.keys(volunteers).map(function (key) {
    const recs = volunteers[key];
    const label = preferredVolunteerLabel_(recs.map(function (record) { return record.publicLabel; }));
    if (!isPublicNamedLabel_(label)) return null;
    const contributorPageRows = recs.filter(function (record) { return record.kind === 'page'; });
    const contributorActivityRows = recs.filter(function (record) { return record.kind === 'activity'; });
    return {
      label: label,
      publicRole: preferredPublicRole_(recs.map(function (record) { return record.publicRole; }), label),
      records: recs.length,
      pageRows: contributorPageRows.length,
      activityRows: contributorActivityRows.length,
      pagesDone: contributorPageRows.reduce(function (sum, record) { return sum + Number(record.pageUnits || 1); }, 0)
    };
  }).filter(Boolean).sort(function (a, b) { return asciiFold_(a.label).localeCompare(asciiFold_(b.label)); });
  const volunteerNames = contributors.filter(function (item) {
    return !item.publicRole;
  }).map(function (item) { return item.label; });
  const coordination = contributors.filter(function (item) { return item.publicRole; });
  const parts = [];
  if (pageRows.length) parts.push(pageRows.length + ' sayfa/detay satırı');
  if (activityRows.length) parts.push(activityRows.length + ' faaliyet kaydı');
  if (contributors.length) parts.push(contributors.length + ' kişi');
  if (Object.keys(boxes).length) parts.push(Object.keys(boxes).length + ' kutu');
  return {
    dateISO: dateISO,
    weekdayTR: TVF_TR_WEEKDAYS[parseIsoDate_(dateISO).getDay() === 0 ? 6 : parseIsoDate_(dateISO).getDay() - 1],
    dayNumber: Number(dateISO.slice(8, 10)),
    records: rows.length,
    pageRows: pageRows.length,
    activityRows: activityRows.length,
    pagesDone: pageRows.reduce(function (sum, record) { return sum + Number(record.pageUnits || 1); }, 0),
    volunteersCount: contributors.length,
    volunteerNames: volunteerNames,
    coordination: coordination,
    contributors: contributors,
    boxesCount: Object.keys(boxes).length,
    boxLabels: Object.keys(boxes).map(function (key) { return boxes[key]; }).sort(),
    materials: counterToRows_(materials),
    firstTime: first ? isoDateTime_(first) : null,
    lastTime: last ? isoDateTime_(last) : null,
    summarySentence: rows.length ? ('Bugün ' + parts.join(', ') + ' işlendi.') : 'Bugün için görünür katkı yok.'
  };
}

function buildWarnings_(records, inventory, byDay, periodRecords, pagesDone, targetPages) {
  const warnings = [];
  if (targetPages > 0 && pagesDone > targetPages) {
    warnings.push({ code: 'pages_done_exceeds_target', message: 'Kaydedilen sayfa birimleri hedef toplamı aşıyor.' });
  }
  const missingTargets = Object.keys(inventory).map(function (key) { return inventory[key]; }).filter(function (box) {
    return Number(box.pageRows || 0) > 0 && Number(box.targetPages || 0) <= 0;
  }).map(function (box) { return box.box; });
  if (missingTargets.length) {
    warnings.push({ code: 'missing_box_targets', message: missingTargets.length + ' aktif kutuda hedef sayfa toplamı yok.', boxes: missingTargets.slice(0, 8) });
  }
  const unsafe = records.filter(function (record) { return record.creditStatus === 'unsafe_identifier'; }).length;
  if (unsafe) {
    warnings.push({ code: 'unsafe_public_identifiers_suppressed', message: unsafe + ' katkı alanı teknik kimlik gibi göründüğü için isim olarak gösterilmedi.' });
  }
  const missing = records.filter(function (record) { return record.creditStatus === 'missing'; }).length;
  if (missing) {
    warnings.push({ code: 'missing_volunteer_names', message: missing + ' katkı satırında kullanılabilir gönüllü adı yok.' });
  }
  const unknownDates = records.filter(function (record) { return !record.dateISO; }).length;
  if (unknownDates) {
    warnings.push({ code: 'unknown_dates', message: unknownDates + ' satır dönem/gün grafiğine atanabilecek tarih taşımıyor.' });
  }
  if (byDay.reduce(function (sum, day) { return sum + day.records; }, 0) !== periodRecords.length) {
    warnings.push({ code: 'by_day_total_mismatch', message: 'Günlük toplam dönem kayıt toplamıyla eşleşmiyor.' });
  }
  return warnings;
}

function getVolunteerDisplayName_(row) {
  if (explicitOptOut_(row)) return TVF_HIDDEN;
  const explicit = normalizeVolunteerName_(row.publicDisplayName || row.publicdisplayname || row.kamusalAd || row.kamusalad);
  if (explicit) return explicit;
  const name = normalizeVolunteerName_(row.paydas || row.kaydiOlusuran || row.kaydiOlusturan || row._sheetPerson || row.volunteerName || row.adSoyad);
  if (name) return name;
  const first = normalizeVolunteerName_(row.firstName || row.first_name || row.ad || row.isim);
  const last = normalizeVolunteerName_(row.lastName || row.last_name || row.soyad || row.soyisim);
  const combined = normalizeVolunteerName_((first + ' ' + last).trim());
  if (combined) return combined;
  if (first) return first;
  return TVF_UNNAMED;
}

function creditStatus_(row) {
  if (explicitOptOut_(row)) return 'opt_out';
  const raw = row.publicDisplayName || row.publicdisplayname || row.kamusalAd || row.kamusalad || row.paydas || row.kaydiOlusuran || row.kaydiOlusturan || row._sheetPerson || '';
  if (raw && isUnsafePublicIdentifier_(raw)) return 'unsafe_identifier';
  if (normalizeVolunteerName_(raw)) return 'name';
  return 'missing';
}

function explicitOptOut_(row) {
  const publicCredit = asciiFold_(row.publicCredit || row.public_credit).toLowerCase().trim();
  if (['no', 'false', '0', 'hayir', 'hayır'].indexOf(publicCredit) >= 0) return true;
  const creditVisible = asciiFold_(row.creditVisible || row.credit_visible).toLowerCase().trim();
  if (['no', 'false', '0', 'hayir', 'hayır'].indexOf(creditVisible) >= 0) return true;
  const hideName = asciiFold_(row.hideName || row.hide_name || row.adGizli || row.ad_gizli).toLowerCase().trim();
  return ['yes', 'true', '1', 'evet', 'gizli', 'hide', 'hidden'].indexOf(hideName) >= 0;
}

function normalizeVolunteerName_(value) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim().replace(/^[\s:;,\-–—]+|[\s:;,\-–—]+$/g, '');
  if (!text || isUnsafePublicIdentifier_(text)) return '';
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text)) return '';
  if (text.length > 64) return '';
  return text;
}

function isUnsafePublicIdentifier_(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return false;
  if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(text)) return true;
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(text)) return true;
  if (/^[0-9a-fA-F]{12,}$/.test(text)) return true;
  if (/^(sheet|row|uid|user|firebase|google|apps?|script|token|id)[_:-]/i.test(text)) return true;
  const compact = text.replace(/[^A-Za-z0-9]/g, '');
  if (compact.length >= 24) return true;
  if (compact.length >= 16 && /[0-9]/.test(compact) && /[A-Za-z]/.test(compact)) {
    const words = text.match(/[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/g) || [];
    const vowels = text.match(/[aeıioöuüAEIİOÖUÜ]/g) || [];
    if (words.length < 2 || vowels.length < 2) return true;
  }
  return false;
}

function isPublicNamedLabel_(label) {
  const text = String(label == null ? '' : label).trim();
  return !!(text && text !== TVF_UNNAMED && text !== TVF_HIDDEN && !isUnsafePublicIdentifier_(text));
}

function normalizePublicRole_(value) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const folded = asciiFold_(text).toLowerCase();
  if (['false', '0', 'no', 'hayir', 'hayır', 'yok', 'none', 'null'].indexOf(folded) >= 0) return '';
  if (isUnsafePublicIdentifier_(text) || text.length > 80) return '';
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text)) return '';
  return text;
}

function getPublicRole_(row, label) {
  const candidates = [
    row.role,
    row.gorev,
    row.publicRole,
    row.publicrole,
    row.public_role,
    row.displayRole,
    row.displayrole,
    row.display_role
  ];
  for (let i = 0; i < candidates.length; i++) {
    const role = normalizePublicRole_(candidates[i]);
    if (role) return role;
  }
  const coordinator = row.coordinator || row.koordinator || row.koordinatör;
  const folded = asciiFold_(coordinator).toLowerCase().trim();
  if (['true', '1', 'yes', 'evet', 'x'].indexOf(folded) >= 0 || folded.indexOf('koordinator') >= 0) {
    return 'Gönüllü Koordinatörü';
  }
  return TVF_PUBLIC_ROLE_BY_NAME[asciiFold_(label).toLowerCase().trim()] || '';
}

function preferredPublicRole_(roles, label) {
  const counts = {};
  (roles || []).forEach(function (role) {
    const clean = normalizePublicRole_(role);
    if (clean) inc_(counts, clean, 1);
  });
  const keys = Object.keys(counts);
  if (keys.length) {
    return keys.sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); })[0];
  }
  return TVF_PUBLIC_ROLE_BY_NAME[asciiFold_(label).toLowerCase().trim()] || '';
}

function contributorKey_(label) {
  if (!label || label === TVF_UNNAMED) return 'unnamed';
  if (label === TVF_HIDDEN) return 'hidden';
  return asciiFold_(label).toLowerCase().replace(/\s+/g, ' ').trim();
}

function preferredVolunteerLabel_(labels) {
  const clean = (labels || []).filter(Boolean);
  if (!clean.length) return TVF_UNNAMED;
  if (clean.indexOf(TVF_HIDDEN) >= 0) return TVF_HIDDEN;
  const human = clean.filter(function (label) { return label !== TVF_UNNAMED && label !== TVF_HIDDEN; });
  if (!human.length) return TVF_UNNAMED;
  const counts = {};
  human.forEach(function (label) { inc_(counts, label, 1); });
  return Object.keys(counts).sort(function (a, b) {
    const ta = (a.match(/[ÇĞİÖŞÜçğıöşü]/g) || []).length;
    const tb = (b.match(/[ÇĞİÖŞÜçğıöşü]/g) || []).length;
    if (ta !== tb) return tb - ta;
    if (counts[a] !== counts[b]) return counts[b] - counts[a];
    if (a.length !== b.length) return b.length - a.length;
    return asciiFold_(a).localeCompare(asciiFold_(b));
  })[0];
}

function materialCategory_(row) {
  const haystack = asciiFold_([
    row.calismaAlani, row.devamEdenCalisma, row.dijitalBelgeKodu, row.notlar, row.fon, row.fonAdi
  ].join(' ')).toLowerCase();
  if (haystack.indexOf('foto') >= 0 || haystack.indexOf('gorsel') >= 0 || haystack.indexOf('dia') >= 0) return 'fotoğraflar';
  if (haystack.indexOf('mektup') >= 0) return 'mektuplar';
  if (haystack.indexOf('kitap') >= 0) return 'kitap metinleri';
  if (haystack.indexOf('ders') >= 0) return 'ders notları';
  if (haystack.indexOf('envanter') >= 0) return 'envanter';
  return 'belgeler';
}

function projectIdFromRow_(row) {
  const haystack = asciiFold_([row.fon, row.fonAdi, row.calismaAlani, row.devamEdenCalisma, row.dijitalBelgeKodu, row.notlar].join(' ')).toLowerCase();
  return haystack.indexOf('pnb') >= 0 || haystack.indexOf('boratav') >= 0 ? TVF_PROJECT_ID : 'foundation';
}

function selectedPeriod_(now, mode) {
  const today = parseIsoDate_(isoDate_(now));
  if (mode === 'rolling_7_days') {
    const start = addDays_(today, -6);
    return { mode: 'rolling_7_days', startDate: isoDate_(start), endDate: isoDate_(today), label: 'Son 7 gün', isPartial: false };
  }
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const start = addDays_(today, mondayOffset);
  const fullEnd = addDays_(start, 6);
  return {
    mode: 'calendar_week_to_date',
    startDate: isoDate_(start),
    endDate: isoDate_(today),
    fullEndDate: isoDate_(fullEnd),
    label: periodLabel_(start, fullEnd),
    isPartial: today.getTime() < fullEnd.getTime()
  };
}

function classifySheet_(title) {
  const slug = slugify_(title);
  if (slug === 'pnb_sayisallastirma') return 'pnb_inventory';
  if (slug === 'gunluk_akis') return 'activity';
  if (slug === 'gunluk_gonullu_akisi') return 'schedule';
  if (slug.indexOf('pnb_') === 0 && slug.indexOf('_zarf') < 0 && slug !== 'pnb_sayisallastirma') return 'pnb_detail';
  return 'other';
}

function personFromTitle_(title) {
  const parts = String(title || '').split(/\s+/).filter(Boolean);
  if (!parts.length || parts[0].toUpperCase() !== 'PNB') return '';
  return parts[parts.length - 1].replace(/-/g, ' - ');
}

function parseSheetDate_(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number' && isFinite(value)) return new Date(Date.UTC(1899, 11, 30 + Math.floor(value), 12, 0, 0));
  const text = String(value).trim();
  let match = text.match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})$/);
  if (match) {
    const month = monthNumber_(match[2]);
    if (month) return new Date(Number(match[3]), month - 1, Number(match[1]), 12, 0, 0);
  }
  match = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(match[2]) - 1, Number(match[1]), 12, 0, 0);
  }
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseDoneTotal_(value) {
  if (value == null || value === '') return { done: 0, total: 0 };
  if (typeof value === 'number') return { done: 0, total: value };
  const text = String(value).trim();
  const match = text.match(/^([\d.,]+)\s*\/\s*([\d.,]+)$/);
  if (match) return { done: parseLocaleNumber_(match[1]), total: parseLocaleNumber_(match[2]) };
  return { done: 0, total: parseLocaleNumber_(text) };
}

function parseLocaleNumber_(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  let text = String(value).trim().replace(/\s+/g, '');
  if (!text) return 0;
  text = text.indexOf(',') >= 0 && text.indexOf('.') >= 0 ? text.replace(/\./g, '').replace(',', '.') : text.replace(',', '.');
  const n = Number(text.replace(/[^\d.-]/g, ''));
  return isFinite(n) ? n : 0;
}

function numberOrZero_(value) {
  return parseLocaleNumber_(value);
}

function publicBoxLabel_(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    if (value.getFullYear() === 2026) return (value.getMonth() + 1) + '-' + value.getDate();
    return isoDate_(value);
  }
  if (typeof value === 'number' && isFinite(value)) return Math.floor(value) === value ? String(value) : String(value).replace('.', ',');
  return String(value).trim();
}

function normalizeBox_(value) {
  const label = asciiFold_(publicBoxLabel_(value)).toLowerCase().trim();
  const range = label.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return 'range_' + range[1] + '_' + range[2];
  return label.replace(/[^a-z0-9]+/g, '');
}

function counterToRows_(obj) {
  const total = Object.keys(obj || {}).reduce(function (sum, key) { return sum + Number(obj[key] || 0); }, 0);
  return Object.keys(obj || {}).sort(function (a, b) {
    return Number(obj[b] || 0) - Number(obj[a] || 0) || a.localeCompare(b);
  }).map(function (key) {
    const count = Number(obj[key] || 0);
    return { material: key, label: key.charAt(0).toLocaleUpperCase('tr') + key.slice(1), count: count, percent: total ? round1_((count / total) * 100) : 0 };
  });
}

function dateRange_(startISO, endISO) {
  const out = [];
  let current = parseIsoDate_(startISO);
  const end = parseIsoDate_(endISO);
  while (current.getTime() <= end.getTime()) {
    out.push(isoDate_(current));
    current = addDays_(current, 1);
  }
  return out;
}

function addDays_(dateObj, days) {
  const d = new Date(dateObj.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function parseIsoDate_(iso) {
  const parts = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

function isoDate_(dateObj) {
  return Utilities.formatDate(dateObj, TVF_TIMEZONE, 'yyyy-MM-dd');
}

function isoDateTime_(dateObj) {
  return Utilities.formatDate(dateObj, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
}

function formatDayMonth_(dateObj) {
  return dateObj.getDate() + ' ' + TVF_TR_MONTHS[dateObj.getMonth()];
}

function periodLabel_(start, fullEnd) {
  const sameMonth = start.getMonth() === fullEnd.getMonth();
  const range = sameMonth
    ? (start.getDate() + '–' + fullEnd.getDate() + ' ' + TVF_TR_MONTHS[start.getMonth()])
    : (start.getDate() + ' ' + TVF_TR_MONTHS[start.getMonth()] + ' – ' + fullEnd.getDate() + ' ' + TVF_TR_MONTHS[fullEnd.getMonth()]);
  return range + ' haftası · bugüne kadar';
}

function monthNumber_(name) {
  const folded = asciiFold_(name).toLowerCase();
  for (let i = 0; i < TVF_TR_MONTHS.length; i++) {
    if (asciiFold_(TVF_TR_MONTHS[i]).toLowerCase() === folded) return i + 1;
  }
  return 0;
}

function headerToKey_(header) {
  const parts = asciiFold_(header).trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.map(function (part, idx) {
    const lower = part.toLowerCase();
    return idx === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

function slugify_(value) {
  return asciiFold_(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function asciiFold_(value) {
  return String(value == null ? '' : value).replace(/ı/g, 'i').replace(/İ/g, 'I').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function inc_(obj, key, amount) {
  obj[key] = (obj[key] || 0) + (amount == null ? 1 : amount);
}

function round1_(n) {
  return Math.round(Number(n || 0) * 10) / 10;
}

function copyObject_(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(function (key) { out[key] = obj[key]; });
  return out;
}

function tvfJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
