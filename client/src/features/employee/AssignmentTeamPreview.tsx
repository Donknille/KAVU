import { MessageCircle, Phone as PhoneIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type AssignmentWorkerLike = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  color?: string | null;
};

type AssignmentWithWorkers = {
  workers?: AssignmentWorkerLike[] | null;
};

function getWorkerInitials(worker: AssignmentWorkerLike) {
  const first = worker.firstName?.trim().charAt(0) ?? "";
  const last = worker.lastName?.trim().charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function formatWorkerShortName(worker: AssignmentWorkerLike) {
  const firstName = worker.firstName?.trim();
  const lastInitial = worker.lastName?.trim().charAt(0);

  if (!firstName && !lastInitial) {
    return "Mitarbeiter";
  }

  if (!lastInitial) {
    return firstName ?? "Mitarbeiter";
  }

  return `${firstName ?? ""} ${lastInitial}.`.trim();
}

export function getAssignmentWorkers(assignment: AssignmentWithWorkers | null | undefined) {
  return Array.isArray(assignment?.workers) ? assignment.workers : [];
}

export function getAssignmentTeamHeadline(assignment: AssignmentWithWorkers | null | undefined) {
  const workers = getAssignmentWorkers(assignment);

  if (workers.length === 0) {
    return "Team wird noch abgestimmt";
  }

  if (workers.length === 1) {
    return null; // Solo — no team display needed
  }

  return `${workers.length} Personen auf diesem Einsatz`;
}

export function getAssignmentTeamNames(
  assignment: AssignmentWithWorkers | null | undefined,
  maxVisibleNames = 3,
) {
  const workers = getAssignmentWorkers(assignment);

  if (workers.length === 0) {
    return "Die Zentrale ergänzt die Teamzuordnung noch.";
  }

  const visibleNames = workers.slice(0, maxVisibleNames).map(formatWorkerShortName);
  const hiddenCount = workers.length - visibleNames.length;

  if (hiddenCount <= 0) {
    return visibleNames.join(", ");
  }

  return `${visibleNames.join(", ")} +${hiddenCount}`;
}

function sanitizePhone(phone: string) {
  return phone.replace(/[^0-9+]/g, "");
}

function whatsAppUrl(phone: string) {
  const clean = sanitizePhone(phone).replace(/^\+/, "");
  return `https://wa.me/${clean}`;
}

export function TeamContactList({
  assignment,
  className,
}: {
  assignment: AssignmentWithWorkers | null | undefined;
  className?: string;
}) {
  const workers = getAssignmentWorkers(assignment);

  // Solo or no team: don't show contact list
  if (workers.length <= 1) return null;

  // workers.length >= 2 guaranteed from here

  return (
    <div className={cn("rounded-2xl border brand-outline-chip px-3 py-2.5 space-y-2", className)}>
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 brand-ink-muted" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] brand-ink-muted">
          Team ({workers.length})
        </p>
      </div>
      {workers.map((worker) => (
        <div key={worker.id ?? `${worker.firstName}`} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: worker.color ?? "#475569" }}
            >
              {getWorkerInitials(worker)}
            </span>
            <span className="truncate text-sm font-medium brand-ink">
              {formatWorkerShortName(worker)}
            </span>
          </div>
          {worker.phone && (
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={`tel:${sanitizePhone(worker.phone)}`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#68d5c8]/15 text-[#173d66] transition hover:bg-[#68d5c8]/25"
                title="Anrufen"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
              </a>
              <a
                href={whatsAppUrl(worker.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366] transition hover:bg-[#25D366]/25"
                title="WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function AssignmentTeamPreview({
  assignment,
  label = "Mit wem",
  compact = false,
  inverse = false,
  className,
}: {
  assignment: AssignmentWithWorkers | null | undefined;
  label?: string;
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  const workers = getAssignmentWorkers(assignment);

  // Solo: don't show team section when alone
  if (workers.length <= 1) return null;

  const visibleWorkers = workers.slice(0, compact ? 3 : 4);
  const hiddenCount = workers.length - visibleWorkers.length;

  return (
    <div
      className={cn(
        "rounded-2xl border",
        inverse ? "border-white/12 bg-white/10" : "brand-outline-chip",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <Users className={cn("h-3.5 w-3.5", inverse ? "text-slate-300" : "brand-ink-muted")} />
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.16em]",
            inverse ? "text-slate-300" : "brand-ink-muted",
          )}
        >
          {label}
        </p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex -space-x-2">
          {visibleWorkers.map((worker) => (
            <span
              key={worker.id ?? `${worker.firstName}-${worker.lastName}`}
              className={cn(
                "flex items-center justify-center rounded-full border text-[10px] font-semibold text-white",
                compact ? "h-7 w-7" : "h-8 w-8",
                inverse ? "border-slate-950/40" : "border-[var(--brand-panel-start)]",
              )}
              style={{ backgroundColor: worker.color ?? "#475569" }}
              title={formatWorkerShortName(worker)}
            >
              {getWorkerInitials(worker)}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span
              className={cn(
                "flex items-center justify-center rounded-full border text-[10px] font-semibold",
                compact ? "h-7 w-7" : "h-8 w-8",
                inverse
                  ? "border-white/15 bg-white/10 text-slate-100"
                  : "border-[var(--brand-chip-border)] bg-[var(--brand-chip-bg)] brand-ink",
              )}
            >
              +{hiddenCount}
            </span>
          )}
        </div>

        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-medium",
              compact ? "text-xs" : "text-sm",
              inverse ? "text-white" : "brand-ink",
            )}
          >
            {getAssignmentTeamHeadline(assignment)}
          </p>
          <p
            className={cn(
              "truncate",
              compact ? "text-[11px]" : "text-xs",
              inverse ? "text-slate-300" : "brand-ink-soft",
            )}
          >
            {getAssignmentTeamNames(assignment, compact ? 2 : 3)}
          </p>
        </div>
      </div>
    </div>
  );
}
