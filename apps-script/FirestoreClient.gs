/**
 * Firestore REST client for Apps Script.
 *
 * Authenticates via a GCP service account whose JSON key lives in
 * PropertiesService.getScriptProperties() under FIREBASE_SERVICE_ACCOUNT.
 * Uses the Firestore REST API directly — no Node SDK, no Cloud Functions.
 *
 * See docs/APPS_SCRIPT_SETUP.md for how to create the service account
 * and paste the JSON.
 */

const FIRESTORE_SCOPE_ = 'https://www.googleapis.com/auth/datastore';
const FIRESTORE_TOKEN_URL_ = 'https://oauth2.googleapis.com/token';

function getServiceAccount_() {
  const raw = PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON: ' + err);
  }
}

function base64UrlEncode_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

/**
 * Builds a JWT signed with the service account's private key and exchanges it
 * for a short-lived OAuth access token scoped to Firestore.
 * Returns the access token string. Throws if credentials are missing/invalid.
 */
function getAccessToken_() {
  const sa = getServiceAccount_();
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT missing from Script Properties');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: FIRESTORE_SCOPE_,
    aud: FIRESTORE_TOKEN_URL_,
    iat: now,
    exp: now + 3600
  };

  const headerB64 = base64UrlEncode_(Utilities.newBlob(JSON.stringify(header)).getBytes());
  const claimB64 = base64UrlEncode_(Utilities.newBlob(JSON.stringify(claim)).getBytes());
  const toSign = headerB64 + '.' + claimB64;
  const signature = Utilities.computeRsaSha256Signature(toSign, sa.private_key);
  const jwt = toSign + '.' + base64UrlEncode_(signature);

  const response = UrlFetchApp.fetch(FIRESTORE_TOKEN_URL_, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    muteHttpExceptions: true,
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }
  });
  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Firestore token exchange failed (' + code + '): ' + response.getContentText());
  }
  return JSON.parse(response.getContentText()).access_token;
}

function firestoreProjectId_() {
  const sa = getServiceAccount_();
  if (!sa || !sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT missing project_id');
  return sa.project_id;
}

function runStructuredQuery_(collection, filters) {
  const token = getAccessToken_();
  const projectId = firestoreProjectId_();
  const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId) +
    '/databases/(default)/documents:runQuery';
  const where = filters.length === 1
    ? filters[0]
    : { compositeFilter: { op: 'AND', filters: filters } };
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: where
    }
  };
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Firestore runQuery failed (' + code + '): ' + response.getContentText());
  }
  const results = JSON.parse(response.getContentText()) || [];
  return results.filter(function (r) { return r && r.document; }).map(function (r) {
    return { name: r.document.name, fields: r.document.fields || {} };
  });
}

function eqFilter_(path, stringValue) {
  return {
    fieldFilter: {
      field: { fieldPath: path },
      op: 'EQUAL',
      value: { stringValue: stringValue }
    }
  };
}

function inStringsFilter_(path, stringValues) {
  return {
    fieldFilter: {
      field: { fieldPath: path },
      op: 'IN',
      value: {
        arrayValue: {
          values: stringValues.map(function (s) { return { stringValue: s }; })
        }
      }
    }
  };
}

function decodeValue_(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue; // ISO 8601 string
  if ('nullValue' in v) return null;
  return null;
}

function mapUserDoc_(doc) {
  const f = doc.fields;
  const segments = doc.name.split('/');
  return {
    uid: segments[segments.length - 1],
    fullName: decodeValue_(f.fullName) || '',
    email: decodeValue_(f.email) || '',
    department: decodeValue_(f.department) || '',
    rhythm: decodeValue_(f.rhythm),
    lastReportAt: decodeValue_(f.lastReportAt)
  };
}

/**
 * Returns approved volunteers as
 * [{uid, fullName, email, department, rhythm, lastReportAt}].
 */
function listApprovedVolunteers() {
  const docs = runStructuredQuery_('users', [
    eqFilter_('role', 'volunteer'),
    eqFilter_('status', 'approved')
  ]);
  return docs.map(mapUserDoc_);
}

/**
 * Returns the latest report.workDate (YYYY-MM-DD) for the given volunteer,
 * or null when no report exists. Used by checkInactiveVolunteers to flag
 * inactivity based on when the work actually happened (not when it was
 * logged) — backdated reports must keep a volunteer counted as active for
 * the dates they cover.
 *
 * Requires the composite index `reports.volunteerId ASC + workDate DESC`
 * (declared in firebase/firestore.indexes.json).
 */
