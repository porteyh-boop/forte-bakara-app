-- פורטה בקרה — תשתית כספית לפרויקט (שלב 1)
-- nullable בלבד; שדות מחושבים (שולם/יתרה/סטטוס) לא נשמרים ב-DB

alter table public.buildings
  add column if not exists order_amount numeric(12, 2),
  add column if not exists order_date date,
  add column if not exists income_type text,
  add column if not exists payment_terms text,
  add column if not exists next_payment_date date;

alter table public.buildings
  drop constraint if exists buildings_income_type_check;

alter table public.buildings
  add constraint buildings_income_type_check
  check (
    income_type is null
    or income_type in (
      'ייעוץ',
      'בדיקה',
      'בקרת שירות',
      'חוות דעת',
      'מכרז',
      'שדרוג / מודרניזציה',
      'פיקוח / קבלה',
      'אחר'
    )
  );

create table if not exists public.project_payments (
  id uuid primary key default gen_random_uuid(),
  building_id text not null
    references public.buildings (building_id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null,
  payment_method text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_payments
  drop constraint if exists project_payments_method_check;

alter table public.project_payments
  add constraint project_payments_method_check
  check (payment_method in (
    'העברה בנקאית',
    'אשראי',
    'צ''ק',
    'מזומן',
    'אחר'
  ));

create index if not exists idx_project_payments_building_id
  on public.project_payments (building_id);

create index if not exists idx_project_payments_building_payment_date
  on public.project_payments (building_id, payment_date desc);

alter table public.project_payments enable row level security;

revoke all on table public.project_payments from anon, authenticated;
grant select, insert, update, delete on table public.project_payments to service_role;
