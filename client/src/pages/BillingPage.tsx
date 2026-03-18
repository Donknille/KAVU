import { useMutation } from "@tanstack/react-query";
import { useCurrentSession } from "@/features/session/useCurrentSession";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, Lock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function createCheckoutSession(): Promise<{ url: string }> {
  const res = await fetch("/api/billing/checkout-session", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Fehler beim Öffnen der Zahlungsseite.");
  }
  return res.json();
}

async function createPortalSession(): Promise<{ url: string }> {
  const res = await fetch("/api/billing/portal-session", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Fehler beim Öffnen der Kontoverwaltung.");
  }
  return res.json();
}

function statusLabel(status: string | undefined): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (status) {
    case "trialing":  return { label: "Testzeitraum", variant: "secondary" };
    case "active":    return { label: "Aktiv", variant: "default" };
    case "past_due":  return { label: "Zahlung ausstehend", variant: "destructive" };
    case "canceled":  return { label: "Gekündigt", variant: "destructive" };
    case "paused":    return { label: "Pausiert", variant: "outline" };
    default:          return { label: "Unbekannt", variant: "outline" };
  }
}

export default function BillingPage() {
  const { data: meData } = useCurrentSession();
  const billing = meData?.billing;
  const { toast } = useToast();

  const checkoutMutation = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: ({ url }) => {
      if (url) window.location.href = url;
    },
    onError: (err: Error) => {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: createPortalSession,
    onSuccess: ({ url }) => {
      if (url) window.location.href = url;
    },
    onError: (err: Error) => {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    },
  });

  const status = billing?.subscriptionStatus;
  const isActive = status === "active";
  const isFrozen = billing?.isFrozen ?? false;
  const hasSubscription = !!meData?.company?.stripeCustomerId;
  const { label, variant } = statusLabel(status);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Abonnement</h1>
        <p className="text-muted-foreground mt-1">Verwalten Sie Ihr Meisterplaner-Abonnement.</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Aktueller Status</CardTitle>
            <Badge variant={variant}>{label}</Badge>
          </div>
          {status === "trialing" && billing?.trialDaysLeft !== null && (
            <CardDescription>
              {isFrozen
                ? "Ihr Testzeitraum ist abgelaufen. Schließen Sie ein Abonnement ab, um die Plattform wieder zu nutzen."
                : `Noch ${billing?.trialDaysLeft} ${billing?.trialDaysLeft === 1 ? "Tag" : "Tage"} verbleibend.`}
            </CardDescription>
          )}
        </CardHeader>
        {isFrozen && (
          <CardContent>
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 px-3 py-2.5 text-sm text-red-800 dark:text-red-200">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Die Plattform ist gesperrt. Neue Aufträge, Mitarbeiter und Planungsänderungen sind nicht möglich.</span>
            </div>
          </CardContent>
        )}
        {status === "past_due" && !isFrozen && (
          <CardContent>
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Zahlung konnte nicht eingezogen werden. Bitte aktualisieren Sie Ihre Zahlungsmethode.</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meisterplaner Pro</CardTitle>
          <CardDescription>Einsatzplanung für Handwerksbetriebe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-bold">
            29,90 €<span className="text-base font-normal text-muted-foreground"> / Monat</span>
          </div>
          <ul className="space-y-2 text-sm">
            {[
              "Unbegrenzte Mitarbeiter",
              "Drag-&-Drop-Einsatzplanung",
              "Zeiterfassung & Pausen",
              "Problemdokumentation",
              "Mitarbeiter-App (mobil)",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {!isActive && (
            <Button
              className="w-full"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {checkoutMutation.isPending ? "Wird geöffnet..." : "Jetzt abonnieren"}
            </Button>
          )}

          {isActive && hasSubscription && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? "Wird geöffnet..." : "Abonnement verwalten"}
            </Button>
          )}

          {(status === "past_due" || status === "paused") && hasSubscription && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? "Wird geöffnet..." : "Zahlungsmethode aktualisieren"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
