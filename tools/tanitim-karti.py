#!/usr/bin/env python3
"""Tanıtım kartı — koordinatörün elinde durur, yeni gelene sistemi anlatır.

İki sayfa:
  1. Ne diyeceğiniz — gönüllüye 2 dakika, koordinatöre 10 dakika
  2. Ne sorulacağı — sık sorulan sorular ve hazır cevaplar

Ezberlenecek bir metin değil; kelimesi kelimesine okunabilir ama kendi
ağzınızla söylemeniz daha iyi. Önemli olan üç cümlenin geçmesi:
kitap raftan çıkmıyor · karar sizin işiniz değil · hiçbir kitap atılmıyor.

    python3 tanitim-karti.py
"""

GONULLU_SSS = [
    ("Bu kitapları atacak mısınız?",
     "<b>Hayır.</b> “Gitmeyecek” denenler yerinde ya da depoda kalıyor. Ne olacaklarına "
     "sonra, yönetim onayıyla karar verilecek. Atılan kitap geri gelmez — o yüzden "
     "acele etmiyoruz."),
    ("Ben telefon kullanmayı bilmiyorum.",
     "İki tuşa basıyorsunuz: fotoğraf ve kaydet. Beş dakikada birlikte deneriz, "
     "sonra kolay geliyor."),
    ("Yazı yazmam gerekmiyor mu?",
     "Hayır. Yazmanız işi yavaşlatır. Fotoğraf yeter — yazıyı bilgisayar okuyor."),
    ("Yanlış çektim, ne olacak?",
     "Alttaki <b>son kayıtlarınız</b> listesinden <b>Düzelt</b>. Yanlış sıradaysa "
     "<b>Sil</b> deyip doğru yerde yeniden girin. Hiçbir şey kaybolmaz."),
    ("İnternet gitti, kayıtlar kayboldu mu?",
     "Hayır, telefonunuzda birikiyor. Bağlantı gelince kendiliğinden gidiyor. "
     "<b>Sarı uyarı sönmeden gitmeyin</b>, tek dikkat edeceğiniz bu."),
    ("Aynı kitaptan beş tane var.",
     "Tek kayıt açın, <b>Ayrıntı ekle → nüsha</b> alanına 5 yazın. Beş kere çekmeyin."),
    ("Fotoğraflar nereye gidiyor?",
     "Vakfın Google hesabına. Sizin telefonunuzda kalmıyor, kimseyle paylaşılmıyor."),
    ("Kaç kitap yapmam lazım?",
     "Kişi hedefi yok. Yavaş ve doğru, hızlı ve yanlıştan iyidir."),
    ("Sıranın bittiğini nasıl anlarım?",
     "Siz karar vermiyorsunuz. <b>Sırayı bitir</b>'e basıp rafı sayıyorsunuz; "
     "sistem kendi sayısıyla karşılaştırıp tutuyor mu söylüyor."),
    ("Bir kitap çok kötü durumda.",
     "<b>⚠ Sorunlu kitap</b>. Küf ya da böcek varsa poşetleyin, ayrı yere koyun, "
     "koordinatöre <b>hemen</b> söyleyin. Bulaşıcıdır."),
    ("İçinden mektup / fotoğraf çıktı.",
     "Yerinde bırakın, <b>Ayrıntı ekle → Not</b>'a yazın, koordinatöre gösterin."),
    ("Şifreyi unuttum.",
     "Koordinatörde. Karttaki QR'ı okutursanız şifre zaten içinde geliyor."),
]

