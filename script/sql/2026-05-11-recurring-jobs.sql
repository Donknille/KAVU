-- T-304: Recurring job templates spawn new jobs on a fixed monthly
-- interval. Drives maintenance contracts ("annual heat pump service",
-- "quarterly PV inspection") without manual re-entry.
--
-- The model is intentionally simpler than full RRULE: a monthly interval
-- and a next_run_at date. The cron at /api/cron/run-recurring-jobs picks
-- up every active row whose next_run_at <= today and creates a job; that
-- date then advances by recurrence_interval_months.
--
-- Apply BEFORE deploying the T-304 code commit.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.recurring_job_templates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id varchar,
  title varchar(255) NOT NULL,
  category job_category,
  description text,
  planned_duration_minutes integer NOT NULL DEFAULT 480,
  recurrence_interval_months integer NOT NULL DEFAULT 12,
  next_run_at date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_company
  ON public.recurring_job_templates (company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_run
  ON public.recurring_job_templates (is_active, next_run_at);

COMMIT;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS public.recurring_job_templates;
-- COMMIT;
