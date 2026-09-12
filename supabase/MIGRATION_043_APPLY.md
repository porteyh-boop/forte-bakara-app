# Migration 043 — trial provision building `service_type`

**Does not re-apply 041 or 042.** Replaces `provision_sales_lead_trial_portal` only.

## Root cause

Sales leads may store free-text `service_type` (e.g. QA prep used `שירות מלא`). The RPC copied that value into `buildings.service_type`, which violates `buildings_service_type_check` (migration 035). Provision fails inside the RPC; no `trial_building_id` is saved.

## Apply

Paste entire `migrations/043_trial_provision_building_service_type_SQL_EDITOR.sql` in one run in Supabase SQL Editor.

Or: `DATABASE_URL=postgresql://... node scripts/run-migration-043.mjs`

## Verify (read-only)

```sql
select position('v_building_service_type' in pg_get_functiondef(p.oid)) > 0 as has_sanitize
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'provision_sales_lead_trial_portal';
```

`has_sanitize` should be `true`.