KOORDINATOR_SSS = [
    ("İki kişi aynı rafı yaparsa?",
     "Yapamaz. Sıra verilen kişiye ayrılıyor; başkası o sırayı seçmeye kalkarsa "
     "“… üzerinde” uyarısı çıkıyor."),
    ("Yarım kalan sırayı ertesi gün gelen nasıl bulur?",
     "Sistem söylüyor: kaç kitap kaydedilmiş ve son kaydedilen kitabın adı + kapak "
     "fotoğrafı. Rafa ayraç konmuyor, kimsenin bir şey hatırlaması gerekmiyor."),
    ("Bir kitap atlanırsa?",
     "Sıra kapanışındaki fiziksel sayım yakalar. Sistemin sayısıyla tutmuyorsa "
     "sıra kapanmaz."),
    ("Yanlış karar verirsem?",
     "Geri alınabilir. Kitap fiziksel olarak ayrılana kadar hiçbir şey kesin değil."),
    ("Veri kaybolur mu?",
     "Her gece otomatik yedek alınıyor. Silinen kayıtlar da gerçekten silinmiyor, "
     "işaretleniyor."),
    ("Neye bakmam lazım?",
     "Tek sayı: <b>bekleyen künye</b>. Düşmüyorsa masaya ikinci kişi lazım. Bir de "
     "panodaki <b>“Bugün dikkat”</b> kartı — yeşilse hiçbir şey yapma."),
    ("Gönüllü sayısını artırsam hızlanır mı?",
     "Hayır, tersi. Darboğaz masa. Gönüllü eklemek kuyruğu büyütür sadece."),
    ("Ne kadar sürecek?",
     "Pilottan sonra net söylenir: bir kitabın kaç saniye sürdüğüne bağlı. "
     "Önce bir sırayı ölçün, sonra çarpın."),
]


def sss(baslik, liste, sinif):
    satirlar = "\n".join(
        f'      <div class="s"><div class="q">{q}</div><div class="a">{a}</div></div>'
        for q, a in liste)
    return f'''    <div class="sss {sinif}">
      <h2>{baslik}</h2>
{satirlar}
    </div>'''


