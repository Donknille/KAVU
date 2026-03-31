import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignmentCard } from "@/components/AssignmentCard";
import { useEmployeeOfflineQueue } from "@/features/employee-offline/EmployeeOfflineQueueProvider";
import { addDays } from "@/features/employee/assignmentSchedule";
import { getAssignmentTeamNames, getAssignmentWorkers } from "@/features/employee/AssignmentTeamPreview";
import { CalendarDays } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { toDateStr } from "@/lib/constants";

function formatDayHeader(dateStr: string, today: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const dayDiff = Math.round(
    (date.getTime() - new Date(`${today}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24),
  );

  const formatted = date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (dayDiff === 0) return `Heute — ${formatted}`;
  if (dayDiff === 1) return `Morgen — ${formatted}`;
  return formatted;
}

export default function EmployeeSchedulePage() {
  const [, navigate] = useLocation();
  const { applyOptimisticAssignmentState } = useEmployeeOfflineQueue();
  const today = toDateStr(new Date());
  const endDate = toDateStr(addDays(new Date(), 13));

  const { data: assignments, isLoading } = useQuery<any[]>({
    queryKey: [`/api/assignments/my?startDate=${today}&endDate=${endDate}`],
  });

  const effectiveAssignments = (assignments ?? []).map((a) =>
    applyOptimisticAssignmentState(a),
  );

  const days = useMemo(() => {
    const result: string[] = [];
    const cursor = new Date(`${today}T12:00:00`);
    for (let i = 0; i < 14; i++) {
      result.push(toDateStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [today]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const day of days) {
      groups.set(
        day,
        effectiveAssignments
          .filter((a) => a.assignmentDate === day)
          .sort((a: any, b: any) => {
            if (a.plannedStartTime && b.plannedStartTime) {
              return a.plannedStartTime.localeCompare(b.plannedStartTime);
            }
            return 0;
          }),
      );
    }
    return groups;
  }, [effectiveAssignments, days]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  const totalAssignments = effectiveAssignments.length;

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-[#173d66]" />
        <h1 className="text-lg font-bold text-[#173d66]">Meine Einsätze</h1>
        <span className="text-sm text-muted-foreground">
          ({totalAssignments} in 14 Tagen)
        </span>
      </div>

      {/* Mini-Kalender: 2 Wochen Übersicht */}
      <div className="grid grid-cols-7 gap-1">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((wd) => (
          <div key={wd} className="text-center text-[10px] font-semibold uppercase tracking-wider brand-ink-muted">
            {wd}
          </div>
        ))}
        {days.map((day) => {
          const dayDate = new Date(`${day}T12:00:00`);
          const dayOfWeek = dayDate.getDay(); // 0=Sun
          const dayNum = dayDate.getDate();
          const hasAssignment = groupedByDate.get(day)?.length ?? 0 > 0;
          const isSunday = dayOfWeek === 0;
          const isToday = day === today;
          return (
            <div
              key={day}
              className={cn(
                "flex h-8 items-center justify-center rounded-lg text-xs font-medium",
                isToday && "ring-2 ring-[#68d5c8]",
                hasAssignment && !isSunday && "bg-[#173d66] text-white",
                !hasAssignment && !isSunday && "brand-ink-soft",
                isSunday && "text-muted-foreground/40",
              )}
            >
              {dayNum}
            </div>
          );
        })}
      </div>

      {totalAssignments === 0 ? (
        <Card className="brand-soft-card rounded-[26px] p-8 text-center">
          <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium text-[#173d66]/76">Keine Einsätze geplant</p>
          <p className="mt-1 text-sm text-[#173d66]/64">
            Geplante Einsätze der nächsten 14 Tage erscheinen hier.
          </p>
        </Card>
      ) : (
        [...groupedByDate].map(([date, dayAssignments]) => (
          <section key={date} className="space-y-2">
            <h2 className="text-sm font-semibold text-[#173d66]/70 flex items-center gap-2">
              <span>{formatDayHeader(date, today)}</span>
              {dayAssignments.length > 0 && (
                <span className="rounded-full bg-[#173d66]/10 px-2 py-0.5 text-[10px] font-bold">
                  {dayAssignments.length}
                </span>
              )}
            </h2>

            {dayAssignments.length === 0 ? (
              <p className="pl-1 text-xs text-muted-foreground italic">Frei</p>
            ) : (
              <div className="space-y-2">
                {dayAssignments.map((assignment: any) => {
                  const workers = getAssignmentWorkers(assignment);
                  return (
                    <div key={assignment.id}>
                      <AssignmentCard
                        assignment={assignment}
                        compact
                        onClick={() => navigate(`/assignment/${assignment.id}`)}
                      />
                      {workers.length > 1 && (
                        <p className="mt-1 pl-1 text-[11px] brand-ink-soft">
                          Mit: {getAssignmentTeamNames(assignment, 3)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
