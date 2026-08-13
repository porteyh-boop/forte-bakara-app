-- פורטה בקרה — מספר פרויקט עסקי (נפרד מ-building_id)
-- nullable; פרויקטים ישנים נשארים ללא מספר עד הזנה ידנית

alter table public.buildings
  add column if not exists project_number text;

create unique index if not exists idx_buildings_project_number_unique
  on public.buildings (project_number)
  where project_number is not null;
