# KAVU on Vercel

KAVU can now run on Vercel as a single Express function plus static client assets.

## What changed in the repo

- root entry for Vercel: `server.ts`
- shared app bootstrap: `server/app.ts`
- Vite writes the built client to root `public/` on Vercel
- `vercel.json` uses `npm ci` and `npm run build`

## Vercel project setup

Framework preset:

- `Express`

Root directory:

- project root

Build command:

```bash
npm run build
```

Install command:

```bash
npm ci
```

Output directory:

- leave empty

## Required environment variables

```env
NODE_ENV=production
APP_BASE_URL=https://your-project.vercel.app
DATABASE_URL=postgres://user:password@host:5432/kavu?sslmode=require
SESSION_SECRET=replace-with-a-long-random-secret
TRUST_PROXY=true
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
AUTH_PROVIDER=app
ENABLE_DEMO_SEED=0
INVITATION_EMAIL_PROVIDER=disabled
```

Optional mail delivery:

```env
INVITATION_EMAIL_PROVIDER=resend
INVITATION_EMAIL_FROM=KAVU <no-reply@your-domain.tld>
INVITATION_EMAIL_REPLY_TO=support@your-domain.tld
RESEND_API_KEY=re_...
```

## Database

Run once before the first production deploy:

```bash
npm ci
npm run db:push
```

Do not rely on Vercel to run `db:push` automatically.

## Checks after deploy

1. Open `/readyz`
2. Register admin account
3. Complete company setup
4. Create employee without email
5. Test employee login
6. Test invite link or invite email flow
