import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  LayoutList,
  Plus,
  Users,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BacklogJobCard,
  CreatePlanningJobDialog,
  DayColumnDropZone,
  DragOverlayCard,
  PlanningBlockCard,
  ResizePreviewGhost,
  SelectedBlockPanel,
  TeamMemberCard,
} from "@/features/planning/components";
import { type ViewSpan } from "@/features/planning/types";
import { usePlanningBoard } from "@/features/planning/usePlanningBoard";
import { VirtualStack } from "@/features/planning/virtual";
import { PlanOverviewList } from "@/features/planning/PlanOverviewList";
import { formatRange, parseDateString, toDateStr } from "@/features/planning/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function PlanView() {
  const planning = usePlanningBoard();
  const isOverviewMode = planning.viewSpan === 4;
  const readableCompactBlocks = planning.isMobile && planning.viewSpan === 2;
  const backlogPanelRef = useRef<ImperativePanelHandle | null>(null);
  const [backlogCollapsed, setBacklogCollapsed] = useState(false);
  const [isWideDesktop, setIsWideDesktop] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "overview">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "overview" : "board",
  );
  const [overviewDay, setOverviewDay] = useState(() => toDateStr(new Date()));
  const [employeeFilter, setEmployeeFilter] = useState<Set<string>>(new Set()); // empty = show all
  const [showOnlyFree, setShowOnlyFree] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  function shiftOverviewDay(delta: number) {
    setOverviewDay((current) => {
      const d = new Date(current);
      d.setDate(d.getDate() + delta);
      return toDateStr(d);
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const updateMatch = () => {
      const nextWideDesktop = mediaQuery.matches;
      setIsWideDesktop(nextWideDesktop);
      if (!nextWideDesktop) {
        setBacklogCollapsed(true);
      }
    };

    updateMatch();
    mediaQuery.addEventListener("change", updateMatch);

    return () => {
      mediaQuery.removeEventListener("change", updateMatch);
    };
  }, []);

  const handleSelectBlock = useCallback(
    (blockId: string) => {
      planning.setSelectedBlockId(blockId);
    },
    [planning.setSelectedBlockId],
  );

  const rangeLabel = useMemo(
    () =>
      formatRange(
        planning.visibleDays[0],
        planning.visibleDays[planning.visibleDays.length - 1],
      ),
    [planning.visibleDays],
  );

  const selectedBlockMoveDates = useMemo(
    () =>
      planning.selectedBlock
        ? planning.visibleDays.filter(
            (_day, index) => index + planning.selectedBlock!.span <= planning.visibleDays.length,
          )
        : [],
    [planning.selectedBlock, planning.visibleDays],
  );

  const dayHeaders = useMemo(
    () =>
      planning.daySummaries.map((summary) => {
        const date = parseDateString(summary.day);
        const isToday = summary.day === toDateStr(new Date());
        const isPreviewDay = planning.resizePreview?.addedDays.includes(summary.day) ?? false;

        const isSaturday = date.getDay() === 6;
        const isMonday = date.getDay() === 1;
        return {
          day: summary.day,
          isToday,
          isSaturday,
          isMonday,
          isPreviewDay,
          previewTone: planning.resizePreview?.valid ? "valid" : "invalid",
          weekdayLabel: date.toLocaleDateString("de-DE", {
            weekday: isOverviewMode && !planning.isMobile ? "narrow" : "short",
          }),
          dateLabel: date.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
          }),
          assignmentCount: summary.assignments,
          freeCount: Math.max(0, planning.activeEmployees.length - summary.workers),
        };
      }),
    [
      isOverviewMode,
      planning.activeEmployees.length,
      planning.daySummaries,
      planning.isMobile,
      planning.resizePreview,
    ],
  );

  function toggleBacklogPanel() {
    const panel = backlogPanelRef.current;
    if (!panel || !isWideDesktop) {
      setBacklogCollapsed((current) => !current);
      return;
    }

    if (panel.isCollapsed()) {
      panel.expand();
      setBacklogCollapsed(false);
      return;
    }

    panel.collapse();
    setBacklogCollapsed(true);
  }

  const backlogCollapsedRail = useMemo(
    () => (
      <Card className="brand-panel flex h-full min-h-0 flex-col items-center justify-between rounded-3xl px-2 py-3">
        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="brand-outline-control h-8 w-8 rounded-full"
            onClick={toggleBacklogPanel}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
          <div className="brand-outline-chip rounded-full px-2 py-1 text-[10px] font-semibold">
            {planning.backlogList.length}
          </div>
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full brand-ink"
          onClick={() => planning.setShowCreateJobDialog(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </Card>
    ),
    [planning.backlogList.length, planning.setShowCreateJobDialog],
  );

  const backlogExpandedPanel = useMemo(
    () => (
      <Card className="brand-panel flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
        <div className="planning-divider border-b p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="brand-kicker">Backlog</p>
              <p className="mt-1 text-sm font-semibold brand-ink">Ungeplante Aufträge</p>
              <p className="text-xs brand-ink-soft">
                {planning.backlogList.length} ungeplante Aufträge
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="brand-outline-control h-8 w-8 rounded-full"
                onClick={toggleBacklogPanel}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                className="h-8 gap-2 px-2.5"
                onClick={() => planning.setShowCreateJobDialog(true)}
              >
                <Plus className="h-4 w-4" />
                Auftrag
              </Button>
            </div>
          </div>
          <Input
            value={planning.backlogSearch}
            onChange={(event) => planning.setBacklogSearch(event.target.value)}
            placeholder="Auftrag suchen..."
            className="brand-input mt-3 h-8"
          />
        </div>
        <div className="min-h-0 flex-1 p-2.5">
          <div className="flex h-full min-h-0 flex-col gap-2">
            <button
              type="button"
              className="brand-soft-card flex w-full items-center justify-between rounded-xl border-dashed px-2.5 py-2 text-left transition hover:border-[color:var(--brand-highlight-border)]"
              onClick={() => planning.setShowCreateJobDialog(true)}
            >
              <div>
                <p className="text-xs font-semibold brand-ink">Neuen Auftrag anlegen</p>
                <p className="text-[10px] brand-ink-soft">
                  Im Backlog erfassen und anschließend disponieren
                </p>
              </div>
              <Plus className="h-4 w-4 brand-ink-muted" />
            </button>

            {planning.backlogList.length === 0 ? (
              <div className="brand-soft-card rounded-2xl border-dashed p-6 text-center text-sm brand-ink-soft">
                <p>Keine offenen Aufträge im Backlog.</p>
                <Button
                  variant="outline"
                  className="brand-outline-control mt-4 gap-2"
                  onClick={() => planning.setShowCreateJobDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  Auftrag anlegen
                </Button>
              </div>
            ) : (
              <VirtualStack
                items={planning.backlogList}
                itemHeight={108}
                className="min-h-0 flex-1 overflow-y-auto pr-1"
                renderItem={(job) => <BacklogJobCard key={job.id} job={job} compact={false} onClickPlace={planning.setPlacingJob} />}
              />
            )}
          </div>
        </div>
      </Card>
    ),
    [
      planning.backlogList,
      planning.backlogSearch,
      planning.setBacklogSearch,
      planning.setShowCreateJobDialog,
    ],
  );

  // Per-employee grid dimensions
  const nameColWidth = "9rem";
  const empHeaderGridCols = `${nameColWidth} ${planning.boardGridStyle.gridTemplateColumns ?? ""}`;
  const dayGridCols = planning.boardGridStyle.gridTemplateColumns ?? "";
  const laneHeight = planning.isMobile ? (planning.viewSpan === 2 ? 88 : 64) : planning.viewSpan === 2 ? 56 : 40;

  // Filter employee rows
  const filteredEmployeeRows = useMemo(() => {
    let rows = planning.employeePlanRows;
    if (employeeFilter.size > 0) {
      rows = rows.filter((r) => employeeFilter.has(r.employee.id));
    }
    if (showOnlyFree) {
      rows = rows.filter((r) => r.blocks.length === 0 || r.laneCount <= 1);
    }
    return rows;
  }, [planning.employeePlanRows, employeeFilter, showOnlyFree]);

  const calendarBoard = useMemo(
    () => (
      <Card className="brand-panel relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
        {planning.isLoadingBoard && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <div className="animate-pulse space-y-3 w-full max-w-md p-8">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
            </div>
          </div>
        )}
        <div className="planning-divider flex items-center justify-between gap-3 border-b px-3 py-2.5">
          <div className="min-w-0">
            <p className="brand-kicker">Team-Ansicht</p>
            <p className="mt-1 truncate text-sm font-semibold brand-ink">
              Mitarbeiter-Einsatzplan {rangeLabel}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="brand-outline-chip rounded-full px-2 py-0.5 text-[11px] font-medium">
              {filteredEmployeeRows.length}/{planning.activeEmployees.length} Mitarbeiter
            </Badge>
            <Badge variant="outline" className="brand-outline-chip rounded-full px-2 py-0.5 text-[11px] font-medium">
              {planning.blocks.length} Aufträge
            </Badge>
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={employeeFilter.size > 0 || showOnlyFree ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2 text-[11px]"
                >
                  <Filter className="h-3 w-3" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnlyFree}
                      onChange={(e) => setShowOnlyFree(e.target.checked)}
                      className="rounded"
                    />
                    Nur freie Mitarbeiter
                  </label>
                  <div className="border-t my-1" />
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-xs font-semibold brand-ink-muted">Mitarbeiter</span>
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:underline"
                      onClick={() => setEmployeeFilter(new Set())}
                    >
                      Alle anzeigen
                    </button>
                  </div>
                  {planning.activeEmployees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={employeeFilter.size === 0 || employeeFilter.has(emp.id)}
                        onChange={(e) => {
                          setEmployeeFilter((prev) => {
                            const next = new Set(prev.size === 0 ? planning.activeEmployees.map((x) => x.id) : prev);
                            if (e.target.checked) {
                              next.add(emp.id);
                            } else {
                              next.delete(emp.id);
                            }
                            // If all selected, reset to empty (= show all)
                            if (next.size === planning.activeEmployees.length) return new Set();
                            return next;
                          });
                        }}
                        className="rounded"
                      />
                      <div
                        className="h-4 w-4 rounded-full text-[7px] font-bold text-white flex items-center justify-center shrink-0"
                        style={{ backgroundColor: emp.color || "#173d66" }}
                      >
                        {emp.firstName?.[0]}{emp.lastName?.[0]}
                      </div>
                      <span className="truncate">{emp.firstName} {emp.lastName?.charAt(0)}.</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="min-h-0 overflow-auto flex-1">
          <div className="w-full">
            {/* Day header row — sticky top */}
            <div
              className="planning-divider grid gap-px border-b bg-[var(--brand-icon-shell-bg)] sticky top-0 z-[15]"
              style={{ gridTemplateColumns: empHeaderGridCols }}
            >
              <div className="sticky left-0 z-[16] bg-[var(--brand-icon-shell-bg)] border-r p-2 text-[10px] font-semibold uppercase tracking-wider brand-ink-muted">
                Mitarbeiter
              </div>
              {dayHeaders.map((header) => (
                <div
                  key={header.day}
                  className={cn(
                    "planning-board-header min-w-0 px-1 py-1.5 brand-ink transition-colors text-center",
                    header.isPreviewDay &&
                      (header.previewTone === "valid" ? "planning-preview-valid" : "planning-preview-invalid"),
                    header.isToday && "bg-[#173d66]/10 font-bold",
                    header.isSaturday && "bg-muted/30",
                    header.isMonday && "border-l-2 border-l-[#173d66]/20",
                    planning.dragOverDate === header.day && "bg-[#68d5c8]/20 ring-1 ring-inset ring-[#68d5c8]",
                  )}
                >
                  <p className="text-[8px] font-semibold uppercase tracking-[0.1em] brand-ink-muted">
                    {header.weekdayLabel}
                  </p>
                  <p className={cn("font-semibold leading-none mt-0.5", isOverviewMode ? "text-[10px]" : "text-xs")}>
                    {header.dateLabel}
                  </p>
                  {!isOverviewMode && (
                    <p className="text-[8px] brand-ink-muted mt-0.5">
                      {header.assignmentCount}E {header.freeCount}f
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Employee rows + global DnD overlay */}
            <div className="p-1.5 relative">
              {/* Per-employee rows — blocks stay within their row */}
              {filteredEmployeeRows.map((row, empIndex) => {
                const rowGridRows = `repeat(${row.laneCount}, ${laneHeight}px)`;
                return (
                  <div
                    key={row.employee.id}
                    className={cn(
                      "planning-board-frame relative border-x border-b",
                      empIndex === 0 && "border-t rounded-t-2xl",
                      empIndex === planning.employeePlanRows.length - 1 && "rounded-b-2xl",
                      empIndex % 2 === 1 && "bg-muted/10",
                    )}
                    style={{
                      display: "grid",
                      gridTemplateColumns: empHeaderGridCols,
                      gridTemplateRows: rowGridRows,
                    }}
                  >
                    {/* Employee name — sticky left, spans all lanes */}
                    <div
                      className="sticky left-0 z-[5] flex items-center gap-2 border-r bg-background px-2 py-1"
                      style={{ gridColumn: "1", gridRow: `1 / span ${row.laneCount}` }}
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: row.employee.color || "#173d66" }}
                      >
                        {(row.employee.firstName?.[0] ?? "")}{(row.employee.lastName?.[0] ?? "")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium brand-ink">
                          {row.employee.firstName} {row.employee.lastName?.charAt(0)}.
                        </p>
                      </div>
                    </div>

                    {/* Block cards layer — own grid starting after name column */}
                    <div
                      className="absolute grid h-full"
                      style={{
                        gridTemplateColumns: dayGridCols,
                        gridTemplateRows: rowGridRows,
                        left: nameColWidth,
                        right: 0,
                        top: 0,
                        bottom: 0,
                      }}
                    >
                      {row.blocks.map((block) => (
                        <PlanningBlockCard
                          key={`${row.employee.id}-${block.id}`}
                          block={{
                            ...block,
                            lane: block.localLane,
                          }}
                          compact
                          overview={isOverviewMode}
                          readableCompact={readableCompactBlocks}
                          employeeDropActive={planning.activeDrag?.type === "employee"}
                          selected={planning.selectedBlock?.id === block.id}
                          onSelectBlock={handleSelectBlock}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Global DnD drop zone overlay — ONE set of day zones spanning ALL employee rows */}
              <div
                className={cn(
                  "absolute grid",
                  planning.activeDrag ? "pointer-events-auto z-20" : "pointer-events-none",
                )}
                style={{
                  gridTemplateColumns: dayGridCols,
                  gridTemplateRows: "1fr",
                  left: nameColWidth,
                  right: 0,
                  top: 0,
                  bottom: 0,
                }}
              >
                {planning.visibleDays.map((day, index) => (
                  <DayColumnDropZone
                    key={day}
                    date={day}
                    column={index + 1}
                    laneCount={1}
                    isEnabled={
                      !!planning.activeDrag &&
                      (planning.activeDrag.type === "job" ||
                        planning.activeDrag.type === "block-move" ||
                        planning.activeDrag.type === "block-resize-start" ||
                        planning.activeDrag.type === "block-resize-end")
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>
    ),
    [
      dayGridCols,
      dayHeaders,
      empHeaderGridCols,
      employeeFilter,
      filterOpen,
      filteredEmployeeRows,
      handleSelectBlock,
      isOverviewMode,
      laneHeight,
      planning.activeDrag,
      planning.activeEmployees,
      planning.blocks.length,
      planning.dragOverDate,
      planning.isLoadingBoard,
      planning.selectedBlock,
      planning.visibleDays,
      rangeLabel,
      readableCompactBlocks,
      showOnlyFree,
    ],
  );

  const teamContextPanel = useMemo(() => {
    const focusSectionLabel = `${planning.teamFocusLabel} frei`;

    return (
      <Card className="brand-panel flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
        <div className="planning-divider border-b p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="brand-kicker">Team</p>
              <p className="mt-1 text-sm font-semibold brand-ink">Verfügbare Mitarbeitende</p>
              <p className="text-xs brand-ink-soft">
                Direkt neben dem Kalender für schnelle Zuweisungen.
              </p>
            </div>
            <Badge variant="secondary" className="brand-highlight">
              {planning.activeEmployees.length}
            </Badge>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="brand-soft-card rounded-2xl px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] brand-ink-muted">Offen</p>
              <p className="mt-1 text-lg font-semibold brand-ink">
                {planning.teamSummary.unassignedInWindow}
              </p>
            </div>
            <div className="brand-soft-card rounded-2xl px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] brand-ink-muted">Frei</p>
              <p className="mt-1 text-lg font-semibold brand-ink">
                {planning.teamSummary.freeOnFocusDay}
              </p>
            </div>
            <div className="brand-soft-card rounded-2xl px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] brand-ink-muted">Voll</p>
              <p className="mt-1 text-lg font-semibold brand-ink">
                {planning.teamSummary.fullyBookedInWindow}
              </p>
            </div>
          </div>

          <Input
            value={planning.teamSearch}
            onChange={(event) => planning.setTeamSearch(event.target.value)}
            placeholder="Mitarbeiter suchen..."
            className="brand-input mt-3 h-8"
          />

          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "Alle" },
              { id: "free-focus", label: focusSectionLabel },
              { id: "unassigned", label: "Nicht eingeteilt" },
            ].map((filter) => (
              <Button
                key={filter.id}
                type="button"
                size="sm"
                variant={planning.teamFilter === filter.id ? "default" : "outline"}
                className="h-7 rounded-full px-2.5 text-[11px]"
                onClick={() => planning.setTeamFilter(filter.id as typeof planning.teamFilter)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 p-2.5">
          {planning.teamEntries.length === 0 ? (
            <div className="brand-soft-card rounded-2xl border-dashed p-5 text-center text-sm brand-ink-soft">
              Fuer den aktuellen Filter wurden keine Mitarbeitenden gefunden.
            </div>
          ) : (
            <VirtualStack
              items={planning.teamEntries}
              itemHeight={88}
              className="min-h-0 h-full overflow-y-auto pr-1"
              renderItem={(entry) => {
                const sectionLabel =
                  entry.section === "unassigned"
                    ? "Nicht eingeteilt"
                    : entry.section === "free-focus"
                      ? focusSectionLabel
                      : `${planning.teamFocusLabel} eingeplant`;

                return (
                  <TeamMemberCard
                    key={entry.employee.id}
                    employee={entry.employee}
                    badgeLabel={entry.badgeLabel}
                    badgeTone={entry.badgeTone}
                    detailLabel={`${sectionLabel} | ${entry.detailLabel}`}
                  />
                );
              }}
            />
          )}
        </div>
      </Card>
    );
  }, [
    planning.activeEmployees.length,
    planning.teamEntries,
    planning.teamFilter,
    planning.teamFocusLabel,
    planning.teamSearch,
    planning.teamSummary,
    planning.setTeamFilter,
    planning.setTeamSearch,
  ]);

  const selectedBlockPanel = useMemo(() => {
    const block = planning.selectedBlock;
    if (!block) return null;
    const address = [block.job.addressStreet, block.job.addressZip, block.job.addressCity].filter(Boolean).join(", ");
    return (
      <Card className="brand-panel flex flex-col overflow-hidden rounded-3xl">
        <div className="planning-divider flex items-center justify-between gap-2 border-b p-3">
          <p className="text-sm font-semibold brand-ink">{block.job.jobNumber} | {block.job.title}</p>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={() => planning.setSelectedBlockId(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="p-3 space-y-3 text-sm">
          <p className="brand-ink-soft">{block.job.customerName}</p>
          {address && (
            <div className="flex items-start gap-1.5 brand-ink-soft">
              <span className="text-[10px] mt-0.5">📍</span>
              <span>{address}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {formatRange(block.startDate, block.endDate)}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {block.workers.length} Mitarbeitende
            </Badge>
          </div>
          {block.workers.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider brand-ink-muted">Team</p>
              <div className="flex flex-wrap gap-1.5">
                {block.workers.map((w) => (
                  <div key={w.id} className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5">
                    <div
                      className="h-4 w-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
                      style={{ backgroundColor: w.color || "#475569" }}
                    >
                      {w.firstName?.[0]}{w.lastName?.[0]}
                    </div>
                    <span className="text-[11px]">{w.firstName} {w.lastName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => void planning.removeSelectedBlock()}
          >
            Auftrag aus Planung entfernen
          </Button>
        </div>
      </Card>
    );
  }, [planning.selectedBlock, planning.setSelectedBlockId, planning.removeSelectedBlock]);

  // Team panel removed — employee rows in the board serve as the team overview
  const contextPanel = planning.selectedBlock ? selectedBlockPanel : null;
  const showMobileDetailsFocus = !!planning.selectedBlock && !isWideDesktop;

  const mobileDetailsFocusCard = (
    <Card className={cn("brand-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl xl:hidden", !planning.selectedBlock && "hidden")}>
      <div className="planning-divider flex items-center justify-between gap-3 border-b px-3 py-3">
        <div className="min-w-0">
          <p className="text-base font-semibold brand-ink">Auftragsdetails</p>
          <p className="text-xs brand-ink-soft">Fokusansicht für kleine Breiten.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="brand-outline-control h-8 gap-1.5 rounded-full px-2.5"
          onClick={() => planning.setSelectedBlockId(null)}
        >
          <X className="h-4 w-4" />
          Schliessen
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <SelectedBlockPanel
            selectedBlock={planning.selectedBlock}
            availableEmployees={planning.activeEmployees}
            availableStartDates={selectedBlockMoveDates}
            getEmployeeAvailability={planning.getEmployeeAvailability}
            onAssignEmployee={(employeeId, selection) => {
              void planning.assignEmployeeToSelected(employeeId, selection);
            }}
            onMoveBlock={(targetDate) => {
              void planning.moveSelectedBlock(targetDate);
            }}
            onRemoveEmployee={(employeeId, selection) => {
              void planning.removeEmployeeFromSelected(employeeId, selection);
            }}
            onRemoveBlock={() => {
              void planning.removeSelectedBlock();
            }}
          />
        </div>
      </ScrollArea>
    </Card>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:p-4">
      <div className="brand-panel flex flex-col gap-3 rounded-3xl px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <BrandMark showWordmark subtitle="Disposition" size={40} labelClassName="text-[1.55rem]" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className="brand-outline-chip gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
            >
              <BriefcaseBusiness className="h-3 w-3" />
              {planning.blocks.length} geplant
            </Badge>
            <Badge
              variant="outline"
              className="brand-outline-chip gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
            >
              <CalendarRange className="h-3 w-3" />
              {planning.backlogJobs.length} im Backlog
            </Badge>
            <Badge
              variant="outline"
              className="brand-outline-chip gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
            >
              <Users className="h-3 w-3" />
              {planning.activeEmployees.length} aktiv
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="brand-outline-control h-8 gap-1.5 px-2.5"
            onClick={toggleBacklogPanel}
          >
            {backlogCollapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
            Backlog
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="brand-outline-control h-8 w-8"
            onClick={() => planning.changeWindow(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Badge
            variant="secondary"
            className="brand-highlight h-8 px-3 text-xs font-medium"
          >
            {rangeLabel}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            className="brand-outline-control h-8 w-8"
            onClick={() => planning.changeWindow(1)}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="brand-outline-chip ml-1 flex items-center gap-1 rounded-full p-0.5">
            {[2, 4].map((span) => (
              <Button
                key={span}
                type="button"
                size="sm"
                variant={planning.viewSpan === span ? "default" : "ghost"}
                className="h-7 rounded-full px-2.5 text-[11px]"
                onClick={() => planning.setViewSpan(span as ViewSpan)}
              >
                {span}W
              </Button>
            ))}
          </div>

          <Button
            variant={viewMode === "overview" ? "default" : "outline"}
            size="sm"
            className="brand-outline-control h-8 gap-1.5 px-2.5"
            onClick={() => setViewMode((m) => (m === "board" ? "overview" : "board"))}
            title={viewMode === "board" ? "Tagesübersicht" : "Planungsboard"}
          >
            {viewMode === "board" ? (
              <LayoutList className="h-4 w-4" />
            ) : (
              <CalendarDays className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {viewMode === "board" ? "Übersicht" : "Board"}
            </span>
          </Button>
        </div>
      </div>

      {viewMode === "overview" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PlanOverviewList
            blocks={planning.blocks}
            day={overviewDay}
            onPrevDay={() => shiftOverviewDay(-1)}
            onNextDay={() => shiftOverviewDay(1)}
          />
        </div>
      ) : null}

      <DndContext
        sensors={planning.sensors}
        collisionDetection={planning.collisionDetection}
        onDragCancel={planning.handleDragCancel}
        onDragOver={planning.handleDragOver}
        onDragStart={planning.handleDragStart}
        onDragEnd={planning.handleDragEnd}
      >
        <div className={cn("flex min-h-0 flex-1 flex-col gap-2", viewMode === "overview" && "hidden")}>
          {showMobileDetailsFocus ? (
            mobileDetailsFocusCard
          ) : isWideDesktop ? (
            <ResizablePanelGroup
              direction="horizontal"
              autoSaveId={`planning-main-layout-${planning.viewSpan}w`}
              className="min-h-0 flex-1 items-stretch gap-2"
            >
              <ResizablePanel
                ref={backlogPanelRef}
                id="planning-backlog"
                order={1}
                collapsible
                collapsedSize={5}
                minSize={14}
                maxSize={26}
                defaultSize={18}
                onCollapse={() => setBacklogCollapsed(true)}
                onExpand={() => setBacklogCollapsed(false)}
                className="min-h-0"
              >
                {backlogCollapsed ? backlogCollapsedRail : backlogExpandedPanel}
              </ResizablePanel>
              <ResizableHandle withHandle className="mx-0.5 bg-transparent after:w-2" />
              <ResizablePanel
                id="planning-board"
                order={2}
                defaultSize={contextPanel ? 56 : 82}
                minSize={44}
                className="min-h-0"
              >
                {calendarBoard}
              </ResizablePanel>
              {contextPanel && (
                <>
                  <ResizableHandle withHandle className="mx-0.5 bg-transparent after:w-2" />
                  <ResizablePanel
                    id="planning-context"
                    order={3}
                    defaultSize={26}
                    minSize={20}
                    maxSize={34}
                    className="min-h-0"
                  >
                    {contextPanel}
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          ) : (
            <>
              <div className={cn("flex-none", backlogCollapsed && "hidden")}>{backlogExpandedPanel}</div>
              <div className="min-h-0 flex-1">{calendarBoard}</div>
              {contextPanel && <div className="flex-none max-h-[20rem]">{contextPanel}</div>}
            </>
          )}
        </div>

        <DragOverlay>
          <DragOverlayCard activeDrag={planning.activeDrag} />
        </DragOverlay>
      </DndContext>

      <CreatePlanningJobDialog
        open={planning.showCreateJobDialog}
        busyLabel={planning.busyLabel}
        jobForm={planning.jobForm}
        onOpenChange={planning.setShowCreateJobDialog}
        onJobFormChange={planning.updateJobForm}
        onSubmit={() => {
          void planning.submitCreateJob();
        }}
      />

      <AlertDialog
        open={planning.pendingRemoveBlock !== null}
        onOpenChange={(open) => { if (!open) planning.cancelRemoveBlock(); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftrag aus Planung entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Soll <strong>{planning.pendingRemoveBlock?.job.jobNumber}</strong> komplett aus der Planung entfernt werden? Der Auftrag wird zurück ins Backlog verschoben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { void planning.confirmRemoveBlock(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
