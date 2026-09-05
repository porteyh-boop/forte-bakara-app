-- Public customer intake form — idempotency + durable rate-limit support.
-- Server-only access via service_role. Browser anon/authenticated have no table grants.
-- Does not change sales_leads columns; source "טופס דיגיטלי ללקוח" is stored in existing source text.

create table if not exists public.sales_lead_form_submissions (
  idempotency_key text primary key,
  payload_hash text not null,
  lead_id uuid not null references public.sales_leads (id) on delete cascade,
  ip_hash text not null default '',
  created_at timestamptz not null default now(),
  constraint sales_lead_form_submissions_key_len check (
    char_length(trim(idempotency_key)) between 16 and 80
  ),
  constraint sales_lead_form_submissions_payload_hash_len check (
    char_length(trim(payload_hash)) > 0
  )
);

create index if not exists idx_sales_lead_form_submissions_ip_created
  on public.sales_lead_form_submissions (ip_hash, created_at desc);

create index if not exists idx_sales_lead_form_submissions_lead_id
  on public.sales_lead_form_submissions (lead_id);

alter table public.sales_lead_form_submissions enable row level security;

revoke all on table public.sales_lead_form_submissions from public, anon, authenticated;

grant select, insert on table public.sales_lead_form_submissions to service_role;

comment on table public.sales_lead_form_submissions is
  'Idempotency keys for the public /lead form. RLS on; anon/authenticated revoked; service_role server API only.';
