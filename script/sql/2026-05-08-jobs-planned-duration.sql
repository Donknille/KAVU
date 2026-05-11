-- T-202: Jobs gain a planned_duration_minutes column.
--
-- Optional integer (nullable) so existing jobs without a planned duration
-- keep working. New jobs default to 8 hours (480 minutes) in the UI, but
-- the column stays nullable at the DB level for backwards-compat.
--
-- Apply BEFORE deploying the T-202 code commit. Without this column the
-- jobs API will fail at runtime when Drizzle tries to select it.
--
-- Idempotent.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS planned_duration_minutes integer;

COMMIT;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- BEGIN;
-- ALTER TABLE public.jobs DROP COLUMN IF EXISTS planned_duration_minutes;
-- COMMIT;
