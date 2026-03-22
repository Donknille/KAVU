import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { JOB_CATEGORY_LABELS, JOB_STATUS_LABELS } from "@/lib/constants";
import { QK } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "planned", label: "Geplant" },
  { value: "in_progress", label: "In Arbeit" },
  { value: "completed", label: "Erledigt" },
];

export default function JobsList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: jobs, isLoading } = useQuery<any[]>({
    queryKey: [QK.JOBS],
  });

  const filtered = useMemo(() => jobs?.filter((j: any) => {
    const matchesSearch = !search || [j.title, j.customerName, j.addressCity, j.jobNumber]
      .some((field) => field?.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [jobs, search, statusFilter]);

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold" data-testid="text-jobs-title">Aufträge</h1>
        <Button size="sm" onClick={() => navigate("/jobs/new")} data-testid="button-new-job-list">
          <Plus className="w-4 h-4 mr-1" />
          Neu
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Auftrag suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-jobs"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === filter.value
                ? "bg-[#173d66] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filtered?.length === 0 ? (
        <Card className="p-8 text-center">
          <Briefcase className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Keine Aufträge gefunden</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered?.map((job: any) => (
            <Card
              key={job.id}
              className="p-3 cursor-pointer hover-elevate"
              onClick={() => navigate(`/jobs/${job.id}`)}
              data-testid={`card-job-${job.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      {job.jobNumber}
                    </span>
                    {job.category && (
                      <span className="text-xs text-muted-foreground">
                        {JOB_CATEGORY_LABELS[job.category]}
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-sm truncate">{job.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {job.customerName}
                    {job.addressCity && ` • ${job.addressCity}`}
                  </p>
                </div>
                <StatusBadge status={job.status} type="job" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
