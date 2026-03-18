import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage.js";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth/index.js";
import {
  isUserTenantConflict,
  USER_TENANT_CONFLICT_MESSAGE,
} from "./tenantErrors.js";
import {
  isInvitationExpired,
  normalizeInvitationEmail,
} from "./companyInvitations.js";
import { buildCompanyInvitationMutationResponse } from "./companyInvitationDispatch.js";
import {
  createCompanyInvitationSchema,
  getCurrentUserEmail,
  toAdminInvitationPayload,
  toInvitationPreviewPayload,
} from "./companyInvitationApi.js";
import {
  PREVIEW_ADMIN_EMPLOYEE_ID,
  PREVIEW_COMPANY_ID,
  PREVIEW_EMPLOYEE_COOKIE,
  PREVIEW_EMPLOYEE_HEADER,
  PREVIEW_MODE,
  getCookieValue,
  normalizePreviewEmployeeToken,
  toPreviewEmployeeSlug,
} from "./preview.js";
import {
  getCachedDashboardResponse,
  getCachedMeResponse,
  invalidateCompanyReadCaches,
  setCachedDashboardResponse,
  setCachedMeResponse,
} from "./readCaches.js";
import { isCompanyFrozen, trialDaysLeft } from "./billing.js";
import { STRIPE_ENABLED } from "./runtimeConfig.js";
import { toDateStr } from "../shared/dates.js";

import { toPublicEmployee, registerEmployeeRoutes } from "./routes/employees.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerAssignmentRoutes, toPublicAssignment } from "./routes/assignments.js";
import { registerPlanningRoutes } from "./routes/planning.js";
import { registerBillingRoutes } from "./routes/billing.js";

const setupSchema = z.object({
  companyName: z.string().min(1).max(255),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(50).optional(),
});

export function toPublicCompany(company: any, options: { includeAccessCode?: boolean } = {}) {
  if (!company) {
    return company;
  }

  if (options.includeAccessCode) {
    return company;
  }

  const { accessCode, ...rest } = company;
  return rest;
}

async function getEmployeeFromReq(req: any) {
  if (PREVIEW_MODE) {
    const previewEmployeeToken =
      normalizePreviewEmployeeToken(req.headers?.[PREVIEW_EMPLOYEE_HEADER]) ??
      getCookieValue(req.headers?.cookie, PREVIEW_EMPLOYEE_COOKIE);

    if (previewEmployeeToken) {
      if (previewEmployeeToken === "admin") {
        const adminEmployee = await storage.getEmployee(PREVIEW_ADMIN_EMPLOYEE_ID);
        if (adminEmployee) {
          return adminEmployee;
        }
      }

      const previewEmployee = await storage.getEmployee(previewEmployeeToken);
      if (previewEmployee) {
        return previewEmployee;
      }

      const previewEmployees = await storage.getEmployeesByCompany(PREVIEW_COMPANY_ID);
      const previewEmployeeBySlug = previewEmployees.find(
        (employee) =>
          employee.isActive !== false &&
          toPreviewEmployeeSlug(employee.firstName, employee.lastName) === previewEmployeeToken,
      );
      if (previewEmployeeBySlug) {
        return previewEmployeeBySlug;
      }
    }
  }

  const userId = req.user?.claims?.sub;
  if (!userId) return null;
  return storage.getEmployeeByUserId(userId);
}

async function ensureCompany(req: any) {
  const employee = await getEmployeeFromReq(req);
  if (!employee) return null;
  return { employee, companyId: employee.companyId };
}

