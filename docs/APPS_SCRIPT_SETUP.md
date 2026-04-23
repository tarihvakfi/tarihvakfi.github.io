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

## Gönüllü aktiflik hatırlatması (14 gün / 28 gün)

Kısa vadeli çözüm — hiç otomasyon gerekmez:
- Admin panelindeki `Yönetim > Aktiflik durumu` ekranı "Yavaşlayan (14–27 gün)" ve "Durmuş (28+ gün)" olarak gönüllüleri listeler.
- "Hatırlatma gönder" butonu koordinatörün e-posta istemcisini önceden doldurur; koordinatör kişiselleştirip gönderir.
- "CSV olarak dışa aktar" butonu haftalık takibi e-tabloda yapmayı kolaylaştırır.

Uzun vadeli (tam otomasyon) için Apps Script'e Firestore okuma yeteneği eklenmelidir:
1. Google Cloud Console'da Firestore erişimli bir service account oluşturun ve JSON anahtarını Apps Script'te `PropertiesService.getScriptProperties()` ile saklayın.
2. `apps-script/FirestoreClient.gs` altında bir yardımcı dosya oluşturup service account JWT + Firestore REST API ile `users` koleksiyonunu okuyun.
3. Yeni bir fonksiyon `checkInactiveVolunteers()`:
   - `users` koleksiyonunda `role == "volunteer"` ve `status == "approved"` olan kayıtları dolaşır.
   - `lastReportAt` boşsa veya 14–27 gün öncesindeyse gönüllüye `sendInactivityReminder(...)` ile e-posta kuyruklar.
   - `lastReportAt` 28 günden eskiyse koordinatöre uyarı gönderen ayrı bir şablon (`sendCoordinatorStalledAlert(...)`) çağrılır.
4. `Triggers.gs` içindeki `createTriggers()` fonksiyonuna günlük bir tetikleyici ekleyin: `{ name: 'checkInactiveVolunteers', everyDays: 1 }`.
5. İlk çalıştırmada gerekli OAuth izinleri (`https://www.googleapis.com/auth/datastore`) onaylanmalıdır.

Güvenlik notu: Service account key'ini asla repoya commitlemeyin. Apps Script `PropertiesService` bu iş için uygundur.
