-- Tek kalan görüşleri 30 gün dolunca otomatik olarak kesinleştir.
-- Supabase zamanlayıcısı UTC kullanır; 02:15 UTC, İstanbul'da 05:15'tir.

create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'library-finalize-expired-opinions'
  ) then
    perform cron.schedule(
      'library-finalize-expired-opinions',
      '15 2 * * *',
      'select public.library_finalize_expired_opinions();'
    );
  end if;
end
$$;
