import type { Express, Request, Response } from "express";
import { and, eq, lt, lte } from "drizzle-orm";
import { asyncHandler } from "../asyncHandler.js";
import { db } from "../db.js";
import { sessions } from "../../shared/models/auth.js";
import { jobs, recurringJobTemplates } from "../../shared/schema.js";
import { CRON_SECRET } from "../runtimeConfig.js";
import { advanceNextRun } from "./recurringJobs.js";

function authorizeCron(req: Request): boolean {
  if (!CRON_SECRET) return false;
  const header = req.headers.authorization;
  if (!header) return false;
  const expected = `Bearer ${CRON_SECRET}`;
  if (header.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function registerCronRoutes(app: Express) {
  app.get(
    "/api/cron/cleanup-sessions",
    asyncHandler(async (req: Request, res: Response) => {
      if (!authorizeCron(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const result = await db.delete(sessions).where(lt(sessions.expire, new Date()));
      const deleted = (result as unknown as { rowCount?: number }).rowCount ?? 0;
      return res.json({ deleted, ranAt: new Date().toISOString() });
    }),
  );

  app.get(
    "/api/cron/run-recurring-jobs",
    asyncHandler(async (req: Request, res: Response) => {
      if (!authorizeCron(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const today = new Date().toISOString().slice(0, 10);
      const dueTemplates = await db
        .select()
        .from(recurringJobTemplates)
        .where(
          and(
            eq(recurringJobTemplates.isActive, true),
            lte(recurringJobTemplates.nextRunAt, today),
          ),
        );

      let created = 0;
      for (const template of dueTemplates) {
        try {
          // Pick the highest existing job number for the company so generated
          // jobs slot into the same A-XXXX sequence the user is used to.
          const existingNumbers = await db
            .select({ jobNumber: jobs.jobNumber })
            .from(jobs)
            .where(eq(jobs.companyId, template.companyId));
          const maxNumber = existingNumbers
            .map((row) => Number(row.jobNumber.replace(/[^0-9]/g, "")) || 0)
            .reduce((max, current) => (current > max ? current : max), 0);
          const jobNumber = `A-${String(maxNumber + 1).padStart(4, "0")}`;

          await db.insert(jobs).values({
            companyId: template.companyId,
            jobNumber,
            customerName: template.title,
            title: template.title,
            description: template.description ?? null,
            category: template.category ?? null,
            customerId: template.customerId ?? null,
            startDate: template.nextRunAt,
            plannedDurationMinutes: template.plannedDurationMinutes,
            status: "planned",
          });

          await db
            .update(recurringJobTemplates)
            .set({
              nextRunAt: advanceNextRun(template.nextRunAt, template.recurrenceIntervalMonths),
              updatedAt: new Date(),
            })
            .where(eq(recurringJobTemplates.id, template.id));
          created += 1;
        } catch (err) {
          console.error("[cron] failed to spawn recurring job", template.id, err);
        }
      }

      return res.json({ created, considered: dueTemplates.length, ranAt: new Date().toISOString() });
    }),
  );
}
