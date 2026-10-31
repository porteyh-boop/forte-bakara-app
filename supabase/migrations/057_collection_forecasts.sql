-- 057: תחזית גבייה חודשית
-- שכבה נפרדת מתשלומים בפועל. אינה משנה את project_payments או את order_amount.

create table if not exists public.collection_forecasts (
  id uuid primary key default gen_random_uuid(),
  building_id text not null
    references public.buildings (building_id) on delete cascade,
  forecast_month date not null,
  planned_amount numeric(12, 2) not null,
  expected_collection_date date not null,
  status text not null default 'planned',
  notes text,
  linked_payment_id uuid
    references public.project_payments (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collection_forecasts
  drop constraint if exists collection_forecasts_planned_amount_check;

alter table public.collection_forecasts
  add constraint collection_forecasts_planned_amount_check
  check (planned_amount > 0);

alter table public.collection_forecasts
  drop constraint if exists collection_forecasts_month_start_check;

alter table public.collection_forecasts
  add constraint collection_forecasts_month_start_check
  check (extract(day from forecast_month) = 1);

alter table public.collection_forecasts
  drop constraint if exists collection_forecasts_status_check;

alter table public.collection_forecasts
  add constraint collection_forecasts_status_check
  check (status in (
    'planned',
    'partially_collected',
    'fully_collected',
    'deferred'
  ));

create index if not exists idx_collection_forecasts_building_id
  on public.collection_forecasts (building_id);

create index if not exists idx_collection_forecasts_forecast_month
  on public.collection_forecasts (forecast_month);

create index if not exists idx_collection_forecasts_expected_collection_date
  on public.collection_forecasts (expected_collection_date);

create index if not exists idx_collection_forecasts_linked_payment_id
  on public.collection_forecasts (linked_payment_id);

create unique index if not exists idx_collection_forecasts_linked_payment_unique
  on public.collection_forecasts (linked_payment_id)
  where linked_payment_id is not null;

create or replace function public.touch_collection_forecast_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_linked_collection_forecast_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.linked_payment_id is not null then
    raise exception 'collection_forecast_linked_payment_delete_forbidden'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create or replace function public.prevent_linked_collection_forecast_month_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.linked_payment_id is not null
     and new.forecast_month is distinct from old.forecast_month then
    raise exception 'collection_forecast_linked_payment_month_change_forbidden'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_collection_forecasts_updated_at
  on public.collection_forecasts;
create trigger trg_collection_forecasts_updated_at
  before update on public.collection_forecasts
  for each row
  execute function public.touch_collection_forecast_updated_at();

drop trigger if exists trg_collection_forecasts_prevent_linked_delete
  on public.collection_forecasts;
create trigger trg_collection_forecasts_prevent_linked_delete
  before delete on public.collection_forecasts
  for each row
  execute function public.prevent_linked_collection_forecast_delete();

drop trigger if exists trg_collection_forecasts_prevent_linked_month_change
  on public.collection_forecasts;
create trigger trg_collection_forecasts_prevent_linked_month_change
  before update on public.collection_forecasts
  for each row
  execute function public.prevent_linked_collection_forecast_month_change();

revoke all on function public.touch_collection_forecast_updated_at()
  from public, anon, authenticated;
revoke all on function public.prevent_linked_collection_forecast_delete()
  from public, anon, authenticated;
revoke all on function public.prevent_linked_collection_forecast_month_change()
  from public, anon, authenticated;

grant execute on function public.touch_collection_forecast_updated_at() to service_role;
grant execute on function public.prevent_linked_collection_forecast_delete() to service_role;
grant execute on function public.prevent_linked_collection_forecast_month_change() to service_role;

alter table public.collection_forecasts enable row level security;

revoke all on table public.collection_forecasts from public, anon, authenticated;
grant select, insert, update, delete on table public.collection_forecasts to service_role;

comment on table public.collection_forecasts is
  'תחזית גבייה חודשית. אינה תשלום בפועל ואינה משנה יתרה, order_amount או project_payments.';
