import {
  type Assignment,
  type AssignmentWorker,
  type BreakEntry,
  type Company,
  type CompanyInvitation,
  type Employee,
  type InsertAssignment,
  type InsertAssignmentWorker,
  type InsertBreakEntry,
  type InsertCompany,
  type InsertCompanyInvitation,
  type InsertEmployee,
  type InsertJob,
  type InsertTimeEntry,
  type Job,
  type TimeEntry,
} from "../shared/schema.js";
import {
  PREVIEW_ADMIN_EMPLOYEE_ID,
  PREVIEW_ADMIN_USER_ID,
  PREVIEW_COMPANY_ID,
} from "./preview.js";
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
import type {
  AcceptCompanyInvitationData,
  CompanyInvitationWithToken,
  ChangeLocalEmployeePasswordData,
  CreateCompanyInvitationData,
  LocalEmployeeAuthenticationData,
  ProvisionEmployeeAccessData,
} from "./storage.js";

type CreateJobData = Omit<InsertJob, "jobNumber">;

function createId() {
  return crypto.randomUUID();
}

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function atTime(baseDate: Date, hours: number, minutes: number) {
  const value = new Date(baseDate);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function sortByCreatedDesc<T extends { createdAt: Date | null }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0),
  );
}

function sortByStartedAsc(entries: TimeEntry[]) {
  return [...entries].sort(
    (left, right) =>
      (left.startedAt?.getTime() ?? 0) - (right.startedAt?.getTime() ?? 0),
  );
}

function sortByAssignmentDate(assignments: Assignment[]) {
  return [...assignments].sort((left, right) => {
    const dateCompare = left.assignmentDate.localeCompare(right.assignmentDate);
    if (dateCompare !== 0) return dateCompare;
    const orderCompare = left.sortOrder - right.sortOrder;
    if (orderCompare !== 0) return orderCompare;
    return (left.plannedStartTime ?? "").localeCompare(right.plannedStartTime ?? "");
  });
}

