-- T-300: Skills as a tenant-managed catalog plus join tables to
-- employees (with a 1..5 proficiency level) and jobs (required skills).
--
-- The planning UI will later filter employees by skill ("wer kann das?")
-- and show a soft warning when an assignment is made to an employee who
-- lacks one of the job's required skills. Skills do NOT hard-block
-- assignments -- workshops sometimes need to improvise.
--
-- Apply BEFORE deploying the T-300 code commit.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.skills (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  color varchar(7),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_company
  ON public.skills (company_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_company_name
  ON public.skills (company_id, name);

CREATE TABLE IF NOT EXISTS public.employee_skills (
  employee_id varchar NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  skill_id varchar NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  company_id varchar NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  created_at timestamp without time zone DEFAULT now(),
  PRIMARY KEY (employee_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill
  ON public.employee_skills (skill_id);

CREATE TABLE IF NOT EXISTS public.job_required_skills (
  job_id varchar NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  skill_id varchar NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_job_required_skills_skill
  ON public.job_required_skills (skill_id);

COMMIT;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS public.job_required_skills;
-- DROP TABLE IF EXISTS public.employee_skills;
-- DROP TABLE IF EXISTS public.skills;
-- COMMIT;