function getLatestWorkDateForVolunteer(volunteerId) {
  if (!volunteerId) return null;
  const token = getAccessToken_();
  const projectId = firestoreProjectId_();
  const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId) +
    '/databases/(default)/documents:runQuery';
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'reports' }],
      where: eqFilter_('volunteerId', volunteerId),
      orderBy: [{ field: { fieldPath: 'workDate' }, direction: 'DESCENDING' }],
      limit: 1
    }
  };
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Firestore latestWorkDate query failed (' + code + '): ' + response.getContentText());
  }
  const results = JSON.parse(response.getContentText()) || [];
  for (var i = 0; i < results.length; i++) {
    var d = results[i].document;
    if (d && d.fields && d.fields.workDate) {
      return decodeValue_(d.fields.workDate);
    }
  }
  return null;
}

/**
 * Returns coordinators and admins in the given department as
 * [{uid, fullName, email, department, rhythm, lastReportAt}].
 */
function findCoordinatorsForDepartment(dept) {
  if (!dept) return [];
  const docs = runStructuredQuery_('users', [
    inStringsFilter_('role', ['coordinator', 'admin']),
    eqFilter_('department', dept)
  ]);
  return docs.map(mapUserDoc_);
}

// ---------------------------------------------------------------------------
// Generic read/write/query helpers — added for the Telegram bot (TelegramBot.gs,
// TelegramSession.gs, TelegramAuth.gs, TelegramReminders.gs).
//
// Everything below is additive. None of the original mailers/inactivity flows
// reference these helpers, so existing behavior is unaffected.
// ---------------------------------------------------------------------------

const FS_TS_SENTINEL_ = '__FS_SERVER_TIMESTAMP__';

/**
 * Sentinel value callers pass into createDocument / updateDocument to mark
 * fields that must be written as server-side request-time timestamps. We emit
 * an `updateTransforms` entry alongside the `update` write in the same commit
 * so the resulting document's timestamp comparison matches a web-side
 * serverTimestamp() exactly (both end up as Firestore Timestamp values
 * stamped at the same wall-clock the request arrived at the server).
 */
function fsServerTimestamp() {
  return FS_TS_SENTINEL_;
}

function fsDocBasePath_() {
  return 'projects/' + firestoreProjectId_() + '/databases/(default)/documents';
}

function fsCommitUrl_() {
  return 'https://firestore.googleapis.com/v1/' + fsDocBasePath_() + ':commit';
}

function fsAuthHeaders_() {
  return { Authorization: 'Bearer ' + getAccessToken_() };
}

// Encode a JS value into a Firestore Value object. Sentinel values for server
// timestamps are filtered out by the caller before this is reached.
function encodeValue_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(encodeValue_) } };
  }
  if (typeof v === 'object') {
    return { mapValue: { fields: encodeFields_(v) } };
  }
  return { stringValue: String(v) };
}

function encodeFields_(obj) {
  const out = {};
  Object.keys(obj).forEach(function (key) {
    const value = obj[key];
    if (value === FS_TS_SENTINEL_) return; // emitted as a fieldTransform instead
    out[key] = encodeValue_(value);
  });
  return out;
}

function collectTimestampFields_(obj) {
  const fields = [];
  Object.keys(obj).forEach(function (key) {
    if (obj[key] === FS_TS_SENTINEL_) fields.push(key);
  });
  return fields;
}

function fsRandomId_() {
  // Firestore's auto-id: 20 chars from [A-Za-z0-9]. Apps Script Utilities.getUuid()
  // is fine for uniqueness; we just compress it.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = Utilities.getUuid().replace(/-/g, '');
  let out = '';
  for (let i = 0; i < 20; i++) {
    const charCode = parseInt(bytes.charAt(i % bytes.length), 16);
    out += alphabet.charAt((charCode * 7 + i) % alphabet.length);
  }
  return out;
}

