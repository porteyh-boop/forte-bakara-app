# Migration 041 — apply once (production)

Additive only: columns `buildings.is_trial`, `sales_leads.trial_*`, RPC `provision_sales_lead_trial_portal`, updated `convert_sales_lead_win_to_project`.

**Production git branch:** `master` (`origin/HEAD` → `master`). Do not merge to `main` unless Vercel is explicitly wired to it.

## Apply

1. Supabase Dashboard → SQL Editor → New query.
2. Paste **entire** file `migrations/041_sales_lead_trial_portal_SQL_EDITOR.sql` (already wrapped in one transaction), or:

```sql
BEGIN;
-- paste full contents of migrations/041_sales_lead_trial_portal.sql
COMMIT;
```

3. Verify:

```sql
select column_name from information_schema.columns
 where table_name = 'buildings' and column_name = 'is_trial';
select proname from pg_proc where proname = 'provision_sales_lead_trial_portal';
```

Or locally: set `DATABASE_URL` (Session pooler, not anon key) and run `node scripts/run-migration-041.mjs`.

## Rollback (code / functions only — no data delete)

Run `rollback/041_restore_pre_trial_win_convert.sql` in SQL Editor. Leaves columns and QA rows in place.

## Backups

Use Supabase Dashboard → Database → Backups (plan-dependent). No automated backup step in this repo.
