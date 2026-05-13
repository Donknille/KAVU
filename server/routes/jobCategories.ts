import type { Express, Response } from "express";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { asyncHandler } from "../asyncHandler.js";
import { db } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import { jobCategories } from "../../shared/schema.js";

const insertSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Farbe muss als #RRGGBB angegeben werden.")
    .optional()
    .nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = insertSchema.partial();

// Default seed used when a company opens the categories settings for the
// first time. Mirrors the existing hard-coded enum so the UI starts with
// familiar names. legacy_enum_value links the row back to the enum so the
// later backfill (stage 2) can use it.
const DEFAULT_CATEGORIES: Array<{
  name: string;
  color: string;
  sortOrder: number;
  legacyEnumValue: "pv" | "heat_pump" | "shk" | "montage" | "service" | "other";
}> = [
  { name: "PV / Solar", color: "#eab308", sortOrder: 0, legacyEnumValue: "pv" },
  { name: "Waermepumpe", color: "#ef4444", sortOrder: 1, legacyEnumValue: "heat_pump" },
  { name: "SHK", color: "#3b82f6", sortOrder: 2, legacyEnumValue: "shk" },
  { name: "Montage", color: "#8b5cf6", sortOrder: 3, legacyEnumValue: "montage" },
  { name: "Service", color: "#06b6d4", sortOrder: 4, legacyEnumValue: "service" },
  { name: "Sonstiges", color: "#6b7280", sortOrder: 5, legacyEnumValue: "other" },
];

export function registerJobCategoryRoutes(
  app: Express,
  requireAuth: (req: any, res: any, next: any) => void,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  app.get(
    "/api/job-categories",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      let list = await db
        .select()
        .from(jobCategories)
        .where(eq(jobCategories.companyId, req.companyId))
        .orderBy(asc(jobCategories.sortOrder), asc(jobCategories.name));

      // First-time-open seeding so the UI never starts empty.
      if (list.length === 0) {
        await db.insert(jobCategories).values(
          DEFAULT_CATEGORIES.map((entry) => ({
            companyId: req.companyId,
            ...entry,
          })),
        );
        list = await db
          .select()
          .from(jobCategories)
          .where(eq(jobCategories.companyId, req.companyId))
          .orderBy(asc(jobCategories.sortOrder), asc(jobCategories.name));
      }

      res.json(list);
    }),
  );

  app.post(
    "/api/job-categories",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = insertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      try {
        const [row] = await db
          .insert(jobCategories)
          .values({ companyId: req.companyId, ...parsed.data })
          .returning();
        res.json(row);
      } catch (err: any) {
        if (err?.code === "23505") {
          return res.status(409).json({ message: "Kategorie mit diesem Namen existiert bereits." });
        }
        throw err;
      }
    }),
  );

  app.patch(
    "/api/job-categories/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const [row] = await db
        .update(jobCategories)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(jobCategories.companyId, req.companyId), eq(jobCategories.id, req.params.id)))
        .returning();
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    }),
  );

  app.delete(
    "/api/job-categories/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const [row] = await db
        .update(jobCategories)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(jobCategories.companyId, req.companyId), eq(jobCategories.id, req.params.id)))
        .returning();
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json({ ok: true });
    }),
  );
}
