import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  labelClassName?: string;
  subtitleClassName?: string;
  size?: number;
  showWordmark?: boolean;
  subtitle?: string;
};

export function BrandMark({
  className,
  iconClassName,
  wordmarkClassName,
  labelClassName,
  subtitleClassName,
  size = 40,
  showWordmark = false,
  subtitle,
}: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center rounded-[18px] border border-[#173d66]/15 bg-white shadow-[0_14px_28px_rgba(21,58,99,0.14)]",
          iconClassName,
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 64 64"
          className="h-[76%] w-[76%]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M24.3 17.8a13.6 13.6 0 0 1 16.9 4.4l-5.2 5.2 1.6 7.3-7.2-1.6-5.2 5.2a13.6 13.6 0 0 1-.9-20.5Z"
            stroke="#173D66"
            strokeWidth="4.6"
            strokeLinejoin="round"
          />
          <path
            d="m33.9 30.1 12.8 12.8"
            stroke="#173D66"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="m44 20.5 12.2-11.1M56.2 9.4 54 21.8m2.2-12.4-12.7 2.2"
            stroke="#68D5C8"
            strokeWidth="4.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {showWordmark && (
        <span className={cn("min-w-0", wordmarkClassName)}>
          <span className={cn("block truncate text-xl font-bold tracking-[-0.04em] text-[#173d66]", labelClassName)}>
            Meisterplaner
          </span>
          {subtitle && (
            <span
              className={cn(
                "mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.22em] text-[#173d66]/58",
                subtitleClassName,
              )}
            >
              {subtitle}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
