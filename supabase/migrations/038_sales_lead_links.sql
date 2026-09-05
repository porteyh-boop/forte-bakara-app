-- Additive link fields on sales leads only.
-- contact_id → existing contacts; converted_building_id → existing buildings.building_id

alter table public.sales_leads
  add column if not exists contact_id uuid references public.contacts (id) on delete set null;

alter table public.sales_leads
  add column if not exists converted_building_id text;

create index if not exists idx_sales_leads_contact_id
  on public.sales_leads (contact_id);

create index if not exists idx_sales_leads_converted_building_id
  on public.sales_leads (converted_building_id);

comment on column public.sales_leads.contact_id is
  'Linked contacts.id from Master sales sync. Null if the lead has no syncable contact.';
comment on column public.sales_leads.converted_building_id is
  'buildings.building_id created on first win conversion. Never cleared if status changes.';
