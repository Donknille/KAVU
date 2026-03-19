import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { nanoid } from "nanoid";
import { toast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { QK } from "@/lib/queryKeys";
import {
  applyOptimisticAssignmentState,
  getConflictQueueItemsForAssignment,
  getNextStatusForAction,
  getPendingQueueItemsForAssignment,
  getQueueItemLabel,
  getSyncErrorMessage,
  isConflictError,
  type AssignmentAction,
  type AssignmentStatus,
  type QueuedAssignmentAction,
} from "@/features/employee-offline/shared";
import { loadQueue, saveQueue } from "@/features/employee-offline/storage";

interface QueueActionInput {
  assignmentId: string;
  assignmentTitle?: string;
  currentStatus: AssignmentStatus;
  action: AssignmentAction;
  body?: Record<string, unknown>;
}

interface EmployeeOfflineQueueContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  queue: QueuedAssignmentAction[];
  pendingCount: number;
  conflictCount: number;
  queueAction: (input: QueueActionInput) => Promise<void>;
  flushQueue: () => Promise<void>;
  dismissAssignmentConflicts: (assignmentId: string) => void;
  getPendingItemsForAssignment: (assignmentId: string) => QueuedAssignmentAction[];
  getConflictItemsForAssignment: (assignmentId: string) => QueuedAssignmentAction[];
  applyOptimisticAssignmentState: <T extends { id: string; status: AssignmentStatus }>(
    assignment: T,
  ) => T & {
    offlineSync?: {
      pendingItems: QueuedAssignmentAction[];
      conflictItems: QueuedAssignmentAction[];
    };
  };
}

const EmployeeOfflineQueueContext = createContext<EmployeeOfflineQueueContextValue | null>(null);

function invalidateAssignmentQueries() {
  queryClient.invalidateQueries({ queryKey: [QK.ASSIGNMENTS] });
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === "string" && key.startsWith(QK.ASSIGNMENTS + "/my");
    },
  });
}

interface EmployeeOfflineQueueProviderProps {
  employeeId?: string | null;
  enabled: boolean;
  children: ReactNode;
}

