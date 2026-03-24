export * from "./models/auth.js";

import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  time,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth.js";

export const roleEnum = pgEnum("role", ["admin", "employee"]);
export const jobStatusEnum = pgEnum("job_status", [
  "planned",
  "in_progress",
  "problem",
  "completed",
  "reviewed",
  "billable",
]);
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "planned",
  "en_route",
  "on_site",
  "break",
  "completed",
]);
export const jobCategoryEnum = pgEnum("job_category", [
  "pv",
  "heat_pump",
  "shk",
  "montage",
  "service",
  "other",
]);

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  accessCode: varchar("access_code", { length: 16 }),
  logoUrl: varchar("logo_url"),
  phone: varchar("phone", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_companies_access_code").on(table.accessCode),
]);

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  userId: varchar("user_id").references(() => users.id),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  loginId: varchar("login_id", { length: 80 }),
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  passwordIssuedAt: timestamp("password_issued_at"),
  role: roleEnum("role").notNull().default("employee"),
  isActive: boolean("is_active").notNull().default(true),
  color: varchar("color", { length: 7 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_employees_company_id").on(table.companyId),
  index("idx_employees_user_id").on(table.userId),
  index("idx_employees_login_id").on(table.loginId),
  uniqueIndex("uq_employees_user_id").on(table.userId),
  uniqueIndex("uq_employees_company_login_id").on(table.companyId, table.loginId),
]);

export const companyInvitations = pgTable("company_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  role: roleEnum("role").notNull().default("employee"),
  invitedByUserId: varchar("invited_by_user_id").references(() => users.id),
  acceptedByUserId: varchar("accepted_by_user_id").references(() => users.id),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  lastSentAt: timestamp("last_sent_at"),
  sendAttempts: integer("send_attempts").notNull().default(0),
  lastSendError: text("last_send_error"),
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_company_invitations_company_id").on(table.companyId),
  index("idx_company_invitations_email").on(table.email),
  uniqueIndex("uq_company_invitations_token_hash").on(table.tokenHash),
]);

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  jobNumber: varchar("job_number", { length: 50 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  addressStreet: varchar("address_street", { length: 255 }),
  addressZip: varchar("address_zip", { length: 20 }),
  addressCity: varchar("address_city", { length: 100 }),
  contactName: varchar("contact_name", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  internalNote: text("internal_note"),
  category: jobCategoryEnum("category"),
  status: jobStatusEnum("status").notNull().default("planned"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_jobs_company_id").on(table.companyId),
  index("idx_jobs_company_archived").on(table.companyId, table.isArchived),
]);

export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  jobId: varchar("job_id")
    .notNull()
    .references(() => jobs.id),
  assignmentDate: date("assignment_date").notNull(),
  plannedStartTime: time("planned_start_time"),
  plannedEndTime: time("planned_end_time"),
  sortOrder: integer("sort_order").notNull().default(0),
  note: text("note"),
  status: assignmentStatusEnum("status").notNull().default("planned"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_assignments_company_id").on(table.companyId),
  index("idx_assignments_job_id").on(table.jobId),
  index("idx_assignments_assignment_date").on(table.assignmentDate),
  index("idx_assignments_date_sort_order").on(table.assignmentDate, table.sortOrder),
  index("idx_assignments_company_date").on(table.companyId, table.assignmentDate),
]);

export const assignmentWorkers = pgTable("assignment_workers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  assignmentId: varchar("assignment_id")
    .notNull()
    .references(() => assignments.id),
  employeeId: varchar("employee_id")
    .notNull()
    .references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_assignment_workers_company_id").on(table.companyId),
  index("idx_assignment_workers_assignment_id").on(table.assignmentId),
  index("idx_assignment_workers_employee_id").on(table.employeeId),
  uniqueIndex("idx_assignment_workers_unique").on(table.assignmentId, table.employeeId),
  index("idx_aw_company_assignment").on(table.companyId, table.assignmentId),
]);

