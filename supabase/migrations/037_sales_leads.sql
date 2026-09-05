-- FORTE Master sales leads — persistent inquiries only
-- Server-only access via service_role. Browser anon/authenticated have no table grants.

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  building_name text not null default '',
  address text not null default '',
  city text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  need_description text not null default '',
  service_type text not null default '',
  source text not null default '',
  source_detail text not null default '',
  contact_channel text not null default '',
  status text not null default 'חדש',
  estimated_value numeric,
  next_action text not null default '',
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_leads_client_name_required check (length(trim(client_name)) > 0),
  constraint sales_leads_status_check check (
    status in (
      'חדש',
      'נוצר קשר',
      'בירור-פגישה',
      'הצעה נשלחה',
      'משא ומתן',
      'זכייה',
      'לא נסגר'
    )
  ),
  constraint sales_leads_estimated_value_non_negative check (
    estimated_value is null or estimated_value >= 0
  )
);

create table if not exists public.sales_lead_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  kind text not null,
  entry_text text not null,
  status text,
  constraint sales_lead_history_kind_check check (
    kind in ('note', 'status', 'created')
  )
);

create index if not exists idx_sales_leads_status
  on public.sales_leads (status);

create index if not exists idx_sales_leads_follow_up_date
  on public.sales_leads (follow_up_date);

create index if not exists idx_sales_leads_updated_at
  on public.sales_leads (updated_at desc);

create index if not exists idx_sales_leads_open_follow_up
  on public.sales_leads (follow_up_date)
  where status not in ('זכייה', 'לא נסגר')
    and follow_up_date is not null;

create index if not exists idx_sales_lead_history_lead_id
  on public.sales_lead_history (lead_id, occurred_at);

alter table public.sales_leads enable row level security;
alter table public.sales_lead_history enable row level security;

revoke all on table public.sales_leads from public, anon, authenticated;
revoke all on table public.sales_lead_history from public, anon, authenticated;

grant select, insert, update, delete on table public.sales_leads to service_role;
grant select, insert, update, delete on table public.sales_lead_history to service_role;

comment on table public.sales_leads is
  'Master sales inquiries. RLS on; anon/authenticated revoked; service_role server APIs only.';
comment on table public.sales_lead_history is
  'Sales lead notes and status history. RLS on; anon/authenticated revoked; service_role only.';
