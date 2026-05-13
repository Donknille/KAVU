import type { Express, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import JSZip from "jszip";
import { asyncHandler } from "../asyncHandler.js";
import { db } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAuthenticated, authStorage } from "../replit_integrations/auth/index.js";
import {
  companies,
  employees,
  jobs,
  assignments,
  assignmentWorkers,
  timeEntries,
  breakEntries,
  companyInvitations,
} from "../../shared/schema.js";

// Fields that must never leave the server even on a self-export. They are
// either secrets (password_hash, token hashes) or operational state that has
// no meaning to the data subject.
function stripUser(user: any) {
  if (!user) return user;
  const {
    passwordHash,
    emailVerifyToken,
    emailVerifyExpires,
    passwordResetToken,
    passwordResetExpires,
    failedLoginAttempts,
    lockedUntil,
    ...rest
  } = user;
  return rest;
}

function stripEmployee(employee: any) {
  if (!employee) return employee;
  const {
    passwordHash,
    passwordIssuedAt,
    failedLoginAttempts,
    lockedUntil,
    ...rest
  } = employee;
  return rest;
}

function stripInvitation(invitation: any) {
  if (!invitation) return invitation;
  const { tokenHash, ...rest } = invitation;
  return rest;
}

function exportFilename(prefix: string, extension: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${prefix}-${stamp}.${extension}`;
}

export function registerDataExportRoutes(
  app: Express,
  requireAuth: (req: any, res: any, next: any) => void,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  // GDPR Art. 20: data subject's own data as a single JSON payload.
  app.get(
    "/api/me/export",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const employee = (req as any).employee;
      const userId = employee.userId;
      const user = userId ? await authStorage.getUser(userId) : null;

      const ownTimeEntries = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.companyId, req.companyId),
            eq(timeEntries.employeeId, employee.id),
          ),
        );

      const ownAssignmentRows = await db
        .select({
          assignmentId: assignmentWorkers.assignmentId,
        })
        .from(assignmentWorkers)
        .where(
          and(
            eq(assignmentWorkers.companyId, req.companyId),
            eq(assignmentWorkers.employeeId, employee.id),
          ),
        );

      const ownAssignmentIds = ownAssignmentRows.map((row) => row.assignmentId);
      const ownAssignments = ownAssignmentIds.length
        ? await db
            .select()
            .from(assignments)
            .where(
              and(
                eq(assignments.companyId, req.companyId),
                inArray(assignments.id, ownAssignmentIds),
              ),
            )
        : [];

      const payload = {
        exportedAt: new Date().toISOString(),
        article: "GDPR Art. 20 — data portability for the data subject",
        user: stripUser(user),
        employee: stripEmployee(employee),
        timeEntries: ownTimeEntries,
        assignments: ownAssignments,
      };

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportFilename("kavu-me-export", "json")}"`,
      );
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.send(JSON.stringify(payload, null, 2));
    }),
  );

  // GDPR Art. 20 for the tenant as a whole: a ZIP of one JSON per relation.
  // Limited to admins of the company; sensitive fields are stripped per table.
  app.get(
    "/api/companies/me/export",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, req.companyId))
        .then((rows) => rows[0]);

      if (!company) {
        return res.status(404).json({ message: "Company nicht gefunden." });
      }

      const [
        employeesList,
        jobsList,
        assignmentsList,
        assignmentWorkersList,
        timeEntriesList,
        breakEntriesList,
        invitationsList,
      ] = await Promise.all([
        db.select().from(employees).where(eq(employees.companyId, req.companyId)),
        db.select().from(jobs).where(eq(jobs.companyId, req.companyId)),
        db.select().from(assignments).where(eq(assignments.companyId, req.companyId)),
        db.select().from(assignmentWorkers).where(eq(assignmentWorkers.companyId, req.companyId)),
        db.select().from(timeEntries).where(eq(timeEntries.companyId, req.companyId)),
        db.select().from(breakEntries).where(eq(breakEntries.companyId, req.companyId)),
        db.select().from(companyInvitations).where(eq(companyInvitations.companyId, req.companyId)),
      ]);

      const zip = new JSZip();
      const meta = {
        exportedAt: new Date().toISOString(),
        companyId: req.companyId,
        article: "GDPR Art. 20 — company-wide data export",
        notes: [
          "passwordHash, token hashes and lockout state are stripped",
          "sessions table is not included (operational state, no GDPR subject)",
        ],
      };
      zip.file("_meta.json", JSON.stringify(meta, null, 2));
      zip.file("company.json", JSON.stringify(company, null, 2));
      zip.file(
        "employees.json",
        JSON.stringify(employeesList.map(stripEmployee), null, 2),
      );
      zip.file("jobs.json", JSON.stringify(jobsList, null, 2));
      zip.file("assignments.json", JSON.stringify(assignmentsList, null, 2));
      zip.file(
        "assignment_workers.json",
        JSON.stringify(assignmentWorkersList, null, 2),
      );
      zip.file("time_entries.json", JSON.stringify(timeEntriesList, null, 2));
      zip.file("break_entries.json", JSON.stringify(breakEntriesList, null, 2));
      zip.file(
        "company_invitations.json",
        JSON.stringify(invitationsList.map(stripInvitation), null, 2),
      );

      const buffer = await zip.generateAsync({ type: "nodebuffer" });
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportFilename("kavu-company-export", "zip")}"`,
      );
      res.setHeader("Content-Type", "application/zip");
      return res.send(buffer);
    }),
  );
}
