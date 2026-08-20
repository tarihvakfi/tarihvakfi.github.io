# Kitap Envanteri Formu — Kurulum

Raftaki gönüllünün telefonundan kayıt girdiği form. Gönüllü sistemiyle aynı altyapı
(Apps Script + Google E-Tablo) ama **ayrı bir betik ve ayrı bir tablo** — birbirlerine
dokunmazlar.

| Parça | Nerede | Dosya |
|---|---|---|
| Form (telefon) | `tarihvakfi.github.io` | `kitap-envanteri.html` |
| Onay ekranı (masa) | `tarihvakfi.github.io` | `kunye-onay.html` |
| Uygulama kabuğu | `tarihvakfi.github.io` | `envanter-manifest.json`, `sw.js`, `assets/envanter-*.png` |
| Arka uç | Google hesabınız | `apps-script/KitapEnvanteri.gs` |
| Veri + fotoğraflar | Google E-Tablo + Drive klasörü | otomatik oluşur |

Kurulum ~10 dakika.

---

## 1. Tablo ve betik

1. [sheets.new](https://sheets.new) → ad: **Tarih Vakfı — Kitap Envanteri**
2. **Uzantılar → Apps Script** (açılmazsa [script.new](https://script.new) ile bağımsız proje
   açıp `AYAR.TABLO_ID` alanına tablonun kimliğini yazın)
3. `KitapEnvanteri.gs` içeriğini yapıştırın
4. Üstteki ayarları düzenleyin:

```js
var AYAR = {
  KURUM: 'Tarih Vakfı',
  TABLO_ID: '',                      // bağımsız projede tablonun kimliği
  CALISMA_SIFRESI: 'BURAYA_CALISMA_SIFRESI',        // gönüllülere söyleyeceğiniz ortak şifre
  KOORDINATOR_SIFRESI: 'BURAYA_KOORDINATOR_SIFRESI', // onay ekranı, katalog ve durum panosu bunu ister
  SON_KAYIT: 8,
  FOTO_KLASOR_ID: '',                // boş bırakırsanız klasörü kendi açar
  OCR_ACIK: true,                    // fotoğraftan yazı çıkarma
  OCR_TOPLU: 12,                     // her turda en fazla kaç fotoğraf

  // Yer kodu — kendi kütüphanenize göre düzenleyin
  MEKANLAR: [{ kod: 'G', ad: 'Giriş Kat' }, { kod: 'U', ad: 'Üst Kat' }, { kod: 'D', ad: 'Depo' }],
  RAF_HARFLERI: 'ABCDEFGHIJKL',      // her mekândaki kitaplık harfleri
  SIRA_SAYISI: 8,                    // bir kitaplıkta en fazla kaç göz var
};
```

> ⚠️ **Şifreleri bu belgeye yazmayın.** Bu depo herkese açıktır; buraya yazılan
> şifre GitHub'da okunabilir hâle gelir ve silseniz bile geçmişte kalır.
> Gerçek şifreler yalnızca Apps Script'teki çalışan kopyada bulunur.

### Yer kodu

Her kitap nereden geldiğini gösteren bir kod alır:

```
G-A03-007
│   │  └── o sıradaki 7. kitap  (sistem verir, gönüllü uğraşmaz)
│   └───── A kitaplığının 3. sırası (gözü)
└───────── 1. kat
```

Kod üç işe yarar: **eksik kontrolü** (sırada 42 kayıt varsa ve rafta 45 kitap
duruyorsa üçü atlanmış), **kutu içeriğini tek satırla yazmak**
("Kutu 17: G-A03-001 → G-A03-042") ve gerekirse yeni binada aynı sırayı kurmak.

Sıra numarasını **gönüllü vermez** — telefon verir, sunucu doğrular. Aynı sırada
iki kişi çalışsa bile numaralar çakışmaz. Silinen kayıttan boşluk kalır; bu zararsızdır,
numaraları yeniden dizmeye çalışmayın.

> Tek mekânda çalışıyorsanız `MEKANLAR` listesine tek satır bırakın; kod `A03-007`
> biçimine iner.

### QR kartları

`qr-kartlari.pdf` — beş ekranın QR kodu **ve şifreleri**. Bastırıp çalışma alanına asın;
gönüllü kamerayı tutar, sayfa açılır, adres yazmaz.

> Kâğıtta şifreler yazılı olduğu için **girişe ya da halka açık bir yere asmayın.**
> Şifreleri değiştirirseniz `qr-kartlari.py` başındaki iki satırı güncelleyip
> kartları yeniden basın.

Adresler değişirse `qr-kartlari.py` içindeki listeyi düzenleyip yeniden çalıştırın
(`pip install qrcode` gerekir).

İlk açılışta gönüllüye **"Ana Ekrana Ekle"** dedirtin — kitap kaydı ekranı telefonda
uygulama gibi durur, QR'a bir daha gerek kalmaz ve internet kesikken de açılır.

### Raf etiketleri

`raf-etiketleri.pdf` — her sıra için basılacak etiket. **Fiziksel etiketle telefondaki
kod birebir aynı olmalı**; gönüllü menüden seçerken etikete bakacak.

Kendi raflarınıza göre üretmek için `raf-etiketleri.py` dosyasının başındaki üç satırı
(`MEKANLAR`, `RAF_HARFLERI`, `SIRA_SAYISI`) Apps Script'teki ayarlarla aynı yapıp
çalıştırın. Etiketleri yapıştırmak yarım gün sürer ama envanterin omurgası budur.

**İki şifre var:**

| Şifre | Neyi açar | Kim bilir |
|---|---|---|
| `CALISMA_SIFRESI` | Kitap kaydı formu | Bütün gönüllüler |
| `KOORDINATOR_SIFRESI` | Künye onayı + katalog | Yalnızca koordinatörler |

Çalışma şifresi neden var: form herkese açık bir adreste duruyor, şifre yoldan geçenin
rastgele kayıt girmesini engeller. Gönüllü bunu bir kez yazar, telefonu hatırlar.
Karmaşık olmasına gerek yok, söylemesi kolay olsun.

Koordinatör şifresi ayrı olmalı: çalışma şifresini bilen bir gönüllü onay ekranını ya da
kataloğu açamasın. `KOORDINATOR_SIFRESI` boş bırakılırsa ayrım kalkar, iki ekran da
çalışma şifresiyle açılır.

5. Kaydedin → fonksiyon listesinden **`kurulum`** → **Çalıştır** → izin verin.
   Tabloda **Envanter, Kurallar, Kutular, Özet** sayfaları oluşur.

## 2. Yayınlama

**Dağıt → Yeni dağıtım → Web uygulaması**
→ Yürüten: *Ben* · Erişimi olan: **Herkes** → `/exec` adresini kopyalayın.

## 3. Siteye ekleme

1. Şu dosyaları deponun köküne kopyalayın: `kitap-envanteri.html`, `kunye-onay.html`,
   `envanter-manifest.json`, `sw.js` — ve `assets/envanter-192.png`, `assets/envanter-512.png`
   dosyalarını `assets/` klasörüne
2. `js/gonullu-config.js` içindeki şu satıra `/exec` adresini yazın:

```js
window.TV_ENVANTER_URL = "https://script.google.com/macros/s/.../exec";
```

3. `.github/workflows/deploy.yml` içindeki kopyalama satırında bu dosyaların hepsi olmalı
   (güncel dosyada var). **Bu satırda adı geçmeyen dosya siteye çıkmaz, 404 verir.**
4. Commit + push →
   - gönüllü formu: **https://tarihvakfi.github.io/kitap-envanteri.html**
   - onay ekranı: **https://tarihvakfi.github.io/kunye-onay.html**

Form adresini gönüllülere WhatsApp'tan yollayın. Telefon sayfayı ilk açtığında üstte
"Uygulama gibi kurabilirsiniz" şeridi çıkar; Android'de **Kur**, iPhone'da
**Paylaş → Ana Ekrana Ekle**. Kurulunca adres çubuğu olmadan, uygulama gibi açılır ve
çevrimdışıyken de açılır (sayfa telefonda saklanır).

## 4. Fotoğraf ve OCR (bir kez)

1. Apps Script'te sol menüden **Hizmetler → +** → **Drive API** → **Ekle**
   (fotoğraftan yazı çıkarma bunu ister; ücretsizdir)
2. Fonksiyon listesinden **`zamanlayiciKur`** → **Çalıştır**
   (5 dakikada bir yeni fotoğrafları okur)
3. Drive'da **Kitap Künye Fotoğrafları** adlı klasör kendiliğinden oluşur. Başka bir
   klasör kullanacaksanız kimliğini `AYAR.FOTO_KLASOR_ID` alanına yazın.

> **İlk gün mutlaka kontrol edin:** bir kitabın fotoğrafını çekip 10 dakika sonra tabloda
> **OCR durumu** sütununun `bitti` olduğunu ve **Öneri başlık** sütununun dolduğunu görün.
> Bu adım buradan sınanamıyor; Drive'ın OCR'ı kurumsal hesap ayarlarına göre kapalı olabilir.
> Çalışmazsa sistem yine çalışır — fotoğraf yine kaydedilir, künye onay ekranında fotoğrafa
> bakılarak elle yazılır. Kaybolan tek şey öneriler olur.

---

## Formda akış

**İlk açılışta bir kez:** ad + çalışma şifresi → mekân / raf / sıra seçimi.
Seçim yapılınca ekranda "bu sırada kaç kitap kayıtlı, sıradaki numara ne" yazar.

**Sonra her kitapta iki yol var:**

**A) Çek geç (hızlı yol — önerilen)**

Formda iki fotoğraf kutusu var, ikisi de isteğe bağlı:

| Kutu | Ne işe yarar |
|---|---|
| **Künye sayfası** | Künye önerisi bundan üretilir. Çekilirse başlık boş bırakılabilir. |
| **Kapak** | Kitabı tanımak için. Sonradan "hangi kitaptı bu" sorusunu bir bakışta çözer; onay ekranında sekmeyle görülür. |

Kapak fotoğrafı kitap başına 3–4 saniye ekler. Hız düşerse **yalnızca "Gidecek" ve
"Belirsiz" kitaplarda kapak çekin** — gitmeyecek kitabın kapağına zaten ihtiyacınız olmaz.

1. 📷 düğmesi → **künye sayfasının** fotoğrafı çekilir

   Künye sayfası, kitabın başındaki **sol** sayfadır: ISBN, baskı yılı, yayınevi ve
   çoğu kitapta "ESER ADI / YAZAR ADI" satırları oradadır. Sağdaki iç kapakta yıl
   genelde bulunmaz — **yıl, "1950 öncesi" kuralı için gerekli.**

   En pratiği: kitabı o sayfadan açıp **iki sayfayı birden** tek karede çekmek.
   Sistem ikisini birlikte okur. Eski kitaplarda ayrı künye sayfası yoksa iç kapağı
   çekin, yeterlidir.
2. Dört renkli düğmeden biri seçilir → kurala dokunulur → **kayıt biter**

Başlık boş kalabilir; künye masa başında fotoğraftan tamamlanır. Rafta geçen süre
kitap başına birkaç saniyeye iner — asıl kazanç budur.

**B) Elle yazma (fotoğraf gerekmeyen kitaplar)**