function buildPreviewData() {
  const now = new Date();
  const monday = new Date(now);
  const dayOfWeek = monday.getDay();
  monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const previewCompany: Company = {
    id: PREVIEW_COMPANY_ID,
    name: "Musterbetrieb Demo GmbH",
    accessCode: "MPLAN2026",
    logoUrl: null,
    phone: "+49 89 1234567",
    createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    updatedAt: now,
  };

  const employees: Employee[] = [
    {
      id: PREVIEW_ADMIN_EMPLOYEE_ID,
      companyId: PREVIEW_COMPANY_ID,
      userId: PREVIEW_ADMIN_USER_ID,
      firstName: "Demo",
      lastName: "Admin",
      phone: "+49 170 0000001",
      loginId: null,
      passwordHash: null,
      mustChangePassword: false,
      passwordIssuedAt: null,
      role: "admin",
      isActive: true,
      color: "#2563eb",
      createdAt: previewCompany.createdAt,
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      userId: null,
      firstName: "Lena",
      lastName: "Bauer",
      phone: "+49 170 0000002",
      loginId: null,
      passwordHash: null,
      mustChangePassword: false,
      passwordIssuedAt: null,
      role: "employee",
      isActive: true,
      color: "#10b981",
      createdAt: previewCompany.createdAt,
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      userId: null,
      firstName: "Mehmet",
      lastName: "Yilmaz",
      phone: "+49 170 0000003",
      loginId: null,
      passwordHash: null,
      mustChangePassword: false,
      passwordIssuedAt: null,
      role: "employee",
      isActive: true,
      color: "#f59e0b",
      createdAt: previewCompany.createdAt,
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      userId: null,
      firstName: "Sarah",
      lastName: "Klein",
      phone: "+49 170 0000004",
      loginId: null,
      passwordHash: null,
      mustChangePassword: false,
      passwordIssuedAt: null,
      role: "employee",
      isActive: true,
      color: "#ef4444",
      createdAt: previewCompany.createdAt,
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      userId: null,
      firstName: "Jonas",
      lastName: "Richter",
      phone: "+49 170 0000005",
      loginId: null,
      passwordHash: null,
      mustChangePassword: false,
      passwordIssuedAt: null,
      role: "employee",
      isActive: true,
      color: "#8b5cf6",
      createdAt: previewCompany.createdAt,
      updatedAt: now,
    },
  ];

  const jobs: Job[] = [
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0001",
      customerName: "Familie Schmitt",
      addressStreet: "Sonnenweg 12",
      addressZip: "80331",
      addressCity: "Muenchen",
      contactName: "Herr Schmitt",
      contactPhone: "+49 89 5551234",
      title: "PV Anlage Dach 12kWp",
      description: "Montage einer 12kWp PV Anlage mit Speicher.",
      internalNote: "Geruest steht bereits.",
      category: "pv",
      status: "in_progress",
      startDate: toDateStr(monday),
      endDate: null,
      isArchived: false,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0002",
      customerName: "Bauprojekt Wagner",
      addressStreet: "Gartenstrasse 8",
      addressZip: "81369",
      addressCity: "Muenchen",
      contactName: "Frau Wagner",
      contactPhone: "+49 89 5552234",
      title: "Waermepumpe Neubau",
      description: "Installation einer Luft Wasser Waermepumpe.",
      internalNote: null,
      category: "heat_pump",
      status: "planned",
      startDate: toDateStr(new Date(monday.getTime() + 2 * 24 * 60 * 60 * 1000)),
      endDate: null,
      isArchived: false,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0003",
      customerName: "Elektro Otto",
      addressStreet: "Handwerkerhof 5",
      addressZip: "85748",
      addressCity: "Garching",
      contactName: "Herr Otto",
      contactPhone: "+49 89 5553234",
      title: "Service Wechselrichter",
      description: "Stoerung am Wechselrichter prüfen.",
      internalNote: "Kunde meldet sporadische Ausfaelle.",
      category: "service",
      status: "in_progress",
      startDate: toDateStr(new Date(monday.getTime() + 1 * 24 * 60 * 60 * 1000)),
      endDate: null,
      isArchived: false,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0004",
      customerName: "Praxis Neumann",
      addressStreet: "Marktplatz 3",
      addressZip: "82131",
      addressCity: "Gauting",
      contactName: "Frau Neumann",
      contactPhone: "+49 89 5554234",
      title: "SHK Sanierung Bad",
      description: "Leitungen, Armaturen und Heizung modernisieren.",
      internalNote: null,
      category: "shk",
      status: "planned",
      startDate: toDateStr(new Date(monday.getTime() + 3 * 24 * 60 * 60 * 1000)),
      endDate: null,
      isArchived: false,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0005",
      customerName: "Autohaus Becker",
      addressStreet: "Industriestrasse 22",
      addressZip: "80807",
      addressCity: "Muenchen",
      contactName: "Herr Becker",
      contactPhone: "+49 89 5555234",
      title: "Montage Solarcarport",
      description: "Solarcarport mit Wallbox Vorbereitung.",
      internalNote: null,
      category: "montage",
      status: "completed",
      startDate: toDateStr(new Date(monday.getTime() - 2 * 24 * 60 * 60 * 1000)),
      endDate: toDateStr(new Date(monday.getTime() - 1 * 24 * 60 * 60 * 1000)),
      isArchived: true,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0006",
      customerName: "Familie Becker",
      addressStreet: "Am Waldrand 11",
      addressZip: "82041",
      addressCity: "Oberhaching",
      contactName: "Herr Becker",
      contactPhone: "+49 89 5556234",
      title: "Heizung Notdienst",
      description: "Akute Stoerung an der Heizungsanlage.",
      internalNote: "Noch nicht disponiert.",
      category: "service",
      status: "planned",
      startDate: toDateStr(monday),
      endDate: null,
      isArchived: false,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0007",
      customerName: "Familie Lorenz",
      addressStreet: "Bergblick 4",
      addressZip: "82008",
      addressCity: "Unterhaching",
      contactName: "Frau Lorenz",
      contactPhone: "+49 89 5557234",
      title: "Kurzservice Waermepumpe",
      description: "Fehlermeldung prüfen und Sensor neu einmessen.",
      internalNote: "Vermutlich Termin unter zwei Stunden.",
      category: "service",
      status: "planned",
      startDate: toDateStr(new Date(monday.getTime() + 1 * 24 * 60 * 60 * 1000)),
      endDate: null,
      isArchived: false,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 36 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0008",
      customerName: "Kita Sternenhimmel",
      addressStreet: "Kinderweg 7",
      addressZip: "80995",
      addressCity: "Muenchen",
      contactName: "Herr Brandt",
      contactPhone: "+49 89 5558234",
      title: "Sanitaer Wartung EG",
      description: "Armaturen prüfen und zwei Ventile tauschen.",
      internalNote: "Kurzer Vormittagstermin, Hausmeister vor Ort.",
      category: "shk",
      status: "planned",
      startDate: toDateStr(new Date(monday.getTime() + 2 * 24 * 60 * 60 * 1000)),
      endDate: null,
      isArchived: false,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 30 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0009",
      customerName: "Baeckerei Hofmann",
      addressStreet: "Marktstrasse 19",
      addressZip: "82110",
      addressCity: "Germering",
      contactName: "Frau Hofmann",
      contactPhone: "+49 89 5559234",
      title: "PV Sichtprüfung Flachdach",
      description: "Kurztermin fuer Kontrolle nach Sturm.",
      internalNote: "Dachzugang ueber Hinterhof.",
      category: "pv",
      status: "planned",
      startDate: toDateStr(new Date(monday.getTime() + 3 * 24 * 60 * 60 * 1000)),
      endDate: null,
      isArchived: false,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0010",
      customerName: "Hausverwaltung Kern",
      addressStreet: "Tal 14",
      addressZip: "80331",
      addressCity: "Muenchen",
      contactName: "Herr Kern",
      contactPhone: "+49 89 5560234",
      title: "Heizkreis entlueften",
      description: "Zwei Wohnungen prüfen und Heizkreis entlueften.",
      internalNote: "Sehr kurzer Einsatz, eher Nachmittagsfenster.",
      category: "service",
      status: "planned",
      startDate: toDateStr(new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000)),
      endDate: null,
      isArchived: false,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobNumber: "A-0011",
      customerName: "Praxis Dr. Albrecht",
      addressStreet: "Bahnhofplatz 2",
      addressZip: "82054",
      addressCity: "Sauerlach",
      contactName: "Frau Albrecht",
      contactPhone: "+49 89 5561234",
      title: "Montage Kleinbauteile Technikraum",
      description: "Kleiner Montagetermin mit Nacharbeit aus Vorwoche.",
      internalNote: "Ein Mann, maximal halber Tag.",
      category: "montage",
      status: "planned",
      startDate: toDateStr(new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000)),
      endDate: null,
      isArchived: false,
      createdBy: PREVIEW_ADMIN_USER_ID,
      createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      updatedAt: now,
    },
  ];

  const assignments: Assignment[] = [
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobId: jobs[0].id,
      assignmentDate: toDateStr(monday),
      plannedStartTime: "07:30",
      plannedEndTime: "16:00",
      sortOrder: 0,
      note: "Module zuerst prüfen, dann Speicher anklemmen.",
      status: "on_site",
      createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobId: jobs[1].id,
      assignmentDate: toDateStr(new Date(monday.getTime() + 2 * 24 * 60 * 60 * 1000)),
      plannedStartTime: "07:00",
      plannedEndTime: "16:00",
      sortOrder: 0,
      note: "Material liegt auf der Baustelle bereit.",
      status: "planned",
      createdAt: new Date(now.getTime() - 36 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobId: jobs[2].id,
      assignmentDate: toDateStr(new Date(monday.getTime() + 1 * 24 * 60 * 60 * 1000)),
      plannedStartTime: "09:00",
      plannedEndTime: "12:00",
      sortOrder: 0,
      note: "Fehlerbild mit Kunde abstimmen.",
      status: "on_site",
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobId: jobs[3].id,
      assignmentDate: toDateStr(new Date(monday.getTime() + 3 * 24 * 60 * 60 * 1000)),
      plannedStartTime: "08:00",
      plannedEndTime: "17:00",
      sortOrder: 0,
      note: null,
      status: "planned",
      createdAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobId: jobs[4].id,
      assignmentDate: toDateStr(new Date(monday.getTime() - 2 * 24 * 60 * 60 * 1000)),
      plannedStartTime: "07:30",
      plannedEndTime: "15:30",
      sortOrder: 0,
      note: "Archivierter Einsatz als Referenz.",
      status: "completed",
      createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
  ];

  const assignmentWorkers: AssignmentWorker[] = [
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      assignmentId: assignments[0].id,
      employeeId: PREVIEW_ADMIN_EMPLOYEE_ID,
      createdAt: assignments[0].createdAt,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      assignmentId: assignments[0].id,
      employeeId: employees[1].id,
      createdAt: assignments[0].createdAt,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      assignmentId: assignments[1].id,
      employeeId: employees[1].id,
      createdAt: assignments[1].createdAt,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      assignmentId: assignments[1].id,
      employeeId: employees[2].id,
      createdAt: assignments[1].createdAt,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      assignmentId: assignments[2].id,
      employeeId: employees[3].id,
      createdAt: assignments[2].createdAt,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      assignmentId: assignments[3].id,
      employeeId: employees[4].id,
      createdAt: assignments[3].createdAt,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      assignmentId: assignments[4].id,
      employeeId: PREVIEW_ADMIN_EMPLOYEE_ID,
      createdAt: assignments[4].createdAt,
    },
  ];

  const timeEntries: TimeEntry[] = [
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobId: jobs[0].id,
      assignmentId: assignments[0].id,
      employeeId: PREVIEW_ADMIN_EMPLOYEE_ID,
      startedAt: atTime(monday, 7, 35),
      arrivedAt: atTime(monday, 8, 5),
      endedAt: null,
      totalMinutes: null,
      status: "on_site",
      createdAt: assignments[0].createdAt,
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobId: jobs[0].id,
      assignmentId: assignments[0].id,
      employeeId: employees[1].id,
      startedAt: atTime(monday, 7, 32),
      arrivedAt: atTime(monday, 8, 3),
      endedAt: null,
      totalMinutes: null,
      status: "on_site",
      createdAt: assignments[0].createdAt,
      updatedAt: now,
    },
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      jobId: jobs[4].id,
      assignmentId: assignments[4].id,
      employeeId: PREVIEW_ADMIN_EMPLOYEE_ID,
      startedAt: atTime(new Date(monday.getTime() - 2 * 24 * 60 * 60 * 1000), 7, 30),
      arrivedAt: atTime(new Date(monday.getTime() - 2 * 24 * 60 * 60 * 1000), 8, 0),
      endedAt: atTime(new Date(monday.getTime() - 2 * 24 * 60 * 60 * 1000), 15, 45),
      totalMinutes: 435,
      status: "completed",
      createdAt: assignments[4].createdAt,
      updatedAt: assignments[4].updatedAt,
    },
  ];

  const breakEntries: BreakEntry[] = [
    {
      id: createId(),
      companyId: PREVIEW_COMPANY_ID,
      timeEntryId: timeEntries[2].id,
      breakStart: atTime(new Date(monday.getTime() - 2 * 24 * 60 * 60 * 1000), 12, 0),
      breakEnd: atTime(new Date(monday.getTime() - 2 * 24 * 60 * 60 * 1000), 12, 30),
      durationMinutes: 30,
    },
  ];

  return {
    companies: [previewCompany],
    companyInvitations: [] as CompanyInvitation[],
    employees,
    jobs,
    assignments,
    assignmentWorkers,
    timeEntries,
    breakEntries,
  };
}

