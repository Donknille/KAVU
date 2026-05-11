import type { User } from "../shared/models/auth.js";

function hasConfiguredAuthProvider() {
  const provider = process.env.AUTH_PROVIDER?.trim().toLowerCase();

  if (provider === "replit") {
    return Boolean(process.env.REPL_ID);
  }

  if (provider === "oidc") {
    return Boolean(process.env.OIDC_ISSUER_URL && process.env.OIDC_CLIENT_ID);
  }

  if (provider === "local") {
    return true;
  }

  if (provider === "app") {
    return true;
  }

  return Boolean(
    process.env.REPL_ID ||
      (process.env.OIDC_ISSUER_URL && process.env.OIDC_CLIENT_ID),
  );
}

const NODE_ENV_NORMALIZED = process.env.NODE_ENV?.trim().toLowerCase();
const IS_PRODUCTION_RUNTIME = NODE_ENV_NORMALIZED === "production";

if (IS_PRODUCTION_RUNTIME && process.env.LOCAL_PREVIEW === "1") {
  throw new Error(
    "LOCAL_PREVIEW=1 is not permitted when NODE_ENV=production. " +
      "Preview mode bypasses authentication and must never run in production.",
  );
}

export const PREVIEW_MODE =
  !IS_PRODUCTION_RUNTIME &&
  (process.env.LOCAL_PREVIEW === "1" ||
    !process.env.DATABASE_URL ||
    !process.env.SESSION_SECRET ||
    !hasConfiguredAuthProvider());

export const PREVIEW_COMPANY_ID = "preview-company";
export const PREVIEW_ADMIN_USER_ID = "7a3677db-c6d6-4dd3-9ef9-2fd7987b3f9d";
export const PREVIEW_ADMIN_EMPLOYEE_ID = "0d6446e3-7de3-44b0-abfd-5688300f0e4a";
export const PREVIEW_EMPLOYEE_COOKIE = "kavu_preview_employee";
export const PREVIEW_EMPLOYEE_HEADER = "x-kavu-preview-employee";
export const PREVIEW_ADMIN_TOKEN = "admin";

export const PREVIEW_AUTH_USER: User = {
  id: PREVIEW_ADMIN_USER_ID,
  email: "demo@kavu.local",
  firstName: "Demo",
  lastName: "Admin",
  profileImageUrl: null,
  passwordHash: null,
  emailVerified: true,
  emailVerifyToken: null,
  emailVerifyExpires: null,
  passwordResetToken: null,
  passwordResetExpires: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function getPreviewSessionUser() {
  return {
    claims: { sub: PREVIEW_AUTH_USER.id },
    access_token: "preview-access-token",
    refresh_token: "preview-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  };
}

export function getCookieValue(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  for (const chunk of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = chunk.trim().split("=");
    if (rawName !== name) continue;
    return decodeURIComponent(rawValueParts.join("="));
  }

  return null;
}

export function normalizePreviewEmployeeToken(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function toPreviewEmployeeSlug(firstName: string, lastName: string) {
  return `${firstName}-${lastName}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}
