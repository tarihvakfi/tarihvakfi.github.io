/**
 * Tarih Vakfı Gönüllü Emek Günlüğü public sheet endpoint.
 *
 * Reads the shared Google Sheet and emits only a public dashboard payload:
 *   - publicSummary: full aggregate object
 *   - trackSummary: full Günlük Akış work-area aggregate
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
const TVF_PROGRESS_CELL = 'PNB Sayısallaştırma!L105';
const TVF_PROGRESS_A1 = 'L105';
const TVF_PROGRESS_NAMED_RANGE = 'toplam_ilerleme'; // optional: define this named range in the sheet to survive row inserts
const TVF_VOLUNTEER_PROFILE_SHEET = 'Gönüllü Kartları';
const TVF_ATTENDANCE_SHEET = 'Katılım'; // legacy fallback, still read if present
const TVF_WEEKLY_PLAN_SHEET = 'Haftalık Plan'; // primary check-in target (existing tab)
const TVF_CHECKIN_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const TVF_ATTENDANCE_DAYS = TVF_CHECKIN_DAYS;
const TVF_CHECKIN_KEY_HEADER = 'Kendi Girişi Anahtarı';
const TVF_CHECKIN_UPDATED_HEADER = 'Güncellenme';
const TVF_CHECKIN_DEVICE_HEADER = 'Tercih Edilen Cihaz';
const TVF_VOLUNTEER_PROFILE_HEADERS = [
  'Slug',
  'Ad Soyad',
  'Kamusal Ad',
  'Kart Yayında',
  'Rol / Kısa Ünvan',
  'Şehir',
  'Kurum / Üniversite',
  'Bölüm / Alan',
  'Konular',
  'Zaman / Uygunluk',
  'Kısa Tanım',
  'Arşiv Notu',
  'Biyografi',
  'Web',
  'Twitter/X',
  'LinkedIn',
  'GitHub',
  'ORCID',
  'Scholar',
  'Güncelleme Notu',
  'Son Kayıt',
  'İlk Kayıt',
  'Toplam Kayıt',
  'Sayfa Satırı',
  'Sayfa Birimi',
  'Materyal',
  'Kutular',
  'Kaynak',
  'Son Senkron'
];
const TVF_PUBLIC_ROLE_BY_NAME = {
  'gulistan eren': 'Gönüllü Koordinatörü'
};
const TVF_TRACK_ORDER = [
  'tarama',
  'tarama_is_bankasi',
  'envanter',
  'kurumsal_bellek',
  'proje_basvuru',
  'osmanlica',
  'egitim',
  'koordinasyon',
  'ars_web',
  'kodlama_kontrol',
  'diger'
];
const TVF_TRACK_LABELS = {
  tarama: 'Tarama (belge & kartpostal)',
  tarama_is_bankasi: 'Tarama (İş Bankası Müzesi)',
  envanter: 'Envanter (afiş, görsel-işitsel)',
  kurumsal_bellek: 'Kurum belleği (Karar Def., G.K.)',
  proje_basvuru: 'Proje çalışmaları',
  osmanlica: 'Osmanlıca çeviri',
  egitim: 'Eğitim (İş Bankası Müzesi)',
  koordinasyon: 'Koordinasyon & planlama',
  ars_web: 'Arşiv-web & IT',
  kodlama_kontrol: 'Kodlama & kontrol',
  diger: 'Diğer çalışma'
};

function invalidatePublicPayloadCache_() {
  try {
    CacheService.getScriptCache().removeAll(['public_payload_rolling_7_days', 'public_payload_calendar_week_to_date']);
  } catch (err) {
    // Non-fatal — worst case the next read is served from cache for up to 45s.
  }
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (params.public !== '1') {
      return tvfJson_({ ok: true, service: 'Tarih Vakfı Gönüllü Emek Günlüğü', hint: 'Add ?public=1' });
    }
    const mode = normalizePeriodMode_(params.period || params.mode);
    const cache = CacheService.getScriptCache();
    const cacheKey = 'public_payload_' + mode;
    const cached = cache.get(cacheKey);
    if (cached) {
      return tvfJson_(JSON.parse(cached));
    }
    const data = buildPublicDashboardPayload_(mode);
    const responseBody = { ok: true, generatedAt: data.generatedAt, data: data };
    try {
      // 45s: short enough that a coordinator's sheet edit shows up almost
      // immediately, long enough that the 20-60s client-side polling we run
      // mostly hits cache instead of re-reading the whole workbook.
      cache.put(cacheKey, JSON.stringify(responseBody), 45);
    } catch (cacheErr) {
      // Payload too large for CacheService (100KB/key limit) — fine, just skip caching.
    }
    return tvfJson_(responseBody);
  } catch (err) {
    return tvfJson_({ ok: false, error: String((err && err.message) || err) });
  }
}

/**
 * Self check-in endpoint for "Bu hafta kim geliyor".
 * Expects a JSON body (sent as text/plain from the browser to dodge CORS
 * preflight): { action: 'checkin', password, name, day, present }
 * `password` is compared against the CHECKIN_PASSWORD script property —
 * set it once via Project Settings → Script Properties, never commit it
 * to source. This is a shared-team gate, not per-person authentication:
 * it keeps random internet strangers out, it does not stop one volunteer
 * from checking in as another.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'checkin') {
      return tvfJson_({ ok: false, error: 'unknown_action' });
    }
    const expected = PropertiesService.getScriptProperties().getProperty('CHECKIN_PASSWORD');
    if (!expected) return tvfJson_({ ok: false, error: 'checkin_not_configured' });
    if (String(body.password || '') !== expected) {
      return tvfJson_({ ok: false, error: 'wrong_password' });
    }
    const name = safePublicText_(body.name, 80);
    if (!name) return tvfJson_({ ok: false, error: 'missing_name' });
    if (TVF_CHECKIN_DAYS.indexOf(body.day) < 0) {
      return tvfJson_({ ok: false, error: 'invalid_day' });
    }
    if (isPastCheckinDay_(body.day)) {
      return tvfJson_({ ok: false, error: 'past_day_locked' });
    }
    const present = body.present === true;
    const sheetId = PropertiesService.getScriptProperties().getProperty('TARIH_VAKFI_SHEET_ID');
    if (!sheetId) throw new Error('TARIH_VAKFI_SHEET_ID is not set');
    writeWeeklyPlanCheckIn_(sheetId, name, body.day, present);
    invalidatePublicPayloadCache_();
    return tvfJson_({ ok: true, name: name, day: body.day, present: present });
  } catch (err) {
    return tvfJson_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Maps a canonical weekday label (Pazartesi..Cuma) onto an actual calendar
 * date in the *current* Mon-Fri week, Türkiye time, and reports whether
 * that date has already passed. Today itself still counts as editable —
 * only strictly earlier days lock. The "Haftalık Plan" sheet only tracks
 * one week at a time (no date column), so "this week" is always assumed;
 * there's currently no way to check in for a week beyond the one the
 * coordinator has set up in the sheet.
 */
function isPastCheckinDay_(dayLabel) {
  const tz = 'Europe/Istanbul';
  const now = new Date();
  const todayKey = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const dayIndex = TVF_CHECKIN_DAYS.indexOf(dayLabel); // 0 Pazartesi .. 4 Cuma
  if (dayIndex < 0) return true;
  const isoDow = Number(Utilities.formatDate(now, tz, 'u')); // 1 Mon .. 7 Sun
  const mondayOffsetDays = -(isoDow - 1);
  const monday = new Date(now.getTime() + mondayOffsetDays * 86400000);
  const target = new Date(monday.getTime() + dayIndex * 86400000);
  const targetKey = Utilities.formatDate(target, tz, 'yyyy-MM-dd');
  return targetKey < todayKey;
}

/**
 * Fuzzy weekday match: ascii-folds and compares a short prefix, so a sheet
 * header typo like "Çarşama" (missing the 'b' in Çarşamba) still matches
 * the canonical day name the client sends. Real Turkish weekday names are
 * distinguishable within their first 4 letters (paza/sali/cars/pers/cuma).
 */
function daysMatch_(a, b) {
  const fa = asciiFold_(String(a || '')).toLowerCase().trim();
  const fb = asciiFold_(String(b || '')).toLowerCase().trim();
  if (!fa || !fb) return false;
  const n = Math.min(4, fa.length, fb.length);
  return fa.slice(0, n) === fb.slice(0, n);
}

