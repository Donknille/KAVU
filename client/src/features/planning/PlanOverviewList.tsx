import { useMemo } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanningBlock } from "./types";
import { parseDateString, toDateStr } from "./utils";

type Props = {
  blocks: PlanningBlock[];
  day: string;
  onPrevDay: () => void;
  onNextDay: () => void;
};

const STATUS_ORDER: Record<string, number> = {
  on_site: 0,
  en_route: 1,
  break: 2,
  planned: 3,
  completed: 4,
};

function EmployeeAvatars({ employees }: { employees: { id: string; firstName: string; lastName: string; color?: string | null }[] }) {
  if (employees.length === 0) {
    return <span className="text-xs text-muted-foreground">Niemand eingeteilt</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {employees.slice(0, 4).map((emp) => (
        <div
          key={emp.id}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: emp.color ?? "#173d66" }}
          title={`${emp.firstName} ${emp.lastName}`}
        >
          {emp.firstName[0]}{emp.lastName[0]}
        </div>
      ))}
      {employees.length > 4 && (
        <span className="text-xs text-muted-foreground">+{employees.length - 4}</span>
      )}
    </div>
  );
}

export function PlanOverviewList({ blocks, day, onPrevDay, onNextDay }: Props) {
  const [, navigate] = useLocation();

  const date = parseDateString(day);
  const isToday = day === toDateStr(new Date());

  const dayLabel = date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const dayBlocks = useMemo(() => {
    const filtered = blocks.filter((b) => b.days.includes(day));
    return filtered.sort((a, b) => {
      const orderA = STATUS_ORDER[a.status] ?? 99;
      const orderB = STATUS_ORDER[b.status] ?? 99;
      return orderA - orderB;
    });
  }, [blocks, day]);

  const activeCount = dayBlocks.filter((b) => b.status === "on_site" || b.status === "en_route").length;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-1">
      {/* Day header */}
      <div className="brand-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 brand-ink" onClick={onPrevDay}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className={cn("text-sm font-semibold brand-ink", isToday && "text-[#173d66]")}>
            {isToday ? "Heute" : dayLabel}
          </p>
          {!isToday && (
            <p className="text-xs text-muted-foreground">{dayLabel}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 brand-ink" onClick={onNextDay}>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="brand-soft-card rounded-2xl px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Einsätze</p>
          <p className="mt-1 text-2xl font-semibold brand-ink">{dayBlocks.length}</p>
        </Card>
        <Card className="brand-soft-card rounded-2xl px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Aktiv</p>
          <p className={cn("mt-1 text-2xl font-semibold", activeCount > 0 ? "text-emerald-600" : "brand-ink")}>
            {activeCount}
          </p>
        </Card>
      </div>

      {/* Assignment list */}
      {dayBlocks.length === 0 ? (
        <Card className="brand-soft-card flex flex-col items-center justify-center rounded-2xl p-8 text-center">
          <CalendarDays className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium brand-ink">Keine Einsätze</p>
          <p className="mt-1 text-xs text-muted-foreground">Für diesen Tag sind keine Einsätze geplant.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {dayBlocks.map((block) => (
            <Card
              key={block.id}
              className="brand-soft-card cursor-pointer rounded-2xl p-3.5 transition-all hover:shadow-md active:scale-[0.99]"
              onClick={() => navigate(`/jobs/${block.jobId}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold brand-ink">{block.job.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{block.job.customerName}</p>
                </div>
                <StatusBadge status={block.status} />
              </div>

              {(block.job.addressCity || block.job.addressStreet) && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 flex-none" />
                  <span className="truncate">
                    {[block.job.addressStreet, block.job.addressCity].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}

              <div className="mt-2.5 flex items-center gap-1.5">
                <Users className="h-3 w-3 flex-none text-muted-foreground" />
                <EmployeeAvatars employees={block.workers} />
              </div>

              {block.span > 1 && (
                <Badge variant="outline" className="mt-2 text-[10px]">
                  Mehrtägig · {block.span} Tage
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
