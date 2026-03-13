export type AssignmentStatus =
  | "planned"
  | "en_route"
  | "on_site"
  | "break"
  | "completed"
  | "problem";

export type AssignmentAction =
  | "start-work"
  | "start-travel"
  | "arrive"
  | "start-break"
  | "end-break"
  | "complete"
  | "report-problem"
  | "resume";

export type QueueItemState = "pending" | "conflict";

export interface QueuedAssignmentAction {
  id: string;
  assignmentId: string;
  assignmentTitle?: string;
  action: AssignmentAction;
  body?: Record<string, unknown>;
  expectedStatus: AssignmentStatus;
  nextStatus: AssignmentStatus;
  createdAt: string;
  state: QueueItemState;
  syncError?: string;
}

const actionLabels: Record<AssignmentAction, string> = {
  "start-work": "Arbeit starten",
  "start-travel": "Fahrt beginnen",
  arrive: "Ankunft Baustelle",
  "start-break": "Pause starten",
  "end-break": "Pause beenden",
  complete: "Einsatz beenden",
  "report-problem": "Problem melden",
  resume: "Weiterarbeiten",
};

const transitionMap: Record<
  AssignmentAction,
  {
    allowedFrom: AssignmentStatus[];
    nextStatus: AssignmentStatus;
  }
> = {
  "start-work": {
    allowedFrom: ["planned", "en_route"],
    nextStatus: "on_site",
  },
  "start-travel": {
    allowedFrom: ["planned"],
    nextStatus: "en_route",
  },
  arrive: {
    allowedFrom: ["en_route"],
    nextStatus: "on_site",
  },
  "start-break": {
    allowedFrom: ["on_site"],
    nextStatus: "break",
  },
  "end-break": {
    allowedFrom: ["break"],
    nextStatus: "on_site",
  },
  complete: {
    allowedFrom: ["on_site", "problem"],
    nextStatus: "completed",
  },
  "report-problem": {
    allowedFrom: ["en_route", "on_site", "break"],
    nextStatus: "problem",
  },
  resume: {
    allowedFrom: ["problem"],
    nextStatus: "on_site",
  },
};

export function getActionLabel(action: AssignmentAction) {
  return actionLabels[action];
}

export function getTransition(action: AssignmentAction) {
  return transitionMap[action];
}

export function getNextStatusForAction(
  action: AssignmentAction,
  currentStatus: AssignmentStatus,
) {
  const transition = getTransition(action);
  if (!transition.allowedFrom.includes(currentStatus)) {
    throw new Error("Der Einsatzstatus hat sich geaendert. Bitte pruefe die Ansicht erneut.");
  }

  return transition.nextStatus;
}

export function getPendingQueueItemsForAssignment(
  queue: QueuedAssignmentAction[],
  assignmentId: string,
) {
  return queue
    .filter((item) => item.assignmentId === assignmentId && item.state === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getConflictQueueItemsForAssignment(
  queue: QueuedAssignmentAction[],
  assignmentId: string,
) {
  return queue
    .filter((item) => item.assignmentId === assignmentId && item.state === "conflict")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getOptimisticStatus(
  status: AssignmentStatus,
  queue: QueuedAssignmentAction[],
  assignmentId: string,
) {
  return getPendingQueueItemsForAssignment(queue, assignmentId).reduce(
    (currentStatus, item) => item.nextStatus,
    status,
  );
}

export function applyOptimisticAssignmentState<T extends { id: string; status: AssignmentStatus }>(
  assignment: T,
  queue: QueuedAssignmentAction[],
) {
  const pendingItems = getPendingQueueItemsForAssignment(queue, assignment.id);
  const conflictItems = getConflictQueueItemsForAssignment(queue, assignment.id);

  if (pendingItems.length === 0 && conflictItems.length === 0) {
    return assignment;
  }

  return {
    ...assignment,
    status: getOptimisticStatus(assignment.status, queue, assignment.id),
    offlineSync: {
      pendingItems,
      conflictItems,
    },
  };
}

export function getSyncErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Die Aktion konnte nicht synchronisiert werden.";
  }

  const match = error.message.match(/^(\d+):/);
  if (!match) {
    return "Die Aktion konnte aktuell nicht mit dem Server synchronisiert werden.";
  }

  const status = Number(match[1]);
  if (status === 400 || status === 409) {
    return "Der Serverstatus passt nicht mehr zur vorgemerkten Aktion.";
  }
  if (status === 403 || status === 404) {
    return "Der Einsatz ist nicht mehr im erwarteten Zustand verfuegbar.";
  }

  return "Die Aktion konnte aktuell nicht synchronisiert werden.";
}

export function isConflictError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const match = error.message.match(/^(\d+):/);
  if (!match) {
    return false;
  }

  const status = Number(match[1]);
  return status === 400 || status === 403 || status === 404 || status === 409;
}

export function getQueueItemLabel(item: QueuedAssignmentAction) {
  return `${getActionLabel(item.action)} vorgemerkt`;
}
