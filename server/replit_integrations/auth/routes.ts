import type { Express } from "express";
import { z } from "zod";
import { authStorage } from "./storage.js";
import { isAuthenticated } from "./replitAuth.js";
import { invalidateLocalAuthIdentity } from "./replitAuth.js";
import { hashPassword, verifyPassword } from "../../passwords.js";
import {
  PREVIEW_AUTH_USER,
  PREVIEW_COMPANY_ID,
  PREVIEW_ADMIN_TOKEN,
  PREVIEW_EMPLOYEE_COOKIE,
  PREVIEW_MODE,
  toPreviewEmployeeSlug,
  normalizePreviewEmployeeToken,
} from "../../preview.js";
import { storage } from "../../storage.js";

const passwordRegistrationSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});

const passwordLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

const employeeLoginSchema = z.object({
  companyAccessCode: z.string().trim().min(4).max(16),
  loginId: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
});

function toPublicUser(user: any, authMethod: string) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    authMethod,
  };
}

function toPublicEmployee(employee: any) {
  if (!employee) {
    return employee;
  }

  const { passwordHash, passwordIssuedAt, userId, ...rest } = employee;
  return rest;
}

function toPublicCompany(company: any) {
  if (!company) {
    return company;
  }

  const { accessCode, ...rest } = company;
  return rest;
}

function regenerateSession(req: any) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((error: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function saveSession(req: any) {
  return new Promise<void>((resolve, reject) => {
    req.session.save((error: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function establishLocalSession(
  req: any,
  localAuth: { userId: string; kind: "employee_access" | "password" },
) {
  if (!req.session) {
    throw new Error("Session unavailable");
  }

  await regenerateSession(req);
  req.session.localAuth = localAuth;
  await saveSession(req);
}

function getPreviewRedirect(redirect: unknown) {
  if (typeof redirect !== "string" || !redirect.startsWith("/")) {
    return "/";
  }

  return redirect;
}

function withPreviewEmployeeParam(path: string, previewEmployee: string) {
  const [pathname, query = ""] = path.split("?", 2);
  const search = new URLSearchParams(query);
  search.set("previewEmployee", previewEmployee);
  const nextQuery = search.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  if (PREVIEW_MODE) {
    app.get("/api/preview/as-admin", (_req, res) => {
      res.setHeader(
        "Set-Cookie",
        `${PREVIEW_EMPLOYEE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
      );
      res.redirect(withPreviewEmployeeParam("/", PREVIEW_ADMIN_TOKEN));
    });

    app.get("/api/preview/as-employee", isAuthenticated, async (req: any, res) => {
      try {
        const redirect = getPreviewRedirect(req.query.redirect);
        const requestedEmployee =
          normalizePreviewEmployeeToken(req.query.employee) ??
          normalizePreviewEmployeeToken(req.query.employeeId);
        const employees = await storage.getEmployeesByCompany(PREVIEW_COMPANY_ID);
        const previewEmployees = employees.filter(
          (item) => item.role === "employee" && item.isActive,
        );

        const employee =
          requestedEmployee
            ? previewEmployees.find(
                (item) =>
                  item.id.toLowerCase() === requestedEmployee ||
                  toPreviewEmployeeSlug(item.firstName, item.lastName) === requestedEmployee,
              )
            : previewEmployees[0];

        if (!employee) {
          return res.status(404).json({
            message: requestedEmployee
              ? "Preview employee not found"
              : "No preview employee found",
          });
        }

        res.setHeader(
          "Set-Cookie",
          `${PREVIEW_EMPLOYEE_COOKIE}=${encodeURIComponent(employee.id)}; Path=/; SameSite=Lax`,
        );
        res.redirect(
          withPreviewEmployeeParam(
            redirect,
            toPreviewEmployeeSlug(employee.firstName, employee.lastName),
          ),
        );
      } catch (error) {
        console.error("Error switching preview employee:", error);
        res.status(500).json({ message: "Failed to switch preview employee" });
      }
    });
  }

  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const parsed = passwordRegistrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const existingUser = await authStorage.getUserByEmail(parsed.data.email);
      if (existingUser) {
        return res.status(409).json({ message: "Diese E-Mail-Adresse ist bereits registriert." });
      }

      const user = await authStorage.createPasswordUser({
        email: parsed.data.email,
        passwordHash: hashPassword(parsed.data.password),
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      });

      await establishLocalSession(req, {
        userId: user.id,
        kind: "password",
      });

      return res.json({ user: toPublicUser(user, "password") });
    } catch (error) {
      console.error("Error during password registration:", error);
      return res.status(500).json({ message: "Registrierung fehlgeschlagen" });
    }
  });

  app.post("/api/auth/login/password", async (req: any, res) => {
    try {
      const parsed = passwordLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const user = await authStorage.getUserByEmail(parsed.data.email);
      if (!user?.passwordHash || !user.email) {
        return res.status(401).json({ message: "E-Mail oder Passwort ist ungueltig." });
      }

      if (!verifyPassword(parsed.data.password, user.passwordHash)) {
        return res.status(401).json({ message: "E-Mail oder Passwort ist ungueltig." });
      }

      await establishLocalSession(req, {
        userId: user.id,
        kind: "password",
      });

      return res.json({ user: toPublicUser(user, "password") });
    } catch (error) {
      console.error("Error during password login:", error);
      return res.status(500).json({ message: "Login fehlgeschlagen" });
    }
  });

  app.post("/api/auth/employee-login", async (req: any, res) => {
    try {
      const parsed = employeeLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await storage.authenticateLocalEmployee(parsed.data);
      await establishLocalSession(req, {
        userId: result.userId,
        kind: "employee_access",
      });

      return res.json({
        employee: toPublicEmployee(result.employee),
        company: toPublicCompany(result.company),
        requiresPasswordChange: result.employee.mustChangePassword,
      });
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message;
        if (
          message === "Company access not found" ||
          message === "Employee access not found" ||
          message === "Invalid password" ||
          message === "Employee access is inactive"
        ) {
          return res.status(401).json({ message: "Betriebscode, Benutzername oder Passwort ist ungueltig." });
        }
      }

      console.error("Error during employee login:", error);
      return res.status(500).json({ message: "Login fehlgeschlagen" });
    }
  });

  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user?.auth_method !== "employee_access") {
        return res.status(400).json({ message: "Nur lokale Mitarbeiterkonten koennen hier ein Passwort setzen." });
      }

      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const employee = await storage.changeLocalEmployeePassword({
        userId,
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      });
      invalidateLocalAuthIdentity(userId, "employee_access");
      return res.json({ employee: toPublicEmployee(employee) });
    } catch (error) {
      if (error instanceof Error && error.message === "Current password is invalid") {
        return res.status(400).json({ message: "Das aktuelle Passwort ist ungueltig." });
      }

      console.error("Error changing employee password:", error);
      return res.status(500).json({ message: "Passwort konnte nicht aktualisiert werden." });
    }
  });

  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      if (PREVIEW_MODE) {
        return res.json(PREVIEW_AUTH_USER);
      }

      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(toPublicUser(user, req.user?.auth_method ?? "oidc"));
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
