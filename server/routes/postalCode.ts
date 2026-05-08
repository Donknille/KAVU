import type { Express, Response } from "express";
import { asyncHandler } from "../asyncHandler.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAuthenticated } from "../replit_integrations/auth/index.js";

const OPENPLZ_BASE = "https://openplzapi.org/de/Localities";
const FETCH_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type PostalCodeResult = {
  city: string;
  federalState?: string;
  district?: string;
} | null;

const cache = new Map<string, { value: PostalCodeResult; expiresAt: number }>();

async function fetchFromOpenPlz(zip: string): Promise<PostalCodeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${OPENPLZ_BASE}?postalCode=${zip}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as Array<{
      name?: string;
      federalState?: { name?: string };
      district?: { name?: string };
    }>;
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }
    const first = data[0];
    if (!first?.name) {
      return null;
    }
    return {
      city: first.name,
      federalState: first.federalState?.name,
      district: first.district?.name,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function registerPostalCodeRoutes(
  app: Express,
  requireAuth: (req: any, res: any, next: any) => void,
) {
  app.get(
    "/api/postal-code/:zip",
    isAuthenticated,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const rawZip = String(req.params.zip ?? "");
      if (!/^\d{5}$/.test(rawZip)) {
        return res.status(400).json({ message: "PLZ muss aus 5 Ziffern bestehen." });
      }

      const cached = cache.get(rawZip);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.value);
      }

      const value = await fetchFromOpenPlz(rawZip);
      cache.set(rawZip, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return res.json(value);
    }),
  );
}
