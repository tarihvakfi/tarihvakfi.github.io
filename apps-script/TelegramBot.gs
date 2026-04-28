// CURRENTLY DISABLED. Webhook removed and triggers deleted on 28 Apr 2026
// due to Apps Script latency (1+ min response times). Revive when migrating
// to a proper backend (Cloud Run / Vercel / etc.).

/**
 * TelegramBot.gs — webhook entrypoint, command dispatch, conversation flow.
 *
 * IMPORTANT: this file runs as the Apps Script Web App. After ANY change to
 * any .gs file in this project you MUST redeploy the web app:
 *
 *   Deploy → Manage deployments → (existing webhook deployment) →
 *     edit (pencil) → Version: New version → Deploy
 *
 * The Telegram webhook URL stays the same across redeploys, but Telegram
 * caches nothing — the next message after redeploy will hit the new code.
 *
 * Setup, webhook registration, and trigger creation are documented in
 * apps-script/TELEGRAM_SETUP.md.
 *
 * The bot token is read from Script Properties (TELEGRAM_BOT_TOKEN). It is
 * never written to a file. If the property is missing every bot function
 * short-circuits with a logged warning — the doPost handler still 200s so
 * Telegram doesn't retry indefinitely.
 */

const TG_API_BASE_ = 'https://api.telegram.org/bot';
const TG_DASHBOARD_URL_ = 'https://tarihvakfi.github.io/app/';

function tgToken_() {
  return PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || '';
}

function hasTelegramToken() {
  return !!tgToken_();
}

function ack() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let chatId = null;
  try {
    if (!hasTelegramToken()) {
      console.warn('TELEGRAM_BOT_TOKEN missing — bot disabled.');
      return ack();
    }
    if (!e || !e.postData) return ack();
    const update = JSON.parse(e.postData.contents);
    const message = update.message;
    if (!message || !message.text) return ack();

    const telegramId = String(message.from.id);
    const text = String(message.text).trim();
    chatId = message.chat.id;

    const session = getOrCreateSession(telegramId);
    const linkedUser = findUserByTelegramId(telegramId);

    if (linkedUser) {
      try { updateUserLastSeen(linkedUser.uid); } catch (err) {}
    }

    if (text.indexOf('/') === 0) {
      handleCommand(text, telegramId, chatId, session, linkedUser);
    } else if (!linkedUser) {
      handleLinkingAttempt(text, telegramId, chatId);
    } else {
      handleConversation(text, telegramId, chatId, session, linkedUser);
    }
  } catch (err) {
    console.error('doPost error: ' + (err && err.message), err && err.stack);
    if (chatId) {
      try {
        sendMessage(chatId, 'Bir şey ters gitti. /iptal yazıp tekrar dene.');
      } catch (replyErr) {
        console.error('Error reply also failed: ' + replyErr.message);
      }
    }
  }
  return ack();
}

// Telegram bot API call. chatId can be a numeric chat id from message.chat.id
// or a string telegramId — both work because Telegram routes by id either way.
function sendMessage(chatId, text) {
  if (!chatId) return;
  if (!hasTelegramToken()) {
    console.warn('sendMessage skipped — no TELEGRAM_BOT_TOKEN.');
    return;
  }
  const url = TG_API_BASE_ + tgToken_() + '/sendMessage';
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: text,
      disable_web_page_preview: true
    }),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code !== 200) {
    console.error('sendMessage failed (' + code + '): ' + response.getContentText());
  }
}

// ---- Command dispatcher -------------------------------------------------

function handleCommand(text, telegramId, chatId, session, linkedUser) {
  // Strip @botname suffix (Telegram appends it in group chats).
  const cmd = text.split(/\s+/)[0].toLowerCase().split('@')[0];
  switch (cmd) {
    case '/start':
      replyStart_(telegramId, chatId, linkedUser);
      return;
    case '/rapor':
      replyRapor_(telegramId, chatId, session, linkedUser);
      return;
    case '/son':
      replySon_(telegramId, chatId, linkedUser);
      return;
    case '/iptal':
      replyIptal_(telegramId, chatId);
      return;
    case '/yardim':
    case '/help':
      replyYardim_(chatId);
      return;
    default:
      sendMessage(chatId, 'Bu komutu tanımıyorum. /yardim için yaz.');
  }
}

