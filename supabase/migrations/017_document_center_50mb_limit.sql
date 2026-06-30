-- פורטה בקרה — Document Center: הגדלת מגבלת קובץ ל-50MB
-- לפני הרצה: ודאו ב-Supabase Dashboard → Storage → Settings
-- ש-Global file size limit >= 50MB (ב-Free עד 50MB; ב-Pro ניתן להגדיר יותר).
-- 50MB = 52428800 bytes

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-center',
  'document-center',
  true,
  52428800,
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
