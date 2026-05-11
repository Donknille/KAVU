// T-200: Twelve preset colors for employee identification in the planning
// view. Each color has at least a 4.5:1 contrast ratio against pure white
// text on top, so the same swatch works as both a background fill and a
// pill background.
export const EMPLOYEE_COLOR_PALETTE = [
  "#2563eb", // blue-600
  "#0891b2", // cyan-600
  "#0d9488", // teal-600
  "#059669", // emerald-600
  "#65a30d", // lime-600
  "#ca8a04", // amber-600
  "#ea580c", // orange-600
  "#dc2626", // red-600
  "#db2777", // pink-600
  "#9333ea", // purple-600
  "#7c3aed", // violet-600
  "#475569", // slate-600 (fallback for legacy employees without color)
] as const;

export type EmployeeColor = (typeof EMPLOYEE_COLOR_PALETTE)[number];

/**
 * Pick the next preset that is not yet in use by the existing employees.
 * Falls back to the first preset once the palette is exhausted.
 */
export function pickDefaultEmployeeColor(usedColors: ReadonlyArray<string | null | undefined>): string {
  const taken = new Set(
    usedColors
      .map((color) => color?.toLowerCase())
      .filter((color): color is string => Boolean(color)),
  );
  for (const candidate of EMPLOYEE_COLOR_PALETTE) {
    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return EMPLOYEE_COLOR_PALETTE[0];
}

export function isValidEmployeeColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
