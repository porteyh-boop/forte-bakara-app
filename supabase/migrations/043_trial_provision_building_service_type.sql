-- 043: Trial provision — do not copy invalid sales_leads.service_type onto buildings.
-- buildings.service_type has a strict check; sales lead free text may differ.

create or replace function public.provision_sales_lead_trial_portal(
  p_lead_id uuid,
  p_expires_at timestamptz,
  p_elevator_names text[]
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
  v_user_id uuid;
  v_token text;
  v_access_id uuid;
  v_i integer;
  v_elevator_name text;
  v_elevator_id text;
  v_now timestamptz := clock_timestamp();
  v_contact_name text;
  v_building_service_type text;
  v_building_service_type_other text;
begin
  if p_lead_id is null then
    raise exception 'invalid_lead_id';
  end if;

  if p_expires_at is null then
    raise exception 'missing_expires_at';
  end if;

  if p_elevator_names is null or array_length(p_elevator_names, 1) is null then
    raise exception 'missing_elevators';
  end if;

  if array_length(p_elevator_names, 1) < 1 then
    raise exception 'missing_elevators';
  end if;

  select *
    into v_lead
    from public.sales_leads
   where id = p_lead_id
   for update;

  if not found then
    raise exception 'not_found';
  end if;

  if nullif(trim(coalesce(v_lead.building_name, '')), '') is null then
    raise exception 'missing_building_name';
  end if;

  if nullif(trim(coalesce(v_lead.trial_building_id, '')), '') is not null then
    select cu.access_token
      into v_token
      from public.client_users cu
     where cu.id = v_lead.trial_client_user_id;

    if v_token is null then
      select cu.access_token
        into v_token
        from public.client_access ca
        join public.client_users cu on cu.id = ca.client_user_id
       where ca.building_id = lower(trim(v_lead.trial_building_id))
       order by cu.created_at desc
       limit 1;
    end if;

    return jsonb_build_object(
      'building_id', v_lead.trial_building_id,
      'client_user_id', v_lead.trial_client_user_id,
      'access_token', coalesce(v_token, ''),
      'already_provisioned', true
    );
  end if;

  v_building_service_type := nullif(trim(coalesce(v_lead.service_type, '')), '');
  v_building_service_type_other := nullif(trim(coalesce(v_lead.service_type_other, '')), '');

  if v_building_service_type is not null
     and v_building_service_type not in (
       'ייעוץ',
       'בקרת שירות',
       'בדק בית / חוות דעת',
       'בדיקת חוזה והצעות מחיר',
       'מודרניזציה / שדרוג',
       'תכנון ופיקוח',
       'בדיקה וקבלת מעלית',
       'שמאות / חוות דעת מומחה',
       'אחר'
     )
  then
    v_building_service_type := null;
    v_building_service_type_other := null;
  elsif v_building_service_type = 'אחר' then
    if v_building_service_type_other is null then
      v_building_service_type := null;
    end if;
  else
    v_building_service_type_other := null;
  end if;

  perform pg_advisory_xact_lock(hashtext('forte_sales_trial_building_id'));

  v_year := extract(year from (timezone('Asia/Jerusalem', v_now)))::integer;
  v_prefix := (750 + (v_year - 2000))::text;

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
      raise exception 'trial_building_sequence_exhausted';
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
  v_contact_name := nullif(trim(coalesce(v_lead.contact_name, '')), '');

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
    is_trial,
    project_stage,
    project_notes,
    project_type,
    order_amount,
    service_type,
    service_type_other
  ) values (
    v_building_id,
    v_building_id,
    trim(v_lead.building_name),
    nullif(trim(coalesce(v_lead.city, '')), ''),
    nullif(trim(coalesce(v_lead.address, '')), ''),
    nullif(trim(coalesce(v_lead.client_name, '')), ''),
    v_contact_name,
    nullif(trim(coalesce(v_lead.phone, '')), ''),
    true,
    true,
    'הצעת מחיר',
    nullif(trim(coalesce(v_lead.need_description, '')), ''),
    'standard',
    null,
    v_building_service_type,
    v_building_service_type_other
  );

  for v_i in 1 .. array_length(p_elevator_names, 1) loop
    v_elevator_name := nullif(trim(coalesce(p_elevator_names[v_i], '')), '');
    if v_elevator_name is null then
      raise exception 'invalid_elevator_name';
    end if;
    v_elevator_id := 'e' || v_i::text;

    insert into public.elevators (
      building_id,
      elevator_id,
      elevator_name,
      is_active,
      status
    ) values (
      v_building_id,
      v_elevator_id,
      v_elevator_name,
      true,
      'פעילה'
    );
  end loop;

  v_token := encode(extensions.gen_random_bytes(9), 'base64');
  v_token := replace(replace(replace(v_token, '+', ''), '/', ''), '=', '');

  insert into public.client_users (
    name,
    phone,
    email,
    access_token,
    is_active,
    expires_at
  ) values (
    coalesce(v_contact_name, trim(v_lead.building_name)),
    nullif(trim(coalesce(v_lead.phone, '')), ''),
    nullif(trim(coalesce(v_lead.email, '')), ''),
    v_token,
    true,
    p_expires_at
  )
  returning id into v_user_id;

  insert into public.client_access (
    client_user_id,
    building_id,
    elevator_id,
    access_level
  ) values (
    v_user_id,
    lower(v_building_id),
    null,
    'building'
  )
  returning id into v_access_id;

  insert into public.client_permissions (
    client_user_id,
    can_view_building_dashboard,
    can_report_faults,
    can_view_open_faults,
    can_view_fault_history,
    can_view_availability,
    can_view_documents,
    can_view_statistics,
    can_upload_images,
    can_receive_notifications,
    can_submit_feedback,
    updated_at
  ) values (
    v_user_id,
    true,
    true,
    true,
    true,
    false,
    false,
    true,
    false,
    false,
    false,
    v_now
  );

  update public.sales_leads
     set trial_building_id = v_building_id,
         trial_client_user_id = v_user_id,
         updated_at = v_now
   where id = p_lead_id;

  insert into public.sales_lead_history (
    lead_id,
    occurred_at,
    kind,
    entry_text,
    status
  ) values (
    p_lead_id,
    v_now,
    'note',
    'נפתח פורטל ניסיון לוועד.',
    v_lead.status
  );

  return jsonb_build_object(
    'building_id', v_building_id,
    'client_user_id', v_user_id,
    'access_token', v_token,
    'already_provisioned', false
  );
end;
$$;

revoke all on function public.provision_sales_lead_trial_portal(uuid, timestamptz, text[]) from public, anon, authenticated;
grant execute on function public.provision_sales_lead_trial_portal(uuid, timestamptz, text[]) to service_role;
