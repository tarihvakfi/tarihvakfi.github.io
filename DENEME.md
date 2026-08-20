# Sistemi denemek

İki yol var. **A yolu** Google kurulumu istemez, beş dakikada başlarsınız —
sistemin nasıl çalıştığını görmek ve gönüllüleri eğitmek için.
**B yolu** gerçek sistemin testidir; kurulum bittikten sonra yapılır.

---

## A) Deneme sayfası — kurulum yok, 5 dakika

`envanter-deneme.html` ve `kunye-onay-deneme.html` gerçek sayfaların birebir aynısıdır.
Tek farkı: **arka uç telefonun içindedir.** Google'a hiçbir şey gitmez, kayıtlar yalnızca
o telefonda durur, istediğiniz kadar saçmalayabilirsiniz.

**Yayına almak:** iki dosyayı deponun köküne kopyalayın, commit + push. İki dakika sonra:

- **tarihvakfi.github.io/envanter-deneme.html**
- **tarihvakfi.github.io/kunye-onay-deneme.html**
- **tarihvakfi.github.io/envanter-katalog-deneme.html**

Üstte koyu bir şerit görürsünüz: *DENEME MODU — kayıtlar yalnızca bu telefonda.*
Şeritte iki düğme var: **İnterneti kes** (bağlantı kesintisini taklit eder) ve
**Deneme kayıtlarını sil**.

**Şifreler:** gönüllü formu `deneme` · onay ekranı ve katalog `koordinator`

### Vakıfta 15 dakikalık test

Elinize gerçek bir kitap alın ve sırayla:

| # | Ne yapıyorsunuz | Görmeniz gereken |
|---|---|---|
| 1 | Adresi telefonda açın | Koyu deneme şeridi ve giriş ekranı |
| 2 | Adınızı yazın, şifreye **yanlış** bir şey yazıp Başla | "Çalışma şifresi hatalı" |
| 3 | Şifreye `deneme` yazıp Başla | Mekân / raf / sıra ekranı |
| 4 | G · A rafı · 1. sıra seçin | Altta **G-A01 · bu sırada 0 kitap kayıtlı · sıradaki: G-A01-001** |
| 5 | "Bu sırada çalışmaya başla" | Üst şeritte **G-A01**, altında *sıradaki 001* |
| 6 | Elinizdeki kitabın yazar/başlık/yılını yazın, **Gidecek** → bir kural | **G-A01-001 kaydedildi**, form temizlendi, üstte *sıradaki 002* |
| 7 | İkinci kitap: hiçbir şey yazmadan **künye sayfası** kutusundaki 📷 → sol sayfayı çekin; sonra **kapak** kutusundan kapağı çekin | İki kutuda da küçük fotoğraf ve "Hazır · ~40 KB" |
| 8 | Başlığı boş bırakıp **Gitse de olur** → bir kural | **G-A01-002 kaydedildi — künye fotoğraftan tamamlanacak** |
| 9 | Şeritteki **İnterneti kes**e basın, üçüncü bir kitap kaydedin | Turuncu şerit: *G-A01-003 telefona kaydedildi*; üstte **çevrimdışı** rozeti; sarı kutuda *1 kayıt gönderilmeyi bekliyor* |
| 10 | **İnterneti aç** → sarı kutudaki **Tekrar dene** | Sarı kutu kayboluyor |
| 11 | Alttaki son kayıtlardan birinde **Düzelt**, başlığı değiştirip yeniden kaydedin | "#N güncellendi" |
| 12 | Bir kaydı **Sil** → **Evet** | Listeden kalkıyor |

Sonra masaya oturun:

| # | Ne yapıyorsunuz | Görmeniz gereken |
|---|---|---|
| 13 | `kunye-onay-deneme.html` açın, **koordinator** şifresiyle girin | Solda çektiğiniz **gerçek fotoğraf**, üstünde **Künye sayfası / Kapak** sekmeleri, sağda künye alanları |
| 14 | Başlığı yazıp **Onayla ve sıradaki** | "#N onaylandı", bekleyen sayısı azalıyor |
| 15 | `envanter-katalog-deneme.html` açın, **koordinator** şifresiyle girin | Onayladığınız kitap **kapak fotoğrafıyla** kart hâlinde görünüyor |
| 16 | Kapsamı **Tüm kayıtlar** yapın, arama kutusuna bir kelime yazın | Liste süzülüyor |

**Bitince:** şeritteki **Deneme kayıtlarını sil** ile temizleyin.

> **Denemede ne gerçek değil:** künye önerisi. Gerçek sistemde fotoğraftan okunur;
> denemede sabit bir örnek metin gelir. Onun dışında gördüğünüz her şey —
> kayıt akışı, yer kodu, çevrimdışı kuyruk, düzeltme, onay ekranı — gerçeğin aynısı.

Bu sayfayı silmeyin: **yeni gönüllüye beş dakikada sistemi öğretmenin en kolay yolu**
budur. Yanlış kayıt gerçek tabloyu kirletmez.

---

## B) Gerçek sistem testi — kurulum bittikten sonra, 15 dakika

Aynı 14 adımı bu kez gerçek adreslerde (`kitap-envanteri.html`, `kunye-onay.html`) ve
gerçek çalışma şifrenizle yapın. Farklı olarak dördü şu:

**1. Tabloya bakın.** 6. adımdaki kayıt Google E-Tablo'nun **Envanter** sayfasında
bir satır olarak durmalı; Yer kodu sütunu `G-A01-001` olmalı.

**2. Fotoğrafı Drive'da görün.** Drive'ınızda **Kitap Künye Fotoğrafları** klasörü
oluşmuş ve içinde çektiğiniz fotoğraf olmalı.

**3. OCR'ı bekleyin.** Fotoğraflı kaydın *OCR durumu* sütunu önce `bekliyor` yazar.
**On dakika sonra** `bitti` olmalı ve *Öneri başlık* sütunu dolmalı.
- Olmazsa: Apps Script'te Drive API eklenmemiş ya da zamanlayıcı kurulmamıştır.
- Yine olmazsa sistem çalışmaya devam eder; künye onay ekranında fotoğrafa bakıp
  elle yazarsınız. OCR bir hızlandırıcıdır, şart değildir.

**4. Çevrimdışını gerçekten deneyin.** Telefonu **uçak moduna** alın, iki kayıt girin,
uçak modunu kapatın, **Tekrar dene** deyin, tabloda iki yeni satırın belirdiğini görün.
Bu, vakıftaki zayıf bağlantının provasıdır — atlamayın.

**Test bitince deneme kayıtlarını silin:** formun altındaki son kayıtlar listesinden
**Sil** deyin. Tabloda satır kalmasın; gerçek çalışma temiz bir tablodan başlasın.

---

## Ne zaman "sistem hazır" denir

- [ ] Deneme sayfasında 14 adımın hepsi çalıştı
- [ ] Gerçek sistemde kayıt tabloya düştü, yer kodu doğru
- [ ] Fotoğraf Drive'a çıktı
- [ ] OCR on dakika içinde öneri üretti *(üretmezse bilinçli olarak vazgeçildi)*
- [ ] Uçak modu testi geçti, kayıtlar bağlantı gelince tabloya düştü
- [ ] Onay ekranı fotoğrafı gösterdi, onaylanan künye tabloya yazıldı
- [ ] Deneme kayıtları silindi
