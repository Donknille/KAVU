export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  planned: "Geplant",
  en_route: "Anfahrt",
  on_site: "Vor Ort",
  break: "Pause",
  completed: "Abgefahren",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  planned: "Geplant",
  in_progress: "In Arbeit",
  problem: "Problem",
  completed: "Erledigt",
  reviewed: "Geprüft",
  billable: "Abrechenbar",
};

export const JOB_CATEGORY_LABELS: Record<string, string> = {
  pv: "PV / Solar",
  heat_pump: "Wärmepumpe",
  shk: "SHK",
  montage: "Montage",
  service: "Service",
  other: "Sonstiges",
};

export const CATEGORY_COLORS: Record<string, string> = {
  pv: "#eab308",
  heat_pump: "#ef4444",
  shk: "#3b82f6",
  montage: "#8b5cf6",
  service: "#06b6d4",
  other: "#6b7280",
};

export const CATEGORY_BG: Record<string, string> = {
  pv: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
  heat_pump: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
  shk: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
  montage: "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800",
  service: "bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-800",
  other: "bg-gray-50 border-gray-200 dark:bg-gray-950/30 dark:border-gray-800",
};

export const STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  en_route: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  on_site: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  break: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  problem: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  in_progress: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  reviewed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  billable: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

export function formatAddress(
  street?: string | null,
  zip?: string | null,
  city?: string | null,
): string {
  return [street, zip, city].filter(Boolean).join(", ");
}

export function getNavigationUrl(address: string): string {
  const encoded = encodeURIComponent(address);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    return `maps://maps.apple.com/?daddr=${encoded}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

export function getPhoneUrl(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

export function formatDuration(minutes: number | null): string {
  if (!minutes) return "0 Min.";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  return `${h} Std. ${m} Min.`;
}

export function formatTime(date: Date | string | null): string {
  if (!date) return "--:--";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(date: string | null): string {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
