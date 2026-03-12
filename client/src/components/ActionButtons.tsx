import { Button } from "@/components/ui/button";
import {
  Car,
  MapPin,
  Pause,
  Play,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Phone,
} from "lucide-react";
import { getNavigationUrl, getPhoneUrl } from "@/lib/constants";

interface ActionButtonsProps {
  status: string;
  onAction: (action: string) => void;
  isLoading?: boolean;
  address?: string;
  phone?: string;
}

export function ActionButtons({
  status,
  onAction,
  isLoading = false,
  address,
  phone,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-col gap-3">
      {address && (
        <a
          href={getNavigationUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full"
          data-testid="link-navigation"
        >
          <Button variant="secondary" className="w-full h-14 text-base gap-2" size="lg">
            <Navigation className="w-5 h-5" />
            Navigation starten
          </Button>
        </a>
      )}

      {phone && (
        <a href={getPhoneUrl(phone)} className="w-full" data-testid="link-call">
          <Button variant="secondary" className="w-full h-14 text-base gap-2" size="lg">
            <Phone className="w-5 h-5" />
            Ansprechpartner anrufen
          </Button>
        </a>
      )}

      {status === "planned" && (
        <Button
          className="w-full h-16 text-lg gap-3 bg-blue-600 dark:bg-blue-700 text-white"
          size="lg"
          onClick={() => onAction("start-travel")}
          disabled={isLoading}
          data-testid="button-start-travel"
        >
          <Car className="w-6 h-6" />
          Fahrt beginnen
        </Button>
      )}

      {status === "en_route" && (
        <Button
          className="w-full h-16 text-lg gap-3 bg-green-600 dark:bg-green-700 text-white"
          size="lg"
          onClick={() => onAction("arrive")}
          disabled={isLoading}
          data-testid="button-arrive"
        >
          <MapPin className="w-6 h-6" />
          Ankunft Baustelle
        </Button>
      )}

      {status === "on_site" && (
        <>
          <Button
            className="w-full h-14 text-base gap-2"
            variant="secondary"
            size="lg"
            onClick={() => onAction("start-break")}
            disabled={isLoading}
            data-testid="button-start-break"
          >
            <Pause className="w-5 h-5" />
            Pause
          </Button>
          <Button
            className="w-full h-16 text-lg gap-3 bg-emerald-600 dark:bg-emerald-700 text-white"
            size="lg"
            onClick={() => onAction("complete")}
            disabled={isLoading}
            data-testid="button-complete"
          >
            <CheckCircle className="w-6 h-6" />
            Einsatz beenden
          </Button>
        </>
      )}

      {status === "break" && (
        <Button
          className="w-full h-16 text-lg gap-3 bg-green-600 dark:bg-green-700 text-white"
          size="lg"
          onClick={() => onAction("end-break")}
          disabled={isLoading}
          data-testid="button-end-break"
        >
          <Play className="w-6 h-6" />
          Pause beenden
        </Button>
      )}

      {status === "problem" && (
        <Button
          className="w-full h-14 text-base gap-2 bg-green-600 dark:bg-green-700 text-white"
          size="lg"
          onClick={() => onAction("resume")}
          disabled={isLoading}
          data-testid="button-resume"
        >
          <Play className="w-5 h-5" />
          Weiterarbeiten
        </Button>
      )}

      {(status === "on_site" || status === "break" || status === "en_route") && (
        <Button
          variant="destructive"
          className="w-full h-14 text-base gap-2"
          size="lg"
          onClick={() => onAction("report-problem")}
          disabled={isLoading}
          data-testid="button-report-problem"
        >
          <AlertTriangle className="w-5 h-5" />
          Problem melden
        </Button>
      )}
    </div>
  );
}
