import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionRequiredError } from "@/lib/queryClient";

/**
 * Returns an onError handler that intercepts SubscriptionRequiredError and
 * redirects the user to /billing with a toast message.
 *
 * Usage in mutations:
 *   const handleBillingError = useBillingGuard();
 *   const mutation = useMutation({ ..., onError: handleBillingError });
 */
export function useBillingGuard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  return (err: Error) => {
    if (err instanceof SubscriptionRequiredError) {
      toast({
        title: "Abonnement erforderlich",
        description: err.message,
        variant: "destructive",
      });
      navigate("/billing");
      return;
    }
    // Re-throw so callers can handle other errors normally
    throw err;
  };
}
