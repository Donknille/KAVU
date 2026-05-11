# KAVU/Meisterplaner — Implementierungsplan

**Stand:** 2026-05-08
**Quelle:** Externe Senior-Engineer-Übergabe vom 09.05.2026, kuratiert und gegen Code-Realität abgeglichen.
**Lesehinweis:** Jedes Ticket ist mit Status annotiert. ✅ erledigt · ⏳ offen · ❌ obsolet (Annahme falsch) · ⚠️ überschätzt/überdenken.

> **Wichtig:** Der Original-Plan macht mehrere Annahmen, die in dieser Version korrigiert sind. Falsche Annahmen würden zu doppelter Arbeit führen.

---

## Stack-Realität (verifiziert 2026-05-08)

| Schicht | Tatsächlich |
|---|---|
| Frontend Build | Vite (kein Next.js) ✓ |
| UI | React 18 + shadcn/ui ✓ (Plan sagte React 19 — falsch) |
| DnD | dnd-kit ✓ |
| DB-Client | **`pg` (node-postgres)** — nicht `postgres` (porsager) wie im Plan |
| ORM | Drizzle ✓ |
| State/Server | TanStack Query ✓ |
| Backend | Express 5 (ESM) ✓ |
| Sessions | `express-session` + `connect-pg-simple` ✓ |
| Auth | App-Auth via passport-local (AUTH_PROVIDER=app) ✓ |
| Email | SMTP (aktuell Gmail) / Resend optional ✓ |
| Payments | Stripe-Routen, aber **Placeholder (501)** — nicht implementiert |
| Datenbank | Supabase Postgres ✓ |
| Deployment | Vercel ✓ |
| `@supabase/ssr` / `@supabase/supabase-js` | **NICHT installiert.** Kein Frontend-Direktzugriff auf Supabase. T-102 obsolet. |
| Helmet | Installiert + konfiguriert ✓ (CSP gehärtet im Audit 2026-05) |

**Repo-Layout:**
```
/                      Repo-Root (Donknille/KAVU, branch main)
├── client/            Vite + React Frontend
│   ├── src/
│   └── public/        ✓ enthält robots.txt + sitemap.xml
├── server/            Express Backend (NICHT server/src/)
│   └── routes/        Modular registrierte Routen
├── shared/            Drizzle Schema + Zod
├── script/            Smoke-Tests, Build-Skripte
└── public/            ✓ statische Assets (robots.txt, sitemap.xml hier)
```

**Migrationen:** Kein eigenes Migration-System. Drizzle nutzt `db:push` (`drizzle-kit`). Plan-Annahme "Supabase CLI" wäre Tooling-Switch.

---

## Sprint-Übersicht (mit Realitäts-Status)

| Sprint | Originalziel | Status |
|---|---|---|
| **S0** | Production retten | ⚠️ **Großteils obsolet** — Build ist grün, robots.txt existiert. Sentry-Setup als einziges Ticket übrig. |
| **S1** | Sicherheits-Findings P0 | 🟡 **Teilweise erledigt** — Audit hat 6 von 10 Tickets bereits abgedeckt. Verbleibend: T-100 PostgREST-Revoke, T-101 Secret-Rotation, T-103 RLS, T-107 Account-Lockout, T-109 Session-Cleanup |
| **S2** | Persona-Quick-Wins | 🟡 **Teilweise** — AP 5.1 PLZ-Autocomplete bereits live. Verbleibend: T-200 Farben, T-201 Auslastung, T-202 Dauer, T-205 Suche, T-206 Tab-Bug, T-207 Status |
| **S3** | Datenmodell | ⏳ offen — Skills, Urlaub, Feiertage, Kunden-Stammdaten, Audit-Log, 1h-Raster, Kategorien-Tabelle |
| **S4** | Mobile-First | ⏳ offen — PWA, Drei-Knopf-Workflow, Offline-Sync, Foto-Upload |
| **S5** | Compliance | ⏳ offen — MFA, DATEV-Export, Backups, Custom Domain, Staging |

---

## Sprint 0 — Production retten

### ❌ T-000 — Build Pipeline reparieren

**Status: OBSOLET.** Plan-Annahme: Build seit 30.03. kaputt wegen fehlender `robots.txt`.

