import type { Express, Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { asyncHandler } from "../asyncHandler.js";
import type { AuthenticatedRequest } from "../types.js";
import { invalidateCompanyReadCaches } from "../readCaches.js";
import { requireNotFrozen } from "../billing.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import { insertJobSchema, assignments, assignmentWorkers, employees } from "../../shared/schema.js";
import { db } from "../db.js";
import { eq, and, inArray } from "drizzle-orm";

export function registerJobRoutes(
  app: Express,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  app.get(
    "/api/jobs",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const includeArchived = req.query.archived === "true";
      const list = await storage.getJobsByCompany(req.companyId, includeArchived);
      res.json(list);
    }),
  );

  app.get(
    "/api/jobs/unassigned",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const list = await storage.getUnassignedJobs(req.companyId);
      res.json(list);
    }),
  );

  app.get(
    "/api/jobs/search",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const qParsed = z.string().max(200).safeParse(req.query.q ?? "");
      if (!qParsed.success) {
        return res.status(400).json({ message: "Suchbegriff ist zu lang." });
      }
      const list = await storage.searchJobs(req.companyId, qParsed.data);
      res.json(list);
    }),
  );

  app.get(
    "/api/jobs/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const job = await storage.getJobForCompany(req.companyId, req.params.id);
      if (!job) return res.status(404).json({ message: "Not found" });

      // Fetch unique team members assigned to this job
      const jobAssignments = await db
        .select({ id: assignments.id })
        .from(assignments)
        .where(and(eq(assignments.companyId, req.companyId), eq(assignments.jobId, job.id)));

      const assignmentIds = jobAssignments.map((a) => a.id);
      let teamMembers: Array<{ id: string; firstName: string; lastName: string; color: string | null }> = [];

      if (assignmentIds.length > 0) {
        const workerRows = await db
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            color: employees.color,
          })
          .from(assignmentWorkers)
          .innerJoin(employees, eq(assignmentWorkers.employeeId, employees.id))
          .where(
            and(
              eq(assignmentWorkers.companyId, req.companyId),
              inArray(assignmentWorkers.assignmentId, assignmentIds),
            ),
          );

        const seen = new Set<string>();
        teamMembers = workerRows.filter((w) => {
          if (seen.has(w.id)) return false;
          seen.add(w.id);
          return true;
        });
      }

      res.json({ ...job, teamMembers });
    }),
  );

  app.post(
    "/api/jobs",
    isAuthenticated,
    requireAdmin,
    requireNotFrozen(storage),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
      invalidateCompanyReadCaches(req.companyId);
      res.json(job);
    }),
  );

  app.patch(
    "/api/jobs/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const existing = await storage.getJobForCompany(req.companyId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const parsed = insertJobSchema
        .omit({ companyId: true, createdBy: true, jobNumber: true })
        .partial()
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const job = await storage.updateJob(req.companyId, req.params.id, parsed.data);
      invalidateCompanyReadCaches(req.companyId);
      res.json(job);
    }),
  );
}
