-- פורטה בקרה — סוג לקוח והודעת פתיחה בפורטל
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ

alter table public.client_users
  add column if not exists client_type text,
  add column if not exists welcome_message text;

comment on column public.client_users.client_type is
  'סוג לקוח: ועד בית | חברת ניהול | דייר | נציג בניין | אחר';

comment on column public.client_users.welcome_message is
  'הודעת פתיחה מותאמת אישית בפורטל הלקוח';
