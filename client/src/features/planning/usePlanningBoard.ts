import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import { createPlanningBoardReadModel } from "../../../../shared/planningBoard.ts";
import {
  preferCollisionHits,
  resolveDropDateForTarget,
} from "@/features/planning/dnd";
import {
  buildEmployeePlanRows,
  buildTeamOverview,
  buildTeamSections,
  EMPTY_PLANNING_BOARD,
  filterJobs,
  filterTeamOverview,
  getPlanningBoardLayout,
  JOBS_QUERY_KEY,
  type TeamFilterMode,
} from "@/features/planning/derived";
import {
  EMPTY_JOB_FORM,
  type ActiveDrag,
  type JobForm,
  type PlanAssignment,
  type PlanEmployee,
  type PlanningBoardResponse,
  type PlanJob,
  type PlanningDragData,
  type PlanningDropData,
  type PlanningBlock,
  type PlanningDaySummary,
  type ResizePreview,
  type ViewSpan,
  type WorkerDaySelection,
} from "@/features/planning/types";
import {
  addCalendarDays,
  formatCompactDate,
  formatRange,
  getAssignmentsForWorkerAdd,
  getAssignmentsForWorkerRemove,
  getEmployeeLabel,
  getVisibleDays,
  isSaturday,
  toDateStr,
  toStartOfWeek,
  uniqueSortedDates,
} from "@/features/planning/utils";

