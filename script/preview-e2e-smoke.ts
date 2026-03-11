import assert from "node:assert/strict";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
};

type Job = {
  id: string;
  jobNumber: string;
  title: string;
  customerName: string;
};

type Assignment = {
  id: string;
  jobId: string;
  assignmentDate: string;
  status: string;
  workers?: Employee[];
  job?: Job;
};

type ResizeBlockResult = {
  ok: true;
  createdAssignments: Assignment[];
};

type PlanningBoardResponse = {
  employees: Employee[];
  backlogJobs: Job[];
  assignments: Assignment[];
};

const BASE_URL = process.env.KAVU_PREVIEW_URL ?? "http://127.0.0.1:5000";

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getSetCookieHeaders(response: Response) {
  const headersWithCookies = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  const direct = headersWithCookies.getSetCookie?.();
  if (direct && direct.length > 0) {
    return direct;
  }

  const combined = response.headers.get("set-cookie");
  return combined ? [combined] : [];
}

class HttpSession {
  private cookies = new Map<string, string>();

  private get cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private storeCookies(response: Response) {
    for (const header of getSetCookieHeaders(response)) {
      const [pair] = header.split(";");
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      this.cookies.set(name, value);
    }
  }

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set("cookie", this.cookieHeader);
    }

    const response = await fetch(new URL(path, BASE_URL), {
      ...init,
      headers,
      redirect: "manual",
    });
    this.storeCookies(response);
    return response;
  }

  async expectJson<T>(path: string, init: RequestInit = {}) {
    const response = await this.request(path, init);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
    }
    return (await response.json()) as T;
  }

  async expectStatus(path: string, expectedStatus: number, init: RequestInit = {}) {
    const response = await this.request(path, init);
    const text = await response.text();
    assert.equal(
      response.status,
      expectedStatus,
      `Expected ${expectedStatus} for ${init.method ?? "GET"} ${path}, got ${response.status}: ${text}`
    );
    return text;
  }
}