function findDayColumn_(headerRow, day) {
  for (let i = 1; i < headerRow.length; i++) { // column A (0) is the station name, skip it
    if (daysMatch_(headerRow[i], day)) return i + 1; // 1-based
  }
  return -1;
}

/**
 * Writes a self check-in directly into the existing "Haftalık Plan" sheet
 * instead of a separate tab. Each self-check-in volunteer gets their own
 * dedicated row with column A left blank — the same shape as the existing
 * unlabeled "extra volunteer" rows already on that sheet (e.g. Öykü, Arda),
 * so the read side (readWeeklyPlan_ / extract_weekly_plan) picks these up
 * automatically as part of "Ek gönüllüler" with no extra logic needed.
 * A hidden key column (past the day columns) tracks row ownership per
 * volunteer so repeated toggles update the same row instead of piling up
 * duplicates. Device/equipment preference is fully optional — it's just
 * a note for the coordinator, never required to check in.
 */
function writeWeeklyPlanCheckIn_(sheetId, name, day, present) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(TVF_WEEKLY_PLAN_SHEET);
  if (!sheet) throw new Error('weekly_plan_sheet_missing: "' + TVF_WEEKLY_PLAN_SHEET + '" bulunamadı');

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = Math.max(sheet.getLastColumn(), 6);
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  const dayCol = findDayColumn_(headerRow, day);
  if (dayCol < 1) throw new Error('weekly_plan_day_column_missing: ' + day);

  let keyCol = headerRow.indexOf(TVF_CHECKIN_KEY_HEADER) + 1;
  let updatedCol = headerRow.indexOf(TVF_CHECKIN_UPDATED_HEADER) + 1;
  let deviceCol = headerRow.indexOf(TVF_CHECKIN_DEVICE_HEADER) + 1;
  if (!keyCol) {
    keyCol = lastCol + 1;
    sheet.getRange(1, keyCol).setValue(TVF_CHECKIN_KEY_HEADER);
    updatedCol = keyCol + 1;
    sheet.getRange(1, updatedCol).setValue(TVF_CHECKIN_UPDATED_HEADER);
    deviceCol = updatedCol + 1;
    sheet.getRange(1, deviceCol).setValue(TVF_CHECKIN_DEVICE_HEADER);
  } else {
    if (!updatedCol) {
      updatedCol = Math.max(lastCol, keyCol) + 1;
      sheet.getRange(1, updatedCol).setValue(TVF_CHECKIN_UPDATED_HEADER);
    }
    if (!deviceCol) {
      deviceCol = Math.max(lastCol, keyCol, updatedCol) + 1;
      sheet.getRange(1, deviceCol).setValue(TVF_CHECKIN_DEVICE_HEADER);
    }
  }

  const foldedName = asciiFold_(name).toLowerCase();
  let targetRow = 0;
  if (lastRow >= 2) {
    const keys = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (asciiFold_(String(keys[i][0] || '')).toLowerCase() === foldedName) {
        targetRow = i + 2;
        break;
      }
    }
  }
  if (!targetRow) {
    if (!present) return; // nothing to clear for a volunteer who has no row yet
    targetRow = lastRow + 1;
    sheet.getRange(targetRow, keyCol).setValue(name);
  }
  sheet.getRange(targetRow, dayCol).setValue(present ? name : '');
  sheet.getRange(targetRow, updatedCol).setValue(new Date());
}

