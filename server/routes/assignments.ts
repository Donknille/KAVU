import type { Express, Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { asyncHandler } from "../asyncHandler.js";
import type { AuthenticatedRequest } from "../types.js";
import { invalidateCompanyReadCaches } from "../readCaches.js";
import { requireNotFrozen } from "../billing.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import {
  insertAssignmentSchema,
} from "../../shared/schema.js";
import { toDateStr } from "../../shared/dates.js";
import { toPublicEmployee } from "./employees.js";

const assignmentDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const MAX_DATE_RANGE_DAYS = 90;

const dateRangeSchema = z.object({
  startDate: assignmentDateSchema,
  endDate: assignmentDateSchema,
}).refine(({ startDate, endDate }) => {
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  return ms >= 0 && ms <= MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000;
}, { message: `Datumsbereich darf maximal ${MAX_DATE_RANGE_DAYS} Tage umfassen.` });

function toPublicAssignment(assignment: any) {
  if (!assignment) {
    return assignment;
  }

  return {
    ...assignment,
    worker: assignment.worker ? toPublicEmployee(assignment.worker) : assignment.worker,
    workers: Array.isArray(assignment.workers)
      ? assignment.workers.map((worker: any) => toPublicEmployee(worker))
      : assignment.workers,
    employee: assignment.employee ? toPublicEmployee(assignment.employee) : assignment.employee,
  };
}

async function isEmployeeAssignedToAssignment(
  companyId: string,
  employeeId: string,
  assignmentId: string,
) {
  const workers = await storage.getWorkersForAssignment(companyId, assignmentId);
  return workers.some((worker) => worker.id === employeeId);
}

async function getAuthorizedAssignment(
  req: AuthenticatedRequest,
  res: Response,
  assignmentId: string,
  options: { requireWorker?: boolean } = {},
) {
  const assignment = await storage.getAssignmentForCompany(req.companyId, assignmentId);
  if (!assignment) {
    res.status(404).json({ message: "Not found" });
    return null;
  }

  if (options.requireWorker && req.employee.role !== "admin") {
    const isAssigned = await isEmployeeAssignedToAssignment(
      req.companyId,
      req.employee.id,
      assignment.id,
    );
    if (!isAssigned) {
      res.status(403).json({ message: "Forbidden" });
      return null;
    }
  }

  return assignment;
}

async function getCompanyAssignments(companyId: string, assignmentIds: string[]) {
  const uniqueIds = [...new Set(assignmentIds)];
  return Promise.all(uniqueIds.map((assignmentId) => storage.getAssignmentForCompany(companyId, assignmentId)));
}

