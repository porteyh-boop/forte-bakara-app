-- FORTE V2 — Master internal fault inbox (additive only)
-- Run manually in Supabase SQL Editor when ready.
--
-- Source of truth: AFTER INSERT on public.pilot_faults → master_fault_inbox row.
-- No backfill — faults that exist before this migration do not receive inbox rows.
--
-- RLS: no anon/authenticated access.
-- All read/mark-read via service_role through /forte/api/master-fault-inbox + Master session.

create table if not exists public.master_fault_inbox (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null
    references public.pilot_faults(id) on delete cascade,
  building_id text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint master_fault_inbox_fault_id_unique unique (fault_id)
);

create index if not exists idx_master_fault_inbox_building_id
  on public.master_fault_inbox(building_id);

create index if not exists idx_master_fault_inbox_unread
  on public.master_fault_inbox(read_at)
  where read_at is null;

create index if not exists idx_master_fault_inbox_created_at
  on public.master_fault_inbox(created_at desc);

alter table public.master_fault_inbox enable row level security;

revoke all on table public.master_fault_inbox from anon, authenticated;

grant select, insert, update, delete on table public.master_fault_inbox to service_role;

-- Trigger: one inbox notification per new pilot_faults row (idempotent via UNIQUE + ON CONFLICT).
create or replace function public.create_master_fault_inbox_on_pilot_fault_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.building_id is null or btrim(new.building_id) = '' then
    return new;
  end if;

  insert into public.master_fault_inbox (fault_id, building_id)
  values (new.id, lower(btrim(new.building_id)))
  on conflict (fault_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_pilot_faults_create_master_fault_inbox on public.pilot_faults;

create trigger trg_pilot_faults_create_master_fault_inbox
  after insert on public.pilot_faults
  for each row
  execute function public.create_master_fault_inbox_on_pilot_fault_insert();
