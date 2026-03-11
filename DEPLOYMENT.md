# KAVU Deployment

## Current production shape

KAVU is now prepared for two deployment modes:

1. Standard cloud hosting
   - `AUTH_PROVIDER=oidc`
   - `UPLOAD_PROVIDER=local`
   - PostgreSQL
   - HTTPS domain
   - persistent disk or mounted volume for uploads

2. Replit hosting
   - `AUTH_PROVIDER=replit`
   - `UPLOAD_PROVIDER=replit`
   - Replit OIDC and Replit Object Storage

The default recommendation for a normal online deployment outside Replit is:

- containerized Node app
- managed PostgreSQL
- OIDC provider
- persistent upload volume

## What must be prepared

### 1. PostgreSQL database

Required:

- Create a PostgreSQL database
- Set `DATABASE_URL`
- Run the schema push once before first start:

```bash
npm ci
npm run db:push
```

Notes:

- The `sessions` table is now created automatically when the app starts.
- The application tables are not auto-migrated. `npm run db:push` is still required.
- If your database provider requires SSL, use it in `DATABASE_URL`.

Example:

```env
DATABASE_URL=postgres://user:password@host:5432/kavu?sslmode=require
```

### 2. Authentication provider

For standard hosting, configure an OIDC provider.

Required environment variables:

```env
AUTH_PROVIDER=oidc
OIDC_ISSUER_URL=https://auth.example.com/application/o/kavu/
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_CALLBACK_URL=https://kavu.example.com/api/callback
OIDC_POST_LOGOUT_REDIRECT_URL=https://kavu.example.com/
```

What you must configure in the OIDC provider:

- Redirect URI: `https://your-domain/api/callback`
- Post logout redirect URI: `https://your-domain/`
- Claims for:
  - `sub`
  - `email`
  - `first_name`
  - `last_name`
  - `profile_image_url` optional

Important:

- After the first successful login, the app creates or updates the user record.
- If no employee/company exists yet, KAVU opens the setup flow automatically.

### 3. Session and proxy settings

Required:

```env
SESSION_SECRET=replace-with-a-long-random-secret
APP_BASE_URL=https://your-domain
TRUST_PROXY=true
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

Notes:

- `SESSION_SECRET` should be a long random value.
- `TRUST_PROXY=true` is needed on most managed platforms behind a reverse proxy.
- `COOKIE_SECURE=true` should stay enabled in production.

### 4. Upload storage

Recommended default for normal hosting:

```env
UPLOAD_PROVIDER=local
LOCAL_UPLOADS_DIR=/app/uploads
```

What you must prepare:

- mount a persistent disk or volume
- map it to `LOCAL_UPLOADS_DIR`
- ensure the application process can write there

Important:

- Do not use ephemeral container filesystem for uploads if photos must survive restarts or redeploys.
- If you host on Replit, switch to `UPLOAD_PROVIDER=replit` and set the Replit object storage env vars instead.

### 5. Demo seed

Demo seed is disabled by default for production.

Keep this:

```env
ENABLE_DEMO_SEED=0
```

Only enable it intentionally for test systems.

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
  -v kavu_uploads:/app/uploads \
  kavu
```

## Health checks

Use one of these endpoints in your hosting platform:

- `/healthz`
- `/api/health`
- `/readyz`
- `/api/ready`

`/healthz` and `/api/health` only show whether the process is alive.

`/readyz` and `/api/ready` are the better staging/production probes because they also check:

- database reachability
- local upload directory writability when `UPLOAD_PROVIDER=local`

## Build and start commands

If your host uses command-based deployment instead of Docker:

Build command:

```bash
npm ci && npm run build
```

Release / migration command:

```bash
npm run db:push
```

Start command:

```bash
npm run start
```

Preflight command for staging:

```bash
npm run verify:staging
```

This command fails fast when:

- required env vars are missing
- the database cannot be reached
- the local upload directory is not writable

## Reverse proxy / platform settings

Make sure the platform provides:

- HTTPS
- forwarded host header
- forwarded proto header
- persistent environment variables
- persistent disk for uploads if `UPLOAD_PROVIDER=local`

## Recommended first production checklist

1. Domain connected and HTTPS active
2. PostgreSQL reachable
3. `DATABASE_URL` set
4. `SESSION_SECRET` set
5. `APP_BASE_URL` set
6. OIDC client configured with correct callback URL
7. `UPLOAD_PROVIDER` chosen
8. Persistent upload directory mounted
9. `npm run db:push` executed
10. `npm run verify:staging` passes
11. `/readyz` returns `200`
12. First admin login tested
13. Setup flow completed

## Staging recommendation

Before production, run a separate staging stack with its own:

- domain, e.g. `staging.kavu.example.com`
- PostgreSQL database
- OIDC client
- upload volume
- environment variables

Use [.env.staging.example](/c:/Users/sebgr/Coding/KAVU%20%E2%80%93%20Die%20einfache%20Einsatzplanung%20f%C3%BCrs%20Handwerk/Document-Analyzer/Document-Analyzer/.env.staging.example) as the starting point.

## Suggested standard production env

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
OIDC_CLIENT_AUTH_METHOD=client_secret_basic
UPLOAD_PROVIDER=local
LOCAL_UPLOADS_DIR=/app/uploads
ENABLE_DEMO_SEED=0
```
