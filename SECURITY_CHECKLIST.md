# SECURITY_CHECKLIST.md — Meisterplaner
**Multi-Tenant B2B SaaS · Express 5 / Drizzle ORM / PostgreSQL (Supabase) / Vercel · Deutschland**

> Status-Legende: ✅ Umgesetzt · ⚠️ Teilweise · ❌ Offen · 🔴 Tag-1-Blocker · 🟡 Woche 1-4 · 🟢 Backlog

---

## 1. Multi-Tenancy & Datenisolation

### 1.1 Architektur

- [x] ✅ Shared-Schema-Modell: Alle Datentabellen haben `company_id`-Spalte (NOT NULL)
- [x] ✅ `company_id` wird serverseitig aus Session/Employee bezogen — niemals aus Client-Input
- [x] ✅ `requireAdmin` und `requireAuth` Middleware setzen `req.companyId` aus DB-Lookup
- [x] ✅ Alle Storage-Methoden nutzen `ForCompany`-Varianten mit explizitem `company_id`-Filter
- [x] ✅ Cross-Tenant-Fehler: `UserTenantConflictError` wenn User Firma wechseln will
- [x] ✅ Tenant-Isolation Smoke-Tests (16 Tests, laufen in CI)

### 1.2 Offene Punkte

- [ ] 🟡 Catch-All Middleware: Neue Routes ohne `requireAdmin`/`requireAuth` koennten Daten exponieren
- [ ] 🟡 Automatischer Test: Pruefe dass ALLE `/api/*` Routes eine Auth-Middleware haben

---

## 2. Authentifizierung & Sessions

### 2.1 Umgesetzt

- [x] ✅ Passwort-Hashing: scrypt (64 Bytes) + Random Salt (16 Bytes)
- [x] ✅ Timing-Safe Vergleich: `timingSafeEqual()` fuer Passwoerter und Admin-Secret
- [x] ✅ Dummy-Hash bei unbekanntem User (verhindert Username-Enumeration)
- [x] ✅ Session-Cookies: `httpOnly: true`, `secure: true` (Prod), `sameSite: strict` (Prod)
- [x] ✅ Session-TTL: 7 Tage, PostgreSQL Session Store
- [x] ✅ Session-Regeneration bei Login (`req.session.regenerate()`)
- [x] ✅ Session-Cache mit konfigurierbarem TTL (15s serverless, 5s standard)
- [x] ✅ `mustChangePassword`-Flag fuer Erstlogin erzwingt Passwortwechsel
- [x] ✅ Passwort-Validierung: min 8, max 128 Zeichen

### 2.2 Offene Punkte

- [ ] 🟡 Account-Lockout nach N fehlgeschlagenen Login-Versuchen
- [ ] 🟡 E-Mail-Verifizierung bei Admin-Registrierung
- [ ] 🟡 Session-Timeout bei Inaktivitaet (aktuell volle 7 Tage)
- [ ] 🟢 MFA / 2FA (TOTP)
- [ ] 🟢 Passwort-Ablauf-Policy

---

## 3. API-Sicherheit

### 3.1 Security Headers (Helmet)

