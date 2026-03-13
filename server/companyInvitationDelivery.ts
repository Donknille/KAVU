import type { Company, CompanyInvitation } from "../shared/schema.js";
import {
  INVITATION_EMAIL_FROM,
  INVITATION_EMAIL_PROVIDER,
  INVITATION_EMAIL_REPLY_TO,
  RESEND_API_KEY,
} from "./runtimeConfig.js";

export type InvitationEmailDeliveryStatus = "sent" | "logged" | "manual" | "failed";

export type InvitationEmailDeliveryResult = {
  status: InvitationEmailDeliveryStatus;
  delivered: boolean;
  message: string;
};

type SendCompanyInvitationInput = {
  company: Company;
  invitation: CompanyInvitation;
  inviteUrl: string;
  invitedByName?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRoleLabel(role: "admin" | "employee") {
  return role === "admin" ? "Admin" : "Mitarbeiter";
}

function getSubject(companyName: string) {
  return `${companyName}: Einladung zu KAVU`;
}

function getTextBody(input: SendCompanyInvitationInput) {
  const inviter = input.invitedByName?.trim()
    ? ` von ${input.invitedByName.trim()}`
    : "";

  return [
    `Hallo ${input.invitation.firstName} ${input.invitation.lastName},`,
    "",
    `${input.company.name} hat dich${inviter} als ${getRoleLabel(input.invitation.role)} zu KAVU eingeladen.`,
    "",
    "Registriere dich ueber diesen Link:",
    input.inviteUrl,
    "",
    `Die Einladung ist gueltig bis ${input.invitation.expiresAt.toLocaleDateString("de-DE")}.`,
    "",
    "Wenn du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.",
  ].join("\n");
}

function getHtmlBody(input: SendCompanyInvitationInput) {
  const fullName = escapeHtml(`${input.invitation.firstName} ${input.invitation.lastName}`.trim());
  const companyName = escapeHtml(input.company.name);
  const inviter = input.invitedByName?.trim()
    ? ` von ${escapeHtml(input.invitedByName.trim())}`
    : "";
  const inviteUrl = escapeHtml(input.inviteUrl);
  const roleLabel = escapeHtml(getRoleLabel(input.invitation.role));
  const expiresAt = escapeHtml(input.invitation.expiresAt.toLocaleDateString("de-DE"));

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
      <p>Hallo ${fullName},</p>
      <p>${companyName} hat dich${inviter} als ${roleLabel} zu KAVU eingeladen.</p>
      <p>
        <a
          href="${inviteUrl}"
          style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;"
        >
          Einladung annehmen
        </a>
      </p>
      <p>Oder kopiere diesen Link in deinen Browser:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>Die Einladung ist gueltig bis ${expiresAt}.</p>
      <p>Wenn du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.</p>
    </div>
  `.trim();
}

function truncateErrorMessage(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 300);
}

async function sendViaResend(input: SendCompanyInvitationInput): Promise<InvitationEmailDeliveryResult> {
  if (!RESEND_API_KEY || !INVITATION_EMAIL_FROM) {
    return {
      status: "failed",
      delivered: false,
      message: "Resend ist nicht vollstaendig konfiguriert. Link bitte manuell teilen.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: INVITATION_EMAIL_FROM,
      to: [input.invitation.email],
      reply_to: INVITATION_EMAIL_REPLY_TO,
      subject: getSubject(input.company.name),
      html: getHtmlBody(input),
      text: getTextBody(input),
    }),
  });

  if (!response.ok) {
    const rawError = (await response.text()) || response.statusText;
    return {
      status: "failed",
      delivered: false,
      message: `Versand ueber Resend fehlgeschlagen: ${truncateErrorMessage(rawError)}`,
    };
  }

  return {
    status: "sent",
    delivered: true,
    message: `Einladung wurde per E-Mail an ${input.invitation.email} gesendet.`,
  };
}

export async function sendCompanyInvitationEmail(
  input: SendCompanyInvitationInput,
): Promise<InvitationEmailDeliveryResult> {
  if (INVITATION_EMAIL_PROVIDER === "disabled") {
    return {
      status: "manual",
      delivered: false,
      message: "Automatischer E-Mail-Versand ist deaktiviert. Link bitte manuell teilen.",
    };
  }

  if (INVITATION_EMAIL_PROVIDER === "log") {
    console.info(
      "[company-invitation]",
      JSON.stringify(
        {
          companyId: input.company.id,
          companyName: input.company.name,
          invitationId: input.invitation.id,
          recipient: input.invitation.email,
          inviteUrl: input.inviteUrl,
        },
        null,
        2,
      ),
    );

    return {
      status: "logged",
      delivered: true,
      message: "E-Mail-Versand laeuft im Log-Modus. Link wurde im Server-Log ausgegeben.",
    };
  }

  return sendViaResend(input);
}
