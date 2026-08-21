#!/usr/bin/env python3
"""Raf/sıra etiketlerini basılacak A4 sayfaları hâlinde üretir.

Etiketler fiziksel raflara yapıştırılır; gönüllü telefondan aynı kodu seçer.
Kod ile etiket birebir aynı olmalı — yoksa yer bilgisi güvenilmez olur.

Kendi kütüphanenize göre aşağıdaki üç satırı düzenleyip çalıştırın:
    python3 raf-etiketleri.py
Apps Script'teki AYAR.MEKANLAR / RAF_HARFLERI / SIRA_SAYISI ile aynı olmalı.
"""

MEKANLAR = [("G", "Giriş Kat"), ("U", "Üst Kat"), ("D", "Depo")]
RAF_HARFLERI = "ABCDEFGH"
SIRA_SAYISI = 8

etiketler = []
for kod, ad in MEKANLAR:
    for harf in RAF_HARFLERI:
        for sira in range(1, SIRA_SAYISI + 1):
            etiketler.append({
                "kod": f"{kod}-{harf}{sira:02d}",
                "alt": f"{ad} · {harf} rafı · {sira}. sıra",
            })

kutular = "\n".join(
    f'''  <div class="etiket">
    <div class="kod">{e["kod"]}</div>
    <div class="alt">{e["alt"]}</div>
    <div class="iz"><span>kaydeden</span><span>tarih</span></div>
  </div>'''
    for e in etiketler
)

html = f"""<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Raf etiketleri</title>
<style>
  @page {{ size: A4; margin: 10mm; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family: 'DejaVu Sans', Arial, sans-serif; color:#211a1d; }}
  .sayfa {{ display:grid; grid-template-columns:1fr 1fr; gap:6mm; }}
  .etiket {{
    border:1.6pt solid #601040; border-radius:3mm; padding:6mm 7mm 5mm;
    height:44mm; display:flex; flex-direction:column; justify-content:center;
    page-break-inside:avoid;
  }}
  .kod {{ font-family:'DejaVu Sans Mono', monospace; font-size:34pt; font-weight:700;
          color:#601040; letter-spacing:1pt; line-height:1; }}
  .alt {{ margin-top:3mm; font-size:11pt; color:#74686e; }}
  .iz {{ margin-top:auto; display:flex; justify-content:space-between; gap:6mm;
         font-size:7.5pt; color:#a89ba1; text-transform:uppercase; letter-spacing:.08em; }}
  .iz span {{ flex:1; border-top:.6pt solid #d9ccd3; padding-top:1.5mm; }}
</style></head>
<body><div class="sayfa">
{kutular}
</div></body></html>
"""

open("raf-etiketleri.html", "w", encoding="utf-8").write(html)
print(f"yazıldı: raf-etiketleri.html — {len(etiketler)} etiket")
