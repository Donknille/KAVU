# Sicherheits-Audit-Plan

Ziel: Sicherstellen, dass kein Mandant (Firma) Daten eines anderen Mandanten lesen oder
verändern kann, und dass Mitarbeiterdaten nicht unautorisiert abrufbar sind.

---

## 1 – Tenant-Isolierung (Cross-Tenant-Datenleck)

Jede DB-Abfrage muss `companyId` als Filter enthalten. Fehlt dieser Filter, kann ein
angemeldeter Benutzer auf fremde Firmendaten zugreifen.

### Checkliste – Server

| # | Was prüfen | Datei | Test |
|---|---|---|---|
| 1.1 | Jede `storage.*`-Methode die Daten liest filtert nach `companyId` | `server/storage.ts` | `getJob(id)` vs. `getJobForCompany(companyId, id)` – in Routen immer `ForCompany`-Variante nutzen |
| 1.2 | `GET /api/jobs/:id` gibt 404 zurück wenn Job nicht zur eigenen Firma gehört | `server/routes/jobs.ts` | HTTP-Request mit Job-ID einer fremden Firma → 404 erwartet |
| 1.3 | `GET /api/employees/:id` – dasselbe | `server/routes/employees.ts` | Fremde Employee-ID → 404 |
| 1.4 | `GET /api/assignments/:id` – dasselbe | `server/routes/assignments.ts` | Fremde Assignment-ID → 404 |
| 1.5 | Planning-Board gibt nur Daten der eigenen Firma zurück | `server/routes/planning.ts` | `GET /api/planning/board` mit companyId aus JWT |
| 1.6 | Billing-Routen prüfen `req.companyId` vor jedem Stripe-Aufruf | `server/routes/billing.ts` | Checkout-Session darf nur für eigene Firma erstellt werden |
| 1.7 | Webhook: `getCompanyByStripeCustomerId` – keine manuelle companyId aus Request | `server/routes/billing.ts` | Stripe-Event enthält customerId → Firma wird aus DB geladen, nicht aus Request |

### Wie manuell testen

```bash
# 1. Firma A: Admin anmelden, Job-ID aus Response notieren
# 2. Firma B: Admin anmelden (separater Browser / Inkognito)
# 3. Mit Session von Firma B die Job-ID von Firma A abrufen:
curl -b "session=<firma-b-session>" https://deine-app.vercel.app/api/jobs/<job-id-firma-a>
# → Erwartet: 404
```

---

## 2 – Authentifizierung und Rollen

| # | Was prüfen | Erwartetes Verhalten |
|---|---|---|
| 2.1 | Alle `/api/*`-Endpunkte (außer `/api/auth/*`, `/api/invitations/:token`) erfordern `isAuthenticated` | Ohne Session → 401 |
| 2.2 | Admin-Endpunkte (`POST /api/jobs`, `/api/employees`, `/api/planning/*`) erfordern `requireAdmin` | Als Mitarbeiter aufrufen → 403 |
| 2.3 | Mitarbeiter kann nur eigene Zeiteinträge starten/stoppen | `POST /api/assignments/:id/start-work` prüft ob Mitarbeiter dem Assignment zugewiesen ist |
| 2.4 | `GET /api/me` gibt `null`-Employee zurück wenn Session abgelaufen | Session löschen → `needsSetup: true` |
| 2.5 | Passwort-Change-Endpoint prüft `currentPassword` korrekt | Falsches Passwort → 401 |
| 2.6 | Preview-Mode (`PREVIEW_MODE=true`) ist in Production nicht aktiv | `PREVIEW_MODE` darf in Production nie `true` sein |

---

## 3 – Mitarbeiterdaten

Mitarbeiterdaten enthalten `passwordHash`, `loginId`, `mustChangePassword`. Diese dürfen
**nie** an den Client gesendet werden.

| # | Was prüfen | Datei |
|---|---|---|
| 3.1 | `toPublicEmployee()` entfernt `passwordHash`, `userId`, `loginId` (außer bei `includeAccess: true`) | `server/routes/employees.ts` |
| 3.2 | `includeAccess: true` wird nur beim Admin-Self-Service-Flow gesetzt, nie bei Listen-Endpunkten | `GET /api/employees` → kein passwordHash im Response |
| 3.3 | Employee-Login gibt nur session-Cookie zurück, kein passwordHash oder userId | `/api/auth/employee-login` |
| 3.4 | `GET /api/employees` ist auf Admins beschränkt – Mitarbeiter können keine Kollegenliste abrufen | `requireAdmin` Middleware vorhanden |
| 3.5 | `/api/me` für Mitarbeiter enthält keine sensiblen Felder | Response prüfen |

