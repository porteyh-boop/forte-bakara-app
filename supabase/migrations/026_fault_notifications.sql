-- FORTE CORE Phase 2 — fault notification log (additive only)
-- Run manually in Supabase SQL Editor when ready.
--
-- RLS: אין גישה ל-anon/authenticated.
-- INSERT מתבצע server-side בלבד דרך service_role (/api/fault-notify).
-- SELECT ל-Master מתבצע דרך /forte/api/fault-notifications עם Master session + service_role.

create table if not exists public.fault_notifications (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null
    references public.pilot_faults(id) on delete cascade,
  building_id text not null,
  event_type text not null
    check (event_type in (
      'FAULT_CREATED',
      'FAULT_TREATMENT_STARTED',
      'FAULT_TREATMENT_UPDATED',
      'FAULT_CLOSED',
      'FAULT_REOPENED'
    )),
  channel text not null default 'telegram',
  recipient text,
  status text not null
    check (status in ('sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_fault_notifications_fault_id
  on public.fault_notifications(fault_id);

create index if not exists idx_fault_notifications_building_id
  on public.fault_notifications(building_id);

create index if not exists idx_fault_notifications_created_at
  on public.fault_notifications(created_at desc);

alter table public.fault_notifications enable row level security;

drop policy if exists "fault_notifications_public_all" on public.fault_notifications;

revoke all on table public.fault_notifications from anon, authenticated;

grant select, insert, update, delete on table public.fault_notifications to service_role;
