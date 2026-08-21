-- פורטה בקרה — סוג שירות עסקי לפרויקט (נפרד מ-project_type / income_type)
-- nullable לפרויקטים קיימים; אין backfill אוטומטי

alter table public.buildings
  add column if not exists service_type text,
  add column if not exists service_type_other text;

alter table public.buildings
  drop constraint if exists buildings_service_type_check;

alter table public.buildings
  add constraint buildings_service_type_check
  check (
    service_type is null
    or service_type in (
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
  );

alter table public.buildings
  drop constraint if exists buildings_service_type_other_check;

alter table public.buildings
  add constraint buildings_service_type_other_check
  check (
    (
      service_type = 'אחר'
      and service_type_other is not null
      and trim(service_type_other) <> ''
    )
    or (
      service_type is distinct from 'אחר'
      and service_type_other is null
    )
  );

create index if not exists idx_buildings_service_type
  on public.buildings (service_type)
  where service_type is not null;
