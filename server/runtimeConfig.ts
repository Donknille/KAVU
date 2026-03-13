import { PREVIEW_MODE } from "./preview.js";

export type AuthProvider = "preview" | "replit" | "oidc" | "local" | "app";
export type InvitationEmailProvider = "disabled" | "log" | "resend";
export type RuntimeConfigIssue = {
  field: string;
  message: string;
  level: "error" | "warning";
};

function normalizeEnv(value: string | undefined) {
  return value?.trim().toLowerCase();
}

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(normalizeEnv(value) || "");
}

function trimTrailingSlash(value: string | undefined) {
  return value?.replace(/\/+$/, "") || undefined;
}

function resolveAuthProvider(): Exclude<AuthProvider, "preview"> {
  const configured = normalizeEnv(process.env.AUTH_PROVIDER);
  if (configured === "replit" || configured === "oidc" || configured === "local" || configured === "app") {
    return configured;
  }

  if (process.env.REPL_ID) {
    return "replit";
  }

  return "app";
}

function resolveSameSite() {
  const configured = normalizeEnv(process.env.COOKIE_SAME_SITE);
  if (configured === "strict" || configured === "none") {
    return configured;
  }

  return "lax";
}

function resolveInvitationEmailProvider(): InvitationEmailProvider {
  const configured = normalizeEnv(process.env.INVITATION_EMAIL_PROVIDER);
  if (configured === "disabled" || configured === "log" || configured === "resend") {
    return configured;
  }

  return process.env.NODE_ENV === "production" ? "disabled" : "log";
}

export const AUTH_PROVIDER: AuthProvider = PREVIEW_MODE
  ? "preview"
  : resolveAuthProvider();

export const APP_BASE_URL = trimTrailingSlash(process.env.APP_BASE_URL);
export const TRUST_PROXY = isTruthy(process.env.TRUST_PROXY) || process.env.NODE_ENV === "production";
export const COOKIE_SECURE =
  process.env.COOKIE_SECURE !== undefined
    ? isTruthy(process.env.COOKIE_SECURE)
    : process.env.NODE_ENV === "production";
export const COOKIE_SAME_SITE = resolveSameSite();
export const INVITATION_EMAIL_PROVIDER = resolveInvitationEmailProvider();
export const INVITATION_EMAIL_FROM = process.env.INVITATION_EMAIL_FROM?.trim() || undefined;
export const INVITATION_EMAIL_REPLY_TO =
  process.env.INVITATION_EMAIL_REPLY_TO?.trim() || undefined;
export const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() || undefined;

export const OIDC_ISSUER_URL = process.env.OIDC_ISSUER_URL;
export const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID;
export const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
export const OIDC_CALLBACK_URL =
  process.env.OIDC_CALLBACK_URL || (APP_BASE_URL ? `${APP_BASE_URL}/api/callback` : undefined);
export const OIDC_POST_LOGOUT_REDIRECT_URL =
  process.env.OIDC_POST_LOGOUT_REDIRECT_URL || APP_BASE_URL || "/";
export const OIDC_SCOPE = process.env.OIDC_SCOPE || "openid email profile offline_access";
export const OIDC_SIGNUP_HINT = process.env.OIDC_SIGNUP_HINT?.trim() || undefined;
export const OIDC_CLIENT_AUTH_METHOD =
  normalizeEnv(process.env.OIDC_CLIENT_AUTH_METHOD) || "client_secret_basic";

export const ENABLE_DEMO_SEED = isTruthy(process.env.ENABLE_DEMO_SEED);
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export function getRuntimeConfigIssues(): RuntimeConfigIssue[] {
  if (PREVIEW_MODE) {
    return [];
  }

  const issues: RuntimeConfigIssue[] = [];

  if (!process.env.DATABASE_URL) {
    issues.push({
      field: "DATABASE_URL",
      message: "PostgreSQL connection string is required outside preview mode.",
      level: "error",
    });
  }

  if (!process.env.SESSION_SECRET) {
    issues.push({
      field: "SESSION_SECRET",
      message: "Session secret is required outside preview mode.",
      level: "error",
    });
  }

  if (!APP_BASE_URL) {
    issues.push({
      field: "APP_BASE_URL",
      message: "Base URL is required so callbacks, cookies and redirects stay consistent.",
      level: "error",
    });
  }

  if (AUTH_PROVIDER === "oidc") {
    if (!OIDC_ISSUER_URL) {
      issues.push({
        field: "OIDC_ISSUER_URL",
        message: "OIDC issuer URL is required when AUTH_PROVIDER=oidc.",
        level: "error",
      });
    }

    if (!OIDC_CLIENT_ID) {
      issues.push({
        field: "OIDC_CLIENT_ID",
        message: "OIDC client id is required when AUTH_PROVIDER=oidc.",
        level: "error",
      });
    }

    if (!OIDC_CALLBACK_URL && !APP_BASE_URL) {
      issues.push({
        field: "OIDC_CALLBACK_URL",
        message: "OIDC callback URL or APP_BASE_URL is required when AUTH_PROVIDER=oidc.",
        level: "error",
      });
    }
  }

  if (AUTH_PROVIDER === "replit" && !process.env.REPL_ID) {
    issues.push({
      field: "REPL_ID",
      message: "REPL_ID is required when AUTH_PROVIDER=replit.",
      level: "error",
    });
  }

  if (INVITATION_EMAIL_PROVIDER === "resend") {
    if (!INVITATION_EMAIL_FROM) {
      issues.push({
        field: "INVITATION_EMAIL_FROM",
        message: "Sender address is required when INVITATION_EMAIL_PROVIDER=resend.",
        level: "error",
      });
    }

    if (!RESEND_API_KEY) {
      issues.push({
        field: "RESEND_API_KEY",
        message: "Resend API key is required when INVITATION_EMAIL_PROVIDER=resend.",
        level: "error",
      });
    }
  }

  if (IS_PRODUCTION && !TRUST_PROXY) {
    issues.push({
      field: "TRUST_PROXY",
      message: "TRUST_PROXY should be enabled behind a reverse proxy in staging/production.",
      level: "warning",
    });
  }

  if (IS_PRODUCTION && !COOKIE_SECURE) {
    issues.push({
      field: "COOKIE_SECURE",
      message: "COOKIE_SECURE should be enabled in staging/production.",
      level: "warning",
    });
  }

  if (IS_PRODUCTION && INVITATION_EMAIL_PROVIDER === "disabled") {
    issues.push({
      field: "INVITATION_EMAIL_PROVIDER",
      message: "Invite emails are disabled. Admins will need to share invite links manually.",
      level: "warning",
    });
  }

  return issues;
}

export function assertRuntimeConfig() {
  const errors = getRuntimeConfigIssues().filter((issue) => issue.level === "error");
  if (errors.length === 0) {
    return;
  }

  const message = errors
    .map((issue) => `- ${issue.field}: ${issue.message}`)
    .join("\n");

  throw new Error(`Runtime configuration is incomplete:\n${message}`);
}
