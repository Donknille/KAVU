import { AlertTriangle, CheckCircle2, RefreshCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEmployeeOfflineQueue } from "@/features/employee-offline/EmployeeOfflineQueueProvider";
import { getQueueItemLabel } from "@/features/employee-offline/shared";

interface OfflineQueueAlertProps {
  assignmentId?: string;
}

export function OfflineQueueAlert({ assignmentId }: OfflineQueueAlertProps) {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    conflictCount,
    flushQueue,
    dismissAssignmentConflicts,
    getPendingItemsForAssignment,
    getConflictItemsForAssignment,
  } = useEmployeeOfflineQueue();

  const pendingItems = assignmentId ? getPendingItemsForAssignment(assignmentId) : [];
  const conflictItems = assignmentId ? getConflictItemsForAssignment(assignmentId) : [];
  const visiblePendingCount = assignmentId ? pendingItems.length : pendingCount;
  const visibleConflictCount = assignmentId ? conflictItems.length : conflictCount;

  if (visiblePendingCount === 0 && visibleConflictCount === 0) {
    return null;
  }

  if (visibleConflictCount > 0) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Sync-Konflikt</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {visibleConflictCount === 1
              ? "Eine vorgemerkte Aktion passt nicht mehr zum aktuellen Serverstand."
              : `${visibleConflictCount} vorgemerkte Aktionen passen nicht mehr zum aktuellen Serverstand.`}
          </p>
          {assignmentId && conflictItems.length > 0 && (
            <ul className="space-y-1 text-sm">
              {conflictItems.map((item) => (
                <li key={item.id}>
                  {getQueueItemLabel(item)}
                  {item.syncError ? `: ${item.syncError}` : ""}
                </li>
              ))}
            </ul>
          )}
          {assignmentId && (
            <Button
              variant="outline"
              size="sm"
              className="border-current bg-transparent"
              onClick={() => dismissAssignmentConflicts(assignmentId)}
              data-testid="button-dismiss-assignment-conflicts"
            >
              Konflikt ausblenden
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      {isOnline ? <CheckCircle2 className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      <AlertTitle>{isOnline ? "Synchronisierung ausstehend" : "Offline gespeichert"}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {isOnline
            ? isSyncing
              ? "Vorgemerkte Aktionen werden gerade mit dem Server abgeglichen."
              : visiblePendingCount === 1
                ? "Eine vorgemerkte Aktion wartet auf die Synchronisierung."
                : `${visiblePendingCount} vorgemerkte Aktionen warten auf die Synchronisierung.`
            : visiblePendingCount === 1
              ? "Eine Aktion wurde lokal gespeichert und wird beim naechsten Online-Moment gesendet."
              : `${visiblePendingCount} Aktionen wurden lokal gespeichert und werden beim naechsten Online-Moment gesendet.`}
        </p>
        {assignmentId && pendingItems.length > 0 && (
          <ul className="space-y-1 text-sm">
            {pendingItems.map((item) => (
              <li key={item.id}>{getQueueItemLabel(item)}</li>
            ))}
          </ul>
        )}
        {isOnline && !isSyncing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void flushQueue()}
            data-testid="button-flush-offline-queue"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Jetzt synchronisieren
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
