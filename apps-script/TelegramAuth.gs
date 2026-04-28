// CURRENTLY DISABLED. Webhook removed and triggers deleted on 28 Apr 2026
// due to Apps Script latency (1+ min response times). Revive when migrating
// to a proper backend (Cloud Run / Vercel / etc.).

/**
 * TelegramAuth.gs — link-code claiming, telegramId resolution, last-seen update.
 *
 * Linking flow:
 *   1. Volunteer opens dashboard Anasayfa → Telegram bağlantı kartı.
 *   2. Web client writes a /telegramLinkCodes/{code} doc (rules enforce uid
 *      matches caller and 10-min TTL).
 *   3. Volunteer pastes the 6-digit code into the bot.
 *   4. doPost detects an unlinked telegramId and calls handleLinkingAttempt,
 *      which calls claimLinkCode here.
 *   5. claimLinkCode validates expiry + uniqueness, sets users/{uid}.telegramId,
 *      deletes the code, returns the user.
 */

function findUserByTelegramId(telegramId) {
  if (!telegramId) return null;
  const docs = listDocuments('users', [eqFilter_('telegramId', telegramId)], { limit: 1 });
  if (!docs.length) return null;
  return mapTelegramUser_(docs[0]);
}

function mapTelegramUser_(doc) {
  const data = doc.data;
  return {
    uid: doc.id,
    fullName: data.fullName || '',
    email: data.email || '',
    department: data.department || '',
    rhythm: data.rhythm || '',
    role: data.role || '',
    status: data.status || '',
    lastReportAt: data.lastReportAt || null,
    telegramId: data.telegramId || '',
    telegramLinkedAt: data.telegramLinkedAt || null,
    telegramLastSeenAt: data.telegramLastSeenAt || null
  };
}

function readUser_(uid) {
  const doc = getDocument('users/' + uid);
  if (!doc) return null;
  return mapTelegramUser_({ id: uid, fields: doc.fields, data: decodeFields(doc.fields) });
}

/**
 * Claims a 6-digit link code on behalf of telegramId. Throws on every failure
 * with a Turkish message the bot can show directly. On success returns the
 * linked user.
 */
function claimLinkCode(code, telegramId) {
  if (!/^\d{6}$/.test(String(code))) {
    throw new Error('Bu 6 haneli bir kod gibi görünmüyor. Web sitesinden yeni bir kod al.');
  }
  const codeDoc = getDocument('telegramLinkCodes/' + code);
  if (!codeDoc) {
    throw new Error('Bu kod bulunamadı. Web sitesinden yeni bir kod al.');
  }
  const codeData = decodeFields(codeDoc.fields);
  const expiresAt = codeData.expiresAt ? new Date(codeData.expiresAt).getTime() : 0;
  if (!expiresAt || expiresAt < Date.now()) {
    // Best-effort cleanup so the next user with the same code-prefix doesn't
    // run into a stale doc. Failures here don't stop the error reply.
    try { deleteDocument('telegramLinkCodes/' + code); } catch (e) {}
    throw new Error('Bu kodun süresi geçti. Web sitesinden yeni bir kod al.');
  }
  const targetUid = codeData.uid;
  if (!targetUid) {
    throw new Error('Kod kayıtlı kullanıcı taşımıyor. Web sitesinden yeni bir kod al.');
  }
  // Reject if this telegramId is already linked to a different user.
  const existing = findUserByTelegramId(telegramId);
  if (existing && existing.uid && existing.uid !== targetUid) {
    throw new Error('Bu Telegram hesabı başka bir kullanıcıyla eşleşmiş.');
  }
  // Reject if the target user already has a different telegramId (someone is
  // re-linking from a fresh code without unlinking the old account).
  const target = readUser_(targetUid);
  if (!target) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  if (target.telegramId && target.telegramId !== telegramId) {
    throw new Error('Bu kullanıcı zaten farklı bir Telegram hesabıyla eşleşmiş. Önce web sitesinden mevcut bağlantıyı kaldır.');
  }
  // All clear — write telegramId + linkedAt, then delete the code.
  updateDocument('users/' + targetUid, {
    telegramId: String(telegramId),
    telegramLinkedAt: fsServerTimestamp(),
    telegramLastSeenAt: fsServerTimestamp(),
    updatedAt: fsServerTimestamp()
  });
  try { deleteDocument('telegramLinkCodes/' + code); } catch (e) {
    console.warn('telegramLinkCodes cleanup failed: ' + e.message);
  }
  return readUser_(targetUid);
}

/**
 * Best-effort touch of users/{uid}.telegramLastSeenAt. Wrapped in try/catch by
 * callers so a failure here never blocks the bot reply.
 */
function updateUserLastSeen(uid) {
  if (!uid) return;
  updateDocument('users/' + uid, {
    telegramLastSeenAt: fsServerTimestamp()
  });
}
