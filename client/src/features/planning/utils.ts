import type {
  BlockWorkerCoverage,
  PlanAssignment,
  PlanEmployee,
  PlanningBlock,
  ViewSpan,
  WorkerDaySelection,
} from "@/features/planning/types";

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

export function isSaturday(dateStr: string) {
  return parseDateString(dateStr).getDay() === 6;
}

export function toStartOfWeek(value: Date) {
  const next = new Date(value);
  next.setHours(12, 0, 0, 0);
  const day = next.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + mondayOffset);
  return next;
}

export function addCalendarDays(dateStr: string, amount: number) {
  const next = parseDateString(dateStr);
  next.setDate(next.getDate() + amount);
  return toDateStr(next);
}

export function getVisibleDays(weekStart: string, viewSpan: ViewSpan) {
  const days: string[] = [];
  const cursor = parseDateString(weekStart);
  while (days.length < viewSpan * 6) {
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

export function getEmployeeLabel(employee: PlanEmployee) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export function getEmployeeShortLabel(employee: PlanEmployee) {
  const first = employee.firstName?.charAt(0) ?? "";
  const last = employee.lastName?.charAt(0) ?? "";
  return `${first}${last}`.toUpperCase();
}

export function getBlockStatus(assignments: PlanAssignment[]) {
  const statuses = assignments.map((assignment) => assignment.status);
  if (statuses.includes("problem")) return "problem";
  if (statuses.every((status) => status === "completed")) return "completed";
  if (statuses.includes("break")) return "break";
  if (statuses.includes("on_site")) return "on_site";
  if (statuses.includes("en_route")) return "en_route";
  return "planned";
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

export function getAssignmentsForWorkerAdd(
  blockAssignments: PlanAssignment[],
  today: string,
  selection?: WorkerDaySelection,
) {
  const openAssignments = blockAssignments.filter(
    (assignment) =>
      assignment.assignmentDate >= today &&
      assignment.status !== "completed"
  );

  if (!selection || selection.mode === "from-date") {
    const effectiveStartDate =
      selection?.startDate && selection.startDate > today ? selection.startDate : today;

    return openAssignments.filter(
      (assignment) => assignment.assignmentDate >= effectiveStartDate
    );
  }

  const selectedDays = new Set(
    selection.dates.filter((date) => date >= today)
  );

  return openAssignments.filter((assignment) => selectedDays.has(assignment.assignmentDate));
}

export function getAssignmentsForWorkerRemove(
  blockAssignments: PlanAssignment[],
  today: string,
  employeeId: string,
  selection?: WorkerDaySelection,
) {
  const removableAssignments = blockAssignments.filter(
    (assignment) =>
      ((assignment.assignmentDate > today) ||
        (assignment.assignmentDate === today && assignment.status === "planned")) &&
      (assignment.workers ?? []).some((worker) => worker.id === employeeId)
  );

  if (!selection || selection.mode === "from-date") {
    const effectiveStartDate =
      selection?.startDate && selection.startDate > today ? selection.startDate : today;

    return removableAssignments.filter(
      (assignment) => assignment.assignmentDate >= effectiveStartDate
    );
  }

  const selectedDays = new Set(
    selection.dates.filter((date) => date >= today)
  );

  return removableAssignments.filter((assignment) => selectedDays.has(assignment.assignmentDate));
}

export function getDaySummaries(assignments: PlanAssignment[], visibleDays: string[]) {
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
  assignments: PlanAssignment[],
  visibleDays: string[],
  today = toDateStr(new Date())
) {
  const dayIndexByDate = new Map(visibleDays.map((day, index) => [day, index]));
  const grouped = new Map<string, PlanAssignment[]>();

  for (const assignment of assignments) {
    if (!assignment.job || !dayIndexByDate.has(assignment.assignmentDate)) {
      continue;
    }
    const list = grouped.get(assignment.jobId) ?? [];
    list.push(assignment);
    grouped.set(assignment.jobId, list);
  }

  const blocks: PlanningBlock[] = [];

  for (const [, jobAssignments] of grouped.entries()) {
    const sorted = [...jobAssignments].sort((left, right) => {
      return dayIndexByDate.get(left.assignmentDate)! - dayIndexByDate.get(right.assignmentDate)!;
    });

    let currentChunk: PlanAssignment[] = [];
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
  chunk: PlanAssignment[],
  dayIndexByDate: Map<string, number>,
  today: string
): PlanningBlock {
  const orderedAssignments = [...chunk].sort((left, right) =>
    left.assignmentDate.localeCompare(right.assignmentDate)
  );
  const first = orderedAssignments[0];
  const last = orderedAssignments[orderedAssignments.length - 1];
  const workersById = new Map<string, PlanEmployee>();

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
  assignments: PlanAssignment[],
  dayIndexByDate: Map<string, number>
): BlockWorkerCoverage[] {
  const coverageByWorker = new Map<string, { employee: PlanEmployee; days: string[] }>();

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