export function EmployeeOfflineQueueProvider({
  employeeId,
  enabled,
  children,
}: EmployeeOfflineQueueProviderProps) {
  const isOnline = useNetworkStatus();
  const [queue, setQueue] = useState<QueuedAssignmentAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const queueRef = useRef<QueuedAssignmentAction[]>([]);
  const isSyncingRef = useRef(false);

  const persistQueue = useCallback(
    (nextQueue: QueuedAssignmentAction[]) => {
      queueRef.current = nextQueue;
      setQueue(nextQueue);

      if (enabled && employeeId) {
        saveQueue(employeeId, nextQueue);
      }
    },
    [employeeId, enabled],
  );

  useEffect(() => {
    if (!enabled || !employeeId) {
      persistQueue([]);
      return;
    }

    persistQueue(loadQueue(employeeId));
  }, [employeeId, enabled, persistQueue]);

  const flushQueue = useCallback(async () => {
    if (!enabled || !employeeId || !isOnline || isSyncingRef.current) {
      return;
    }

    const pendingItems = queueRef.current.filter((item) => item.state === "pending");
    if (pendingItems.length === 0) {
      return;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    let syncedCount = 0;
    let conflictCount = 0;

    try {
      let nextQueue = queueRef.current;

      while (true) {
        const currentItem = nextQueue
          .filter((item) => item.state === "pending")
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

        if (!currentItem) {
          break;
        }

        try {
          await apiRequest(
            "POST",
            `/api/assignments/${currentItem.assignmentId}/${currentItem.action}`,
            currentItem.body,
          );
          syncedCount += 1;
          nextQueue = nextQueue.filter((item) => item.id !== currentItem.id);
          persistQueue(nextQueue);
        } catch (error) {
          if (!isConflictError(error)) {
            break;
          }

          const syncError = getSyncErrorMessage(error);
          const relatedItems = nextQueue.filter(
            (item) => item.assignmentId === currentItem.assignmentId && item.state === "pending",
          );
          conflictCount += relatedItems.length;
          nextQueue = nextQueue.map((item) => {
            if (item.assignmentId !== currentItem.assignmentId || item.state !== "pending") {
              return item;
            }

            return {
              ...item,
              state: "conflict",
              syncError,
            };
          });
          persistQueue(nextQueue);
        }
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }

    if (syncedCount > 0 || conflictCount > 0) {
      invalidateAssignmentQueries();
    }

    if (syncedCount > 0) {
      toast({
        title: "Synchronisiert",
        description:
          syncedCount === 1
            ? "Eine vorgemerkte Aktion wurde mit dem Server abgeglichen."
            : `${syncedCount} vorgemerkte Aktionen wurden mit dem Server abgeglichen.`,
      });
    }

    if (conflictCount > 0) {
      toast({
        title: "Sync-Konflikt",
        description:
          conflictCount === 1
            ? "Eine vorgemerkte Aktion passt nicht mehr zum aktuellen Serverstand."
            : `${conflictCount} vorgemerkte Aktionen passen nicht mehr zum aktuellen Serverstand.`,
        variant: "destructive",
      });
    }
  }, [employeeId, enabled, isOnline, persistQueue]);

  useEffect(() => {
    if (!enabled || !employeeId || !isOnline) {
      return;
    }

    void flushQueue();
  }, [employeeId, enabled, flushQueue, isOnline]);

  const queueAction = useCallback(
    async ({ assignmentId, assignmentTitle, currentStatus, action, body }: QueueActionInput) => {
      if (!enabled || !employeeId) {
        throw new Error("Offline-Sync ist für diesen Benutzer nicht verfügbar.");
      }

      const queuedItem: QueuedAssignmentAction = {
        id: nanoid(),
        assignmentId,
        assignmentTitle,
        action,
        body,
        expectedStatus: currentStatus,
        nextStatus: getNextStatusForAction(action, currentStatus),
        createdAt: new Date().toISOString(),
        state: "pending",
      };

      const nextQueue = [...queueRef.current, queuedItem];
      persistQueue(nextQueue);

      toast({
        title: isOnline ? "Änderung gespeichert" : "Änderung offline gespeichert",
        description: isOnline
          ? `${getQueueItemLabel(queuedItem)}. Der Abgleich wird jetzt gestartet.`
          : `${getQueueItemLabel(queuedItem)}. Die Änderung wird automatisch übermittelt, sobald wieder eine Verbindung besteht.`,
      });

      if (isOnline) {
        await flushQueue();
      }
    },
    [employeeId, enabled, flushQueue, isOnline, persistQueue],
  );

  const dismissAssignmentConflicts = useCallback(
    (assignmentId: string) => {
      persistQueue(
        queueRef.current.filter(
          (item) => !(item.assignmentId === assignmentId && item.state === "conflict"),
        ),
      );
    },
    [persistQueue],
  );

  const pendingCount = useMemo(
    () => queue.filter((item) => item.state === "pending").length,
    [queue],
  );
  const conflictCount = useMemo(
    () => queue.filter((item) => item.state === "conflict").length,
    [queue],
  );

  const value = useMemo<EmployeeOfflineQueueContextValue>(
    () => ({
      isOnline,
      isSyncing,
      queue,
      pendingCount,
      conflictCount,
      queueAction,
      flushQueue,
      dismissAssignmentConflicts,
      getPendingItemsForAssignment: (assignmentId: string) =>
        getPendingQueueItemsForAssignment(queue, assignmentId),
      getConflictItemsForAssignment: (assignmentId: string) =>
        getConflictQueueItemsForAssignment(queue, assignmentId),
      applyOptimisticAssignmentState: <T extends { id: string; status: AssignmentStatus }>(
        assignment: T,
      ) => applyOptimisticAssignmentState(assignment, queue),
    }),
    [
      conflictCount,
      dismissAssignmentConflicts,
      flushQueue,
      isOnline,
      isSyncing,
      pendingCount,
      queue,
      queueAction,
    ],
  );

  return (
    <EmployeeOfflineQueueContext.Provider value={value}>
      {children}
    </EmployeeOfflineQueueContext.Provider>
  );
}

export function useEmployeeOfflineQueue() {
  const context = useContext(EmployeeOfflineQueueContext);
  if (!context) {
    throw new Error("useEmployeeOfflineQueue must be used within EmployeeOfflineQueueProvider");
  }

  return context;
}
