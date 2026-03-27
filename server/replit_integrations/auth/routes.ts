import crypto from "node:crypto";
import type { Express } from "express";
import { z } from "zod";
import { authStorage } from "./storage.js";
import { isAuthenticated } from "./replitAuth.js";
import { invalidateLocalAuthIdentity } from "./replitAuth.js";
import { hashPassword, verifyPassword } from "../../passwords.js";
import { invalidateCompanyReadCaches } from "../../readCaches.js";
import { sendVerificationEmail } from "../../emailVerification.js";

// Constant-time dummy hash to prevent username enumeration via timing attacks.
// Called even when a user is not found, so response time stays consistent.
const DUMMY_HASH = hashPassword("__timing_protection_dummy__");
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
        `${PREVIEW_EMPLOYEE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`,
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
          `${PREVIEW_EMPLOYEE_COOKIE}=${encodeURIComponent(employee.id)}; Path=/; SameSite=Lax; HttpOnly`,
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

      const verifyToken = crypto.randomBytes(32).toString("hex");
      const verifyExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const user = await authStorage.createPasswordUser({
        email: parsed.data.email,
        passwordHash: hashPassword(parsed.data.password),
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        emailVerified: false,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
      });

      await establishLocalSession(req, {
        userId: user.id,
        kind: "password",
      });

      // Send verification email (fire-and-forget, don't block registration)
      void sendVerificationEmail({
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        token: verifyToken,
        baseUrl: `${req.protocol}://${req.get("host")}`,
      }).catch((err) => console.error("[email-verify] Failed to send:", err));

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
        verifyPassword(parsed.data.password, DUMMY_HASH); // constant-time: prevent username enumeration
        return res.status(401).json({ message: "E-Mail oder Passwort ist ungültig." });
      }

      if (!verifyPassword(parsed.data.password, user.passwordHash)) {
        return res.status(401).json({ message: "E-Mail oder Passwort ist ungültig." });
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

  // Email verification
  app.get("/api/auth/verify-email", async (req: any, res) => {
    try {
      const token = String(req.query.token ?? "");
      if (!token) {
        return res.status(400).json({ message: "Token fehlt." });
      }

      const user = await authStorage.getUserByVerifyToken(token);
      if (!user) {
        return res.status(400).json({ message: "Ungueltiger oder abgelaufener Link." });
      }
      if (user.emailVerifyExpires && new Date(user.emailVerifyExpires) < new Date()) {
        return res.status(400).json({ message: "Der Link ist abgelaufen. Bitte fordere einen neuen an." });
      }

      await authStorage.markEmailVerified(user.id);
      // Redirect to app with success message
      return res.redirect("/?verified=1");
    } catch (error) {
      console.error("Error verifying email:", error);
      return res.status(500).json({ message: "Verifizierung fehlgeschlagen." });
    }
  });

  // Resend verification email
  app.post("/api/auth/resend-verification", isAuthenticated, async (req: any, res) => {
    try {
      const user = await authStorage.getUserById(req.session?.localAuth?.userId);
      if (!user?.email) {
        return res.status(400).json({ message: "Kein Account gefunden." });
      }
      if (user.emailVerified) {
        return res.json({ message: "E-Mail bereits bestaetigt." });
      }

      const verifyToken = crypto.randomBytes(32).toString("hex");
      const verifyExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await authStorage.setVerifyToken(user.id, verifyToken, verifyExpires);

      await sendVerificationEmail({
        email: user.email,
        firstName: user.firstName ?? undefined,
        token: verifyToken,
        baseUrl: `${req.protocol}://${req.get("host")}`,
      });

      return res.json({ message: "Bestaetigungsmail gesendet." });
    } catch (error) {
      console.error("Error resending verification:", error);
      return res.status(500).json({ message: "Senden fehlgeschlagen." });
    }
  });

  // Forgot password — send reset email
  app.post("/api/auth/forgot-password", async (req: any, res) => {
    try {
      const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Bitte geben Sie eine gueltige E-Mail-Adresse ein." });
      }

      const user = await authStorage.getUserByEmail(parsed.data.email);
      // Always return success to prevent email enumeration
      if (!user?.passwordHash) {
        return res.json({ message: "Falls ein Account mit dieser E-Mail existiert, erhalten Sie einen Link." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await authStorage.setPasswordResetToken(user.id, resetToken, resetExpires);

      const { sendPasswordResetEmail } = await import("../../emailVerification.js");
      void sendPasswordResetEmail({
        email: parsed.data.email,
        firstName: user.firstName ?? undefined,
        token: resetToken,
        baseUrl: `${req.protocol}://${req.get("host")}`,
      }).catch((err) => console.error("[password-reset] Failed to send:", err));

      return res.json({ message: "Falls ein Account mit dieser E-Mail existiert, erhalten Sie einen Link." });
    } catch (error) {
      console.error("Error in forgot-password:", error);
      return res.status(500).json({ message: "Anfrage fehlgeschlagen." });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req: any, res) => {
    try {
      const parsed = z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Mindestens 8 Zeichen"),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Ungueltiger Token oder Passwort zu kurz." });
      }

      const user = await authStorage.getUserByResetToken(parsed.data.token);
      if (!user) {
        return res.status(400).json({ message: "Ungueltiger oder abgelaufener Link." });
      }
      if (user.passwordResetExpires && new Date(user.passwordResetExpires) < new Date()) {
        return res.status(400).json({ message: "Der Link ist abgelaufen. Bitte fordern Sie einen neuen an." });
      }

      await authStorage.updateUserPassword(user.id, hashPassword(parsed.data.password));
      await authStorage.clearPasswordResetToken(user.id);

      return res.json({ message: "Passwort erfolgreich geaendert. Sie koennen sich jetzt anmelden." });
    } catch (error) {
      console.error("Error in reset-password:", error);
      return res.status(500).json({ message: "Zuruecksetzen fehlgeschlagen." });
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
          return res.status(401).json({ message: "Betriebscode, Benutzername oder Passwort ist ungültig." });
        }
      }

      console.error("Error during employee login:", error);
      return res.status(500).json({ message: "Login fehlgeschlagen" });
    }
  });

  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user?.auth_method !== "employee_access") {
        return res.status(400).json({ message: "Nur lokale Mitarbeiterkonten können hier ein Passwort setzen." });
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
      invalidateCompanyReadCaches(employee.companyId);
      return res.json({ employee: toPublicEmployee(employee) });
    } catch (error) {
      if (error instanceof Error && error.message === "Current password is invalid") {
        return res.status(400).json({ message: "Das aktuelle Passwort ist ungültig." });
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