1. Yazar / Başlık / Yıl / Nüsha yazılır
2. Gerekiyorsa Durum değiştirilir (varsayılan *Sağlam*)
3. Renkli düğme → kural → kayıt biter

Yeni, kapağı okunaklı kitaplarda yazmak fotoğraftan hızlıdır; eski, Osmanlıca, karışık
künyeli kitaplarda fotoğraf çekin. Karar gönüllünün.

Her iki yolda da kural kodunu ayrı bir yere yazmaya gerek yok; kararla birlikte alınıyor.

**Sıra kodu üst şeritte sabit** durur (G-A03) ve altında sıradaki kitabın numarası
görünür. Sıra bitince "Sıra değiştir" düğmesi.

**Sayaç:** üst sağda o gün siz kaç kitap girdiniz — gönüllüyü motive eder, koordinatöre
hız ölçüsü verir.

**Son kayıtlarınız:** altta son 8 kayıt görünür; yanlış giren **Düzelt** veya **Sil**
diyebilir. Yanlış kaydı düzeltmek için tabloyu açmaya gerek yok.

**Küflü/böcekli** seçilirse ekranda uyarı çıkar: kitabı poşetleyin, ayırın, koordinatöre
haber verin.

### Zayıf bağlantı

Apps Script bir süre kullanılmayınca "uykuya" geçer; uyanırken ilk istek 20–30 saniye
sürebilir. Form buna göre kuruldu:

