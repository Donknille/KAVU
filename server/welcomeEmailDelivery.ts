import type { Company, Employee } from "../shared/schema.js";
import {
  INVITATION_EMAIL_FROM,
  INVITATION_EMAIL_PROVIDER,
  INVITATION_EMAIL_REPLY_TO,
  RESEND_API_KEY,
  APP_BASE_URL,
} from "./runtimeConfig.js";
import { sendViaSMTP } from "./smtpTransport.js";
import {
  escapeHtml,
  wrapEmailLayout,
  emailButton,
  emailInfoBox,
  emailSteps,
} from "./emailTemplates.js";

export type WelcomeEmailResult = {
  status: "sent" | "logged" | "skipped" | "failed";
  delivered: boolean;
  message: string;
};

type WelcomeInput = {
  company: Company;
  admin: Employee;
  adminEmail: string;
};

function getSubject(companyName: string) {
  return `Willkommen bei Meisterplaner — ${companyName} ist startklar`;
}

function getTextBody(input: WelcomeInput) {
  return [
    `Hallo ${input.admin.firstName},`,
    "",
    `dein Betrieb "${input.company.name}" ist jetzt eingerichtet.`,
    "",
    `Betrieb:      ${input.company.name}`,
    `Betriebscode: ${input.company.accessCode ?? "—"}`,
    `Deine Rolle:  Administrator`,
    "",
    "Den Betriebscode brauchen deine Mitarbeiter, um sich anzumelden.",
    "Gib ihn nur an Personen weiter, die Zugang haben sollen.",
    "",
    APP_BASE_URL ? `Zum Dashboard: ${APP_BASE_URL}` : "",
    "",
    "Deine naechsten Schritte:",
    "1. Lege deine ersten Auftraege an",
    "2. Lade Mitarbeiter ein",
    "3. Plane Einsaetze per Drag & Drop",
    "",
    "Bei Fragen antworte einfach auf diese E-Mail.",
    "",
    "— Dein Meisterplaner-Team",
  ]
    .filter(Boolean)
    .join("\n");
}

function getHtmlBody(input: WelcomeInput) {
  const firstName = escapeHtml(input.admin.firstName);
  const companyName = escapeHtml(input.company.name);
  const accessCode = escapeHtml(input.company.accessCode ?? "—");
  const dashboardUrl = APP_BASE_URL || "#";

  const body = `
    <p style="font-size:16px;color:#111827;line-height:1.6;margin:0 0 16px;">
      Hallo ${firstName},
    </p>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
      dein Betrieb <strong>&bdquo;${companyName}&ldquo;</strong> ist jetzt eingerichtet.
    </p>

    ${emailInfoBox([
      { label: "Betrieb", value: input.company.name },
      { label: "Betriebscode", value: input.company.accessCode ?? "—" },
      { label: "Deine Rolle", value: "Administrator" },
    ])}

    <p style="font-size:14px;color:#6B7280;line-height:1.5;margin:0 0 8px;">
      Den Betriebscode brauchen deine Mitarbeiter, um sich anzumelden.
      Gib ihn nur an Personen weiter, die Zugang haben sollen.
    </p>

    ${emailButton("Zum Dashboard", dashboardUrl)}

    <p style="font-size:15px;font-weight:600;color:#111827;margin:24px 0 8px;">
      Deine n&auml;chsten Schritte
    </p>

    ${emailSteps([
      "Lege deine ersten Auftr\u00e4ge an",
      "Lade Mitarbeiter ein",
      "Plane Eins\u00e4tze per Drag & Drop",
    ])}

    <p style="font-size:14px;color:#6B7280;line-height:1.5;margin:24px 0 0;">
      Bei Fragen antworte einfach auf diese E-Mail.
    </p>
    <p style="font-size:14px;color:#6B7280;margin:8px 0 0;">
      — Dein Meisterplaner-Team
    </p>`;

  return wrapEmailLayout(body);
}

function truncateError(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 300);
}

async function sendViaResend(input: WelcomeInput): Promise<WelcomeEmailResult> {
  if (!RESEND_API_KEY || !INVITATION_EMAIL_FROM) {
    return { status: "failed", delivered: false, message: "Resend ist nicht konfiguriert." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: INVITATION_EMAIL_FROM,
      to: [input.adminEmail],
      reply_to: INVITATION_EMAIL_REPLY_TO,
      subject: getSubject(input.company.name),
      html: getHtmlBody(input),
      text: getTextBody(input),
    }),
  });

  if (!response.ok) {
    const raw = (await response.text()) || response.statusText;
    return { status: "failed", delivered: false, message: `Resend: ${truncateError(raw)}` };
  }

  return { status: "sent", delivered: true, message: "Welcome-Email gesendet." };
}

async function sendViaSMTPWelcome(input: WelcomeInput): Promise<WelcomeEmailResult> {
  const result = await sendViaSMTP({
    to: input.adminEmail,
    subject: getSubject(input.company.name),
    html: getHtmlBody(input),
    text: getTextBody(input),
  });

  if (!result.success) {
    return { status: "failed", delivered: false, message: `SMTP: ${result.error}` };
  }

  return { status: "sent", delivered: true, message: "Welcome-Email gesendet." };
}

export async function sendWelcomeEmail(input: WelcomeInput): Promise<WelcomeEmailResult> {
  if (INVITATION_EMAIL_PROVIDER === "disabled") {
    return { status: "skipped", delivered: false, message: "E-Mail-Versand deaktiviert." };
  }

  if (INVITATION_EMAIL_PROVIDER === "log") {
    console.info("[welcome-email]", JSON.stringify({
      companyId: input.company.id,
      companyName: input.company.name,
      adminEmail: input.adminEmail,
      accessCode: input.company.accessCode,
    }, null, 2));
    return { status: "logged", delivered: true, message: "Welcome-Email im Log ausgegeben." };
  }

  if (INVITATION_EMAIL_PROVIDER === "smtp") {
    return sendViaSMTPWelcome(input);
  }

  return sendViaResend(input);
}
