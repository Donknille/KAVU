import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionStatusBadge } from "@/components/ConnectionStatusBadge";
import { InstallAppCard } from "@/components/InstallAppCard";
import { AssignmentTeamPreview, TeamContactList, getAssignmentTeamNames } from "@/features/employee/AssignmentTeamPreview";
import {
  addDays,
  formatPlannedWindow,
  getFocusAssignment,
  getFocusLabel,
  getNextAssignment,
  splitEmployeeAssignments,
} from "@/features/employee/assignmentSchedule";
import { OfflineQueueAlert } from "@/features/employee-offline/OfflineQueueAlert";
import { useEmployeeOfflineQueue } from "@/features/employee-offline/EmployeeOfflineQueueProvider";
import { ArrowRight, Clock3, Users } from "lucide-react";
import { useLocation } from "wouter";
import { formatDate, toDateStr } from "@/lib/constants";

export default function EmployeeDayView() {
  const [, navigate] = useLocation();
  const { isOnline, applyOptimisticAssignmentState } = useEmployeeOfflineQueue();
  const today = toDateStr(new Date());
  const endDate = toDateStr(addDays(new Date(), 13));

  const { data: assignments, isLoading } = useQuery<any[]>({
    queryKey: [`/api/assignments/my?startDate=${today}&endDate=${endDate}`],
  });

  const effectiveAssignments = (assignments ?? []).map((assignment) =>
    applyOptimisticAssignmentState(assignment),
  );

  const { activeAssignments, todayAssignments, upcomingAssignments } = splitEmployeeAssignments(
    effectiveAssignments,
    today,
  );

  const focusAssignment = getFocusAssignment({
    activeAssignments,
    todayAssignments,
    upcomingAssignments,
  });
  const nextAssignment = getNextAssignment({
    activeAssignments,
    todayAssignments,
    upcomingAssignments,
  });
  const totalAssignments =
    activeAssignments.length + todayAssignments.length + upcomingAssignments.length;

  const focusLabel = getFocusLabel({
    activeAssignmentsCount: activeAssignments.length,
    todayAssignmentsCount: todayAssignments.length,
    upcomingAssignmentsCount: upcomingAssignments.length,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-56" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <section className="brand-panel overflow-hidden rounded-[30px]">
        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1
                className="text-2xl font-semibold tracking-tight brand-ink"
                data-testid="text-today-title"
              >
                Heute im Blick
              </h1>
            </div>
            <ConnectionStatusBadge isOnline={isOnline} compact className="brand-outline-chip" />
          </div>

          <p className="text-sm brand-ink-soft">
            {totalAssignments === 0
              ? "Heute frei"
              : activeAssignments.length + todayAssignments.length > 0
                ? `Heute: ${activeAssignments.length + todayAssignments.length} ${activeAssignments.length + todayAssignments.length === 1 ? "Einsatz" : "Einsaetze"}`
                : `Naechster Einsatz: ${formatDate(upcomingAssignments[0]?.assignmentDate)}`}
          </p>

          <div className="brand-navy-panel rounded-[26px] p-4">
            {focusAssignment ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200/90">
                      {focusLabel}
                    </p>
                    <p className="mt-1 truncate text-lg font-bold text-white">
                      {focusAssignment.job?.title || "Auftrag"}
                    </p>
                    <p className="truncate text-sm text-slate-200">
                      {focusAssignment.job?.customerName || "Kunde offen"}
                    </p>
                  </div>
                  <p className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200">
                    {focusAssignment.assignmentDate === today
                      ? "Heute"
                      : formatDate(focusAssignment.assignmentDate)}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200/90">
                    Zeitfenster
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-white">
                    <Clock3 className="h-4 w-4 text-white/80" />
                    <span>{formatPlannedWindow(focusAssignment)}</span>
                  </div>
                </div>
                <AssignmentTeamPreview
                  assignment={focusAssignment}
                  label="Mit wem"
                  inverse
                />

                {nextAssignment && (
                  <div className="rounded-2xl border border-white/12 bg-white/6 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      Danach
                    </p>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {nextAssignment.job?.title || "Nächster Auftrag"}
                        </p>
                        <p className="truncate text-xs text-slate-300">
                          {formatPlannedWindow(nextAssignment)} | {getAssignmentTeamNames(nextAssignment, 2)}
                        </p>
                      </div>
                      <p className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium text-slate-200">
                        {nextAssignment.assignmentDate === today
                          ? "Heute"
                          : formatDate(nextAssignment.assignmentDate)}
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  className="h-12 w-full justify-between rounded-2xl bg-white text-slate-950 hover:bg-slate-100"
                  onClick={() => navigate(`/assignment/${focusAssignment.id}`)}
                  data-testid={`button-open-focus-assignment-${focusAssignment.id}`}
                >
                  <span className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    Zeiterfassung & Details
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>

                {activeAssignments.length > 1 && (
                  <p className="text-xs text-slate-300">
                    Es ist noch {activeAssignments.length - 1} weiterer aktiver Einsatz vorhanden.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Für heute sind derzeit keine Einsätze eingeplant.</p>
                <p className="text-sm text-slate-300">
                  Neue Termine werden nach der Disposition hier angezeigt.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <InstallAppCard />
      <OfflineQueueAlert />

      {/* Team-Kontakte zum aktuellen Einsatz */}
      {focusAssignment && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#173d66]" />
            <h2 className="font-semibold text-[#173d66]">Dein Team</h2>
          </div>
          <TeamContactList assignment={focusAssignment} />
        </section>
      )}

      {/* Morgen-Vorschau */}
      {(() => {
        const tomorrow = toDateStr(addDays(new Date(), 1));
        const tomorrowAssignments = effectiveAssignments.filter((a: any) => a.assignmentDate === tomorrow);
        if (tomorrowAssignments.length === 0) return null;
        const first = tomorrowAssignments[0];
        return (
          <Card className="brand-soft-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] brand-ink-muted">Morgen</p>
                <p className="mt-1 text-sm font-semibold brand-ink truncate">
                  {first.job?.title || "Auftrag"}
                </p>
                <p className="text-xs brand-ink-soft truncate">
                  {first.job?.customerName}
                  {first.workers?.length > 1 && ` | Mit: ${getAssignmentTeamNames(first, 2)}`}
                </p>
              </div>
              <p className="shrink-0 text-xs brand-ink-muted">{formatDate(tomorrow)}</p>
            </div>
            {tomorrowAssignments.length > 1 && (
              <p className="mt-2 text-xs brand-ink-soft">+ {tomorrowAssignments.length - 1} weitere</p>
            )}
          </Card>
        );
      })()}

    </div>
  );
}