function replyStart_(telegramId, chatId, linkedUser) {
  if (!linkedUser) {
    sendMessage(chatId,
      'Merhaba! Ben Tarih Vakfı gönüllü botu.\n\n' +
      'Önce kim olduğunu öğrenmem gerek. Şu adrese gir:\n' +
      TG_DASHBOARD_URL_ + '\n\n' +
      'Anasayfa\'da Telegram bağlantı bölümünden 6 haneli kod al, o kodu buraya gönder.');
    return;
  }
  sendMessage(chatId, welcomeLinkedText_(linkedUser));
}

function welcomeLinkedText_(user) {
  const firstName = (user.fullName || '').split(' ')[0] || 'gönüllü';
  return 'Merhaba ' + firstName + '!\n\n' +
    'Komutlar:\n' +
    '/rapor - Yeni rapor yaz\n' +
    '/son - Son raporlarını göster\n' +
    '/iptal - Yazmakta olduğun raporu iptal et\n' +
    '/yardim - Yardım';
}

function replyRapor_(telegramId, chatId, session, linkedUser) {
  if (!linkedUser) {
    sendMessage(chatId, 'Önce /start yazarak bağlantı kur.');
    return;
  }
  // Reset draft, advance to project pick. Today every approved volunteer can
  // see PNB; explicit memberships will gate this when projectMemberships lands.
  session.draft = {
    projectId: null, unitId: null, unitSnapshot: null,
    note: null, status: null, url: null
  };
  session.lastSearchResults = [];
  session.step = 'awaiting_project';
  writeSession(telegramId, session);
  sendMessage(chatId,
    'Hangi proje için?\n\n' +
    '1. Pertev Naili Boratav\n' +
    '2. Genel vakıf çalışması\n\n' +
    '(numara yaz, /iptal ile çık)');
}

function replySon_(telegramId, chatId, linkedUser) {
  if (!linkedUser) {
    sendMessage(chatId, 'Önce /start yazarak bağlantı kur.');
    return;
  }
  const docs = listDocuments('reports',
    [eqFilter_('volunteerId', linkedUser.uid)],
    { orderBy: { field: 'createdAt', direction: 'desc' }, limit: 3 });
  if (!docs.length) {
    sendMessage(chatId, 'Henüz hiç rapor yazmamışsın. /rapor yazarak başlayabilirsin.');
    return;
  }
  const lines = ['Son raporların:', ''];
  docs.forEach(function (doc, idx) {
    const data = doc.data;
    const ago = relativeAgo_(data.createdAt);
    const summary = shortSummaryFor_(data);
    lines.push((idx + 1) + '. ' + ago + ' — ' + summary);
  });
  sendMessage(chatId, lines.join('\n'));
}

function replyIptal_(telegramId, chatId) {
  resetSession(telegramId);
  sendMessage(chatId, 'Tamam, iptal edildi. /rapor ile yeniden başlayabilirsin.');
}

function replyYardim_(chatId) {
  sendMessage(chatId,
    'Tarih Vakfı gönüllü botu. Komutlar:\n\n' +
    '/rapor - Bu hafta ne yaptığını yaz\n' +
    '/son - Son 3 raporunu göster\n' +
    '/iptal - Yazmakta olduğun raporu iptal et\n\n' +
    'Web sitesinden de rapor yazabilirsin:\n' +
    TG_DASHBOARD_URL_);
}

// ---- Linking (unlinked users) ------------------------------------------

function handleLinkingAttempt(text, telegramId, chatId) {
  if (/^\d{6}$/.test(text)) {
    try {
      const user = claimLinkCode(text, telegramId);
      sendMessage(chatId, 'Bağlantı kuruldu! Hoş geldin.\n\n' + welcomeLinkedText_(user));
    } catch (err) {
      sendMessage(chatId, err.message || 'Bağlantı kurulamadı. Web sitesinden yeni bir kod al.');
    }
    return;
  }
  sendMessage(chatId,
    'Önce kim olduğunu öğrenmem gerek. Şu adrese gir:\n' +
    TG_DASHBOARD_URL_ + '\n\n' +
    'Anasayfa\'da Telegram bağlantı bölümünden 6 haneli kod al, o kodu buraya gönder.');
}

// ---- Conversation flow (linked users) ----------------------------------

function handleConversation(text, telegramId, chatId, session, linkedUser) {
  switch (session.step) {
    case 'awaiting_project': return handleAwaitingProject_(text, telegramId, chatId, session);
    case 'awaiting_unit':    return handleAwaitingUnit_(text, telegramId, chatId, session);
    case 'awaiting_note':    return handleAwaitingNote_(text, telegramId, chatId, session);
    case 'awaiting_status':  return handleAwaitingStatus_(text, telegramId, chatId, session);
    case 'awaiting_link':    return handleAwaitingLink_(text, telegramId, chatId, session, linkedUser);
    case 'idle':
    default:
      // Idle + free-text — gentle nudge to /rapor.
      sendMessage(chatId, 'Yeni rapor için /rapor yaz, son raporların için /son.');
  }
}

