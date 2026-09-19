# Migration 047 — FORTE AI Marketing core

## Apply

1. Run `supabase/migrations/047_forte_ai_marketing_SQL_EDITOR.sql` in Supabase SQL Editor (Production), **or** apply via CLI migration `047_forte_ai_marketing.sql`.
2. Verify tables exist: `ai_agents`, `ai_tasks`, `ai_actions`, `ai_approvals`, `marketing_content`, `marketing_campaigns`.
3. Verify seed: `select agent_key, display_name from ai_agents order by agent_key;` — 6 rows including `manager`.

## Notes

- Uses existing `sales_leads` (no duplicate leads table).
- RLS enabled; `anon` / `authenticated` revoked; `service_role` only (Master APIs).
- Phase 1: infrastructure only — no social publish or external AI calls.
