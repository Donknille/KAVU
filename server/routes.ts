import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import {
  insertEmployeeSchema,
  insertJobSchema,
  insertAssignmentSchema,
  insertPhotoSchema,
  insertIssueReportSchema,
} from "../shared/schema.ts";
import {
  createPlanningBoardReadModel,
  getPlanningDaysInRange,
} from "../shared/planningBoard.ts";
import {
  PREVIEW_ADMIN_EMPLOYEE_ID,
  PREVIEW_COMPANY_ID,
  PREVIEW_EMPLOYEE_COOKIE,
  PREVIEW_EMPLOYEE_HEADER,
  PREVIEW_MODE,
  getCookieValue,
  normalizePreviewEmployeeToken,
  toPreviewEmployeeSlug,
} from "./preview";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const setupSchema = z.object({
  companyName: z.string().min(1).max(255),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(50).optional(),
});

const assignmentDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const batchAssignWorkersSchema = z.object({
  assignmentIds: z.array(z.string().uuid()).min(1),
  employeeId: z.string().uuid(),
  mode: z.enum(["add", "remove"]),
});
const moveBlockSchema = z.object({
  updates: z
    .array(
      z.object({
        assignmentId: z.string().uuid(),
        assignmentDate: assignmentDateSchema,
      })
    )
    .min(1),
});
const resizeBlockSchema = z
  .object({
    removeAssignmentIds: z.array(z.string().uuid()).default([]),
    createAssignments: z
      .array(
        insertAssignmentSchema
          .omit({ companyId: true })
          .extend({ workerIds: z.array(z.string().uuid()).optional() })
      )
      .default([]),
  })
  .refine(
    (value) => value.removeAssignmentIds.length > 0 || value.createAssignments.length > 0,
    { message: "Mindestens eine Aenderung ist erforderlich." }
  );
const removeBlockSchema = z.object({
  assignmentIds: z.array(z.string().uuid()).min(1),
});

async function getEmployeeFromReq(req: any) {
  if (PREVIEW_MODE) {
    const previewEmployeeToken =
      normalizePreviewEmployeeToken(req.headers?.[PREVIEW_EMPLOYEE_HEADER]) ??
      getCookieValue(
      req.headers?.cookie,
      PREVIEW_EMPLOYEE_COOKIE,
    );

    if (previewEmployeeToken) {
      if (previewEmployeeToken === "admin") {
        const adminEmployee = await storage.getEmployee(PREVIEW_ADMIN_EMPLOYEE_ID);
        if (adminEmployee) {
          return adminEmployee;
        }
      }

      const previewEmployee = await storage.getEmployee(previewEmployeeToken);
      if (previewEmployee) {
        return previewEmployee;
      }

      const previewEmployees = await storage.getEmployeesByCompany(PREVIEW_COMPANY_ID);
      const previewEmployeeBySlug = previewEmployees.find(
        (employee) =>
          employee.isActive !== false &&
          toPreviewEmployeeSlug(employee.firstName, employee.lastName) === previewEmployeeToken,
      );
      if (previewEmployeeBySlug) {
        return previewEmployeeBySlug;
      }
    }
  }

  const userId = req.user?.claims?.sub;
  if (!userId) return null;
  return storage.getEmployeeByUserId(userId);
}

async function ensureCompany(req: any) {
  const employee = await getEmployeeFromReq(req);
  if (!employee) return null;
  return { employee, companyId: employee.companyId };
}

