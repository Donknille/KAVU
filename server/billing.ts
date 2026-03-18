import type { Company } from "../shared/schema.js";
import { STRIPE_ENABLED } from "./runtimeConfig.js";

export const TRIAL_DAYS = 28;

/**
 * Returns true when Stripe is enabled AND the company has no active subscription.
 * During the free trial (subscriptionStatus === "trialing" and trialEndsAt in future)
 * the company is NOT frozen.
 *
 * Frozen states: trial expired, past_due, canceled, paused.
 */
export function isCompanyFrozen(company: Company): boolean {
  if (!STRIPE_ENABLED) return false;

  const status = company.subscriptionStatus;

  if (status === "active") return false;

  if (status === "trialing") {
    if (!company.trialEndsAt) return false;
    return new Date() > new Date(company.trialEndsAt);
  }

  // past_due, canceled, paused → frozen
  return true;
}

/**
 * Returns the number of days left in the trial, or null if not in trial.
 */
export function trialDaysLeft(company: Company): number | null {
  if (company.subscriptionStatus !== "trialing") return null;
  if (!company.trialEndsAt) return null;
  const ms = new Date(company.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Express middleware that blocks mutating requests when a company is frozen.
 * Attach after requireAdmin / requireAuth so req.companyId is already set.
 */
export function requireNotFrozen(storage: any) {
  return (req: any, res: any, next: any) => {
    (async () => {
      const companyId: string | undefined = req.companyId;
      if (!companyId) return res.status(401).json({ message: "Unauthorized" });

      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      if (isCompanyFrozen(company)) {
        return res.status(402).json({
          message: "Ihr Testzeitraum ist abgelaufen. Bitte schließen Sie ein Abonnement ab, um fortzufahren.",
          code: "SUBSCRIPTION_REQUIRED",
        });
      }

      next();
    })();
  };
}
