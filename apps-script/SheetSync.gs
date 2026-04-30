/**
 * Live one-way sync from the shared "Tarih Vakfı Gönüllü Ağı" Google Sheet
 * into Firestore. The sheet is owned by a foundation colleague (the user
 * has Editor + sharing rights but is not the owner), so the sync is
 * deliberately defensive:
 *
 *   1. Sheet → Firestore only. We never write back to the sheet.
 *   2. Additive only. A row that disappears from the sheet does NOT trigger
 *      a Firestore delete. The mirror doc stays in place; the latest sheet
 *      state is what new dashboard reads see, but history is preserved.
 *   3. Schema-tolerant. Renamed tabs, missing columns, or extra columns
 *      produce a "degraded" sync log + an email alert; they don't crash the
 *      run and they don't silently drop data.
 *   4. Structure-change detection. Each run captures a snapshot of every
 *      tab's name + header row + row count and diffs it against the last
 *      known-good state. Any drift triggers a single email per 24h.
 *   5. Sharing-loss detection. Three consecutive permission failures pause
 *      the sync (config.enabled = false) and email the admin.
 *
 * Required Script Properties:
 *   - FIREBASE_SERVICE_ACCOUNT  (already wired via FirestoreClient.gs)
 *   - TARIH_VAKFI_SHEET_ID       the Google Sheet ID
 *   - SYNC_ALERT_EMAIL           admin email for alerts
 *
 * Setup (manual, see SHEET_SYNC_README.md for the full runbook):
 *   1. Talk to the sheet owner; explain that an automatic reader is being
 *      added and ask them to ping you if they restructure tabs/columns.
 *   2. Add the service account email (FIREBASE_SERVICE_ACCOUNT.client_email)
 *      as Viewer on the sheet.
 *   3. Set TARIH_VAKFI_SHEET_ID and SYNC_ALERT_EMAIL Script Properties.
 *   4. Run sheetSyncRun() once manually to verify access + write the
 *      initial baseline. Subsequent runs come from the hourly trigger
 *      registered by Triggers.gs::createTriggers.
 */

const SHEETS_SCOPE_ = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SHEET_SYNC_CONFIG_PATH_ = 'config/sheetSync';
const SHEET_SYNC_LOGS_COLLECTION_ = 'syncLogs';
const SHEET_SYNC_INTERVAL_MIN_ = 60;       // matches the Triggers.gs cadence
const ACCESS_FAILURE_PAUSE_THRESHOLD_ = 3; // 3 consecutive failures → pause
const ALERT_COOLDOWN_HOURS_ = 24;
const SHEET_SYNC_TIMEZONE_ = 'Europe/Istanbul';

// ---------------------------------------------------------------------------
// Public entry point — invoked by the time trigger AND by the user via the
// Apps Script editor for the initial test run.
// ---------------------------------------------------------------------------

