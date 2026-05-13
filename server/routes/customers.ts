import type { Express, Response } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { asyncHandler } from "../asyncHandler.js";
import { db } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import { customers } from "../../shared/schema.js";

const insertSchema = z.object({
  name: z.string().min(1).max(255),
  customerNumber: z.string().max(50).optional().nullable(),
  contactName: z.string().max(255).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  contactEmail: z.string().email().max(255).optional().nullable().or(z.literal("")),
  addressStreet: z.string().max(255).optional().nullable(),
  addressZip: z.string().max(20).optional().nullable(),
  addressCity: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
});

const updateSchema = insertSchema.partial();

export function registerCustomerRoutes(
  app: Express,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  app.get(
    "/api/customers",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const includeArchived = req.query.archived === "true";
      const conditions = [eq(customers.companyId, req.companyId)];
      if (!includeArchived) {
        conditions.push(eq(customers.isArchived, false));
      }
      const list = await db
        .select()
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.createdAt));
      res.json(list);
    }),
  );

  app.get(
    "/api/customers/search",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const qParsed = z.string().max(200).safeParse(req.query.q ?? "");
      const limitParsed = z.coerce.number().int().min(1).max(50).safeParse(
        req.query.limit ?? 20,
      );
      const limit = limitParsed.success ? limitParsed.data : 20;
      if (!qParsed.success || !qParsed.data.trim()) {
        const list = await db
          .select()
          .from(customers)
          .where(and(eq(customers.companyId, req.companyId), eq(customers.isArchived, false)))
          .orderBy(desc(customers.createdAt))
          .limit(limit);
        return res.json(list);
      }
      const q = `%${qParsed.data.trim()}%`;
      const list = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.companyId, req.companyId),
            eq(customers.isArchived, false),
            or(
              ilike(customers.name, q),
              ilike(customers.contactName, q),
              ilike(customers.customerNumber, q),
              ilike(customers.addressCity, q),
            ),
          ),
        )
        .orderBy(desc(customers.createdAt))
        .limit(limit);
      res.json(list);
    }),
  );

  app.get(
    "/api/customers/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const [customer] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.companyId, req.companyId), eq(customers.id, req.params.id)));
      if (!customer) return res.status(404).json({ message: "Not found" });
      res.json(customer);
    }),
  );

  app.post(
    "/api/customers",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = insertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const [customer] = await db
        .insert(customers)
        .values({
          companyId: req.companyId,
          ...parsed.data,
          contactEmail: parsed.data.contactEmail === "" ? null : parsed.data.contactEmail,
        })
        .returning();
      res.json(customer);
    }),
  );

  app.patch(
    "/api/customers/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const [customer] = await db
        .update(customers)
        .set({
          ...parsed.data,
          contactEmail: parsed.data.contactEmail === "" ? null : parsed.data.contactEmail,
          updatedAt: new Date(),
        })
        .where(and(eq(customers.companyId, req.companyId), eq(customers.id, req.params.id)))
        .returning();
      if (!customer) return res.status(404).json({ message: "Not found" });
      res.json(customer);
    }),
  );

  app.delete(
    "/api/customers/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const [customer] = await db
        .update(customers)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(and(eq(customers.companyId, req.companyId), eq(customers.id, req.params.id)))
        .returning();
      if (!customer) return res.status(404).json({ message: "Not found" });
      res.json({ ok: true });
    }),
  );
}
