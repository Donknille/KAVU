import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { EmployeeDayCell, EmployeeRow } from "@/features/planning/derived";
import type { PlanJob } from "@/features/planning/types";
import type { PlanningDropData } from "@/features/planning/types";
import { getEmployeeShortLabel } from "@/features/planning/utils";
import { cn } from "@/lib/utils";

// Deterministic color per job — same job = same color across all employees
const TEAM_COLORS = [
  "#3b82f6", "#ef4444", "#eab308", "#22c55e", "#8b5cf6",
  "#f97316", "#06b6d4", "#ec4899", "#14b8a6", "#6366f1",
];

function getJobColor(jobId: string): string {
  let hash = 0;
  for (let i = 0; i < jobId.length; i++) hash = (hash * 31 + jobId.charCodeAt(i)) | 0;
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
}

type DayHeaderInfo = {
  day: string;
  isToday: boolean;
  weekdayLabel: string;
  dateLabel: string;
};

type EmployeeBoardProps = {
  employeeRows: EmployeeRow[];
  visibleDays: string[];
  dayHeaders: DayHeaderInfo[];
  onCellClick: (employeeId: string, day: string) => void;
  onJobClick: (blockId: string) => void;
  isDragActive: boolean;
};

// Individual droppable cell
function DroppableCell({
  employeeId,
  day,
  cell,
  isDragActive,
  onCellClick,
  onJobClick,
}: {
  employeeId: string;
  day: string;
  cell: EmployeeDayCell | undefined;
  isDragActive: boolean;
  onCellClick: (employeeId: string, day: string) => void;
  onJobClick: (blockId: string) => void;
}) {
  const isFree = cell?.isFree ?? true;

  const { setNodeRef, isOver } = useDroppable({
    id: `employee-cell:${employeeId}:${day}`,
    data: {
      dropType: "employee-cell",
      employeeId,
      date: day,
    } satisfies PlanningDropData,
    disabled: !isDragActive,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[3rem] border-r p-0.5 transition-colors",
        isFree && "cursor-pointer hover:bg-[#68d5c8]/5",
        isOver && isFree && "bg-[#68d5c8]/20 ring-1 ring-inset ring-[#68d5c8]",
        !isFree && "bg-muted/10",
      )}
      onClick={() =>
        isFree
          ? onCellClick(employeeId, day)
          : cell?.blockIds[0] && onJobClick(cell.blockIds[0])
      }
    >
      {cell?.jobs.map((job, idx) => {
        const color = getJobColor(job.id);
        return (
          <div
            key={`${job.id}-${idx}`}
            className="rounded px-1 py-0.5 text-[9px] font-medium truncate mb-0.5 cursor-pointer"
            style={{
              backgroundColor: `${color}15`,
              color,
              borderLeft: `3px solid ${color}`,
            }}
            title={`${job.jobNumber} | ${job.title}`}
          >
            {job.jobNumber}
          </div>
        );
      })}
    </div>
  );
}

// Legend showing job → color mapping
function JobLegend({ jobs }: { jobs: PlanJob[] }) {
  if (jobs.length === 0) return null;

  // Deduplicate by job ID
  const uniqueJobs = Array.from(new Map(jobs.map((j) => [j.id, j])).values());

  return (
    <div className="flex flex-wrap gap-2 border-t px-3 py-2">
      {uniqueJobs.map((job) => {
        const color = getJobColor(job.id);
        return (
          <div key={job.id} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] brand-ink-muted">
              {job.jobNumber} {job.title.length > 20 ? `${job.title.slice(0, 20)}…` : job.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const EmployeeBoard = memo(function EmployeeBoard({
  employeeRows,
  visibleDays,
  dayHeaders,
  onCellClick,
  onJobClick,
  isDragActive,
}: EmployeeBoardProps) {
  const gridCols = `8rem repeat(${visibleDays.length}, minmax(3.5rem, 1fr))`;

  // Collect all jobs for legend
  const allJobs: PlanJob[] = [];
  for (const row of employeeRows) {
    for (const cell of row.cells.values()) {
      allJobs.push(...cell.jobs);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        {/* Header Row */}
        <div
          className="planning-divider grid border-b bg-[var(--brand-icon-shell-bg)] sticky top-0 z-10"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="border-r p-2 text-[10px] font-semibold uppercase tracking-wider brand-ink-muted">
            Mitarbeiter
          </div>
          {dayHeaders.map((header) => (
            <div
              key={header.day}
              className={cn(
                "planning-board-header min-w-0 px-1 py-1.5 text-center brand-ink",
                header.isToday && "brand-highlight",
              )}
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] brand-ink-muted">
                {header.weekdayLabel}
              </p>
              <p className="text-[11px] font-semibold leading-none mt-0.5">
                {header.dateLabel}
              </p>
            </div>
          ))}
        </div>

        {/* Employee Rows */}
        {employeeRows.map((row) => (
          <div
            key={row.employee.id}
            className="grid border-b hover:bg-muted/20 transition-colors"
            style={{ gridTemplateColumns: gridCols }}
          >
            {/* Employee Name Cell */}
            <div className="sticky left-0 z-[5] flex items-center gap-2 border-r bg-background px-2 py-1.5">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: row.employee.color || "#173d66" }}
              >
                {getEmployeeShortLabel(row.employee)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium brand-ink">
                  {row.employee.firstName} {row.employee.lastName}
                </p>
                <p className="text-[10px] brand-ink-muted">
                  {row.assignedDayCount} von {row.assignedDayCount + row.freeDayCount} Tagen
                </p>
              </div>
            </div>

            {/* Day Cells */}
            {visibleDays.map((day) => (
              <DroppableCell
                key={day}
                employeeId={row.employee.id}
                day={day}
                cell={row.cells.get(day)}
                isDragActive={isDragActive}
                onCellClick={onCellClick}
                onJobClick={onJobClick}
              />
            ))}
          </div>
        ))}

        {/* Empty State */}
        {employeeRows.length === 0 && (
          <div className="p-8 text-center text-sm brand-ink-soft">
            Keine Mitarbeitenden vorhanden.
          </div>
        )}
      </div>

      {/* Job Color Legend */}
      <JobLegend jobs={allJobs} />
    </div>
  );
});
