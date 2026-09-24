-- 053: Per-network publish status + error message (Facebook / Instagram)
-- Requires: 052_social_facebook_publish.sql

alter table public.social_marketing_posts
  add column if not exists facebook_publish_status text,
  add column if not exists instagram_publish_status text,
  add column if not exists publish_error_message text;

alter table public.social_marketing_posts drop constraint if exists social_marketing_facebook_publish_status_check;
alter table public.social_marketing_posts add constraint social_marketing_facebook_publish_status_check check (
  facebook_publish_status is null
  or facebook_publish_status in ('not_applicable', 'pending', 'published', 'failed')
);

alter table public.social_marketing_posts drop constraint if exists social_marketing_instagram_publish_status_check;
alter table public.social_marketing_posts add constraint social_marketing_instagram_publish_status_check check (
  instagram_publish_status is null
  or instagram_publish_status in ('not_applicable', 'pending', 'published', 'failed', 'unavailable')
);

-- Backfill from existing publish metadata (non-destructive)
update public.social_marketing_posts
set facebook_publish_status = case
  when platform = 'instagram' then 'not_applicable'
  when facebook_post_id is not null then 'published'
  when status = 'failed' and publish_error_code is not null then 'failed'
  else coalesce(facebook_publish_status, 'pending')
end
where facebook_publish_status is null;

update public.social_marketing_posts
set instagram_publish_status = case
  when platform = 'facebook' then 'not_applicable'
  else coalesce(instagram_publish_status, 'pending')
end
where instagram_publish_status is null;

comment on column public.social_marketing_posts.facebook_publish_status is
  'Real Facebook publish outcome; published only after Graph API success.';
comment on column public.social_marketing_posts.instagram_publish_status is
  'Instagram publish outcome; unavailable until IG API is wired.';
