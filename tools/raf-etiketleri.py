#!/usr/bin/env python3
"""Raf/sıra etiketlerini basılacak A4 sayfaları hâlinde üretir.

Etiketler fiziksel raflara yapıştırılır; gönüllü telefondan aynı kodu seçer.
Kod ile etiket birebir aynı olmalı — yoksa yer bilgisi güvenilmez olur.

Kendi kütüphanenize göre aşağıdaki ayarları düzenleyip çalıştırın:
    python3 raf-etiketleri.py
Apps Script'teki AYAR.MEKANLAR / RAF_SAYISI / SIRA_SAYISI ile aynı olmalı —
etiket ile sistemdeki kod ayrışırsa yer bilgisi güvenilmez olur.

Sözlük: kod G-A01-007 → G kat, A KİTAPLIK, 01 RAF, 007 o raftaki kitabın SIRAsı.
Etiket kitaplık+raf seviyesine yapıştırılır (G-A01), tek tek kitaplara değil.
"""

# (kod, ad, harf dizisindeki başlangıç, kaç kitaplık)
# Harfler bina boyunca kesintisiz: giriş kat A…BA, üst kat BB…BH.
# "Diğer" bilerek A'dan başlar; harf dizisinin parçası değildir.
MEKANLAR = [
    ("G", "Giriş Kat", 0, 53),
    ("U", "Üst Kat", 53, 7),
    ("X", "Diğer", 0, 6),
]
RAF_SAYISI = 60      # bina genelindeki toplam kitaplık
SIRA_SAYISI = 6      # her kitaplıkta kaç raf


def kitaplik_harfleri(sayi):
    """A…Z, sonra AA, AB… (Excel sütunları gibi). Apps Script ile aynı üretim."""
    A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return [A[i] if i < 26 else A[i // 26 - 1] + A[i % 26] for i in range(sayi)]


HEPSI = kitaplik_harfleri(RAF_SAYISI)

etiketler = []
for kod, ad, bas, adet in MEKANLAR:
    for harf in HEPSI[bas:bas + adet]:
        for raf in range(1, SIRA_SAYISI + 1):
            etiketler.append({
                "kod": f"{kod}-{harf}{raf:02d}",
                "alt": f"{ad} · {harf} kitaplığı · {raf}. raf",
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
