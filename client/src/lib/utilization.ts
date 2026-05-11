// T-201: Day-level utilization, computed from the count of active employees
// vs. those that have at least one assignment for the day. Returns both raw
// numbers and a coarse traffic-light level so the UI doesn't have to repeat
// the threshold logic.

export type UtilizationLevel = "green" | "yellow" | "red";

export interface Utilization {
  busy: number;
  free: number;
  total: number;
  freeRatio: number; // 0..1, 1 means everyone is free, 0 means everyone is busy
  level: UtilizationLevel;
}

const GREEN_FREE_THRESHOLD = 0.5; // >= 50% free -> green
const YELLOW_FREE_THRESHOLD = 0.2; // 20..50% free -> yellow, < 20% -> red

export function calcUtilization(total: number, busy: number): Utilization {
  const safeTotal = Math.max(0, total);
  const safeBusy = Math.max(0, Math.min(busy, safeTotal));
  const free = safeTotal - safeBusy;
  const freeRatio = safeTotal === 0 ? 1 : free / safeTotal;
  let level: UtilizationLevel;
  if (freeRatio >= GREEN_FREE_THRESHOLD) {
    level = "green";
  } else if (freeRatio >= YELLOW_FREE_THRESHOLD) {
    level = "yellow";
  } else {
    level = "red";
  }
  return {
    busy: safeBusy,
    free,
    total: safeTotal,
    freeRatio,
    level,
  };
}

export function utilizationLabel(u: Utilization): string {
  if (u.total === 0) return "Keine Mitarbeiter";
  return `${u.free} von ${u.total} frei`;
}

export function utilizationDetailLabel(u: Utilization): string {
  if (u.total === 0) return "Keine aktiven Mitarbeiter.";
  const busyPart = `${u.busy} im Einsatz`;
  const freePart = `${u.free} frei`;
  return `${busyPart} · ${freePart}`;
}
