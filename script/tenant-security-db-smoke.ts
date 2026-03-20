import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";

process.env.AUTH_PROVIDER ??= "app";
process.env.SESSION_SECRET ??= "tenant-security-db-smoke-secret";
process.env.APP_BASE_URL ??= "http://127.0.0.1";
process.env.TRUST_PROXY ??= "false";
process.env.COOKIE_SECURE ??= "false";
process.env.COOKIE_SAME_SITE ??= "lax";
process.env.ENABLE_DEMO_SEED ??= "0";
process.env.VERCEL ??= "1";
process.env.NODE_ENV ??= "test";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the DB-backed tenant security smoke test.",
  );
}

type RequestOptions = {
  method?: string;
  body?: unknown;
};

class SessionClient {
  private cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  async request(path: string, options: RequestOptions = {}) {
    const headers = new Headers();
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body,
      redirect: "manual",
    });

    this.storeCookies(response);

    const text = await response.text();
    let json: unknown = null;
    if (text.length > 0) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }

    return { response, text, json };
  }

  getCookie(name: string) {
    return this.cookies.get(name);
  }

  private buildCookieHeader() {
    const pairs = [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`);
    return pairs.length > 0 ? pairs.join("; ") : undefined;
  }

  private storeCookies(response: Response) {
    const rawCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : response.headers.get("set-cookie")
          ? [response.headers.get("set-cookie") as string]
          : [];

    for (const rawCookie of rawCookies) {
      const [cookiePair] = rawCookie.split(";", 1);
      const [name, value] = cookiePair.split("=", 2);
      if (!name) continue;
      this.cookies.set(name.trim(), value ?? "");
    }
  }
}

function uniquePrefix(label: string) {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

async function expectStatus(
  client: SessionClient,
  path: string,
  expectedStatus: number,
  label: string,
  options: RequestOptions = {},
) {
  const result = await client.request(path, options);
  assert.equal(
    result.response.status,
    expectedStatus,
    `${label}: expected ${expectedStatus}, received ${result.response.status} (${result.text})`,
  );
  return result;
}

async function createAdminTenant(client: SessionClient, label: string) {
  const prefix = uniquePrefix(label);
  const email = `${prefix}@example.com`;
  const password = "SicheresPasswort9";

  const registration = await expectStatus(client, "/api/auth/register", 200, `${label} register`, {
    method: "POST",
    body: {
      email,
      password,
      firstName: "Tenant",
      lastName: label,
    },
  });

  const registeredUserId = (registration.json as any)?.user?.id;
  assert.ok(registeredUserId, `${label} register: missing user id`);

  const setup = await expectStatus(client, "/api/setup", 200, `${label} setup`, {
    method: "POST",
    body: {
      companyName: `${prefix} GmbH`,
      firstName: "Tenant",
      lastName: label,
      phone: "+49 89 123456",
    },
  });

  const company = (setup.json as any)?.company;
  const employee = (setup.json as any)?.employee;
  assert.ok(company?.id, `${label} setup: missing company id`);
  assert.ok(employee?.id, `${label} setup: missing employee id`);

  return {
    registeredUserId,
    company,
    employee,
    email,
  };
}

async function createJob(client: SessionClient, label: string) {
  const result = await expectStatus(client, "/api/jobs", 200, `${label} create job`, {
    method: "POST",
    body: {
      title: `${label} Baustelle`,
      customerName: `${label} Kunde`,
    },
  });

  const job = result.json as any;
  assert.ok(job?.id, `${label} create job: missing job id`);
  return job;
}

async function createAssignment(client: SessionClient, label: string, jobId: string, assignmentDate: string) {
  const result = await expectStatus(client, "/api/assignments", 200, `${label} create assignment`, {
    method: "POST",
    body: {
      jobId,
      assignmentDate,
    },
  });

  const assignment = result.json as any;
  assert.ok(assignment?.id, `${label} create assignment: missing assignment id`);
  return assignment;
}

async function cleanupTenantData(companyIds: string[], userIds: string[]) {
  const { db } = await import("../server/db.js");
  const {
    assignmentWorkers,
    assignments,
    breakEntries,
    companies,
    companyInvitations,
    employees,
    jobs,
    timeEntries,
  } = await import("../shared/schema.js");
  const { users } = await import("../shared/models/auth.js");

  if (companyIds.length > 0) {
    await db.delete(breakEntries).where(inArray(breakEntries.companyId, companyIds));
    await db.delete(timeEntries).where(inArray(timeEntries.companyId, companyIds));
    await db.delete(assignmentWorkers).where(inArray(assignmentWorkers.companyId, companyIds));
    await db.delete(assignments).where(inArray(assignments.companyId, companyIds));
    await db.delete(jobs).where(inArray(jobs.companyId, companyIds));
    await db.delete(companyInvitations).where(inArray(companyInvitations.companyId, companyIds));
    await db.delete(employees).where(inArray(employees.companyId, companyIds));
    await db.delete(companies).where(inArray(companies.id, companyIds));
  }

  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
  }
}

async function main() {
  const { bootstrapApp, httpServer } = await import("../server/app.js");
  const { pool } = await import("../server/db.js");
  const { DatabaseStorage } = await import("../server/storage.js");

  const companyIds: string[] = [];
  const userIds: string[] = [];
  let serverStarted = false;

  try {
    await bootstrapApp();
    httpServer.listen(0, "127.0.0.1");
    await once(httpServer, "listening");
    serverStarted = true;

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to resolve tenant smoke test server address");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const adminA = new SessionClient(baseUrl);
    const adminB = new SessionClient(baseUrl);
    const storage = new DatabaseStorage();

    const tenantA = await createAdminTenant(adminA, "tenant-a");
    const tenantB = await createAdminTenant(adminB, "tenant-b");
    companyIds.push(tenantA.company.id, tenantB.company.id);
    userIds.push(tenantA.registeredUserId, tenantB.registeredUserId);

    const jobA = await createJob(adminA, "tenant-a");
    const jobB = await createJob(adminB, "tenant-b");
    const assignmentA = await createAssignment(adminA, "tenant-a", jobA.id, "2026-03-20");
    const assignmentB = await createAssignment(adminB, "tenant-b", jobB.id, "2026-03-21");

    const employeeA = await storage.createEmployee({
      companyId: tenantA.company.id,
      firstName: "Eigener",
      lastName: "Monteur",
      role: "employee",
      isActive: true,
    });
    const employeeAAccess = await storage.provisionEmployeeAccess({
      companyId: tenantA.company.id,
      employeeId: employeeA.id,
    });
    if (employeeAAccess.employee.userId) {
      userIds.push(employeeAAccess.employee.userId);
    }

    await storage.addWorkerToAssignment({
      companyId: tenantA.company.id,
      assignmentId: assignmentA.id,
      employeeId: employeeA.id,
    });

    const employeeB = await storage.createEmployee({
      companyId: tenantB.company.id,
      firstName: "Fremd",
      lastName: "Monteur",
      role: "employee",
      isActive: true,
    });

    await storage.addWorkerToAssignment({
      companyId: tenantB.company.id,
      assignmentId: assignmentB.id,
      employeeId: employeeB.id,
    });

    const timeEntryB = await storage.createTimeEntry({
      companyId: tenantB.company.id,
      jobId: jobB.id,
      assignmentId: assignmentB.id,
      employeeId: employeeB.id,
      status: "planned",
    });

    const employeeClient = new SessionClient(baseUrl);
    const employeeLogin = await expectStatus(
      employeeClient,
      "/api/auth/employee-login",
      200,
      "employee login",
      {
        method: "POST",
        body: {
          companyAccessCode: employeeAAccess.access.companyAccessCode,
          loginId: employeeAAccess.access.loginId,
          password: employeeAAccess.access.temporaryPassword,
        },
      },
    );

    assert.equal((employeeLogin.json as any)?.employee?.passwordHash, undefined);
    assert.equal((employeeLogin.json as any)?.employee?.userId, undefined);
    assert.equal((employeeLogin.json as any)?.company?.accessCode, undefined);
    assert.equal((employeeLogin.json as any)?.requiresPasswordChange, true);

    await expectStatus(adminA, `/api/jobs/${jobB.id}`, 404, "cross-tenant job read");
    await expectStatus(
      adminA,
      `/api/assignments/${assignmentB.id}`,
      404,
      "cross-tenant assignment read",
    );
    await expectStatus(adminA, `/api/jobs/${jobB.id}`, 404, "cross-tenant job patch", {
      method: "PATCH",
      body: { title: "Manipuliert" },
    });
    await expectStatus(
      adminA,
      `/api/assignments/${assignmentB.id}`,
      404,
      "cross-tenant assignment patch",
      {
        method: "PATCH",
        body: { note: "Manipuliert" },
      },
    );
    await expectStatus(adminA, "/api/assignments", 404, "cross-tenant assignment create", {
      method: "POST",
      body: {
        jobId: jobB.id,
        assignmentDate: "2026-03-22",
      },
    });
    await expectStatus(
      adminA,
      `/api/assignments/${assignmentA.id}/workers`,
      404,
      "cross-tenant worker assignment",
      {
        method: "POST",
        body: { employeeId: employeeB.id },
      },
    );
    await expectStatus(
      adminA,
      `/api/assignments/${assignmentB.id}`,
      404,
      "cross-tenant assignment delete",
      {
        method: "DELETE",
      },
    );
    await expectStatus(adminA, "/api/planning/move-block", 404, "cross-tenant planning move", {
      method: "POST",
      body: {
        updates: [
          {
            assignmentId: assignmentB.id,
            assignmentDate: "2026-03-24",
          },
        ],
      },
    });

    assert.equal(
      await storage.updateJob(tenantA.company.id, jobB.id, { title: "Manipuliert" }),
      undefined,
    );
    assert.equal(
      (await storage.getJobForCompany(tenantB.company.id, jobB.id))?.title,
      jobB.title,
    );

    assert.equal(
      await storage.updateAssignment(tenantA.company.id, assignmentB.id, { note: "Manipuliert" }),
      undefined,
    );
    assert.equal(
      (await storage.getAssignmentForCompany(tenantB.company.id, assignmentB.id))?.note ?? null,
      assignmentB.note ?? null,
    );

    assert.equal(await storage.deleteAssignment(tenantA.company.id, assignmentB.id), false);
    assert.ok(await storage.getAssignmentForCompany(tenantB.company.id, assignmentB.id));

    assert.equal(
      await storage.updateEmployee(tenantA.company.id, employeeB.id, { firstName: "Manipuliert" }),
      undefined,
    );
    assert.equal(
      (await storage.getEmployeeForCompany(tenantB.company.id, employeeB.id))?.firstName,
      employeeB.firstName,
    );

    assert.equal(
      await storage.updateTimeEntry(tenantA.company.id, timeEntryB.id, { status: "completed" }),
      undefined,
    );
    assert.equal((await storage.getTimeEntry(timeEntryB.id))?.status, "planned");

    await expectStatus(employeeClient, "/api/jobs", 403, "employee job list forbidden");
    await expectStatus(
      employeeClient,
      `/api/planning/board?startDate=2026-03-20&endDate=2026-03-20`,
      403,
      "employee planning board forbidden",
    );
    await expectStatus(employeeClient, "/api/assignments", 403, "employee assignment list forbidden");
    await expectStatus(
      employeeClient,
      `/api/time-entries/job/${jobA.id}`,
      403,
      "employee job time entries forbidden",
    );
    await expectStatus(
      employeeClient,
      `/api/issues/job/${jobA.id}`,
      403,
      "employee job issues forbidden",
    );

    const employeeMe = await expectStatus(employeeClient, "/api/me", 200, "employee me");
    assert.equal((employeeMe.json as any)?.company?.accessCode, undefined);

    const myAssignments = await expectStatus(
      employeeClient,
      "/api/assignments/my?startDate=2026-03-20&endDate=2026-03-20",
      200,
      "employee assignments my",
    );
    assert.equal(Array.isArray(myAssignments.json), true);
    assert.equal((myAssignments.json as any[]).some((item) => item.id === assignmentA.id), true);

    await expectStatus(
      employeeClient,
      `/api/assignments/${assignmentA.id}`,
      200,
      "employee own assignment detail",
    );
    await expectStatus(
      employeeClient,
      `/api/assignments/${assignmentB.id}`,
      404,
      "employee foreign assignment detail",
    );

    console.log("Verified DB-backed tenant isolation across storage and HTTP routes.");
  } finally {
    if (serverStarted) {
      httpServer.close();
      await once(httpServer, "close");
    }

    try {
      await cleanupTenantData(companyIds, userIds);
    } finally {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