export function registerAssignmentRoutes(
  app: Express,
  requireAdmin: (req: any, res: any, next: any) => void,
  requireAuth: (req: any, res: any, next: any) => void,
) {
  app.get(
    "/api/assignments",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { date, startDate, endDate } = req.query;

      if (date) {
        const dateCheck = assignmentDateSchema.safeParse(date);
        if (!dateCheck.success) {
          return res.status(400).json({ message: "Ungültiges Datumsformat. Erwartet: YYYY-MM-DD" });
        }
        const list = await storage.getAssignmentsByDate(req.companyId, dateCheck.data);
        return res.json(list.map(toPublicAssignment));
      }

      if (startDate && endDate) {
        const rangeCheck = dateRangeSchema.safeParse({ startDate, endDate });
        if (!rangeCheck.success) {
          return res.status(400).json({ message: rangeCheck.error.issues[0]?.message ?? "Ungültiger Datumsbereich." });
        }
        const list = await storage.getAssignmentsByDateRange(
          req.companyId,
          rangeCheck.data.startDate,
          rangeCheck.data.endDate,
        );
        return res.json(list.map(toPublicAssignment));
      }

      const today = toDateStr(new Date());
      const list = await storage.getAssignmentsByDate(req.companyId, today);
      res.json(list.map(toPublicAssignment));
    }),
  );

  app.get(
    "/api/assignments/my",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { date, startDate, endDate } = req.query;

      if (startDate && endDate) {
        const rangeCheck = dateRangeSchema.safeParse({ startDate, endDate });
        if (!rangeCheck.success) {
          return res.status(400).json({ message: rangeCheck.error.issues[0]?.message ?? "Ungültiger Datumsbereich." });
        }
        const list = await storage.getAssignmentsByEmployee(
          req.companyId,
          req.employee.id,
          rangeCheck.data.startDate,
          rangeCheck.data.endDate,
        );
        return res.json(list.map(toPublicAssignment));
      }

      if (date) {
        const dateCheck = assignmentDateSchema.safeParse(date);
        if (!dateCheck.success) {
          return res.status(400).json({ message: "Ungültiges Datumsformat. Erwartet: YYYY-MM-DD" });
        }
        const list = await storage.getAssignmentsByEmployee(req.companyId, req.employee.id, dateCheck.data);
        return res.json(list.map(toPublicAssignment));
      }

      const list = await storage.getAssignmentsByEmployee(
        req.companyId,
        req.employee.id,
        toDateStr(new Date()),
      );
      res.json(list.map(toPublicAssignment));
    }),
  );

  app.get(
    "/api/assignments/:id",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      const job = await storage.getJobForCompany(req.companyId, assignment.jobId);
      const workers = await storage.getWorkersForAssignment(req.companyId, assignment.id);
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        assignment.id,
        req.employee.id,
      );
      const breaksList = timeEntry
        ? await storage.getBreakEntriesByTimeEntry(req.companyId, timeEntry.id)
        : [];
      res.json({
        ...assignment,
        job,
        workers: workers.map((worker) => toPublicEmployee(worker)),
        timeEntry,
        breaks: breaksList,
      });
    }),
  );

  app.post(
    "/api/assignments",
    isAuthenticated,
    requireAdmin,
    requireNotFrozen(storage),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const assignmentBodySchema = insertAssignmentSchema.omit({ companyId: true }).extend({
        workerIds: z.array(z.string().uuid()).optional(),
      });
      const parsed = assignmentBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const { workerIds, ...data } = parsed.data;
      const job = await storage.getJobForCompany(req.companyId, data.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (workerIds) {
        for (const workerId of workerIds) {
          const employee = await storage.getEmployeeForCompany(req.companyId, workerId);
          if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
          }
        }
      }

      const assignment = await storage.createAssignment({
        ...data,
        companyId: req.companyId,
      });
      if (workerIds && Array.isArray(workerIds)) {
        for (const wId of workerIds) {
          await storage.addWorkerToAssignment({
            companyId: req.companyId,
            assignmentId: assignment.id,
            employeeId: wId,
          });
        }
      }
      invalidateCompanyReadCaches(req.companyId);
      res.json(assignment);
    }),
  );

  app.patch(
    "/api/assignments/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const existing = await storage.getAssignmentForCompany(req.companyId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const allowedFields = insertAssignmentSchema.omit({ companyId: true }).partial();
      const parsed = allowedFields.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      if (parsed.data.jobId) {
        const job = await storage.getJobForCompany(req.companyId, parsed.data.jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }
      }
      const assignment = await storage.updateAssignment(req.companyId, req.params.id, parsed.data);
      if (!assignment) return res.status(404).json({ message: "Not found" });
      invalidateCompanyReadCaches(req.companyId);
      res.json(assignment);
    }),
  );

  app.post(
    "/api/assignments/:id/workers",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const existing = await storage.getAssignmentForCompany(req.companyId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const employeeIdSchema = z.object({ employeeId: z.string().uuid() });
      const parsed = employeeIdSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const employee = await storage.getEmployeeForCompany(req.companyId, parsed.data.employeeId);
      if (!employee) return res.status(404).json({ message: "Employee not found" });
      await storage.addWorkerToAssignment({
        companyId: req.companyId,
        assignmentId: req.params.id,
        employeeId: parsed.data.employeeId,
      });
      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/assignments/:id/workers/:employeeId",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const existing = await storage.getAssignmentForCompany(req.companyId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      await storage.removeWorkerFromAssignment(req.companyId, req.params.id, req.params.employeeId);
      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/assignments/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const existing = await storage.getAssignmentForCompany(req.companyId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.status !== "planned") {
        return res.status(400).json({ message: "Nur geplante Einsätze können gelöscht werden" });
      }
      await storage.deleteAssignment(req.companyId, req.params.id);
      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );

  // ── Assignment status transitions ─────────────────────────────────────────

  app.post(
    "/api/assignments/:id/start-travel",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "planned") {
        return res.status(400).json({ message: "Invalid status transition" });
      }

      await storage.updateAssignment(req.companyId, req.params.id, { status: "en_route" });

      let timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id,
      );
      if (!timeEntry) {
        timeEntry = await storage.createTimeEntry({
          companyId: req.companyId,
          jobId: assignment.jobId,
          assignmentId: req.params.id,
          employeeId: req.employee.id,
          startedAt: new Date(),
          status: "en_route",
        });
      } else {
        timeEntry = await storage.updateTimeEntry(req.companyId, timeEntry.id, {
          startedAt: new Date(),
          status: "en_route",
        });
      }

      const job = await storage.getJobForCompany(req.companyId, assignment.jobId);
      if (job && job.status === "planned") {
        await storage.updateJob(req.companyId, job.id, { status: "in_progress" });
      }

      invalidateCompanyReadCaches(req.companyId);
      res.json({ assignment: { ...assignment, status: "en_route" }, timeEntry });
    }),
  );

  app.post(
    "/api/assignments/:id/start-work",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "planned" && assignment.status !== "en_route") {
        return res.status(400).json({ message: "Invalid status transition" });
      }

      await storage.updateAssignment(req.companyId, req.params.id, { status: "on_site" });

      const now = new Date();
      let timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id,
      );
      if (!timeEntry) {
        timeEntry = await storage.createTimeEntry({
          companyId: req.companyId,
          jobId: assignment.jobId,
          assignmentId: req.params.id,
          employeeId: req.employee.id,
          startedAt: now,
          arrivedAt: now,
          status: "on_site",
        });
      } else {
        timeEntry = await storage.updateTimeEntry(req.companyId, timeEntry.id, {
          startedAt: timeEntry.startedAt ?? now,
          arrivedAt: timeEntry.arrivedAt ?? now,
          endedAt: null,
          totalMinutes: null,
          status: "on_site",
        });
      }

      const job = await storage.getJobForCompany(req.companyId, assignment.jobId);
      if (job && job.status === "planned") {
        await storage.updateJob(req.companyId, job.id, { status: "in_progress" });
      }

      invalidateCompanyReadCaches(req.companyId);
      res.json({ assignment: { ...assignment, status: "on_site" }, timeEntry });
    }),
  );

  app.post(
    "/api/assignments/:id/arrive",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "en_route") {
        return res.status(400).json({ message: "Invalid status transition" });
      }

      await storage.updateAssignment(req.companyId, req.params.id, { status: "on_site" });
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id,
      );
      if (timeEntry) {
        await storage.updateTimeEntry(req.companyId, timeEntry.id, {
          arrivedAt: new Date(),
          status: "on_site",
        });
      }
      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/assignments/:id/start-break",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "on_site") {
        return res.status(400).json({ message: "Invalid status transition" });
      }

      await storage.updateAssignment(req.companyId, req.params.id, { status: "break" });
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id,
      );
      if (timeEntry) {
        await storage.updateTimeEntry(req.companyId, timeEntry.id, { status: "break" });
        await storage.createBreakEntry(req.companyId, timeEntry.id);
      }
      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/assignments/:id/end-break",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "break") {
        return res.status(400).json({ message: "Invalid status transition" });
      }

      await storage.updateAssignment(req.companyId, req.params.id, { status: "on_site" });
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id,
      );
      if (timeEntry) {
        await storage.updateTimeEntry(req.companyId, timeEntry.id, { status: "on_site" });
        await storage.endBreakEntry(req.companyId, timeEntry.id);
      }
      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/assignments/:id/complete",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "on_site" && assignment.status !== "break") {
        return res.status(400).json({ message: "Invalid status transition" });
      }

      await storage.updateAssignment(req.companyId, req.params.id, { status: "completed" });
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id,
      );
      if (timeEntry) {
        const now = new Date();
        const breaksList = await storage.getBreakEntriesByTimeEntry(req.companyId, timeEntry.id);
        const totalBreakMins = breaksList.reduce(
          (sum, b) => sum + (b.durationMinutes || 0),
          0,
        );
        const startTime = timeEntry.startedAt || now;
        const totalMins =
          Math.round((now.getTime() - startTime.getTime()) / 60000) - totalBreakMins;
        await storage.updateTimeEntry(req.companyId, timeEntry.id, {
          endedAt: now,
          totalMinutes: Math.max(0, totalMins),
          status: "completed",
        });
      }
      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );

  // ── Time Entries ──────────────────────────────────────────────────────────

  app.get(
    "/api/time-entries/job/:jobId",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const job = await storage.getJobForCompany(req.companyId, req.params.jobId);
      if (!job) return res.status(404).json({ message: "Not found" });
      const entries = await storage.getTimeEntriesByJob(req.companyId, req.params.jobId);
      const enriched = [];
      for (const entry of entries) {
        const employee = await storage.getEmployeeForCompany(req.companyId, entry.employeeId);
        const breaks = await storage.getBreakEntriesByTimeEntry(req.companyId, entry.id);
        enriched.push({ ...entry, employee: toPublicEmployee(employee), breaks });
      }
      res.json(enriched);
    }),
  );
}

export { getCompanyAssignments, toPublicAssignment };
