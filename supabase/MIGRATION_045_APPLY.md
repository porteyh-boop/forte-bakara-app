# Migration 045 — public form terms consent on `sales_leads`

Adds `terms_accepted`, `terms_accepted_at`, `terms_version` and extends `submit_public_sales_lead_form` with required `p_terms_version`.

## Apply

Paste `migrations/045_sales_lead_terms_consent_SQL_EDITOR.sql` once in Supabase SQL Editor.

Or: `DATABASE_URL=... node scripts/run-migration-045.mjs`

## Verify

```sql
select column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'sales_leads'
   and column_name like 'terms_%';

select pg_get_function_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'submit_public_sales_lead_form';
```

Expected: `p_terms_version` in RPC args.
