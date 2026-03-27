import { sendViaSMTP } from "./smtpTransport.js";

export async function sendVerificationEmail(options: {
  email: string;
  firstName?: string;
  token: string;
  baseUrl: string;
}) {
  const verifyUrl = `${options.baseUrl}/api/auth/verify-email?token=${options.token}`;
  const name = options.firstName || "Nutzer";

  const subject = "Meisterplaner: E-Mail-Adresse bestaetigen";

  const html = `
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

  const text = `Hallo ${name},\n\nBitte bestaetigen Sie Ihre E-Mail-Adresse: ${verifyUrl}\n\nDieser Link ist 7 Tage gueltig.`;

  const result = await sendViaSMTP({
    to: options.email,
    subject,
    html,
    text,
  });

  if (!result.success) {
    console.error("[email-verify] SMTP error:", result.error);
  }

  return result;
}

export async function sendPasswordResetEmail(options: {
  email: string;
  firstName?: string;
  token: string;
  baseUrl: string;
}) {
  const resetUrl = `${options.baseUrl}/reset-password?token=${options.token}`;
  const name = options.firstName || "Nutzer";

  const subject = "Meisterplaner: Passwort zuruecksetzen";

  const html = `
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

  const text = `Hallo ${name},\n\nPasswort zuruecksetzen: ${resetUrl}\n\nDieser Link ist 1 Stunde gueltig.`;

  const result = await sendViaSMTP({
    to: options.email,
    subject,
    html,
    text,
  });

  if (!result.success) {
    console.error("[password-reset] SMTP error:", result.error);
  }

  return result;
}
