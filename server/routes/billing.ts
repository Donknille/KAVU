import type { Express, Response } from "express";
import { storage } from "../storage.js";
import { asyncHandler } from "../asyncHandler.js";
import type { AuthenticatedRequest } from "../types.js";
import { invalidateCompanyReadCaches } from "../readCaches.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";
import { getStripe } from "../stripe.js";
import {
  STRIPE_ENABLED,
  STRIPE_PRICE_ID,
  STRIPE_WEBHOOK_SECRET,
  APP_BASE_URL,
} from "../runtimeConfig.js";

export function registerBillingRoutes(
  app: Express,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  // POST /api/billing/checkout-session
  // Creates a Stripe Checkout Session and returns the URL.
  app.post(
    "/api/billing/checkout-session",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      if (!STRIPE_ENABLED) {
        return res.status(501).json({ message: "Billing is not configured on this server." });
      }

      const company = await storage.getCompany(req.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      const stripe = getStripe();
      const baseUrl = APP_BASE_URL || "http://localhost:5000";

      // Reuse existing customer if possible
      let customerId = company.stripeCustomerId ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: company.name,
          metadata: { companyId: company.id },
        });
        customerId = customer.id;
        await storage.updateCompany(company.id, { stripeCustomerId: customerId });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: STRIPE_PRICE_ID!, quantity: 1 }],
        success_url: `${baseUrl}/billing?success=1`,
        cancel_url: `${baseUrl}/billing?canceled=1`,
        metadata: { companyId: company.id },
      });

      res.json({ url: session.url });
    }),
  );

  // POST /api/billing/portal-session
  // Opens the Stripe Customer Portal for self-service subscription management.
  app.post(
    "/api/billing/portal-session",
    isAuthenticated,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      if (!STRIPE_ENABLED) {
        return res.status(501).json({ message: "Billing is not configured on this server." });
      }

      const company = await storage.getCompany(req.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (!company.stripeCustomerId) {
        return res.status(400).json({ message: "No billing account found. Please complete checkout first." });
      }

      const stripe = getStripe();
      const baseUrl = APP_BASE_URL || "http://localhost:5000";
      const session = await stripe.billingPortal.sessions.create({
        customer: company.stripeCustomerId,
        return_url: `${baseUrl}/billing`,
      });

      res.json({ url: session.url });
    }),
  );

  // POST /api/billing/webhook
  // Stripe sends events here. Must be called with raw body (no JSON parsing).
  app.post("/api/billing/webhook", async (req: any, res: Response) => {
    if (!STRIPE_ENABLED || !STRIPE_WEBHOOK_SECRET) {
      return res.status(501).send("Webhook not configured.");
    }

    const sig = req.headers["stripe-signature"] as string;
    let event: any;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error("Stripe webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      const obj = event.data.object as any;

      if (event.type === "checkout.session.completed") {
        const companyId = obj.metadata?.companyId;
        if (companyId && obj.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(obj.subscription);
          await storage.updateCompany(companyId, {
            stripeSubscriptionId: sub.id,
            subscriptionStatus: sub.status as any,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          });
          invalidateCompanyReadCaches(companyId);
        }
      }

      if (
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const sub = obj;
        // Find company by stripeCustomerId
        const company = await storage.getCompanyByStripeCustomerId(sub.customer);
        if (company) {
          await storage.updateCompany(company.id, {
            stripeSubscriptionId: sub.id,
            subscriptionStatus: sub.status as any,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          });
          invalidateCompanyReadCaches(company.id);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error handling Stripe webhook:", error);
      res.status(500).json({ message: "Internal error" });
    }
  });
}
