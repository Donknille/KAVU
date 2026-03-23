import { memo, useEffect, useState } from "react";
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

// Deterministic color per job — same job = same color across all employees
const JOB_COLORS = [
  "#3b82f6", "#ef4444", "#eab308", "#22c55e", "#8b5cf6",
  "#f97316", "#06b6d4", "#ec4899", "#14b8a6", "#6366f1",
];
function getJobColor(jobId: string): string {
  let hash = 0;
  for (let i = 0; i < jobId.length; i++) hash = (hash * 31 + jobId.charCodeAt(i)) | 0;
  return JOB_COLORS[Math.abs(hash) % JOB_COLORS.length];
}
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

export const BacklogJobCard = memo(function BacklogJobCard({
  job,
  compact,
  onClickPlace,
}: {
  job: PlanJob;
  compact: boolean;
  onClickPlace?: (job: PlanJob) => void;
}) {
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
      onClick={onClickPlace ? () => onClickPlace(job) : undefined}
      className={cn(
        "brand-soft-card w-full rounded-xl text-left transition",
        compact ? "min-h-[5rem] p-2" : "min-h-[6.75rem] p-2.5",
        "hover:border-[color:var(--brand-highlight-border)] hover:shadow-[0_16px_30px_rgba(16,38,62,0.1)]",
        isDragging && "opacity-60",
        onClickPlace && "cursor-pointer",
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
              title={job.title}
              className={cn(
                "min-w-0 flex-1 font-semibold leading-tight brand-ink",
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
              "mt-0.5 line-clamp-2 brand-ink-soft",
              compact ? "text-[10px] leading-snug" : "text-xs"
            )}
          >
            {job.jobNumber} | {job.customerName}
          </p>
          <p
            title={formatAddress(job.addressStreet, job.addressZip, job.addressCity) || undefined}
            className={cn(
              "mt-1 brand-ink-soft",
              compact ? "line-clamp-2 text-[10px] leading-snug" : "line-clamp-2 text-[11px]"
            )}
          >
            {formatAddress(job.addressStreet, job.addressZip, job.addressCity) || "Keine Adresse"}
          </p>
        </div>
        <span
          ref={setActivatorNodeRef}
          title="Zum Kalender ziehen — oder klicken um zu platzieren"
          className={cn(
            "mt-0.5 shrink-0 rounded-md p-1 brand-ink-muted transition hover:bg-[var(--brand-highlight-bg)] touch-none",
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
});

export const TeamMemberCard = memo(function TeamMemberCard({
  employee,
  badgeLabel,
  badgeTone,
  detailLabel,
  compact,
}: {
  employee: PlanEmployee;
  badgeLabel: string;
  badgeTone: "neutral" | "free" | "scheduled";
  detailLabel: string;
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
    badgeTone === "free"
      ? "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
      : badgeTone === "scheduled"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        : "bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-200";

  const metaLine = [detailLabel, employee.phone].filter(Boolean).join(" | ");

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "brand-soft-card w-full rounded-xl text-left transition",
        compact ? "min-h-[4.5rem] p-2" : "min-h-[4.75rem] p-2.5",
        "hover:border-[color:var(--brand-highlight-border)] hover:shadow-[0_16px_30px_rgba(16,38,62,0.1)]",
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
          <p className={cn("truncate font-semibold leading-tight brand-ink", compact ? "text-xs" : "text-[13px]")}>
            {getEmployeeLabel(employee)}
          </p>
          <p className={cn("truncate brand-ink-soft", compact ? "text-[10px]" : "text-[11px]")}>
            {metaLine}
          </p>
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
            {badgeLabel}
          </Badge>
          <span
            ref={setActivatorNodeRef}
            className={cn(
              "rounded-md p-1 brand-ink-muted transition hover:bg-[var(--brand-highlight-bg)] touch-none",
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
});

export const DayColumnDropZone = memo(function DayColumnDropZone({
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
        isEnabled ? "border-[color:var(--brand-panel-border)]" : "border-transparent",
        isEnabled && isOver && "border-[#68d5c8] bg-[#68d5c8]/18"
      )}
      style={{
        gridColumn: column,
        gridRow: `1 / span ${laneCount}`,
      }}
    />
  );
});

export const PlanningBlockCard = memo(function PlanningBlockCard({
  block,
  compact,
  overview = false,
  readableCompact = false,
  employeeDropActive = false,
  selected,
  onSelectBlock,
}: {
  block: PlanningBlock;
  compact: boolean;
  overview?: boolean;
  readableCompact?: boolean;
  employeeDropActive?: boolean;
  selected: boolean;
  onSelectBlock: (blockId: string) => void;
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
        "group relative flex h-full min-w-0 overflow-hidden rounded-xl border shadow-[0_10px_24px_rgba(16,38,62,0.08)] transition animate-in fade-in-0 duration-200",
        block.canMove && "cursor-grab active:cursor-grabbing",
        selected && "ring-2 ring-[color:var(--brand-highlight-border)]",
        isOver && "ring-2 ring-[#68d5c8]",
        isDragging && "opacity-60"
      )}
      style={{
        gridColumn: `${block.startIndex + 1} / span ${block.span}`,
        gridRow: `${block.lane + 1}`,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : selected ? 20 : 10,
        backgroundColor: `${getJobColor(block.jobId)}12`,
        borderColor: `${getJobColor(block.jobId)}30`,
      }}
      onClick={() => onSelectBlock(block.id)}
    >
      {employeeDropActive && block.canAssignWorkers && (
        <div
          ref={setEmployeeDropNodeRef}
          className={cn(
            "pointer-events-none absolute inset-0 z-20 rounded-xl border-2 border-dashed transition",
            isEmployeeOver
              ? "border-[#68d5c8] bg-[#68d5c8]/26 shadow-[inset_0_0_0_1px_rgba(104,213,200,0.36)]"
              : "border-[#68d5c8]/70 bg-[#68d5c8]/12"
          )}
        >
          <div className="brand-outline-chip absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold shadow-sm">
            {isEmployeeOver ? "Hier zuweisen" : "Mitarbeiter hier ablegen"}
          </div>
        </div>
      )}

      <div
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ backgroundColor: getJobColor(block.jobId) }}
      />

      {block.canResizeStart && (
        <button
          ref={setStartNodeRef}
          type="button"
          className={cn(
            "absolute left-1 top-1 bottom-1 z-10 hidden rounded-full border border-transparent bg-[var(--brand-chip-bg)] brand-ink-muted transition hover:border-[color:var(--brand-highlight-border)] group-hover:block touch-none",
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
            "absolute right-1 top-1 bottom-1 z-10 flex items-center justify-center rounded-full border border-[#68d5c8]/70 bg-[var(--brand-chip-bg)] brand-ink shadow-sm transition hover:border-[#68d5c8] hover:bg-[var(--brand-highlight-bg)] touch-none",
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
            "mt-0.5 flex shrink-0 items-center justify-center rounded-lg border bg-[var(--brand-chip-bg)] brand-ink-muted touch-none",
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
                "font-semibold leading-tight brand-ink",
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
          {/* Worker avatars removed — employee rows make them redundant */}
        </div>
      </div>
    </div>
  );
});

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
          preview.valid ? "border-sky-400 planning-preview-valid" : "planning-preview-invalid planning-preview-invalid-border"
        )}
        style={{
          gridColumn: `${preview.startIndex + 1} / span ${preview.span}`,
          gridRow: `${preview.lane + 1}`,
          zIndex: 6,
        }}
      >
        <div className="flex h-full items-start justify-between gap-2 px-2 py-1">
          <div className="min-w-0">
            <p className={cn("truncate font-semibold brand-ink", compact ? "text-[10px]" : "text-xs")}>
              {preview.valid ? "Neuer Zeitraum" : "Nicht möglich"}
            </p>
            {!compact && <p className="truncate text-[10px] brand-ink-soft">{preview.label}</p>}
          </div>
        </div>
      </div>

      {preview.addedStartIndex !== null && preview.addedSpan > 0 && (
        <div
          className={cn(
            "pointer-events-none rounded-xl border border-dashed",
            preview.valid ? "border-sky-500/80 planning-preview-valid" : "planning-preview-invalid planning-preview-invalid-border"
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
    return <div />;
  }

  if (activeDrag.type === "job") {
    return (
      <Card className="brand-panel w-72 rounded-[24px] shadow-xl">
        <div className="flex items-start gap-3 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border">
            <CategoryIcon category={activeDrag.job.category ?? "other"} className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold brand-ink">{activeDrag.job.title}</p>
            <p className="truncate text-xs brand-ink-soft">
              {activeDrag.job.jobNumber} | {activeDrag.job.customerName}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (activeDrag.type === "employee") {
    return (
      <Card className="brand-panel w-64 rounded-[24px] shadow-xl">
        <div className="flex items-center gap-3 p-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: activeDrag.employee.color ?? "#475569" }}
          >
            {getEmployeeShortLabel(activeDrag.employee)}
          </div>
          <div>
            <p className="text-sm font-semibold brand-ink">{getEmployeeLabel(activeDrag.employee)}</p>
            <p className="text-xs brand-ink-soft">In Auftrag ziehen</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="brand-panel w-80 rounded-[24px] shadow-xl">
      <div className="p-3">
        <p className="truncate text-sm font-semibold brand-ink">
          {activeDrag.block.job.jobNumber} | {activeDrag.block.job.title}
        </p>
        <p className="text-xs brand-ink-soft">
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
      <Card className="brand-panel rounded-3xl p-5">
        Bitte wählen Sie einen Auftrag aus, um Details und Teamzuordnungen zu bearbeiten.
      </Card>
    );
  }

  return (
    <Card className="brand-panel rounded-3xl p-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold brand-ink">
              {selectedBlock.job.jobNumber} | {selectedBlock.job.title}
            </p>
            <p className="truncate text-sm brand-ink-soft">{selectedBlock.job.customerName}</p>
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
          <div className="flex items-start gap-2 text-sm brand-ink-soft">
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
          <div className="flex items-center gap-2 text-sm brand-ink-soft">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{selectedBlock.job.contactPhone}</span>
          </div>
        )}

        {selectedBlock.canAssignWorkers && (
          <div className="brand-soft-card space-y-2 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold brand-ink">Mitarbeitende zuordnen</p>
                <p className="text-xs brand-ink-soft">
                  Tagesgenaue Zuordnungen können hier gezielt vorgenommen werden.
                </p>
              </div>
              <Badge variant="outline" className="gap-1">
                <UserRoundPlus className="h-3 w-3" />
                Zuordnung
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
                    Ausgewählte Tage
                  </Button>
                </div>

                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Mitarbeiter wählen" />
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
                      Fuer ausgewählte Tage zuweisen
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="brand-outline-chip rounded-2xl border-dashed p-3 text-sm brand-ink-soft">
                Alle aktiven Mitarbeitenden sind für diesen Auftrag bereits eingeteilt.
              </div>
            )}
          </div>
        )}

        {selectedBlock.canMove && onMoveBlock && availableStartDates.length > 0 && (
          <div className="brand-soft-card space-y-2 rounded-2xl p-3">
            <div>
              <p className="text-sm font-semibold brand-ink">Auftrag verschieben</p>
              <p className="text-xs brand-ink-soft">
                Das Startdatum kann innerhalb des verfügbaren Zeitraums angepasst werden.
              </p>
            </div>

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <Select value={selectedMoveDate} onValueChange={setSelectedMoveDate}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Neues Startdatum wählen" />
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
            <p className="text-sm font-semibold brand-ink">Eingeplantes Team</p>
            {selectedBlock.canAssignWorkers && (
              <Badge variant="outline" className="gap-1">
                <UserRoundPlus className="h-3 w-3" />
                Zuweisung möglich
              </Badge>
            )}
          </div>
          {selectedBlock.workers.length === 0 && (
            <div className="brand-outline-chip rounded-2xl border-dashed p-4 text-sm brand-ink-soft">
              Diesem Auftrag sind noch keine Mitarbeitenden zugeordnet.
            </div>
          )}
          <div className="space-y-2">
            {selectedBlock.workerCoverage.map((coverage) => (
              <div
                key={coverage.employee.id}
                className="brand-soft-card flex items-center justify-between gap-3 rounded-2xl px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: coverage.employee.color ?? "#475569" }}
                  >
                    {getEmployeeShortLabel(coverage.employee)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold brand-ink">{getEmployeeLabel(coverage.employee)}</p>
                    <p className="text-xs brand-ink-soft">
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
          <div className="brand-soft-card space-y-2 rounded-2xl p-3">
            <div>
              <p className="text-sm font-semibold brand-ink">Teilweise aus Tagen entfernen</p>
              <p className="text-xs brand-ink-soft">
                Entfernt Mitarbeitende nur aus noch nicht gestarteten, ausgewählten Tagen.
              </p>
            </div>
            <Select value={selectedRemoveEmployeeId} onValueChange={setSelectedRemoveEmployeeId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Mitarbeiter wählen" />
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
              Aus ausgewählten Tagen entfernen
            </Button>
          </div>
        )}

        <div className="brand-soft-card rounded-2xl p-3 text-xs brand-ink-soft">
          {selectedBlock.hasProtectedHistory
            ? "Bei laufenden Aufträgen bleiben vergangene oder bereits begonnene Tage unverändert. Weitere Mitarbeitende können ab heute für offene Tage ergänzt oder entfernt werden."
            : "Mehrere Einsätze pro Tag sind möglich. Reihenfolge und Uhrzeiten sollten in der Disposition beachtet werden."}
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
      <DialogContent className="brand-panel max-w-2xl border-[color:var(--brand-panel-border)] bg-[var(--brand-panel-start)]">
        <DialogHeader>
          <DialogTitle className="brand-ink">Auftrag im Backlog anlegen</DialogTitle>
          <DialogDescription className="brand-ink-soft">
            Erfassen Sie die wesentlichen Auftragsdaten für die Disposition. Der Auftrag steht anschließend direkt im Backlog bereit.
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
                <SelectValue placeholder="Kategorie wählen" />
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