function sheetSyncRun() {
  const startedAt = new Date();
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('TARIH_VAKFI_SHEET_ID');
  const alertEmail = props.getProperty('SYNC_ALERT_EMAIL');

  if (!sheetId) {
    _logSyncEvent_('error', { stage: 'startup', error: 'TARIH_VAKFI_SHEET_ID not set' });
    return;
  }
  if (!alertEmail) {
    _logSyncEvent_('warning', { stage: 'startup', warning: 'SYNC_ALERT_EMAIL not set; alerts will be skipped' });
  }

  const config = _loadConfig_();

  // Manual pause via Bakım panel: respect it and bail out without contacting
  // Sheets. The admin re-enables sync after they've reviewed whatever
  // structure change or access loss caused the pause.
  if (config.enabled === false) {
    _logSyncEvent_('skipped', { reason: 'sync paused (config.enabled=false)' });
    return;
  }

  // Step 1 — sharing-loss check. A tiny read of the spreadsheet metadata is
  // the cheapest probe; if the service account lost access, this throws and
  // we bump the consecutive-failure counter.
  let metadata;
  try {
    metadata = _readSheetMetadata_(sheetId);
  } catch (err) {
    return _handleAccessFailure_(err, config, alertEmail);
  }
  // Any successful read resets the counter — even if no rows changed.
  if ((config.consecutiveAccessFailures || 0) > 0) {
    config.consecutiveAccessFailures = 0;
  }

  // Step 2 — structure snapshot. Captured BEFORE we read row contents so a
  // partial / fast-fail pass still records what we saw.
  const currentSnapshot = _captureStructureSnapshot_(sheetId, metadata);

  // First run after deploy: write baseline, no alert.
  let degraded = false;
  let structureChanges = [];
  if (!config.lastGoodStructure || !Array.isArray(config.lastGoodStructure.tabs)) {
    config.lastGoodStructure = currentSnapshot;
    _logSyncEvent_('baseline_set', { tabCount: currentSnapshot.tabs.length });
  } else {
    structureChanges = detectStructureChange_(currentSnapshot, config.lastGoodStructure);
    if (structureChanges.length > 0) {
      degraded = true;
      _logSyncEvent_('structure_changed', {
        changes: structureChanges,
        currentTabs: currentSnapshot.tabs.map(function (t) { return t.name; })
      });
      _sendAlertIfFresh_(config, alertEmail,
        '[Tarih Vakfı] Sheet structure changed',
        _composeStructureChangeBody_(structureChanges, currentSnapshot, config.lastGoodStructure)
      );
      // We do NOT update lastGoodStructure on a degraded run. The admin
      // accepts the new structure via the "Yapıyı yeniden kabul et" button
      // in the Bakım panel, which writes the current snapshot as the new
      // baseline and clears the alert cooldown.
    } else {
      // No drift — bump the baseline forward (rowCount may have grown, that's fine).
      config.lastGoodStructure = currentSnapshot;
    }
  }

  // Step 3 — sync each tab. Schema-tolerant: each tab handler catches its
  // own errors so a single broken tab doesn't poison the rest of the run.
  const perTabSummary = [];
  let totalWritten = 0;
  let totalSkipped = 0;
  metadata.sheets.forEach(function (sheetMeta) {
    const props = sheetMeta.properties || {};
    const tabName = props.title;
    const rowCount = (props.gridProperties && props.gridProperties.rowCount) || 0;
    const colCount = (props.gridProperties && props.gridProperties.columnCount) || 0;
    if (!tabName || rowCount < 1 || colCount < 1) return;
    try {
      const result = _syncTab_(sheetId, tabName, rowCount, colCount);
      perTabSummary.push({
        tab: tabName,
        rowsRead: result.rowsRead,
        written: result.written,
        skipped: result.skipped,
        warnings: result.warnings
      });
      totalWritten += result.written;
      totalSkipped += result.skipped;
      if (result.warnings.length > 0) degraded = true;
    } catch (err) {
      degraded = true;
      perTabSummary.push({ tab: tabName, error: String(err) });
      _logSyncEvent_('tab_error', { tab: tabName, error: String(err) });
    }
  });

  let publicProjectionSummary = null;
  try {
    publicProjectionSummary = _publishPublicProjectionFromSheet_(sheetId, metadata);
  } catch (err) {
    degraded = true;
    publicProjectionSummary = { error: String(err) };
    _logSyncEvent_('public_projection_error', { error: String(err) });
  }

  // Step 4 — write the run summary and persist updated config.
  const status = degraded ? 'degraded' : 'ok';
  config.lastSyncAt = startedAt.toISOString();
  config.lastSyncStatus = status;
  config.lastSyncSummary = {
    durationMs: Date.now() - startedAt.getTime(),
    tabs: perTabSummary,
    totalWritten: totalWritten,
    totalSkipped: totalSkipped,
    structureChanges: structureChanges,
    publicProjection: publicProjectionSummary
  };
  _saveConfig_(config);

  _logSyncEvent_(status, {
    durationMs: Date.now() - startedAt.getTime(),
    tabs: perTabSummary,
    totalWritten: totalWritten,
    totalSkipped: totalSkipped,
    structureChangesCount: structureChanges.length
  });
}

// ---------------------------------------------------------------------------
// Public helper: accept the current sheet state as the new structural baseline.
// Called by the "Yapıyı yeniden kabul et" button in the Bakım panel after the
// admin verifies the structure was changed intentionally. Resets the alert
// cooldown so the next genuine drift can re-alert.
// ---------------------------------------------------------------------------

function sheetSyncAcceptCurrentStructure() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('TARIH_VAKFI_SHEET_ID');
  if (!sheetId) throw new Error('TARIH_VAKFI_SHEET_ID not set');
  const metadata = _readSheetMetadata_(sheetId);
  const snapshot = _captureStructureSnapshot_(sheetId, metadata);
  const config = _loadConfig_();
  config.lastGoodStructure = snapshot;
  config.consecutiveAccessFailures = 0;
  config.alertCooldown = {}; // clear cooldowns so future drift re-alerts immediately
  config.enabled = true;
  _saveConfig_(config);
  _logSyncEvent_('baseline_accepted', { tabCount: snapshot.tabs.length });
  // Run a normal sync now so the mirror picks up any data shifted around by
  // the restructure (e.g. a column rename that maps to a new field key).
  sheetSyncRun();
}

// ---------------------------------------------------------------------------
// Public helper: re-enable sync after access loss has been resolved.
// Mirrored on the Bakım panel button for a one-click recovery.
// ---------------------------------------------------------------------------

function sheetSyncResume() {
  const config = _loadConfig_();
  config.enabled = true;
  config.consecutiveAccessFailures = 0;
  _saveConfig_(config);
  _logSyncEvent_('resumed', {});
}

// ---------------------------------------------------------------------------
// Structure snapshot + diff
// ---------------------------------------------------------------------------

/**
 * Returns { tabs: [{ name, headers: [...], rowCount }, ...] } for the given
 * spreadsheet. Reads each tab's first row (the header) via the values API.
 */
function _captureStructureSnapshot_(sheetId, metadataOverride) {
  const metadata = metadataOverride || _readSheetMetadata_(sheetId);
  const tabs = [];
  metadata.sheets.forEach(function (sheetMeta) {
    const props = sheetMeta.properties || {};
    const tabName = props.title;
    const colCount = (props.gridProperties && props.gridProperties.columnCount) || 0;
    const rowCount = (props.gridProperties && props.gridProperties.rowCount) || 0;
    if (!tabName) return;
    let headers = [];
    if (colCount > 0 && rowCount > 0) {
      try {
        const headerRow = _readSheetValues_(sheetId, tabName + '!A1:' + _columnLetter_(colCount) + '1');
        headers = (headerRow[0] || []).map(function (h) { return h == null ? '' : String(h).trim(); });
        // Trim trailing empties (sheets often report grid columns wider than
        // actually-used columns — keep only the named-header prefix).
        while (headers.length > 0 && headers[headers.length - 1] === '') headers.pop();
      } catch (err) {
        headers = [];
      }
    }
    tabs.push({ name: tabName, headers: headers, rowCount: rowCount });
  });
  return { tabs: tabs };
}

