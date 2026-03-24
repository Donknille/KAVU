import { Button } from "@/components/ui/button";

export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="brand-soft-card rounded-2xl border-dashed p-6 text-center">
      <p className="text-sm brand-ink-soft">{message}</p>
      {actionLabel && onAction && (
        <Button
          variant="outline"
          size="sm"
          className="brand-outline-control mt-3"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