function buildPublicDashboardPayload_(mode) {
  const sheetId = PropertiesService.getScriptProperties().getProperty('TARIH_VAKFI_SHEET_ID');
  if (!sheetId) throw new Error('TARIH_VAKFI_SHEET_ID is not set');
  const workbook = readWorkbook_(sheetId);
  const inventory = buildInventory_(workbook.rowsBySheet);
  const inventoryTotals = computeInventoryTotals_(workbook.rowsBySheet);
  const records = collectPublicRecords_(workbook.rowsBySheet, inventory);
  const volunteerProfiles = readPublicVolunteerProfiles_(workbook.rowsBySheet);
  const volunteerLogs = buildPublicVolunteerLogs_(records);
  const attendance = readAttendance_(workbook.rowsBySheet);
  const weeklyPlan = readWeeklyPlan_(workbook.weeklyPlanMatrix);
  const equipmentUsage = readEquipmentUsage_(workbook.rowsBySheet);
  const generatedAt = new Date();
  const summary = buildPublicSummaryFromRows(records, inventory, inventoryTotals, generatedAt, mode || 'rolling_7_days', workbook.pnbProgress);
  const trackSummary = buildTrackSummary_(records, generatedAt);
  return {
    generatedAt: summary.generatedAt,
    publicSummary: summary,
    trackSummary: trackSummary,
    latestActivity: latestActivity_(records, TVF_LATEST_LIMIT, generatedAt),
    content: publicContent_(volunteerProfiles, volunteerLogs, attendance, weeklyPlan, equipmentUsage),
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

function readAttendance_(rowsBySheet) {
  const volunteers = [];
  Object.keys(rowsBySheet || {}).forEach(function (title) {
    if (classifySheet_(title) !== 'attendance') return;
    (rowsBySheet[title] || []).forEach(function (row) {
      const name = safePublicText_(row.adSoyad || row.name, 80);
      if (!name) return;
      const byDay = {};
      TVF_ATTENDANCE_DAYS.forEach(function (day) {
        const key = headerToKey_(day); // pazartesi, sali, carsamba, persembe, cuma
        byDay[day] = row[key] === true || String(row[key] || '').trim().toLowerCase() === 'true';
      });
      volunteers.push({ name: name, byDay: byDay, updatedAt: row.guncellenme || null });
    });
  });
  volunteers.sort(function (a, b) { return asciiFold_(a.name).localeCompare(asciiFold_(b.name)); });
  return { days: TVF_ATTENDANCE_DAYS, volunteers: volunteers };
}

function readWeeklyPlan_(matrix) {
  if (!matrix || matrix.length < 2) return null;
  const headerRow = matrix[0] || [];
  const days = headerRow.slice(1, 6).map(function (v) { return v == null ? '' : String(v).trim(); }).filter(Boolean);
  if (!days.length) return null;
  const keyCol = headerRow.indexOf('Kendi Girişi Anahtarı');
  const deviceCol = headerRow.indexOf('Tercih Edilen Cihaz');
  const stations = [];
  const extras = {};
  days.forEach(function (d) { extras[d] = []; });
  matrix.slice(1).forEach(function (row) {
    if (!row || !row.some(function (v) { return v != null && String(v).trim() !== ''; })) return;
    const stationRaw = row[0];
    const station = stationRaw ? String(stationRaw).trim() : '';
    const checkinKey = (keyCol >= 0 && row[keyCol]) ? String(row[keyCol]).trim() : '';
    const rowDevice = (deviceCol >= 0 && row[deviceCol]) ? String(row[deviceCol]).trim() : null;
    const assignments = {};
    let any = false;
    days.forEach(function (day, i) {
      const cell = row[i + 1];
      const value = cell ? String(cell).trim() : null;
      assignments[day] = value;
      if (value) any = true;
      if (!station && value) {
        let names;
        if (checkinKey) {
          names = [checkinKey]; // self check-in: one verbatim name, never split
        } else if (value.split(/\s+/).length > 1) {
          names = value.split(/\s+(?=[A-ZÇĞİÖŞÜ])/); // coordinator shorthand, e.g. "Öykü Arda"
        } else {
          names = [value];
        }
        const existingNames = extras[day].map(function (e) { return e.name; });
        names.forEach(function (name) {
          if (name && existingNames.indexOf(name) < 0) {
            extras[day].push({ name: name, device: checkinKey ? rowDevice : null });
            existingNames.push(name);
          }
        });
      }
    });
    if (station && any) stations.push({ station: station, byDay: assignments });
  });
  const hasExtras = Object.keys(extras).some(function (d) { return extras[d].length; });
  if (!stations.length && !hasExtras) return null;
  return { days: days, stations: stations, extras: extras };
}

function readEquipmentUsage_(rowsBySheet) {
  const counts = {};
  Object.keys(rowsBySheet || {}).forEach(function (title) {
    if (classifySheet_(title) !== 'activity') return;
    (rowsBySheet[title] || []).forEach(function (row) {
      const raw = row.tarayici;
      if (!raw) return;
      const key = String(raw).trim().replace(/\s+/g, ' ');
      const label = key.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
      counts[label] = (counts[label] || 0) + 1;
    });
  });
  return Object.keys(counts)
    .map(function (device) { return { device: device, sessions: counts[device] }; })
    .sort(function (a, b) { return b.sessions - a.sessions; })
    .slice(0, 12);
}

function publicContent_(volunteerProfiles, volunteerLogs, attendance, weeklyPlan, equipmentUsage) {
  const content = {};
  if (volunteerProfiles && volunteerProfiles.length) content.volunteerProfiles = volunteerProfiles;
  if (volunteerLogs && volunteerLogs.length) content.volunteerLogs = volunteerLogs;
  if (attendance && attendance.volunteers && attendance.volunteers.length) content.attendance = attendance;
  if (weeklyPlan) content.weeklyPlan = weeklyPlan;
  if (equipmentUsage && equipmentUsage.length) content.equipmentUsage = equipmentUsage;
  return content;
}

function buildPublicSummaryFromRows(records, inventory, inventoryTotals, now, mode, pnbProgress) {
  const period = selectedPeriod_(now, mode || 'rolling_7_days');
  const periodRecords = records.filter(function (record) {
    return record.dateISO && record.dateISO >= period.startDate && record.dateISO <= period.endDate;
  });
  const pageRecords = periodRecords.filter(function (record) { return record.kind === 'page'; });
  const activityRecords = periodRecords.filter(function (record) { return record.kind === 'activity'; });

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
  const byTrack = buildPeriodTrackRows_(periodRecords);
  const namedVolunteerKeys = {};
  periodRecords.forEach(function (record) {
    if (record.privateKey && isPublicNamedLabel_(record.publicLabel)) namedVolunteerKeys[record.privateKey] = true;
  });

  const inventoryBoxes = Object.keys(inventory).map(function (key) { return inventory[key]; }).filter(function (box) {
    return box.targetPages || box.files || box.documents;
  });
  const targetPages = Number(inventoryTotals.totalPages || 0);
  const progressSignal = normalizeProgressSignal_(pnbProgress) || inventoryProgressSignal_(inventoryBoxes, targetPages);
  const progressPercent = progressSignal ? progressSignal.percent : 0;
  const pagesDone = targetPages > 0 && progressSignal
    ? Math.round((targetPages * progressPercent) / 100)
    : inventoryProgressPages_(inventoryBoxes);
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
      volunteerCredit: 'credit-visible, ID-safe volunteer display',
      volunteerCreditBasis: 'row_explicit_only',
      progressBasis: progressSignal ? progressSignal.basis : null,
      progressCell: progressSignal ? (progressSignal.cell || null) : null
    },
    period: period,
    totals: {
      records: periodRecords.length,
      pageRows: pageRecords.length,
      activityRows: activityRecords.length,
      periodPagesDone: pageRecords.reduce(function (sum, record) { return sum + Number(record.pageUnits || 1); }, 0),
      pagesDone: pagesDone,
      pagesTarget: targetPages,
      progressPercent: progressPercent,
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
    byTrack: byTrack,
    highlights: {
      busiestDay: busiestDay,
      latestDate: periodRecords.length ? periodRecords[0].dateISO : null,
      topMaterial: byMaterial[0] || null,
      firstCompletedBox: null
    },
    warnings: warnings
  };
}

function inventoryProgressPages_(inventoryBoxes) {
  return (inventoryBoxes || []).reduce(function (sum, box) {
    const target = Number(box.targetPages || 0);
    if (target <= 0) return sum;
    const done = Math.max(Number(box.summaryDonePages || 0), Number(box.detailDonePages || 0));
    return sum + Math.min(done, target);
  }, 0);
}

function inventoryProgressSignal_(inventoryBoxes, targetPages) {
  const target = Number(targetPages || 0);
  if (target <= 0) return null;
  const done = inventoryProgressPages_(inventoryBoxes);
  return {
    percent: round1_((done / target) * 100),
    basis: 'pnb_inventory_done_total_scan',
    cell: null
  };
}

function normalizeProgressSignal_(signal) {
  if (signal == null || signal === '') return null;
  if (typeof signal === 'number' || typeof signal === 'string') {
    const percent = normalizeProgressPercent_(signal);
    return percent == null ? null : { percent: percent, basis: 'unknown_progress_percent', cell: null };
  }
  const percent = normalizeProgressPercent_(signal.percent);
  if (percent == null) return null;
  return {
    percent: percent,
    basis: signal.basis || 'unknown_progress_percent',
    cell: signal.cell || null
  };
}

function buildPeriodTrackRows_(periodRecords) {
  const trackGroups = {};
  (periodRecords || []).forEach(function (record) {
    if (!isPublicNamedLabel_(record.publicLabel)) return;
    const key = trackKeyForRecord_(record);
    if (!trackGroups[key]) {
      trackGroups[key] = {
        key: key,
        label: trackLabel_(key),
        records: 0,
        pageRows: 0,
        activityRows: 0,
        pagesDone: 0,
        contributors: {}
      };
    }
    const group = trackGroups[key];
    const people = publicPeopleFromLabel_(record.publicLabel);
    group.records += 1;
    if (record.kind === 'page') {
      group.pageRows += 1;
      group.pagesDone += Number(record.pageUnits || 1);
    } else {
      group.activityRows += 1;
    }
    people.forEach(function (person) {
      const ckey = person.key;
      if (!group.contributors[ckey]) {
        group.contributors[ckey] = {
          labels: [],
          roles: [],
          records: 0,
          pageRows: 0,
          activityRows: 0,
          pagesDone: 0
        };
      }
      const contributor = group.contributors[ckey];
      contributor.labels.push(person.label);
      contributor.roles.push(record.publicRole || '');
      contributor.records += 1;
      if (record.kind === 'page') {
        contributor.pageRows += 1;
        contributor.pagesDone += Number(record.pageUnits || 1);
      } else {
        contributor.activityRows += 1;
      }
    });
  });

  const seen = {};
  const orderedKeys = TVF_TRACK_ORDER.concat(Object.keys(trackGroups)).filter(function (key) {
    if (seen[key] || !trackGroups[key]) return false;
    seen[key] = true;
    return true;
  });
  return orderedKeys.map(function (key) {
    const group = trackGroups[key];
    const contributors = Object.keys(group.contributors).map(function (ckey) {
      const row = group.contributors[ckey];
      const label = preferredVolunteerLabel_(row.labels);
      if (!isPublicNamedLabel_(label)) return null;
      return {
        label: label,
        publicRole: preferredPublicRole_(row.roles, label),
        records: row.records,
        pageRows: row.pageRows,
        activityRows: row.activityRows,
        pagesDone: row.pagesDone
      };
    }).filter(Boolean).sort(function (a, b) {
      return b.records - a.records || a.label.localeCompare(b.label, 'tr');
    });
    return {
      key: group.key,
      label: group.label,
      records: group.records,
      pageRows: group.pageRows,
      activityRows: group.activityRows,
      pagesDone: group.pagesDone,
      peopleCount: contributors.length,
      contributors: contributors
    };
  }).filter(function (group) {
    return group.records > 0 && group.contributors.length > 0;
  }).sort(function (a, b) {
    return b.records - a.records
      || TVF_TRACK_ORDER.indexOf(a.key) - TVF_TRACK_ORDER.indexOf(b.key)
      || a.label.localeCompare(b.label, 'tr');
  });
}

function readWorkbook_(sheetId) {
  const metadata = fetchSheetsApi_(sheetId, '?fields=sheets(properties(title))');
  const titles = ((metadata.sheets || []).map(function (sheet) {
    return sheet.properties && sheet.properties.title;
  }) || []).filter(Boolean);

  // Single batched request instead of one HTTP round-trip per sheet — with
  // ~90+ PNB detail tabs in this workbook, the old per-sheet loop meant
  // ~90 sequential UrlFetch calls on every single page load/poll, which is
  // what made the check-in page feel slow to load.
  const rangeParams = titles.map(function (t) {
    return 'ranges=' + encodeURIComponent(t + '!A1:AZ5000');
  }).join('&');
  const batch = titles.length ? fetchSheetsApi_(sheetId, '/values:batchGet?' + rangeParams) : { valueRanges: [] };
  const matrixByTitle = {};
  (batch.valueRanges || []).forEach(function (vr, i) {
    matrixByTitle[titles[i]] = vr.values || [];
  });

  const rowsBySheet = {};
  const sheetInfo = [];
  let pnbProgress = null;
  let weeklyPlanMatrix = null;
  const workbookSheets = [];
  titles.forEach(function (title) {
    const matrix = matrixByTitle[title] || [];
    const classification = classifySheet_(title);
    workbookSheets.push({ title: title, classification: classification, matrix: matrix });
    if (classification === 'weekly_plan' && weeklyPlanMatrix == null) {
      weeklyPlanMatrix = matrix;
    }
    if (classification === 'pnb_inventory' && pnbProgress == null) {
      pnbProgress = readProgressCellSignal_(sheetId, title);
    }
    const rows = rowsFromMatrix_(title, matrix);
    rowsBySheet[title] = rows.rows;
    sheetInfo.push({ title: title, classification: classification, rows: rows.rows.length, headers: rows.headers });
  });
  if (pnbProgress == null) pnbProgress = findWorkbookProgress_(workbookSheets);
  return { sheetInfo: sheetInfo, rowsBySheet: rowsBySheet, pnbProgress: pnbProgress, weeklyPlanMatrix: weeklyPlanMatrix };
}

function matrixValue_(matrix, oneBasedRow, oneBasedCol) {
  const row = matrix && matrix[oneBasedRow - 1];
  return row ? row[oneBasedCol - 1] : null;
}

// Reads the "toplam ilerleme" value directly with UNFORMATTED_VALUE so we get
// the raw number instead of a locale-formatted display string. Tries the
// optional named range first (a named range follows the cell when rows are
// inserted/deleted), then falls back to the fixed A1 address. Returns null on
// any formula error (#REF!, #DIV/0!, ...), non-numeric text, or a value
// outside (0, 100], so the caller can fall through to the inventory-based
// fallback instead of confidently publishing a bogus 0%.
function readProgressCellSignal_(sheetId, sheetTitle) {
  const candidates = [
    { range: TVF_PROGRESS_NAMED_RANGE, cell: TVF_PROGRESS_NAMED_RANGE },
    { range: "'" + sheetTitle + "'!" + TVF_PROGRESS_A1, cell: sheetTitle + '!' + TVF_PROGRESS_A1 }
  ];
  for (let i = 0; i < candidates.length; i++) {
    let raw = null;
    try {
      const encoded = '/values/' + encodeURIComponent(candidates[i].range) + '?valueRenderOption=UNFORMATTED_VALUE';
      const result = fetchSheetsApi_(sheetId, encoded);
      raw = result.values && result.values[0] ? result.values[0][0] : null;
    } catch (err) {
      continue; // named range not defined, or transient API error → try next candidate
    }
    const percent = strictProgressPercent_(raw);
    if (percent != null) {
      return { percent: percent, basis: 'pnb_sayisallastirma_l105', cell: candidates[i].cell };
    }
  }
  return null;
}

function strictProgressPercent_(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && value.charAt(0) === '#') return null; // formula error cell
  if (typeof value !== 'number' && !/\d/.test(String(value))) return null; // no digits at all → unparseable
  const percent = parseProgressPercent_(value);
  if (percent == null || !isFinite(percent) || percent <= 0 || percent > 100) return null;
  return percent;
}

