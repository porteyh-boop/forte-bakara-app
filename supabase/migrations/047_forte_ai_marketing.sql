-- 047: FORTE AI Marketing — multi-agent core (infrastructure only)
-- Requires: 037 sales_leads

-- ---------------------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------------------

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null,
  display_name text not null,
  description text not null default '',
  status text not null default 'idle',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_agents_agent_key_check check (
    agent_key in ('manager', 'scout', 'content', 'distribution', 'engagement', 'sales')
  ),
  constraint ai_agents_status_check check (
    status in ('idle', 'active', 'paused', 'error')
  ),
  constraint ai_agents_agent_key_unique unique (agent_key)
);

-- ---------------------------------------------------------------------------
-- Marketing campaigns & content (no external publish in phase 1)
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  status text not null default 'draft',
  lead_id uuid references public.sales_leads (id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaigns_name_required check (length(trim(name)) > 0),
  constraint marketing_campaigns_status_check check (
    status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived')
  )
);

create table if not exists public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  content_type text not null default 'general',
  status text not null default 'draft',
  lead_id uuid references public.sales_leads (id) on delete set null,
  campaign_id uuid references public.marketing_campaigns (id) on delete set null,
  created_by_agent_id uuid references public.ai_agents (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_content_title_required check (length(trim(title)) > 0),
  constraint marketing_content_status_check check (
    status in ('draft', 'pending_approval', 'approved', 'published', 'archived')
  )
);

-- ---------------------------------------------------------------------------
-- Tasks, actions, approvals
-- ---------------------------------------------------------------------------

create table if not exists public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ai_agents (id) on delete cascade,
  task_type text not null,
  title text not null,
  description text not null default '',
  status text not null default 'pending',
  priority smallint not null default 0,
  lead_id uuid references public.sales_leads (id) on delete set null,
  campaign_id uuid references public.marketing_campaigns (id) on delete set null,
  content_id uuid references public.marketing_content (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_tasks_title_required check (length(trim(title)) > 0),
  constraint ai_tasks_status_check check (
    status in ('pending', 'running', 'completed', 'failed', 'cancelled')
  )
);

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ai_agents (id) on delete restrict,
  task_id uuid references public.ai_tasks (id) on delete set null,
  action_type text not null,
  risk_level text not null default 'internal',
  requires_approval boolean not null default false,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  lead_id uuid references public.sales_leads (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ai_actions_summary_required check (length(trim(summary)) > 0),
  constraint ai_actions_risk_level_check check (
    risk_level in ('internal', 'system_change', 'external')
  )
);

create table if not exists public.ai_approvals (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.ai_actions (id) on delete cascade,
  approval_kind text not null,
  status text not null default 'pending',
  approver_label text not null default 'יהודה',
  decision_note text not null default '',
  payload jsonb not null default '{}'::jsonb,
  decided_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_approvals_status_check check (
    status in ('pending', 'approved', 'rejected', 'executed')
  ),
  constraint ai_approvals_action_unique unique (action_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_ai_tasks_agent_status
  on public.ai_tasks (agent_id, status, updated_at desc);

create index if not exists idx_ai_tasks_active
  on public.ai_tasks (status, updated_at desc)
  where status in ('pending', 'running');

create index if not exists idx_ai_actions_created
  on public.ai_actions (created_at desc);

create index if not exists idx_ai_approvals_status
  on public.ai_approvals (status, updated_at desc);

create index if not exists idx_marketing_content_status
  on public.marketing_content (status, updated_at desc);

create index if not exists idx_marketing_campaigns_status
  on public.marketing_campaigns (status, updated_at desc);

-- ---------------------------------------------------------------------------
-- Seed agents (idempotent)
-- ---------------------------------------------------------------------------

insert into public.ai_agents (agent_key, display_name, description, status)
values
  (
    'manager',
    'מנהל AI',
    'תיאום סוכני השיווק, תיעוד ומדיניות אישורים — ללא פעולות חיצוניות בשלב זה.',
    'idle'
  ),
  (
    'scout',
    'SCOUT',
    'איתור והעשרת לידים (שלב עתידי).',
    'idle'
  ),
  (
    'content',
    'CONTENT',
    'יצירת תוכן וקריאייטיב (שלב עתידי).',
    'idle'
  ),
  (
    'distribution',
    'DISTRIBUTION',
    'הפצה וקמפיינים (שלב עתידי).',
    'idle'
  ),
  (
    'engagement',
    'ENGAGEMENT',
    'טיפול במתעניינים ומעקב (שלב עתידי).',
    'idle'
  ),
  (
    'sales',
    'SALES',
    'קידום לידים למכירה (שלב עתידי).',
    'idle'
  )
on conflict (agent_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- RLS: service_role only (Master server APIs)
-- ---------------------------------------------------------------------------

alter table public.ai_agents enable row level security;
alter table public.ai_tasks enable row level security;
alter table public.ai_actions enable row level security;
alter table public.ai_approvals enable row level security;
alter table public.marketing_content enable row level security;
alter table public.marketing_campaigns enable row level security;

revoke all on table public.ai_agents from public, anon, authenticated;
revoke all on table public.ai_tasks from public, anon, authenticated;
revoke all on table public.ai_actions from public, anon, authenticated;
revoke all on table public.ai_approvals from public, anon, authenticated;
revoke all on table public.marketing_content from public, anon, authenticated;
revoke all on table public.marketing_campaigns from public, anon, authenticated;

grant select, insert, update, delete on table public.ai_agents to service_role;
grant select, insert, update, delete on table public.ai_tasks to service_role;
grant select, insert, update, delete on table public.ai_actions to service_role;
grant select, insert, update, delete on table public.ai_approvals to service_role;
grant select, insert, update, delete on table public.marketing_content to service_role;
grant select, insert, update, delete on table public.marketing_campaigns to service_role;

comment on table public.ai_agents is
  'FORTE AI Marketing agent registry. Server APIs only (service_role).';
comment on table public.ai_tasks is
  'Work items for AI agents; links optionally to sales_leads and marketing entities.';
comment on table public.ai_actions is
  'Immutable audit log of agent actions; external actions require ai_approvals.';
comment on table public.ai_approvals is
  'Human approval queue (יהודה) for publish/message/email/proposal/commitment.';
comment on table public.marketing_content is
  'Draft marketing content; no external publish in phase 1 infrastructure.';
comment on table public.marketing_campaigns is
  'Marketing campaigns metadata; distribution agent phase 2+.';
