export type AssignmentScheduleLike = {
  id: string;
  assignmentDate?: string | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  status?: string | null;
};

const ACTIVE_STATUSES = new Set(["en_route", "on_site", "break"]);

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function compareAssignments(a: AssignmentScheduleLike, b: AssignmentScheduleLike) {
  const dateCompare = (a.assignmentDate ?? "").localeCompare(b.assignmentDate ?? "");
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return (a.plannedStartTime ?? "99:99").localeCompare(b.plannedStartTime ?? "99:99");
}

export function formatPlannedWindow(assignment: AssignmentScheduleLike | null | undefined) {
  const start = assignment?.plannedStartTime?.slice(0, 5);
  const end = assignment?.plannedEndTime?.slice(0, 5);

  if (!start) {
    return "Flexible Ankunft";
  }

  return end ? `${start} - ${end}` : start;
}

export function splitEmployeeAssignments<T extends AssignmentScheduleLike>(
  assignments: T[],
  today: string,
) {
  const activeAssignments = assignments
    .filter((assignment) => ACTIVE_STATUSES.has(assignment.status ?? ""))
    .sort(compareAssignments);

  const activeAssignmentIds = new Set(activeAssignments.map((assignment) => assignment.id));

  const todayAssignments = assignments
    .filter(
      (assignment) =>
        assignment.assignmentDate === today && !activeAssignmentIds.has(assignment.id),
    )
    .sort(compareAssignments);

  const upcomingAssignments = assignments
    .filter(
      (assignment) =>
        (assignment.assignmentDate ?? "") > today && !activeAssignmentIds.has(assignment.id),
    )
    .sort(compareAssignments);

  return {
    activeAssignments,
    todayAssignments,
    upcomingAssignments,
  };
}

export function getFocusAssignment<T extends AssignmentScheduleLike>(params: {
  activeAssignments: T[];
  todayAssignments: T[];
  upcomingAssignments: T[];
}) {
  return (
    params.activeAssignments[0] ??
    params.todayAssignments[0] ??
    params.upcomingAssignments[0] ??
    null
  );
}

export function getFocusLabel(params: {
  activeAssignmentsCount: number;
  todayAssignmentsCount: number;
  upcomingAssignmentsCount: number;
}) {
  if (params.activeAssignmentsCount > 0) {
    return "Aktiv jetzt";
  }

  if (params.todayAssignmentsCount > 0) {
    return "Als Nächstes heute";
  }

  if (params.upcomingAssignmentsCount > 0) {
    return "Nächster geplanter Einsatz";
  }

  return "Heute im Blick";
}

export function getNextAssignment<T extends AssignmentScheduleLike>(params: {
  activeAssignments: T[];
  todayAssignments: T[];
  upcomingAssignments: T[];
}) {
  if (params.activeAssignments.length > 0) {
    return params.todayAssignments[0] ?? params.upcomingAssignments[0] ?? null;
  }

  if (params.todayAssignments.length > 0) {
    return params.todayAssignments[1] ?? params.upcomingAssignments[0] ?? null;
  }

  if (params.upcomingAssignments.length > 0) {
    return params.upcomingAssignments[1] ?? null;
  }

  return null;
}

export function getNextAssignmentAfterCurrent<T extends AssignmentScheduleLike>(
  assignments: T[],
  currentAssignmentId: string,
) {
  const sortedAssignments = [...assignments].sort(compareAssignments);
  const currentIndex = sortedAssignments.findIndex(
    (assignment) => assignment.id === currentAssignmentId,
  );

  if (currentIndex === -1) {
    return sortedAssignments[0] ?? null;
  }

  return sortedAssignments[currentIndex + 1] ?? null;
}
