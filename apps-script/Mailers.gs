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
    <p>Artık sistemde görevlerinizi ve duyuruları görüntüleyebilirsiniz.</p>
  `;
  enqueueMail('approved', email, subject, body, {});
}

function sendTaskAssignedMail(email, taskTitle, dueDate) {
  const subject = 'Yeni görev atandı';
  const body = `
    <p>Size yeni bir görev atandı:</p>
    <p><strong>${taskTitle}</strong></p>
    <p>Son tarih: ${dueDate || '-'}</p>
  `;
  enqueueMail('task_assigned', email, subject, body, {});
}

function sendInactivityReminder(email, fullName, inactiveDays) {
  const subject = 'Tarih Vakfı gönüllü takibi: kısa hatırlatma';
  const body = `
    <p>Merhaba ${fullName || ''},</p>
    <p>Son raporunun üzerinden yaklaşık ${inactiveDays} gün geçmiş.</p>
    <p>Müsait olduğunda kısa bir rapor yazabilir veya bir engel varsa bize iletebilir misin?</p>
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

// checkInactiveVolunteers: günlük tetikleyici için iskelet.
// Çalışması için Firestore'a erişim gerekir (service account + REST API).
// Kurulum adımları için docs/APPS_SCRIPT_SETUP.md bölümüne bakın.
// TODO: FirestoreClient.gs altında listUsers() yardımcı fonksiyonu oluşturun.
function checkInactiveVolunteers() {
  // Aşağıdaki kod yorum satırı; gerçek kullanımda FirestoreClient.gs hazır olduğunda aktifleştirilir.
  // const users = FirestoreClient_listApprovedVolunteers();
  // const now = Date.now();
  // users.forEach(function (u) {
  //   const last = u.lastReportAt ? new Date(u.lastReportAt).getTime() : null;
  //   const days = last ? Math.floor((now - last) / 86400000) : null;
  //   if (days === null || days >= 28) {
  //     const coord = FirestoreClient_findCoordinatorForDept(u.department);
  //     if (coord && coord.email) sendCoordinatorStalledAlert(coord.email, u.fullName, u.email, days || 0);
  //   } else if (days >= 14) {
  //     sendInactivityReminder(u.email, u.fullName, days);
  //   }
  // });
  appendLog('inactivity_check_stub', { note: 'checkInactiveVolunteers henüz Firestore erişimine bağlı değil; admin panelindeki Aktiflik durumu ekranını kullanın.' }, '');
}
