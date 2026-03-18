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
        <AlertTitle>Abgleich erforderlich</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {visibleConflictCount === 1
              ? "Eine gespeicherte Änderung passt nicht mehr zum aktuellen Datenstand."
              : `${visibleConflictCount} gespeicherte Änderungen passen nicht mehr zum aktuellen Datenstand.`}
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
      <AlertTitle>{isOnline ? "Abgleich ausstehend" : "Änderung gespeichert"}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {isOnline
            ? isSyncing
              ? "Gespeicherte Änderungen werden derzeit mit dem System abgeglichen."
              : visiblePendingCount === 1
                ? "Eine gespeicherte Änderung wartet auf den Abgleich."
                : `${visiblePendingCount} gespeicherte Änderungen warten auf den Abgleich.`
            : visiblePendingCount === 1
              ? "Eine Änderung wurde gespeichert und wird übermittelt, sobald wieder eine Verbindung besteht."
              : `${visiblePendingCount} Änderungen wurden gespeichert und werden übermittelt, sobald wieder eine Verbindung besteht.`}
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
            Abgleich starten
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
