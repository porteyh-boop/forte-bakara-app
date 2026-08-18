-- Security Phase 1 — Client Portal anon lockdown (PREPARED ONLY — do NOT run in Production yet)
--
-- Prerequisites before running:
--   1. Deploy Client Portal server APIs (/forte/api/client/*) using service_role.
--   2. Verify Client Portal works fully via server APIs (bootstrap, faults, feedback, activity, statistics).
--   3. Master client management (client_users / client_access / client_permissions) must use
--      server-side APIs with master session — browser anon still used today via lib/client-access.ts.
--   4. Master fault/document flows still use browser anon — Part B requires Master server migration.
--
-- Rollback: re-create open policies from migrations 001, 005, 008, 013 and
--   GRANT SELECT, INSERT, UPDATE, DELETE ON affected tables TO anon;
--
-- NOTE: buildings / elevators remain open to anon in this migration (Master V2 still reads them from browser).

-- ---------------------------------------------------------------------------
-- Part A — Client Portal identity & permissions (blocks direct token enumeration)
-- WARNING: breaks Master UI client management until Master uses service_role APIs.
-- ---------------------------------------------------------------------------

drop policy if exists "client_users_public_all" on public.client_users;
drop policy if exists "client_access_public_all" on public.client_access;
drop policy if exists "client_permissions_public_all" on public.client_permissions;
drop policy if exists "client_activity_log_public_all" on public.client_activity_log;

revoke all on table public.client_users from anon, authenticated;
revoke all on table public.client_access from anon, authenticated;
revoke all on table public.client_permissions from anon, authenticated;
revoke all on table public.client_activity_log from anon, authenticated;

-- service_role retains full access via bypass RLS

-- ---------------------------------------------------------------------------
-- Part B — Portal data writes/reads previously done from browser (Client Portal migrated)
-- WARNING: breaks Master fault inbox UI, document center, statistics until Master uses server APIs.
-- ---------------------------------------------------------------------------

drop policy if exists "pilot_faults_public_all" on public.pilot_faults;
drop policy if exists "pilot_feedback_public_all" on public.pilot_feedback;
drop policy if exists "documents_public_all" on public.documents;

revoke all on table public.pilot_faults from anon, authenticated;
revoke all on table public.pilot_feedback from anon, authenticated;
revoke all on table public.documents from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part C — NOT included (Master still requires browser anon):
--   public.buildings, public.elevators, storage.objects (document buckets)
-- Phase 2: private storage buckets + signed URLs
-- ---------------------------------------------------------------------------

comment on table public.client_users is
  'Client Portal tokens — browser anon revoked in 034; access via service_role server APIs only.';
