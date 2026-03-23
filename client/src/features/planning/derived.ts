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

// --- Employee-centric plan rows ---

export type EmployeePlanRow = {
  employee: PlanEmployee;
  /** Blocks assigned to this employee, with localLane set for sub-row positioning */
  blocks: Array<PlanningBlock & { localLane: number }>;
  /** Number of sub-lanes within this employee's row (for parallel assignments) */
  laneCount: number;
  /** Global row offset (sum of all previous employees' laneCounts) */
  globalRowOffset: number;
};

export function buildEmployeePlanRows(
  employees: PlanEmployee[],
  blocks: PlanningBlock[],
): EmployeePlanRow[] {
  let globalRowOffset = 0;

  return employees.map((emp) => {
    // Find all blocks where this employee is assigned
    const empBlocks = blocks.filter((b) =>
      b.workerCoverage.some((c) => c.employee.id === emp.id),
    );

    // Lane allocation within the employee row (greedy, same as buildPlanningBlocks)
    const sorted = [...empBlocks].sort((a, b) =>
      a.startIndex !== b.startIndex ? a.startIndex - b.startIndex : b.span - a.span,
    );
    const laneEnds: number[] = [];
    const blocksWithLane = sorted.map((block) => {
      let lane = 0;
      while (laneEnds[lane] !== undefined && block.startIndex <= laneEnds[lane]) lane++;
      laneEnds[lane] = block.endIndex;
      return { ...block, localLane: lane };
    });

    const laneCount = Math.max(1, laneEnds.length);
    const row: EmployeePlanRow = {
      employee: emp,
      blocks: blocksWithLane,
      laneCount,
      globalRowOffset,
    };
    globalRowOffset += laneCount;
    return row;
  });
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
