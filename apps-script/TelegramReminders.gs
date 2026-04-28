/**
 * TelegramReminders.gs — two Friday 17:00 (Europe/Istanbul) triggers:
 *
 *   sendVolunteerWeeklyReminders  — pings volunteers who haven't reported
 *     this week. Best-channel: Telegram if linked, else email queue.
 *   sendManagerWeeklySummary      — sends coordinators/admins a one-message
 *     weekly digest via Telegram.
 *
 * Both are added to the existing createTriggers() registry, with a 5-minute
 * gap between them so we don't bump into Apps Script's 6-minute simultaneous
 * execution quota during a single fire window.
 *
 * The volunteer reminder trigger keeps writing email to the existing
 * MailQueue sheet for unlinked volunteers. Mailers.gs trigger functions
 * (processMailQueue, generateWeeklySummary, checkInactiveVolunteers) are
 * intentionally untouched.
 */

const TG_REMINDER_DEDUP_DAYS_ = 5;

function sendVolunteerWeeklyReminders() {
  if (!hasFirebaseCreds_()) {
    console.warn('FIREBASE_SERVICE_ACCOUNT missing — volunteer reminders skipped.');
    return;
  }
  const now = new Date();
  const monday = mondayOfWeekIstanbul_(now);

  // We can't compose a "rhythm NOT IN [casual, burst]" Firestore query (no
  // NOT_IN composite filter we can index without a fanout). So we list all
  // approved volunteers and filter rhythm in-process.
  const candidates = listDocuments('users', [
    eqFilter_('role', 'volunteer'),
    eqFilter_('status', 'approved')
  ], { limit: 1000 }).filter(function (doc) {
    const r = doc.data.rhythm;
    return r !== 'casual' && r !== 'burst';
  });

  let remindedTelegram = 0;
  let remindedEmail = 0;
  let skipped = 0;

  candidates.forEach(function (doc) {
    const user = mapTelegramUser_(doc);
    try {
      // Skip if they already reported this week.
      const reportsThisWeek = listDocuments('reports', [
        eqFilter_('volunteerId', user.uid),
        fsGte('createdAt', monday)
      ], { limit: 1 });
      if (reportsThisWeek.length > 0) { skipped++; return; }

      // Dedup window: don't send if any reminder went out in last 5 days.
      const dedupCutoff = new Date(Date.now() - TG_REMINDER_DEDUP_DAYS_ * 86400000);
      const recentReminders = listDocuments('activityLogs', [
        inStringsFilter_('action', [
          'weekly_reminder_sent_telegram',
          'weekly_reminder_sent_email'
        ]),
        eqFilter_('actorUid', user.uid),
        fsGte('createdAt', dedupCutoff)
      ], { limit: 1 });
      if (recentReminders.length > 0) { skipped++; return; }

      const messages = buildVolunteerReminderMessage_(user);

      if (user.telegramId && hasTelegramToken()) {
        sendMessage(user.telegramId, messages.telegram);
        logReminderActivity_(user.uid, 'weekly_reminder_sent_telegram');
        remindedTelegram++;
      } else if (user.email) {
        // Use existing Mailers.gs MailQueue path so email batching, retries,
        // and audit logs all stay on the same rails as the rest of the system.
        enqueueMail('weekly_reminder', user.email,
          'Cuma akşamı kısa hatırlatma', messages.email,
          { uid: user.uid });
        logReminderActivity_(user.uid, 'weekly_reminder_sent_email');
        remindedEmail++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error('Reminder failed for ' + user.uid + ': ' + err.message);
      // Continue with the next user — never let one failure stop the batch.
    }
  });

  appendLog('weekly_reminder_sweep', {
    candidates: candidates.length,
    telegramSent: remindedTelegram,
    emailQueued: remindedEmail,
    skipped: skipped
  }, '');
}

function logReminderActivity_(uid, action) {
  try {
    createDocument('activityLogs', {
      actorUid: uid,
      actorEmail: '',
      action: action,
      targetType: 'user',
      targetId: uid,
      metadata: {},
      createdAt: fsServerTimestamp()
    });
  } catch (err) {
    console.warn('activityLogs write failed: ' + err.message);
  }
}

function buildVolunteerReminderMessage_(user) {
  const firstName = (user.fullName || '').split(' ')[0] || 'gönüllü';
  const telegram =
    'Selam ' + firstName + '!\n\n' +
    'Cuma akşamı, kısa bir hatırlatma. Bu hafta henüz rapor yazmadığını gördüm. ' +
    'Bu hafta arşivde bir şeyler yaptıysan birkaç cümleyle yazmaya ne dersin?\n\n' +
    'Doğrudan buradan rapor yazabilirsin: /rapor\n\n' +
    'Veya web sitesinden: ' + TG_DASHBOARD_URL_ + '\n\n' +
    'Yaptığın iş varsa unutma. Yapmadıysan da sorun yok, sıradaki sefere.';
  const email =
    '<p>Selam ' + escapeHtml_(firstName) + ',</p>' +
    '<p>Cuma akşamı, kısa bir hatırlatma. Bu hafta henüz rapor yazmadığını gördüm. ' +
    'Bu hafta arşivde bir şeyler yaptıysan birkaç cümleyle yazmaya ne dersin?</p>' +
    '<p><a href="' + TG_DASHBOARD_URL_ + '">Rapor yazmak için panele git</a></p>' +
    '<p>Yaptığın iş varsa unutma. Yapmadıysan da sorun yok, sıradaki sefere.</p>' +
    '<p>—<br>Tarih Vakfı koordinasyon</p>';
  return { telegram: telegram, email: email };
}

// ---- Manager weekly summary --------------------------------------------

function sendManagerWeeklySummary() {
  if (!hasFirebaseCreds_()) {
    console.warn('FIREBASE_SERVICE_ACCOUNT missing — manager summary skipped.');
    return;
  }
  if (!hasTelegramToken()) {
    console.warn('TELEGRAM_BOT_TOKEN missing — manager summary skipped.');
    return;
  }
  const now = new Date();
  const monday = mondayOfWeekIstanbul_(now);
  const threeWeeksAgo = new Date(now.getTime() - 21 * 86400000);

  const allUsers = listDocuments('users', [], { limit: 5000 });
  const allReports = listDocuments('reports', [
    fsGte('createdAt', monday)
  ], { limit: 5000 });

  // Approved volunteers (excluding casual) for the silent-volunteer count.
  const approvedActive = allUsers.filter(function (d) {
    return d.data.status === 'approved'
      && d.data.role === 'volunteer'
      && d.data.rhythm !== 'casual';
  });
  const silentVolunteers = approvedActive.filter(function (d) {
    const last = d.data.lastReportAt;
    if (!last) return true;
    return new Date(last).getTime() < threeWeeksAgo.getTime();
  }).length;

  const pendingApprovals = allUsers.filter(function (d) { return d.data.status === 'pending'; }).length;
  const newSignupsThisWeek = allUsers.filter(function (d) {
    const created = d.data.createdAt;
    if (!created) return false;
    return new Date(created).getTime() >= monday.getTime();
  }).length;
  const telegramLinkedUsers = allUsers.filter(function (d) {
    return d.data.telegramId && d.data.telegramId.length > 0;
  }).length;

  const blockedUnits = listDocuments('archiveUnits', [
    eqFilter_('status', 'blocked')
  ], { limit: 500 }).length;

  const reportsThisWeek = allReports.length;
  const distinctReporters = countDistinct_(allReports.map(function (r) {
    return r.data.volunteerId || r.data.userUid || '';
  }).filter(Boolean));
  const pnbReports = allReports.filter(function (r) { return r.data.projectId === 'pnb'; });
  const generalReports = allReports.filter(function (r) {
    // foundation_general has projectId === null; project_general has projectId
    // set but reportType project_general. The summary counts only the
    // foundation-level "Genel vakıf" bucket here.
    return r.data.reportType === 'foundation_general';
  });
  // PNB pages: reports don't carry pagesDone for the new flow, so we
  // approximate "pages ilerlendi" by summing pageCount of units that
  // transitioned to done since Monday. Best-effort number.
  const pnbPages = sumPagesOfDoneUnitsSince_(monday);

  const dateRange = formatDateRangeIstanbul_(monday, now);
  const message = buildManagerSummaryMessage_(dateRange, {
    pendingApprovals: pendingApprovals,
    silentVolunteers: silentVolunteers,
    blockedUnits: blockedUnits,
    reportsThisWeek: reportsThisWeek,
    distinctReportersThisWeek: distinctReporters,
    pnbReportsThisWeek: pnbReports.length,
    pnbPagesThisWeek: pnbPages,
    generalReportsThisWeek: generalReports.length,
    newSignupsThisWeek: newSignupsThisWeek,
    activeVolunteersThisWeek: distinctReporters,
    telegramLinkedUsers: telegramLinkedUsers
  });

  // Recipients: admins + coordinators with linked telegramIds.
  const recipients = allUsers.filter(function (d) {
    const role = d.data.role;
    return d.data.status === 'approved'
      && (role === 'admin' || role === 'coordinator')
      && d.data.telegramId && d.data.telegramId.length > 0;
  });

  let sent = 0;
  recipients.forEach(function (d) {
    try {
      sendMessage(d.data.telegramId, message);
      logReminderActivity_(d.id, 'weekly_summary_sent');
      sent++;
    } catch (err) {
      console.error('Summary failed for ' + d.id + ': ' + err.message);
    }
  });
  appendLog('weekly_manager_summary', { recipients: recipients.length, sent: sent }, '');
}

function buildManagerSummaryMessage_(dateRange, m) {
  const allZero = !m.reportsThisWeek && !m.newSignupsThisWeek
    && !m.pendingApprovals && !m.silentVolunteers && !m.blockedUnits;
  if (allZero) {
    return '📊 Bu hafta sakindi: ' + (m.reportsThisWeek || 0) + ' rapor, ' +
      (m.activeVolunteersThisWeek || 0) + ' aktif gönüllü.\n' +
      'Detaylar: ' + TG_DASHBOARD_URL_ + '#bugun';
  }

  const lines = [];
  lines.push('📊 Tarih Vakfı – Haftalık Özet');
  lines.push(dateRange);
  lines.push('');

  const todoLines = [];
  if (m.pendingApprovals > 0) todoLines.push('• ' + m.pendingApprovals + ' yeni gönüllü başvurusu onay bekliyor');
  if (m.silentVolunteers > 0) todoLines.push('• ' + m.silentVolunteers + ' sessiz gönüllü (≥21 gün rapor yok)');
  if (m.blockedUnits > 0) todoLines.push('• ' + m.blockedUnits + ' takılan iş paketi');
  if (todoLines.length) {
    lines.push('✋ Yapılması gerekenler');
    todoLines.forEach(function (l) { lines.push(l); });
    lines.push('');
  }

  lines.push('📝 Bu hafta');
  lines.push('- ' + m.reportsThisWeek + ' rapor yazıldı, ' + m.distinctReportersThisWeek + ' farklı gönüllü');
  if (m.pnbReportsThisWeek > 0) {
    lines.push('• PNB: ' + m.pnbReportsThisWeek + ' rapor, ' + m.pnbPagesThisWeek + ' sayfa ilerlendi');
  }
  if (m.generalReportsThisWeek > 0) {
    lines.push('• Genel vakıf: ' + m.generalReportsThisWeek + ' rapor');
  }
  lines.push('');

  lines.push('👥 Ekip');
  if (m.newSignupsThisWeek > 0) lines.push('• ' + m.newSignupsThisWeek + ' yeni kayıt');
  lines.push('- ' + m.activeVolunteersThisWeek + ' aktif gönüllü (haftalık)');
  lines.push('- ' + m.telegramLinkedUsers + ' bağlı Telegram kullanıcısı');
  lines.push('');
  lines.push('Tüm raporlar: ' + TG_DASHBOARD_URL_ + '#bugun');

  return lines.join('\n');
}

// ---- Trigger registration ---------------------------------------------
//
// All trigger registration moved to Triggers.gs::createTriggers, which is
// now the single source of truth (delete-and-recreate idempotent — wipes
// every existing trigger then rebuilds the canonical set including the
// two Friday handlers below and the new keepWarmPing). The legacy
// installTelegramTriggers shim in Triggers.gs forwards to createTriggers
// so old setup instructions keep working.

// ---- Diagnostic helpers (used by Bakım admin tool too) ----------------

function telegramDiagnosticsCounts() {
  if (!hasFirebaseCreds_()) {
    return { error: 'FIREBASE_SERVICE_ACCOUNT missing.' };
  }
  const linkedUsers = listDocuments('users', [fsNotNull('telegramId')], { limit: 5000 }).length;
  const allSessions = listDocuments('telegramSessions', [], { limit: 5000 });
  const activeSessions = allSessions.filter(function (s) {
    return s.data.step && s.data.step !== 'idle';
  }).length;
  const allCodes = listDocuments('telegramLinkCodes', [], { limit: 1000 });
  const expiredCodes = allCodes.filter(function (c) {
    return c.data.expiresAt && new Date(c.data.expiresAt).getTime() < Date.now();
  }).length;
  return {
    linkedUsers: linkedUsers,
    activeSessions: activeSessions,
    expiredCodes: expiredCodes,
    totalSessions: allSessions.length,
    totalCodes: allCodes.length
  };
}

/**
 * Compares the most recent 10 web reports with the most recent 10 Telegram
 * reports field-by-field. Returns { ok, webMissing, telegramMissing,
 * typeMismatches, sampleSize }. The Bakım admin button calls this and
 * renders the result inline.
 */
function telegramSchemaParityCheck() {
  if (!hasFirebaseCreds_()) {
    return { error: 'FIREBASE_SERVICE_ACCOUNT missing.' };
  }
  const recent = listDocuments('reports', [], {
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit: 200
  });
  const web = [];
  const tg = [];
  recent.forEach(function (r) {
    if (r.data.channel === 'telegram') {
      if (tg.length < 10) tg.push(r.fields);
    } else {
      if (web.length < 10) web.push(r.fields);
    }
  });

  const webKeys = collectKeys_(web);
  const tgKeys = collectKeys_(tg);
  const webMissing = setDiff_(tgKeys, webKeys); // present on tg, missing on web
  const tgMissing = setDiff_(webKeys, tgKeys);  // present on web, missing on tg

  // Type comparison: for keys present in both, compare the Value type tag of
  // the first sample. Catches stringValue vs integerValue style drift.
  const typeMismatches = [];
  const both = setIntersect_(webKeys, tgKeys);
  both.forEach(function (k) {
    const wType = web.length ? typeOfFirstField_(web, k) : null;
    const tType = tg.length ? typeOfFirstField_(tg, k) : null;
    if (wType && tType && wType !== tType) {
      typeMismatches.push({ field: k, web: wType, telegram: tType });
    }
  });

  return {
    ok: webMissing.length === 0 && tgMissing.length === 0 && typeMismatches.length === 0,
    sampleSize: { web: web.length, telegram: tg.length },
    webMissing: webMissing,
    telegramMissing: tgMissing,
    typeMismatches: typeMismatches
  };
}

// ---- Misc helpers ------------------------------------------------------

function hasFirebaseCreds_() {
  return !!PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT');
}

function mondayOfWeekIstanbul_(date) {
  // Apps Script Date math is local-timezone aware via Utilities.formatDate.
  // We compute "Monday 00:00 Istanbul" in two steps: format → parse.
  const dayStr = Utilities.formatDate(date, 'Europe/Istanbul', 'u'); // 1=Mon..7=Sun
  const dayOfWeek = parseInt(dayStr, 10);
  const istanbulYmd = Utilities.formatDate(date, 'Europe/Istanbul', 'yyyy-MM-dd');
  const todayLocal = new Date(istanbulYmd + 'T00:00:00+03:00');
  const offsetDays = dayOfWeek - 1; // back up to Monday
  return new Date(todayLocal.getTime() - offsetDays * 86400000);
}

function formatDateRangeIstanbul_(monday, now) {
  const fromStr = Utilities.formatDate(monday, 'Europe/Istanbul', 'd MMM');
  const toStr = Utilities.formatDate(now, 'Europe/Istanbul', 'd MMM');
  return fromStr + ' – ' + toStr;
}

function countDistinct_(values) {
  const seen = {};
  let n = 0;
  values.forEach(function (v) {
    if (!v) return;
    if (!seen[v]) { seen[v] = true; n++; }
  });
  return n;
}

function sumPagesOfDoneUnitsSince_(monday) {
  // "Done since Monday" = archiveUnits where status==done AND lastActivityAt >= monday.
  // We sum pageCount as a proxy for "pages ilerlendi this week". Best-effort.
  const docs = listDocuments('archiveUnits', [
    eqFilter_('status', 'done'),
    eqFilter_('projectId', 'pnb'),
    fsGte('lastActivityAt', monday)
  ], { limit: 1000 });
  let sum = 0;
  docs.forEach(function (d) {
    const n = Number(d.data.pageCount) || 0;
    sum += n;
  });
  return sum;
}

function escapeHtml_(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function collectKeys_(fieldMaps) {
  const seen = {};
  fieldMaps.forEach(function (fm) {
    Object.keys(fm).forEach(function (k) { seen[k] = true; });
  });
  return Object.keys(seen).sort();
}
function setDiff_(a, b) {
  const bSet = {};
  b.forEach(function (x) { bSet[x] = true; });
  return a.filter(function (x) { return !bSet[x]; });
}
function setIntersect_(a, b) {
  const bSet = {};
  b.forEach(function (x) { bSet[x] = true; });
  return a.filter(function (x) { return bSet[x]; });
}
function typeOfFirstField_(samples, key) {
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i][key];
    if (!v) continue;
    const keys = Object.keys(v);
    if (keys.length) return keys[0]; // stringValue / integerValue / etc.
  }
  return null;
}
