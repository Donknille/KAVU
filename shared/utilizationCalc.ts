// T-307: Per-employee utilization for a closed date range. Pure function
// over already-fetched data so it can be smoke-tested without a database.
//
// Inputs:
// - rangeDays: every workday (Mon-Fri) inside the range, ISO YYYY-MM-DD
// - weeklyHours: contractual hours per week (default 40)
// - holidayDates: dates inside the range that are public holidays for the
//   employee's company region
// - vacationDates: dates inside the range that are blocked by an approved
//   vacation
// - plannedMinutesByDate: minutes already scheduled per date (sum across
//   assignments, fallback 8h if a job has no plannedDurationMinutes)
//
// Output:
// - availableHours: contractually available work hours after subtracting
//   holidays and vacation days
// - plannedHours: hours already booked into assignments
// - utilizationRatio: plannedHours / availableHours, clamped to [0, 5]
// - level: traffic light identical to client-side calcUtilization

export type UtilizationLevel = "green" | "yellow" | "red";

export interface EmployeeUtilization {
  availableHours: number;
  plannedHours: number;
  utilizationRatio: number;
  level: UtilizationLevel;
}

function isWorkday(isoDate: string): boolean {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function listWorkdays(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const start = new Date(fy, (fm ?? 1) - 1, fd ?? 1);
  const end = new Date(ty, (tm ?? 1) - 1, td ?? 1);
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();
    if (day < 1 || day > 5) continue;
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    const dd = String(cursor.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
}

export function calculateEmployeeUtilization(input: {
  rangeDays: string[];
  weeklyHours: number;
  holidayDates: Set<string> | string[];
  vacationDates: Set<string> | string[];
  plannedMinutesByDate: Record<string, number>;
}): EmployeeUtilization {
  const holidays = input.holidayDates instanceof Set ? input.holidayDates : new Set(input.holidayDates);
  const vacations = input.vacationDates instanceof Set ? input.vacationDates : new Set(input.vacationDates);
  const dailyHours = Math.max(0, input.weeklyHours) / 5;

  const workdays = input.rangeDays.filter(isWorkday);
  const availableDays = workdays.filter((d) => !holidays.has(d) && !vacations.has(d)).length;
  const availableHours = Number((availableDays * dailyHours).toFixed(2));

  const plannedMinutes = workdays.reduce(
    (sum, d) => sum + (input.plannedMinutesByDate[d] ?? 0),
    0,
  );
  const plannedHours = Number((plannedMinutes / 60).toFixed(2));

  const rawRatio = availableHours === 0 ? (plannedHours > 0 ? 5 : 0) : plannedHours / availableHours;
  const utilizationRatio = Math.min(5, Math.max(0, Number(rawRatio.toFixed(3))));

  let level: UtilizationLevel;
  if (utilizationRatio > 1) {
    level = "red";
  } else if (utilizationRatio >= 0.8) {
    level = "yellow";
  } else {
    level = "green";
  }

  return { availableHours, plannedHours, utilizationRatio, level };
}
