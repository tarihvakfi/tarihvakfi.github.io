-- Tarih Vakfı kütüphane envanteri için ilişkisel veri modeli.
-- Bu şema mevcut Apps Script sistemine dokunmaz; kontrollü geçiş için
-- Supabase tarafını hazırlar.

create extension if not exists pgcrypto with schema extensions;

create type public.library_user_role as enum ('volunteer', 'coordinator', 'admin');
create type public.library_book_condition as enum ('good', 'worn', 'mold_or_pest');
create type public.library_decision_choice as enum ('go', 'may_go', 'stay', 'uncertain');
create type public.library_decision_resolution_kind as enum ('consensus', 'single_after_30_days', 'legacy', 'manual');
create type public.library_shelf_count_kind as enum ('initial', 'control', 'correction', 'closing');
create type public.library_shelf_count_status as enum ('counted', 'could_not_count', 'approved', 'disputed');

create table public.library_members (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  role public.library_user_role not null default 'volunteer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.library_locations (
  code text primary key,
  name text not null,
  sort_order integer not null default 0
);

create table public.library_shelf_positions (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  location_code text not null references public.library_locations(code),
  bookcase_code text not null,
  shelf_number smallint not null check (shelf_number between 1 and 20),
  sort_order integer not null,
  assigned_to uuid references public.library_members(id),
  assigned_at timestamptz,
  completed_by uuid references public.library_members(id),
  completed_at timestamptz,
  closing_count integer check (closing_count >= 0),
  closing_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_code, bookcase_code, shelf_number)
);

create table public.library_shelf_counts (
  id bigint generated always as identity primary key,
  shelf_position_id uuid not null references public.library_shelf_positions(id) on delete cascade,
  kind public.library_shelf_count_kind not null default 'initial',
  status public.library_shelf_count_status not null default 'counted',
  layout text not null default 'single' check (layout in ('single', 'double')),
  front_count integer check (front_count between 0 and 2000),
  back_count integer check (back_count between 0 and 2000),
  back_unavailable boolean not null default false,
  total_count integer generated always as
    (coalesce(front_count, 0) + case when back_unavailable then 0 else coalesce(back_count, 0) end) stored,
  note text,
  photo_path text,
  legacy_photo_url text,
  counted_by uuid references public.library_members(id),
  counted_by_name text,
  counted_at timestamptz not null default now(),
  approved_by uuid references public.library_members(id),
  approved_by_name text,
  approved_at timestamptz,
  legacy_source_key text unique,
  created_at timestamptz not null default now(),
  check (
    status = 'could_not_count'
    or front_count is not null
  )
);

create table public.library_boxes (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  destination text not null check (destination in ('new_library', 'storage')),
  packed_by uuid references public.library_members(id),
  packed_by_name text,
  packed_at timestamptz not null default now(),
  note text
);

create table public.library_books (
  id uuid primary key default extensions.gen_random_uuid(),
  legacy_no bigint unique,
  client_id text unique,
  shelf_position_id uuid not null references public.library_shelf_positions(id),
  position_number integer not null check (position_number > 0),
  place_code text not null unique,
  author text,
  title text,
  publication_year integer check (publication_year between 1000 and 2200),
  copies integer not null default 1 check (copies between 1 and 100),
  condition public.library_book_condition not null default 'good',
  note text,
  recorded_by uuid references public.library_members(id),
  recorded_by_name text,
  recorded_at timestamptz not null default now(),
  imprint_photo_path text,
  cover_photo_path text,
  legacy_imprint_url text,
  legacy_cover_url text,
  ocr_status text,
  ocr_text text,
  suggested_title text,
  suggested_author text,
  suggested_year integer,
  suggested_publisher text,
  bibliography_approved_by uuid references public.library_members(id),
  bibliography_approved_by_name text,
  bibliography_approved_at timestamptz,
  requested_reason text,
  requested_by uuid references public.library_members(id),
  requested_by_name text,
  requested_at timestamptz,
  box_id uuid references public.library_boxes(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shelf_position_id, position_number)
);

create table public.library_decision_opinions (
  id bigint generated always as identity primary key,
  book_id uuid not null references public.library_books(id) on delete cascade,
  voter_id uuid references public.library_members(id),
  voter_name text not null check (char_length(trim(voter_name)) between 2 and 80),
  voter_key text generated always as (lower(regexp_replace(trim(voter_name), '\s+', ' ', 'g'))) stored,
  choice public.library_decision_choice not null,
  note text check (char_length(coalesce(note, '')) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, voter_key)
);

