#!/usr/bin/env python3
"""Gönüllü kartı — bir sayfa, masaya konur, yeni gelen okur.

Kural kartı (kural-karti.pdf) artık koordinatör masasına ait; gönüllü
sınıflandırma yapmıyor. Bu kart onun yerine geçiyor:
"rastgele bir gün geldim, ne yapacağım?" sorusunun tek sayfalık cevabı.

    python3 gonullu-karti.py
"""

html = """<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Gönüllü kartı</title>
<style>
  @page { size: A4; margin: 11mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:'DejaVu Sans',Arial,sans-serif; color:#211a1d;
         font-size:8.4pt; line-height:1.32; }
  .bas { border-bottom:2.5px solid #601040; padding-bottom:5px; margin-bottom:8px; }
  .bas h1 { margin:0; font-size:16pt; color:#601040; letter-spacing:-.2px; }
  .bas span { font-size:8.6pt; color:#74686e; }
  .altin { background:#fdf0e6; border:1.6px solid #601040; border-radius:7px;
           padding:6px 10px; margin-bottom:8px; font-size:8.8pt; }
  .adimlar { counter-reset:a; margin:0 0 8px; padding:0; list-style:none; }
  .adimlar > li { counter-increment:a; position:relative; padding:4px 0 4px 30px;
                  border-bottom:1px solid #e6dcd6; }
  .adimlar > li:last-child { border-bottom:0; }
  .adimlar > li::before { content:counter(a); position:absolute; left:0; top:6px;
      width:22px; height:22px; border-radius:50%; background:#601040; color:#fff;
      font-weight:700; font-size:10.5pt; text-align:center; line-height:22px; }
  .adimlar b { color:#601040; }
  .adimlar small { display:block; color:#74686e; font-size:8.3pt; margin-top:2px; }
  .sut { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
  .kutu { border:1.6px solid #d8ccc4; border-radius:7px; overflow:hidden; }
  .kutu h2 { margin:0; padding:6px 10px; font-size:10pt; background:#f4ece7;
             border-bottom:1.4px solid #d8ccc4; }
  .kutu ul { margin:0; padding:5px 9px 6px 23px; }
  .kutu li { margin-bottom:3px; }
  .yesil h2 { background:#e4f0e7; border-color:#2e6440; color:#22502f; }
  .yesil { border-color:#2e6440; }
  .kirmizi h2 { background:#fbe6e9; border-color:#9c2233; color:#8a1c2c; }
  .kirmizi { border-color:#9c2233; }
  .vurgu { background:#601040; color:#fff; border-radius:7px; padding:5px 10px;
           margin:8px 0; font-size:8.6pt; }
  .vurgu b { color:#ffd9a8; }
  .kod { display:inline-block; background:#601040; color:#fff; border-radius:4px;
         padding:0 5px; font-weight:700; font-size:8.6pt; margin-right:5px; }
  table { width:100%; border-collapse:collapse; font-size:8.4pt; }
  td, th { border:1px solid #d8ccc4; padding:3.5px 6px; text-align:left; vertical-align:top; }
  th { background:#f4ece7; font-size:8.4pt; }
  .dip { margin-top:7px; font-size:7.8pt; color:#74686e; border-top:1px solid #e6dcd6;
         padding-top:6px; }
</style></head><body>

  <div class="bas">
    <h1>Gönüllü Kartı — Kitap Envanteri</h1>
    <span>Tarih Vakfı Kütüphanesi · Taşınma · bugün ilk kez geldiyseniz bu kart yeter</span>
  </div>

  <div class="altin">
    <b>Sizin işiniz kitabı kaydetmek.</b> Kitabın nereye gideceğine
    <b>siz karar vermiyorsunuz</b> — o kararı koordinatör, masa başında, fotoğrafa
    bakarak verecek. Siz hızlı ve eksiksiz kaydedin, yeter.
    <br><b>Hiçbir kitap atılmıyor:</b> bir kısmı yeni binaya taşınacak, kalanlar
    yerinde duracak — eski raflar depo olacak. İkisinin de kaydı sizde.
  </div>

  <ol class="adimlar">
    <li><b>Adınızı ve çalışma şifresini yazın.</b>
      <small>QR kodu okutun. Telefon "Ana ekrana ekle" derse kabul edin — uygulama gibi
      açılır, internet kesilince de çalışır.</small></li>

    <li><b>"Bana sıra ver"e basın.</b>
      <small>Sistem size bir sıra verir ve adınıza ayırır. Başka kimse o sıraya
      gönderilmez. Ekrandaki uyarıyı okuyun, sonra rafa gidin.</small></li>

    <li><b>10–15 kitabı birlikte alın, masaya dizin.</b>
      <small>Tek tek çekip yerine koymayın — blok hâlinde alın, işleyin, aynı sırayla
      geri koyun. <b>Kutuya koyuyorsanız</b> geri koymayın.</small></li>

    <li><b>Her kitap için: çek — çek — kaydet.</b>
      <small>Künye fotoğrafı, kapak fotoğrafı, <b>Kitabı kaydet</b>. Hepsi bu.
      <b>Hiçbir şey yazmanıza gerek yok.</b> Yazmak isterseniz <b>Ayrıntı ekle</b>;
      küf/hasar varsa <b>⚠ Sorunlu kitap</b>.</small></li>

    <li><b>Sıra bitince "Sırayı bitir"e basın, kitapları sayın.</b>
      <small>Sistem kendi sayısıyla karşılaştırır; eksik varsa hemen söyler.
      Poşetlediğiniz küflü kitapları saymayın. Sonra yeni sıra alın.
      <b>Gitmeden önce sarı "bekleyen kayıt" uyarısının söndüğüne bakın.</b></small></li>
  </ol>

  <div class="vurgu">
    <b>Sıra ekranındaki uyarı ne diyor?</b> &nbsp;
    “boş sıra” → baştan başlayın. &nbsp;
    “yarım kalmış” → mavi kutuya bakın. &nbsp;
    “BİTMİŞ” ya da “… ÜZERİNDE” → başka sıra alın.
  </div>

  <div class="kutu" style="margin-bottom:9px;border-color:#2a5b86">
    <h2 style="background:#eef4fa;border-color:#2a5b86;color:#1f4260">
      Yarım kalmış sırayı devralıyorsanız</h2>
    <ul style="padding:6px 10px 7px 23px">
      <li>Mavi kutu size <b>rafta kaç kitaba kadar sayacağınızı</b> söyler —
        soldan sayın, <b>sonraki kitaptan</b> devam edin.</li>
      <li>Altında <b>son kaydedilen kitabın adı ve kapağı</b> var.
        Saydığınız kitap oysa yer doğrudur; <b>tutmuyorsa tekrar sayın.</b></li>
      <li><b>Turuncu şerit varsa</b> bilgi eskidir (bağlantı yok). Ad tutmuyorsa
        o sırayı almayın, koordinatöre söyleyin.</li>
      <li>Rafta ayraç, kâğıt, işaret aramayın — <b>hepsi ekranda.</b></li>
    </ul>
  </div>

  <div class="sut">
    <div class="kutu yesil">
      <h2>✔ Siz yapıyorsunuz</h2>
      <ul>
        <li>Sıra almak ve bitirmek</li>
        <li><b>Künye + kapak fotoğrafı</b> — asıl işiniz bu</li>
        <li>Nüsha sayısı (aynı kitaptan kaç tane)</li>
        <li><b>Sorunlu kitap</b> işaretlemek</li>
        <li>Not — fark ettiğiniz her şey</li>
        <li>Rafı sayıp sırayı kapatmak</li>
      </ul>
    </div>
    <div class="kutu kirmizi">
      <h2>✘ Siz yapmıyorsunuz</h2>
      <ul>
        <li>Gidecek mi, gitmeyecek mi kararı</li>
        <li>Kural kodu seçmek (Y1, S2, K3…)</li>
        <li>Künyeyi elle yazmak <em>(fotoğraf varsa gereksiz)</em></li>
        <li>Kitap ayırmak <em>(çekme sonra, listeyle)</em></li>
        <li>Yer kodu yazmak — sistem veriyor</li>
        <li>Kitabı rafından çıkarmak
          <em>(küflü kitap hariç — onu poşetleyin)</em></li>
      </ul>
    </div>
  </div>

  <div style="margin-top:8px">
    <table>
      <tr><th style="width:38%">Karşılaştığınız durum</th><th>Ne yapacaksınız</th></tr>
      <tr><td><b>Küf, böcek, rutubet kokusu</b></td>
          <td><b>⚠ Sorunlu kitap</b> → "Küflü/böcekli". Kitabı poşetleyin, ayrı yere koyun,
              <b>koordinatöre hemen söyleyin</b>. Bulaşıcıdır. Sayarken saymayın.</td></tr>
      <tr><td>İçinden mektup, fotoğraf, belge çıktı</td>
          <td>Yerinde bırakın, <b>Ayrıntı ekle → Not</b>'a yazın, koordinatöre gösterin.</td></tr>      <tr><td>Aynı kitaptan birden fazla var</td>
          <td><b>Ayrıntı ekle → nüsha</b> alanına sayıyı yazın. Tek kayıt açın.</td></tr>
      <tr><td>Ekran "çevrimdışı" diyor</td>
          <td>Normal, devam edin. Kayıtlar telefonda birikir, bağlantı gelince gider.
              <b>Gitmeden önce sarı uyarının söndüğüne bakın.</b></td></tr>
      <tr><td>Mavi kutuda "koordinatör şu kitabı istiyor" yazıyor</td>
          <td>Yer kodundaki kitabı bulup masaya götürün. Sayarken saymayın.</td></tr>
      <tr><td>Bir kaydı yanlış girdim</td>
          <td>Alttaki <b>son kayıtlarınız</b> listesinden <b>Düzelt</b>. Yanlış sıradaysa
              <b>Sil</b> deyip doğru sırada yeniden girin.</td></tr>
      <tr><td>Bu kitap atılır mı diye endişeleniyorum</td>
          <td>Atılmıyor. "Gitmeyecek" denen kitaplar <b>depoya</b> kalkıyor ve
              <b>yerinde kalıyor</b>; eski raflar depoya dönüşüyor. Siz kaydedin, geçin.</td></tr>
    </table>
  </div>

  <p class="dip">
    <b>Bir şeyden emin değilseniz durmayın:</b> nota yazın ve devam edin. Beş dakika
    düşünmek, koordinatörün otuz saniyede vereceği karardan daha iyi sonuç vermez.
    &nbsp;·&nbsp; Yer kodu: <span class="kod">G-A03-007</span> = mekân · raf · sıra ·
    o sıradaki kaçıncı kitap.
  </p>

</body></html>"""

with open('gonullu-karti.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('yazıldı: gonullu-karti.html')
