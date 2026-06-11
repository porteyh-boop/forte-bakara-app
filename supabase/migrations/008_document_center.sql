-- פורטה בקרה — Document Center V1 (Master בלבד)
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  building_id text not null,
  elevator_id text,
  document_type text not null default 'other',
  title text not null,
  description text,
  file_name text not null,
  file_url text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes integer,
  tags text[] not null default '{}',
  ocr_status text not null default 'none',
  ocr_text text,
  ai_summary text,
  ai_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_building
  on public.documents(building_id);

create index if not exists idx_documents_elevator
  on public.documents(elevator_id);

create index if not exists idx_documents_type
  on public.documents(document_type);

create index if not exists idx_documents_created
  on public.documents(created_at desc);

create index if not exists idx_documents_tags
  on public.documents using gin(tags);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-center',
  'document-center',
  true,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.documents enable row level security;

drop policy if exists "documents_public_all" on public.documents;
create policy "documents_public_all" on public.documents
  for all using (true) with check (true);

drop policy if exists "document_center_storage_public_read" on storage.objects;
create policy "document_center_storage_public_read" on storage.objects
  for select using (bucket_id = 'document-center');

drop policy if exists "document_center_storage_public_insert" on storage.objects;
create policy "document_center_storage_public_insert" on storage.objects
  for insert with check (bucket_id = 'document-center');

drop policy if exists "document_center_storage_public_update" on storage.objects;
create policy "document_center_storage_public_update" on storage.objects
  for update using (bucket_id = 'document-center');

drop policy if exists "document_center_storage_public_delete" on storage.objects;
create policy "document_center_storage_public_delete" on storage.objects
  for delete using (bucket_id = 'document-center');
