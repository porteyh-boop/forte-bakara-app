-- 050: FORTE AI CONTENT v1 — outreach drafts (no send)
-- Requires: 047 ai_agents, 048 scout_lead_candidates

create table if not exists public.scout_outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  scout_lead_candidate_id uuid not null
    references public.scout_lead_candidates (id) on delete cascade,
  sales_lead_id uuid references public.sales_leads (id) on delete set null,
  channel text not null,
  draft_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scout_outreach_channel_check check (
    channel in ('whatsapp', 'email', 'phone')
  ),
  constraint scout_outreach_draft_required check (length(trim(draft_text)) > 0)
);

create index if not exists idx_scout_outreach_drafts_candidate
  on public.scout_outreach_drafts (scout_lead_candidate_id, created_at desc);

alter table public.scout_outreach_drafts enable row level security;

revoke all on table public.scout_outreach_drafts from public, anon, authenticated;
grant select, insert, update, delete on table public.scout_outreach_drafts to service_role;

comment on table public.scout_outreach_drafts is
  'CONTENT v1 outreach drafts for approved SCOUT candidates; human sends outside the app.';
