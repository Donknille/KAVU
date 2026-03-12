import { useEffect, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  LockKeyhole,
  MapPin,
  Phone,
  Plus,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_BG,
  CATEGORY_COLORS,
  JOB_CATEGORY_LABELS,
  formatAddress,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  ActiveDrag,
  EmployeeAvailability,
  JobForm,
  PlanEmployee,
  PlanJob,
  PlanningDragData,
  PlanningDropData,
  PlanningBlock,
  ResizePreview,
  WorkerDaySelection,
} from "@/features/planning/types";
import {
  formatCompactDate,
  formatRange,
  getEmployeeLabel,
  getEmployeeShortLabel,
  toDateStr,
} from "@/features/planning/utils";

export function BacklogJobCard({ job, compact }: { job: PlanJob; compact: boolean }) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `job:${job.id}`,
    data: {
      dragType: "job",
      jobId: job.id,
    } satisfies PlanningDragData,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "w-full rounded-xl border bg-background text-left shadow-sm transition",
        compact ? "min-h-[5rem] p-2" : "min-h-[6.75rem] p-2.5",
        "hover:border-slate-300 hover:shadow-md",
        isDragging && "opacity-60"
      )}
      style={{
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 40 : undefined,
      }}
    >
      <div className={cn("flex items-start", compact ? "gap-2" : "gap-2.5")}>
        <div
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-lg border",
            compact ? "h-7 w-7" : "h-8 w-8"
          )}
          style={{
            borderColor: CATEGORY_COLORS[job.category ?? "other"] ?? CATEGORY_COLORS.other,
            color: CATEGORY_COLORS[job.category ?? "other"] ?? CATEGORY_COLORS.other,
          }}
        >
          <CategoryIcon category={job.category ?? "other"} className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <p
              className={cn(
                "min-w-0 flex-1 font-semibold leading-tight text-slate-900",
                compact ? "line-clamp-2 text-[11px]" : "line-clamp-2 text-[13px]"
              )}
            >
              {job.title}
            </p>
            <Badge
              variant="secondary"
              className={cn(
                "shrink-0 rounded-full py-0",
                compact ? "px-1.5 text-[9px]" : "px-2 text-[10px]"
              )}
            >
              Backlog
            </Badge>
          </div>
          <p
            className={cn(
              "mt-0.5 line-clamp-2 text-muted-foreground",
              compact ? "text-[10px] leading-snug" : "text-xs"
            )}
          >
            {job.jobNumber} | {job.customerName}
          </p>
          <p
            className={cn(
              "mt-1 text-muted-foreground",
              compact ? "line-clamp-2 text-[10px] leading-snug" : "line-clamp-2 text-[11px]"
            )}
          >
            {formatAddress(job.addressStreet, job.addressZip, job.addressCity) || "Keine Adresse"}
          </p>
        </div>
        <span
          ref={setActivatorNodeRef}
          className={cn(
            "mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-slate-100 touch-none",
            compact ? "h-5 w-5" : "h-6 w-6"
          )}
          aria-label="Auftrag ziehen"
          {...attributes}
          {...listeners}
        >
          <GripVertical className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </span>
      </div>
    </button>
  );
}

