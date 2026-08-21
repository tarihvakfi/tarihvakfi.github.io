#!/usr/bin/env python3
"""Kabul testi — kurulum bittikten sonra, başlamadan önce yapılan kontrol.

Bir kâğıt, otuz dakika. Hepsi tikliyse sistem hazırdır; biri tutmuyorsa
başlamayın — çalışma günü ortasında hata aramak çok daha pahalıdır.

    python3 kabul-testi.py
"""

ADIMLAR = [
    ("Telefondan girip <b>Bana sıra ver</b>'e basın",
     "Bir sıra verir; “boş sıra — hiç başlanmamış” yazar", "g"),
    ("Bir kitabın künye sayfasını ve kapağını çekip <b>Kaydet</b>",
     "<b>G-A01-001 kaydedildi</b> — yer kodunu sistem verdi", "g"),
    ("İki kitap daha kaydedin",
     "Sayaç 3 olur; hiçbir alan doldurmadınız", "g"),
    ("Sayfayı yenileyip <b>aynı sırayı</b> açın",
     "<b>Devir kartı</b> çıkar: “3 kitap kaydedilmiş”, son kitabın adı ve kapağı", "g"),
    ("<b>Başka bir telefondan</b> aynı sırayı seçin",
     "“BU SIRA … ÜZERİNDE” uyarısı — çifte çalışma engellendi", "g"),
    ("Uçak moduna alıp 2 kitap kaydedin",
     "“telefona kaydedildi” + <b>sarı bekleyen uyarısı</b>", "c"),
    ("Uçak modu açıkken <b>Sırayı bitir</b>'e basın",
     "<b>Engellenir</b> — önce bağlantının gelmesi istenir", "c"),
    ("Uçak modunu kapatın, birkaç saniye bekleyin",
     "Sarı uyarı söner; kayıtlar sunucuya gider", "c"),
    ("<b>Sırayı bitir</b> → rafı sayın, <b>bilerek yanlış</b> sayı girin",
     "Farkı söyler ve <b>sırayı kapatmaz</b>", "g"),
    ("Doğru sayıyı girin",
     "Sıra kapanır; harita “bitti” gösterir", "g"),
    ("Onay ekranını açın (koordinatör şifresiyle)",
     "Kayıtlar bekliyor; kural önerisi <b>ön-seçili</b> geliyor", "k"),
    ("<b>Enter</b>'a basın",
     "Onaylanır ve kendiliğinden sıradaki kayda geçer", "k"),
    ("Katalog → sırayı seçin → Karar süzgeci → <b>Kutula</b>",
     "<b>Y-001 kapatıldı — 3 kayıt, 3 cilt</b> + yer kodu aralığı", "k"),
    ("Kutuladığınız kitabı katalogda arayın",
     "Rozet: <b>YENİ BİNADA · Y-001</b> — nerede olduğu belli", "k"),
    ("Durum panosunu açın",
     "<b>“Bugün dikkat”</b> kartı — sorun yoksa yeşil “her şey yolunda”", "k"),
    ("Apps Script'te <b>gunlukYedek</b> fonksiyonunu çalıştırın",
     "Drive'da <b>Yedekler</b> klasörü ve tarihli bir kopya oluşur", "s"),
]

RENK = {"g": ("GÖNÜLLÜ", "#2e6440"), "c": ("ÇEVRİMDIŞI", "#a06a12"),
        "k": ("KOORDİNATÖR", "#2a5b86"), "s": ("SİSTEM", "#5b3a8e")}

satirlar = "\n".join(
    f'''    <tr class="{r}">
      <td class="tik"></td>
      <td class="no">{i}</td>
      <td class="ne">{ne}<span class="rozet">{RENK[r][0]}</span></td>
      <td class="bek">{bek}</td>
    </tr>'''
    for i, (ne, bek, r) in enumerate(ADIMLAR, 1))

renk_css = "\n".join(
    f'  tr.{k} .no {{ background:{v[1]}; }}\n  tr.{k} .rozet {{ color:{v[1]}; }}'
    for k, v in RENK.items())

