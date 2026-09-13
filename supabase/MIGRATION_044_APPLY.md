# Migration 044 — trial provision elevator `floors_count`

**Does not re-apply 041–043.** Drops `provision_sales_lead_trial_portal(uuid, timestamptz, text[])` and creates `(uuid, timestamptz, jsonb)`.

## Apply

Paste `migrations/044_trial_provision_elevator_floors_count_SQL_EDITOR.sql` once in Supabase SQL Editor.

Or: `DATABASE_URL=... node scripts/run-migration-044.mjs`

## Verify

```sql
select pg_get_function_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'provision_sales_lead_trial_portal';
```

Expected args include `p_elevators jsonb`.
