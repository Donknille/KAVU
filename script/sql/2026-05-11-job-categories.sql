-- T-308 Stage 1: User-editable job categories living alongside the existing
-- job_category enum.
--
-- Approach: ship the new model now, keep the existing jobs.category enum
-- column in place. New jobs can set jobs.category_id; the enum column is
-- still written so list pages keep working. Stages 2+3 (backfill jobs.category_id
-- from the enum, then drop the enum column) wait until enough time has passed
-- for code consumers to switch -- see docs/implementation-plan.md.
--
-- Per-company default seeding (PV / Waermepumpe / SHK / Montage / Service /
-- Sonstiges) happens at the application layer the first time an admin opens
-- the categories settings; this migration only creates the table and the
-- jobs.category_id column.
--
-- Apply BEFORE deploying the T-308 code commit.

BEGIN;

CREATE TABLE IF NOT EXISTS public.job_categories (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  color varchar(7),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  legacy_enum_value job_category,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_categories_company_name
  ON public.job_categories (company_id, name);
CREATE INDEX IF NOT EXISTS idx_job_categories_company
  ON public.job_categories (company_id, is_active);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS category_id varchar REFERENCES public.job_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_category_id ON public.jobs (category_id);

COMMIT;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- BEGIN;
-- ALTER TABLE public.jobs DROP COLUMN IF EXISTS category_id;
-- DROP TABLE IF EXISTS public.job_categories;
-- COMMIT;
