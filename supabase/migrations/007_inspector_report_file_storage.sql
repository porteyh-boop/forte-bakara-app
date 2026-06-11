-- פורטה בקרה — העלאת קבצים לתסקירי בודק (Master בלבד)
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ

alter table public.inspector_reports
  add column if not exists file_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspector-reports',
  'inspector-reports',
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

drop policy if exists "inspector_reports_storage_public_read" on storage.objects;
create policy "inspector_reports_storage_public_read" on storage.objects
  for select using (bucket_id = 'inspector-reports');

drop policy if exists "inspector_reports_storage_public_insert" on storage.objects;
create policy "inspector_reports_storage_public_insert" on storage.objects
  for insert with check (bucket_id = 'inspector-reports');

drop policy if exists "inspector_reports_storage_public_update" on storage.objects;
create policy "inspector_reports_storage_public_update" on storage.objects
  for update using (bucket_id = 'inspector-reports');

drop policy if exists "inspector_reports_storage_public_delete" on storage.objects;
create policy "inspector_reports_storage_public_delete" on storage.objects
  for delete using (bucket_id = 'inspector-reports');
