import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignmentCard } from "@/components/AssignmentCard";
import { ConnectionStatusBadge } from "@/components/ConnectionStatusBadge";
import { InstallAppCard } from "@/components/InstallAppCard";
import { AssignmentTeamPreview, getAssignmentTeamNames } from "@/features/employee/AssignmentTeamPreview";
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
import { ArrowRight, CalendarDays, ClipboardList, Clock3, Sun } from "lucide-react";
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
              <BrandMark
                showWordmark
                subtitle="Mitarbeiteransicht"
                size={40}
                labelClassName="text-lg"
                subtitleClassName="text-[10px]"
              />
              <h1
                className="mt-4 text-2xl font-semibold tracking-tight brand-ink"
                data-testid="text-today-title"
              >
                Heute im Blick
              </h1>
              <p className="mt-1 max-w-md text-sm brand-ink-soft">
                Sehen Sie sofort, was jetzt ansteht, was danach folgt und mit wem der nächste Einsatz umgesetzt wird.
              </p>
            </div>
            <ConnectionStatusBadge isOnline={isOnline} compact className="brand-outline-chip" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="brand-soft-card rounded-2xl p-3">
              <p className="brand-kicker">Aktiv</p>
              <p className="mt-1 text-2xl font-semibold brand-ink">{activeAssignments.length}</p>
            </div>
            <div className="brand-soft-card rounded-2xl p-3">
              <p className="brand-kicker">Danach</p>
              <p className="mt-1 text-2xl font-semibold brand-ink">{todayAssignments.length}</p>
            </div>
            <div className="brand-soft-card rounded-2xl p-3">
              <p className="brand-kicker">Später</p>
              <p className="mt-1 text-2xl font-semibold brand-ink">{upcomingAssignments.length}</p>
            </div>
          </div>

          <div className="brand-navy-panel rounded-[26px] p-4">
            {focusAssignment ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {focusLabel}
                    </p>
                    <p className="mt-1 truncate text-lg font-semibold">
                      {focusAssignment.job?.title || "Auftrag"}
                    </p>
                    <p className="truncate text-sm text-slate-300">
                      {focusAssignment.job?.customerName || "Kunde offen"}
                    </p>
                  </div>
                  <p className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200">
                    {focusAssignment.assignmentDate === today
                      ? "Heute"
                      : formatDate(focusAssignment.assignmentDate)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      Zeitfenster
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-100">
                      <Clock3 className="h-4 w-4" />
                      <span>{formatPlannedWindow(focusAssignment)}</span>
                    </div>
                  </div>
                  <AssignmentTeamPreview
                    assignment={focusAssignment}
                    label="Mit wem"
                    inverse
                  />
                </div>

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
                  Zum Einsatz
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
                <p className="text-sm font-medium">Fuer heute sind derzeit keine Einsätze eingeplant.</p>
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

      {activeAssignments.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-[#173d66]" />
            <h2 className="font-semibold text-[#173d66]">Jetzt dran</h2>
          </div>
          <div className="space-y-3">
            {activeAssignments.map((assignment) => (
              <Card
                key={assignment.id}
                className="brand-panel cursor-pointer rounded-[26px] p-4 ring-2 ring-[#68d5c8]/50"
                onClick={() => navigate(`/assignment/${assignment.id}`)}
                data-testid={`card-active-assignment-${assignment.id}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="brand-kicker text-[#173d66]">Aktiver Einsatz</p>
                  {assignment.assignmentDate !== today && (
                    <p className="text-[11px] text-[#173d66]/64">
                      Geplant für {formatDate(assignment.assignmentDate)}
                    </p>
                  )}
                </div>
                <AssignmentCard assignment={assignment} compact emphasizeTeam />
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#173d66]" />
          <h2 className="font-semibold text-[#173d66]">
            {activeAssignments.length > 0 ? "Danach heute" : "Als Nächstes heute"}
          </h2>
        </div>

        {todayAssignments.length === 0 ? (
          <Card className="brand-soft-card rounded-[26px] p-6 text-center">
            <p className="font-medium text-[#173d66]/76">
              {totalAssignments === 0 ? "Keine Einsätze für heute" : "Heute ist nichts Weiteres offen"}
            </p>
            <p className="mt-1 text-sm text-[#173d66]/64">
              {totalAssignments === 0
                ? "Sobald ein Einsatz für heute disponiert ist, wird er hier angezeigt."
                : "Weitere Einsätze für den heutigen Tag werden hier fortlaufend ergänzt."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {todayAssignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                emphasizeTeam
                onClick={() => navigate(`/assignment/${assignment.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {upcomingAssignments.length > 0 && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => navigate("/assignments")}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {upcomingAssignments.length} weitere Einsätze anzeigen
          </Button>
        </div>
      )}
    </div>
  );
}
