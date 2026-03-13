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
              ? "Eine gespeicherte Aenderung passt nicht mehr zum aktuellen Datenstand."
              : `${visibleConflictCount} gespeicherte Aenderungen passen nicht mehr zum aktuellen Datenstand.`}
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
      <AlertTitle>{isOnline ? "Abgleich ausstehend" : "Aenderung gespeichert"}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {isOnline
            ? isSyncing
              ? "Gespeicherte Aenderungen werden derzeit mit dem System abgeglichen."
              : visiblePendingCount === 1
                ? "Eine gespeicherte Aenderung wartet auf den Abgleich."
                : `${visiblePendingCount} gespeicherte Aenderungen warten auf den Abgleich.`
            : visiblePendingCount === 1
              ? "Eine Aenderung wurde gespeichert und wird uebermittelt, sobald wieder eine Verbindung besteht."
              : `${visiblePendingCount} Aenderungen wurden gespeichert und werden uebermittelt, sobald wieder eine Verbindung besteht.`}
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