export function TeamMemberCard({
  employee,
  availability,
  compact,
}: {
  employee: PlanEmployee;
  availability: EmployeeAvailability;
  compact?: boolean;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `employee:${employee.id}`,
    data: {
      dragType: "employee",
      employeeId: employee.id,
    } satisfies PlanningDragData,
  });

  const statusClass =
    availability === "assigned"
      ? "bg-emerald-100 text-emerald-800"
      : availability === "scheduled"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";

  const statusLabel =
    availability === "assigned"
      ? "Zugewiesen"
      : availability === "scheduled"
        ? "Schon geplant"
        : "Frei";

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "w-full rounded-xl border bg-background text-left shadow-sm transition",
        compact ? "min-h-[4.5rem] p-2" : "min-h-[4.75rem] p-2.5",
        "hover:border-slate-300 hover:shadow-md",
        isDragging && "opacity-60"
      )}
      style={{
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 40 : undefined,
      }}
    >
      <div className={cn("flex items-center", compact ? "gap-2" : "gap-2.5")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
            compact ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-[11px]"
          )}
          style={{ backgroundColor: employee.color ?? "#475569" }}
        >
          {getEmployeeShortLabel(employee)}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-semibold leading-tight", compact ? "text-xs" : "text-[13px]")}>
            {getEmployeeLabel(employee)}
          </p>
          {!compact && (
            <p className="truncate text-[11px] text-muted-foreground">
              {employee.phone || "Keine Telefonnummer"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Badge
            variant="secondary"
            className={cn(
              "rounded-full py-0",
              compact ? "px-1.5 text-[9px]" : "px-2 text-[10px]",
              statusClass
            )}
          >
            {statusLabel}
          </Badge>
          <span
            ref={setActivatorNodeRef}
            className={cn(
              "rounded-md p-1 text-muted-foreground transition hover:bg-slate-100 touch-none",
              compact ? "h-5 w-5" : "h-6 w-6"
            )}
            aria-label="Mitarbeiter ziehen"
            {...attributes}
            {...listeners}
          >
            <GripVertical className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </span>
        </div>
      </div>
    </button>
  );
}

export function DayColumnDropZone({
  date,
  column,
  laneCount,
  isEnabled,
}: {
  date: string;
  column: number;
  laneCount: number;
  isEnabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${date}`,
    data: {
      dropType: "day",
      date,
    } satisfies PlanningDropData,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border-2 border-dashed transition",
        isEnabled ? "border-slate-200/80" : "border-transparent",
        isEnabled && isOver && "border-blue-400 bg-blue-100/50"
      )}
      style={{
        gridColumn: column,
        gridRow: `1 / span ${laneCount}`,
      }}
    />
  );
}

export function PlanningBlockCard({
  block,
  compact,
  overview = false,
  readableCompact = false,
  employeeDropActive = false,
  selected,
  onSelect,
}: {
  block: PlanningBlock;
  compact: boolean;
  overview?: boolean;
  readableCompact?: boolean;
  employeeDropActive?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const {
    attributes: moveAttributes,
    listeners: moveListeners,
    setActivatorNodeRef: setMoveActivatorNodeRef,
    setNodeRef: setMoveNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `block-move:${block.id}`,
    data: {
      dragType: "block-move",
      blockId: block.id,
    } satisfies PlanningDragData,
  });
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `block:${block.id}`,
    data: {
      dropType: "block",
      blockId: block.id,
      startDate: block.startDate,
      endDate: block.endDate,
      days: block.days,
    } satisfies PlanningDropData,
  });
  const {
    attributes: startAttributes,
    listeners: startListeners,
    setNodeRef: setStartNodeRef,
  } = useDraggable({
    id: `block-resize-start:${block.id}`,
    data: {
      dragType: "block-resize-start",
      blockId: block.id,
    } satisfies PlanningDragData,
  });
  const { setNodeRef: setEmployeeDropNodeRef, isOver: isEmployeeOver } = useDroppable({
    id: `block-employee:${block.id}`,
    data: {
      dropType: "block",
      blockId: block.id,
      startDate: block.startDate,
      endDate: block.endDate,
      days: block.days,
    } satisfies PlanningDropData,
  });
  const {
    attributes: endAttributes,
    listeners: endListeners,
    setNodeRef: setEndNodeRef,
  } = useDraggable({
    id: `block-resize-end:${block.id}`,
    data: {
      dragType: "block-resize-end",
      blockId: block.id,
    } satisfies PlanningDragData,
  });

  const setRefs = (node: HTMLDivElement | null) => {
    setMoveNodeRef(node);
    setDropNodeRef(node);
  };

  const category = block.job.category ?? "other";
  const workerPreview = block.workers.slice(0, compact ? 2 : 4);
  const remainingWorkers = block.workers.length - workerPreview.length;
  const showExtendedMeta = !overview;
  const shouldWrapTitle = !overview && (readableCompact || !compact);

  return (
    <div
      ref={setRefs}
      className={cn(
        "group relative flex h-full min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm transition",
        CATEGORY_BG[category] ?? CATEGORY_BG.other,
        block.canMove && "cursor-grab active:cursor-grabbing",
        selected && "ring-2 ring-slate-900/20",
        isOver && "ring-2 ring-blue-400",
        isDragging && "opacity-60"
      )}
      style={{
        gridColumn: `${block.startIndex + 1} / span ${block.span}`,
        gridRow: `${block.lane + 1}`,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : selected ? 20 : 10,
      }}
      onClick={onSelect}
    >
      {employeeDropActive && block.canAssignWorkers && (
        <div
          ref={setEmployeeDropNodeRef}
          className={cn(
            "pointer-events-none absolute inset-0 z-20 rounded-xl border-2 border-dashed transition",
            isEmployeeOver
              ? "border-emerald-500 bg-emerald-100/75 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)]"
              : "border-emerald-300/80 bg-emerald-50/55"
          )}
        >
          <div className="absolute right-2 top-2 rounded-full border bg-white/95 px-2 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm">
            {isEmployeeOver ? "Hier zuweisen" : "Mitarbeiter hier ablegen"}
          </div>
        </div>
      )}

      <div
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ backgroundColor: CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other }}
      />

      {block.canResizeStart && (
        <button
          ref={setStartNodeRef}
          type="button"
          className={cn(
            "absolute left-1 top-1 bottom-1 z-10 hidden rounded-full border border-transparent bg-white/60 text-slate-500 transition hover:border-slate-300 group-hover:block touch-none",
            compact ? "w-2.5" : "w-3"
          )}
          aria-label="Start verschieben"
          {...startAttributes}
          {...startListeners}
        />
      )}

      {block.canResizeEnd && (
        <button
          ref={setEndNodeRef}
          type="button"
          className={cn(
            "absolute right-1 top-1 bottom-1 z-10 flex items-center justify-center rounded-full border border-sky-200 bg-white/90 text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 touch-none",
            compact ? "w-4" : "w-10"
          )}
          aria-label="Ende verschieben"
          {...endAttributes}
          {...endListeners}
        >
          {compact ? (
            <Plus className="h-2.5 w-2.5" />
          ) : (
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em]">+ Tag</span>
          )}
        </button>
      )}

      <div
        className={cn(
          "flex min-w-0 flex-1 items-start",
          compact ? (readableCompact ? "gap-2 px-2 py-2" : "gap-2 px-2 py-1.5") : "gap-2.5 px-3 py-2.5"
        )}
      >
        <div
          ref={block.canMove ? setMoveActivatorNodeRef : undefined}
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-lg border bg-white/80 text-slate-500 touch-none",
            compact ? "h-6 w-6" : "h-7 w-7",
            block.canMove && "shadow-sm"
          )}
          {...(block.canMove ? moveAttributes : {})}
          {...(block.canMove ? moveListeners : {})}
          aria-hidden={block.canMove ? undefined : true}
        >
          <GripVertical className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </div>

        <div className="min-w-0 flex-1">
          <div className={cn("flex flex-wrap items-center", compact ? "gap-1.5" : "gap-2")}>
            <p
              className={cn(
                "font-semibold leading-tight",
                shouldWrapTitle ? "line-clamp-2 break-words" : "truncate",
                overview ? "text-[11px]" : compact ? (readableCompact ? "text-[11px]" : "text-xs") : "text-[13px]"
              )}
            >
              {block.job.jobNumber} | {block.job.title}
            </p>
            <StatusBadge
              status={block.status}
              className={cn(compact ? "px-1.5 py-0 text-[9px]" : "", overview && "px-1 py-0 text-[8px]")}
            />
            {!block.canMove && (
              <Badge
                variant="secondary"
                className={cn("gap-1", compact ? "px-1.5 py-0 text-[9px]" : "", overview && "px-1 py-0 text-[8px]")}
              >
                <LockKeyhole className="h-3 w-3" />
                Fix
              </Badge>
            )}
          </div>
          {!compact && showExtendedMeta && (
            <p className="truncate text-xs text-muted-foreground">{block.job.customerName}</p>
          )}
          <div
            className={cn(
              "flex flex-wrap items-center text-muted-foreground",
              overview
                ? "mt-1 gap-1 text-[9px]"
                : compact
                  ? readableCompact
                    ? "mt-1.5 gap-1 text-[10px]"
                    : "mt-1 gap-1 text-[10px]"
                  : "mt-1.5 gap-1.5 text-[11px]"
            )}
          >
            {showExtendedMeta ? (
              <>
                <span>{formatRange(block.startDate, block.endDate)}</span>
                <span>|</span>
              </>
            ) : (
              <>
                <span>{block.span} T</span>
                <span>|</span>
              </>
            )}
            <span>{block.workers.length} MA</span>
            {!compact && showExtendedMeta && block.job.contactPhone && (
              <>
                <span>|</span>
                <span>{block.job.contactPhone}</span>
              </>
            )}
          </div>
          <div className={cn("flex flex-wrap", compact ? "mt-1.5 gap-1" : "mt-2 gap-1.5")}>
            {workerPreview.map((worker) => (
              compact ? (
                <span
                  key={worker.id}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full border bg-white/85 px-1 font-semibold",
                    overview ? "h-4 min-w-4 text-[8px]" : "h-5 min-w-5 text-[9px]"
                  )}
                  style={{ borderColor: worker.color ?? "#64748b" }}
                >
                  {getEmployeeShortLabel(worker)}
                </span>
              ) : (
                <span
                  key={worker.id}
                  className="inline-flex items-center gap-1 rounded-full border bg-white/80 px-1.5 py-0.5 text-[10px] font-medium"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: worker.color ?? "#64748b" }}
                  />
                  {getEmployeeShortLabel(worker)}
                </span>
              )
            ))}
            {remainingWorkers > 0 && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border bg-white/80 font-medium",
                  overview ? "px-1 py-0 text-[8px]" : compact ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
                )}
              >
                +{remainingWorkers}
              </span>
            )}
            {block.workers.length === 0 && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border border-dashed bg-white/60 font-medium text-muted-foreground",
                  overview ? "px-1 py-0 text-[8px]" : compact ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
                )}
              >
                {overview ? "Team" : "Mitarbeiter hineinziehen"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResizePreviewGhost({
  preview,
  compact,
}: {
  preview: ResizePreview | null;
  compact: boolean;
}) {
  if (!preview) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "pointer-events-none rounded-xl border-2 border-dashed",
          preview.valid ? "border-sky-400 bg-sky-100/35" : "border-rose-400 bg-rose-100/35"
        )}
        style={{
          gridColumn: `${preview.startIndex + 1} / span ${preview.span}`,
          gridRow: `${preview.lane + 1}`,
          zIndex: 6,
        }}
      >
        <div className="flex h-full items-start justify-between gap-2 px-2 py-1">
          <div className="min-w-0">
            <p className={cn("truncate font-semibold text-slate-700", compact ? "text-[10px]" : "text-xs")}>
              {preview.valid ? "Neuer Zeitraum" : "Nicht moeglich"}
            </p>
            {!compact && <p className="truncate text-[10px] text-slate-500">{preview.label}</p>}
          </div>
        </div>
      </div>

      {preview.addedStartIndex !== null && preview.addedSpan > 0 && (
        <div
          className={cn(
            "pointer-events-none rounded-xl border border-dashed",
            preview.valid ? "border-sky-500/80 bg-sky-200/55" : "border-rose-500/80 bg-rose-200/55"
          )}
          style={{
            gridColumn: `${preview.addedStartIndex + 1} / span ${preview.addedSpan}`,
            gridRow: `${preview.lane + 1}`,
            zIndex: 7,
          }}
        />
      )}
    </>
  );
}

export function DragOverlayCard({ activeDrag }: { activeDrag: ActiveDrag | null }) {
  if (!activeDrag) {
    return null;
  }

  if (activeDrag.type === "job") {
    return (
      <Card className="w-72 border shadow-xl">
        <div className="flex items-start gap-3 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border">
            <CategoryIcon category={activeDrag.job.category ?? "other"} className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{activeDrag.job.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {activeDrag.job.jobNumber} | {activeDrag.job.customerName}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (activeDrag.type === "employee") {
    return (
      <Card className="w-64 border shadow-xl">
        <div className="flex items-center gap-3 p-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: activeDrag.employee.color ?? "#475569" }}
          >
            {getEmployeeShortLabel(activeDrag.employee)}
          </div>
          <div>
            <p className="text-sm font-semibold">{getEmployeeLabel(activeDrag.employee)}</p>
            <p className="text-xs text-muted-foreground">In Auftrag ziehen</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-80 border shadow-xl">
      <div className="p-3">
        <p className="truncate text-sm font-semibold">
          {activeDrag.block.job.jobNumber} | {activeDrag.block.job.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {activeDrag.type === "block-move"
            ? "Auftrag verschieben"
            : activeDrag.type === "block-resize-start"
              ? "Startdatum anpassen"
              : "Enddatum anpassen"}
        </p>
      </div>
    </Card>
  );
}

export function SelectedBlockPanel({
  selectedBlock,
  availableEmployees = [],
  availableStartDates = [],
  getEmployeeAvailability,
  onAssignEmployee,
  onMoveBlock,
  onRemoveEmployee,
  onRemoveBlock,
}: {
  selectedBlock: PlanningBlock | null;
  availableEmployees?: PlanEmployee[];
  availableStartDates?: string[];
  getEmployeeAvailability?: (employeeId: string) => EmployeeAvailability;
  onAssignEmployee?: (employeeId: string, selection?: WorkerDaySelection) => void;
  onMoveBlock?: (targetDate: string) => void;
  onRemoveEmployee: (employeeId: string, selection?: WorkerDaySelection) => void;
  onRemoveBlock: () => void;
}) {
  const today = toDateStr(new Date());
  const assignmentByDate = new Map(
    selectedBlock?.assignments.map((assignment) => [assignment.assignmentDate, assignment]) ?? []
  );
  const assignableStartDates = selectedBlock
    ? selectedBlock.assignments
        .filter(
          (assignment) =>
            assignment.assignmentDate >= today && assignment.status !== "completed"
        )
        .map((assignment) => assignment.assignmentDate)
    : [];
  const assignableDaySet = new Set(assignableStartDates);
  const assignableEmployees = selectedBlock
    ? availableEmployees.filter((employee) =>
        selectedBlock.assignments.some(
          (assignment) =>
            assignment.assignmentDate >= today &&
            assignment.status !== "completed" &&
            !(assignment.workers ?? []).some((worker) => worker.id === employee.id)
        )
      )
    : [];
  const removableCoverages = selectedBlock
    ? selectedBlock.workerCoverage.filter((coverage) =>
        coverage.days.some((day) => {
          const assignment = assignmentByDate.get(day);
          if (!assignment) {
            return false;
          }
          return day > today || (day === today && assignment.status === "planned");
        })
      )
    : [];
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedStartDate, setSelectedStartDate] = useState("");
  const [assignMode, setAssignMode] = useState<"from-date" | "specific-days">("from-date");
  const [selectedAssignDays, setSelectedAssignDays] = useState<string[]>([]);
  const [selectedMoveDate, setSelectedMoveDate] = useState("");
  const [selectedRemoveEmployeeId, setSelectedRemoveEmployeeId] = useState("");
  const [selectedRemoveDays, setSelectedRemoveDays] = useState<string[]>([]);

  function toggleDate(dates: string[], targetDate: string) {
    return dates.includes(targetDate)
      ? dates.filter((date) => date !== targetDate)
      : [...dates, targetDate].sort((left, right) => left.localeCompare(right));
  }

  function sameDates(left: string[], right: string[]) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  const removableDaysForEmployee = (employeeId: string) => {
    const coverage = removableCoverages.find((entry) => entry.employee.id === employeeId);
    if (!coverage) {
      return [];
    }

    return coverage.days.filter((day) => {
      const assignment = assignmentByDate.get(day);
      return !!assignment && (day > today || (day === today && assignment.status === "planned"));
    });
  };

  const selectedRemovableDays = removableDaysForEmployee(selectedRemoveEmployeeId);

  useEffect(() => {
    if (assignableEmployees.length === 0) {
      setSelectedEmployeeId("");
    } else if (!assignableEmployees.some((employee) => employee.id === selectedEmployeeId)) {
      setSelectedEmployeeId(assignableEmployees[0]?.id ?? "");
    }
  }, [assignableEmployees, selectedEmployeeId]);

  useEffect(() => {
    if (assignableStartDates.length === 0) {
      setSelectedStartDate("");
    } else if (!assignableStartDates.includes(selectedStartDate)) {
      setSelectedStartDate(assignableStartDates[0] ?? "");
    }
  }, [assignableStartDates, selectedStartDate]);

  useEffect(() => {
    setSelectedAssignDays((current) => {
      const next = current.filter((date) => assignableDaySet.has(date));
      if (sameDates(current, next)) {
        return current;
      }
      if (next.length > 0) {
        return next;
      }
      return assignableStartDates[0] ? [assignableStartDates[0]] : [];
    });
  }, [assignableDaySet, assignableStartDates]);

  useEffect(() => {
    if (!selectedBlock || availableStartDates.length === 0) {
      setSelectedMoveDate("");
      return;
    }

    if (
      selectedMoveDate &&
      availableStartDates.includes(selectedMoveDate) &&
      selectedMoveDate !== selectedBlock.startDate
    ) {
      return;
    }

    setSelectedMoveDate(
      availableStartDates.find((date) => date !== selectedBlock.startDate) ?? selectedBlock.startDate
    );
  }, [availableStartDates, selectedBlock, selectedMoveDate]);

  useEffect(() => {
    if (removableCoverages.length === 0) {
      setSelectedRemoveEmployeeId("");
      setSelectedRemoveDays([]);
      return;
    }

    if (!removableCoverages.some((coverage) => coverage.employee.id === selectedRemoveEmployeeId)) {
      setSelectedRemoveEmployeeId(removableCoverages[0]?.employee.id ?? "");
    }
  }, [removableCoverages, selectedRemoveEmployeeId]);

  useEffect(() => {
    if (selectedRemovableDays.length === 0) {
      setSelectedRemoveDays((current) => (current.length === 0 ? current : []));
      return;
    }

    setSelectedRemoveDays((current) => {
      const next = current.filter((date) => selectedRemovableDays.includes(date));
      if (sameDates(current, next)) {
        return current;
      }
      if (next.length > 0) {
        return next;
      }
      return [selectedRemovableDays[0]];
    });
  }, [selectedRemovableDays]);

  if (!selectedBlock) {
    return (
      <Card className="rounded-3xl border bg-card p-5 shadow-sm">
        Auftrag auswaehlen oder direkt Mitarbeiter auf einen Auftragsbalken ziehen.
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border bg-card p-4 shadow-sm">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {selectedBlock.job.jobNumber} | {selectedBlock.job.title}
            </p>
            <p className="truncate text-sm text-muted-foreground">{selectedBlock.job.customerName}</p>
          </div>
          <StatusBadge status={selectedBlock.status} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{formatRange(selectedBlock.startDate, selectedBlock.endDate)}</Badge>
          <Badge variant="secondary">{selectedBlock.workers.length} Mitarbeitende</Badge>
          {selectedBlock.hasProtectedHistory && (
            <Badge variant="secondary" className="gap-1">
              <LockKeyhole className="h-3 w-3" />
              Vergangene Tage fix
            </Badge>
          )}
        </div>

        {(selectedBlock.job.addressStreet || selectedBlock.job.addressCity) && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {formatAddress(
                selectedBlock.job.addressStreet,
                selectedBlock.job.addressZip,
                selectedBlock.job.addressCity
              )}
            </span>
          </div>
        )}

        {selectedBlock.job.contactPhone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{selectedBlock.job.contactPhone}</span>
          </div>
        )}

        {selectedBlock.canAssignWorkers && (
          <div className="space-y-2 rounded-2xl border bg-muted/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Mitarbeiter direkt zuordnen</p>
                <p className="text-xs text-muted-foreground">
                  Fallback, falls Drag & Drop hakt. Tagesgenaue Teilzuweisungen sind hier ebenfalls moeglich.
                </p>
              </div>
              <Badge variant="outline" className="gap-1">
                <UserRoundPlus className="h-3 w-3" />
                Direkt
              </Badge>
            </div>

            {assignableEmployees.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={assignMode === "from-date" ? "secondary" : "ghost"}
                    onClick={() => setAssignMode("from-date")}
                  >
                    Ab Datum
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={assignMode === "specific-days" ? "secondary" : "ghost"}
                    onClick={() => setAssignMode("specific-days")}
                  >
                    Ausgewaehlte Tage
                  </Button>
                </div>

                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Mitarbeiter waehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableEmployees.map((employee) => {
                      const availability = getEmployeeAvailability?.(employee.id) ?? "free";
                      const availabilityLabel =
                        availability === "scheduled"
                          ? "Schon geplant"
                          : availability === "assigned"
                            ? "Bereits zugeordnet"
                            : "Frei";

                      return (
                        <SelectItem key={employee.id} value={employee.id}>
                          {getEmployeeLabel(employee)} | {availabilityLabel}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {assignMode === "from-date" ? (
                  <div className="grid gap-2 md:grid-cols-[12rem_auto]">
                    <Select value={selectedStartDate} onValueChange={setSelectedStartDate}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Ab wann?" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableStartDates.map((startDate) => (
                          <SelectItem key={startDate} value={startDate}>
                            Ab {formatCompactDate(startDate)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      className="shrink-0 gap-1.5"
                      onClick={() => {
                        if (selectedEmployeeId && onAssignEmployee) {
                          onAssignEmployee(selectedEmployeeId, {
                            mode: "from-date",
                            startDate: selectedStartDate || undefined,
                          });
                        }
                      }}
                      disabled={!selectedEmployeeId || !selectedStartDate || !onAssignEmployee}
                    >
                      <Plus className="h-4 w-4" />
                      Zuweisen
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {assignableStartDates.map((date) => (
                        <Button
                          key={date}
                          type="button"
                          size="sm"
                          variant={selectedAssignDays.includes(date) ? "default" : "outline"}
                          className="h-8 rounded-full px-3 text-[11px]"
                          onClick={() => setSelectedAssignDays((current) => toggleDate(current, date))}
                        >
                          {formatCompactDate(date)}
                        </Button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      className="gap-1.5"
                      onClick={() => {
                        if (selectedEmployeeId && selectedAssignDays.length > 0 && onAssignEmployee) {
                          onAssignEmployee(selectedEmployeeId, {
                            mode: "specific-days",
                            dates: selectedAssignDays,
                          });
                        }
                      }}
                      disabled={!selectedEmployeeId || selectedAssignDays.length === 0 || !onAssignEmployee}
                    >
                      <Plus className="h-4 w-4" />
                      Fuer ausgewaehlte Tage zuweisen
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-card p-3 text-sm text-muted-foreground">
                Alle aktiven Mitarbeitenden sind fuer diesen Auftrag bereits eingeteilt.
              </div>
            )}
          </div>
        )}

        {selectedBlock.canMove && onMoveBlock && availableStartDates.length > 0 && (
          <div className="space-y-2 rounded-2xl border bg-muted/60 p-3">
            <div>
              <p className="text-sm font-semibold">Auftrag direkt verschieben</p>
              <p className="text-xs text-muted-foreground">
                Fallback, falls Drag & Drop beim Verschieben hakt.
              </p>
            </div>

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <Select value={selectedMoveDate} onValueChange={setSelectedMoveDate}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Neues Startdatum waehlen" />
                </SelectTrigger>
                <SelectContent>
                  {availableStartDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {date === selectedBlock.startDate
                        ? `Aktuell: ${formatCompactDate(date)}`
                        : `Start ab ${formatCompactDate(date)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={!selectedMoveDate || selectedMoveDate === selectedBlock.startDate}
                onClick={() => {
                  if (selectedMoveDate && selectedMoveDate !== selectedBlock.startDate) {
                    onMoveBlock(selectedMoveDate);
                  }
                }}
              >
                Verschieben
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Eingeplantes Team</p>
            {selectedBlock.canAssignWorkers && (
              <Badge variant="outline" className="gap-1">
                <UserRoundPlus className="h-3 w-3" />
                Drag & Drop
              </Badge>
            )}
          </div>
          {selectedBlock.workers.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
              Noch kein Mitarbeiter zugeordnet.
            </div>
          )}
          <div className="space-y-2">
            {selectedBlock.workerCoverage.map((coverage) => (
              <div
                key={coverage.employee.id}
                className="flex items-center justify-between gap-3 rounded-2xl border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: coverage.employee.color ?? "#475569" }}
                  >
                    {getEmployeeShortLabel(coverage.employee)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{getEmployeeLabel(coverage.employee)}</p>
                    <p className="text-xs text-muted-foreground">
                      {coverage.label}
                      {coverage.employee.phone ? ` | ${coverage.employee.phone}` : ""}
                    </p>
                    {coverage.days.length > 1 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {coverage.days.map((day) => (
                          <Badge
                            key={`${coverage.employee.id}-${day}`}
                            variant="outline"
                            className="rounded-full px-1.5 py-0 text-[9px]"
                          >
                            {formatCompactDate(day)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {selectedBlock.canRemoveWorkers && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveEmployee(coverage.employee.id)}
                    title="Aus allen offenen Tagen entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {selectedBlock.canRemoveWorkers && removableCoverages.length > 0 && (
          <div className="space-y-2 rounded-2xl border bg-muted/60 p-3">
            <div>
              <p className="text-sm font-semibold">Teilweise aus Tagen entfernen</p>
              <p className="text-xs text-muted-foreground">
                Entfernt Mitarbeitende nur aus noch nicht gestarteten, ausgewaehlten Tagen.
              </p>
            </div>
            <Select value={selectedRemoveEmployeeId} onValueChange={setSelectedRemoveEmployeeId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Mitarbeiter waehlen" />
              </SelectTrigger>
              <SelectContent>
                {removableCoverages.map((coverage) => (
                  <SelectItem key={coverage.employee.id} value={coverage.employee.id}>
                    {getEmployeeLabel(coverage.employee)} | {coverage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1.5">
              {selectedRemovableDays.map((date) => (
                <Button
                  key={`remove-${date}`}
                  type="button"
                  size="sm"
                  variant={selectedRemoveDays.includes(date) ? "default" : "outline"}
                  className="h-8 rounded-full px-3 text-[11px]"
                  onClick={() => setSelectedRemoveDays((current) => toggleDate(current, date))}
                >
                  {formatCompactDate(date)}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={!selectedRemoveEmployeeId || selectedRemoveDays.length === 0}
              onClick={() =>
                onRemoveEmployee(selectedRemoveEmployeeId, {
                  mode: "specific-days",
                  dates: selectedRemoveDays,
                })
              }
            >
              <Trash2 className="h-4 w-4" />
              Aus ausgewaehlten Tagen entfernen
            </Button>
          </div>
        )}

        <div className="rounded-2xl border bg-muted p-3 text-xs text-muted-foreground">
          {selectedBlock.hasProtectedHistory
            ? "Laufender Auftrag: Vergangene oder bereits gestartete Tage bleiben fix. Neue Mitarbeitende koennen ab heute tagegenau dazukommen und nur aus offenen Tagen wieder entfernt werden."
            : "Mehrere Auftraege pro Tag sind moeglich. Fuer kurze Einsaetze Reihenfolge und Uhrzeiten im Blick behalten."}
        </div>

        {selectedBlock.canDelete && (
          <Button variant="destructive" className="w-full gap-2" onClick={onRemoveBlock}>
            <Trash2 className="h-4 w-4" />
            Auftrag aus Planung entfernen
          </Button>
        )}
      </div>
    </Card>
  );
}

export function CreatePlanningJobDialog({
  open,
  busyLabel,
  jobForm,
  onOpenChange,
  onJobFormChange,
  onSubmit,
}: {
  open: boolean;
  busyLabel: string | null;
  jobForm: JobForm;
  onOpenChange: (open: boolean) => void;
  onJobFormChange: (field: keyof JobForm, value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neuen Auftrag direkt im Backlog anlegen</DialogTitle>
          <DialogDescription>
            Erfasse den Auftrag komplett genug fuer die Disposition. Danach liegt er sofort links im Backlog.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="job-title">Auftragsname *</Label>
            <Input
              id="job-title"
              value={jobForm.title}
              onChange={(event) => onJobFormChange("title", event.target.value)}
              placeholder="z.B. Heizungswartung Musterschule"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-name">Kundenname *</Label>
            <Input
              id="customer-name"
              value={jobForm.customerName}
              onChange={(event) => onJobFormChange("customerName", event.target.value)}
              placeholder="z.B. Familie Meier"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Kategorie</Label>
            <Select value={jobForm.category} onValueChange={(value) => onJobFormChange("category", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie waehlen" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(JOB_CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="street">Strasse / Hausnummer</Label>
            <Input
              id="street"
              value={jobForm.addressStreet}
              onChange={(event) => onJobFormChange("addressStreet", event.target.value)}
              placeholder="Musterstrasse 12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zip">PLZ</Label>
            <Input
              id="zip"
              value={jobForm.addressZip}
              onChange={(event) => onJobFormChange("addressZip", event.target.value)}
              placeholder="12345"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Ort</Label>
            <Input
              id="city"
              value={jobForm.addressCity}
              onChange={(event) => onJobFormChange("addressCity", event.target.value)}
              placeholder="Musterstadt"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-name">Ansprechpartner</Label>
            <Input
              id="contact-name"
              value={jobForm.contactName}
              onChange={(event) => onJobFormChange("contactName", event.target.value)}
              placeholder="Vor- und Nachname"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-phone">Telefon</Label>
            <Input
              id="contact-phone"
              value={jobForm.contactPhone}
              onChange={(event) => onJobFormChange("contactPhone", event.target.value)}
              placeholder="+49..."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Kurzbeschreibung</Label>
            <Textarea
              id="description"
              value={jobForm.description}
              onChange={(event) => onJobFormChange("description", event.target.value)}
              placeholder="Kurz notieren, was vor Ort erledigt werden soll."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={onSubmit} disabled={!!busyLabel} className="gap-2">
            <Plus className="h-4 w-4" />
            {busyLabel ?? "Auftrag im Backlog anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
