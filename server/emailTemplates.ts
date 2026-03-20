/**
 * Shared email layout and helpers for all Meisterplaner transactional emails.
 * All styles are inline (email clients strip <style> tags).
 */

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export { escapeHtml };

export function emailButton(label: string, href: string) {
  const safeHref = escapeHtml(href);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:8px;background:#111827;" align="center">
          <a href="${safeHref}" target="_blank"
             style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#F59E0B;text-decoration:none;border-radius:8px;">
            ${escapeHtml(label)} &rarr;
          </a>
        </td>
      </tr>
    </table>`;
}

export function emailInfoBox(rows: Array<{ label: string; value: string }>) {
  const rowsHtml = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 16px;color:#6B7280;font-size:14px;white-space:nowrap;">${escapeHtml(r.label)}</td>
        <td style="padding:8px 16px;font-weight:600;color:#111827;font-size:14px;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0"
           style="width:100%;border:1px solid #E5E7EB;border-radius:8px;margin:20px 0;border-collapse:separate;">
      ${rowsHtml}
    </table>`;
}

export function emailSteps(steps: string[]) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      ${steps
        .map(
          (step, i) => `
        <tr>
          <td style="padding:6px 12px 6px 0;vertical-align:top;">
            <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;background:#F59E0B;color:#111827;font-weight:700;font-size:14px;">${i + 1}</span>
          </td>
          <td style="padding:8px 0;color:#374151;font-size:15px;">${escapeHtml(step)}</td>
        </tr>`,
        )
        .join("")}
    </table>`;
}

export function wrapEmailLayout(bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:24px 32px;border-radius:12px 12px 0 0;">
              <span style="font-size:22px;font-weight:700;color:#F59E0B;">&#9889;</span>
              <span style="font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;"> Meisterplaner</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;padding:32px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid #E5E7EB;border-top:none;">
              <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5;">
                &copy; ${new Date().getFullYear()} Meisterplaner &middot; Die einfache Einsatzplanung f&uuml;rs Handwerk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
