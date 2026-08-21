# Kurulum — adım adım

Kitap envanteri sisteminin sıfırdan kurulumu. Teknik bilgi gerektirmiyor;
her adımda ne tıklayacağınız ve ekranda ne göreceğiniz yazıyor.

**Toplam süre:** 40–50 dakika. Yarıda bırakıp sonra devam edebilirsiniz.

**Önce şunu kararlaştırın: hangi Google hesabı?** Tablo, fotoğraflar ve e-postalar
o hesaba bağlı olacak. Mümkünse **kuruma ait bir hesap** kullanın; kişisel hesap
kullanırsanız o kişi ayrıldığında sistem onunla birlikte gider.

---

## Bölüm 1 — Google tarafı (25 dakika)

### 1. Tabloyu açın

Tarayıcıda **sheets.new** yazın. Boş bir Google E-Tablo açılır.

Sol üstteki *"Adsız e-tablo"* yazısına tıklayıp adını değiştirin:
**Tarih Vakfı — Kitap Envanteri**

### 2. Betik düzenleyicisini açın

Üst menüden **Uzantılar → Apps Script**.

**Ne göreceksiniz:** yeni bir sekmede kod düzenleyici açılır, içinde şuna benzer
üç satır vardır:

```js
function myFunction() {
}
```

> **Açılmazsa:** Bu menü bazı hesaplarda çalışmıyor. O zaman yeni sekmede
> **script.new** yazın, aşağıdaki 4. adımda `TABLO_ID` alanını doldurun.
> (Tablonun adres çubuğundaki `/d/` ile `/edit` arasındaki uzun karakter dizisi
> tablonun kimliğidir.)

### 3. Kodu yapıştırın

Düzenleyicideki o üç satırı **silin** (hepsini seçip Delete).
Sonra `apps-script/KitapEnvanteri.gs` dosyasını bir metin düzenleyicide açın,
**tamamını** kopyalayıp bu boş alana yapıştırın.

Sol üstteki *"Adsız proje"* yazısına tıklayıp projeye ad verin: **Kitap Envanteri**

### 4. Ayarları düzenleyin

Yapıştırdığınız kodun en başında `var AYAR = { … }` diye bir bölüm var.
Yalnızca şu satırlara dokunun:

```js
TABLO_ID: '',
```
Uzantılar menüsünden geldiyseniz **boş bırakın**. script.new ile açtıysanız
tablonun kimliğini tırnak içine yazın.

```js
CALISMA_SIFRESI: 'BURAYA_CALISMA_SIFRESI',
```
Gönüllülere söyleyeceğiniz ortak şifre. Form herkese açık bir adreste duracak;
bu şifre yoldan geçenin rastgele kayıt girmesini engeller. Söylemesi kolay olsun.

```js
MEKANLAR: [
  { kod: 'G', ad: 'Giriş Kat' },
  { kod: 'U', ad: 'Üst Kat' },
  { kod: 'D',  ad: 'Depo' },
],
```
Kitapların bulunduğu oda/katlar. `kod` kısa olsun (yer kodunda görünecek),
`ad` gönüllünün menüde okuyacağı açıklama. **Tek mekânda çalışıyorsanız** listede
tek satır bırakın; kod `A03-007` biçimine iner.

```js
RAF_HARFLERI: 'ABCDEFGHIJKL',
```
Bir mekândaki kitaplıklara vereceğiniz harfler. Sekiz kitaplığınız varsa
`'ABCDEFGH'` yazın — fazlasını yazarsanız menüde olmayan raflar görünür.

```js
SIRA_SAYISI: 8,
```
Bir kitaplıkta kaç göz (raf sırası) var. Farklı kitaplıklarda farklıysa **en
büyüğünü** yazın.

