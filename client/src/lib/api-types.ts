/** Response types for /api/me and related endpoints */

export type PublicEmployee = {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: "admin" | "employee";
  isActive: boolean;
  color: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** Only present when includeAccess: true */
  loginId?: string | null;
  /** Only present when includeAccess: true */
  mustChangePassword?: boolean;
};

export type PublicCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
  phone: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** Only present for admin employees */
  accessCode?: string | null;
};

export type BillingInfo = {
  isFrozen: boolean;
  trialDaysLeft: number | null;
};

/** Flat response type for /api/me */
export type MeResponse = {
  employee: PublicEmployee | null;
  company: PublicCompany | null;
  needsSetup: boolean;
  authMethod?: string;
  requiresPasswordChange?: boolean;
  billing?: BillingInfo | null;
  emailVerified?: boolean;
};
