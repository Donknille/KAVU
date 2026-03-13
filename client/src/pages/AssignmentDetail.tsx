import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionButtons } from "@/components/ActionButtons";
import { ConnectionStatusBadge } from "@/components/ConnectionStatusBadge";
import { ProblemDialog } from "@/components/ProblemDialog";
import { OfflineQueueAlert } from "@/features/employee-offline/OfflineQueueAlert";
import { useEmployeeOfflineQueue } from "@/features/employee-offline/EmployeeOfflineQueueProvider";
import { type AssignmentAction } from "@/features/employee-offline/shared";
import { useToast } from "@/hooks/use-toast";
import {
  formatAddress,
  formatDate,
  formatDuration,
  formatTime,
  getNavigationUrl,
  getPhoneUrl,
  ISSUE_TYPE_LABELS,
  toDateStr,
} from "@/lib/constants";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock,
  FileText,
  MapPin,
  Navigation,
  Phone,
  User,
} from "lucide-react";

function formatPlannedWindow(detail: any) {
  const start = detail?.plannedStartTime?.slice(0, 5);
  const end = detail?.plannedEndTime?.slice(0, 5);

  if (!start) {
    return "Ohne feste Uhrzeit";
  }

  return end ? `${start} - ${end}` : start;
}

function getStatusSummary(status: string) {
  switch (status) {
    case "planned":
      return "Starte die Fahrt, sobald du losfaehrst.";
    case "en_route":
      return "Melde deine Ankunft direkt bei der Baustelle.";
    case "on_site":
      return "Arbeite vor Ort und beende den Einsatz erst, wenn alles abgeschlossen ist.";
    case "break":
      return "Dein Einsatz pausiert. Beende die Pause, wenn du weiterarbeitest.";
    case "problem":
      return "Es liegt ein Problem vor. Setze den Einsatz fort, sobald es geloest ist.";
    case "completed":
      return "Dieser Einsatz ist abgeschlossen.";
    default:
      return "Alle wichtigen Einsatzdaten sind hier gebuendelt.";
  }
}

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showProblemDialog, setShowProblemDialog] = useState(false);
  const {
    isOnline,
    isSyncing,
    queueAction,
    applyOptimisticAssignmentState,
    getPendingItemsForAssignment,
    getConflictItemsForAssignment,
  } = useEmployeeOfflineQueue();

  const { data: detail, isLoading } = useQuery<any>({
    queryKey: ["/api/assignments", id],
  });

  const effectiveDetail = detail ? applyOptimisticAssignmentState(detail) : null;

  async function runAction(action: AssignmentAction) {
    if (action === "report-problem") {
      setShowProblemDialog(true);
      return;
    }

    if (!effectiveDetail) {
      return;
    }

    try {
      await queueAction({
        assignmentId: effectiveDetail.id,
        assignmentTitle: effectiveDetail.job?.title,
        currentStatus: effectiveDetail.status,
        action,
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Aktion konnte nicht vorgemerkt werden.",
        variant: "destructive",
      });
    }
  }

  function handleAction(action: string) {
    void runAction(action as AssignmentAction);
  }

  async function handleProblemSubmit(issueType: string, note: string) {
    if (!effectiveDetail) {
      return;
    }

    try {
      await queueAction({
        assignmentId: effectiveDetail.id,
        assignmentTitle: effectiveDetail.job?.title,
        currentStatus: effectiveDetail.status,
        action: "report-problem",
        body: { issueType, note },
      });
      setShowProblemDialog(false);
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Problem konnte nicht vorgemerkt werden.",
        variant: "destructive",
      });
    }
  }

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    navigate("/");
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Einsatz nicht gefunden</p>
      </div>
    );
  }

  const pendingItems = getPendingItemsForAssignment(effectiveDetail.id);
  const assignmentConflicts = getConflictItemsForAssignment(effectiveDetail.id);
  const job = effectiveDetail.job;
  const address = formatAddress(job?.addressStreet, job?.addressZip, job?.addressCity);
  const timeEntry = effectiveDetail.timeEntry;
  const plannedWindow = formatPlannedWindow(effectiveDetail);
  const assignmentDateLabel = effectiveDetail.assignmentDate
    ? effectiveDetail.assignmentDate === toDateStr(new Date())
      ? "Heute"
      : formatDate(effectiveDetail.assignmentDate)
    : "Einsatz";

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-40">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1"
          onClick={handleBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurueck
        </Button>
        <ConnectionStatusBadge isOnline={isOnline} compact />
      </div>

      <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-sm">
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                {assignmentDateLabel}
              </p>
              <h1
                className="mt-2 text-2xl font-semibold leading-tight"
                data-testid="text-assignment-title"
              >
                {job?.title}
              </h1>
              <p className="mt-1 text-sm text-slate-300">{job?.customerName}</p>
            </div>
            <StatusBadge status={effectiveDetail.status} className="shrink-0" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] bg-white/10 p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                <CalendarDays className="h-3.5 w-3.5" />
                Zeitpunkt
              </div>
              <p className="mt-2 text-base font-semibold">{plannedWindow}</p>
            </div>
            <div className="rounded-[20px] bg-white/10 p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                <MapPin className="h-3.5 w-3.5" />
                Ort
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-100">
                {address || "Adresse fehlt noch"}
              </p>
            </div>
          </div>

          <p className="text-sm leading-6 text-slate-200">{getStatusSummary(effectiveDetail.status)}</p>
        </div>
      </Card>

      <OfflineQueueAlert assignmentId={effectiveDetail.id} />

      <Card className="p-4">
        <div className="mb-3">
          <h2 className="font-semibold">Schnellzugriff</h2>
          <p className="text-sm text-muted-foreground">
            Wegbeschreibung und Kontakt direkt vom Einsatz aus.
          </p>
        </div>
        {address || job?.contactPhone ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {address && (
              <a
                href={getNavigationUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
                data-testid="link-navigation"
              >
                <Button
                  variant="secondary"
                  className="h-14 w-full justify-start gap-2 text-base"
                  size="lg"
                >
                  <Navigation className="h-5 w-5" />
                  Navigation starten
                </Button>
              </a>
            )}

            {job?.contactPhone && (
              <a href={getPhoneUrl(job.contactPhone)} className="w-full" data-testid="link-phone">
                <Button
                  variant="secondary"
                  className="h-14 w-full justify-start gap-2 text-base"
                  size="lg"
                >
                  <Phone className="h-5 w-5" />
                  Ansprechpartner anrufen
                </Button>
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Fuer diesen Einsatz sind noch keine direkten Kontakt- oder Navigationsdaten hinterlegt.
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Einsatzdaten</h2>
        {address && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm">{address}</span>
          </div>
        )}
        {job?.contactName && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm">{job.contactName}</span>
          </div>
        )}
        {job?.description && (
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm">{job.description}</span>
          </div>
        )}
      </Card>

      {!isOnline && (
        <Card className="border-amber-300 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Offline</p>
              <p className="mt-1 text-sm">
                Statuswechsel und Problem-Meldungen werden lokal vorgemerkt und beim naechsten
                Online-Moment synchronisiert.
              </p>
            </div>
          </div>
        </Card>
      )}

      {timeEntry && (
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Clock className="h-4 w-4" />
            Zeiterfassung
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Start</p>
              <p className="font-mono font-medium" data-testid="text-time-start">
                {formatTime(timeEntry.startedAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ankunft</p>
              <p className="font-mono font-medium" data-testid="text-time-arrival">
                {formatTime(timeEntry.arrivedAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ende</p>
              <p className="font-mono font-medium" data-testid="text-time-end">
                {formatTime(timeEntry.endedAt)}
              </p>
            </div>
          </div>
          {timeEntry.totalMinutes != null && (
            <div className="mt-2 border-t pt-2 text-center">
              <p className="text-xs text-muted-foreground">Arbeitszeit</p>
              <p className="font-semibold" data-testid="text-duration">
                {formatDuration(timeEntry.totalMinutes)}
              </p>
            </div>
          )}
        </Card>
      )}

      {effectiveDetail.issues && effectiveDetail.issues.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Probleme ({effectiveDetail.issues.length})
          </h3>
          <div className="space-y-2">
            {effectiveDetail.issues.map((issue: any) => (
              <div
                key={issue.id}
                className="rounded-md bg-red-50 p-2 text-sm dark:bg-red-900/10"
              >
                <p className="font-medium">
                  {ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType}
                </p>
                {issue.note && (
                  <p className="mt-0.5 text-muted-foreground">{issue.note}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {effectiveDetail.note && (
        <Card className="p-4">
          <h3 className="mb-1 text-sm font-medium">Dispo-Notiz</h3>
          <p className="text-sm text-muted-foreground">{effectiveDetail.note}</p>
        </Card>
      )}

      <div className="safe-area-bottom fixed bottom-0 left-0 right-0 border-t bg-background/95 p-4 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          <div className="rounded-[24px] border bg-background p-3 shadow-lg">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Naechster Schritt
            </p>
            <ActionButtons
              status={effectiveDetail.status}
              onAction={handleAction}
              isLoading={isSyncing && pendingItems.length > 0}
              disabled={assignmentConflicts.length > 0}
            />
          </div>
        </div>
      </div>

      <ProblemDialog
        open={showProblemDialog}
        onClose={() => setShowProblemDialog(false)}
        onSubmit={handleProblemSubmit}
        isLoading={false}
      />
    </div>
  );
}
