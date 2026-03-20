import type { Company, CompanyInvitation } from "../shared/schema.js";
import {
  INVITATION_EMAIL_FROM,
  INVITATION_EMAIL_PROVIDER,
  INVITATION_EMAIL_REPLY_TO,
  RESEND_API_KEY,
} from "./runtimeConfig.js";
import { sendViaSMTP } from "./smtpTransport.js";
import { escapeHtml, wrapEmailLayout, emailButton } from "./emailTemplates.js";

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

function getRoleLabel(role: "admin" | "employee") {
  return role === "admin" ? "Admin" : "Mitarbeiter";
}

function getSubject(companyName: string) {
  return `${companyName}: Einladung zu Meisterplaner`;
}

function getTextBody(input: SendCompanyInvitationInput) {
  const inviter = input.invitedByName?.trim()
    ? ` von ${input.invitedByName.trim()}`
    : "";

  return [
    `Hallo ${input.invitation.firstName} ${input.invitation.lastName},`,
    "",
    `${input.company.name} hat dich${inviter} als ${getRoleLabel(input.invitation.role)} zu Meisterplaner eingeladen`,
    "— der einfachen Einsatzplanung fuers Handwerk.",
    "",
    "Registriere dich ueber diesen Link:",
    input.inviteUrl,
    "",
    "Was ist Meisterplaner?",
    "Meisterplaner hilft Handwerksbetrieben, Auftraege und",
    "Mitarbeiter-Einsaetze einfach zu planen.",
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
    ? `${escapeHtml(input.invitedByName.trim())} von `
    : "";
  const inviteUrl = input.inviteUrl;
  const roleLabel = escapeHtml(getRoleLabel(input.invitation.role));
  const expiresAt = escapeHtml(input.invitation.expiresAt.toLocaleDateString("de-DE"));

  const body = `
    <p style="font-size:16px;color:#111827;line-height:1.6;margin:0 0 16px;">
      Hallo ${fullName},
    </p>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
      ${inviter}<strong>${companyName}</strong> hat dich als <strong>${roleLabel}</strong>
      zu Meisterplaner eingeladen &mdash; der einfachen Einsatzplanung f&uuml;rs Handwerk.
    </p>

    ${emailButton("Einladung annehmen", inviteUrl)}

    <p style="font-size:13px;color:#6B7280;line-height:1.5;margin:0 0 4px;">
      Oder kopiere diesen Link in deinen Browser:
    </p>
    <p style="font-size:13px;color:#6B7280;word-break:break-all;margin:0 0 24px;">
      <a href="${escapeHtml(inviteUrl)}" style="color:#2563EB;">${escapeHtml(inviteUrl)}</a>
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0"
           style="width:100%;border-top:1px solid #E5E7EB;margin:24px 0 0;padding:16px 0 0;">
      <tr>
        <td>
          <p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 4px;">
            Was ist Meisterplaner?
          </p>
          <p style="font-size:14px;color:#6B7280;line-height:1.5;margin:0;">
            Meisterplaner hilft Handwerksbetrieben, Auftr&auml;ge und
            Mitarbeiter-Eins&auml;tze einfach zu planen &mdash; alles an einem Ort.
          </p>
        </td>
      </tr>
    </table>

    <p style="font-size:13px;color:#9CA3AF;margin:20px 0 0;">
      Die Einladung ist g&uuml;ltig bis ${expiresAt}. Wenn du diese Einladung
      nicht erwartet hast, kannst du diese E-Mail ignorieren.
    </p>`;

  return wrapEmailLayout(body);
}

function truncateErrorMessage(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 300);
}

async function sendViaResend(input: SendCompanyInvitationInput): Promise<InvitationEmailDeliveryResult> {
  if (!RESEND_API_KEY || !INVITATION_EMAIL_FROM) {
    return {
      status: "failed",
      delivered: false,
      message: "Resend ist nicht vollständig konfiguriert. Link bitte manuell teilen.",
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
      message: "E-Mail-Versand läuft im Log-Modus. Link wurde im Server-Log ausgegeben.",
    };
  }

  if (INVITATION_EMAIL_PROVIDER === "smtp") {
    return sendViaSMTPInvitation(input);
  }

  return sendViaResend(input);
}

async function sendViaSMTPInvitation(input: SendCompanyInvitationInput): Promise<InvitationEmailDeliveryResult> {
  const result = await sendViaSMTP({
    to: input.invitation.email,
    subject: getSubject(input.company.name),
    html: getHtmlBody(input),
    text: getTextBody(input),
  });

  if (!result.success) {
    return {
      status: "failed",
      delivered: false,
      message: `Versand ueber SMTP fehlgeschlagen: ${result.error}`,
    };
  }

  return {
    status: "sent",
    delivered: true,
    message: `Einladung wurde per E-Mail an ${input.invitation.email} gesendet.`,
  };
}