// Public alias — matches the spec's name for callers in the Bakım panel.
function captureStructureSnapshot_(sheetId) {
  return _captureStructureSnapshot_(sheetId);
}

/**
 * Returns an array of human-readable change descriptions. Empty array means
 * the structure is unchanged (rowCount may differ; that's not a structure
 * change). Detects:
 *   - tabs added / removed / renamed (best-effort: same headers + similar
 *     name → rename; otherwise added/removed)
 *   - columns added / removed / renamed within a known tab
 *   - column reorder within a known tab
 */
function detectStructureChange_(currentSnapshot, lastSnapshot) {
  const changes = [];
  const currTabs = (currentSnapshot && currentSnapshot.tabs) || [];
  const lastTabs = (lastSnapshot && lastSnapshot.tabs) || [];
  const currByName = {};
  const lastByName = {};
  currTabs.forEach(function (t) { currByName[t.name] = t; });
  lastTabs.forEach(function (t) { lastByName[t.name] = t; });

  // Tabs that disappeared from current. We try a best-effort rename match
  // before declaring them gone: a removed tab whose headers exactly match an
  // added tab is reported as a rename.
  const removedTabs = lastTabs.filter(function (t) { return !currByName[t.name]; });
  const addedTabs = currTabs.filter(function (t) { return !lastByName[t.name]; });
  const matchedRenames = {};
  removedTabs.forEach(function (rem) {
    for (let i = 0; i < addedTabs.length; i++) {
      const add = addedTabs[i];
      if (matchedRenames[add.name]) continue;
      if (_arraysEqual_(rem.headers, add.headers)) {
        changes.push("Tab '" + rem.name + "' renamed to '" + add.name + "'");
        matchedRenames[add.name] = rem.name;
        break;
      }
    }
  });
  removedTabs.forEach(function (rem) {
    const renamedTo = Object.keys(matchedRenames).find(function (k) { return matchedRenames[k] === rem.name; });
    if (!renamedTo) changes.push("Tab '" + rem.name + "' removed");
  });
  addedTabs.forEach(function (add) {
    if (!matchedRenames[add.name]) changes.push("Tab '" + add.name + "' added");
  });

  // Tabs present in both: compare headers.
  currTabs.forEach(function (curr) {
    const last = lastByName[curr.name];
    if (!last) return; // already flagged as added or rename
    const a = last.headers || [];
    const b = curr.headers || [];
    const added = b.filter(function (h) { return a.indexOf(h) === -1; });
    const removed = a.filter(function (h) { return b.indexOf(h) === -1; });
    if (added.length === 0 && removed.length === 0) {
      // Same set, possibly reordered.
      if (!_arraysEqual_(a, b)) {
        changes.push("Tab '" + curr.name + "' columns reordered");
      }
      return;
    }
    // Try column-rename heuristic: if exactly one removed and one added, treat
    // as rename. More complex multi-rename gets reported as add+remove pairs.
    if (added.length === 1 && removed.length === 1) {
      changes.push("Tab '" + curr.name + "' column '" + removed[0] + "' renamed to '" + added[0] + "'");
      return;
    }
    removed.forEach(function (h) { changes.push("Tab '" + curr.name + "' lost column '" + h + "'"); });
    added.forEach(function (h) { changes.push("Tab '" + curr.name + "' gained column '" + h + "'"); });
  });
  return changes;
}

