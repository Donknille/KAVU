import { Skeleton } from "@/components/ui/skeleton";

export function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="space-y-3 w-56">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
