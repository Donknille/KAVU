import type { Express, Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { asyncHandler } from "../asyncHandler.js";
import type { AuthenticatedRequest } from "../types.js";
import { invalidateCompanyReadCaches } from "../readCaches.js";
import {
  getCachedPlanningBoardResponse,
  setCachedPlanningBoardResponse,
} from "../readCaches.js";
import { requireNotFrozen } from "../billing.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import { insertAssignmentSchema } from "../../shared/schema.js";
import {
  createPlanningBoardReadModel,
  getPlanningDaysInRange,
} from "../../shared/planningBoard.js";
import { toPublicEmployee } from "./employees.js";
import { getCompanyAssignments, toPublicAssignment } from "./assignments.js";

const assignmentDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MAX_PLANNING_RANGE_DAYS = 90;

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
      }),
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
          .extend({ workerIds: z.array(z.string().uuid()).optional() }),
      )
      .default([]),
  })
  .refine(
    (value) => value.removeAssignmentIds.length > 0 || value.createAssignments.length > 0,
    { message: "Mindestens eine Änderung ist erforderlich." },
  );

const removeBlockSchema = z.object({
  assignmentIds: z.array(z.string().uuid()).min(1),
});

export function registerPlanningRoutes(
  app: Express,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  app.get(
    "/api/planning/board",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = z
        .object({
          startDate: assignmentDateSchema,
          endDate: assignmentDateSchema,
        })
        .refine(({ startDate, endDate }) => {
          const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
          return ms >= 0 && ms <= MAX_PLANNING_RANGE_DAYS * 24 * 60 * 60 * 1000;
        }, { message: `Planungsbereich darf maximal ${MAX_PLANNING_RANGE_DAYS} Tage umfassen.` })
        .safeParse({
          startDate: req.query.startDate,
          endDate: req.query.endDate,
        });

      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.issues[0]?.message ?? "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const cacheKey = `${req.companyId}:planning:${parsed.data.startDate}:${parsed.data.endDate}`;
      const cached = getCachedPlanningBoardResponse<any>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const [employeesList, backlogJobs, planningAssignments] = await Promise.all([
        storage.getEmployeesByCompany(req.companyId),
        storage.getUnassignedJobs(req.companyId),
        storage.getAssignmentsByDateRange(
          req.companyId,
          parsed.data.startDate,
          parsed.data.endDate,
        ),
      ]);

      const visibleDays = getPlanningDaysInRange(parsed.data.startDate, parsed.data.endDate);

      const responsePayload = createPlanningBoardReadModel(
        {
          employees: employeesList.map((employee) => toPublicEmployee(employee)),
          backlogJobs,
          assignments: planningAssignments.map((assignment) => toPublicAssignment(assignment)),
        },
        visibleDays,
      );
      setCachedPlanningBoardResponse(cacheKey, responsePayload);
      res.json(responsePayload);
    }),
  );

  app.post(
    "/api/planning/assign-workers",
    isAuthenticated,
    requireAdmin,
    requireNotFrozen(storage),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
        parsed.data.assignmentIds,
      );
      if (assignmentsForCompany.some((assignment) => !assignment)) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      await Promise.all(
        assignmentsForCompany.filter(Boolean).map((assignment) =>
          parsed.data.mode === "add"
            ? storage.addWorkerToAssignment({
                companyId: req.companyId,
                assignmentId: assignment!.id,
                employeeId: parsed.data.employeeId,
              })
            : storage.removeWorkerFromAssignment(
                req.companyId,
                assignment!.id,
                parsed.data.employeeId,
              ),
        ),
      );

      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/planning/move-block",
    isAuthenticated,
    requireAdmin,
    requireNotFrozen(storage),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = moveBlockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const assignmentsForCompany = await getCompanyAssignments(
        req.companyId,
        parsed.data.updates.map((update) => update.assignmentId),
      );
      if (assignmentsForCompany.some((assignment) => !assignment)) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      for (const update of parsed.data.updates) {
        await storage.updateAssignment(req.companyId, update.assignmentId, {
          assignmentDate: update.assignmentDate,
        });
      }

      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/planning/resize-block",
    isAuthenticated,
    requireAdmin,
    requireNotFrozen(storage),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
          parsed.data.removeAssignmentIds,
        );
        if (assignmentsForCompany.some((assignment) => !assignment)) {
          return res.status(404).json({ message: "Assignment not found" });
        }
        const protectedAssignment = assignmentsForCompany.find(
          (assignment) => assignment && assignment.status !== "planned",
        );
        if (protectedAssignment) {
          return res.status(400).json({
            message: "Nur geplante Einsätze können entfernt werden",
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
        await storage.deleteAssignment(req.companyId, assignmentId);
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

      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true, createdAssignments });
    }),
  );

  app.post(
    "/api/planning/remove-block",
    isAuthenticated,
    requireAdmin,
    requireNotFrozen(storage),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = removeBlockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const assignmentsForCompany = await getCompanyAssignments(
        req.companyId,
        parsed.data.assignmentIds,
      );
      if (assignmentsForCompany.some((assignment) => !assignment)) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      const protectedAssignment = assignmentsForCompany.find(
        (assignment) => assignment && assignment.status !== "planned",
      );
      if (protectedAssignment) {
        return res.status(400).json({
          message: "Nur komplett geplante Aufträge können entfernt werden",
        });
      }

      for (const assignmentId of parsed.data.assignmentIds) {
        await storage.deleteAssignment(req.companyId, assignmentId);
      }

      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );
}
