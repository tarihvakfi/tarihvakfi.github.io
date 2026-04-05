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
  const subject = 'Gönüllü hesabınız için hatırlatma';
  const body = `
    <p>Merhaba ${fullName || ''},</p>
    <p>Son ${inactiveDays} gündür sistemde bir etkinlik görünmüyor.</p>
    <p>Müsaitseniz güncel durumunuzu ve katkınızı sisteme girmenizi rica ederiz.</p>
  `;
  enqueueMail('inactivity', email, subject, body, { inactiveDays });
}