- **Ayarlar telefonda saklanır.** Raf harfleri, mekânlar ve kurallar bir kez alındıktan
  sonra telefonda durur; form ikinci açılıştan itibaren beklemeden açılır, arka planda
  tazelenir.
- **Okuma istekleri kendiliğinden tekrar denenir** (iki kez, artan aralıkla). Kayıt
  gönderme istekleri tekrarlanmaz — aynı kitap iki kez kaydedilmesin.
- **Şifresi daha önce çalışmış telefon, sunucuya ulaşılamasa da çalışmaya başlayabilir:**
  "çevrimdışı başladınız" uyarısıyla girer, kayıtlar kuyruğa yazılır.
- Giriş uzun sürerse düğme **"Sunucu uyanıyor, bekleyin…"** der; gönüllü sayfayı
  yenilemek zorunda kalmaz.

Vakıfta internet güvenilmez olduğu için form buna göre kuruldu:

- **Kayıt telefonda saklanır**, üstte "N kayıt gönderilmeyi bekliyor" uyarısı çıkar,
  bağlantı gelince kendiliğinden gönderilir. **Fotoğraflar da bekler** (telefonun
  kendi deposunda) ve kayıtla birlikte gider.
- **Yer kodu çevrimdışıyken de verilir.** Telefon numarayı kendi verir; kayıt sunucuya
  ulaştığında sunucu doğrular, çakışma varsa düzeltip yeni numarayı ekranda bildirir.
