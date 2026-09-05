-- Public /lead form notifications — one row per successful submit.
-- Used for Master inbox + Telegram. Written only inside submit_public_sales_lead_form.
-- Server-only: RLS on; public/anon/authenticated revoked; service_role only.

create table if not exists public.sales_lead_notifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads (id) on delete cascade,
  submission_key text not null,
  event_kind text not null,
  client_name text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  building_name text not null default '',
  address text not null default '',
  city text not null default '',
  service_type text not null default '',
  need_description text not null default '',
  preferred_contact text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  telegram_status text not null default 'pending',
  telegram_attempted_at timestamptz,
  telegram_error text,
  constraint sales_lead_notifications_submission_key_unique unique (submission_key),
  constraint sales_lead_notifications_event_kind_check check (
    event_kind in ('new_lead', 'updated_lead')
  ),
  constraint sales_lead_notifications_telegram_status_check check (
    telegram_status in ('pending', 'sent', 'failed')
  )
);

create index if not exists idx_sales_lead_notifications_unread
  on public.sales_lead_notifications (created_at desc)
  where read_at is null;

create index if not exists idx_sales_lead_notifications_lead_id
  on public.sales_lead_notifications (lead_id);

create index if not exists idx_sales_lead_notifications_telegram_status
  on public.sales_lead_notifications (telegram_status)
  where telegram_status = 'pending';

alter table public.sales_lead_notifications enable row level security;

revoke all on table public.sales_lead_notifications from public, anon, authenticated;

grant select, insert, update on table public.sales_lead_notifications to service_role;

comment on table public.sales_lead_notifications is
  'One Master+Telegram notification per public /lead submit. Inserted in submit_public_sales_lead_form. service_role only.';

drop function if exists public.submit_public_sales_lead_form(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
);

