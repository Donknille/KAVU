import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignmentCard } from "@/components/AssignmentCard";
import { ConnectionStatusBadge } from "@/components/ConnectionStatusBadge";
import { InstallAppCard } from "@/components/InstallAppCard";
import { OfflineQueueAlert } from "@/features/employee-offline/OfflineQueueAlert";
import { useEmployeeOfflineQueue } from "@/features/employee-offline/EmployeeOfflineQueueProvider";
import { ArrowRight, CalendarDays, ClipboardList, Clock3, Sun } from "lucide-react";
import { useLocation } from "wouter";
import { formatDate, toDateStr } from "@/lib/constants";

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function compareAssignments(a: any, b: any) {
  const dateCompare = (a.assignmentDate ?? "").localeCompare(b.assignmentDate ?? "");
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return (a.plannedStartTime ?? "99:99").localeCompare(b.plannedStartTime ?? "99:99");
}

function formatPlannedWindow(assignment: any) {
  const start = assignment.plannedStartTime?.slice(0, 5);
  const end = assignment.plannedEndTime?.slice(0, 5);

  if (!start) {
    return "Ohne Uhrzeit";
  }

  return end ? `${start} - ${end}` : start;
}

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

  const activeAssignments = effectiveAssignments
    .filter(
      (assignment) =>
        assignment.status === "en_route" ||
        assignment.status === "on_site" ||
        assignment.status === "break",
    )
    .sort(compareAssignments);

  const activeAssignmentIds = new Set(activeAssignments.map((assignment) => assignment.id));

  const todayAssignments = effectiveAssignments
    .filter(
      (assignment) =>
        assignment.assignmentDate === today && !activeAssignmentIds.has(assignment.id),
    )
    .sort(compareAssignments);

  const upcomingAssignments = effectiveAssignments
    .filter(
      (assignment) =>
        assignment.assignmentDate > today && !activeAssignmentIds.has(assignment.id),
    )
    .sort(compareAssignments);

  const focusAssignment = activeAssignments[0] ?? todayAssignments[0] ?? upcomingAssignments[0];
  const totalAssignments =
    activeAssignments.length + todayAssignments.length + upcomingAssignments.length;

  const focusLabel =
    activeAssignments.length > 0
      ? "Aktiv jetzt"
      : todayAssignments.length > 0
        ? "Naechster Einsatz heute"
        : upcomingAssignments.length > 0
          ? "Naechster geplanter Einsatz"
          : "Heute im Blick";

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-56" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <section className="overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-sm">
        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-amber-400" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                  Mitarbeiteransicht
                </p>
              </div>
              <h1
                className="mt-3 text-2xl font-semibold tracking-tight"
                data-testid="text-today-title"
              >
                Heute im Blick
              </h1>
              <p className="mt-1 max-w-md text-sm text-slate-300">
                Aktiver Einsatz, naechster Termin und dein Tagesplan ohne Suchen.
              </p>
            </div>
            <ConnectionStatusBadge
              isOnline={isOnline}
              compact
              className="border-white/15 bg-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Aktiv</p>
              <p className="mt-1 text-2xl font-semibold">{activeAssignments.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Heute</p>
              <p className="mt-1 text-2xl font-semibold">{todayAssignments.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Geplant</p>
              <p className="mt-1 text-2xl font-semibold">{upcomingAssignments.length}</p>
            </div>
          </div>

          <div className="rounded-[24px] bg-white/10 p-4">
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

                <div className="flex items-center gap-2 text-sm text-slate-200">
                  <Clock3 className="h-4 w-4" />
                  <span>{formatPlannedWindow(focusAssignment)}</span>
                </div>

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
                    Noch {activeAssignments.length - 1} weiterer aktiver Einsatz verfuegbar.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Heute sind noch keine Einsaetze eingeplant.</p>
                <p className="text-sm text-slate-300">
                  Neue Zuordnungen erscheinen hier automatisch, sobald die Disposition plant.
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
            <Sun className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold">Jetzt dran</h2>
          </div>
          <div className="space-y-3">
            {activeAssignments.map((assignment) => (
              <Card
                key={assignment.id}
                className="cursor-pointer p-4 ring-2 ring-primary"
                onClick={() => navigate(`/assignment/${assignment.id}`)}
                data-testid={`card-active-assignment-${assignment.id}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-primary">AKTIVER EINSATZ</p>
                  {assignment.assignmentDate !== today && (
                    <p className="text-[11px] text-muted-foreground">
                      Geplant fuer {formatDate(assignment.assignmentDate)}
                    </p>
                  )}
                </div>
                <AssignmentCard assignment={assignment} compact />
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold">
            {activeAssignments.length > 0 ? "Weitere Einsaetze heute" : "Heute"}
          </h2>
        </div>

        {todayAssignments.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="font-medium text-muted-foreground">
              {totalAssignments === 0 ? "Keine Einsaetze fuer heute" : "Heute ist nichts Weiteres offen"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalAssignments === 0
                ? "Sobald du heute eingeplant bist, erscheint der Einsatz hier."
                : "Dein weiterer Tagesplan bleibt hier sichtbar, sobald neue Termine dazukommen."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {todayAssignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onClick={() => navigate(`/assignment/${assignment.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold">Kommende Einsaetze</h2>
        </div>

        {upcomingAssignments.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="font-medium text-muted-foreground">Keine weiteren Planungen</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Zukuenftige Zuordnungen erscheinen automatisch in dieser Liste.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingAssignments.map((assignment) => (
              <div key={assignment.id} className="space-y-1">
                <p className="px-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {formatDate(assignment.assignmentDate)}
                </p>
                <AssignmentCard
                  assignment={assignment}
                  onClick={() => navigate(`/assignment/${assignment.id}`)}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
