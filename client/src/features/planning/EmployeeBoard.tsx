import { memo } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { EmployeeBlockSpan, EmployeeRow } from "@/features/planning/derived";
import type { PlanJob } from "@/features/planning/types";
import type { PlanningDragData, PlanningDropData } from "@/features/planning/types";
import { getEmployeeShortLabel } from "@/features/planning/utils";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

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

// Droppable cell for each employee × day (background layer for dropping jobs)
const DroppableCell = memo(function DroppableCell({
  employeeId,
  day,
  isFree,
  isDragActive,
}: {
  employeeId: string;
  day: string;
  isFree: boolean;
  isDragActive: boolean;
}) {
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
        "min-h-full border-r transition-colors",
        isDragActive && isFree && "hover:bg-[#68d5c8]/5",
        isOver && "bg-[#68d5c8]/20 ring-1 ring-inset ring-[#68d5c8]",
      )}
    />
  );
});

// A spanning block within an employee row — draggable + resizable
const EmployeeBlockSpanCard = memo(function EmployeeBlockSpanCard({
  span: bs,
  onJobClick,
}: {
  span: EmployeeBlockSpan;
  onJobClick: (blockId: string) => void;
}) {
  const color = getJobColor(bs.job.id);

  const {
    attributes: moveAttributes,
    listeners: moveListeners,
    setActivatorNodeRef: setMoveActivatorRef,
    setNodeRef: setMoveNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `block-move:${bs.blockId}`,
    data: {
      dragType: "block-move",
      blockId: bs.blockId,
    } satisfies PlanningDragData,
  });

  const {
    attributes: endAttributes,
    listeners: endListeners,
    setNodeRef: setEndNodeRef,
  } = useDraggable({
    id: `block-resize-end:${bs.blockId}`,
    data: {
      dragType: "block-resize-end",
      blockId: bs.blockId,
    } satisfies PlanningDragData,
  });

  return (
    <div
      ref={setMoveNodeRef}
      className={cn(
        "group absolute flex items-center overflow-hidden rounded-md border text-[9px] font-medium transition cursor-pointer",
        isDragging && "opacity-50 z-50",
      )}
      style={{
        gridColumn: `${bs.startIndex + 2} / span ${bs.span}`, // +2 because col 1 is employee name
        gridRow: `${bs.lane + 1}`,
        backgroundColor: `${color}18`,
        borderColor: `${color}40`,
        borderLeftWidth: "3px",
        borderLeftColor: color,
        color,
        left: "2px",
        right: "2px",
        top: "2px",
        bottom: "2px",
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : 10,
        position: "relative",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onJobClick(bs.blockId);
      }}
    >
      {/* Move handle */}
      <span
        ref={setMoveActivatorRef}
        className="shrink-0 cursor-grab touch-none px-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
        {...moveAttributes}
        {...moveListeners}
      >
        <GripVertical className="h-3 w-3" />
      </span>

      {/* Content */}
      <span className="truncate flex-1 pr-1">
        {bs.job.jobNumber}
        <span className="ml-0.5 opacity-60">
          {bs.job.title.length > 12 ? `${bs.job.title.slice(0, 12)}…` : bs.job.title}
        </span>
      </span>

      {/* Resize end handle */}
      {bs.span >= 1 && (
        <span
          ref={setEndNodeRef}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize touch-none opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: `${color}30` }}
          {...endAttributes}
          {...endListeners}
        />
      )}
    </div>
  );
});

// Legend showing job → color mapping
function JobLegend({ jobs }: { jobs: PlanJob[] }) {
  if (jobs.length === 0) return null;
  const uniqueJobs = Array.from(new Map(jobs.map((j) => [j.id, j])).values());

  return (
    <div className="flex flex-wrap gap-2 border-t px-3 py-2">
      {uniqueJobs.map((job) => {
        const color = getJobColor(job.id);
        return (
          <div key={job.id} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
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
  const colWidth = visibleDays.length > 14 ? "4.5rem" : "6rem";
  const gridCols = `8rem repeat(${visibleDays.length}, ${colWidth})`;

  // Collect all jobs for legend
  const allJobs: PlanJob[] = [];
  for (const row of employeeRows) {
    for (const bs of row.blockSpans) {
      allJobs.push(bs.job);
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
          <div className="border-r p-2 text-[10px] font-semibold uppercase tracking-wider brand-ink-muted sticky left-0 bg-[var(--brand-icon-shell-bg)] z-[11]">
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
        {employeeRows.map((row) => {
          const rowHeight = Math.max(1, row.laneCount) * 2.2; // rem per lane
          return (
            <div key={row.employee.id} className="border-b hover:bg-muted/10 transition-colors">
              <div
                className="grid relative"
                style={{
                  gridTemplateColumns: gridCols,
                  gridTemplateRows: `repeat(${Math.max(1, row.laneCount)}, minmax(2rem, auto))`,
                  minHeight: `${rowHeight}rem`,
                }}
              >
                {/* Employee Name Cell — spans all lanes */}
                <div
                  className="sticky left-0 z-[5] flex items-center gap-2 border-r bg-background px-2 py-1.5"
                  style={{ gridRow: `1 / span ${Math.max(1, row.laneCount)}` }}
                >
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

                {/* Background droppable cells — one per day, spanning all lanes */}
                {visibleDays.map((day) => {
                  const cell = row.cells.get(day);
                  return (
                    <div
                      key={day}
                      style={{ gridRow: `1 / span ${Math.max(1, row.laneCount)}` }}
                      onClick={() => (cell?.isFree ?? true) ? onCellClick(row.employee.id, day) : undefined}
                    >
                      <DroppableCell
                        employeeId={row.employee.id}
                        day={day}
                        isFree={cell?.isFree ?? true}
                        isDragActive={isDragActive}
                      />
                    </div>
                  );
                })}

                {/* Spanning block cards — positioned via grid */}
                {row.blockSpans.map((bs) => (
                  <EmployeeBlockSpanCard
                    key={`${bs.blockId}-${bs.startDate}`}
                    span={bs}
                    onJobClick={onJobClick}
                  />
                ))}
              </div>
            </div>
          );
        })}

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
