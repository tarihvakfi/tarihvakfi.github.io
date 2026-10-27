# Kronoloji sitesi: "Otuz beş yıl, bir rafta"

Menüde üç sayfa var:

- `index.html`: **Kronoloji**, sitenin ön sayfası. Yıllar raftaki ciltler olarak; seçilen
  yılın kayıtları çizimleriyle, "Bugün, geçmiş yıllarda" ve "Yedi dönemden yedi iz".
- `archive.html`: **Arşiv**. Arama, süzme ve atıf aynen çalışır; kartlarda kaydın çizimi görünür.
- `dashboard.html`: **Görsel Özet**. Sayılar ve grafikler korunur; yalnızca görünüm değişti.

Menüde olmayan iki sayfa, kayıtlardan açılır:

- `item.html`: Kayıt sayfası (paylaşılan bağlantılar ve atıflar buraya gelir). Kaydın
  büyük çizimi ve "yılını rafta açın" bağlantısı eklendi.
- `contribute.html`: Düzeltme formu. Bir kayıttan gelindiyse o kaydın çizimi formun
  başında görünür. Ayrıca her sayfanın altından erişilir.

`timeline.html` artık `index.html`'e yönlendirir; eski bağlantılardaki arama (`?q=`),
tür (`?kind=`), dönem (`?period=`) ve yıl/kayıt (`#y1996`, `#TV00019`) korunur.

Arşiv, görsel özet, kayıt sayfası ve düzeltme formu `site.js` ile
çalışmaya devam eder: düzenlenebilir site metinleri ("Site Metinleri" sekmesi),
süzgeçler, sayfalama, atıf kopyalama, düzeltme gönderimi ve canlı veri yenilemesi
değişmedi. Bu sayfalarda yalnızca başlık ve görünüm değişti; içerik alanlarının
kimlikleri (`id`) ve `data-content` anahtarları korundu. Ön sayfanın metinleri de
"Site Metinleri"nden değiştirilebilir: `raf.hero.title`, `raf.hero.lead`,
`raf.search.placeholder`, `raf.eras.title`, `raf.eras.lead`, `raf.footer.note`.
Menü adları her sayfada `nav.timeline`, `nav.archive`, `nav.dashboard` anahtarlarından gelir.

## Dosyalar

| Dosya | Durum |
|---|---|
| `index.html` | Yeniden yazıldı: Kronoloji artık ön sayfa |
| `timeline.html` | `index.html`'e yönlendirme |
| `archive.html`, `dashboard.html`, `item.html`, `contribute.html` | Başlık, stil ve betik bağlantıları değişti; içerik aynı |
| `assets/css/raf.css` | Yeni: ortak görünüm, çizimler, Kronoloji sayfası |
| `assets/css/raf-pages.css` | Yeni: `site.js` sayfalarının yeni görünümü |
| `assets/js/raf-art.js` | Yeni: çizimler ve veri temizliği (tüm sayfalar kullanır) |
| `assets/js/raf.js` | Yeni: Kronoloji (ön sayfa) |
| `assets/js/raf-enhance.js` | Yeni: arşiv, kayıt ve düzeltme sayfalarına çizim ekler |
| `assets/img/kayitlar/` | Yeni klasör (kayıt görselleri için) |
| `apps-script/ChronologyPublicApi.gs` | Değişti (isteğe bağlı görsel sütunları) |

`site.js`, `config.js`, `editorial.js`, `style.css` ve veri dosyalarına dokunulmadı.
`editorial.js`, `editorial.css` ve `assets/img/archive-collage.png`, `archive-themes.png`
artık hiçbir sayfada kullanılmıyor; istenirse silinebilir.

## Veri

Sayfa, sitenin geri kalanıyla aynı kaynakları okur: önce
`assets/data/chronology_public.json`, ardından arka planda `config.js` içindeki
canlı Apps Script adresi. Sütunlar ada göre okunur; editörlerin satır ve sütun
eklemesi, silmesi sayfayı bozmaz.

Yayına çıkmadan önce sayfada şu temizlik yapılır (kaynak tablo değişmez):

- Aynı etkinlik her türü için ayrı satıra girildiyse (aynı yıl, tarih ve başlık),
  tek kayıt olarak gösterilir ve tüm türleri taşır.
- "2006–05–01 00:00:00" gibi tablo zaman damgaları "1 Mayıs 2006" olarak gösterilir.
- Yılı olmayan tarihlere ("23 Şubat") yıl eklenir.
- Kategori alanındaki editör notları ve kısa iç kodlar (`osm4`, `kit 100` vb.)
  ve `D_` öneki herkese açık sayfada gösterilmez.
- Yalnızca "[Gizli bilgi içeriyor]" olan kayıtlar gösterilmez.

Bu kurallar `assets/js/raf-art.js` içindeki `normalizeRow` ve `prepareRecords`
fonksiyonlarındadır. Arşiv ve Görsel Özet `site.js` verisini olduğu gibi gösterir;
bu temizlik orada henüz uygulanmıyor.

Bir kaydın neye çizileceğine faaliyet kodu karar verir; kod ile faaliyet grubu
çeliştiğinde grup esas alınır. Örneğin kodu boş kalan toplantılar `site.js` ve Apps
Script'te `ÖTY` (öteki yayın) koduyla ama "Toplantılar" grubunda işaretleniyor;
bunlar yayın değil toplantı olarak çizilir.

## Çizimler ve görseller

Her kayıt, ne olduğuna göre çizilir: yayın kapağı, dergi kapağı, davetiye,
afiş, proje dosyası ya da kurum belgesi. Çizimler yalnızca kayıttaki bilgilerle
(başlık, tarih, sayı, konuşmacı, yayınevi) hazırlanır; sayfada temsili olduğu
yazılıdır. Faaliyet kodu varsa (TT, YYA, SER, KON…) neyin çizileceğini kod belirler.

Gerçek görsel eklemek için editör tablosuna iki isteğe bağlı sütun eklenir:

| Sütun başlığı | İçerik |
|---|---|
| `Görsel` | `assets/img/kayitlar/` içindeki dosya adı (ör. `tt-334.jpg`) ya da tam adres |
| `Görsel Kaynağı` | Kaynak satırı (ör. `Tarih Vakfı Arşivi`) |

Görseli olan kayıtta çizimin yerini görsel alır; olmayanlar çizimde kalır.
Görsel dosyaları bu depoda, `kronoloji/assets/img/kayitlar/` klasöründe tutulur;
başka bir sitenin adres değişikliği kronolojiyi bozmasın diye.

Sütunların canlı veriye geçmesi için güncellenen `ChronologyPublicApi.gs`
Apps Script projesine kopyalanıp **yeni sürüm olarak yeniden dağıtılmalıdır**
(Dağıt → Dağıtımları yönet → Düzenle → Yeni sürüm). Web uygulaması adresi
değişmez. Sütunlar eklenmezse hiçbir şey değişmez.

## Bağlantılar

Ön sayfa şu bağlantıları anlar (eski `timeline.html` adresleri de buraya yönlenir):

- `index.html?q=sergi`: aramayla açar
- `index.html?kind=publication`: türe göre süzer

- `index.html#y1996`: o yılı açar
- `index.html#TV00019`: o kaydı açar
- "Kayıt sayfası" düğmesi mevcut `item.html?id=…` sayfasına gider; "Bağlantıyı
  kopyala" da bu adresi kopyalar.
- Düzeltme davetleri mevcut `contribute.html?id=…&title=…` formunu açar.

## Yerelde deneme

```bash
python3 -m http.server
# http://localhost:8000/kronoloji/
```