function findWorkbookProgress_(sheets) {
  let best = null;
  (sheets || []).forEach(function (sheet) {
    const matrix = sheet.matrix || [];
    matrix.forEach(function (row, rIdx) {
      (row || []).forEach(function (value, cIdx) {
        const label = String(value == null ? '' : value).trim();
        const score = progressLabelScore_(label, sheet);
        if (!score) return;
        progressNeighborOffsets_().forEach(function (offset) {
          const candidate = matrixValue_(matrix, rIdx + 1 + offset.r, cIdx + 1 + offset.c);
          const percent = parseProgressPercentCandidate_(candidate);
          if (percent == null) return;
          const cell = sheet.title + '!' + a1_(rIdx + 1 + offset.r, cIdx + 1 + offset.c);
          const candidateScore = score - Math.abs(offset.r) - Math.abs(offset.c) / 10;
          if (!best || candidateScore > best.score) {
            best = {
              percent: percent,
              basis: 'workbook_progress_label_scan',
              cell: cell,
              score: candidateScore
            };
          }
        });
      });
    });
  });
  return best ? { percent: best.percent, basis: best.basis, cell: best.cell } : null;
}

function progressNeighborOffsets_() {
  return [
    { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }, { r: 0, c: 4 },
    { r: 1, c: 0 }, { r: 1, c: 1 }, { r: -1, c: 0 }, { r: 0, c: -1 }
  ];
}

function progressLabelScore_(label, sheet) {
  const haystack = asciiFold_([sheet.title, label].join(' ')).toLowerCase();
  if (!(haystack.indexOf('ilerleme') >= 0 || haystack.indexOf('tamamlan') >= 0 || haystack.indexOf('progress') >= 0 || haystack.indexOf('oran') >= 0 || haystack.indexOf('yuzde') >= 0)) {
    return 0;
  }
  let score = 10;
  if (haystack.indexOf('toplam ilerleme') >= 0 || haystack.indexOf('genel ilerleme') >= 0) score += 20;
  if (sheet.classification === 'pnb_inventory' || haystack.indexOf('pnb') >= 0 || haystack.indexOf('sayisallastirma') >= 0) score += 10;
  return score;
}

function parseProgressPercentCandidate_(value) {
  return strictProgressPercent_(value);
}

function a1_(oneBasedRow, oneBasedCol) {
  let col = '';
  let n = oneBasedCol;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col + String(oneBasedRow);
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
      rows.forEach(function (row) {
        const enriched = copyObject_(row);
        let label = getVolunteerDisplayName_(enriched);
        const when = parseSheetDate_(row.tarih);
        const pageUnits = 1;
        const box = publicBoxLabel_(row.kutu || row.kutuNo);
        const workTitle = publicWorkTitle_(row);
        const workDetail = publicWorkDetail_(row);
        const originalCreditStatus = creditStatus_(enriched);
        const suppressed = isSuppressedLegacyCredit_(label, {
          kind: 'page',
          box: box,
          workTitle: workTitle,
          workDetail: workDetail
        });
        if (suppressed) label = TVF_UNNAMED;
        const publicRole = suppressed ? '' : getPublicRole_(enriched, label);
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
          creditStatus: suppressed ? 'suppressed_legacy_sheet_title_credit' : originalCreditStatus,
          box: box,
          pageUnits: pageUnits,
          workTitle: workTitle,
          workDetail: workDetail
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
        const workTitle = publicWorkTitle_(row);
        const workDetail = publicWorkDetail_(row);
        // Column E, "Yapılan Çalışmaya İlişkin Sayısal Bilgi" — the volunteer's
        // own reported page/document count for that entry. This used to be
        // hardcoded to 0, silently discarding every number logged here.
        const numericInfo = parseLocaleNumber_(row.yapilanCalismayaIliskinSayisalBilgi);
        const units = numericInfo > 0 ? Math.round(numericInfo) : 0;
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
          pageUnits: units,
          workTitle: workTitle,
          workDetail: workDetail
        });
      });
    }
  });
  return records;
}

