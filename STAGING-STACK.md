# KAVU Staging Stack

## Recommendation

For the current codebase, the most practical staging setup is:

1. `Render` for the application
2. `Supabase Postgres` for the database
3. `Auth0` as OIDC provider
4. `Resend` for invite emails

This matches the current monolith architecture: React build and Express API are served from the same Node process and share the same session cookies.

## Why this setup fits

- the app is a Node and Express monolith
- there is no separate frontend deployment target yet
- session-based auth works best with one origin
- file uploads are no longer part of the product, so no volume or object storage is required

## Target picture

### Staging

- app:
  - Render web service from this repository
- database:
  - Supabase Postgres
- auth:
  - Auth0 regular web application
- invite emails:
  - Resend
- domain:
  - e.g. `staging.kavu.example.com`

## Setup step by step

### 1. Create Supabase project

- create a new Supabase project
- set a database password
- copy the connection string from `Connect`

For a persistent backend service, start with the Supavisor session pooler connection string.

Example:

```env
DATABASE_URL=postgres://...pooler.supabase.com:5432/postgres
```

Then run once:

```bash
npm run db:push
```

### 2. Create Auth0 application

- create a `Regular Web Application`
- set callback URL:
  - `https://staging.kavu.example.com/api/callback`
- set logout URL:
  - `https://staging.kavu.example.com/`

KAVU environment variables:

```env
AUTH_PROVIDER=oidc
OIDC_ISSUER_URL=https://YOUR_TENANT_REGION.auth0.com/
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_CALLBACK_URL=https://staging.kavu.example.com/api/callback
OIDC_POST_LOGOUT_REDIRECT_URL=https://staging.kavu.example.com/
OIDC_SCOPE=openid email profile offline_access
OIDC_SIGNUP_HINT=signup
OIDC_CLIENT_AUTH_METHOD=client_secret_basic
```

Required claims:

- `sub`
- `email`
- `first_name`
- `last_name`

### 3. Configure invite emails

```env
INVITATION_EMAIL_PROVIDER=resend
INVITATION_EMAIL_FROM=KAVU Staging <no-reply@staging.kavu.example.com>
INVITATION_EMAIL_REPLY_TO=support@staging.kavu.example.com
RESEND_API_KEY=re_...
```

### 4. Create Render service

- create a new Render web service
- connect the GitHub repository
- use the existing `Dockerfile`
- add a public domain
- optionally add a custom domain for staging

Health check:

```text
/readyz
```

### 5. Set Render environment variables

Minimum set:

```env
NODE_ENV=production
PORT=5000
APP_BASE_URL=https://staging.kavu.example.com
DATABASE_URL=postgres://...
SESSION_SECRET=replace-with-a-long-random-secret
TRUST_PROXY=true
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
AUTH_PROVIDER=oidc
OIDC_ISSUER_URL=https://YOUR_TENANT_REGION.auth0.com/
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_CALLBACK_URL=https://staging.kavu.example.com/api/callback
OIDC_POST_LOGOUT_REDIRECT_URL=https://staging.kavu.example.com/
OIDC_SIGNUP_HINT=signup
INVITATION_EMAIL_PROVIDER=resend
INVITATION_EMAIL_FROM=KAVU Staging <no-reply@staging.kavu.example.com>
INVITATION_EMAIL_REPLY_TO=support@staging.kavu.example.com
RESEND_API_KEY=re_placeholder
ENABLE_DEMO_SEED=0
```

Starting point:

- [.env.staging.example](/c:/Users/sebgr/Coding/KAVU%20%E2%80%93%20Die%20einfache%20Einsatzplanung%20f%C3%BCrs%20Handwerk/KAVU-main/.env.staging.example)

### 6. Preflight and first staging go-live

Before deploy:

```bash
npm run verify:staging
```

Then:

1. set env vars in Render
2. deploy once
3. run `npm run db:push` against the staging database
4. verify `/readyz`
5. verify login
6. verify setup flow
7. verify invite flow
8. verify job creation and planning

## What still matters before real customers

- browser E2E tests for critical flows
- error tracking, e.g. Sentry
- audit log for planning actions
- backup and restore test
- billing when the product side is ready

## References

- Render Docker:
  - https://render.com/docs/docker
- Render Web Services:
  - https://render.com/docs/web-services
- Supabase Postgres connections:
  - https://supabase.com/docs/guides/database/connecting-to-postgres
- Auth0 application settings:
  - https://auth0.com/docs/get-started/applications/application-settings
