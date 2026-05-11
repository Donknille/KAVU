import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { withPreviewHeaders } from "@/lib/preview-session";
import { JOB_STATUS_LABELS } from "@/lib/constants";

type SearchJobResult = {
  id: string;
  jobNumber: string;
  title: string;
  customerName: string;
  addressCity?: string | null;
  status: string;
};

const DEBOUNCE_MS = 200;

async function fetchSearch(query: string): Promise<SearchJobResult[]> {
  const url = `/api/jobs/search?q=${encodeURIComponent(query)}&limit=20`;
  const response = await fetch(url, {
    headers: withPreviewHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    return [];
  }
  return response.json();
}

interface JobSearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobSearchPalette({ open, onOpenChange }: JobSearchPaletteProps) {
  const [, navigate] = useLocation();
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [input]);

  useEffect(() => {
    if (!open) {
      setInput("");
      setDebounced("");
    }
  }, [open]);

  const { data: results = [], isFetching } = useQuery<SearchJobResult[]>({
    queryKey: ["/api/jobs/search", debounced],
    queryFn: () => fetchSearch(debounced),
    enabled: open,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Auftragsnummer, Kunde, Titel oder Adresse…"
        value={input}
        onValueChange={setInput}
      />
      <CommandList>
        <CommandEmpty>
          {isFetching ? "Suche…" : debounced ? "Keine Treffer." : "Tippe, um zu suchen."}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading={`Aufträge (${results.length})`}>
            {results.map((job) => (
              <CommandItem
                key={job.id}
                value={`${job.jobNumber} ${job.title} ${job.customerName} ${job.addressCity ?? ""}`}
                onSelect={() => {
                  onOpenChange(false);
                  navigate(`/jobs/${job.id}`);
                }}
                data-testid={`search-result-${job.id}`}
              >
                <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {job.jobNumber} · {job.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {job.customerName}
                    {job.addressCity ? ` · ${job.addressCity}` : ""}
                  </span>
                </div>
                <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {JOB_STATUS_LABELS[job.status] ?? job.status}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
