#!/usr/bin/env python3
"""Süreç afişi — tek sayfa, duvara asılır, herkes zincirin tamamını görür.

    python3 surec-afisi.py
"""

FAZLAR = [
    ("1", "ENVANTER", "Gönüllü · rafta",
     "Sıra al → çek, çek, kaydet → sırayı sayarak kapat",
     "Kitap rafından ÇIKMAZ", "g"),
    ("2", "KARAR", "Koordinatör · masada",
     "Sistem kuralı önerir → onayla ya da değiştir → gruplu onay",
     "Kitaba dokunulmaz", "g"),
    ("3", "ÇEKME + KUTULAMA", "Ekip · rafta",
     "Çekme listesi → <b>yalnızca ÇIKACAK</b>ları al → kutuya koy → ekrandan Kutula",
     "Yalnızca taşınan çıkar", "k"),
    ("4", "TAŞIMA", "Herkes",
     "Kutu listesini yazdır → yüklerken tikle → indirirken tekrar tikle",
     "İki tik tutmalı", "m"),
    ("5", "YERLEŞTİRME", "Ekip · yeni bina",
     "Hedef bölüme taşı → kutudan çıktığı sırayla rafa diz",
     "Raf düzeni korunur", "m"),
]

satirlar = "\n".join(
    f'''  <div class="faz {r}">
    <div class="no">{no}</div>
    <div class="orta">
      <h2>{ad} <em>{kim}</em></h2>
      <p>{ne}</p>
    </div>
    <div class="kitap">{kitap}</div>
  </div>'''
    for no, ad, kim, ne, kitap, r in FAZLAR
)

