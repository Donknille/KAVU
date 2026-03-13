import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { MapPin, Clock, User } from "lucide-react";
import { formatAddress } from "@/lib/constants";

interface AssignmentCardProps {
  assignment: any;
  onClick?: () => void;
  compact?: boolean;
}

export function AssignmentCard({ assignment, onClick, compact = false }: AssignmentCardProps) {
  const job = assignment.job;
  const address = formatAddress(job?.addressStreet, job?.addressZip, job?.addressCity);

  return (
    <Card
      className={`p-4 cursor-pointer hover-elevate transition-all ${
        assignment.status === "problem"
          ? "ring-2 ring-red-400 dark:ring-red-600"
          : ""
      }`}
      onClick={onClick}
      data-testid={`card-assignment-${assignment.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate" data-testid={`text-job-title-${assignment.id}`}>
            {job?.title || "Auftrag"}
          </h3>
          <p className="text-sm text-muted-foreground truncate" data-testid={`text-customer-${assignment.id}`}>
            {job?.customerName}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>

      {!compact && (
        <>
          {address && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{address}</span>
            </div>
          )}

          {assignment.plannedStartTime && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {assignment.plannedStartTime?.slice(0, 5)}
                {assignment.plannedEndTime && ` - ${assignment.plannedEndTime.slice(0, 5)}`}
              </span>
            </div>
          )}
        </>
      )}

      {assignment.workers && assignment.workers.length > 0 && (
        <div
          className={`flex items-center gap-1.5 text-muted-foreground ${
            compact ? "mt-1 text-xs" : "text-sm"
          }`}
        >
          <User className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {assignment.workers
              .map((w: any) => `${w.firstName} ${w.lastName.charAt(0)}.`)
              .join(", ")}
          </span>
        </div>
      )}

      {assignment.offlineSync?.pendingItems?.length > 0 && (
        <div className="mt-2 text-xs font-medium text-amber-700">
          Wird synchronisiert
        </div>
      )}

      {assignment.offlineSync?.conflictItems?.length > 0 && (
        <div className="mt-2 text-xs font-medium text-red-700">
          Sync-Konflikt pruefen
        </div>
      )}
    </Card>
  );
}
