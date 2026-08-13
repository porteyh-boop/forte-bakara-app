-- פורטה בקרה — שדות פרויקט נוספים לבניין
-- nullable בלבד, ללא מחיקת עמודות

alter table public.buildings
  add column if not exists project_start_date date,
  add column if not exists project_delivery_date date,
  add column if not exists project_notes text,
  add column if not exists certified_inspector text,
  add column if not exists maintenance_company text;
