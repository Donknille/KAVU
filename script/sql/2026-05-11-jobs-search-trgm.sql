-- T-205: Optional performance boost for /api/jobs/search.
--
-- The current ILIKE-based search works without this migration; the
-- migration just makes it cheap when the jobs table grows past a few
-- thousand rows by adding a GIN trigram index. Safe to apply at any
-- time; the application code does not depend on the extension being
-- present.
--
-- The extension is core Postgres and shipped with Supabase. The index
-- covers the same five fields that the search endpoint hits.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS ix_jobs_search_trgm
  ON public.jobs
  USING gin (
    (
      coalesce(job_number, '') || ' ' ||
      coalesce(title, '') || ' ' ||
      coalesce(customer_name, '') || ' ' ||
      coalesce(address_city, '') || ' ' ||
      coalesce(address_street, '')
    ) gin_trgm_ops
  );

COMMIT;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS public.ix_jobs_search_trgm;
-- -- pg_trgm stays; multiple features can reuse it.
-- COMMIT;
