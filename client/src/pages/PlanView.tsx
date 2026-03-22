import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ChevronsLeft,
  ChevronsRight,
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
import { EmployeeBoard } from "@/features/planning/EmployeeBoard";
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
  const [viewMode, setViewMode] = useState<"board" | "employee" | "overview">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "overview" : "employee",
  );
  const [overviewDay, setOverviewDay] = useState(() => toDateStr(new Date()));

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

        return {
          day: summary.day,
          isToday,
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
            <p className="brand-kicker">Kalender</p>
            <p className="mt-1 truncate text-sm font-semibold brand-ink">
              Einsatzplan im Zeitraum {rangeLabel}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="brand-outline-chip rounded-full px-2 py-0.5 text-[11px] font-medium"
            >
              {planning.blocks.length} geplant
            </Badge>
            <Badge
              variant="outline"
              className="brand-outline-chip rounded-full px-2 py-0.5 text-[11px] font-medium"
            >
              {planning.teamSummary.freeOnFocusDay} frei
            </Badge>
          </div>
        </div>
        {planning.placingJob && (
          <div className="flex items-center justify-between gap-2 border-b bg-[#68d5c8]/10 px-3 py-2">
            <p className="text-sm font-medium text-[#173d66]">
              Klicke auf einen Tag um <span className="font-bold">{planning.placingJob.title}</span> zu platzieren
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => planning.setPlacingJob(null)}
            >
              Abbrechen
            </Button>
          </div>
        )}
        <div className="min-h-0 overflow-auto flex-1">
          <div className="w-full">
            <div
              className="planning-divider grid gap-px border-b bg-[var(--brand-icon-shell-bg)] sticky top-0 z-10"
              style={{ gridTemplateColumns: planning.boardGridStyle.gridTemplateColumns }}
            >
              {dayHeaders.map((header) => (
                <div
                  key={header.day}
                  className={cn(
                    "planning-board-header min-w-0 px-1.5 py-1.5 brand-ink transition-colors",
                    header.isPreviewDay &&
                      (header.previewTone === "valid" ? "planning-preview-valid" : "planning-preview-invalid"),
                    header.isToday && "brand-highlight",
                    planning.dragOverDate === header.day && "bg-[#68d5c8]/20 ring-1 ring-inset ring-[#68d5c8]",
                    planning.placingJob && "cursor-pointer hover:bg-[#68d5c8]/15",
                  )}
                  onClick={planning.placingJob ? () => planning.placeJobOnDate(header.day) : undefined}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] brand-ink-muted">
                    {header.weekdayLabel}
                  </p>
                  <div className="mt-0.5 flex items-end justify-between gap-1">
                    <p
                      className={cn(
                        "font-semibold leading-none",
                        isOverviewMode ? "text-xs" : "text-sm",
                      )}
                    >
                      {header.dateLabel}
                    </p>
                    <div className="text-right text-[9px] brand-ink-muted">
                      <p title="Einsatztage">{`${header.assignmentCount} ET`}</p>
                      <p title="Mitarbeiter frei">{`${header.freeCount} frei`}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-1.5">
              <div
                className="planning-board-frame relative rounded-2xl border"
                style={planning.boardGridStyle}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={planning.boardBackgroundStyle}
                />

                <div className="relative grid h-full" style={planning.boardGridStyle}>
                  {planning.blocks.map((block) => (
                    <PlanningBlockCard
                      key={block.id}
                      block={block}
                      compact
                      overview={isOverviewMode}
                      readableCompact={readableCompactBlocks}
                      employeeDropActive={planning.activeDrag?.type === "employee"}
                      selected={planning.selectedBlock?.id === block.id}
                      onSelectBlock={handleSelectBlock}
                    />
                  ))}
                  <ResizePreviewGhost preview={planning.resizePreview} compact />
                </div>

                <div
                  className={cn(
                    "absolute inset-0 grid",
                    planning.activeDrag ? "pointer-events-auto z-20" : "pointer-events-none",
                  )}
                  style={planning.boardGridStyle}
                >
                  {planning.visibleDays
                    .map((day, index) => ({ day, column: index + 1 }))
                    .filter(({ day }) => planning.resizePreview?.addedDays.includes(day))
                    .map(({ day, column }) => (
                      <div
                        key={`preview-${day}`}
                        className={cn(
                          "rounded-none pointer-events-none",
                          planning.resizePreview!.valid ? "planning-preview-valid" : "planning-preview-invalid",
                        )}
                        style={{
                          gridColumn: `${column}`,
                          gridRow: `1 / span ${planning.laneCount}`,
                        }}
                      />
                    ))}
                  {planning.visibleDays.map((day, index) => (
                    <DayColumnDropZone
                      key={day}
                      date={day}
                      column={index + 1}
                      laneCount={planning.laneCount}
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
        </div>
      </Card>
    ),
    [
      dayHeaders,
      handleSelectBlock,
      isOverviewMode,
      planning.activeDrag,
      planning.blocks,
      planning.boardBackgroundStyle,
      planning.boardGridStyle,
      planning.isLoadingBoard,
      planning.laneCount,
      planning.resizePreview,
      planning.selectedBlock,
      planning.teamSummary.freeOnFocusDay,
      planning.visibleDays,
      rangeLabel,
      readableCompactBlocks,
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

  const selectedBlockPanel = useMemo(
    () => (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <Card className="brand-panel flex flex-col overflow-hidden rounded-3xl">
          <div className="planning-divider flex items-center justify-between gap-2 border-b p-3">
            <div>
              <p className="brand-kicker">Auftrag</p>
              <p className="mt-1 text-sm font-semibold brand-ink">Details und Teamzuordnung</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="brand-outline-control h-7 gap-1 rounded-full px-2 text-[11px]"
              onClick={() => planning.setSelectedBlockId(null)}
            >
              <X className="h-3 w-3" />
              Schliessen
            </Button>
          </div>
          <ScrollArea className="min-h-0 max-h-[45vh]">
            <div className="p-3">
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
        {teamContextPanel}
      </div>
    ),
    [
      planning.activeEmployees,
      planning.assignEmployeeToSelected,
      planning.getEmployeeAvailability,
      planning.moveSelectedBlock,
      planning.removeEmployeeFromSelected,
      planning.removeSelectedBlock,
      planning.selectedBlock,
      planning.setSelectedBlockId,
      selectedBlockMoveDates,
      teamContextPanel,
    ],
  );

  const contextPanel = planning.selectedBlock ? selectedBlockPanel : teamContextPanel;
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

          <div className="brand-outline-chip flex items-center gap-0.5 rounded-full border p-0.5">
            {([
              { id: "board" as const, icon: CalendarDays, label: "Aufträge" },
              { id: "employee" as const, icon: Users, label: "Team" },
              { id: "overview" as const, icon: LayoutList, label: "Liste" },
            ]).map((mode) => (
              <Button
                key={mode.id}
                variant={viewMode === mode.id ? "default" : "ghost"}
                size="sm"
                className="h-7 gap-1 rounded-full px-2 text-[11px]"
                onClick={() => setViewMode(mode.id)}
              >
                <mode.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{mode.label}</span>
              </Button>
            ))}
          </div>
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
        {viewMode === "employee" && (
          <div className="flex min-h-0 flex-1 gap-2">
            {backlogCollapsed ? backlogCollapsedRail : backlogExpandedPanel}
            <div className="min-h-0 flex-1">
              <Card className="brand-panel flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
                <div className="planning-divider flex items-center justify-between gap-3 border-b px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="brand-kicker">Team-Ansicht</p>
                    <p className="mt-1 truncate text-sm font-semibold brand-ink">
                      Mitarbeiter-Einsatzplan {rangeLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="brand-outline-chip rounded-full px-2 py-0.5 text-[11px] font-medium">
                      {planning.activeEmployees.length} Mitarbeiter
                    </Badge>
                    <Badge variant="outline" className="brand-outline-chip rounded-full px-2 py-0.5 text-[11px] font-medium">
                      {planning.blocks.length} Aufträge
                    </Badge>
                  </div>
                </div>
                <EmployeeBoard
                  employeeRows={planning.employeeRows}
                  visibleDays={planning.visibleDays}
                  dayHeaders={dayHeaders}
                  isDragActive={!!planning.activeDrag}
                  onCellClick={(employeeId, day) => {
                    planning.setSelectedBlockId(null);
                  }}
                  onJobClick={(blockId) => {
                    planning.setSelectedBlockId(blockId);
                  }}
                />
              </Card>
            </div>
            {planning.selectedBlock && (
              <div className="hidden w-[22rem] shrink-0 xl:block">
                {selectedBlockPanel}
              </div>
            )}
          </div>
        )}
        <div className={cn("flex min-h-0 flex-1 flex-col gap-2", viewMode !== "board" && "hidden")}>
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
                defaultSize={56}
                minSize={44}
                className="min-h-0"
              >
                {calendarBoard}
              </ResizablePanel>
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
            </ResizablePanelGroup>
          ) : (
            <>
              <div className={cn("flex-none", backlogCollapsed && "hidden")}>{backlogExpandedPanel}</div>
              <div className="min-h-0 flex-1">{calendarBoard}</div>
              <div className="flex-none max-h-[20rem]">{contextPanel}</div>
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
