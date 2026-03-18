import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { MapPin, Clock, User } from "lucide-react";
import { formatAddress } from "@/lib/constants";
import {
  AssignmentTeamPreview,
  formatWorkerShortName,
  getAssignmentWorkers,
} from "@/features/employee/AssignmentTeamPreview";

interface AssignmentCardProps {
  assignment: any;
  onClick?: () => void;
  compact?: boolean;
  emphasizeTeam?: boolean;
}

export function AssignmentCard({
  assignment,
  onClick,
  compact = false,
  emphasizeTeam = false,
}: AssignmentCardProps) {
  const job = assignment.job;
  const address = formatAddress(job?.addressStreet, job?.addressZip, job?.addressCity);
  const workers = getAssignmentWorkers(assignment);

  return (
    <Card
      className={`brand-soft-card rounded-[24px] p-4 cursor-pointer transition-all ${
        assignment.status === "problem"
          ? "ring-2 ring-red-400 dark:ring-red-600"
          : ""
      }`}
      onClick={onClick}
      data-testid={`card-assignment-${assignment.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-base truncate brand-ink"
            data-testid={`text-job-title-${assignment.id}`}
          >
            {job?.title || "Auftrag"}
          </h3>
          <p
            className="text-sm truncate brand-ink-soft"
            data-testid={`text-customer-${assignment.id}`}
          >
            {job?.customerName}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>

      {!compact && (
        <>
          {address && (
            <div className="mb-1 flex items-center gap-1.5 text-sm brand-ink-soft">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{address}</span>
            </div>
          )}

          {assignment.plannedStartTime && (
            <div className="mb-1 flex items-center gap-1.5 text-sm brand-ink-soft">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {assignment.plannedStartTime?.slice(0, 5)}
                {assignment.plannedEndTime && ` - ${assignment.plannedEndTime.slice(0, 5)}`}
              </span>
            </div>
          )}
        </>
      )}

      {emphasizeTeam ? (
        <AssignmentTeamPreview
          assignment={assignment}
          label={compact ? "Team" : "Mit wem"}
          compact={compact}
          className={compact ? "mt-2" : "mt-3"}
        />
      ) : workers.length > 0 ? (
        <div
          className={`flex items-center gap-1.5 brand-ink-soft ${
            compact ? "mt-1 text-xs" : "text-sm"
          }`}
        >
          <User className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {workers.map((worker: any) => formatWorkerShortName(worker)).join(", ")}
          </span>
        </div>
      ) : null}

      {assignment.offlineSync?.pendingItems?.length > 0 && (
        <div className="mt-2 text-xs font-medium text-amber-700">
          Wird synchronisiert
        </div>
      )}

      {assignment.offlineSync?.conflictItems?.length > 0 && (
        <div className="mt-2 text-xs font-medium text-red-700">
          Sync-Konflikt prüfen
        </div>
      )}
    </Card>
  );
}
