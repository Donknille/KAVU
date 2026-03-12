import { z } from "zod";
import {
  insertCompanyInvitationSchema,
  type Company,
  type CompanyInvitation,
} from "../shared/schema.ts";
import { isInvitationExpired } from "./companyInvitations";
import { PREVIEW_AUTH_USER, PREVIEW_MODE } from "./preview";
import { authStorage } from "./replit_integrations/auth";
import { APP_BASE_URL } from "./runtimeConfig";

export const createCompanyInvitationSchema = insertCompanyInvitationSchema
  .omit({ companyId: true, expiresAt: true })
  .extend({
    email: z.string().trim().email().max(255),
  });

export type CompanyInvitationStatus =
  | "pending"
  | "accepted"
  | "revoked"
  | "expired";

export type AdminInvitationPayload = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: "admin" | "employee";
  expiresAt: Date;
  lastSentAt: Date | null;
  sendAttempts: number;
  lastSendError: string | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date | null;
  status: CompanyInvitationStatus;
};

export type InvitationPreviewPayload = {
  companyName: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: "admin" | "employee";
  expiresAt: Date;
};

export function resolveBaseUrl(req: any) {
  if (APP_BASE_URL) {
    return APP_BASE_URL;
  }

  const protocol = req.protocol || "http";
  const host = req.get?.("host") || req.headers?.host;
  return host ? `${protocol}://${host}` : "http://localhost:5000";
}

export function getInvitationStatus(invitation: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): CompanyInvitationStatus {
  if (invitation.acceptedAt) return "accepted";
  if (invitation.revokedAt) return "revoked";
  if (isInvitationExpired(invitation.expiresAt)) return "expired";
  return "pending";
}

export function toAdminInvitationPayload(
  invitation: CompanyInvitation,
): AdminInvitationPayload {
  return {
    id: invitation.id,
    email: invitation.email,
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    phone: invitation.phone,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    lastSentAt: invitation.lastSentAt,
    sendAttempts: invitation.sendAttempts,
    lastSendError: invitation.lastSendError,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    createdAt: invitation.createdAt,
    status: getInvitationStatus(invitation),
  };
}

export function toInvitationPreviewPayload(
  invitation: CompanyInvitation,
  company: Company,
): InvitationPreviewPayload {
  return {
    companyName: company.name,
    email: invitation.email,
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    phone: invitation.phone,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  };
}

export async function getCurrentUserEmail(req: any) {
  if (PREVIEW_MODE) {
    return PREVIEW_AUTH_USER.email;
  }

  const userId = req.user?.claims?.sub;
  if (!userId) {
    return null;
  }

  const user = await authStorage.getUser(userId);
  return user?.email ?? null;
}
