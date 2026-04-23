# Tarih Vakfı Gönüllü Takip Sistemi

Bu repo, Tarih Vakfı için GitHub Pages üzerinde çalışacak ücretsiz gönüllü takip sistemi iskeletini içerir.

## Mimari

- **GitHub Pages** → statik web arayüzü
- **Firebase Authentication** → Google ile giriş
- **Cloud Firestore** → veri tabanı
- **Google Apps Script + Google Sheets** → e-posta otomasyonları ve özetler

## Uygulama alanları

- `/` → kamuya açık ana sayfa
- `/auth/` → giriş ve ilk başvuru akışı
- `/app/` → gönüllü paneli
- `/admin/` → koordinatör / yönetici paneli

## PNB arşiv operasyonları

Sistem bütün gönüllü işleri için tek yönetim ortamıdır. Pertev Naili Boratav çalışması ilk ayrıntılı arşiv vaka çalışması olarak desteklenir:

- Proje başlıkları `projects` koleksiyonunda tutulur.
- PNB arşiv iş paketleri `archiveUnits` koleksiyonunda tutulur.
- Görevler ve raporlar PNB arşiv birimine bağlanabilir.
- Gönüllüler yalnızca kendilerine atanmış arşiv birimlerini görür.
- Koordinatör/admin rolleri iş paketlerini atar, durum günceller, engelleri takip eder ve raporları inceler.
- Excel dosyaları doğrudan canlı veritabanına yazılmaz; önce `tools/pnb_excel_to_import.py` ile JSON önizleme üretilir, sonra `/app/` içindeki `PNB İçe Aktar` ekranından admin tarafından aktarılır.
- PNB dışındaki gönüllü işleri aynı panelde genel `Görevler`, `Raporlar`, `Duyurular` ve `Kullanıcılar` akışıyla yönetilir.

## Roller

- `volunteer`
- `coordinator`
- `admin`

## Durumlar

- `pending`
- `approved`
- `blocked`

PNB arşiv iş durumları:

- `not_started`
- `assigned`
- `in_progress`
- `review`
- `done`
- `blocked`

## Dosya yapısı

```text
.
├─ index.html
├─ 404.html
├─ css/
├─ js/
├─ auth/
├─ app/
├─ admin/
├─ firebase/
├─ apps-script/
├─ docs/
└─ prompts/
```

## Hızlı başlangıç

1. `js/config.firebase.example.js` dosyasını `js/config.firebase.js` olarak kopyalayın.
2. Firebase proje bilgilerinizi `js/config.firebase.js` içine ekleyin.
3. Firebase Console'da:
   - Authentication > Google sağlayıcısını açın
   - Firestore veritabanını oluşturun
   - `firebase/firestore.rules` kurallarını yayınlayın
4. `apps-script/` altındaki dosyaları yeni bir Apps Script projesine kopyalayın.
5. GitHub Pages'i repo ayarlarından etkinleştirin.

## Yerel önizleme

Statik dosya olduğu için doğrudan açabilirsiniz; yine de en sağlıklısı yerel bir sunucu ile test etmektir.

Örnek:

```bash
python3 -m http.server 8000
```

Sonra:
- `http://localhost:8000/`
- `http://localhost:8000/auth/`
- `http://localhost:8000/app/`
- `http://localhost:8000/admin/`

## Önemli not

Bu repo iskelet bir başlangıç sürümüdür. Canlıya almadan önce şu adımlar manuel olarak yapılmalıdır:

- Firebase projesi oluşturma
- Yetkili domain ekleme
- Google sign-in etkinleştirme
- Firestore security rules yayınlama
- Apps Script trigger kurma
- Yönetici kullanıcılarının ilk rol atamalarını yapma

Detaylı kurulum için:
- `docs/SETUP.md`
- `docs/FIRESTORE_SCHEMA.md`
- `docs/SECURITY_RULES.md`
- `docs/PNB_IMPORT.md`
- `docs/APPS_SCRIPT_SETUP.md`
- `docs/DEPLOYMENT.md`
