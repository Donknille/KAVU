import type { Express, Response } from "express";
import { z } from "zod";
import { and, desc, eq, or, between } from "drizzle-orm";
import { asyncHandler } from "../asyncHandler.js";
import { db } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import { vacations, employees } from "../../shared/schema.js";
import { logAuditEvent } from "../audit.js";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  employeeId: z.string().min(1).optional(),
  startDate: z.string().regex(dateRegex),
  endDate: z.string().regex(dateRegex),
  reason: z.string().max(2000).optional().nullable(),
  status: z.enum(["pending", "approved"]).optional(),
});

const updateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "canceled"]).optional(),
  reason: z.string().max(2000).optional().nullable(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
});

export function registerVacationRoutes(
  app: Express,
  requireAuth: (req: any, res: any, next: any) => void,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  // List vacations. Employees see their own only; admins see the whole
  // company. Optional date-range filter via ?from=&to=.
  app.get(
    "/api/vacations",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const isAdmin = req.employee.role === "admin";
      const baseConditions = [eq(vacations.companyId, req.companyId)];
      if (!isAdmin) {
        baseConditions.push(eq(vacations.employeeId, req.employee.id));
      } else if (req.query.employeeId && typeof req.query.employeeId === "string") {
        baseConditions.push(eq(vacations.employeeId, req.query.employeeId));
      }

      const from = typeof req.query.from === "string" && dateRegex.test(req.query.from)
        ? req.query.from
        : null;
      const to = typeof req.query.to === "string" && dateRegex.test(req.query.to)
        ? req.query.to
        : null;
      if (from && to) {
        baseConditions.push(
          or(
            between(vacations.startDate, from, to),
            between(vacations.endDate, from, to),
          )!,
        );
      }

      const list = await db
        .select()
        .from(vacations)
        .where(and(...baseConditions))
        .orderBy(desc(vacations.startDate));
      res.json(list);
    }),
  );

  // Self-service create: employees post for themselves with status=pending.
  // Admin: may post on behalf of any employee, may set status=approved.
  app.post(
    "/api/vacations",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      if (parsed.data.endDate < parsed.data.startDate) {
        return res.status(400).json({ message: "Enddatum darf nicht vor dem Startdatum liegen." });
      }

      const isAdmin = req.employee.role === "admin";
      const targetEmployeeId = isAdmin && parsed.data.employeeId
        ? parsed.data.employeeId
        : req.employee.id;

      // Tenant-check on target employee.
      const target = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.companyId, req.companyId), eq(employees.id, targetEmployeeId)))
        .then((rows) => rows[0]);
      if (!target) return res.status(404).json({ message: "Mitarbeiter nicht gefunden." });

      const status = isAdmin && parsed.data.status === "approved" ? "approved" : "pending";

      try {
        const [vacation] = await db
          .insert(vacations)
          .values({
            companyId: req.companyId,
            employeeId: targetEmployeeId,
            startDate: parsed.data.startDate,
            endDate: parsed.data.endDate,
            reason: parsed.data.reason ?? null,
            status,
            approvedBy: status === "approved" ? req.employee.userId ?? null : null,
            approvedAt: status === "approved" ? new Date() : null,
          })
          .returning();
        logAuditEvent({
          companyId: req.companyId,
          actorUserId: req.employee.userId,
          actorEmployeeId: req.employee.id,
          eventType: status === "approved" ? "vacation.approved" : "vacation.requested",
          resourceType: "vacation",
          resourceId: vacation.id,
          payload: { employeeId: targetEmployeeId, startDate: parsed.data.startDate, endDate: parsed.data.endDate },
          request: req,
        });
        res.json(vacation);
      } catch (err: any) {
        if (err?.code === "23P01") {
          return res.status(409).json({ message: "Ein genehmigter Urlaub ueberlappt bereits diesen Zeitraum." });
        }
        throw err;
      }
    }),
  );

  // Approve / reject / cancel. Admin only for non-cancel transitions;
  // employees may cancel their own pending request.
  app.patch(
    "/api/vacations/:id",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const existing = await db
        .select()
        .from(vacations)
        .where(and(eq(vacations.companyId, req.companyId), eq(vacations.id, req.params.id)))
        .then((rows) => rows[0]);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const isAdmin = req.employee.role === "admin";
      const isOwner = existing.employeeId === req.employee.id;

      // Non-admin employees may only cancel their own pending request.
      if (!isAdmin) {
        if (!isOwner) return res.status(403).json({ message: "Forbidden" });
        const onlyCancel =
          parsed.data.status === "canceled" &&
          !parsed.data.reason &&
          !parsed.data.startDate &&
          !parsed.data.endDate;
        if (!onlyCancel) {
          return res.status(403).json({
            message: "Nur Adminstratoren koennen Urlaube genehmigen oder bearbeiten.",
          });
        }
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.status) {
        patch.status = parsed.data.status;
        if (parsed.data.status === "approved") {
          patch.approvedBy = req.employee.userId;
          patch.approvedAt = new Date();
        }
      }
      if (parsed.data.reason !== undefined) patch.reason = parsed.data.reason;
      if (parsed.data.startDate) patch.startDate = parsed.data.startDate;
      if (parsed.data.endDate) patch.endDate = parsed.data.endDate;

      try {
        const [vacation] = await db
          .update(vacations)
          .set(patch as any)
          .where(and(eq(vacations.companyId, req.companyId), eq(vacations.id, req.params.id)))
          .returning();
        if (!vacation) return res.status(404).json({ message: "Not found" });
        logAuditEvent({
          companyId: req.companyId,
          actorUserId: req.employee.userId,
          actorEmployeeId: req.employee.id,
          eventType: `vacation.${vacation.status}`,
          resourceType: "vacation",
          resourceId: vacation.id,
          request: req,
        });
        res.json(vacation);
      } catch (err: any) {
        if (err?.code === "23P01") {
          return res.status(409).json({ message: "Ein genehmigter Urlaub ueberlappt bereits diesen Zeitraum." });
        }
        throw err;
      }
    }),
  );

  // Soft "delete" via status=canceled; hard delete is admin-only and rare.
  app.delete(
    "/api/vacations/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const [vacation] = await db
        .delete(vacations)
        .where(and(eq(vacations.companyId, req.companyId), eq(vacations.id, req.params.id)))
        .returning();
      if (!vacation) return res.status(404).json({ message: "Not found" });
      res.json({ ok: true });
    }),
  );
}
