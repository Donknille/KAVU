import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { QK } from "@/lib/queryKeys";
import {
  formatTime,
  formatDuration,
  formatDate,
  formatAddress,
  JOB_CATEGORY_LABELS,
  getNavigationUrl,
} from "@/lib/constants";
import {
  ArrowLeft,
  MapPin,
  User,
  Users,
  Phone,
  FileText,
  Clock,
  CheckCircle,
  DollarSign,
  Navigation,
  Calendar,
} from "lucide-react";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: job, isLoading } = useQuery<any>({
    queryKey: [QK.JOBS, id],
  });

  const { data: timeEntries } = useQuery<any[]>({
    queryKey: ["/api/time-entries/job", id],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/jobs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QK.JOBS, id] });
      queryClient.invalidateQueries({ queryKey: [QK.DASHBOARD] });
      toast({ title: "Auftrag aktualisiert" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Auftrag nicht gefunden</p>
      </div>
    );
  }

  const address = formatAddress(job.addressStreet, job.addressZip, job.addressCity);

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 -ml-2"
        onClick={() => window.history.back()}
        data-testid="button-back-job"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück
      </Button>

      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-muted-foreground">{job.jobNumber}</span>
            {job.category && (
              <span className="text-xs text-muted-foreground">
                {JOB_CATEGORY_LABELS[job.category]}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold" data-testid="text-job-detail-title">
            {job.title}
          </h1>
          <p className="text-muted-foreground">{job.customerName}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={job.status} type="job" />
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => navigate("/")}
          >
            <Calendar className="w-3 h-3 mr-1" />
            Im Einsatzplan
          </Button>
        </div>
      </div>

      {(job.status === "completed" || job.status === "reviewed") && (
        <div className="flex gap-2">
          {job.status === "completed" && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={() => updateMutation.mutate({ status: "reviewed" })}
              data-testid="button-mark-reviewed"
            >
              <CheckCircle className="w-4 h-4" />
              Als geprüft markieren
            </Button>
          )}
          {job.status === "reviewed" && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={() => updateMutation.mutate({ status: "billable" })}
              data-testid="button-mark-billable"
            >
              <DollarSign className="w-4 h-4" />
              Abrechenbar
            </Button>
          )}
        </div>
      )}

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1" data-testid="tab-details">
            Details
          </TabsTrigger>
          <TabsTrigger value="times" className="flex-1" data-testid="tab-times">
            Zeiten
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-3 mt-3">
          <Card className="p-4 space-y-3">
            {address && (
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="text-sm">{address}</span>
                </div>
                <a
                  href={getNavigationUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="secondary" size="sm" className="gap-1 shrink-0">
                    <Navigation className="w-3.5 h-3.5" />
                    Nav
                  </Button>
                </a>
              </div>
            )}
            {job.contactName && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{job.contactName}</span>
              </div>
            )}
            {job.contactPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href={`tel:${job.contactPhone}`} className="text-sm text-primary underline">
                  {job.contactPhone}
                </a>
              </div>
            )}
            {job.description && (
              <p className="text-sm brand-ink-soft">{job.description}</p>
            )}
            {job.startDate && (
              <p className="text-sm brand-ink-soft">
                {formatDate(job.startDate)}
                {job.endDate && ` - ${formatDate(job.endDate)}`}
              </p>
            )}
          </Card>

          {job.teamMembers && job.teamMembers.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium text-sm mb-2 text-muted-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Team ({job.teamMembers.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {job.teamMembers.map((member: any) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 bg-muted rounded-full px-3 py-1"
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: member.color || "#6b7280" }}
                    >
                      {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                    </div>
                    <span className="text-sm">{member.firstName} {member.lastName}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {job.internalNote && (
            <Card className="p-4">
              <h3 className="font-medium text-sm mb-1 text-muted-foreground">Interne Notiz</h3>
              <p className="text-sm">{job.internalNote}</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="times" className="mt-3">
          {!timeEntries || timeEntries.length === 0 ? (
            <Card className="p-6 text-center">
              <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Noch keine Zeiten erfasst</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {timeEntries.map((entry: any) => (
                <Card key={entry.id} className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {entry.employee?.firstName} {entry.employee?.lastName}
                    </span>
                    <StatusBadge status={entry.status} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                    <div>
                      <p>Start</p>
                      <p className="font-mono text-foreground">{formatTime(entry.startedAt)}</p>
                    </div>
                    <div>
                      <p>Ankunft</p>
                      <p className="font-mono text-foreground">{formatTime(entry.arrivedAt)}</p>
                    </div>
                    <div>
                      <p>Ende</p>
                      <p className="font-mono text-foreground">{formatTime(entry.endedAt)}</p>
                    </div>
                    <div>
                      <p>Dauer</p>
                      <p className="font-mono text-foreground font-semibold">
                        {formatDuration(entry.totalMinutes)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
