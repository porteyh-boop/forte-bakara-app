-- פורטה בקרה — Document Center: חיזוק policies ל-Storage (Master בלבד)
-- הרץ אם העלאה נכשלת ב-Production למרות migration 008

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
