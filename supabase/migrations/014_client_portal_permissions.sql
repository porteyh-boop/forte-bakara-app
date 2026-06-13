-- פורטה בקרה — פורטל לקוח V1: הרשאת כניסה + מקור תקלה
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ
-- דורש: migrations 005, 013

alter table public.client_permissions
  add column if not exists can_view_building_dashboard boolean not null default false;

alter table public.pilot_faults
  add column if not exists fault_source text;

create index if not exists idx_pilot_faults_fault_source
  on public.pilot_faults(fault_source);