- **İstekler 12 saniyede kesilir.** Ölü bir wifi'ye bağlıyken telefon dakikalarca
  bekleyebilir; bu süre dolunca kayıt çevrimdışı kuyruğa düşer, gönüllü beklemez.
- Üst şeritte **"çevrimdışı"** rozeti görünür — gönüllü kayıtların gitmediğini bilir.

> **Gönüllülere söyleyin:** vakıf wifi'si takılıyorsa telefonun wifi'sini tamamen
> kapatıp mobil veriyle çalışmak çoğu zaman daha iyidir. Yarı çalışan bir wifi,
> hiç bağlantı olmamasından kötüdür.

> Bekleyen kayıt varken gönüllünün tarayıcı geçmişini/verilerini temizlememesi gerekir.
> Gün sonunda üstteki uyarının kaybolduğundan emin olun; 25'i geçerse form zaten
> "bağlantının iyi olduğu bir yere geçin" diye uyarır.

---

## Masa başı: künye onayı

**https://tarihvakfi.github.io/kunye-onay.html** — **koordinatör şifresiyle** girilir.

Ekran ikiye bölünür: solda kitabın fotoğrafı, sağda künye alanları. Fotoğraftan çıkan
öneri yeşil kutuda görünür ve alanlara hazır düşer. Onaylayan bakar, gerekirse düzeltir,
**Onayla ve sıradaki** (ya da Ctrl+Enter) der; sıradaki kayıt gelir.

