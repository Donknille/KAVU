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
