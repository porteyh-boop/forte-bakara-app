-- פורטה בקרה — מצב workflow לפי סוג פרויקט (שלבים + תאריכי השלמה)
-- project_stage / project_progress ממשיכים להיות source of truth לתצוגה;
-- project_workflow_state שומר completedSteps { stepId: ISO8601 }

alter table public.buildings
  add column if not exists project_workflow_state jsonb;

comment on column public.buildings.project_workflow_state is
  'Workflow completion map: { "completedSteps": { "<stepId>": "<iso8601>" } }';

-- שלבי workflow מוגדרים ב-app לפי project_type — אין CHECK קשיח על project_stage
alter table public.buildings
  drop constraint if exists buildings_project_stage_check;

create index if not exists idx_buildings_project_workflow_state
  on public.buildings using gin (project_workflow_state)
  where project_workflow_state is not null;