- Öneri yanlışsa üzerine yazın — tabloya sizin yazdığınız gider.
- Öneri hiç çıkmamışsa (OCR okuyamadıysa) fotoğrafa bakıp elle yazarsınız.
- **Atla** düğmesi kaydı bozmaz, sıradakine geçer; sonra geri gelir.
- Onaylanan satırın **Onay** sütununa "Onaylandı — ad · tarih" yazılır. Onay sütunu boş
  olan fotoğraflı kayıtlar bu ekranda birikmeye devam eder.

> **Beklenti:** OCR tek başına temiz künye üretmez, **öneri** üretir. Doğruluk bu onay
> adımından gelir. Bir kişi masa başında saatte 60–100 künye onaylayabilir; rafta aynı
> sürede bu kadar kitap yazılamaz. İş bölümü bu yüzden mantıklı: raf hızlı, masa dikkatli.

Gün sonunda onay ekranındaki "onay bekliyor" sayısının düştüğünü görün. Sürekli
büyüyorsa masa başına bir kişi daha koyun.

---

## Katalog: kaydedilenleri görmek

**https://tarihvakfi.github.io/envanter-katalog.html** — **koordinatör şifresiyle** girilir.

Kaydedilmiş kitapları **fotoğraflarıyla birlikte** kart kart gösterir. Kapak fotoğrafı
varsa kapak, yoksa künye sayfası görünür; fotoğrafa tıklayınca Drive'da tam boy açılır.

- **Ara** — başlık, yazar, yer kodu, kutu no ve not içinde arar
- **Karar** — yalnızca Gidecek / Gitmeyecek… olanları göster
- **Sıralama** — en yeni kayıt önce ya da yer koduna göre (raf sırasıyla gezmek için)
- **Kapsam** — varsayılan "yalnızca onaylananlar"; "tüm kayıtlar" ile künyesi henüz
  tamamlanmamışları da görürsünüz
- **CSV indir** — süzülmüş listenin tamamını tabloya döker (fotoğraf bağlantıları dahil)

Kartın üstündeki renkli şerit kararı gösterir: yeşil gidecek, sarı gitse de olur,
kırmızı gitmeyecek, mavi belirsiz.

Liste 60'ar kitap yükler; "Daha fazla göster" ile devam eder. Zayıf bağlantıda
tüm envanteri tek seferde indirmemek için böyle yapıldı.

---

## Durum panosu: çalışma nerede?

**https://tarihvakfi.github.io/envanter-durum.html** — koordinatör şifresiyle girilir.

Tek ekranda:

- **Kaydedilen kitap** · **künyesi onaylı** · **onay bekleyen** · **künyesi eksik** ·
  **belirsiz oranı**
- **Karar dağılımı** — gidecek / gitse de olur / gitmeyecek / belirsiz, çubuk ve tablo
- **Günlük ilerleme** — son 14 günde kaç kitap; son yedi günün ortalaması
- **Yeni binaya sığacak mı** — `AYAR.HEDEF_KITAP` doldurulmuşsa gidecek+sarı toplamını
  kapasiteyle karşılaştırır; aşım varsa kaç kitap fazla olduğunu yazar
- **İşleyiş** — küflü kitap sayısı (uyarı), fotoğraflı kayıtlar, okunmayı bekleyen ve
  okunamayan fotoğraflar
- **Sıralar** — hangi sırada kaç kitap, son numara, son kayıt günü
- **Kaydedenler** — bugün ve toplam

