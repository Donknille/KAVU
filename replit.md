# KAVU Overview

## Architecture

- frontend:
  - React + Vite
- backend:
  - Express + TypeScript
- database:
  - PostgreSQL
- auth:
  - Replit Auth, local auth or generic OIDC depending on runtime config
- port:
  - `5000`

## Core features

1. company and employee management
2. multi-tenant setup and company invitations
3. jobs and assignments
4. planning board with drag and drop
5. time tracking and breaks
6. problem reporting

## Security

- auth middleware on protected routes
- tenant scoping on all data access
- zod validation on POST and PATCH routes
- rate limiting on API and auth endpoints
- helmet headers

## Data model

- `companies`
- `employees`
- `company_invitations`
- `jobs`
- `assignments`
- `assignment_workers`
- `time_entries`
- `break_entries`
- `issue_reports`

## Main files

- `shared/schema.ts`
- `server/index.ts`
- `server/routes.ts`
- `server/storage.ts`
- `server/previewStorage.ts`
- `client/src/pages/*`

## Important API groups

- `/api/me`
- `/api/setup`
- `/api/company-invitations`
- `/api/employees`
- `/api/jobs`
- `/api/assignments`
- `/api/time-entries/job/:jobId`
- `/api/issues/job/:jobId`
