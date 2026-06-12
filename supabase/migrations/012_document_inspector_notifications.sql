-- פורטה בקרה — מעקב התראות מייל לתסקירי בודק (documents + document_inspector_meta)
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ
-- לא מוחק טבלאות / buckets קיימים

create table if not exists public.document_inspector_notifications (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.documents(id) on delete cascade,
  notification_type text not null
    check (notification_type in ('day_35', 'day_40', 'day_45_plus')),
  sent_at timestamptz not null default now(),
  constraint document_inspector_notifications_unique
    unique (document_id, notification_type)
);

create index if not exists idx_document_inspector_notifications_document_id
  on public.document_inspector_notifications(document_id);

create index if not exists idx_document_inspector_notifications_sent_at
  on public.document_inspector_notifications(sent_at desc);

alter table public.document_inspector_notifications enable row level security;

drop policy if exists "document_inspector_notifications_public_all"
  on public.document_inspector_notifications;
create policy "document_inspector_notifications_public_all"
  on public.document_inspector_notifications
  for all using (true) with check (true);
