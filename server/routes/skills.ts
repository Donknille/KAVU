import type { Express, Response } from "express";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { asyncHandler } from "../asyncHandler.js";
import { db } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import {
  skills,
  employeeSkills,
  jobRequiredSkills,
  employees,
  jobs,
} from "../../shared/schema.js";

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

const employeeSkillSetSchema = z.object({
  skills: z.array(
    z.object({
      skillId: z.string().min(1),
      level: z.number().int().min(1).max(5).default(1),
    }),
  ),
});

const jobRequiredSkillsSetSchema = z.object({
  skillIds: z.array(z.string().min(1)),
});

export function registerSkillRoutes(
  app: Express,
  requireAuth: (req: any, res: any, next: any) => void,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  // List skills (any authenticated user can see, admin can mutate).
  app.get(
    "/api/skills",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const list = await db
        .select()
        .from(skills)
        .where(and(eq(skills.companyId, req.companyId), eq(skills.isActive, true)))
        .orderBy(asc(skills.sortOrder), asc(skills.name));
      res.json(list);
    }),
  );

  app.post(
    "/api/skills",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = insertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      try {
        const [skill] = await db
          .insert(skills)
          .values({ companyId: req.companyId, ...parsed.data })
          .returning();
        res.json(skill);
      } catch (err: any) {
        if (err?.code === "23505") {
          return res.status(409).json({ message: "Skill mit diesem Namen existiert bereits." });
        }
        throw err;
      }
    }),
  );

  app.patch(
    "/api/skills/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }
      const [skill] = await db
        .update(skills)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(skills.companyId, req.companyId), eq(skills.id, req.params.id)))
        .returning();
      if (!skill) return res.status(404).json({ message: "Not found" });
      res.json(skill);
    }),
  );

  app.delete(
    "/api/skills/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const [skill] = await db
        .update(skills)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(skills.companyId, req.companyId), eq(skills.id, req.params.id)))
        .returning();
      if (!skill) return res.status(404).json({ message: "Not found" });
      res.json({ ok: true });
    }),
  );

  // Replace the full skill set for one employee.
  app.put(
    "/api/employees/:id/skills",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const employee = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.companyId, req.companyId), eq(employees.id, req.params.id)))
        .then((rows) => rows[0]);
      if (!employee) return res.status(404).json({ message: "Not found" });

      const parsed = employeeSkillSetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }

      // Validate every supplied skillId belongs to this company.
      if (parsed.data.skills.length > 0) {
        const skillIds = parsed.data.skills.map((entry) => entry.skillId);
        const validSkills = await db
          .select({ id: skills.id })
          .from(skills)
          .where(and(eq(skills.companyId, req.companyId), inArray(skills.id, skillIds)));
        if (validSkills.length !== skillIds.length) {
          return res.status(400).json({ message: "Mindestens ein Skill gehoert nicht zur Firma." });
        }
      }

      await db.delete(employeeSkills).where(eq(employeeSkills.employeeId, req.params.id));
      if (parsed.data.skills.length > 0) {
        await db.insert(employeeSkills).values(
          parsed.data.skills.map((entry) => ({
            employeeId: req.params.id,
            skillId: entry.skillId,
            companyId: req.companyId,
            level: entry.level,
          })),
        );
      }

      const updated = await db
        .select()
        .from(employeeSkills)
        .where(eq(employeeSkills.employeeId, req.params.id));
      res.json(updated);
    }),
  );

  app.get(
    "/api/employees/:id/skills",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const rows = await db
        .select()
        .from(employeeSkills)
        .where(
          and(
            eq(employeeSkills.companyId, req.companyId),
            eq(employeeSkills.employeeId, req.params.id),
          ),
        );
      res.json(rows);
    }),
  );

  // Replace the full required-skill set for one job.
  app.put(
    "/api/jobs/:id/required-skills",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const job = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.companyId, req.companyId), eq(jobs.id, req.params.id)))
        .then((rows) => rows[0]);
      if (!job) return res.status(404).json({ message: "Not found" });

      const parsed = jobRequiredSkillsSetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }

      if (parsed.data.skillIds.length > 0) {
        const validSkills = await db
          .select({ id: skills.id })
          .from(skills)
          .where(and(eq(skills.companyId, req.companyId), inArray(skills.id, parsed.data.skillIds)));
        if (validSkills.length !== parsed.data.skillIds.length) {
          return res.status(400).json({ message: "Mindestens ein Skill gehoert nicht zur Firma." });
        }
      }

      await db.delete(jobRequiredSkills).where(eq(jobRequiredSkills.jobId, req.params.id));
      if (parsed.data.skillIds.length > 0) {
        await db.insert(jobRequiredSkills).values(
          parsed.data.skillIds.map((skillId) => ({ jobId: req.params.id, skillId })),
        );
      }

      const updated = await db
        .select()
        .from(jobRequiredSkills)
        .where(eq(jobRequiredSkills.jobId, req.params.id));
      res.json(updated);
    }),
  );

  app.get(
    "/api/jobs/:id/required-skills",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      // Ensure tenant: the job must belong to the company.
      const job = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.companyId, req.companyId), eq(jobs.id, req.params.id)))
        .then((rows) => rows[0]);
      if (!job) return res.status(404).json({ message: "Not found" });
      const rows = await db
        .select()
        .from(jobRequiredSkills)
        .where(eq(jobRequiredSkills.jobId, req.params.id));
      res.json(rows);
    }),
  );
}
