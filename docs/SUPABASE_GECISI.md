# Supabase geçişi

Bu geçiş, Google E-Tablo ve Apps Script sistemini tek hamlede kapatmaz. Önce
Supabase'e güvenli bir kopya alınır, sayılar karşılaştırılır ve yeni ekranlar
deneme kullanıcılarıyla doğrulanır. Son aşamada site Supabase'e yönlendirilir.

## Kurulan yapı

- **396 raf gözü:** 66 kitaplık × 6 sıra
- **Kitap kayıtları:** yer, künye, nüsha, fiziksel durum ve fotoğraf bağlantıları
- **Raf sayımları:** ilk sayım, kontrol/düzeltme ve onay bilgileri
- **Kararlar:** iki aynı görüşte kesinleşme; tek görüşün 30 gün sonra geçerli olması
- **Görüş geri alma:** kesinleşmemiş görüşü yalnız görüş sahibi geri alabilir
- **Yetkiler:** gönüllü, koordinatör ve yönetici rolleri
- **Fotoğraflar:** özel Storage kovası; yalnız oturum açanlar görebilir
- **İletişim:** gönderim durumu izlenen mesaj kayıtları
- **Günlük karar işlemi:** yalnız kalan görüşler 30 gün dolunca her sabah otomatik kesinleşir

## 10 Eylül 2026 aktarım durumu

- Supabase Pro projesi etkin ve veritabanı şeması kuruldu.
- Mevcut Google E-Tablo verileri Supabase'e kopyalandı; kaynak sistem kapatılmadı.
- 396 raf gözü, 154 raf sayımı ve toplam 7.160 sayılmış kitap aktarıldı.
- 287 kitap/nüsha kaydı, 2 görüş ve 1 kesin karar aktarıldı.
- Canlı veritabanında tek görüş, iki aynı görüş, görüş geri alma, 30 günlük kesinleşme ve anonim erişim engeli denendi.
- Site henüz Supabase'e yönlendirilmedi; bu nedenle geçiş tamamlanana kadar mevcut ekranlar Apps Script üzerinden çalışır.

## Geçiş sırası

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
7. Site yeni sisteme geçirilir; Apps Script bir süre yalnız geri dönüş için açık kalır.

`SUPABASE_SERVICE_ROLE_KEY` yalnız yerel `.env` dosyasında tutulur; site koduna ve
GitHub'a eklenmez. Fotoğraflar ilk aktarımda mevcut Drive bağlantılarıyla çalışır.
Tüm kayıtlar doğrulandıktan sonra dosyalar özel Storage kovasına taşınabilir.
