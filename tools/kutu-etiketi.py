#!/usr/bin/env python3
"""Kutu etiketleri — A4 sayfada altışar tane, kesilip kutuya yapıştırılır.

Kutulanan tek şey **taşınan kitaplardır**:

    Y-001, Y-002 …   YENİ BİNA — raftan çıkıp taşınacak kitaplar

Yerinde kalan kitaplar kutulanmaz. Eski raflar depo olarak duruyor; o
kitapların adresi zaten yer kodudur (G-A03-007) ve katalogda "DEPODA —
yerinde" görünürler. Kutu ve etiket yalnızca yerinden kımıldayan kitap için
gerekir.

    D-001, D-002 …   DEPO — yalnızca depoda kalanlar sonradan başka bir
                     yere taşınırsa; normal taşınmada bu seriye gerek yok

Numaralar önden basılıdır ki kimse iki kutuya aynı numarayı vermesin.
Ekranda kutuyu kapatırken (Katalog → sıra seç → Kutula) aynı numarayı
yazarsınız; sistem o kitapların hepsine "Y-017" damgasını basar.

    python3 kutu-etiketi.py                 # Y-001 … Y-040   (olağan kullanım)
    python3 kutu-etiketi.py 41 80           # Y-041 … Y-080
    python3 kutu-etiketi.py depo 1 20       # D-001 … D-020   (depo taşınırsa)
    python3 kutu-etiketi.py ikisi           # iki seri birden
"""
import sys

argv = sys.argv[1:]
if argv and argv[0].lower() in ('ikisi', 'hepsi'):
    seriler, argv = ['yeni', 'depo'], argv[1:]
elif argv and argv[0].lower() in ('yeni', 'y', 'depo', 'd'):
    seriler = ['depo' if argv[0].lower().startswith('d') else 'yeni']
    argv = argv[1:]
else:
    seriler = ['yeni']

bas = int(argv[0]) if len(argv) > 0 else 1
son = int(argv[1]) if len(argv) > 1 else bas + 39
if son < bas:
    bas, son = son, bas

BILGI = {
    'yeni': dict(kod='Y', ad='YENİ BİNA', renk='#2e6440', acik='#e4f0e7',
                 hedef='Hedef bölüm — yeni binada nereye',
                 uyari='<b>Kutudan çıktığı sırayla</b> rafa dizin.',
                 tikler=['kamyona yüklendi', 'yeni binada indirildi', 'rafa dizildi']),
    'depo': dict(kod='D', ad='DEPO', renk='#5b3a8e', acik='#ece6f7',
                 hedef='Yeni depo yeri — hangi alan / raf',
                 uyari='<b>Yalnızca depo taşınırsa kullanılır.</b> Yerinde duran '
                       'kitap kutulanmaz; adresi zaten yer kodudur.',
                 tikler=['depoya taşındı', 'yerine kondu']),
}


def etiket(seri, n):
    b = BILGI[seri]
    tik = ' '.join(f'<span><b>☐</b> {t}</span>' for t in b['tikler'])
    return f'''  <div class="etiket {seri}">
    <div class="ust">
      <div class="no"><small>KUTU</small>{b['kod']}-{n:03d}</div>
      <div class="hedefrozet">{b['ad']}</div>
    </div>
    <div class="kurum">Tarih Vakfı Kütüphanesi · taşınma 2026</div>
    <div class="alan genis"><label>{b['hedef']}</label><div class="cizgi"></div></div>
    <div class="ikili">
      <div class="alan"><label>Kaynak sıra</label><div class="cizgi kod"></div></div>
      <div class="alan"><label>Kaç cilt</label><div class="cizgi"></div></div>
    </div>
    <div class="alan genis"><label>Yer kodu aralığı</label><div class="cizgi kod"></div></div>
    <div class="ikili">
      <div class="alan"><label>Paketleyen</label><div class="cizgi"></div></div>
      <div class="alan"><label>Tarih</label><div class="cizgi"></div></div>
    </div>
    <div class="uyari">{b['uyari']}</div>
    <div class="tikler">{tik}</div>
  </div>'''


