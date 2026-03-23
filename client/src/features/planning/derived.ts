import type { CSSProperties } from "react";
import type {
  PlanAssignment,
  PlanEmployee,
  PlanJob,
  PlanningBlock,
  PlanningBoardResponse,
  ViewSpan,
} from "@/features/planning/types";
import { getEmployeeLabel, uniqueSortedDates } from "@/features/planning/utils";
import { QK } from "@/lib/queryKeys";

export const JOBS_QUERY_KEY = QK.JOBS;

export const EMPTY_PLANNING_BOARD: PlanningBoardResponse = {
  employees: [],
  activeEmployees: [],
  backlogJobs: [],
  assignments: [],
  blocks: [],
  daySummaries: [],
};

export type TeamFilterMode = "all" | "unassigned" | "free-focus";

export type TeamOverviewEntry = {
  employee: PlanEmployee;
  scheduledDays: string[];
  focusAssigned: boolean;
  unassignedInWindow: boolean;
  fullyBookedInWindow: boolean;
  section: "unassigned" | "free-focus" | "scheduled-focus";
  badgeLabel: string;
  badgeTone: "neutral" | "free" | "scheduled";
  detailLabel: string;
};

export type TeamSection = {
  id: TeamOverviewEntry["section"];
  title: string;
  description: string;
  items: TeamOverviewEntry[];
};

export function filterJobs(jobs: PlanJob[], searchTerm: string) {
  if (!searchTerm.trim()) {
    return jobs;
  }

  const normalizedSearch = searchTerm.toLowerCase();
  return jobs.filter((job) => {
    const haystack = `${job.jobNumber} ${job.title} ${job.customerName}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}

export function buildTeamOverview(
  employees: PlanEmployee[],
  assignments: PlanAssignment[],
  visibleDays: string[],
  focusDate: string,
): TeamOverviewEntry[] {
  const visibleDaySet = new Set(visibleDays);

  return employees
    .map((employee) => {
      const scheduledDays = uniqueSortedDates(
        assignments
          .filter(
            (assignment) =>
              visibleDaySet.has(assignment.assignmentDate) &&
              (assignment.workers ?? []).some((worker) => worker.id === employee.id),
          )
          .map((assignment) => assignment.assignmentDate),
      );
      const scheduledCount = scheduledDays.length;
      const focusAssigned = scheduledDays.includes(focusDate);
      const unassignedInWindow = scheduledCount === 0;
      const fullyBookedInWindow = visibleDays.length > 0 && scheduledCount >= visibleDays.length;

      let section: TeamOverviewEntry["section"];
      let badgeLabel: string;
      let badgeTone: TeamOverviewEntry["badgeTone"];

      if (unassignedInWindow) {
        section = "unassigned";
        badgeLabel = "Ohne Einsatz";
        badgeTone = "neutral";
      } else if (!focusAssigned) {
        section = "free-focus";
        badgeLabel = "Frei";
        badgeTone = "free";
      } else {
        section = "scheduled-focus";
        badgeLabel = "Eingeplant";
        badgeTone = "scheduled";
      }

      const detailLabel = unassignedInWindow
        ? "Im sichtbaren Zeitraum noch offen"
        : fullyBookedInWindow
          ? `An allen ${visibleDays.length} Tagen eingeplant`
          : `${scheduledCount} von ${visibleDays.length} Tagen eingeplant`;

      return {
        employee,
        scheduledDays,
        focusAssigned,
        unassignedInWindow,
        fullyBookedInWindow,
        section,
        badgeLabel,
        badgeTone,
        detailLabel,
      };
    })
    .sort((left, right) => {
      const sectionOrder = {
        unassigned: 0,
        "free-focus": 1,
        "scheduled-focus": 2,
      } as const;
      const sectionDelta = sectionOrder[left.section] - sectionOrder[right.section];
      if (sectionDelta !== 0) {
        return sectionDelta;
      }
      if (left.scheduledDays.length !== right.scheduledDays.length) {
        return left.scheduledDays.length - right.scheduledDays.length;
      }
      return getEmployeeLabel(left.employee).localeCompare(getEmployeeLabel(right.employee));
    });
}

export function filterTeamOverview(
  entries: TeamOverviewEntry[],
  searchTerm: string,
  teamFilter: TeamFilterMode,
) {
  const hasSearch = !!searchTerm.trim();
  const normalizedSearch = searchTerm.toLowerCase();

  return entries.filter((entry) => {
    if (hasSearch) {
      const haystack =
        `${entry.employee.firstName} ${entry.employee.lastName} ${entry.employee.phone ?? ""}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }

    if (teamFilter === "unassigned") {
      return entry.unassignedInWindow;
    }
    if (teamFilter === "free-focus") {
      return !entry.focusAssigned;
    }
    return true;
  });
}

