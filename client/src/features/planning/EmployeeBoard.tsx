import { memo } from "react";
import type { EmployeeRow } from "@/features/planning/derived";


import { getEmployeeShortLabel } from "@/features/planning/utils";
import { CATEGORY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

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
};

export const EmployeeBoard = memo(function EmployeeBoard({
  employeeRows,
  visibleDays,
  dayHeaders,
  onCellClick,
  onJobClick,
}: EmployeeBoardProps) {
  const gridCols = `8rem repeat(${visibleDays.length}, minmax(3.5rem, 1fr))`;

  return (
    <div className="overflow-auto">
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
          className="grid border-b hover:bg-muted/30 transition-colors"
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
          {visibleDays.map((day) => {
            const cell = row.cells.get(day);
            const isFree = cell?.isFree ?? true;

            return (
              <div
                key={day}
                className={cn(
                  "min-h-[3rem] border-r p-0.5 transition-colors",
                  isFree
                    ? "cursor-pointer hover:bg-[#68d5c8]/10"
                    : "bg-muted/20",
                )}
                onClick={() =>
                  isFree
                    ? onCellClick(row.employee.id, day)
                    : cell?.blockIds[0] && onJobClick(cell.blockIds[0])
                }
              >
                {cell?.jobs.map((job, idx) => {
                  const color = CATEGORY_COLORS[job.category ?? "other"] ?? CATEGORY_COLORS.other;
                  return (
                    <div
                      key={`${job.id}-${idx}`}
                      className="rounded px-1 py-0.5 text-[9px] font-medium truncate mb-0.5"
                      style={{
                        backgroundColor: `${color}15`,
                        color,
                        borderLeft: `2px solid ${color}`,
                      }}
                      title={`${job.jobNumber} | ${job.title}`}
                    >
                      {job.jobNumber}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}

      {/* Empty State */}
      {employeeRows.length === 0 && (
        <div className="p-8 text-center text-sm brand-ink-soft">
          Keine Mitarbeitenden vorhanden.
        </div>
      )}
    </div>
  );
});
