import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

// Billing page — placeholder for Phase 2 (Stripe integration)
export default function BillingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold brand-ink">Abonnement</h1>

      <Card className="brand-panel rounded-3xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#68d5c8]/15">
              <CreditCard className="h-5 w-5 text-[#68d5c8]" />
            </div>
            <div>
              <CardTitle className="text-lg brand-ink">Kostenloser Testzeitraum</CardTitle>
              <p className="text-sm brand-ink-soft">
                Du nutzt Meisterplaner aktuell kostenlos.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border bg-muted/30 p-4 text-sm brand-ink-soft">
            <p>
              Die Abonnement-Verwaltung wird in einer zukünftigen Version verfügbar sein.
              Bis dahin kannst du alle Funktionen uneingeschränkt nutzen.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
