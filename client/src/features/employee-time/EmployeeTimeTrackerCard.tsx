import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Clock3,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { QueuedAssignmentAction } from "@/features/employee-offline/shared";
import { cn } from "@/lib/utils";
import {
  applyOptimisticTimeState,
  formatStopwatchParts,
  getTrackedDurationMs,
  getTrackerFacts,
  getTrackerHelperText,
  getTrackerStatusLabel,
  isLiveTrackingStatus,
  type BreakEntryLike,
  type TimeEntryLike,
  type TrackerStatus,
} from "./shared";

type TimerAction = {
  action: string;
  label: string;
  icon: LucideIcon;
  tone?: "accent" | "danger" | "neutral";
};

type EmployeeTimeTrackerCardProps = {
  status: TrackerStatus;
  timeEntry?: TimeEntryLike | null;
  breaks?: BreakEntryLike[];
  pendingItems?: QueuedAssignmentAction[];
  onAction: (action: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
};

function getAccentClasses(status: TrackerStatus) {
  switch (status) {
    case "planned":
      return {
        text: "text-slate-200",
        subtleText: "text-slate-400",
        ring: "from-slate-500/20 to-slate-500/5",
      };
    case "en_route":
      return {
        text: "text-sky-300",
        subtleText: "text-sky-100/70",
        ring: "from-sky-400/30 to-sky-400/5",
      };
    case "on_site":
      return {
        text: "text-emerald-300",
        subtleText: "text-emerald-100/70",
        ring: "from-emerald-400/30 to-emerald-400/5",
      };
    case "break":
      return {
        text: "text-amber-300",
        subtleText: "text-amber-100/70",
        ring: "from-amber-400/30 to-amber-400/5",
      };
    case "problem":
      return {
        text: "text-amber-200",
        subtleText: "text-amber-100/70",
        ring: "from-amber-400/30 to-amber-400/5",
      };
    case "completed":
      return {
        text: "text-white",
        subtleText: "text-slate-300",
        ring: "from-emerald-400/20 to-emerald-400/5",
      };
    default:
      return {
        text: "text-white",
        subtleText: "text-slate-300",
        ring: "from-slate-500/20 to-slate-500/5",
      };
  }
}

function getActionLayout(status: TrackerStatus) {
  switch (status) {
    case "planned":
      return {
        leftDecorativeIcon: Clock3,
        rightAction: { action: "start-work", label: "Start", icon: Play, tone: "accent" as const },
        secondaryActions: [] as TimerAction[],
      };
    case "en_route":
      return {
        leftDecorativeIcon: Clock3,
        rightAction: { action: "start-work", label: "Start", icon: Play, tone: "accent" as const },
        secondaryActions: [] as TimerAction[],
      };
    case "on_site":
      return {
        leftAction: { action: "start-break", label: "Pause", icon: Pause, tone: "neutral" as const },
        rightAction: { action: "complete", label: "Ende", icon: Square, tone: "accent" as const },
        secondaryActions: [] as TimerAction[],
      };
    case "break":
      return {
        leftAction: { action: "end-break", label: "Weiter", icon: Play, tone: "accent" as const },
        rightAction: undefined,
        secondaryActions: [] as TimerAction[],
      };
    case "problem":
      return {
        leftAction: { action: "resume", label: "Weiter", icon: Play, tone: "accent" as const },
        rightAction: { action: "complete", label: "Ende", icon: Square, tone: "neutral" as const },
        secondaryActions: [],
      };
    case "completed":
    default:
      return {
        leftDecorativeIcon: CheckCircle2,
        rightAction: undefined,
        secondaryActions: [] as TimerAction[],
      };
  }
}

function TimerControl({
  action,
  onAction,
  disabled,
}: {
  action?: TimerAction;
  onAction: (action: string) => void;
  disabled: boolean;
}) {
  if (!action) {
    return <div className="hidden w-[5.5rem] sm:block" aria-hidden="true" />;
  }

  const toneClass =
    action.tone === "danger"
      ? "bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
      : action.tone === "neutral"
        ? "bg-white/10 text-white hover:bg-white/15"
        : "bg-sky-400/20 text-sky-100 hover:bg-sky-400/30";

  return (
    <div className="flex w-[5.5rem] flex-col items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn("h-20 w-20 rounded-full border border-white/10 shadow-sm", toneClass)}
        onClick={() => onAction(action.action)}
        disabled={disabled}
        data-testid={`button-timer-${action.action}`}
      >
        <action.icon className="h-8 w-8" />
      </Button>
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
        {action.label}
      </span>
    </div>
  );
}

function TimerDecoration({
  icon: Icon,
  ringClassName,
}: {
  icon?: LucideIcon;
  ringClassName: string;
}) {
  if (!Icon) {
    return <div className="hidden w-[5.5rem] sm:block" aria-hidden="true" />;
  }

  return (
    <div className="flex w-[5.5rem] flex-col items-center gap-2">
      <div
        className={cn(
          "flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br",
          ringClassName,
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950/95">
          <Icon className="h-7 w-7 text-white" />
        </div>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
        Status
      </span>
    </div>
  );
}

export function EmployeeTimeTrackerCard({
  status,
  timeEntry,
  breaks = [],
  pendingItems = [],
  onAction,
  isLoading = false,
  disabled = false,
}: EmployeeTimeTrackerCardProps) {
  const [now, setNow] = useState(() => Date.now());
  const optimisticTimeState = applyOptimisticTimeState(timeEntry, breaks, pendingItems);
  const effectiveTimeEntry = optimisticTimeState.timeEntry;
  const effectiveBreaks = optimisticTimeState.breaks;
  const liveTimer = isLiveTrackingStatus(status) && !!effectiveTimeEntry?.startedAt && !effectiveTimeEntry?.endedAt;
  const trackedDurationMs = getTrackedDurationMs(effectiveTimeEntry, effectiveBreaks, now);
  const stopwatch = formatStopwatchParts(trackedDurationMs);
  const facts = getTrackerFacts(effectiveTimeEntry, effectiveBreaks, now);
  const helperText = getTrackerHelperText(status, effectiveTimeEntry, effectiveBreaks, now);
  const accent = getAccentClasses(status);
  const layout = getActionLayout(status);
  const controlsDisabled = isLoading || disabled;

  useEffect(() => {
    if (!liveTimer) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [liveTimer]);

  useEffect(() => {
    setNow(Date.now());
  }, [effectiveTimeEntry?.startedAt, effectiveTimeEntry?.endedAt, effectiveBreaks.length, status]);

  return (
    <Card className="overflow-hidden rounded-[30px] border-0 bg-slate-950 text-white shadow-2xl">
      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Zeiterfassung
          </p>
          {pendingItems.length > 0 ? (
            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-100">
              Wird uebertragen
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          {layout.leftAction ? (
            <TimerControl action={layout.leftAction} onAction={onAction} disabled={controlsDisabled} />
          ) : (
            <TimerDecoration icon={layout.leftDecorativeIcon} ringClassName={accent.ring} />
          )}

          <div className="min-w-0 flex-1 text-center">
            <div className={cn("font-semibold tabular-nums tracking-tight", accent.text)}>
              <span className="text-[3.75rem] leading-none sm:text-[4.5rem]">{stopwatch.main}</span>
              <span className="ml-1 align-top text-2xl sm:text-3xl">{stopwatch.seconds}</span>
            </div>
            <p className={cn("mt-2 text-lg font-medium", accent.text)}>{getTrackerStatusLabel(status)}</p>
            <p className={cn("mt-1 text-sm leading-5", accent.subtleText)}>{helperText}</p>
          </div>

          {layout.rightAction ? (
            <TimerControl action={layout.rightAction} onAction={onAction} disabled={controlsDisabled} />
          ) : (
            <TimerDecoration icon={layout.leftDecorativeIcon} ringClassName={accent.ring} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-white/10">
        {facts.map((item) => (
          <div key={item.label} className="bg-slate-950 px-3 py-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
            <p className="mt-1 font-medium tabular-nums text-slate-100">{item.value}</p>
          </div>
        ))}
      </div>

      {layout.secondaryActions.length > 0 ? (
        <div className="grid gap-2 border-t border-white/10 p-3">
          {layout.secondaryActions.map((action) => (
            <Button
              key={action.action}
              type="button"
              variant={action.tone === "danger" ? "destructive" : "secondary"}
              className="h-12 w-full gap-2 rounded-2xl text-base"
              onClick={() => onAction(action.action)}
              disabled={controlsDisabled}
              data-testid={`button-timer-secondary-${action.action}`}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
