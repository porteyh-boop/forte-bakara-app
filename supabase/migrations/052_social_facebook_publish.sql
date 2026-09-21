-- 052: Facebook Page connection + real publish metadata (Graph API via server)
-- Requires: 051 social_marketing_posts

create table if not exists public.social_facebook_oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  state_token_hash text not null unique,
  master_session_hash text not null,
  encrypted_user_access_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_social_facebook_oauth_sessions_expires
  on public.social_facebook_oauth_sessions (expires_at);

create table if not exists public.social_facebook_connection (
  id uuid primary key default gen_random_uuid(),
  singleton_key text not null default 'default' unique,
  page_id text not null,
  page_name text not null,
  encrypted_page_access_token text not null,
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_facebook_page_id_required check (length(trim(page_id)) > 0)
);

alter table public.social_marketing_posts
  add column if not exists content_version integer not null default 1,
  add column if not exists approved_content_version integer,
  add column if not exists facebook_post_id text,
  add column if not exists facebook_post_url text,
  add column if not exists published_to_facebook_at timestamptz,
  add column if not exists publishing_started_at timestamptz,
  add column if not exists publish_error_code text;

create unique index if not exists idx_social_marketing_posts_facebook_post_id
  on public.social_marketing_posts (facebook_post_id)
  where facebook_post_id is not null;

alter table public.social_marketing_posts drop constraint if exists social_marketing_status_check;
alter table public.social_marketing_posts add constraint social_marketing_status_check check (
  status in (
    'draft',
    'pending_approval',
    'approved',
    'scheduled',
    'ready_to_publish',
    'published',
    'failed',
    'rejected',
    'publish_uncertain'
  )
);

alter table public.social_facebook_oauth_sessions enable row level security;
alter table public.social_facebook_connection enable row level security;

revoke all on table public.social_facebook_oauth_sessions from public, anon, authenticated;
revoke all on table public.social_facebook_connection from public, anon, authenticated;
grant select, insert, update, delete on table public.social_facebook_oauth_sessions to service_role;
grant select, insert, update, delete on table public.social_facebook_connection to service_role;

comment on table public.social_facebook_connection is
  'Single Facebook Page connection for marketing publish; tokens encrypted at rest.';
