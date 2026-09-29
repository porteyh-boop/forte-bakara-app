-- 056: Multiple Facebook Page connections + per-page publish + post publish_targets
-- Requires: 055_social_post_image_mode.sql

alter table public.social_facebook_connection
  add column if not exists display_label text,
  add column if not exists connection_status text not null default 'connected',
  add column if not exists last_token_checked_at timestamptz,
  add column if not exists is_primary_for_instagram boolean not null default false;

alter table public.social_facebook_connection
  drop constraint if exists social_facebook_connection_status_check;

alter table public.social_facebook_connection
  add constraint social_facebook_connection_status_check check (
    connection_status in ('connected', 'disconnected', 'token_invalid')
  );

update public.social_facebook_connection
set display_label = coalesce(nullif(trim(display_label), ''), nullif(trim(page_name), ''), 'Facebook')
where display_label is null or trim(display_label) = '';

alter table public.social_facebook_connection
  alter column display_label set not null;

alter table public.social_facebook_connection
  drop constraint if exists social_facebook_connection_singleton_key_key;

create unique index if not exists idx_social_facebook_connection_page_id_connected
  on public.social_facebook_connection (page_id)
  where connection_status = 'connected';

-- Backfill exactly one Primary for Instagram (prefer legacy singleton row)
update public.social_facebook_connection
set is_primary_for_instagram = false
where is_primary_for_instagram;

with legacy_primary as (
  select id
  from public.social_facebook_connection
  where instagram_business_account_id is not null
    and trim(instagram_business_account_id) <> ''
  order by
    case when singleton_key = 'default' then 0 else 1 end,
    case when connection_status = 'connected' then 0 else 1 end,
    connected_at asc nulls last
  limit 1
)
update public.social_facebook_connection c
set is_primary_for_instagram = true
from legacy_primary lp
where c.id = lp.id;

-- At most one row may be Primary for Instagram (DB-enforced, including concurrent writes)
create unique index if not exists idx_social_facebook_connection_one_primary_ig
  on public.social_facebook_connection ((true))
  where is_primary_for_instagram;

alter table public.social_marketing_posts
  add column if not exists publish_targets jsonb not null default '{}'::jsonb;

create table if not exists public.social_marketing_facebook_publications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_marketing_posts (id) on delete cascade,
  connection_id uuid not null references public.social_facebook_connection (id) on delete restrict,
  publish_status text not null default 'pending',
  facebook_post_id text,
  facebook_post_url text,
  publish_mode text,
  publish_error_code text,
  publish_error_message text,
  published_at timestamptz,
  publishing_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sm_fb_pub_status_check check (
    publish_status in ('pending', 'published', 'failed', 'skipped', 'not_selected')
  ),
  constraint sm_fb_pub_mode_check check (
    publish_mode is null or publish_mode in ('feed', 'photos')
  ),
  constraint sm_fb_pub_post_connection_unique unique (post_id, connection_id)
);

create index if not exists idx_sm_fb_pub_post
  on public.social_marketing_facebook_publications (post_id);

create unique index if not exists idx_sm_fb_pub_graph_post_id
  on public.social_marketing_facebook_publications (facebook_post_id)
  where facebook_post_id is not null;

alter table public.social_marketing_facebook_publications enable row level security;
revoke all on table public.social_marketing_facebook_publications from public, anon, authenticated;
grant select, insert, update, delete on table public.social_marketing_facebook_publications to service_role;

-- Backfill publication row for legacy single-page publish
insert into public.social_marketing_facebook_publications (
  post_id,
  connection_id,
  publish_status,
  facebook_post_id,
  facebook_post_url,
  published_at,
  publish_mode,
  publish_error_code,
  publish_error_message
)
select
  p.id,
  c.id,
  case
    when p.facebook_post_id is not null then 'published'
    when p.facebook_publish_status = 'failed' then 'failed'
    when p.platform = 'instagram' then 'not_selected'
    else 'pending'
  end,
  p.facebook_post_id,
  p.facebook_post_url,
  p.published_to_facebook_at,
  nullif(trim(p.meta_payload->'facebook'->>'publishMode'), ''),
  p.publish_error_code,
  p.publish_error_message
from public.social_marketing_posts p
cross join lateral (
  select id
  from public.social_facebook_connection
  where connection_status = 'connected'
  order by
    case when singleton_key = 'default' then 0 else 1 end,
    connected_at asc nulls last
  limit 1
) c
where p.platform in ('facebook', 'both')
  and not exists (
    select 1
    from public.social_marketing_facebook_publications x
    where x.post_id = p.id and x.connection_id = c.id
  );

comment on table public.social_facebook_connection is
  'N Facebook Page connections; tokens encrypted; optional primary for Instagram.';
comment on column public.social_marketing_posts.publish_targets is
  '{"facebookConnectionIds":["uuid",...],"instagram":boolean} — selected publish destinations.';
comment on column public.social_marketing_posts.facebook_post_id is
  'Legacy aggregate; prefer social_marketing_facebook_publications per page.';