export class PreviewStorage {
  private data = buildPreviewData();

  private async ensureUserLinkAvailable(userId: string, currentEmployeeId?: string) {
    const existingEmployee = await this.getEmployeeByUserId(userId);
    if (existingEmployee && existingEmployee.id !== currentEmployeeId) {
      throw new UserTenantConflictError();
    }
  }

  private generateUniqueCompanyAccessCode() {
    while (true) {
      const accessCode = generateCompanyAccessCode();
      if (!this.data.companies.some((company) => company.accessCode === accessCode)) {
        return accessCode;
      }
    }
  }

  private resolveUniqueEmployeeLoginId(
    companyId: string,
    firstName: string,
    lastName: string,
    explicitLoginId?: string | null,
    currentEmployeeId?: string,
  ) {
    const baseCandidates = buildEmployeeLoginCandidates(firstName, lastName, explicitLoginId);

    for (const candidate of baseCandidates) {
      const existingEmployee = this.data.employees.find(
        (employee) => employee.companyId === companyId && employee.loginId === candidate,
      );
      if (!existingEmployee || existingEmployee.id === currentEmployeeId) {
        return candidate;
      }
    }

    const fallbackBase = baseCandidates[0] || "mitarbeiter";
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const fallback = `${fallbackBase}.${attempt}`.slice(0, 80);
      const existingEmployee = this.data.employees.find(
        (employee) => employee.companyId === companyId && employee.loginId === fallback,
      );
      if (!existingEmployee || existingEmployee.id === currentEmployeeId) {
        return fallback;
      }
    }

