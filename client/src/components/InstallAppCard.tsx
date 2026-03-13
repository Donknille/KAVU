import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Download, Share2, Smartphone, X } from "lucide-react";

const DISMISS_KEY = "kavu-install-card-dismissed";

export function InstallAppCard() {
  const { canInstall, install, isStandalone, showIosHint } = usePwaInstall();
  const [isHidden, setIsHidden] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    setIsHidden(dismissed);
  }, []);

  useEffect(() => {
    if (isStandalone) {
      setIsHidden(true);
    }
  }, [isStandalone]);

  if (isStandalone || (!canInstall && !showIosHint) || isHidden) {
    return null;
  }

  async function handleInstall() {
    setIsInstalling(true);
    try {
      const accepted = await install();
      if (accepted) {
        setIsHidden(true);
      }
    } finally {
      setIsInstalling(false);
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setIsHidden(true);
  }

  return (
    <Card className="overflow-hidden border-primary/15 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">KAVU als App installieren</p>
            <p className="text-sm text-muted-foreground">
              Oeffne deine Mitarbeiteransicht direkt vom Homescreen und halte die App schneller griffbereit.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={dismiss}
          data-testid="button-dismiss-install-card"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {canInstall ? (
        <Button
          className="mt-4 h-11 w-full justify-between rounded-2xl"
          onClick={handleInstall}
          disabled={isInstalling}
          data-testid="button-install-pwa"
        >
          <span>App installieren</span>
          <Download className="h-4 w-4" />
        </Button>
      ) : (
        <div className="mt-4 rounded-2xl border bg-background/80 p-3 text-sm text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
            <Share2 className="h-4 w-4" />
            Auf iPhone installieren
          </div>
          <p>Teilen antippen und dann "Zum Home-Bildschirm" waehlen.</p>
        </div>
      )}
    </Card>
  );
}
