import { Link } from "wouter";
import { useCurrentSession } from "@/features/session/useCurrentSession";

export function BillingBanner() {
  const { data: meData } = useCurrentSession();
  const billing = meData?.billing;

  if (!billing || !billing.stripeEnabled) return null;

  if (billing.isFrozen) {
    return (
      <div className="border-b bg-red-50 dark:bg-red-950 px-4 py-2.5 text-sm text-red-900 dark:text-red-100 flex items-center justify-between gap-3">
        <span className="font-medium">
          Ihr Testzeitraum ist abgelaufen. Die Plattform ist im Lesemodus.
        </span>
        <Link
          href="/billing"
          className="shrink-0 rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
        >
          Jetzt abonnieren
        </Link>
      </div>
    );
  }

  if (billing.subscriptionStatus === "trialing" && billing.trialDaysLeft !== null) {
    if (billing.trialDaysLeft > 7) return null;

    return (
      <div className="border-b bg-amber-50 dark:bg-amber-950 px-4 py-2.5 text-sm text-amber-900 dark:text-amber-100 flex items-center justify-between gap-3">
        <span>
          {billing.trialDaysLeft === 0
            ? "Ihr Testzeitraum endet heute."
            : `Ihr Testzeitraum endet in ${billing.trialDaysLeft} ${billing.trialDaysLeft === 1 ? "Tag" : "Tagen"}.`}
        </span>
        <Link
          href="/billing"
          className="shrink-0 rounded-md bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800 transition-colors"
        >
          Abonnement abschließen
        </Link>
      </div>
    );
  }

  return null;
}
