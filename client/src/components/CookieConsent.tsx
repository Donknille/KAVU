import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Cookie, Settings } from "lucide-react";

const CONSENT_KEY = "meisterplaner-cookie-consent";

interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
}

const defaultPreferences: CookiePreferences = {
  necessary: true,
  functional: false,
  analytics: false,
};

function getStoredConsent(): CookiePreferences | null {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return null;
}

function storeConsent(prefs: CookiePreferences) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs));
}

export function useCookieSettings() {
  const [showSettings, setShowSettings] = useState(false);
  const openCookieSettings = useCallback(() => setShowSettings(true), []);
  const closeCookieSettings = useCallback(() => setShowSettings(false), []);
  return { showSettings, openCookieSettings, closeCookieSettings };
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] =
    useState<CookiePreferences>(defaultPreferences);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      setShowBanner(true);
    } else {
      setPreferences(stored);
    }
  }, []);

  const acceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      functional: true,
      analytics: true,
    };
    storeConsent(allAccepted);
    setPreferences(allAccepted);
    setShowBanner(false);
    setShowDetails(false);
  };

  const acceptNecessaryOnly = () => {
    const necessaryOnly: CookiePreferences = {
      necessary: true,
      functional: false,
      analytics: false,
    };
    storeConsent(necessaryOnly);
    setPreferences(necessaryOnly);
    setShowBanner(false);
    setShowDetails(false);
  };

  const savePreferences = () => {
    storeConsent(preferences);
    setShowBanner(false);
    setShowDetails(false);
  };

  if (!showBanner) return null;

  return (
    <Dialog open={showBanner} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md gap-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cookie className="h-5 w-5" />
            Cookie-Einstellungen
          </DialogTitle>
          <DialogDescription>
            {showDetails
              ? "Hier können Sie auswählen, welche Cookies Sie zulassen möchten."
              : "Wir verwenden Cookies, um die Funktionalität unserer Anwendung sicherzustellen. Einige Cookies sind technisch notwendig, andere helfen uns, die Nutzung zu verbessern."}
          </DialogDescription>
        </DialogHeader>

        {showDetails && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Notwendige Cookies</p>
                <p className="text-xs text-muted-foreground">
                  Für den Betrieb erforderlich (z.B. Anmeldung, Sicherheit).
                </p>
              </div>
              <Switch checked disabled />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Funktionale Cookies</p>
                <p className="text-xs text-muted-foreground">
                  Personalisierung und gespeicherte Einstellungen.
                </p>
              </div>
              <Switch
                checked={preferences.functional}
                onCheckedChange={(checked) =>
                  setPreferences((p) => ({ ...p, functional: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Analyse-Cookies</p>
                <p className="text-xs text-muted-foreground">
                  Hilft uns zu verstehen, wie die Anwendung genutzt wird.
                </p>
              </div>
              <Switch
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences((p) => ({ ...p, analytics: checked }))
                }
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {showDetails ? (
            <>
              <Button variant="outline" className="flex-1" onClick={acceptNecessaryOnly}>
                Nur notwendige
              </Button>
              <Button className="flex-1" onClick={savePreferences}>
                Auswahl speichern
              </Button>
            </>
          ) : (
            <>
              <Button className="flex-1" onClick={acceptAll}>
                Alle akzeptieren
              </Button>
              <Button variant="outline" className="flex-1" onClick={acceptNecessaryOnly}>
                Nur notwendige
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowDetails(true)}
              >
                <Settings className="mr-1 h-3.5 w-3.5" />
                Einstellungen
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Standalone button to re-open cookie settings after initial consent.
 * Resets consent so the banner re-appears with the settings dialog open.
 */
export function CookieSettingsButton({
  className,
}: {
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        localStorage.removeItem(CONSENT_KEY);
        window.location.reload();
      }}
    >
      <Cookie className="mr-1 h-3.5 w-3.5 inline" />
      Cookie-Einstellungen
    </button>
  );
}
