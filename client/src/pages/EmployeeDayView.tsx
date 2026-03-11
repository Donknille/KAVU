import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignmentCard } from "@/components/AssignmentCard";
import { CalendarDays, ClipboardList, Sun } from "lucide-react";
import { useLocation } from "wouter";
import { formatDate, toDateStr } from "@/lib/constants";

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export default function EmployeeDayView() {
  const [, navigate] = useLocation();
  const today = toDateStr(new Date());
  const endDate = toDateStr(addDays(new Date(), 13));

  const { data: assignments, isLoading } = useQuery<any[]>({
    queryKey: [`/api/assignments/my?startDate=${today}&endDate=${endDate}`],
  });

  const activeAssignments = (assignments ?? []).filter(
    (assignment) =>
      assignment.status === "en_route" ||
      assignment.status === "on_site" ||
      assignment.status === "break"
  );
  const activeAssignmentIds = new Set(activeAssignments.map((assignment) => assignment.id));

  const todayAssignments = (assignments ?? []).filter(
    (assignment) => assignment.assignmentDate === today && !activeAssignmentIds.has(assignment.id)
  );
  const upcomingAssignments = (assignments ?? []).filter(
    (assignment) => assignment.assignmentDate > today && !activeAssignmentIds.has(assignment.id)
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-56" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Sun className="h-5 w-5 text-amber-500" />
        <div>
          <h1 className="text-xl font-bold" data-testid="text-today-title">
            Deine Einsaetze
          </h1>
          <p className="text-sm text-muted-foreground">
            Heute und die naechsten zwei Wochen.
          </p>
        </div>
      </div>

      {activeAssignments.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold">Aktive Einsaetze</h2>
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
          <h2 className="font-semibold">Heute</h2>
        </div>

        {todayAssignments.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="font-medium text-muted-foreground">Keine Einsaetze fuer heute</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sobald du heute eingeplant bist, erscheint der Einsatz hier.
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