function buildTrackSummary_(records, now) {
  const rows = (records || []).filter(function (record) {
    return record.kind === 'activity' && record.dateISO;
  });
  const monthSeen = {};
  const trackRows = {};
  const personSeen = {};

  rows.forEach(function (record) {
    const month = String(record.dateISO).slice(0, 7);
    const key = trackKeyFromActivity_(record);
    monthSeen[month] = true;
    if (!trackRows[key]) {
      trackRows[key] = {
        key: key,
        label: trackLabel_(key),
        sessions: 0,
        byMonth: {},
        peopleMap: {}
      };
    }
    trackRows[key].sessions += 1;
    inc_(trackRows[key].byMonth, month, 1);
    if (isPublicNamedLabel_(record.publicLabel)) {
      publicPeopleFromLabel_(record.publicLabel).forEach(function (person) {
        trackRows[key].peopleMap[person.key] = preferredVolunteerLabel_([
          trackRows[key].peopleMap[person.key],
          person.label
        ]);
        personSeen[person.key] = preferredVolunteerLabel_([
          personSeen[person.key],
          person.label
        ]);
      });
    }
  });

  const orderIndex = {};
  TVF_TRACK_ORDER.forEach(function (key, idx) { orderIndex[key] = idx; });
  const tracks = Object.keys(trackRows).map(function (key) {
    const row = trackRows[key];
    const people = Object.keys(row.peopleMap).map(function (personKey) { return row.peopleMap[personKey]; })
      .sort(function (a, b) { return a.localeCompare(b, 'tr'); });
    return {
      key: row.key,
      label: row.label,
      sessions: row.sessions,
      byMonth: row.byMonth,
      peopleCount: people.length,
      people: people
    };
  }).sort(function (a, b) {
    return Number(b.sessions || 0) - Number(a.sessions || 0)
      || (orderIndex[a.key] == null ? 999 : orderIndex[a.key]) - (orderIndex[b.key] == null ? 999 : orderIndex[b.key])
      || a.label.localeCompare(b.label, 'tr');
  });

  const people = Object.keys(personSeen).map(function (key) { return personSeen[key]; })
    .sort(function (a, b) { return a.localeCompare(b, 'tr'); });
  return {
    generatedAt: isoDateTime_(now || new Date()),
    source: {
      name: 'Günlük Akış',
      rows: rows.length,
      method: 'activity-row-track-summary'
    },
    monthsActive: Object.keys(monthSeen).sort(),
    peopleCount: people.length,
    people: people,
    tracks: tracks
  };
}

function buildPublicVolunteerLogs_(records) {
  const groups = {};
  (records || []).forEach(function (record) {
    if (!record || !record.dateISO || !isPublicNamedLabel_(record.publicLabel)) return;
    const people = publicPeopleFromLabel_(record.publicLabel);
    people.forEach(function (person) {
      const key = person.key;
      if (!key) return;
      if (!groups[key]) {
        groups[key] = {
          label: person.label,
          slug: volunteerSlug_(person.label),
          publicRole: '',
          records: 0,
          pageRows: 0,
          activityRows: 0,
          pagesDone: 0,
          boxes: {},
          tracks: {},
          entries: {}
        };
      }
      const group = groups[key];
      group.label = preferredVolunteerLabel_([group.label, person.label]);
      if (!group.publicRole && record.publicRole) group.publicRole = record.publicRole;
      group.records += 1;
      if (record.kind === 'page') {
        group.pageRows += 1;
        group.pagesDone += Number(record.pageUnits || 1);
      } else {
        group.activityRows += 1;
      }
      const trackKey = trackKeyForRecord_(record);
      if (!group.tracks[trackKey]) {
        group.tracks[trackKey] = {
          key: trackKey,
          label: trackLabel_(trackKey),
          records: 0,
          pageRows: 0,
          activityRows: 0,
          pagesDone: 0
        };
      }
      const track = group.tracks[trackKey];
      track.records += 1;
      if (record.kind === 'page') {
        track.pageRows += 1;
        track.pagesDone += Number(record.pageUnits || 1);
      } else {
        track.activityRows += 1;
      }
      const boxLabel = record.box ? ('Kutu ' + record.box) : '';
      if (boxLabel) group.boxes[boxLabel] = true;
      const entryKey = [
        record.dateISO || '',
        record.kind || '',
        trackKey,
        record.material || '',
        boxLabel,
        record.workTitle || '',
        record.workDetail || ''
      ].join('|');
      if (!group.entries[entryKey]) {
        group.entries[entryKey] = {
          dateISO: record.dateISO || '',
          kind: record.kind || '',
          track: trackKey,
          trackLabel: trackLabel_(trackKey),
          material: record.material || '',
          boxLabel: boxLabel,
          workTitle: record.workTitle || '',
          workDetail: record.workDetail || '',
          records: 0,
          pageRows: 0,
          activityRows: 0,
          pagesDone: 0
        };
      }
      const entry = group.entries[entryKey];
      entry.records += 1;
      if (record.kind === 'page') {
        entry.pageRows += 1;
        entry.pagesDone += Number(record.pageUnits || 1);
      } else {
        entry.activityRows += 1;
      }
    });
  });

  const orderIndex = {};
  TVF_TRACK_ORDER.forEach(function (key, idx) { orderIndex[key] = idx; });
  return Object.keys(groups).map(function (key) {
    const group = groups[key];
    const label = preferredVolunteerLabel_([group.label]);
    const tracks = Object.keys(group.tracks).map(function (trackKey) { return group.tracks[trackKey]; })
      .sort(function (a, b) {
        return Number(b.records || 0) - Number(a.records || 0)
          || (orderIndex[a.key] == null ? 999 : orderIndex[a.key]) - (orderIndex[b.key] == null ? 999 : orderIndex[b.key])
          || a.label.localeCompare(b.label, 'tr');
      });
    const entries = Object.keys(group.entries).map(function (entryKey) { return group.entries[entryKey]; })
      .sort(function (a, b) {
        return String(b.dateISO || '').localeCompare(String(a.dateISO || ''))
          || Number(b.records || 0) - Number(a.records || 0)
          || String(a.trackLabel || '').localeCompare(String(b.trackLabel || ''), 'tr')
          || String(a.workTitle || '').localeCompare(String(b.workTitle || ''), 'tr');
      });
    return {
      label: label,
      slug: volunteerSlug_(label),
      publicRole: group.publicRole || preferredPublicRole_([], label),
      records: group.records,
      pageRows: group.pageRows,
      activityRows: group.activityRows,
      pagesDone: group.pagesDone,
      boxes: Object.keys(group.boxes).sort(function (a, b) { return normalizeBox_(a).localeCompare(normalizeBox_(b)); }),
      tracks: tracks,
      entries: entries
    };
  }).sort(function (a, b) {
    return Number(b.records || 0) - Number(a.records || 0)
      || a.label.localeCompare(b.label, 'tr');
  });
}

function trackKeyFromActivity_(record) {
  const haystack = asciiFold_([
    record.workTitle,
    record.workDetail,
    record.material,
    record.publicRole,
    record.projectId
  ].join(' ')).toLowerCase();

  if (/\b(web|site|teknik|it)\b/.test(haystack) || haystack.indexOf('arsiv web') >= 0 || haystack.indexOf('arsiv-web') >= 0) {
    return 'ars_web';
  }
  if (haystack.indexOf('is bankasi') >= 0) {
    return 'tarama_is_bankasi';
  }
  if (haystack.indexOf('tarama') >= 0 && haystack.indexOf('egitim') >= 0) {
    return 'tarama';
  }
  if (haystack.indexOf('egitim') >= 0 || haystack.indexOf('muze') >= 0) {
    return 'egitim';
  }
  if (haystack.indexOf('osmanlica') >= 0 || haystack.indexOf('ceviri') >= 0) {
    return 'osmanlica';
  }
  if (haystack.indexOf('envanter') >= 0 || haystack.indexOf('afis') >= 0 || haystack.indexOf('gorsel') >= 0 || haystack.indexOf('harita') >= 0 || haystack.indexOf('dvd') >= 0 || haystack.indexOf('video') >= 0 || haystack.indexOf('sozlu tarih') >= 0 || haystack.indexOf('aktarim') >= 0 || haystack.indexOf('tashih') >= 0) {
    return 'envanter';
  }
  if (haystack.indexOf('kronoloji') >= 0 || haystack.indexOf('karar defter') >= 0 || haystack.indexOf('genel kurul') >= 0 || haystack.indexOf('faaliyet rapor') >= 0 || haystack.indexOf('kurucu') >= 0) {
    return 'kurumsal_bellek';
  }
  if (haystack.indexOf('gerda') >= 0 || haystack.indexOf('basvuru') >= 0 || haystack.indexOf('proje butcesi') >= 0 || haystack.indexOf('proje form') >= 0 || haystack.indexOf('proje hazir') >= 0 || haystack.indexOf('proje deger') >= 0 || haystack.indexOf('culture civic') >= 0 || haystack.indexOf('salt') >= 0 || haystack.indexOf('fon') >= 0) {
    return 'proje_basvuru';
  }
  if (haystack.indexOf('koordinasyon') >= 0 || haystack.indexOf('koordinator') >= 0 || haystack.indexOf('planlama') >= 0 || haystack.indexOf('oryantasyon') >= 0 || haystack.indexOf('organizasyon') >= 0 || haystack.indexOf('toplanti') >= 0 || haystack.indexOf('gorusme') >= 0) {
    return 'koordinasyon';
  }
  if (haystack.indexOf('kodlama') >= 0 || haystack.indexOf('kontrol') >= 0 || haystack.indexOf('duzelt') >= 0 || haystack.indexOf('duzenleme') >= 0 || haystack.indexOf('adlandirma') >= 0) {
    return 'kodlama_kontrol';
  }
  if (haystack.indexOf('tarama') >= 0 || haystack.indexOf('sayisallastirma') >= 0 || haystack.indexOf('dijitallestirme') >= 0 || haystack.indexOf('dia') >= 0 || haystack.indexOf('pnb') >= 0 || haystack.indexOf('kutu') >= 0) {
    return 'tarama';
  }
  return 'diger';
}

