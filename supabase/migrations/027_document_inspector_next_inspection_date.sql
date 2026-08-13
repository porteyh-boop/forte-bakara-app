-- פורטה בקרה — מועד בדיקה הבאה על תסקירי בודק (additive)
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ

alter table public.document_inspector_meta
  add column if not exists next_inspection_date date;

create index if not exists idx_document_inspector_meta_next_inspection
  on public.document_inspector_meta(next_inspection_date);
