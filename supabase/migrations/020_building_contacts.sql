-- פורטה בקרה — אנשי קשר לבניין (מערכת FORTE החדשה)
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ
--
-- RLS: אין גישה ל-anon/authenticated — הטבלה מכילה PII (שם, טלפון, דוא"ל).
-- CRUD מתבצע דרך API server-side עם service_role בלבד.

create table if not exists public.building_contacts (
  id uuid primary key default gen_random_uuid(),
  building_id text not null,
  full_name text not null,
  role_title text not null default '',
  company text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  contact_type text not null,
  is_primary boolean not null default false,
  receives_reports boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_building_contacts_building_id
  on public.building_contacts (building_id);

create index if not exists idx_building_contacts_primary
  on public.building_contacts (building_id, is_primary)
  where is_primary = true;

alter table public.building_contacts enable row level security;

drop policy if exists "building_contacts_public_all" on public.building_contacts;

revoke all on table public.building_contacts from anon, authenticated;

grant select, insert, update, delete on table public.building_contacts to service_role;
