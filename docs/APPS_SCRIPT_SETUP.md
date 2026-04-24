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

## Gönüllü aktiflik hatırlatması (otomatik)

`apps-script/FirestoreClient.gs` + `Mailers.gs` → `checkInactiveVolunteers()` günde bir çalışarak Firestore'daki gönüllüleri tarar, hatırlatma e-postalarını `MailQueue` sekmesine yazar, durmuş gönüllüler için bölüm koordinatörlerine ayrı bir uyarı kuyruklar.

Sınıflandırma mantığı (`users.rhythm` alanına bağlıdır):

| rhythm | Hatırlatma (gönüllüye) | Durmuş (koordinatöre) |
|--------|------------------------|------------------------|
| `regular` veya boş | 14–27 gün | 28+ gün |
| `burst` | 30–44 gün | 45+ gün |
| `casual` | — (hiç otomatik bildirim gönderilmez) | — |

Aynı gönüllü için son 7 gün içinde kuyruklanmış bir bildirim varsa tekrar bildirim oluşturulmaz (dedupe, `Logs` sekmesinden okunur).

Admin panelindeki `Yönetim > Aktiflik durumu` ekranı manuel takibi desteklemeye devam eder; otomatik akış onun yerini almaz.

## Firestore erişimi için service account kurulumu

`checkInactiveVolunteers()`'ın çalışabilmesi için Apps Script'in Firestore'u REST API üzerinden okuyabilmesi gerekir. Aşağıdaki adımlar sadece bir kez yapılır.

### 1. Google Cloud Console'da service account oluşturma

1. Firebase projenizin bağlı olduğu Google Cloud projesini açın: <https://console.cloud.google.com/>.
2. Sol menüden `IAM & Admin > Service Accounts` seçin.
3. `Create service account`:
   - Ad: `tarihvakfi-apps-script` (veya benzeri)
   - Açıklama: `Apps Script inactivity sweep, Firestore read-only`
4. `Grant this service account access to project` adımında role olarak `Cloud Datastore User` verin. Bu rol Firestore okuma/yazma yetkisi verir; yalnız okuma yetkisi yeterlidir ama ayrı bir "viewer" rolü yoksa Datastore User pratik seçimdir.
5. Oluşturmayı tamamlayın. Ardından hesap listesinden yeni hesaba tıklayın → `Keys > Add key > Create new key > JSON`. İnen JSON dosyasını güvenli bir yere kaydedin; **repoya commitlemeyin**.

### 2. Apps Script tarafına bağlama

1. Apps Script projesinde `Project Settings > Script properties` sekmesini açın.
2. `Add script property` ile bir özellik ekleyin:
   - Property: `FIREBASE_SERVICE_ACCOUNT`
   - Value: JSON dosyasının **tüm içeriğini** tek satır olarak yapıştırın (Apps Script JSON'u aynen parse eder; yeni satırlar sorun çıkarmaz ama tek satır daha güvenli).
3. Kaydedin. Bu alan hiçbir zaman repoya girmemelidir.

### 3. OAuth izinleri

`FirestoreClient.gs` içindeki `UrlFetchApp.fetch` çağrıları ilk çalıştırmada Apps Script'in kendi OAuth onay penceresini açar. Onaylanması gereken scope'lar:

- `https://www.googleapis.com/auth/script.external_request` — `UrlFetchApp` için (dışarıya HTTP isteği)
- `https://www.googleapis.com/auth/spreadsheets` — `Logs` / `MailQueue` sekmeleri için
- `https://www.googleapis.com/auth/script.send_mail` veya `.../auth/gmail.send` — `MailApp.sendEmail` için

`https://www.googleapis.com/auth/datastore` scope'u service account'ın kendi token'ı için geçerlidir; Apps Script'in kendi kullanıcı izinlerinde görünmez — JWT değişimiyle ayrıca alınır.

### 4. Test adımları

1. Apps Script editöründe `checkInactiveVolunteers` fonksiyonunu seçip `Run` basın.
2. İlk çalıştırmada OAuth onay ekranı gelir; yukarıdaki scope'ları onaylayın.
3. `Executions` panelinden logları inceleyin. Hata olmadıysa:
   - `MailQueue` sekmesinde yeni `inactivity_reminder_volunteer` ve/veya `inactivity_alert_coordinator` satırları görünmelidir (uygun gönüllü varsa).
   - `Logs` sekmesinde `inactivity_check_done` satırı eklenmiş olmalıdır.
4. Service account henüz bağlı değilse `inactivity_check_skipped` log satırı görünür — bu defensive davranıştır, crash beklemeyin.
5. Dedupe'u test etmek için fonksiyonu arka arkaya iki kez çalıştırın; ikincide kuyruk boyutu artmamalıdır.

### 5. Günlük tetikleyici

`createTriggers()` fonksiyonunu bir kez manuel çalıştırdığınızda günlük `checkInactiveVolunteers` tetikleyicisi otomatik kurulur (`Triggers.gs` içinde `everyDays: 1` kayıtlıdır).

### Güvenlik notları

- Service account JSON'u yalnızca `PropertiesService.getScriptProperties()` altında tutulur; `.gs` dosyalarına veya repoya asla yazılmaz.
- Service account'a yalnızca gerekli en az yetki verilir. Gerekirse Firestore rules üzerinden ek kısıtlama yapılabilir (ör. `allow read: if request.auth == null` yok; service account token'ı Firestore kurallarını **bypass eder** — bu davranışı bilerek kullanın).
- JSON anahtarı sızarsa: Cloud Console'dan anahtarı `Disable` edip yenisini üretin, ardından Script property'sini güncelleyin.
