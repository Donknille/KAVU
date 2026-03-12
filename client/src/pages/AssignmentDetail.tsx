import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionButtons } from "@/components/ActionButtons";
import { ProblemDialog } from "@/components/ProblemDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatTime, formatDuration, formatAddress, ISSUE_TYPE_LABELS } from "@/lib/constants";
import {
  ArrowLeft,
  MapPin,
  User,
  Phone,
  FileText,
  Clock,
  AlertTriangle,
} from "lucide-react";

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showProblemDialog, setShowProblemDialog] = useState(false);

  const { data: detail, isLoading } = useQuery<any>({
    queryKey: ["/api/assignments", id],
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, body }: { action: string; body?: any }) => {
      return apiRequest("POST", `/api/assignments/${id}/${action}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments", id] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/assignments/my");
        },
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAction = (action: string) => {
    if (action === "report-problem") {
      setShowProblemDialog(true);
      return;
    }
    actionMutation.mutate({ action });
  };

  const handleProblemSubmit = (issueType: string, note: string) => {
    actionMutation.mutate(
      { action: "report-problem", body: { issueType, note } },
      { onSuccess: () => setShowProblemDialog(false) }
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
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

  const job = detail.job;
  const address = formatAddress(job?.addressStreet, job?.addressZip, job?.addressCity);
  const timeEntry = detail.timeEntry;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-32">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 -ml-2"
        onClick={() => window.history.back()}
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück
      </Button>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-assignment-title">
            {job?.title}
          </h1>
          <p className="text-muted-foreground">{job?.customerName}</p>
        </div>
        <StatusBadge status={detail.status} />
      </div>

      <Card className="p-4 space-y-3">
        {address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <span className="text-sm">{address}</span>
          </div>
        )}
        {job?.contactName && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm">{job.contactName}</span>
          </div>
        )}
        {job?.contactPhone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
            <a
              href={`tel:${job.contactPhone}`}
              className="text-sm text-primary underline"
              data-testid="link-phone"
            >
              {job.contactPhone}
            </a>
          </div>
        )}
        {job?.description && (
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <span className="text-sm">{job.description}</span>
          </div>
        )}
      </Card>

      {timeEntry && (
        <Card className="p-4">
          <h3 className="font-medium text-sm mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
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
            <div className="mt-2 pt-2 border-t text-center">
              <p className="text-xs text-muted-foreground">Arbeitszeit</p>
              <p className="font-semibold" data-testid="text-duration">
                {formatDuration(timeEntry.totalMinutes)}
              </p>
            </div>
          )}
        </Card>
      )}

      {detail.issues && detail.issues.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium text-sm mb-2 flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            Probleme ({detail.issues.length})
          </h3>
          <div className="space-y-2">
            {detail.issues.map((issue: any) => (
              <div
                key={issue.id}
                className="text-sm p-2 rounded-md bg-red-50 dark:bg-red-900/10"
              >
                <p className="font-medium">
                  {ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType}
                </p>
                {issue.note && (
                  <p className="text-muted-foreground mt-0.5">{issue.note}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {detail.note && (
        <Card className="p-4">
          <h3 className="font-medium text-sm mb-1">Dispo-Notiz</h3>
          <p className="text-sm text-muted-foreground">{detail.note}</p>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          <ActionButtons
            status={detail.status}
            onAction={handleAction}
            isLoading={actionMutation.isPending}
            address={address}
            phone={job?.contactPhone}
          />
        </div>
      </div>

      <ProblemDialog
        open={showProblemDialog}
        onClose={() => setShowProblemDialog(false)}
        onSubmit={handleProblemSubmit}
        isLoading={actionMutation.isPending}
      />
    </div>
  );
}
