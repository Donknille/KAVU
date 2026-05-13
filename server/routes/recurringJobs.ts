import type { Express, Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { asyncHandler } from "../asyncHandler.js";
import { db } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import { recurringJobTemplates } from "../../shared/schema.js";

const insertSchema = z.object({
  customerId: z.string().optional().nullable(),
  title: z.string().min(1).max(255),
  category: z.enum(["pv", "heat_pump", "shk", "montage", "service", "other"]).optional().nullable(),
  description: z.string().optional().nullable(),
  plannedDurationMinutes: z.number().int().min(1).max(60 * 24 * 90).optional(),
  recurrenceIntervalMonths: z.number().int().min(1).max(60).default(12),
  nextRunAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isActive: z.boolean().optional(),
});

const updateSchema = insertSchema.partial();

export function registerRecurringJobRoutes(
  app: Express,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  app.get(
    "/api/recurring-jobs",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const list = await db
        .select()
        .from(recurringJobTemplates)
        .where(eq(recurringJobTemplates.companyId, req.companyId))
        .orderBy(desc(recurringJobTemplates.createdAt));
      res.json(list);
    }),
  );

  app.post(
    "/api/recurring-jobs",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = insertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const [template] = await db
        .insert(recurringJobTemplates)
        .values({
          companyId: req.companyId,
          ...parsed.data,
        })
        .returning();
      res.json(template);
    }),
  );

  app.patch(
    "/api/recurring-jobs/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const [template] = await db
        .update(recurringJobTemplates)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(
          and(
            eq(recurringJobTemplates.companyId, req.companyId),
            eq(recurringJobTemplates.id, req.params.id),
          ),
        )
        .returning();
      if (!template) return res.status(404).json({ message: "Not found" });
      res.json(template);
    }),
  );

  app.delete(
    "/api/recurring-jobs/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const [template] = await db
        .delete(recurringJobTemplates)
        .where(
          and(
            eq(recurringJobTemplates.companyId, req.companyId),
            eq(recurringJobTemplates.id, req.params.id),
          ),
        )
        .returning();
      if (!template) return res.status(404).json({ message: "Not found" });
      res.json({ ok: true });
    }),
  );
}

// Used by /api/cron/run-recurring-jobs to advance one template forward by
// recurrence_interval_months. Exported so the cron route can reuse it.
export function advanceNextRun(currentISO: string, months: number): string {
  const [y, m, d] = currentISO.split("-").map(Number);
  const next = new Date(y, (m ?? 1) - 1, d ?? 1);
  next.setMonth(next.getMonth() + months);
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
