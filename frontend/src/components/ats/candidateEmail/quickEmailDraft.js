/**
 * Quick-send starters — plain subject/body the user can edit on the spot.
 * Keep wording aligned with backend/services/quickEmailContent.js
 */

import { convertPlainEmailBody, escapeHtml } from '../../../utils/emailBodyHtml';

export function buildQuickDraft({
  emailType = 'interview',
  name = 'Candidate',
  position = '',
  department = '',
  joiningDate = '',
  senderName = 'HR Team',
} = {}) {
  const candidate = String(name || 'Candidate').trim() || 'Candidate';
  const role = String(position || '').trim() || 'the open role';
  const sender = String(senderName || 'HR Team').trim() || 'HR Team';
  const dept = String(department || '').trim();
  const join = String(joiningDate || '').trim() || 'To be confirmed';

  switch (emailType) {
    case 'rejection':
      return {
        subject: `Update on your application – ${role}`,
        body: `Dear ${candidate},

Thank you for your interest in the ${role} position. After careful review, we have decided to move forward with other candidates at this time.

We appreciate your time and encourage you to apply for future roles that match your experience.

Best regards,
${sender}`,
      };
    case 'document':
      return {
        subject: `Documents requested – ${role}`,
        body: `Dear ${candidate},

As the next step for the ${role} role, please share the following documents:

• Updated resume
• Valid government ID
• Educational certificates
• Previous employment letters (if applicable)

Please reply with the documents within 3 business days.

Best regards,
${sender}`,
      };
    case 'onboarding':
      return {
        subject: `Welcome – ${role}`,
        body: `Dear ${candidate},

Welcome! We are excited to have you join as ${role}${dept ? ` in ${dept}` : ''}.

Joining date: ${join}

Please complete onboarding formalities and bring the required documents on your first day.

Best regards,
${sender}`,
      };
    case 'custom':
      return {
        subject: 'Message from recruiting team',
        body: `Dear ${candidate},

`,
      };
    case 'interview':
    default:
      return {
        subject: `Interview invitation – ${role}`,
        body: `Dear ${candidate},

We are pleased to invite you for an interview for the ${role} position.

Our team will follow up with interview details including date, time, and format.

If you have any questions, reply to this email.

Best regards,
${sender}`,
      };
  }
}

/**
 * Preview HTML matching the backend premium branded email layout.
 */
export function buildQuickDraftHtml({
  subject,
  body,
  brand = '',
  logoUrl = '',
  brandColor = '#0f766e',
  senderName = '',
  sampleName = '',
} = {}) {
  const orgName = String(brand || 'Talent Acquisition').trim() || 'Talent Acquisition';
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#0f766e';
  const year = new Date().getFullYear();
  const logo = String(logoUrl || '').trim();
  const safeBrand = escapeHtml(orgName);
  const safeSender = escapeHtml(senderName || '');
  const safeSubject = escapeHtml(String(subject || '').trim());
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const useWordmark =
    /skillnix/i.test(orgName) || /skillnix/i.test(logo);

  const inner = convertPlainEmailBody(body || '', {
    brandColor: accent,
    sampleName: sampleName || undefined,
  });

  let brandHeader;
  if (logo && useWordmark) {
    brandHeader = `<tr><td style="background:#111827;padding:22px 40px;">
      <img src="${escapeHtml(logo)}" alt="${safeBrand}" width="168" style="display:block;max-width:168px;width:168px;height:auto;border:0;" />
    </td></tr>`;
  } else if (logo) {
    brandHeader = `<tr><td style="padding:20px 40px;border-bottom:1px solid #e5e7eb;background:#ffffff;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle"><img src="${escapeHtml(logo)}" alt="${safeBrand}" width="36" height="36" style="display:block;width:36px;height:36px;border:0;border-radius:6px;" /></td>
        <td valign="middle" style="padding-left:12px;"><p style="margin:0;font-family:${font};font-size:15px;font-weight:600;color:#111827;">${safeBrand}</p></td>
      </tr></table>
    </td></tr>`;
  } else {
    brandHeader = `<tr><td style="padding:20px 40px;border-bottom:1px solid #e5e7eb;">
      <p style="margin:0;font-family:${font};font-size:15px;font-weight:600;color:#111827;">${safeBrand}</p>
    </td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
            ${brandHeader}
            ${
              safeSubject
                ? `<tr><td style="padding:28px 40px 0 40px;">
              <p style="margin:0 0 8px 0;font-family:${font};font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Opportunity</p>
              <h1 style="margin:0;font-family:${font};font-size:22px;font-weight:600;line-height:1.35;color:#111827;letter-spacing:-0.02em;">${safeSubject}</h1>
            </td></tr>`
                : ''
            }
            <tr><td style="padding:${safeSubject ? '20px' : '32px'} 40px 36px 40px;font-family:${font};font-size:15px;line-height:1.7;color:#374151;">
              ${inner}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 16px 8px 16px;text-align:center;">
          ${safeSender ? `<p style="margin:0 0 12px 0;font-family:${font};font-size:12px;color:#6b7280;">Sent by <span style="color:#111827;font-weight:600;">${safeSender}</span></p>` : ''}
          <p style="margin:0 0 6px 0;font-family:${font};font-size:13px;font-weight:700;color:#111827;">${safeBrand}</p>
          <p style="margin:0;font-family:${font};font-size:11px;color:#9ca3af;">&copy; ${year} ${safeBrand}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
