import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "./runtimeConfig.js";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }
    _stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}
