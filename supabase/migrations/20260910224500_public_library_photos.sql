-- Eski sistemdeki Drive fotoğrafları bağlantıya sahip herkese açıktı.
-- Aynı erişim düzeyi, tarayıcının her görsel için ayrı imzalı bağlantı
-- beklemesini kaldırır ve katalog açılışını belirgin biçimde hızlandırır.
update storage.buckets set public = true where id = 'library-photos';

create policy "public reads library photos"
on storage.objects for select to anon
using (bucket_id = 'library-photos');
