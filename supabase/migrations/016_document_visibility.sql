-- פורטה בקרה — הרשאות צפייה למסמכים (Master / Client)
-- internal = מאסטר בלבד | client = גם לקוח רואה

alter table public.documents
  add column if not exists visibility text not null default 'internal'
  check (visibility in ('internal', 'client'));

create index if not exists idx_documents_visibility
  on public.documents(visibility);

update public.documents
set visibility = coalesce(ai_metadata->>'visibility', 'internal')
where ai_metadata is not null
  and coalesce(ai_metadata->>'visibility', 'internal') in ('internal', 'client');