sayfalar = []
for seri in seriler:
    tumu = [etiket(seri, n) for n in range(bas, son + 1)]
    for i in range(0, len(tumu), 6):
        sayfalar.append('  <div class="sayfa">\n' + "\n".join(tumu[i:i + 6]) + '\n  </div>')

govde = "\n".join(sayfalar)
adlar = ' + '.join(BILGI[s]['ad'] for s in seriler)

html = f"""<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Kutu etiketleri {bas}–{son}</title>
<style>
  @page {{ size: A4; margin: 8mm; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family:'DejaVu Sans',Arial,sans-serif; color:#211a1d; }}
  .sayfa {{ display:grid; grid-template-columns:1fr 1fr; gap:4mm;
           page-break-after:always; }}
  .sayfa:last-child {{ page-break-after:auto; }}

  .etiket {{ border:2.5px solid #601040; border-radius:4mm; padding:3.5mm 4mm;
            min-height:88mm; display:flex; flex-direction:column;
            page-break-inside:avoid; }}
  .etiket.yeni {{ border-color:#2e6440; }}
  .etiket.depo {{ border-color:#5b3a8e; }}

  .ust {{ display:flex; align-items:center; justify-content:space-between; gap:2mm;
         border-bottom:1.5px solid #d8ccc4; padding-bottom:2mm; margin-bottom:1.2mm; }}
  .no {{ font-size:25pt; font-weight:800; line-height:.95;
        font-family:'DejaVu Sans Mono',monospace; }}
  .yeni .no {{ color:#2e6440; }}
  .depo .no {{ color:#5b3a8e; }}
  .no small {{ display:block; font-size:7pt; font-weight:700; letter-spacing:1.5px;
              color:#74686e; font-family:'DejaVu Sans',Arial,sans-serif; }}

  .hedefrozet {{ font-size:12pt; font-weight:800; letter-spacing:.5px; color:#fff;
                padding:2mm 3.5mm; border-radius:2.5mm; white-space:nowrap; }}
  .yeni .hedefrozet {{ background:#2e6440; }}
  .depo .hedefrozet {{ background:#5b3a8e; }}

  .kurum {{ font-size:7pt; color:#9a8b92; margin-bottom:2.5mm; }}

  .alan {{ margin-bottom:2.2mm; }}
  .alan label {{ display:block; font-size:6.6pt; font-weight:700; letter-spacing:.4px;
                text-transform:uppercase; color:#74686e; margin-bottom:.5mm; }}
  .cizgi {{ border-bottom:1.2px solid #b9a9b1; height:6.5mm; }}
  .cizgi.kod {{ border-bottom-style:dashed; }}
  .ikili {{ display:grid; grid-template-columns:1fr 1fr; gap:3.5mm; }}

  .uyari {{ margin-top:auto; font-size:6.9pt; line-height:1.35; padding:1.6mm 2mm;
           border-radius:1.5mm; }}
  .yeni .uyari {{ background:#e4f0e7; color:#22502f; }}
  .depo .uyari {{ background:#ece6f7; color:#402868; }}

  .tikler {{ display:flex; flex-wrap:wrap; gap:1.5mm 4mm; margin-top:2mm;
            padding-top:2mm; border-top:1.2px solid #e6dcd6;
            font-size:7.2pt; color:#5a4a52; }}
  .tikler b {{ font-size:9pt; color:#601040; }}
</style></head><body>
{govde}
</body></html>"""

with open('kutu-etiketi.html', 'w', encoding='utf-8') as f:
    f.write(html)
print(f'yazıldı: kutu-etiketi.html — {adlar} · {son - bas + 1}\'er etiket ({bas}–{son})')
