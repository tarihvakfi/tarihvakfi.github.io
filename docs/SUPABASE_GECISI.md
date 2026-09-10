# Supabase geçişi

Kitap envanteri ve koordinatör ekranlarının canlı veri kaynağı Supabase'tir.
Google E-Tablo ve Apps Script artık bu iki sayfanın çalışma yolunda değildir;
yalnızca geçiş öncesi yedek olarak korunur.

## Kurulan yapı

- **396 raf gözü:** 66 kitaplık × 6 sıra
- **Kitap kayıtları:** yer, künye, nüsha, fiziksel durum ve fotoğraf bağlantıları
- **Raf sayımları:** ilk sayım, kontrol/düzeltme ve onay bilgileri
- **Kararlar:** iki aynı görüşte kesinleşme; tek görüşün 30 gün sonra geçerli olması
- **Görüş geri alma:** kesinleşmemiş görüşü yalnız görüş sahibi geri alabilir
- **Yetkiler:** gönüllü, koordinatör ve yönetici rolleri
- **Fotoğraflar:** Supabase Storage; 693 eski fotoğraf taşındı ve sayfalarda küçültülmüş sürümleri kullanılıyor
- **İletişim:** gönderim durumu izlenen mesaj kayıtları
- **Günlük karar işlemi:** yalnız kalan görüşler 30 gün dolunca her sabah otomatik kesinleşir

## 10 Eylül 2026 geçiş durumu

- Supabase Pro projesi etkin ve veritabanı şeması kuruldu.
- Mevcut Google E-Tablo verileri kesim anında son kez Supabase'e eşitlendi.
- 396 raf gözü, 154 raf sayımı ve toplam 7.160 sayılmış kitap aktarıldı.
- 287 kitap/nüsha kaydı, 2 görüş ve 1 kesin karar aktarıldı.
- Canlı veritabanında tek görüş, iki aynı görüş, görüş geri alma, 30 günlük kesinleşme ve anonim erişim engeli denendi.
- `kitap-envanteri.html`, `koordinator.html` ve envanterin yardımcı yönetim
  sayfaları `library-api` Edge Function üzerinden doğrudan Supabase ile çalışır.
- Eski Apps Script adresi envanter sayfalarının ayarından çıkarıldı.
- Ortak bağlantı kodundan Apps Script ve JSONP yolları kaldırıldı; envanter sayfaları
  yalnız Supabase Edge Function adresini kabul eder.
- Canlı kabul testinde 34 okuma/yazma işlemi geçici raf ve kitap üzerinde çalıştırıldı;
  test verileri işlem sonunda silindi.

## Uygulanan geçiş sırası

1. Supabase Pro projesi etkinleştirilir.
2. `supabase db push` ile şema kurulur ve 396 raf gözü oluşturulur.
3. Mevcut sistemden salt okunur dışa aktarım alınır:

   ```sh
   SOURCE_APPS_SCRIPT_URL=".../exec" \
   SOURCE_COORDINATOR_PASSWORD="..." \
   node tools/migrate_inventory_to_supabase.mjs
   ```

   Bu komut yalnız `.migration/` altında yedek üretir ve hiçbir veriyi yazmaz.

4. Önizleme sayıları onaylandıktan sonra aynı dışa aktarım Supabase'e uygulanır:

   ```sh
   APPLY=1 \
   SOURCE_APPS_SCRIPT_URL=".../exec" \
   SOURCE_COORDINATOR_PASSWORD="..." \
   SUPABASE_URL="https://PROJECT.supabase.co" \
   SUPABASE_SERVICE_ROLE_KEY="..." \
   node tools/migrate_inventory_to_supabase.mjs
   ```

5. Kaynak ve hedefte kitap, nüsha, sayılmış raf ve karar sayıları karşılaştırılır.
6. Gönüllü ve koordinatör ekranları deneme grubuyla sınanır.
7. Site Supabase'e geçirilir ve envanter sayfalarındaki Apps Script çalışma yolu kaldırılır.

`SUPABASE_SERVICE_ROLE_KEY` yalnız yerel `.env` dosyasında tutulur; site koduna ve
GitHub'a eklenmez. Eski Google E-Tablo ve Apps Script dosyaları yalnız arşiv/yedek
olarak korunur; canlı envanter işlemlerinde kullanılmaz.
