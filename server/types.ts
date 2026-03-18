import type { Request } from "express";
import type { Employee } from "../shared/schema.js";

export interface AuthenticatedRequest extends Request {
  companyId: string;
  employee: Employee;
  /** Route params are always plain strings in Express (not arrays) */
  params: Record<string, string>;
}

/** Alias – role === "admin" is enforced by the requireAdmin middleware */
export type AdminRequest = AuthenticatedRequest;
