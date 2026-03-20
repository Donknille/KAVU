import nodemailer from "nodemailer";
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  INVITATION_EMAIL_FROM,
  INVITATION_EMAIL_REPLY_TO,
} from "./runtimeConfig.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendViaSMTP(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !INVITATION_EMAIL_FROM) {
    return { success: false, error: "SMTP ist nicht vollständig konfiguriert." };
  }

  try {
    await getTransporter().sendMail({
      from: INVITATION_EMAIL_FROM,
      to: options.to,
      replyTo: INVITATION_EMAIL_REPLY_TO,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return { success: true };
  } catch (err: any) {
    const message = err?.message || String(err);
    return { success: false, error: message.slice(0, 300) };
  }
}