**Realität:** Build ist grün, letzter erfolgreicher Push war Commit `4b55bd6` (AP 5.1) am 2026-05-08. `public/robots.txt` und `public/sitemap.xml` existieren seit Commit `8a342c2` (29.03.). Keine Aktion nötig.

### ⏳ T-001 — Logs-Snapshot vor weiteren Security-Patches

**Status: Sebastian-Aufgabe.** Supabase-Dashboard → Logs → letzte 7 Tage exportieren. Snapshot **nicht** ins öffentliche Repo, verschlüsselter externer Speicher.

### ⏳ T-002 — Sentry-Frontend + -Backend

**Status: Offen.** `@sentry/react` und `@sentry/node` nicht installiert. Reihenfolge:
1. Sebastian: Sentry-Projekt anlegen, DSN holen → Vercel-ENV als `SENTRY_DSN` + `VITE_SENTRY_DSN`
2. Claude: Code-Integration (Frontend + Backend), Source-Maps-Upload-Hook im Build
3. Sebastian: Test-Error werfen → Sentry-Dashboard-Verifikation

Kann ich heute machen, sobald DSN da ist.

---

## Sprint 1 — Sicherheit P0

### ⏳ T-100 — PostgREST-Privilegien für `anon`/`authenticated` revoken

**Status: Offen, hohe Priorität.** Auch wenn KAVU den Anon-Key nicht nutzt: Supabase exponiert PostgREST standardmäßig. Anon-Key ist öffentlich (laut Supabase-URL ableitbar). Defense-in-Depth nötig.

**Vorgehen:** SQL-Migration vorbereiten, Sebastian führt sie via Supabase-Dashboard → SQL Editor aus (ich habe keinen direkten DB-Zugriff). Migration siehe Original-Plan Abschnitt T-100.

**Verifikation:** `curl <supabase-url>/rest/v1/users -H "apikey: <anon>"` → 401/403 nach Migration.

### ⏳ T-101 — Vercel-Secrets rotieren

**Status: Sebastian-Aufgabe.** `DATABASE_URL`, `SESSION_SECRET`, `RESEND_API_KEY`, `PLATFORM_ADMIN_SECRET`. Nach Rotation: alle Sessions invalidiert, Nutzer müssen sich neu einloggen.

### ❌ T-102 — Repo-Audit Supabase-Key-Nutzung

**Status: OBSOLET.** Verifikation 2026-05-08: weder `@supabase/ssr` noch `@supabase/supabase-js` in `package.json`. Frontend nutzt keinen direkten Supabase-Client. Audit hat Resultat schon: `Vorhanden: nichts`.

### ⚠️ T-103 — RLS-Policies (Defense-in-Depth)

**Status: Großer Refactor, 2-3 Tage Arbeit.** Plan-Code-Snippets nutzen `postgres`-Templates; muss auf `pg`/Drizzle adaptiert werden. Empfehlung: erst nach T-100, beginnend mit `jobs`-Tabelle, dann inkrementell. **Nicht als Tagesarbeit anpacken.**

### ✅ T-104 — Helmet + CSP

**Status: ERLEDIGT** im Audit (Commit `543238c`). Helmet aktiv, CSP gehärtet (`scriptSrc: 'self'` ohne `unsafe-inline`). Inline-Scripts externalisiert in `client/public/theme-init.js` + `asset-recovery.js`.

**Verbleibend (Plan-Original):** HSTS-`preload`-Flag, `report-uri` für CSP-Violations, CSP-Report-Endpoint. Optional als kleines Folge-Ticket.

### ✅ T-105 — Rate-Limiting an Auth-Endpoints

**Status: ERLEDIGT** im Audit (Commit `543238c`). 10/min auf 7 Auth-Routen + 3/h auf `/api/auth/forgot-password` + `/api/auth/resend-verification` + 20/h auf `/api/company-invitations`.

**Bekannte Einschränkung:** In-Memory `express-rate-limit` ist nicht persistent über Vercel-Function-Instanzen. Persistente Lösung (Vercel KV / Upstash) ist T-509 in Sprint 5.

### ✅ T-106 — CSRF-Schutz

