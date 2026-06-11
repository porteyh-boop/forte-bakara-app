-- פורטה בקרה — metadata תסקיר בודק על documents (Master בלבד)
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ
-- לא מוחק inspector_reports / inspector-reports

create table if not exists public.document_inspector_meta (
  document_id uuid primary key references public.documents(id) on delete cascade,
  report_date date not null,
  inspector_name text,
  has_remarks boolean not null default false,
  deadline_at timestamptz,
  status text not null default 'open',
  closed_at timestamptz,
  closure_notes text,
  legacy_inspector_report_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_document_inspector_meta_status
  on public.document_inspector_meta(status);

create index if not exists idx_document_inspector_meta_report_date
  on public.document_inspector_meta(report_date desc);

create index if not exists idx_document_inspector_meta_has_remarks
  on public.document_inspector_meta(has_remarks);

create index if not exists idx_document_inspector_meta_legacy
  on public.document_inspector_meta(legacy_inspector_report_id);

alter table public.document_inspector_meta enable row level security;

drop policy if exists "document_inspector_meta_public_all" on public.document_inspector_meta;
create policy "document_inspector_meta_public_all" on public.document_inspector_meta
  for all using (true) with check (true);