function requireAdmin(req: any, res: any, next: any) {
  (async () => {
    const ctx = await ensureCompany(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    if (ctx.employee.role !== "admin")
      return res.status(403).json({ message: "Forbidden" });
    (req as any).companyId = ctx.companyId;
    (req as any).employee = ctx.employee;
    next();
  })();
}

function requireAuth(req: any, res: any, next: any) {
  (async () => {
    const ctx = await ensureCompany(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    (req as any).companyId = ctx.companyId;
    (req as any).employee = ctx.employee;
    next();
  })();
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
  req: any,
  res: any,
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app);

  app.get("/api/me", isAuthenticated, async (req: any, res) => {
    try {
      const employee = await getEmployeeFromReq(req);
      if (!employee) {
        return res.json({ employee: null, company: null, needsSetup: true });
      }
      const company = await storage.getCompany(employee.companyId);
      return res.json({ employee, company, needsSetup: false });
    } catch (error) {
      console.error("Error in /api/me:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const existing = await storage.getEmployeeByUserId(userId);
      if (existing) {
        return res.json({ employee: existing });
      }
      const parsed = setupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const { companyName, firstName, lastName, phone } = parsed.data;
      const company = await storage.createCompany({ name: companyName });
      const employee = await storage.createEmployee({
        companyId: company.id,
        userId,
        firstName,
        lastName,
        phone,
        role: "admin",
        isActive: true,
      });
      return res.json({ employee, company });
    } catch (error) {
      console.error("Error in /api/setup:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/dashboard", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getDashboardStats(req.companyId);
      const today = toDateStr(new Date());
      const todayAssignments = await storage.getAssignmentsByDate(req.companyId, today);
      const unassigned = await storage.getUnassignedJobs(req.companyId);
      res.json({ stats, todayAssignments, unassignedJobs: unassigned });
    } catch (error) {
      console.error("Error in /api/dashboard:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/planning/board", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const parsed = z
        .object({
          startDate: assignmentDateSchema,
          endDate: assignmentDateSchema,
        })
        .safeParse({
          startDate: req.query.startDate,
          endDate: req.query.endDate,
        });

      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const [employeesList, backlogJobs, planningAssignments] = await Promise.all([
        storage.getEmployeesByCompany(req.companyId),
        storage.getUnassignedJobs(req.companyId),
        storage.getAssignmentsByDateRange(
          req.companyId,
          parsed.data.startDate,
          parsed.data.endDate
        ),
      ]);

      const visibleDays = getPlanningDaysInRange(parsed.data.startDate, parsed.data.endDate);

      res.json(
        createPlanningBoardReadModel(
          {
            employees: employeesList,
            backlogJobs,
            assignments: planningAssignments,
          },
          visibleDays
        )
      );
    } catch (error) {
      console.error("Error in /api/planning/board:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/employees", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const list = await storage.getEmployeesByCompany(req.companyId);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/employees", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertEmployeeSchema.omit({ companyId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const employee = await storage.createEmployee({
        ...parsed.data,
        companyId: req.companyId,
      });
      res.json(employee);
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch("/api/employees/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const existing = await storage.getEmployeeForCompany(req.companyId, req.params.id);
      if (!existing)
        return res.status(404).json({ message: "Not found" });
      const parsed = insertEmployeeSchema.omit({ companyId: true }).partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const employee = await storage.updateEmployee(req.params.id, parsed.data);
      if (!employee) return res.status(404).json({ message: "Not found" });
      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/jobs", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const includeArchived = req.query.archived === "true";
      const list = await storage.getJobsByCompany(req.companyId, includeArchived);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/jobs/unassigned", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const list = await storage.getUnassignedJobs(req.companyId);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/jobs/search", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const q = (req.query.q as string) || "";
      const list = await storage.searchJobs(req.companyId, q);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/jobs/:id", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getJobForCompany(req.companyId, req.params.id);
      if (!job)
        return res.status(404).json({ message: "Not found" });
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/jobs", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = insertJobSchema
        .omit({ companyId: true, createdBy: true, jobNumber: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const job = await storage.createJob({
        ...parsed.data,
        companyId: req.companyId,
        createdBy: req.employee.userId,
      });
      res.json(job);
    } catch (error) {
      console.error("Error creating job:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch("/api/jobs/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const existing = await storage.getJobForCompany(req.companyId, req.params.id);
      if (!existing)
        return res.status(404).json({ message: "Not found" });
      const parsed = insertJobSchema
        .omit({ companyId: true, createdBy: true, jobNumber: true })
        .partial()
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const job = await storage.updateJob(req.params.id, parsed.data);
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/assignments", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const { date, startDate, endDate } = req.query;
      if (date) {
        const list = await storage.getAssignmentsByDate(req.companyId, date as string);
        return res.json(list);
      }
      if (startDate && endDate) {
        const list = await storage.getAssignmentsByDateRange(
          req.companyId,
          startDate as string,
          endDate as string
        );
        return res.json(list);
      }
      const today = toDateStr(new Date());
      const list = await storage.getAssignmentsByDate(req.companyId, today);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/assignments/my", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const date = req.query.date as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const list = startDate && endDate
        ? await storage.getAssignmentsByEmployee(req.companyId, req.employee.id, startDate, endDate)
        : await storage.getAssignmentsByEmployee(
            req.companyId,
            req.employee.id,
            date || toDateStr(new Date())
          );
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/assignments/:id", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      const job = await storage.getJobForCompany(req.companyId, assignment.jobId);
      const workers = await storage.getWorkersForAssignment(req.companyId, assignment.id);
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        assignment.id,
        req.employee.id
      );
      const breaksList = timeEntry
        ? await storage.getBreakEntriesByTimeEntry(req.companyId, timeEntry.id)
        : [];
      const photosList = await storage.getPhotosByAssignment(req.companyId, assignment.id);
      const issues = await storage.getIssueReportsByAssignment(req.companyId, assignment.id);
      res.json({
        ...assignment,
        job,
        workers,
        timeEntry,
        breaks: breaksList,
        photos: photosList,
        issues,
      });
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/assignments", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
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
      res.json(assignment);
    } catch (error) {
      console.error("Error creating assignment:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch("/api/assignments/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const existing = await storage.getAssignmentForCompany(req.companyId, req.params.id);
      if (!existing)
        return res.status(404).json({ message: "Not found" });
      const allowedFields = insertAssignmentSchema.omit({ companyId: true }).partial();
      const parsed = allowedFields.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      const { companyId, ...safeData } = parsed.data as any;
      if (safeData.jobId) {
        const job = await storage.getJobForCompany(req.companyId, safeData.jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }
      }
      const assignment = await storage.updateAssignment(req.params.id, safeData);
      if (!assignment) return res.status(404).json({ message: "Not found" });
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/assignments/:id/workers", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const existing = await storage.getAssignmentForCompany(req.companyId, req.params.id);
      if (!existing)
        return res.status(404).json({ message: "Not found" });
      const employeeIdSchema = z.object({ employeeId: z.string().uuid() });
      const parsed = employeeIdSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      const employee = await storage.getEmployeeForCompany(req.companyId, parsed.data.employeeId);
      if (!employee)
        return res.status(404).json({ message: "Employee not found" });
      await storage.addWorkerToAssignment({
        companyId: req.companyId,
        assignmentId: req.params.id,
        employeeId: parsed.data.employeeId,
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(
    "/api/assignments/:id/workers/:employeeId",
    isAuthenticated,
    requireAdmin,
    async (req: any, res) => {
      try {
        const existing = await storage.getAssignmentForCompany(req.companyId, req.params.id);
        if (!existing)
          return res.status(404).json({ message: "Not found" });
        await storage.removeWorkerFromAssignment(req.companyId, req.params.id, req.params.employeeId);
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ message: "Internal error" });
      }
    }
  );

  app.delete("/api/assignments/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const existing = await storage.getAssignmentForCompany(req.companyId, req.params.id);
      if (!existing)
        return res.status(404).json({ message: "Not found" });
      if (existing.status !== "planned")
        return res.status(400).json({ message: "Nur geplante Einsätze können gelöscht werden" });
      await storage.deleteAssignment(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/planning/assign-workers", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = batchAssignWorkersSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const employee = await storage.getEmployeeForCompany(req.companyId, parsed.data.employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const assignmentsForCompany = await getCompanyAssignments(
        req.companyId,
        parsed.data.assignmentIds
      );
      if (assignmentsForCompany.some((assignment) => !assignment)) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      for (const assignment of assignmentsForCompany) {
        if (!assignment) {
          continue;
        }

        if (parsed.data.mode === "add") {
          await storage.addWorkerToAssignment({
            companyId: req.companyId,
            assignmentId: assignment.id,
            employeeId: parsed.data.employeeId,
          });
          continue;
        }

        await storage.removeWorkerFromAssignment(
          req.companyId,
          assignment.id,
          parsed.data.employeeId
        );
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Error assigning workers in batch:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/planning/move-block", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = moveBlockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const assignmentsForCompany = await getCompanyAssignments(
        req.companyId,
        parsed.data.updates.map((update) => update.assignmentId)
      );
      if (assignmentsForCompany.some((assignment) => !assignment)) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      for (const update of parsed.data.updates) {
        await storage.updateAssignment(update.assignmentId, {
          assignmentDate: update.assignmentDate,
        });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Error moving planning block:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/planning/resize-block", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = resizeBlockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      if (parsed.data.removeAssignmentIds.length > 0) {
        const assignmentsForCompany = await getCompanyAssignments(
          req.companyId,
          parsed.data.removeAssignmentIds
        );
        if (assignmentsForCompany.some((assignment) => !assignment)) {
          return res.status(404).json({ message: "Assignment not found" });
        }
        const protectedAssignment = assignmentsForCompany.find(
          (assignment) => assignment && assignment.status !== "planned"
        );
        if (protectedAssignment) {
          return res.status(400).json({
            message: "Nur geplante Einsaetze koennen entfernt werden",
          });
        }
      }

      for (const createInput of parsed.data.createAssignments) {
        const job = await storage.getJobForCompany(req.companyId, createInput.jobId);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }
        if (createInput.workerIds) {
          for (const workerId of createInput.workerIds) {
            const employee = await storage.getEmployeeForCompany(req.companyId, workerId);
            if (!employee) {
              return res.status(404).json({ message: "Employee not found" });
            }
          }
        }
      }

      for (const assignmentId of parsed.data.removeAssignmentIds) {
        await storage.deleteAssignment(assignmentId);
      }

      const createdAssignments = [];

      for (const createInput of parsed.data.createAssignments) {
        const { workerIds, ...assignmentData } = createInput;
        const assignment = await storage.createAssignment({
          ...assignmentData,
          companyId: req.companyId,
        });

        for (const workerId of workerIds ?? []) {
          await storage.addWorkerToAssignment({
            companyId: req.companyId,
            assignmentId: assignment.id,
            employeeId: workerId,
          });
        }

        createdAssignments.push(assignment);
      }

      res.json({ ok: true, createdAssignments });
    } catch (error) {
      console.error("Error resizing planning block:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/planning/remove-block", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = removeBlockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const assignmentsForCompany = await getCompanyAssignments(
        req.companyId,
        parsed.data.assignmentIds
      );
      if (assignmentsForCompany.some((assignment) => !assignment)) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      const protectedAssignment = assignmentsForCompany.find(
        (assignment) => assignment && assignment.status !== "planned"
      );
      if (protectedAssignment) {
        return res.status(400).json({
          message: "Nur komplett geplante Auftraege koennen entfernt werden",
        });
      }

      for (const assignmentId of parsed.data.assignmentIds) {
        await storage.deleteAssignment(assignmentId);
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Error removing planning block:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/assignments/:id/start-travel", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "planned")
        return res.status(400).json({ message: "Invalid status transition" });

      await storage.updateAssignment(req.params.id, { status: "en_route" });

      let timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id
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
        timeEntry = await storage.updateTimeEntry(timeEntry.id, {
          startedAt: new Date(),
          status: "en_route",
        });
      }

      const job = await storage.getJobForCompany(req.companyId, assignment.jobId);
      if (job && job.status === "planned") {
        await storage.updateJob(job.id, { status: "in_progress" });
      }

      res.json({ assignment: { ...assignment, status: "en_route" }, timeEntry });
    } catch (error) {
      console.error("Error starting travel:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/assignments/:id/arrive", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "en_route")
        return res.status(400).json({ message: "Invalid status transition" });

      await storage.updateAssignment(req.params.id, { status: "on_site" });
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id
      );
      if (timeEntry) {
        await storage.updateTimeEntry(timeEntry.id, {
          arrivedAt: new Date(),
          status: "on_site",
        });
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/assignments/:id/start-break", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "on_site")
        return res.status(400).json({ message: "Invalid status transition" });

      await storage.updateAssignment(req.params.id, { status: "break" });
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id
      );
      if (timeEntry) {
        await storage.updateTimeEntry(timeEntry.id, { status: "break" });
        await storage.createBreakEntry(req.companyId, timeEntry.id);
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/assignments/:id/end-break", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "break")
        return res.status(400).json({ message: "Invalid status transition" });

      await storage.updateAssignment(req.params.id, { status: "on_site" });
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id
      );
      if (timeEntry) {
        await storage.updateTimeEntry(timeEntry.id, { status: "on_site" });
        await storage.endBreakEntry(req.companyId, timeEntry.id);
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/assignments/:id/complete", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "on_site" && assignment.status !== "problem")
        return res.status(400).json({ message: "Invalid status transition" });

      await storage.updateAssignment(req.params.id, { status: "completed" });
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id
      );
      if (timeEntry) {
        const now = new Date();
        const breaksList = await storage.getBreakEntriesByTimeEntry(req.companyId, timeEntry.id);
        const totalBreakMins = breaksList.reduce(
          (sum, b) => sum + (b.durationMinutes || 0),
          0
        );
        const startTime = timeEntry.startedAt || now;
        const totalMins =
          Math.round((now.getTime() - startTime.getTime()) / 60000) - totalBreakMins;
        await storage.updateTimeEntry(timeEntry.id, {
          endedAt: now,
          totalMinutes: Math.max(0, totalMins),
          status: "completed",
        });
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/assignments/:id/report-problem", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;

      const reportSchema = insertIssueReportSchema.pick({ issueType: true, note: true, photoUrl: true });
      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }

      await storage.updateAssignment(req.params.id, { status: "problem" });
      const job = await storage.getJobForCompany(req.companyId, assignment.jobId);
      if (job) {
        await storage.updateJob(job.id, { status: "problem" });
      }
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id
      );
      if (timeEntry) {
        await storage.updateTimeEntry(timeEntry.id, { status: "problem" });
      }
      const report = await storage.createIssueReport({
        companyId: req.companyId,
        jobId: assignment.jobId,
        assignmentId: req.params.id,
        employeeId: req.employee.id,
        issueType: parsed.data.issueType,
        note: parsed.data.note,
        photoUrl: parsed.data.photoUrl,
      });
      res.json(report);
    } catch (error) {
      console.error("Error reporting problem:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/assignments/:id/resume", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const assignment = await getAuthorizedAssignment(req, res, req.params.id, {
        requireWorker: true,
      });
      if (!assignment) return;
      if (assignment.status !== "problem")
        return res.status(400).json({ message: "Invalid status transition" });

      await storage.updateAssignment(req.params.id, { status: "on_site" });
      const timeEntry = await storage.getTimeEntryForAssignment(
        req.companyId,
        req.params.id,
        req.employee.id
      );
      if (timeEntry) {
        await storage.updateTimeEntry(timeEntry.id, { status: "on_site" });
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/photos", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const parsed = insertPhotoSchema.omit({ companyId: true, employeeId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }

      const job = await storage.getJobForCompany(req.companyId, parsed.data.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (parsed.data.assignmentId) {
        const assignment = await getAuthorizedAssignment(req, res, parsed.data.assignmentId, {
          requireWorker: true,
        });
        if (!assignment) return;
        if (assignment.jobId !== parsed.data.jobId) {
          return res.status(400).json({ message: "Assignment does not belong to job" });
        }
      }

      const photo = await storage.createPhoto({
        ...parsed.data,
        companyId: req.companyId,
        employeeId: req.employee.id,
      });
      res.json(photo);
    } catch (error) {
      console.error("Error creating photo:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/photos/job/:jobId", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getJobForCompany(req.companyId, req.params.jobId);
      if (!job)
        return res.status(404).json({ message: "Not found" });
      const list = await storage.getPhotosByJob(req.companyId, req.params.jobId);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/issues/job/:jobId", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getJobForCompany(req.companyId, req.params.jobId);
      if (!job)
        return res.status(404).json({ message: "Not found" });
      const list = await storage.getIssueReportsByJob(req.companyId, req.params.jobId);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch("/api/issues/:id/resolve", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const existingReport = await storage.getIssueReportForCompany(req.companyId, req.params.id);
      if (!existingReport)
        return res.status(404).json({ message: "Not found" });

      if (existingReport.resolved) {
        return res.json(existingReport);
      }

      const report = await storage.resolveIssueReport(req.companyId, req.params.id);
      if (!report) return res.status(404).json({ message: "Not found" });
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/time-entries/job/:jobId", isAuthenticated, requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getJobForCompany(req.companyId, req.params.jobId);
      if (!job)
        return res.status(404).json({ message: "Not found" });
      const entries = await storage.getTimeEntriesByJob(req.companyId, req.params.jobId);
      const enriched = [];
      for (const entry of entries) {
        const employee = await storage.getEmployeeForCompany(req.companyId, entry.employeeId);
        const breaks = await storage.getBreakEntriesByTimeEntry(req.companyId, entry.id);
        enriched.push({ ...entry, employee, breaks });
      }
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  return httpServer;
}
