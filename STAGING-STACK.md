# KAVU Staging Stack

## Empfehlung

Fuer den aktuellen Stand von KAVU ist die sinnvollste Staging-Architektur:

1. `Railway` fuer die komplette App
2. `Supabase Postgres` fuer die Datenbank
3. `Auth0` als OIDC-Provider
4. `Railway Volume` fuer Uploads in Staging

Diese Kombination passt zum jetzigen Code besser als ein frueher Split auf `Vercel + separates Backend`, weil KAVU aktuell als Node/Express-Monolith mit derselben Origin fuer UI, API und Session-Cookies gebaut ist.

## Warum genau diese Struktur

- Die App ist heute ein Monolith:
  - React build wird vom Express-Server ausgeliefert
  - API und Frontend teilen sich dieselbe Session- und Cookie-Logik
- Railway deployt den bestehenden Dockerfile direkt.
- Supabase liefert eine verwaltete PostgreSQL-Datenbank.
- Auth0 passt zum vorhandenen generischen OIDC-Setup.
- Ein Railway Volume reicht fuer Staging-Fotos und Uploads, ohne sofort Storage-Migrationen aufzuzwingen.

## Zielbild

### Staging

- App:
  - Railway Service aus diesem Repository per `Dockerfile`
- Datenbank:
  - Supabase Postgres
- Auth:
  - Auth0 Regular Web Application
- Uploads:
  - Railway Volume gemountet auf `/app/uploads`
- Domain:
  - z. B. `staging.kavu.example.com`

### Produktion spaeter

- Kurzfristig:
  - dieselbe Struktur wie Staging
- Mittelfristig:
  - optional Frontend auf Vercel
  - API weiterhin als eigener Node-Service
  - Uploads auf S3/Supabase Storage statt lokales Volume

## Setup Schritt fuer Schritt

### 1. Supabase Projekt anlegen

- Neues Supabase-Projekt anlegen
- Datenbank-Passwort setzen
- Connection String aus `Connect` kopieren

Empfehlung:
- fuer persistenten Backend-Betrieb auf Railway zuerst `Supavisor session mode`
- alternativ direkte Verbindung, wenn dein Railway-Setup sauber mit IPv6 arbeitet

Env fuer KAVU:

```env
DATABASE_URL=postgres://...pooler.supabase.com:5432/postgres
```

Danach einmalig:

```bash
npm run db:push
```

### 2. Auth0 App anlegen

- In Auth0 eine `Regular Web Application` anlegen
- Callback-URL setzen:
  - `https://staging.kavu.example.com/api/callback`
- Logout-URL setzen:
  - `https://staging.kavu.example.com/`

KAVU-Umgebungsvariablen:

```env
AUTH_PROVIDER=oidc
OIDC_ISSUER_URL=https://YOUR_TENANT_REGION.auth0.com/
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_CALLBACK_URL=https://staging.kavu.example.com/api/callback
OIDC_POST_LOGOUT_REDIRECT_URL=https://staging.kavu.example.com/
OIDC_SCOPE=openid email profile offline_access
OIDC_CLIENT_AUTH_METHOD=client_secret_basic
```

Wichtig:
- Claims `sub`, `email`, `first_name`, `last_name` muessen verfuegbar sein
- Logout muss exakt auf dieselbe Domain zurueckfuehren

### 3. Railway Service anlegen

- Neues Railway-Projekt anlegen
- Service mit GitHub-Repo verbinden
- Railway erkennt den vorhandenen `Dockerfile`
- Public Domain generieren
- Custom Domain fuer Staging hinterlegen

Wichtige Railway-Einstellungen:

- Volume erstellen
- Mount Path:

```env
/app/uploads
```

- Healthcheck auf:

```text
/readyz
```

### 4. Railway Variablen setzen

Mindestens:

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
UPLOAD_PROVIDER=local
LOCAL_UPLOADS_DIR=/app/uploads
ENABLE_DEMO_SEED=0
```

Ausgangspunkt:
- [.env.staging.example](/c:/Users/sebgr/Coding/KAVU%20%E2%80%93%20Die%20einfache%20Einsatzplanung%20f%C3%BCrs%20Handwerk/Document-Analyzer/Document-Analyzer/.env.staging.example)

### 5. Preflight und Readiness

Vor dem echten Deploy:

```bash
npm run verify:staging
```

Nach dem Deploy muessen diese Endpunkte stimmen:

- Liveness:
  - `/healthz`
  - `/api/health`
- Readiness:
  - `/readyz`
  - `/api/ready`

Readiness prueft jetzt:
- DB erreichbar
- Upload-Verzeichnis beschreibbar

### 6. Erstes Staging-Go

Reihenfolge:

1. Env in Railway setzen
2. Volume mounten
3. Erstes Deploy
4. `npm run db:push` gegen die Staging-DB ausfuehren
5. `/readyz` pruefen
6. Login pruefen
7. Setup-Flow pruefen
8. Kernflows pruefen:
   - Auftrag anlegen
   - Auftrag einplanen
   - Mitarbeiter zuweisen
   - Mitarbeitersicht pruefen
   - Auftrag verschieben
   - Auftrag verlaengern

## Was vor echten Kunden noch fehlt

- Browser-E2E mit Playwright fuer die Kernflows
- Error Tracking, z. B. Sentry
- Audit Log fuer Planungsaktionen
- Stripe + Freemium-Entitlements
- Backup- und Restore-Test
- private objektbasierte Uploads fuer Produktion

## Warum Vercel jetzt noch nicht die erste Wahl ist

Vercel kann Express deployen, aber der aktuelle KAVU-Server wuerde dort als einzelne Vercel Function laufen. Fuer den jetzigen Monolithen ist Railway als persistenter Node-Service einfacher und robuster.

Sobald KAVU spaeter klar in `Frontend` und `Backend` getrennt ist, kann man sinnvoll auf diese Struktur wechseln:

- Vercel fuer Frontend
- Railway/Fly/Render fuer API
- Supabase fuer Postgres
- S3/Supabase Storage fuer Uploads

## Offizielle Referenzen

- Railway Dockerfiles:
  - https://docs.railway.com/deploy/dockerfiles
- Railway Services:
  - https://docs.railway.com/guides/services
- Railway Volumes:
  - https://docs.railway.com/volumes/reference
- Supabase Connection Strings:
  - https://supabase.com/docs/reference/postgres/connection-strings
- Supabase Verbindungstypen:
  - https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers
- Auth0 Application Settings:
  - https://auth0.com/docs/get-started/applications/application-settings
- Auth0 Express / Callback- und Logout-Konzept:
  - https://auth0.com/docs/quickstart/webapp/express/index