    throw new Error("Unable to generate a unique employee login");
  }

  async getAllCompanies() {
    return [...this.data.companies];
  }

  async getCompany(id: string) {
    return this.data.companies.find((company) => company.id === id);
  }

  async getCompanyByAccessCode(accessCode: string) {
    const normalizedCode = normalizeCompanyAccessCode(accessCode);
    return this.data.companies.find((company) => company.accessCode === normalizedCode);
  }

  async getCompanyByUserId(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    if (!employee) return undefined;
    return this.getCompany(employee.companyId);
  }

  async createCompany(data: InsertCompany) {
    const company: Company = {
      id: createId(),
      name: data.name,
      accessCode: data.accessCode ?? this.generateUniqueCompanyAccessCode(),
      logoUrl: data.logoUrl ?? null,
      phone: data.phone ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.companies.push(company);
    return company;
  }

  async createCompanyWithAdmin(data: {
    companyName: string;
    userId: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    await this.ensureUserLinkAvailable(data.userId);

    const company = await this.createCompany({ name: data.companyName });
    const employee = await this.createEmployee({
      companyId: company.id,
      userId: data.userId,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: "admin",
      isActive: true,
    });

    return { company, employee };
  }

  async updateCompany(id: string, data: Partial<InsertCompany>) {
    const company = this.data.companies.find((item) => item.id === id);
    if (!company) return undefined;
    Object.assign(company, data, { updatedAt: new Date() });
    return company;
  }

  async deleteCompanyWithAllData(id: string) {
    const before = this.data.companies.length;
    this.data.breakEntries = this.data.breakEntries.filter((e) => e.companyId !== id);
    this.data.timeEntries = this.data.timeEntries.filter((e) => e.companyId !== id);
    this.data.assignmentWorkers = this.data.assignmentWorkers.filter((e) => e.companyId !== id);
    this.data.assignments = this.data.assignments.filter((e) => e.companyId !== id);
    this.data.jobs = this.data.jobs.filter((e) => e.companyId !== id);
    this.data.companyInvitations = this.data.companyInvitations.filter((e) => e.companyId !== id);
    this.data.employees = this.data.employees.filter((e) => e.companyId !== id);
    this.data.companies = this.data.companies.filter((e) => e.id !== id);
    return this.data.companies.length < before;
  }

  async getEmployee(id: string) {
    return this.data.employees.find((employee) => employee.id === id);
  }

  async getEmployeeForCompany(companyId: string, id: string) {
    return this.data.employees.find(
      (employee) => employee.id === id && employee.companyId === companyId,
    );
  }

  async getEmployeeByUserId(userId: string) {
    return this.data.employees.find((employee) => employee.userId === userId);
  }

  async getEmployeeByLoginId(companyId: string, loginId: string) {
    const normalizedLoginId = normalizeEmployeeLoginId(loginId);
    if (!normalizedLoginId) {
      return undefined;
    }

    return this.data.employees.find(
      (employee) => employee.companyId === companyId && employee.loginId === normalizedLoginId,
    );
  }

  async getEmployeesByCompany(companyId: string) {
    return [...this.data.employees]
      .filter((employee) => employee.companyId === companyId)
      .sort((left, right) => left.firstName.localeCompare(right.firstName));
  }

  async createEmployee(data: InsertEmployee) {
    if (data.userId) {
      await this.ensureUserLinkAvailable(data.userId);
    }

    const employee: Employee = {
      id: createId(),
      companyId: data.companyId,
      userId: data.userId ?? null,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
      loginId: data.loginId ? normalizeEmployeeLoginId(data.loginId) : null,
      passwordHash: data.passwordHash ?? null,
      mustChangePassword: data.mustChangePassword ?? false,
      passwordIssuedAt: data.passwordIssuedAt ?? null,
      role: data.role ?? "employee",
      isActive: data.isActive ?? true,
      color: data.color ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.employees.push(employee);
    return employee;
  }

  async updateEmployee(companyId: string, id: string, data: Partial<InsertEmployee>) {
    if (data.userId) {
      await this.ensureUserLinkAvailable(data.userId, id);
    }

    const employee = this.data.employees.find(
      (item) => item.id === id && item.companyId === companyId,
    );
    if (!employee) return undefined;
    Object.assign(employee, {
      ...data,
      loginId: data.loginId === undefined
        ? employee.loginId
        : data.loginId
          ? normalizeEmployeeLoginId(data.loginId)
          : null,
      updatedAt: new Date(),
    });
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

    if (!company.accessCode) {
      company.accessCode = this.generateUniqueCompanyAccessCode();
      company.updatedAt = new Date();
    }

    const loginId =
      employee.loginId ??
      this.resolveUniqueEmployeeLoginId(
        data.companyId,
        employee.firstName,
        employee.lastName,
        data.loginId,
        employee.id,
      );
    const temporaryPassword = generateTemporaryPassword();

    employee.userId = employee.userId ?? createLocalUserId();
    employee.loginId = loginId;
    employee.passwordHash = hashEmployeePassword(temporaryPassword);
    employee.mustChangePassword = true;
    employee.passwordIssuedAt = new Date();
    employee.updatedAt = new Date();

    return {
      employee,
      company,
      access: {
        companyAccessCode: company.accessCode,
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

    employee.passwordHash = hashEmployeePassword(data.newPassword);
    employee.mustChangePassword = false;
    employee.passwordIssuedAt = new Date();
    employee.updatedAt = new Date();
    return employee;
  }

  async getCompanyInvitation(id: string) {
    return this.data.companyInvitations.find((invitation) => invitation.id === id);
  }

  async getCompanyInvitationForCompany(companyId: string, id: string) {
    return this.data.companyInvitations.find(
      (invitation) => invitation.id === id && invitation.companyId === companyId,
    );
  }

  async getCompanyInvitationByToken(token: string) {
    const tokenHash = hashInvitationToken(token);
    return this.data.companyInvitations.find((invitation) => invitation.tokenHash === tokenHash);
  }

  async getActiveCompanyInvitationByToken(token: string) {
    const invitation = await this.getCompanyInvitationByToken(token);
    if (!invitation) return undefined;
    if (invitation.revokedAt || invitation.acceptedAt) return undefined;
    if (isInvitationExpired(invitation.expiresAt)) return undefined;
    return invitation;
  }

  async getCompanyInvitationsByCompany(companyId: string) {
    return sortByCreatedDesc(
      this.data.companyInvitations.filter((invitation) => invitation.companyId === companyId),
    );
  }

  async createCompanyInvitation(
    data: CreateCompanyInvitationData,
  ): Promise<CompanyInvitationWithToken> {
    const token = createInvitationToken();
    const invitation: CompanyInvitation = {
      id: createId(),
      companyId: data.companyId,
      email: normalizeInvitationEmail(data.email),
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
      role: data.role,
      invitedByUserId: data.invitedByUserId ?? null,
      acceptedByUserId: null,
      tokenHash: hashInvitationToken(token),
      expiresAt: getInvitationExpiry(),
      lastSentAt: null,
      sendAttempts: 0,
      lastSendError: null,
      acceptedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.companyInvitations.push(invitation);
    return { invitation, token };
  }

  async reissueCompanyInvitation(companyId: string, id: string) {
    const invitation = await this.getCompanyInvitationForCompany(companyId, id);
    if (!invitation) {
      return undefined;
    }
    if (invitation.revokedAt) {
      throw new Error("Invitation revoked");
    }
    if (invitation.acceptedAt) {
      throw new Error("Invitation already accepted");
    }

    const token = createInvitationToken();
    invitation.tokenHash = hashInvitationToken(token);
    invitation.expiresAt = getInvitationExpiry();
    invitation.updatedAt = new Date();

    return { invitation, token };
  }

  async recordCompanyInvitationDelivery(
    companyId: string,
    id: string,
    result: { delivered: boolean; errorMessage?: string | null },
  ) {
    const invitation = await this.getCompanyInvitationForCompany(companyId, id);
    if (!invitation) {
      return undefined;
    }

    invitation.sendAttempts += 1;
    if (result.delivered) {
      invitation.lastSentAt = new Date();
      invitation.lastSendError = null;
    } else {
      invitation.lastSendError =
        result.errorMessage?.trim().slice(0, 500) || "Einladungsversand fehlgeschlagen.";
    }
    invitation.updatedAt = new Date();

    return invitation;
  }

  async acceptCompanyInvitation(data: AcceptCompanyInvitationData) {
    await this.ensureUserLinkAvailable(data.userId);

    const invitation = await this.getCompanyInvitationByToken(data.token);
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

    const company = await this.getCompany(invitation.companyId);
    if (!company) {
      throw new Error("Invitation company not found");
    }

    const employee = await this.createEmployee({
      companyId: invitation.companyId,
      userId: data.userId,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      phone: invitation.phone ?? undefined,
      role: invitation.role,
      isActive: true,
    });

    invitation.acceptedAt = new Date();
    invitation.acceptedByUserId = data.userId;
    invitation.updatedAt = new Date();

    return { invitation, employee, company };
  }

  async revokeCompanyInvitation(companyId: string, id: string) {
    const invitation = await this.getCompanyInvitationForCompany(companyId, id);
    if (!invitation) return undefined;
    invitation.revokedAt = new Date();
    invitation.updatedAt = new Date();
    return invitation;
  }

  async getJob(id: string) {
    return this.data.jobs.find((job) => job.id === id);
  }

  async getJobForCompany(companyId: string, id: string) {
    return this.data.jobs.find((job) => job.id === id && job.companyId === companyId);
  }

  async getJobsByCompany(companyId: string, includeArchived = false) {
    const jobs = this.data.jobs.filter(
      (job) => job.companyId === companyId && (includeArchived || !job.isArchived),
    );
    return sortByCreatedDesc(jobs);
  }

  async getUnassignedJobs(companyId: string) {
    return this.data.jobs.filter((job) => {
      if (job.companyId !== companyId || job.isArchived || job.status !== "planned") {
        return false;
      }
      return !this.data.assignments.some((assignment) => assignment.jobId === job.id);
    });
  }

  async createJob(data: CreateJobData) {
    const nextNumber = this.data.jobs.length + 1;
    const job: Job = {
      id: createId(),
      companyId: data.companyId,
      jobNumber: `A-${String(nextNumber).padStart(4, "0")}`,
      customerName: data.customerName,
      addressStreet: data.addressStreet ?? null,
      addressZip: data.addressZip ?? null,
      addressCity: data.addressCity ?? null,
      contactName: data.contactName ?? null,
      contactPhone: data.contactPhone ?? null,
      title: data.title,
      description: data.description ?? null,
      internalNote: data.internalNote ?? null,
      category: data.category ?? null,
      status: data.status ?? "planned",
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      isArchived: data.isArchived ?? false,
      createdBy: data.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.jobs.unshift(job);
    return job;
  }

  async updateJob(companyId: string, id: string, data: Partial<InsertJob>) {
    const job = this.data.jobs.find((item) => item.id === id && item.companyId === companyId);
    if (!job) return undefined;
    Object.assign(job, data, { updatedAt: new Date() });
    return job;
  }

  async searchJobs(companyId: string, query: string) {
    const term = query.trim().toLowerCase();
    if (!term) return this.getJobsByCompany(companyId, true);
    return this.data.jobs.filter((job) => {
      if (job.companyId !== companyId) return false;
      return [
        job.customerName,
        job.title,
        job.addressCity,
        job.addressStreet,
        job.jobNumber,
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }

  async getAssignment(id: string) {
    return this.data.assignments.find((assignment) => assignment.id === id);
  }

  async getAssignmentForCompany(companyId: string, id: string) {
    return this.data.assignments.find(
      (assignment) => assignment.id === id && assignment.companyId === companyId,
    );
  }

  async getAssignmentsByDate(companyId: string, date: string) {
    const assignments = this.data.assignments.filter(
      (assignment) =>
        assignment.companyId === companyId && assignment.assignmentDate === date,
    );
    return this.enrichAssignments(sortByAssignmentDate(assignments));
  }

  async getAssignmentsByDateRange(companyId: string, startDate: string, endDate: string) {
    const assignments = this.data.assignments.filter(
      (assignment) =>
        assignment.companyId === companyId &&
        assignment.assignmentDate >= startDate &&
        assignment.assignmentDate <= endDate,
    );
    return this.enrichAssignments(sortByAssignmentDate(assignments));
  }

  async getAssignmentsByEmployee(companyId: string, employeeId: string, date?: string, endDate?: string) {
    const assignmentIds = this.data.assignmentWorkers
      .filter(
        (item) => item.companyId === companyId && item.employeeId === employeeId,
      )
      .map((item) => item.assignmentId);
    const activeStatuses = new Set(["en_route", "on_site", "break"]);

    const assignments = this.data.assignments.filter((assignment) => {
      if (assignment.companyId !== companyId) return false;
      if (!assignmentIds.includes(assignment.id)) return false;
      if (date && endDate) {
        if (
          (assignment.assignmentDate < date || assignment.assignmentDate > endDate) &&
          !activeStatuses.has(assignment.status)
        ) {
          return false;
        }
      } else if (date && assignment.assignmentDate !== date && !activeStatuses.has(assignment.status)) {
        return false;
      }
      return true;
    });

    return this.enrichAssignments(sortByAssignmentDate(assignments));
  }

  private async enrichAssignments(assignments: Assignment[]) {
    return Promise.all(
      assignments.map(async (assignment) => ({
        ...assignment,
        job: await this.getJobForCompany(assignment.companyId, assignment.jobId),
        workers: await this.getWorkersForAssignment(assignment.companyId, assignment.id),
      })),
    );
  }

  async createAssignment(data: InsertAssignment) {
    const job = await this.getJobForCompany(data.companyId, data.jobId);
    if (!job) {
      throw new Error("Cross-tenant assignment blocked");
    }

    const nextSortOrder =
      data.sortOrder ??
      this.data.assignments.filter(
        (assignment) =>
          assignment.companyId === data.companyId &&
          assignment.assignmentDate === data.assignmentDate,
      ).length;

    const assignment: Assignment = {
      id: createId(),
      companyId: data.companyId,
      jobId: data.jobId,
      assignmentDate: data.assignmentDate,
      plannedStartTime: data.plannedStartTime ?? null,
      plannedEndTime: data.plannedEndTime ?? null,
      sortOrder: nextSortOrder,
      note: data.note ?? null,
      status: data.status ?? "planned",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.assignments.push(assignment);
    return assignment;
  }

  async updateAssignment(companyId: string, id: string, data: Partial<InsertAssignment>) {
    const assignment = this.data.assignments.find(
      (item) => item.id === id && item.companyId === companyId,
    );
    if (!assignment) return undefined;
    Object.assign(assignment, data, { updatedAt: new Date() });
    return assignment;
  }

  async deleteAssignment(companyId: string, id: string) {
    const beforeLength = this.data.assignments.length;
    this.data.assignments = this.data.assignments.filter(
      (assignment) => assignment.id !== id || assignment.companyId !== companyId,
    );
    this.data.assignmentWorkers = this.data.assignmentWorkers.filter(
      (worker) => worker.assignmentId !== id || worker.companyId !== companyId,
    );
    const removedTimeEntryIds = this.data.timeEntries
      .filter((entry) => entry.assignmentId === id && entry.companyId === companyId)
      .map((entry) => entry.id);
    this.data.timeEntries = this.data.timeEntries.filter(
      (entry) => entry.assignmentId !== id || entry.companyId !== companyId,
    );
    this.data.breakEntries = this.data.breakEntries.filter(
      (entry) => entry.companyId !== companyId || !removedTimeEntryIds.includes(entry.timeEntryId),
    );
    return beforeLength !== this.data.assignments.length;
  }

  async addWorkerToAssignment(data: InsertAssignmentWorker) {
    const assignment = await this.getAssignmentForCompany(data.companyId, data.assignmentId);
    const employee = await this.getEmployeeForCompany(data.companyId, data.employeeId);
    if (!assignment || !employee) {
      throw new Error("Cross-tenant worker assignment blocked");
    }

    const exists = this.data.assignmentWorkers.some(
      (worker) =>
        worker.companyId === data.companyId &&
        worker.assignmentId === data.assignmentId &&
        worker.employeeId === data.employeeId,
    );
    if (exists) return;
    this.data.assignmentWorkers.push({
      id: createId(),
      companyId: data.companyId,
      assignmentId: data.assignmentId,
      employeeId: data.employeeId,
      createdAt: new Date(),
    });
  }

  async removeWorkerFromAssignment(companyId: string, assignmentId: string, employeeId: string) {
    this.data.assignmentWorkers = this.data.assignmentWorkers.filter(
      (worker) =>
        worker.companyId !== companyId ||
        worker.assignmentId !== assignmentId ||
        worker.employeeId !== employeeId,
    );
  }

  async getWorkersForAssignment(companyId: string, assignmentId: string) {
    const workerIds = this.data.assignmentWorkers
      .filter(
        (worker) => worker.companyId === companyId && worker.assignmentId === assignmentId,
      )
      .map((worker) => worker.employeeId);
    return this.data.employees.filter(
      (employee) => employee.companyId === companyId && workerIds.includes(employee.id),
    );
  }

  async getTimeEntry(id: string) {
    return this.data.timeEntries.find((entry) => entry.id === id);
  }

  async getTimeEntryForAssignment(companyId: string, assignmentId: string, employeeId: string) {
    return this.data.timeEntries.find(
      (entry) =>
        entry.companyId === companyId &&
        entry.assignmentId === assignmentId && entry.employeeId === employeeId,
    );
  }

  async createTimeEntry(data: InsertTimeEntry) {
    const assignment = await this.getAssignmentForCompany(data.companyId, data.assignmentId);
    const employee = await this.getEmployeeForCompany(data.companyId, data.employeeId);
    const job = await this.getJobForCompany(data.companyId, data.jobId);

    if (!assignment || !employee || !job || assignment.jobId !== job.id) {
      throw new Error("Cross-tenant time entry blocked");
    }

    const entry: TimeEntry = {
      id: createId(),
      companyId: data.companyId,
      jobId: data.jobId,
      assignmentId: data.assignmentId,
      employeeId: data.employeeId,
      startedAt: data.startedAt ?? null,
      arrivedAt: data.arrivedAt ?? null,
      endedAt: data.endedAt ?? null,
      totalMinutes: data.totalMinutes ?? null,
      status: data.status ?? "planned",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.timeEntries.push(entry);
    return entry;
  }

  async updateTimeEntry(companyId: string, id: string, data: Partial<TimeEntry>) {
    const entry = this.data.timeEntries.find(
      (item) => item.id === id && item.companyId === companyId,
    );
    if (!entry) return undefined;
    Object.assign(entry, data, { updatedAt: new Date() });
    return entry;
  }

  async getTimeEntriesByJob(companyId: string, jobId: string) {
    const entries = this.data.timeEntries.filter(
      (entry) => entry.companyId === companyId && entry.jobId === jobId,
    );
    return sortByStartedAsc(entries);
  }

  async createBreakEntry(companyId: string, timeEntryId: string) {
    const timeEntry = this.data.timeEntries.find(
      (entry) => entry.id === timeEntryId && entry.companyId === companyId,
    );
    if (!timeEntry) {
      throw new Error("Cross-tenant break entry blocked");
    }

    const entry: BreakEntry = {
      id: createId(),
      companyId,
      timeEntryId,
      breakStart: new Date(),
      breakEnd: null,
      durationMinutes: null,
    };
    this.data.breakEntries.push(entry);
    return entry;
  }

  async endBreakEntry(companyId: string, timeEntryId: string) {
    const openBreak = [...this.data.breakEntries]
      .reverse()
      .find(
        (entry) =>
          entry.companyId === companyId &&
          entry.timeEntryId === timeEntryId &&
          !entry.breakEnd,
      );
    if (!openBreak) return undefined;
    const breakEnd = new Date();
    openBreak.breakEnd = breakEnd;
    openBreak.durationMinutes = Math.max(
      0,
      Math.round((breakEnd.getTime() - openBreak.breakStart.getTime()) / 60000),
    );
    return openBreak;
  }

  async getBreakEntriesByTimeEntry(companyId: string, timeEntryId: string) {
    return this.data.breakEntries
      .filter(
        (entry) => entry.companyId === companyId && entry.timeEntryId === timeEntryId,
      )
      .sort((left, right) => left.breakStart.getTime() - right.breakStart.getTime());
  }

  async getDashboardStats(companyId: string) {
    const today = toDateStr(new Date());
    const todayAssignments = this.data.assignments.filter(
      (assignment) =>
        assignment.companyId === companyId && assignment.assignmentDate === today,
    );
    const activeJobs = this.data.jobs.filter(
      (job) => job.companyId === companyId && !job.isArchived,
    );

    return {
      todayAssignmentCount: todayAssignments.length,
      activeJobCount: activeJobs.length,
      todayCompleted: todayAssignments.filter(
        (assignment) => assignment.status === "completed",
      ).length,
      todayInProgress: todayAssignments.filter((assignment) =>
        ["en_route", "on_site"].includes(assignment.status),
      ).length,
    };
  }
}
