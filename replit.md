# Der Digitale Polier

  Mobile-first PWA for field service management in small craft businesses (5-15 employees) specializing in solar, heat pumps, and construction. All UI in German.

  ## Architecture

  - **Frontend**: React + Vite, TailwindCSS, shadcn/ui, wouter (routing), TanStack Query v5
  - **Backend**: Express.js (TypeScript), Drizzle ORM
  - **Database**: PostgreSQL (Replit provisioned)
  - **Auth**: Replit Auth (login with Replit)
  - **Storage**: GCS Object Storage (Replit integration) for photo uploads
  - **Port**: 5000 (Express serves both API and Vite dev server)
  - **Security**: helmet (security headers), express-rate-limit (100 req/min API, 10 req/min auth)

  ## Key Features

  1. **Multi-role auth** (admin/employee) with Replit Auth
  2. **Job management** (CRUD, categories: PV, heat pump, SHK, montage, service)
  3. **Dispatch planning board** (weekly grid: employees x days, drag & drop)
  4. **State-machine assignment workflow**: planned → en_route → on_site → break → completed (+problem branch)
  5. **Time tracking** (auto-recorded on status transitions)
  6. **Photo documentation** (client-side compression, presigned URL upload)
  7. **Problem reporting** (issue types: material_missing, customer_unavailable, technical_issue, other)
  8. **Seed data** (demo company with 7 employees, 8 jobs, 7 assignments)

  ## Security

  - All API routes protected with auth middleware (requireAuth/requireAdmin)
  - Object storage endpoints (/api/uploads/request-url, /objects/*) require authentication
  - All PATCH/mutation routes enforce company scoping (multi-tenant isolation)
  - Input validation via Zod schemas on all POST/PATCH routes (strips unknown fields)
  - Rate limiting: 100 req/min general API, 10 req/min auth endpoints
  - Security headers via helmet (CSP disabled for dev compatibility)
  - Logging stripped of response bodies (no PII leak)
  - Database indexes on all foreign keys + unique constraint on assignment_workers

  ## Data Model (shared/schema.ts)

  - **companies**: id, name, phone
  - **employees**: id, companyId, userId, firstName, lastName, phone, role (admin/employee), color, isActive
  - **jobs**: id, companyId, jobNumber, title, customerName, address fields, contact fields, category, status, dates
  - **assignments**: id, companyId, jobId, assignmentDate, plannedStartTime, plannedEndTime, status, note
  - **assignmentWorkers**: assignmentId, employeeId (many-to-many, unique constraint)
  - **timeEntries**: id, companyId, jobId, assignmentId, employeeId, timestamps, totalMinutes, status
  - **breakEntries**: id, timeEntryId, startedAt, endedAt
  - **photos**: id, companyId, jobId, assignmentId, employeeId, photoUrl, category
  - **issueReports**: id, companyId, jobId, assignmentId, employeeId, issueType, note, resolved

  ## File Structure

  ```
  shared/schema.ts          # Data model, enums, Drizzle tables, Zod schemas, DB indexes
  server/index.ts            # Express server entry point + helmet + rate limiting + seed
  server/routes.ts           # All API routes (with Zod validation + company scoping)
  server/storage.ts          # DatabaseStorage implementing IStorage interface
  server/seed.ts             # Demo data seeding
  server/db.ts               # Database connection
  client/src/App.tsx          # Root component with routing and auth
  client/src/components/      # AppShell, AssignmentCard, StatusBadge, ActionButtons, ProblemDialog, PhotoUpload, CategoryIcon, WorkerDots
  client/src/pages/           # LandingPage, SetupPage, AdminDashboard, EmployeeDayView, AssignmentDetail, PlanView, JobsList, JobDetail, CreateJob, EmployeesList, ArchiveSearch
  client/src/lib/constants.ts # German labels, status colors, category colors, formatters (formatAddress, formatTime, etc.)
  client/src/hooks/           # use-auth, use-toast, use-upload, use-mobile
  ```

  ## API Routes

  - `GET /api/me` - Current user + employee profile
  - `POST /api/setup` - First-time company + admin setup
  - `GET /api/dashboard` - Admin dashboard stats + today's assignments
  - `GET/POST /api/employees` - CRUD employees
  - `GET/POST /api/jobs` - CRUD jobs
  - `GET /api/jobs/unassigned` - Jobs without assignments
  - `GET/POST /api/assignments` - CRUD assignments (with date range query params)
  - `GET /api/assignments/my` - Employee's own assignments
  - `POST /api/assignments/:id/{start-travel,arrive,start-break,end-break,complete,report-problem,resume}` - Status transitions
  - `POST /api/photos` - Create photo record
  - `GET /api/photos/job/:jobId` - Photos by job
  - `GET /api/issues/job/:jobId` - Issues by job
  - `GET /api/time-entries/job/:jobId` - Time entries by job

  ## Status Colors

  - Blue = planned, Amber = en_route, Green = on_site/completed, Red = problem, Gray = break

  ## Category Colors

  - PV = yellow (#eab308), Heat Pump = red (#ef4444), SHK = blue (#3b82f6), Montage = violet (#8b5cf6), Service = cyan (#06b6d4)
  