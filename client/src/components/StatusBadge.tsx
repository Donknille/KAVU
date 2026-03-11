import { Badge } from "@/components/ui/badge";
import {
  STATUS_COLORS,
  ASSIGNMENT_STATUS_LABELS,
  JOB_STATUS_LABELS,
} from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
  type?: "assignment" | "job";
  className?: string;
}

export function StatusBadge({ status, type = "assignment", className = "" }: StatusBadgeProps) {
  const labels = type === "job" ? JOB_STATUS_LABELS : ASSIGNMENT_STATUS_LABELS;
  const label = labels[status] || status;
  const colorClass = STATUS_COLORS[status] || "bg-muted text-muted-foreground";

  return (
    <Badge
      variant="secondary"
      className={`${colorClass} border-0 font-medium text-xs ${className}`}
      data-testid={`badge-status-${status}`}
    >
      {status === "problem" && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />
      )}
      {label}
    </Badge>
  );
}