function _arraysEqual_(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Per-tab sync — read rows, hash, compare to mirror, write only diffs.
// ---------------------------------------------------------------------------

function _syncTab_(sheetId, tabName, rowCount, colCount) {
  const warnings = [];
  // Cap the read range at the metadata's row/col counts; the values API
  // will truncate to last-non-empty anyway.
  const range = tabName + '!A1:' + _columnLetter_(colCount) + Math.max(rowCount, 1);
  const matrix = _readSheetValues_(sheetId, range);
  if (!matrix || matrix.length < 1) {
    return { rowsRead: 0, written: 0, skipped: 0, warnings: warnings };
  }
  const rawHeaders = (matrix[0] || []).map(function (h) { return h == null ? '' : String(h).trim(); });
  // Trim trailing empty header columns.
  while (rawHeaders.length > 0 && rawHeaders[rawHeaders.length - 1] === '') rawHeaders.pop();
  if (rawHeaders.length === 0) {
    warnings.push('header row is empty; nothing synced');
    return { rowsRead: 0, written: 0, skipped: 0, warnings: warnings };
  }

  // Camel-case header → field-key mapping. Duplicates within a single tab
  // are renamed to {key}_2, {key}_3 etc. so we don't silently drop a column.
  const fieldKeys = [];
  const seenKeys = {};
  rawHeaders.forEach(function (h, idx) {
    if (h === '') {
      fieldKeys.push('column' + (idx + 1));
      return;
    }
    let key = _slugifyHeaderToKey_(h);
    if (!key) key = 'column' + (idx + 1);
    if (seenKeys[key]) {
      seenKeys[key] += 1;
      key = key + '_' + seenKeys[key];
      warnings.push("duplicate header '" + h + "' → key " + key);
    } else {
      seenKeys[key] = 1;
    }
    fieldKeys.push(key);
  });

  const slug = _slugifyTabName_(tabName);
  // Per-tab subcollection layout: /sheets/{tabSlug}/rows/{rowId}. The
  // parent doc /sheets/{tabSlug} carries tab metadata (name, headers,
  // lastSyncAt) so an admin reading just /sheets sees the tab list.
  const tabDocPath = 'sheets/' + slug;
  const collectionPath = tabDocPath + '/rows';

  // Pre-load the existing mirror docs in this tab. We only care about
  // content hashes here so we can skip writing rows whose content hasn't
  // changed since last sync.
  const existing = _listMirrorDocs_(collectionPath);
  const existingByRow = {};
  existing.forEach(function (d) {
    const rowField = d.data && d.data._sourceRow;
    if (typeof rowField === 'number') existingByRow[rowField] = d;
  });

  const writes = [];
  let written = 0;
  let skipped = 0;
  for (let r = 1; r < matrix.length; r++) { // skip header
    const row = matrix[r] || [];
    const sourceRow = r + 1; // 1-based, matches what the sheet UI shows
    // Skip rows that are entirely empty so we don't fill the mirror with
    // garbage when the owner pre-pads tabs with blank rows.
    const allBlank = row.every(function (v) { return v == null || String(v).trim() === ''; });
    if (allBlank) { skipped += 1; continue; }

    const fields = {};
    fieldKeys.forEach(function (key, idx) {
      const cell = row[idx];
      fields[key] = (cell === undefined || cell === null) ? null : cell;
    });
    const hash = _hashRow_(rawHeaders, row);
    const existingDoc = existingByRow[sourceRow];
    const existingHash = existingDoc && existingDoc.data ? existingDoc.data._contentHash : null;

    if (existingHash === hash) { skipped += 1; continue; }

    // Build the full doc payload. _history captures the prior shape so we
    // never lose information even on overwrite (additive guarantee).
    const docId = 'row' + sourceRow;
    const docPath = collectionPath + '/' + docId;
    const newDoc = Object.assign({}, fields, {
      _sourceTab: tabName,
      _sourceRow: sourceRow,
      _sourceHeaders: rawHeaders,
      _contentHash: hash,
      _syncedAt: fsServerTimestamp()
    });
    if (existingDoc && existingDoc.data) {
      const priorHistory = Array.isArray(existingDoc.data._history) ? existingDoc.data._history : [];
      const priorSnapshot = _stripMetaForHistory_(existingDoc.data);
      // Cap history at 10 entries so a chatty cell can't blow up the doc.
      newDoc._history = (priorHistory.concat([priorSnapshot])).slice(-10);
    } else {
      newDoc._history = [];
    }

    // Use a setDocument-style write (overwrite). Apps Script REST: a write
    // with `update` and no precondition is an upsert.
    writes.push(_buildSetWrite_(docPath, newDoc));
    written += 1;
  }

  // Always refresh the parent tab metadata doc (cheap — single write per
  // tab per run) so admin reads of /sheets/{slug} return current headers
  // and an up-to-date lastSyncAt without touching every row.
  writes.push(_buildSetWrite_(tabDocPath, {
    name: tabName,
    headers: rawHeaders,
    rowCount: matrix.length - 1,
    lastSyncAt: fsServerTimestamp()
  }));

  // Flush writes in batches of 400 to stay under Firestore's 500-write commit
  // limit while leaving headroom for retry overhead.
  while (writes.length > 0) {
    const chunk = writes.splice(0, 400);
    fsCommit_(chunk);
  }

  return { rowsRead: matrix.length - 1, written: written, skipped: skipped, warnings: warnings };
}

// Build a Firestore commit write entry from a plain JS doc, honoring the
// fsServerTimestamp() sentinel for any timestamp fields. Mirrors the helper
// shape inside FirestoreClient.gs::createDocument but skips the
// currentDocument: { exists: false } precondition so we get upsert semantics.
function _buildSetWrite_(docPath, data) {
  const docName = fsDocBasePath_() + '/' + docPath;
  const tsFields = collectTimestampFields_(data || {});
  const write = {
    update: {
      name: docName,
      fields: encodeFields_(data || {})
    }
  };
  if (tsFields.length) {
    write.updateTransforms = tsFields.map(function (path) {
      return { fieldPath: path, setToServerValue: 'REQUEST_TIME' };
    });
  }
  return write;
}

// Strip the synthetic _ fields before pushing onto _history — the history
// array should only contain the original cell-content snapshot, not nested
// _history of _history.
function _stripMetaForHistory_(doc) {
  const out = {};
  Object.keys(doc).forEach(function (key) {
    if (key === '_history') return;
    if (key === '_syncedAt') {
      out[key] = doc[key]; // preserve the previous synced timestamp
      return;
    }
    out[key] = doc[key];
  });
  return out;
}

function _listMirrorDocs_(collectionPath) {
  // Read the concrete collection path directly. Firestore structured queries
  // take a collection *id*, not "sheets/foo/rows"; using a direct documents
  // list keeps nested row collections working reliably.
  const token = getAccessToken_();
  const out = [];
  let nextPageToken = null;
  let safety = 10; // hard cap at 10 pages = 3000 docs
  do {
    const u = _collectionListUrl_(collectionPath, nextPageToken);
    const response = UrlFetchApp.fetch(u, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    if (code === 404) return out; // collection doesn't exist yet
    if (code !== 200) {
      throw new Error('Firestore listDocuments failed (' + code + '): ' + response.getContentText());
    }
    const body = JSON.parse(response.getContentText());
    (body.documents || []).forEach(function (d) {
      const segs = d.name.split('/');
      out.push({
        id: segs[segs.length - 1],
        fields: d.fields || {},
        data: decodeFields(d.fields || {})
      });
    });
    nextPageToken = body.nextPageToken || null;
    safety -= 1;
  } while (nextPageToken && safety > 0);
  return out;
}

// ---------------------------------------------------------------------------
// Public landing projection
// ---------------------------------------------------------------------------
//
// The raw /sheets mirror is admin-only because the source sheet contains names,
// internal notes, equipment labels, and other operational context. The public
// homepage reads only /publicProjectStats and /publicTicker, so each sync also
// publishes a tiny, privacy-safe projection:
//   - aggregate PNB page/unit counts
//   - anonymous recent activity rows with coarse material categories
//
// No volunteer names, notes, sheet row ids, links, scanner labels, or raw unit
// identifiers are written to the public collections.

function _publishPublicProjectionFromSheet_(sheetId, metadata) {
  const projection = _buildPublicProjectionFromSheet_(sheetId, metadata);
  const writes = [];

  if (projection.hasStats) {
    writes.push(_buildSetWrite_('publicProjectStats/pnb', {
      totalPages: projection.totalPages,
      donePages: projection.donePages,
      totalUnits: projection.totalUnits,
      doneUnits: projection.doneUnits,
      updatedAt: fsServerTimestamp()
    }));
  }

  projection.tickerEntries.forEach(function (entry) {
    writes.push(_buildSetWrite_('publicTicker/' + entry.id, {
      createdAt: entry.createdAt,
      effort: entry.effort,
      materialCategory: entry.materialCategory,
      projectId: entry.projectId,
      volunteerToken: entry.volunteerToken
    }));
  });

  while (writes.length > 0) {
    fsCommit_(writes.splice(0, 400));
  }
  return {
    totalPages: projection.totalPages,
    donePages: projection.donePages,
    totalUnits: projection.totalUnits,
    doneUnits: projection.doneUnits,
    statsWritten: projection.hasStats,
    tickerWritten: projection.tickerEntries.length
  };
}

function _buildPublicProjectionFromSheet_(sheetId, metadata) {
  const tabs = ((metadata && metadata.sheets) || []).map(function (s) {
    return (s.properties && s.properties.title) || '';
  }).filter(Boolean);

  let totalPages = 0;
  let totalUnits = 0;
  const summaryTab = tabs.find(function (name) {
    return _slugifyTabName_(name) === 'pnb_sayisallastirma';
  });
  if (summaryTab) {
    const summaryRows = _readPublicSheetRows_(sheetId, summaryTab);
    const summary = _summarizePnbOverviewRows_(summaryRows);
    totalPages = summary.totalPages;
    totalUnits = summary.totalUnits;
  }

  let donePages = 0;
  let doneUnits = 0;
  let tickerEntries = [];
  tabs.forEach(function (tabName) {
    const slug = _slugifyTabName_(tabName);
    const rows = _readPublicSheetRows_(sheetId, tabName);
    if (slug === 'gunluk_akis') {
      tickerEntries = tickerEntries.concat(_tickerFromDailyFlowRows_(slug, rows));
      return;
    }
    if (slug.indexOf('pnb_') === 0 && slug !== 'pnb_sayisallastirma') {
      const detail = _summarizePnbDetailRows_(slug, rows);
      donePages += detail.donePages;
      doneUnits += detail.doneUnits;
      tickerEntries = tickerEntries.concat(detail.tickerEntries);
    }
  });

  tickerEntries = _dedupePublicTickerEntries_(tickerEntries)
    .sort(function (a, b) { return b.createdAt.getTime() - a.createdAt.getTime(); })
    .slice(0, 500);

  return {
    hasStats: totalPages > 0 || totalUnits > 0,
    totalPages: Math.max(0, Math.round(totalPages)),
    donePages: Math.max(0, Math.round(totalPages > 0 ? Math.min(donePages, totalPages) : donePages)),
    totalUnits: Math.max(0, Math.round(totalUnits)),
    doneUnits: Math.max(0, Math.round(totalUnits > 0 ? Math.min(doneUnits, totalUnits) : doneUnits)),
    tickerEntries: tickerEntries
  };
}

function _readPublicSheetRows_(sheetId, tabName) {
  const range = tabName + '!A1:J1000';
  const matrix = _readSheetValues_(sheetId, range);
  if (!matrix || matrix.length < 2) return [];
  const headers = (matrix[0] || []).map(function (h, idx) {
    const key = _slugifyHeaderToKey_(h);
    return key || ('column' + (idx + 1));
  });
  const rows = [];
  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] || [];
    const allBlank = raw.every(function (v) { return v == null || String(v).trim() === ''; });
    if (allBlank) continue;
    const row = { _sourceRow: i + 1, _raw: raw };
    headers.forEach(function (key, idx) {
      row[key] = raw[idx] == null ? null : raw[idx];
    });
    rows.push(row);
  }
  return rows;
}

