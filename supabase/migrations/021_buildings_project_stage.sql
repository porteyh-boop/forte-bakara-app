-- פורטה בקרה — שלב ואחוז התקדמות לפרויקט (בניין)
-- לא מוחק נתונים קיים — עמודות nullable

alter table public.buildings
  add column if not exists project_stage text,
  add column if not exists project_progress integer;

alter table public.buildings
  drop constraint if exists buildings_project_stage_check;

alter table public.buildings
  add constraint buildings_project_stage_check
  check (
    project_stage is null
    or project_stage in (
      'הצעת מחיר',
      'משא ומתן',
      'הזמנה',
      'תכנון',
      'ביצוע',
      'מסירה',
      'פרויקט סגור'
    )
  );

alter table public.buildings
  drop constraint if exists buildings_project_progress_check;

alter table public.buildings
  add constraint buildings_project_progress_check
  check (
    project_progress is null
    or (project_progress >= 0 and project_progress <= 100)
  );

create index if not exists idx_buildings_project_stage
  on public.buildings (project_stage)
  where project_stage is not null;
