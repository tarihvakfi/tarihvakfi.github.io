function processMailQueue() {
  const sheet = getSheet(SHEET_NAMES.mailQueue);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  for (let i = 1; i < values.length; i++) {
    const [createdAt, type, recipient, subject, body, status] = values[i];
    if (status !== 'queued') continue;

    try {
      MailApp.sendEmail({
        to: recipient,
        subject: subject,
        htmlBody: body
      });
      sheet.getRange(i + 1, 6).setValue('sent');
      appendLog('mail_sent', { type, recipient, subject }, recipient);
    } catch (error) {
      sheet.getRange(i + 1, 6).setValue('error');
      appendLog('mail_error', { type, recipient, subject, error: String(error) }, recipient);
    }
  }
}

function sendApplicationReceivedMail(email, fullName) {
  const subject = 'Başvurunuz alındı';
  const body = `
    <p>Merhaba ${fullName || ''},</p>
    <p>Tarih Vakfı gönüllü başvurunuz sisteme alınmıştır.</p>
    <p>Başvurunuz incelendikten sonra size dönüş yapılacaktır.</p>
  `;
  enqueueMail('application_received', email, subject, body, {});
}

function sendApprovalMail(email, fullName) {
  const subject = 'Başvurunuz onaylandı';
  const body = `
    <p>Merhaba ${fullName || ''},</p>
    <p>Tarih Vakfı gönüllü başvurunuz onaylandı.</p>
    <p>Artık panele girerek arşiv iş paketlerini görebilir, üzerinde çalışmak istediğin paketi kendin seçip "Rapor Yaz" akışını kullanabilirsin. Beklenecek bir atama yok.</p>
  `;
  enqueueMail('approved', email, subject, body, {});
}

// Used for genuinely assigned non-archive tasks (review, translate, etc.).
// Archive iş paketleri için bu maile düşmüyoruz; oradaki akış report-first.
function sendTaskAssignedMail(email, taskTitle, dueDate) {
  const subject = 'Yeni iş: ' + (taskTitle || 'Tarih Vakfı');
  const body = `
    <p>Sana özel olarak iletilen bir iş var:</p>
    <p><strong>${taskTitle}</strong></p>
    <p>Son tarih: ${dueDate || '-'}</p>
    <p>Çalıştıktan sonra panelden kısa bir rapor bırakman yeterli.</p>
  `;
  enqueueMail('task_assigned', email, subject, body, {});
}

function sendInactivityReminder(email, fullName, inactiveDays) {
  const subject = 'Tarih Vakfı: ufak bir hatırlatma';
  const body = `
    <p>Merhaba ${fullName || ''},</p>
    <p>Son raporundan bu yana yaklaşık ${inactiveDays} gün geçti.</p>
    <p>Müsait olduğunda panele girip ufak bir iş paketi seçip rapor vermeye ne dersin? Hangi pakette çalışacağına sen karar veriyorsun, beklenecek bir atama yok. Bir engel varsa onu da bildirebilirsin.</p>
    <p>Teşekkürler,<br>Tarih Vakfı koordinasyon</p>
  `;
  enqueueMail('inactivity_reminder_volunteer', email, subject, body, { inactiveDays });
}

function sendCoordinatorStalledAlert(coordinatorEmail, volunteerName, volunteerEmail, inactiveDays) {
  const subject = 'Durmuş gönüllü: koordinatör aksiyonu';
  const body = `
    <p>Merhaba,</p>
    <p><strong>${volunteerName || volunteerEmail}</strong> yaklaşık ${inactiveDays} gündür rapor yazmamış.</p>
    <p>Kişiye ulaşarak engel olup olmadığını öğrenmenizi rica ederiz. İletişim: ${volunteerEmail}</p>
  `;
  enqueueMail('inactivity_alert_coordinator', coordinatorEmail, subject, body, { volunteerName, volunteerEmail, inactiveDays });
}

// Daily inactivity sweep. Reads the users collection via FirestoreClient.gs,
// enqueues reminder emails, and alerts coordinators for stalled volunteers.
// Thresholds are rhythm-aware; casual helpers are never auto-flagged.
// See docs/APPS_SCRIPT_SETUP.md for service account setup.

const INACTIVITY_NUDGE_ACTIONS_ = ['inactivity_nudge_volunteer', 'inactivity_nudge_coordinator'];

