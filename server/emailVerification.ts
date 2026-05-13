import {
  INVITATION_EMAIL_FROM,
  INVITATION_EMAIL_PROVIDER,
  INVITATION_EMAIL_REPLY_TO,
  RESEND_API_KEY,
} from "./runtimeConfig.js";
import { sendViaSMTP } from "./smtpTransport.js";

export type EmailVerificationResult = {
  status: "sent" | "logged" | "skipped" | "failed";
  delivered: boolean;
  message: string;
};

type VerifyInput = {
  email: string;
  firstName?: string;
  token: string;
  baseUrl: string;
};

type ResetInput = VerifyInput;

function truncateError(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 300);
}

function buildVerifySubject() {
  return "Meisterplaner: E-Mail-Adresse bestaetigen";
}

function buildVerifyHtml(name: string, verifyUrl: string) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #173d66; margin-bottom: 8px;">Willkommen bei Meisterplaner</h2>
      <p>Hallo ${name},</p>
      <p>Bitte bestaetigen Sie Ihre E-Mail-Adresse, um Ihren Account zu aktivieren.</p>
      <a href="${verifyUrl}" style="display: inline-block; background: #173d66; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
        E-Mail bestaetigen
      </a>
      <p style="color: #666; font-size: 13px;">Oder kopieren Sie diesen Link:<br>${verifyUrl}</p>
      <p style="color: #999; font-size: 12px;">Dieser Link ist 7 Tage gueltig. Falls Sie sich nicht registriert haben, ignorieren Sie diese E-Mail.</p>
    </div>
  `;
}

function buildVerifyText(name: string, verifyUrl: string) {
  return `Hallo ${name},\n\nBitte bestaetigen Sie Ihre E-Mail-Adresse: ${verifyUrl}\n\nDieser Link ist 7 Tage gueltig.`;
}

function buildResetSubject() {
  return "Meisterplaner: Passwort zuruecksetzen";
}

function buildResetHtml(name: string, resetUrl: string) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #173d66; margin-bottom: 8px;">Passwort zuruecksetzen</h2>
      <p>Hallo ${name},</p>
      <p>Sie haben angefordert, Ihr Passwort zurueckzusetzen. Klicken Sie auf den Button um ein neues Passwort zu vergeben.</p>
      <a href="${resetUrl}" style="display: inline-block; background: #173d66; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
        Neues Passwort setzen
      </a>
      <p style="color: #666; font-size: 13px;">Oder kopieren Sie diesen Link:<br>${resetUrl}</p>
      <p style="color: #999; font-size: 12px;">Dieser Link ist 1 Stunde gueltig. Falls Sie kein neues Passwort angefordert haben, ignorieren Sie diese E-Mail.</p>
    </div>
  `;
}

function buildResetText(name: string, resetUrl: string) {
  return `Hallo ${name},\n\nPasswort zuruecksetzen: ${resetUrl}\n\nDieser Link ist 1 Stunde gueltig.`;
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<EmailVerificationResult> {
  if (!RESEND_API_KEY || !INVITATION_EMAIL_FROM) {
    return { status: "failed", delivered: false, message: "Resend ist nicht konfiguriert." };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: INVITATION_EMAIL_FROM,
      to: [to],
      reply_to: INVITATION_EMAIL_REPLY_TO,
      subject,
      html,
      text,
    }),
  });
  if (!response.ok) {
    const raw = (await response.text()) || response.statusText;
    return { status: "failed", delivered: false, message: `Resend: ${truncateError(raw)}` };
  }
  return { status: "sent", delivered: true, message: "E-Mail gesendet." };
}

async function sendViaSMTPWrapped(
  to: string,
  subject: string,
  html: string,
  text: string,
  context: string,
): Promise<EmailVerificationResult> {
  const result = await sendViaSMTP({ to, subject, html, text });
  if (!result.success) {
    console.error(`[${context}] SMTP error:`, result.error);
    return { status: "failed", delivered: false, message: `SMTP: ${result.error}` };
  }
  return { status: "sent", delivered: true, message: "E-Mail gesendet." };
}

function dispatch(
  to: string,
  subject: string,
  html: string,
  text: string,
  context: string,
): Promise<EmailVerificationResult> {
  if (INVITATION_EMAIL_PROVIDER === "disabled") {
    return Promise.resolve({
      status: "skipped",
      delivered: false,
      message: "E-Mail-Versand deaktiviert.",
    });
  }
  if (INVITATION_EMAIL_PROVIDER === "log") {
    console.info(`[${context}]`, JSON.stringify({ to, subject }, null, 2));
    return Promise.resolve({
      status: "logged",
      delivered: true,
      message: "E-Mail im Log ausgegeben.",
    });
  }
  if (INVITATION_EMAIL_PROVIDER === "smtp") {
    return sendViaSMTPWrapped(to, subject, html, text, context);
  }
  return sendViaResend(to, subject, html, text);
}

export async function sendVerificationEmail(options: VerifyInput) {
  const verifyUrl = `${options.baseUrl}/api/auth/verify-email?token=${options.token}`;
  const name = options.firstName || "Nutzer";
  return dispatch(
    options.email,
    buildVerifySubject(),
    buildVerifyHtml(name, verifyUrl),
    buildVerifyText(name, verifyUrl),
    "email-verify",
  );
}

export async function sendPasswordResetEmail(options: ResetInput) {
  const resetUrl = `${options.baseUrl}/reset-password?token=${options.token}`;
  const name = options.firstName || "Nutzer";
  return dispatch(
    options.email,
    buildResetSubject(),
    buildResetHtml(name, resetUrl),
    buildResetText(name, resetUrl),
    "password-reset",
  );
}