function _summarizePnbOverviewRows_(rows) {
  let totalPages = 0;
  let totalUnits = 0;
  rows.forEach(function (row) {
    const pages = _parseDoneTotalCell_(row.sayfaSayisi);
    totalPages += pages.total;
    totalUnits += _numberOrZero_(row.belgeSayisi);
  });
  return { totalPages: totalPages, totalUnits: totalUnits };
}

function _summarizePnbDetailRows_(tabSlug, rows) {
  let donePages = 0;
  let doneUnits = 0;
  const tickerEntries = [];
  rows.forEach(function (row) {
    const pages = _parseDoneTotalCell_(row.sayfaSayisi != null ? row.sayfaSayisi : row.sayfa);
    const pageCount = pages.done || pages.total;
    if (pageCount > 0) donePages += pageCount;
    doneUnits += 1;

    const createdAt = _parseSheetDate_(row.tarih);
    const person = _stringValue_(row.kaydiOlusuran || row.kaydiOlusturan || row.paydas);
    if (!createdAt || !person) return;
    tickerEntries.push({
      id: _publicTickerDocId_('sheet_' + tabSlug + '_row' + row._sourceRow),
      createdAt: createdAt,
      effort: 'medium',
      materialCategory: _materialCategoryFromPublicRow_(row),
      projectId: 'pnb',
      volunteerToken: _publicVolunteerToken_(person, createdAt)
    });
  });
  return { donePages: donePages, doneUnits: doneUnits, tickerEntries: tickerEntries };
}

