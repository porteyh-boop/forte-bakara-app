-- 055: social posts — with_image vs without_image (text-only Facebook feed)

alter table public.social_marketing_posts
  add column if not exists post_image_mode text not null default 'with_image';

alter table public.social_marketing_posts
  drop constraint if exists social_marketing_post_image_mode_check;

alter table public.social_marketing_posts
  add constraint social_marketing_post_image_mode_check check (
    post_image_mode in ('with_image', 'without_image')
  );

comment on column public.social_marketing_posts.post_image_mode is
  'with_image: AI/manual image + /photos when image_url set; without_image: text-only, no image generation.';
