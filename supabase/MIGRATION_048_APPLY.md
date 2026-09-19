# Migration 048 — SCOUT `scout_lead_candidates`

Run `supabase/migrations/048_scout_lead_candidates_SQL_EDITOR.sql` in Supabase SQL Editor after 047.

Verify:

```sql
select count(*) from public.scout_lead_candidates;
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'scout_lead_candidates'
order by 1;
```
