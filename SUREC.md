# Taşınma Süreci — baştan sona

Bu belge bütün işin haritası. Diğer belgeler tek tek fazları anlatıyor; burada
zincirin tamamı var.

---

## Temel kural: sıra = iş birimi

Kütüphane **sıralara** bölünmüş durumda (`G-A03` = Giriş Kat · A rafı · 3. göz).
Bir sıra ortalama 30–50 kitap. **Bütün süreç boyunca iş birimi bu.**

Bir sıra üç kez elden geçiyor:

| Geçiş | Ne yapılıyor | Kim | Kitap raftan çıkıyor mu? |
|---|---|---|---|
| 1 | **Envanter** — künye + fotoğraf | Gönüllü, rafta | **Hayır** |
| 2 | **Karar** — gidecek / gitmeyecek | Koordinatör, masada | Kitaba dokunulmuyor |
| 3 | **Çekme + paketleme** — taşınacaklar alınıp kutulanıyor | Ekip, rafta | Yalnızca taşınacaklar |

Her sıra bu üçünü kendi hızında geçiyor. Bütün kütüphanenin 1. geçişi bitmeden
2. geçişe başlanmıyor diye bir kural **yok** — sıra bazında ilerliyor.

---

## Hiçbir kitap atılmıyor — ve depo diye ayrı bir iş yok

Karar masasında verilen karar **"taşınacak mı, yerinde mi kalacak"**:

| Karar | Ne oluyor | Katalogda |
|---|---|---|
| **Gidecek** | Raftan çıkar, `Y-` kutusuna girer, yeni binaya | 🟢 **YENİ BİNADA · Y-017** |
| **Gitmeyecek** | **Hiçbir şey. Yerinde kalır.** | 🟣 **DEPODA — yerinde · G-A03-007** |

**Depo, eski rafların kendisi.** Taşınmayan kitap kımıldamıyor; onu bir yerden
bir yere taşımak, kutulamak, numaralamak diye bir iş **yok**. Adresi zaten
envanterde: `G-A03-007` = Giriş Kat · A rafı · 3. göz · 7. kitap. Katalogdan
arayınca hangi rafta durduğu çıkıyor.

Bunun pratik karşılığı büyük:

- **Her kitap bir kez elleniyor** — o da yalnızca taşınacaksa
- İki yığın kurmak, iki kutu serisi tutmak, ikinci bir paketleme geçişi **yok**
- Yerinde kalan kitabın kaydı bozulmuyor: yer kodu doğruluğunu koruyor

> **Kural: kutusuz kitap raftan inmez.** Bir kitap yerinden ancak `Y-` kutusuna
> numarasıyla girdikten sonra ayrılır. Numarasız kutuya atılan kitap kaybolmuş
> demektir — katalog onu hâlâ rafında sanar.

> **Depo bir gün taşınırsa** (eski bina bırakılır, koleksiyon başka yere alınır)
> aynı ekran `D-` serisiyle çalışıyor: sıra süzgeci → hedef **Depo taşınıyor** →
> kutu numarası. Ama olağan taşınmada bu seriye gerek yok.

---

## ⚠️ En önemli kural: envanter sırasında kitap rafından çıkmaz

Gönüllü kitabı alır, fotoğrafını çeker, **aynı yere geri koyar.**

Neden:

- **Sayım bozulur.** Sıra bitince gönüllü rafı sayıyor, sistem kendi sayısıyla
  karşılaştırıyor. Bu, hiçbir kitabın atlanmadığının tek güvencesi. Araya kitap
  çıkarılırsa karşılaştırma anlamsızlaşır.
- **Karar henüz verilmemiştir.** Koordinatör kitabı saatler, belki günler sonra
  görecek. O ana kadar kitabın nereye gideceği bilinmiyor.
- **Yarım kalan sıra kurtarılamaz.** Ertesi gün gelen gönüllü yarı boşalmış bir rafta
  neyin yapıldığını anlayamaz.

**Tek istisna: küflü/böcekli kitap.** O poşetlenip ayrı alana konur (bulaşıcıdır).
Gönüllü ekranda işaretlediği için sistem sayımdan düşer — sayım yine tutar.

> **Kutuya doğrudan çalışıyorsanız** (`AYAR.KUTU_KULLAN: true`) kitaplar rafa dönmez,
> kutuya girer. O zaman gönüllü **kutuya koyduklarını** sayar. Ama bu yöntemde
> raf boşalır — yani "yerinde kalan = depo" düzeni ortadan kalkar ve gitmeyecek
> kitaplar da kutuya girmiş olur; ayıklama sonradan kutu açılarak yapılır.
> **Yer çok darsa** tercih edilir; değilse blok usulü hem daha güvenli hem daha az iş.

