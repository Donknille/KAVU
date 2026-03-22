import type { Company, Employee } from "../shared/schema.js";
import {
  INVITATION_EMAIL_FROM,
  INVITATION_EMAIL_PROVIDER,
  INVITATION_EMAIL_REPLY_TO,
  RESEND_API_KEY,
  APP_BASE_URL,
} from "./runtimeConfig.js";
import { sendViaSMTP } from "./smtpTransport.js";
import { escapeHtml, wrapEmailLayout, emailButton, emailInfoBox } from "./emailTemplates.js";
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

function getSubject(input: SendEmployeeAccessInput) {
  return `${input.company.name}: Zugangsdaten fuer ${input.employee.firstName} ${input.employee.lastName}`;
}

function buildTextBody(input: SendEmployeeAccessInput) {
  const recipient = input.recipientName?.trim() ? `Hallo ${input.recipientName.trim()},` : "Hallo,";
  const loginUrl = APP_BASE_URL ? `${APP_BASE_URL}/employee-login` : "";

  return [
    recipient,
    "",
    `fuer ${input.employee.firstName} ${input.employee.lastName} wurde ein neuer Zugang`,
    `bei ${input.company.name} eingerichtet.`,
    "",
    `Betriebscode:        ${input.access.companyAccessCode}`,
    `Benutzername:        ${input.access.loginId}`,
    `Temporaeres Passwort: ${input.access.temporaryPassword}`,
    "",
    loginUrl ? `Jetzt anmelden: ${loginUrl}` : "",
    "",
    "Beim ersten Login muss das Passwort geaendert werden.",
    "Bitte gib diese Daten nur vertraulich weiter.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildHtmlBody(input: SendEmployeeAccessInput) {
  const recipient = escapeHtml(input.recipientName?.trim() || "Hallo");
  const employeeName = escapeHtml(`${input.employee.firstName} ${input.employee.lastName}`);
  const companyName = escapeHtml(input.company.name);
  const loginUrl = APP_BASE_URL ? `${APP_BASE_URL}/employee-login` : "#";

  const body = `
    <p style="font-size:16px;color:#111827;line-height:1.6;margin:0 0 16px;">
      ${recipient},
    </p>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
      f&uuml;r <strong>${employeeName}</strong> wurde ein neuer Zugang
      bei <strong>${companyName}</strong> eingerichtet.
    </p>

    ${emailInfoBox([
      { label: "Betriebscode", value: input.access.companyAccessCode },
      { label: "Benutzername", value: input.access.loginId },
      { label: "Tempor\u00e4res Passwort", value: input.access.temporaryPassword },
    ])}

    ${emailButton("Jetzt anmelden", loginUrl)}

    <p style="font-size:14px;color:#6B7280;line-height:1.5;margin:0 0 4px;">
      Beim ersten Login muss das Passwort ge&auml;ndert werden.
    </p>
    <p style="font-size:14px;color:#6B7280;line-height:1.5;margin:0;">
      Bitte gib diese Daten nur vertraulich weiter.
    </p>`;

  return wrapEmailLayout(body);
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
      subject: getSubject(input),
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
          companyAccessCode: process.env.NODE_ENV !== "production" ? input.access.companyAccessCode : "[redacted]",
          loginId: input.access.loginId,
          temporaryPassword: process.env.NODE_ENV !== "production" ? input.access.temporaryPassword : "[redacted]",
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

  if (INVITATION_EMAIL_PROVIDER === "smtp") {
    return sendViaSMTPAccess(input);
  }

  return sendViaResend(input);
}

async function sendViaSMTPAccess(input: SendEmployeeAccessInput): Promise<EmployeeAccessDeliveryResult> {
  const result = await sendViaSMTP({
    to: input.recipientEmail!,
    subject: getSubject(input),
    html: buildHtmlBody(input),
    text: buildTextBody(input),
  });

  if (!result.success) {
    return {
      status: "failed",
      delivered: false,
      message: `Versand über SMTP fehlgeschlagen: ${result.error}`,
    };
  }

  return {
    status: "sent",
    delivered: true,
    message: `Zugangsdaten wurden an ${input.recipientEmail} gesendet.`,
  };
}