function handleAwaitingProject_(text, telegramId, chatId, session) {
  if (text === '1') {
    session.draft.projectId = 'pnb';
    session.step = 'awaiting_unit';
    writeSession(telegramId, session);
    sendMessage(chatId,
      'PNB için yazıyoruz.\n\n' +
      'Hangi iş paketi? Kutu/seri kodu ya da kelime yaz, ya da \'yok\' yaz ' +
      '(toplantı, koordinasyon gibi belirli bir kutuya bağlı olmayan işler için).');
  } else if (text === '2') {
    session.draft.projectId = null;
    session.step = 'awaiting_note';
    writeSession(telegramId, session);
    sendMessage(chatId,
      'Genel vakıf çalışması için yazıyoruz.\n\n' +
      'Ne yaptın? Birkaç cümle yaz.');
  } else {
    sendMessage(chatId, 'Lütfen 1 veya 2 yaz.');
  }
}

function handleAwaitingUnit_(text, telegramId, chatId, session) {
  const lower = text.toLowerCase();
  if (lower === 'yok' || text === '0') {
    session.draft.unitId = null;
    session.draft.unitSnapshot = null;
    session.step = 'awaiting_note';
    session.lastSearchResults = [];
    writeSession(telegramId, session);
    sendMessage(chatId, 'Tamam. Ne yaptın? Birkaç cümle yaz.');
    return;
  }
  // Numeric pick from previous result list.
  if (/^[1-5]$/.test(text) && session.lastSearchResults.length) {
    const idx = parseInt(text, 10) - 1;
    if (idx < 0 || idx >= session.lastSearchResults.length) {
      sendMessage(chatId, 'Geçersiz numara. Tekrar dene.');
      return;
    }
    const unitId = session.lastSearchResults[idx];
    const fetched = getDocument('archiveUnits/' + unitId);
    if (!fetched) {
      sendMessage(chatId, 'Bu iş paketini bulamadım. Tekrar ara veya \'yok\' yaz.');
      session.lastSearchResults = [];
      writeSession(telegramId, session);
      return;
    }
    const data = decodeFields(fetched.fields);
    session.draft.unitId = unitId;
    session.draft.unitSnapshot = {
      sourceIdentifier: data.sourceIdentifier || '',
      contentDescription: data.contentDescription || ''
    };
    session.step = 'awaiting_note';
    session.lastSearchResults = [];
    writeSession(telegramId, session);
    sendMessage(chatId,
      'Tamam, ' + (data.sourceIdentifier || 'iş paketi') + ' üzerinde çalışıyoruz.\n\n' +
      'Ne yaptın? Birkaç cümle yaz.');
    return;
  }
  // Search by free text.
  const results = searchArchiveUnits(session.draft.projectId, text);
  if (!results.length) {
    session.lastSearchResults = [];
    writeSession(telegramId, session);
    sendMessage(chatId, 'Bulamadım. Farklı kelime dene veya \'yok\' yaz.');
    return;
  }
  if (results.length === 1) {
    const unit = results[0];
    session.draft.unitId = unit.id;
    session.draft.unitSnapshot = {
      sourceIdentifier: unit.sourceIdentifier,
      contentDescription: unit.contentDescription
    };
    session.step = 'awaiting_note';
    session.lastSearchResults = [];
    writeSession(telegramId, session);
    sendMessage(chatId,
      'Tamam, ' + unit.sourceIdentifier + ' üzerinde çalışıyoruz.\n\n' +
      'Ne yaptın? Birkaç cümle yaz.');
    return;
  }
  session.lastSearchResults = results.map(function (r) { return r.id; });
  writeSession(telegramId, session);
  const lines = ['Şu seçenekleri buldum:', ''];
  results.forEach(function (r, i) {
    const desc = (r.contentDescription || '').slice(0, 40);
    lines.push((i + 1) + '. ' + r.sourceIdentifier + (desc ? ' — ' + desc : ''));
  });
  lines.push('');
  lines.push('Hangisi? (numara yaz, ya da farklı kelime ile ara)');
  sendMessage(chatId, lines.join('\n'));
}