- [x] ✅ `Content-Security-Policy`: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`
- [x] ✅ `Strict-Transport-Security`: aktiviert (Helmet Default)
- [x] ✅ `X-Content-Type-Options: nosniff`
- [x] ✅ `X-Frame-Options: SAMEORIGIN`
- [x] ✅ `upgrade-insecure-requests` in CSP

### 3.2 Rate Limiting

- [x] ✅ General API: 100 req/min
- [x] ✅ Auth-Endpoints: 10 req/min (Login, Register, Passwort-Aenderung)
- [x] ✅ Platform Admin: 10 req/min
- [x] ✅ `standardHeaders: true` (RateLimit-* Response Headers)
- [ ] 🟡 Trust Proxy korrekt konfiguriert (Vercel: `TRUST_PROXY=true`)
- [ ] 🟢 Verteilter Rate-Limit Store (aktuell In-Memory, nicht persistent ueber Serverless-Invocations)

### 3.3 CSRF-Schutz

- [x] ✅ Content-Type-Check: POST/PUT/DELETE muessen `application/json` sein
- [x] ✅ SameSite=strict auf Session-Cookies (Prod)
- [x] ✅ Keine CSRF-Tokens noetig dank Content-Type + SameSite

### 3.4 Input-Validierung

- [x] ✅ Zod-Schema-Validierung auf ALLEN Endpoints
- [x] ✅ `safeParse()` Pattern mit strukturierten Fehlermeldungen
- [x] ✅ Datum-Validierung: striktes `YYYY-MM-DD` Regex
- [x] ✅ Datumsbereich max. 90 Tage (verhindert DoS ueber grosse Queries)
- [x] ✅ String-Laengen-Limits auf allen Feldern
- [x] ✅ E-Mail-Validierung via Zod `.email()`
- [x] ✅ SQL-Injection-Schutz: Drizzle ORM mit parametrisierten Queries

### 3.5 Payload-Limits

- [x] ✅ JSON Body: max 512 KB
- [x] ✅ gzip-Kompression aktiviert

### 3.6 Offene Punkte

- [ ] 🟡 Log-Sanitisierung: Fehlerlogs koennten Request-Bodies mit Credentials enthalten
- [ ] 🟢 CSP Violation Reporting Endpoint

---

## 4. Sensible Daten

### 4.1 Umgesetzt

- [x] ✅ `passwordHash` wird aus ALLEN API-Responses entfernt (`toPublicEmployee()`)
- [x] ✅ `userId`, `loginId` nur in Self-Service-Flows exponiert
- [x] ✅ `accessCode` nur fuer Admins der eigenen Firma sichtbar
- [x] ✅ Einladungs-Tokens als SHA-256 Hash gespeichert (Klartext nur in E-Mail)
- [x] ✅ Session-Cookies mit `httpOnly` (kein JS-Zugriff)
- [x] ✅ Keine Stack-Traces in API-Responses (generische Fehlermeldungen)

### 4.2 Offene Punkte

- [ ] 🟡 Audit-Logging fuer Admin-Aktionen (Job-CRUD, Mitarbeiter-Aenderungen)
- [ ] 🟡 Error Tracking (Sentry) in Produktion
- [ ] 🟢 Strukturiertes Logging mit Request-IDs

---

## 5. Datenbank-Sicherheit

### 5.1 Umgesetzt

- [x] ✅ Connection Pool: 1 (serverless) / 3 (standard) — konfigurierbar
- [x] ✅ Idle Timeout: 5s (serverless) / 10s (standard)
- [x] ✅ Statement Timeout: 10s (verhindert Runaway Queries)
- [x] ✅ Max Connection Reuses: 7500 vor Reconnect
- [x] ✅ Drizzle ORM: Parametrisierte Queries, kein Raw SQL
- [x] ✅ Supabase RLS deaktiviert (Tenant-Isolation auf App-Ebene)

### 5.2 Offene Punkte

- [ ] 🔴 `sslmode=require` in DATABASE_URL sicherstellen
- [ ] 🟡 Regelmaessige Backups (Supabase Pro Plan oder pg_dump Cron)
- [ ] 🟢 Connection-Pool Monitoring / Alerting

---

## 6. Einladungs- und E-Mail-Sicherheit

### 6.1 Umgesetzt

- [x] ✅ Invite-Tokens: `crypto.randomBytes(32)` (256 Bit Entropie)
- [x] ✅ Tokens als SHA-256 Hash gespeichert
- [x] ✅ Single-Use: Token nach Annahme sofort invalidiert
- [x] ✅ Ablaufzeit: 14 Tage fuer Einladungen
- [x] ✅ Server-gerenderte E-Mail-Templates (kein User-HTML)
- [x] ✅ Rate-Limiting auf Invite-Endpoints (10 req/min)

### 6.2 Offene Punkte

- [ ] 🟡 SPF / DKIM / DMARC wenn eigene Domain fuer E-Mail
- [ ] 🟡 Rate-Limiting pro Nutzer (max. 20 Einladungen/Tag)
- [ ] 🟢 Disposable-E-Mail-Domains blocken bei Registrierung
- [ ] 🟢 `abuse@`-Adresse einrichten (RFC 2142)

---

## 7. Umgebungs-Konfiguration

### 7.1 Umgesetzt

- [x] ✅ `assertRuntimeConfig()` prueft alle Pflicht-Env-Vars beim Start
- [x] ✅ `SESSION_SECRET`: mindestens 32 Zeichen erzwungen
- [x] ✅ `DATABASE_URL`: Pflicht ausserhalb Preview-Mode
- [x] ✅ `APP_BASE_URL`: Pflicht fuer konsistente Redirects
- [x] ✅ Conditional Validation fuer OIDC, SMTP, Resend je nach Provider
- [x] ✅ Keine Secrets mit Client-Prefix
- [x] ✅ Vercel Environment Variables getrennt nach Environment

---

## 8. Datenschutz & DSGVO

### 8.1 Tag-1-Pflicht

- [ ] 🔴 Vollstaendige deutsche Datenschutzerklaerung veroeffentlicht
- [ ] 🔴 Impressum max. 2 Klicks erreichbar (Website + App)
- [ ] 🔴 AGB mit B2B-Bestaetigung ("Ich handle als Unternehmer i.S.d. §14 BGB")
- [ ] 🔴 AVV-Template erstellt und bereitgestellt

### 8.2 Cookie-Situation

- [x] ✅ Nur technisch notwendige Session-Cookies — kein Opt-In-Banner noetig
- [x] ✅ Cookie-Info-Banner implementiert ("Nur technisch notwendige Cookies")
- [ ] 🔴 Cookie-Nutzung in Datenschutzerklaerung beschrieben

### 8.3 Auftragsverarbeitung (AVV)

- [ ] 🔴 AVV mit Supabase unterzeichnet (supabase.com/legal/dpa)
- [ ] 🔴 AVV mit Vercel unterzeichnet (vercel.com/legal/dpa)
- [ ] 🔴 AVV mit E-Mail-Provider (Gmail SMTP: Google Workspace DPA)
- [ ] 🟡 Sub-Processor-Liste oeffentlich

### 8.4 Betroffenenrechte

- [ ] 🟡 Account-Loeschung im Dashboard (Art. 17 DSGVO)
- [ ] 🟡 Daten-Export als JSON/CSV (Art. 20 DSGVO)
- [ ] 🟡 PII-Anonymisierung bei Loeschung (E-Mail → `deleted-{id}@deleted.local`)

### 8.5 Hosting & Datenresidenz

- [x] ✅ Supabase-Projekt in EU-Region
- [ ] 🟡 Vercel Serverless Functions Region `fra1` in vercel.json konfigurieren
- [ ] 🟡 EU-US Data Privacy Framework Zertifizierung aller US-Provider pruefen

---

## 9. Rechtliches (Deutschland)

### 9.1 Impressum (§5 DDG)

- [ ] 🔴 Vollstaendiger Name, Rechtsform, Postanschrift
- [ ] 🔴 E-Mail + weiterer Kommunikationskanal
- [ ] 🔴 USt-IdNr. (falls vorhanden)
- [x] ✅ Impressum-Seite existiert (Platzhalter — muss mit echten Daten befuellt werden)

### 9.2 AGB

- [ ] 🔴 AGB vor Launch veroeffentlicht
- [ ] 🔴 Registrierungs-Checkbox: "Ich handle als Unternehmer"
- [ ] 🔴 Keine Widerrufsbelehrung (B2B)
- [ ] 🟡 Leistungsbeschreibung, Haftungsbeschraenkung, Kuendigung

### 9.3 Rechnungsstellung (wenn Stripe kommt)

- [ ] 🟢 Pflichtangaben nach §14(4) UStG
- [ ] 🟢 10 Jahre Aufbewahrungspflicht (§14b UStG)
- [ ] 🟢 E-Rechnung Empfang (XRechnung/ZUGFeRD) ab 01.01.2025

---

## 10. CI/CD & Dependencies

### 10.1 Umgesetzt

- [x] ✅ GitHub Actions CI: tsc + build + DnD-Tests + Tenant-Tests
- [x] ✅ Preview E2E Tests gegen Production-Build im Preview-Mode

### 10.2 Offene Punkte

- [ ] 🟡 `npm audit` in CI — Builds bei High/Critical Vulnerabilities scheitern lassen
- [ ] 🟡 Dependabot oder Renovate fuer automatische Updates
- [ ] 🟡 Pre-Commit Secret-Scanning (GitGuardian / TruffleHog)
- [ ] 🟢 SAST (Semgrep) auf PRs

---

## Prioritaeten-Zusammenfassung

### 🔴 Vor Launch (Pflicht)

| # | Aufgabe | Typ |
|---|---------|-----|
| 1 | Datenschutzerklaerung mit echten Daten | Rechtlich |
| 2 | Impressum mit echten Daten | Rechtlich |
| 3 | AGB mit B2B-Bestaetigung | Rechtlich |
| 4 | AVV-Template bereitstellen | Rechtlich |
| 5 | AVVs mit Supabase + Vercel + Gmail unterzeichnen | Rechtlich |
| 6 | `sslmode=require` in DATABASE_URL pruefen | Technisch |

### 🟡 Woche 1-4 nach Launch

| # | Aufgabe |
|---|---------|
| 1 | Account-Lockout nach fehlgeschlagenen Logins |
| 2 | Audit-Logging fuer Admin-Aktionen |
| 3 | Error Tracking (Sentry) |
| 4 | Account-Loeschung + PII-Anonymisierung |
| 5 | `npm audit` in CI |
| 6 | SPF/DKIM/DMARC bei eigener E-Mail-Domain |
| 7 | Backup-Strategie (pg_dump Cron) |
| 8 | Vercel Region `fra1` konfigurieren |

### 🟢 Backlog

| # | Aufgabe |
|---|---------|
| 1 | MFA / 2FA |
| 2 | Daten-Export (Art. 20 DSGVO) |
| 3 | Strukturiertes Logging mit Request-IDs |
| 4 | CSP Violation Reporting |
| 5 | Penetration Test vor erstem Enterprise-Kunden |

---

## Sicherheitsbewertung

**Gesamtstatus: 7.5/10 — SOLIDE Basis**

| Bereich | Score | Bemerkung |
|---------|-------|-----------|
| Tenant-Isolation | 9/10 | Starke App-Level Isolation + Tests |
| Authentifizierung | 8/10 | scrypt + timing-safe, fehlt Lockout |
| Input-Validierung | 9/10 | Zod auf allen Endpoints |
| Session-Management | 9/10 | Korrekte Cookie-Flags |
| API-Haertung | 8/10 | Headers + Rate-Limiting + CSRF |
| Datenschutz/Recht | 4/10 | Platzhalter-Texte, AVVs fehlen |
| Monitoring | 3/10 | Kein Sentry, kein Audit-Log |

**Hauptrisiko**: Nicht technisch, sondern **rechtlich** — Datenschutzerklaerung, Impressum und AVVs muessen vor Launch mit echten Daten befuellt werden.

---

> **Hinweis**: Diese Checkliste ersetzt keine individuelle Rechtsberatung.
> AGB, AVV und Datenschutzerklaerung sollten durch einen IT-Recht-Anwalt geprueft werden.
>
> Stack: Express 5 · Drizzle ORM · PostgreSQL (Supabase) · Vercel · App-Auth (Passport)
> Letzte Aktualisierung: Maerz 2026
