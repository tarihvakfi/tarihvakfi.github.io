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
CALISMA_SIFRESI: 'kitap2026@tv',   // gönüllülere söyleyeceğiniz ortak şifre
KOORDINATOR_SIFRESI: 'k2026@tv',   // onay, katalog ve durum panosu
MEKANLAR: [{ kod: 'G', ad: 'Giriş Kat' }, { kod: 'D', ad: 'Depo' }],
RAF_HARFLERI: 'ABCDEFGH',          // gerçek kitaplık sayınız kadar
SIRA_SAYISI: 6,                    // bir kitaplıkta kaç göz var
```

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
> Çalışma şifresi: **kitap2026@tv**. Başka bir şey kurmanıza gerek yok.
> Powerbank getirebilirseniz iyi olur; vakıfta internet zayıf, telefonu wifi'ye
> bağlamayıp mobil veriyle çalışmak daha rahat.

---

## 1. Roller

Bir çalışma gününde en verimli düzen budur:

| Rol | Kaç kişi | Ne yapar |
|---|---|---|
| **Raf ekibi** | ikişerli, 2–5 ekip | Okuyucu kitabı alır, künyeyi söyler, kategoriyi verir, renkli etiketi yapıştırır. Kayıtçı telefondan girer. |
| **Masa (künye onayı)** | 1 kişi | `kunye-onay.html` ekranında fotoğraflı kayıtların künyesini tamamlar. Rafta değil, oturarak çalışır. **Koordinatör şifresi ister.** |
| **Paketleme** | 1–2 kişi | Yalnızca renge bakar; yeşil ve sarıları kutular, kutu numarasını yazar. Karar vermez. |
| **Belirsiz masası** | uzman/kütüphaneci | Mavi etiketlileri toplu inceler. Gün sonunda ya da ertesi gün. |
| **Koordinatör** | 1 kişi | Sayıları izler, tıkanan yeri açar, gün sonu turunu yapar. |

**Dört kişilik küçük bir gün:** iki kişi raf ekibi, bir kişi masa, koordinatör
paketlemeye de bakar. **On kişilik bir gün:** dört raf ekibi, bir masa, bir paketleme.

Masa rolünü boş bırakmayın. Fotoğraflı kayıtlar birikirse envanterin yarısı
"künye fotoğraftan gelecek" satırı olarak kalır.

---

## 2. Gün başı — ilk 20 dakika

1. **Kural kartlarını masalara koyun**, yeni gelenlere on saniye kuralını söyleyin:
   *on saniyede karar veremiyorsan mavi işaretle, devam et.*
2. **Herkes formu açsın**, adını ve şifreyi girsin.
3. **Her ekibe bir sıra verin** — "siz G-A03'ten başlıyorsunuz". İki ekip aynı sırada
   çalışmasın; sistem çakışmayı çözer ama fiziksel karışıklık çözmez.
4. Ekipler sırayı seçince ekranda **"bu sırada kaç kitap kayıtlı, sıradaki numara ne"**
   yazar. Dünden devam eden sırada bu sayı sıfır olmaz — doğru yerdesiniz demektir.
5. **Kutu ve etiketleri dağıtın.** Her paketleme noktasında dört renk de bulunsun.
6. Koordinatör tabloyu açsın, **Özeti yenilesin** — günün başlangıç sayısını not edin.

---

## 3. Gün içi ritim

**90 dakika çalışma + 15 dakika mola.** Kitap taşımak yorucudur; mola vermeyen ekip
üçüncü saatte hata yapmaya başlar.

Her mola arasında koordinatör üç şeye bakar:

- **Belirsiz oranı** — %15'i geçiyorsa durun. Kural yetersiz demektir; beş dakika konuşup
  kuralı netleştirmek, iki saat sonra iki yüz mavi kitapla uğraşmaktan iyidir.
- **Bekleyen kayıt uyarısı** — bir telefonda sayı büyüyorsa o kişiyi bağlantının iyi
  olduğu yere gönderin, kuyruğu boşaltsın, geri dönsün.
- **Hız** — ekip başına saatte 60–80 kitap normaldir. Belirgin düşük ekip varsa
  sebebini sorun; genellikle raf çok karışıktır ya da kural tartışması vardır.

**Küflü/böcekli kitap çıkarsa** iş durur: kitap poşetlenir, ayrı alana konur,
koordinatöre haber verilir. Bu bir ayıklama kararı değil, koruma tedbiridir.

**Yeşil ve sarı biriktikçe paketlenir**, kutu numarası kutunun üstüne kalın kalemle
yazılır ve **Kutular** sayfasına işlenir: kutu no, kaynak sıra, yer kodu aralığı
(*G-A03-001 → G-A03-042*), hedef bölüm.

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
