-- ════════════════════════════════════════════
-- Tarih Vakfı Gönüllü Yönetim Sistemi
-- Supabase Full Schema
-- ════════════════════════════════════════════

-- 1) ROLLER & PROFİLLER
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  phone text,
  display_name text not null default '',
  avatar_url text,
  role text not null default 'vol' check (role in ('admin','coord','vol')),
  department text check (department in (
    'arsiv','egitim','etkinlik','dijital','rehber','baski','bagis','idari'
  )),
  bio text default '',
  city text default '',
  status text default 'active' check (status in ('active','inactive','pending')),
  total_hours numeric default 0,
  joined_at timestamptz default now(),
  last_active timestamptz default now(),
  settings jsonb default '{"email_notifs":true,"dark_mode":false}'::jsonb
);

alter table public.profiles enable row level security;

-- Herkes profilleri görebilir (vakıf içi)
create policy "profiles_select" on public.profiles
  for select using (auth.uid() is not null);

-- Kendi profilini düzenleyebilir
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Admin tüm profilleri düzenleyebilir
create policy "profiles_update_admin" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Profil oluşturma (trigger ile)
create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

-- 2) GÖREVLER
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text default '',
  department text not null,
  assigned_to uuid[] default '{}',
  priority text default 'medium' check (priority in ('high','medium','low')),
  status text default 'pending' check (status in ('pending','active','done','cancelled')),
  deadline date,
  created_by uuid references public.profiles(id) not null,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.tasks enable row level security;
create policy "tasks_select" on public.tasks for select using (auth.uid() is not null);
create policy "tasks_insert" on public.tasks for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','coord'))
);
create policy "tasks_update" on public.tasks for update using (
  auth.uid() = created_by
  or auth.uid() = any(assigned_to)
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','coord'))
);
create policy "tasks_delete" on public.tasks for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 3) SAAT KAYITLARI
create table public.hour_logs (
  id uuid default gen_random_uuid() primary key,
  volunteer_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  hours numeric not null check (hours > 0),
  department text not null,
  description text default '',
  status text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text default '',
  created_at timestamptz default now()
);

alter table public.hour_logs enable row level security;
create policy "hours_select" on public.hour_logs for select using (
  auth.uid() = volunteer_id
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','coord'))
);
create policy "hours_insert" on public.hour_logs for insert with check (auth.uid() = volunteer_id);
create policy "hours_update_reviewer" on public.hour_logs for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','coord'))
);
create policy "hours_delete_own" on public.hour_logs for delete using (
  auth.uid() = volunteer_id and status = 'pending'
);

-- 4) VARDİYALAR
create table public.shifts (
  id uuid default gen_random_uuid() primary key,
  volunteer_id uuid references public.profiles(id) on delete cascade not null,
  day_of_week text not null check (day_of_week in ('Pzt','Sal','Çar','Per','Cum','Cmt','Paz')),
  start_time time not null,
  end_time time not null,
  department text not null,
  is_recurring boolean default true,
  specific_date date, -- null ise haftalık tekrar
  note text default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.shifts enable row level security;
create policy "shifts_select" on public.shifts for select using (auth.uid() is not null);
create policy "shifts_insert" on public.shifts for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','coord'))
);
create policy "shifts_update" on public.shifts for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','coord'))
);
create policy "shifts_delete" on public.shifts for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','coord'))
);

-- 5) DUYURULAR
create table public.announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  body text not null,
  author_id uuid references public.profiles(id) not null,
  department text, -- null = herkese
  is_pinned boolean default false,
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;
create policy "ann_select" on public.announcements for select using (auth.uid() is not null);
create policy "ann_insert" on public.announcements for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','coord'))
);
create policy "ann_update" on public.announcements for update using (
  auth.uid() = author_id
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "ann_delete" on public.announcements for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 6) GÖNÜLLÜ BAŞVURULARI
create table public.applications (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  phone text,
  department text not null,
  motivation text default '',
  experience text default '',
  availability text default '',
  status text default 'pending' check (status in ('pending','approved','rejected','interview')),
  reviewed_by uuid references public.profiles(id),
  review_note text default '',
  applied_at timestamptz default now()
);

alter table public.applications enable row level security;
-- Başvuru herkes yapabilir (auth olmadan da)
create policy "app_insert" on public.applications for insert with check (true);
create policy "app_select" on public.applications for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','coord'))
);
create policy "app_update" on public.applications for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','coord'))
);

-- 7) BİLDİRİMLER
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('task','hours','announcement','application','shift','system','welcome')),
  title text not null,
  body text default '',
  is_read boolean default false,
  link text default '',
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;
create policy "notif_select" on public.notifications for select using (auth.uid() = user_id);
create policy "notif_update" on public.notifications for update using (auth.uid() = user_id);
create policy "notif_insert" on public.notifications for insert with check (true);

