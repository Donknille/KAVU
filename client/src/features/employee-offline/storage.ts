import type { QueuedAssignmentAction } from "@/features/employee-offline/shared";

function getStorageKey(employeeId: string) {
  return `kavu:employee-sync-queue:${employeeId}`;
}

export function loadQueue(employeeId: string) {
  if (typeof window === "undefined") {
    return [] as QueuedAssignmentAction[];
  }

  const raw = window.localStorage.getItem(getStorageKey(employeeId));
  if (!raw) {
    return [] as QueuedAssignmentAction[];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedAssignmentAction[]) : [];
  } catch {
    return [] as QueuedAssignmentAction[];
  }
}

export function saveQueue(employeeId: string, queue: QueuedAssignmentAction[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(employeeId), JSON.stringify(queue));
}
