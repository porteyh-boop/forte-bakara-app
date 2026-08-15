-- Project type discriminator (standard = existing elevator projects)
alter table public.buildings
  add column if not exists project_type text not null default 'standard';

alter table public.buildings
  drop constraint if exists buildings_project_type_check;

alter table public.buildings
  add constraint buildings_project_type_check
  check (project_type in ('standard', 'home_inspection'));

create index if not exists buildings_project_type_idx
  on public.buildings (project_type);
