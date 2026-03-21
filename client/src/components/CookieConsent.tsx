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
    <>
      {/* Banner */}
      {!showDetails && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg md:bottom-4 md:left-auto md:right-4 md:max-w-md md:rounded-lg md:border">
          <div className="flex items-start gap-3">
            <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold">Cookie-Einstellungen</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Wir verwenden Cookies, um die Funktionalität unserer Anwendung
                  sicherzustellen. Einige Cookies sind technisch notwendig,
                  andere helfen uns, die Nutzung zu verbessern.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={acceptAll}>
                  Alle akzeptieren
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={acceptNecessaryOnly}
                >
                  Nur notwendige
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDetails(true)}
                >
                  <Settings className="mr-1 h-3.5 w-3.5" />
                  Einstellungen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie-Einstellungen</DialogTitle>
            <DialogDescription>
              Hier können Sie auswählen, welche Cookies Sie zulassen möchten.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Necessary */}
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Notwendige Cookies</p>
                <p className="text-xs text-muted-foreground">
                  Diese Cookies sind für den Betrieb der Anwendung erforderlich
                  (z.B. Anmeldung, Sicherheit).
                </p>
              </div>
              <Switch checked disabled />
            </div>

            {/* Functional */}
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Funktionale Cookies</p>
                <p className="text-xs text-muted-foreground">
                  Diese Cookies ermöglichen erweiterte Funktionen wie
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

            {/* Analytics */}
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Analyse-Cookies</p>
                <p className="text-xs text-muted-foreground">
                  Diese Cookies helfen uns zu verstehen, wie die Anwendung
                  genutzt wird, um sie zu verbessern.
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

          <DialogFooter>
            <Button variant="outline" onClick={acceptNecessaryOnly}>
              Nur notwendige
            </Button>
            <Button onClick={savePreferences}>Auswahl speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