-- ════════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════════

-- Gönüllü özet istatistikleri
create or replace view public.volunteer_stats as
select
  p.id,
  p.display_name,
  p.role,
  p.department,
  p.status,
  p.avatar_url,
  p.joined_at,
  coalesce(sum(h.hours) filter (where h.status = 'approved'), 0) as approved_hours,
  coalesce(sum(h.hours) filter (where h.status = 'pending'), 0) as pending_hours,
  count(h.id) filter (where h.status = 'approved') as approved_count,
  count(distinct h.date) filter (where h.status = 'approved') as active_days,
  max(h.date) filter (where h.status = 'approved') as last_active_date
from public.profiles p
left join public.hour_logs h on h.volunteer_id = p.id
group by p.id;

-- Departman özet
create or replace view public.department_stats as
select
  h.department,
  count(distinct h.volunteer_id) as volunteer_count,
  coalesce(sum(h.hours) filter (where h.status = 'approved'), 0) as total_hours,
  coalesce(sum(h.hours) filter (
    where h.status = 'approved'
    and extract(month from h.date) = extract(month from current_date)
    and extract(year from h.date) = extract(year from current_date)
  ), 0) as monthly_hours
from public.hour_logs h
group by h.department;

-- ════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════

-- Yeni kullanıcı → otomatik profil + hoşgeldin bildirimi
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_name text;
  user_email text;
  user_phone text;
begin
  user_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'display_name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Gönüllü'
  );
  user_email := new.email;
  user_phone := new.phone;

  insert into public.profiles (id, email, phone, display_name, role, status)
  values (new.id, user_email, user_phone, user_name, 'vol', 'active');

  -- Hoşgeldin bildirimi
  insert into public.notifications (user_id, type, title, body)
  values (new.id, 'welcome', '🏛️ Tarih Vakfı''na Hoş Geldiniz!',
    'Gönüllü yönetim sistemine kaydınız tamamlandı. Koordinatörünüz size departman ve görev atayacaktır.');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Saat onaylandığında toplam güncelle
create or replace function public.update_volunteer_hours()
returns trigger as $$
begin
  if NEW.status = 'approved' and (OLD.status is null or OLD.status != 'approved') then
    update public.profiles
    set total_hours = total_hours + NEW.hours,
        last_active = now()
    where id = NEW.volunteer_id;

    -- Bildirim
    insert into public.notifications (user_id, type, title, body)
    values (NEW.volunteer_id, 'hours', '✅ Saat onaylandı',
      NEW.hours || ' saatlik kaydınız onaylandı. (' || NEW.description || ')');

  elsif NEW.status = 'rejected' and OLD.status = 'pending' then
    insert into public.notifications (user_id, type, title, body)
    values (NEW.volunteer_id, 'hours', '❌ Saat reddedildi',
      'Kaydınız reddedildi: ' || coalesce(NEW.review_note, 'Açıklama yok'));
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_hour_status_change
  after update of status on public.hour_logs
  for each row execute procedure public.update_volunteer_hours();

-- Görev atandığında bildirim
create or replace function public.notify_task_assignment()
returns trigger as $$
declare
  vol_id uuid;
begin
  if NEW.assigned_to is not null then
    foreach vol_id in array NEW.assigned_to loop
      if OLD.assigned_to is null or not (vol_id = any(OLD.assigned_to)) then
        insert into public.notifications (user_id, type, title, body)
        values (vol_id, 'task', '📋 Yeni görev atandı', NEW.title);
      end if;
    end loop;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_task_assigned
  after insert or update of assigned_to on public.tasks
  for each row execute procedure public.notify_task_assignment();

-- ════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════

create index idx_profiles_role on public.profiles(role);
create index idx_profiles_dept on public.profiles(department);
create index idx_profiles_status on public.profiles(status);
create index idx_hours_volunteer on public.hour_logs(volunteer_id);
create index idx_hours_status on public.hour_logs(status);
create index idx_hours_date on public.hour_logs(date desc);
create index idx_tasks_status on public.tasks(status);
create index idx_tasks_dept on public.tasks(department);
create index idx_shifts_volunteer on public.shifts(volunteer_id);
create index idx_shifts_day on public.shifts(day_of_week);
create index idx_notifications_user on public.notifications(user_id, is_read);
create index idx_applications_status on public.applications(status);
create index idx_announcements_pinned on public.announcements(is_pinned desc, created_at desc);

-- ════════════════════════════════════════════
-- ADMIN KULLANICISI
-- ════════════════════════════════════════════
-- Not: İlk admin kullanıcısı kaydolduktan sonra
-- Supabase SQL Editor'da şu komutu çalıştır:
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'senin@email.com';
