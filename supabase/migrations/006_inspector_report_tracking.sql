-- פורטה בקרה — מעקב תסקירי בודק (Master בלבד)
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ

create table if not exists public.inspector_reports (
  id uuid primary key default gen_random_uuid(),
  building_id text not null,
  elevator_id text,
  report_date date not null,
  inspector_name text,
  document_name text,
  document_url text,
  document_description text,
  has_remarks boolean not null default false,
  deadline_at timestamptz,
  status text not null default 'open',
  closed_at timestamptz,
  closure_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inspector_reports_building
  on public.inspector_reports(building_id);

create index if not exists idx_inspector_reports_status
  on public.inspector_reports(status);

create index if not exists idx_inspector_reports_report_date
  on public.inspector_reports(report_date desc);

create index if not exists idx_inspector_reports_deadline
  on public.inspector_reports(deadline_at);

-- RLS פתוח לשלב פיילוט ביניים (כמו pilot_faults)
alter table public.inspector_reports enable row level security;

drop policy if exists "inspector_reports_public_all" on public.inspector_reports;
create policy "inspector_reports_public_all" on public.inspector_reports
  for all using (true) with check (true);
