import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { Writable } from "node:stream";

interface CredentialsData {
  companyName: string;
  employeeName: string;
  loginUrl: string;
  accessCode: string;
  loginId: string;
  temporaryPassword: string;
}

/**
 * Generates a single-page A4 PDF with employee login credentials and a QR code.
 * The QR code links to the login page with pre-filled access code and username.
 */
export async function generateCredentialsPdf(
  data: CredentialsData,
  output: Writable,
): Promise<void> {
  const qrUrl = `${data.loginUrl}?code=${encodeURIComponent(data.accessCode)}&user=${encodeURIComponent(data.loginId)}`;
  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    width: 160,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60 });
    doc.pipe(output);

    // Header
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("Meisterplaner", { align: "center" });
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666666")
      .text("Einsatzplanung fuer Handwerksbetriebe", { align: "center" });
    doc.moveDown(1.5);

    // Divider
    doc
      .strokeColor("#e0e0e0")
      .lineWidth(1)
      .moveTo(60, doc.y)
      .lineTo(535, doc.y)
      .stroke();
    doc.moveDown(1);

    // Title
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .fillColor("#173d66")
      .text(`Zugangsdaten fuer ${data.employeeName}`);
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#444444")
      .text(`Firma: ${data.companyName}`);
    doc.moveDown(1.5);

    // QR Code + Credentials side by side
    const startY = doc.y;

    // QR Code (left side)
    doc.image(qrBuffer, 60, startY, { width: 140 });

    // Credentials (right side)
    const rightX = 230;
    const labelStyle = { continued: false } as const;

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#888888")
      .text("Betriebscode", rightX, startY, labelStyle);
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#173d66")
      .text(data.accessCode, rightX, doc.y);
    doc.moveDown(0.8);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#888888")
      .text("Benutzername", rightX, doc.y, labelStyle);
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#173d66")
      .text(data.loginId, rightX, doc.y);
    doc.moveDown(0.8);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#888888")
      .text("Passwort", rightX, doc.y, labelStyle);
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#173d66")
      .text(data.temporaryPassword, rightX, doc.y);
    doc.moveDown(0.8);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#888888")
      .text("Login-Adresse", rightX, doc.y, labelStyle);
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#173d66")
      .text(data.loginUrl, rightX, doc.y);

    // Move below QR code area
    doc.y = Math.max(doc.y, startY + 160);
    doc.moveDown(2);

    // Divider
    doc
      .strokeColor("#e0e0e0")
      .lineWidth(1)
      .moveTo(60, doc.y)
      .lineTo(535, doc.y)
      .stroke();
    doc.moveDown(1);

    // Instructions
    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .fillColor("#173d66")
      .text("So meldest du dich an:");
    doc.moveDown(0.5);

    const steps = [
      "QR-Code mit dem Handy scannen — oder die Login-Adresse im Browser oeffnen.",
      "Betriebscode und Benutzername sind bereits vorausgefuellt. Gib dein Passwort ein.",
      "Beim ersten Login wirst du aufgefordert, ein eigenes Passwort zu vergeben.",
    ];

    steps.forEach((step, i) => {
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#173d66")
        .text(`${i + 1}. `, 60, doc.y, { continued: true })
        .font("Helvetica")
        .fillColor("#333333")
        .text(step);
      doc.moveDown(0.4);
    });

    doc.moveDown(1.5);

    // Footer note
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#999999")
      .text(
        "Dieses Dokument enthaelt vertrauliche Zugangsdaten. Bitte sicher aufbewahren und nicht an Dritte weitergeben.",
        60,
        doc.y,
        { align: "center", width: 475 },
      );

    doc.end();
    output.on("finish", resolve);
    output.on("error", reject);
  });
}
