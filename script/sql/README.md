# SQL migrations (out-of-band)

This directory holds SQL that is **not** part of the Drizzle schema
(`drizzle-kit push`) but still needs to land in Postgres — typically
privilege changes, extension creation, or policy bootstrapping.

Apply manually via Supabase Dashboard → SQL Editor (or Supabase CLI for
larger projects). Filenames are `YYYY-MM-DD-<slug>.sql` so the order is
obvious in `ls`.

## Files

| File | Purpose | Status |
|---|---|---|
| `2026-05-08-revoke-postgrest-public-access.sql` | T-100 — revoke anon/authenticated CRUD on public schema | not applied |
| `2026-05-08-account-lockout-columns.sql` | T-107 — add failed_login_attempts + locked_until on users + employees | not applied |
| `2026-05-08-rls-tenant-context.sql` | T-103 — RLS helper functions + (commented) tenant policies | helper block only; ENABLE block must wait until full storage refactor |
| `2026-05-08-jobs-planned-duration.sql` | T-202 — add planned_duration_minutes to jobs | not applied |
| `2026-05-11-jobs-search-trgm.sql` | T-205 — pg_trgm extension + GIN search index (optional perf boost) | not applied |
| `2026-05-11-holidays-and-workhours.sql` | T-302 — holidays table + region_code on companies + weekly_hours/start_date/vacation_days_per_year on employees | not applied |
| `2026-05-11-customers.sql` | T-303 — customers table + jobs.customer_id (nullable, transitional) | not applied |
| `2026-05-11-audit-events.sql` | T-305 — append-only audit_events table + non-owner UPDATE/DELETE revoke | not applied |
| `2026-05-11-recurring-jobs.sql` | T-304 — recurring_job_templates table | not applied |
| `2026-05-11-skills.sql` | T-300 — skills + employee_skills + job_required_skills | not applied |
| `2026-05-11-vacations.sql` | T-301 — vacations table + btree_gist overlap constraint | not applied |

## Verification scripts

| Script | When to run |
|---|---|
| `verify-postgrest-locked.sh` | Before and after T-100. Needs `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars. |

## Workflow per change

1. Add new SQL file with date prefix
2. Document expected behavior + rollback inline in the SQL
3. Apply via Supabase Dashboard
4. Run verification script
5. Smoke-test production app (login + jobs list + planning view)
6. Mark applied in the table above (commit the README update)

Never run these via Drizzle's `db:push` — they touch privileges/extensions,
not schema. Drizzle would either ignore them or reset them on the next push.
