/**
 * Shared Quick-send email content — preview and send must match.
 */
const { wrapBrandedEmailHtml, brandButtonHtml, escapeHtml } = require('./emailBrandLayout');

function subscribeBlockHtml(subscribeUrl, brandColor = '#0f766e') {
  const href = String(subscribeUrl || '').trim();
  if (!href || !/^https?:\/\//i.test(href)) return '';
  return `<div style="margin:22px 0 8px 0;text-align:center;">${brandButtonHtml({
    href,
    label: 'Subscribe to job & career updates',
    brandColor,
    fullWidth: true,
  })}</div>
  <p style="margin:0 0 4px 0;text-align:center;font-size:12px;line-height:1.5;color:#9ca3af;">Marketing updates on open roles and hiring drives · Unsubscribe anytime</p>
  <p style="margin:12px 0 0 0;text-align:center;font-size:12px;line-height:1.6;color:#6b7280;">
    Prefer ongoing updates?
    <a href="${escapeHtml(href)}" style="color:${brandColor};text-decoration:underline;font-weight:600;">Subscribe to job &amp; career updates</a>
  </p>`;
}

/**
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildQuickEmailContent({
  emailType,
  name = 'Candidate',
  position = '',
  customMessage = '',
  department = '',
  joiningDate = '',
  senderName = 'HR Team',
  subject: subjectOverride = '',
  brand = null,
  subscribeUrl = '',
}) {
  const safeName = escapeHtml(name || 'Candidate');
  const role = String(position || '').trim() || 'the open role';
  const safeRole = escapeHtml(role);
  const sender = senderName || 'HR Team';
  const orgName = brand?.name || 'Talent Acquisition';
  const logoUrl = brand?.logoUrl || '';
  const brandColor = brand?.brandColor || '#0f766e';
  const wordmark = brand?.wordmark;
  const subHtml = subscribeBlockHtml(subscribeUrl, brandColor);

  const wrap = ({ title, bodyHtml, includeSignOff = true, category = '' }) =>
    wrapBrandedEmailHtml({
      title,
      category,
      bodyHtml: `${bodyHtml}${subHtml}`,
      orgName,
      logoUrl,
      brandColor,
      senderName: sender,
      includeSignOff,
      wordmark,
      websiteUrl: brand?.websiteUrl || '',
      supportEmail: brand?.supportEmail || '',
      socialLinks: brand?.socialLinks || {},
      companyAddress: brand?.companyAddress || '',
    });

  switch (emailType) {
    case 'interview':
      return {
        subject: `Interview invitation – ${role}`,
        html: wrap({
          title: 'Interview invitation',
          category: 'interview',
          bodyHtml: `
            <p style="margin:0 0 16px 0;font-size:15px;color:#0f172a;font-weight:600;">Dear ${safeName},</p>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.7;">We are pleased to invite you for an interview for the <strong style="color:#0f172a;">${safeRole}</strong> position.</p>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.7;">Our team will follow up with interview details including date, time, and format.</p>
            <p style="margin:0;color:#334155;line-height:1.7;">If you have any questions, reply to this email.</p>`,
        }),
        text: `Dear ${name || 'Candidate'},\n\nWe are pleased to invite you for an interview for the ${role} position.\nOur team will follow up with interview details.\n\nBest regards,\n${sender}\n\n${orgName}`,
      };

    case 'rejection':
      return {
        subject: `Update on your application – ${role}`,
        html: wrap({
          title: 'Application update',
          category: 'rejection',
          bodyHtml: `
            <p style="margin:0 0 16px 0;font-size:15px;color:#0f172a;font-weight:600;">Dear ${safeName},</p>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.7;">Thank you for your interest in the <strong style="color:#0f172a;">${safeRole}</strong> position. After careful review, we have decided to move forward with other candidates at this time.</p>
            <p style="margin:0;color:#334155;line-height:1.7;">We appreciate your time and encourage you to apply for future roles that match your experience.</p>`,
        }),
        text: `Dear ${name || 'Candidate'},\n\nThank you for your interest in the ${role} position. We have decided to move forward with other candidates at this time.\n\nBest regards,\n${sender}\n\n${orgName}`,
      };

    case 'document':
      return {
        subject: `Documents requested – ${role}`,
        html: wrap({
          title: 'Documents requested',
          category: 'document',
          bodyHtml: `
            <p style="margin:0 0 16px 0;font-size:15px;color:#0f172a;font-weight:600;">Dear ${safeName},</p>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.7;">As the next step for the <strong style="color:#0f172a;">${safeRole}</strong> role, please share the following documents:</p>
            <ul style="margin:0 0 12px 0;padding-left:18px;color:#334155;line-height:1.8;">
              <li>Updated resume</li>
              <li>Valid government ID</li>
              <li>Educational certificates</li>
              <li>Previous employment letters (if applicable)</li>
            </ul>
            <p style="margin:0;color:#334155;line-height:1.7;">Please reply with the documents within 3 business days.</p>`,
        }),
        text: `Dear ${name || 'Candidate'},\n\nPlease share the required documents for the ${role} role.\n\nBest regards,\n${sender}\n\n${orgName}`,
      };

    case 'onboarding':
      return {
        subject: `Welcome – ${role}`,
        html: wrap({
          title: 'Welcome aboard',
          category: 'onboarding',
          bodyHtml: `
            <p style="margin:0 0 16px 0;font-size:15px;color:#0f172a;font-weight:600;">Dear ${safeName},</p>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.7;">Welcome! We are excited to have you join as <strong style="color:#0f172a;">${safeRole}</strong>${department ? ` in <strong style="color:#0f172a;">${escapeHtml(department)}</strong>` : ''}.</p>
            <p style="margin:0 0 12px 0;color:#334155;line-height:1.7;"><strong style="color:#0f172a;">Joining date:</strong> ${escapeHtml(joiningDate || 'To be confirmed')}</p>
            <p style="margin:0;color:#334155;line-height:1.7;">Please complete onboarding formalities and bring the required documents on your first day.</p>`,
        }),
        text: `Dear ${name || 'Candidate'},\n\nWelcome! You are joining as ${role}${department ? ` in ${department}` : ''}. Joining date: ${joiningDate || 'To be confirmed'}.\n\nBest regards,\n${sender}\n\n${orgName}`,
      };

    case 'custom': {
      const subject = (subjectOverride || '').trim() || 'Message from recruiting team';
      // Full edited body already includes greeting / sign-off — no extra title or sign-off.
      return {
        subject,
        html: wrap({
          title: '',
          includeSignOff: false,
          bodyHtml: `<div style="color:#334155;white-space:pre-wrap;line-height:1.65;">${escapeHtml(customMessage || '')}</div>`,
        }),
        text: `${String(customMessage || '').trim()}\n\n${orgName}`,
      };
    }

    default:
      return null;
  }
}

module.exports = {
  buildQuickEmailContent,
  escapeHtml,
};
