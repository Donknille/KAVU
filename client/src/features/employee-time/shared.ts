import type { QueuedAssignmentAction } from "@/features/employee-offline/shared";
import { formatDuration, formatTime } from "@/lib/constants";

export type TrackerStatus =
  | "planned"
  | "en_route"
  | "on_site"
  | "break"
  | "problem"
  | "completed";

export type TimeEntryLike = {
  startedAt?: string | Date | null;
  arrivedAt?: string | Date | null;
  endedAt?: string | Date | null;
  totalMinutes?: number | null;
};

export type BreakEntryLike = {
  breakStart?: string | Date | null;
  breakEnd?: string | Date | null;
  durationMinutes?: number | null;
};

export function toTimestamp(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

export function getTotalBreakDurationMs(breaks: BreakEntryLike[] = [], now = Date.now()) {
  return breaks.reduce((total, entry) => {
    const breakStart = toTimestamp(entry.breakStart);
    if (!breakStart) {
      return total;
    }

    const breakEnd = toTimestamp(entry.breakEnd) ?? now;
    return total + Math.max(0, breakEnd - breakStart);
  }, 0);
}

export function getCurrentBreakDurationMs(breaks: BreakEntryLike[] = [], now = Date.now()) {
  const openBreak = [...breaks].reverse().find((entry) => !entry.breakEnd && entry.breakStart);
  const breakStart = toTimestamp(openBreak?.breakStart);
  if (!breakStart) {
    return 0;
  }

  return Math.max(0, now - breakStart);
}

export function getTrackedDurationMs(
  timeEntry?: TimeEntryLike | null,
  breaks: BreakEntryLike[] = [],
  now = Date.now(),
) {
  if (!timeEntry) {
    return 0;
  }

  if (timeEntry.totalMinutes != null && timeEntry.endedAt) {
    return Math.max(0, timeEntry.totalMinutes) * 60_000;
  }

  const startedAt = toTimestamp(timeEntry.startedAt);
  if (!startedAt) {
    return 0;
  }

  const endedAt = toTimestamp(timeEntry.endedAt) ?? now;
  const grossDuration = Math.max(0, endedAt - startedAt);
  const breakDuration = getTotalBreakDurationMs(breaks, endedAt);

  return Math.max(0, grossDuration - breakDuration);
}

export function formatStopwatchParts(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    main: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    seconds: String(seconds).padStart(2, "0"),
  };
}

function cloneBreakEntry(entry: BreakEntryLike): BreakEntryLike {
  return {
    breakStart: entry.breakStart ?? null,
    breakEnd: entry.breakEnd ?? null,
    durationMinutes: entry.durationMinutes ?? null,
  };
}

function ensureOptimisticTimeEntry(
  timeEntry: TimeEntryLike | null,
  actionTimestamp: string,
): TimeEntryLike {
  return (
    timeEntry ?? {
      startedAt: actionTimestamp,
      arrivedAt: null,
      endedAt: null,
      totalMinutes: null,
    }
  );
}

