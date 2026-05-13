-- T-303: Customers as first-class entities + a nullable customer_id on jobs.
--
-- Existing jobs.customer_name stays in place during the transition. New
-- jobs may pick an existing customer via customer_id; the legacy free-text
-- column is still written so list views keep working unchanged. A future
-- migration can backfill customer_id from customer_name once a UI has
-- collected explicit picks.
--
-- Apply BEFORE deploying the T-303 code commit, otherwise customer
-- queries fail at runtime.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.customers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_number varchar(50),
  name varchar(255) NOT NULL,
  contact_name varchar(255),
  contact_phone varchar(50),
  contact_email varchar(255),
  address_street varchar(255),
  address_zip varchar(20),
  address_city varchar(100),
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers (company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_archived
  ON public.customers (company_id, is_archived);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS customer_id varchar REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON public.jobs (customer_id);

COMMIT;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- BEGIN;
-- ALTER TABLE public.jobs DROP COLUMN IF EXISTS customer_id;
-- DROP TABLE IF EXISTS public.customers;
-- COMMIT;
