# PNB Excel Import Akışı

PNB Excel dosyaları doğrudan tarayıcıdan okunmaz. Önce yerel bir JSON önizleme üretilir, sonra admin panelinde kontrol edilip Firestore'a aktarılır.

Bu import yalnızca PNB'yi ilk ayrıntılı proje olarak sisteme taşır. PNB dışındaki gönüllü işleri aynı yönetim ortamında genel görev/rapor/duyuru akışıyla yürümeye devam eder.

## 1. Önizleme JSON üret

Repo kökünden:

```bash
python tools/pnb_excel_to_import.py --excel-dir "C:\Users\arifs\Yandex.Disk\Free\Tarih Vakfı - Gönüllü Çalışmaları\PNB-Sevda Hanım Excel" --output imports/pnb-import-preview.json
```

Gerekirse Python ortamına `openpyxl` kurulmalıdır.

## 2. Admin panelinde kontrol et

1. `/app/` içine admin olarak girin.
2. `PNB İçe Aktar` sekmesini açın.
3. `imports/pnb-import-preview.json` dosyasını seçin.
4. Özet sayılarını ve uyarıları kontrol edin.
5. Uygunsa `Firestore'a aktar` düğmesine basın.

## 3. Beklenen PNB başlangıç sayıları

Mevcut çalışma dosyaları için yaklaşık başlangıç:

- 101 arşiv iş paketi
- 1.282 dosya
- 14.099 belge
- 80.378 sayfa
- 24 paydaş/kişi kaydı
- 59 uygunluk satırı
- 50 uygunluk slotu
- 4 iletişim rutini

## Gizlilik

Üretilen JSON e-posta ve telefon gibi kişisel bilgiler içerebilir. Bu nedenle `imports/` klasörü `.gitignore` içindedir ve public repo'ya eklenmemelidir.