### Schnelltest

```bash
# Als normaler Mitarbeiter eingeloggt:
curl -b "session=<mitarbeiter-session>" https://deine-app.vercel.app/api/employees
# → Erwartet: 403

# Admin-Response auf einzelnen Mitarbeiter prüfen:
curl -b "session=<admin-session>" https://deine-app.vercel.app/api/employees/<id>
# → Kein passwordHash, kein passwordIssuedAt im JSON
```

---

## 4 – Rate Limiting und Brute-Force-Schutz

| # | Was prüfen | Aktueller Stand |
|---|---|---|
| 4.1 | `/api/auth/employee-login` ist rate-limited | `authLimiter` (10/min) in `server/app.ts` – vorhanden |
| 4.2 | `/api/auth/login/password` ist rate-limited | `authLimiter` – vorhanden |
| 4.3 | `/api/setup` ist rate-limited | `authLimiter` – vorhanden |
| 4.4 | `/api/billing/webhook` benötigt kein Auth, ist aber durch Stripe-Signature gesichert | `stripe.webhooks.constructEvent()` – vorhanden |
| 4.5 | Company-Access-Code kann nicht per Brute-Force erraten werden | 6-stellig alphanumerisch = ~2 Mrd. Kombinationen. Rate-Limit auf `/api/auth/employee-login` greift |

---

## 5 – Stripe-Webhook-Sicherheit

| # | Was prüfen |
|---|---|
| 5.1 | Webhook prüft Stripe-Signature (`constructEvent` mit `STRIPE_WEBHOOK_SECRET`) |
| 5.2 | `companyId` wird aus dem Stripe-Event (`metadata` oder `customer`) geholt – **nicht** aus dem HTTP-Request-Body |
| 5.3 | Webhook antwortet mit 200 auch wenn Company nicht gefunden (kein Fehlerloop) |
| 5.4 | `STRIPE_WEBHOOK_SECRET` ist nur in Vercel env gesetzt, nicht im Repo |

---

## 6 – HTTP-Header-Sicherheit

Helmet ist konfiguriert (`server/app.ts`). Folgende Header sollten gesetzt sein:

```bash
curl -I https://deine-app.vercel.app/
# Erwartete Header:
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
# Strict-Transport-Security: max-age=...
# X-XSS-Protection: 0
```

---

## 7 – Was noch fehlt / zu tun ist

| # | Maßnahme | Priorität |
|---|---|---|
| 7.1 | **Automatisierte Tenant-Security-Tests** – `npm run test:tenant-security` läuft durch | Hoch |
| 7.2 | **Audit-Log** – jede Admin-Mutation (Job anlegen, Mitarbeiter anlegen, Planung) wird geloggt | Mittel |
| 7.3 | **E-Mail-Verifikation** bei Admin-Registrierung | Mittel |
| 7.4 | **Session-Timeout** – Sitzung läuft nach Inaktivität ab | Mittel |
| 7.5 | **CSRF-Schutz** – SameSite=Lax ist gesetzt, reicht für die meisten Fälle | Vorhanden |
| 7.6 | **Dependency-Audit** – `npm audit` regelmäßig ausführen | Niedrig |
| 7.7 | **Stripe-Webhooks nur von Stripe-IPs** akzeptieren (optionale extra Absicherung) | Niedrig |

---

## 8 – Bestehende Test-Skripte ausführen

```bash
# Tenant-Isolierung testen:
npm run test:tenant-security

# Gegen echte DB testen:
npm run test:tenant-security:db

# Preview-E2E:
npm run test:preview-e2e

# Alle kritischen Flows:
npm run verify:critical-flows
```

---

## Vergessen?

Die folgenden Punkte sind im aktuellen Stand **noch nicht umgesetzt** und sollten
vor dem Launch mit echten Kunden adressiert werden:

1. **Kein Audit-Log** – Es gibt keinen Nachweis wer wann was geändert hat
2. **Keine E-Mail-Verifikation** – Ein Admin kann sich mit jeder E-Mail registrieren
3. **Kein automatischer Session-Timeout** – Sitzung bleibt unbegrenzt aktiv
4. **Stripe-Abo-Status wird nicht bei jedem Request geprüft** – Nur beim Login (via `/api/me`). Ein Abo das während einer aktiven Session gekündigt wird, friert die Plattform erst beim nächsten Seitenaufruf ein
5. **Kein Sentry / Error-Tracking** – Fehler in Production sind unsichtbar
