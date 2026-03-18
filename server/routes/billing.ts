import type { Express } from "express";

// Stripe not yet implemented — all billing routes return 501
export function registerBillingRoutes(
  app: Express,
  _requireAdmin: (req: any, res: any, next: any) => void,
) {
  app.post("/api/billing/checkout-session", (_req, res) => {
    res.status(501).json({ message: "Billing is not configured on this server." });
  });

  app.post("/api/billing/portal-session", (_req, res) => {
    res.status(501).json({ message: "Billing is not configured on this server." });
  });

  app.post("/api/billing/webhook", (_req, res) => {
    res.status(501).send("Webhook not configured.");
  });
}