function handleAwaitingNote_(text, telegramId, chatId, session) {
  if (text.length < 3) {
    sendMessage(chatId, 'Çok kısa. Birkaç cümle yaz (en az 3 karakter).');
    return;
  }
  if (text.length > 500) {
    sendMessage(chatId, 'Çok uzun. 500 karakteri geçmesin. Lütfen kısalt ve tekrar yaz.');
    return;
  }
  session.draft.note = text;
  session.step = 'awaiting_status';
  writeSession(telegramId, session);
  sendMessage(chatId,
    'Durum?\n\n' +
    '1. Devam ediyor\n' +
    '2. Tamamlandı');
}

function handleAwaitingStatus_(text, telegramId, chatId, session) {
  if (text === '1') {
    session.draft.status = 'in_progress';
  } else if (text === '2') {
    session.draft.status = 'done';
  } else {
    sendMessage(chatId, 'Lütfen 1 veya 2 yaz.');
    return;
  }
  session.step = 'awaiting_link';
  writeSession(telegramId, session);
  sendMessage(chatId, 'Link var mı? (Drive vs.) Varsa yapıştır, yoksa \'yok\' yaz.');
}

function handleAwaitingLink_(text, telegramId, chatId, session, linkedUser) {
  if (text.toLowerCase() === 'yok') {
    session.draft.url = null;
  } else if (/^https?:\/\//i.test(text)) {
    session.draft.url = text;
  } else {
    sendMessage(chatId, 'Geçerli bir link değil. URL yapıştır veya \'yok\' yaz.');
    return;
  }
  // Persist before commit so a partial failure can be resumed (edge: a
  // commitReport throw before resetSession leaves the session here, but
  // /iptal cleans up).
  writeSession(telegramId, session);
  commitReport(session.draft, linkedUser, telegramId, chatId);
}

// ---- Report commit -----------------------------------------------------
//
// Schema parity: every required + conditional field documented in the spec
// is written here. The web side writes additional legacy fields (taskId,
// summary, hours, pagesDone, workStatus, links, images, coworkerUids,
// reportStatus, reviewerUid, feedback, archiveUnitId, reportDate,
// projectName, updatedAt) — we mirror those too so the schema-parity
// diagnostic in the Bakım tab finds zero discrepancies.

