export type InvitationPreview = {
  companyName: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: "admin" | "employee";
  expiresAt: string;
};

export type InvitationRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: "admin" | "employee";
  expiresAt: string;
  lastSentAt?: string | null;
  sendAttempts: number;
  lastSendError?: string | null;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
};

export type InvitationDelivery = {
  status: "sent" | "logged" | "manual" | "failed";
  message: string;
};

export type InvitationMutationResponse = {
  invitation: InvitationRecord;
  inviteUrl: string;
  delivery: InvitationDelivery;
};

export type InvitationCreateResponse = InvitationMutationResponse;
export type InvitationResendResponse = InvitationMutationResponse;

export function getInviteToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("invite");
}

export function getInvitationRoleLabel(role: "admin" | "employee") {
  return role === "admin" ? "Admin" : "Mitarbeiter";
}

export function getInviteReturnPath(inviteToken: string | null) {
  return inviteToken ? `/?invite=${encodeURIComponent(inviteToken)}` : "/";
}

export function getInvitationDeliverySummary(invitation: InvitationRecord) {
  if (invitation.lastSendError) {
    return {
      tone: "warning" as const,
      text: invitation.lastSendError,
    };
  }

  if (invitation.lastSentAt) {
    return {
      tone: "ok" as const,
      text: `Zuletzt versendet am ${new Date(invitation.lastSentAt).toLocaleString("de-DE")}`,
    };
  }

  return {
    tone: "muted" as const,
    text: invitation.sendAttempts > 0
      ? "Automatischer Versand steht noch aus."
      : "Noch nicht automatisch versendet.",
  };
}
