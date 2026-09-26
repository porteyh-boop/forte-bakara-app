-- 054: Instagram Business publish metadata + connection discovery fields
-- Requires: 053_social_marketing_publish_status.sql

alter table public.social_facebook_connection
  add column if not exists instagram_business_account_id text,
  add column if not exists instagram_username text;

alter table public.social_marketing_posts
  add column if not exists instagram_media_id text,
  add column if not exists instagram_permalink text,
  add column if not exists instagram_published_at timestamptz,
  add column if not exists instagram_publish_error text,
  add column if not exists instagram_publishing_started_at timestamptz;

create unique index if not exists idx_social_marketing_posts_instagram_media_id
  on public.social_marketing_posts (instagram_media_id)
  where instagram_media_id is not null;

comment on column public.social_facebook_connection.instagram_business_account_id is
  'IG User ID from Page instagram_business_account for Content Publishing API.';
comment on column public.social_marketing_posts.instagram_media_id is
  'Published Instagram media id from media_publish; prevents duplicate IG publish.';
