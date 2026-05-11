import type { Express, Request, Response } from "express";
import { lt } from "drizzle-orm";
import { asyncHandler } from "../asyncHandler.js";
import { db } from "../db.js";
import { sessions } from "../../shared/models/auth.js";
import { CRON_SECRET } from "../runtimeConfig.js";

function authorizeCron(req: Request): boolean {
  if (!CRON_SECRET) return false;
  const header = req.headers.authorization;
  if (!header) return false;
  const expected = `Bearer ${CRON_SECRET}`;
  if (header.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function registerCronRoutes(app: Express) {
  app.get(
    "/api/cron/cleanup-sessions",
    asyncHandler(async (req: Request, res: Response) => {
      if (!authorizeCron(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const result = await db.delete(sessions).where(lt(sessions.expire, new Date()));
      const deleted = (result as unknown as { rowCount?: number }).rowCount ?? 0;
      return res.json({ deleted, ranAt: new Date().toISOString() });
    }),
  );
}
