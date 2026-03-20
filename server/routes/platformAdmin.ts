import type { Express, Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { storage } from "../storage.js";
import { authStorage } from "../replit_integrations/auth/storage.js";
import { asyncHandler } from "../asyncHandler.js";
import { PLATFORM_ADMIN_SECRET } from "../runtimeConfig.js";
import { isCompanyFrozen, trialDaysLeft } from "../billing.js";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare b against itself to keep constant time, then return false
    const buf = Buffer.from(b);
    timingSafeEqual(buf, buf);
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!PLATFORM_ADMIN_SECRET) {
    return res.status(503).json({ message: "Platform admin ist nicht konfiguriert. PLATFORM_ADMIN_SECRET fehlt." });
  }
  const provided = (req.headers["x-admin-secret"] as string) ?? "";
  if (!constantTimeEqual(provided, PLATFORM_ADMIN_SECRET)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function toAdminCompany(company: any) {
  const { accessCode, passwordHash, ...rest } = company;
  return {
    ...rest,
    frozen: isCompanyFrozen(company),
    trialDaysLeft: trialDaysLeft(company),
  };
}

export function registerPlatformAdminRoutes(app: Express) {
  // GET /admin/companies — list all companies with stats
  app.get(
    "/admin/companies",
    requirePlatformAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const list = await storage.getAllCompanies();
      const enriched = await Promise.all(
        list.map(async (c) => {
          const [emps, jobList] = await Promise.all([
            storage.getEmployeesByCompany(c.id),
            storage.getJobsByCompany(c.id),
          ]);
          return {
            ...toAdminCompany(c),
            accessCode: c.accessCode,
            employeeCount: emps.length,
            jobCount: jobList.length,
          };
        }),
      );
      res.json(enriched);
    }),
  );

  // GET /admin/companies/:id — single company with employees
  app.get(
    "/admin/companies/:id",
    requirePlatformAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params["id"] as string;
      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ message: "Not found" });

      const employees = await storage.getEmployeesByCompany(id);

      res.json({
        ...toAdminCompany(company),
        employees: employees.map(({ passwordHash, userId, loginId, ...e }: any) => e),
      });
    }),
  );

  // GET /admin/orphaned-users — list users not linked to any employee
  app.get(
    "/admin/orphaned-users",
    requirePlatformAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const allCompanies = await storage.getAllCompanies();
      const allEmployeeUserIds = new Set<string>();
      for (const c of allCompanies) {
        const emps = await storage.getEmployeesByCompany(c.id);
        for (const e of emps) {
          if (e.userId) allEmployeeUserIds.add(e.userId);
        }
      }
      // Get all users via direct DB query
      const { db } = await import("../db.js");
      const { users } = await import("../../shared/models/auth.js");
      const allUsers = await db.select().from(users);
      const orphaned = allUsers.filter((u) => !allEmployeeUserIds.has(u.id));
      res.json(orphaned.map(({ passwordHash, ...u }) => u));
    }),
  );

  // DELETE /admin/orphaned-users — delete all users not linked to any employee
  app.delete(
    "/admin/orphaned-users",
    requirePlatformAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const allCompanies = await storage.getAllCompanies();
      const allEmployeeUserIds = new Set<string>();
      for (const c of allCompanies) {
        const emps = await storage.getEmployeesByCompany(c.id);
        for (const e of emps) {
          if (e.userId) allEmployeeUserIds.add(e.userId);
        }
      }
      const { db } = await import("../db.js");
      const { users } = await import("../../shared/models/auth.js");
      const allUsers = await db.select().from(users);
      const orphaned = allUsers.filter((u) => !allEmployeeUserIds.has(u.id));
      let deleted = 0;
      for (const u of orphaned) {
        await authStorage.deleteUser(u.id);
        deleted++;
      }
      console.info(`[platform-admin] Deleted ${deleted} orphaned users`);
      res.json({ message: `${deleted} verwaiste User gelöscht.`, deleted });
    }),
  );

  // DELETE /admin/companies/:id — delete company and all associated data
  app.delete(
    "/admin/companies/:id",
    requirePlatformAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params["id"] as string;
      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ message: "Not found" });

      const deleted = await storage.deleteCompanyWithAllData(id);
      if (!deleted) return res.status(500).json({ message: "Löschen fehlgeschlagen" });

      console.info(`[platform-admin] Company deleted: ${company.name} (${id})`);
      res.json({ message: `Betrieb "${company.name}" und alle zugehörigen Daten gelöscht.` });
    }),
  );

}
