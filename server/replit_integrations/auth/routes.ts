import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import {
  PREVIEW_AUTH_USER,
  PREVIEW_COMPANY_ID,
  PREVIEW_ADMIN_TOKEN,
  PREVIEW_EMPLOYEE_COOKIE,
  PREVIEW_MODE,
  toPreviewEmployeeSlug,
  normalizePreviewEmployeeToken,
} from "../../preview";
import { storage } from "../../storage";

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

  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      if (PREVIEW_MODE) {
        return res.json(PREVIEW_AUTH_USER);
      }

      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
