# Firestore Güvenlik Mantığı

Bu projede güvenlik sadece arayüzdeki buton gizleme ile sağlanmaz. Asıl koruma `firebase/firestore.rules` dosyasındadır.

## Temel kurallar

- Giriş yapmayan kullanıcı korumalı verilere erişemez.
- `pending` kullanıcı operasyonel verilere erişemez.
- `blocked` kullanıcı uygulamayı kullanamaz.
- Gönüllü kendi profilini, kendi görevlerini, kendi raporlarını, genel proje başlıklarını ve kendisine atanmış PNB arşiv birimlerini görür.
- Gönüllü atanmış PNB biriminde yalnızca engel bildirme ve son rapor zamanını güncelleme gibi sınırlı alanları değiştirebilir.
- Gönüllü kendi `users/{uid}` dokümanında yalnızca `userSelfEditableFields()` listesindeki alanları (ad, telefon, notlar, skills, `lastSeenAt`, `lastReportAt`, `reportCount7d`, `reportCount30d`, `counterWindowStart`, `updatedAt`) değiştirebilir. `role`, `status`, `department`, `email` gibi yetki/kimlik alanları yalnızca admin veya koordinatör tarafından değiştirilebilir. Bu sınır, rapor gönderirken aynı batch içinde aktivite sayaçlarının güvenle güncellenmesine izin verir ama rol yükseltmesine kapalıdır.
- Koordinatör ve admin proje kayıtlarını, PNB arşiv birimlerini, uygunluk kayıtlarını, iletişim planını ve rapor incelemelerini yönetebilir.
- Paydaş/iletişim verisi içeren `projectPeople` ve `availability` koleksiyonları gönüllülere kapalıdır.
- Admin her şeyi yönetebilir ve PNB importunu çalıştırabilir.

## PNB gizlilik modeli

Gönüllüler ekipteki herkesin telefon/e-posta/uygunluk bilgisini görmez. PNB sekmesinde sadece kendi atandıkları iş paketlerini ve genel duyuruları görürler. Koordinatör ve admin rolleri operasyonel planlama için tam PNB görünümüne sahiptir.

## Manuel kurulum notu

İlk admin kaydı Firebase Console üzerinden manuel atanmalıdır. Aksi halde sistemde yönetici oluşmaz ve import ekranı kullanılamaz.
