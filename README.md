# Tarih Vakfı · Sayım Defteri

Bu depo, Tarih Vakfı Pertev Naili Boratav Arşivi için hazırlanan kamuya açık Sayım Defteri panosunu barındırır. Pano, Google Sheet üzerinde tutulan sayım ve gönüllü katkı verilerini düzenli olarak okuyarak haftalık ilerlemeyi, aktif kutuları, malzeme dağılımını ve gönüllü/koordinasyon emeğini görünür kılar.

Kamu sayfası statik GitHub Pages olarak çalışır; üretim runtime’ında Firebase, oturum açma, özel backend, Node/Express sunucu veya ücretli servis gerekmez.

## Veri Akışı

- `apps-script/SheetSync.gs` Google Sheet’i okur ve `?public=1` endpoint’iyle güvenli kamu payload’ı üretir.
- `js/snapshot.js` ilk boyama için statik yedek veridir; GitHub Actions veya yerel audit script ile yenilenir.
- `js/data-loader.js` önce snapshot’ı kullanır, sonra yapılandırılmış Apps Script endpoint’inden canlı veriyi dener.
- `tools/audit_public_dashboard.py` yerel Excel kopyasından aynı kamu özetini üretir ve denetim raporu yazar.

## Kamuya Açık Veri Sözleşmesi

```js
window.TVF_PUBLIC_DATA = {
  generatedAt,
  publicSummary,
  latestActivity
};
```

`publicSummary` tüm toplamların kaynağıdır. `latestActivity` yalnızca kısa “Son hareketler” akışıdır ve hiçbir toplam bu sınırlı feed’den hesaplanmaz.

## Gönüllü Kredisi

Pano **credit-visible, ID-safe volunteer display** kullanır:

- Sheet’te gerçek insan adı varsa gösterilir.
- `publicDisplayName` / `kamusal_ad` gibi açık kamu adı varsa önceliklidir.
- `role`, `görev`, `publicRole`, `displayRole`, `coordinator`, `koordinatör` gibi alanlar varsa kişinin yanında gösterilir.
- E-posta, UUID, uzun hex hash, opaque veritabanı ID’si veya machine token isim olarak gösterilmez.
- Kullanılabilir ad yoksa satır toplamların içinde korunur, fakat kamu sayfasında sahte bir kişi kartı oluşturmaz.
- Açık opt-out alanı varsa kişi adı kamu görünümünden çıkarılır.

Önerilen opt-out alanları: `public_credit = no`, `credit_visible = false`, `hide_name = yes`.

## Kamuya Açılmayanlar

- e-posta adresleri
- raw volunteer/user IDs
- UUID, hash, token, sheet row IDs
- özel notlar
- ham spreadsheet export’u
- Apps Script veya Google credential/secrets

## Resmi Bağlam

Sayfa kısa bir Tarih Vakfı kurumsal bağlamı ve Pertev Naili Boratav Arşivi açıklaması içerir. Kullanılan resmi bağlantılar:

- [Tarih Vakfı hakkında](https://tarihvakfi.org.tr/hakkimizda/)
- [Bilgi Belge Merkezi hakkında](https://tarihvakfi.org.tr/bilgi-belge-merkezi-hakkinda/)

Logo dosyası: `assets/img/tarih-vakfi-logo.png`.

## Yerel Kurulum

```bash
python3 -m pip install -r tools/requirements.txt
python3 tools/audit_public_dashboard.py
python3 tools/validate_public_summary.py
python3 -m http.server 8000
```

Önizleme:

```text
http://localhost:8000/
http://localhost:8000/?debug=1
```

Yerel Excel’den snapshot yenilemek:

```bash
python3 tools/audit_public_dashboard.py --write-snapshot
python3 tools/validate_public_summary.py --snapshot
```

## Dosya Yapısı

```text
.
├─ index.html
├─ 404.html
├─ .github/workflows/deploy.yml
├─ assets/
│  └─ img/tarih-vakfi-logo.png
├─ css/site.css
├─ js/
│  ├─ config.public.js
│  ├─ snapshot.js
│  ├─ data-loader.js
│  ├─ aggregate.js
│  ├─ volunteer-credit.js
│  ├─ render-dashboard.js
│  └─ utils.js
├─ apps-script/
├─ tools/
├─ docs/
└─ _audit/
```

## Bakım Kontrol Listesi

1. Sheet yapısı değiştiyse `python3 tools/audit_public_dashboard.py` çalıştırın.
2. `_audit/output/public_dashboard_audit.md` içindeki uyarıları okuyun.
3. `python3 tools/validate_public_summary.py --snapshot` ile snapshot’ı doğrulayın.
4. Yerelde `/` ve `/?debug=1` ile adların, dönem etiketinin, günlük toplamların ve aktif kutuların doğru göründüğünü kontrol edin.
5. Apps Script endpoint’i değişirse `js/config.public.js` ve `.github/workflows/deploy.yml` içindeki URL’yi güncelleyin.

Dağıtım ayrıntıları için [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) dosyasına bakın.
