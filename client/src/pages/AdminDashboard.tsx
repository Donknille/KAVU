import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignmentCard } from "@/components/AssignmentCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ClipboardList,
  AlertTriangle,
  Clock,
  CheckCircle,
  Plus,
  Calendar,
} from "lucide-react";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const stats = data?.stats;
  const todayAssignments = data?.todayAssignments || [];
  const unassignedJobs = data?.unassignedJobs || [];

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => navigate("/jobs/new")}
            data-testid="button-new-job"
          >
            <Plus className="w-4 h-4 mr-1" />
            Auftrag
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/")}
            data-testid="button-open-plan"
          >
            <Calendar className="w-4 h-4 mr-1" />
            Plan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Heute</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-today-count">
            {stats?.todayAssignmentCount || 0}
          </p>
          <p className="text-xs text-muted-foreground">Einsätze</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Aktiv</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-active-count">
            {stats?.todayInProgress || 0}
          </p>
          <p className="text-xs text-muted-foreground">laufend</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-muted-foreground">Probleme</span>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-problem-count">
            {stats?.problemCount || 0}
          </p>
          <p className="text-xs text-muted-foreground">offen</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-muted-foreground">Erledigt</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-completed-count">
            {stats?.todayCompleted || 0}
          </p>
          <p className="text-xs text-muted-foreground">heute</p>
        </Card>
      </div>

      {(stats?.problemCount || 0) > 0 && (
        <Card className="p-4 ring-2 ring-red-400 dark:ring-red-600">
          <h2 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Probleme erfordern Aufmerksamkeit
          </h2>
          <div className="space-y-2">
            {todayAssignments
              .filter((a: any) => a.status === "problem")
              .map((a: any) => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  onClick={() => navigate(`/jobs/${a.jobId}`)}
                  compact
                />
              ))}
          </div>
        </Card>
      )}

      <div>
        <h2 className="font-semibold text-lg mb-3">Heutige Einsätze</h2>
        {todayAssignments.length === 0 ? (
          <Card className="p-8 text-center">
            <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Keine Einsätze für heute geplant</p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => navigate("/plan")}
              data-testid="button-go-plan-empty"
            >
              Einsatz planen
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayAssignments.map((a: any) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                onClick={() => navigate(`/jobs/${a.jobId}`)}
              />
            ))}
          </div>
        )}
      </div>

      {unassignedJobs.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            Nicht zugewiesen
            <span className="text-sm font-normal text-muted-foreground">
              ({unassignedJobs.length})
            </span>
          </h2>
          <div className="space-y-2">
            {unassignedJobs.map((job: any) => (
              <Card
                key={job.id}
                className="p-3 cursor-pointer hover-elevate"
                onClick={() => navigate(`/jobs/${job.id}`)}
                data-testid={`card-unassigned-${job.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.customerName}</p>
                  </div>
                  <StatusBadge status={job.status} type="job" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
