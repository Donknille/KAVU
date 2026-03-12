import { createHash, randomBytes } from "node:crypto";

export const COMPANY_INVITATION_TTL_DAYS = 14;

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createInvitationToken() {
  return randomBytes(24).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getInvitationExpiry(baseDate = new Date()) {
  const expiresAt = new Date(baseDate);
  expiresAt.setDate(expiresAt.getDate() + COMPANY_INVITATION_TTL_DAYS);
  return expiresAt;
}

export function isInvitationExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function createInvitationLink(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/+$/, "")}/?invite=${encodeURIComponent(token)}`;
}
