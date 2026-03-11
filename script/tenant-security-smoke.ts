import assert from "node:assert/strict";
import { PreviewStorage } from "../server/previewStorage.ts";
import { PREVIEW_COMPANY_ID } from "../server/preview.ts";

async function main() {
  const storage = new PreviewStorage();

  const previewJob = await storage.createJob({
    companyId: PREVIEW_COMPANY_ID,
    title: "Tenant Smoke Preview",
    customerName: "Preview Kunde",
  });

  const previewAssignment = await storage.createAssignment({
    companyId: PREVIEW_COMPANY_ID,
    jobId: previewJob.id,
    assignmentDate: "2026-03-10",
  });

  const otherCompany = await storage.createCompany({ name: "Andere Firma" });
  const otherEmployee = await storage.createEmployee({
    companyId: otherCompany.id,
    firstName: "Fremd",
    lastName: "Mitarbeiter",
    role: "employee",
    isActive: true,
  });
  const otherJob = await storage.createJob({
    companyId: otherCompany.id,
    title: "Andere Baustelle",
    customerName: "Andere Kunde",
  });
  const otherAssignment = await storage.createAssignment({
    companyId: otherCompany.id,
    jobId: otherJob.id,
    assignmentDate: "2026-03-11",
  });
  const otherTimeEntry = await storage.createTimeEntry({
    companyId: otherCompany.id,
    jobId: otherJob.id,
    assignmentId: otherAssignment.id,
    employeeId: otherEmployee.id,
    status: "planned",
  });

  assert.equal(
    await storage.getAssignmentForCompany(otherCompany.id, previewAssignment.id),
    undefined,
  );

  assert.equal(
    (await storage.getAssignmentsByEmployee(PREVIEW_COMPANY_ID, otherEmployee.id, "2026-03-01", "2026-03-31"))
      .length,
    0,
  );

  await assert.rejects(
    () =>
      storage.addWorkerToAssignment({
        companyId: PREVIEW_COMPANY_ID,
        assignmentId: previewAssignment.id,
        employeeId: otherEmployee.id,
      }),
    /Cross-tenant worker assignment blocked/,
  );

  await assert.rejects(
    () => storage.createBreakEntry(PREVIEW_COMPANY_ID, otherTimeEntry.id),
    /Cross-tenant break entry blocked/,
  );

  await assert.rejects(
    () =>
      storage.createPhoto({
        companyId: PREVIEW_COMPANY_ID,
        jobId: previewJob.id,
        assignmentId: previewAssignment.id,
        employeeId: otherEmployee.id,
        photoUrl: "https://example.com/test.jpg",
      }),
    /Cross-tenant photo blocked/,
  );

  await assert.rejects(
    () =>
      storage.createIssueReport({
        companyId: PREVIEW_COMPANY_ID,
        jobId: previewJob.id,
        assignmentId: previewAssignment.id,
        employeeId: otherEmployee.id,
        issueType: "other",
      }),
    /Cross-tenant issue report blocked/,
  );

  console.log("Verified tenant isolation smoke checks.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
