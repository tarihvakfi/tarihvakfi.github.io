# SETUP

## 1. Repo hazırlığı

- Bu repoyu GitHub'a yükleyin.
- GitHub Pages'i `main` branch / root dizin üzerinden açın.

## 2. Firebase projesi

1. Firebase Console'da yeni proje açın.
2. Authentication > Sign-in method > Google sağlayıcısını etkinleştirin.
3. Authorized domains listesine şu alanları ekleyin:
   - `tarihvakfi.github.io`
   - yerel test için `localhost`

## 3. Firestore

1. Cloud Firestore oluşturun.
2. `users`, `tasks`, `reports`, `announcements`, `activityLogs` koleksiyonları için veri modelini kullanın.
3. `firebase/firestore.rules` içeriğini yayınlayın.

## 4. İstemci yapılandırması

1. `js/config.firebase.example.js` dosyasını `js/config.firebase.js` olarak kopyalayın.
2. Firebase proje ayarlarındaki web app config alanını bu dosyaya ekleyin.

## 5. Apps Script

1. Google Sheet oluşturun.
2. `apps-script/` altındaki dosyaları Apps Script projesine kopyalayın.
3. Gerekli sheet sekmelerini oluşturun.
4. `createTriggers()` fonksiyonunu çalıştırın.

## 6. İlk yönetici

İlk admin kullanıcı oluşturmak için:

1. Google ile giriş yapın.
2. Firestore `users/{uid}` dokümanınız oluşsun.
3. Firebase Console veya Firestore UI üzerinden ilgili kaydın:
   - `role` alanını `admin`
   - `status` alanını `approved`
   yapın.

## 7. Test

- Başvuru oluşturun
- Gönüllü paneline girin
- Yönetici olarak onay verin
- Görev oluşturun
- Rapor gönderin