function wasRecentlyNudged_(volunteerEmail, withinDays) {
  if (!volunteerEmail) return false;
  const sheet = getSheet(SHEET_NAMES.logs);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;
  const cutoff = Date.now() - withinDays * 86400000;
  const target = String(volunteerEmail).toLowerCase();
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (INACTIVITY_NUDGE_ACTIONS_.indexOf(row[2]) === -1) continue;
    const ts = row[0];
    const t = (ts instanceof Date) ? ts.getTime() : new Date(ts).getTime();
    if (isNaN(t) || t < cutoff) continue;
    if (String(row[1]).toLowerCase() === target) return true;
  }
  return false;
}

function checkInactiveVolunteers() {
  const hasCreds = PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT');
  if (!hasCreds) {
    appendLog('inactivity_check_skipped', { reason: 'FIREBASE_SERVICE_ACCOUNT missing' }, '');
    return;
  }

  let volunteers;
  try {
    volunteers = listApprovedVolunteers();
  } catch (err) {
    appendLog('inactivity_check_error', { stage: 'listApprovedVolunteers', error: String(err) }, '');
    return;
  }

  const now = Date.now();
  const dedupeWindowDays = 7;
  const coordinatorCache = {};
  let reminded = 0;
  let stalled = 0;

  volunteers.forEach(function (u) {
    if (!u.email) return;
    if (u.rhythm === 'casual') return;

    // Use the latest reports.workDate (the calendar date the volunteer says
    // they did the work) rather than the original users.lastReportAt
    // (submission timestamp). A volunteer who batches three weeks of past
    // work into one session shouldn't get nudged about being silent — the
    // work happened, just got logged late. publicTicker still uses createdAt
    // because it's about flow of submissions, not historical work.
    var latestWorkDate;
    try {
      latestWorkDate = getLatestWorkDateForVolunteer(u.uid);
    } catch (err) {
      appendLog('inactivity_check_error', { stage: 'getLatestWorkDateForVolunteer', uid: u.uid, error: String(err) }, u.email);
      return;
    }
    // Backwards compatibility: pre-Prompt-W reports don't have workDate, so a
    // volunteer with only legacy reports falls back to lastReportAt. Without
    // either signal, skip — there's nothing to compare against.
    var lastSourceMs;
    if (latestWorkDate) {
      // Parse YYYY-MM-DD as local midnight; fine here since we only care
      // about day-granularity for the inactivity threshold.
      lastSourceMs = new Date(latestWorkDate + 'T00:00:00').getTime();
    } else if (u.lastReportAt) {
      lastSourceMs = new Date(u.lastReportAt).getTime();
    } else {
      return;
    }
    if (isNaN(lastSourceMs)) return;
    const days = Math.floor((now - lastSourceMs) / 86400000);

    const isBurst = u.rhythm === 'burst';
    const reminderMin = isBurst ? 30 : 14;
    const stalledMin = isBurst ? 45 : 28;

    if (days < reminderMin) return;
    if (wasRecentlyNudged_(u.email, dedupeWindowDays)) return;

    if (days >= stalledMin) {
      const dept = u.department || '';
      if (!(dept in coordinatorCache)) {
        try {
          coordinatorCache[dept] = findCoordinatorsForDepartment(dept);
        } catch (err) {
          appendLog('inactivity_check_error', { stage: 'findCoordinatorsForDepartment', department: dept, error: String(err) }, u.email);
          coordinatorCache[dept] = [];
        }
      }
      const coords = coordinatorCache[dept].filter(function (c) { return c.email; });
      if (!coords.length) {
        appendLog('inactivity_no_coordinator', { department: dept, inactiveDays: days }, u.email);
        return;
      }
      coords.forEach(function (c) {
        sendCoordinatorStalledAlert(c.email, u.fullName, u.email, days);
      });
      appendLog('inactivity_nudge_coordinator', {
        department: dept,
        inactiveDays: days,
        coordinators: coords.map(function (c) { return c.email; })
      }, u.email);
      stalled++;
    } else {
      sendInactivityReminder(u.email, u.fullName, days);
      appendLog('inactivity_nudge_volunteer', { inactiveDays: days, rhythm: u.rhythm || null }, u.email);
      reminded++;
    }
  });

  appendLog('inactivity_check_done', {
    totalVolunteers: volunteers.length,
    remindersQueued: reminded,
    coordinatorAlertsQueued: stalled
  }, '');
}
