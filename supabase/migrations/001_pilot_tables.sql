-- פורטה בקרה — טבלאות פיילוט מינימליות (שלב ביניים)
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ

create extension if not exists "pgcrypto";

create table if not exists public.pilot_faults (
  id uuid primary key default gen_random_uuid(),
  building_id text not null,
  building_name text not null,
  elevator_id text not null,
  elevator_name text not null,
  fault_type text not null,
  description text not null,
  is_disabled boolean not null default false,
  status text not null default 'פתוחה',
  ticket_number text,
  image_data text,
  image_url text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  source_device_id text
);

create index if not exists pilot_faults_building_id_idx on public.pilot_faults (building_id);
create index if not exists pilot_faults_status_idx on public.pilot_faults (status);
create index if not exists pilot_faults_created_at_idx on public.pilot_faults (created_at desc);
create index if not exists pilot_faults_ticket_number_idx on public.pilot_faults (ticket_number);

create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  building_id text not null,
  building_name text not null,
  sender_name text not null,
  sender_role text not null,
  rating int not null check (rating between 1 and 5),
  would_use_regularly text not null,
  unclear_or_missing text default '',
  expected_feature text default '',
  would_recommend text not null,
  created_at timestamptz not null default now(),
  source_device_id text
);

create index if not exists pilot_feedback_building_id_idx on public.pilot_feedback (building_id);
create index if not exists pilot_feedback_created_at_idx on public.pilot_feedback (created_at desc);

-- RLS פתוח לשלב פיילוט ביניים (ללא login ללקוחות)
-- חשוב: להחליף במדיניות מוגבלת לפני מסחור
alter table public.pilot_faults enable row level security;
alter table public.pilot_feedback enable row level security;

drop policy if exists "pilot_faults_public_all" on public.pilot_faults;
create policy "pilot_faults_public_all" on public.pilot_faults
  for all using (true) with check (true);

drop policy if exists "pilot_feedback_public_all" on public.pilot_feedback;
create policy "pilot_feedback_public_all" on public.pilot_feedback
  for all using (true) with check (true);
