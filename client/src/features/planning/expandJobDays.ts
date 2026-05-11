// T-202 stage 2: turn a job's planned duration into a list of consecutive
// workdays starting at the user-dropped date. One workday equals 8 hours;
// weekends are skipped after the first day so a drop directly on Saturday
// or Sunday is still honored (user intent overrides the default).

import { toDateStr } from "./utils";

const MINUTES_PER_WORKDAY = 8 * 60;

function parseIsoDay(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function expandJobIntoWorkdays(
  startDateISO: string,
  plannedDurationMinutes: number | null | undefined,
  options: { skipWeekends?: boolean } = {},
): string[] {
  const skipWeekends = options.skipWeekends ?? true;
  const required =
    !plannedDurationMinutes || plannedDurationMinutes <= MINUTES_PER_WORKDAY
      ? 1
      : Math.ceil(plannedDurationMinutes / MINUTES_PER_WORKDAY);

  const days: string[] = [];
  const cursor = parseIsoDay(startDateISO);

  let safetyCounter = 0;
  while (days.length < required && safetyCounter < 365) {
    safetyCounter += 1;
    const include = days.length === 0 || !skipWeekends || !isWeekend(cursor);
    if (include) {
      days.push(toDateStr(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}
