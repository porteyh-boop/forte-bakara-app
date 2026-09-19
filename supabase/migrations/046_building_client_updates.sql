-- 046: Building client updates (portal activity log) + per-user read tracking
-- Requires: 005 client_access, 008 documents, 013 client_permissions

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.building_client_updates (
  id uuid primary key default gen_random_uuid(),
  building_id text not null,
  project_number text,
  title text not null,
  body text not null,
  update_type text not null,
  status text not null,
  visible_to_client boolean not null default false,
  document_id uuid references public.documents(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.building_client_update_reads (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.building_client_updates(id) on delete cascade,
  client_user_id uuid not null references public.client_users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (update_id, client_user_id)
);

create index if not exists idx_building_client_updates_building_published
  on public.building_client_updates (building_id, published_at desc);

create index if not exists idx_building_client_updates_building_visible
  on public.building_client_updates (building_id)
  where visible_to_client = true;

create index if not exists idx_building_client_update_reads_update
  on public.building_client_update_reads (update_id);

create index if not exists idx_building_client_update_reads_user
  on public.building_client_update_reads (client_user_id);

create index if not exists idx_building_client_update_reads_user_update
  on public.building_client_update_reads (client_user_id, update_id);

-- ---------------------------------------------------------------------------
-- Client permission
-- ---------------------------------------------------------------------------

alter table public.client_permissions
  add column if not exists can_view_client_updates boolean not null default false;

-- ---------------------------------------------------------------------------
-- RLS: service_role only (same pattern as 034 client tables)
-- ---------------------------------------------------------------------------

alter table public.building_client_updates enable row level security;
alter table public.building_client_update_reads enable row level security;

revoke all on table public.building_client_updates from anon, authenticated;
revoke all on table public.building_client_update_reads from anon, authenticated;

comment on table public.building_client_updates is
  'FORTE → client building activity updates; CRUD via Master/Client server APIs (service_role).';
comment on table public.building_client_update_reads is
  'Per client_user read state for building_client_updates; written via Client mark-read API only.';
