-- פורטה בקרה — ניהול בניינים ומעליות (מסך /master בלבד)
-- אין מחיקת נתונים קיימים ב-pilot_faults / pilot_feedback

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  building_id text not null unique,
  name text not null,
  city text,
  address text,
  management_company text,
  elevator_company text,
  contact_name text,
  contact_phone text,
  floors_count int,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.elevators (
  id uuid primary key default gen_random_uuid(),
  building_id text not null,
  elevator_id text not null,
  elevator_name text not null,
  floors_count int,
  elevator_type text,
  is_active boolean not null default true,
  status text not null default 'פעילה',
  created_at timestamptz not null default now(),
  unique (building_id, elevator_id)
);

create index if not exists idx_buildings_building_id on public.buildings (building_id);
create index if not exists idx_buildings_is_active on public.buildings (is_active);
create index if not exists idx_elevators_building_id on public.elevators (building_id);
create index if not exists idx_elevators_is_active on public.elevators (is_active);

alter table public.buildings enable row level security;
alter table public.elevators enable row level security;

drop policy if exists "buildings_pilot_all" on public.buildings;
create policy "buildings_pilot_all"
  on public.buildings for all
  using (true)
  with check (true);

drop policy if exists "elevators_pilot_all" on public.elevators;
create policy "elevators_pilot_all"
  on public.elevators for all
  using (true)
  with check (true);