**Status: ERLEDIGT.** Content-Type-Gate in [server/app.ts:76-83](../server/app.ts#L76-L83) — pragmatische CSRF-Mitigation, ohne Token nötig. Plus `SameSite=strict` in Prod (wenn ENV korrekt). Im Audit als Positiv-Befund vermerkt.

### ⏳ T-107 — Account-Lockout nach 5 Fehlversuchen

**Status: Offen.** Im Audit als H5 identifiziert. Drizzle-Migration: 2 Spalten an `users` + `employees`. Login-Logik anpassen. ~4-6h Arbeit inkl. Tests.

### ⚠️ T-108 — Auth-Code-Review

**Status: Größtenteils im Audit gemacht.** Findings: scrypt + `timingSafeEqual` ist drin, Tokens 256-bit + SHA-256, TTLs korrekt, Cookies `HttpOnly`+`Secure`. **Offene Punkte:**
- Email-Verify-Token wird nach Verifikation gelöscht — Single-Use ist gegeben, aber keine Atomic-Update (Race-Theorie als N2)
- Password-Reset: andere Sessions des Users werden nicht invalidiert — sollte als Follow-up

### ⏳ T-109 — Session-Cleanup via Vercel Cron

**Status: Offen, einfach.** `vercel.json` cron + Route mit `CRON_SECRET`-Auth. ~30 min Arbeit. **Guter Quick-Win.**

---

## Sprint 2 — Persona-Quick-Wins

| Ticket | Titel | Status |
|---|---|---|
| T-200 | Mitarbeiter-Farben im Plan | ⏳ Schema hat `employees.color`, UI nutzt nicht |
| T-201 | Auslastung Klartext | ⏳ Aktuelle Anzeige `0E 2f` ist kryptisch |
| T-202 | Geplante Dauer am Job | ⏳ Migration `planned_duration_minutes` + Drop-Logik |
| T-203 | PLZ-Autocomplete | ✅ **ERLEDIGT** (Commit `4b55bd6`) |
| T-205 | Such-Bar Cmd+K | ⏳ Benötigt `pg_trgm`-Extension, Backend-Endpoint, Frontend-Command-Palette |
| T-206 | Zeiten-Tab Bug | ⏳ Radix-Tab-State-Bug — wenn reproduzierbar, schnell |
| T-207 | Statuswechsel One-Click | ⏳ State-Machine + Dropdown |

**Empfehlung:** T-206 (Bug) zuerst, T-200 (Farben) als visuell sichtbarer Quick-Win, T-202 (geplante Dauer) braucht Migration und ist riskanter.

---

## Sprint 3 — Datenmodell-Erweiterungen

| Ticket | Titel | Status | Hinweis |
|---|---|---|---|
| T-300 | Skills + employee_skills | ⏳ | Neue Tabellen + UI; offene Frage „Matching oder visuell?" steht weiter aus |
| T-301 | Urlaubsverwaltung | ⏳ | Erfordert `btree_gist`-Extension; offene Frage „Self-Service vs. Admin?" |
| T-302 | Feiertage + Soll-Stunden | ⏳ | Globale `holidays`-Tabelle ohne RLS, `region_code` an companies |
| T-303 | Kunden-Stammdaten | ⏳ | Migration plus 60-Tage-Übergangsphase für `customer_name`-Backfill |
| T-304 | Wiederkehrende Aufträge | ⏳ | RRULE-basiert + Vercel-Cron |
| T-305 | Audit-Log | ⏳ | Append-only Tabelle; Helper `logEvent()`; in alle State-Changes einbinden |
| T-306 | 1-Stunden-Raster im Plan | ⏳ | Größerer DnD-Refactor |
| T-307 | Auslastungsindikator (echte Berechnung) | ⏳ | Hängt von T-301 + T-302 ab |
| T-308 | Job-Kategorien als Tabelle | ⏳ | 3-stufige Migration über 30+ Tage |

---

## Sprint 4 — Mobile-First Mitarbeiter

| Ticket | Titel | Status |
|---|---|---|
| T-400 | PWA-Setup mit `vite-plugin-pwa` | ⏳ Manifest existiert bereits; Workbox/Service-Worker fehlt |
| T-401 | EmployeeDayView Mobile-First | ⏳ Eigene Route `/today` |
| T-402 | Drei-Knopf-Workflow | ⏳ "Bin da" / "Pause" / "Fertig" |
| T-403 | Offline-Time-Tracking | ⏳ IndexedDB + Background-Sync |
| T-404 | Foto-Upload via Supabase Storage | ⏳ Neue `job_photos`-Tabelle + Bucket-Policy |
| T-405 | Push-Notifications | ⏳ Web-Push + Vercel-Cron |
| T-406 | Pausen-Erinnerung (ArbZG) | ⏳ Lokale Notification + In-App-Banner |
| T-407 | Stundenübersicht "Diese Woche" | ⏳ Aggregation aus `time_entries` |

---

## Sprint 5 — Compliance & Reife

| Ticket | Titel | Status |
|---|---|---|
| T-500 | MFA für Admins (TOTP) | ⏳ |
| T-501 | DATEV-CSV-Export | ⏳ |
| T-502 | iCal/Outlook-Export | ⏳ |
| T-503 | Stripe-Webhook-Signaturprüfung | ⏳ — abhängig von Stripe-Implementations-Entscheidung (im Audit als K1 erfasst) |
| T-504 | Backup-Strategie + Supabase-Pro | ⏳ |
| T-505 | Platform-Admin-Account statt Secret | ⏳ |
| T-506 | Material-Liste pro Job | ⏳ |
| T-507 | Custom Domain + HSTS-Preload | ⏳ |
| T-508 | Staging-Umgebung | ⏳ |
| T-509 | Vercel KV / Upstash Redis (Rate-Limit-Persistenz) | ⏳ |

---

## Querschnitt — bereits aus dem Audit übernommen

Diese Punkte sind im [SECURITY_AUDIT_REPORT.md](../SECURITY_AUDIT_REPORT.md) erfasst und teilweise mit dem Plan deckungsgleich:

- **K1** Stripe-Placeholder (= T-503): Sebastian muss entscheiden mit/ohne Billing launchen
- **K2** DSGVO-Seiten (= Plan-Punkt "BDM-/Legal-Workstream"): Impressum, Datenschutzerklärung, AGB, AVVs — Sebastian-Aufgabe
- **K4-Rest** drizzle-orm Major-Upgrade von 0.39 → 0.45: HIGH-Vuln, separates Ticket nötig
- **H1** Data-Export (DSGVO Art. 20) — fehlt im Plan, sollte ergänzt werden
- **H3** `emailVerification.ts` ignoriert Provider-Switch — relevant bei Resend-Wechsel

---

## Empfohlene konkrete nächste Schritte (Reihenfolge)

1. **Sebastian:** Sentry-Projekt anlegen → DSN setzen in Vercel-ENV (Vorbedingung für T-002)
2. **Sebastian:** Beantworte offene Backlog-Fragen 1-5 aus `Meisterplaner-Backlog-Feedback.md` (blockieren S3-Scope)
3. **Sebastian:** Stripe-Entscheidung (K1/T-503) — mit oder ohne Billing launchen
4. **Sebastian:** Mail-Provider-Wechsel (Plan steht, siehe `C:\Users\sebgr\.claude\plans\ist-es-m-glich-das-tender-bird.md`)
5. **Claude:** T-002 Sentry-Integration (sobald DSN da)
6. **Claude:** T-109 Session-Cleanup-Cron — saubere kleine Aufgabe
7. **Claude:** T-107 Account-Lockout — gemäßigt riskant, Migration + Login-Logik
8. **Sebastian:** T-100 SQL-Migration für PostgREST-Revoke ausführen (ich bereite SQL vor)
9. **Sebastian:** T-101 Secrets rotieren — invalidiert alle Sessions
10. **Beide:** T-103 RLS-Refactor — größtes Risiko, sorgsam planen (1-2 Wochen)

Alles weitere nach Bestätigung der Reihenfolge.

---

## Originalplan

Der unkurierte Originalplan vom 09.05.2026 (mit den oben markierten falschen Annahmen) ist nicht ins Repo aufgenommen, weil das hier die kuratierte Arbeitsfassung ist. Der Originalplan liegt bei Sebastian lokal.
