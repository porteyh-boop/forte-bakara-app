-- פורטה בקרה — הרשאת צפייה בסטטיסטיקות בפורטל לקוח
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ
-- דורש: migration 013

alter table public.client_permissions
  add column if not exists can_view_statistics boolean not null default false;
