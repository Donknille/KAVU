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
// Email delivery removed — PDF credentials are the primary onboarding method
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
  const { accessCode, ...rest } = company;
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

function skipDelivery() {
  return {
    status: "skipped" as const,
    delivered: false,
    message: "Zugangsdaten per PDF herunterladen.",
  };
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

      const delivery = skipDelivery();

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

      const delivery = skipDelivery();

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

  // PDF credentials download
  app.get(
    "/api/employees/:id/credentials-pdf",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const employee = await storage.getEmployeeForCompany(req.companyId, req.params.id);
      if (!employee) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!employee.loginId) {
        return res.status(400).json({ message: "Mitarbeiter hat noch keinen Zugang. Bitte zuerst Zugang erstellen." });
      }

      const company = await storage.getCompany(req.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Generate a fresh temporary password for the PDF
      const { generateTemporaryPassword, hashPassword } = await import("../passwords.js");
      const tempPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(tempPassword);

      // Update employee password and set mustChangePassword
      await storage.updateEmployee(req.companyId, employee.id, {
        passwordHash,
        mustChangePassword: true,
      });

      if (employee.userId) {
        invalidateLocalAuthIdentity(employee.userId, "employee_access");
      }

      const { APP_BASE_URL } = await import("../runtimeConfig.js");
      const loginUrl = `${APP_BASE_URL}/login/employee`;

      const { generateCredentialsPdf } = await import("../employeeCredentialsPdf.js");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Zugangsdaten-${employee.firstName}-${employee.lastName}.pdf"`,
      );

      await generateCredentialsPdf(
        {
          companyName: company.name,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          loginUrl,
          accessCode: company.accessCode ?? "",
          loginId: employee.loginId!,
          temporaryPassword: tempPassword,
        },
        res,
      );
    }),
  );

  // Toggle active/inactive
  app.patch(
    "/api/employees/:id/status",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive muss true oder false sein." });
      }

      const employee = await storage.getEmployeeForCompany(req.companyId, req.params.id);
      if (!employee) return res.status(404).json({ message: "Mitarbeiter nicht gefunden." });

      // Don't allow deactivating yourself
      if (employee.id === req.employee?.id) {
        return res.status(400).json({ message: "Sie koennen sich nicht selbst deaktivieren." });
      }

      await storage.updateEmployee(req.companyId, req.params.id, { isActive });
      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true, isActive });
    }),
  );

  // Delete employee
  app.delete(
    "/api/employees/:id",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const employee = await storage.getEmployeeForCompany(req.companyId, req.params.id);
      if (!employee) return res.status(404).json({ message: "Mitarbeiter nicht gefunden." });

      // Don't allow deleting yourself
      if (employee.id === req.employee?.id) {
        return res.status(400).json({ message: "Sie koennen sich nicht selbst loeschen." });
      }

      // Delete user account if exists
      if (employee.userId) {
        const { authStorage } = await import("../replit_integrations/auth/storage.js");
        await authStorage.deleteUser(employee.userId);
      }

      await storage.deleteEmployee(req.companyId, req.params.id);
      invalidateCompanyReadCaches(req.companyId);
      res.json({ ok: true });
    }),
  );
}
