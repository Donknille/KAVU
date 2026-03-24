# Meisterplaner — Entwicklungsrichtlinien

## DnD-Architektur — UNVERAENDERLICHE REGELN

Diese Regeln gelten fuer JEDE Aenderung an der Planungsansicht.
Verstoss gegen eine dieser Regeln hat in der Vergangenheit zu
kritischen Bugs gefuehrt die einen kompletten Rollback erforderten.

### 1. Drop-Zone IDs muessen global eindeutig sein
- `day:${date}` darf nur EINMAL im gesamten DOM existieren
- Fuer per-Employee Zonen: `employee-day:${employeeId}:${date}`
- dnd-kit kann nicht mit doppelten IDs umgehen — der Drop
  landet auf dem ERSTEN Element im DOM, nicht dem naechsten

### 2. Zwei-Schichten-Architektur (nicht verhandelbar)
- **Schicht 1**: Per-Employee Drop-Zones (`employee-day:*`)
  → Aktiv NUR bei Job-Drags (`activeDrag.type === "job"`)
  → Liefern `{ dropType: "employee-day", employeeId, date }`
- **Schicht 2**: Globales Day-Overlay (`day:*`)
  → Aktiv NUR bei Resize + Move (`activeDrag.type !== "job"`)
  → Liefern `{ dropType: "day", date }`
- NIEMALS beide gleichzeitig `pointer-events-auto` setzen

### 3. z-Index Hierarchie
- Bloecke (PlanningBlockCard): z-10
- Resize-Handles auf Bloecken: z-15 (muessen IMMER greifbar sein)
- Drop-Zone Overlay (aktive Schicht): z-20
- Drag-Overlay (schwebendes Element): z-50
- REGEL: Resize-Handles duerfen NIEMALS von einem Overlay verdeckt
  werden. Das Overlay darf nur `pointer-events-auto` haben wenn
  der Drag BEREITS laeuft (nicht vorher).

### 4. Nach jeder Mutation: refreshPlanningBoard()
- KEIN manuelles Cache-Patching fuer Employee-Rows
- `refreshPlanningBoard()` holt den kompletten Server-State
- `buildEmployeePlanRows()` berechnet die Zeilen aus dem
  frischen Server-Response — das ist die Single Source of Truth
- Optimistisches Cache-Update nur fuer Backlog-Entfernung

### 5. Resize-Datum kommt aus dragOverDate
- `handleDragOver` setzt `dragOverDate` bei jedem Hover
- `handleDragEnd` nutzt `dragOverDate` als primaere Quelle
- NICHT aus `event.over` — das kann ein Block-Target sein
  das ein anderes Datum liefert als der visuelle Cursor zeigt

### 6. Vor JEDEM Commit pruefen
```bash
npm run check && npm run test:planning-dnd
```
- 16 Tests muessen bestehen (inkl. Lane-Allocation fuer 3/5/10 Bloecke)
- Visuell testen: Drop, Resize, Move bei ERSTEM und LETZTEM Mitarbeiter

### 7. NIEMALS diese Dateien gleichzeitig refactoren
- `usePlanningBoard.ts` (State + Handlers)
- `PlanView.tsx` (Layout + Drop-Zones)
- `dnd.ts` (Collision Detection)
- `derived.ts` (Row-Berechnung)
Eine Datei pro Commit. Jeder Commit muss fuer sich funktionieren.

## Kritische Dateien

| Datei | Verantwortung |
|---|---|
| `client/src/features/planning/usePlanningBoard.ts` | DnD State, Drag-Handlers, API-Calls |
| `client/src/pages/PlanView.tsx` | Layout, Drop-Zones, Employee-Grids |
| `client/src/features/planning/dnd.ts` | Collision Detection, Drop-Date-Resolution |
| `client/src/features/planning/derived.ts` | Employee-Row-Berechnung, Block-Zuweisung |
| `client/src/features/planning/components.tsx` | PlanningBlockCard, DayColumnDropZone |
| `shared/planningBoard.ts` | buildPlanningBlocks (Lane-Algorithmus) |

## Test-Befehle

```bash
npm run check                    # TypeScript
npm run test:planning-dnd        # 16 DnD + Lane-Tests
npm run test:tenant-security     # Tenant-Isolation
npm run verify:production        # Alles + Build
```

## Tech-Stack

- Frontend: React 18, Vite, TanStack Query, @dnd-kit/core + sortable, shadcn/ui, Tailwind
- Backend: Express 5, TypeScript (ESM), Drizzle ORM, PostgreSQL (Supabase)
- Auth: App-Auth (local), konfigurierbar via AUTH_PROVIDER
- Email: SMTP (Gmail) / Resend — konfigurierbar via INVITATION_EMAIL_PROVIDER
- Deployment: Vercel (server.ts als Einstiegspunkt)
