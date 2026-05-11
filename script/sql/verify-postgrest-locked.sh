#!/usr/bin/env bash
# Verifies that the PostgREST surface for KAVU's Supabase project is locked
# down. Run before AND after applying revoke-postgrest-public-access.sql so
# the delta is obvious.
#
# Required env:
#   SUPABASE_URL    e.g. https://abcd.supabase.co
#   SUPABASE_ANON_KEY  the public anon key (Supabase dashboard -> Settings -> API)
#
# Exit code:
#   0  all tables are locked (status != 200)
#   1  at least one table is still readable
#
# Usage:
#   SUPABASE_URL=https://xyz.supabase.co \
#   SUPABASE_ANON_KEY=eyJ... \
#     ./script/sql/verify-postgrest-locked.sh

set -u

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set." >&2
  exit 2
fi

# Tables defined in shared/schema.ts + shared/models/auth.ts that hold
# tenant or auth data. Keep in sync when new tables are added.
TABLES=(
  users
  sessions
  companies
  employees
  company_invitations
  jobs
  assignments
  assignment_workers
  time_entries
  break_entries
)

URL_BASE="${SUPABASE_URL%/}/rest/v1"
fail=0

for table in "${TABLES[@]}"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    "${URL_BASE}/${table}?select=*&limit=1")
  if [ "$code" = "200" ]; then
    echo "FAIL ${table} returned 200 -- still readable via anon" >&2
    fail=1
  else
    echo "OK   ${table} locked (${code})"
  fi
done

if [ "$fail" -ne 0 ]; then
  echo
  echo "One or more tables are still exposed. Apply" >&2
  echo "  script/sql/2026-05-08-revoke-postgrest-public-access.sql" >&2
  echo "in the Supabase SQL editor." >&2
  exit 1
fi

echo
echo "All tables locked."
