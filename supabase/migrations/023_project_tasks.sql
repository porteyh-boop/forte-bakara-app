-- משימות פרויקט — גישה דרך API server-side בלבד (RLS ללא policies ל-anon)

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  building_id text not null references public.buildings (building_id) on delete cascade,
  title text not null,
  description text not null default '',
  priority text not null default 'רגילה',
  status text not null default 'פתוחה',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_tasks_building_id
  on public.project_tasks (building_id);

alter table public.project_tasks enable row level security;
