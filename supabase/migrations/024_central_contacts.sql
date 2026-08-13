-- פורטה בקרה — Sprint 3: ספר אנשי קשר מרכזי + שיוך לפרויקטים
-- additive בלבד — building_contacts נשמר ללא שינוי

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text not null default '',
  role_title text not null default '',
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contacts_full_name
  on public.contacts (full_name);

create index if not exists idx_contacts_company
  on public.contacts (company);

create table if not exists public.project_contacts (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete restrict,
  building_id text not null references public.buildings (building_id) on delete cascade,
  project_role text not null default '',
  is_primary boolean not null default false,
  legacy_building_contact_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_contacts_unique_contact_building unique (contact_id, building_id)
);

create index if not exists idx_project_contacts_building_id
  on public.project_contacts (building_id);

create index if not exists idx_project_contacts_contact_id
  on public.project_contacts (contact_id);

create unique index if not exists idx_project_contacts_one_primary
  on public.project_contacts (building_id)
  where is_primary = true;

alter table public.contacts enable row level security;
alter table public.project_contacts enable row level security;

revoke all on public.contacts from anon, authenticated;
revoke all on public.project_contacts from anon, authenticated;

grant select, insert, update, delete on public.contacts to service_role;
grant select, insert, update, delete on public.project_contacts to service_role;

-- העברת נתונים מ-building_contacts (שורה-לשורה, idempotent)
do $$
declare
  bc record;
  new_contact_id uuid;
  merged_notes text;
begin
  for bc in
    select *
    from public.building_contacts
    where not exists (
      select 1
      from public.project_contacts pc
      where pc.legacy_building_contact_id = building_contacts.id
    )
  loop
    merged_notes := trim(both E'\n' from concat_ws(
      E'\n',
      nullif(trim(bc.notes), ''),
      case
        when nullif(trim(bc.whatsapp), '') is not null
          and trim(bc.whatsapp) is distinct from trim(bc.phone)
          then 'WhatsApp: ' || trim(bc.whatsapp)
        else null
      end,
      case
        when nullif(trim(bc.contact_type), '') is not null
          then 'סוג: ' || trim(bc.contact_type)
        else null
      end,
      case
        when bc.receives_reports then 'מקבל דיווחים'
        else null
      end
    ));

    insert into public.contacts (
      full_name,
      company,
      role_title,
      phone,
      email,
      notes,
      created_at,
      updated_at
    )
    values (
      bc.full_name,
      bc.company,
      bc.role_title,
      bc.phone,
      bc.email,
      coalesce(merged_notes, ''),
      bc.created_at,
      bc.updated_at
    )
    returning id into new_contact_id;

    insert into public.project_contacts (
      contact_id,
      building_id,
      project_role,
      is_primary,
      legacy_building_contact_id,
      created_at,
      updated_at
    )
    values (
      new_contact_id,
      bc.building_id,
      '',
      bc.is_primary,
      bc.id,
      bc.created_at,
      bc.updated_at
    );
  end loop;
end $$;
