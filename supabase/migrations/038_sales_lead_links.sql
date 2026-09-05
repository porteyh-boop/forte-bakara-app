-- Additive link fields on sales leads + atomic win-to-project conversion.
-- contact_id → existing contacts; converted_building_id → existing buildings.building_id
-- RPC is service_role only. Do not grant execute to public, anon, or authenticated.

alter table public.sales_leads
  add column if not exists contact_id uuid references public.contacts (id) on delete set null;

alter table public.sales_leads
  add column if not exists converted_building_id text;

create index if not exists idx_sales_leads_contact_id
  on public.sales_leads (contact_id);

create index if not exists idx_sales_leads_converted_building_id
  on public.sales_leads (converted_building_id);

create unique index if not exists idx_sales_leads_converted_building_id_unique
  on public.sales_leads (converted_building_id)
  where converted_building_id is not null;

comment on column public.sales_leads.contact_id is
  'Linked contacts.id from Master sales sync. Null if the lead has no syncable contact.';
comment on column public.sales_leads.converted_building_id is
  'buildings.building_id created on first win conversion. Never cleared if status changes.';

create or replace function public.convert_sales_lead_win_to_project(
  p_lead_id uuid,
  p_name text,
  p_city text,
  p_address text,
  p_management_company text,
  p_contact_name text,
  p_contact_phone text,
  p_project_notes text,
  p_project_type text,
  p_order_amount numeric,
  p_service_type text,
  p_contact_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead public.sales_leads%rowtype;
  v_building_id text;
  v_year integer;
  v_prefix text;
  v_seq integer;
  v_candidate text;
  v_now timestamptz := clock_timestamp();
begin
  if p_lead_id is null then
    raise exception 'invalid_lead_id';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'missing_building_name';
  end if;

  select *
    into v_lead
    from public.sales_leads
   where id = p_lead_id
   for update;

  if not found then
    raise exception 'not_found';
  end if;

  if nullif(trim(coalesce(v_lead.converted_building_id, '')), '') is not null then
    return jsonb_build_object(
      'building_id', v_lead.converted_building_id,
      'already_converted', true
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('forte_sales_win_project_id'));

  v_year := extract(year from (timezone('Asia/Jerusalem', v_now)))::integer;
  v_prefix := (800 + (v_year - 2000))::text;

  select coalesce(
    max(
      case
        when b.building_id ~ ('^' || v_prefix || '[0-9]{3}$')
          and substring(b.building_id from 4)::integer >= 101
        then substring(b.building_id from 4)::integer
        else null
      end
    ),
    100
  )
    into v_seq
    from public.buildings b;

  loop
    v_seq := v_seq + 1;
    if v_seq > 999 then
      raise exception 'project_number_sequence_exhausted';
    end if;

    v_candidate := v_prefix || lpad(v_seq::text, 3, '0');

    exit when not exists (
      select 1
        from public.buildings b
       where b.building_id = v_candidate
          or nullif(trim(b.project_number), '') = v_candidate
    );
  end loop;

  v_building_id := v_candidate;

  insert into public.buildings (
    building_id,
    project_number,
    name,
    city,
    address,
    management_company,
    contact_name,
    contact_phone,
    is_active,
    project_stage,
    project_notes,
    project_type,
    order_amount,
    service_type,
    service_type_other
  ) values (
    v_building_id,
    v_building_id,
    trim(p_name),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_management_company, '')), ''),
    nullif(trim(coalesce(p_contact_name, '')), ''),
    nullif(trim(coalesce(p_contact_phone, '')), ''),
    true,
    'הזמנה',
    nullif(trim(coalesce(p_project_notes, '')), ''),
    coalesce(nullif(trim(coalesce(p_project_type, '')), ''), 'standard'),
    p_order_amount,
    nullif(trim(coalesce(p_service_type, '')), ''),
    null
  );

  update public.sales_leads
     set converted_building_id = v_building_id,
         contact_id = coalesce(p_contact_id, contact_id),
         updated_at = v_now
   where id = p_lead_id;

  if p_contact_id is not null then
    update public.project_contacts
       set is_primary = false,
           updated_at = v_now
     where building_id = v_building_id
       and is_primary = true
       and contact_id is distinct from p_contact_id;

    insert into public.project_contacts (
      contact_id,
      building_id,
      project_role,
      is_primary,
      updated_at
    ) values (
      p_contact_id,
      v_building_id,
      '',
      true,
      v_now
    )
    on conflict (contact_id, building_id) do update
      set is_primary = excluded.is_primary,
          updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object(
    'building_id', v_building_id,
    'already_converted', false
  );
end;
$$;

comment on function public.convert_sales_lead_win_to_project(
  uuid, text, text, text, text, text, text, text, text, numeric, text, uuid
) is
  'Atomic sales win conversion: lock lead, reuse converted_building_id if set, else insert buildings row and persist the link in one transaction. service_role only.';

revoke all on function public.convert_sales_lead_win_to_project(
  uuid, text, text, text, text, text, text, text, text, numeric, text, uuid
) from public, anon, authenticated;

grant execute on function public.convert_sales_lead_win_to_project(
  uuid, text, text, text, text, text, text, text, text, numeric, text, uuid
) to service_role;
