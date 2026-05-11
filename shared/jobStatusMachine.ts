// T-207: Allowed transitions between job statuses. Shared between the
// admin UI (to filter the dropdown) and the backend (to validate PATCH
// /api/jobs/:id requests).
//
// The enum order in shared/schema.ts is:
//   planned, in_progress, problem, completed, reviewed, billable

export type JobStatus =
  | "planned"
  | "in_progress"
  | "problem"
  | "completed"
  | "reviewed"
  | "billable";

export const JOB_STATUSES: readonly JobStatus[] = [
  "planned",
  "in_progress",
  "problem",
  "completed",
  "reviewed",
  "billable",
] as const;

// "problem" is reachable from every state because something can always go
// wrong; from "problem" you can step back into any active state.
// "billable" is the terminal happy path; the only way out is back to
// "completed" (correcting a premature mark as billable).
const ALLOWED_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  planned: ["in_progress", "problem"],
  in_progress: ["completed", "problem"],
  problem: ["planned", "in_progress", "completed"],
  completed: ["reviewed", "in_progress", "problem"],
  reviewed: ["billable", "completed", "problem"],
  billable: ["completed"],
};

export function getAllowedTransitions(from: JobStatus): readonly JobStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

export function canTransitionJobStatus(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}
