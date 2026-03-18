import type { Company } from "../shared/schema.js";

// Stripe not yet implemented — billing is always inactive
export function isCompanyFrozen(_company: Company): boolean {
  return false;
}

export function trialDaysLeft(_company: Company): number | null {
  return null;
}

export function requireNotFrozen(_storage: any) {
  return (_req: any, _res: any, next: any) => next();
}