function _tickerFromDailyFlowRows_(tabSlug, rows) {
  const entries = [];
  rows.forEach(function (row) {
    const createdAt = _parseSheetDate_(row.tarih);
    const person = _stringValue_(row.paydas || row.kaydiOlusuran || row.kaydiOlusturan);
    if (!createdAt || !person) return;
    const scope = _publicProjectIdFromRow_(row);
    entries.push({
      id: _publicTickerDocId_('sheet_' + tabSlug + '_row' + row._sourceRow),
      createdAt: createdAt,
      effort: 'medium',
      materialCategory: _materialCategoryFromPublicRow_(row),
      projectId: scope,
      volunteerToken: _publicVolunteerToken_(person, createdAt)
    });
  });
  return entries;
}

function _dedupePublicTickerEntries_(entries) {
  const seen = {};
  const out = [];
  entries.forEach(function (entry) {
    if (!entry || !entry.id || seen[entry.id]) return;
    seen[entry.id] = true;
    out.push(entry);
  });
  return out;
}

function _parseDoneTotalCell_(value) {
  if (value == null || value === '') return { done: 0, total: 0 };
  if (typeof value === 'number') return { done: 0, total: value };
  const s = String(value).trim();
  const fraction = s.match(/^([\d.,]+)\s*\/\s*([\d.,]+)$/);
  if (fraction) {
    return {
      done: _parseLocaleNumber_(fraction[1]),
      total: _parseLocaleNumber_(fraction[2])
    };
  }
  const n = _parseLocaleNumber_(s);
  return { done: 0, total: n };
}

function _parseLocaleNumber_(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  const s = String(value).trim().replace(/\s+/g, '');
  if (!s) return 0;
  const normalized = s.indexOf(',') >= 0 && s.indexOf('.') >= 0
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '.');
  const n = Number(normalized.replace(/[^\d.-]/g, ''));
  return isFinite(n) ? n : 0;
}

function _numberOrZero_(value) {
  return _parseLocaleNumber_(value);
}

function _parseSheetDate_(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number' && isFinite(value)) {
    // Google Sheets serial date: days since 1899-12-30.
    const ms = Math.round((value - 25569) * 86400000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (!s) return null;
  const turkishLong = s.match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})$/);
  if (turkishLong) {
    const month = _turkishMonthIndex_(turkishLong[2]);
    if (month >= 0) return new Date(Number(turkishLong[3]), month, Number(turkishLong[1]), 12, 0, 0);
  }
  const numeric = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (numeric) {
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(numeric[2]) - 1, Number(numeric[1]), 12, 0, 0);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function _turkishMonthIndex_(monthName) {
  const key = _asciiFold_(monthName).toLowerCase();
  const months = {
    ocak: 0, subat: 1, mart: 2, nisan: 3, mayis: 4, haziran: 5,
    temmuz: 6, agustos: 7, eylul: 8, ekim: 9, kasim: 10, aralik: 11
  };
  return Object.prototype.hasOwnProperty.call(months, key) ? months[key] : -1;
}

function _materialCategoryFromPublicRow_(row) {
  const haystack = _asciiFold_([
    row.calismaAlani,
    row.devamEdenCalisma,
    row.dijitalBelgeKodu,
    row.notlar
  ].join(' ')).toLowerCase();
  if (haystack.indexOf('foto') >= 0 || haystack.indexOf('gorsel') >= 0) return 'fotoğraflar';
  if (haystack.indexOf('mektup') >= 0) return 'mektuplar';
  if (haystack.indexOf('kitap') >= 0) return 'kitap metinleri';
  if (haystack.indexOf('ders') >= 0) return 'ders notları';
  if (haystack.indexOf('envanter') >= 0) return 'envanter';
  if (haystack.indexOf('toplanti') >= 0 || haystack.indexOf('koordinasyon') >= 0) return 'genel';
  return 'belgeler';
}

