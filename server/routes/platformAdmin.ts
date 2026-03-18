import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { asyncHandler } from "../asyncHandler.js";
import { PLATFORM_ADMIN_SECRET } from "../runtimeConfig.js";
import { isCompanyFrozen, trialDaysLeft } from "../billing.js";

function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!PLATFORM_ADMIN_SECRET) {
    return res.status(503).json({ message: "Platform admin ist nicht konfiguriert. PLATFORM_ADMIN_SECRET fehlt." });
  }
  if (req.headers["x-admin-secret"] !== PLATFORM_ADMIN_SECRET) {
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

  // POST /admin/companies/:id/extend-trial — extend trial by N days
  app.post(
    "/admin/companies/:id/extend-trial",
    requirePlatformAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params["id"] as string;
      const parsed = z.object({ days: z.number().int().min(1).max(365) }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }

      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ message: "Not found" });

      const currentTrialEnd = company.trialEndsAt ? new Date(company.trialEndsAt) : new Date();
      const newTrialEnd = new Date(currentTrialEnd.getTime() + parsed.data.days * 24 * 60 * 60 * 1000);

      const updated = await storage.updateCompany(id, {
        trialEndsAt: newTrialEnd,
        subscriptionStatus: "trialing",
      });

      res.json(toAdminCompany(updated));
    }),
  );

  // POST /admin/companies/:id/subscription — manually set subscription status
  app.post(
    "/admin/companies/:id/subscription",
    requirePlatformAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params["id"] as string;
      const parsed = z
        .object({
          status: z.enum(["trialing", "active", "past_due", "canceled", "paused"]),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }

      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ message: "Not found" });

      const updated = await storage.updateCompany(id, {
        subscriptionStatus: parsed.data.status,
      });

      res.json(toAdminCompany(updated));
    }),
  );
}