function trackKeyForRecord_(record) {
  if (record && record.kind === 'page') return 'tarama';
  return trackKeyFromActivity_(record || {});
}

function trackLabel_(key) {
  return TVF_TRACK_LABELS[key] || TVF_TRACK_LABELS.diger;
}

function isSuppressedLegacyCredit_(label, meta) {
  const key = contributorKey_(normalizeVolunteerName_(label));
  if (key !== 'betul iseri') return false;
  if (!meta || meta.kind !== 'page') return false;
  return normalizeBox_(meta.box || meta.boxLabel || '') === '31';
}

function publicPeopleFromLabel_(label) {
  if (!isPublicNamedLabel_(label)) return [];
  return String(label || '')
    .split(/\s*(?:,|;|\n|\s+-\s+)\s*/)
    .map(function (item) { return normalizeVolunteerName_(item); })
    .filter(function (item) { return isPublicNamedLabel_(item); })
    .map(function (item) {
      return {
        key: contributorKey_(item),
        label: item
      };
    })
    .filter(function (item, idx, arr) {
      return arr.findIndex(function (other) { return other.key === item.key; }) === idx;
    });
}

function latestActivity_(records, limit, now) {
  const todayISO = now ? isoDate_(now) : '9999-12-31';
  return records.filter(function (record) {
    return record.when instanceof Date
      && !isNaN(record.when.getTime())
      && record.dateISO
      && record.dateISO <= todayISO
      && isPublicNamedLabel_(record.publicLabel);
  }).sort(function (a, b) {
    return b.when.getTime() - a.when.getTime();
  }).slice(0, limit || TVF_LATEST_LIMIT).map(function (record) {
    const item = {
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
    if (record.workTitle) item.workTitle = record.workTitle;
    if (record.workDetail) item.workDetail = record.workDetail;
    return item;
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
      pagesDone: contributorPageRows.reduce(function (sum, record) { return sum + Number(record.pageUnits || 1); }, 0),
      workRows: publicWorkRowsForContributor_(recs, 4)
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

function publicWorkRowsForContributor_(records, limit) {
  const groups = {};
  (records || []).forEach(function (record) {
    const boxLabel = record.box ? ('Kutu ' + record.box) : '';
    const key = [
      record.kind || '',
      record.material || '',
      boxLabel,
      record.workTitle || '',
      record.workDetail || ''
    ].join('|');
    if (!groups[key]) {
      groups[key] = {
        dateISO: record.dateISO || null,
        kind: record.kind || '',
        material: record.material || '',
        boxLabel: boxLabel,
        workTitle: record.workTitle || '',
        workDetail: record.workDetail || '',
        records: 0,
        pageRows: 0,
        activityRows: 0,
        pagesDone: 0
      };
    }
    const group = groups[key];
    group.records += 1;
    if (record.kind === 'page') {
      group.pageRows += 1;
      group.pagesDone += Number(record.pageUnits || 1);
    } else {
      group.activityRows += 1;
    }
  });
  return Object.keys(groups).map(function (key) {
    return groups[key];
  }).sort(function (a, b) {
    return (b.records - a.records)
      || String(a.workTitle || '').localeCompare(String(b.workTitle || ''), 'tr')
      || String(a.workDetail || '').localeCompare(String(b.workDetail || ''), 'tr');
  }).slice(0, limit || 4);
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

/**
 * Run manually from Apps Script to create/update the volunteer-editable card tab.
 *
 * The function preserves volunteer-entered profile fields and refreshes only
 * the identity/metric columns from the live archive sheets.
 */
function refreshVolunteerProfileTab() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('TARIH_VAKFI_SHEET_ID');
  if (!sheetId) throw new Error('TARIH_VAKFI_SHEET_ID is not set');
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const workbook = readWorkbook_(sheetId);
  const inventory = buildInventory_(workbook.rowsBySheet);
  const records = collectPublicRecords_(workbook.rowsBySheet, inventory);
  const sheet = spreadsheet.getSheetByName(TVF_VOLUNTEER_PROFILE_SHEET)
    || spreadsheet.insertSheet(TVF_VOLUNTEER_PROFILE_SHEET);
  const existingRows = readVolunteerProfileRowsFromSheet_(sheet);
  const seeds = buildVolunteerProfileSeeds_(records, workbook.rowsBySheet, existingRows);
  const output = mergeVolunteerProfileRows_(seeds, existingRows);
  writeVolunteerProfileSheet_(sheet, output);
  return {
    sheetName: TVF_VOLUNTEER_PROFILE_SHEET,
    volunteers: output.length,
    generatedAt: isoDateTime_(new Date())
  };
}

function readPublicVolunteerProfiles_(rowsBySheet) {
  const profiles = [];
  Object.keys(rowsBySheet || {}).forEach(function (title) {
    if (classifySheet_(title) !== 'volunteer_profiles') return;
    (rowsBySheet[title] || []).forEach(function (row) {
      if (!profileIsVisible_(row.kartYayinda)) return;
      const name = normalizeVolunteerName_(row.kamusalAd || row.adSoyad);
      if (!isPublicNamedLabel_(name)) return;
      const profile = {
        slug: volunteerSlug_(row.slug || name),
        name: name
      };
      const role = normalizePublicRole_(row.rolKisaUnvan || row.rol || row.role || row.gorev);
      const city = safePublicText_(row.sehir || row.city || row.il, 80);
      const uni = safePublicText_(row.kurumUniversite || row.universite || row.kurum, 120);
      const dept = safePublicText_(row.bolumAlan || row.bolum || row.departman || row.alan, 120);
      const topics = splitPublicList_(row.konular || row.ilgiAlanlari, 8, 60);
      const slots = splitPublicList_(row.zamanUygunluk || row.musaitlik || row.slots, 8, 40);
      const bio = {};
      const shortRole = safePublicText_(row.kisaTanim || row.shortRole, 180);
      const tvNarrative = safePublicLongText_(row.arsivNotu || row.tvNarrative, 420);
      const narrative = safePublicLongText_(row.biyografi || row.narrative, 700);
      const website = safePublicLink_(row.web || row.website, 'website');
      const twitter = safePublicLink_(row.twitterX || row.twitter, 'handle');
      const linkedin = safePublicLink_(row.linkedin, 'handle');
      const github = safePublicLink_(row.github, 'handle');
      const orcid = safePublicLink_(row.orcid, 'orcid');
      const scholar = safePublicLink_(row.scholar, 'website');
      if (shortRole) bio.shortRole = shortRole;
      if (tvNarrative) bio.tvNarrative = tvNarrative;
      if (narrative) bio.narrative = narrative;
      if (website) bio.website = website;
      if (twitter) bio.twitter = twitter;
      if (linkedin) bio.linkedin = linkedin;
      if (github) bio.github = github;
      if (orcid) bio.orcid = orcid;
      if (scholar) bio.scholar = scholar;
      if (role) profile.role = role;
      if (city) profile.city = city;
      if (uni) profile.uni = uni;
      if (dept) profile.dept = dept;
      if (topics.length) profile.topics = topics;
      if (slots.length) profile.slots = slots;
      if (Object.keys(bio).length) profile.bio = bio;
      profiles.push(profile);
    });
  });
  return profiles.sort(function (a, b) { return asciiFold_(a.name).localeCompare(asciiFold_(b.name)); });
}

function readVolunteerProfileRowsFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  return rowsFromMatrix_(TVF_VOLUNTEER_PROFILE_SHEET, values).rows;
}

function buildVolunteerProfileSeeds_(records, rowsBySheet, existingRows) {
  const seeds = {};
  records.forEach(function (record) {
    const seed = ensureVolunteerProfileSeed_(seeds, record.publicLabel);
    if (!seed) return;
    seed.sources.records = true;
    seed.records += 1;
    if (record.kind === 'page') {
      seed.pageRows += 1;
      seed.pagesDone += Number(record.pageUnits || 1);
    }
    if (record.publicRole) addUnique_(seed.roles, record.publicRole);
    if (record.material) addUnique_(seed.materials, record.material);
    if (record.box) addUnique_(seed.boxes, 'Kutu ' + record.box);
    if (record.dateISO) {
      if (!seed.firstSeen || record.dateISO < seed.firstSeen) seed.firstSeen = record.dateISO;
      if (!seed.lastSeen || record.dateISO > seed.lastSeen) seed.lastSeen = record.dateISO;
    }
  });

  Object.keys(rowsBySheet || {}).forEach(function (title) {
    if (classifySheet_(title) !== 'schedule') return;
    (rowsBySheet[title] || []).forEach(function (row) {
      const label = getVolunteerDisplayName_(row);
      const seed = ensureVolunteerProfileSeed_(seeds, label);
      if (!seed) return;
      seed.sources.schedule = true;
      const role = normalizePublicRole_(row.rol || row.role || row.gorev || row.tvRole || row.unvan);
      if (role) addUnique_(seed.roles, role);
      copySeedProfileField_(seed, 'city', row.sehir || row.city || row.il, 80);
      copySeedProfileField_(seed, 'uni', row.kurumUniversite || row.universite || row.kurum || row.okul, 120);
      copySeedProfileField_(seed, 'dept', row.bolumAlan || row.bolum || row.alan || row.departman, 120);
      splitPublicList_(row.konular || row.ilgiAlanlari || row.calismaAlanlari, 8, 60)
        .forEach(function (item) { addUnique_(seed.topics, item); });
      splitPublicList_(row.zamanUygunluk || row.musaitlik || row.slots || row.slot, 8, 40)
        .forEach(function (item) { addUnique_(seed.slots, item); });
    });
  });

  (existingRows || []).forEach(function (row) {
    const label = normalizeVolunteerName_(row.adSoyad || row.kamusalAd);
    const seed = ensureVolunteerProfileSeed_(seeds, label);
    if (!seed) return;
    seed.sources.profile = true;
  });

  return Object.keys(seeds).map(function (key) {
    const seed = seeds[key];
    seed.role = seed.roles[0] || '';
    seed.materials.sort();
    seed.boxes.sort(function (a, b) { return a.localeCompare(b, 'tr', { numeric: true }); });
    return seed;
  }).sort(function (a, b) {
    return asciiFold_(a.name).localeCompare(asciiFold_(b.name));
  });
}

function ensureVolunteerProfileSeed_(seeds, label) {
  const name = normalizeVolunteerName_(label);
  if (!isPublicNamedLabel_(name)) return null;
  const key = contributorKey_(name);
  if (!seeds[key]) {
    seeds[key] = {
      name: name,
      slug: volunteerSlug_(name),
      roles: [],
      city: '',
      uni: '',
      dept: '',
      topics: [],
      slots: [],
      records: 0,
      pageRows: 0,
      pagesDone: 0,
      materials: [],
      boxes: [],
      firstSeen: '',
      lastSeen: '',
      sources: {}
    };
  }
  return seeds[key];
}

function copySeedProfileField_(seed, key, value, maxLen) {
  if (seed[key]) return;
  const clean = safePublicText_(value, maxLen);
  if (clean) seed[key] = clean;
}

function mergeVolunteerProfileRows_(seeds, existingRows) {
  const existingBySlug = {};
  const existingByName = {};
  (existingRows || []).forEach(function (row) {
    const slug = volunteerSlug_(row.slug || row.adSoyad || row.kamusalAd);
    const nameKey = contributorKey_(normalizeVolunteerName_(row.adSoyad || row.kamusalAd));
    if (slug) existingBySlug[slug] = row;
    if (nameKey && nameKey !== 'unnamed' && nameKey !== 'hidden') existingByName[nameKey] = row;
  });

  const syncedAt = Utilities.formatDate(new Date(), TVF_TIMEZONE, 'yyyy-MM-dd HH:mm');
  return (seeds || []).map(function (seed) {
    const existing = existingBySlug[seed.slug] || existingByName[contributorKey_(seed.name)] || {};
    const displayName = profileCell_(existing, ['adSoyad']) || seed.name;
    const slug = volunteerSlug_(profileCell_(existing, ['slug']) || seed.slug || displayName);
    const sourceLabels = [];
    if (seed.sources.records) sourceLabels.push('kayıtlar');
    if (seed.sources.schedule) sourceLabels.push('gönüllü akışı');
    if (seed.sources.profile) sourceLabels.push('profil tabı');
    return [
      slug,
      displayName,
      profileCell_(existing, ['kamusalAd']),
      profileYesNo_(profileCell_(existing, ['kartYayinda']), 'Evet'),
      profileCell_(existing, ['rolKisaUnvan', 'rol']) || seed.role || '',
      profileCell_(existing, ['sehir']) || seed.city || '',
      profileCell_(existing, ['kurumUniversite']) || seed.uni || '',
      profileCell_(existing, ['bolumAlan']) || seed.dept || '',
      profileCell_(existing, ['konular']) || seed.topics.join(', '),
      profileCell_(existing, ['zamanUygunluk']) || seed.slots.join(', '),
      profileCell_(existing, ['kisaTanim']),
      profileCell_(existing, ['arsivNotu']),
      profileCell_(existing, ['biyografi']),
      profileCell_(existing, ['web']),
      profileCell_(existing, ['twitterX', 'twitter']),
      profileCell_(existing, ['linkedin']),
      profileCell_(existing, ['github']),
      profileCell_(existing, ['orcid']),
      profileCell_(existing, ['scholar']),
      profileCell_(existing, ['guncellemeNotu']),
      seed.lastSeen,
      seed.firstSeen,
      seed.records,
      seed.pageRows,
      seed.pagesDone,
      seed.materials.join(', '),
      seed.boxes.join(', '),
      sourceLabels.join(', '),
      syncedAt
    ];
  });
}

function writeVolunteerProfileSheet_(sheet, rows) {
  const values = [TVF_VOLUNTEER_PROFILE_HEADERS].concat(rows || []);
  sheet.clear();
  sheet.getRange(1, 1, values.length, TVF_VOLUNTEER_PROFILE_HEADERS.length).setValues(values);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, TVF_VOLUNTEER_PROFILE_HEADERS.length)
    .setBackground('#601040')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(true);
  sheet.getRange(1, 1, Math.max(values.length, 2), TVF_VOLUNTEER_PROFILE_HEADERS.length).createFilter();
  if (rows && rows.length) {
    const body = sheet.getRange(2, 1, rows.length, TVF_VOLUNTEER_PROFILE_HEADERS.length);
    body.setVerticalAlignment('top').setWrap(true);
    const validation = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Evet', 'Hayır'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, 4, rows.length, 1).setDataValidation(validation);
  }
  sheet.getRange(1, 1, 1, TVF_VOLUNTEER_PROFILE_HEADERS.length).setNotes([[
    'Otomatik kalıcı bağlantı; değiştirmeyin.',
    'Mevcut kaynaklarda görünen ad.',
    'Sitede farklı ad görünsünse yazın; boş kalırsa Ad Soyad kullanılır.',
    'Hayır seçilirse kart kamu payloadına eklenmez.',
    'Kart başlığının altında görünecek kısa rol/ünvan.',
    'Kamuya açık şehir.',
    'Kamuya açık kurum/üniversite.',
    'Kamuya açık bölüm/alan.',
    'Virgülle ayırın.',
    'Virgülle ayırın.',
    'Tek cümlelik kısa tanım.',
    'Tarih Vakfı gönüllü çalışmasına dair kısa not.',
    'Kısa biyografi; e-posta yazmayın.',
    'Web sitesi URLsi.',
    'Twitter/X kullanıcı adı veya URL.',
    'LinkedIn kullanıcı adı veya URL.',
    'GitHub kullanıcı adı veya URL.',
    'ORCID ID veya URL.',
    'Scholar URLsi.',
    'Ekip içi not; kamuya açılmaz.',
    'Otomatik: son görünür katkı tarihi.',
    'Otomatik: ilk görünür katkı tarihi.',
    'Otomatik: toplam görünür kayıt.',
    'Otomatik: sayfa/detay satırı.',
    'Otomatik: sayfa birimi.',
    'Otomatik: materyal alanları.',
    'Otomatik: kutular.',
    'Otomatik: hangi kaynaklardan görüldü.',
    'Otomatik: son yenileme.'
  ]]);
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(9, 220);
  sheet.setColumnWidth(10, 180);
  sheet.setColumnWidth(11, 260);
  sheet.setColumnWidth(12, 320);
  sheet.setColumnWidth(13, 360);
  sheet.setColumnWidths(14, 6, 170);
  sheet.setColumnWidths(20, 10, 130);
}

function profileCell_(row, keys) {
  for (let i = 0; i < keys.length; i++) {
    const value = row && row[keys[i]];
    if (value == null || value === '') continue;
    if (value instanceof Date && !isNaN(value.getTime())) return isoDate_(value);
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

function profileYesNo_(value, fallback) {
  const folded = asciiFold_(value).toLowerCase().trim();
  if (['hayir', 'hayır', 'no', 'false', '0', 'gizli', 'hidden'].indexOf(folded) >= 0) return 'Hayır';
  if (['evet', 'yes', 'true', '1', 'yayinda', 'yayında'].indexOf(folded) >= 0) return 'Evet';
  return fallback || 'Evet';
}

function profileIsVisible_(value) {
  return profileYesNo_(value, 'Evet') === 'Evet';
}

function safePublicText_(value, maxLen) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(text)) return '';
  if (isUnsafePublicIdentifier_(text)) return '';
  return text.length > maxLen ? text.slice(0, maxLen - 3).trim() + '...' : text;
}

function safePublicLongText_(value, maxLen) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(text)) return '';
  return text.length > maxLen ? text.slice(0, maxLen - 3).trim() + '...' : text;
}

