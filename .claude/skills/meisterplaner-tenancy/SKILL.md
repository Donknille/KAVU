# meisterplaner-tenancy

## Wann zu nutzen

Wenn ein neuer Datenbankzugriff geschrieben wird, eine Migration eine neue Tabelle erstellt, oder eine API-Route Tenant-Daten liest oder schreibt.

## Goldene Regel

KAVU ist Multi-Tenant. Jede geschäftsrelevante Tabelle hat **`companyId`** als Fremdschlüssel auf `companies(id)`. Jeder Datenzugriff muss `companyId` aus dem Session-Kontext (`req.companyId`) ableiten, **nie aus User-Input**.

## Anti-Patterns (verboten)

```ts
// ❌ companyId aus Body
const { companyId, ... } = req.body;
await storage.getJobsByCompany(companyId);

// ❌ companyId aus Query-Param
const companyId = req.query.companyId;

// ❌ Naked Query ohne companyId-Filter
const job = await storage.getJob(id);  // wenn das an Route exponiert wird
```

## Korrekte Patterns

```ts
// ✅ companyId aus authentifizierter Session
app.get(
  "/api/jobs/:id",
  isAuthenticated,
  requireAuth,  // setzt req.companyId aus DB-Lookup via Employee
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const job = await storage.getJobForCompany(req.companyId, req.params.id);
    if (!job) return res.status(404).json({ message: "Not found" });
    res.json(job);
  }),
);
```

## Storage-Layer-Konvention

- `getXForCompany(companyId, id)` — sicher, öffentlich aus Routen aufrufbar
- `getX(id)` — privat, nur intern, nie aus Routen exponieren
- `updateX(companyId, id, data)` — `companyId` ist immer erstes Argument

## Migration-Template für neue Tabelle

```sql
CREATE TABLE public.<tablename> (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- weitere Spalten
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX ix_<tablename>_company ON public.<tablename> (company_id);
```

In Drizzle-Schema (`shared/schema.ts`) entsprechend:

```ts
export const <tablename> = pgTable("<tablename>", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  // ...
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("ix_<tablename>_company_id").on(table.companyId),
]);
```

## Cross-Tenant-Blocker (Defense-in-Depth)

Storage-Methoden, die FK-Validierung über mehrere Tenants brauchen (z.B. Worker einem Assignment hinzufügen, das einer Company gehört, mit einem Employee einer anderen Company), müssen explizit prüfen und werfen:

```ts
const [assignment, employee] = await Promise.all([
  this.getAssignmentForCompany(data.companyId, data.assignmentId),
  this.getEmployeeForCompany(data.companyId, data.employeeId),
]);
if (!assignment || !employee) {
  throw new Error("Cross-tenant worker assignment blocked");
}
```

Referenz: `server/storage.ts:1190-1201`, `1260-1270`, `1294-1309`.

## Test-Verpflichtung

Jede neue tenant-scoped Route bekommt einen Eintrag in:
- `script/tenant-security-smoke.ts` (In-Memory-Cross-Tenant-Test)
- `script/tenant-security-db-smoke.ts` (Live-HTTP-Cross-Tenant-Test, 404 für Other-Tenant-Ressourcen)

Tests müssen vor Merge grün sein:
```bash
npm run test:tenant-security
npm run test:tenant-security:db
```

## RLS — geplant, aber nicht aktiv

Aktuell ist Tenant-Isolation 100% app-level. RLS ist als T-103 in `docs/implementation-plan.md` als Defense-in-Depth-Folgeticket erfasst, aber **bis dahin gilt:** jeder DB-Call muss app-seitig `companyId` filtern, sonst Leak.

## Referenzdateien

- `CLAUDE.md` (Repo-Root) — unveränderliche Regeln für DnD/Storage
- `SECURITY_AUDIT_REPORT.md` — Tenant-Matrix mit allen Tabellen + Storage-Pattern-Audit
- `server/routes.ts` — `requireAuth` und `requireAdmin` Middleware
- `server/storage.ts` — alle `getXForCompany`-Methoden
