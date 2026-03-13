import type { CompanyInvitation } from "../shared/schema.js";
import { createInvitationLink } from "./companyInvitations.js";
import {
  sendCompanyInvitationEmail,
  type InvitationEmailDeliveryResult,
} from "./companyInvitationDelivery.js";
import {
  resolveBaseUrl,
  toAdminInvitationPayload,
  type AdminInvitationPayload,
} from "./companyInvitationApi.js";
import { storage } from "./storage.js";

export type CompanyInvitationMutationResponse = {
  invitation: AdminInvitationPayload;
  inviteUrl: string;
  delivery: {
    status: InvitationEmailDeliveryResult["status"];
    message: string;
  };
};

type InvitationRequestContext = {
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
  get?: (name: string) => string | undefined;
  employee?: {
    firstName?: string | null;
    lastName?: string | null;
  };
};

function getEmployeeDisplayName(employee?: { firstName?: string | null; lastName?: string | null }) {
  const name = [employee?.firstName, employee?.lastName].filter(Boolean).join(" ").trim();
  return name || undefined;
}

function toFailedInvitationDelivery(error: unknown): InvitationEmailDeliveryResult {
  const message =
    error instanceof Error && error.message.trim()
      ? `Einladungsversand fehlgeschlagen: ${error.message.trim()}`
      : "Einladungsversand fehlgeschlagen. Link bitte manuell teilen.";

  return {
    status: "failed",
    delivered: false,
    message,
  };
}

export async function buildCompanyInvitationMutationResponse(
  req: InvitationRequestContext,
  invitation: CompanyInvitation,
  token: string,
): Promise<CompanyInvitationMutationResponse> {
  const company = await storage.getCompany(invitation.companyId);
  if (!company) {
    throw new Error("Invitation company not found");
  }

  const inviteUrl = createInvitationLink(resolveBaseUrl(req), token);
  const deliveryResult = await sendCompanyInvitationEmail({
    company,
    invitation,
    inviteUrl,
    invitedByName: getEmployeeDisplayName(req.employee),
  }).catch(toFailedInvitationDelivery);

  const updatedInvitation =
    (await storage.recordCompanyInvitationDelivery(invitation.companyId, invitation.id, {
      delivered: deliveryResult.delivered,
      errorMessage: deliveryResult.delivered ? null : deliveryResult.message,
    })) ?? invitation;

  return {
    invitation: toAdminInvitationPayload(updatedInvitation),
    inviteUrl,
    delivery: {
      status: deliveryResult.status,
      message: deliveryResult.message,
    },
  };
}