function commitReport(draft, linkedUser, telegramId, chatId) {
  const reportType = computeReportType_(draft);
  const noteSliced = String(draft.note || '');
  const notePreview = noteSliced.slice(0, 80);
  const projectId = draft.projectId || null;
  const unitSnapshot = draft.unitSnapshot
    ? {
        sourceIdentifier: draft.unitSnapshot.sourceIdentifier || '',
        contentDescription: draft.unitSnapshot.contentDescription || ''
      }
    : null;
  const status = draft.status || 'in_progress';
  const url = draft.url || null;

  const reportDoc = {
    // Canonical Prompt-K fields (also written by web submitInlineRapor).
    reportType: reportType,
    projectId: projectId,
    projectName: projectId ? projectDisplayName_(projectId) : null,
    unitId: draft.unitId || null,
    unitSnapshot: unitSnapshot,
    note: noteSliced,
    effort: 'medium',
    status: status,
    url: url,
    volunteerId: linkedUser.uid,
    volunteerName: linkedUser.fullName || linkedUser.email || '',
    // Legacy duplicates kept for back-compat (queries, renderers, rules):
    userUid: linkedUser.uid,
    userEmail: linkedUser.email || '',
    archiveUnitId: draft.unitId || '',
    taskId: (unitSnapshot && unitSnapshot.sourceIdentifier) || '',
    summary: noteSliced,
    hours: 0,
    pagesDone: null,
    workStatus: status === 'done' ? 'unit_done' : 'in_progress',
    // The existing `source` field already encodes the WEB FLOW variant
    // (report_first / quick / detailed / system / coordinator_logged). To avoid
    // clobbering its semantics, the bot adds its own `channel: "telegram"`
    // field and writes `source: "telegram"` only as a tagging hint for the
    // drill-modal renderer. See Prompt R deliverables for the full rationale.
    source: 'telegram',
    channel: 'telegram',
    reportDate: todayIstanbulIsoDate_(),
    links: url ? [url] : [],
    images: [],
    coworkerUids: [],
    reportStatus: 'submitted',
    reviewerUid: null,
    feedback: [],
    createdAt: fsServerTimestamp(),
    updatedAt: fsServerTimestamp()
  };

  const reportId = createDocument('reports', reportDoc);

  // Stamp the volunteer's lastReportAt so the inactivity sweep + admin
  // dashboards see the activity even if the bot is the only channel they use.
  try {
    updateDocument('users/' + linkedUser.uid, {
      lastReportAt: fsServerTimestamp(),
      lastSeenAt: fsServerTimestamp(),
      updatedAt: fsServerTimestamp()
    });
  } catch (err) {
    console.warn('users lastReportAt update failed: ' + err.message);
  }

  // Unit denormalization mirrors the reportFirstUnitUpdate set in
  // firestore.rules. Service-account writes bypass rules but we still match
  // the field names so there is no schema divergence.
  if (reportType === 'unit' && draft.unitId) {
    try {
      updateDocument('archiveUnits/' + draft.unitId, {
        status: status,
        lastActivityAt: fsServerTimestamp(),
        lastReporterId: linkedUser.uid,
        lastReporterName: linkedUser.fullName || '',
        lastReportNotePreview: notePreview,
        latestReportAt: fsServerTimestamp(),
        updatedAt: fsServerTimestamp()
      });
    } catch (err) {
      console.warn('archiveUnits denorm failed: ' + err.message);
    }
  }

  // Public ticker (privacy-safe). foundation_general reports never publish.
  if (reportType === 'unit' || reportType === 'project_general') {
    try {
      const materialCategory = reportType === 'unit'
        ? deriveMaterialCategory(unitSnapshot)
        : 'genel';
      createDocument('publicTicker', {
        createdAt: fsServerTimestamp(),
        effort: 'medium',
        materialCategory: materialCategory || 'belgeler',
        projectId: projectId || 'pnb',
        volunteerToken: computeVolunteerToken(linkedUser.uid)
      });
    } catch (err) {
      console.warn('publicTicker write failed: ' + err.message);
    }
  }

  // Activity log so the report shows up in coordinator-side feeds and so the
  // schema-parity diagnostic can correlate channel activity with reports.
  try {
    createDocument('activityLogs', {
      actorUid: linkedUser.uid,
      actorEmail: linkedUser.email || '',
      action: 'report_submitted_via_telegram',
      targetType: 'report',
      targetId: reportId,
      metadata: {
        reportType: reportType,
        projectId: projectId,
        unitId: draft.unitId || '',
        status: status
      },
      createdAt: fsServerTimestamp()
    });
  } catch (err) {
    console.warn('activityLogs write failed: ' + err.message);
  }

  resetSession(telegramId);
  sendMessage(chatId, buildReportSummary_(reportDoc, draft));
}

function computeReportType_(draft) {
  if (draft.unitId) return 'unit';
  if (draft.projectId) return 'project_general';
  return 'foundation_general';
}

function projectDisplayName_(projectId) {
  if (projectId === 'pnb') return 'Pertev Naili Boratav Arşivi';
  return projectId || '';
}

function todayIstanbulIsoDate_() {
  const fmt = Utilities.formatDate(new Date(), 'Europe/Istanbul', 'yyyy-MM-dd');
  return fmt;
}

function buildReportSummary_(reportDoc, draft) {
  const projectLabel = draft.projectId === 'pnb' ? 'PNB' : 'Genel vakıf çalışması';
  const unitLabel = (draft.unitSnapshot && draft.unitSnapshot.sourceIdentifier)
    ? draft.unitSnapshot.sourceIdentifier
    : projectLabel;
  const statusLabel = reportDoc.status === 'done' ? 'Tamamlandı' : 'Devam ediyor';
  const noteShort = (draft.note || '').length > 80
    ? draft.note.substring(0, 80) + '...'
    : (draft.note || '');
  return 'Rapor kaydedildi. Teşekkürler!\n\n' +
    'Özet:\n' +
    unitLabel + '\n' +
    '"' + noteShort + '"\n' +
    'Durum: ' + statusLabel + '\n\n' +
    'Tekrar yazmak için /rapor';
}

// ---- Helpers shared with /son ------------------------------------------

function shortSummaryFor_(report) {
  const sid = report.unitSnapshot && report.unitSnapshot.sourceIdentifier;
  const head = sid || (report.projectId ? 'Genel proje' : 'Genel vakıf');
  const note = (report.note || report.summary || '').slice(0, 50);
  return note ? head + ' — ' + note : head;
}

function relativeAgo_(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return mins + ' dk önce';
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + ' saat önce';
  const days = Math.round(hours / 24);
  if (days < 7) return days + ' gün önce';
  const weeks = Math.round(days / 7);
  return weeks + ' hafta önce';
}
