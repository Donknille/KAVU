import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ThemeValue = "light" | "dark" | "system";

const themeOptions: Array<{
  value: ThemeValue;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const currentTheme = (theme as ThemeValue | undefined) ?? "system";
  const currentOption =
    themeOptions.find((option) => option.value === currentTheme) ?? themeOptions[2];
  const CurrentIcon = currentOption.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={cn(
            "brand-outline-chip h-8 border-[color:var(--brand-chip-border)] bg-[color:var(--brand-chip-bg)] text-[color:var(--brand-chip-text)]",
            !compact && "gap-2 rounded-full px-3",
            className,
          )}
          data-testid="button-theme-toggle"
        >
          <CurrentIcon className="h-4 w-4" />
          {!compact && <span>{currentOption.label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="brand-panel min-w-[11rem] border-[color:var(--brand-panel-border)] text-[color:var(--brand-ink)]"
      >
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentTheme === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={cn(
                "rounded-xl text-[color:var(--brand-ink)] focus:bg-[color:var(--brand-highlight-bg)] focus:text-[color:var(--brand-highlight-text)]",
                isActive && "bg-[color:var(--brand-highlight-bg)]",
              )}
              data-testid={`button-theme-${option.value}`}
            >
              <Icon className="h-4 w-4" />
              <span>{option.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
