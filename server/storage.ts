import {
  companies,
  companyInvitations,
  employees,
  jobs,
  assignments,
  assignmentWorkers,
  timeEntries,
  breakEntries,
  type Company,
  type InsertCompany,
  type Employee,
  type InsertEmployee,
  type CompanyInvitation,
  type InsertCompanyInvitation,
  type Job,
  type InsertJob,
  type Assignment,
  type InsertAssignment,
  type InsertAssignmentWorker,
  type TimeEntry,
  type InsertTimeEntry,
  type BreakEntry,
} from "../shared/schema.js";
import { db } from "./db.js";
import { PREVIEW_MODE } from "./preview.js";
import { PreviewStorage } from "./previewStorage.js";
import { eq, and, gte, lte, or, like, desc, asc, isNull, sql, inArray } from "drizzle-orm";
import { UserTenantConflictError } from "./tenantErrors.js";
import {
  createInvitationToken,
  getInvitationExpiry,
  hashInvitationToken,
  isInvitationExpired,
  normalizeInvitationEmail,
} from "./companyInvitations.js";
import {
  buildEmployeeLoginCandidates,
  createLocalUserId,
  generateCompanyAccessCode,
  generateTemporaryPassword,
  hashEmployeePassword,
  normalizeCompanyAccessCode,
  normalizeEmployeeLoginId,
  verifyEmployeePassword,
} from "./employeeAccess.js";
import { authStorage } from "./replit_integrations/auth/storage.js";
import { users } from "../shared/models/auth.js";

type CreateJobData = Omit<InsertJob, "jobNumber">;
export type CreateCompanyWithAdminData = {
  companyName: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string;
};
export type CreateCompanyInvitationData = {
  companyId: string;
  invitedByUserId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: "admin" | "employee";
};
export type AcceptCompanyInvitationData = {
  token: string;
  userId: string;
  userEmail: string;
};
export type CompanyInvitationWithToken = {
  invitation: CompanyInvitation;
  token: string;
};
export type CompanyInvitationDeliveryUpdate = {
  delivered: boolean;
  errorMessage?: string | null;
};
export type LocalEmployeeAccess = {
  companyAccessCode: string;
  loginId: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
};
export type ProvisionEmployeeAccessData = {
  companyId: string;
  employeeId: string;
  loginId?: string | null;
};
export type LocalEmployeeAuthenticationData = {
  companyAccessCode: string;
  loginId: string;
  password: string;
};
export type ChangeLocalEmployeePasswordData = {
  userId: string;
  currentPassword: string;
  newPassword: string;
};

