-- פורטה בקרה — הרשאות לקוח ויומן פעילות (Master בלבד)
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ
-- דורש: migration 005 (client_users)

create table if not exists public.client_permissions (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null unique references public.client_users(id) on delete cascade,
  can_report_faults boolean not null default false,
  can_view_open_faults boolean not null default false,
  can_view_fault_history boolean not null default false,
  can_view_availability boolean not null default false,
  can_view_documents boolean not null default false,
  can_upload_images boolean not null default false,
  can_receive_notifications boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_activity_log (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references public.client_users(id) on delete cascade,
  action_type text not null,
  action_details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_permissions_user
  on public.client_permissions(client_user_id);

create index if not exists idx_client_activity_log_user
  on public.client_activity_log(client_user_id);

create index if not exists idx_client_activity_log_created
  on public.client_activity_log(created_at desc);

-- RLS פתוח לשלב פיילוט ביניים (כמו client_users)
alter table public.client_permissions enable row level security;
alter table public.client_activity_log enable row level security;

drop policy if exists "client_permissions_public_all" on public.client_permissions;
create policy "client_permissions_public_all" on public.client_permissions
  for all using (true) with check (true);

drop policy if exists "client_activity_log_public_all" on public.client_activity_log;
create policy "client_activity_log_public_all" on public.client_activity_log
  for all using (true) with check (true);
