import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Archive, Briefcase } from "lucide-react";
import { useLocation } from "wouter";
import { JOB_CATEGORY_LABELS, formatDate } from "@/lib/constants";

export default function ArchiveSearch() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: jobs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs?archived=true"],
  });

  const filtered = jobs?.filter((j: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      j.title?.toLowerCase().includes(q) ||
      j.customerName?.toLowerCase().includes(q) ||
      j.addressCity?.toLowerCase().includes(q) ||
      j.jobNumber?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Archive className="w-5 h-5" />
        Archiv & Suche
      </h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Kunde, Adresse, Auftragsnummer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-archive-search"
        />
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
          <p className="text-muted-foreground">
            {search ? "Keine Ergebnisse" : "Keine Aufträge im Archiv"}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered?.map((job: any) => (
            <Card
              key={job.id}
              className="p-3 cursor-pointer hover-elevate"
              onClick={() => navigate(`/jobs/${job.id}`)}
              data-testid={`card-archive-${job.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-muted-foreground">
                      {job.jobNumber}
                    </span>
                    {job.category && (
                      <span className="text-xs text-muted-foreground">
                        {JOB_CATEGORY_LABELS[job.category]}
                      </span>
                    )}
                    {job.startDate && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(job.startDate)}
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
