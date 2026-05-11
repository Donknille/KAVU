-- T-107: Account lockout columns on users and employees.
--
-- After 5 failed login attempts the account is locked for 15 minutes.
-- Logic lives in server/replit_integrations/auth/lockout.ts.
--
-- Apply BEFORE deploying the T-107 code commit. Without these columns the
-- login routes will fail at runtime when they query failedLoginAttempts.
--
-- Idempotent: safe to run multiple times.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> paste -> Run.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamp without time zone;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamp without time zone;

COMMIT;

-- =========================================================================
-- ROLLBACK (only if you want to drop the columns)
-- =========================================================================
-- BEGIN;
-- ALTER TABLE public.users
--   DROP COLUMN IF EXISTS failed_login_attempts,
--   DROP COLUMN IF EXISTS locked_until;
-- ALTER TABLE public.employees
--   DROP COLUMN IF EXISTS failed_login_attempts,
--   DROP COLUMN IF EXISTS locked_until;
-- COMMIT;
