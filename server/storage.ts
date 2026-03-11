import {
  companies,
  employees,
  jobs,
  assignments,
  assignmentWorkers,
  timeEntries,
  breakEntries,
  photos,
  issueReports,
  type Company,
  type InsertCompany,
  type Employee,
  type InsertEmployee,
  type Job,
  type InsertJob,
  type Assignment,
  type InsertAssignment,
  type InsertAssignmentWorker,
  type TimeEntry,
  type InsertTimeEntry,
  type BreakEntry,
  type Photo,
  type InsertPhoto,
  type IssueReport,
  type InsertIssueReport,
} from "../shared/schema.ts";
import { db } from "./db";
import { PREVIEW_MODE } from "./preview";
import { PreviewStorage } from "./previewStorage";
import { eq, and, gte, lte, or, like, desc, asc, isNull, sql, inArray } from "drizzle-orm";

type CreateJobData = Omit<InsertJob, "jobNumber">;

function getEmployeeSortKey(employee: Pick<Employee, "firstName" | "lastName">) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export interface IStorage {
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByUserId(userId: string): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;

  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeForCompany(companyId: string, id: string): Promise<Employee | undefined>;
  getEmployeeByUserId(userId: string): Promise<Employee | undefined>;
  getEmployeesByCompany(companyId: string): Promise<Employee[]>;
  createEmployee(data: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined>;

  getJob(id: string): Promise<Job | undefined>;
  getJobForCompany(companyId: string, id: string): Promise<Job | undefined>;
  getJobsByCompany(companyId: string, includeArchived?: boolean): Promise<Job[]>;
  getUnassignedJobs(companyId: string): Promise<Job[]>;
  createJob(data: CreateJobData): Promise<Job>;
  updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined>;
  searchJobs(companyId: string, query: string): Promise<Job[]>;

  getAssignment(id: string): Promise<Assignment | undefined>;
  getAssignmentForCompany(companyId: string, id: string): Promise<Assignment | undefined>;
  getAssignmentsByDate(companyId: string, date: string): Promise<any[]>;
  getAssignmentsByDateRange(companyId: string, startDate: string, endDate: string): Promise<any[]>;
  getAssignmentsByEmployee(companyId: string, employeeId: string, date?: string, endDate?: string): Promise<any[]>;
  createAssignment(data: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: string, data: Partial<InsertAssignment>): Promise<Assignment | undefined>;
  deleteAssignment(id: string): Promise<boolean>;

  addWorkerToAssignment(data: InsertAssignmentWorker): Promise<void>;
  removeWorkerFromAssignment(companyId: string, assignmentId: string, employeeId: string): Promise<void>;
  getWorkersForAssignment(companyId: string, assignmentId: string): Promise<Employee[]>;

  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  getTimeEntryForAssignment(companyId: string, assignmentId: string, employeeId: string): Promise<TimeEntry | undefined>;
  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, data: Partial<TimeEntry>): Promise<TimeEntry | undefined>;
  getTimeEntriesByJob(companyId: string, jobId: string): Promise<TimeEntry[]>;

  createBreakEntry(companyId: string, timeEntryId: string): Promise<BreakEntry>;
  endBreakEntry(companyId: string, timeEntryId: string): Promise<BreakEntry | undefined>;
  getBreakEntriesByTimeEntry(companyId: string, timeEntryId: string): Promise<BreakEntry[]>;

  getPhotosByJob(companyId: string, jobId: string): Promise<Photo[]>;
  getPhotosByAssignment(companyId: string, assignmentId: string): Promise<Photo[]>;
  createPhoto(data: InsertPhoto): Promise<Photo>;

  getIssueReport(id: string): Promise<IssueReport | undefined>;
  getIssueReportForCompany(companyId: string, id: string): Promise<IssueReport | undefined>;
  getIssueReportsByJob(companyId: string, jobId: string): Promise<IssueReport[]>;
  getIssueReportsByAssignment(companyId: string, assignmentId: string): Promise<IssueReport[]>;
  createIssueReport(data: InsertIssueReport): Promise<IssueReport>;
  resolveIssueReport(companyId: string, id: string): Promise<IssueReport | undefined>;

  getDashboardStats(companyId: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompanyByUserId(userId: string): Promise<Company | undefined> {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.userId, userId));
    if (!employee) return undefined;
    return this.getCompany(employee.companyId);
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data).returning();
    return company;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async getEmployeeForCompany(companyId: string, id: string): Promise<Employee | undefined> {
    const [employee] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.companyId, companyId)));
    return employee;
  }

  async getEmployeeByUserId(userId: string): Promise<Employee | undefined> {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.userId, userId));
    return employee;
  }

  async getEmployeesByCompany(companyId: string): Promise<Employee[]> {
    return db
      .select()
      .from(employees)
      .where(eq(employees.companyId, companyId))
      .orderBy(asc(employees.firstName));
  }

  async createEmployee(data: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(data).returning();
    return employee;
  }

  async updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [employee] = await db
      .update(employees)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning();
    return employee;
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async getJobForCompany(companyId: string, id: string): Promise<Job | undefined> {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)));
    return job;
  }

  async getJobsByCompany(companyId: string, includeArchived = false): Promise<Job[]> {
    const conditions = [eq(jobs.companyId, companyId)];
    if (!includeArchived) {
      conditions.push(eq(jobs.isArchived, false));
    }
    return db
      .select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt));
  }

  async getUnassignedJobs(companyId: string): Promise<Job[]> {
    return db
      .select()
      .from(jobs)
      .leftJoin(
        assignments,
        and(
          eq(assignments.companyId, companyId),
          eq(assignments.jobId, jobs.id)
        )
      )
      .where(
        and(
          eq(jobs.companyId, companyId),
          eq(jobs.status, "planned"),
          eq(jobs.isArchived, false),
          isNull(assignments.id)
        )
      )
      .orderBy(desc(jobs.createdAt))
      .then((rows) => rows.map((row) => row.jobs));
  }

  async createJob(data: CreateJobData): Promise<Job> {
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.companyId, data.companyId));
    const num = Number(count[0].count) + 1;
    const jobNumber = `A-${String(num).padStart(4, "0")}`;
    const [job] = await db
      .insert(jobs)
      .values({ ...data, jobNumber })
      .returning();
    return job;
  }

  async updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return job;
  }

  async searchJobs(companyId: string, query: string): Promise<Job[]> {
    const q = `%${query}%`;
    return db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          or(
            like(jobs.customerName, q),
            like(jobs.title, q),
            like(jobs.addressCity, q),
            like(jobs.addressStreet, q),
            like(jobs.jobNumber, q)
          )
        )
      )
      .orderBy(desc(jobs.createdAt));
  }

  async getAssignment(id: string): Promise<Assignment | undefined> {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, id));
    return assignment;
  }

  async getAssignmentForCompany(companyId: string, id: string): Promise<Assignment | undefined> {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, id), eq(assignments.companyId, companyId)));
    return assignment;
  }

  async getAssignmentsByDate(companyId: string, date: string): Promise<any[]> {
    const rawAssignments = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.companyId, companyId),
          eq(assignments.assignmentDate, date)
        )
      )
      .orderBy(
        asc(assignments.sortOrder),
        asc(assignments.plannedStartTime),
        asc(assignments.createdAt)
      );
    return this.enrichAssignments(rawAssignments);
  }

  async getAssignmentsByDateRange(
    companyId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const rawAssignments = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.companyId, companyId),
          gte(assignments.assignmentDate, startDate),
          lte(assignments.assignmentDate, endDate)
        )
      )
      .orderBy(
        asc(assignments.assignmentDate),
        asc(assignments.sortOrder),
        asc(assignments.plannedStartTime),
        asc(assignments.createdAt)
      );
    return this.enrichAssignments(rawAssignments);
  }

  async getAssignmentsByEmployee(companyId: string, employeeId: string, date?: string, endDate?: string): Promise<any[]> {
    const conditions: any[] = [
      eq(assignmentWorkers.companyId, companyId),
      eq(assignments.companyId, companyId),
      eq(assignmentWorkers.employeeId, employeeId),
    ];
    if (date && endDate) {
      conditions.push(
        or(
          and(gte(assignments.assignmentDate, date), lte(assignments.assignmentDate, endDate)),
          inArray(assignments.status, ["en_route", "on_site", "break"])
        )
      );
    } else if (date) {
      conditions.push(
        or(
          eq(assignments.assignmentDate, date),
          inArray(assignments.status, ["en_route", "on_site", "break"])
        )
      );
    }

    const rawAssignments = await db
      .select({ assignment: assignments })
      .from(assignmentWorkers)
      .innerJoin(
        assignments,
        and(
          eq(assignmentWorkers.assignmentId, assignments.id),
          eq(assignmentWorkers.companyId, assignments.companyId)
        )
      )
      .where(and(...conditions))
      .orderBy(
        asc(assignments.assignmentDate),
        asc(assignments.sortOrder),
        asc(assignments.plannedStartTime),
        asc(assignments.createdAt)
      )
      .then((rows) => rows.map((row) => row.assignment));

    return this.enrichAssignments(rawAssignments);
  }

  private async getNextAssignmentSortOrder(
    companyId: string,
    assignmentDate: string
  ): Promise<number> {
    const [result] = await db
      .select({ maxSortOrder: sql<number>`coalesce(max(${assignments.sortOrder}), -1)` })
      .from(assignments)
      .where(
        and(
          eq(assignments.companyId, companyId),
          eq(assignments.assignmentDate, assignmentDate)
        )
      );

    return Number(result?.maxSortOrder ?? -1) + 1;
  }

  private async enrichAssignments(rawAssignments: Assignment[]): Promise<any[]> {
    if (rawAssignments.length === 0) {
      return [];
    }

    const companyId = rawAssignments[0].companyId;
    const jobIds = [...new Set(rawAssignments.map((assignment) => assignment.jobId))];
    const assignmentIds = rawAssignments.map((assignment) => assignment.id);

    const [jobRows, workerRows] = await Promise.all([
      db
        .select()
        .from(jobs)
        .where(
          and(eq(jobs.companyId, companyId), inArray(jobs.id, jobIds))
        ),
      db
        .select({
          assignmentId: assignmentWorkers.assignmentId,
          employee: employees,
        })
        .from(assignmentWorkers)
        .innerJoin(employees, eq(assignmentWorkers.employeeId, employees.id))
        .where(
          and(
            eq(assignmentWorkers.companyId, companyId),
            eq(employees.companyId, companyId),
            inArray(assignmentWorkers.assignmentId, assignmentIds)
          )
        ),
    ]);

    const jobsById = new Map(jobRows.map((job) => [job.id, job]));
    const workersByAssignmentId = new Map<string, Employee[]>();

    for (const row of workerRows) {
      const list = workersByAssignmentId.get(row.assignmentId) ?? [];
      list.push(row.employee);
      workersByAssignmentId.set(row.assignmentId, list);
    }

    return rawAssignments.map((assignment) => ({
      ...assignment,
      job: jobsById.get(assignment.jobId),
      workers:
        workersByAssignmentId
          .get(assignment.id)
          ?.sort((left, right) => getEmployeeSortKey(left).localeCompare(getEmployeeSortKey(right))) ?? [],
    }));
  }

  async createAssignment(data: InsertAssignment): Promise<Assignment> {
    const job = await this.getJobForCompany(data.companyId, data.jobId);
    if (!job) {
      throw new Error("Cross-tenant assignment blocked");
    }

    const sortOrder =
      data.sortOrder ??
      (await this.getNextAssignmentSortOrder(data.companyId, data.assignmentDate));

    const [assignment] = await db
      .insert(assignments)
      .values({ ...data, sortOrder })
      .returning();
    return assignment;
  }

  async updateAssignment(
    id: string,
    data: Partial<InsertAssignment>
  ): Promise<Assignment | undefined> {
    const [assignment] = await db
      .update(assignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(assignments.id, id))
      .returning();
    return assignment;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    await db.delete(assignmentWorkers).where(eq(assignmentWorkers.assignmentId, id));
    const [deleted] = await db.delete(assignments).where(eq(assignments.id, id)).returning();
    return !!deleted;
  }

  async addWorkerToAssignment(data: InsertAssignmentWorker): Promise<void> {
    const assignment = await this.getAssignmentForCompany(data.companyId, data.assignmentId);
    const employee = await this.getEmployeeForCompany(data.companyId, data.employeeId);

    if (!assignment || !employee) {
      throw new Error("Cross-tenant worker assignment blocked");
    }

    const existing = await db
      .select()
      .from(assignmentWorkers)
      .where(
        and(
          eq(assignmentWorkers.companyId, data.companyId),
          eq(assignmentWorkers.assignmentId, data.assignmentId),
          eq(assignmentWorkers.employeeId, data.employeeId)
        )
      );
    if (existing.length === 0) {
      await db.insert(assignmentWorkers).values(data);
    }
  }

  async removeWorkerFromAssignment(
    companyId: string,
    assignmentId: string,
    employeeId: string
  ): Promise<void> {
    await db
      .delete(assignmentWorkers)
      .where(
        and(
          eq(assignmentWorkers.companyId, companyId),
          eq(assignmentWorkers.assignmentId, assignmentId),
          eq(assignmentWorkers.employeeId, employeeId)
        )
      );
  }

  async getWorkersForAssignment(companyId: string, assignmentId: string): Promise<Employee[]> {
    const workers = await db
      .select()
      .from(assignmentWorkers)
      .innerJoin(employees, eq(assignmentWorkers.employeeId, employees.id))
      .where(
        and(
          eq(assignmentWorkers.companyId, companyId),
          eq(employees.companyId, companyId),
          eq(assignmentWorkers.assignmentId, assignmentId)
        )
      );
    return workers.map((w) => w.employees);
  }

  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id));
    return entry;
  }

  async getTimeEntryForAssignment(
    companyId: string,
    assignmentId: string,
    employeeId: string
  ): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.companyId, companyId),
          eq(timeEntries.assignmentId, assignmentId),
          eq(timeEntries.employeeId, employeeId)
        )
      );
    return entry;
  }

  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    const assignment = await this.getAssignmentForCompany(data.companyId, data.assignmentId);
    const employee = await this.getEmployeeForCompany(data.companyId, data.employeeId);
    const job = await this.getJobForCompany(data.companyId, data.jobId);

    if (!assignment || !employee || !job || assignment.jobId !== job.id) {
      throw new Error("Cross-tenant time entry blocked");
    }

    const [entry] = await db.insert(timeEntries).values(data).returning();
    return entry;
  }

  async updateTimeEntry(
    id: string,
    data: Partial<TimeEntry>
  ): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .update(timeEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(timeEntries.id, id))
      .returning();
    return entry;
  }

  async getTimeEntriesByJob(companyId: string, jobId: string): Promise<TimeEntry[]> {
    return db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.companyId, companyId), eq(timeEntries.jobId, jobId)))
      .orderBy(asc(timeEntries.startedAt));
  }

  async createBreakEntry(companyId: string, timeEntryId: string): Promise<BreakEntry> {
    const [timeEntry] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, timeEntryId), eq(timeEntries.companyId, companyId)));

    if (!timeEntry) {
      throw new Error("Cross-tenant break entry blocked");
    }

    const [entry] = await db
      .insert(breakEntries)
      .values({ companyId, timeEntryId, breakStart: new Date() })
      .returning();
    return entry;
  }

  async endBreakEntry(companyId: string, timeEntryId: string): Promise<BreakEntry | undefined> {
    const openBreaks = await db
      .select()
      .from(breakEntries)
      .where(
        and(
          eq(breakEntries.companyId, companyId),
          eq(breakEntries.timeEntryId, timeEntryId),
          isNull(breakEntries.breakEnd)
        )
      );
    if (openBreaks.length === 0) return undefined;
    const breakEntry = openBreaks[0];
    const now = new Date();
    const duration = Math.round(
      (now.getTime() - breakEntry.breakStart.getTime()) / 60000
    );
    const [updated] = await db
      .update(breakEntries)
      .set({ breakEnd: now, durationMinutes: duration })
      .where(eq(breakEntries.id, breakEntry.id))
      .returning();
    return updated;
  }

  async getBreakEntriesByTimeEntry(companyId: string, timeEntryId: string): Promise<BreakEntry[]> {
    return db
      .select()
      .from(breakEntries)
      .where(
        and(eq(breakEntries.companyId, companyId), eq(breakEntries.timeEntryId, timeEntryId))
      )
      .orderBy(asc(breakEntries.breakStart));
  }

  async getPhotosByJob(companyId: string, jobId: string): Promise<Photo[]> {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.companyId, companyId), eq(photos.jobId, jobId)))
      .orderBy(desc(photos.createdAt));
  }

  async getPhotosByAssignment(companyId: string, assignmentId: string): Promise<Photo[]> {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.companyId, companyId), eq(photos.assignmentId, assignmentId)))
      .orderBy(desc(photos.createdAt));
  }

  async createPhoto(data: InsertPhoto): Promise<Photo> {
    const job = await this.getJobForCompany(data.companyId, data.jobId);
    const employee = await this.getEmployeeForCompany(data.companyId, data.employeeId);
    const assignment = data.assignmentId
      ? await this.getAssignmentForCompany(data.companyId, data.assignmentId)
      : null;

    if (!job || !employee || (data.assignmentId && (!assignment || assignment.jobId !== job.id))) {
      throw new Error("Cross-tenant photo blocked");
    }

    const [photo] = await db.insert(photos).values(data).returning();
    return photo;
  }

  async getIssueReport(id: string): Promise<IssueReport | undefined> {
    const [report] = await db
      .select()
      .from(issueReports)
      .where(eq(issueReports.id, id));
    return report;
  }

  async getIssueReportForCompany(companyId: string, id: string): Promise<IssueReport | undefined> {
    const [report] = await db
      .select()
      .from(issueReports)
      .where(and(eq(issueReports.id, id), eq(issueReports.companyId, companyId)));
    return report;
  }

  async getIssueReportsByJob(companyId: string, jobId: string): Promise<IssueReport[]> {
    return db
      .select()
      .from(issueReports)
      .where(and(eq(issueReports.companyId, companyId), eq(issueReports.jobId, jobId)))
      .orderBy(desc(issueReports.createdAt));
  }

  async getIssueReportsByAssignment(companyId: string, assignmentId: string): Promise<IssueReport[]> {
    return db
      .select()
      .from(issueReports)
      .where(and(eq(issueReports.companyId, companyId), eq(issueReports.assignmentId, assignmentId)))
      .orderBy(desc(issueReports.createdAt));
  }

  async createIssueReport(data: InsertIssueReport): Promise<IssueReport> {
    const job = await this.getJobForCompany(data.companyId, data.jobId);
    const employee = await this.getEmployeeForCompany(data.companyId, data.employeeId);
    const assignment = await this.getAssignmentForCompany(data.companyId, data.assignmentId);

    if (!job || !employee || !assignment || assignment.jobId !== job.id) {
      throw new Error("Cross-tenant issue report blocked");
    }

    const [report] = await db.insert(issueReports).values(data).returning();
    return report;
  }

  async resolveIssueReport(companyId: string, id: string): Promise<IssueReport | undefined> {
    const [report] = await db
      .update(issueReports)
      .set({ resolved: true })
      .where(and(eq(issueReports.id, id), eq(issueReports.companyId, companyId)))
      .returning();
    return report;
  }

  async getDashboardStats(companyId: string): Promise<any> {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const todayAssignments = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.companyId, companyId),
          eq(assignments.assignmentDate, today)
        )
      );

    const problemAssignments = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.companyId, companyId),
          eq(assignments.status, "problem")
        )
      );

    const activeJobs = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          eq(jobs.isArchived, false)
        )
      );

    const unresolvedIssues = await db
      .select()
      .from(issueReports)
      .where(
        and(
          eq(issueReports.companyId, companyId),
          eq(issueReports.resolved, false)
        )
      );

    return {
      todayAssignmentCount: todayAssignments.length,
      problemCount: problemAssignments.length,
      activeJobCount: activeJobs.length,
      unresolvedIssueCount: unresolvedIssues.length,
      todayCompleted: todayAssignments.filter((a) => a.status === "completed").length,
      todayInProgress: todayAssignments.filter(
        (a) => a.status === "en_route" || a.status === "on_site"
      ).length,
    };
  }
}

export const storage: IStorage = PREVIEW_MODE
  ? (new PreviewStorage() as IStorage)
  : new DatabaseStorage();
