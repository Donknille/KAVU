# KAVU Deployment

## Current production shape

KAVU is currently prepared for standard hosting as a single Node service:

- `AUTH_PROVIDER=app` for built-in owner/admin email registration
- optional legacy `AUTH_PROVIDER=oidc` or `AUTH_PROVIDER=replit`
- PostgreSQL
- HTTPS domain
- invite emails via `INVITATION_EMAIL_PROVIDER`

The application no longer contains any file upload feature. There is no object storage setup and no persistent upload directory requirement anymore.

## What must be prepared

### 1. PostgreSQL database

Required:

- create a PostgreSQL database
- set `DATABASE_URL`
- run the schema push once before first start:

```bash
npm ci
npm run db:push
```

Notes:

- the `sessions` table is created automatically when the app starts
- the application tables are not auto-migrated, `npm run db:push` is still required
- if your database provider requires SSL, include it in `DATABASE_URL`

Example:

```env
DATABASE_URL=postgres://user:password@host:5432/kavu?sslmode=require
```

### 2. Authentication mode

Recommended for Render/Supabase:

```env
AUTH_PROVIDER=app
```

In this mode:

- owners/admins register directly in KAVU with email and password
- invited users with email also use the same KAVU registration/login
- employees without email use `company access code + login id + password`

Optional legacy mode:

```env
AUTH_PROVIDER=oidc
OIDC_ISSUER_URL=https://auth.example.com/application/o/kavu/
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_CALLBACK_URL=https://kavu.example.com/api/callback
OIDC_POST_LOGOUT_REDIRECT_URL=https://kavu.example.com/
OIDC_SIGNUP_HINT=signup
```

### 3. Invite emails

Required for automatic invite delivery:

```env
INVITATION_EMAIL_PROVIDER=resend
INVITATION_EMAIL_FROM=KAVU <no-reply@kavu.example.com>
INVITATION_EMAIL_REPLY_TO=support@kavu.example.com
RESEND_API_KEY=re_...
```

If automatic delivery is not needed yet, use:

```env
INVITATION_EMAIL_PROVIDER=disabled
```

Admins can still share invite links manually in that mode.

### 4. Session and proxy settings

Required:

```env
SESSION_SECRET=replace-with-a-long-random-secret
APP_BASE_URL=https://your-domain
TRUST_PROXY=true
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

## Docker deployment

Build image:

```bash
docker build -t kavu .
```

Run container:

```bash
docker run \
  --env-file .env.production \
  -p 5000:5000 \
  kavu
```

## Health checks

Use one of these endpoints:

- `/healthz`
- `/api/health`
- `/readyz`
- `/api/ready`

`/readyz` and `/api/ready` are the better staging and production probes because they also verify database reachability.

## Build and start commands

If your host uses command-based deployment:

Build command:

```bash
npm ci && npm run build
```

Release command:

```bash
npm run db:push
```

Start command:

```bash
npm run start
```

Preflight command:

```bash
npm run verify:staging
```

## Recommended first production checklist

1. Domain connected and HTTPS active
2. PostgreSQL reachable
3. `DATABASE_URL` set
4. `SESSION_SECRET` set
5. `APP_BASE_URL` set
6. OIDC client configured with correct callback URL
7. `INVITATION_EMAIL_PROVIDER` chosen
8. `npm run db:push` executed
9. `npm run verify:staging` passes
10. `/readyz` returns `200`
11. First admin login tested
12. Setup flow completed
13. Invite flow tested

## Suggested production env

```env
NODE_ENV=production
PORT=5000
APP_BASE_URL=https://kavu.example.com
DATABASE_URL=postgres://user:password@host:5432/kavu?sslmode=require
SESSION_SECRET=replace-with-a-long-random-secret
TRUST_PROXY=true
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
AUTH_PROVIDER=oidc
OIDC_ISSUER_URL=https://auth.example.com/application/o/kavu/
OIDC_CLIENT_ID=replace-me
OIDC_CLIENT_SECRET=replace-me
OIDC_CALLBACK_URL=https://kavu.example.com/api/callback
OIDC_POST_LOGOUT_REDIRECT_URL=https://kavu.example.com/
OIDC_SCOPE=openid email profile offline_access
OIDC_SIGNUP_HINT=signup
OIDC_CLIENT_AUTH_METHOD=client_secret_basic
INVITATION_EMAIL_PROVIDER=resend
INVITATION_EMAIL_FROM=KAVU <no-reply@kavu.example.com>
INVITATION_EMAIL_REPLY_TO=support@kavu.example.com
RESEND_API_KEY=re_placeholder
ENABLE_DEMO_SEED=0
```