html = f"""<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Taşınma süreci</title>
<style>
  @page {{ size: A4; margin: 12mm; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family:'DejaVu Sans',Arial,sans-serif; color:#211a1d; font-size:10pt; }}
  .bas {{ border-bottom:3px solid #601040; padding-bottom:8px; margin-bottom:14px; }}
  .bas h1 {{ margin:0; font-size:20pt; color:#601040; letter-spacing:-.3px; }}
  .bas span {{ font-size:9.5pt; color:#74686e; }}

  .kural {{ background:#601040; color:#fff; border-radius:9px; padding:11px 15px;
           margin-bottom:16px; font-size:11pt; line-height:1.45; }}
  .kural b {{ color:#ffd9a8; }}

  .hedefler {{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;
              margin-bottom:10px; }}
  .h {{ border:1.8px solid #d8ccc4; border-radius:9px; padding:7px 10px; font-size:9pt; }}
  .h b {{ display:block; font-size:9.6pt; margin-bottom:2px; }}
  .h span {{ display:block; color:#5a4a52; }}
  .h u {{ font-family:'DejaVu Sans Mono',monospace; }}
  .h em {{ display:block; margin-top:3px; font-style:normal; font-size:8.2pt; color:#74686e; }}
  .h.yesil {{ border-color:#2e6440; background:#e4f0e7; }} .h.yesil b {{ color:#22502f; }}
  .h.mor {{ border-color:#5b3a8e; background:#ece6f7; }} .h.mor b {{ color:#402868; }}
  .h.gri b {{ color:#601040; }}

  .faz {{ display:flex; align-items:stretch; gap:12px; border:1.8px solid #d8ccc4;
         border-radius:10px; margin-bottom:6px; overflow:hidden; }}
  .faz .no {{ flex:0 0 42px; display:flex; align-items:center; justify-content:center;
             font-size:20pt; font-weight:800; color:#fff; }}
  .faz.g .no {{ background:#2e6440; }}
  .faz.k .no {{ background:#a06a12; }}
  .faz.m .no {{ background:#2a5b86; }}
  .faz .orta {{ flex:1 1 auto; padding:9px 4px 9px 0; }}
  .faz h2 {{ margin:0 0 3px; font-size:12.5pt; color:#601040; }}
  .faz h2 em {{ font-style:normal; font-weight:400; font-size:9.5pt; color:#74686e; }}
  .faz p {{ margin:0; font-size:10pt; line-height:1.4; }}
  .faz .kitap {{ flex:0 0 148px; display:flex; align-items:center; padding:0 12px;
                background:#f4ece7; font-size:9pt; font-weight:700; color:#5a4a52;
                border-left:1.5px solid #e0d5cd; }}

  .alt {{ display:grid; grid-template-columns:1fr 1fr; gap:11px; margin-top:10px; }}
  .kutu {{ border:1.8px solid #d8ccc4; border-radius:10px; overflow:hidden; }}
  .kutu h3 {{ margin:0; padding:7px 12px; font-size:11pt; background:#f4ece7;
             border-bottom:1.5px solid #d8ccc4; color:#601040; }}
  .kutu ul {{ margin:0; padding:8px 12px 9px 26px; }}
  .kutu li {{ margin-bottom:4px; font-size:9.5pt; line-height:1.4; }}
  .kutu.uyari {{ border-color:#9c2233; }}
  .kutu.uyari h3 {{ background:#fbe6e9; border-color:#9c2233; color:#8a1c2c; }}

  .dip {{ margin-top:9px; padding-top:7px; border-top:1.5px solid #e6dcd6;
         font-size:9pt; color:#74686e; line-height:1.5; }}
  .dip b {{ color:#601040; }}
</style></head><body>

  <div class="bas">
    <h1>Taşınma Süreci — bir sıranın yolculuğu</h1>
    <span>Tarih Vakfı Kütüphanesi · her sıra bu altı adımı kendi hızında yürür</span>
  </div>

  <div class="kural">
    <b>Tek iş birimi: SIRA.</b> Kütüphane sıralara bölünmüş (G-A03 = Giriş Kat ·
    A rafı · 3. göz, ortalama 30–50 kitap). Bir sıra baştan sona bir bütün olarak
    ilerler. &nbsp;·&nbsp;
    <b>Bütün kütüphanenin 1. adımı bitmeden 2. adıma geçilmesi gerekmez</b> —
    her sıra bağımsız akar.
  </div>

  <div class="hedefler">
    <div class="h yesil"><b>GİDECEK → raftan çıkar</b>
      <span><u>Y-001</u>, Y-002 … kutusuna girer</span>
      <em>katalogda: YENİ BİNADA · Y-017</em></div>
    <div class="h mor"><b>GİTMEYECEK → yerinde kalır</b>
      <span>kutu yok, taşıma yok, iş yok</span>
      <em>katalogda: DEPODA — yerinde · G-A03-007</em></div>
    <div class="h gri"><b>DEPO = ESKİ RAFLARIN KENDİSİ</b>
      <span>adresi zaten yer kodu; hiçbir kitap atılmıyor</span>
      <em>kutusuz kitap raftan inmez</em></div>
  </div>

{satirlar}

  <div class="alt">
    <div class="kutu uyari">
      <h3>⚠ Envanterde kitap raftan çıkmaz</h3>
      <ul>
        <li><b>Sayım bozulur</b> — sıra sonundaki fiziksel sayım, hiçbir kitabın
            atlanmadığının tek güvencesi</li>
        <li><b>Karar henüz yok</b> — koordinatör kitabı saatler sonra görecek</li>
        <li><b>Yarım sıra kurtarılamaz</b> — ertesi gün gelen ne olduğunu anlayamaz</li>
        <li><b>Tek istisna:</b> küflü/böcekli kitap poşetlenip ayrılır; ekranda
            işaretlenir, sistem sayımdan düşer</li>
      </ul>
    </div>
    <div class="kutu">
      <h3>Kritik bağımlılık</h3>
      <ul>
        <li>Bir sıradan <b>kitap çekilemez</b>, kararları bitmeden</li>
        <li>Karar masası geride kalırsa <b>çekme de geride kalır</b></li>
        <li>Panodaki <b>"onay bekleyen"</b> sayısı bu yüzden en önemli sayı</li>
        <li>Kuyruk 40'ı aşınca onay ekranı kendiliğinden <b>gruplu onaya</b> geçer</li>
        <li>Masa boş kalırsa hiçbir şey ilerlemez — <b>bir kişiyi masaya sabitleyin</b></li>
      </ul>
    </div>
  </div>

  <p class="dip">
    <b>Yer kodu G-A03-007</b> = mekân · raf · sıra · kaçıncı kitap. Sistem verir.
    &nbsp;·&nbsp; <b>Kutulamadan raftan indirmeyin</b> — kutu numarası kayda ancak
    ekrandan <b>Kutula</b> denince yazılır; yazılmazsa katalog kitabı hâlâ "RAFTA"
    gösterir, ama rafta değildir.
  </p>

</body></html>"""

with open('surec-afisi.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('yazıldı: surec-afisi.html')