---

## Faz 0 — Başlamadan önce (bir kez)

Bunlar yapılmadan başlarsanız, eksikliği taşınma haftasında ve en pahalı anda
fark edersiniz. Hepsi bir günlük iş.

| # | Ne | Kim | Neden şimdi |
|---|---|---|---|
| 1 | **Kutu ve koli bandı tedarik et**, boş kutulara yer ayır | Yönetim | Kutu bitince ayrıştırma durur; yığınlar ortada kalır |
| 2 | **Depoda kutulara yer ayır** ve nasıl diziliyorlarsa öyle numaralayın | Ekip | Depo kutusu numarasıyla bulunur; gelişigüzel yığılırsa numara işe yaramaz |
| 3 | **`zamanlayiciKur()` çalıştır**, sonra `gunlukYedek()`'i bir kez elle çalıştır | Kuran kişi | Tablo tek nokta; gecelik yedek olmadan bir kaza bir aylık işi siler |
| 4 | **Koordinatör yedeği belirle** — en az iki kişi onay ekranını bilsin | Koordinatör | Tek kişi hastalanınca bütün süreç durur |
| 5 | **Şartlı bağış koleksiyonlarını listele** | Yönetim | Sözleşmesi bütünlük şart koşan koleksiyondan kitap ayrılamaz (Y7 kuralı) |
| 6 | **"Belirsiz" için son tarih koy** — taşınmadan en az bir hafta önce | Yönetim | Mavi kitaplar karara bağlanmazsa kamyon günü karar verirsiniz |
| 7 | **Bir deneme sırası yapın** — bir sırayı baştan sona yürütün | Koordinatör | Akışın gerçek rafta nasıl işlediğini ilk çalışma gününde öğrenmeyin |

**Kontrol:** 3. madde yapılmadıysa panodaki **"Bugün dikkat"** kartı bunu zaten
söyleyecek.

> **Yeni bina henüz gündemde değilse** kapasite (`AYAR.HEDEF_KITAP`) boş kalabilir;
> sistem bunu dert etmez, uyarı üretmez. Yeni bina netleştiğinde boş raf metresini
> ölçüp 30 ile çarpın ve o ayara yazın — pano o andan itibaren "gidecek yığın
> sığacak mı" sorusunu takip etmeye başlar.

---

## Faz 1 — Envanter

**Ne oluyor:** Gönüllü sıra alır, kitapları tek tek kaydeder, sırayı sayarak kapatır.

**Sistem ne yapıyor:** Sırayı gönüllünün adına ayırır (kimse aynı sıraya
gönderilmez). Yer kodunu kendisi verir. Sıra kapanırken fiziksel sayımla kendi
sayısını karşılaştırır.

**Çıktı:** `Envanter` sayfasında satırlar — künye, fotoğraf, yer kodu.
Kategori sütununda **`Sınıflandırılmadı`** yazar.

**Bittiğini nasıl anlarız:** Durum panosu → Sıra haritası → *"hiç başlanmadı"* sayısı sıfır.

### Yarım kalan sıra — devir teslim sistemden

Bir gönüllü sırasını bitiremeden gidebilir. Bunun için **rafa hiçbir şey konmaz,
kimse deftere not almaz.** Ertesi gün o sırayı seçen kişi ekranda şunu görür:

> **Bu sıra yarım kalmış — nereden devam edeceksiniz**
> **17** kitap kaydedilmiş. Rafta **17.** kitaba kadar sayın, **sonrakinden** devam edin.
> ── *Tanzimat Dönemi Maarifi* · `G-B07-017` · Ayşe · 14.08.2026 15:20 [kapak fotoğrafı]

İki bağımsız işaret verilir, biri diğerini doğrular:

- **sayı** — rafta soldan kaç kitap sayılacağı (nüsha sayısı ve poşetlenip
  raftan alınanlar düşülmüş hâliyle)
- **kitap** — o noktadaki kitabın adı, yer kodu ve kapak fotoğrafı

Sayarak bulduğunuz kitabın adı ekrandakiyle aynıysa yer kesindir. Tutmuyorsa
saymayı tekrarlayın; yine tutmuyorsa koordinatöre söyleyin.

**İnternet giderse ne olur?** Telefon bu bilgiyi kendinde saklıyor. Bağlantı
yokken kart yine çıkar, ama üstünde turuncu bir şerit belirir: *"Bağlantı yok —
bu bilgi 3 saat önce alınmış hâli."* O arada başkası çalışmış olabileceği için,
**saydığınız kitapla ad tutmuyorsa bağlantı gelene kadar o sırayı almayın.**