function fsCommit_(writes) {
  const response = UrlFetchApp.fetch(fsCommitUrl_(), {
    method: 'post',
    contentType: 'application/json',
    headers: fsAuthHeaders_(),
    payload: JSON.stringify({ writes: writes }),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Firestore commit failed (' + code + '): ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}

/**
 * Creates a document under {collectionPath}. If docId is null/undefined a 20-char
 * auto-id is generated. Returns the new document id. Server-timestamp fields
 * are emitted as updateTransforms so they land identically to web writes.
 */
function createDocument(collectionPath, data, docId) {
  const id = docId || fsRandomId_();
  const docName = fsDocBasePath_() + '/' + collectionPath + '/' + id;
  const tsFields = collectTimestampFields_(data || {});
  const write = {
    update: {
      name: docName,
      fields: encodeFields_(data || {})
    },
    currentDocument: { exists: false } // create-if-not-exists semantics
  };
  if (tsFields.length) {
    write.updateTransforms = tsFields.map(function (path) {
      return { fieldPath: path, setToServerValue: 'REQUEST_TIME' };
    });
  }
  fsCommit_([write]);
  return id;
}

/**
 * Patch-updates an existing document at {docPath} (e.g. "users/abc"). Only the
 * fields you pass are touched (uses an updateMask). Server-timestamp fields
 * are emitted as updateTransforms.
 */
function updateDocument(docPath, data) {
  const docName = fsDocBasePath_() + '/' + docPath;
  const tsFields = collectTimestampFields_(data || {});
  const fieldKeys = Object.keys(data || {}); // includes timestamp-sentinel keys
  const regularKeys = fieldKeys.filter(function (k) { return data[k] !== FS_TS_SENTINEL_; });
  const write = {
    update: {
      name: docName,
      fields: encodeFields_(data || {})
    },
    updateMask: { fieldPaths: regularKeys }
  };
  if (tsFields.length) {
    write.updateTransforms = tsFields.map(function (path) {
      return { fieldPath: path, setToServerValue: 'REQUEST_TIME' };
    });
  }
  fsCommit_([write]);
}

/**
 * Deletes a document at {docPath}. No-op if it doesn't exist (Firestore returns
 * 200 either way for delete writes).
 */
function deleteDocument(docPath) {
  const docName = fsDocBasePath_() + '/' + docPath;
  fsCommit_([{ delete: docName }]);
}

/**
 * Reads a document at {docPath}. Returns { id, fields } where fields is the
 * raw Firestore Value-encoded map, or null if the doc doesn't exist.
 */
function getDocument(docPath) {
  const url = 'https://firestore.googleapis.com/v1/' + fsDocBasePath_() + '/' + docPath;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: fsAuthHeaders_(),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code === 404) return null;
  if (code !== 200) {
    throw new Error('Firestore get failed (' + code + '): ' + response.getContentText());
  }
  const doc = JSON.parse(response.getContentText());
  const segments = doc.name.split('/');
  return { id: segments[segments.length - 1], fields: doc.fields || {} };
}

// Decodes a fields map into a plain JS object. Recursively handles maps and
// arrays. Used by the Telegram bot to read sessions, link codes, users, etc.
function decodeFields(fields) {
  if (!fields) return {};
  const out = {};
  Object.keys(fields).forEach(function (key) {
    out[key] = decodeFieldValue_(fields[key]);
  });
  return out;
}

function decodeFieldValue_(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) {
    const values = (v.arrayValue && v.arrayValue.values) || [];
    return values.map(decodeFieldValue_);
  }
  if ('mapValue' in v) {
    return decodeFields((v.mapValue && v.mapValue.fields) || {});
  }
  return null;
}

/**
 * Generic structured-query helper exposed to bot code. Pass an array of
 * filters (built via fsEq / fsIn / fsGte / fsLt / fsNotNull) plus optional
 * { orderBy, limit }. Returns [{ id, fields, data }] where data is the
 * decoded plain-object form.
 */
function listDocuments(collectionPath, filters, opts) {
  opts = opts || {};
  const token = getAccessToken_();
  const url = 'https://firestore.googleapis.com/v1/' + fsDocBasePath_() + ':runQuery';
  const where = !filters || filters.length === 0
    ? null
    : (filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters: filters } });
  const structuredQuery = { from: [{ collectionId: collectionPath }] };
  if (where) structuredQuery.where = where;
  if (opts.orderBy) {
    structuredQuery.orderBy = [{
      field: { fieldPath: opts.orderBy.field },
      direction: opts.orderBy.direction === 'desc' ? 'DESCENDING' : 'ASCENDING'
    }];
  }
  if (opts.limit) structuredQuery.limit = opts.limit;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ structuredQuery: structuredQuery }),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Firestore listDocuments failed (' + code + '): ' + response.getContentText());
  }
  const results = JSON.parse(response.getContentText()) || [];
  return results.filter(function (r) { return r && r.document; }).map(function (r) {
    const segments = r.document.name.split('/');
    const fields = r.document.fields || {};
    return { id: segments[segments.length - 1], fields: fields, data: decodeFields(fields) };
  });
}

// Filter builders. Names are short on purpose so query call-sites stay readable.
function fsEq(path, value) {
  return { fieldFilter: { field: { fieldPath: path }, op: 'EQUAL', value: encodeValue_(value) } };
}
function fsIn(path, values) {
  return {
    fieldFilter: {
      field: { fieldPath: path },
      op: 'IN',
      value: { arrayValue: { values: values.map(encodeValue_) } }
    }
  };
}
function fsGte(path, value) {
  return { fieldFilter: { field: { fieldPath: path }, op: 'GREATER_THAN_OR_EQUAL', value: encodeValue_(value) } };
}
function fsLt(path, value) {
  return { fieldFilter: { field: { fieldPath: path }, op: 'LESS_THAN', value: encodeValue_(value) } };
}
function fsNotNull(path) {
  return { unaryFilter: { field: { fieldPath: path }, op: 'IS_NOT_NULL' } };
}
