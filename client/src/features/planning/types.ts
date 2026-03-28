export type ViewSpan = 2 | 4;

export type PlanEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  color?: string | null;
  isActive?: boolean;
};

export type PlanJob = {
  id: string;
  jobNumber: string;
  title: string;
  customerName: string;
  addressStreet?: string | null;
  addressZip?: string | null;
  addressCity?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  description?: string | null;
  internalNote?: string | null;
  category?: string | null;
  status: string;
};

export type PlanAssignment = {
  id: string;
  jobId: string;
  assignmentDate: string;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  sortOrder: number;
  note?: string | null;
  accommodationNote?: string | null;
  status: string;
  job?: PlanJob;
  workers?: PlanEmployee[];
};

export type PlanningDaySummary = {
  day: string;
  assignments: number;
  workers: number;
};

export type PlanningBoardResponse = {
  employees: PlanEmployee[];
  activeEmployees: PlanEmployee[];
  backlogJobs: PlanJob[];
  assignments: PlanAssignment[];
  blocks: PlanningBlock[];
  daySummaries: PlanningDaySummary[];
};

export type WorkerCoverageSegment = {
  startDate: string;
  endDate: string;
  days: string[];
};

export type BlockWorkerCoverage = {
  employee: PlanEmployee;
  days: string[];
  segments: WorkerCoverageSegment[];
  label: string;
};

export type PlanningBlock = {
  id: string;
  jobId: string;
  job: PlanJob;
  startDate: string;
  endDate: string;
  startIndex: number;
  endIndex: number;
  span: number;
  lane: number;
  days: string[];
  assignments: PlanAssignment[];
  assignmentIds: string[];
  workers: PlanEmployee[];
  workerIds: string[];
  workerCoverage: BlockWorkerCoverage[];
  status: string;
  canAssignWorkers: boolean;
  canMove: boolean;
  canRemoveWorkers: boolean;
  canResizeEnd: boolean;
  canResizeStart: boolean;
  canDelete: boolean;
  hasProtectedHistory: boolean;
  isReadOnly: boolean;
};

export type ActiveDrag =
  | { type: "job"; job: PlanJob }
  | { type: "employee"; employee: PlanEmployee }
  | { type: "block-move"; block: PlanningBlock }
  | { type: "block-resize-start"; block: PlanningBlock }
  | { type: "block-resize-end"; block: PlanningBlock };

export type PlanningDragData =
  | { dragType: "job"; jobId: string }
  | { dragType: "employee"; employeeId: string }
  | { dragType: "block-move"; blockId: string }
  | { dragType: "block-resize-start"; blockId: string }
  | { dragType: "block-resize-end"; blockId: string };

export type PlanningDropData =
  | { dropType: "day"; date: string }
  | { dropType: "employee-day"; employeeId: string; date: string }
  | {
      dropType: "block";
      blockId: string;
      startDate: string;
      endDate: string;
      days: string[];
    };

export type ResizePreview = {
  blockId: string;
  edge: "start" | "end";
  startIndex: number;
  endIndex: number;
  span: number;
  lane: number;
  nextDays: string[];
  addedDays: string[];
  addedStartIndex: number | null;
  addedSpan: number;
  valid: boolean;
  label: string;
};

export type EmployeeAvailability = "free" | "assigned" | "scheduled";

export type WorkerDaySelection =
  | {
      mode: "from-date";
      startDate?: string | null;
    }
  | {
      mode: "specific-days";
      dates: string[];
    };

export type JobForm = {
  title: string;
  customerName: string;
  addressStreet: string;
  addressZip: string;
  addressCity: string;
  contactName: string;
  contactPhone: string;
  category: string;
  description: string;
};

export const EMPTY_JOB_FORM: JobForm = {
  title: "",
  customerName: "",
  addressStreet: "",
  addressZip: "",
  addressCity: "",
  contactName: "",
  contactPhone: "",
  category: "",
  description: "",
};
