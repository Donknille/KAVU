# KAVU (Meisterplaner) — Security Audit Report

**Datum:** 2026-04-19
**Methode:** Statische Code-Analyse (drei parallele Explore-Agenten, manuelle Verifikation kritischer Claims)
**Auditor:** Claude Code
**Fokus:** Multi-Tenant-Isolation, OWASP Web Top 10, DSGVO, Launch-Readiness

> **Kontext:** Der Audit-Prompt war für einen Next.js-App-Router + Supabase-RLS + Drizzle-Stack geschrieben. KAVU läuft stattdessen auf Express 5 (ESM) + App-Auth + Supabase-als-Postgres-only (keine RLS). Phasen wurden auf den tatsächlichen Stack adaptiert.
>
> Die existierende [SECURITY-AUDIT.md](SECURITY-AUDIT.md) ist ein **Audit-Plan, kein Ergebnis**, und enthält veraltete Claims (z. B. „Stripe-Webhook-Signature-Verification vorhanden" — tatsächlich ist Stripe ein 501-Placeholder). Dieser Report ist das verifizierte Ergebnis.

---

## Executive Summary

- **Gesamtrisiko:** Mittel — gute Anwendungs-Sicherheit, aber **mehrere Launch-Blocker rechtlicher Natur**
- **Tenant-Isolation:** ✅ **Bestanden** — app-level konsistent, mit 16 In-Memory + 11 HTTP-IDOR-Tests abgedeckt
- **Findings:** 5 Kritisch · 5 Hoch · 5 Mittel · 4 Niedrig · diverse Positive
- **Release-Empfehlung:** **No-Go für Produktivstart** — Blocker sind überwiegend DSGVO-/Recht-/Dependency-Items, keine Architektur-Mängel. Nach Abarbeitung des Maßnahmenplans unten: Go.

### Stärken (Kurzfassung)
- Keine IDOR-Schwachstellen in ~40 geprüften Routen — `companyId` kommt ausnahmslos aus der Session, nie aus User-Input
- Keine Raw-SQL, alle Queries via Drizzle parametrisiert
- Zod-Validierung auf allen `/api/*`-Endpoints mit Body
- Sensible Felder (`passwordHash`, `accessCode`, `loginId`) via `toPublicEmployee` / `toPublicCompany` konsequent entfernt
- CSRF-Schutz via Content-Type-Gate ([server/app.ts:76-83](server/app.ts#L76)) — pragmatisch und wirksam für JSON-API
- Scrypt-Passwort-Hashing mit `timingSafeEqual`
- `DUMMY_HASH`-Pattern bei `/api/auth/login/password` gegen Timing-Enumeration

### Blocker-Themen (Kurzfassung)
1. **Stripe ist Placeholder** — `server/billing.ts` und `server/routes/billing.ts` sind 501/noop, aber KAVU bewirbt sich als SaaS mit Billing → Go-Live ohne echte Zahlungsabwicklung
2. **DSGVO-Artefakte fehlen** — Impressum, Datenschutzerklärung, AGB, Subprocessor-Liste, Art.-20-Export
3. **AVVs unsigned** — Supabase, Vercel, Mail-Provider (laut eigener [SECURITY_CHECKLIST.md:255](SECURITY_CHECKLIST.md#L255))
4. **`npm audit` meldet mehrere HIGH-Vulns** — bedürfen Upgrade + Smoke-Test
5. **Rate-Limit-Lücken** auf `/api/auth/forgot-password`, `/api/auth/resend-verification`, `/api/company-invitations`

---

## Tenant-Isolation-Matrix

| Tabelle | companyId-Feld | Indexed | Storage-Pattern | Routen-Coverage | Bewertung |
|---|---|---|---|---|---|
| `employees` | ✅ | ✅ | `ForCompany(cId,id)` + FK | `/api/employees/*` via `requireAdmin` | ✅ Sicher |
| `jobs` | ✅ | ✅ | `ForCompany(cId,id)` + FK | `/api/jobs/*` via `requireAdmin` | ✅ Sicher |
| `assignments` | ✅ | ✅ | `ForCompany(cId,id)` + FK | `/api/assignments/*` via `requireAuth`+Worker-Check | ✅ Sicher |
| `assignment_workers` | ✅ | ✅ | Cross-Tenant-Block in `storage.ts:1190-1201` | Intern | ✅ Sicher |
| `timeEntries` | ✅ | ✅ | Cross-Tenant-Block in `storage.ts:1260-1270` | `/api/time-entries/*` | ✅ Sicher |
| `breakEntries` | ✅ | ✅ | Cross-Tenant-Block in `storage.ts:1294-1309` | Intern | ✅ Sicher |
| `company_invitations` | ✅ | ✅ | Token-Hash + Email-Match-Check | `/api/invitations/*`, `/api/company-invitations/*` | ✅ Sicher |
| `companies` | (Root) | — | Indirekt via `employees.companyId` | `/api/setup`, `/api/me` | ✅ Sicher |
| `users` (Auth) | — | — | Global, tenant-agnostic | `/api/auth/*` | ✅ Sicher |
| `sessions` | — | — | express-session + connect-pg-simple | Intern | ✅ Sicher |

**RLS:** nicht aktiv — Tenant-Isolation ist 100 % app-level. Dokumentiert in [SECURITY_CHECKLIST.md:125](SECURITY_CHECKLIST.md#L125). Siehe Finding M3 für Bewertung.

**Test-Coverage:** 27 automatisierte IDOR-Assertions (16 in-memory + 11 HTTP) in `script/tenant-security-smoke.ts` und `script/tenant-security-db-smoke.ts`. Abdeckung überzeugend.

---

## Findings

### 🔴 KRITISCH

#### K1 — Stripe-Integration ist Placeholder (501), aber als implementiert dokumentiert

**Kategorie:** AuthZ / Billing / Dokumentationsdiskrepanz
**Dateien:** [server/billing.ts:1-14](server/billing.ts#L1-L14), [server/routes/billing.ts:1-19](server/routes/billing.ts#L1-L19)

**Beweis:**
```typescript
// server/billing.ts
export function isCompanyFrozen(_company: Company): boolean { return false; }
export function trialDaysLeft(_company: Company): number | null { return null; }
export function requireNotFrozen(_storage: any) {
  return (_req: any, _res: any, next: any) => next();
}
```
```typescript
// server/routes/billing.ts
app.post("/api/billing/webhook", (_req, res) => {
  res.status(501).send("Webhook not configured.");
});
```

**Risiko:** [SECURITY-AUDIT.md:84, 93-97](SECURITY-AUDIT.md#L84) beansprucht: „`/api/billing/webhook` ist durch Stripe-Signature gesichert" und „Webhook prüft Stripe-Signature". Das ist **falsch** — es gibt keinen Webhook-Handler und keine Signaturprüfung. Beim Launch mit Billing: entweder kein Billing → Revenue = 0, oder Billing wird kurzfristig nachgerüstet mit hohem Fehlerrisiko.

**Empfehlung:**
1. Vor Launch entscheiden: Launch **mit** Billing (→ vollständige Stripe-Integration inkl. Webhook-Signature, Idempotenz, Raw-Body-Handling auf Webhook-Route) oder **ohne** (→ Pricing-Seite umschreiben, Stripe-Links entfernen).
2. [SECURITY-AUDIT.md](SECURITY-AUDIT.md) Abschnitte 4.4 und 5 korrigieren, damit kein falscher Sicherheits-Eindruck bestehen bleibt.
3. `.env.example` um `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` ergänzen, sobald implementiert.
4. Bei Implementierung: `express.raw({ type: "application/json" })` **nur** für Webhook-Route, vor `express.json()` registrieren — sonst scheitert die Signaturprüfung.

---

#### K2 — DSGVO-Pflichtseiten fehlen (Impressum, Datenschutzerklärung, AGB, Subprocessor-Liste)

**Kategorie:** DSGVO / Rechtspflichten
**Prüfung:** keine Route / Page für `/impressum`, `/datenschutz`, `/agb`, `/privacy`, `/legal`, `/subprocessors` im Repo

**Risiko:**
- **§5 DDG (ehem. TMG)**: Impressum ist bei geschäftlichen Websites in Deutschland **Pflicht** — Verstoß ist abmahnfähig (typische Streitwerte 500-5.000 €).
- **Art. 13 DSGVO**: Informationspflichten bei Datenerhebung — ohne Datenschutzerklärung rechtswidrige Verarbeitung.
- **Art. 28 DSGVO**: Auftragsverarbeitungs-Verträge (AVVs) mit Supabase, Vercel, Mail-Provider. [SECURITY_CHECKLIST.md:255](SECURITY_CHECKLIST.md#L255) listet diese selbst als „noch zu unterzeichnen".
- **B2B-Fall:** AGB mit B2B-Bestätigung verhindern Widerruf-Ansprüche, die bei B2C existieren.

**Empfehlung:** Vor Go-Live:
1. **Impressum** als React-Page oder statisches HTML (kann in `client/public/` liegen), verlinkt im Footer — maximal 2 Klicks vom Dashboard.
2. **Datenschutzerklärung** mit echten Angaben: Supabase-Region (EU-Central/Frankfurt o. ä.), Vercel (US/EU), Mail-Provider, Cookie-Kategorien (→ verknüpft sich mit Cookie-Consent-Branch, siehe früheres Gespräch).
3. **AGB** mit B2B-Klausel („Vertragsschluss ausschließlich mit Unternehmern im Sinne §14 BGB").
4. **AVVs unterzeichnen** — Supabase: supabase.com/legal/dpa · Vercel: vercel.com/legal/dpa · aktueller SMTP-Provider: eigene DPA einholen.
5. **Subprocessor-Liste** als öffentliche Markdown-Seite oder in der Datenschutzerklärung.
6. **Empfehlung dringend:** Review durch Fachanwalt für IT-Recht (pauschal 800-2.000 €).

---

#### K3 — Fehlende Rate-Limits auf Mail-auslösenden Endpoints

**Kategorie:** DoS / Spam / Email-Enumeration
**Datei:** [server/app.ts:56-71](server/app.ts#L56-L71)

**Beweis:** `authLimiter` (10 req/min) ist aktiv auf 7 Routen, aber **nicht** auf:
- `POST /api/auth/forgot-password` — unbegrenzte Password-Reset-Mails möglich (nur globaler 100/min-Limit)
- `POST /api/auth/resend-verification` — unbegrenzte Verify-Mails möglich
- `POST /api/company-invitations` — unbegrenzte Invitations-Mails möglich

**Risiko:**
1. **Mail-Bombing** eines beliebigen Users: 60 Reset-Mails/Minute in dessen Inbox. Schlechte Reputation des eigenen SMTP-Senders.
2. **Verbrauch von Mail-Kontingent** (Resend Free-Tier: 100/Tag). Angreifer kann das Kontingent in < 2 Minuten verbrauchen.
3. **Email-Enumeration per Response-Pattern** auf `/api/company-invitations`.

**Empfehlung:**
```typescript
// Am Anfang von server/app.ts, zu den bestehenden Limits:
const emailAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 3,                    // 3 Versuche pro IP/Stunde
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Zu viele Versuche. Bitte in einer Stunde erneut versuchen." },
});
app.use("/api/auth/forgot-password", emailAuthLimiter);
app.use("/api/auth/resend-verification", emailAuthLimiter);

const invitationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,  // 20 Invitations pro IP/Stunde
  // Optional: keyGenerator nach companyId statt IP für fairere Limits
});
app.use("/api/company-invitations", invitationLimiter);
```

---

#### K4 — `npm audit`: mehrere HIGH-Vulnerabilities in Production-Dependencies

**Kategorie:** Supply-Chain
**Betroffen (Stand Audit-Zeitpunkt, bitte mit `npm audit` frisch prüfen):**
- **`drizzle-orm` <0.45.2** — GHSA-gpj5-g38j-94v9 (ORM-seitig fragliches Quoting)
- **`vite` 7.0.0-7.3.1** — mehrfach HIGH (Path Traversal, File Read)
- **`path-to-regexp`** — DoS via Backtracking
- **`picomatch`** — ReDoS
- **`lodash`** — mehrere HIGH
- **`nodemailer` ≤8.0.4** — MODERATE (SMTP-Injection) — betrifft KAVUs Mail-Versand direkt
- **`brace-expansion`**, **`yaml`** — MODERATE (DoS)

**Risiko:** `drizzle-orm` ist die Kernabhängigkeit aller DB-Queries. Jede ORM-Injection-Lücke wäre ein Totalschaden. `vite`-Lücken treffen nur Dev-Server (in Prod wird statisch ausgeliefert). `nodemailer` ist laufzeit-relevant.

**Empfehlung:**
```bash
npm audit                  # Aktuelle Liste
npm audit fix              # Nicht-breaking fixes
# Für drizzle-orm ggf. Major-Upgrade prüfen:
npm view drizzle-orm versions --json | tail -20
npm install drizzle-orm@latest
npm run check              # TypeScript durchlaufen
npm run test:planning-dnd  # Smoke
npm run test:tenant-security
```
Falls Major-Upgrade breaking ist: Version-Pin auf niedrigstem sicheren Patch-Level.

---

#### K5 — CSP `scriptSrc` erlaubt `'unsafe-inline'`

**Kategorie:** XSS-Härtung
**Datei:** [server/app.ts:33-34](server/app.ts#L33-L34)

**Beweis:**
```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],  // ← PROBLEM
    styleSrc: ["'self'", "'unsafe-inline'"],   // Für Tailwind akzeptabel
    ...
```

**Risiko:** Sollte es irgendwo zu einer Reflected/Stored-XSS-Schwachstelle kommen (z. B. fehlendes Escaping in einer neuen Komponente), wäre die CSP als Verteidigungslinie **ausgehebelt**. Aktuell ist keine XSS-Quelle bekannt (siehe Positiv-Befund XSS), aber Defense-in-Depth ist gerade hier wichtig.

**Empfehlung:**
- Vite produziert im Prod-Build ausschließlich externe Scripts (kein Inline). `scriptSrc: ["'self'"]` reicht.
- Falls ein Inline-Script doch nötig ist (z. B. ein Theme-Preload-Snippet in `index.html`): Nonce-basierter Ansatz (`scriptSrc: ["'self'", \`'nonce-${nonce}'\`]`) statt `unsafe-inline`.
- `styleSrc` kann `'unsafe-inline'` behalten, solange Tailwind JIT-Runtime-Classes generiert — das ist Standard und kein Risiko, weil CSS kein Code-Ausführungsvektor ist.

**Verifikation nach Fix:** `curl -I https://<app>/` → `content-security-policy`-Header prüfen, dann Production-Check ob App noch rendert (Login-Flow, Dashboard, Planning-View).

---

### 🟠 HOCH

#### H1 — Kein Data-Export (DSGVO Art. 20)

**Kategorie:** DSGVO
**Prüfung:** Keine Route, die strukturiert alle Daten eines Users/einer Company exportiert

**Risiko:** Bei Kundenanfrage („Ich möchte alle meine Daten") muss innerhalb 30 Tagen strukturiert/maschinenlesbar (JSON/CSV) geliefert werden — sonst drohen Bußgelder (bis 4 % Jahresumsatz, realistisch 500-10.000 € für KMU).

**Empfehlung:** `GET /api/me/export` für Employee-Self-Service und `GET /api/company/:id/export` (requireAdmin) für Company-Level. Ergebnis als ZIP mit JSON pro Tabelle (employees.json, jobs.json, assignments.json, timeEntries.json, ...). Vorerst akzeptabel: manueller Export auf Anfrage, dokumentiert in Datenschutzerklärung — aber Endpoint-Automatisierung ist empfohlen.

---

#### H2 — Error-Handler loggt komplettes Error-Objekt (PII-Leak-Potenzial)

**Kategorie:** Logging / DSGVO
**Datei:** [server/app.ts:180-191](server/app.ts#L180-L191)

**Beweis:**
```typescript
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Internal Server Error:", err);  // ← komplettes err-Objekt
  ...
});
```

**Risiko:** `err` kann bei Zod-Fehlern oder Validation-Errors den kompletten Request-Body enthalten (Email, Passwort, Token). Vercel Log Drains / Runtime-Logs würden diese Daten dann speichern.

**Empfehlung:**
```typescript
console.error("Internal Server Error:", {
  status,
  message,
  stack: err?.stack,
  name: err?.name,
});
```
oder Strukturierter Logger (Pino) mit Redact-Feldern (`email`, `password`, `token`).

---

#### H3 — Bug: `emailVerification.ts` ignoriert Provider-Switch

**Kategorie:** Config-Kompatibilität / Mail-Versand
**Datei:** [server/emailVerification.ts:29, 69](server/emailVerification.ts#L29)

**Beweis:**
```typescript
// Zeile 29 und 69 — beide Stellen hardcoded SMTP:
const result = await sendViaSMTP({ to, subject, html, text });
```

**Risiko:** Im Moment unkritisch (Prod läuft auf `INVITATION_EMAIL_PROVIDER=smtp`). Wird zum Blocker, sobald Provider auf `resend` umgestellt wird — Signup-Verify-Mails und Password-Reset-Mails werden still ausfallen, während Welcome-Mails und Invitations korrekt laufen.

**Empfehlung:** Analog [server/welcomeEmailDelivery.ts:154-174](server/welcomeEmailDelivery.ts#L154-L174) refactoren — Provider-Switch mit vier Fällen (`disabled`/`log`/`smtp`/`resend`). Oder gleich gemeinsame `sendEmail(...)`-Abstraktion für alle drei Delivery-Module extrahieren (entfernt ~80 Zeilen Duplikation).

---

#### H4 — Email-Verifikation bei Admin-Registrierung nicht erzwungen

**Kategorie:** AuthZ
**Status:** Bereits erfasst in [LAUNCH-CHECKLIST.md:85](LAUNCH-CHECKLIST.md#L85) und [SECURITY-AUDIT.md:121, 153](SECURITY-AUDIT.md#L121)

**Beweis:** Nach Registrierung setzt der Code sofort `req.session.localAuth` und lässt den User einloggen, obwohl `emailVerified: false`. Company-Erstellung, Einladungen versenden — alles möglich ohne Verifikation.

**Risiko:** Tippfehler in Email = Hijacking-Potenzial (Angreifer registriert mit fremder Email, kontrolliert dann deren Account). Kein direkter Compromise, aber Account-Confusion.

**Empfehlung:** Gate für Company-Erstellung: `if (!user.emailVerified) return 403`. UI: Verify-Banner auf Dashboard, solange `emailVerified === false`.

---

#### H5 — Kein Account-Lockout nach fehlgeschlagenen Logins

**Kategorie:** Brute-Force
**Datei:** [server/replit_integrations/auth/routes.ts:235-287 (password-login)](server/replit_integrations/auth/routes.ts#L235)

**Risiko:** Rate-Limit erlaubt 10 Versuche/min/IP — d. h. **14.400/Tag** pro IP. Bei schwachen Passwörtern (8 Zeichen Minimum laut Zod) und bekannter Email ist das in einer mittelgroßen Credential-Liste durchaus durchführbar. Rate-Limit ist ein Damm, aber kein Verhinderer.

**Empfehlung:** Pro-User-Lockout nach 5-10 fehlgeschlagenen Versuchen innerhalb von 15 Minuten → 15-30 Minuten Sperre. Umsetzung: zusätzliche Spalten `failedLoginCount` + `lockedUntil` auf `users`-Tabelle, oder separate `loginAttempts`-Tabelle mit TTL.

---

### 🟡 MITTEL

#### M1 — Timing-Enumeration auf `/api/auth/forgot-password`

**Datei:** [server/replit_integrations/auth/routes.ts:322-352](server/replit_integrations/auth/routes.ts#L322-L352)

Unbekannter User: sofortiger Return (~2 ms). Bekannter User: + Token-Generierung + DB-Write (~10-15 ms). Per Timing-Attack (viele Messungen) ist Email-Registrierung detektierbar. Von K3 (Rate-Limit) teil-mitigiert, aber nicht komplett.

**Empfehlung:** Gleichen Code-Pfad für beide Fälle laufen lassen (Dummy-Token generieren auch bei unbekanntem User, DB-Write in unabhängiger dummy-Tabelle oder in einer `setTimeout`-Simulation).

#### M2 — Timing-Enumeration auf `/api/auth/employee-login`

**Datei:** [server/replit_integrations/auth/routes.ts:383-420](server/replit_integrations/auth/routes.ts#L383-L420) + [server/storage.ts:565-598](server/storage.ts#L565-L598)

Drei unterschiedliche Timings: Company-nicht-gefunden (~10 ms), Employee-nicht-gefunden (~20 ms), Passwort-falsch (~50-100 ms scrypt). Kombiniert mit Rate-Limit bleibt das Risiko gering, aber nicht null.

**Empfehlung:** Wie bei `/api/auth/login/password` Dummy-Hash gegen festen Wert verifizieren, wenn Employee nicht existiert oder Company nicht passt — gleicht Timings an.

#### M3 — Supabase-RLS nicht aktiv (Defense-in-Depth-Lücke)

Tenant-Isolation ist 100 % app-level. Bei Supabase-Credential-Leak (DATABASE_URL) wären alle Tenants exponiert. Dokumentiert in [SECURITY_CHECKLIST.md:125](SECURITY_CHECKLIST.md#L125).

**Empfehlung (nicht blockend):** Nach-Launch-Aufgabe — RLS-Policies nachziehen als zweite Verteidigungslinie. Zwingt aber Umbau auf Supabase-User-Clients oder Postgres-Session-Context (`SET LOCAL app.tenant_id`). 2-3 Tage Arbeit.

#### M4 — Kein Audit-Log für Admin-Mutationen

Schon erfasst in [LAUNCH-CHECKLIST.md:87](LAUNCH-CHECKLIST.md#L87) und [SECURITY-AUDIT.md:120](SECURITY-AUDIT.md#L120). Bei Missbrauch (Insider oder kompromittierter Admin-Account) gibt es keinen Forensik-Trail.

**Empfehlung:** Einfache Tabelle `audit_logs(id, companyId, actorUserId, action, resourceType, resourceId, changes jsonb, createdAt)` + Middleware auf PATCH/DELETE/POST der Admin-Routen. Nachholbarer Launch-Ready-Task, nicht blockend.

#### M5 — `.env.example` setzt `COOKIE_SAME_SITE=lax` (Doku-Fallstrick)

**Datei:** [.env.example:18](.env.example#L18)

Der Code in [server/runtimeConfig.ts:42](server/runtimeConfig.ts#L42) würde bei *nicht gesetzter* Variable in Prod `strict` wählen. Die Beispiel-Datei setzt jedoch explizit `lax`. Wer das zur Vorlage nimmt und `NODE_ENV=production` setzt, bekommt ein schwächeres SameSite.

**Empfehlung:** In `.env.example` und `.env.staging.example` auf `COOKIE_SAME_SITE=strict` umstellen, oder die Zeile ganz kommentieren (Default greift).

---

### 🟢 NIEDRIG / INFO

#### N1 — PREVIEW_MODE-Gate ist case-sensitive

[server/preview.ts:28-33](server/preview.ts#L28-L33): `NODE_ENV !== "production"` bricht bei `NODE_ENV=Production` oder `prod`. In Prod mit vollständiger ENV aber doppelt abgesichert (DATABASE_URL + SESSION_SECRET müssen fehlen, damit PREVIEW_MODE aktiv wird). Theoretisches Risiko, kein aktuelles.

#### N2 — Password-Reset-Token: theoretische Race-Condition

[server/replit_integrations/auth/routes.ts:365-374](server/replit_integrations/auth/routes.ts#L365) nutzt keine Transaktion. Zwei Requests mit gleichem Token könnten parallel durchlaufen. Impact minimal — beide Requests kommen vom selben Token-Besitzer und setzen meist das identische Passwort. Fix: Atomic `UPDATE ... WHERE passwordResetToken = ? AND NOW() < passwordResetExpires RETURNING id`.

#### N3 — Temp-Password-Alphabet enthält `l`

[server/employeeAccess.ts:5](server/employeeAccess.ts#L5) verwendet `"ABC...abcl...xyz23456789"`. Kleine `l` vs. große `I` — UX-Problem beim Abschreiben. Nicht sicherheits-kritisch (256 Bits Gesamt-Entropie). `l`, `I`, `1`, `0`, `O` ausschließen für bessere Nutzbarkeit.

#### N4 — Session-TTL 7 Tage, kein Idle-Timeout

Bereits in Launch-Checklist erfasst. Bei geteilten Geräten (Werkstatt-PC) theoretisches Risiko.

---

## Positiv-Befunde

- ✅ **Keine IDOR:** Alle `:id`-Routen prüfen Tenant-Zugehörigkeit vor Response.
- ✅ **Keine Raw-SQL:** 100 % Drizzle-Builder, parametrisiert.
- ✅ **CSRF-Schutz:** Content-Type-Gate in [server/app.ts:76-83](server/app.ts#L76-L83) — wirksam, ohne Token nötig. Plus `SameSite=strict` in Prod (wenn ENV korrekt).
- ✅ **Zod überall:** Alle State-Mutating-Routes validieren `req.body` mit Zod.
- ✅ **Sensible Felder redacted:** `toPublicEmployee` entfernt `passwordHash`, `userId`, `loginId`, `mustChangePassword`; `toPublicCompany` entfernt `accessCode` (außer für Admins).
- ✅ **Email-Templates escapen:** `escapeHtml()` in [server/emailTemplates.ts:6-13](server/emailTemplates.ts#L6-L13) auf allen User-Input-Feldern.
- ✅ **1× `dangerouslySetInnerHTML`** ([client/src/components/ui/chart.tsx:81-98](client/src/components/ui/chart.tsx#L81-L98)) — nur CSS-Custom-Properties, kein User-Input.
- ✅ **Cross-Tenant-Blocker in Storage:** `addWorkerToAssignment`, `createTimeEntry`, `createBreakEntry` werfen explizite Errors.
- ✅ **Payload-Limit:** 512 KB in [server/app.ts:87](server/app.ts#L87).
- ✅ **Date-Range-Limit:** Max 90 Tage auf Planning-Queries — DoS-Mitigation.
- ✅ **Secrets server-only:** Kein `SESSION_SECRET`, `DATABASE_URL`, `SMTP_PASS`, `STRIPE_SECRET_KEY`, `OIDC_CLIENT_SECRET` im Client-Bundle (Vite zieht nur `VITE_`-Prefix rein, und das ist nirgends gesetzt).
- ✅ **Scrypt + timingSafeEqual** für Passwort-Verifikation.
- ✅ **Invite-Tokens SHA-256 gehasht**, Klartext nur in Mail, 14 Tage TTL.
- ✅ **Password-Reset-Tokens**: 32-Byte random, SHA-256 in DB, 1h TTL.
- ✅ **27 automatisierte Tenant-Isolation-Tests** (IDOR, Cross-Tenant-Writes).
- ✅ **Helmet** ist aktiv mit CSP, HSTS, X-Frame-Options, X-Content-Type-Options.
- ✅ **Stripe-Webhook Raw-Body** ist bereits vorbereitet: [server/app.ts:88-90](server/app.ts#L88-L90) speichert `req.rawBody` — bei späterer Stripe-Implementierung direkt nutzbar.

---

## Priorisierter Maßnahmenplan

| # | Maßnahme | Severity | Aufwand | Launch-Blocker? |
|---|---|---|---|---|
| 1 | Impressum / Datenschutzerklärung / AGB + Footer-Links | Kritisch | 1-2 Tage (+ Anwalt) | **Ja** |
| 2 | Subprocessor-Liste + AVVs unterzeichnen (Supabase, Vercel, Mail) | Kritisch | Halber Tag | **Ja** |
| 3 | Stripe: Entscheidung „mit/ohne Billing launchen", dann Dokumentation konsistent machen | Kritisch | 1 h (Entscheid) bis 1 Woche (Impl) | **Ja** |
| 4 | `npm audit fix` + Smoke-Tests | Kritisch | 2-4 h | **Ja** |
| 5 | Rate-Limiter auf `/api/auth/forgot-password`, `/api/auth/resend-verification`, `/api/company-invitations` | Kritisch | 30 min | **Ja** |
| 6 | CSP `scriptSrc`: `'unsafe-inline'` entfernen, Prod-Build testen | Kritisch | 1-2 h | **Ja** |
| 7 | Error-Handler-Logging sanitisieren | Hoch | 30 min | Empfohlen |
| 8 | `emailVerification.ts` auf Provider-Switch umstellen (oder bei SMTP belassen) | Hoch | 1-2 h | Nein (solange SMTP) |
| 9 | Email-Verifikation-Gate vor Company-Erstellung | Hoch | 2-4 h | Empfohlen |
| 10 | Account-Lockout nach N fehlgeschlagenen Logins | Hoch | 4-8 h | Nein |
| 11 | Data-Export-Endpoint (DSGVO Art. 20) | Hoch | 1 Tag | Nein (auf Anfrage zunächst manuell) |
| 12 | Timing-Angleichung forgot-password + employee-login | Mittel | 2 h | Nein |
| 13 | `COOKIE_SAME_SITE` in `.env.example` auf `strict` | Mittel | 2 min | Nein |
| 14 | Audit-Log-Tabelle + Middleware | Mittel | 1 Tag | Nein |
| 15 | RLS als zweite Verteidigungslinie | Mittel | 2-3 Tage | Nein |
| 16 | Session-Idle-Timeout | Niedrig | 2 h | Nein |
| 17 | Temp-Password-Alphabet entschärfen (`l`/`I`/`1`/`0`/`O` raus) | Niedrig | 5 min | Nein |
| 18 | PREVIEW_MODE-Gate case-insensitive + Prod-Hard-Block | Niedrig | 10 min | Nein |

---

## Anhang A — Route-Auth-Inventar (Auszug)

| Route | Methode | Middleware | Input-Validation | Tenant-Check | Status |
|---|---|---|---|---|---|
| `/api/auth/register` | POST | `authLimiter` | Zod | (public) | ✅ |
| `/api/auth/login/password` | POST | `authLimiter` | Zod + DUMMY_HASH | (public) | ✅ |
| `/api/auth/employee-login` | POST | `authLimiter` | Zod | via Company-Access-Code | ⚠️ Timing (M2) |
| `/api/auth/forgot-password` | POST | `apiLimiter`(100/min) | Zod | (public) | ❌ K3 + M1 |
| `/api/auth/resend-verification` | POST | `apiLimiter` | — | Session | ❌ K3 |
| `/api/auth/verify-email` | GET | `apiLimiter` | Token | Token-Lookup | ✅ |
| `/api/auth/reset-password` | POST | `apiLimiter` | Zod | Token-Lookup | ⚠️ N2 |
| `/api/auth/change-password` | POST | `authLimiter` + `isAuthenticated` | Zod | Session | ✅ |
| `/api/me` | GET | `isAuthenticated` | — | Session | ✅ |
| `/api/setup` | POST | `authLimiter` + `isAuthenticated` | Zod | Session | ✅ |
| `/api/jobs/*` | ALL | `requireAdmin` | Zod | `ForCompany` | ✅ |
| `/api/employees/*` | ALL | `requireAdmin` / `requireAuth` | Zod | `ForCompany` | ✅ |
| `/api/assignments/*` | ALL | `requireAuth` + Worker-Check | Zod | `ForCompany` | ✅ |
| `/api/planning/*` | ALL | `requireAdmin` | Zod | `ForCompany` | ✅ |
| `/api/time-entries/*` | ALL | `requireAuth` | Zod | Via Assignment → Company | ✅ |
| `/api/company-invitations` | POST | `requireAdmin` | Zod | Session-Company | ❌ K3 |
| `/api/invitations/:token/preview` | GET | (public) | Token | Token-Lookup | ✅ |
| `/api/invitations/:token/accept` | POST | `isAuthenticated` | — | Email-Match | ✅ |
| `/api/billing/checkout-session` | POST | (nicht implementiert) | — | — | ❌ K1 |
| `/api/billing/webhook` | POST | (nicht implementiert) | — | — | ❌ K1 |

---

## Anhang B — Verifikation nach Fixes

```bash
# Nach jeder Maßnahme:
npm run check                       # TypeScript
npm run test:tenant-security        # In-Memory IDOR-Tests (16 Assertions)
npm run test:tenant-security:db     # Live HTTP-Tests gegen DB (benötigt DATABASE_URL)
npm run test:planning-dnd           # Regression auf DnD
npm audit                           # Remaining Vulnerabilities

# Nach Deploy:
curl -I https://<app>/              # Response-Header: CSP, HSTS, X-Frame-Options
# mail-tester.com — Score ≥ 9/10 nach Mail-Provider-Wechsel
# Cookie-Inspector im Browser: HttpOnly, Secure, SameSite=Strict
```

---

## Anhang C — Einschränkungen dieses Audits

- **Keine Runtime-Tests** — es wurde weder gegen die Live-DB noch gegen Stripe-Staging gefahren. Dynamische Fehler (TOCTOU, Locking-Probleme in Prod) können nicht durch statische Analyse allein gefunden werden.
- **Keine Git-Historie-Prüfung** — Secrets in alten Commits (falls je commited) wurden nicht untersucht. Empfehlung: `git log -p | grep -iE "sk_live|re_[0-9]|[A-Za-z0-9]{40,}"` manuell. Falls Treffer: Rotation der betroffenen Secrets.
- **Keine Dependency-Transitive-Prüfung** über `npm audit` hinaus.
- **Keine DoS-/Lasttest-Simulation** — Rate-Limit-Wirksamkeit unter Last nicht gemessen.
- **Keine OIDC-Flow-Penetration** — falls `AUTH_PROVIDER=oidc` später aktiv wird, separater Audit empfohlen.

---

**Nächster Schritt:** Mit dem Maßnahmenplan oben durcharbeiten. Punkte 1-6 vor Go-Live. Bei Rückfragen zu Findings: Ticket-weise durchgehen, jeder Fix ist ein separater kleiner Commit.
