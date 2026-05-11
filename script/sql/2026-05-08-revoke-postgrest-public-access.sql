-- T-100: Revoke PostgREST privileges from anon and authenticated roles.
--
-- Background: Supabase exposes PostgREST on every project. Even though
-- KAVU's backend talks to Postgres only via the `pg` client (no
-- @supabase/supabase-js, no anon key in code), the anon key is derivable
-- from the project URL. As long as anon and authenticated roles have CRUD
-- on public schema tables, anyone who knows the project URL can read all
-- tenant data via curl. CVSS 9.8 according to the implementation plan.
--
-- This migration revokes all access. App functionality is unaffected
-- because the backend uses the dedicated DATABASE_URL credentials (service
-- role / dedicated user), not the anon role.
--
-- HOW TO RUN:
--   1. Supabase Dashboard -> SQL Editor -> new query
--   2. Paste the FORWARD block, run as single statement
--   3. Verify via script/sql/verify-postgrest-locked.sh
--   4. Smoke-test KAVU production: login, load jobs list, planning view
--   5. If anything breaks: paste and run the ROLLBACK block immediately
--
-- Do NOT run via Drizzle. This is a privilege change, not a schema change.

-- =========================================================================
-- FORWARD
-- =========================================================================
BEGIN;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

COMMIT;

-- =========================================================================
-- ROLLBACK (run only if production breaks)
-- =========================================================================
-- BEGIN;
--
-- GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
--   TO anon, authenticated;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
--
-- COMMIT;
