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
