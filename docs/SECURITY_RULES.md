# Firestore güvenlik mantığı

Bu projede güvenlik sadece arayüzdeki buton gizleme ile sağlanmaz. Asıl koruma Firestore security rules içindedir.

## Temel kurallar

- Giriş yapmayan kullanıcı korumalı verilere erişemez.
- `pending` kullanıcı operasyonel verilere erişemez.
- `blocked` kullanıcı uygulamayı kullanamaz.
- Gönüllü sadece kendi profilini, kendi görevlerini ve kendi raporlarını görür.
- Koordinatör sadece kendi departmanındaki kullanıcı/görev/raporları yönetir.
- Admin her şeyi yönetebilir.

## Dikkat

İlk admin kaydı manuel olarak atanmalıdır. Aksi halde sistemde yönetici oluşmaz.
