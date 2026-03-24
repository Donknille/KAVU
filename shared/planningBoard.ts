export type PlanningBoardEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  color?: string | null;
  isActive?: boolean;
};

export type PlanningBoardJob = {
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

export type PlanningBoardAssignment = {
  id: string;
  jobId: string;
  assignmentDate: string;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  sortOrder: number;
  note?: string | null;
  status: string;
  job?: PlanningBoardJob;
  workers?: PlanningBoardEmployee[];
};

export type PlanningDaySummary = {
  day: string;
  assignments: number;
  workers: number;
};

export type WorkerCoverageSegment = {
  startDate: string;
  endDate: string;
  days: string[];
};

export type BlockWorkerCoverage = {
  employee: PlanningBoardEmployee;
  days: string[];
  segments: WorkerCoverageSegment[];
  label: string;
};

export type PlanningBoardBlock = {
  id: string;
  jobId: string;
  job: PlanningBoardJob;
  startDate: string;
  endDate: string;
  startIndex: number;
  endIndex: number;
  span: number;
  lane: number;
  days: string[];
  assignments: PlanningBoardAssignment[];
  assignmentIds: string[];
  workers: PlanningBoardEmployee[];
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

export type PlanningBoardBase = {
  employees: PlanningBoardEmployee[];
  backlogJobs: PlanningBoardJob[];
  assignments: PlanningBoardAssignment[];
};

export type PlanningBoardReadModel = PlanningBoardBase & {
  activeEmployees: PlanningBoardEmployee[];
  blocks: PlanningBoardBlock[];
  daySummaries: PlanningDaySummary[];
};

export function parseDateString(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function toDateStr(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;
}

function isSunday(value: Date) {
  return value.getDay() === 0;
}

export function getPlanningDaysInRange(startDate: string, endDate: string) {
  const days: string[] = [];
  const cursor = parseDateString(startDate);
  const end = parseDateString(endDate);

  while (cursor <= end) {
    if (!isSunday(cursor)) {
      days.push(toDateStr(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export function uniqueSortedDates(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function getEmployeeLabel(employee: PlanningBoardEmployee) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export function formatCompactDate(date: string) {
  return parseDateString(date).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatRange(startDate: string, endDate: string) {
  if (startDate === endDate) {
    return formatCompactDate(startDate);
  }
  return `${formatCompactDate(startDate)} - ${formatCompactDate(endDate)}`;
}

function getBlockStatus(assignments: PlanningBoardAssignment[]) {
  const statuses = assignments.map((assignment) => assignment.status);
  if (statuses.includes("problem")) return "problem";
  if (statuses.every((status) => status === "completed")) return "completed";
  if (statuses.includes("break")) return "break";
  if (statuses.includes("on_site")) return "on_site";
  if (statuses.includes("en_route")) return "en_route";
  return "planned";
}

export function getPlanningDaySummaries(
  assignments: PlanningBoardAssignment[],
  visibleDays: string[]
) {
  return visibleDays.map((day) => {
    const dayAssignments = assignments.filter((assignment) => assignment.assignmentDate === day);
    const uniqueWorkers = new Set(
      dayAssignments.flatMap((assignment) => (assignment.workers ?? []).map((worker) => worker.id))
    );

    return {
      day,
      assignments: dayAssignments.length,
      workers: uniqueWorkers.size,
    };
  });
}

export function buildPlanningBlocks(
  assignments: PlanningBoardAssignment[],
  visibleDays: string[],
  today = toDateStr(new Date())
) {
  const dayIndexByDate = new Map(visibleDays.map((day, index) => [day, index]));
  const grouped = new Map<string, PlanningBoardAssignment[]>();

  for (const assignment of assignments) {
    if (!assignment.job || !dayIndexByDate.has(assignment.assignmentDate)) {
      continue;
    }
    const list = grouped.get(assignment.jobId) ?? [];
    list.push(assignment);
    grouped.set(assignment.jobId, list);
  }

  const blocks: PlanningBoardBlock[] = [];

  for (const [, jobAssignments] of grouped.entries()) {
    const sorted = [...jobAssignments].sort((left, right) => {
      return dayIndexByDate.get(left.assignmentDate)! - dayIndexByDate.get(right.assignmentDate)!;
    });

    let currentChunk: PlanningBoardAssignment[] = [];
    let previousIndex: number | null = null;

    for (const assignment of sorted) {
      const currentIndex = dayIndexByDate.get(assignment.assignmentDate)!;
      if (previousIndex === null || currentIndex === previousIndex + 1) {
        currentChunk.push(assignment);
      } else {
        blocks.push(createBlockFromAssignments(currentChunk, dayIndexByDate, today));
        currentChunk = [assignment];
      }
      previousIndex = currentIndex;
    }

    if (currentChunk.length > 0) {
      blocks.push(createBlockFromAssignments(currentChunk, dayIndexByDate, today));
    }
  }

  const laneEndByIndex: number[] = [];
  const sortedBlocks = blocks.sort((left, right) => {
    if (left.startIndex !== right.startIndex) {
      return left.startIndex - right.startIndex;
    }
    return right.span - left.span;
  });

  return sortedBlocks.map((block) => {
    let lane = 0;
    while (laneEndByIndex[lane] !== undefined && block.startIndex <= laneEndByIndex[lane]) {
      lane += 1;
    }
    laneEndByIndex[lane] = block.endIndex;
    return { ...block, lane };
  });
}

function createBlockFromAssignments(
  chunk: PlanningBoardAssignment[],
  dayIndexByDate: Map<string, number>,
  today: string
): PlanningBoardBlock {
  const orderedAssignments = [...chunk].sort((left, right) =>
    left.assignmentDate.localeCompare(right.assignmentDate)
  );
  const first = orderedAssignments[0];
  const last = orderedAssignments[orderedAssignments.length - 1];
  const workersById = new Map<string, PlanningBoardEmployee>();

  for (const assignment of orderedAssignments) {
    for (const worker of assignment.workers ?? []) {
      workersById.set(worker.id, worker);
    }
  }

  const workers = [...workersById.values()].sort((left, right) =>
    getEmployeeLabel(left).localeCompare(getEmployeeLabel(right))
  );
  const workerCoverage = buildWorkerCoverage(orderedAssignments, dayIndexByDate);
  const assignmentIds = orderedAssignments.map((assignment) => assignment.id).sort();
  const canMove = orderedAssignments.every((assignment) => assignment.status === "planned");
  const canResizeStart = canMove;
  const canResizeEnd =
    canMove ||
    orderedAssignments.some(
      (assignment) => assignment.assignmentDate >= today && assignment.status !== "completed"
    );
  const canAssignWorkers = orderedAssignments.some(
    (assignment) => assignment.assignmentDate >= today && assignment.status !== "completed"
  );
  const canRemoveWorkers = orderedAssignments.some(
    (assignment) =>
      assignment.assignmentDate > today ||
      (assignment.assignmentDate === today && assignment.status === "planned")
  );
  const canDelete = canMove;
  const hasProtectedHistory = orderedAssignments.some(
    (assignment) =>
      assignment.assignmentDate < today ||
      (assignment.assignmentDate === today && assignment.status !== "planned")
  );

  return {
    id: assignmentIds.join("|"),
    jobId: first.jobId,
    job: first.job!,
    startDate: first.assignmentDate,
    endDate: last.assignmentDate,
    startIndex: dayIndexByDate.get(first.assignmentDate)!,
    endIndex: dayIndexByDate.get(last.assignmentDate)!,
    span: orderedAssignments.length,
    lane: 0,
    days: orderedAssignments.map((assignment) => assignment.assignmentDate),
    assignments: orderedAssignments,
    assignmentIds,
    workers,
    workerIds: workers.map((worker) => worker.id),
    workerCoverage,
    status: getBlockStatus(orderedAssignments),
    canAssignWorkers,
    canMove,
    canRemoveWorkers,
    canResizeEnd,
    canResizeStart,
    canDelete,
    hasProtectedHistory,
    isReadOnly:
      !canAssignWorkers &&
      !canMove &&
      !canRemoveWorkers &&
      !canResizeEnd &&
      !canResizeStart &&
      !canDelete,
  };
}

function buildWorkerCoverage(
  assignments: PlanningBoardAssignment[],
  dayIndexByDate: Map<string, number>
): BlockWorkerCoverage[] {
  const coverageByWorker = new Map<string, { employee: PlanningBoardEmployee; days: string[] }>();

  for (const assignment of assignments) {
    for (const worker of assignment.workers ?? []) {
      const existing = coverageByWorker.get(worker.id);
      if (existing) {
        existing.days.push(assignment.assignmentDate);
      } else {
        coverageByWorker.set(worker.id, {
          employee: worker,
          days: [assignment.assignmentDate],
        });
      }
    }
  }

  return [...coverageByWorker.values()]
    .map(({ employee, days }) => {
      const sortedDays = uniqueSortedDates(days);
      const segments: BlockWorkerCoverage["segments"] = [];

      for (const day of sortedDays) {
        const lastSegment = segments[segments.length - 1];
        if (!lastSegment) {
          segments.push({ startDate: day, endDate: day, days: [day] });
          continue;
        }

        const previousIndex = dayIndexByDate.get(lastSegment.endDate);
        const currentIndex = dayIndexByDate.get(day);
        if (
          previousIndex !== undefined &&
          currentIndex !== undefined &&
          currentIndex === previousIndex + 1
        ) {
          lastSegment.endDate = day;
          lastSegment.days.push(day);
          continue;
        }

        segments.push({ startDate: day, endDate: day, days: [day] });
      }

      return {
        employee,
        days: sortedDays,
        segments,
        label: segments.map((segment) => formatRange(segment.startDate, segment.endDate)).join(", "),
      };
    })
    .sort((left, right) =>
      getEmployeeLabel(left.employee).localeCompare(getEmployeeLabel(right.employee))
    );
}

export function createPlanningBoardReadModel(
  data: PlanningBoardBase,
  visibleDays: string[],
  today = toDateStr(new Date())
): PlanningBoardReadModel {
  const activeEmployees = data.employees
    .filter((employee) => employee.isActive !== false)
    .sort((left, right) => getEmployeeLabel(left).localeCompare(getEmployeeLabel(right)));

  return {
    ...data,
    activeEmployees,
    blocks: buildPlanningBlocks(data.assignments, visibleDays, today),
    daySummaries: getPlanningDaySummaries(data.assignments, visibleDays),
  };
}
