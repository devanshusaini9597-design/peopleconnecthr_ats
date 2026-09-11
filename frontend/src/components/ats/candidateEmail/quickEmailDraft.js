/**
 * Quick-send starters — plain subject/body the user can edit on the spot.
 * Keep wording aligned with backend/services/quickEmailContent.js
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  brandColor = '#5b21b6',
  senderName = '',
} = {}) {
  const orgName = String(brand || 'Talent Acquisition').trim() || 'Talent Acquisition';
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(String(brandColor || '').trim())
    ? String(brandColor).trim()
    : '#5b21b6';
  const year = new Date().getFullYear();
  const logo = String(logoUrl || '').trim();
  const safeBrand = escapeHtml(orgName);
  const safeSender = escapeHtml(senderName || '');
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const useWordmark =
    /skillnix/i.test(orgName) || /skillnix/i.test(logo);

  let brandHeader;
  if (logo && useWordmark) {
    brandHeader = `<tr><td style="background:#0b0b0f;padding:28px 32px;text-align:center;">
      <img src="${escapeHtml(logo)}" alt="${safeBrand}" width="220" style="display:inline-block;max-width:220px;width:220px;height:auto;border:0;" />
    </td></tr>`;
  } else if (logo) {
    brandHeader = `<tr><td style="background:#0b0b0f;padding:22px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="48" valign="middle"><img src="${escapeHtml(logo)}" alt="${safeBrand}" width="40" height="40" style="display:block;width:40px;height:40px;border:0;border-radius:8px;object-fit:contain;" /></td>
        <td valign="middle" style="padding-left:14px;"><p style="margin:0;font-family:${font};font-size:18px;font-weight:700;color:#fff;">${safeBrand}</p></td>
      </tr></table>
    </td></tr>`;
  } else {
    brandHeader = `<tr><td style="background:#0b0b0f;padding:26px 28px;">
      <p style="margin:0;font-family:${font};font-size:20px;font-weight:700;color:#fff;">${safeBrand}</p>
    </td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#eceef2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceef2;padding:48px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e5eb;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${brandHeader}
            <tr><td style="height:4px;background:${accent};background-image:linear-gradient(90deg,#7c3aed 0%,#2563eb 55%,#22d3ee 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr><td style="padding:40px;font-family:${font};font-size:15px;line-height:1.7;color:#3f3f46;">
              <div style="white-space:pre-wrap;">${escapeHtml(body || '')}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 16px 8px 16px;text-align:center;">
          ${safeSender ? `<p style="margin:0 0 12px 0;font-family:${font};font-size:12px;color:#71717a;">Sent by <span style="color:#3f3f46;font-weight:600;">${safeSender}</span></p>` : ''}
          <p style="margin:0 0 6px 0;font-family:${font};font-size:13px;font-weight:700;color:#27272a;">${safeBrand}</p>
          <p style="margin:0;font-family:${font};font-size:11px;color:#a1a1aa;">&copy; ${year} ${safeBrand}. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
