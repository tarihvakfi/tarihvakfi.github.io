# Apps Script kurulumu

## Gerekli Google Sheet sekmeleri

### MailQueue
Kolonlar:
- createdAt
- type
- recipient
- subject
- body
- status
- metadata

### Logs
Kolonlar:
- timestamp
- email
- action
- detail

### WeeklySummary
Script bu sekmeyi haftalık özet için doldurur.

## Kurulum adımları

1. Google Sheet açın.
2. `Extensions > Apps Script` ile script projesi oluşturun.
3. `apps-script/` klasöründeki dosyaları yapıştırın.
4. `createTriggers()` fonksiyonunu çalıştırın.
5. Gerekli Gmail ve Spreadsheet izinlerini onaylayın.

## Önerilen kullanım

- Başvuru alındığında `sendApplicationReceivedMail`
- Onay verildiğinde `sendApprovalMail`
- Görev atandığında `sendTaskAssignedMail`
- Pasif kullanıcılar için `sendInactivityReminder`
- PNB için haftalık özet hazırlanırken `archiveUnits`, `reports` ve `communicationPlans` verilerinden manuel/yarı otomatik rapor üretimi

Not: Bu repo, Apps Script ile Firestore arasında doğrudan entegrasyon kurmaz. İlk aşamada Apps Script daha çok hafif e-posta otomasyonu ve özetler için tasarlanmıştır.