export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  jobId: varchar("job_id")
    .notNull()
    .references(() => jobs.id),
  assignmentId: varchar("assignment_id")
    .notNull()
    .references(() => assignments.id),
  employeeId: varchar("employee_id")
    .notNull()
    .references(() => employees.id),
  startedAt: timestamp("started_at"),
  arrivedAt: timestamp("arrived_at"),
  endedAt: timestamp("ended_at"),
  totalMinutes: integer("total_minutes"),
  status: assignmentStatusEnum("time_status").notNull().default("planned"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_time_entries_assignment_id").on(table.assignmentId),
  index("idx_time_entries_employee_id").on(table.employeeId),
  index("idx_time_entries_company_assignment").on(table.companyId, table.assignmentId),
]);

export const breakEntries = pgTable("break_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  timeEntryId: varchar("time_entry_id")
    .notNull()
    .references(() => timeEntries.id),
  breakStart: timestamp("break_start").notNull(),
  breakEnd: timestamp("break_end"),
  durationMinutes: integer("duration_minutes"),
}, (table) => [
  index("idx_break_entries_company_id").on(table.companyId),
  index("idx_break_entries_time_entry_id").on(table.timeEntryId),
]);


export const companiesRelations = relations(companies, ({ many }) => ({
  employees: many(employees),
  invitations: many(companyInvitations),
  jobs: many(jobs),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  company: one(companies, {
    fields: [employees.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  assignmentWorkers: many(assignmentWorkers),
  timeEntries: many(timeEntries),
}));

export const companyInvitationsRelations = relations(
  companyInvitations,
  ({ one }) => ({
    company: one(companies, {
      fields: [companyInvitations.companyId],
      references: [companies.id],
    }),
    invitedByUser: one(users, {
      fields: [companyInvitations.invitedByUserId],
      references: [users.id],
    }),
    acceptedByUser: one(users, {
      fields: [companyInvitations.acceptedByUserId],
      references: [users.id],
    }),
  }),
);

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  assignments: many(assignments),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  company: one(companies, {
    fields: [assignments.companyId],
    references: [companies.id],
  }),
  job: one(jobs, {
    fields: [assignments.jobId],
    references: [jobs.id],
  }),
  workers: many(assignmentWorkers),
  timeEntries: many(timeEntries),
}));

export const assignmentWorkersRelations = relations(
  assignmentWorkers,
  ({ one }) => ({
    company: one(companies, {
      fields: [assignmentWorkers.companyId],
      references: [companies.id],
    }),
    assignment: one(assignments, {
      fields: [assignmentWorkers.assignmentId],
      references: [assignments.id],
    }),
    employee: one(employees, {
      fields: [assignmentWorkers.employeeId],
      references: [employees.id],
    }),
  })
);

export const timeEntriesRelations = relations(timeEntries, ({ one, many }) => ({
  assignment: one(assignments, {
    fields: [timeEntries.assignmentId],
    references: [assignments.id],
  }),
  employee: one(employees, {
    fields: [timeEntries.employeeId],
    references: [employees.id],
  }),
  job: one(jobs, {
    fields: [timeEntries.jobId],
    references: [jobs.id],
  }),
  breaks: many(breakEntries),
}));

export const breakEntriesRelations = relations(breakEntries, ({ one }) => ({
  company: one(companies, {
    fields: [breakEntries.companyId],
    references: [companies.id],
  }),
  timeEntry: one(timeEntries, {
    fields: [breakEntries.timeEntryId],
    references: [timeEntries.id],
  }),
}));


export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCompanyInvitationSchema = createInsertSchema(
  companyInvitations,
).omit({
  id: true,
  tokenHash: true,
  invitedByUserId: true,
  acceptedByUserId: true,
  lastSentAt: true,
  sendAttempts: true,
  lastSendError: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
});
export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAssignmentSchema = createInsertSchema(assignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAssignmentWorkerSchema = createInsertSchema(
  assignmentWorkers
).omit({ id: true, createdAt: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertBreakEntrySchema = createInsertSchema(breakEntries).omit({
  id: true,
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type CompanyInvitation = typeof companyInvitations.$inferSelect;
export type InsertCompanyInvitation = z.infer<typeof insertCompanyInvitationSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type AssignmentWorker = typeof assignmentWorkers.$inferSelect;
export type InsertAssignmentWorker = z.infer<
  typeof insertAssignmentWorkerSchema
>;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type BreakEntry = typeof breakEntries.$inferSelect;
export type InsertBreakEntry = z.infer<typeof insertBreakEntrySchema>;