function splitPublicList_(value, maxItems, maxLen) {
  return String(value == null ? '' : value)
    .split(/[,;\n]+/)
    .map(function (item) { return safePublicText_(item, maxLen || 80); })
    .filter(Boolean)
    .filter(function (item, idx, arr) { return arr.indexOf(item) === idx; })
    .slice(0, maxItems || 8);
}

function safePublicLink_(value, kind) {
  let text = String(value == null ? '' : value).trim();
  if (!text) return '';
  if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(text) || /^mailto:/i.test(text)) return '';
  if (kind === 'orcid') {
    const match = text.match(/\d{4}-\d{4}-\d{4}-[\dX]{4}/i);
    return match ? match[0].toUpperCase() : '';
  }
  if (/^https?:\/\//i.test(text)) return text.slice(0, 240);
  if (kind === 'website' && /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/.*)?$/.test(text)) {
    return ('https://' + text).slice(0, 240);
  }
  if (kind === 'handle') {
    text = text.replace(/^@/, '');
    if (/^[A-Za-z0-9_.-]{2,80}$/.test(text)) return text;
  }
  return '';
}

function volunteerSlug_(value) {
  return slugify_(value).replace(/_/g, '-') || 'gonullu';
}

function getVolunteerDisplayName_(row) {
  if (explicitOptOut_(row)) return TVF_HIDDEN;
  const explicit = normalizeVolunteerName_(row.publicDisplayName || row.publicdisplayname || row.kamusalAd || row.kamusalad);
  if (explicit) return explicit;
  const name = normalizeVolunteerName_(row.paydas || row.kaydiOlusuran || row.kaydiOlusturan || row.volunteerName || row.adSoyad);
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
  const raw = row.publicDisplayName || row.publicdisplayname || row.kamusalAd || row.kamusalad || row.paydas || row.kaydiOlusuran || row.kaydiOlusturan || row.volunteerName || row.adSoyad || '';
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
  return !!(text && text !== TVF_UNNAMED && text !== TVF_HIDDEN && !isUnsafePublicIdentifier_(text) && !isNonPersonLabel_(text));
}