Koordinatör tarafında aynı bilgi **Durum panosu → Sıra haritası**'nda: hangi
sıralar yarım, her birinde kaç kayıt var, en son kim dokunmuş.

---

## Faz 2 — Karar

**Ne oluyor:** Koordinatör onay ekranında künyeyi tamamlar ve kararı verir.

**Sistem ne yapıyor:** Her kayda kural önerir (nüsha, yıl, başlık, OCR metnine
bakarak) ve ön-seçili getirir. Aynı öneriyi taşıyanları gruplar — *"23 kayıt · K1 ·
hepsini onayla"*. Kuyruk 40'ı aşarsa kendiliğinden gruplu moda geçer.

**Çıktı:** Kategori + kural kodu + onay damgası.

**Bittiğini nasıl anlarız:** Onay ekranında *"Bekleyen künye kalmadı"*.

> Bu faz envanterin **gerisinden gelir** ve bu normaldir. Ama günlerce geride
> kalmamalı: çekme, kararlar bitmeden başlayamaz.

---

## Faz 3 — Çekme ve paketleme

**Ne oluyor:** Bir sıranın bütün kararları verildikten sonra ekip o sıraya gider,
**yalnızca taşınacak kitapları** raftan alır ve doğrudan kutuya koyar.
Gerisine dokunulmaz.

Bu tek geçiştir; çekmek ile kutulamak ayrı iş değildir. Kutu sıranın yanında
durur, kitap raftan çıkıp kutuya girer.

**Sistem ne yapıyor:** Katalog → Sıra süzgecinden sırayı seçin →
**"Çekme listesini yazdır"**. Tek sayfa:

- **ÇIKACAK** (yeşil) — yeni binaya gidecekler; yer kodu, başlık, kural kodu,
  tik kutusu
- **YERİNDE KALACAK** (mor) — depo; **dokunulmayacaklar.** Bu liste iş listesi
  değil, sağlama listesi: sonunda rafta kalanların sayısı buna uymalı

**Nasıl yapılır:**

1. Listeyi yazdırın, boş kutuyu ve etiketi (`kutu-etiketi.pdf`) alın, sıraya gidin.
2. ÇIKACAK listesindekileri **soldan sağa, raftaki sırayla** alın ve aynı sırayla
   kutuya koyun. Karıştırmayın — yeni binada bu sırayla çıkacak.
3. **Ekranda kutuyu kapatın** — bu adım atlanırsa kitapların izi kaybolur:
   - Katalog → **Sıra** süzgecinden sırayı seçin
   - **Karar** süzgecini seçin (`Gidecek`)
   - Kutu numarasını yazın → **Kutuyu kapat**
   - Sistem o kayıtların hepsine `Y-017` damgasını basar ve `Kutular` sayfasına
     satır ekler
4. Ekranın verdiği **yer kodu aralığını** ve **cilt sayısını** etikete de yazın.
   Etiket ile tablo birbirinin yedeği.
5. Rafta kalanları sayın; YERİNDE KALACAK sayısıyla tutmalı.
6. **Listede olmayan bir kitap bulursanız raftan almayın.** Henüz onaylanmamıştır;
   koordinatöre söyleyin.

**Çıktı:** Numaralı, etiketli, katalogda izi olan kutular + seyrelmiş ama düzeni
bozulmamış bir raf.

> **Rafta boşluk kalacak, sorun değil.** Kalanları sıkıştırıp öne çekmeyin;
> yer kodları o sıradaki kayıt numarasına göre verildi, kitapları oynatmak
> kaydı bozmaz ama sağlamayı zorlaştırır.

---

## Faz 4 — Taşıma

**Ne oluyor:** `Y-` kutuları kamyona ve yeni binaya. Eski binada kalanlara
dokunulmuyor.

**Nasıl yapılır:**

1. `Kutular` sayfasını yazdırın — bu sizin yükleme listeniz.
2. Yüklerken **numara sırasıyla** yükleyin ve listeden tikleyin.
3. Yeni binada indirirken **aynı listeden** tekrar tikleyin.
4. İki tik tutmuyorsa kutu eksik demektir — araç gitmeden bulun.

**Çıktı:** Çift tiklenmiş kutu listesi. Bu, hiçbir kutunun kaybolmadığının kanıtı.

---

## Faz 5 — Yerleştirme

Kutu etiketindeki **hedef bölüm** neredeyse oraya taşıyın, kutuyu orada açın,
kitapları **kutudan çıktığı sırayla** rafa dizin. Paketleme sırası korunduysa
raf düzeni de korunur.

