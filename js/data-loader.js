// Snapshot-first loader: static GitHub Pages with optional live Apps Script overlay.
(function () {
  const U = window.TVFUtils;
  const Aggregate = window.TVFAggregate;
  const Renderer = window.TVFRenderDashboard;

  const params = new URLSearchParams(location.search);
  const liveOnly = params.get('live') === '1';
  const debug = params.get('debug') === '1';
  let rendered = false;
  let snapshotPayload = null;

  function renderPayload(raw, allowLegacy) {
    const payload = sanitizePublicPayload(Aggregate.normalizePayload(raw));
    if (!payload || !payload.publicSummary) return false;
    if (!allowLegacy && !isCompatibleSummary(payload.publicSummary)) return false;
    applyVolunteerProfiles(payload);
    Renderer.renderDashboard(payload, { debug, allowLegacy });
    rendered = true;
    return true;
  }

  function publishLivePayload(raw) {
    const payload = sanitizePublicPayload(Aggregate.normalizePayload(raw));
    if (!payload || !payload.publicSummary) return;
    publishSharedPayload(payload, true);
  }

  function publishSharedPayload(payload, liveReady) {
    window.TVF_PUBLIC_DATA = payload;
    window.__SNAPSHOT__ = { ok: true, generatedAt: payload.generatedAt, data: payload };
    if (liveReady) window.TVF_LIVE_DATA_READY = true;
    applyVolunteerProfiles(payload);
    if (window.TVF && typeof window.TVF.renderRosterSections === 'function') {
      window.TVF.renderRosterSections();
    }
    document.dispatchEvent(new CustomEvent('tvf:data', { detail: payload }));
  }

  if (!liveOnly) {
    snapshotPayload = sanitizePublicPayload(Aggregate.normalizePayload(window.TVF_PUBLIC_DATA || window.__SNAPSHOT__));
    renderPayload(snapshotPayload, true);
    if (snapshotPayload) publishSharedPayload(snapshotPayload, false);
  }

  const url = window.__SHEETSYNC_URL__;
  const configured = typeof url === 'string'
    && url.includes('script.google.com')
    && !url.includes('REPLACE_ME');

  if (configured) {
    const sep = url.includes('?') ? '&' : '?';
    fetch(`${url}${sep}public=1&period=rolling_7_days&t=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      redirect: 'follow'
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((body) => {
        if (!body || body.ok !== true) return;
        const raw = body.data || body;
        const livePayload = normalizeLivePayload(raw);
        if (livePayload && renderPayload(livePayload, !rendered)) publishLivePayload(livePayload);
      })
      .catch(() => {
        if (!rendered) Renderer.renderError();
      });
  } else if (!rendered) {
    Renderer.renderError();
  }

  function isCompatibleSummary(summary) {
    return summary
      && summary.source
      && summary.source.recordsAreFullAggregate === true
      && summary.source.volunteerCredit === 'credit-visible, ID-safe volunteer display'
      && summary.period
      && summary.period.mode === 'rolling_7_days';
  }

  function normalizeLivePayload(raw) {
    const payload = Aggregate.normalizePayload(raw);
    if (!payload || !payload.publicSummary) return null;
    const normalized = isCompatibleSummary(payload.publicSummary)
      ? payload
      : (repairRollingPayload(payload) || payload);
    return sanitizePublicPayload(normalized);
  }

  function sanitizePublicPayload(payload) {
    if (!payload || !payload.publicSummary) return payload;
    const summary = payload.publicSummary;
    const source = summary.source || {};
    if (source.volunteerCreditBasis === 'row_explicit_only') return payload;

    const rules = legacyFalseCreditRules();
    if (!rules.length) return payload;

    const cloned = clone(payload);
    const cleanSummary = cloned.publicSummary;
    const removedByName = {};

    cleanSummary.byDay = (Array.isArray(cleanSummary.byDay) ? cleanSummary.byDay : []).map((day) => {
      const dateISO = U.toISODate(day.dateISO);
      const out = Object.assign({}, day);
      out.contributors = removeFalseCreditRows(day.contributors, dateISO, rules, removedByName);
      out.coordination = removeFalseCreditRows(day.coordination, dateISO, rules, removedByName);
      out.volunteerNames = (Array.isArray(day.volunteerNames) ? day.volunteerNames : [])
        .filter((label) => !matchesAnyFalseCreditRule(label, dateISO, rules));
      out.volunteersCount = (out.contributors || []).length + (out.coordination || []).length;
      return out;
    });

    cleanSummary.byVolunteer = subtractFalseCreditRows(cleanSummary.byVolunteer, removedByName);
    cleanSummary.byTrack = subtractFalseCreditRowsFromTracks(cleanSummary.byTrack, removedByName);
    cleanSummary.byBox = subtractFalseCreditRowsFromBoxes(cleanSummary.byBox, removedByName);
    cloned.latestActivity = (Array.isArray(cloned.latestActivity) ? cloned.latestActivity : [])
      .filter((row) => !matchesLatestFalseCredit(row, rules));

    const volunteers = Array.isArray(cleanSummary.byVolunteer)
      ? cleanSummary.byVolunteer.filter((row) => isPublicLabel(row.label))
      : [];
    cleanSummary.totals = Object.assign({}, cleanSummary.totals || {}, {
      volunteersActive: volunteers.length,
      volunteers: volunteers.length
    });
    cleanSummary.source = Object.assign({}, source, {
      volunteerCreditBasis: 'client_filtered_legacy_sheet_title_credit'
    });
    cleanSummary.warnings = (Array.isArray(cleanSummary.warnings) ? cleanSummary.warnings : []).concat([{
      code: 'legacy_sheet_title_credit_filtered',
      message: 'Eski canlı endpointte PNB detay sekmesi adından türeyen kişi kredileri tarayıcıda görünür listelerden çıkarıldı.'
    }]);
    return cloned;
  }

  function legacyFalseCreditRules() {
    return [{
      key: foldName('Betül İşeri'),
      startDate: '2026-06-23',
      endDate: '2026-06-29',
      boxes: ['kutu 31']
    }];
  }

  function removeFalseCreditRows(rows, dateISO, rules, removedByName) {
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const rule = matchingFalseCreditRule(row && row.label, dateISO, rules);
      if (!rule || !looksLikeLegacyPageCredit(row, rule)) return true;
      const key = rule.key;
      if (!removedByName[key]) removedByName[key] = { records: 0, pageRows: 0, activityRows: 0, pagesDone: 0 };
      removedByName[key].records += Number(row.records || 0);
      removedByName[key].pageRows += Number(row.pageRows || 0);
      removedByName[key].activityRows += Number(row.activityRows || 0);
      removedByName[key].pagesDone += Number(row.pagesDone || 0);
      return false;
    });
  }

  function subtractFalseCreditRows(rows, removedByName) {
    return (Array.isArray(rows) ? rows : []).map((row) => subtractFalseCreditRow(row, removedByName)).filter(Boolean);
  }

  function subtractFalseCreditRowsFromTracks(rows, removedByName) {
    return (Array.isArray(rows) ? rows : []).map((track) => {
      const out = Object.assign({}, track);
      out.contributors = subtractFalseCreditRows(track.contributors, removedByName);
      out.peopleCount = out.contributors.length;
      return out;
    });
  }

  function subtractFalseCreditRowsFromBoxes(rows, removedByName) {
    return (Array.isArray(rows) ? rows : []).map((box) => {
      const out = Object.assign({}, box);
      out.contributors = subtractFalseCreditRows(box.contributors, removedByName);
      out.topContributors = subtractFalseCreditRows(box.topContributors, removedByName);
      out.contributorsCount = out.contributors.length;
      return out;
    });
  }

  function subtractFalseCreditRow(row, removedByName) {
    if (!row) return null;
    const key = foldName(row.label);
    const removed = removedByName[key];
    if (!removed) return row;
    const out = Object.assign({}, row);
    out.records = Math.max(0, Number(out.records || 0) - Number(removed.records || 0));
    out.pageRows = Math.max(0, Number(out.pageRows || 0) - Number(removed.pageRows || 0));
    out.activityRows = Math.max(0, Number(out.activityRows || 0) - Number(removed.activityRows || 0));
    out.pagesDone = Math.max(0, Number(out.pagesDone || 0) - Number(removed.pagesDone || 0));
    if (Array.isArray(out.boxBreakdown)) out.boxBreakdown = [];
    if (Array.isArray(out.boxes)) out.boxes = [];
    if (out.records <= 0 && out.pageRows <= 0 && out.activityRows <= 0 && out.pagesDone <= 0) return null;
    return out;
  }

  function matchesLatestFalseCredit(row, rules) {
    const dateISO = U.toISODate(row && (row.dateISO || row.when));
    const rule = matchingFalseCreditRule(row && row.volunteerLabel, dateISO, rules);
    if (!rule) return false;
    const box = foldName(row && row.boxLabel);
    return (row.recordType === 'page_detail' || row.kind === 'page')
      && (!rule.boxes.length || rule.boxes.indexOf(box) >= 0);
  }

  function matchesAnyFalseCreditRule(label, dateISO, rules) {
    return Boolean(matchingFalseCreditRule(label, dateISO, rules));
  }

  function matchingFalseCreditRule(label, dateISO, rules) {
    const key = foldName(label);
    if (!key || !dateISO) return null;
    return rules.find((rule) => {
      return key === rule.key
        && dateISO >= rule.startDate
        && dateISO <= rule.endDate;
    }) || null;
  }

  function looksLikeLegacyPageCredit(row, rule) {
    if (!row) return false;
    if (Number(row.pageRows || 0) <= 0 || Number(row.activityRows || 0) > 0) return false;
    const workRows = Array.isArray(row.workRows) ? row.workRows : [];
    if (!workRows.length) return true;
    return workRows.every((work) => {
      const box = foldName(work.boxLabel);
      return (work.kind === 'page' || !work.kind)
        && (!rule.boxes.length || rule.boxes.indexOf(box) >= 0);
    });
  }

  function isPublicLabel(label) {
    const text = String(label || '').trim();
    return Boolean(text && text !== 'Adı belirtilmeyen gönüllü' && text !== 'İsmini gizlemeyi tercih eden gönüllü');
  }

  function repairRollingPayload(livePayload) {
    const liveSummary = livePayload && livePayload.publicSummary;
    const livePeriod = liveSummary && liveSummary.period;
    if (!liveSummary || !liveSummary.source || liveSummary.source.recordsAreFullAggregate !== true || !livePeriod || !livePeriod.endDate) return null;

    const endISO = U.toISODate(livePeriod.endDate);
    if (!endISO) return null;
    const startISO = addDaysISO(endISO, -6);
    const baseSummary = snapshotPayload && snapshotPayload.publicSummary;
    const dayMap = {};

    addDaysToMap(dayMap, baseSummary && baseSummary.byDay, startISO, endISO);
    addDaysToMap(dayMap, liveSummary.byDay, startISO, endISO);

    const days = dateRangeISO(startISO, endISO).map((iso) => dayMap[iso] || emptyDay(iso));
    if (!days.some((day) => Number(day.records || 0) > 0)) return null;

    const byMaterial = buildMaterialRows(days);
    const byVolunteer = buildVolunteerRows(days);
    const byBox = buildBoxRows(days);
    const totals = Object.assign({}, liveSummary.totals || {}, {
      records: sum(days, 'records'),
      pageRows: sum(days, 'pageRows'),
      activityRows: sum(days, 'activityRows'),
      periodPagesDone: sum(days, 'pagesDone'),
      boxesActive: byBox.length,
      volunteersActive: byVolunteer.length,
      volunteers: byVolunteer.length,
      materials: byMaterial.length
    });
    if (totals.pagesTarget > 0 && totals.pagesDone != null) {
      totals.progressPercent = Math.round((Number(totals.pagesDone || 0) / Number(totals.pagesTarget)) * 1000) / 10;
    }

    const warnings = (liveSummary.warnings || []).concat([{
      code: 'client_repaired_rolling_period',
      message: 'Live endpoint returned week-to-date mode; browser merged live days with the static snapshot for a rolling seven-day view.'
    }]);
    const syntheticLatest = latestFromDays(days);
    const latestActivity = mergeLatestActivity([
      livePayload.latestActivity,
      snapshotPayload && snapshotPayload.latestActivity,
      syntheticLatest
    ], startISO, endISO);

    const repairedSummary = Object.assign({}, liveSummary, {
      generatedAt: liveSummary.generatedAt || livePayload.generatedAt,
      period: {
        mode: 'rolling_7_days',
        startDate: startISO,
        endDate: endISO,
        label: `Güncel dönem · ${U.formatDayMonth(startISO)} – ${U.formatDayMonth(endISO)}`,
        isPartial: false
      },
      totals,
      byDay: days,
      byMaterial,
      byVolunteer,
      byBox,
      highlights: Object.assign({}, liveSummary.highlights || {}, {
        busiestDay: days.slice().sort((a, b) => Number(b.records || 0) - Number(a.records || 0))[0] || null,
        latestDate: days.slice().reverse().find((day) => Number(day.records || 0) > 0)?.dateISO || null,
        topMaterial: byMaterial[0] || null
      }),
      warnings,
      source: Object.assign({}, liveSummary.source, {
        recordsAreFullAggregate: true,
        volunteerCredit: liveSummary.source.volunteerCredit || 'credit-visible, ID-safe volunteer display'
      })
    });

    return Object.assign({}, livePayload, {
      generatedAt: livePayload.generatedAt || liveSummary.generatedAt,
      publicSummary: repairedSummary,
      trackSummary: livePayload.trackSummary || (snapshotPayload && snapshotPayload.trackSummary),
      latestActivity
    });
  }

  function addDaysToMap(dayMap, days, startISO, endISO) {
    (Array.isArray(days) ? days : []).forEach((day) => {
      const iso = U.toISODate(day.dateISO);
      if (!iso || iso < startISO || iso > endISO) return;
      dayMap[iso] = clone(day);
    });
  }

  function buildMaterialRows(days) {
    const rows = {};
    days.forEach((day) => {
      (day.materials || []).forEach((item) => {
        const key = item.material || item.label;
        if (!key) return;
        if (!rows[key]) rows[key] = { material: key, label: item.label || key, count: 0 };
        rows[key].count += Number(item.count || 0);
      });
    });
    return withPercents(Object.values(rows).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr')));
  }

  function buildVolunteerRows(days) {
    const rows = {};
    days.forEach((day) => {
      uniqueContributors(day).forEach((item) => {
        const label = publicLabel(item.label);
        if (!label) return;
        const key = foldName(label);
        if (!rows[key]) rows[key] = { label, publicRole: item.publicRole || '', records: 0, pageRows: 0, activityRows: 0, pagesDone: 0, boxes: [], boxBreakdown: [] };
        rows[key].records += Number(item.records || 0);
        rows[key].pageRows += Number(item.pageRows || 0);
        rows[key].activityRows += Number(item.activityRows || 0);
        rows[key].pagesDone += Number(item.pagesDone || 0);
        if (!rows[key].publicRole && item.publicRole) rows[key].publicRole = item.publicRole;
        (day.boxLabels || []).forEach((box) => addUnique(rows[key].boxes, box));
      });
    });
    return Object.values(rows).map((row) => {
      row.topBox = row.boxes[0] || null;
      row.boxBreakdown = row.boxes.map((boxLabel) => ({ boxLabel, records: 1 }));
      return row;
    }).sort((a, b) => b.records - a.records || a.label.localeCompare(b.label, 'tr'));
  }

  function buildBoxRows(days) {
    const rows = {};
    days.forEach((day) => {
      (day.boxLabels || []).forEach((boxLabel) => {
        const key = foldName(boxLabel);
        if (!rows[key]) rows[key] = { box: boxLabel.replace(/^Kutu\s+/i, ''), boxLabel, label: boxLabel, records: 0, pageRows: 0, activityRows: 0, periodRecords: 0, periodPageRows: 0, periodPagesDone: 0, contributors: [], topContributors: [], contributorsCount: 0, lastActivityDate: day.dateISO };
        rows[key].records += Number(day.records || 0);
        rows[key].pageRows += Number(day.pageRows || 0);
        rows[key].activityRows += Number(day.activityRows || 0);
        rows[key].periodRecords += Number(day.records || 0);
        rows[key].periodPageRows += Number(day.pageRows || 0);
        rows[key].periodPagesDone += Number(day.pagesDone || 0);
        if (!rows[key].lastActivityDate || day.dateISO > rows[key].lastActivityDate) rows[key].lastActivityDate = day.dateISO;
      });
    });
    return Object.values(rows).sort((a, b) => String(b.lastActivityDate || '').localeCompare(String(a.lastActivityDate || '')));
  }

  function latestFromDays(days) {
    return days.flatMap((day) => {
      const material = (day.materials && day.materials[0] && (day.materials[0].material || day.materials[0].label)) || 'belgeler';
      const boxLabel = day.boxLabels && day.boxLabels[0] ? day.boxLabels[0] : null;
      const when = day.lastTime || day.firstTime || `${day.dateISO}T09:00:00.000Z`;
      return uniqueContributors(day).map((item) => ({
        when,
        dateISO: day.dateISO,
        kind: Number(item.pageRows || item.pagesDone || 0) > 0 ? 'page' : 'activity',
        recordType: 'day_summary',
        material,
        projectId: 'pnb',
        volunteerLabel: item.label,
        publicRole: item.publicRole || '',
        boxLabel,
        pagesDone: Number(item.pagesDone || 0),
        records: Number(item.records || 1)
      }));
    });
  }

  function mergeLatestActivity(groups, startISO, endISO) {
    const byKey = {};
    groups.forEach((rows) => {
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const iso = U.toISODate(row.dateISO || row.when);
        const label = publicLabel(row.volunteerLabel);
        if (!iso || !label || iso < startISO || iso > endISO) return;
        const key = [iso, row.when || '', label, row.kind || '', row.boxLabel || '', row.workTitle || '', row.workDetail || ''].join('|');
        if (!byKey[key]) byKey[key] = Object.assign({}, row, { dateISO: iso, volunteerLabel: label });
      });
    });
    return Object.values(byKey)
      .sort((a, b) => String(b.when || b.dateISO || '').localeCompare(String(a.when || a.dateISO || '')))
      .slice(0, 50);
  }

  function uniqueContributors(day) {
    const rows = {};
    (day.contributors || []).concat(day.coordination || []).forEach((item) => {
      const label = publicLabel(item.label);
      if (!label) return;
      const key = foldName(label);
      if (!rows[key]) rows[key] = Object.assign({}, item, { label });
    });
    return Object.values(rows);
  }

  function emptyDay(iso) {
    return {
      dateISO: iso,
      weekdayTR: U.weekdayTR(iso),
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
      summarySentence: 'Bugün için görünür katkı yok.'
    };
  }

  function dateRangeISO(startISO, endISO) {
    const days = [];
    let iso = startISO;
    while (iso <= endISO) {
      days.push(iso);
      iso = addDaysISO(iso, 1);
    }
    return days;
  }

  function addDaysISO(iso, days) {
    const date = new Date(`${iso}T12:00:00`);
    date.setDate(date.getDate() + days);
    return U.toISODate(date);
  }

  function sum(rows, key) {
    return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
  }

  function withPercents(rows) {
    const total = rows.reduce((count, row) => count + Number(row.count || 0), 0);
    return rows.map((row) => Object.assign({}, row, {
      percent: total ? Math.round((Number(row.count || 0) / total) * 1000) / 10 : 0
    }));
  }

  function publicLabel(value) {
    const label = String(value || '').replace(/\s+/g, ' ').trim();
    if (!label || label === 'Adı belirtilmeyen gönüllü' || label === 'İsmini gizlemeyi tercih eden gönüllü') return '';
    return label;
  }

  function addUnique(items, value) {
    if (value && items.indexOf(value) < 0) items.push(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function applyVolunteerProfiles(payload) {
    const profiles = payload
      && payload.content
      && Array.isArray(payload.content.volunteerProfiles)
      ? payload.content.volunteerProfiles
      : [];
    const roster = window.TVF_ROSTER;
    if (!profiles.length || !roster || !Array.isArray(roster.volunteers)) return;

    const bySlug = {};
    const byName = {};
    roster.volunteers.forEach((volunteer) => {
      if (volunteer.slug) bySlug[volunteer.slug] = volunteer;
      byName[foldName(volunteer.name)] = volunteer;
    });

    profiles.forEach((profile) => {
      const slug = String(profile.slug || '').trim();
      const name = String(profile.name || '').trim();
      if (!slug && !name) return;
      let volunteer = bySlug[slug] || byName[foldName(name)];
      if (!volunteer) {
        volunteer = {
          name: name || slug,
          slug: slug || slugifyName(name),
          city: '',
          role: '',
          tv_role: 'Gönüllü',
          uni: '',
          dept: '',
          topics: [],
          slots: [],
          sessions: 0,
          tracks: [],
          byMonth: {},
          scanners: [],
          boxes: [],
          firstSeen: null,
          lastSeen: null,
          active: false,
          log: [],
          bio: {}
        };
        roster.volunteers.push(volunteer);
      }
      if (name) volunteer.name = name;
      if (slug) volunteer.slug = slug;
      ['city', 'role', 'uni', 'dept'].forEach((key) => {
        if (profile[key] != null) volunteer[key] = String(profile[key]);
      });
      ['topics', 'slots'].forEach((key) => {
        if (Array.isArray(profile[key])) volunteer[key] = profile[key].map(String).filter(Boolean);
      });
      if (profile.bio && typeof profile.bio === 'object') {
        volunteer.bio = Object.assign({}, volunteer.bio || {}, profile.bio);
      }
      bySlug[volunteer.slug] = volunteer;
      byName[foldName(volunteer.name)] = volunteer;
    });

    if (roster.source) {
      roster.source.bioSize = roster.volunteers.filter((volunteer) => {
        const bio = volunteer.bio || {};
        return Object.keys(bio).some((key) => String(bio[key] || '').trim());
      }).length;
    }
  }

  function foldName(value) {
    return String(value || '')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[ıİI]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[şŞ]/g, 's')
      .replace(/[üÜ]/g, 'u')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function slugifyName(value) {
    return foldName(value).replace(/\s+/g, '-') || 'gonullu';
  }
})();