export function applyOptimisticTimeState(
  timeEntry?: TimeEntryLike | null,
  breaks: BreakEntryLike[] = [],
  pendingItems: QueuedAssignmentAction[] = [],
) {
  let nextTimeEntry = timeEntry ? { ...timeEntry } : null;
  const nextBreaks = breaks.map(cloneBreakEntry);

  for (const item of [...pendingItems].sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
    const actionTimestamp = item.createdAt;

    switch (item.action) {
      case "start-work": {
        nextTimeEntry = ensureOptimisticTimeEntry(nextTimeEntry, actionTimestamp);
        nextTimeEntry.startedAt = nextTimeEntry.startedAt ?? actionTimestamp;
        nextTimeEntry.arrivedAt = nextTimeEntry.arrivedAt ?? actionTimestamp;
        nextTimeEntry.endedAt = null;
        nextTimeEntry.totalMinutes = null;
        break;
      }
      case "start-travel": {
        nextTimeEntry = ensureOptimisticTimeEntry(nextTimeEntry, actionTimestamp);
        nextTimeEntry.startedAt = nextTimeEntry.startedAt ?? actionTimestamp;
        nextTimeEntry.endedAt = null;
        nextTimeEntry.totalMinutes = null;
        break;
      }
      case "arrive": {
        nextTimeEntry = ensureOptimisticTimeEntry(nextTimeEntry, actionTimestamp);
        nextTimeEntry.startedAt = nextTimeEntry.startedAt ?? actionTimestamp;
        nextTimeEntry.arrivedAt = nextTimeEntry.arrivedAt ?? actionTimestamp;
        break;
      }
      case "start-break": {
        nextTimeEntry = ensureOptimisticTimeEntry(nextTimeEntry, actionTimestamp);
        nextBreaks.push({
          breakStart: actionTimestamp,
          breakEnd: null,
          durationMinutes: null,
        });
        break;
      }
      case "end-break": {
        const openBreak = [...nextBreaks].reverse().find((entry) => !entry.breakEnd && entry.breakStart);
        const breakStart = toTimestamp(openBreak?.breakStart);
        const breakEnd = toTimestamp(actionTimestamp);

        if (openBreak && breakStart && breakEnd) {
          openBreak.breakEnd = actionTimestamp;
          openBreak.durationMinutes = Math.max(0, Math.round((breakEnd - breakStart) / 60_000));
        }
        break;
      }
      case "complete": {
        nextTimeEntry = ensureOptimisticTimeEntry(nextTimeEntry, actionTimestamp);
        nextTimeEntry.endedAt = actionTimestamp;
        nextTimeEntry.totalMinutes = Math.round(
          getTrackedDurationMs(nextTimeEntry, nextBreaks, toTimestamp(actionTimestamp) ?? Date.now()) /
            60_000,
        );
        break;
      }
      case "report-problem":
      case "resume":
        break;
      default:
        break;
    }
  }

  return {
    timeEntry: nextTimeEntry,
    breaks: nextBreaks,
  };
}

export function getTrackerStatusLabel(status: TrackerStatus) {
  switch (status) {
    case "planned":
      return "Bereit";
    case "en_route":
      return "Start offen";
    case "on_site":
      return "Arbeit";
    case "break":
      return "Pause";
    case "problem":
      return "Unterbrochen";
    case "completed":
      return "Abgeschlossen";
    default:
      return "Zeiterfassung";
  }
}

export function getTrackerHelperText(
  status: TrackerStatus,
  timeEntry?: TimeEntryLike | null,
  breaks: BreakEntryLike[] = [],
  now = Date.now(),
) {
  switch (status) {
    case "planned":
      return "Die Zeiterfassung startet mit Arbeitsbeginn.";
    case "en_route":
      return "Bitte den Arbeitsbeginn einmal bestaetigen.";
    case "on_site":
      return timeEntry?.startedAt
        ? `Arbeitszeit laeuft seit ${formatTime(timeEntry.startedAt)}`
        : "Einsatz ist aktiv.";
    case "break": {
      const currentBreakDuration = getCurrentBreakDurationMs(breaks, now);
      return currentBreakDuration > 0
        ? `Pause seit ${formatDuration(Math.round(currentBreakDuration / 60_000))}`
        : "Pause ist aktiv.";
    }
    case "problem":
      return "Bitte kurz mit dem Buero abstimmen und danach fortsetzen oder abschliessen.";
    case "completed":
      return timeEntry?.endedAt
        ? `Abgeschlossen um ${formatTime(timeEntry.endedAt)}`
        : "Einsatz ist abgeschlossen.";
    default:
      return "Zeiterfassung";
  }
}

export function getTrackerFacts(
  timeEntry?: TimeEntryLike | null,
  breaks: BreakEntryLike[] = [],
  now = Date.now(),
) {
  const totalBreakMinutes = Math.round(getTotalBreakDurationMs(breaks, now) / 60_000);

  return [
    {
      label: "Beginn",
      value: formatTime(timeEntry?.startedAt ?? null),
    },
    {
      label: "Ende",
      value: formatTime(timeEntry?.endedAt ?? null),
    },
    {
      label: "Pausen",
      value: formatDuration(totalBreakMinutes),
    },
  ];
}

export function isLiveTrackingStatus(status: TrackerStatus) {
  return status === "en_route" || status === "on_site" || status === "break" || status === "problem";
}
