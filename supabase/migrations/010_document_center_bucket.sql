-- פורטה בקרה — Document Center: יצירת bucket document-center אם חסר
-- הרץ ב-Supabase SQL Editor אם מתקבלת שגיאה: Bucket not found
-- (למשל כש-migration 008 לא הורץ, או שרק 009 הורץ)

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
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "document_center_storage_public_read" on storage.objects;
create policy "document_center_storage_public_read" on storage.objects
  for select to public
  using (bucket_id = 'document-center');

drop policy if exists "document_center_storage_public_insert" on storage.objects;
create policy "document_center_storage_public_insert" on storage.objects
  for insert to public
  with check (bucket_id = 'document-center');

drop policy if exists "document_center_storage_public_update" on storage.objects;
create policy "document_center_storage_public_update" on storage.objects
  for update to public
  using (bucket_id = 'document-center');

drop policy if exists "document_center_storage_public_delete" on storage.objects;
create policy "document_center_storage_public_delete" on storage.objects
  for delete to public
  using (bucket_id = 'document-center');