function _publicProjectIdFromRow_(row) {
  const haystack = _asciiFold_([
    row.fon,
    row.fonAdi,
    row.calismaAlani,
    row.devamEdenCalisma,
    row.dijitalBelgeKodu,
    row.notlar
  ].join(' ')).toLowerCase();
  return haystack.indexOf('pnb') >= 0 || haystack.indexOf('boratav') >= 0 ? 'pnb' : 'foundation';
}

function _publicVolunteerToken_(name, date) {
  const normalized = _asciiFold_(name).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const monthSalt = Utilities.formatDate(d, SHEET_SYNC_TIMEZONE_, 'yyyy-MM');
  const secret = _publicTickerSecret_();
  const payload = normalized + '|' + monthSalt + '|tarih-vakfi-public-ticker';
  const bytes = Utilities.computeHmacSha256Signature(payload, secret);
  return _bytesToHex_(bytes).slice(0, 16);
}

function _publicTickerSecret_() {
  const props = PropertiesService.getScriptProperties();
  const explicit = props.getProperty('PUBLIC_TICKER_TOKEN_SALT');
  if (explicit) return explicit;
  const sa = getServiceAccount_();
  return (sa && sa.private_key) || 'tarih-vakfi-public-ticker-fallback';
}

function _publicTickerDocId_(value) {
  return _slugifyTabName_(value).slice(0, 120) || ('sheet_' + _hashText_(value).slice(0, 16));
}

function _hashText_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, String(value || ''));
  return _bytesToHex_(bytes);
}

function _bytesToHex_(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

function _stringValue_(value) {
  return value == null ? '' : String(value).trim();
}

function _collectionListUrl_(collectionPath, pageToken) {
  const segments = String(collectionPath || '').split('/').filter(Boolean);
  if (segments.length === 0 || segments.length % 2 === 0) {
    throw new Error('Expected a Firestore collection path, got: ' + collectionPath);
  }
  const collectionId = segments.pop();
  const parentPath = segments.join('/');
  let url = 'https://firestore.googleapis.com/v1/' + fsDocBasePath_();
  if (parentPath) url += '/' + _encodeFirestorePath_(parentPath);
  url += '/' + encodeURIComponent(collectionId) + '?pageSize=300';
  if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
  return url;
}

function _encodeFirestorePath_(path) {
  return String(path || '').split('/').filter(Boolean).map(function (seg) {
    return encodeURIComponent(seg);
  }).join('/');
}

// ---------------------------------------------------------------------------
// Sheets API REST wrappers
// ---------------------------------------------------------------------------

function _readSheetMetadata_(sheetId) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sheetId)
    + '?includeGridData=false';
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + getAccessToken_(SHEETS_SCOPE_) },
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code === 403 || code === 404) {
    const err = new Error('Sheets API access denied (' + code + '): ' + response.getContentText());
    err.code = code;
    err.accessDenied = true;
    throw err;
  }
  if (code !== 200) {
    throw new Error('Sheets API error (' + code + '): ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}

function _readSheetValues_(sheetId, range) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sheetId)
    + '/values/' + encodeURIComponent(range)
    + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING';
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + getAccessToken_(SHEETS_SCOPE_) },
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code === 403 || code === 404) {
    const err = new Error('Sheets API access denied on range ' + range + ' (' + code + ')');
    err.code = code;
    err.accessDenied = true;
    throw err;
  }
  if (code !== 200) {
    throw new Error('Sheets API range read failed (' + code + '): ' + response.getContentText());
  }
  const body = JSON.parse(response.getContentText());
  return body.values || [];
}

// ---------------------------------------------------------------------------
// Config + logging
// ---------------------------------------------------------------------------

function _loadConfig_() {
  try {
    const doc = getDocument(SHEET_SYNC_CONFIG_PATH_);
    if (!doc) return _defaultConfig_();
    return Object.assign(_defaultConfig_(), decodeFields(doc.fields));
  } catch (err) {
    return _defaultConfig_();
  }
}

function _defaultConfig_() {
  return {
    enabled: true,
    consecutiveAccessFailures: 0,
    lastGoodStructure: null,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncSummary: null,
    alertCooldown: {} // { subject → ISO timestamp of last send }
  };
}

function _saveConfig_(config) {
  const payload = Object.assign({}, config, { updatedAt: fsServerTimestamp() });
  // Use updateDocument (patch with field mask) so we don't blow away unknown
  // future fields if a manual edit added some.
  try {
    updateDocument(SHEET_SYNC_CONFIG_PATH_, payload);
  } catch (err) {
    // updateDocument will fail with "no document to update" the very first
    // time. Fall back to createDocument with the same id.
    createDocument('config', payload, 'sheetSync');
  }
}

function _logSyncEvent_(status, details) {
  try {
    createDocument(SHEET_SYNC_LOGS_COLLECTION_, {
      status: status,
      details: details || {},
      createdAt: fsServerTimestamp()
    });
  } catch (err) {
    // Logging must never throw — fall back to console only.
    console.warn('syncLog write failed: ' + err);
  }
}

// ---------------------------------------------------------------------------
// Alert email — gated by 24h per-subject cooldown so a persistent issue
// doesn't flood the admin's inbox.
// ---------------------------------------------------------------------------

