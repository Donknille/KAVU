import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { AuthenticatedRequest } from "./types.js";

export function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req as AuthenticatedRequest, res, next).catch((error: unknown) => {
      console.error("Unhandled route error:", error instanceof Error ? error.message : String(error));
      if (!res.headersSent) {
        res.status(500).json({ message: "Internal error" });
      }
    });
  };
}