function requireAdmin(req: any, res: any, next: any) {
  (async () => {
    const ctx = await ensureCompany(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    if (ctx.employee.role !== "admin")
      return res.status(403).json({ message: "Forbidden" });
    (req as any).companyId = ctx.companyId;
    (req as any).employee = ctx.employee;
    next();
  })();
}

function requireAuth(req: any, res: any, next: any) {
  (async () => {
    const ctx = await ensureCompany(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    (req as any).companyId = ctx.companyId;
    (req as any).employee = ctx.employee;
    next();
  })();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/me", isAuthenticated, async (req: any, res) => {
    try {
      const employee = await getEmployeeFromReq(req);
      if (!employee) {
        return res.json({ employee: null, company: null, needsSetup: true });
      }
      const authMethod = req.user?.auth_method ?? "oidc";
      const cacheKey = `${employee.companyId}:me:${employee.id}:${authMethod}`;
      const cached = getCachedMeResponse<any>(cacheKey);
      if (cached) {
        return res.json(cached);
      }
      const company = await storage.getCompany(employee.companyId);
      const billing = company
        ? {
            subscriptionStatus: company.subscriptionStatus ?? "trialing",
            trialEndsAt: company.trialEndsAt ?? null,
            currentPeriodEnd: company.currentPeriodEnd ?? null,
            trialDaysLeft: trialDaysLeft(company),
            isFrozen: isCompanyFrozen(company),
            stripeEnabled: STRIPE_ENABLED,
          }
        : null;
      const responsePayload = {
        employee: toPublicEmployee(employee),
        company: toPublicCompany(company, {
          includeAccessCode: employee.role === "admin",
        }),
        needsSetup: false,
        authMethod,
        requiresPasswordChange:
          authMethod === "employee_access" && employee.mustChangePassword === true,
        billing,
      };
      setCachedMeResponse(cacheKey, responsePayload);
      return res.json(responsePayload);
    } catch (error) {
      console.error("Error in /api/me:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/setup", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;

    try {
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const existing = await storage.getEmployeeByUserId(userId);
      if (existing) {
        const company = await storage.getCompany(existing.companyId);
        return res.json({ employee: toPublicEmployee(existing), company });
      }

      const parsed = setupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }

      const { companyName, firstName, lastName, phone } = parsed.data;

      const { company, employee } = await storage.createCompanyWithAdmin({
        companyName,
        userId,
        firstName,
        lastName,
        phone,
      });

      invalidateCompanyReadCaches(company.id);
      return res.json({ employee: toPublicEmployee(employee), company });
    } catch (error) {
      if (userId && isUserTenantConflict(error)) {
        const existing = await storage.getEmployeeByUserId(userId);
        if (existing) {
          const company = await storage.getCompany(existing.companyId);
          return res.json({ employee: toPublicEmployee(existing), company });
        }

        return res.status(409).json({ message: USER_TENANT_CONFLICT_MESSAGE });
      }

      console.error("Error in /api/setup:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/invitations/:token", async (req: any, res) => {
    try {
      const invitation = await storage.getActiveCompanyInvitationByToken(req.params.token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      const company = await storage.getCompany(invitation.companyId);
      if (!company) {
        return res.status(404).json({ message: "Invitation company not found" });
      }

      return res.json(toInvitationPreviewPayload(invitation, company));
    } catch (error) {
      console.error("Error in GET /api/invitations/:token:", error);
      return res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/invitations/:token/accept", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;

    try {
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userEmail = await getCurrentUserEmail(req);
      if (!userEmail) {
        return res.status(400).json({
          message: "Dein Konto hat keine E-Mail-Adresse. Einladung kann nicht zugeordnet werden.",
        });
      }

      const invitation = await storage.getCompanyInvitationByToken(req.params.token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.revokedAt) {
        return res.status(410).json({ message: "Diese Einladung wurde widerrufen." });
      }
      if (invitation.acceptedAt) {
        return res.status(410).json({ message: "Diese Einladung wurde bereits angenommen." });
      }
      if (isInvitationExpired(invitation.expiresAt)) {
        return res.status(410).json({ message: "Diese Einladung ist abgelaufen." });
      }
      if (normalizeInvitationEmail(userEmail) !== normalizeInvitationEmail(invitation.email)) {
        return res.status(403).json({
          message: "Diese Einladung gehoert zu einer anderen E-Mail-Adresse.",
        });
      }

      const result = await storage.acceptCompanyInvitation({
        token: req.params.token,
        userId,
        userEmail,
      });

      invalidateCompanyReadCaches(result.company.id);
      return res.json({
        employee: toPublicEmployee(result.employee),
        company: result.company,
      });
    } catch (error) {
      if (isUserTenantConflict(error)) {
        return res.status(409).json({ message: USER_TENANT_CONFLICT_MESSAGE });
      }
      if (error instanceof Error && error.message === "Invitation already claimed") {
        return res.status(410).json({ message: "Diese Einladung wurde bereits angenommen." });
      }

      console.error("Error in POST /api/invitations/:token/accept:", error);
      return res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/company-invitations", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const invitations = await storage.getCompanyInvitationsByCompany(req.companyId);
      res.json(invitations.map(toAdminInvitationPayload));
    } catch (error) {
      console.error("Error fetching company invitations:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/company-invitations", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = createCompanyInvitationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { invitation, token } = await storage.createCompanyInvitation({
        companyId: req.companyId,
        invitedByUserId: req.employee.userId,
        ...parsed.data,
        role: parsed.data.role ?? "employee",
      });

      return res.json(await buildCompanyInvitationMutationResponse(req, invitation, token));
    } catch (error) {
      console.error("Error creating company invitation:", error);
      return res.status(500).json({ message: "Internal error" });
    }
  });

  app.post(
    "/api/company-invitations/:id/resend",
    isAuthenticated,
    requireAdmin,
    async (req: any, res) => {
      try {
        const invitation = await storage.getCompanyInvitationForCompany(
          req.companyId,
          req.params.id,
        );
        if (!invitation) {
          return res.status(404).json({ message: "Not found" });
        }
        if (invitation.revokedAt) {
          return res.status(410).json({ message: "Diese Einladung wurde bereits widerrufen." });
        }
        if (invitation.acceptedAt) {
          return res.status(410).json({ message: "Diese Einladung wurde bereits angenommen." });
        }

        const reissued = await storage.reissueCompanyInvitation(req.companyId, req.params.id);
        if (!reissued) {
          return res.status(404).json({ message: "Not found" });
        }

        return res.json(
          await buildCompanyInvitationMutationResponse(req, reissued.invitation, reissued.token),
        );
      } catch (error) {
        if (error instanceof Error && error.message === "Invitation already claimed") {
          return res.status(410).json({ message: "Diese Einladung wurde bereits angenommen." });
        }

        console.error("Error resending company invitation:", error);
        return res.status(500).json({ message: "Internal error" });
      }
    },
  );

  app.delete(
    "/api/company-invitations/:id",
    isAuthenticated,
    requireAdmin,
    async (req: any, res) => {
      try {
        const invitation = await storage.getCompanyInvitationForCompany(
          req.companyId,
          req.params.id,
        );
        if (!invitation) {
          return res.status(404).json({ message: "Not found" });
        }

        const revoked = await storage.revokeCompanyInvitation(req.companyId, req.params.id);
        return res.json({ invitation: revoked ? toAdminInvitationPayload(revoked) : null });
      } catch (error) {
        console.error("Error revoking company invitation:", error);
        return res.status(500).json({ message: "Internal error" });
      }
    },
  );

  app.get("/api/dashboard", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const today = toDateStr(new Date());
      const cacheKey = `${req.companyId}:dashboard:${today}`;
      const cached = getCachedDashboardResponse<any>(cacheKey);
      if (cached) {
        return res.json(cached);
      }
      const stats = await storage.getDashboardStats(req.companyId);
      const todayAssignments = await storage.getAssignmentsByDate(req.companyId, today);
      const unassigned = await storage.getUnassignedJobs(req.companyId);
      const responsePayload = {
        stats,
        todayAssignments: todayAssignments.map((assignment) => toPublicAssignment(assignment)),
        unassignedJobs: unassigned,
      };
      setCachedDashboardResponse(cacheKey, responsePayload);
      res.json(responsePayload);
    } catch (error) {
      console.error("Error in /api/dashboard:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Register modular route handlers
  registerEmployeeRoutes(app, requireAdmin);
  registerJobRoutes(app, requireAdmin);
  registerAssignmentRoutes(app, requireAdmin, requireAuth);
  registerPlanningRoutes(app, requireAdmin);
  registerBillingRoutes(app, requireAdmin);

  return httpServer;
}
