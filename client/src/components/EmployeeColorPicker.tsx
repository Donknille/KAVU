import { cn } from "@/lib/utils";
import { EMPLOYEE_COLOR_PALETTE } from "@/lib/employee-colors";

interface EmployeeColorPickerProps {
  value: string | null | undefined;
  onChange: (color: string) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function EmployeeColorPicker({
  value,
  onChange,
  disabled,
  className,
  size = "md",
}: EmployeeColorPickerProps) {
  const swatch = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="radiogroup" aria-label="Mitarbeiter-Farbe">
      {EMPLOYEE_COLOR_PALETTE.map((color) => {
        const selected = value?.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            disabled={disabled}
            onClick={() => onChange(color)}
            className={cn(
              swatch,
              "rounded-full border-2 transition focus:outline-none focus:ring-2 focus:ring-offset-1",
              selected
                ? "border-foreground shadow ring-2 ring-foreground/30"
                : "border-transparent hover:scale-110",
              disabled && "cursor-not-allowed opacity-50",
            )}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}