function _sendAlertIfFresh_(config, alertEmail, subject, body) {
  if (!alertEmail) return;
  const cooldown = config.alertCooldown || {};
  const lastSent = cooldown[subject];
  if (lastSent) {
    const lastMs = new Date(lastSent).getTime();
    if (!isNaN(lastMs) && Date.now() - lastMs < ALERT_COOLDOWN_HOURS_ * 3600 * 1000) {
      return; // within cooldown — log but don't email
    }
  }
  try {
    MailApp.sendEmail({ to: alertEmail, subject: subject, body: body });
    cooldown[subject] = new Date().toISOString();
    config.alertCooldown = cooldown;
  } catch (err) {
    _logSyncEvent_('alert_email_failed', { subject: subject, error: String(err) });
  }
}

function _composeStructureChangeBody_(changes, currentSnapshot, lastSnapshot) {
  const lines = [];
  lines.push('Hello,');
  lines.push('');
  lines.push('The Tarih Vakfı volunteer sheet structure changed since the last sync.');
  lines.push('Sync continues in degraded mode and will keep mirroring rows, but');
  lines.push('any renamed columns will land under their new field-name keys until');
  lines.push('you confirm the new structure from the Bakım panel.');
  lines.push('');
  lines.push('Detected changes:');
  changes.forEach(function (c) { lines.push('  • ' + c); });
  lines.push('');
  lines.push('Current tabs in the sheet:');
  (currentSnapshot.tabs || []).forEach(function (t) {
    lines.push('  - ' + t.name + ' (' + (t.headers || []).length + ' columns, ' + t.rowCount + ' rows)');
  });
  lines.push('');
  lines.push('Open the Bakım panel and click "Yapıyı yeniden kabul et" once you have');
  lines.push('verified the new structure is intentional. The sync will then take the');
  lines.push('current state as the new baseline and stop alerting.');
  lines.push('');
  lines.push('— Tarih Vakfı sheet sync');
  return lines.join('\n');
}

function _composeAccessLossBody_(consecutive) {
  return [
    'Hello,',
    '',
    'The Tarih Vakfı sheet sync has lost access to the source spreadsheet.',
    'After ' + consecutive + ' consecutive failed reads (about ' + (consecutive * SHEET_SYNC_INTERVAL_MIN_) + ' minutes),',
    'the sync has been paused automatically.',
    '',
    'What probably happened:',
    '  • The sheet owner removed the service account from the share list',
    '  • The sheet was moved into a Drive that the service account cannot reach',
    '  • The sheet was deleted',
    '',
    'Next steps:',
    '  1. Confirm with the sheet owner whether the share was changed intentionally.',
    '  2. Re-add the service account email as Viewer if needed.',
    '  3. From the Bakım panel, click "Senkronizasyonu yeniden başlat" to resume sync.',
    '',
    '— Tarih Vakfı sheet sync'
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Access-failure handling
// ---------------------------------------------------------------------------

function _handleAccessFailure_(err, config, alertEmail) {
  const consecutive = (config.consecutiveAccessFailures || 0) + 1;
  config.consecutiveAccessFailures = consecutive;
  config.lastSyncAt = new Date().toISOString();
  config.lastSyncStatus = 'access_denied';
  _logSyncEvent_('access_denied', {
    error: String(err),
    consecutive: consecutive,
    threshold: ACCESS_FAILURE_PAUSE_THRESHOLD_
  });
  if (consecutive >= ACCESS_FAILURE_PAUSE_THRESHOLD_) {
    config.enabled = false;
    _sendAlertIfFresh_(config, alertEmail,
      '[Tarih Vakfı] Sheet access lost — sync stopped',
      _composeAccessLossBody_(consecutive)
    );
    _logSyncEvent_('paused', { reason: 'access_denied threshold reached' });
  }
  _saveConfig_(config);
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

// "Tab Name" → "tab_name" (ASCII-folded, lower-cased, underscored). Matches
// the slug used in the Firestore mirror collection name (sheet_<slug>).
function _slugifyTabName_(name) {
  return _asciiFold_(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// "Çalışma Alanı" → "calismaAlani" (ASCII-folded, camel-cased). Used for
// per-row field keys.
function _slugifyHeaderToKey_(header) {
  const folded = _asciiFold_(header).trim();
  if (!folded) return '';
  const parts = folded.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.map(function (p, i) {
    const lower = p.toLowerCase();
    return i === 0 ? lower : (lower.charAt(0).toUpperCase() + lower.slice(1));
  }).join('');
}

// Turkish-aware ASCII folding for slug generation.
function _asciiFold_(s) {
  if (s == null) return '';
  return String(s)
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ı/g, 'i').replace(/I/g, 'I')
    .replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
}

// Column index (1-based) → A1 letter ("A", "Z", "AA", ...). We cap at ZZ
// (702 columns) which is far beyond anything the volunteer sheet needs.
function _columnLetter_(n) {
  if (n < 1) n = 1;
  if (n > 702) n = 702;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Stable hash of a row's contents — used to skip writes when the row hasn't
// changed since the last sync. Includes the raw header set so a column
// rename invalidates the cached hash and forces a re-write.
function _hashRow_(headers, row) {
  const payload = JSON.stringify({ h: headers, r: row.map(function (v) { return v == null ? null : v; }) });
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, payload);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}
