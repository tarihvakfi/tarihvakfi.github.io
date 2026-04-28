// CURRENTLY DISABLED. Webhook removed and triggers deleted on 28 Apr 2026
// due to Apps Script latency (1+ min response times). Revive when migrating
// to a proper backend (Cloud Run / Vercel / etc.).

/**
 * TelegramSession.gs — session CRUD, archive-unit search, materialCategory
 * lookup, volunteer token hashing.
 *
 * Sessions live in /telegramSessions/{telegramId}. They are write-only via the
 * service account (rules deny client access). State machine:
 *
 *   idle → awaiting_project → awaiting_unit → awaiting_note
 *        → awaiting_status → awaiting_link → idle (after commitReport)
 *
 * /iptal at any point resets to idle and clears draft.
 *
 * Sessions auto-expire 30 minutes after the last update. We do NOT actively
 * delete expired sessions (no need — getOrCreateSession resets to idle on
 * expiry). A future housekeeping trigger could prune them if storage matters.
 */

const TG_SESSION_TTL_MS_ = 30 * 60 * 1000;

function freshDraft_() {
  return {
    projectId: null,
    unitId: null,
    unitSnapshot: null,
    note: null,
    status: null,
    url: null
  };
}

function freshSession_() {
  const now = new Date();
  return {
    step: 'idle',
    draft: freshDraft_(),
    lastSearchResults: [],
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TG_SESSION_TTL_MS_).toISOString()
  };
}

/**
 * Returns the live session for a telegramId, creating an idle one if missing
 * or if the previous session expired. The returned object is a plain JS dict;
 * call writeSession() to persist any changes.
 */
function getOrCreateSession(telegramId) {
  const doc = getDocument('telegramSessions/' + telegramId);
  if (!doc) {
    const session = freshSession_();
    writeSession(telegramId, session);
    return session;
  }
  const data = decodeFields(doc.fields);
  // Hydrate the nested draft + array fields with sensible defaults so callers
  // don't need to null-check every property.
  const session = {
    step: data.step || 'idle',
    draft: Object.assign(freshDraft_(), data.draft || {}),
    lastSearchResults: Array.isArray(data.lastSearchResults) ? data.lastSearchResults : [],
    updatedAt: data.updatedAt || new Date().toISOString(),
    expiresAt: data.expiresAt || ''
  };
  // Auto-reset on expiry. Volunteer can resume mid-flow within 30 min;
  // beyond that we silently forget where they were.
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    const fresh = freshSession_();
    writeSession(telegramId, fresh);
    return fresh;
  }
  return session;
}

function writeSession(telegramId, session) {
  const now = new Date();
  session.updatedAt = now.toISOString();
  session.expiresAt = new Date(now.getTime() + TG_SESSION_TTL_MS_).toISOString();
  // We use createDocument with a forced docId so the same call works for both
  // first-write (creates) and rewrite (replaces). Firestore's update REST
  // semantics with no updateMask replaces all fields, which is exactly what we
  // want for sessions.
  const docPath = 'telegramSessions/' + telegramId + '/__placeholder__';
  // Build via createDocument with docId override.
  const id = telegramId;
  const collectionPath = 'telegramSessions';
  // createDocument has currentDocument: { exists: false } — that would fail on
  // overwrite. Use a separate write path that doesn't require non-existence.
  writeFullDoc_('telegramSessions/' + id, {
    step: session.step,
    draft: session.draft,
    lastSearchResults: session.lastSearchResults,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt
  });
}

// Full-document write that replaces existing fields (or creates if absent).
// Internal helper because the public createDocument enforces exists==false for
// safety; sessions need overwrite semantics.
function writeFullDoc_(docPath, data) {
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
  fsCommit_([write]);
}

function resetSession(telegramId) {
  writeSession(telegramId, freshSession_());
}

function setSessionStep(telegramId, session, step) {
  session.step = step;
  writeSession(telegramId, session);
}

// ---- archiveUnits search (PNB-aware) -----------------------------------
//
// The bot's /rapor flow searches archive units by source identifier, seri no,
// and content description. Turkish-normalized matching: lowercase + map ı→i,
// İ→i, ş→s, ğ→g, ü→u, ö→o, ç→c. Returns up to 5 results.

