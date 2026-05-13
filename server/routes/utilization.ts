import type { Express, Response } from "express";
import { z } from "zod";
import { and, between, eq, gte, inArray, lte, or } from "drizzle-orm";
import { asyncHandler } from "../asyncHandler.js";
import { db } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import {
  assignmentWorkers,
  assignments,
  companies,
  employees,
  holidays,
  vacations,
} from "../../shared/schema.js";
import { calculateEmployeeUtilization, listWorkdays } from "../../shared/utilizationCalc.js";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const PER_ASSIGNMENT_HOURS = 8;

function eachDayInclusive(fromISO: string, toISO: string): string[] {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const start = new Date(fy, (fm ?? 1) - 1, fd ?? 1);
  const end = new Date(ty, (tm ?? 1) - 1, td ?? 1);
  const out: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    const dd = String(cursor.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
}

export function registerUtilizationRoutes(
  app: Express,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  app.get(
    "/api/utilization/employees",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const querySchema = z.object({
        from: z.string().regex(dateRegex),
        to: z.string().regex(dateRegex),
      });
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ message: "from und to (YYYY-MM-DD) sind Pflicht." });
      }
      if (parsed.data.to < parsed.data.from) {
        return res.status(400).json({ message: "to darf nicht vor from liegen." });
      }
      // Cap at ~120 calendar days to bound work; longer ranges should
      // paginate.
      const days = eachDayInclusive(parsed.data.from, parsed.data.to);
      if (days.length > 120) {
        return res.status(400).json({ message: "Zeitraum maximal 120 Tage." });
      }

      const company = await db
        .select({ regionCode: companies.regionCode })
        .from(companies)
        .where(eq(companies.id, req.companyId))
        .then((rows) => rows[0]);
      if (!company) return res.status(404).json({ message: "Company nicht gefunden." });

      const activeEmployees = await db
        .select()
        .from(employees)
        .where(and(eq(employees.companyId, req.companyId), eq(employees.isActive, true)));

      // Federal + state holidays inside the range.
      const holidayRows = await db
        .select({ date: holidays.date })
        .from(holidays)
        .where(
          and(
            or(eq(holidays.regionCode, "DE"), eq(holidays.regionCode, company.regionCode))!,
            between(holidays.date, parsed.data.from, parsed.data.to),
          ),
        );
      const holidayDates = new Set(holidayRows.map((row) => row.date));

      // Approved vacations that overlap the range.
      const vacationRows = await db
        .select()
        .from(vacations)
        .where(
          and(
            eq(vacations.companyId, req.companyId),
            eq(vacations.status, "approved"),
            lte(vacations.startDate, parsed.data.to),
            gte(vacations.endDate, parsed.data.from),
          ),
        );
      const vacationDatesByEmployee = new Map<string, Set<string>>();
      for (const vacation of vacationRows) {
        let bucket = vacationDatesByEmployee.get(vacation.employeeId);
        if (!bucket) {
          bucket = new Set();
          vacationDatesByEmployee.set(vacation.employeeId, bucket);
        }
        for (const day of eachDayInclusive(vacation.startDate, vacation.endDate)) {
          if (day < parsed.data.from || day > parsed.data.to) continue;
          bucket.add(day);
        }
      }

      // Assignments in range -> per-employee, per-date count -> hours.
      const assignmentRows = await db
        .select({ id: assignments.id, assignmentDate: assignments.assignmentDate })
        .from(assignments)
        .where(
          and(
            eq(assignments.companyId, req.companyId),
            between(assignments.assignmentDate, parsed.data.from, parsed.data.to),
          ),
        );
      const dateByAssignment = new Map<string, string>(
        assignmentRows.map((row) => [row.id, row.assignmentDate]),
      );
      const assignmentIds = assignmentRows.map((row) => row.id);
      const workerRows = assignmentIds.length
        ? await db
            .select({
              assignmentId: assignmentWorkers.assignmentId,
              employeeId: assignmentWorkers.employeeId,
            })
            .from(assignmentWorkers)
            .where(
              and(
                eq(assignmentWorkers.companyId, req.companyId),
                inArray(assignmentWorkers.assignmentId, assignmentIds),
              ),
            )
        : [];

      const plannedMinutesByEmployeeAndDate = new Map<string, Map<string, number>>();
      for (const row of workerRows) {
        const day = dateByAssignment.get(row.assignmentId);
        if (!day) continue;
        let bucket = plannedMinutesByEmployeeAndDate.get(row.employeeId);
        if (!bucket) {
          bucket = new Map();
          plannedMinutesByEmployeeAndDate.set(row.employeeId, bucket);
        }
        bucket.set(day, (bucket.get(day) ?? 0) + PER_ASSIGNMENT_HOURS * 60);
      }

      const result = activeEmployees.map((employee) => {
        const weeklyHours = Number(employee.weeklyHours ?? "40") || 0;
        const vacationDates = vacationDatesByEmployee.get(employee.id) ?? new Set<string>();
        const dayMap = plannedMinutesByEmployeeAndDate.get(employee.id);
        const plannedMinutesByDate: Record<string, number> = {};
        if (dayMap) {
          for (const [day, minutes] of dayMap.entries()) {
            plannedMinutesByDate[day] = minutes;
          }
        }
        const utilization = calculateEmployeeUtilization({
          rangeDays: listWorkdays(parsed.data.from, parsed.data.to),
          weeklyHours,
          holidayDates,
          vacationDates,
          plannedMinutesByDate,
        });
        return {
          employee: {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            color: employee.color,
            weeklyHours,
          },
          ...utilization,
        };
      });

      res.json({ from: parsed.data.from, to: parsed.data.to, employees: result });
    }),
  );
}
