-- Tarayıcıdaki mevcut gönüllü/koordinatör akışında kişi adıyla tutulan
-- geçici raf rezervasyonu ve kapanış bilgileri.
alter table public.library_shelf_positions
  add column if not exists assigned_by_name text,
  add column if not exists completed_by_name text;

create index if not exists library_shelf_positions_assignment_name_idx
  on public.library_shelf_positions (lower(assigned_by_name))
  where assigned_at is not null and completed_at is null;

-- Yeni API sayım düzeltmesinde son yanlış işlemi geri alabilmeli.
create policy "authors delete own unapproved shelf counts"
on public.library_shelf_counts for delete to authenticated
using (
  (counted_by = auth.uid() and approved_at is null)
  or public.library_current_user_role() in ('coordinator', 'admin')
);