Kaydedin: **Ctrl+S** (Mac'te ⌘+S) ya da üstteki disket simgesi.

### 5. `kurulum` fonksiyonunu çalıştırın

Üst şeritte bir açılır liste var, içinde fonksiyon adları yazıyor
(`doGet`, `doPost`, `kurulum`…). Oradan **`kurulum`** seçin ve yanındaki
**▷ Çalıştır** düğmesine basın.

**İlk çalıştırmada Google izin isteyecek.** Sırasıyla:

1. **"Yetkilendirmeyi incele"** → tıklayın
2. Google hesabınızı seçin
3. **"Google bu uygulamayı doğrulamadı"** uyarısı çıkar → **"Gelişmiş"**e tıklayın
4. Altta beliren **"Kitap Envanteri (güvenli değil) sayfasına git"** bağlantısına tıklayın
5. **"İzin ver"**

> Bu uyarı normaldir ve tehlikeli değildir: uygulama sizsiniz. Google, kendi
> yazdığınız betikleri de "doğrulanmamış" sayar çünkü mağazadan geçmemiştir.
> Betik yalnızca sizin açtığınız tabloya ve kendi oluşturduğu Drive klasörüne dokunur.

**Ne göreceksiniz:** Aşağıdaki kayıt bölmesinde "Yürütme tamamlandı" yazar.
E-Tablo sekmesine dönün: alt tarafta **Özet · Envanter · Kurallar · Kutular**
sayfaları oluşmuştur.

### 6. Fotoğraf ve OCR (fotoğrafla çalışacaksanız)

Betik düzenleyicisinde sol taraftaki menüde **Hizmetler** yazıyor, yanında **+**.

**+ → listeden "Drive API" → Ekle.**
(Sağdaki "Kimlik" kutusunda `Drive` yazmalı; değiştirmeyin.)

Sonra yine fonksiyon listesinden **`zamanlayiciKur`** seçip **▷ Çalıştır**.
Bu, beş dakikada bir yeni fotoğrafları okuyup künye önerisi üreten zamanlayıcıyı kurar.

> `kurulum` bu zamanlayıcıyı zaten kurmaya çalışır; ama Drive API'yi sonradan
> eklediyseniz bir kez daha çalıştırmak garantiye alır. İkinci çalıştırma zarar vermez,
> zamanlayıcı zaten varsa hiçbir şey yapmaz.

> Fotoğraf kullanmayacaksanız bu adımı atlayın; sistem yine çalışır.

### 7. Yayınlayın

Sağ üstteki mavi **Dağıt** düğmesi → **Yeni dağıtım**.

Açılan pencerede sol üstte bir **dişli** simgesi var → **Web uygulaması** seçin.
Sonra:

- **Açıklama:** ilk sürüm *(istediğinizi yazabilirsiniz)*
- **Yürüten:** Ben *(kendi e-postanız)*
- **Erişimi olan:** **Herkes**

**Dağıt** → **Web uygulaması URL'si** diye `/exec` ile biten uzun bir adres verir.
**Bu adresi kopyalayın**, bir yere kaydedin. Sonraki bölümde lazım.

> "Erişimi olan: Herkes" ürkütücü görünebilir; gerekli, çünkü telefondaki form
> Google hesabı sormadan kayıt gönderecek. Koruma, girdiğiniz **çalışma şifresi**.

---

## Bölüm 2 — Site tarafı (10 dakika)

Bu bölüm `tarihvakfi.github.io` deposunda çalışır. GitHub Desktop kullanıyorsanız
dosyaları kopyalayıp commit + push demeniz yeterli.

### 8. Dosyaları yerine koyun

Zipten çıkan dosyaları deponun içine şöyle yerleştirin:

| Dosya | Nereye |
|---|---|
| `kitap-envanteri.html` | deponun kökü |
| `kunye-onay.html` | deponun kökü |
| `envanter-manifest.json` | deponun kökü |
| `sw.js` | deponun kökü |
| `assets/envanter-192.png` | `assets/` klasörü |
| `assets/envanter-512.png` | `assets/` klasörü |

### 9. Adresi yazın

`js/gonullu-config.js` dosyasını bir metin düzenleyicide açın. En alttaki satırı
7. adımda kopyaladığınız adresle değiştirin:

```js
window.TV_ENVANTER_URL = "https://script.google.com/macros/s/AKfy.../exec";
```

Tırnak işaretleri kalsın, adres tırnakların arasına girsin.

> Bu dosya yalnızca adresleri tutar. Sayfaları güncellediğimizde bu dosyaya
> dokunmayız; adresi bir daha girmeniz gerekmez.

### 10. Dağıtım listesini kontrol edin

`.github/workflows/deploy.yml` dosyasını açın, `cp index.html` ile başlayan satırı
bulun. Şu dosya adlarının **hepsi** o satırda olmalı:

```
kitap-envanteri.html kunye-onay.html envanter-manifest.json sw.js
```

**Bu satırda adı geçmeyen dosya siteye çıkmaz, adres 404 verir.**
Gönderdiğim `deploy.yml` bunları içeriyor; kendi deponuzda eski sürüm varsa
bu satırı elle tamamlayın.

### 11. Commit + push

GitHub Desktop'ta soldaki *Changes* listesinde değişen dosyaları görürsünüz.
Alta kısa bir açıklama yazın (*"kitap envanteri eklendi"*), **Commit to main**,
sonra üstten **Push origin**.

**Ne göreceksiniz:** 1–2 dakika sonra sayfalar yayında olur:

- Gönüllü formu: `https://tarihvakfi.github.io/kitap-envanteri.html`
- Onay ekranı: `https://tarihvakfi.github.io/kunye-onay.html`

> Açılmazsa iki dakika bekleyip yenileyin. Hâlâ 404 ise GitHub'da deponuzun
> **Actions** sekmesine bakın: yeşil tik varsa yayın tamamdır, kırmızı çarpı varsa
> `deploy.yml` satırında bir dosya adı eksiktir.

---

## Bölüm 3 — Denemesi (10 dakika)

Bu bölümü **mutlaka gönüllü gününden önce** yapın.

1. **Telefonda** `kitap-envanteri.html` adresini açın.
2. Üstte "Uygulama gibi kurabilirsiniz" şeridi çıkar → **Kur**
   (iPhone'da: **Paylaş → Ana Ekrana Ekle**). Artık uygulama gibi açılıyor.
3. Adınızı ve çalışma şifresini girin. **"Çalışma şifresi hatalı" derse** 4. adımdaki
   şifreyi yanlış yazmışsınızdır.
4. Mekân / raf / sıra seçin. Ekranda **"bu sırada 0 kitap kayıtlı · sıradaki: G-A01-001"**
   yazmalı.
5. Bir deneme kitabı girin: başlık yazıp yeşil **Gidecek** düğmesine, sonra bir kurala
   dokunun. Üstte **"G-A01-001 kaydedildi"** çıkmalı.
6. **E-Tabloya bakın:** Envanter sayfasında satır oluşmuş olmalı, Yer kodu dolu.
7. **Fotoğrafı deneyin:** yeni bir kayıtta 📷 düğmesiyle bir kitabın künye sayfasını
   çekin, kaydedin. **10 dakika sonra** tabloda o satırın *OCR durumu* sütunu `bitti`,
   *Öneri başlık* sütunu dolu olmalı.
   - Dolmazsa: 6. adımdaki Drive API eklenmemiş ya da zamanlayıcı kurulmamış olabilir.
   - Yine olmazsa sorun değil; onay ekranında fotoğrafa bakıp künye elle yazılır.
8. **Onay ekranını açın** (`kunye-onay.html`), aynı şifreyle girin, fotoğraflı kaydın
   göründüğünü doğrulayın.
9. **Deneme kayıtlarını silin:** formun altındaki son kayıtlar listesinden **Sil**.

---

## Sonradan değişiklik yaparsanız

**Bu kuralı unutmayın:** Apps Script'te herhangi bir ayarı ya da kuralı
değiştirdiğinizde kaydetmek yetmez. Şunu yapmanız gerekir:

> **Dağıt → Dağıtımları yönet → ✏️ (kalem) → Sürüm: Yeni sürüm → Dağıt**

Bunu atlarsanız site eski ayarlarla çalışmaya devam eder ve "ben değiştirdim ama
olmuyor" dersiniz. En sık yapılan hata budur.

Site dosyalarında (HTML) değişiklik yaptığınızda ise commit + push yeterlidir;
telefonlardaki uygulama sayfayı her açılışta sunucudan tazeler.

---

## Takılırsanız

| Ekranda ne yazıyor | Sebebi | Çözümü |
|---|---|---|
| "Sistem adresi tanımlanmamış" | `js/gonullu-config.js` içine `/exec` adresi yazılmamış | 9. adımı yapın, push edin |
| Sayfa 404 veriyor | `deploy.yml` satırında dosya adı eksik ya da yayın bitmemiş | 10. adım; Actions sekmesine bakın |
| "Çalışma şifresi hatalı" | Şifre yanlış yazıldı **ya da** şifreyi değiştirdiniz ama yeni sürüm dağıtmadınız | Şifreyi kontrol edin; sonra "Yeni sürüm" dağıtın |
| "Yetkiniz yok" / izin ekranı tekrar çıkıyor | Yetkilendirme yarıda kalmış | `kurulum`'u yeniden çalıştırıp izin akışını sonuna kadar götürün |
| Uzantılar → Apps Script açılmıyor | Hesap kısıtı | script.new ile ayrı proje açıp `TABLO_ID` doldurun (2. adımdaki not) |
| OCR durumu hep "bekliyor" | Drive API eklenmemiş ya da zamanlayıcı kurulmamış | 6. adım. Olmazsa OCR'siz devam edin, sistem çalışır |
| Ayarı değiştirdim, sitede eskisi görünüyor | Yeni sürüm dağıtılmadı | Yukarıdaki "Sonradan değişiklik" kutusu |
| Telefonda hiçbir şey açılmıyor | Bağlantı yok ve sayfa daha önce hiç açılmamış | Bağlantı olan bir yerde bir kez açın; sonrasında çevrimdışı da açılır |

---

## Kurulum bitti — sırada ne var

1. `raf-etiketleri.py` içindeki üç satırı 4. adımdaki ayarlarla **aynı** yapıp
   çalıştırın, PDF'i bastırın, etiketleri raflara yapıştırın.
2. Kural kartını yönetime onaylatıp laminatlayın.
3. `gun-listesi.pdf`'i bastırıp koordinatör masasına asın.
4. Gönüllülere adresi ve şifreyi gönderin.

Günün nasıl yürüyeceği: **Çalışma Günü Kılavuzu** (`CALISMA-GUNU.md`).
