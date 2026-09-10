-- İlk yetkili görüşünü doğrudan kesin karara dönüştür.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'library-finalize-expired-opinions') then
    perform cron.unschedule('library-finalize-expired-opinions');
  end if;
end
$$;

create or replace function public.library_refresh_book_decision(p_book_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  first_opinion record;
begin
  if exists (
    select 1 from public.library_decision_resolutions
    where book_id = p_book_id and kind in ('legacy', 'manual')
  ) then
    return;
  end if;

  delete from public.library_decision_resolutions
  where book_id = p_book_id and kind in ('consensus', 'single_after_30_days');

  select choice, voter_name, updated_at
  into first_opinion
  from public.library_decision_opinions
  where book_id = p_book_id
  order by updated_at, id
  limit 1;

  if first_opinion.choice is not null then
    insert into public.library_decision_resolutions
      (book_id, choice, kind, decided_at, decided_by_names)
    values
      (p_book_id, first_opinion.choice, 'manual', first_opinion.updated_at,
       array[first_opinion.voter_name])
    on conflict (book_id) do update set
      choice = excluded.choice,
      kind = excluded.kind,
      decided_at = excluded.decided_at,
      decided_by_names = excluded.decided_by_names;
  end if;
end;
$$;

-- Eski iki aşamalı düzende bekleyen görüşleri ilk kaydedilen görüşe göre kesinleştir.
do $$
declare
  item record;
begin
  for item in
    select book_id
    from public.library_decision_opinions
    group by book_id
    order by min(updated_at)
  loop
    perform public.library_refresh_book_decision(item.book_id);
  end loop;
end
$$;
