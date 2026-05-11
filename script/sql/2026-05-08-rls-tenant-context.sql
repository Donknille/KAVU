-- T-103: Row Level Security policies for tenant isolation.
--
-- WARNING: DO NOT APPLY THIS YET.
--
-- This migration enables RLS on every tenant-scoped table and adds policies
-- that require app.current_company_id() to match the row's company_id.
--
-- Because `FORCE ROW LEVEL SECURITY` is set, even the postgres owner role
-- has to satisfy the policy. As long as KAVU's storage layer makes queries
-- via plain `db.select(...)` instead of `withTenantContext(..., (tx) => ...)`,
-- those queries will return zero rows after the policy lands and the entire
-- app breaks.
--
-- Apply ONLY after every storage method that touches a tenant-scoped table
-- has been migrated to withTenantContext. See:
--   - server/db/withTenantContext.ts
--   - docs/implementation-plan.md, section T-103
--
-- The script is split into a HELPER block (safe to apply immediately,
-- creates the schema + GUC accessors) and an ENABLE block (apply last).

-- =========================================================================
-- HELPER block — safe to apply now. Creates app.current_company_id() and
-- app.current_user_id() reading from session GUCs. Returns NULL if unset.
-- =========================================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_company_id()
RETURNS varchar
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::varchar
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS varchar
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::varchar
$$;

COMMIT;

-- =========================================================================
-- ENABLE block — DO NOT apply until storage layer is fully migrated.
-- =========================================================================
-- BEGIN;
--
-- -- Tenant-scoped tables
-- ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.jobs FORCE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_jobs ON public.jobs
--   FOR ALL
--   USING (company_id = app.current_company_id())
--   WITH CHECK (company_id = app.current_company_id());
--
-- ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.assignments FORCE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_assignments ON public.assignments
--   FOR ALL
--   USING (company_id = app.current_company_id())
--   WITH CHECK (company_id = app.current_company_id());
--
-- ALTER TABLE public.assignment_workers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.assignment_workers FORCE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_assignment_workers ON public.assignment_workers
--   FOR ALL
--   USING (company_id = app.current_company_id())
--   WITH CHECK (company_id = app.current_company_id());
--
-- ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.time_entries FORCE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_time_entries ON public.time_entries
--   FOR ALL
--   USING (company_id = app.current_company_id())
--   WITH CHECK (company_id = app.current_company_id());
--
-- ALTER TABLE public.break_entries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.break_entries FORCE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_break_entries ON public.break_entries
--   FOR ALL
--   USING (company_id = app.current_company_id())
--   WITH CHECK (company_id = app.current_company_id());
--
-- ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.employees FORCE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_employees ON public.employees
--   FOR ALL
--   USING (company_id = app.current_company_id())
--   WITH CHECK (company_id = app.current_company_id());
--
-- ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.company_invitations FORCE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_company_invitations ON public.company_invitations
--   FOR ALL
--   USING (company_id = app.current_company_id())
--   WITH CHECK (company_id = app.current_company_id());
--
-- ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_self_companies ON public.companies
--   FOR ALL
--   USING (id = app.current_company_id())
--   WITH CHECK (id = app.current_company_id());
--
-- COMMIT;

-- =========================================================================
-- ROLLBACK (drops everything created here)
-- =========================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS tenant_jobs ON public.jobs;
-- DROP POLICY IF EXISTS tenant_assignments ON public.assignments;
-- DROP POLICY IF EXISTS tenant_assignment_workers ON public.assignment_workers;
-- DROP POLICY IF EXISTS tenant_time_entries ON public.time_entries;
-- DROP POLICY IF EXISTS tenant_break_entries ON public.break_entries;
-- DROP POLICY IF EXISTS tenant_employees ON public.employees;
-- DROP POLICY IF EXISTS tenant_company_invitations ON public.company_invitations;
-- DROP POLICY IF EXISTS tenant_self_companies ON public.companies;
-- ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY, NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.assignments DISABLE ROW LEVEL SECURITY, NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.assignment_workers DISABLE ROW LEVEL SECURITY, NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.time_entries DISABLE ROW LEVEL SECURITY, NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.break_entries DISABLE ROW LEVEL SECURITY, NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY, NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.company_invitations DISABLE ROW LEVEL SECURITY, NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY, NO FORCE ROW LEVEL SECURITY;
-- DROP FUNCTION IF EXISTS app.current_company_id();
-- DROP FUNCTION IF EXISTS app.current_user_id();
-- DROP SCHEMA IF EXISTS app;
-- COMMIT;