html = f"""<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Kabul testi</title>
<style>
  @page {{ size: A4; margin: 10mm; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family:'DejaVu Sans',Arial,sans-serif; color:#211a1d;
         font-size:8.8pt; line-height:1.35; }}
  .bas {{ border-bottom:2.5px solid #601040; padding-bottom:6px; margin-bottom:9px;
         display:flex; align-items:flex-end; justify-content:space-between; }}
  .bas h1 {{ margin:0; font-size:15.5pt; color:#601040; letter-spacing:-.2px; }}
  .bas span {{ font-size:8.4pt; color:#74686e; }}
  .bas .imza {{ font-size:8pt; color:#74686e; text-align:right; line-height:2.1; }}
  .bas .imza u {{ text-decoration:none; border-bottom:1px solid #b9a9b1;
                 display:inline-block; width:38mm; }}

  .kural {{ background:#601040; color:#fff; border-radius:8px; padding:8px 12px;
           margin-bottom:10px; font-size:9.2pt; }}
  .kural b {{ color:#ffd9a8; }}

  table {{ width:100%; border-collapse:collapse; }}
  td, th {{ border:1px solid #d8ccc4; padding:5px 7px; vertical-align:top; }}
  th {{ background:#f4ece7; font-size:8pt; text-align:left; color:#601040; }}
  .tik {{ width:9mm; }}
  td.tik {{ background:#fff; }}
  .no {{ width:8mm; text-align:center; color:#fff; font-weight:800; font-size:10pt;
        font-family:'DejaVu Sans Mono',monospace; }}
  .ne {{ width:44%; }}
  .bek {{ color:#3c3238; }}
  .rozet {{ display:block; margin-top:2px; font-size:6.6pt; font-weight:700;
           letter-spacing:.6px; }}
  b {{ color:#601040; }}
  .bek b {{ color:#22502f; }}
{renk_css}

  .alt {{ display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:10px; }}
  .kutu {{ border:1.8px solid #d8ccc4; border-radius:9px; overflow:hidden; }}
  .kutu h2 {{ margin:0; padding:6px 11px; font-size:10pt; background:#f4ece7;
             border-bottom:1.5px solid #d8ccc4; color:#601040; }}
  .kutu .ic {{ padding:7px 11px; }}
  .kutu ol {{ margin:0; padding-left:17px; }}
  .kutu li {{ margin-bottom:3px; }}
  .kutu.uyari {{ border-color:#9c2233; }}
  .kutu.uyari h2 {{ background:#fbe6e9; border-color:#9c2233; color:#8a1c2c; }}
  .olcum {{ margin-top:6px; padding:6px 8px; background:#f4ece7; border-radius:6px;
           font-size:8.4pt; }}
  .olcum u {{ text-decoration:none; border-bottom:1.2px solid #b9a9b1;
             display:inline-block; width:16mm; }}
</style></head><body>

  <div class="bas">
    <div>
      <h1>Kabul Testi — başlamadan önce</h1>
      <span>Tarih Vakfı Kütüphanesi · Taşınma · otuz dakika · bir kere yapılır</span>
    </div>
    <div class="imza">Yapan: <u></u><br>Tarih: <u></u></div>
  </div>

  <div class="kural">
    <b>Hepsi tiklenmeden çalışma günü başlamasın.</b> Bir adım tutmuyorsa durun ve
    sebebini bulun — çalışma günü ortasında hata aramak, buradaki yarım saatten
    kat kat pahalıya patlar. &nbsp;·&nbsp; Test kayıtlarını sonra <b>silin</b>.
  </div>

  <table>
    <tr><th></th><th>#</th><th>Ne yapılacak</th><th>Beklenen sonuç</th></tr>
{satirlar}
  </table>

  <div class="alt">
    <div class="kutu">
      <h2>Sonra: pilot — 1 saat</h2>
      <div class="ic">
        <ol>
          <li><b>Gerçek bir rafta</b>, 2 gönüllüyle, tek sıra yapın.</li>
          <li>Süre tutun: sıra kaç dakikada bitti, kaç kitap çıktı.</li>
          <li>Bölün — <b>bir kitap kaç saniye?</b></li>
          <li>Gönüllülere sorun: nerede takıldınız?</li>
        </ol>
        <div class="olcum">
          Bir kitap: <u></u> saniye &nbsp;·&nbsp; Bu sayı bütün planlamanın temeli.
          30 sn ise rahatsınız; 90 sn ise gönüllü sayısını artırın.
        </div>
      </div>
    </div>
    <div class="kutu uyari">
      <h2>⚠ Tutmazsa ne demektir</h2>
      <div class="ic">
        <ol>
          <li><b>4 tutmuyorsa</b> — yarım kalan sıra devredilemez, ertesi gün gelen
              nereden devam edeceğini bilemez.</li>
          <li><b>7–8 tutmuyorsa</b> — zayıf wifi'de kayıt kaybedersiniz.</li>
          <li><b>9 tutmuyorsa</b> — atlanan kitabı hiçbir şey yakalamaz.</li>
          <li><b>13–14 tutmuyorsa</b> — kutulanan kitabın izi kaybolur.</li>
          <li><b>16 tutmuyorsa</b> — yedek yok; tek bir kaza her şeyi götürür.</li>
        </ol>
      </div>
    </div>
  </div>

</body></html>"""

with open('kabul-testi.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('yazıldı: kabul-testi.html')
