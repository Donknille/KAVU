# Launch-Checkliste – Meisterplaner

Status-Legende: ✅ Implementiert · ⬜ Noch offen · 🔧 Vercel-Config nötig

---

## 1 · Stripe / Billing

### Code (bereits implementiert)
- ✅ DB-Schema: Billing-Spalten in `companies` (stripeCustomerId, subscriptionStatus, trialEndsAt, ...)
- ✅ 28-Tage Trial-Logik (`server/billing.ts`)
- ✅ `requireNotFrozen` Middleware auf allen Mutations
- ✅ `POST /api/billing/checkout-session` – Stripe Checkout
- ✅ `POST /api/billing/portal-session` – Stripe Customer Portal
- ✅ `POST /api/billing/webhook` – Webhook-Handler (checkout.session.completed, subscription.updated/deleted)
- ✅ BillingBanner im Frontend (Warnung + Freeze-Hinweis)
- ✅ BillingPage (`/billing`) mit Plan, Status, Checkout-Button

### Stripe Dashboard
- ⬜ Produkt und Preis in Stripe erstellt (29,90 € / Monat, recurring)
- ⬜ Webhook-Endpunkt in Stripe registriert: `https://masterplaner-three.vercel.app/api/billing/webhook`
- ⬜ Webhook-Events aktiviert: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### Vercel Umgebungsvariablen
- 🔧 `STRIPE_SECRET_KEY` gesetzt (beginnt mit `sk_live_...`)
- 🔧 `STRIPE_WEBHOOK_SECRET` gesetzt (beginnt mit `whsec_...`)
- 🔧 `STRIPE_PRICE_ID` gesetzt (beginnt mit `price_...`)

### Datenbank
- ⬜ `npm run db:push` auf Production-DB ausgeführt (Billing-Spalten anlegen)

### Testen
- ⬜ Checkout-Flow end-to-end getestet (Testkarte `4242 4242 4242 4242`)
- ⬜ Webhook empfangen und subscriptionStatus korrekt gesetzt
- ⬜ Frozen-Zustand getestet (Trial abgelaufen → keine neuen Jobs möglich)
- ⬜ Customer Portal öffnet sich korrekt

---

## 2 · Platform Admin (Masteradmin)

### Code (bereits implementiert)
- ✅ `GET /admin/companies` – alle Firmen mit Subscription-Status
- ✅ `GET /admin/companies/:id` – Firma + Mitarbeiterliste
- ✅ `POST /admin/companies/:id/extend-trial` – Trial verlängern
- ✅ `POST /admin/companies/:id/subscription` – Status manuell setzen

### Vercel
- 🔧 `PLATFORM_ADMIN_SECRET` gesetzt (langer zufälliger String, z.B. `openssl rand -hex 32`)

### Testen
- ⬜ `GET /admin/companies` mit `X-Admin-Secret` Header funktioniert
- ⬜ Trial-Verlängerung getestet
- ⬜ Ohne Header → 401 erwartet

---

## 3 · Vercel Grundkonfiguration

- 🔧 `DATABASE_URL` gesetzt (PostgreSQL Connection String)
- 🔧 `SESSION_SECRET` gesetzt (min. 32 Zeichen, zufällig)
- 🔧 `APP_BASE_URL` = `https://masterplaner-three.vercel.app`
- 🔧 `NODE_ENV` = `production`
- 🔧 `TRUST_PROXY` = `1`
- 🔧 `COOKIE_SECURE` = `true`
- 🔧 `AUTH_PROVIDER` = `app` (oder gewünschter Provider)
- ⬜ `PREVIEW_MODE` ist **nicht** auf `true` gesetzt

---

## 4 · Sicherheit

### Implementiert
- ✅ Tenant-Isolierung: alle Queries nach `companyId` gefiltert
- ✅ `requireAdmin` auf allen Admin-Endpunkten
- ✅ Letzter-Admin-Guard (Downgrade verhindert)
- ✅ Date-Range-Limit (max. 90 Tage auf Assignments + Planning)
- ✅ `toPublicEmployee` / `toPublicCompany` – sensitive Felder werden nicht gesendet
- ✅ Rate-Limiting auf Auth-Endpunkten
- ✅ Helmet (HTTP-Security-Header)
- ✅ Session TTL konsistent (7 Tage)
- ✅ Stripe Webhook Signature Verification

### Noch offen (vor echten Kunden adressieren)
- ⬜ **E-Mail-Verifikation** bei Admin-Registrierung (Mittel)
- ⬜ **Session-Timeout** nach Inaktivität (Mittel)
- ⬜ **Audit-Log** – wer hat wann was geändert (Mittel)
- ⬜ `npm audit` ausführen, kritische Schwachstellen beheben (Niedrig)

---

## 5 · Performance

### Implementiert
- ✅ Alle 15 Seiten lazy-loaded (Code Splitting)
- ✅ TTL-Caches für `/me`, Dashboard, Planning Board
- ✅ Kein N+1 im Storage-Layer

### Noch offen
- ⬜ **Composite-Index** `assignments(companyId, assignmentDate)` in `shared/schema.ts`
- ⬜ **Composite-Index** `jobs(companyId, isArchived)` in `shared/schema.ts`
- ⬜ **Vite Chunking** – Vendor-Libraries separat bundlen
- ⬜ **Vercel Speed Insights** aktivieren
- ⬜ **DB Connection Pooling** prüfen (bei höherem Traffic)

---

## 6 · Monitoring & Observability

- ⬜ **Sentry** einbinden (Frontend + Backend) – Fehler in Production sichtbar machen
- ⬜ **Vercel Analytics** aktivieren (Core Web Vitals)
- ⬜ Vercel Log-Drain konfigurieren (optional, für längere Log-History)

---

## 7 · Vor dem ersten echten Kunden

- ⬜ Alle Punkte aus Abschnitt 1 (Stripe) erledigt
- ⬜ Alle Vercel-Variablen aus Abschnitt 3 gesetzt
- ⬜ `npm run db:push` auf Production ausgeführt
- ⬜ `npm run test:tenant-security` läuft grün durch
- ⬜ Manueller Test: Login → Job anlegen → Mitarbeiter anlegen → Planung → Zeiterfassung
- ⬜ Manueller Test: Trial abgelaufen → Freeze → Checkout → Entsperrt
- ⬜ Impressum / Datenschutzerklärung / AGB vorhanden (rechtlich, DE)
- ⬜ DSGVO: Wo werden Daten gespeichert? (Vercel/Neon Region EU?)

---

## Kurzübersicht – Was blockiert den Launch?

| Priorität | Was | Aufwand |
|---|---|---|
| 🔴 Blocker | Stripe Vercel-Variablen setzen | 5 Min |
| 🔴 Blocker | Stripe Produkt + Webhook im Dashboard | 15 Min |
| 🔴 Blocker | `db:push` auf Production | 2 Min |
| 🟡 Wichtig | `PLATFORM_ADMIN_SECRET` setzen | 2 Min |
| 🟡 Wichtig | End-to-end Checkout testen | 30 Min |
| 🟢 Nice-to-have | Sentry, Performance-Optimierungen | — |
