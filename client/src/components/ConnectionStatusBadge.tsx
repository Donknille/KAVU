import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusBadgeProps {
  isOnline: boolean;
  className?: string;
  compact?: boolean;
}

export function ConnectionStatusBadge({
  isOnline,
  className,
  compact = false,
}: ConnectionStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        isOnline
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-800",
        compact && "px-2 py-0.5 text-[11px]",
        className,
      )}
    >
      {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span>{isOnline ? "Online" : "Offline"}</span>
    </span>
  );
}