create or replace function public.submit_public_sales_lead_form(
  p_idempotency_key text,
  p_payload_hash text,
  p_client_name text,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_building_name text,
  p_address text,
  p_city text,
  p_service_type text,
  p_service_type_other text,
  p_need_description text,
  p_next_action text,
  p_ip_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_key text;
  v_hash text;
  v_phone_norm text;
  v_email text;
  v_service_type text;
  v_service_type_other text;
  v_service_label text;
  v_next_action text;
  v_now timestamptz := clock_timestamp();
  v_sub public.sales_lead_form_submissions%rowtype;
  v_lead public.sales_leads%rowtype;
  v_lead_id uuid;
  v_lead_created boolean := false;
  v_contact public.contacts%rowtype;
  v_contact_id uuid;
  v_notes text;
  v_existing_notes text;
  v_notification_id uuid;
begin
  v_key := trim(coalesce(p_idempotency_key, ''));
  v_hash := trim(coalesce(p_payload_hash, ''));
  if char_length(v_key) < 16 or char_length(v_key) > 80 or v_hash = '' then
    raise exception 'invalid_request';
  end if;

  if length(trim(coalesce(p_client_name, ''))) = 0 then
    raise exception 'missing_client_name';
  end if;
  if length(trim(coalesce(p_contact_name, ''))) = 0 then
    raise exception 'missing_contact_name';
  end if;

  v_phone_norm := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_phone_norm like '972%' and char_length(v_phone_norm) >= 11 then
    v_phone_norm := '0' || substr(v_phone_norm, 4);
  end if;
  if char_length(v_phone_norm) < 9 then
    raise exception 'missing_phone';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  v_service_type := nullif(trim(coalesce(p_service_type, '')), '');
  if v_service_type = 'אחר' then
    v_service_type_other := nullif(trim(coalesce(p_service_type_other, '')), '');
    if v_service_type_other is null then
      raise exception 'missing_service_type_other';
    end if;
  else
    v_service_type_other := null;
  end if;
  v_next_action := nullif(trim(coalesce(p_next_action, '')), '');

  perform pg_advisory_xact_lock(hashtext('forte_public_sales_lead:' || v_key));
  perform pg_advisory_xact_lock(hashtext('forte_public_sales_phone:' || v_phone_norm));

  select *
    into v_sub
    from public.sales_lead_form_submissions
   where idempotency_key = v_key
   for update;

  if found then
    if v_sub.payload_hash = v_hash then
      return jsonb_build_object(
        'ok', true,
        'already_processed', true
      );
    end if;
    raise exception 'idempotency_conflict';
  end if;

  select sl.*
    into v_lead
    from public.sales_leads sl
   where sl.status not in ('זכייה', 'לא נסגר')
     and (
       case
         when regexp_replace(coalesce(sl.phone, ''), '\D', '', 'g') like '972%'
          and char_length(regexp_replace(coalesce(sl.phone, ''), '\D', '', 'g')) >= 11
           then '0' || substr(regexp_replace(coalesce(sl.phone, ''), '\D', '', 'g'), 4)
         else regexp_replace(coalesce(sl.phone, ''), '\D', '', 'g')
       end
     ) = v_phone_norm
   order by sl.updated_at desc
   limit 1
   for update;

  if not found then
    select sl.*
      into v_lead
      from public.sales_leads sl
     where sl.status not in ('זכייה', 'לא נסגר')
       and (
         case
           when regexp_replace(coalesce(sl.phone, ''), '\D', '', 'g') like '972%'
            and char_length(regexp_replace(coalesce(sl.phone, ''), '\D', '', 'g')) >= 11
             then '0' || substr(regexp_replace(coalesce(sl.phone, ''), '\D', '', 'g'), 4)
           else regexp_replace(coalesce(sl.phone, ''), '\D', '', 'g')
         end
       ) = ''
       and v_email <> ''
       and lower(trim(coalesce(sl.email, ''))) = v_email
     order by sl.updated_at desc
     limit 1
     for update;
  end if;

  if found then
    v_lead_id := v_lead.id;
    v_lead_created := false;

    update public.sales_leads
       set client_name = trim(p_client_name),
           contact_name = trim(p_contact_name),
           phone = trim(p_phone),
           email = coalesce(nullif(trim(coalesce(p_email, '')), ''), email),
           building_name = coalesce(nullif(trim(coalesce(p_building_name, '')), ''), building_name),
           address = coalesce(nullif(trim(coalesce(p_address, '')), ''), address),
           city = coalesce(nullif(trim(coalesce(p_city, '')), ''), city),
           service_type = coalesce(v_service_type, service_type),
           service_type_other = case
             when coalesce(v_service_type, service_type) = 'אחר'
               then coalesce(v_service_type_other, service_type_other)
             else null
           end,
           need_description = coalesce(nullif(trim(coalesce(p_need_description, '')), ''), need_description),
           next_action = coalesce(v_next_action, next_action),
           updated_at = v_now
     where id = v_lead_id;
  else
    v_lead_created := true;
    insert into public.sales_leads (
      client_name,
      building_name,
      address,
      city,
      contact_name,
      phone,
      email,
      need_description,
      service_type,
      service_type_other,
      source,
      source_detail,
      contact_channel,
      status,
      next_action,
      created_at,
      updated_at
    ) values (
      trim(p_client_name),
      trim(coalesce(p_building_name, '')),
      trim(coalesce(p_address, '')),
      trim(coalesce(p_city, '')),
      trim(p_contact_name),
      trim(p_phone),
      trim(coalesce(p_email, '')),
      trim(coalesce(p_need_description, '')),
      coalesce(v_service_type, ''),
      v_service_type_other,
      'טופס דיגיטלי ללקוח',
      '',
      '',
      'חדש',
      coalesce(v_next_action, ''),
      v_now,
      v_now
    )
    returning id into v_lead_id;

    insert into public.sales_lead_history (
      lead_id, occurred_at, kind, entry_text, status
    ) values (
      v_lead_id, v_now, 'created', 'פנייה נוצרה.', 'חדש'
    );
  end if;

  insert into public.sales_lead_history (
    lead_id, occurred_at, kind, entry_text, status
  ) values (
    v_lead_id, v_now, 'note', 'פרטים התקבלו מטופס לקוח', null
  );

  v_notes := trim(both ' ' from concat_ws(
    ' · ',
    case when length(trim(coalesce(p_building_name, ''))) > 0
      then 'בניין: ' || trim(p_building_name) else null end,
    case when length(trim(coalesce(p_address, ''))) > 0
      then 'כתובת: ' || trim(p_address) else null end,
    case when length(trim(coalesce(p_city, ''))) > 0
      then 'עיר: ' || trim(p_city) else null end
  ));
  if v_notes <> '' then
    v_notes := '[מכירות] ' || v_notes;
  end if;

  select sl.contact_id
    into v_contact_id
    from public.sales_leads sl
   where sl.id = v_lead_id;

  if v_contact_id is not null then
    select * into v_contact from public.contacts where id = v_contact_id;
  end if;

  if not found or v_contact_id is null then
    v_contact_id := null;
    if v_phone_norm <> '' then
      select c.*
        into v_contact
        from public.contacts c
       where (
         case
           when regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '972%'
            and char_length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) >= 11
             then '0' || substr(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 4)
           else regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')
         end
       ) = v_phone_norm
       limit 1;
      if found then
        v_contact_id := v_contact.id;
      end if;
    end if;
    if v_contact_id is null and v_email <> '' then
      select c.*
        into v_contact
        from public.contacts c
       where lower(trim(coalesce(c.email, ''))) = v_email
       limit 1;
      if found then
        v_contact_id := v_contact.id;
      end if;
    end if;
  end if;

  if v_contact_id is not null then
    v_existing_notes := trim(coalesce(v_contact.notes, ''));
    update public.contacts
       set full_name = trim(p_contact_name),
           company = trim(p_client_name),
           phone = trim(p_phone),
           email = coalesce(nullif(trim(coalesce(p_email, '')), ''), email),
           notes = case
             when v_notes <> ''
              and (v_existing_notes = '' or v_existing_notes like '[מכירות]%')
               then v_notes
             else notes
           end,
           updated_at = v_now
     where id = v_contact_id;
  else
    insert into public.contacts (
      full_name, company, role_title, phone, email, notes, updated_at
    ) values (
      trim(p_contact_name),
      trim(p_client_name),
      '',
      trim(p_phone),
      trim(coalesce(p_email, '')),
      v_notes,
      v_now
    )
    returning id into v_contact_id;
  end if;

  update public.sales_leads
     set contact_id = v_contact_id,
         updated_at = v_now
   where id = v_lead_id;

  insert into public.sales_lead_form_submissions (
    idempotency_key, payload_hash, lead_id, ip_hash, created_at
  ) values (
    v_key, v_hash, v_lead_id, trim(coalesce(p_ip_hash, '')), v_now
  );

  v_service_label := case
    when coalesce(v_service_type, '') = 'אחר'
      then coalesce(v_service_type_other, 'אחר')
    else coalesce(v_service_type, '')
  end;

  insert into public.sales_lead_notifications (
    lead_id,
    submission_key,
    event_kind,
    client_name,
    contact_name,
    phone,
    email,
    building_name,
    address,
    city,
    service_type,
    need_description,
    preferred_contact,
    created_at,
    telegram_status
  ) values (
    v_lead_id,
    v_key,
    case when v_lead_created then 'new_lead' else 'updated_lead' end,
    trim(p_client_name),
    trim(p_contact_name),
    trim(p_phone),
    trim(coalesce(p_email, '')),
    trim(coalesce(p_building_name, '')),
    trim(coalesce(p_address, '')),
    trim(coalesce(p_city, '')),
    v_service_label,
    trim(coalesce(p_need_description, '')),
    coalesce(v_next_action, ''),
    v_now,
    'pending'
  )
  returning id into v_notification_id;

  return jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'lead_created', v_lead_created,
    'lead_id', v_lead_id,
    'notification_id', v_notification_id
  );
end;
$$;

comment on function public.submit_public_sales_lead_form(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) is
  'Atomic public /lead submit: lock key, find/create lead, sync contact, history, idempotency, and one notification. service_role only.';

revoke all on function public.submit_public_sales_lead_form(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.submit_public_sales_lead_form(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) to service_role;
