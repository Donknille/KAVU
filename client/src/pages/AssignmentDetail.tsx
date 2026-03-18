import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { ConnectionStatusBadge } from "@/components/ConnectionStatusBadge";
import { EmployeeTimeTrackerCard } from "@/features/employee-time/EmployeeTimeTrackerCard";
import { AssignmentTeamPreview, getAssignmentTeamNames } from "@/features/employee/AssignmentTeamPreview";
import {
  addDays,
  formatPlannedWindow,
  getNextAssignmentAfterCurrent,
} from "@/features/employee/assignmentSchedule";
import { OfflineQueueAlert } from "@/features/employee-offline/OfflineQueueAlert";
import { useEmployeeOfflineQueue } from "@/features/employee-offline/EmployeeOfflineQueueProvider";
import { type AssignmentAction } from "@/features/employee-offline/shared";
import { useToast } from "@/hooks/use-toast";
import {
  formatAddress,
  formatDate,
  getNavigationUrl,
  getPhoneUrl,
  ISSUE_TYPE_LABELS,
  toDateStr,
} from "@/lib/constants";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FileText,
  MapPin,
  Navigation,
  Phone,
  User,
} from "lucide-react";

function getStatusSummary(status: string) {
  switch (status) {
    case "planned":
      return "Der Einsatz ist geplant. Starten Sie die Zeiterfassung bei Arbeitsbeginn.";
    case "en_route":
      return "Bitte bestätigen Sie den Arbeitsbeginn für diesen Einsatz.";
    case "on_site":
      return "Die Arbeitszeit für diesen Einsatz läuft.";
    case "break":
      return "Der Einsatz ist derzeit pausiert.";
    case "problem":
      return "Der Einsatz ist unterbrochen. Bitte kurz mit dem Büro abstimmen.";
    case "completed":
      return "Dieser Einsatz ist abgeschlossen.";
    default:
      return "Alle relevanten Einsatzinformationen sind hier gebuendelt.";
  }
}

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const {
    isOnline,
    isSyncing,
    queueAction,
    applyOptimisticAssignmentState,
    getPendingItemsForAssignment,
    getConflictItemsForAssignment,
  } = useEmployeeOfflineQueue();
  const today = toDateStr(new Date());
  const endDate = toDateStr(addDays(new Date(), 13));

  const { data: detail, isLoading } = useQuery<any>({
    queryKey: ["/api/assignments", id],
  });
  const { data: assignmentList = [] } = useQuery<any[]>({
    queryKey: [`/api/assignments/my?startDate=${today}&endDate=${endDate}`],
    enabled: !!id,
  });

  const effectiveDetail = detail ? applyOptimisticAssignmentState(detail) : null;
  const effectiveAssignments = assignmentList.map((assignment) =>
    applyOptimisticAssignmentState(assignment),
  );

  async function runAction(action: AssignmentAction) {
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
  const nextAssignment = getNextAssignmentAfterCurrent(
    effectiveAssignments.filter((assignment) => (assignment.assignmentDate ?? "") >= today),
    effectiveDetail.id,
  );
  const assignmentDateLabel = effectiveDetail.assignmentDate
    ? effectiveDetail.assignmentDate === today
      ? "Heute"
      : formatDate(effectiveDetail.assignmentDate)
    : "Einsatz";

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 pb-72 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1"
          onClick={handleBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        <ConnectionStatusBadge isOnline={isOnline} compact className="brand-outline-chip" />
      </div>

      <Card className="brand-panel overflow-hidden rounded-[30px]">
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <BrandMark size={36} />
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] brand-ink-muted">
                {assignmentDateLabel}
              </p>
              <h1
                className="mt-2 text-2xl font-semibold leading-tight brand-ink"
                data-testid="text-assignment-title"
              >
                {job?.title}
              </h1>
              <p className="mt-1 text-sm brand-ink-soft">{job?.customerName}</p>
            </div>
            <StatusBadge status={effectiveDetail.status} className="shrink-0" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="brand-soft-card rounded-[20px] p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] brand-ink-muted">
                <CalendarDays className="h-3.5 w-3.5 brand-ink" />
                Zeitpunkt
              </div>
              <p className="mt-2 text-base font-semibold brand-ink">{plannedWindow}</p>
            </div>
            <div className="brand-soft-card rounded-[20px] p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] brand-ink-muted">
                <MapPin className="h-3.5 w-3.5 brand-ink" />
                Ort
              </div>
              <p className="mt-2 text-sm leading-5 brand-ink">
                {address || "Adresse fehlt noch"}
              </p>
            </div>
          </div>

          <p className="text-sm leading-6 brand-ink-soft">{getStatusSummary(effectiveDetail.status)}</p>
        </div>
      </Card>

      <OfflineQueueAlert assignmentId={effectiveDetail.id} />

      <Card className="brand-panel rounded-[28px] p-4">
        <div className="mb-3">
          <p className="brand-kicker">Team</p>
          <h2 className="mt-2 font-semibold brand-ink">Heute auf diesem Einsatz</h2>
          <p className="text-sm brand-ink-soft">
            Sehen Sie direkt, mit wem dieser Auftrag umgesetzt wird und was danach als Nächstes ansteht.
          </p>
        </div>

        <AssignmentTeamPreview assignment={effectiveDetail} label="Mit wem" />

        {nextAssignment && (
          <button
            type="button"
            className="brand-soft-card mt-3 flex w-full items-center justify-between rounded-[22px] px-4 py-3 text-left transition hover:border-[color:var(--brand-highlight-border)]"
            onClick={() => navigate(`/assignment/${nextAssignment.id}`)}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] brand-ink-muted">
                Danach
              </p>
              <p className="mt-1 truncate text-sm font-semibold brand-ink">
                {nextAssignment.job?.title || "Nächster Einsatz"}
              </p>
              <p className="truncate text-xs brand-ink-soft">
                {formatPlannedWindow(nextAssignment)} | {getAssignmentTeamNames(nextAssignment, 2)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="shrink-0 rounded-full bg-[var(--brand-chip-bg)] px-2 py-1 text-[10px] font-medium brand-ink">
                {nextAssignment.assignmentDate === today
                  ? "Heute"
                  : formatDate(nextAssignment.assignmentDate)}
              </p>
              <ArrowRight className="h-4 w-4 brand-ink" />
            </div>
          </button>
        )}
      </Card>

      <Card className="brand-panel rounded-[28px] p-4">
        <div className="mb-3">
          <p className="brand-kicker">Vor Ort</p>
          <h2 className="mt-2 font-semibold brand-ink">Kontakt und Navigation</h2>
          <p className="text-sm brand-ink-soft">
            Ansprechpartner und Wegbeschreibung für diesen Einsatz.
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
                  className="brand-outline-control h-14 w-full justify-start gap-2 rounded-2xl text-base shadow-sm"
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
                  className="brand-outline-control h-14 w-full justify-start gap-2 rounded-2xl text-base shadow-sm"
                  size="lg"
                >
                  <Phone className="h-5 w-5" />
                  Ansprechpartner anrufen
                </Button>
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm brand-ink-soft">
            Fuer diesen Einsatz sind derzeit keine Kontakt- oder Navigationsdaten hinterlegt.
          </p>
        )}
      </Card>

      <Card className="brand-panel space-y-3 rounded-[28px] p-4">
        <div>
          <p className="brand-kicker">Details</p>
          <h2 className="mt-2 font-semibold brand-ink">Einsatzdaten</h2>
        </div>
        {address && (
          <div className="flex items-start gap-2 brand-ink-soft">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 brand-ink-muted" />
            <span className="text-sm">{address}</span>
          </div>
        )}
        {job?.contactName && (
          <div className="flex items-center gap-2 brand-ink-soft">
            <User className="h-4 w-4 shrink-0 brand-ink-muted" />
            <span className="text-sm">{job.contactName}</span>
          </div>
        )}
        {job?.description && (
          <div className="flex items-start gap-2 brand-ink-soft">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 brand-ink-muted" />
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
                Statusänderungen und Problem-Meldungen werden gespeichert und automatisch
                synchronisiert, sobald wieder eine Verbindung besteht.
              </p>
            </div>
          </div>
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
        <Card className="brand-panel rounded-[28px] p-4">
          <h3 className="mb-1 text-sm font-medium">Dispo-Notiz</h3>
          <p className="text-sm brand-ink-soft">{effectiveDetail.note}</p>
        </Card>
      )}

      {effectiveDetail.status === "completed" ? (
        <EmployeeTimeTrackerCard
          status={effectiveDetail.status}
          timeEntry={timeEntry}
          breaks={effectiveDetail.breaks ?? []}
          pendingItems={pendingItems}
          onAction={handleAction}
          isLoading={isSyncing && pendingItems.length > 0}
          disabled={assignmentConflicts.length > 0}
        />
      ) : (
        <div className="safe-area-bottom fixed bottom-0 left-0 right-0 border-t border-[color:var(--brand-panel-border)] bg-[var(--brand-header-bg)] p-4 backdrop-blur-xl">
          <div className="mx-auto max-w-xl">
            <EmployeeTimeTrackerCard
              status={effectiveDetail.status}
              timeEntry={timeEntry}
              breaks={effectiveDetail.breaks ?? []}
              pendingItems={pendingItems}
              onAction={handleAction}
              isLoading={isSyncing && pendingItems.length > 0}
              disabled={assignmentConflicts.length > 0}
            />
          </div>
        </div>
      )}

    </div>
  );
}
