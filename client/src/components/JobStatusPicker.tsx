import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JOB_STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import {
  getAllowedTransitions,
  isJobStatus,
  type JobStatus,
} from "@shared/jobStatusMachine";

interface JobStatusPickerProps {
  status: string;
  onChange: (next: JobStatus) => void;
  disabled?: boolean;
  className?: string;
}

export function JobStatusPicker({ status, onChange, disabled, className }: JobStatusPickerProps) {
  const transitions = isJobStatus(status) ? getAllowedTransitions(status) : [];
  const label = JOB_STATUS_LABELS[status] ?? status;
  const colorClass = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || transitions.length === 0}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-foreground/40",
            colorClass,
            !disabled && transitions.length > 0
              ? "cursor-pointer hover:ring-2 hover:ring-foreground/30"
              : "cursor-default opacity-90",
            className,
          )}
          data-testid="button-job-status"
        >
          <span>{label}</span>
          {!disabled && transitions.length > 0 && <ChevronDown className="h-3 w-3 opacity-70" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Status ändern zu</p>
        <div className="space-y-1">
          {transitions.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Endstatus – kein Wechsel möglich.
            </p>
          ) : (
            transitions.map((next) => (
              <Button
                key={next}
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => onChange(next)}
                data-testid={`button-status-to-${next}`}
              >
                <Badge variant="secondary" className={cn("mr-2 border-0", STATUS_COLORS[next])}>
                  {JOB_STATUS_LABELS[next] ?? next}
                </Badge>
              </Button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
