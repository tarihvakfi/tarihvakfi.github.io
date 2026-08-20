# Çalışma Günü Kılavuzu
### Tarih Vakfı Kütüphanesi — taşınma ve envanter çalışması

Bu belge iki şeyi anlatır: **çalışma başlamadan önce bir kez yapılacak kurulum** ve
**her çalışma gününün rutini**. Koordinatör bu belgeyi, gönüllüler yalnızca kural
kartını okur.

---

## 0. Bir kez: kurulum

### A) Teknik kurulum — koordinatör, bilgisayar başında, ~40 dakika

**1. Tablo ve betik**

[sheets.new](https://sheets.new) → ad: *Tarih Vakfı — Kitap Envanteri* →
**Uzantılar → Apps Script** → içindekini silip `apps-script/KitapEnvanteri.gs`
dosyasının tamamını yapıştırın.

**2. Ayarları düzenleyin** (betiğin ilk 40 satırı)

```js
CALISMA_SIFRESI: 'BURAYA_CALISMA_SIFRESI',        // gönüllülere söyleyeceğiniz ortak şifre
KOORDINATOR_SIFRESI: 'BURAYA_KOORDINATOR_SIFRESI', // onay, katalog ve durum panosu
MEKANLAR: [{ kod: 'G', ad: 'Giriş Kat' }, { kod: 'D', ad: 'Depo' }],
RAF_HARFLERI: 'ABCDEFGH',          // gerçek kitaplık sayınız kadar
SIRA_SAYISI: 6,                    // bir kitaplıkta kaç göz var
```

> ⚠️ **Şifreleri bu belgeye yazmayın.** Bu depo herkese açıktır; buraya yazılan
> şifre GitHub'da okunabilir hâle gelir ve silseniz bile geçmişte kalır.
> Gerçek şifreler yalnızca Apps Script'teki çalışan kopyada bulunur.

Bu üç satır **gerçek kütüphaneye göre** ayarlanmalı; menüler ve raf etiketleri
buradan üretiliyor. Yanlış bırakırsanız gönüllü olmayan bir rafı seçer.

**3. Kaydedin** → fonksiyon listesinden **`kurulum`** → **Çalıştır** → izin verin.
Tabloda Envanter, Kurallar, Kutular, Özet sayfaları oluşur.

**4. Fotoğraf/OCR** (fotoğrafla çalışacaksanız): sol menüden **Hizmetler → + → Drive API →
Ekle**, sonra fonksiyon listesinden **`zamanlayiciKur`** → **Çalıştır**.

**5. Yayınlayın:** **Dağıt → Yeni dağıtım → Web uygulaması** → Yürüten: *Ben* ·
Erişimi olan: **Herkes** → `/exec` ile biten adresi kopyalayın.

**6. Siteye koyun:** zipteki `kitap-envanteri.html`, `kunye-onay.html`,
`envanter-manifest.json`, `sw.js` dosyalarını deponun köküne; `assets/envanter-192.png`
ve `assets/envanter-512.png` dosyalarını `assets/` klasörüne kopyalayın.
`js/gonullu-config.js` içine adresi yazın:

```js
window.TV_ENVANTER_URL = "https://script.google.com/macros/s/.../exec";
```

`.github/workflows/deploy.yml` içindeki kopyalama satırında bu dosyaların adı geçmeli —
**geçmezse sayfa 404 verir.** Commit + push.

**7. Kendiniz deneyin.** Telefondan formu açın, bir deneme kaydı girin, tabloda görün,
sonra formdaki **Sil** ile silin. Bu adımı atlamayın; gönüllü günü ilk denemenizin günü
olmasın.

> Ayrıntılı hâli: `KURULUM.md`

### B) Fiziksel hazırlık — ekip, yarım–bir gün

| İş | Kim | Süre |
|---|---|---|
| Raf metresini ölçün (eski + yeni bina) | 3 kişi | 1–2 saat |
| Raf harflerini ve sıra sayısını kararlaştırın | koordinatörler | 30 dk |
| `raf-etiketleri.py` içindeki üç satırı buna göre düzenleyip çalıştırın, PDF'i bastırın | koordinatör | 20 dk |
| Etiketleri raflara yapıştırın | 2 kişi | yarım gün |
| `qr-kartlari.pdf`'i bastırıp girişe ve masalara asın | koordinatör | 10 dk |
| Kural kartını yönetime onaylatın, laminatlayıp masalara koyun | koordinatör | — |
| Blok tarama: "bu ünite komple yeşil / kırmızı adayı / tek tek" | koordinatörler | yarım gün |

**Etiket = sistemin omurgası.** Telefondaki menüde yazan kod ile rafa yapıştırdığınız
etiket birebir aynı olmalı. Yapıştırma yarım gün alır ama envanterin güvenilirliği
buna bağlıdır.

**Malzeme listesi:** renkli etiket (yeşil/sarı/kırmızı/mavi), kutu, koli bandı, kalın
kalem, kilitli poşet (küflü kitap için), metre, laminatlı kural kartı, priz uzatma
kablosu ve birkaç powerbank.

### C) Gönüllülere gönderilecek mesaj

> Merhaba, yarın kütüphane çalışmasındayız. Girişteki QR kodu telefon kameranızla
> okutun (ya da şu adresi açın: **tarihvakfi.github.io/kitap-envanteri.html**).
> Tarayıcı "Ana ekrana ekle / Kur" derse kabul edin — uygulama gibi açılır.
> Çalışma şifresi: **[çalışma şifresini buraya yazın]**. Başka bir şey kurmanıza gerek yok.
> Powerbank getirebilirseniz iyi olur; vakıfta internet zayıf, telefonu wifi'ye
> bağlamayıp mobil veriyle çalışmak daha rahat.

---

## 1. Roller

Bir çalışma gününde en verimli düzen budur:

**Gönüllü kitabın akıbetine karar vermez.** Gönüllü künyeyi girer ve fotoğrafı
çeker; gidecek/gitmeyecek kararını koordinatör onay ekranında verir. Bu ayrım
bilerek yapıldı: karar tutarlılığı bir günde eğitilecek bir beceri değil, ve rafta
on saniyede verilen karar masa başında fotoğrafa bakarak verilen karardan kötüdür.

| Rol | Kaç kişi | Ne yapar |
|---|---|---|
| **Raf ekibi** | tek ya da ikişerli, 2–5 ekip | **Çek — çek — kaydet.** Künye ve kapak fotoğrafı, sonra Kaydet. Yazmak zorunda değil. Sorunlu kitabı işaretler. **Karar vermez, etiket yapıştırmaz.** |
| **Masa (onay + karar)** | 1 kişi | `kunye-onay.html`: künyeyi tamamlar ve kararı verir. **Sistem kararı önerip hazır getiriyor**, masa onaylıyor ya da değiştiriyor. Kuyruk şişerse **gruplu onay** açılır. **Koordinatör şifresi ister.** |
| **Paketleme** | 1–2 kişi | Onaylanmış kayıtların listesine (katalog) bakarak yeşil ve sarıları kutular. Karar vermez. |
| **Koordinatör** | 1 kişi | Sıra dağıtır, sayıları izler, tıkanan yeri açar, gün sonu turunu yapar. |

**Dört kişilik küçük bir gün:** iki kişi raf, bir kişi masa, koordinatör paketlemeye
de bakar. **On kişilik bir gün:** altı kişi raf, iki kişi masa, bir paketleme.

**Masa darboğaz olmasın diye sistem üç şey yapıyor:**

1. **Kararı öneriyor.** Künye, yayınevi, yıl, nüsha ve OCR metnine bakıp bir kural
   öneriyor (ör. "YKS Soru Bankası" → K1, "1934 baskısı" → Y4, "5 nüsha" → K3).
   Öneri ekranda **ön-seçili** gelir; masa katılıyorsa tek dokunuş, katılmıyorsa
   değiştirir. Karar yine insanda — değişen tek şey kaç kez düşünüldüğü.
2. **Aynı öneriyi taşıyanları grupluyor.** "23 kayıt · K1 · ders/sınav kitabı —
   hepsini onayla". En kalabalık grup en üstte; zayıf öneriler en altta, onlar
   tek tek bakılmalı.
3. **Kuyruğa göre kendini ayarlıyor.** Bekleyen 40'ı aşarsa onay ekranı
   **gruplu onayla** açılır ve sebebini yazar. Kuyruk küçülünce tek tek moda döner.
   120'yi aşarsa raftaki gönüllülerin ekranında da uyarı çıkar — birinin masaya
   geçmesi gerektiğini onlar da görsün diye.

Yine de masa boş kalırsa kuyruk büyür. **Bir kişiyi masaya sabitleyin**; gruplu
onayla bir kişi saatte binlerce kayıt geçebilir, ama sıfır kişi sıfır geçer.

---

## 1b. Rastgele gelen gönüllü — sıra dağıtımı kuralları

Gönüllüler her gün aynı kişiler değil. Biri salı gelir, biri perşembe; kimi iki saat
kalır, kimi tam gün. Rafın hangi kısmının bittiğini kimse hatırlamak zorunda kalmasın
diye **sırayı sistem dağıtıyor.** Kurallar şunlar:

**Kural 1 — Sıra sistemden alınır, seçilmez.**
Gönüllü giriş yapınca **"Bana boş bir sıra ver"** düğmesine basar. Sistem sırayı
**o kişinin adına ayırır** (rezerve eder) ve menüyü kendisi ayarlar. Aynı dakikada
sekiz kişi bassa sekizi de farklı sıra alır — üstelik **farklı kitaplıklardan**,
tek rafın önünde yığılmasınlar diye.

Rezervasyon **8 saat** sürer. Süre dolunca sıra havuza döner (yarım kalmışsa
"yarım" olarak). Gönüllü sırayı bitirince rezervasyon hemen kalkar.

> **Bir kişinin aynı anda bir sırası olur.** Bitirmeden yeni sıra istenirse sistem
> "bu sıra zaten sizin üzerinizde" der. Bu kasıtlı: yarım bırakılıp unutulan sıra
> sayısını sıfıra yakın tutuyor.

**Kural 2 — Kendi seçen, ekrandaki uyarıyı okur.**
Gönüllü fiziksel olarak bir rafın önündeyse elle de seçebilir. O zaman ekran üç
şeyden birini söyler:

| Ekranda | Anlamı | Ne yapılır |
|---|---|---|
| **boş sıra — hiç başlanmamış** | Kimse dokunmamış | Soldan başlayın |
| **yarım kalmış**, son çalışan ve tarih yazar | Biri başlamış, bitirmemiş | Kaldığı yerden devam edin — numara sistemden gelir |
| **BU SIRA BİTMİŞ** (kırmızı), kim bitirmiş ve kaç kitap saymış yazar | Kapatılmış | Başka sıra seçin. Atlanmış kitap bulduysanız yine de ekleyin ve koordinatöre söyleyin |
| **BU SIRA … ÜZERİNDE** (kırmızı), kimin aldığı yazar | Bugün başkasına verilmiş | Başka sıra seçin. Devralıyorsanız ekrandaki soruya "evet" deyin |

**Kural 3 — Bir sıra bir kişinindir.** Sistem bunu artık kendisi uyguluyor:
başkasının üzerindeki sıra size önerilmez, elle seçerseniz kırmızı uyarı ve onay
sorusu çıkar. Yine de devralabilirsiniz (biri erken gitmişse gerekir), ama bilerek
yapmış olursunuz.

**Kural 4 — Sıra bitirilmeden bırakılmaz.**
Gönüllü sırayı bitirince **rafta kaç kitap olduğunu fiziksel olarak sayar** ve
"Bu sırayı bitirdim" ekranına yazar. Sistem kendi sayısıyla karşılaştırır:

- **tutuyorsa** sıra kapanır, yeni sıra alınır
- **eksikse** ("rafta 42, sistemde 39") gönüllü rafı bir daha gözden geçirir
- **fazlaysa** aynı kitap iki kez kaydedilmiş olabilir — koordinatöre söylenir

Bu adım, hiçbir kitabın geride kalmadığının **tek** güvencesi. Sistem kaç kitap
kaydettiğini bilir ama rafta kaç kitap durduğunu bilemez.

**Kural 5 — Yarım sıra bırakmak serbesttir, ama haber verilir.**
Gönüllü gitmek zorunda kalırsa sırayı bitirmez, öylece bırakır — sistem "yarım
kalmış" diye işaretler, ertesi gün gelen kaldığı yerden devam eder. Ancak
**gitmeden önce bekleyen kayıt uyarısının söndüğünden emin olmalı**, yoksa
kaydettikleri telefonunda kalır.

**Kural 6 — Koordinatör günde bir kez sıra haritasına bakar.**
`envanter-durum.html` → **Sıra haritası**. Üstte şerit: kaç sıra bitti, kaç yarım,
kaç tanesi şu an birinin üzerinde, **kaç tanesinin sayımı tutmuyor**. Tabloda
sayımı tutmayanlar en üstte, kırmızı zeminde. Sonra üzerinde biri olanlar, sonra
yarım kalanlar. Hiç başlanmamış sıralar listeye alınmaz, sayıları altta yazar.

Bakılacak iki şey: **sayımı tutmayan sıralar** (o rafa tekrar bakılmalı) ve
**gün sonunda hâlâ birinin üzerinde görünen sıralar** (kapatılmadan bırakılmış).

### Yarım günlük bir gönüllünün akışı, baştan sona

1. Gelir, QR kodu okutur, adını ve çalışma şifresini yazar.
2. **"Bana boş bir sıra ver"** — sistem `G-C04` verir.
3. Gönüllü kartını okur (bir sayfa, masada duruyor).
4. Rafın soluna gider, kitapları tek tek kaydeder: künye + kapak fotoğrafı,
   ya da yazar/başlık/yıl.
5. Sıra biter, rafı sayar, "Bu sırayı bitirdim — rafta 38 kitap vardı" der.
6. Sistem "sistemde de 38, tutuyor" der. Sıra kapanır.
7. Yeni sıra alır, ya da gider. Giderken sarı uyarının söndüğüne bakar.

Bu akışta gönüllünün karar vermesi gereken tek şey yok — bu kasıtlı.

---

## 2. Gün başı — ilk 20 dakika

1. **Gönüllü kartlarını masalara koyun** (`gonullu-karti.pdf`, tek sayfa). Yeni
   gelene tek cümle yeter: *"Çek, çek, kaydet — kararı biz veriyoruz."*
   Kural kartı (`kural-karti.pdf`) yalnızca **onay masasında** durur.
2. **Herkes formu açsın**, adını ve çalışma şifresini girsin.
3. **Herkes "Bana boş bir sıra ver"e bassın.** Sıra dağıtımını siz yapmayın; sistem
   çakışmasız dağıtıyor. Yalnızca kimin nerede olduğunu bir kâğıda not edin.
4. **Onay masasını kurun.** O kişi `kunye-onay.html`'i koordinatör şifresiyle açar.
   Bu masa boş kalırsa gün sonunda envanterin hepsi "Sınıflandırılmadı" olur.
5. **Kutuları dağıtın.** Etiket paketlemede kullanılır, rafta değil — renk kararı
   artık masada veriliyor.
6. Koordinatör tabloyu açsın, **Özeti yenilesin** — günün başlangıç sayısını not edin.

---

## 3. Gün içi ritim

**90 dakika çalışma + 15 dakika mola.** Kitap taşımak yorucudur; mola vermeyen ekip
üçüncü saatte hata yapmaya başlar.

Her mola arasında koordinatör üç şeye bakar:

- **Onay kuyruğu** — sayı sürekli büyüyorsa masa yetişmiyor demektir. Önce
  **gruplu onaya** geçin (ekran zaten öneriyor); yetmezse bir raf ekibini masaya alın.
  Kuyruk büyümesi bir günde telafi edilebilir, üç günde edilemez.
- **Bekleyen kayıt uyarısı** — bir telefonda sayı büyüyorsa o kişiyi bağlantının iyi
  olduğu yere gönderin, kuyruğu boşaltsın, geri dönsün.
- **Hız** — ekip başına saatte 60–80 kitap normaldir. Sınıflandırma kalktığı için bu
  sayı artmalı. Belirgin düşük ekip varsa sebebini sorun; genellikle raf çok karışıktır.
- **Belirsiz oranı** — bu artık masanın metriği. Masa %15'ten fazla "Belirsiz"
  veriyorsa kural yetersiz demektir; beş dakika konuşup kuralı netleştirin.

**Küflü/böcekli kitap çıkarsa** iş durur: kitap poşetlenir, ayrı alana konur,
koordinatöre haber verilir. Bu bir ayıklama kararı değil, koruma tedbiridir.

**Paketleme onaydan sonra gelir.** Bir sıra ayıklandıktan sonra masa o sıranın
kayıtlarını onaylar; paketleme ekibi katalogdan (`envanter-katalog.html`) o sıranın
yeşil ve sarılarını görüp kutular. Kutu numarası kutunun üstüne kalın kalemle yazılır
ve **Kutular** sayfasına işlenir: kutu no, kaynak sıra, yer kodu aralığı
(*G-A03-001 → G-A03-042*), hedef bölüm.

> Paketleme aynı gün yetişmeyebilir; sorun değil. Kitaplar rafında durur, kayıtları
> hazırdır. Paketlemeyi taşınma haftasına toplamak da geçerli bir plan.

---

## 4. Gün sonu — son 30 dakika

Bu yarım saat pazarlığa açık değil. Erken bırakılan gün, ertesi gün iki saat kaybettirir.

1. **Kuyruk turu.** Koordinatör her telefona tek tek bakar: üstteki turuncu
   "gönderilmeyi bekliyor" uyarısı kalmamalı. Kalan varsa o telefon bağlantının iyi
   olduğu yere götürülür, **Tekrar dene** denir, uyarı kaybolana kadar beklenir.
   *Gönüllü, bekleyen kaydı varken telefonun tarayıcı verilerini temizlemesin.*
2. **Açık kutuları kapatın**, numarasını yazın, Kutular sayfasına işleyin. Yarım kutu
   ertesi güne kalabilir ama numarası ve kaynak sırası şimdi yazılsın.
3. **Mavi etiketlileri belirsiz masasına taşıyın**, bir yığın hâlinde bırakmayın.
4. **Poşetlenmiş küflü kitap var mı**, ayrı alanda mı — kontrol edin.
5. **Durum panosunu** açın (`envanter-durum.html`) — günün resmi orada. Sonra tabloda
   **Kitap Envanteri → Özeti yenile** deyin ve dört sayıyı deftere yazın:
   *kaç kitap kaydedildi · kaç metre raf bitti · belirsiz oranı · onay bekleyen künye*.
6. **Yarım kalan sıraları yazın.** "G-A03 yarım kaldı, 42'de bırakıldı; G-B01 bitti."
   Ertesi günün ilk beş dakikası bu nottan doğar.
7. Masa ekibi mümkünse **onay kuyruğunu sıfırlasın**; olmuyorsa kaç kaldığını not edin.

---

## 5. Ertesi gün

- **Yarım kalan sıradan devam edilir.** Ekip aynı sırayı seçer; sistem numarayı kaldığı
  yerden sürdürür (43'ten). Kimse "kaçıncıydık" diye saymaz.
- **Dünün belirsizleri** gün başında karara bağlanır. Uzman gelmediyse mavi yığını
  büyütmeyin; koordinatör en azından "bu ay bakılacak" kutusuna alsın.
- **Onay bekleyen künyeler** masaya oturan ilk kişinin işidir. Fotoğraflar Drive'da
  duruyor, aceleye gerek yok — ama her gün biraz eritilmezse ay sonunda dağ olur.
- Koordinatör dünkü dört sayıyı bugünkülerle karşılaştırır. **Metre ilerlemesi**
  gönüllülere duyurulacak sayıdır: "dün 18 metre bitirdik, toplam 96 metre" —
  kitap sayısından çok daha motive edicidir.

---

## 6. Haftalık

- **Belirsiz masası oturumu** — uzmanla birlikte biriken mavileri karara bağlayın.
- **Kuralları gözden geçirin.** Aynı tartışma üçüncü kez çıktıysa kural eksiktir.
  `KURALLAR` listesine satır ekleyip **Dağıt → Dağıtımları yönet → Yeni sürüm** deyin;
  form kuralları her açılışta sunucudan çeker. **Kural kartını da yeniden bastırın** —
  ekrandaki liste ile masadaki kart birbirini tutmazsa gönüllü tereddüt eder.
- **Hedefe göre durum:** Özet sayfasındaki "Gidecek + Gitse de olur" toplamı, yeni
  binanın kapasitesini geçiyor mu? Geçiyorsa sarıların bir kısmı elenecek demektir;
  bunu ay sonunda değil, şimdi görün.
- **Tabloyu yedekleyin:** Dosya → İndir → Excel. Haftada bir, ayrı bir klasöre.

---

## 7. Sık karşılaşılan durumlar

| Durum | Ne yapılır |
|---|---|
| Telefonda **"çevrimdışı"** rozeti | Normal. Çalışmaya devam; kayıtlar telefonda birikiyor. Gün sonunda kuyruğun boşaldığından emin olun. |
| Kuyruk bir türlü boşalmıyor | Wifi'yi tamamen kapatıp mobil veriyle deneyin. Yarım çalışan wifi, hiç bağlantı olmamasından kötüdür. |
| **Yanlış sıra** seçilmiş, on kitap oraya girmiş | Kayıtları formdaki **Sil** ile silip doğru sırada yeniden girmek en temizi. Az sayıda kayıt için tabloda Mekân/Raf/Sıra hücrelerini elle düzeltebilirsiniz — ama Yer kodu sütununu da elle düzeltin. |
| Gönüllü "gidecek mi" diye soruyor | Sizin işiniz değil, deyin. Kaydedip geçsin; şüphesi varsa **Not** alanına yazsın. |
| Onay kuyruğu şişti | Masaya ikinci kişi koyun. Bir raf ekibini masaya alın — kayıt bir gün bekleyebilir, karar bekleyemez. |
| Sıra sayımı tutmuyor (eksik) | Gönüllü rafı bir daha geçsin. Yine tutmuyorsa **Sıralar** sayfasındaki Not alanına sebebini yazın; taşınmadan önce o sıra tekrar bakılacaklar listesine girer. |
| Sıra sayımı tutmuyor (fazla) | Aynı kitap iki kez kaydedilmiş olabilir. Katalogdan o sıranın kayıtlarına bakıp mükerrer olanı silin. |
| Herkes aynı rafa üşüştü | "Bana boş bir sıra ver" düğmesini kullanmalarını söyleyin; sistem çakışmasız dağıtıyor. |
| Bir kayıt yanlış girildi | Formun altındaki **son kayıtlar** listesinden **Düzelt**. Kaydın bütün alanları forma gelir; değiştirmek istemediğinizi ellemeyin. Yer kodu değişmez. Vazgeçmek isterseniz uyarıdaki **Vazgeç**e basın. |
| Numaralarda **boşluk** var (007 yok) | Silinen kayıttan kalmıştır, zararsızdır. Numaraları yeniden dizmeye çalışmayın. |
| Kırmızı kutuda **"N kayıt sunucuya girmedi"** yazıyor | O kayıtlar sunucunun kabul etmediği kayıtlardır (ör. eksik bilgi). Listedeki kitapları elle yeniden kaydedin, sonra **Listeyi temizle**. Arkadaki kayıtlar zaten gitmiştir. |
| Sarı kutuda **"N kitabın yer kodu değişti"** yazıyor | Siz çevrimdışıyken aynı sırada başkası da çalışmış. Listedeki kitapların üstündeki/kutudaki kodu yenisiyle düzeltin, sonra **Düzelttim**. |
| Bir kaydı yanlışlıkla sildim | Kayıt tablodan tamamen silinmez, "Silindi" sütunu işaretlenir. Koordinatör o hücreyi boşaltınca kayıt geri gelir. |
| Fotoğrafların hiçbirinden öneri gelmiyor | Tabloda "OCR hatası" yazıyorsa Drive API açık olmayabilir. Koordinatör: Apps Script → Hizmetler → Drive API ekleyin, sonra tablodaki **Kitap Envanteri → OCR hatalarını yeniden dene** menüsünü çalıştırın. |
| Aynı sırada iki kişi çalıştı | Sistem numaraları çakıştırmaz; ekranda "numara sunucuda düzeltildi" yazar. Yine de fiziksel karışıklık için bir daha yapmayın. |
| Rafın ortasına sonradan kitap eklendi | Sıradaki son numaradan devam edin. Yer kodu "rafta soldan kaçıncı" demek değil, "bu sırada kaçıncı kaydedildi" demektir. |
| Telefonun şarjı bitti | Powerbank. Bekleyen kaydı olan telefon kapanırsa kayıtlar kaybolmaz (telefonda saklıdır), ama o telefon açılana kadar tabloya düşmez. |
| Gönüllü tarayıcı verilerini temizledi | Gönderilmemiş kayıtlar kaybolur. Gün sonu turunun asıl sebebi budur. |
| Fotoğraf çekildi ama öneri gelmedi | OCR okuyamamıştır. Onay ekranında fotoğrafa bakıp künyeyi elle yazın; sistem yine çalışır. |

---

## 8. Bir günün iskeleti

| Saat | Ne oluyor |
|---|---|
| 10.00 | Karşılama, kural kartı, telefonlara form, sıra dağıtımı |
| 10.20 | Çalışma bloğu 1 |
| 11.50 | Mola · koordinatör sayılara bakar |
| 12.05 | Çalışma bloğu 2 |
| 13.30 | Öğle arası |
| 14.15 | Çalışma bloğu 3 · paketleme hızlanır |
| 15.45 | Mola · belirsiz masası oturumu |
| 16.00 | Çalışma bloğu 4 |
| 17.00 | **Gün sonu turu** (kuyruklar, kutular, mavi yığın, özet, notlar) |
| 17.30 | Bitiş |

Beş saatlik fiili çalışma, dört raf ekibi, ekip başına saatte 70 kitap
≈ **günde 1.400 kitap**. 7.000 kitaplık bir koleksiyon için beş çalışma günü eder.