html = f"""<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Tanıtım kartı</title>
<style>
  @page {{ size: A4; margin: 11mm; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family:'DejaVu Sans',Arial,sans-serif; color:#211a1d;
         font-size:9pt; line-height:1.42; }}
  .bas {{ border-bottom:2.5px solid #601040; padding-bottom:6px; margin-bottom:11px; }}
  .bas h1 {{ margin:0; font-size:16pt; color:#601040; letter-spacing:-.2px; }}
  .bas span {{ font-size:8.6pt; color:#74686e; }}

  .uc {{ background:#601040; color:#fff; border-radius:8px; padding:9px 13px;
        margin-bottom:12px; font-size:9.6pt; }}
  .uc b {{ color:#ffd9a8; }}

  .konus {{ border:1.8px solid #d8ccc4; border-radius:9px; margin-bottom:11px;
           overflow:hidden; }}
  .konus h2 {{ margin:0; padding:7px 12px; font-size:11pt; background:#f4ece7;
              border-bottom:1.5px solid #d8ccc4; color:#601040; }}
  .konus h2 em {{ font-style:normal; font-weight:400; font-size:9pt; color:#74686e; }}
  .konus .ic {{ padding:9px 13px; }}
  .konus p {{ margin:0 0 7px; }}
  .konus p:last-child {{ margin-bottom:0; }}
  .konus b {{ color:#601040; }}

  .sss {{ border:1.8px solid #d8ccc4; border-radius:9px; overflow:hidden;
         margin-bottom:10px; page-break-inside:avoid; }}
  .sss h2 {{ margin:0; padding:6px 12px; font-size:10.5pt; background:#f4ece7;
            border-bottom:1.5px solid #d8ccc4; color:#601040; }}
  .sss.mor {{ border-color:#5b3a8e; }}
  .sss.mor h2 {{ background:#ece6f7; border-color:#5b3a8e; color:#402868; }}
  .s {{ padding:6px 12px; border-bottom:1px solid #efe7e2; }}
  .s:last-child {{ border-bottom:0; }}
  .q {{ font-weight:700; font-size:9pt; }}
  .q::before {{ content:'“'; }} .q::after {{ content:'”'; }}
  .a {{ font-size:8.7pt; color:#3c3238; margin-top:2px; }}

  .kir {{ page-break-before:always; }}
  .sutunlar {{ column-count:2; column-gap:7mm; }}
  .sutunlar .sss {{ break-inside:avoid; }}
  .dip {{ margin-top:9px; padding-top:7px; border-top:1.5px solid #e6dcd6;
         font-size:8pt; color:#74686e; }}
</style></head><body>

  <div class="bas">
    <h1>Tanıtım Kartı — sistemi nasıl anlatırsınız</h1>
    <span>Tarih Vakfı Kütüphanesi · Taşınma · onay masasında dursun</span>
  </div>

  <div class="uc">
    <b>Üç cümle geçsin, gerisi ayrıntı:</b> &nbsp;
    1) Kitap rafından çıkmıyor. &nbsp; 2) Hangi kitabın gideceğine gönüllü karar
    vermiyor. &nbsp; 3) Hiçbir kitap atılmıyor.
  </div>

  <div class="konus">
    <h2>Gönüllüye — 2 dakika <em>· ilk geldiğinde, masada</em></h2>
    <div class="ic">
      <p>“Kütüphaneyi taşıyoruz. Taşımadan önce elimizde ne var, onu bilmemiz lazım.</p>
      <p><b>Sizin işiniz fotoğraf çekmek.</b> Telefonu açıyorsunuz, sistem size bir
        raf gözü veriyor. O gözdeki kitapları tek tek alıp künye sayfasının ve kapağın
        fotoğrafını çekiyor, kaydet diyorsunuz. Kitabı yerine koyuyorsunuz. Hepsi bu.</p>
      <p><b>Hiçbir şey yazmanıza gerek yok</b> — yazıyı bilgisayar okuyor.</p>
      <p><b>Hangi kitabın gideceğine siz karar vermiyorsunuz.</b> O karar masada,
        sizin çektiğiniz fotoğrafa bakılarak veriliyor. Siz kaydedin, geçin.</p>
      <p><b>Kitap rafından çıkmıyor.</b> Aldınız, çektiniz, yerine koydunuz.</p>
      <p>Yanlış yaparsanız sorun değil, geri alınabiliyor. <b>Emin olmadığınızda
        durmayın</b> — nota yazıp devam edin.”</p>
      <p style="color:#74686e;font-size:8.4pt">Sonra <b>gönüllü kartını</b> eline
        verin. Aynı şeyler orada da yazıyor.</p>
    </div>
  </div>

  <div class="konus">
    <h2>Koordinatöre — 10 dakika <em>· masaya oturmadan önce</em></h2>
    <div class="ic">
      <p>“Bu, kitapların künyesini toplayan ve nerede olduğunu takip eden bir defter.
        Google E-Tablo'nun üstünde çalışıyor — istersen tabloyu açıp elle de
        bakabilirsin, sihir yok.</p>
      <p><b>İş birimi bir raf gözü.</b> Bir göz baştan sona bir bütün olarak ilerliyor:
        gönüllü kaydediyor → sen karar veriyorsun → ekip ayırıp kutuluyor. Bütün
        kütüphanenin ilk adımı bitmeden ikinciye geçilmesini beklemiyoruz; her göz
        kendi hızında akıyor.</p>
      <p><b>Senin işin masada karar vermek.</b> Sistem bir kural öneriyor ve ön-seçili
        getiriyor; katılıyorsan Enter, katılmıyorsan değiştiriyorsun. Kuyruk kabarınca
        kendiliğinden gruplu onaya geçiyor.</p>
      <p><b>Bakacağın tek sayı: bekleyen künye.</b> Düşmüyorsa masaya ikinci kişi
        lazım — gönüllü eklemek durumu kötüleştirir, çünkü darboğaz sensin.</p>
      <p><b>Panoda “Bugün dikkat” kartı var.</b> Her şey yolundaysa yeşil; sorun varsa
        yalnızca o sorunu yazıyor. Günde iki kere bakman yeter.”</p>
    </div>
  </div>

  <p class="dip">
    Bu metni ezberlemeyin, kendi ağzınızla söyleyin. Yeni gelen birine anlatırken
    <b>ilk 30 saniyede</b> “karar sizin işiniz değil” cümlesi geçsin — en çok kaygı
    yaratan konu bu.
  </p>

  <div class="kir">
    <div class="bas">
      <h1>Sık Sorulanlar</h1>
      <span>Hazır cevaplar · gönüllü ve koordinatör</span>
    </div>

    <div class="sutunlar">
{sss('Gönüllülerden gelen sorular', GONULLU_SSS, '')}
{sss('Koordinatörlerden gelen sorular', KOORDINATOR_SSS, 'mor')}
    </div>

    <p class="dip">
      Cevabını bilmediğiniz bir soru gelirse <b>uydurmayın</b> — “bakıp söyleyeceğim”
      deyin. Yanlış cevap, cevapsız sorudan pahalıya patlar.
    </p>
  </div>

</body></html>"""

with open('tanitim-karti.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('yazıldı: tanitim-karti.html')
