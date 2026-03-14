import { useEffect, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarRange,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Users,
  X,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export default function PlanView() {
  const planning = usePlanningBoard();
  const isOverviewMode = planning.viewSpan === 4;
  const readableCompactBlocks = planning.isMobile && planning.viewSpan === 2;
  const compactBoard = isOverviewMode;
  const backlogPanelRef = useRef<ImperativePanelHandle | null>(null);
  const [backlogCollapsed, setBacklogCollapsed] = useState(false);
  const [isWideDesktop, setIsWideDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const updateMatch = () => {
      setIsWideDesktop(mediaQuery.matches);
    };

    updateMatch();
    mediaQuery.addEventListener("change", updateMatch);

    return () => {
      mediaQuery.removeEventListener("change", updateMatch);
    };
  }, []);

  function toggleBacklogPanel() {
    const panel = backlogPanelRef.current;
    if (!panel) {
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

  const backlogCollapsedRail = (
    <Card className="brand-panel flex h-full min-h-0 flex-col items-center justify-between rounded-3xl px-2 py-3">
      <div className="flex flex-col items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 rounded-full border-[#173d66]/12 bg-white/85 text-[#173d66]"
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
        className="h-8 w-8 rounded-full text-[#173d66]"
        onClick={() => planning.setShowCreateJobDialog(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </Card>
  );

  const backlogExpandedPanel = (
    <Card className="brand-panel flex min-h-0 flex-col overflow-hidden rounded-3xl">
      <div className="border-b border-[#173d66]/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="brand-kicker">Backlog</p>
            <p className="mt-1 text-sm font-semibold text-[#173d66]">Ungeplante Auftraege</p>
            <p className="text-xs text-[#173d66]/64">
              {planning.backlogList.length} ungeplante Auftraege
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full border-[#173d66]/12 bg-white/85 text-[#173d66]"
              onClick={toggleBacklogPanel}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="h-8 gap-2 bg-[#173d66] px-2.5 text-white hover:bg-[#123251]"
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
          className="mt-3 h-8 border-[#173d66]/10 bg-white/80"
        />
      </div>
      <div className="min-h-0 flex-1 p-2.5">
        <div className="flex h-full min-h-0 flex-col gap-2">
          <button
            type="button"
            className="brand-soft-card flex w-full items-center justify-between rounded-xl border-dashed px-2.5 py-2 text-left transition hover:border-[#173d66]/18"
            onClick={() => planning.setShowCreateJobDialog(true)}
          >
            <div>
              <p className="text-xs font-semibold text-[#173d66]">Neuen Auftrag anlegen</p>
              <p className="text-[10px] text-[#173d66]/64">
                Im Backlog erfassen und anschliessend disponieren
              </p>
            </div>
            <Plus className="h-4 w-4 text-[#173d66]/56" />
          </button>

          {planning.backlogList.length === 0 && (
            <div className="brand-soft-card rounded-2xl border-dashed p-6 text-center text-sm text-[#173d66]/64">
              <p>Keine offenen Auftraege im Backlog.</p>
              <Button
                variant="outline"
                className="mt-4 gap-2 border-[#173d66]/12 bg-white/80 text-[#173d66]"
                onClick={() => planning.setShowCreateJobDialog(true)}
              >
                <Plus className="h-4 w-4" />
                Auftrag anlegen
              </Button>
            </div>
          )}
          {planning.backlogList.length > 0 && (
            <VirtualStack
              items={planning.backlogList}
              itemHeight={108}
              className="min-h-0 flex-1 overflow-y-auto pr-1"
              renderItem={(job) => <BacklogJobCard key={job.id} job={job} compact={false} />}
            />
          )}
        </div>
      </div>
    </Card>
  );

  const calendarBoard = (
    <Card className="brand-panel flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <div className="overflow-x-auto">
        <div className="w-full">
          <div
            className="grid gap-px border-b border-[#173d66]/10 bg-[#173d66]/10"
            style={{ gridTemplateColumns: planning.boardGridStyle.gridTemplateColumns }}
          >
            {planning.daySummaries.map((summary) => {
              const isToday = summary.day === toDateStr(new Date());
              return (
                <div
                  key={summary.day}
                  className={cn(
                    "min-w-0 bg-background px-1.5 py-1.5 text-[#173d66]",
                    planning.resizePreview?.addedDays.includes(summary.day) &&
                      (planning.resizePreview.valid ? "bg-sky-50" : "bg-rose-50"),
                    isToday && "bg-[#68d5c8]/24"
                  )}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#173d66]/58">
                    {parseDateString(summary.day).toLocaleDateString("de-DE", {
                      weekday: isOverviewMode && !planning.isMobile ? "narrow" : "short",
                    })}
                  </p>
                  <div className="mt-0.5 flex items-end justify-between gap-1">
                    <p className={cn("font-semibold leading-none", isOverviewMode ? "text-xs" : "text-sm")}>
                      {parseDateString(summary.day).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </p>
                    <div className="text-right text-[9px] text-[#173d66]/58">
                      <p>{`${summary.assignments} ET`}</p>
                      <p>{`${Math.max(0, planning.activeEmployees.length - summary.workers)} frei`}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-1.5">
            <div
              className="relative overflow-hidden rounded-2xl border border-[#173d66]/12"
              style={planning.boardGridStyle}
            >
              <div className="pointer-events-none absolute inset-0" style={planning.boardBackgroundStyle} />

              <div
                className="pointer-events-none absolute inset-0 grid"
                style={planning.boardGridStyle}
              >
                {planning.visibleDays.map((day, index) =>
                  planning.resizePreview?.addedDays.includes(day) ? (
                    <div
                      key={`preview-${day}`}
                      className={cn(
                        "rounded-none",
                        planning.resizePreview.valid ? "bg-sky-50/70" : "bg-rose-50/70"
                      )}
                      style={{
                        gridColumn: `${index + 1}`,
                        gridRow: `1 / span ${planning.laneCount}`,
                      }}
                    />
                  ) : null
                )}
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

              <div
                className="relative grid h-full"
                style={planning.boardGridStyle}
              >
                {planning.blocks.map((block) => (
                  <PlanningBlockCard
                    key={block.id}
                    block={block}
                    compact
                    overview={isOverviewMode}
                    readableCompact={readableCompactBlocks}
                    employeeDropActive={planning.activeDrag?.type === "employee"}
                    selected={planning.selectedBlock?.id === block.id}
                    onSelect={() => planning.setSelectedBlockId(block.id)}
                  />
                ))}
                <ResizePreviewGhost preview={planning.resizePreview} compact />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  const teamCard = (
    <Card className="brand-panel overflow-hidden rounded-3xl">
      <div className="border-b border-[#173d66]/10 p-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="brand-kicker">Team</p>
            <p className="mt-1 text-sm font-semibold text-[#173d66]">Verfuegbare Mitarbeitende</p>
            <p className="text-xs text-[#173d66]/64">
              Sortiert nach Verfuegbarkeit fuer {planning.teamFocusLabel.toLowerCase()}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {planning.selectedBlock && (
              <Badge variant="outline" className="rounded-full border-[#173d66]/10 bg-white/70 px-2 py-0.5 text-[10px] text-[#173d66]">
                Detailansicht aktiv
              </Badge>
            )}
            <Badge variant="secondary" className="bg-[#173d66]/8 text-[#173d66]">
              {planning.activeEmployees.length}
            </Badge>
          </div>
        </div>
        <Input
          value={planning.teamSearch}
          onChange={(event) => planning.setTeamSearch(event.target.value)}
          placeholder="Mitarbeiter suchen..."
          className="mt-2 h-8 border-[#173d66]/10 bg-white/80"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { id: "all", label: "Alle" },
            { id: "free-focus", label: `${planning.teamFocusLabel} frei` },
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
      <ScrollArea className="h-[min(30vh,18rem)]">
        <div className="space-y-3 p-2">
          {planning.teamSections.length === 0 && (
            <div className="brand-soft-card rounded-2xl border-dashed p-5 text-center text-sm text-[#173d66]/64">
              Fuer den aktuellen Filter wurden keine Mitarbeitenden gefunden.
            </div>
          )}
          {planning.teamSections.map((section) => (
            <div key={section.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#173d66]/58">
                    {section.title}
                  </p>
                  <p className="text-[11px] text-[#173d66]/64">{section.description}</p>
                </div>
                <Badge variant="outline" className="rounded-full border-[#173d66]/10 bg-white/70 px-2 py-0.5 text-[10px] text-[#173d66]">
                  {section.items.length}
                </Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {section.items.map((entry) => (
                  <TeamMemberCard
                    key={entry.employee.id}
                    employee={entry.employee}
                    badgeLabel={entry.badgeLabel}
                    badgeTone={entry.badgeTone}
                    detailLabel={entry.detailLabel}
                    compact={compactBoard}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );

  const showMobileDetailsFocus = !!planning.selectedBlock && !isWideDesktop;
  const selectedBlockMoveDates = planning.selectedBlock
    ? planning.visibleDays.filter(
        (_day, index) => index + planning.selectedBlock!.span <= planning.visibleDays.length
      )
    : [];

  const mobileDetailsFocusCard = planning.selectedBlock ? (
    <Card className="brand-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl xl:hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#173d66]/10 px-3 py-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-[#173d66]">Auftragsdetails</p>
          <p className="text-xs text-[#173d66]/64">
            Fokusansicht fuer kleine Breiten.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-full border-[#173d66]/12 bg-white/85 px-2.5 text-[#173d66]"
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
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:p-4">
      <div className="brand-panel flex flex-col gap-4 rounded-[34px] p-4 md:p-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <BrandMark showWordmark subtitle="Disposition" size={44} labelClassName="text-[1.7rem]" />
          <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#173d66]/58">
            <CalendarRange className="h-3.5 w-3.5" />
            Einsatzplanung
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#173d66]">Wochenplanung nach Auftrag</h1>
          <p className="mt-0.5 text-sm text-[#173d66]/68">
            Backlog, Wochenplanung und Teamuebersicht in einer zentralen Arbeitsflaeche.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1.5 rounded-full border-[#173d66]/10 bg-white/72 px-2 py-0.5 text-[11px] font-medium text-[#173d66]">
              <BriefcaseBusiness className="h-3 w-3" />
              {planning.blocks.length} geplant
            </Badge>
            <Badge variant="outline" className="gap-1.5 rounded-full border-[#173d66]/10 bg-white/72 px-2 py-0.5 text-[11px] font-medium text-[#173d66]">
              <CalendarRange className="h-3 w-3" />
              {planning.backlogJobs.length} im Backlog
            </Badge>
            <Badge variant="outline" className="gap-1.5 rounded-full border-[#173d66]/10 bg-white/72 px-2 py-0.5 text-[11px] font-medium text-[#173d66]">
              <Users className="h-3 w-3" />
              {planning.activeEmployees.length} aktiv
            </Badge>
            <Badge variant="outline" className="rounded-full border-[#173d66]/10 bg-white/72 px-2 py-0.5 text-[11px] font-medium text-[#173d66]">
              {planning.teamSummary.unassignedInWindow} ohne Einsatz
            </Badge>
            <Badge variant="outline" className="rounded-full border-[#173d66]/10 bg-white/72 px-2 py-0.5 text-[11px] font-medium text-[#173d66]">
              {planning.teamSummary.freeOnFocusDay} {planning.teamFocusLabel.toLowerCase()} frei
            </Badge>
            <Badge variant="outline" className="rounded-full border-[#173d66]/10 bg-white/72 px-2 py-0.5 text-[11px] font-medium text-[#173d66]">
              {planning.teamSummary.fullyBookedInWindow} durchgehend eingeplant
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-[#173d66]/12 bg-white/80 px-2.5 text-[#173d66]"
            onClick={toggleBacklogPanel}
          >
            {backlogCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            Backlog
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 border-[#173d66]/12 bg-white/80 text-[#173d66]" onClick={() => planning.changeWindow(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="h-8 bg-[#173d66]/8 px-3 text-xs font-medium text-[#173d66]">
            {formatRange(
              planning.visibleDays[0],
              planning.visibleDays[planning.visibleDays.length - 1]
            )}
          </Badge>
          <Button variant="outline" size="icon" className="h-8 w-8 border-[#173d66]/12 bg-white/80 text-[#173d66]" onClick={() => planning.changeWindow(1)}>
            <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="ml-1 flex items-center gap-1 rounded-full border border-[#173d66]/10 bg-white/78 p-0.5">
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
        </div>
      </div>

      <DndContext
        sensors={planning.sensors}
        collisionDetection={planning.collisionDetection}
        onDragCancel={planning.handleDragCancel}
        onDragOver={planning.handleDragOver}
        onDragStart={planning.handleDragStart}
        onDragEnd={planning.handleDragEnd}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {showMobileDetailsFocus ? (
            mobileDetailsFocusCard
          ) : (
            <>
              {isWideDesktop ? (
                <div className="min-h-0 flex-1">
                  <ResizablePanelGroup
                    direction="horizontal"
                    autoSaveId={`planning-top-layout-${planning.viewSpan}w`}
                    className="min-h-0 flex-1 items-stretch gap-2"
                  >
                    <ResizablePanel
                      ref={backlogPanelRef}
                      id="planning-backlog"
                      order={1}
                      collapsible
                      collapsedSize={5}
                      minSize={14}
                      maxSize={32}
                      defaultSize={planning.viewSpan === 2 ? 24 : 18}
                      onCollapse={() => setBacklogCollapsed(true)}
                      onExpand={() => setBacklogCollapsed(false)}
                      className="min-h-0"
                    >
                      {backlogCollapsed ? backlogCollapsedRail : backlogExpandedPanel}
                    </ResizablePanel>
                    <ResizableHandle withHandle className="mx-0.5 bg-transparent after:w-2" />
                    <ResizablePanel id="planning-board" order={2} defaultSize={76} minSize={68} className="min-h-0">
                      {calendarBoard}
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>
              ) : (
                <>
                  {!backlogCollapsed && <div>{backlogExpandedPanel}</div>}
                  <div className="min-h-0">{calendarBoard}</div>
                </>
              )}

              <div className="flex-none">{teamCard}</div>
            </>
          )}
        </div>

        <DragOverlay>
          <DragOverlayCard activeDrag={planning.activeDrag} />
        </DragOverlay>
      </DndContext>

      {isWideDesktop && (
        <Sheet
          modal={false}
          open={!!planning.selectedBlock}
          onOpenChange={(open) => {
            if (!open) {
              planning.setSelectedBlockId(null);
            }
          }}
        >
          <SheetContent
            side="right"
            showOverlay={false}
            className="w-[28rem] border-l border-[#173d66]/10 bg-[#f7f6f2] sm:max-w-[28rem]"
          >
            <SheetHeader className="pr-8">
              <SheetTitle className="text-[#173d66]">Auftragsdetails</SheetTitle>
              <SheetDescription className="text-[#173d66]/64">
                Details bleiben aus dem Board raus, damit die Wochenplanung kompakt bleibt.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="mt-6 h-[calc(100vh-8rem)] pr-4">
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
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}

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
    </div>
  );
}