export function buildTeamSections(entries: TeamOverviewEntry[], focusLabel: string) {
  return [
    {
      id: "unassigned",
      title: "Nicht eingeteilt",
      description: "Im sichtbaren Zeitraum ohne Einsatz.",
      items: entries.filter((entry) => entry.section === "unassigned"),
    },
    {
      id: "free-focus",
      title: `${focusLabel} frei`,
      description: "An diesem Tag verfügbar, aber an anderen Tagen bereits eingeplant.",
      items: entries.filter((entry) => entry.section === "free-focus"),
    },
    {
      id: "scheduled-focus",
      title: `${focusLabel} eingeplant`,
      description: "Am Fokus-Tag bereits im Einsatz.",
      items: entries.filter((entry) => entry.section === "scheduled-focus"),
    },
  ].filter((section) => section.items.length > 0) as TeamSection[];
}

export function getPlanningBoardLayout({
  isMobile,
  viewSpan,
  visibleDayCount,
  laneCount,
}: {
  isMobile: boolean;
  viewSpan: ViewSpan;
  visibleDayCount: number;
  laneCount: number;
}) {
  const columnMinWidth = isMobile ? (viewSpan === 2 ? 104 : 76) : viewSpan === 2 ? 58 : 36;
  const laneHeight = isMobile ? (viewSpan === 2 ? 88 : 64) : viewSpan === 2 ? 56 : 40;
  const boardMinHeight = isMobile
    ? viewSpan === 2 ? "18rem" : "14rem"
    : viewSpan === 2 ? "13.5rem" : "11rem";

  const boardGridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${visibleDayCount}, minmax(${columnMinWidth}px, 1fr))`,
    gridTemplateRows: `repeat(${laneCount}, ${laneHeight}px)`,
    minHeight: `${laneCount * laneHeight}px`,
  };

  const boardBackgroundStyle: CSSProperties = {
    backgroundColor: "var(--planning-board-surface)",
    backgroundImage:
      "linear-gradient(to right, var(--planning-board-grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--planning-board-grid-line) 1px, transparent 1px)",
    backgroundSize: `calc(100% / ${visibleDayCount}) calc(100% / ${laneCount})`,
  };

  return {
    columnMinWidth,
    laneHeight,
    boardMinHeight,
    boardGridStyle,
    boardBackgroundStyle,
  };
}

// --- Employee Board (Mitarbeiter-Ansicht) ---

export type EmployeeDayCell = {
  jobs: PlanJob[];
  blockIds: string[];
  statuses: string[];
  isFree: boolean;
};

export type EmployeeBlockSpan = {
  blockId: string;
  job: PlanJob;
  startIndex: number;
  span: number;
  startDate: string;
  endDate: string;
  days: string[];
  status: string;
  lane: number;
};

export type EmployeeRow = {
  employee: PlanEmployee;
  cells: Map<string, EmployeeDayCell>;
  blockSpans: EmployeeBlockSpan[];
  laneCount: number;
  assignedDayCount: number;
  freeDayCount: number;
};

export function buildEmployeeRows(
  employees: PlanEmployee[],
  blocks: PlanningBlock[],
  visibleDays: string[],
): EmployeeRow[] {
  // Pre-index: for each employee, which blocks cover which days
  const empDayBlocks = new Map<string, Map<string, PlanningBlock[]>>();

  for (const block of blocks) {
    for (const coverage of block.workerCoverage) {
      let dayMap = empDayBlocks.get(coverage.employee.id);
      if (!dayMap) {
        dayMap = new Map();
        empDayBlocks.set(coverage.employee.id, dayMap);
      }
      for (const day of coverage.days) {
        const list = dayMap.get(day) ?? [];
        list.push(block);
        dayMap.set(day, list);
      }
    }
  }

  return employees.map((emp) => {
    const dayMap = empDayBlocks.get(emp.id);
    let assignedDayCount = 0;

    const cells = new Map<string, EmployeeDayCell>(
      visibleDays.map((day) => {
        const dayBlocks = dayMap?.get(day) ?? [];
        const isFree = dayBlocks.length === 0;
        if (!isFree) assignedDayCount++;
        return [
          day,
          {
            jobs: dayBlocks.map((b) => b.job),
            blockIds: dayBlocks.map((b) => b.id),
            statuses: dayBlocks.map((b) => b.status),
            isFree,
          },
        ];
      }),
    );

    // Build spanning blocks for this employee
    const dayIndexByDate = new Map(visibleDays.map((d, i) => [d, i]));
    const empBlocks = new Map<string, { block: PlanningBlock; days: string[] }>();

    // Collect which days each block covers for this employee
    for (const block of blocks) {
      const coverage = block.workerCoverage.find((c) => c.employee.id === emp.id);
      if (!coverage) continue;
      const coveredVisibleDays = coverage.days.filter((d) => dayIndexByDate.has(d)).sort();
      if (coveredVisibleDays.length === 0) continue;
      empBlocks.set(block.id, { block, days: coveredVisibleDays });
    }

    // Convert to spanning blocks (split on gaps)
    const blockSpans: EmployeeBlockSpan[] = [];
    for (const [, { block, days }] of empBlocks) {
      let chunk: string[] = [];
      for (const day of days) {
        const idx = dayIndexByDate.get(day)!;
        if (chunk.length > 0) {
          const prevIdx = dayIndexByDate.get(chunk[chunk.length - 1])!;
          if (idx !== prevIdx + 1) {
            // Gap — flush chunk
            const startIdx = dayIndexByDate.get(chunk[0])!;
            blockSpans.push({
              blockId: block.id,
              job: block.job,
              startIndex: startIdx,
              span: chunk.length,
              startDate: chunk[0],
              endDate: chunk[chunk.length - 1],
              days: [...chunk],
              status: block.status,
              lane: 0,
            });
            chunk = [];
          }
        }
        chunk.push(day);
      }
      if (chunk.length > 0) {
        const startIdx = dayIndexByDate.get(chunk[0])!;
        blockSpans.push({
          blockId: block.id,
          job: block.job,
          startIndex: startIdx,
          span: chunk.length,
          startDate: chunk[0],
          endDate: chunk[chunk.length - 1],
          days: [...chunk],
          status: block.status,
          lane: 0,
        });
      }
    }

    // Assign lanes (same algorithm as main board)
    blockSpans.sort((a, b) => a.startIndex !== b.startIndex ? a.startIndex - b.startIndex : b.span - a.span);
    const laneEnds: number[] = [];
    for (const bs of blockSpans) {
      let lane = 0;
      while (laneEnds[lane] !== undefined && bs.startIndex <= laneEnds[lane]) {
        lane++;
      }
      laneEnds[lane] = bs.startIndex + bs.span - 1;
      bs.lane = lane;
    }

    return {
      employee: emp,
      cells,
      blockSpans,
      laneCount: Math.max(1, laneEnds.length),
      assignedDayCount,
      freeDayCount: visibleDays.length - assignedDayCount,
    };
  });
}
