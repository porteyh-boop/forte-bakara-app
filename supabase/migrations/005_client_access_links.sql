-- פורטה בקרה — קישורי גישה אישיים ללקוחות (Master בלבד)
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ

create table if not exists public.client_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  access_token text not null unique,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.client_access (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references public.client_users(id) on delete cascade,
  building_id text not null,
  elevator_id text,
  access_level text not null default 'building',
  created_at timestamptz not null default now()
);

create index if not exists idx_client_users_access_token
  on public.client_users(access_token);

create index if not exists idx_client_access_user
  on public.client_access(client_user_id);

create index if not exists idx_client_access_building
  on public.client_access(building_id);

create index if not exists idx_client_access_elevator
  on public.client_access(elevator_id);

-- RLS פתוח לשלב פיילוט ביניים (כמו pilot_faults)
-- חשוב: להחליף במדיניות מוגבלת לפני מסחור
alter table public.client_users enable row level security;
alter table public.client_access enable row level security;

drop policy if exists "client_users_public_all" on public.client_users;
create policy "client_users_public_all" on public.client_users
  for all using (true) with check (true);

drop policy if exists "client_access_public_all" on public.client_access;
create policy "client_access_public_all" on public.client_access
  for all using (true) with check (true);
