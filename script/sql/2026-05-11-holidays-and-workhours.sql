-- T-302: Public holidays + per-employee weekly hours / vacation days.
--
-- Adds a global holidays table, a region_code column on companies (default
-- DE-BY -- Bavaria, the largest German federal state by workforce), and
-- three new fields on employees: weekly_hours, start_date,
-- vacation_days_per_year.
--
-- The holidays table is intentionally not RLS-protected: it is reference
-- data that every tenant reads. Region codes follow ISO 3166-2 (DE-BY,
-- DE-BE, ...). The special pseudo-code DE marks federal holidays that
-- apply across the entire country; application logic should query
-- WHERE region_code IN ('DE', <company.region_code>).
--
-- Idempotent. Apply BEFORE deploying the T-302 code commit.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.holidays (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code varchar(5) NOT NULL,
  date date NOT NULL,
  name varchar(100) NOT NULL,
  is_half_day boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_holidays_region_date
  ON public.holidays (region_code, date);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays (date);

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS region_code varchar(5) NOT NULL DEFAULT 'DE-BY';

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS weekly_hours numeric(4, 2) NOT NULL DEFAULT 40.00,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS vacation_days_per_year integer NOT NULL DEFAULT 25;

-- Federal German holidays for 2026 and 2027. Region 'DE' means "applies in
-- every federal state"; state-specific dates (Fronleichnam etc.) live as
-- separate rows per ISO 3166-2 code and can be added incrementally.
INSERT INTO public.holidays (region_code, date, name) VALUES
  ('DE', '2026-01-01', 'Neujahr'),
  ('DE', '2026-04-03', 'Karfreitag'),
  ('DE', '2026-04-06', 'Ostermontag'),
  ('DE', '2026-05-01', 'Tag der Arbeit'),
  ('DE', '2026-05-14', 'Christi Himmelfahrt'),
  ('DE', '2026-05-25', 'Pfingstmontag'),
  ('DE', '2026-10-03', 'Tag der Deutschen Einheit'),
  ('DE', '2026-12-25', '1. Weihnachtstag'),
  ('DE', '2026-12-26', '2. Weihnachtstag'),
  ('DE', '2027-01-01', 'Neujahr'),
  ('DE', '2027-03-26', 'Karfreitag'),
  ('DE', '2027-03-29', 'Ostermontag'),
  ('DE', '2027-05-01', 'Tag der Arbeit'),
  ('DE', '2027-05-06', 'Christi Himmelfahrt'),
  ('DE', '2027-05-17', 'Pfingstmontag'),
  ('DE', '2027-10-03', 'Tag der Deutschen Einheit'),
  ('DE', '2027-12-25', '1. Weihnachtstag'),
  ('DE', '2027-12-26', '2. Weihnachtstag')
ON CONFLICT (region_code, date) DO NOTHING;

-- Common state-specific holidays for 2026. State-specific 2027 rows can be
-- added later or seeded via a follow-up migration.
INSERT INTO public.holidays (region_code, date, name) VALUES
  ('DE-BW', '2026-01-06', 'Heilige Drei Koenige'),
  ('DE-BY', '2026-01-06', 'Heilige Drei Koenige'),
  ('DE-ST', '2026-01-06', 'Heilige Drei Koenige'),
  ('DE-BW', '2026-06-04', 'Fronleichnam'),
  ('DE-BY', '2026-06-04', 'Fronleichnam'),
  ('DE-HE', '2026-06-04', 'Fronleichnam'),
  ('DE-NW', '2026-06-04', 'Fronleichnam'),
  ('DE-RP', '2026-06-04', 'Fronleichnam'),
  ('DE-SL', '2026-06-04', 'Fronleichnam'),
  ('DE-SL', '2026-08-15', 'Mariae Himmelfahrt'),
  ('DE-BB', '2026-10-31', 'Reformationstag'),
  ('DE-HB', '2026-10-31', 'Reformationstag'),
  ('DE-HH', '2026-10-31', 'Reformationstag'),
  ('DE-MV', '2026-10-31', 'Reformationstag'),
  ('DE-NI', '2026-10-31', 'Reformationstag'),
  ('DE-SH', '2026-10-31', 'Reformationstag'),
  ('DE-SN', '2026-10-31', 'Reformationstag'),
  ('DE-ST', '2026-10-31', 'Reformationstag'),
  ('DE-TH', '2026-10-31', 'Reformationstag'),
  ('DE-BW', '2026-11-01', 'Allerheiligen'),
  ('DE-BY', '2026-11-01', 'Allerheiligen'),
  ('DE-NW', '2026-11-01', 'Allerheiligen'),
  ('DE-RP', '2026-11-01', 'Allerheiligen'),
  ('DE-SL', '2026-11-01', 'Allerheiligen'),
  ('DE-SN', '2026-11-18', 'Buss- und Bettag')
ON CONFLICT (region_code, date) DO NOTHING;

COMMIT;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- BEGIN;
-- ALTER TABLE public.employees
--   DROP COLUMN IF EXISTS weekly_hours,
--   DROP COLUMN IF EXISTS start_date,
--   DROP COLUMN IF EXISTS vacation_days_per_year;
-- ALTER TABLE public.companies DROP COLUMN IF EXISTS region_code;
-- DROP TABLE IF EXISTS public.holidays;
-- COMMIT;
