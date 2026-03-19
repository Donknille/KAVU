/**
 * Centralized TanStack Query key constants.
 * Using constants prevents typos and makes refactoring easier.
 */

export const QK = {
  AUTH_USER: "/api/auth/user",
  ME: "/api/me",
  DASHBOARD: "/api/dashboard",
  JOBS: "/api/jobs",
  JOBS_ARCHIVED: "/api/jobs?archived=true",
  JOBS_UNASSIGNED: "/api/jobs/unassigned",
  EMPLOYEES: "/api/employees",
  ASSIGNMENTS: "/api/assignments",
  COMPANY_INVITATIONS: "/api/company-invitations",
  PLANNING_BOARD: "/api/planning/board",
} as const;
