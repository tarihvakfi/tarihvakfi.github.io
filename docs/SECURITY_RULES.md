# Firestore Güvenlik Mantığı

Bu projede güvenlik sadece arayüzdeki buton gizleme ile sağlanmaz. Asıl koruma `firebase/firestore.rules` dosyasındadır.

## Temel kurallar

- Giriş yapmayan kullanıcı korumalı verilere erişemez.
- `pending` kullanıcı operasyonel verilere erişemez.
- `blocked` kullanıcı uygulamayı kullanamaz.
- Gönüllü kendi profilini, kendi görevlerini, kendi raporlarını, genel proje başlıklarını ve PNB arşiv birimlerini görür. Rapor-öncelikli akıştaki typeahead'in çalışabilmesi için `archiveUnits` okuma yetkisi onaylı tüm kullanıcılara açıktır; yazma yetkisi hâlâ ayrı kapılarla korunur.
- Gönüllü atanmış PNB biriminde yalnızca engel bildirme ve son rapor zamanını güncelleme gibi sınırlı alanları değiştirebilir. Rapor-öncelikli akışta ise `reportFirstUnitUpdate()` kuralı, gönüllünün rapor gönderimi sırasında `status`, `lastActivityAt`, `lastReporterId`, `lastReporterName`, `lastReportNotePreview`, `digitized`, `latestReportAt` ve `updatedAt` dışındaki alanlara dokunamayacağını garanti eder; `lastReporterId` mutlaka çağıranın uid'i olmalıdır.
- Gönüllü "liste dışı / yeni iş" yoluyla yalnızca `status == "pending_review"` ve `createdByVolunteerId == auth.uid` olan yeni bir `archiveUnits` dokümanı yaratabilir. Diğer tüm `archiveUnits` create yolları koordinatör/admin'e ayrılmıştır.
- Gönüllü kendi `users/{uid}` dokümanında yalnızca `userSelfEditableFields()` listesindeki alanları (ad, telefon, notlar, skills, `lastSeenAt`, `lastReportAt`, `reportCount7d`, `reportCount30d`, `counterWindowStart`, `updatedAt`) değiştirebilir. `role`, `status`, `department`, `email` gibi yetki/kimlik alanları yalnızca admin veya koordinatör tarafından değiştirilebilir. Bu sınır, rapor gönderirken aynı batch içinde aktivite sayaçlarının güvenle güncellenmesine izin verir ama rol yükseltmesine kapalıdır.
- Koordinatör ve admin proje kayıtlarını, PNB arşiv birimlerini, uygunluk kayıtlarını, iletişim planını ve rapor incelemelerini yönetebilir.
- Koordinatör ve admin tüm `users` dokümanlarını okuyabilir (departman sınırı yoktur — uzmanlık eşleştirmesi departmanlar arası çalışır). Koordinatör yalnızca kendi departmanındaki kullanıcılarda yazma yapabilir ve `specialty` / `availabilityDays` alanlarına dokunamaz; bu iki alan admin'e ayrılmıştır, gönüllüler değişikliği koordinatöre talep eder.
- Paydaş/iletişim verisi içeren `projectPeople` ve `availability` koleksiyonları gönüllülere kapalıdır.
- Admin her şeyi yönetebilir ve PNB importunu çalıştırabilir.

## PNB gizlilik modeli

Gönüllüler ekipteki herkesin telefon/e-posta/uygunluk bilgisini görmez. PNB sekmesinde sadece kendi atandıkları iş paketlerini ve genel duyuruları görürler. Koordinatör ve admin rolleri operasyonel planlama için tam PNB görünümüne sahiptir.

## Manuel kurulum notu

İlk admin kaydı Firebase Console üzerinden manuel atanmalıdır. Aksi halde sistemde yönetici oluşmaz ve import ekranı kullanılamaz.
