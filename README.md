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

## Gönüllü akışı (rapor-öncelikli)

Sistem rapor-öncelikli (report-first) bir model kullanır. Gönüllüler sıraya alınmış işleri beklemez; üzerinde çalışmak istedikleri iş paketini kendileri seçer ve çalıştıktan sonra kısa bir rapor bırakır. Birim durumu en son rapordan otomatik türetilir.

1. Gönüllü Google ile giriş yapar, başvurusu onaylanır.
2. Panel açıldığında büyük bir **Rapor Yaz** birincil butonu ve son üç raporun listesi karşılar.
3. Modaldan iş paketini typeahead ile arar (kaynak / kutu / seri / içerik), ne yaptığını yazar, efor (Biraz / Normal / Epey) ve durum (Başladım / Devam ediyor / Gözden geçirme için hazır / Bitirdim / Takıldım) seçer, isteğe bağlı link bırakır.
4. Kayıt tek bir Firestore batch'i ile `reports` dokümanını yazar, ilgili `archiveUnits` kaydının durum + son aktivite alanlarını günceller, gönüllünün `users.lastReportAt` damgasını tazeler.
5. "Liste dışı / yeni bir iş" yoluyla gönüllü `pending_review` statüsüyle yeni bir kayıt da oluşturabilir; admin Bakım sekmesinde onaylar veya birleştirir.

## PNB arşiv operasyonları

Sistem bütün gönüllü işleri için tek yönetim ortamıdır. Pertev Naili Boratav çalışması ilk ayrıntılı arşiv vaka çalışması olarak desteklenir:

- Proje başlıkları `projects` koleksiyonunda tutulur.
- PNB arşiv iş paketleri `archiveUnits` koleksiyonunda tutulur; her birim `sourceIdentifier`, `priority`, `suitableFor`, `city`, `digitized`, `lastActivityAt`, `lastReporterId/Name`, `lastReportNotePreview` gibi alanlar taşır.
- Raporlar `reports` koleksiyonunda tutulur ve bir arşiv birimine bağlanır.
- Gönüllüler `Rapor Yaz` modalindeki typeahead aracılığıyla tüm PNB iş paketlerine erişir; Ankara'daki gönüllüler yalnızca `digitized == true` kutuları görür. Atanmış / atanmamış ayrımı artık akışın belirleyici unsuru değildir.
- Koordinatör/admin rolleri operasyonel takip için **Pano** (sadece görüntüleme), **Son raporlar** akışı, **Dikkat** paneli (engelliler, uzun süredir dokunulmamış birimler, sessiz gönüllüler) ve **Yönetim** drawer'ları üzerinden çalışır.
- Excel dosyaları doğrudan canlı veritabanına yazılmaz; önce `tools/pnb_excel_to_import.py` ile JSON önizleme üretilir, sonra `/app/` içindeki admin-only `Bakım` ekranından aktarılır.
- PNB dışındaki gönüllü işleri aynı `İşler` ekranındaki `Diğer işler`, `Rapor Yaz`, `Duyurular` ve staff-only `Yönetim` akışıyla yönetilir.

> Eski "atama-merkezli" akış (self-claim banner + sıradan iş seçimi) kod tabanında muhafaza edilmiştir ve `window.FEATURE_FLAGS.selfClaim` bayrağı ile geri açılabilir; ayrıntılar için `AGENTS.md` içindeki "Self-claim is deprecated but retained" bölümüne bakın.

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