function getEmployeeSortKey(employee: Pick<Employee, "firstName" | "lastName">) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export interface IStorage {
  getAllCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByAccessCode(accessCode: string): Promise<Company | undefined>;
  getCompanyByUserId(userId: string): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  createCompanyWithAdmin(
    data: CreateCompanyWithAdminData,
  ): Promise<{ company: Company; employee: Employee }>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompanyWithAllData(id: string): Promise<boolean>;

  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeForCompany(companyId: string, id: string): Promise<Employee | undefined>;
  getEmployeeByUserId(userId: string): Promise<Employee | undefined>;
  getEmployeeByLoginId(companyId: string, loginId: string): Promise<Employee | undefined>;
  getEmployeesByCompany(companyId: string): Promise<Employee[]>;
  createEmployee(data: InsertEmployee): Promise<Employee>;
  updateEmployee(
    companyId: string,
    id: string,
    data: Partial<InsertEmployee>,
  ): Promise<Employee | undefined>;
  provisionEmployeeAccess(
    data: ProvisionEmployeeAccessData,
  ): Promise<{ employee: Employee; company: Company; access: LocalEmployeeAccess }>;
  authenticateLocalEmployee(
    data: LocalEmployeeAuthenticationData,
  ): Promise<{ employee: Employee; company: Company; userId: string }>;
  changeLocalEmployeePassword(data: ChangeLocalEmployeePasswordData): Promise<Employee>;

  getCompanyInvitation(id: string): Promise<CompanyInvitation | undefined>;
  getCompanyInvitationForCompany(
    companyId: string,
    id: string,
  ): Promise<CompanyInvitation | undefined>;
  getCompanyInvitationByToken(token: string): Promise<CompanyInvitation | undefined>;
  getActiveCompanyInvitationByToken(token: string): Promise<CompanyInvitation | undefined>;
  getCompanyInvitationsByCompany(companyId: string): Promise<CompanyInvitation[]>;
  createCompanyInvitation(data: CreateCompanyInvitationData): Promise<CompanyInvitationWithToken>;
  reissueCompanyInvitation(
    companyId: string,
    id: string,
  ): Promise<CompanyInvitationWithToken | undefined>;
  recordCompanyInvitationDelivery(
    companyId: string,
    id: string,
    result: CompanyInvitationDeliveryUpdate,
  ): Promise<CompanyInvitation | undefined>;
  acceptCompanyInvitation(
    data: AcceptCompanyInvitationData,
  ): Promise<{ invitation: CompanyInvitation; employee: Employee; company: Company }>;
  revokeCompanyInvitation(
    companyId: string,
    id: string,
  ): Promise<CompanyInvitation | undefined>;

  getJob(id: string): Promise<Job | undefined>;
  getJobForCompany(companyId: string, id: string): Promise<Job | undefined>;
  getJobsByCompany(companyId: string, includeArchived?: boolean): Promise<Job[]>;
  getUnassignedJobs(companyId: string): Promise<Job[]>;
  createJob(data: CreateJobData): Promise<Job>;
  updateJob(
    companyId: string,
    id: string,
    data: Partial<InsertJob>,
  ): Promise<Job | undefined>;
  searchJobs(companyId: string, query: string): Promise<Job[]>;

  getAssignment(id: string): Promise<Assignment | undefined>;
  getAssignmentForCompany(companyId: string, id: string): Promise<Assignment | undefined>;
  getAssignmentsForCompanyByIds(companyId: string, ids: string[]): Promise<(Assignment | undefined)[]>;
  getAssignmentsByDate(companyId: string, date: string): Promise<any[]>;
  getAssignmentsByDateRange(companyId: string, startDate: string, endDate: string): Promise<any[]>;
  getAssignmentsByEmployee(companyId: string, employeeId: string, date?: string, endDate?: string): Promise<any[]>;
  createAssignment(data: InsertAssignment): Promise<Assignment>;
  updateAssignment(
    companyId: string,
    id: string,
    data: Partial<InsertAssignment>,
  ): Promise<Assignment | undefined>;
  deleteAssignment(companyId: string, id: string): Promise<boolean>;

  addWorkerToAssignment(data: InsertAssignmentWorker): Promise<void>;
  removeWorkerFromAssignment(companyId: string, assignmentId: string, employeeId: string): Promise<void>;
  getWorkersForAssignment(companyId: string, assignmentId: string): Promise<Employee[]>;

  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  getTimeEntryForAssignment(companyId: string, assignmentId: string, employeeId: string): Promise<TimeEntry | undefined>;
  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(
    companyId: string,
    id: string,
    data: Partial<TimeEntry>,
  ): Promise<TimeEntry | undefined>;
  getTimeEntriesByJob(companyId: string, jobId: string): Promise<TimeEntry[]>;

  createBreakEntry(companyId: string, timeEntryId: string): Promise<BreakEntry>;
  endBreakEntry(companyId: string, timeEntryId: string): Promise<BreakEntry | undefined>;
  getBreakEntriesByTimeEntry(companyId: string, timeEntryId: string): Promise<BreakEntry[]>;

  getDashboardStats(companyId: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  private async ensureUserLinkAvailable(userId: string, currentEmployeeId?: string) {
    const existingEmployee = await this.getEmployeeByUserId(userId);
    if (existingEmployee && existingEmployee.id !== currentEmployeeId) {
      throw new UserTenantConflictError();
    }
  }

  private async generateUniqueCompanyAccessCode(tx: any = db) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const accessCode = generateCompanyAccessCode();
      const [existingCompany] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.accessCode, accessCode));

      if (!existingCompany) {
        return accessCode;
      }
    }

    throw new Error("Unable to generate a unique company access code");
  }

  private async resolveUniqueEmployeeLoginId(
    companyId: string,
    firstName: string,
    lastName: string,
    explicitLoginId?: string | null,
    currentEmployeeId?: string,
  ) {
    const candidates = buildEmployeeLoginCandidates(firstName, lastName, explicitLoginId);

    for (const candidate of candidates) {
      const [existingEmployee] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.companyId, companyId),
            eq(employees.loginId, candidate),
          ),
        );

      if (!existingEmployee || existingEmployee.id === currentEmployeeId) {
        return candidate;
      }
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const fallback = `${buildEmployeeLoginCandidates(firstName, lastName)[0] || "mitarbeiter"}.${attempt + 1}`.slice(0, 80);
      const [existingEmployee] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.companyId, companyId),
            eq(employees.loginId, fallback),
          ),
        );

      if (!existingEmployee || existingEmployee.id === currentEmployeeId) {
        return fallback;
      }
    }

    throw new Error("Unable to generate a unique employee login");
  }

  async getAllCompanies(): Promise<Company[]> {
    return db.select().from(companies).orderBy(companies.createdAt);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompanyByAccessCode(accessCode: string): Promise<Company | undefined> {
    const normalizedCode = normalizeCompanyAccessCode(accessCode);
    if (!normalizedCode) {
      return undefined;
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.accessCode, normalizedCode));
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
    const [company] = await db
      .insert(companies)
      .values({
        ...data,
        accessCode: data.accessCode ?? (await this.generateUniqueCompanyAccessCode()),
      })
      .returning();
    return company;
  }

  async createCompanyWithAdmin(data: CreateCompanyWithAdminData) {
    return db.transaction(async (tx) => {
      const [existingEmployee] = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.userId, data.userId));

      if (existingEmployee) {
        throw new UserTenantConflictError();
      }

      const [company] = await tx
        .insert(companies)
        .values({
          name: data.companyName,
          accessCode: await this.generateUniqueCompanyAccessCode(tx),
        })
        .returning();

      const [employee] = await tx
        .insert(employees)
        .values({
          companyId: company.id,
          userId: data.userId,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: "admin",
          isActive: true,
        })
        .returning();

      return { company, employee };
    });
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  async deleteCompanyWithAllData(id: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      // Collect userIds before deleting employees
      const emps = await tx
        .select({ userId: employees.userId })
        .from(employees)
        .where(eq(employees.companyId, id));
      const userIds = emps.map((e) => e.userId).filter(Boolean) as string[];

      // Delete in dependency order (leaves first)
      await tx.delete(breakEntries).where(eq(breakEntries.companyId, id));
      await tx.delete(timeEntries).where(eq(timeEntries.companyId, id));
      await tx.delete(assignmentWorkers).where(eq(assignmentWorkers.companyId, id));
      await tx.delete(assignments).where(eq(assignments.companyId, id));
      await tx.delete(jobs).where(eq(jobs.companyId, id));
      await tx.delete(companyInvitations).where(eq(companyInvitations.companyId, id));
      await tx.delete(employees).where(eq(employees.companyId, id));
      const [deleted] = await tx.delete(companies).where(eq(companies.id, id)).returning();

      // Delete orphaned auth users
      for (const uid of userIds) {
        await tx.delete(users).where(eq(users.id, uid));
      }

      return !!deleted;
    });
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

  async getEmployeeByLoginId(companyId: string, loginId: string): Promise<Employee | undefined> {
    const normalizedLoginId = normalizeEmployeeLoginId(loginId);
    if (!normalizedLoginId) {
      return undefined;
    }

    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.companyId, companyId),
          eq(employees.loginId, normalizedLoginId),
        ),
      );
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
    if (data.userId) {
      await this.ensureUserLinkAvailable(data.userId);
    }

    const [employee] = await db
      .insert(employees)
      .values({
        ...data,
        loginId: data.loginId ? normalizeEmployeeLoginId(data.loginId) : null,
      })
      .returning();
    return employee;
  }

  async updateEmployee(
    companyId: string,
    id: string,
    data: Partial<InsertEmployee>,
  ): Promise<Employee | undefined> {
    if (data.userId) {
      await this.ensureUserLinkAvailable(data.userId, id);
    }

    const [employee] = await db
      .update(employees)
      .set({
        ...data,
        loginId: data.loginId === undefined
          ? undefined
          : data.loginId
            ? normalizeEmployeeLoginId(data.loginId)
            : null,
        updatedAt: new Date(),
      })
      .where(and(eq(employees.id, id), eq(employees.companyId, companyId)))
      .returning();
    return employee;
  }

  async provisionEmployeeAccess(data: ProvisionEmployeeAccessData) {
    const employee = await this.getEmployeeForCompany(data.companyId, data.employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    const company = await this.getCompany(data.companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    const companyAccessCode = company.accessCode ?? (await this.generateUniqueCompanyAccessCode());
    const loginId =
      employee.loginId ??
      (await this.resolveUniqueEmployeeLoginId(
        data.companyId,
        employee.firstName,
        employee.lastName,
        data.loginId,
        employee.id,
      ));
    const temporaryPassword = generateTemporaryPassword();
    const userId = employee.userId ?? createLocalUserId();
    const existingUser = await authStorage.getUser(userId);

    await authStorage.upsertUser({
      id: userId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: existingUser?.email ?? null,
      profileImageUrl: existingUser?.profileImageUrl ?? null,
    });

    const [updatedCompany] =
      company.accessCode
        ? [company]
        : await db
            .update(companies)
            .set({ accessCode: companyAccessCode, updatedAt: new Date() })
            .where(eq(companies.id, company.id))
            .returning();
    const resolvedCompany = updatedCompany ?? { ...company, accessCode: companyAccessCode };

    const [updatedEmployee] = await db
      .update(employees)
      .set({
        userId,
        loginId,
        passwordHash: hashEmployeePassword(temporaryPassword),
        mustChangePassword: true,
        passwordIssuedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(employees.id, employee.id), eq(employees.companyId, data.companyId)))
      .returning();

    if (!updatedEmployee) {
      throw new Error("Employee access could not be provisioned");
    }

    return {
      employee: updatedEmployee,
      company: resolvedCompany,
      access: {
        companyAccessCode,
        loginId,
        temporaryPassword,
        mustChangePassword: true,
      },
    };
  }

  async authenticateLocalEmployee(data: LocalEmployeeAuthenticationData) {
    const company = await this.getCompanyByAccessCode(data.companyAccessCode);
    if (!company) {
      throw new Error("Company access not found");
    }

    const employee = await this.getEmployeeByLoginId(company.id, data.loginId);
    if (!employee || !employee.passwordHash || !employee.userId) {
      throw new Error("Employee access not found");
    }

    if (!employee.isActive) {
      throw new Error("Employee access is inactive");
    }

    if (!verifyEmployeePassword(data.password, employee.passwordHash)) {
      throw new Error("Invalid password");
    }

    const existingUser = await authStorage.getUser(employee.userId);
    await authStorage.upsertUser({
      id: employee.userId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: existingUser?.email ?? null,
      profileImageUrl: existingUser?.profileImageUrl ?? null,
    });

    return {
      employee,
      company,
      userId: employee.userId,
    };
  }

  async changeLocalEmployeePassword(data: ChangeLocalEmployeePasswordData) {
    const employee = await this.getEmployeeByUserId(data.userId);
    if (!employee || !employee.passwordHash) {
      throw new Error("Local employee access not found");
    }

    if (!verifyEmployeePassword(data.currentPassword, employee.passwordHash)) {
      throw new Error("Current password is invalid");
    }

    const [updatedEmployee] = await db
      .update(employees)
      .set({
        passwordHash: hashEmployeePassword(data.newPassword),
        mustChangePassword: false,
        passwordIssuedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(employees.id, employee.id))
      .returning();

    if (!updatedEmployee) {
      throw new Error("Local employee access could not be updated");
    }

    return updatedEmployee;
  }

  async getCompanyInvitation(id: string): Promise<CompanyInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(companyInvitations)
      .where(eq(companyInvitations.id, id));
    return invitation;
  }

  async getCompanyInvitationForCompany(
    companyId: string,
    id: string,
  ): Promise<CompanyInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(companyInvitations)
      .where(
        and(
          eq(companyInvitations.id, id),
          eq(companyInvitations.companyId, companyId),
        ),
      );
    return invitation;
  }

  async getCompanyInvitationByToken(token: string): Promise<CompanyInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(companyInvitations)
      .where(eq(companyInvitations.tokenHash, hashInvitationToken(token)));
    return invitation;
  }

  async getActiveCompanyInvitationByToken(token: string) {
    const invitation = await this.getCompanyInvitationByToken(token);
    if (!invitation) return undefined;
    if (invitation.revokedAt || invitation.acceptedAt) return undefined;
    if (isInvitationExpired(invitation.expiresAt)) return undefined;
    return invitation;
  }

  async getCompanyInvitationsByCompany(companyId: string): Promise<CompanyInvitation[]> {
    return db
      .select()
      .from(companyInvitations)
      .where(eq(companyInvitations.companyId, companyId))
      .orderBy(desc(companyInvitations.createdAt));
  }

  async createCompanyInvitation(
    data: CreateCompanyInvitationData,
  ): Promise<CompanyInvitationWithToken> {
    const token = createInvitationToken();
    const [invitation] = await db
      .insert(companyInvitations)
      .values({
        companyId: data.companyId,
        invitedByUserId: data.invitedByUserId ?? null,
        email: normalizeInvitationEmail(data.email),
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
        tokenHash: hashInvitationToken(token),
        expiresAt: getInvitationExpiry(),
        sendAttempts: 0,
        lastSentAt: null,
        lastSendError: null,
      })
      .returning();

    return { invitation, token };
  }

  async reissueCompanyInvitation(companyId: string, id: string) {
    const existingInvitation = await this.getCompanyInvitationForCompany(companyId, id);
    if (!existingInvitation) {
      return undefined;
    }
    if (existingInvitation.revokedAt) {
      throw new Error("Invitation revoked");
    }
    if (existingInvitation.acceptedAt) {
      throw new Error("Invitation already accepted");
    }

    const token = createInvitationToken();
    const [invitation] = await db
      .update(companyInvitations)
      .set({
        tokenHash: hashInvitationToken(token),
        expiresAt: getInvitationExpiry(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companyInvitations.id, id),
          eq(companyInvitations.companyId, companyId),
          isNull(companyInvitations.acceptedAt),
          isNull(companyInvitations.revokedAt),
        ),
      )
      .returning();

    if (!invitation) {
      throw new Error("Invitation already claimed");
    }

    return { invitation, token };
  }

  async recordCompanyInvitationDelivery(
    companyId: string,
    id: string,
    result: CompanyInvitationDeliveryUpdate,
  ) {
    const invitation = await this.getCompanyInvitationForCompany(companyId, id);
    if (!invitation) {
      return undefined;
    }

    const lastSendError = result.delivered
      ? null
      : result.errorMessage?.trim().slice(0, 500) || "Einladungsversand fehlgeschlagen.";
    const now = new Date();
    const [updatedInvitation] = await db
      .update(companyInvitations)
      .set({
        sendAttempts: invitation.sendAttempts + 1,
        lastSendError,
        updatedAt: now,
        ...(result.delivered ? { lastSentAt: now } : {}),
      })
      .where(
        and(
          eq(companyInvitations.id, id),
          eq(companyInvitations.companyId, companyId),
        ),
      )
      .returning();

    return updatedInvitation;
  }

  async acceptCompanyInvitation(data: AcceptCompanyInvitationData) {
    await this.ensureUserLinkAvailable(data.userId);

    return db.transaction(async (tx) => {
      const [invitation] = await tx
        .select()
        .from(companyInvitations)
        .where(eq(companyInvitations.tokenHash, hashInvitationToken(data.token)));

      if (!invitation) {
        throw new Error("Invitation not found");
      }
      if (invitation.revokedAt) {
        throw new Error("Invitation revoked");
      }
      if (invitation.acceptedAt) {
        throw new Error("Invitation already accepted");
      }
      if (isInvitationExpired(invitation.expiresAt)) {
        throw new Error("Invitation expired");
      }
      if (normalizeInvitationEmail(data.userEmail) !== normalizeInvitationEmail(invitation.email)) {
        throw new Error("Invitation email mismatch");
      }

      const [company] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, invitation.companyId));
      if (!company) {
        throw new Error("Invitation company not found");
      }

      const [claimedInvitation] = await tx
        .update(companyInvitations)
        .set({
          acceptedAt: new Date(),
          acceptedByUserId: data.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(companyInvitations.id, invitation.id),
            isNull(companyInvitations.acceptedAt),
            isNull(companyInvitations.revokedAt),
          ),
        )
        .returning();

      if (!claimedInvitation) {
        throw new Error("Invitation already claimed");
      }

      const [employee] = await tx
        .insert(employees)
        .values({
          companyId: invitation.companyId,
          userId: data.userId,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          phone: invitation.phone,
          role: invitation.role,
          isActive: true,
        })
        .returning();

      return {
        invitation: claimedInvitation,
        employee,
        company,
      };
    });
  }

  async revokeCompanyInvitation(companyId: string, id: string) {
    const [invitation] = await db
      .update(companyInvitations)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companyInvitations.id, id),
          eq(companyInvitations.companyId, companyId),
        ),
      )
      .returning();
    return invitation;
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

  async updateJob(
    companyId: string,
    id: string,
    data: Partial<InsertJob>,
  ): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
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

  async getAssignmentsForCompanyByIds(companyId: string, ids: string[]): Promise<(Assignment | undefined)[]> {
    if (ids.length === 0) return [];
    const rows = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.companyId, companyId), inArray(assignments.id, ids)));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id));
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
    companyId: string,
    id: string,
    data: Partial<InsertAssignment>
  ): Promise<Assignment | undefined> {
    const [assignment] = await db
      .update(assignments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(assignments.id, id), eq(assignments.companyId, companyId)))
      .returning();
    return assignment;
  }

  async deleteAssignment(companyId: string, id: string): Promise<boolean> {
    await db
      .delete(assignmentWorkers)
      .where(
        and(
          eq(assignmentWorkers.assignmentId, id),
          eq(assignmentWorkers.companyId, companyId),
        ),
      );
    const [deleted] = await db
      .delete(assignments)
      .where(and(eq(assignments.id, id), eq(assignments.companyId, companyId)))
      .returning();
    return !!deleted;
  }

  async addWorkerToAssignment(data: InsertAssignmentWorker): Promise<void> {
    const [assignment, employee] = await Promise.all([
      this.getAssignmentForCompany(data.companyId, data.assignmentId),
      this.getEmployeeForCompany(data.companyId, data.employeeId),
    ]);

    if (!assignment || !employee) {
      throw new Error("Cross-tenant worker assignment blocked");
    }

    await db.insert(assignmentWorkers).values(data).onConflictDoNothing();
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
    companyId: string,
    id: string,
    data: Partial<TimeEntry>
  ): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .update(timeEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.companyId, companyId)))
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

    const activeJobs = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          eq(jobs.isArchived, false)
        )
      );

    return {
      todayAssignmentCount: todayAssignments.length,
      activeJobCount: activeJobs.length,
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
