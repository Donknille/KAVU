import { Sun, Flame, Wrench, HardHat, Settings, Package } from "lucide-react";

  export function CategoryIcon({ category, className }: { category: string; className?: string }) {
    const cn = className || "w-3 h-3";
    switch (category) {
      case "pv": return <Sun className={cn} />;
      case "heat_pump": return <Flame className={cn} />;
      case "shk": return <Wrench className={cn} />;
      case "montage": return <HardHat className={cn} />;
      case "service": return <Settings className={cn} />;
      default: return <Package className={cn} />;
    }
  }

  export function WorkerDots({ workers }: { workers: any[] }) {
    if (!workers || workers.length === 0) return null;
    return (
      <div className="flex items-center gap-0.5 mt-0.5">
        {workers.map((w: any) => (
          <span
            key={w.id}
            className="w-2 h-2 rounded-full shrink-0 inline-block"
            style={{ backgroundColor: w.color || "#6b7280" }}
            title={`${w.firstName} ${w.lastName}`}
          />
        ))}
        {workers.length <= 2 && (
          <span className="text-[9px] text-muted-foreground ml-0.5">
            {workers.map((w: any) => w.firstName.charAt(0) + w.lastName.charAt(0)).join(" ")}
          </span>
        )}
      </div>
    );
  }
  