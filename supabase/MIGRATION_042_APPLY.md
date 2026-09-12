# Migration 042 — pgcrypto schema for trial portal tokens

**Does not re-apply 041.** Replaces `provision_sales_lead_trial_portal` only.

## Root cause

041 sets `search_path = public` on the RPC. `gen_random_bytes` from pgcrypto is not in `public` on Supabase (typically `extensions` after the extension is enabled). Unqualified `gen_random_bytes(9)` fails at runtime even when pgcrypto is installed.

## Read-only catalog (SQL Editor)

```sql
select extname, n.nspname as schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
 where extname = 'pgcrypto';

select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.proname = 'gen_random_bytes'
 order by 1, 2;

select coalesce(array_to_string(p.proconfig, ', '), '') as proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'provision_sales_lead_trial_portal';
```

If `gen_random_bytes` appears only under `public`, change `extensions.gen_random_bytes` to `public.gen_random_bytes` in 042 before applying.

## Apply

Paste entire `migrations/042_trial_portal_pgcrypto_schema_SQL_EDITOR.sql` in one run.

## Rollback

`rollback/042_restore_pre_pgcrypto_schema_fix.sql` — restores 041-era function body (still requires pgcrypto visible on `search_path`).
