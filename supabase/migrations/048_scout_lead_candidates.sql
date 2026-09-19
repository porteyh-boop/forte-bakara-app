-- 048: SCOUT lead candidates (staging before sales_leads import)
-- Requires: 037 sales_leads, 047 ai_tasks

create table if not exists public.scout_lead_candidates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ai_tasks (id) on delete cascade,
  candidate_type text not null,
  organization_name text not null default '',
  building_name text not null default '',
  city text not null default '',
  address text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  public_notes text not null default '',
  source_url text not null,
  source_title text not null default '',
  source_snippet text not null default '',
  raw_evidence jsonb not null default '[]'::jsonb,
  match_score smallint not null default 0,
  score_rationale text not null default '',
  duplicate_lead_id uuid references public.sales_leads (id) on delete set null,
  duplicate_match_reason text not null default '',
  review_status text not null default 'pending',
  sales_lead_id uuid references public.sales_leads (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scout_candidates_type_check check (
    candidate_type in (
      'vaad_bayit',
      'building_with_elevators',
      'management_company',
      'relevant_asset'
    )
  ),
  constraint scout_candidates_review_check check (
    review_status in ('pending', 'approved', 'rejected', 'imported')
  ),
  constraint scout_candidates_score_range check (
    match_score >= 0 and match_score <= 100
  ),
  constraint scout_candidates_source_url_required check (length(trim(source_url)) > 0)
);

create index if not exists idx_scout_candidates_task
  on public.scout_lead_candidates (task_id, created_at desc);

create index if not exists idx_scout_candidates_task_review
  on public.scout_lead_candidates (task_id, review_status);

create index if not exists idx_scout_candidates_duplicate_lead
  on public.scout_lead_candidates (duplicate_lead_id)
  where duplicate_lead_id is not null;

alter table public.scout_lead_candidates enable row level security;

revoke all on table public.scout_lead_candidates from public, anon, authenticated;
grant select, insert, update, delete on table public.scout_lead_candidates to service_role;

comment on table public.scout_lead_candidates is
  'SCOUT staging candidates with source URL/evidence; import to sales_leads only after human approval.';
