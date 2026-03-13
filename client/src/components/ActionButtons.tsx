import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Car,
  CheckCircle,
  Pause,
  Play,
} from "lucide-react";

interface ActionButtonsProps {
  status: string;
  onAction: (action: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ActionButtons({
  status,
  onAction,
  isLoading = false,
  disabled = false,
}: ActionButtonsProps) {
  const isDisabled = isLoading || disabled;

  return (
    <div className="flex flex-col gap-3">
      {status === "planned" && (
        <Button
          className="h-16 w-full gap-3 bg-blue-600 text-lg text-white dark:bg-blue-700"
          size="lg"
          onClick={() => onAction("start-travel")}
          disabled={isDisabled}
          data-testid="button-start-travel"
        >
          <Car className="h-6 w-6" />
          Fahrt beginnen
        </Button>
      )}

      {status === "en_route" && (
        <>
          <Button
            variant="destructive"
            className="h-14 w-full gap-2 text-base"
            size="lg"
            onClick={() => onAction("report-problem")}
            disabled={isDisabled}
            data-testid="button-report-problem"
          >
            <AlertTriangle className="h-5 w-5" />
            Problem melden
          </Button>
          <Button
            className="h-16 w-full gap-3 bg-green-600 text-lg text-white dark:bg-green-700"
            size="lg"
            onClick={() => onAction("arrive")}
            disabled={isDisabled}
            data-testid="button-arrive"
          >
            <CheckCircle className="h-6 w-6" />
            Ankunft Baustelle
          </Button>
        </>
      )}

      {status === "on_site" && (
        <>
          <Button
            className="h-14 w-full gap-2 text-base"
            variant="secondary"
            size="lg"
            onClick={() => onAction("start-break")}
            disabled={isDisabled}
            data-testid="button-start-break"
          >
            <Pause className="h-5 w-5" />
            Pause
          </Button>
          <Button
            variant="destructive"
            className="h-14 w-full gap-2 text-base"
            size="lg"
            onClick={() => onAction("report-problem")}
            disabled={isDisabled}
            data-testid="button-report-problem"
          >
            <AlertTriangle className="h-5 w-5" />
            Problem melden
          </Button>
          <Button
            className="h-16 w-full gap-3 bg-emerald-600 text-lg text-white dark:bg-emerald-700"
            size="lg"
            onClick={() => onAction("complete")}
            disabled={isDisabled}
            data-testid="button-complete"
          >
            <CheckCircle className="h-6 w-6" />
            Einsatz beenden
          </Button>
        </>
      )}

      {status === "break" && (
        <>
          <Button
            variant="destructive"
            className="h-14 w-full gap-2 text-base"
            size="lg"
            onClick={() => onAction("report-problem")}
            disabled={isDisabled}
            data-testid="button-report-problem"
          >
            <AlertTriangle className="h-5 w-5" />
            Problem melden
          </Button>
          <Button
            className="h-16 w-full gap-3 bg-green-600 text-lg text-white dark:bg-green-700"
            size="lg"
            onClick={() => onAction("end-break")}
            disabled={isDisabled}
            data-testid="button-end-break"
          >
            <Play className="h-6 w-6" />
            Pause beenden
          </Button>
        </>
      )}

      {status === "problem" && (
        <Button
          className="h-14 w-full gap-2 bg-green-600 text-base text-white dark:bg-green-700"
          size="lg"
          onClick={() => onAction("resume")}
          disabled={isDisabled}
          data-testid="button-resume"
        >
          <Play className="h-5 w-5" />
          Weiterarbeiten
        </Button>
      )}
    </div>
  );
}
