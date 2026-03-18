import type { Company, Employee } from "../shared/schema.js";
import {
  INVITATION_EMAIL_FROM,
  INVITATION_EMAIL_PROVIDER,
  INVITATION_EMAIL_REPLY_TO,
  RESEND_API_KEY,
} from "./runtimeConfig.js";
import type { LocalEmployeeAccess } from "./storage.js";

export type EmployeeAccessDeliveryStatus = "sent" | "logged" | "manual" | "failed" | "skipped";

export type EmployeeAccessDeliveryResult = {
  status: EmployeeAccessDeliveryStatus;
  delivered: boolean;
  message: string;
};

type SendEmployeeAccessInput = {
  company: Company;
  employee: Employee;
  access: LocalEmployeeAccess;
  recipientEmail: string | null;
  recipientName?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildTextBody(input: SendEmployeeAccessInput) {
  const recipient = input.recipientName?.trim() ? `${input.recipientName.trim()},` : "Hallo,";

  return [
    recipient,
    "",
    `du hast fuer ${input.employee.firstName} ${input.employee.lastName} einen neuen Meisterplaner-Zugang erhalten.`,
    "",
    `Betrieb: ${input.company.name}`,
    `Betriebscode: ${input.access.companyAccessCode}`,
    `Benutzername: ${input.access.loginId}`,
    `Temporaeres Passwort: ${input.access.temporaryPassword}`,
    "",
    "Bitte gib diese Daten vertraulich weiter. Beim ersten Login muss das Passwort geändert werden.",
  ].join("\n");
}

function buildHtmlBody(input: SendEmployeeAccessInput) {
  const recipient = escapeHtml(input.recipientName?.trim() || "Hallo");
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
      <p>${recipient},</p>
      <p>du hast fuer <strong>${escapeHtml(`${input.employee.firstName} ${input.employee.lastName}`)}</strong> einen neuen Meisterplaner-Zugang erhalten.</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:6px 12px 6px 0;"><strong>Betrieb</strong></td><td>${escapeHtml(input.company.name)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;"><strong>Betriebscode</strong></td><td>${escapeHtml(input.access.companyAccessCode)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;"><strong>Benutzername</strong></td><td>${escapeHtml(input.access.loginId)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;"><strong>Temporaeres Passwort</strong></td><td>${escapeHtml(input.access.temporaryPassword)}</td></tr>
      </table>
      <p>Bitte gib diese Daten vertraulich weiter. Beim ersten Login muss das Passwort geändert werden.</p>
    </div>
  `.trim();
}

function truncateErrorMessage(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 300);
}

async function sendViaResend(input: SendEmployeeAccessInput): Promise<EmployeeAccessDeliveryResult> {
  if (!RESEND_API_KEY || !INVITATION_EMAIL_FROM) {
    return {
      status: "failed",
      delivered: false,
      message: "E-Mail-Versand ist nicht vollständig konfiguriert. Zugangsdaten bitte manuell weitergeben.",
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
      to: [input.recipientEmail],
      reply_to: INVITATION_EMAIL_REPLY_TO,
      subject: `${input.company.name}: Zugangsdaten fuer ${input.employee.firstName} ${input.employee.lastName}`,
      html: buildHtmlBody(input),
      text: buildTextBody(input),
    }),
  });

  if (!response.ok) {
    const rawError = (await response.text()) || response.statusText;
    return {
      status: "failed",
      delivered: false,
      message: `Versand fehlgeschlagen: ${truncateErrorMessage(rawError)}`,
    };
  }

  return {
    status: "sent",
    delivered: true,
    message: `Zugangsdaten wurden an ${input.recipientEmail} gesendet.`,
  };
}

export async function sendEmployeeAccessEmail(
  input: SendEmployeeAccessInput,
): Promise<EmployeeAccessDeliveryResult> {
  if (!input.recipientEmail) {
    return {
      status: "manual",
      delivered: false,
      message: "Keine Admin-E-Mail verfügbar. Zugangsdaten bitte direkt weitergeben.",
    };
  }

  if (INVITATION_EMAIL_PROVIDER === "disabled") {
    return {
      status: "manual",
      delivered: false,
      message: "Automatischer E-Mail-Versand ist deaktiviert. Zugangsdaten bitte direkt weitergeben.",
    };
  }

  if (INVITATION_EMAIL_PROVIDER === "log") {
    console.info(
      "[employee-access]",
      JSON.stringify(
        {
          companyId: input.company.id,
          companyName: input.company.name,
          employeeId: input.employee.id,
          employeeName: `${input.employee.firstName} ${input.employee.lastName}`,
          recipientEmail: input.recipientEmail,
          companyAccessCode: input.access.companyAccessCode,
          loginId: input.access.loginId,
          temporaryPassword: input.access.temporaryPassword,
        },
        null,
        2,
      ),
    );

    return {
      status: "logged",
      delivered: true,
      message: "E-Mail-Versand läuft im Log-Modus. Zugangsdaten wurden im Server-Log ausgegeben.",
    };
  }

  return sendViaResend(input);
}
