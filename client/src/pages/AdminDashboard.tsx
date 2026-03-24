import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AssignmentCard } from "@/components/AssignmentCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  Plus,
} from "lucide-react";
import { QK } from "@/lib/queryKeys";

const statCards = [
  {
    key: "todayAssignmentCount",
    testId: "text-today-count",
    label: "Heute",
    helper: "Einsätze",
    icon: ClipboardList,
    iconTone: "bg-[#173d66]/8 text-[#173d66]",
  },
  {
    key: "todayInProgress",
    testId: "text-active-count",
    label: "Aktiv",
    helper: "laufend",
    icon: Clock,
    iconTone: "bg-[#68d5c8]/24 text-[#173d66]",
  },
  {
    key: "todayCompleted",
    testId: "text-completed-count",
    label: "Erledigt",
    helper: "heute",
    icon: CheckCircle,
    iconTone: "bg-emerald-100 text-emerald-700",
  },
] as const;

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<any>({
    queryKey: [QK.DASHBOARD],
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-40 rounded-[32px]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-[26px]" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-[32px]" />
      </div>
    );
  }

  const stats = data?.stats;
  const todayAssignments = data?.todayAssignments || [];
  const unassignedJobs = data?.unassignedJobs || [];
  const attentionAssignments = todayAssignments.filter((a: any) => a.status === "en_route");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <section className="brand-panel rounded-[34px] p-5 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-[#173d66]" data-testid="text-dashboard-title">
              Dashboard
            </h1>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="brand-highlight rounded-full px-4 py-2 text-sm font-medium">
                {stats?.todayAssignmentCount || 0} Einsätze für heute
              </span>
              <span className="brand-highlight rounded-full px-4 py-2 text-sm font-medium">
                {unassignedJobs.length} noch nicht disponiert
              </span>
              <span className="brand-highlight rounded-full px-4 py-2 text-sm font-medium">
                {stats?.todayCompleted || 0} heute abgeschlossen
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="h-12 rounded-2xl bg-[#173d66] px-5 text-base text-white hover:bg-[#123251]"
              onClick={() => navigate("/jobs/new")}
              data-testid="button-new-job"
            >
              <Plus className="mr-2 h-4 w-4" />
              Auftrag anlegen
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-2xl border-[#173d66]/12 bg-white/80 px-5 text-base text-[#173d66]"
              onClick={() => navigate("/")}
              data-testid="button-open-plan"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Planung öffnen
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.key} className="brand-soft-card rounded-[28px] p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.iconTone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="brand-kicker text-right">{stat.label}</p>
              </div>
              <p
                className="mt-5 text-3xl font-semibold tracking-tight text-[#173d66]"
                data-testid={stat.testId}
              >
                {stats?.[stat.key] || 0}
              </p>
              <p className="mt-1 text-sm text-[#173d66]/64">{stat.helper}</p>
            </Card>
          );
        })}
      </section>

      {attentionAssignments.length > 0 && (
        <section className="brand-panel rounded-[32px] p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="brand-kicker text-sky-700">Auf Anfahrt</p>
              <h2 className="mt-2 text-xl font-semibold text-[#173d66]">
                Mitarbeiter noch unterwegs
              </h2>
              <p className="mt-1 text-sm text-[#173d66]/72">
                Diese Einsätze sind gestartet, Mitarbeiter sind noch nicht vor Ort.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {attentionAssignments.map((assignment: any) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onClick={() => navigate(`/jobs/${assignment.jobId}`)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="brand-panel rounded-[32px] p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="brand-kicker">Heute im Betrieb</p>
              <h2 className="mt-2 text-xl font-semibold text-[#173d66]">Heutige Einsätze</h2>
              <p className="mt-1 text-sm text-[#173d66]/72">
                Alle disponierten Einsätze für den aktuellen Tag.
              </p>
            </div>
          </div>

          {todayAssignments.length === 0 ? (
            <Card className="brand-soft-card mt-5 rounded-[26px] p-8 text-center">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 text-[#173d66]/42" />
              <p className="font-medium text-[#173d66]/76">Keine Einsätze für heute geplant</p>
              <Button
                variant="outline"
                className="mt-4 rounded-2xl border-[#173d66]/12 bg-white/80 text-[#173d66]"
                onClick={() => navigate("/plan")}
                data-testid="button-go-plan-empty"
              >
                Einsatz planen
              </Button>
            </Card>
          ) : (
            <div className="mt-5 space-y-3">
              {todayAssignments.map((assignment: any) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onClick={() => navigate(`/jobs/${assignment.jobId}`)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="brand-panel rounded-[32px] p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="brand-kicker">Offene Disposition</p>
              <h2 className="mt-2 text-xl font-semibold text-[#173d66]">Nicht zugewiesen</h2>
            </div>
            <span className="brand-outline-chip rounded-full px-3 py-1 text-xs font-semibold">
              {unassignedJobs.length}
            </span>
          </div>

          {unassignedJobs.length === 0 ? (
            <Card className="brand-soft-card mt-5 rounded-[26px] p-6 text-center">
              <p className="font-medium text-[#173d66]/76">Aktuell ist kein Auftrag offen.</p>
              <p className="mt-1 text-sm text-[#173d66]/64">
                Neue oder verschobene Aufträge erscheinen hier automatisch.
              </p>
            </Card>
          ) : (
            <div className="mt-5 space-y-3">
              {unassignedJobs.map((job: any) => (
                <Card
                  key={job.id}
                  className="brand-soft-card cursor-pointer rounded-[24px] p-4"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  data-testid={`card-unassigned-${job.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#173d66]">{job.title}</p>
                      <p className="truncate text-sm text-[#173d66]/64">{job.customerName}</p>
                    </div>
                    <StatusBadge status={job.status} type="job" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
