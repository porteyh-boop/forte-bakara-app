-- 049: FORTE AI QUALIFIER v1 (rule-based recommendations on SCOUT candidates)
-- Requires: 047 ai_agents, 048 scout_lead_candidates

-- Extend allowed agent keys
alter table public.ai_agents drop constraint if exists ai_agents_agent_key_check;
alter table public.ai_agents add constraint ai_agents_agent_key_check check (
  agent_key in (
    'manager',
    'scout',
    'qualifier',
    'content',
    'distribution',
    'engagement',
    'sales'
  )
);

insert into public.ai_agents (agent_key, display_name, description, status)
values (
  'qualifier',
  'QUALIFIER',
  'סינון והמלצה על מועמדי SCOUT — ללא ייבוא או פנייה ללקוח.',
  'idle'
)
on conflict (agent_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  updated_at = now();

-- Qualifier output on staging candidates (does not replace review_status)
alter table public.scout_lead_candidates
  add column if not exists qualify_verdict text,
  add column if not exists qualify_reason text,
  add column if not exists qualified_at timestamptz;

alter table public.scout_lead_candidates drop constraint if exists scout_candidates_qualify_verdict_check;
alter table public.scout_lead_candidates add constraint scout_candidates_qualify_verdict_check check (
  qualify_verdict is null
  or qualify_verdict in ('suitable', 'review', 'unsuitable')
);

comment on column public.scout_lead_candidates.qualify_verdict is
  'QUALIFIER v1 recommendation: suitable | review | unsuitable (human review_status unchanged).';
comment on column public.scout_lead_candidates.qualify_reason is
  'Short Hebrew explanation from rule-based QUALIFIER.';
comment on column public.scout_lead_candidates.qualified_at is
  'When QUALIFIER last ran for this candidate.';
