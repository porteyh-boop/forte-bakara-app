-- פורטה בקרה — הרשאת שליחת משוב בפורטל לקוח
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ
-- דורש: migration 013

alter table public.client_permissions
  add column if not exists can_submit_feedback boolean not null default false;
