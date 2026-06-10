-- פורטה בקרה — סימון תחילת שימוש אמיתי לבניין (מסך /master)
-- לא מוחק בניינים או מעליות — רק מוסיף live_started_at לסינון דמו/נתונים ישנים בלקוח

alter table public.buildings
  add column if not exists live_started_at timestamptz;

create index if not exists idx_buildings_live_started_at
  on public.buildings (live_started_at)
  where live_started_at is not null;