function tgNormalize_(value) {
  if (!value) return '';
  return String(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/Ü/g, 'u')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c');
}

function searchArchiveUnits(projectId, query) {
  if (!query) return [];
  const needle = tgNormalize_(query.trim());
  if (!needle) return [];
  // Firestore can't do prefix-match on multiple fields server-side without
  // composite indexes per field. The dataset is small (~250 units for PNB) so
  // we list-by-projectId and filter in memory.
  const filters = [eqFilter_('projectId', projectId)];
  const docs = listDocuments('archiveUnits', filters, { limit: 1000 });
  const ranked = [];
  docs.forEach(function (doc) {
    const data = doc.data;
    if (data.status === 'pending_review') return; // not yet triaged
    const haystackBits = [
      data.sourceIdentifier, data.sourceCode, data.seriesNo,
      data.boxNo, data.contentDescription, data.title, data.notes
    ].filter(Boolean);
    const haystack = tgNormalize_(haystackBits.join(' '));
    if (haystack.indexOf(needle) === -1) return;
    // Score: exact source-identifier match wins, then prefix on sid, then
    // contains. Used to put the most-likely pick first.
    const sidNorm = tgNormalize_(data.sourceIdentifier || '');
    let score = 0;
    if (sidNorm === needle) score = 1000;
    else if (sidNorm.indexOf(needle) === 0) score = 500;
    else if (sidNorm.indexOf(needle) !== -1) score = 200;
    else score = 50;
    ranked.push({ doc: doc, score: score });
  });
  ranked.sort(function (a, b) { return b.score - a.score; });
  return ranked.slice(0, 5).map(function (r) {
    return {
      id: r.doc.id,
      sourceIdentifier: r.doc.data.sourceIdentifier || '',
      contentDescription: r.doc.data.contentDescription || '',
      seriesNo: r.doc.data.seriesNo || ''
    };
  });
}

// Same mapping as web's materialCategoryFromSeriesNo (app/dashboard.js). Kept
// in sync manually — if the web mapping changes, update both.
function deriveMaterialCategoryFromSeries(seriesNo) {
  const s = String(seriesNo || '').trim();
  if (!s) return 'belgeler';
  if (s.indexOf('170') === 0) return 'mektuplar';
  if (s === '120.5' || s.indexOf('120.5') === 0) return 'kitap metinleri';
  if (s.indexOf('120') === 0) return 'yayın metinleri';
  if (s.indexOf('110') === 0) return 'ders notları';
  if (s.indexOf('130') === 0) return 'makaleler';
  if (s.indexOf('140') === 0) return 'halk hikâyeleri';
  if (s.indexOf('150') === 0) return 'halkbilim derlemeleri';
  if (s.indexOf('210') === 0) return 'ses kayıtları';
  if (s.indexOf('220') === 0 || /^I\.?0?1/i.test(s)) return 'fotoğraflar';
  if (s.indexOf('230') === 0) return 'görseller';
  return 'belgeler';
}

function deriveMaterialCategory(unitSnapshot) {
  if (!unitSnapshot) return 'belgeler';
  // Snapshot only carries sid + desc. Seri-no is on the live archive doc, so
  // we re-fetch it; categorization is best-effort and falls through to "belgeler"
  // on any miss.
  const sid = unitSnapshot.sourceIdentifier || '';
  return deriveMaterialCategoryFromSeries(sid); // sid often starts with the seri no
}

/**
 * 16-hex-char monthly token. Mirrors app/dashboard.js computeVolunteerToken so
 * publicTicker entries written by the bot count correctly toward the
 * "distinct volunteers" metric on the public landing page.
 */
function computeVolunteerToken(uid) {
  if (!uid) return '';
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const data = uid + '|' + month + '|tarih-vakfi-public-ticker';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data, Utilities.Charset.UTF_8);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    const h = b.toString(16);
    hex += h.length === 1 ? '0' + h : h;
  }
  return hex.slice(0, 16);
}
