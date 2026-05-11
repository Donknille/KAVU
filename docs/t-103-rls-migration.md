# T-103 — RLS migration

## Pilot status (2026-05-08)

| Building block | State |
|---|---|
| `withTenantContext(context, fn)` helper | ✅ in `server/db/withTenantContext.ts` |
| `app.current_company_id()` / `app.current_user_id()` Postgres functions | ✅ SQL ready, **HELPER block applies safely**, ENABLE block is commented |
| Demo migration of one storage method (`getJobsByCompany`) | ✅ wraps query in `withTenantContext` |
| Remaining storage methods refactored | ❌ **~80 still need migration** |
| RLS policies enabled in Supabase | ❌ deliberately not applied |

## Why RLS, given the audit already shows app-level isolation is clean?

The current isolation is enforced in the app layer: every `getXForCompany` storage method filters on `companyId`. The smoke tests prove no IDOR is reachable today. But:

1. **Defense in depth.** A future bug in a single new storage method that forgets the filter would expose another tenant. RLS is a second layer that catches that bug at the database, not in code review.
2. **Supabase posture.** `T-100` revokes anon/authenticated PostgREST access. RLS hardens against the much harder case where an attacker gains a Postgres connection (e.g. leaked `DATABASE_URL`). Without `FORCE ROW LEVEL SECURITY`, that connection — running as the owner role with `BYPASSRLS` — would still see everything.

## Order of operations

The ENABLE block in `script/sql/2026-05-08-rls-tenant-context.sql` **cannot** be run until every query against a tenant-scoped table flows through `withTenantContext`. Otherwise the app sees zero rows for every read and breaks.

```
Step 1   [DONE]   Add withTenantContext helper                                   server/db/withTenantContext.ts
Step 2   [DONE]   Apply HELPER block of the SQL migration (creates GUCs)        Supabase SQL Editor
Step 3   [TODO]   Refactor every storage method to use withTenantContext         server/storage.ts (~80 methods)
Step 4   [TODO]   Verify under load — transactions must close cleanly under
                  bottleneck conditions, and connection-pool sizing may
                  need to rise because every read now uses one connection
                  for the duration of the transaction
Step 5   [TODO]   Apply ENABLE block in Supabase                                  Supabase SQL Editor
Step 6   [TODO]   Manual cross-tenant probe + npm run test:tenant-security:db    smoke
```

## Why this is the right amount of work for one pass

The pilot wires up the plumbing (helper + GUC functions + one demo method) so future PRs only need to repeat the storage-method pattern. The refactor itself is mechanical but spans every read/write in the app — splitting it across multiple smaller PRs is safer than a single 2000-line diff that's impossible to review.

A suggested PR breakdown:
- `t-103/jobs` — all `jobs`-related storage methods (~10)
- `t-103/assignments` — assignments + assignment_workers (~15)
- `t-103/time-entries` — time and break entries (~10)
- `t-103/employees` — employees CRUD (~15)
- `t-103/companies-invitations` — remainder (~10)
- `t-103/enable-rls` — final SQL apply, only after the above ship

## Failure mode if you apply ENABLE prematurely

Every read returns zero rows. Login still succeeds (sessions table is not under RLS). Dashboard loads with empty job lists, planning view shows no employees, etc. Recovery: run the ROLLBACK block in `2026-05-08-rls-tenant-context.sql`. No data loss, but every user sees an empty app until rolled back.

## Transactional cost

`withTenantContext` opens a Postgres transaction. For a single-statement read this adds roughly one network round-trip (BEGIN + SET + SELECT + COMMIT vs. just SELECT). With Supabase connection pooling that is sub-millisecond. Heavier per-request impact when many small storage calls chain together — those should be refactored to do their work inside a single `withTenantContext` block.
