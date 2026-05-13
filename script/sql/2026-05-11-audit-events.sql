-- T-305: Append-only audit log of admin mutations and auth events.
--
-- New rows arrive via the logAuditEvent helper in server/audit.ts. To keep
-- the table tamper-evident we revoke UPDATE and DELETE for non-owner roles;
-- backend writes still work because the connection uses the postgres role.
--
-- Apply BEFORE deploying the T-305 code commit, otherwise inserts via
-- Drizzle fail at runtime.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamp without time zone NOT NULL DEFAULT now(),
  company_id varchar,
  actor_user_id varchar,
  actor_employee_id varchar,
  actor_ip varchar(64),
  event_type varchar(80) NOT NULL,
  resource_type varchar(40),
  resource_id varchar,
  payload text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_audit_company_time
  ON public.audit_events (company_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_event_type
  ON public.audit_events (event_type, occurred_at);

-- Append-only enforcement for non-owner roles. The application connects
-- as postgres so writes still succeed; anon/authenticated/service_role
-- are blocked from rewriting history. After T-100 the public-facing
-- PostgREST surface is already locked down; this is defense in depth.
REVOKE UPDATE, DELETE ON public.audit_events FROM PUBLIC;

COMMIT;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS public.audit_events;
-- COMMIT;