async function main() {
  const admin = new HttpSession();
  const employee = new HttpSession();
  const sharedBrowserSession = new HttpSession();
  const today = new Date();
  const createDate = toDateStr(addDays(today, 1));
  const moveDate = toDateStr(addDays(today, 2));
  const resizeDate = toDateStr(addDays(today, 3));
  const rangeEnd = toDateStr(addDays(today, 14));
  const testSuffix = Date.now().toString().slice(-6);
  const testTitle = `Smoke Auftrag ${testSuffix}`;

  await admin.expectStatus("/api/preview/as-admin", 302);
  await sharedBrowserSession.expectStatus(
    "/api/preview/as-employee?employee=jonas-richter&redirect=/assignments",
    302,
  );

  const employees = await admin.expectJson<Employee[]>("/api/employees");
  const jonas = employees.find(
    (entry) => entry.firstName === "Jonas" && entry.lastName === "Richter"
  );
  const lena = employees.find(
    (entry) => entry.firstName === "Lena" && entry.lastName === "Bauer"
  );
  assert.ok(jonas, "Jonas Richter must exist in preview employees");
  assert.ok(lena, "Lena Bauer must exist in preview employees");

  const createdJob = await admin.expectJson<Job>("/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: testTitle,
      customerName: "Smoke Kunde",
      addressStreet: "Testweg 1",
      addressZip: "80331",
      addressCity: "Muenchen",
      category: "service",
    }),
  });
  assert.equal(createdJob.title, testTitle, "Created job title should match");

  const backlogAfterCreate = await admin.expectJson<Job[]>("/api/jobs/unassigned");
  assert.ok(
    backlogAfterCreate.some((job) => job.id === createdJob.id),
    "Created job should appear in backlog"
  );

  const boardAfterCreate = await admin.expectJson<PlanningBoardResponse>(
    `/api/planning/board?startDate=${createDate}&endDate=${rangeEnd}`
  );
  assert.ok(
    boardAfterCreate.backlogJobs.some((job) => job.id === createdJob.id),
    "Planning board read model should include new backlog job"
  );

  const createdAssignment = await admin.expectJson<Assignment>("/api/assignments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jobId: createdJob.id,
      assignmentDate: createDate,
    }),
  });
  assert.equal(createdAssignment.assignmentDate, createDate, "Assignment should be created on target day");

  const assignmentsOnCreateDate = await admin.expectJson<Assignment[]>(
    `/api/assignments?date=${createDate}`
  );
  const adminAssignment = assignmentsOnCreateDate.find(
    (assignment) => assignment.id === createdAssignment.id
  );
  assert.ok(adminAssignment, "Created assignment should be visible to admin");

  await admin.expectJson<{ ok: true }>(`/api/planning/assign-workers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      assignmentIds: [createdAssignment.id],
      employeeId: jonas.id,
      mode: "add",
    }),
  });

  const assignmentsWithWorker = await admin.expectJson<Assignment[]>(
    `/api/assignments?date=${createDate}`
  );
  const assigned = assignmentsWithWorker.find((assignment) => assignment.id === createdAssignment.id);
  assert.ok(
    assigned?.workers?.some((worker) => worker.id === jonas.id),
    "Jonas should be assigned on admin side"
  );

  await employee.expectStatus(
    "/api/preview/as-employee?employee=jonas-richter&redirect=/assignments",
    302
  );

  const me = await employee.expectJson<{ employee: Employee | null }>("/api/me");
  assert.equal(me.employee?.id, jonas.id, "Employee session should resolve to Jonas Richter");

  const sharedAdminMe = await sharedBrowserSession.expectJson<{ employee: Employee | null }>(
    "/api/me",
    {
      headers: {
        "x-kavu-preview-employee": "admin",
      },
    },
  );
  assert.equal(
    sharedAdminMe.employee?.role,
    "admin",
    "Shared browser session should still resolve admin view via preview header"
  );

  const sharedJonasMe = await sharedBrowserSession.expectJson<{ employee: Employee | null }>(
    "/api/me",
    {
      headers: {
        "x-kavu-preview-employee": "jonas-richter",
      },
    },
  );
  assert.equal(
    sharedJonasMe.employee?.id,
    jonas.id,
    "Shared browser session should resolve Jonas view via preview header"
  );

  const employeeAssignments = await employee.expectJson<Assignment[]>(
    `/api/assignments/my?startDate=${toDateStr(today)}&endDate=${rangeEnd}`
  );
  assert.ok(
    employeeAssignments.some(
      (assignment) => assignment.id === createdAssignment.id && assignment.assignmentDate === createDate
    ),
    "Jonas should see the new assignment in his upcoming list"
  );

  const boardAfterAssignmentCreate = await admin.expectJson<PlanningBoardResponse>(
    `/api/planning/board?startDate=${createDate}&endDate=${rangeEnd}`
  );
  assert.ok(
    boardAfterAssignmentCreate.assignments.some((assignment) => assignment.id === createdAssignment.id),
    "Planning board read model should include the created assignment"
  );

  const resizeResult = await admin.expectJson<ResizeBlockResult>("/api/planning/resize-block", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      removeAssignmentIds: [],
      createAssignments: [
        {
          jobId: createdJob.id,
          assignmentDate: resizeDate,
          workerIds: [jonas.id],
        },
      ],
    }),
  });
  assert.equal(
    resizeResult.createdAssignments.length,
    1,
    "Resize should create exactly one additional assignment day"
  );
  const resizedAssignment = resizeResult.createdAssignments[0];

  const employeeAssignmentsAfterResize = await employee.expectJson<Assignment[]>(
    `/api/assignments/my?startDate=${toDateStr(today)}&endDate=${rangeEnd}`
  );
  assert.ok(
    employeeAssignmentsAfterResize.some(
      (assignment) => assignment.id === resizedAssignment.id && assignment.assignmentDate === resizeDate
    ),
    "Jonas should see the resized additional assignment day"
  );

  await admin.expectJson<{ ok: true }>(`/api/planning/assign-workers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      assignmentIds: [resizedAssignment.id],
      employeeId: lena.id,
      mode: "add",
    }),
  });

  const createDayAssignmentsAfterPartialAdd = await admin.expectJson<Assignment[]>(
    `/api/assignments?date=${createDate}`
  );
  const resizeDayAssignmentsAfterPartialAdd = await admin.expectJson<Assignment[]>(
    `/api/assignments?date=${resizeDate}`
  );
  assert.ok(
    !createDayAssignmentsAfterPartialAdd
      .find((assignment) => assignment.id === createdAssignment.id)
      ?.workers?.some((worker) => worker.id === lena.id),
    "Lena should not be assigned to the original day after partial add"
  );
  assert.ok(
    resizeDayAssignmentsAfterPartialAdd
      .find((assignment) => assignment.id === resizedAssignment.id)
      ?.workers?.some((worker) => worker.id === lena.id),
    "Lena should be assigned only to the selected future day"
  );

  await admin.expectJson<{ ok: true }>(`/api/planning/move-block`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      updates: [{ assignmentId: createdAssignment.id, assignmentDate: moveDate }],
    }),
  });

  const employeeAssignmentsAfterMove = await employee.expectJson<Assignment[]>(
    `/api/assignments/my?startDate=${toDateStr(today)}&endDate=${rangeEnd}`
  );
  assert.ok(
    employeeAssignmentsAfterMove.some(
      (assignment) => assignment.id === createdAssignment.id && assignment.assignmentDate === moveDate
    ),
    "Jonas should see the moved assignment date"
  );

  await admin.expectJson<{ ok: true }>(`/api/planning/assign-workers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      assignmentIds: [resizedAssignment.id],
      employeeId: lena.id,
      mode: "remove",
    }),
  });

  const resizeDayAssignmentsAfterPartialRemoval = await admin.expectJson<Assignment[]>(
    `/api/assignments?date=${resizeDate}`
  );
  assert.ok(
    !resizeDayAssignmentsAfterPartialRemoval
      .find((assignment) => assignment.id === resizedAssignment.id)
      ?.workers?.some((worker) => worker.id === lena.id),
    "Lena should be removable from the selected future day only"
  );

  await admin.expectJson<{ ok: true }>(`/api/planning/assign-workers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      assignmentIds: [createdAssignment.id, resizedAssignment.id],
      employeeId: jonas.id,
      mode: "remove",
    }),
  });

  const employeeAssignmentsAfterRemoval = await employee.expectJson<Assignment[]>(
    `/api/assignments/my?startDate=${toDateStr(today)}&endDate=${rangeEnd}`
  );
  assert.ok(
    !employeeAssignmentsAfterRemoval.some((assignment) => assignment.id === createdAssignment.id),
    "Jonas should no longer see the assignment after worker removal"
  );

  await admin.expectJson<{ ok: true }>(`/api/planning/remove-block`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assignmentIds: [createdAssignment.id, resizedAssignment.id] }),
  });

  const backlogAfterDelete = await admin.expectJson<Job[]>("/api/jobs/unassigned");
  assert.ok(
    backlogAfterDelete.some((job) => job.id === createdJob.id),
    "Job should return to backlog after deleting the only assignment"
  );

  console.log("PASS shared browser session can separate admin and Jonas via preview header");
  console.log("PASS create job -> backlog");
  console.log("PASS planning board read model -> backlog and assignments");
  console.log("PASS create assignment -> admin day view");
  console.log("PASS assign Jonas -> employee upcoming view");
  console.log("PASS resize assignment block -> employee sees added day");
  console.log("PASS partial worker assignment -> selected day only");
  console.log("PASS move assignment -> employee updated date");
  console.log("PASS partial worker removal -> selected day only");
  console.log("PASS remove Jonas -> employee no longer sees assignment");
  console.log("PASS delete assignment -> job returns to backlog");
  console.log("Verified preview admin/employee end-to-end smoke.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
