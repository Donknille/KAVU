-- T-301: Vacation requests with admin approval and an overlap-prevention
-- index so an approved request can't collide with another approved one for
-- the same employee.
--
-- The status flow is: pending -> approved | rejected | canceled.
-- Self-service: employees POST their own request (status=pending).
-- Admin: PATCH to set status=approved or status=rejected; an admin POST
-- can short-circuit straight to status=approved for booked vacations.
--
-- Requires the btree_gist extension for the EXCLUDE constraint. CREATE
-- EXTENSION is a privileged operation; in Supabase the SQL Editor runs
-- as postgres, so it works.
--
-- Apply BEFORE deploying the T-301 code commit.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
  CREATE TYPE vacation_status AS ENUM ('pending', 'approved', 'rejected', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.vacations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id varchar NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date >= start_date),
  status vacation_status NOT NULL DEFAULT 'pending',
  reason text,
  approved_by varchar,
  approved_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vacations_employee_date
  ON public.vacations (employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vacations_company_date
  ON public.vacations (company_id, start_date, end_date);

-- Prevent two approved vacations from overlapping for the same employee.
ALTER TABLE public.vacations
  DROP CONSTRAINT IF EXISTS no_overlap_approved_vacations;
ALTER TABLE public.vacations
  ADD CONSTRAINT no_overlap_approved_vacations EXCLUDE USING gist (
    employee_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status = 'approved');

COMMIT;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS public.vacations;
-- DROP TYPE IF EXISTS vacation_status;
-- -- btree_gist may be used elsewhere; leave it installed.
-- COMMIT;
