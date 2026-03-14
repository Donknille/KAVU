import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/BrandMark";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Download, Share2, X } from "lucide-react";

const DISMISS_KEY = "meisterplaner-install-card-dismissed";

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
    <Card className="brand-panel overflow-hidden rounded-[28px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BrandMark size={40} />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#173d66]">Meisterplaner auf dem Geraet speichern</p>
            <p className="text-sm text-[#173d66]/72">
              Oeffnen Sie die Mitarbeiteransicht direkt ueber den Startbildschirm und greifen Sie schneller auf aktuelle Einsaetze zu.
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
          className="mt-4 h-11 w-full justify-between rounded-2xl bg-[#173d66] text-white hover:bg-[#123251]"
          onClick={handleInstall}
          disabled={isInstalling}
          data-testid="button-install-pwa"
        >
          <span>Auf Geraet installieren</span>
          <Download className="h-4 w-4" />
        </Button>
      ) : (
        <div className="mt-4 rounded-2xl border border-[#173d66]/12 bg-white/80 p-3 text-sm text-[#173d66]/72">
          <div className="mb-1 flex items-center gap-2 font-medium text-[#173d66]">
            <Share2 className="h-4 w-4" />
            Auf iPhone installieren
          </div>
          <p>Waehlen Sie "Teilen" und anschliessend "Zum Home-Bildschirm".</p>
        </div>
      )}
    </Card>
  );
}