function isNonPersonLabel_(label) {
  const folded = asciiFold_(label).toLowerCase().replace(/\s+/g, ' ').trim();
  return folded === 'gonullu toplantisi' || folded === 'toplanti' || folded === 'gonullu toplanti';
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

function publicWorkTitle_(row) {
  return safePublicText_(
    row.calismaAlani
      || row.calisma
      || row.isAlani
      || row.isTanimi
      || row.devamEdenCalisma
      || row.notlar
      || row.fonAdi
      || row.fon
      || '',
    140
  );
}

function publicWorkDetail_(row) {
  return safePublicLongText_(
    row.devamEdenCalisma
      || row.notlar
      || row.yapilanCalismayaIliskinSayisalBilgi
      || row.devam
      || row.yapilanIs
      || row.aciklama
      || '',
    260
  );
}

function projectIdFromRow_(row) {
  const haystack = asciiFold_([row.fon, row.fonAdi, row.calismaAlani, row.devamEdenCalisma, row.dijitalBelgeKodu, row.notlar].join(' ')).toLowerCase();
  return haystack.indexOf('pnb') >= 0 || haystack.indexOf('boratav') >= 0 ? TVF_PROJECT_ID : 'foundation';
}

function selectedPeriod_(now, mode) {
  const today = parseIsoDate_(isoDate_(now));
  if (mode === 'rolling_7_days') {
    const start = addDays_(today, -6);
    return {
      mode: 'rolling_7_days',
      startDate: isoDate_(start),
      endDate: isoDate_(today),
      label: 'Güncel dönem · ' + dateRangeLabel_(start, today),
      isPartial: false
    };
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
  if (slug === 'haftalik_plan') return 'weekly_plan';
  if (slug === 'katilim') return 'attendance';
  if (slug === 'gonullu_kartlari' || slug === 'gonullu_kartlari_public') return 'volunteer_profiles';
  if (slug.indexOf('pnb_') === 0 && slug.indexOf('_zarf') < 0 && slug !== 'pnb_sayisallastirma') return 'pnb_detail';
  return 'other';
}

function normalizePeriodMode_(mode) {
  return mode === 'calendar_week_to_date' ? 'calendar_week_to_date' : 'rolling_7_days';
}

function parseSheetDate_(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number' && isFinite(value)) return new Date(Date.UTC(1899, 11, 30 + Math.floor(value), 12, 0, 0));
  const text = String(value).trim();
  let match = text.match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)(?:\s+(\d{4}))?$/);
  if (match) {
    const month = monthNumber_(match[2]);
    if (month) {
      const year = match[3] ? Number(match[3]) : new Date().getFullYear();
      return new Date(year, month - 1, Number(match[1]), 12, 0, 0);
    }
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

function parseProgressPercent_(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  const hasPercent = text.indexOf('%') >= 0;
  const n = parseLocaleNumber_(hasPercent ? text.replace(/%/g, '') : value);
  if (!isFinite(n)) return null;
  return round1_(hasPercent ? n : (Math.abs(n) <= 1 ? n * 100 : n));
}

function normalizeProgressPercent_(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseProgressPercent_(value);
  if (!isFinite(n)) return null;
  return round1_(Math.abs(n) <= 1 ? n * 100 : n);
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
  return dateRangeLabel_(start, fullEnd) + ' haftası · bugüne kadar';
}

function dateRangeLabel_(start, fullEnd) {
  const sameMonth = start.getMonth() === fullEnd.getMonth();
  return sameMonth
    ? (start.getDate() + '–' + fullEnd.getDate() + ' ' + TVF_TR_MONTHS[start.getMonth()])
    : (start.getDate() + ' ' + TVF_TR_MONTHS[start.getMonth()] + ' – ' + fullEnd.getDate() + ' ' + TVF_TR_MONTHS[fullEnd.getMonth()]);
}

function monthNumber_(name) {
  const folded = asciiFold_(name).toLowerCase();
  if (folded === 'harizan') return 6;
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

function addUnique_(arr, value) {
  const text = String(value == null ? '' : value).trim();
  if (text && arr.indexOf(text) < 0) arr.push(text);
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