create table public.library_decision_resolutions (
  book_id uuid primary key references public.library_books(id) on delete cascade,
  choice public.library_decision_choice not null,
  kind public.library_decision_resolution_kind not null,
  decided_at timestamptz not null default now(),
  decided_by_names text[] not null default '{}',
  legacy_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.library_decision_events (
  id bigint generated always as identity primary key,
  book_id uuid not null references public.library_books(id) on delete cascade,
  event_type text not null check (event_type in ('opinion_added', 'opinion_changed', 'opinion_withdrawn', 'resolved', 'resolution_reopened', 'imported')),
  actor_id uuid references public.library_members(id),
  actor_name text,
  choice public.library_decision_choice,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.library_contact_messages (
  id bigint generated always as identity primary key,
  page text not null,
  message_type text not null,
  sender_id uuid references public.library_members(id),
  sender_name text not null,
  sender_contact text,
  subject text,
  message text not null check (char_length(trim(message)) >= 5),
  context jsonb not null default '{}',
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index library_books_shelf_position_idx on public.library_books (shelf_position_id, position_number) where deleted_at is null;
create index library_books_bibliography_queue_idx on public.library_books (bibliography_approved_at, place_code) where deleted_at is null;
create index library_shelf_counts_position_time_idx on public.library_shelf_counts (shelf_position_id, counted_at desc);
create index library_decision_opinions_book_idx on public.library_decision_opinions (book_id, updated_at);
create unique index library_decision_opinions_user_idx on public.library_decision_opinions (book_id, voter_id)
where voter_id is not null;
create index library_decision_resolutions_choice_idx on public.library_decision_resolutions (choice, decided_at);
create index library_decision_events_book_time_idx on public.library_decision_events (book_id, created_at desc);

create or replace function public.library_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger library_members_touch before update on public.library_members
for each row execute function public.library_touch_updated_at();
create trigger shelf_positions_touch before update on public.library_shelf_positions
for each row execute function public.library_touch_updated_at();
create trigger books_touch before update on public.library_books
for each row execute function public.library_touch_updated_at();
create trigger decision_opinions_touch before update on public.library_decision_opinions
for each row execute function public.library_touch_updated_at();
create trigger decision_resolutions_touch before update on public.library_decision_resolutions
for each row execute function public.library_touch_updated_at();

create or replace function public.library_current_user_role()
returns public.library_user_role
language sql stable security definer set search_path = public
as $$
  select role from public.library_members where id = auth.uid() and active;
$$;

create or replace function public.library_current_display_name()
returns text
language sql stable security definer set search_path = public
as $$
  select display_name from public.library_members where id = auth.uid() and active;
$$;

create or replace function public.create_library_member_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  proposed_name text;
begin
  proposed_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Kullanıcı'));
  if char_length(proposed_name) < 2 then proposed_name := 'Kullanıcı'; end if;
  insert into public.library_members (id, display_name)
  values (new.id, left(proposed_name, 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger create_library_member_after_signup
after insert on auth.users
for each row execute function public.create_library_member_for_new_user();

insert into public.library_members (id, display_name)
select id, left(trim(coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1), 'Kullanıcı')), 80)
from auth.users
on conflict (id) do nothing;

-- Bu Supabase projesinde daha önce kurulmuş gönüllü ağı profilleri varsa
-- adları ve rolleri kütüphane yetkilerine güvenli biçimde eşlenir.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute $copy$
      insert into public.library_members (id, display_name, role, active)
      select p.id,
             coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1), 'Kullanıcı'),
             case p.role::text
               when 'admin' then 'admin'::public.library_user_role
               when 'coord' then 'coordinator'::public.library_user_role
               when 'coordinator' then 'coordinator'::public.library_user_role
               else 'volunteer'::public.library_user_role
             end,
             coalesce(p.status::text = 'active', true)
      from public.profiles p
      join auth.users u on u.id = p.id
      on conflict (id) do update set
        display_name = excluded.display_name,
        role = excluded.role,
        active = excluded.active
    $copy$;
  end if;
end;
$$;

create or replace function public.library_refresh_book_decision(p_book_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  matching record;
  single_opinion record;
begin
  -- Elle verilmiş veya eski sistemden aktarılmış kararlar korunur.
  if exists (
    select 1 from public.library_decision_resolutions
    where book_id = p_book_id and kind in ('legacy', 'manual')
  ) then
    return;
  end if;

  delete from public.library_decision_resolutions
  where book_id = p_book_id and kind in ('consensus', 'single_after_30_days');

  select choice, array_agg(voter_name order by updated_at) as voter_names,
         max(updated_at) as decided_at
  into matching
  from public.library_decision_opinions
  where book_id = p_book_id
  group by choice
  having count(*) >= 2
  order by max(updated_at)
  limit 1;

  if matching.choice is not null then
    insert into public.library_decision_resolutions (book_id, choice, kind, decided_at, decided_by_names)
    values (p_book_id, matching.choice, 'consensus', matching.decided_at, matching.voter_names)
    on conflict (book_id) do update set
      choice = excluded.choice,
      kind = excluded.kind,
      decided_at = excluded.decided_at,
      decided_by_names = excluded.decided_by_names;
    return;
  end if;

  select choice, voter_name, updated_at
  into single_opinion
  from public.library_decision_opinions
  where book_id = p_book_id
  order by updated_at
  limit 1;

  if (select count(*) from public.library_decision_opinions where book_id = p_book_id) = 1
     and single_opinion.updated_at <= now() - interval '30 days' then
    insert into public.library_decision_resolutions (book_id, choice, kind, decided_at, decided_by_names)
    values (p_book_id, single_opinion.choice, 'single_after_30_days',
            single_opinion.updated_at + interval '30 days', array[single_opinion.voter_name])
    on conflict (book_id) do update set
      choice = excluded.choice,
      kind = excluded.kind,
      decided_at = excluded.decided_at,
      decided_by_names = excluded.decided_by_names;
  end if;
end;
$$;

create or replace function public.library_recompute_decision_after_opinion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.library_refresh_book_decision(coalesce(new.book_id, old.book_id));
  return coalesce(new, old);
end;
$$;

create trigger opinion_recompute_after_write
after insert or update or delete on public.library_decision_opinions
for each row execute function public.library_recompute_decision_after_opinion();

create or replace function public.library_record_resolution_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or old.choice is distinct from new.choice or old.kind is distinct from new.kind then
    insert into public.library_decision_events
      (book_id, event_type, actor_name, choice, detail)
    values
      (new.book_id, 'resolved', array_to_string(new.decided_by_names, ' + '), new.choice,
       jsonb_build_object('kind', new.kind));
  end if;
  return new;
end;
$$;

create trigger library_resolution_event_after_write
after insert or update on public.library_decision_resolutions
for each row execute function public.library_record_resolution_event();

create or replace function public.library_submit_book_opinion(p_book_id uuid, p_choice public.library_decision_choice, p_note text default null)
returns public.library_decision_opinions
language plpgsql security definer set search_path = public
as $$
declare
  result public.library_decision_opinions;
  name text;
  existed boolean := false;
begin
  if public.library_current_user_role() not in ('coordinator', 'admin') then
    raise exception 'Bu işlem için koordinatör yetkisi gerekir.';
  end if;
  name := public.library_current_display_name();
  if name is null then raise exception 'Kullanıcı profili bulunamadı.'; end if;
  if exists (select 1 from public.library_decision_resolutions where book_id = p_book_id) then
    raise exception 'Bu kitabın kararı kesinleşmiş.';
  end if;

  update public.library_decision_opinions set
    voter_id = auth.uid(), voter_name = name, choice = p_choice,
    note = nullif(trim(p_note), ''), updated_at = now()
  where book_id = p_book_id
    and (voter_id = auth.uid()
      or voter_key = lower(regexp_replace(trim(name), '\s+', ' ', 'g')))
  returning * into result;
  existed := found;

  if not existed then
    insert into public.library_decision_opinions (book_id, voter_id, voter_name, choice, note)
    values (p_book_id, auth.uid(), name, p_choice, nullif(trim(p_note), ''))
    returning * into result;
  end if;

  insert into public.library_decision_events (book_id, event_type, actor_id, actor_name, choice)
  values (p_book_id, case when existed then 'opinion_changed' else 'opinion_added' end,
          auth.uid(), name, p_choice);
  return result;
end;
$$;

create or replace function public.library_update_my_display_name(p_display_name text)
returns public.library_members
language plpgsql security definer set search_path = public
as $$
declare
  result public.library_members;
  clean_name text := trim(p_display_name);
begin
  if auth.uid() is null then raise exception 'Oturum açmanız gerekir.'; end if;
  if char_length(clean_name) not between 2 and 80 then
    raise exception 'Ad 2 ile 80 karakter arasında olmalı.';
  end if;
  update public.library_members set display_name = clean_name
  where id = auth.uid() and active
  returning * into result;
  if result.id is null then raise exception 'Kullanıcı profili bulunamadı.'; end if;
  return result;
end;
$$;

create or replace function public.library_withdraw_my_book_opinion(p_book_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  name text;
  old_choice public.library_decision_choice;
begin
  if public.library_current_user_role() not in ('coordinator', 'admin') then
    raise exception 'Bu işlem için koordinatör yetkisi gerekir.';
  end if;
  name := public.library_current_display_name();
  if exists (select 1 from public.library_decision_resolutions where book_id = p_book_id) then
    raise exception 'Bu kitabın kararı kesinleşmiş; önce karar yeniden açılmalı.';
  end if;

  select choice into old_choice
  from public.library_decision_opinions
  where book_id = p_book_id
    and (voter_id = auth.uid() or voter_key = lower(regexp_replace(trim(name), '\s+', ' ', 'g')))
  limit 1;

  delete from public.library_decision_opinions
  where book_id = p_book_id
    and (voter_id = auth.uid() or voter_key = lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

  if not found then return false; end if;
  insert into public.library_decision_events (book_id, event_type, actor_id, actor_name, choice)
  values (p_book_id, 'opinion_withdrawn', auth.uid(), name, old_choice);
  return true;
end;
$$;

create or replace function public.library_reopen_book_decision(p_book_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  name text := public.library_current_display_name();
  old_choice public.library_decision_choice;
begin
  if public.library_current_user_role() not in ('coordinator', 'admin') then
    raise exception 'Bu işlem için koordinatör yetkisi gerekir.';
  end if;
  delete from public.library_decision_resolutions where book_id = p_book_id returning choice into old_choice;
  if not found then return false; end if;
  delete from public.library_decision_opinions where book_id = p_book_id;
  insert into public.library_decision_events (book_id, event_type, actor_id, actor_name, choice)
  values (p_book_id, 'resolution_reopened', auth.uid(), name, old_choice);
  return true;
end;
$$;

create or replace function public.library_finalize_expired_opinions()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  item record;
  affected integer := 0;
begin
  for item in
    select book_id from public.library_decision_opinions
    group by book_id
    having count(*) = 1 and max(updated_at) <= now() - interval '30 days'
  loop
    perform public.library_refresh_book_decision(item.book_id);
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;

create or replace view public.library_book_decision_status
with (security_invoker = true)
as
select
  b.id as book_id,
  r.choice as final_choice,
  r.kind as resolution_kind,
  r.decided_at,
  r.decided_by_names,
  count(o.id)::integer as opinion_count,
  count(distinct o.choice)::integer as distinct_choice_count,
  coalesce(jsonb_agg(jsonb_build_object(
    'choice', o.choice,
    'voter_name', o.voter_name,
    'note', o.note,
    'created_at', o.created_at,
    'updated_at', o.updated_at
  ) order by o.updated_at) filter (where o.id is not null), '[]'::jsonb) as opinions,
  case
    when r.book_id is not null then 'final'
    when count(distinct o.choice) > 1 then 'disagreement'
    when count(o.id) > 0 then 'waiting_second_opinion'
    else 'waiting_opinion'
  end as status
from public.library_books b
left join public.library_decision_opinions o on o.book_id = b.id
left join public.library_decision_resolutions r on r.book_id = b.id
where b.deleted_at is null
group by b.id, r.book_id, r.choice, r.kind, r.decided_at, r.decided_by_names;

create or replace view public.library_current_shelf_status
with (security_invoker = true)
as
select
  sp.*,
  coalesce(book_totals.book_records, 0) as book_records,
  coalesce(book_totals.physical_books, 0) as physical_books,
  latest_count.total_count as counted_books,
  latest_count.status as count_status,
  latest_count.counted_at,
  latest_count.counted_by_name,
  latest_count.photo_path as count_photo_path,
  latest_count.legacy_photo_url,
  coalesce(decision_totals.final_decisions, 0) as final_decisions
from public.library_shelf_positions sp
left join lateral (
  select count(*)::integer as book_records, coalesce(sum(copies), 0)::integer as physical_books
  from public.library_books b where b.shelf_position_id = sp.id and b.deleted_at is null
) book_totals on true
left join lateral (
  select sc.* from public.library_shelf_counts sc
  where sc.shelf_position_id = sp.id
  order by sc.counted_at desc, sc.id desc limit 1
) latest_count on true
left join lateral (
  select count(*)::integer as final_decisions
  from public.library_books b join public.library_decision_resolutions dr on dr.book_id = b.id
  where b.shelf_position_id = sp.id and b.deleted_at is null
) decision_totals on true;

-- Row-level security: tarayıcıda yalnız giriş yapmış kullanıcı işlem yapar.
alter table public.library_members enable row level security;
alter table public.library_locations enable row level security;
alter table public.library_shelf_positions enable row level security;
alter table public.library_shelf_counts enable row level security;
alter table public.library_boxes enable row level security;
alter table public.library_books enable row level security;
alter table public.library_decision_opinions enable row level security;
alter table public.library_decision_resolutions enable row level security;
alter table public.library_decision_events enable row level security;
alter table public.library_contact_messages enable row level security;

create policy "users read own profile and coordinators read profiles" on public.library_members for select to authenticated
using (id = auth.uid() or public.library_current_user_role() in ('coordinator', 'admin'));

create policy "authenticated users read locations" on public.library_locations for select to authenticated using (true);
create policy "authenticated users read shelf positions" on public.library_shelf_positions for select to authenticated using (true);
create policy "coordinators manage shelf positions" on public.library_shelf_positions for all to authenticated
using (public.library_current_user_role() in ('coordinator', 'admin'))
with check (public.library_current_user_role() in ('coordinator', 'admin'));

create policy "authenticated users read shelf counts" on public.library_shelf_counts for select to authenticated using (true);
create policy "volunteers create shelf counts" on public.library_shelf_counts for insert to authenticated
with check (counted_by = auth.uid() or public.library_current_user_role() in ('coordinator', 'admin'));
create policy "authors update unapproved shelf counts" on public.library_shelf_counts for update to authenticated
using ((counted_by = auth.uid() and approved_at is null) or public.library_current_user_role() in ('coordinator', 'admin'))
with check ((counted_by = auth.uid() and approved_at is null) or public.library_current_user_role() in ('coordinator', 'admin'));

create policy "authenticated users read books" on public.library_books for select to authenticated using (deleted_at is null or public.library_current_user_role() in ('coordinator', 'admin'));
create policy "volunteers create books" on public.library_books for insert to authenticated
with check (recorded_by = auth.uid() or public.library_current_user_role() in ('coordinator', 'admin'));
create policy "authors update unapproved books" on public.library_books for update to authenticated
using ((recorded_by = auth.uid() and bibliography_approved_at is null) or public.library_current_user_role() in ('coordinator', 'admin'))
with check ((recorded_by = auth.uid() and bibliography_approved_at is null) or public.library_current_user_role() in ('coordinator', 'admin'));

create policy "authenticated users read decisions" on public.library_decision_opinions for select to authenticated using (true);
create policy "authenticated users read resolutions" on public.library_decision_resolutions for select to authenticated using (true);
create policy "authenticated users read decision history" on public.library_decision_events for select to authenticated using (true);

create policy "coordinators read boxes" on public.library_boxes for select to authenticated using (public.library_current_user_role() in ('coordinator', 'admin'));
create policy "coordinators manage boxes" on public.library_boxes for all to authenticated
using (public.library_current_user_role() in ('coordinator', 'admin'))
with check (public.library_current_user_role() in ('coordinator', 'admin'));

create policy "users submit contact messages" on public.library_contact_messages for insert to authenticated
with check (sender_id = auth.uid());
create policy "coordinators read contact messages" on public.library_contact_messages for select to authenticated
using (public.library_current_user_role() in ('coordinator', 'admin'));

grant usage on schema public to authenticated;
grant select on public.library_locations, public.library_shelf_positions, public.library_current_shelf_status,
  public.library_books, public.library_book_decision_status, public.library_decision_opinions,
  public.library_decision_resolutions, public.library_decision_events to authenticated;
grant select, insert, update on public.library_shelf_counts, public.library_books, public.library_contact_messages to authenticated;
grant select on public.library_decision_opinions to authenticated;
grant select, insert, update, delete on public.library_boxes to authenticated;
grant usage, select on sequence public.library_shelf_counts_id_seq,
  public.library_decision_opinions_id_seq, public.library_decision_events_id_seq,
  public.library_contact_messages_id_seq to authenticated;
revoke all on function public.library_touch_updated_at() from public, anon, authenticated;
revoke all on function public.create_library_member_for_new_user() from public, anon, authenticated;
revoke all on function public.library_current_user_role() from public, anon;
revoke all on function public.library_current_display_name() from public, anon;
revoke all on function public.library_refresh_book_decision(uuid) from public, anon, authenticated;
revoke all on function public.library_recompute_decision_after_opinion() from public, anon, authenticated;
revoke all on function public.library_record_resolution_event() from public, anon, authenticated;
revoke all on function public.library_submit_book_opinion(uuid, public.library_decision_choice, text) from public, anon;
revoke all on function public.library_withdraw_my_book_opinion(uuid) from public, anon;
revoke all on function public.library_reopen_book_decision(uuid) from public, anon;
revoke all on function public.library_update_my_display_name(text) from public, anon;
revoke all on function public.library_finalize_expired_opinions() from public, anon, authenticated;
grant execute on function public.library_current_user_role() to authenticated;
grant execute on function public.library_current_display_name() to authenticated;
grant execute on function public.library_submit_book_opinion(uuid, public.library_decision_choice, text) to authenticated;
grant execute on function public.library_withdraw_my_book_opinion(uuid) to authenticated;
grant execute on function public.library_reopen_book_decision(uuid) to authenticated;
grant execute on function public.library_update_my_display_name(text) to authenticated;
grant execute on function public.library_finalize_expired_opinions() to service_role;

-- Kütüphanedeki 396 raf gözü: Giriş 53, Üst Kat 7, Diğer 6 kitaplık × 6 sıra.
insert into public.library_locations (code, name, sort_order) values
  ('G', 'Giriş Kat', 1), ('U', 'Üst Kat', 2), ('X', 'Diğer', 3);

create or replace function public.library_bookcase_label(n integer)
returns text language plpgsql immutable strict set search_path = '' as $$
declare result text := ''; value integer := n;
begin
  while value > 0 loop
    value := value - 1;
    result := chr(65 + (value % 26)) || result;
    value := value / 26;
  end loop;
  return result;
end;
$$;

revoke all on function public.library_bookcase_label(integer) from public, anon, authenticated;

insert into public.library_shelf_positions (code, location_code, bookcase_code, shelf_number, sort_order)
select location_code || '-' || bookcase_code || lpad(shelf_number::text, 2, '0'),
       location_code, bookcase_code, shelf_number, global_order
from (
  select 'G'::text as location_code, public.library_bookcase_label(bookcase) as bookcase_code,
         shelf_number, ((bookcase - 1) * 6 + shelf_number) as global_order
  from generate_series(1, 53) bookcase cross join generate_series(1, 6) shelf_number
  union all
  select 'U', public.library_bookcase_label(bookcase + 53), shelf_number,
         318 + ((bookcase - 1) * 6 + shelf_number)
  from generate_series(1, 7) bookcase cross join generate_series(1, 6) shelf_number
  union all
  select 'X', public.library_bookcase_label(bookcase), shelf_number,
         360 + ((bookcase - 1) * 6 + shelf_number)
  from generate_series(1, 6) bookcase cross join generate_series(1, 6) shelf_number
) seeded;

-- Fotoğraflar özel kovada tutulur; görüntüleme yetkisi signed URL ile verilir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-photos', 'library-photos', false, 12582912,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "authenticated users read library photos" on storage.objects for select to authenticated
using (bucket_id = 'library-photos');
create policy "authenticated users upload library photos" on storage.objects for insert to authenticated
with check (bucket_id = 'library-photos');
create policy "owners and coordinators update library photos" on storage.objects for update to authenticated
using (bucket_id = 'library-photos' and (owner_id = auth.uid()::text or public.library_current_user_role() in ('coordinator', 'admin')))
with check (bucket_id = 'library-photos');
create policy "owners and coordinators delete library photos" on storage.objects for delete to authenticated
using (bucket_id = 'library-photos' and (owner_id = auth.uid()::text or public.library_current_user_role() in ('coordinator', 'admin')));
