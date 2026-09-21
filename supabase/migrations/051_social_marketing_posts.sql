-- 051: FORTE AI — סוכן שיווק (Facebook / Instagram), ללא פרסום Meta בשלב זה
-- Requires: 047 ai_agents

alter table public.ai_agents drop constraint if exists ai_agents_agent_key_check;
alter table public.ai_agents add constraint ai_agents_agent_key_check check (
  agent_key in (
    'manager',
    'scout',
    'qualifier',
    'content',
    'marketing',
    'distribution',
    'engagement',
    'sales'
  )
);

insert into public.ai_agents (agent_key, display_name, description, status)
values (
  'marketing',
  'שיווק',
  'הכנה ותזמון פוסטים לרשתות חברתיות — פרסום רק לאחר אישור יהודה.',
  'active'
)
on conflict (agent_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  status = excluded.status,
  updated_at = now();

create table if not exists public.social_marketing_posts (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  target_audience text not null default '',
  platform text not null,
  body_facebook text not null default '',
  body_instagram text not null default '',
  publish_date date,
  publish_time time,
  image_url text,
  status text not null default 'draft',
  approved_at timestamptz,
  approved_by text,
  meta_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_marketing_topic_required check (length(trim(topic)) > 0),
  constraint social_marketing_platform_check check (
    platform in ('facebook', 'instagram', 'both')
  ),
  constraint social_marketing_status_check check (
    status in (
      'draft',
      'pending_approval',
      'approved',
      'scheduled',
      'ready_to_publish',
      'published',
      'failed',
      'rejected'
    )
  )
);

create index if not exists idx_social_marketing_posts_status
  on public.social_marketing_posts (status, updated_at desc);

alter table public.social_marketing_posts enable row level security;

revoke all on table public.social_marketing_posts from public, anon, authenticated;
grant select, insert, update, delete on table public.social_marketing_posts to service_role;

comment on table public.social_marketing_posts is
  'Marketing agent v1 — social posts; scheduling/publish requires approved_at + approved_by.';
