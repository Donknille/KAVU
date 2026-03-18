import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { asyncHandler } from "../asyncHandler.js";
import type { AuthenticatedRequest } from "../types.js";
import { invalidateLocalAuthIdentity } from "../replit_integrations/auth/replitAuth.js";
import {
  isUserTenantConflict,
  USER_TENANT_CONFLICT_MESSAGE,
} from "../tenantErrors.js";
import { sendEmployeeAccessEmail } from "../employeeAccessDelivery.js";
import { getCurrentUserEmail } from "../companyInvitationApi.js";
import { invalidateCompanyReadCaches } from "../readCaches.js";
import { requireNotFrozen } from "../billing.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import type { Response } from "express";

const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(50).optional(),
  role: z.enum(["admin", "employee"]).default("employee"),
  createAccess: z.boolean().default(false),
  loginId: z.string().trim().max(80).optional(),
  sendCredentialsToAdmin: z.boolean().default(false),
});

const provisionEmployeeAccessSchema = z.object({
  loginId: z.string().trim().max(80).optional(),
  sendCredentialsToAdmin: z.boolean().default(false),
});

function toPublicCompany(company: any) {
  if (!company) return company;
  const { accessCode, stripeCustomerId, stripeSubscriptionId, ...rest } = company;
  return rest;
}

export function toPublicEmployee(employee: any, options: { includeAccess?: boolean } = {}) {
  if (!employee) {
    return employee;
  }

  const {
    passwordHash,
    passwordIssuedAt,
    userId,
    loginId,
    mustChangePassword,
    ...rest
  } = employee;

  if (options.includeAccess) {
    return {
      ...rest,
      loginId,
      mustChangePassword,
    };
  }

  return rest;
}

async function maybeDeliverEmployeeAccess(
  req: AuthenticatedRequest,
  employee: any,
  company: any,
  access: any,
  shouldSend: boolean,
) {
  if (!shouldSend) {
    return {
      status: "skipped",
      delivered: false,
      message: "Zugangsdaten werden nur im Browser angezeigt.",
    };
  }

  const recipientEmail = await getCurrentUserEmail(req);
  return sendEmployeeAccessEmail({
    company,
    employee,
    access,
    recipientEmail,
    recipientName: [req.employee?.firstName, req.employee?.lastName].filter(Boolean).join(" "),
  });
}

export function registerEmployeeRoutes(
  app: Express,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  app.get(
    "/api/employees",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const list = await storage.getEmployeesByCompany(req.companyId);
      res.json(list.map((employee) => toPublicEmployee(employee, { includeAccess: true })));
    }),
  );

  app.post(
    "/api/employees",
    isAuthenticated,
    requireAdmin,
    requireNotFrozen(storage),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createEmployeeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }

      let employee;
      try {
        employee = await storage.createEmployee({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          phone: parsed.data.phone,
          role: parsed.data.role,
          isActive: true,
          companyId: req.companyId,
        });
      } catch (error) {
        if (isUserTenantConflict(error)) {
          return res.status(409).json({ message: USER_TENANT_CONFLICT_MESSAGE });
        }
        console.error("Error creating employee:", error);
        return res.status(500).json({ message: "Internal error" });
      }

      if (!parsed.data.createAccess) {
        invalidateCompanyReadCaches(req.companyId);
        return res.json({
          employee: toPublicEmployee(employee, { includeAccess: true }),
          access: null,
          delivery: null,
        });
      }

      let provisioned;
      try {
        provisioned = await storage.provisionEmployeeAccess({
          companyId: req.companyId,
          employeeId: employee.id,
          loginId: parsed.data.loginId,
        });
      } catch (error) {
        if (isUserTenantConflict(error)) {
          return res.status(409).json({ message: USER_TENANT_CONFLICT_MESSAGE });
        }
        console.error("Error provisioning employee access:", error);
        return res.status(500).json({ message: "Internal error" });
      }

      const delivery = await maybeDeliverEmployeeAccess(
        req,
        provisioned.employee,
        provisioned.company,
        provisioned.access,
        parsed.data.sendCredentialsToAdmin,
      );

      if (provisioned.employee.userId) {
        invalidateLocalAuthIdentity(provisioned.employee.userId, "employee_access");
      }
      invalidateCompanyReadCaches(req.companyId);
      res.json({
        employee: toPublicEmployee(provisioned.employee, { includeAccess: true }),
        company: toPublicCompany(provisioned.company),
        access: provisioned.access,
        delivery,
      });
    }),
  );

  app.patch(
    "/api/employees/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const existing = await storage.getEmployeeForCompany(req.companyId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const parsed = createEmployeeSchema
        .omit({ createAccess: true, loginId: true, sendCredentialsToAdmin: true })
        .partial()
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }

      // Prevent downgrading the last admin
      if (parsed.data.role === "employee" && existing.role === "admin") {
        const allEmployees = await storage.getEmployeesByCompany(req.companyId);
        const activeAdmins = allEmployees.filter((e) => e.role === "admin" && e.isActive && e.id !== existing.id);
        if (activeAdmins.length === 0) {
          return res.status(400).json({
            message: "Der letzte Admin kann nicht auf 'Mitarbeiter' herabgestuft werden.",
          });
        }
      }

      let employee;
      try {
        employee = await storage.updateEmployee(req.companyId, req.params.id, parsed.data);
      } catch (error) {
        if (isUserTenantConflict(error)) {
          return res.status(409).json({ message: USER_TENANT_CONFLICT_MESSAGE });
        }
        return res.status(500).json({ message: "Internal error" });
      }

      if (!employee) return res.status(404).json({ message: "Not found" });
      if (employee.userId) {
        invalidateLocalAuthIdentity(employee.userId, "employee_access");
      }
      invalidateCompanyReadCaches(req.companyId);
      res.json(toPublicEmployee(employee, { includeAccess: true }));
    }),
  );

  app.post(
    "/api/employees/:id/access",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const existing = await storage.getEmployeeForCompany(req.companyId, req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Not found" });
      }

      const parsed = provisionEmployeeAccessSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });
      }

      let provisioned;
      try {
        provisioned = await storage.provisionEmployeeAccess({
          companyId: req.companyId,
          employeeId: req.params.id,
          loginId: parsed.data.loginId,
        });
      } catch (error) {
        if (isUserTenantConflict(error)) {
          return res.status(409).json({ message: USER_TENANT_CONFLICT_MESSAGE });
        }
        console.error("Error provisioning employee access:", error);
        return res.status(500).json({ message: "Internal error" });
      }

      const delivery = await maybeDeliverEmployeeAccess(
        req,
        provisioned.employee,
        provisioned.company,
        provisioned.access,
        parsed.data.sendCredentialsToAdmin,
      );

      if (provisioned.employee.userId) {
        invalidateLocalAuthIdentity(provisioned.employee.userId, "employee_access");
      }
      invalidateCompanyReadCaches(req.companyId);
      return res.json({
        employee: toPublicEmployee(provisioned.employee, { includeAccess: true }),
        company: toPublicCompany(provisioned.company),
        access: provisioned.access,
        delivery,
      });
    }),
  );
}