Üç sayıya düzenli bakın: **belirsiz oranı** (%15'i geçerse kurallar yetersiz),
**onay bekleyen** (büyüyorsa masaya bir kişi daha gerek), **küflü** (sıfırdan büyükse
o kitaplar poşetlenmiş ve ayrılmış olmalı).

---

## Tablodaki sayfalar

- **Envanter** — her kitap bir satır. Başta yer bilgisi (Yer kodu · Mekân · Raf · Sıra ·
  Sıra no), sonda fotoğraf bağlantısı, OCR durumu, öneri alanları, ham OCR metni ve onay.
  Mekân/Raf/Sıra ayrı sütunlarda olduğu için süzme ve sayma doğru çalışır; birleşik
  **Yer kodu** insan içindir.
- **Kurallar** — kural kodlarının açıklaması (kural kartıyla birebir)
- **Kutular** — paketleme sırasında elle doldurulur
- **Özet** — üst menüdeki **Kitap Envanteri → Özeti yenile** ile hesaplanır:
  kaç kayıt, karar dağılımı, belirsiz oranı, fiziksel durum, bugün kim kaç kitap girdi

**Belirsiz oranını takip edin.** %15'i geçiyorsa kurallar yetersiz demektir; durup
kural kartını netleştirin.

---

## Kuralları değiştirmek

`KURALLAR` listesi betiğin başında duruyor. Bir kural eklemek/çıkarmak için satır
ekleyip **Dağıt → Dağıtımları yönet → Yeni sürüm** deyin; form kuralları her açılışta
sunucudan çeker, sayfayı güncellemeye gerek yok.

Değiştirdiğinizde **kural kartını da güncelleyip yeniden yazdırın** — ekrandaki liste ile
masadaki kart birbirini tutmazsa gönüllü tereddüt eder.

---

## Pilot günü kontrol listesi

- [ ] Şifre gönüllülere söylendi mi
- [ ] Herkes formu telefonunda açıp ana ekrana ekledi mi
- [ ] Raf etiketleri basılıp yapıştırıldı mı (etiket ile menüdeki kod birebir aynı mı)
- [ ] `MEKANLAR` / `RAF_HARFLERI` / `SIRA_SAYISI` gerçek kütüphaneye göre ayarlandı mı
- [ ] Bir kitabı çevrimdışıyken kaydedip bağlantı gelince tabloya düştüğü görüldü mü
- [ ] İlk yarım saatte 5 kaydı tabloda kontrol edin: alanlar doğru yere düşüyor mu
- [ ] Saatteki hız ölçüldü mü (kişi/ekip başına kaç kitap)
- [ ] Belirsiz oranı %15'in altında mı
- [ ] Gün sonunda "gönderilmeyi bekleyen kayıt" uyarısı kalmadı mı
- [ ] Bir fotoğraf çekip 10 dakika içinde **OCR durumu → bitti** ve **Öneri başlık** doldu mu
- [ ] Onay ekranında en az 5 künye onaylandı mı (fotoğraf açılıyor mu, öneri işe yarıyor mu)
- [ ] Fotoğraflı kaydın rafta kaç saniye sürdüğü ölçüldü mü (elle yazımla karşılaştırın)
- [ ] Özet yenilendi mi

---

## Ek: 19 Ağustos 2026 güncellemesi — ne değişti, ne yapmanız gerekiyor

Beş veri kaybı yolu kapatıldı. Güncellemeyi uygularken **sırayla** şunları yapın:

1. `apps-script/KitapEnvanteri.gs` içeriğini Apps Script'e yapıştırın.
2. **`kurulum` fonksiyonunu bir kez çalıştırın.** Bu adım zorunlu: tabloya
   `İstemci no` ve `Silindi` diye iki yeni sütun eklenir. Çalıştırmazsanız yeni
   kayıtlar "sütun sayısı uymuyor" hatası verir.
3. **Yeni sürüm** olarak dağıtın (Dağıt → Dağıtımları yönet → kalem → Yeni sürüm).
4. `kitap-envanteri.html` ve `sw.js` dosyalarını depoya gönderin. `sw.js` içindeki
   sürüm numarası `v2` oldu; telefonlar eski kabuğu kendiliğinden atacak.

### Değişenler

| Ne | Eskiden | Şimdi |
|---|---|---|
| **Düzelt** | Yalnız başlık forma geliyor, kaydedince yazar/yıl/nüsha/not/fiziksel durum siliniyordu | Kaydın tamamı forma gelir; sunucu yalnızca gönderilen alanı yazar |
| **Çevrimdışı açılış** | Ayar dosyası önbellekte olmadığı için uygulama "Sistem adresi tanımlanmamış" deyip hiç açılmıyordu | Ayar dosyası da kabukta; ağ 4 saniyede yanıt vermezse önbellekten açılır |
| **Kuyruk** | Sunucunun kalıcı olarak reddettiği tek kayıt, arkasındaki her şeyi sonsuza kadar tıkıyordu | Reddedilen kayıt ayrı bir "sorunlu" listesine alınır, kuyruk akmaya devam eder, gönüllüye gösterilir |
| **Mükerrer kayıt** | Zaman aşımı, üst üste binen kuyruk turu ya da ikinci dokunuş yeni satır açıyordu | Her kaydın istemci kimliği var; aynı kayıt ikinci kez gelirse yeni satır açılmaz. Kaydederken bütün kural düğmeleri kilitlenir |
| **Silme** | `?action=sil&...` bağlantısı çalışıyordu; satır tamamen siliniyor, numara yeniden kullanılıyordu | Yazan işlemler bağlantı (GET) ile çalışmaz; silinen satır durur, `Silindi` sütunu işaretlenir, numara yeniden dağıtılmaz |
| **OCR hatası** | Kalıcıydı; Drive API'yi sonradan açmak eski kayıtları kurtarmıyordu | Tablo menüsünde **OCR hatalarını yeniden dene** |

### Bir kaydı geri almak

`Silindi` sütunundaki hücreyi boşaltın. Kayıt listelere, katalog ve panoya geri döner.

---

## Ek: 20 Ağustos 2026 — iş bölümü değişti

Gönüllü artık **sınıflandırma yapmıyor**; yalnızca künye girer. Gidecek/gitmeyecek
kararını koordinatör onay ekranında veriyor. Ayrıca sıra dağıtımı ve sıra bitirme
sisteme bağlandı.

### Kurulum sırası

1. `apps-script/KitapEnvanteri.gs` içeriğini Apps Script'e yapıştırın.
2. **`kurulum` fonksiyonunu çalıştırın** — tabloya **Sıralar** adlı yeni bir sayfa
   eklenir. Çalıştırmazsanız "sırayı bitirdim" kaydedilemez.
3. **Yeni sürüm** olarak dağıtın.
4. `kitap-envanteri.html` ve `kunye-onay.html` dosyalarını depoya gönderin.
5. `gonullu-karti.pdf`'i yazdırıp masalara koyun; `kural-karti.pdf` artık yalnızca
   onay masasına ait.

### Ne değişti

| | Eskiden | Şimdi |
|---|---|---|
| **Gönüllü ekranı** | Künye + kategori + kural kodu; kural çipi aynı zamanda kaydet düğmesiydi | Künye + fiziksel durum + not; tek bir **Kitabı kaydet** düğmesi |
| **Karar** | Rafta, on saniyede, gönüllü verirdi | Masada, fotoğrafa bakarak, koordinatör veriyor |
| **Onay kuyruğu** | Yalnızca fotoğraflı kayıtlar | Onaylanmamış **her** kayıt (karar hepsi için gerekli) |
| **Onay ekranı** | Künyeyi tamamlar | Künyeyi tamamlar **ve** kategori + kural seçer; karar olmadan onaylanamaz |
| **Sınıflandırılmamış kayıt** | Olamazdı | Kategori sütununda `Sınıflandırılmadı` yazar, kuyrukta bekler |
| **Sıra seçimi** | Gönüllü menüden seçerdi, sıranın durumunu bilmezdi | **"Bana boş bir sıra ver"** düğmesi; seçilen sıra için "boş / yarım kalmış / BİTMİŞ" uyarısı |
| **Sıra bitişi** | Diye bir şey yoktu | **"Bu sırayı bitirdim"** — gönüllü rafı sayar, sistem karşılaştırır, eksik varsa söyler |
| **Tamlık denetimi** | Yoktu | `Sıralar` sayfası + koordinatör için `siraHaritasi`: kaç sıra bitti, kaç yarım, kaç sayım tutmuyor |

### Eski kayıtlar

Kategorisi zaten dolu olan eski kayıtlar olduğu gibi kalır; onay ekranı o kararı
seçili getirir, koordinatör isterse değiştirir.
