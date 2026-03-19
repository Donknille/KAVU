import type { Express, Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { storage } from "../storage.js";
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
  // GET /admin/companies — list all companies
  app.get(
    "/admin/companies",
    requirePlatformAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const list = await storage.getAllCompanies();
      res.json(list.map(toAdminCompany));
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

}
