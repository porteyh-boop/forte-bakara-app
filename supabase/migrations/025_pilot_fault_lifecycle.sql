-- FORTE CORE Phase 1 — fault lifecycle fields (additive only)
-- Run manually in Supabase SQL Editor when ready.

alter table public.pilot_faults
  add column if not exists treatment_note text,
  add column if not exists closure_note text,
  add column if not exists treatment_started_at timestamptz;

comment on column public.pilot_faults.treatment_note is
  'Professional treatment note while fault is in progress';

comment on column public.pilot_faults.closure_note is
  'Summary note when fault is closed';

comment on column public.pilot_faults.treatment_started_at is
  'Timestamp when status moved to בטיפול';
