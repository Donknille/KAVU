import { useEffect, useState } from "react";
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
  toDateStr,
  toStartOfWeek,
  uniqueSortedDates,
} from "@/features/planning/utils";

const JOBS_QUERY_KEY = "/api/jobs";
const EMPTY_PLANNING_BOARD: PlanningBoardResponse = {
  employees: [],
  activeEmployees: [],
  backlogJobs: [],
  assignments: [],
  blocks: [],
  daySummaries: [],
};

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
  const [backlogSearch, setBacklogSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");

  const visibleDays = getVisibleDays(weekStart, viewSpan);
  const planningBoardUrl = `/api/planning/board?startDate=${visibleDays[0]}&endDate=${
    visibleDays[visibleDays.length - 1]
  }`;

  const { data: planningBoard = EMPTY_PLANNING_BOARD } = useQuery<PlanningBoardResponse>({
    queryKey: [planningBoardUrl],
  });

  const { assignments, activeEmployees, backlogJobs, blocks } = planningBoard;
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const jobsById = new Map<string, PlanJob>();
  for (const job of backlogJobs) {
    jobsById.set(job.id, job);
  }
  for (const assignment of assignments) {
    if (assignment.job) {
      jobsById.set(assignment.job.id, assignment.job);
    }
  }
  const employeesById = new Map(activeEmployees.map((employee) => [employee.id, employee]));
  const dayIndexByDate = new Map(visibleDays.map((date, index) => [date, index]));
  const selectedBlock = selectedBlockId ? blocksById.get(selectedBlockId) ?? null : null;
  const backlogList = filterJobs(backlogJobs, backlogSearch);
  const employeeList = filterEmployees(activeEmployees, teamSearch);

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

  const collisionDetection: CollisionDetection = (args) => {
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
  };

  function updateJobForm(field: keyof JobForm, value: string) {
    setJobForm((current) => ({ ...current, [field]: value }));
  }

  function setCreateJobDialogOpen(open: boolean) {
    setShowCreateJobDialog(open);
    if (!open) {
      setJobForm(EMPTY_JOB_FORM);
    }
  }

  function composePlanningBoard(
    data: Pick<PlanningBoardResponse, "employees" | "backlogJobs" | "assignments">
  ): PlanningBoardResponse {
    return createPlanningBoardReadModel(data, visibleDays, today) as PlanningBoardResponse;
  }

  function updateAssignmentsCache(
    updater: (current: PlanAssignment[]) => PlanAssignment[]
  ) {
    queryClient.setQueryData<PlanningBoardResponse>([planningBoardUrl], (current) => ({
      ...composePlanningBoard({
        employees: current?.employees ?? [],
        backlogJobs: current?.backlogJobs ?? [],
        assignments: updater(current?.assignments ?? []),
      }),
    }));
  }

  function updateBacklogCache(updater: (current: PlanJob[]) => PlanJob[]) {
    queryClient.setQueryData<PlanningBoardResponse>([planningBoardUrl], (current) => ({
      ...composePlanningBoard({
        employees: current?.employees ?? [],
        backlogJobs: updater(current?.backlogJobs ?? []),
        assignments: current?.assignments ?? [],
      }),
    }));
  }

  function updateJobsCache(updater: (current: PlanJob[]) => PlanJob[]) {
    queryClient.setQueryData<PlanJob[]>([JOBS_QUERY_KEY], (current = []) => updater(current));
  }

  async function refreshPlanningBoard() {
    await queryClient.invalidateQueries({
      queryKey: [planningBoardUrl],
      exact: true,
    });
  }

  async function runBusyAction(label: string, action: () => Promise<void>) {
    if (busyLabel) {
      return;
    }

    setBusyLabel(label);
    try {
      await action();
    } finally {
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

  function getEmployeeScheduledDates(
    employeeId: string,
    targetDays: string[],
    ignoredAssignmentIds: string[] = []
  ) {
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
  }

  function getJobConflictDates(jobId: string, targetDays: string[], ignoredAssignmentIds: string[] = []) {
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
  }

  function getEmployeeAvailability(employeeId: string) {
    if (!selectedBlock) {
      return "free" as const;
    }
    if (selectedBlock.workerIds.includes(employeeId)) {
      return "assigned" as const;
    }

    return getEmployeeScheduledDates(employeeId, selectedBlock.days, selectedBlock.assignmentIds).length > 0
      ? ("scheduled" as const)
      : ("free" as const);
  }

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

  async function createBlockFromBacklog(job: PlanJob, targetDate: string) {
    if (getJobConflictDates(job.id, [targetDate]).length > 0) {
      toast({
        title: "Auftrag bereits eingeplant",
        description: "Fuer diesen Tag existiert bereits ein Eintrag.",
        variant: "destructive",
      });
      return;
    }

    await runBusyAction("Auftrag wird eingeplant...", async () => {
      const createdAssignment = await apiRequestJson<PlanAssignment>("POST", "/api/assignments", {
        jobId: job.id,
        assignmentDate: targetDate,
      });

      updateAssignmentsCache((current) => [
        ...current,
        {
          ...createdAssignment,
          job,
          workers: [],
        },
      ]);
      updateBacklogCache((current) => current.filter((entry) => entry.id !== job.id));
      toast({
        title: "Auftrag eingeplant",
        description: `${job.jobNumber} liegt jetzt am ${formatCompactDate(targetDate)} im Kalender.`,
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
        "Bei laufenden Auftraegen koennen Mitarbeitende nur ab heute und nur auf offene Tage ergaenzt werden."
      )
    ) {
      return;
    }
    const targetAssignments = getAssignmentsForWorkerAdd(block.assignments, today, selection);
    if (targetAssignments.length === 0) {
      toast({
        title: "Keine offenen Tage mehr",
        description: "Fuer die gewaehlten Tage gibt es keine offenen oder laufenden Einsatzdaten mehr.",
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
        description: `${getEmployeeLabel(employee)} ist fuer die gewaehlten Tage bereits auf ${block.job.jobNumber} eingeplant.`,
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
      const firstAssignedDay = pendingAssignments[0]?.assignmentDate;
      const lastAssignedDay = pendingAssignments[pendingAssignments.length - 1]?.assignmentDate;
      toast({
        title: "Mitarbeiter zugewiesen",
        description:
          firstAssignedDay && lastAssignedDay
            ? `${getEmployeeLabel(employee)} arbeitet jetzt auf ${block.job.jobNumber} fuer ${formatRange(
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
        "Mitarbeitende koennen nur aus noch nicht gestarteten Tagen entfernt werden."
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
        description: "Fuer die gewaehlten Tage gibt es keine noch nicht gestarteten Einsatzdaten mehr, aus denen Mitarbeitende entfernt werden koennen.",
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
      updateAssignmentsCache((current) =>
        current.map((assignment) => {
          if (!targetAssignments.some((entry) => entry.id === assignment.id)) {
            return assignment;
          }

          return {
            ...assignment,
            workers: (assignment.workers ?? []).filter((worker) => worker.id !== employeeId),
          };
        })
      );
      toast({
        title: "Mitarbeiter entfernt",
        description:
          targetAssignments.length > 0
            ? `Die Zuweisung wurde fuer ${formatRange(
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
    if (targetIndex + block.span > visibleDays.length) {
      toast({
        title: "Zeitraum ausserhalb der Ansicht",
        description: "Der Auftrag passt in dieser Wochenansicht nicht mehr vollstaendig hinein.",
        variant: "destructive",
      });
      return;
    }

    const nextDays = visibleDays.slice(targetIndex, targetIndex + block.span);
    if (nextDays.join("|") === block.days.join("|")) {
      return;
    }

    if (getJobConflictDates(block.jobId, nextDays, block.assignmentIds).length > 0) {
      toast({
        title: "Auftrag kollidiert",
        description: "Fuer den Auftrag liegen im Zielzeitraum bereits andere Tages-Einsaetze vor.",
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
          "Der Start eines laufenden Auftrags bleibt fix. Nur noch komplett geplante Auftraege koennen am Anfang verschoben werden."
        )
      ) {
        return;
      }
    } else if (
      !ensureActionAllowed(
        block.canResizeEnd,
        "Laufende Auftraege koennen nur nach hinten auf offene Tage verlaengert werden."
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
    const nextDays = visibleDays.slice(newStartIndex, newEndIndex + 1);

    if (nextDays.join("|") === block.days.join("|")) {
      return;
    }

    const addedDays = nextDays.filter((day) => !block.days.includes(day));
    const removedDays = block.days.filter((day) => !nextDays.includes(day));

    if (!block.canMove && removedDays.length > 0) {
      toast({
        title: "Nur nach hinten verlaengern",
        description: "Sobald der Auftrag gestartet ist, bleiben bisherige Tage fix.",
        variant: "destructive",
      });
      return;
    }

    if (getJobConflictDates(block.jobId, addedDays, block.assignmentIds).length > 0) {
      toast({
        title: "Auftrag kollidiert",
        description: "Im erweiterten Zeitraum liegen fuer diesen Auftrag bereits andere Eintraege.",
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

      updateAssignmentsCache((current) => [
        ...current.filter((assignment) => !removedAssignmentIds.has(assignment.id)),
        ...createdAssignments,
      ]);
      toast({
        title: "Zeitraum aktualisiert",
        description: `${block.job.jobNumber} laeuft jetzt von ${formatRange(
          nextDays[0],
          nextDays[nextDays.length - 1]
        )}.`,
      });
    });
  }

  async function removeBlock(block: PlanningBlock) {
    if (
      !ensureActionAllowed(
        block.canDelete,
        "Nur komplett geplante Auftraege koennen komplett aus der Planung entfernt werden."
      )
    ) {
      return;
    }

    if (!window.confirm(`Soll ${block.job.jobNumber} komplett aus der Planung entfernt werden?`)) {
      return;
    }

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

  function changeWindow(direction: -1 | 1) {
    setWeekStart((current) => addCalendarDays(current, direction * viewSpan * 7));
  }

  function handleDragStart(event: DragStartEvent) {
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
  }

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

  function resolveDropDate(event: DragOverEvent | DragEndEvent, currentDrag: ActiveDrag) {
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
  }

  function buildResizePreview(currentDrag: ActiveDrag, targetDate: string | null): ResizePreview | null {
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
  }

  function handleDragOver(event: DragOverEvent) {
    if (!activeDrag) {
      return;
    }

    if (!event.over) {
      setDragOverDate(null);
      return;
    }

    setDragOverDate(resolveDropDate(event, activeDrag));
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDrag(null);
    setDragOverDate(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
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
        title: "Aenderung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Die Planung konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  }

  const laneCount = Math.max(2, blocks.reduce((max, block) => Math.max(max, block.lane + 1), 0));
  const columnMinWidth = isMobile ? (viewSpan === 2 ? 104 : 76) : viewSpan === 2 ? 58 : 36;
  const laneHeight = isMobile ? (viewSpan === 2 ? 88 : 64) : viewSpan === 2 ? 48 : 34;
  const boardMinHeight = isMobile
    ? viewSpan === 2
      ? "clamp(18rem, 40vh, 24rem)"
      : "clamp(14rem, 30vh, 18rem)"
    : viewSpan === 2
      ? "clamp(13.5rem, 28vh, 17rem)"
      : "clamp(11rem, 22vh, 14rem)";
  const resizePreview = activeDrag ? buildResizePreview(activeDrag, dragOverDate) : null;
  const boardGridStyle = {
    gridTemplateColumns: `repeat(${visibleDays.length}, minmax(${columnMinWidth}px, 1fr))`,
    gridTemplateRows: `repeat(${laneCount}, minmax(${laneHeight}px, 1fr))`,
    minHeight: boardMinHeight,
  };
  const boardBackgroundStyle = {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    backgroundImage:
      "linear-gradient(to right, rgba(203, 213, 225, 0.9) 1px, transparent 1px), linear-gradient(to bottom, rgba(203, 213, 225, 0.9) 1px, transparent 1px)",
    backgroundSize: `calc(100% / ${visibleDays.length}) calc(100% / ${laneCount})`,
  };

  return {
    activeDrag,
    activeEmployees,
    backlogJobs,
    backlogList,
    backlogSearch,
    blocks,
    boardBackgroundStyle,
    boardGridStyle,
    busyLabel,
    collisionDetection,
    daySummaries: planningBoard.daySummaries,
    employeeList,
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
    teamSearch,
    isMobile,
    viewSpan,
    visibleDays,
    weekStart,
    changeWindow,
    removeEmployeeFromSelected(employeeId: string, selection?: WorkerDaySelection) {
      if (selectedBlock) {
        return removeEmployeeFromBlock(selectedBlock, employeeId, selection);
      }
    },
    assignEmployeeToSelected(employeeId: string, selection?: WorkerDaySelection) {
      if (selectedBlock) {
        const employee = employeesById.get(employeeId);
        if (employee) {
          return assignEmployeeToBlock(selectedBlock, employee, selection);
        }
      }
    },
    moveSelectedBlock(targetDate: string) {
      if (selectedBlock) {
        return moveBlock(selectedBlock, targetDate);
      }
    },
    removeSelectedBlock() {
      if (selectedBlock) {
        return removeBlock(selectedBlock);
      }
    },
    setBacklogSearch,
    setSelectedBlockId,
    setTeamSearch,
    setViewSpan,
    updateJobForm,
    setShowCreateJobDialog: setCreateJobDialogOpen,
    submitCreateJob: createBacklogJob,
  };
}

function filterJobs(jobs: PlanJob[], searchTerm: string) {
  const normalizedSearch = searchTerm.toLowerCase();
  return jobs.filter((job) => {
    const haystack = `${job.jobNumber} ${job.title} ${job.customerName}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}

function filterEmployees(employees: PlanEmployee[], searchTerm: string) {
  const normalizedSearch = searchTerm.toLowerCase();
  return employees.filter((employee) => {
    const haystack = `${employee.firstName} ${employee.lastName} ${employee.phone ?? ""}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}