export function usePlanningBoard() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const today = toDateStr(new Date());
  const [viewSpan, setViewSpan] = useState<ViewSpan>(2);
  const [weekStart, setWeekStart] = useState(toDateStr(toStartOfWeek(new Date())));
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false);
  const [jobForm, setJobForm] = useState<JobForm>(EMPTY_JOB_FORM);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [placingJob, setPlacingJob] = useState<PlanJob | null>(null);
  const [backlogSearch, setBacklogSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<TeamFilterMode>("all");
  const deferredBacklogSearch = useDeferredValue(backlogSearch);
  const deferredTeamSearch = useDeferredValue(teamSearch);

  const visibleDays = useMemo(() => getVisibleDays(weekStart, viewSpan), [weekStart, viewSpan]);
  const planningBoardUrl = useMemo(
    () =>
      `/api/planning/board?startDate=${visibleDays[0]}&endDate=${
        visibleDays[visibleDays.length - 1]
      }`,
    [visibleDays],
  );

  const { data: planningBoard = EMPTY_PLANNING_BOARD, isPending: isLoadingBoard } = useQuery<PlanningBoardResponse>({
    queryKey: [planningBoardUrl],
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const { assignments, activeEmployees, backlogJobs, blocks, daySummaries } = planningBoard;
  const blocksById = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks]);
  const jobsById = useMemo(() => {
    const next = new Map<string, PlanJob>();
    for (const job of backlogJobs) {
      next.set(job.id, job);
    }
    for (const assignment of assignments) {
      if (assignment.job) {
        next.set(assignment.job.id, assignment.job);
      }
    }
    return next;
  }, [assignments, backlogJobs]);
  const employeesById = useMemo(
    () => new Map(activeEmployees.map((employee) => [employee.id, employee])),
    [activeEmployees],
  );
  const dayIndexByDate = useMemo(
    () => new Map(visibleDays.map((date, index) => [date, index])),
    [visibleDays],
  );
  const selectedBlock = useMemo(
    () => (selectedBlockId ? blocksById.get(selectedBlockId) ?? null : null),
    [blocksById, selectedBlockId],
  );
  const plannedJobIds = useMemo(
    () => new Set(assignments.map((a) => a.jobId)),
    [assignments],
  );
  const backlogList = useMemo(
    () => filterJobs(backlogJobs, deferredBacklogSearch),
    [backlogJobs, deferredBacklogSearch],
  );
  const teamFocusDate = useMemo(
    () =>
      selectedBlock && visibleDays.includes(selectedBlock.startDate)
        ? selectedBlock.startDate
        : visibleDays.includes(today)
          ? today
          : visibleDays[0],
    [selectedBlock, today, visibleDays],
  );
  const teamFocusLabel = useMemo(
    () => (teamFocusDate === today ? "Heute" : formatCompactDate(teamFocusDate)),
    [teamFocusDate, today],
  );
  const teamOverview = useMemo(
    () => buildTeamOverview(activeEmployees, assignments, visibleDays, teamFocusDate),
    [activeEmployees, assignments, teamFocusDate, visibleDays],
  );
  const filteredTeamOverview = useMemo(
    () => filterTeamOverview(teamOverview, deferredTeamSearch, teamFilter),
    [deferredTeamSearch, teamFilter, teamOverview],
  );
  const teamSections = useMemo(
    () => buildTeamSections(filteredTeamOverview, teamFocusLabel),
    [filteredTeamOverview, teamFocusLabel],
  );
  const teamSummary = useMemo(
    () => ({
      freeOnFocusDay: teamOverview.filter((entry) => !entry.focusAssigned).length,
      unassignedInWindow: teamOverview.filter((entry) => entry.unassignedInWindow).length,
      fullyBookedInWindow: teamOverview.filter((entry) => entry.fullyBookedInWindow).length,
    }),
    [teamOverview],
  );

  useEffect(() => {
    if (selectedBlockId && !blocksById.has(selectedBlockId)) {
      setSelectedBlockId(null);
    }
  }, [blocksById, selectedBlockId]);

  useEffect(() => {
    if (isMobile && viewSpan === 4) {
      setViewSpan(2);
    }
  }, [isMobile, viewSpan]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 140,
        tolerance: 8,
      },
    })
  );

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const hits = pointerWithin(args);
    const activeId = String(args.active.id);
    const preferred = preferCollisionHits(activeId, hits);

    if (preferred.length > 0) {
      return preferred;
    }
    if (hits.length > 0) {
      return hits;
    }

    const fallbackHits = rectIntersection(args);
    const preferredFallback = preferCollisionHits(activeId, fallbackHits);
    if (preferredFallback.length > 0) {
      return preferredFallback;
    }

    return fallbackHits;
  }, []);

  const updateJobForm = useCallback((field: keyof JobForm, value: string) => {
    setJobForm((current) => ({ ...current, [field]: value }));
  }, []);

  const setCreateJobDialogOpen = useCallback((open: boolean) => {
    setShowCreateJobDialog(open);
    if (!open) {
      setJobForm(EMPTY_JOB_FORM);
    }
  }, []);

  const composePlanningBoard = useCallback((
    data: Pick<PlanningBoardResponse, "employees" | "backlogJobs" | "assignments">
  ): PlanningBoardResponse => {
    return createPlanningBoardReadModel(data, visibleDays, today) as PlanningBoardResponse;
  }, [today, visibleDays]);

  const updateAssignmentsCache = useCallback((
    updater: (current: PlanAssignment[]) => PlanAssignment[]
  ) => {
    queryClient.setQueryData<PlanningBoardResponse>([planningBoardUrl], (current) => ({
      ...composePlanningBoard({
        employees: current?.employees ?? [],
        backlogJobs: current?.backlogJobs ?? [],
        assignments: updater(current?.assignments ?? []),
      }),
    }));
  }, [composePlanningBoard, planningBoardUrl]);

  const updateBacklogCache = useCallback((updater: (current: PlanJob[]) => PlanJob[]) => {
    queryClient.setQueryData<PlanningBoardResponse>([planningBoardUrl], (current) => ({
      ...composePlanningBoard({
        employees: current?.employees ?? [],
        backlogJobs: updater(current?.backlogJobs ?? []),
        assignments: current?.assignments ?? [],
      }),
    }));
  }, [composePlanningBoard, planningBoardUrl]);

  const updateJobsCache = useCallback((updater: (current: PlanJob[]) => PlanJob[]) => {
    queryClient.setQueryData<PlanJob[]>([JOBS_QUERY_KEY], (current = []) => updater(current));
  }, []);

  const refreshPlanningBoard = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [planningBoardUrl],
      exact: true,
    });
  }, [planningBoardUrl]);

  const BUSY_TIMEOUT_MS = 30_000;

  async function runBusyAction(label: string, action: () => Promise<void>) {
    if (busyLabel) return;
    setBusyLabel(label);
    const timer = setTimeout(() => {
      setBusyLabel(null);
      toast({
        title: "Zeitüberschreitung",
        description: "Die Aktion hat zu lange gedauert. Bitte erneut versuchen.",
        variant: "destructive",
      });
      void refreshPlanningBoard();
    }, BUSY_TIMEOUT_MS);
    try {
      await action();
    } finally {
      clearTimeout(timer);
      setBusyLabel(null);
    }
  }

  function ensureActionAllowed(allowed: boolean, description: string) {
    if (allowed) {
      return true;
    }

    toast({
      title: "Auftrag gesperrt",
      description,
      variant: "destructive",
    });
    return false;
  }

  const getEmployeeScheduledDates = useCallback((
    employeeId: string,
    targetDays: string[],
    ignoredAssignmentIds: string[] = []
  ) => {
    const ignored = new Set(ignoredAssignmentIds);

    return uniqueSortedDates(
      assignments
        .filter((assignment) => {
          return (
            !ignored.has(assignment.id) &&
            targetDays.includes(assignment.assignmentDate) &&
            (assignment.workers ?? []).some((worker) => worker.id === employeeId)
          );
        })
        .map((assignment) => assignment.assignmentDate)
    );
  }, [assignments]);

  const getJobConflictDates = useCallback((
    jobId: string,
    targetDays: string[],
    ignoredAssignmentIds: string[] = [],
  ) => {
    const ignored = new Set(ignoredAssignmentIds);

    return uniqueSortedDates(
      assignments
        .filter((assignment) => {
          return (
            assignment.jobId === jobId &&
            !ignored.has(assignment.id) &&
            targetDays.includes(assignment.assignmentDate)
          );
        })
        .map((assignment) => assignment.assignmentDate)
    );
  }, [assignments]);

  const getEmployeeAvailability = useCallback((employeeId: string) => {
    if (!selectedBlock) {
      return "free" as const;
    }
    if (selectedBlock.workerIds.includes(employeeId)) {
      return "assigned" as const;
    }

    return getEmployeeScheduledDates(employeeId, selectedBlock.days, selectedBlock.assignmentIds).length > 0
      ? ("scheduled" as const)
      : ("free" as const);
  }, [getEmployeeScheduledDates, selectedBlock]);

  async function createBacklogJob() {
    if (!jobForm.title || !jobForm.customerName) {
      toast({
        title: "Fehlende Angaben",
        description: "Auftragsname und Kundenname sind Pflichtfelder.",
        variant: "destructive",
      });
      return;
    }

    await runBusyAction("Auftrag wird angelegt...", async () => {
      const createdJob = await apiRequestJson<PlanJob>("POST", "/api/jobs", {
        title: jobForm.title,
        customerName: jobForm.customerName,
        addressStreet: jobForm.addressStreet || undefined,
        addressZip: jobForm.addressZip || undefined,
        addressCity: jobForm.addressCity || undefined,
        contactName: jobForm.contactName || undefined,
        contactPhone: jobForm.contactPhone || undefined,
        category: jobForm.category || undefined,
        description: jobForm.description || undefined,
      });

      updateJobsCache((current) => [createdJob, ...current.filter((job) => job.id !== createdJob.id)]);
      updateBacklogCache((current) => [
        createdJob,
        ...current.filter((job) => job.id !== createdJob.id),
      ]);
      setShowCreateJobDialog(false);
      setJobForm(EMPTY_JOB_FORM);
      toast({
        title: "Auftrag erstellt",
        description: "Der Auftrag liegt jetzt direkt im Backlog.",
      });
    });
  }

  async function createBlockWithEmployee(job: PlanJob, targetDate: string, employeeId: string) {
    if (getJobConflictDates(job.id, [targetDate]).length > 0) {
      toast({
        title: "Auftrag bereits eingeplant",
        description: "Für diesen Tag existiert bereits ein Eintrag.",
        variant: "destructive",
      });
      return;
    }

    await runBusyAction("Auftrag wird eingeplant...", async () => {
      const createdAssignment = await apiRequestJson<PlanAssignment>("POST", "/api/assignments", {
        jobId: job.id,
        assignmentDate: targetDate,
        workerIds: [employeeId],
      });

      await refreshPlanningBoard();
      const emp = activeEmployees.find((e) => e.id === employeeId);
      toast({
        title: "Auftrag eingeplant",
        description: `${job.jobNumber} am ${formatCompactDate(targetDate)} für ${emp?.firstName ?? "Mitarbeiter"} eingeplant.`,
      });
    });
  }

  async function createBlockFromBacklog(job: PlanJob, targetDate: string) {
    if (getJobConflictDates(job.id, [targetDate]).length > 0) {
      toast({
        title: "Auftrag bereits eingeplant",
        description: "Für diesen Tag existiert bereits ein Eintrag.",
        variant: "destructive",
      });
      return;
    }

    await runBusyAction("Auftrag wird eingeplant...", async () => {
      const createdAssignment = await apiRequestJson<PlanAssignment>("POST", "/api/assignments", {
        jobId: job.id,
        assignmentDate: targetDate,
      });

      // Refresh from server to get correct block/employee data
      await refreshPlanningBoard();
      toast({
        title: "Auftrag eingeplant",
        description: `${job.jobNumber} liegt am ${formatCompactDate(targetDate)}. Ziehe einen Mitarbeiter auf den Block um ihn zuzuweisen.`,
      });
    });
  }

  async function assignEmployeeToBlock(
    block: PlanningBlock,
    employee: PlanEmployee,
    selection?: WorkerDaySelection
  ) {
    if (
      !ensureActionAllowed(
        block.canAssignWorkers,
        "Bei laufenden Aufträgen können Mitarbeitende nur ab heute und nur auf offene Tage ergänzt werden."
      )
    ) {
      return;
    }
    const targetAssignments = getAssignmentsForWorkerAdd(block.assignments, today, selection);
    if (targetAssignments.length === 0) {
      toast({
        title: "Keine offenen Tage mehr",
        description: "Für die gewählten Tage gibt es keine offenen oder laufenden Einsatzdaten mehr.",
        variant: "destructive",
      });
      return;
    }

    const pendingAssignments = targetAssignments.filter(
      (assignment) => !(assignment.workers ?? []).some((worker) => worker.id === employee.id)
    );

    if (pendingAssignments.length === 0) {
      toast({
        title: "Bereits eingeteilt",
        description: `${getEmployeeLabel(employee)} ist für die gewählten Tage bereits auf ${block.job.jobNumber} eingeplant.`,
        variant: "destructive",
      });
      return;
    }

    await runBusyAction("Mitarbeiter wird zugewiesen...", async () => {
      await apiRequest("POST", "/api/planning/assign-workers", {
        assignmentIds: pendingAssignments.map((assignment) => assignment.id),
        employeeId: employee.id,
        mode: "add",
      });
      updateAssignmentsCache((current) =>
        current.map((assignment) => {
          if (!pendingAssignments.some((entry) => entry.id === assignment.id)) {
            return assignment;
          }

          const workers = assignment.workers ?? [];
          if (workers.some((worker) => worker.id === employee.id)) {
            return assignment;
          }

          return {
            ...assignment,
            workers: [...workers, employee].sort((left, right) =>
              getEmployeeLabel(left).localeCompare(getEmployeeLabel(right))
            ),
          };
        })
      );
      setSelectedBlockId(block.id);
      await refreshPlanningBoard();
      const firstAssignedDay = pendingAssignments[0]?.assignmentDate;
      const lastAssignedDay = pendingAssignments[pendingAssignments.length - 1]?.assignmentDate;
      toast({
        title: "Mitarbeiter zugewiesen",
        description:
          firstAssignedDay && lastAssignedDay
            ? `${getEmployeeLabel(employee)} arbeitet jetzt auf ${block.job.jobNumber} für ${formatRange(
                firstAssignedDay,
                lastAssignedDay
              )} mit.`
            : `${getEmployeeLabel(employee)} wurde zugewiesen.`,
      });
    });
  }

  async function removeEmployeeFromBlock(
    block: PlanningBlock,
    employeeId: string,
    selection?: WorkerDaySelection
  ) {
    if (
      !ensureActionAllowed(
        block.canRemoveWorkers,
        "Mitarbeitende können nur aus noch nicht gestarteten Tagen entfernt werden."
      )
    ) {
      return;
    }

    const targetAssignments = getAssignmentsForWorkerRemove(
      block.assignments,
      today,
      employeeId,
      selection
    );
    if (targetAssignments.length === 0) {
      toast({
        title: "Keine offenen Tage mehr",
        description: "Für die gewählten Tage gibt es keine noch nicht gestarteten Einsatzdaten mehr, aus denen Mitarbeitende entfernt werden können.",
        variant: "destructive",
      });
      return;
    }

    await runBusyAction("Mitarbeiter wird entfernt...", async () => {
      await apiRequest("POST", "/api/planning/assign-workers", {
        assignmentIds: targetAssignments.map((assignment) => assignment.id),
        employeeId,
        mode: "remove",
      });
      await refreshPlanningBoard();
      toast({
        title: "Mitarbeiter entfernt",
        description:
          targetAssignments.length > 0
            ? `Die Zuweisung wurde für ${formatRange(
                targetAssignments[0].assignmentDate,
                targetAssignments[targetAssignments.length - 1].assignmentDate
              )} entfernt.`
            : "Die Zuweisung wurde entfernt.",
      });
    });
  }

  async function moveBlock(block: PlanningBlock, targetDate: string) {
    if (
      !ensureActionAllowed(
        block.canMove,
        "Laufende oder abgeschlossene Tage bleiben an ihrer Position. Verschieben geht nur, solange der Auftrag komplett geplant ist."
      )
    ) {
      return;
    }

    const targetIndex = dayIndexByDate.get(targetDate);
    if (targetIndex === undefined) {
      return;
    }
    // Collect enough workdays (skip Saturdays) to match block.span
    const workdayCount = block.days.filter((d) => !isSaturday(d)).length || block.span;
    const nextDays: string[] = [];
    for (let i = targetIndex; i < visibleDays.length && nextDays.length < workdayCount; i++) {
      if (!isSaturday(visibleDays[i])) {
        nextDays.push(visibleDays[i]);
      }
    }
    if (nextDays.length < workdayCount) {
      toast({
        title: "Zeitraum außerhalb der Ansicht",
        description: "Der Auftrag passt in dieser Wochenansicht nicht mehr vollständig hinein.",
        variant: "destructive",
      });
      return;
    }
    if (nextDays.join("|") === block.days.join("|")) {
      return;
    }

    if (getJobConflictDates(block.jobId, nextDays, block.assignmentIds).length > 0) {
      toast({
        title: "Auftrag kollidiert",
        description: "Für den Auftrag liegen im Zielzeitraum bereits andere Tages-Einsätze vor.",
        variant: "destructive",
      });
      return;
    }

    const orderedAssignments = [...block.assignments].sort((left, right) =>
      left.assignmentDate.localeCompare(right.assignmentDate)
    );

    await runBusyAction("Auftrag wird verschoben...", async () => {
      const updates = orderedAssignments.map((assignment, index) => ({
        assignmentId: assignment.id,
        assignmentDate: nextDays[index],
      }));
      await apiRequest("POST", "/api/planning/move-block", { updates });
      const dateByAssignmentId = new Map(
        updates.map((update) => [update.assignmentId, update.assignmentDate])
      );
      updateAssignmentsCache((current) =>
        current.map((assignment) =>
          dateByAssignmentId.has(assignment.id)
            ? {
                ...assignment,
                assignmentDate: dateByAssignmentId.get(assignment.id)!,
              }
            : assignment
        )
      );
      setSelectedBlockId(block.id);
      await refreshPlanningBoard();
      toast({
        title: "Auftrag verschoben",
        description: `${block.job.jobNumber} wurde auf ${formatRange(
          nextDays[0],
          nextDays[nextDays.length - 1]
        )} verschoben.`,
      });
    });
  }

  async function resizeBlock(block: PlanningBlock, edge: "start" | "end", targetDate: string) {
    if (edge === "start") {
      if (
        !ensureActionAllowed(
          block.canResizeStart,
          "Der Start eines laufenden Auftrags bleibt fix. Nur noch komplett geplante Aufträge können am Anfang verschoben werden."
        )
      ) {
        return;
      }
    } else if (
      !ensureActionAllowed(
        block.canResizeEnd,
        "Laufende Aufträge können nur nach hinten auf offene Tage verlängert werden."
      )
    ) {
      return;
    }

    const targetIndex = dayIndexByDate.get(targetDate);
    if (targetIndex === undefined) {
      return;
    }

    if (edge === "start" && targetIndex > block.endIndex) {
      return;
    }
    if (edge === "end" && targetIndex < block.startIndex) {
      return;
    }

    const newStartIndex = edge === "start" ? targetIndex : block.startIndex;
    const newEndIndex = edge === "end" ? targetIndex : block.endIndex;
    const nextDays = visibleDays.slice(newStartIndex, newEndIndex + 1).filter((day) => !isSaturday(day));

    if (nextDays.join("|") === block.days.join("|")) {
      return;
    }

    const addedDays = nextDays.filter((day) => !block.days.includes(day));
    const removedDays = block.days.filter((day) => !nextDays.includes(day));

    if (!block.canMove && removedDays.length > 0) {
      toast({
        title: "Nur nach hinten verlängern",
        description: "Sobald der Auftrag gestartet ist, bleiben bisherige Tage fix.",
        variant: "destructive",
      });
      return;
    }

    if (getJobConflictDates(block.jobId, addedDays, block.assignmentIds).length > 0) {
      toast({
        title: "Auftrag kollidiert",
        description: "Im erweiterten Zeitraum liegen für diesen Auftrag bereits andere Einträge.",
        variant: "destructive",
      });
      return;
    }

    const template = block.assignments[0];
    const workerIds = block.workers.map((worker) => worker.id);

    await runBusyAction("Zeitraum wird aktualisiert...", async () => {
      const removedAssignments = block.assignments.filter((assignment) =>
        removedDays.includes(assignment.assignmentDate)
      );
      const resizeResult = await apiRequestJson<{ ok: true; createdAssignments: PlanAssignment[] }>(
        "POST",
        "/api/planning/resize-block",
        {
          removeAssignmentIds: removedAssignments.map((assignment) => assignment.id),
          createAssignments: addedDays.map((day) => ({
          jobId: block.jobId,
          assignmentDate: day,
          plannedStartTime: template.plannedStartTime || undefined,
          plannedEndTime: template.plannedEndTime || undefined,
          note: template.note || undefined,
          workerIds,
          })),
        }
      );

      const removedAssignmentIds = new Set(removedAssignments.map((assignment) => assignment.id));
      const createdAssignments = resizeResult.createdAssignments.map((assignment) => ({
        ...assignment,
        job: block.job,
        workers: [...block.workers],
      }));

      await refreshPlanningBoard();
      toast({
        title: "Zeitraum aktualisiert",
        description: `${block.job.jobNumber} läuft jetzt von ${formatRange(
          nextDays[0],
          nextDays[nextDays.length - 1]
        )}.`,
      });
    });
  }

  const [pendingRemoveBlock, setPendingRemoveBlock] = useState<PlanningBlock | null>(null);

  function requestRemoveBlock(block: PlanningBlock) {
    if (
      !ensureActionAllowed(
        block.canDelete,
        "Nur komplett geplante Aufträge können komplett aus der Planung entfernt werden."
      )
    ) {
      return;
    }
    setPendingRemoveBlock(block);
  }

  async function confirmRemoveBlock() {
    const block = pendingRemoveBlock;
    setPendingRemoveBlock(null);
    if (!block) return;

    await runBusyAction("Auftrag wird entfernt...", async () => {
      await apiRequest("POST", "/api/planning/remove-block", {
        assignmentIds: block.assignments.map((assignment) => assignment.id),
      });
      const assignmentIds = new Set(block.assignmentIds);
      updateAssignmentsCache((current) =>
        current.filter((assignment) => !assignmentIds.has(assignment.id))
      );
      updateBacklogCache((current) => {
        if (current.some((job) => job.id === block.job.id)) {
          return current;
        }
        return [block.job, ...current];
      });
      await refreshPlanningBoard();
      setSelectedBlockId(null);
      toast({
        title: "Auftrag entfernt",
        description: "Der Auftrag liegt wieder nur noch im Backlog.",
      });
    });
  }

  function cancelRemoveBlock() {
    setPendingRemoveBlock(null);
  }

  const changeWindow = useCallback((direction: -1 | 1) => {
    setWeekStart((current) => addCalendarDays(current, direction * viewSpan * 7));
  }, [viewSpan]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    const data = event.active.data.current as PlanningDragData | undefined;

    if (data?.dragType === "job") {
      const job = jobsById.get(data.jobId);
      if (job) {
        setActiveDrag({ type: "job", job });
      }
      return;
    }

    if (data?.dragType === "employee") {
      const employee = employeesById.get(data.employeeId);
      if (employee) {
        setActiveDrag({ type: "employee", employee });
      }
      return;
    }

    if (data?.dragType === "block-move") {
      const block = blocksById.get(data.blockId);
      if (block) {
        setActiveDrag({ type: "block-move", block });
      }
      return;
    }

    if (data?.dragType === "block-resize-start") {
      const block = blocksById.get(data.blockId);
      if (block) {
        setActiveDrag({ type: "block-resize-start", block });
      }
      return;
    }

    if (data?.dragType === "block-resize-end") {
      const block = blocksById.get(data.blockId);
      if (block) {
        setActiveDrag({ type: "block-resize-end", block });
      }
      return;
    }

    if (id.startsWith("job:")) {
      const job = jobsById.get(id.slice(4));
      if (job) {
        setActiveDrag({ type: "job", job });
      }
      return;
    }

    if (id.startsWith("employee:")) {
      const employee = employeesById.get(id.slice(9));
      if (employee) {
        setActiveDrag({ type: "employee", employee });
      }
      return;
    }

    if (id.startsWith("block-move:")) {
      const block = blocksById.get(id.slice(11));
      if (block) {
        setActiveDrag({ type: "block-move", block });
      }
      return;
    }

    if (id.startsWith("block-resize-start:")) {
      const block = blocksById.get(id.slice(19));
      if (block) {
        setActiveDrag({ type: "block-resize-start", block });
      }
      return;
    }

    if (id.startsWith("block-resize-end:")) {
      const block = blocksById.get(id.slice(17));
      if (block) {
        setActiveDrag({ type: "block-resize-end", block });
      }
    }
  }, [blocksById, employeesById, jobsById]);

  function getActiveCenterX(event: DragOverEvent | DragEndEvent) {
    const translated = event.active.rect.current.translated;
    if (translated) {
      return translated.left + translated.width / 2;
    }

    const initial = event.active.rect.current.initial;
    if (initial) {
      return initial.left + initial.width / 2;
    }

    return null;
  }

  const resolveDropDate = useCallback((event: DragOverEvent | DragEndEvent, currentDrag: ActiveDrag) => {
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) {
      return null;
    }

    const overData = event.over?.data.current as PlanningDropData | undefined;
    const targetBlock =
      overData?.dropType === "block"
        ? blocksById.get(overData.blockId) ?? overData
        : overId.startsWith("block:")
          ? blocksById.get(overId.slice(6))
          : null;

    return resolveDropDateForTarget({
      overId,
      activeType: currentDrag.type,
      overData,
      targetBlock,
      activeCenterX: getActiveCenterX(event),
      overRect: event.over?.rect ?? null,
    });
  }, [blocksById]);

  const buildResizePreview = useCallback((currentDrag: ActiveDrag, targetDate: string | null): ResizePreview | null => {
    if (!targetDate) {
      return null;
    }

    if (currentDrag.type !== "block-resize-start" && currentDrag.type !== "block-resize-end") {
      return null;
    }

    const edge = currentDrag.type === "block-resize-start" ? "start" : "end";
    const block = currentDrag.block;
    const targetIndex = dayIndexByDate.get(targetDate);

    if (targetIndex === undefined) {
      return null;
    }

    if (edge === "start" && targetIndex > block.endIndex) {
      return null;
    }

    if (edge === "end" && targetIndex < block.startIndex) {
      return null;
    }

    const startIndex = edge === "start" ? targetIndex : block.startIndex;
    const endIndex = edge === "end" ? targetIndex : block.endIndex;
    const nextDays = visibleDays.slice(startIndex, endIndex + 1);

    if (nextDays.length === 0) {
      return null;
    }

    const addedDays = nextDays.filter((day) => !block.days.includes(day));
    const removedDays = block.days.filter((day) => !nextDays.includes(day));
    const addedIndexes = addedDays
      .map((day) => dayIndexByDate.get(day))
      .filter((index): index is number => index !== undefined);

    const blockedByHistory = !block.canMove && removedDays.length > 0;
    const blockedByPermission =
      (edge === "start" && !block.canResizeStart) || (edge === "end" && !block.canResizeEnd);
    const blockedByConflict =
      getJobConflictDates(block.jobId, addedDays, block.assignmentIds).length > 0;

    return {
      blockId: block.id,
      edge,
      startIndex,
      endIndex,
      span: nextDays.length,
      lane: block.lane,
      nextDays,
      addedDays,
      addedStartIndex: addedIndexes.length > 0 ? Math.min(...addedIndexes) : null,
      addedSpan: addedIndexes.length,
      valid: !blockedByHistory && !blockedByPermission && !blockedByConflict,
      label: formatRange(nextDays[0], nextDays[nextDays.length - 1]),
    };
  }, [dayIndexByDate, getJobConflictDates, visibleDays]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (!activeDrag) {
      return;
    }

    if (!event.over) {
      setDragOverDate(null);
      return;
    }

    setDragOverDate(resolveDropDate(event, activeDrag));
  }, [activeDrag, resolveDropDate]);

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActiveDrag(null);
    setDragOverDate(null);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const overId = event.over ? String(event.over.id) : null;
    const overData = event.over?.data.current as PlanningDropData | undefined;
    const currentDrag = activeDrag;
    setActiveDrag(null);
    setDragOverDate(null);

    if (!currentDrag || !overId || busyLabel) {
      return;
    }

    try {
      const overDate = resolveDropDate(event, currentDrag);

      // Job dropped on employee-day zone → create assignment + assign worker
      if (currentDrag.type === "job" && overData?.dropType === "employee-day") {
        const { date, employeeId } = overData;
        await createBlockWithEmployee(currentDrag.job, date, employeeId);
        return;
      }

      // Job dropped on generic day zone (no employee) → create without worker
      if (currentDrag.type === "job" && overDate) {
        await createBlockFromBacklog(currentDrag.job, overDate);
        return;
      }

      if (currentDrag.type === "employee" && (overData?.dropType === "block" || overId.startsWith("block:"))) {
        const blockId = overData?.dropType === "block" ? overData.blockId : overId.slice(6);
        const block = blocksById.get(blockId);
        if (block) {
          await assignEmployeeToBlock(block, currentDrag.employee, {
            mode: "from-date",
            startDate: overDate ?? block.startDate,
          });
        }
        return;
      }

      if (currentDrag.type === "block-move" && overDate) {
        await moveBlock(currentDrag.block, overDate);
        return;
      }

      if (currentDrag.type === "block-resize-start" && overDate) {
        await resizeBlock(currentDrag.block, "start", overDate);
        return;
      }

      if (currentDrag.type === "block-resize-end" && overDate) {
        await resizeBlock(currentDrag.block, "end", overDate);
      }
    } catch (error) {
      toast({
        title: "Änderung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Die Planung konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      void refreshPlanningBoard();
    }
  }, [
    activeDrag,
    assignEmployeeToBlock,
    blocksById,
    busyLabel,
    createBlockFromBacklog,
    moveBlock,
    refreshPlanningBoard,
    resizeBlock,
    resolveDropDate,
    toast,
  ]);

  const employeePlanRows = useMemo(
    () => buildEmployeePlanRows(activeEmployees, blocks),
    [activeEmployees, blocks],
  );
  const totalEmployeeLanes = useMemo(
    () => employeePlanRows.reduce((sum, row) => sum + row.laneCount, 0),
    [employeePlanRows],
  );
  const laneCount = useMemo(
    () => Math.max(2, totalEmployeeLanes),
    [totalEmployeeLanes],
  );
  const { boardBackgroundStyle, boardGridStyle } = useMemo(
    () =>
      getPlanningBoardLayout({
        isMobile,
        viewSpan,
        visibleDayCount: visibleDays.length,
        laneCount,
      }),
    [isMobile, laneCount, viewSpan, visibleDays.length],
  );
  const resizePreview = useMemo(
    () => (activeDrag ? buildResizePreview(activeDrag, dragOverDate) : null),
    [activeDrag, buildResizePreview, dragOverDate],
  );

  const removeEmployeeFromSelected = useCallback((employeeId: string, selection?: WorkerDaySelection) => {
    if (selectedBlock) {
      return removeEmployeeFromBlock(selectedBlock, employeeId, selection);
    }
  }, [removeEmployeeFromBlock, selectedBlock]);

  const assignEmployeeToSelected = useCallback((employeeId: string, selection?: WorkerDaySelection) => {
    if (selectedBlock) {
      const employee = employeesById.get(employeeId);
      if (employee) {
        return assignEmployeeToBlock(selectedBlock, employee, selection);
      }
    }
  }, [assignEmployeeToBlock, employeesById, selectedBlock]);

  const moveSelectedBlock = useCallback((targetDate: string) => {
    if (selectedBlock) {
      return moveBlock(selectedBlock, targetDate);
    }
  }, [moveBlock, selectedBlock]);

  const removeSelectedBlock = useCallback(() => {
    if (selectedBlock) {
      requestRemoveBlock(selectedBlock);
    }
  }, [selectedBlock]);

  const placeJobOnDate = useCallback(async (targetDate: string) => {
    if (!placingJob) return;
    const job = placingJob;
    setPlacingJob(null);
    await runBusyAction("Platziere Auftrag...", () => createBlockFromBacklog(job, targetDate));
  }, [placingJob, createBlockFromBacklog]);

  useEffect(() => {
    if (!placingJob) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlacingJob(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [placingJob]);

  return {
    activeDrag,
    activeEmployees,
    backlogJobs,
    backlogList,
    backlogSearch,
    plannedJobIds,
    blocks,
    employeePlanRows,
    boardBackgroundStyle,
    boardGridStyle,
    busyLabel,
    dragOverDate,
    isLoadingBoard,
    collisionDetection,
    getEmployeeAvailability,
    handleDragCancel,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    jobForm,
    laneCount,
    resizePreview,
    selectedBlock,
    sensors,
    showCreateJobDialog,
    teamFilter,
    teamEntries: filteredTeamOverview,
    teamFocusDate,
    teamFocusLabel,
    teamSearch,
    daySummaries,
    teamSections,
    teamSummary,
    isMobile,
    viewSpan,
    visibleDays,
    weekStart,
    changeWindow,
    removeEmployeeFromSelected,
    assignEmployeeToSelected,
    moveSelectedBlock,
    removeSelectedBlock,
    pendingRemoveBlock,
    confirmRemoveBlock,
    cancelRemoveBlock,
    setBacklogSearch,
    setSelectedBlockId,
    setTeamFilter,
    setTeamSearch,
    setViewSpan,
    updateJobForm,
    setShowCreateJobDialog: setCreateJobDialogOpen,
    submitCreateJob: createBacklogJob,
    placingJob,
    setPlacingJob,
    placeJobOnDate,
  };
}