**Çıktı:** Yerleşmiş kütüphane. `Kutular` sayfasına "rafa dizildi" işareti koyun.

---

## Faz 6 — Eski binada kalanlar ne olacak?

Bunlar **kaybolmadı** — hepsi katalogda, hepsi kendi rafında, hepsi yer koduyla
bulunabilir. Karar acele değil.

**Depodaki bir kitabı bulmak:** Katalog → kitabı arayın → rozet
**DEPODA — yerinde · G-A03-007** diyorsa o kitap Giriş Kat, A rafı, 3. gözdedir.
Ya da tersinden: sıra süzgecinden `G-A03` seçip o gözde ne kaldığını listeleyin.

**Sağlama:** Katalog → `Karar: Gitmeyecek` süzgeci → CSV. Bu, deponun envanteridir.
Kural koduna göre bakın; `K1` (fazla nüsha) ile `K3` (alan dışı) çok farklı iki
yığındır.

**Sonra ne yapılabilir** (her biri ayrı bir karar, ayrı bir zaman):

| Yol | Ne gerekir |
|---|---|
| Olduğu gibi depo olarak kalır | Hiçbir şey — bugünkü durum |
| Bir kısmı yeni binaya alınır | Yer açıldığında; kayıtlar güncellenir |
| Başka kuruma bağış | Kurum listesi + kabul yazışması |
| Satış / sahaf | Değerli olanların ayrı değerlendirilmesi |
| Geri dönüşüm | **Yönetim onayı — en son çare** |

> **Eski bina bir gün bırakılırsa** kalanlar da taşınacak demektir. O zaman aynı
> çekme + kutulama işi `D-` serisiyle tekrarlanır: sıra süzgeci → hedef
> **Depo taşınıyor** → kutu numarası. Sistem hazır; bugün gerekmiyor.

> **Hiçbir kitap, listesi çıkarılıp yönetime gösterilmeden elden çıkarılmaz.**
> Atılan kitap geri gelmez; rafta duran kitap gelir.

> **Şartlı bağış uyarısı.** Bağış sözleşmesi koleksiyonun bütünlüğünü şart koşuyorsa
> o koleksiyondan kitap ayırmak sözleşmeye aykırı olabilir. Hangi koleksiyonların
> şartlı olduğunu **envanter başlamadan önce** çıkarın; Y7 kuralı bunun için var.

---

## Fazlar nasıl örtüşür

```
Sıra G-A01  [Envanter]──[Karar]──[Çek + Kutula]──┐
Sıra G-A02       [Envanter]──[Karar]──[Çek + Kutula]──┤
Sıra G-A03            [Envanter]──[Karar]──[Çek + Kutula]──┤
                                                           │
                                          Y- kutuları ──► YENİ BİNA
                                          rafta kalanlar ─► oldukları yerde = DEPO
```

Her sıra kendi zincirini yürüyor. Taşıma tek seferde, en sonda.

**Kritik bağımlılık:** bir sıradan kitap çekilemez, kararları bitmeden. Karar masası
geride kalırsa çekme de geride kalır. Panodaki "onay bekleyen" sayısı bu yüzden
en önemli sayı.

---

## Kim ne yapıyor — tek tablo

| | Envanter | Karar | Çekme + paketleme | Taşıma | Yerleştirme |
|---|---|---|---|---|---|
| **Gönüllü** | ✔ asıl iş | | ✔ | ✔ | ✔ |
| **Koordinatör** | sıra dağıtır | ✔ asıl iş | liste basar, kutuyu kapatır | liste tutar | |
| **Uzman/kütüphaneci** | | zor kararlar | | | |
| **Sistem** | yer kodu, sayım, rezervasyon | öneri, gruplama | çekme listesi + kutu numarasını kayda yazar | Kutular sayfası | |

---

## Hangi belge ne için

| Belge | Ne zaman |
|---|---|
| `SUREC.md` (bu belge) | Baştan sona ne olacağını anlamak |
| `KURULUM.md` | Sistemi bir kez kurmak |
| `CALISMA-GUNU.md` | Bir çalışma gününü yönetmek |
| `STRATEJI.md` | Karar kurallarının gerekçesi |
| `tanitim-karti.pdf` | Yeni gelene sistemi anlatırken · SSS |
| `kabul-testi.pdf` | Başlamadan önce, bir kere · 30 dk |
| `gonullu-karti.pdf` | Gönüllünün masasında |
| `kutu-etiketi.pdf` | Kutulara yapıştırılır (yeşil = yeni bina, mor = depo) |
| `surec-afisi.pdf` | Duvara asılır |
| `kural-karti.pdf` | Onay masasında |
| `DENEME.md` | Sistemi denemek |
